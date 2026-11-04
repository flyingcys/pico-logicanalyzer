/**
 * `LACEditorProvider.exportData` —— **真实落盘**验证。
 *
 * ## 为什么单独开一个文件（而不是加进 `export.test.ts`）
 *
 * `export.test.ts` 把 `DataExportService` **整个 mock 掉**了：
 * ```ts
 * jest.mock('../../../src/services/DataExportService', () => ({
 *   DataExportService: jest.fn().mockImplementation(() => ({
 *     initialize, dispose, exportWaveformData   // ← 全是 jest.fn()
 *   }))
 * }));
 * ```
 * ⇒ 那 11 条用例证明的是「产品对 mock 的反应」，**不是「产品对真实 DataExportService 的反应」**。
 *
 * 本文件**不 mock** `DataExportService`，让它真的走
 * `exportWaveformData → exportToCSV → fs.writeFile`，断言**磁盘上的文件**。
 *
 * ## 判据是"文件真的写出来了"，不是"函数被调用了"
 *
 * - 文件存在（`fs.existsSync`）
 * - 内容非空
 * - 格式正确（CSV 有表头 + 数据行；LAC 是合法 JSON 且含 Samples）
 *
 * ## ⚠️ 用临时目录 + afterEach 清理
 *
 * 不清理会踩 `/tmp` 泄漏门禁（`scripts/check-tmp-leaks.js`）。
 * 用 `mkdtemp` 建**每用例唯一**目录，`afterEach` 递归删除。
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const showSaveDialog = jest.fn();
const showInformationMessage = jest.fn();
const showErrorMessage = jest.fn();

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

// ⚠️ **刻意不 mock DataExportService** —— 这是本文件存在的全部意义。

import { LACEditorProvider } from '../../../src/providers/LACEditorProvider';

/** 6 个样本、2 个通道的最小合法 .lac 文档。 */
function createDocument(): any {
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
  };
}

describe('LACEditorProvider.exportData —— 真实落盘（不 mock DataExportService）', () => {
  let tmpDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lac-export-persist-'));
  });

  afterEach(() => {
    // 门禁要求：临时目录必须清理（scripts/check-tmp-leaks.js）
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const provider = () => new LACEditorProvider({ extensionUri: { fsPath: tmpDir } } as any);

  it('CSV：真实写出文件，含表头与数据行', async () => {
    const target = path.join(tmpDir, 'out.csv');
    showSaveDialog.mockResolvedValue({ fsPath: target });

    await (provider() as any).exportData(createDocument(), {
      format: 'csv',
      selectedChannels: [0, 1],
      timeRange: 'all'
    });

    expect(showErrorMessage).not.toHaveBeenCalled();
    expect(fs.existsSync(target)).toBe(true);

    const content = fs.readFileSync(target, 'utf8');
    const lines = content.split('\n').filter(line => line.length > 0);

    // 判据 1：有表头（Time + 通道名列）
    expect(lines[0]).toContain('Time');
    expect(lines[0]).toContain('D0');
    // 判据 2：有数据行（6 个样本）
    expect(lines.length).toBeGreaterThan(1);

    expect(showInformationMessage).toHaveBeenCalledWith(`数据已导出到: ${target}`);
  });

  it('LAC：真实写出合法 JSON，且保留 Samples', async () => {
    const target = path.join(tmpDir, 'out.lac');
    showSaveDialog.mockResolvedValue({ fsPath: target });

    await (provider() as any).exportData(createDocument(), {
      format: 'lac',
      selectedChannels: [0, 1],
      timeRange: 'all'
    });

    expect(showErrorMessage).not.toHaveBeenCalled();
    expect(fs.existsSync(target)).toBe(true);

    const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
    // 判据：不是"写了点什么"，而是"写的是可解析的 LAC 且带样本"
    expect(parsed).toHaveProperty('Settings');
    expect(parsed).toHaveProperty('Samples');
    expect(Array.isArray(parsed.Samples)).toBe(true);
    expect(parsed.Samples.length).toBeGreaterThan(0);
  });

  it('JSON：真实写出合法 JSON 数组/对象', async () => {
    const target = path.join(tmpDir, 'out.json');
    showSaveDialog.mockResolvedValue({ fsPath: target });

    await (provider() as any).exportData(createDocument(), {
      format: 'json',
      selectedChannels: [0],
      timeRange: 'all'
    });

    expect(showErrorMessage).not.toHaveBeenCalled();
    expect(fs.existsSync(target)).toBe(true);

    const content = fs.readFileSync(target, 'utf8');
    expect(() => JSON.parse(content)).not.toThrow();
    expect(content.length).toBeGreaterThan(0);
  });

  it('用户取消保存：不写任何文件，也不报错', async () => {
    showSaveDialog.mockResolvedValue(undefined);

    await (provider() as any).exportData(createDocument(), { format: 'csv' });

    // 目录里什么都不该多出来
    expect(fs.readdirSync(tmpDir)).toEqual([]);
    expect(showErrorMessage).not.toHaveBeenCalled();
    expect(showInformationMessage).not.toHaveBeenCalled();
  });

  /**
   * ## LAC + selectedRegions：**二次写盘**的真实结果
   *
   * `exportData` 对 LAC 格式会写**两次**：
   * 1. `exportWaveformData` → `exportToLAC` → `fs.writeFile`（第一次，无 regions）
   * 2. `persistLacSelectedRegionsIfNeeded` → `mergeSelectedRegionsIntoLacContent`
   *    → `fs.promises.writeFile`（第二次，**覆盖**第一次，带上 regions）
   *
   * ⚠️ 为什么必须单独验：现有 `export.test.ts` 把 `fs.promises.writeFile` mock 成
   * `overwriteExportedLacFile`，断言的是「调用了这个 mock」——
   * **证明不了磁盘上最终内容是对的**。而第 2 次写盘是**覆盖写**：
   * 若合并逻辑坏了，用户拿到的是残缺数据（第一次的完整内容被覆盖掉）。
   *
   * 判据：读回磁盘文件 → 解析 → `SelectedRegions` 存在且值与输入一致，
   * 同时 `Samples` 仍在（证明不是"只留了 regions 丢了样本"）。
   */
  it('LAC + selectedRegions：磁盘上的最终内容真的合并了 regions（不是只调了 mock）', async () => {
    const target = path.join(tmpDir, 'out-with-regions.lac');
    showSaveDialog.mockResolvedValue({ fsPath: target });

    await (provider() as any).exportData(createDocument(), {
      source: 'webview',
      format: 'lac',
      timeRange: 'all',
      selectedChannels: [0, 1],
      selectedRegions: [
        {
          firstSample: 0,
          lastSample: 2,
          regionName: '区域甲',
          color: 'rgba(255, 0, 0, 1)'
        },
        {
          firstSample: 3,
          lastSample: 5,
          regionName: '区域乙',
          color: 'rgba(0, 128, 255, 1)'
        }
      ]
    });

    expect(showErrorMessage).not.toHaveBeenCalled();
    expect(fs.existsSync(target)).toBe(true);

    const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));

    // 判据 1：regions 真的落进最终文件（值逐个核对，不是"有这个字段就行"）
    expect(parsed.SelectedRegions).toHaveLength(2);
    expect(parsed.SelectedRegions[0]).toMatchObject({
      FirstSample: 0,
      LastSample: 2,
      RegionName: '区域甲',
      R: 255,
      G: 0,
      B: 0,
      A: 255
    });
    expect(parsed.SelectedRegions[1]).toMatchObject({
      FirstSample: 3,
      LastSample: 5,
      RegionName: '区域乙',
      R: 0,
      G: 128,
      B: 255,
      A: 255
    });

    // 判据 2：样本没被合并写盘丢掉（证明是"合并"而不是"只留 regions"）
    expect(Array.isArray(parsed.Samples)).toBe(true);
    expect(parsed.Samples.length).toBeGreaterThan(0);

    // 判据 3：Settings 仍在（合并走的是 parse → 重建，不能把元数据弄丢）
    expect(parsed.Settings).toBeDefined();
    expect(parsed.Settings.Frequency).toBe(1000);
  });

  it('LAC 无 selectedRegions：不应多出 SelectedRegions 字段（避免无中生有）', async () => {
    const target = path.join(tmpDir, 'out-no-regions.lac');
    showSaveDialog.mockResolvedValue({ fsPath: target });

    await (provider() as any).exportData(createDocument(), {
      source: 'webview',
      format: 'lac',
      timeRange: 'all',
      selectedChannels: [0, 1]
      // 刻意不传 selectedRegions
    });

    expect(fs.existsSync(target)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));

    // 反向判据：没有 regions 时不该凭空造一个空数组出来
    expect(parsed.SelectedRegions).toBeUndefined();
    expect(Array.isArray(parsed.Samples)).toBe(true);
  });
});
