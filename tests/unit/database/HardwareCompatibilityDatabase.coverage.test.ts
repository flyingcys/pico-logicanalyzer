/**
 * HardwareCompatibilityDatabase 覆盖率测试
 *
 * 测试目标：通过真实临时目录驱动 fs.promises 的真实 IO，覆盖
 *   initialize / loadDatabase / buildIndexes / queryDevices /
 *   findCompatibleDrivers / addOrUpdateDevice / removeDevice /
 *   updateTestResults / addUserFeedback / getStatistics /
 *   exportDatabase / importDatabase / intersectSets / dispose
 * 的全部主路径与边界分支。
 *
 * 测试方法：最小化 Mock，每个用例使用独立的临时 JSON 文件作为 databasePath，
 * afterEach 中清理（忽略 ENOENT），符合本仓库"测真实业务逻辑"的原则。
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  HardwareCompatibilityDatabase,
  DeviceCompatibilityEntry
} from '../../../src/database/HardwareCompatibilityDatabase';
import { TriggerType } from '../../../src/models/AnalyzerTypes';

/**
 * 生成一个完整合法的 DeviceCompatibilityEntry，允许部分覆盖。
 * capabilities 使用 TriggerType.Edge 等真实枚举值。
 */
function createEntry(overrides: Partial<DeviceCompatibilityEntry> = {}): DeviceCompatibilityEntry {
  const base: DeviceCompatibilityEntry = {
    deviceId: 'test-device',
    manufacturer: 'TestCorp',
    model: 'TestModel',
    version: '1.0',
    category: 'usb-la',
    identifiers: {
      vendorId: '1234',
      productId: '5678',
      serialPattern: 'TEST*'
    },
    driverCompatibility: {
      primaryDriver: 'LogicAnalyzerDriver',
      alternativeDrivers: [],
      driverVersion: '2.0.0',
      compatibilityLevel: 'full',
      knownIssues: [],
      workarounds: []
    },
    capabilities: {
      channels: {
        digital: 8,
        analog: 0,
        maxVoltage: 5.0,
        inputImpedance: 1000000,
        thresholdVoltages: [0.8, 1.5, 3.3]
      },
      sampling: {
        maxRate: 25000000,
        minRate: 1000,
        supportedRates: [1000, 1000000, 25000000],
        bufferSize: 1000000,
        streamingSupport: false,
        compressionSupport: false
      },
      triggers: {
        types: [TriggerType.Edge, TriggerType.Complex],
        maxChannels: 8,
        patternWidth: 8,
        sequentialSupport: false,
        conditions: ['rising', 'falling', 'high', 'low']
      },
      protocol: {
        supportedProtocols: ['uart', 'spi', 'i2c'],
        hardwareDecoding: false,
        customProtocols: false
      },
      advanced: {
        memorySegmentation: false,
        externalClock: false,
        calibration: true,
        selfTest: true
      },
      connectivity: {
        interfaces: ['usb'],
        protocols: ['custom']
      },
      features: {
        signalGeneration: false,
        powerSupply: false,
        i2cSniffer: false,
        canSupport: false,
        customDecoders: true,
        voltageMonitoring: false
      }
    },
    connectionOptions: {
      defaultConnectionString: 'COM3',
      alternativeConnections: [],
      connectionParameters: {
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        timeout: 5000
      }
    },
    testStatus: {
      lastTested: new Date('2024-06-01'),
      testResults: {
        driverValidation: 90,
        functionalTests: 88,
        performanceGrade: 'A',
        reliability: 'excellent'
      },
      certificationLevel: 'fixture'
    },
    communityFeedback: {
      userRating: 4.0,
      reportCount: 10,
      commonIssues: [],
      userComments: []
    },
    metadata: {
      addedDate: new Date('2024-01-01'),
      lastUpdated: new Date('2024-06-01'),
      maintainer: 'Test Maintainer',
      documentationUrl: 'https://example.com/doc',
      vendorUrl: 'https://example.com',
      supportStatus: 'active'
    }
  };

  return { ...base, ...overrides };
}

/** 生成唯一的临时数据库路径 */
function uniqueTempPath(): string {
  return path.join(
    os.tmpdir(),
    `hw-compat-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  );
}

/** 安全删除临时文件，忽略 ENOENT */
async function safeUnlink(p: string): Promise<void> {
  try {
    await fs.unlink(p);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw e;
    }
  }
}

describe('HardwareCompatibilityDatabase 覆盖率测试', () => {
  let db: HardwareCompatibilityDatabase;
  let tempPath: string;

  beforeEach(() => {
    tempPath = uniqueTempPath();
    db = new HardwareCompatibilityDatabase(tempPath);
  });

  afterEach(async () => {
    if (db) {
      db.dispose();
    }
    await safeUnlink(tempPath);
  });

  describe('initialize 初始化与加载', () => {
    it('首次初始化应加载 3 条默认设备数据', async () => {
      await db.initialize();

      expect((db as any).isLoaded).toBe(true);
      const all = await db.queryDevices({});
      expect(all).toHaveLength(3);
      const ids = all.map(d => d.deviceId).sort();
      expect(ids).toEqual(['pico-la-v1', 'rigol-mso5000', 'saleae-logic-8']);
    });

    it('初始化后默认数据文件应被写入磁盘', async () => {
      await db.initialize();

      const raw = await fs.readFile(tempPath, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.version).toBe('2.0');
      expect(Array.isArray(parsed.entries)).toBe(true);
      expect(parsed.entries).toHaveLength(3);
    });

    it('重复初始化应提前返回，不重新加载（isLoaded 守卫分支）', async () => {
      await db.initialize();
      expect((db as any).entries.size).toBe(3);

      // 手动破坏内部状态
      (db as any).entries.clear();
      (db as any).indexCache.clear();
      expect((db as any).entries.size).toBe(0);

      // 再次 initialize：因 isLoaded=true 直接 return，不会重新加载
      await db.initialize();

      expect((db as any).entries.size).toBe(0);
      expect((db as any).isLoaded).toBe(true);
    });

    it('loadDatabase 文件不存在时应走 ENOENT 分支并加载默认数据', async () => {
      // 文件不存在，initialize 内部 loadDatabase 捕获 ENOENT
      await db.initialize();
      const all = await db.queryDevices({});
      expect(all).toHaveLength(3);
    });

    it('数据库非空时不应加载默认数据', async () => {
      const custom = createEntry({ deviceId: 'custom-only' });
      await fs.writeFile(
        tempPath,
        JSON.stringify({
          version: '2.0',
          lastUpdated: new Date().toISOString(),
          entries: [custom]
        })
      );

      await db.initialize();

      const all = await db.queryDevices({});
      expect(all).toHaveLength(1);
      expect(all[0].deviceId).toBe('custom-only');
    });

    it('loadDatabase 应将日期字符串转换为 Date 对象', async () => {
      const entry = createEntry({ deviceId: 'date-test' });
      // 写入时序列化为字符串日期
      await fs.writeFile(
        tempPath,
        JSON.stringify({
          version: '2.0',
          entries: [entry]
        })
      );

      await db.initialize();

      const internal = (db as any).entries.get('date-test');
      expect(internal).toBeDefined();
      expect(internal.testStatus.lastTested).toBeInstanceOf(Date);
      expect(internal.metadata.addedDate).toBeInstanceOf(Date);
      expect(internal.metadata.lastUpdated).toBeInstanceOf(Date);
    });

    it('loadDatabase entries 非 array 时应跳过并加载默认数据', async () => {
      await fs.writeFile(
        tempPath,
        JSON.stringify({ version: '2.0', entries: 'not-an-array' })
      );

      await db.initialize();

      // entries 字段无效 -> entries 为空 -> 触发 loadDefaultData
      const all = await db.queryDevices({});
      expect(all).toHaveLength(3);
    });
  });

  describe('buildIndexes 索引构建（通过 queryDevices 验证）', () => {
    beforeEach(async () => {
      await db.initialize();
    });

    it('制造商索引（小写键）', async () => {
      const result = await db.queryDevices({ manufacturer: 'saleae' });
      expect(result).toHaveLength(1);
      expect(result[0].manufacturer).toBe('Saleae');
    });

    it('型号索引（小写键）', async () => {
      const result = await db.queryDevices({ model: 'logic 8' });
      expect(result).toHaveLength(1);
      expect(result[0].deviceId).toBe('saleae-logic-8');
    });

    it('类别索引', async () => {
      const result = await db.queryDevices({ category: 'usb-la' });
      expect(result.map(d => d.deviceId).sort()).toEqual(['pico-la-v1', 'saleae-logic-8']);
    });

    it('驱动索引', async () => {
      const result = await db.queryDevices({ driverName: 'LogicAnalyzerDriver' });
      expect(result).toHaveLength(1);
      expect(result[0].deviceId).toBe('pico-la-v1');
    });

    it('兼容性级别索引', async () => {
      const result = await db.queryDevices({ compatibilityLevel: 'full' });
      expect(result.map(d => d.deviceId).sort()).toEqual(['pico-la-v1', 'saleae-logic-8']);
    });

    it('认证级别索引', async () => {
      const result = await db.queryDevices({ certificationLevel: 'fixture' });
      expect(result).toHaveLength(1);
      expect(result[0].deviceId).toBe('pico-la-v1');
    });

    it('支持状态索引', async () => {
      const result = await db.queryDevices({ supportStatus: 'active' });
      expect(result).toHaveLength(3);
    });

    it('vendorId 标识符索引', async () => {
      const result = await db.queryDevices({ identifierType: 'vendorId', identifierValue: '0483' });
      expect(result).toHaveLength(1);
      expect(result[0].deviceId).toBe('pico-la-v1');
    });

    it('productId 标识符索引', async () => {
      const result = await db.queryDevices({ identifierType: 'productId', identifierValue: '5740' });
      expect(result).toHaveLength(1);
      expect(result[0].deviceId).toBe('pico-la-v1');
    });

    it('scpiIdn 索引应按小写键构建（直接验证 indexCache）', async () => {
      // 注：buildIndexes 用 'scpiIdn' 作为索引前缀（源码第 604 行），
      // 直接验证 buildIndexes 的 scpiIdn 分支已正确写入索引。
      const indexCache = (db as any).indexCache;
      const keys: string[] = Array.from(indexCache.keys());
      expect(keys).toContain('scpiIdn:rigol technologies,mso5*');
      const set: Set<string> = indexCache.get('scpiIdn:rigol technologies,mso5*');
      expect(set.has('rigol-mso5000')).toBe(true);
    });
  });

  describe('queryDevices 查询逻辑', () => {
    beforeEach(async () => {
      await db.initialize();
    });

    it('无过滤条件应返回全部设备', async () => {
      const result = await db.queryDevices({});
      expect(result).toHaveLength(3);
    });

    it('单字段过滤：manufacturer', async () => {
      const result = await db.queryDevices({ manufacturer: 'Rigol' });
      expect(result).toHaveLength(1);
      expect(result[0].deviceId).toBe('rigol-mso5000');
    });

    it('单字段过滤：model', async () => {
      const result = await db.queryDevices({ model: 'Pico Logic Analyzer' });
      expect(result).toHaveLength(1);
      expect(result[0].deviceId).toBe('pico-la-v1');
    });

    it('单字段过滤：certificationLevel', async () => {
      const result = await db.queryDevices({ certificationLevel: 'community' });
      expect(result).toHaveLength(1);
      expect(result[0].deviceId).toBe('rigol-mso5000');
    });

    it('单字段过滤：compatibilityLevel=partial', async () => {
      const result = await db.queryDevices({ compatibilityLevel: 'partial' });
      expect(result).toHaveLength(1);
      expect(result[0].deviceId).toBe('rigol-mso5000');
    });

    it('多字段交集应返回交集结果', async () => {
      const result = await db.queryDevices({ manufacturer: 'Saleae', category: 'usb-la' });
      expect(result).toHaveLength(1);
      expect(result[0].deviceId).toBe('saleae-logic-8');
    });

    it('多字段交集为空时返回空数组', async () => {
      const result = await db.queryDevices({ manufacturer: 'Saleae', category: 'mixed-signal' });
      expect(result).toEqual([]);
    });

    it('minValidationScore 过滤应剔除低分设备', async () => {
      // pico=95, saleae=88, rigol=78
      const result = await db.queryDevices({ minValidationScore: 90 });
      expect(result).toHaveLength(1);
      expect(result[0].deviceId).toBe('pico-la-v1');
    });

    it('minValidationScore=80 应保留 pico 与 saleae', async () => {
      const result = await db.queryDevices({ minValidationScore: 80 });
      expect(result.map(d => d.deviceId).sort()).toEqual(['pico-la-v1', 'saleae-logic-8']);
    });

    it('查询不存在的制造商应返回空数组', async () => {
      const result = await db.queryDevices({ manufacturer: 'NonExistent' });
      expect(result).toEqual([]);
    });

    it('identifierType 与 identifierValue 联合查询', async () => {
      const result = await db.queryDevices({
        identifierType: 'vendorId',
        identifierValue: '0925'
      });
      expect(result).toHaveLength(1);
      expect(result[0].deviceId).toBe('saleae-logic-8');
    });

    it('已知源码 bug：scpiIdnResponse 查询无法命中 scpiIdn 索引', async () => {
      // buildIndexes 建的索引前缀是 'scpiIdn'（源码第 604 行），
      // 但 queryDevices 用 identifierType（'scpiIdnResponse'）作前缀（源码第 673 行），
      // 两者不一致导致该查询永远返回空。此处记录此 bug 的实际行为。
      const result = await db.queryDevices({
        identifierType: 'scpiIdnResponse',
        identifierValue: 'RIGOL TECHNOLOGIES,MSO5*'
      });
      expect(result).toEqual([]);
    });
  });

  describe('findCompatibleDrivers 查找兼容驱动', () => {
    beforeEach(async () => {
      await db.initialize();
    });

    it('基于 manufacturer 查找', async () => {
      const result = await db.findCompatibleDrivers({ manufacturer: 'Rigol' });
      expect(result).toHaveLength(1);
      expect(result[0].deviceId).toBe('rigol-mso5000');
    });

    it('基于 model 查找', async () => {
      const result = await db.findCompatibleDrivers({ model: 'Logic 8' });
      expect(result).toHaveLength(1);
      expect(result[0].deviceId).toBe('saleae-logic-8');
    });

    it('基于 serialNumber 命中 serialPattern 时应直接返回匹配项', async () => {
      // pico serialPattern='PLA*'
      const result = await db.findCompatibleDrivers({ serialNumber: 'PLA123456' });
      expect(result).toHaveLength(1);
      expect(result[0].deviceId).toBe('pico-la-v1');
    });

    it('serialNumber 命中时优先于 manufacturer/model 查询', async () => {
      // 即使传了其它字段，serialNumber 命中后直接 return
      const result = await db.findCompatibleDrivers({
        serialNumber: 'SL9999',
        manufacturer: 'Rigol'
      });
      expect(result).toHaveLength(1);
      expect(result[0].deviceId).toBe('saleae-logic-8');
    });

    it('serialNumber 不命中任何 serialPattern 时应回退到 manufacturer/model 查询', async () => {
      const result = await db.findCompatibleDrivers({
        serialNumber: 'UNKNOWN-SN',
        manufacturer: 'Saleae'
      });
      expect(result).toHaveLength(1);
      expect(result[0].deviceId).toBe('saleae-logic-8');
    });

    it('无任何匹配字段时应返回空数组', async () => {
      const result = await db.findCompatibleDrivers({});
      expect(result).toEqual([]);
    });

    it('manufacturer 与 model 同时命中不同设备时应合并去重', async () => {
      // Saleae 制造商命中 saleae；Pico Logic Analyzer 型号命中 pico
      const result = await db.findCompatibleDrivers({
        manufacturer: 'Saleae',
        model: 'Pico Logic Analyzer'
      });
      const ids = result.map(d => d.deviceId).sort();
      expect(ids).toEqual(['pico-la-v1', 'saleae-logic-8']);
    });
  });

  describe('addOrUpdateDevice 添加与更新', () => {
    beforeEach(async () => {
      await db.initialize();
    });

    it('新增设备应设置 addedDate 与 lastUpdated', async () => {
      const before = Date.now();
      const newEntry = createEntry({ deviceId: 'brand-new-device' });
      await db.addOrUpdateDevice(newEntry);

      expect(newEntry.metadata.addedDate).toBeInstanceOf(Date);
      expect(newEntry.metadata.lastUpdated).toBeInstanceOf(Date);
      expect(newEntry.metadata.addedDate.getTime()).toBeGreaterThanOrEqual(before);
      expect(newEntry.metadata.lastUpdated.getTime()).toBeGreaterThanOrEqual(before);

      const found = await db.queryDevices({ manufacturer: 'TestCorp' });
      expect(found.find(d => d.deviceId === 'brand-new-device')).toBeDefined();
    });

    it('更新已有设备应保留 addedDate 并刷新 lastUpdated', async () => {
      const entry = createEntry({ deviceId: 'update-target' });
      // 第一次：新增，addOrUpdateDevice 会把 addedDate 设为当前时间
      await db.addOrUpdateDevice(entry);
      const addedAfterFirst = entry.metadata.addedDate;
      expect(addedAfterFirst).toBeInstanceOf(Date);

      // 确保 lastUpdated 时间戳推进
      await new Promise(resolve => setTimeout(resolve, 5));
      const beforeSecond = Date.now();

      // 第二次：更新（设备已存在），addedDate 应保持不变
      entry.model = 'UpdatedModel';
      await db.addOrUpdateDevice(entry);

      expect(entry.metadata.addedDate.getTime()).toBe(addedAfterFirst.getTime());
      expect(entry.metadata.lastUpdated.getTime()).toBeGreaterThanOrEqual(beforeSecond);

      const found = await db.queryDevices({ model: 'UpdatedModel' });
      expect(found).toHaveLength(1);
      expect(found[0].deviceId).toBe('update-target');
    });

    it('saveDatabase 写入后应能被新实例加载', async () => {
      const newEntry = createEntry({ deviceId: 'persist-test', manufacturer: 'PersistCorp' });
      await db.addOrUpdateDevice(newEntry);
      db.dispose();

      // 用同一临时路径新建实例
      const db2 = new HardwareCompatibilityDatabase(tempPath);
      await db2.initialize();
      const all = await db2.queryDevices({});
      // 默认 3 条 + 新增 1 条
      expect(all).toHaveLength(4);
      expect(all.find(d => d.deviceId === 'persist-test')).toBeDefined();
      db2.dispose();
    });
  });

  describe('removeDevice 删除设备', () => {
    beforeEach(async () => {
      await db.initialize();
    });

    it('删除存在的设备应返回 true 并移除', async () => {
      const result = await db.removeDevice('pico-la-v1');
      expect(result).toBe(true);

      const all = await db.queryDevices({});
      expect(all).toHaveLength(2);
      expect(all.find(d => d.deviceId === 'pico-la-v1')).toBeUndefined();
    });

    it('删除不存在的设备应返回 false', async () => {
      const result = await db.removeDevice('does-not-exist');
      expect(result).toBe(false);

      const all = await db.queryDevices({});
      expect(all).toHaveLength(3);
    });
  });

  describe('updateTestResults 更新测试结果', () => {
    beforeEach(async () => {
      await db.initialize();
    });

    it('更新存在设备的测试结果', async () => {
      const before = Date.now();
      await db.updateTestResults('pico-la-v1', {
        driverValidation: 99,
        functionalTests: 97,
        performanceGrade: 'A',
        reliability: 'excellent'
      });

      const internal = (db as any).entries.get('pico-la-v1');
      expect(internal.testStatus.testResults.driverValidation).toBe(99);
      expect(internal.testStatus.testResults.functionalTests).toBe(97);
      expect(internal.testStatus.lastTested).toBeInstanceOf(Date);
      expect(internal.testStatus.lastTested.getTime()).toBeGreaterThanOrEqual(before);
      expect(internal.metadata.lastUpdated.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('更新不存在设备时应静默跳过（不抛错）', async () => {
      await expect(
        db.updateTestResults('non-existent', {
          driverValidation: 50,
          functionalTests: 50,
          performanceGrade: 'C',
          reliability: 'fair'
        })
      ).resolves.toBeUndefined();

      // 原数据不变
      const all = await db.queryDevices({});
      expect(all).toHaveLength(3);
    });
  });

  describe('addUserFeedback 用户反馈', () => {
    beforeEach(async () => {
      await db.initialize();
    });

    it('应按加权平均更新评分并追加评论、自增 reportCount', async () => {
      // pico 初始: userRating=4.5, reportCount=12
      await db.addUserFeedback('pico-la-v1', 5, '很好用', ['新问题A']);

      const internal = (db as any).entries.get('pico-la-v1');
      // (4.5 * 12 + 5) / 13 = 59/13
      expect(internal.communityFeedback.userRating).toBeCloseTo(59 / 13, 5);
      expect(internal.communityFeedback.reportCount).toBe(13);
      expect(internal.communityFeedback.userComments).toContain('很好用');
      expect(internal.communityFeedback.commonIssues).toContain('新问题A');
      expect(internal.metadata.lastUpdated).toBeInstanceOf(Date);
    });

    it('设备不存在时应静默跳过', async () => {
      await expect(
        db.addUserFeedback('non-existent', 5, 'x', [])
      ).resolves.toBeUndefined();

      const all = await db.queryDevices({});
      expect(all).toHaveLength(3);
    });

    it('issues 默认为空数组时不影响 commonIssues', async () => {
      const beforeIssues = (db as any).entries.get('pico-la-v1').communityFeedback.commonIssues.length;
      await db.addUserFeedback('pico-la-v1', 4, '评论');
      const internal = (db as any).entries.get('pico-la-v1');
      expect(internal.communityFeedback.commonIssues).toHaveLength(beforeIssues);
      expect(internal.communityFeedback.reportCount).toBe(13);
    });
  });

  describe('getStatistics 统计信息', () => {
    it('默认数据的统计应正确', async () => {
      await db.initialize();
      const stats = await db.getStatistics();

      expect(stats.totalDevices).toBe(3);
      expect(stats.devicesByCategory['usb-la']).toBe(2);
      expect(stats.devicesByCategory['mixed-signal']).toBe(1);
      expect(stats.devicesByManufacturer['DebugVn']).toBe(1);
      expect(stats.devicesByManufacturer['Saleae']).toBe(1);
      expect(stats.devicesByManufacturer['Rigol']).toBe(1);
      expect(stats.certificationLevels['fixture']).toBe(1);
      expect(stats.certificationLevels['experimental']).toBe(1);
      expect(stats.certificationLevels['community']).toBe(1);

      // 加权平均: (4.5*12 + 4.2*8 + 3.8*5) / (12+8+5) = 106.6/25 = 4.264
      expect(stats.averageUserRating).toBeCloseTo(106.6 / 25, 5);
    });

    it('全部设备 reportCount=0 时 averageUserRating 应为 0', async () => {
      const entry = createEntry({ deviceId: 'no-rating' });
      entry.communityFeedback.reportCount = 0;
      entry.communityFeedback.userRating = 0;
      await fs.writeFile(
        tempPath,
        JSON.stringify({ version: '2.0', entries: [entry] })
      );

      await db.initialize();
      const stats = await db.getStatistics();
      expect(stats.totalDevices).toBe(1);
      expect(stats.averageUserRating).toBe(0);
    });

    it('混合评分设备时应只对 reportCount>0 的设备加权', async () => {
      const rated = createEntry({ deviceId: 'rated', manufacturer: 'Rated' });
      rated.communityFeedback.userRating = 4.0;
      rated.communityFeedback.reportCount = 10;

      const unrated = createEntry({ deviceId: 'unrated', manufacturer: 'Unrated' });
      unrated.communityFeedback.userRating = 0;
      unrated.communityFeedback.reportCount = 0;

      await fs.writeFile(
        tempPath,
        JSON.stringify({ version: '2.0', entries: [rated, unrated] })
      );

      await db.initialize();
      const stats = await db.getStatistics();
      expect(stats.totalDevices).toBe(2);
      // 只有 rated 参与: (4.0 * 10) / 10 = 4.0
      expect(stats.averageUserRating).toBeCloseTo(4.0, 5);
    });
  });

  describe('exportDatabase 导出', () => {
    beforeEach(async () => {
      await db.initialize();
    });

    it('json 格式应包含 version/exported/entries', async () => {
      const json = await db.exportDatabase('json');
      const parsed = JSON.parse(json);

      expect(parsed.version).toBe('2.0');
      expect(typeof parsed.exported).toBe('string');
      expect(Array.isArray(parsed.entries)).toBe(true);
      expect(parsed.entries).toHaveLength(3);
    });

    it('csv 格式应包含表头与数据行', async () => {
      const csv = await db.exportDatabase('csv');
      const lines = csv.split('\n');

      expect(lines[0]).toContain('Device ID');
      expect(lines[0]).toContain('Manufacturer');
      expect(lines[0]).toContain('Compatibility Level');
      // 1 表头 + 3 数据行
      expect(lines).toHaveLength(4);

      // 验证表行包含已知设备 id
      const dataBody = lines.slice(1).join('\n');
      expect(dataBody).toContain('pico-la-v1');
      expect(dataBody).toContain('rigol-mso5000');
    });

    it('默认 format 参数应为 json', async () => {
      const result = await db.exportDatabase();
      const parsed = JSON.parse(result);
      expect(parsed.version).toBe('2.0');
    });
  });

  describe('importDatabase 导入', () => {
    beforeEach(async () => {
      await db.initialize();
    });

    it('json merge=true 应在现有数据基础上合并', async () => {
      const newEntry = createEntry({ deviceId: 'imported-merge' });
      const importData = JSON.stringify({
        version: '2.0',
        entries: [newEntry]
      });

      await db.importDatabase(importData, 'json', true);

      const all = await db.queryDevices({});
      expect(all).toHaveLength(4);
      expect(all.find(d => d.deviceId === 'imported-merge')).toBeDefined();
    });

    it('json merge=false 应清空后再导入', async () => {
      const newEntry = createEntry({ deviceId: 'imported-replace' });
      const importData = JSON.stringify({
        version: '2.0',
        entries: [newEntry]
      });

      await db.importDatabase(importData, 'json', false);

      const all = await db.queryDevices({});
      expect(all).toHaveLength(1);
      expect(all[0].deviceId).toBe('imported-replace');
    });

    it('entries 非 array 时应跳过导入', async () => {
      const before = (await db.queryDevices({})).length;
      await db.importDatabase(JSON.stringify({ entries: 'not-array' }), 'json', true);
      const after = (await db.queryDevices({})).length;
      expect(after).toBe(before);
    });

    it('应将日期字符串转换为 Date 对象', async () => {
      const entry = createEntry({ deviceId: 'date-import' });
      // 序列化后日期为字符串
      const importData = JSON.stringify({
        version: '2.0',
        entries: [entry]
      });

      await db.importDatabase(importData, 'json', false);

      const internal = (db as any).entries.get('date-import');
      expect(internal.testStatus.lastTested).toBeInstanceOf(Date);
      expect(internal.metadata.addedDate).toBeInstanceOf(Date);
      expect(internal.metadata.lastUpdated).toBeInstanceOf(Date);
    });

    it('导入后应重建索引并可被查询', async () => {
      const newEntry = createEntry({
        deviceId: 'queryable-import',
        manufacturer: 'QueryableCorp'
      });
      await db.importDatabase(
        JSON.stringify({ version: '2.0', entries: [newEntry] }),
        'json',
        true
      );

      const found = await db.queryDevices({ manufacturer: 'QueryableCorp' });
      expect(found).toHaveLength(1);
      expect(found[0].deviceId).toBe('queryable-import');
    });
  });

  describe('私有方法 intersectSets', () => {
    it('应正确计算两个集合的交集', () => {
      const dbAny = db as any;
      const result = dbAny.intersectSets(new Set([1, 2, 3]), new Set([2, 3, 4]));
      expect(Array.from(result).sort()).toEqual([2, 3]);
    });

    it('无交集时应返回空集合', () => {
      const dbAny = db as any;
      const result = dbAny.intersectSets(new Set([1, 2]), new Set([3, 4]));
      expect(result.size).toBe(0);
    });

    it('空集合交集应返回空集合', () => {
      const dbAny = db as any;
      const result = dbAny.intersectSets(new Set<number>(), new Set([1, 2]));
      expect(result.size).toBe(0);
    });
  });

  describe('dispose 资源清理', () => {
    it('应清空 entries、indexCache 并将 isLoaded 置为 false', async () => {
      await db.initialize();
      expect((db as any).entries.size).toBeGreaterThan(0);
      expect((db as any).indexCache.size).toBeGreaterThan(0);
      expect((db as any).isLoaded).toBe(true);

      db.dispose();

      expect((db as any).entries.size).toBe(0);
      expect((db as any).indexCache.size).toBe(0);
      expect((db as any).isLoaded).toBe(false);
    });

    it('dispose 后再次 initialize 应重新加载数据', async () => {
      await db.initialize();
      db.dispose();

      // 重新初始化，应重新加载（文件已存在默认数据）
      await db.initialize();
      expect((db as any).isLoaded).toBe(true);
      const all = await db.queryDevices({});
      expect(all).toHaveLength(3);
    });
  });
});
