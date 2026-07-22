/**
 * ConfigurationManager 类型清理（any -> unknown）回归测试
 *
 * 专注验证以下清理点未破坏功能、且新增的类型守卫分支被真正覆盖：
 * 1. importConfiguration 的 `catch (fileError: unknown)` + ENOENT 类型守卫
 *    - 守卫命中（code === 'ENOENT'）-> 抛出 "文件不存在"
 *    - 守卫未命中（非 ENOENT 对象 / 非对象）-> 原样 re-throw
 * 2. isValidDeviceConfiguration(device: unknown) 对无效/非对象数据的过滤
 * 3. isValidThemeConfiguration(theme: unknown) 对无效/非对象数据的过滤
 * 4. saveDeviceConfiguration / getAllDeviceConfigurations 公共 API 正常工作
 * 5. EventEmitter 代理 on/emit/off 在 unknown[] 参数下正常工作
 *
 * Mock 策略与 ConfigurationManager.accurate.test.ts 对齐：
 * - vscode mock 提供 workspace / window
 * - fs/promises mock 使 loadXxx 路径可控，从而覆盖私有守卫的 false 分支
 */

jest.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
    getConfiguration: jest.fn(() => ({
      get: jest.fn((key: string) => {
        const mockConfigs: Record<string, unknown> = {
          'display.theme': 'auto'
        };
        return mockConfigs[key];
      }),
      update: jest.fn().mockResolvedValue(undefined)
    })),
    onDidChangeConfiguration: jest.fn(() => ({ dispose: jest.fn() }))
  },
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn()
  },
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3
  }
}));

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn()
}));

import { ConfigurationManager, DeviceConfiguration, ThemeConfiguration } from '../../../src/services/ConfigurationManager';
import * as fs from 'fs/promises';

const mockFs = fs as jest.Mocked<typeof fs>;

describe('ConfigurationManager 类型清理（any -> unknown）回归测试', () => {
  let configManager: ConfigurationManager;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    // 默认让 readFile 在 load 阶段抛 ENOENT（空配置），单个用例可覆盖
    mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
    configManager = new ConfigurationManager();
    await configManager.initialize();
  });

  afterEach(async () => {
    if (configManager) {
      await configManager.dispose();
    }
  });

  describe('importConfiguration 的 catch (fileError: unknown) 守卫', () => {
    it('文件路径不存在（ENOENT）时抛出包含"文件不存在"的错误（覆盖守卫 true 分支）', async () => {
      // importConfiguration 走文件路径分支（非 '{' 开头），readFile 抛 { code: 'ENOENT' }
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });

      await expect(
        configManager.importConfiguration('/nonexistent/path/config.json')
      ).rejects.toThrow('文件不存在');

      // 确认确实走了文件读取分支
      expect(mockFs.readFile).toHaveBeenCalledWith('/nonexistent/path/config.json', 'utf8');
    });

    it('文件错误为非 ENOENT 对象时（如 EACCES）应被原样向上抛出（覆盖守卫 false -> throw fileError 分支）', async () => {
      const accErr = { code: 'EACCES', message: 'permission denied' };
      mockFs.readFile.mockRejectedValue(accErr);

      // 外层 catch 会包装为 "配置导入失败: ..."，内层 fileError 被原样 re-throw
      await expect(
        configManager.importConfiguration('/forbidden/config.json')
      ).rejects.toThrow('配置导入失败');
    });

    it('fileError 为非对象（如字符串）时也应被原样抛出，不触发属性访问异常', async () => {
      // 字符串类型的 fileError：守卫 typeof === 'object' 为 false，应直接 throw
      mockFs.readFile.mockRejectedValue('string-error');

      await expect(
        configManager.importConfiguration('/some/path.json')
      ).rejects.toThrow('配置导入失败');
    });
  });

  describe('isValidThemeConfiguration(theme: unknown) 守卫容错', () => {
    it('加载到有效主题时应被正确加载', async () => {
      const validTheme: ThemeConfiguration = {
        name: 'Custom Theme',
        colors: {
          background: '#000000',
          foreground: '#FFFFFF',
          channelColors: ['#FF0000'],
          gridColor: '#333',
          markerColor: '#AAA',
          triggerColor: '#BBB'
        },
        fonts: { family: 'Consolas', size: 14, weight: 'bold' }
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify([validTheme]));

      const newManager = new ConfigurationManager();
      await newManager.initialize();

      const loaded = newManager.getTheme('Custom Theme');
      expect(loaded).toBeDefined();
      expect(loaded?.colors.background).toBe('#000000');

      await newManager.dispose();
    });

    it('加载到空名主题（name === ""）时应被过滤', async () => {
      const invalidTheme = { name: '', colors: { background: '#000', foreground: '#fff', channelColors: [] }, fonts: { family: 'x' } };
      mockFs.readFile.mockResolvedValue(JSON.stringify([invalidTheme]));

      const newManager = new ConfigurationManager();
      await newManager.initialize();

      // 空名主题被守卫拒绝
      expect(newManager.getTheme('')).toBeUndefined();
      // 默认主题仍存在
      expect(newManager.getAllThemes().length).toBeGreaterThanOrEqual(2);

      await newManager.dispose();
    });

    it('加载到非对象主题（null / 字符串）时应被过滤，不抛错', async () => {
      // JSON 中混入 null、字符串等非法主题
      mockFs.readFile.mockResolvedValue(JSON.stringify([null, 'not-a-theme', 42]));

      const newManager = new ConfigurationManager();
      await expect(newManager.initialize()).resolves.not.toThrow();

      // 只有默认主题，非法项被过滤
      const themes = newManager.getAllThemes();
      expect(themes.length).toBeGreaterThanOrEqual(2);
      themes.forEach(t => expect(typeof t.name).toBe('string'));

      await newManager.dispose();
    });

    it('saveTheme -> getTheme 公共 API 正常工作（类型清理未破坏功能）', async () => {
      const theme: ThemeConfiguration = {
        name: 'Save Test Theme',
        colors: {
          background: '#101010',
          foreground: '#EEEEEE',
          channelColors: ['#111', '#222'],
          gridColor: '#333',
          markerColor: '#444',
          triggerColor: '#555'
        },
        fonts: { family: 'Mono', size: 13, weight: 'normal' }
      };

      await configManager.saveTheme(theme);
      const got = configManager.getTheme('Save Test Theme');
      expect(got).toBeDefined();
      expect(got?.fonts.family).toBe('Mono');
    });
  });

  describe('isValidDeviceConfiguration(device: unknown) 守卫容错', () => {
    const validDevice: DeviceConfiguration = {
      deviceId: 'dev-valid',
      name: 'Valid Device',
      type: 'LogicAnalyzer',
      connectionString: 'COM1',
      settings: { baudRate: 9600 },
      lastUsed: new Date().toISOString(),
      favorite: false
    };

    it('加载到空 deviceId 的设备应被过滤', async () => {
      const invalid = { ...validDevice, deviceId: '' };
      mockFs.readFile.mockResolvedValue(JSON.stringify([invalid]));

      const newManager = new ConfigurationManager();
      await newManager.initialize();

      expect(newManager.getAllDeviceConfigurations()).toEqual([]);

      await newManager.dispose();
    });

    it('加载到缺字段的设备（无 favorite）应被过滤', async () => {
      const incomplete = {
        deviceId: 'dev-2',
        name: 'NoFav',
        type: 'LogicAnalyzer',
        connectionString: 'COM2',
        settings: {},
        lastUsed: new Date().toISOString()
        // 缺少 favorite
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify([incomplete]));

      const newManager = new ConfigurationManager();
      await newManager.initialize();

      expect(newManager.getDeviceConfiguration('dev-2')).toBeUndefined();

      await newManager.dispose();
    });

    it('加载到非对象设备（null / 数字）时应被过滤，不抛错', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify([null, 123, 'str']));

      const newManager = new ConfigurationManager();
      await expect(newManager.initialize()).resolves.not.toThrow();
      expect(newManager.getAllDeviceConfigurations()).toEqual([]);

      await newManager.dispose();
    });

    it('saveDeviceConfiguration / getAllDeviceConfigurations 正常工作（类型清理未破坏功能）', async () => {
      await configManager.saveDeviceConfiguration(validDevice);

      const got = configManager.getDeviceConfiguration('dev-valid');
      expect(got).toBeDefined();
      expect(got?.name).toBe('Valid Device');

      const all = configManager.getAllDeviceConfigurations();
      expect(all.find(d => d.deviceId === 'dev-valid')).toBeDefined();

      // 删除后应消失
      await configManager.deleteDeviceConfiguration('dev-valid');
      expect(configManager.getDeviceConfiguration('dev-valid')).toBeUndefined();
    });
  });

  describe('EventEmitter 代理（unknown 参数）', () => {
    it('on/emit/off 链式调用 + listenerCount 在 unknown 参数下正常工作', () => {
      const listener = jest.fn();

      // on 返回 this（链式）
      const ret = configManager.on('type-event', listener);
      expect(ret).toBe(configManager);
      expect(configManager.listenerCount('type-event')).toBe(1);

      // emit 传入 unknown 类型负载（对象、原始值混合）
      const emitOk = configManager.emit('type-event', { a: 1 }, 'str', 42);
      expect(typeof emitOk).toBe('boolean');
      expect(listener).toHaveBeenCalledWith({ a: 1 }, 'str', 42);

      // off 移除
      configManager.off('type-event', listener);
      expect(configManager.listenerCount('type-event')).toBe(0);
    });
  });
});
