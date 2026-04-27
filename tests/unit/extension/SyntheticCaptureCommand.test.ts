import * as vscode from 'vscode';
import { activate, deactivate } from '../../../src/extension';
import { LACFileFormat } from '../../../src/models/LACFileFormat';

jest.mock('vscode', () => ({
  commands: {
    registerCommand: jest.fn((_command: string, _handler: Function) => ({ dispose: jest.fn() })),
    executeCommand: jest.fn()
  },
  window: {
    activeTextEditor: undefined,
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showInputBox: jest.fn(),
    showQuickPick: jest.fn(),
    showSaveDialog: jest.fn()
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
    fs: {
      writeFile: jest.fn()
    }
  },
  Uri: {
    file: jest.fn((fsPath: string) => ({ fsPath }))
  },
  ProgressLocation: {
    Notification: 15
  }
}), { virtual: true });

jest.mock('../../../src/providers/LACEditorProvider', () => ({
  LACEditorProvider: {
    register: jest.fn().mockReturnValue({ dispose: jest.fn() })
  }
}));

jest.mock('../../../src/drivers/HardwareDriverManager', () => ({
  hardwareDriverManager: {
    detectHardware: jest.fn().mockResolvedValue([]),
    getCurrentDevice: jest.fn().mockReturnValue(null),
    getCurrentDeviceInfo: jest.fn().mockReturnValue(null),
    dispose: jest.fn().mockResolvedValue(undefined)
  }
}));

jest.mock('../../../src/services/WiFiDeviceDiscovery', () => ({
  WiFiDeviceDiscovery: jest.fn().mockImplementation(() => ({
    scanForDevices: jest.fn().mockResolvedValue({ devices: [] }),
    stopScan: jest.fn(),
    clearCache: jest.fn()
  }))
}));

jest.mock('../../../src/services/NetworkStabilityService', () => ({
  NetworkStabilityService: jest.fn().mockImplementation(() => ({
    runDiagnostics: jest.fn().mockResolvedValue([]),
    connect: jest.fn().mockResolvedValue(false),
    disconnect: jest.fn().mockResolvedValue(undefined),
    getConnectionQuality: jest.fn()
  }))
}));

jest.mock('../../../src/models/LACFileFormat', () => ({
  LACFileFormat: {
    createFromCaptureSession: jest.fn().mockReturnValue({ Settings: {} }),
    save: jest.fn().mockResolvedValue({ success: true, filePath: '/workspace/synthetic.lac' })
  }
}));

describe('Synthetic capture command', () => {
  let mockVSCode: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockVSCode = vscode as any;
    mockVSCode.window.activeTextEditor = {
      document: {
        getText: jest.fn().mockReturnValue([
          'sample_rate 1000000',
          'samples 4',
          'channel 0 CLK pattern bits=1010'
        ].join('\n'))
      }
    };
    mockVSCode.window.showSaveDialog.mockResolvedValue({ fsPath: '/workspace/synthetic.lac' });
  });

  afterEach(() => {
    deactivate();
  });

  it('registers createSyntheticCapture command', () => {
    activate({ subscriptions: [] } as any);

    expect(mockVSCode.commands.registerCommand).toHaveBeenCalledWith(
      'logicAnalyzer.createSyntheticCapture',
      expect.any(Function)
    );
  });

  it('saves active editor DSL as an original-compatible LAC file', async () => {
    activate({ subscriptions: [] } as any);
    const handler = mockVSCode.commands.registerCommand.mock.calls
      .find((call: any[]) => call[0] === 'logicAnalyzer.createSyntheticCapture')?.[1];

    await handler();

    expect(LACFileFormat.save).toHaveBeenCalledWith(
      '/workspace/synthetic.lac',
      expect.objectContaining({
        frequency: 1000000,
        postTriggerSamples: 4
      }),
      undefined,
      true
    );
    expect(mockVSCode.commands.executeCommand).toHaveBeenCalledWith(
      'vscode.open',
      { fsPath: '/workspace/synthetic.lac' }
    );
  });
});
