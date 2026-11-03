import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DriverUtils } from '../../../src/driver-sdk/utils/DriverUtils';

describe('DriverUtils release wording', () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(join(tmpdir(), 'driver-utils-release-'));
  });

  /**
   * ⚠️ 必须清理：`beforeEach` 每个用例建一个临时目录。
   *
   * 原先没有这一步 ⇒ 每跑一次测试，`/tmp` 就多 2 个 `driver-utils-release-*`
   * 目录，且**永不删除**（测试正常跑完、正常退出，目录就是不删）。
   * 实测：连跑一次 4 → 6。
   *
   * 检查方式：`ls -d /tmp/driver-utils-release-* | wc -l`
   *
   * 用 `afterEach` 而不是 `afterAll`：`tempRoot` 每个用例都会重建，
   * 前一个用例的目录在 `beforeEach` 里就被覆盖了引用 —— 只有 `afterEach`
   * 能在引用丢失前删掉它。
   */
  afterEach(async () => {
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('生成的驱动包明确标注实验性脚手架边界', async () => {
    const packageDir = await DriverUtils.createDriverPackage('sample-driver', tempRoot, {
      author: '测试作者',
      description: '示例驱动',
      driverType: 'serial',
      includeDocs: true
    });

    const readme = await fs.readFile(join(packageDir, 'README.md'), 'utf-8');
    const driverSource = await fs.readFile(join(packageDir, 'src', 'SampleDriverDriver.ts'), 'utf-8');

    expect(readme).toContain('实验性脚手架');
    expect(readme).toContain('必须完成设备协议、采集解析和真实硬件验证后才能提升质量等级');
    expect(readme).not.toContain('成熟');
    expect(driverSource).toContain('IMPLEMENTATION_REQUIRED');
    expect(driverSource).not.toContain('TODO');
  });

  it('生成的驱动文档不把 HTML/PDF 输出描述为可发布报告', async () => {
    const packageDir = await DriverUtils.createDriverPackage('report-driver', tempRoot, {
      author: '测试作者',
      description: '报告示例驱动',
      driverType: 'generic'
    });

    const docPath = await DriverUtils.generateDriverDocumentation(packageDir, {
      outputFormat: 'pdf'
    });

    const documentation = await fs.readFile(docPath, 'utf-8');

    expect(docPath).toMatch(/\.pdf$/);
    expect(documentation).toContain('实验性文档输出');
    expect(documentation).toContain('当前内容仍为 Markdown 文本');
    expect(documentation).not.toContain('PDF 报告可用');
  });
});
