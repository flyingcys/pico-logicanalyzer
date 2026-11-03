import * as fs from 'fs';
import { mkdtemp, rm, copyFile, readFile } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

describe('CLI export 子命令真进程测试', () => {
  const cliPath = path.resolve(__dirname, '../../../out/cli/index.js');
  const fixtureLac = path.resolve(__dirname, '../../fixtures/lac/current-lowercase-samples.lac');
  let tempDir: string;

  beforeAll(() => {
    // 防御性断言：确保 CLI 编译产物存在
    expect(fs.existsSync(cliPath)).toBe(true);
    expect(fs.existsSync(fixtureLac)).toBe(true);
  });

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'logic-cli-export-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('判据 1：真实导出单文件为 CSV 并校验表头与内容', async () => {
    const targetCsv = path.join(tempDir, 'sample_export.csv');

    const { stdout, stderr } = await execFileAsync(process.execPath, [
      cliPath,
      'export',
      fixtureLac,
      '--format',
      'csv',
      '-o',
      targetCsv
    ]);

    expect(stderr).toBe('');
    expect(stdout).toContain('[OK]');
    expect(fs.existsSync(targetCsv)).toBe(true);

    const csvContent = await readFile(targetCsv, 'utf8');
    const lines = csvContent.trim().split('\n');

    // 结构与表头断言
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0]).toMatch(/sample|time|ch/i);
    expect(csvContent).toMatch(/CH0|ch0/i);
  });

  it('判据 2：批量导出多个文件至指定目录', async () => {
    const lac1 = path.join(tempDir, 'file1.lac');
    const lac2 = path.join(tempDir, 'file2.lac');
    await copyFile(fixtureLac, lac1);
    await copyFile(fixtureLac, lac2);

    const outDir = path.join(tempDir, 'batch_out');

    const { stdout, stderr } = await execFileAsync(process.execPath, [
      cliPath,
      'export',
      lac1,
      lac2,
      '--format',
      'json',
      '--out-dir',
      outDir
    ]);

    expect(stderr).toBe('');
    expect(stdout).toContain('全部导出完成: 2/2 个文件成功');

    const out1 = path.join(outDir, 'file1.json');
    const out2 = path.join(outDir, 'file2.json');

    expect(fs.existsSync(out1)).toBe(true);
    expect(fs.existsSync(out2)).toBe(true);

    // 校验 JSON 格式有效性
    const parsed1 = JSON.parse(await readFile(out1, 'utf8'));
    const parsed2 = JSON.parse(await readFile(out2, 'utf8'));
    expect(parsed1).toBeDefined();
    expect(parsed2).toBeDefined();
  });

  it('判据 3：输入不存在的文件时失败可见且返回非 0 退出码', async () => {
    const nonExistent = path.join(tempDir, 'ghost-non-existent.lac');

    try {
      await execFileAsync(process.execPath, [
        cliPath,
        'export',
        nonExistent,
        '--format',
        'csv'
      ]);
      fail('应该抛出非 0 退出码异常');
    } catch (err: any) {
      expect(err.code).not.toBe(0);
      expect(err.stderr || err.message).toContain('不存在');
    }
  });

  it('互斥校验：批量多文件时若使用 -o 指定单一输出文件名应报错非 0', async () => {
    const lac1 = path.join(tempDir, 'file1.lac');
    const lac2 = path.join(tempDir, 'file2.lac');
    await copyFile(fixtureLac, lac1);
    await copyFile(fixtureLac, lac2);

    try {
      await execFileAsync(process.execPath, [
        cliPath,
        'export',
        lac1,
        lac2,
        '-o',
        path.join(tempDir, 'conflict.csv')
      ]);
      fail('应该因参数互斥报错退出');
    } catch (err: any) {
      expect(err.code).toBe(2);
      expect(err.stderr || err.message).toContain('--out-dir');
    }
  });

  it('重名防冲突：同名文件导出至同一目录时自动追加自增序号', async () => {
    const subDirA = path.join(tempDir, 'subA');
    const subDirB = path.join(tempDir, 'subB');
    await fs.promises.mkdir(subDirA, { recursive: true });
    await fs.promises.mkdir(subDirB, { recursive: true });

    const lacA = path.join(subDirA, 'data.lac');
    const lacB = path.join(subDirB, 'data.lac');
    await copyFile(fixtureLac, lacA);
    await copyFile(fixtureLac, lacB);

    const outDir = path.join(tempDir, 'unified_out');

    const { stdout } = await execFileAsync(process.execPath, [
      cliPath,
      'export',
      lacA,
      lacB,
      '--format',
      'csv',
      '--out-dir',
      outDir
    ]);

    expect(stdout).toContain('检测到重名冲突');
    expect(fs.existsSync(path.join(outDir, 'data.csv'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'data_1.csv'))).toBe(true);
  });
});
