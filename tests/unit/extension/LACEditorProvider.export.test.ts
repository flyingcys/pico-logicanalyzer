import * as vscode from 'vscode';

const exportWaveformData = jest.fn();
const initialize = jest.fn();
const dispose = jest.fn();
const overwriteExportedLacFile = jest.fn();
const showSaveDialog = jest.fn();
const showInformationMessage = jest.fn();
const showErrorMessage = jest.fn();

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs') as typeof import('fs');
  return {
    ...actualFs,
    promises: {
      ...actualFs.promises,
      writeFile: overwriteExportedLacFile
    }
  };
});

jest.mock('vscode', () => ({
  commands: { executeCommand: jest.fn() },
  window: {
    registerCustomEditorProvider: jest.fn(),
    showInformationMessage,
    showErrorMessage,
    showSaveDialog
  },
  workspace: {
    applyEdit: jest.fn(),
    onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() }))
  },
  Uri: {
    joinPath: jest.fn(),
    file: jest.fn((filePath: string) => ({ fsPath: filePath }))
  },
  Range: jest.fn(),
  WorkspaceEdit: jest.fn()
}), { virtual: true });

jest.mock('../../../src/services/DataExportService', () => ({
  DataExportService: jest.fn().mockImplementation(() => ({
    initialize,
    dispose,
    exportWaveformData
  }))
}));

jest.mock('../../../src/drivers/HardwareDriverManager', () => ({
  hardwareDriverManager: {
    getCurrentDevice: jest.fn(() => null),
    disconnectCurrentDevice: jest.fn(),
    connectToDevice: jest.fn()
  }
}));

jest.mock('../../../src/services/NetworkStabilityService', () => ({
  NetworkStabilityService: jest.fn().mockImplementation(() => ({
    disconnect: jest.fn(),
    connect: jest.fn(),
    runDiagnostics: jest.fn()
  }))
}));

jest.mock('../../../src/services/WiFiDeviceDiscovery', () => ({
  WiFiDeviceDiscovery: jest.fn().mockImplementation(() => ({
    scanForDevices: jest.fn(),
    stopScan: jest.fn(),
    getCachedDevices: jest.fn()
  }))
}));

import { LACEditorProvider } from '../../../src/providers/LACEditorProvider';
import { buildWebviewExportRequest } from '../../../src/frontend/core/services/exportRequestService';

function createProvider(): LACEditorProvider {
  return new LACEditorProvider({ extensionUri: { fsPath: '/tmp/extension' } } as any);
}

function createDocument(): vscode.TextDocument {
  return {
    getText: () => JSON.stringify({
      Settings: {
        Frequency: 1000,
        PreTriggerSamples: 0,
        PostTriggerSamples: 6,
        CaptureChannels: [
          { ChannelNumber: 0, ChannelName: 'D0', Hidden: false },
          { ChannelNumber: 1, ChannelName: 'D1', Hidden: false }
        ]
      },
      Samples: [
        '00000000000000000000000000000001',
        '00000000000000000000000000000002',
        '00000000000000000000000000000003',
        '00000000000000000000000000000000',
        '00000000000000000000000000000001',
        '00000000000000000000000000000002'
      ]
    }),
    lineCount: 1,
    uri: { toString: () => 'file:///tmp/capture.lac', fsPath: '/tmp/capture.lac' }
  } as any;
}

describe('LACEditorProvider exportData 用户路径补强', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    initialize.mockResolvedValue(true);
    dispose.mockResolvedValue(true);
    overwriteExportedLacFile.mockResolvedValue(undefined);
    exportWaveformData.mockResolvedValue({
      success: true,
      filename: '/tmp/export.csv',
      mimeType: 'text/csv',
      size: 16
    });
  });

  it('用户取消保存对话框时不应初始化导出服务或提示错误', async () => {
    showSaveDialog.mockResolvedValue(undefined);

    await (createProvider() as any).exportData(createDocument(), { format: 'csv' });

    expect(showSaveDialog).toHaveBeenCalled();
    expect(initialize).not.toHaveBeenCalled();
    expect(exportWaveformData).not.toHaveBeenCalled();
    expect(showErrorMessage).not.toHaveBeenCalled();
    expect(showInformationMessage).not.toHaveBeenCalled();
  });

  it('保存失败时应显示导出失败并释放导出服务', async () => {
    showSaveDialog.mockResolvedValue({ fsPath: '/tmp/export.csv' });
    exportWaveformData.mockResolvedValue({
      success: false,
      filename: '/tmp/export.csv',
      mimeType: 'text/csv',
      size: 0,
      error: '权限不足：无法写入文件'
    });

    await (createProvider() as any).exportData(createDocument(), { format: 'csv' });

    expect(exportWaveformData).toHaveBeenCalled();
    expect(showErrorMessage).toHaveBeenCalledWith('导出数据失败: 权限不足：无法写入文件');
    expect(showInformationMessage).not.toHaveBeenCalled();
    expect(dispose).toHaveBeenCalled();
  });

  it('保存失败返回对象错误时应优先显示 message', async () => {
    showSaveDialog.mockResolvedValue({ fsPath: '/tmp/export.csv' });
    exportWaveformData.mockResolvedValue({
      success: false,
      filename: '/tmp/export.csv',
      mimeType: 'text/csv',
      size: 0,
      error: { message: '磁盘不可写' }
    });

    await (createProvider() as any).exportData(createDocument(), { format: 'csv' });

    expect(showErrorMessage).toHaveBeenCalledWith('导出数据失败: 磁盘不可写');
    expect(showErrorMessage).not.toHaveBeenCalledWith(expect.stringContaining('[object Object]'));
    expect(showInformationMessage).not.toHaveBeenCalled();
    expect(dispose).toHaveBeenCalled();
  });

  it('导出服务抛出对象错误时应优先显示 message 并释放导出服务', async () => {
    showSaveDialog.mockResolvedValue({ fsPath: '/tmp/export.csv' });
    exportWaveformData.mockRejectedValue({ message: '导出目录不存在' });

    await (createProvider() as any).exportData(createDocument(), { format: 'csv' });

    expect(showErrorMessage).toHaveBeenCalledWith('导出数据失败: 导出目录不存在');
    expect(showErrorMessage).not.toHaveBeenCalledWith(expect.stringContaining('[object Object]'));
    expect(showInformationMessage).not.toHaveBeenCalled();
    expect(dispose).toHaveBeenCalled();
  });

  it('不支持的格式应在打开保存对话框前拒绝', async () => {
    await (createProvider() as any).exportData(createDocument(), { format: 'pdf' });

    expect(showSaveDialog).not.toHaveBeenCalled();
    expect(exportWaveformData).not.toHaveBeenCalled();
    expect(showErrorMessage).toHaveBeenCalledWith('导出数据失败: 不支持的导出格式: pdf');
  });

  it('应把 webview selection 请求转换为显式 custom 范围', async () => {
    showSaveDialog.mockResolvedValue({ fsPath: '/tmp/export.csv' });

    await (createProvider() as any).exportData(createDocument(), {
      source: 'webview',
      format: 'csv',
      timeRange: 'selection',
      selection: { startSample: 1, endSample: 3, channelIndex: 0 },
      selectedChannels: [0]
    });

    expect(exportWaveformData).toHaveBeenCalledWith(
      expect.any(Object),
      'csv',
      expect.objectContaining({
        filename: '/tmp/export.csv',
        timeRange: 'custom',
        customStart: 1,
        customEnd: 4,
        selectedChannels: [0]
      })
    );
  });

  it('应把 webview visible 请求转换为显式 custom 范围', async () => {
    showSaveDialog.mockResolvedValue({ fsPath: '/tmp/export.vcd' });

    await (createProvider() as any).exportData(createDocument(), {
      source: 'webview',
      format: 'vcd',
      timeRange: 'visible',
      visibleRange: { firstSample: 2, visibleSamples: 3 },
      selectedChannels: [1]
    });

    expect(exportWaveformData).toHaveBeenCalledWith(
      expect.any(Object),
      'vcd',
      expect.objectContaining({
        filename: '/tmp/export.vcd',
        timeRange: 'custom',
        customStart: 2,
        customEnd: 5,
        selectedChannels: [1]
      })
    );
  });

  it('应把 webview custom 请求转换为显式 custom 范围', async () => {
    showSaveDialog.mockResolvedValue({ fsPath: '/tmp/export.json' });

    await (createProvider() as any).exportData(createDocument(), {
      source: 'webview',
      format: 'json',
      timeRange: 'custom',
      customStart: 2,
      customEnd: 5,
      selectedChannels: [0, 1]
    });

    expect(exportWaveformData).toHaveBeenCalledWith(
      expect.any(Object),
      'json',
      expect.objectContaining({
        filename: '/tmp/export.json',
        timeRange: 'custom',
        customStart: 2,
        customEnd: 5,
        selectedChannels: [0, 1]
      })
    );
  });

  it('应接受真实 webview builder 生成的 selection 半开 custom 范围', async () => {
    showSaveDialog.mockResolvedValue({ fsPath: '/tmp/export.csv' });

    const request = buildWebviewExportRequest(
      { fileName: 'capture.lac' },
      {
        channels: [
          { channelNumber: 0, hidden: false },
          { channelNumber: 1, hidden: true },
          { channelNumber: 2, hidden: false }
        ],
        selection: { startSample: 1, endSample: 3, channelIndex: 0 },
        viewRange: { firstSample: 0, visibleSamples: 6 },
        markers: [],
        lastMeasurement: null,
        exportSelectedRegionsForLac: () => []
      },
      'csv'
    );

    await (createProvider() as any).exportData(createDocument(), request);

    expect(exportWaveformData).toHaveBeenCalledWith(
      expect.any(Object),
      'csv',
      expect.objectContaining({
        filename: '/tmp/export.csv',
        timeRange: 'custom',
        customStart: 1,
        customEnd: 4,
        selectedChannels: [0, 2]
      })
    );
  });

  it('webview all 请求应忽略残留 custom 范围', async () => {
    showSaveDialog.mockResolvedValue({ fsPath: '/tmp/export.csv' });

    await (createProvider() as any).exportData(createDocument(), {
      source: 'webview',
      format: 'csv',
      timeRange: 'all',
      customStart: 2,
      customEnd: 5,
      selectedChannels: [0, 1]
    });

    const exportOptions = exportWaveformData.mock.calls[0][2];
    expect(exportOptions).toEqual(expect.objectContaining({
      filename: '/tmp/export.csv',
      timeRange: 'all',
      selectedChannels: [0, 1]
    }));
    expect(exportOptions.customStart).toBeUndefined();
    expect(exportOptions.customEnd).toBeUndefined();
  });

  it('webview lac 导出应把 selectedRegions 写入导出内容', async () => {
    showSaveDialog.mockResolvedValue({ fsPath: '/tmp/export.lac' });
    exportWaveformData.mockResolvedValue({
      success: true,
      filename: '/tmp/export.lac',
      mimeType: 'application/octet-stream',
      size: 256,
      data: JSON.stringify({
        Settings: {
          Frequency: 1000,
          PreTriggerSamples: 0,
          PostTriggerSamples: 3,
          CaptureChannels: [{ ChannelNumber: 0, ChannelName: 'D0', Hidden: false }]
        },
        Samples: [
          '00000000000000000000000000000001',
          '00000000000000000000000000000000',
          '00000000000000000000000000000001'
        ]
      })
    });

    await (createProvider() as any).exportData(createDocument(), {
      source: 'webview',
      format: 'lac',
      timeRange: 'custom',
      customStart: 1,
      customEnd: 4,
      selectedChannels: [0],
      selectedRegions: [
        {
          firstSample: 0,
          lastSample: 2,
          regionName: '保留区域',
          color: 'rgba(255, 0, 0, 0.5)'
        },
        {
          firstSample: 2,
          lastSample: 5,
          regionName: '截断区域',
          color: 'rgba(0, 128, 255, 1)'
        },
        {
          firstSample: 5,
          lastSample: 6,
          regionName: '越界区域',
          color: 'rgba(0, 0, 0, 1)'
        }
      ]
    });

    expect(exportWaveformData).toHaveBeenCalledWith(
      expect.any(Object),
      'lac',
      expect.objectContaining({
        filename: '/tmp/export.lac',
        timeRange: 'custom',
        customStart: 1,
        customEnd: 4,
        selectedChannels: [0]
      })
    );
    expect(showInformationMessage).toHaveBeenCalledWith('数据已导出到: /tmp/export.lac');

    expect(overwriteExportedLacFile).toHaveBeenCalledWith(
      '/tmp/export.lac',
      expect.any(String),
      'utf-8'
    );

    expect(JSON.parse(overwriteExportedLacFile.mock.calls[0][1])).toMatchObject({
      SelectedRegions: [
        {
          FirstSample: 0,
          LastSample: 1,
          RegionName: '保留区域',
          R: 255,
          G: 0,
          B: 0,
          A: 128
        },
        {
          FirstSample: 1,
          LastSample: 2,
          RegionName: '截断区域',
          R: 0,
          G: 128,
          B: 255,
          A: 255
        }
      ]
    });
  });
});
