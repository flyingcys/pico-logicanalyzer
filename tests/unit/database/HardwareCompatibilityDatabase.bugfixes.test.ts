/**
 * HardwareCompatibilityDatabase Bugfix 回归测试
 *
 * 覆盖两个已修复的 bug：
 * 1. buildIndexes 用索引前缀 'scpiIdn'，而 queryDevices 用 query.identifierType
 *    （类型定义为 'scpiIdnResponse'）拼 key，两者永不匹配 → SCPI IDN 标识符查询永远返回空。
 *    修复：统一索引前缀为 'scpiIdnResponse'。
 * 2. databasePath 不含 '/' 时 lastIndexOf 返回 -1，substring(0, -1) 得空串，
 *    mkdir('') 抛错。修复：无 '/' 时退化为当前工作目录 '.'。
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { HardwareCompatibilityDatabase } from '../../../src/database/HardwareCompatibilityDatabase';

describe('HardwareCompatibilityDatabase bugfixes', () => {
  let tmpDir: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hwcompat-bugfix-'));
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  describe('bug1: SCPI IDN 标识符查询索引前缀不一致', () => {
    // 默认种子数据 rigol-mso5000 的 identifiers.scpiIdnResponse = 'RIGOL TECHNOLOGIES,MSO5*'
    const SCPI_IDN_VALUE = 'RIGOL TECHNOLOGIES,MSO5*';

    it('用 identifierType="scpiIdnResponse" 查询应匹配到 rigol-mso5000（修复前返回空）', async () => {
      const dbPath = path.join(tmpDir, 'nested', 'hardware-compatibility.json');
      const db = new HardwareCompatibilityDatabase(dbPath);
      await db.initialize();

      const results = await db.queryDevices({
        identifierType: 'scpiIdnResponse',
        identifierValue: SCPI_IDN_VALUE
      });

      // 修复前：buildIndexes 写入 'scpiIdn:...'，queryDevices 查 'scpiIdnResponse:...'，永不匹配 → 返回 []
      // 修复后：前缀统一为 'scpiIdnResponse'，命中 rigol-mso5000
      expect(results).toHaveLength(1);
      expect(results[0].deviceId).toBe('rigol-mso5000');
      db.dispose();
    });

    it('查询值大小写不敏感（索引与查询均做 toLowerCase）', async () => {
      const dbPath = path.join(tmpDir, 'hardware-compatibility.json');
      const db = new HardwareCompatibilityDatabase(dbPath);
      await db.initialize();

      const results = await db.queryDevices({
        identifierType: 'scpiIdnResponse',
        identifierValue: SCPI_IDN_VALUE.toLowerCase()
      });

      expect(results).toHaveLength(1);
      expect(results[0].deviceId).toBe('rigol-mso5000');
      db.dispose();
    });

    it('未匹配的 SCPI IDN 值返回空集', async () => {
      const dbPath = path.join(tmpDir, 'hardware-compatibility.json');
      const db = new HardwareCompatibilityDatabase(dbPath);
      await db.initialize();

      const results = await db.queryDevices({
        identifierType: 'scpiIdnResponse',
        identifierValue: 'NONEXISTENT,VENDOR*'
      });

      expect(results).toHaveLength(0);
      db.dispose();
    });

    it('vendorId / productId 标识符查询仍正常工作（回归保护）', async () => {
      const dbPath = path.join(tmpDir, 'hardware-compatibility.json');
      const db = new HardwareCompatibilityDatabase(dbPath);
      await db.initialize();

      // 默认数据 saleae-logic-8: vendorId='0925', productId='3881'
      const byVendor = await db.queryDevices({
        identifierType: 'vendorId',
        identifierValue: '0925'
      });
      expect(byVendor.map(d => d.deviceId)).toContain('saleae-logic-8');

      const byProduct = await db.queryDevices({
        identifierType: 'productId',
        identifierValue: '3881'
      });
      expect(byProduct.map(d => d.deviceId)).toContain('saleae-logic-8');

      db.dispose();
    });
  });

  describe('bug2: 无路径分隔符的 databasePath 不应导致 mkdir 抛错', () => {
    it('databasePath 不含 "/" 时 initialize 成功完成', async () => {
      // chdir 到 tmp 目录，避免纯文件名写入项目目录污染仓库
      process.chdir(tmpDir);
      const plainFilename = 'hardware-compatibility.json';
      const db = new HardwareCompatibilityDatabase(plainFilename);

      // 修复前：lastIndexOf('/')=-1 → substring(0,-1)='' → mkdir('') 抛 EINVAL/ENOENT
      // 修复后：无 '/' 时 dataDir 退化为 '.'，mkdir('.', {recursive:true}) 成功
      await expect(db.initialize()).resolves.not.toThrow();

      // 进一步验证数据库确实加载成功（默认数据应已写入）
      const stats = await db.getStatistics();
      expect(stats.totalDevices).toBeGreaterThan(0);

      db.dispose();
      await fs.promises.rm(path.join(tmpDir, plainFilename), { force: true }).catch(() => {});
    });
  });
});
