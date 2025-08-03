import { DriverUtils, DriverPackageInfo, DriverPackageStructure } from '../../../../src/driver-sdk/utils/DriverUtils';
import { AnalyzerDriverBase } from '../../../../src/drivers/AnalyzerDriverBase';
import { DriverValidator } from '../../../../src/driver-sdk/tools/DriverValidator';
import { DriverTester } from '../../../../src/driver-sdk/tools/DriverTester';
import {
  AnalyzerDriverType,
  ConnectionParams,
  ConnectionResult,
  CaptureSession,
  CaptureError,
  DeviceStatus
} from '../../../../src/models/AnalyzerTypes';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock 驱动用于测试
class MockTestDriver extends AnalyzerDriverBase {
  get deviceVersion(): string | null { return 'v1.0.0'; }
  get channelCount(): number { return 8; }
  get maxFrequency(): number { return 100000000; }
  get blastFrequency(): number { return 200000000; }
  get bufferSize(): number { return 1000000; }
  get isNetwork(): boolean { return false; }
  get isCapturing(): boolean { return false; }
  get driverType(): AnalyzerDriverType { return AnalyzerDriverType.Serial; }

  async connect(params?: ConnectionParams): Promise<ConnectionResult> {
    return { success: true, deviceInfo: { name: 'Mock Device' } };
  }

  async disconnect(): Promise<void> {}

  async startCapture(session: CaptureSession): Promise<CaptureError> {
    return CaptureError.None;
  }

  async stopCapture(): Promise<boolean> {
    return true;
  }

  async getStatus(): Promise<DeviceStatus> {
    return {
      isConnected: true,
      isCapturing: false,
      lastError: null,
      batteryLevel: 100,
      temperature: 25
    };
  }

  dispose(): void {}
}

describe('DriverUtils', () => {
  let tempDir: string;

  beforeEach(async () => {
    // 创建临时目录用于测试
    tempDir = await fs.mkdtemp(join(tmpdir(), 'driver-utils-test-'));
  });

  afterEach(async () => {
    // 清理临时目录
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('清理临时目录失败:', error);
    }
  });

  describe('createDriverPackage', () => {
    it('应该成功创建串口驱动包', async () => {
      const packageName = 'test-serial-driver';
      const options = {
        author: 'Test Author',
        description: '测试串口驱动',
        driverType: 'serial' as const,
        includeTests: true,
        includeExamples: true,
        includeDocs: true
      };

      const packageDir = await DriverUtils.createDriverPackage(packageName, tempDir, options);

      // 验证返回路径
      expect(packageDir).toBe(join(tempDir, packageName));

      // 验证目录结构
      expect(await fs.access(packageDir).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(join(packageDir, 'src')).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(join(packageDir, 'tests')).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(join(packageDir, 'examples')).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(join(packageDir, 'docs')).then(() => true).catch(() => false)).toBe(true);

      // 验证必需文件
      expect(await fs.access(join(packageDir, 'package.json')).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(join(packageDir, 'tsconfig.json')).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(join(packageDir, 'README.md')).then(() => true).catch(() => false)).toBe(true);
    }, 10000);

    it('应该成功创建网络驱动包', async () => {
      const packageName = 'test-network-driver';
      const options = {
        author: 'Test Author',
        description: '测试网络驱动',
        driverType: 'network' as const,
        includeTests: false,
        includeExamples: false,
        includeDocs: false
      };

      const packageDir = await DriverUtils.createDriverPackage(packageName, tempDir, options);

      // 验证基本结构
      expect(await fs.access(packageDir).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(join(packageDir, 'src')).then(() => true).catch(() => false)).toBe(true);

      // 验证可选目录不存在
      expect(await fs.access(join(packageDir, 'tests')).then(() => true).catch(() => false)).toBe(false);
      expect(await fs.access(join(packageDir, 'examples')).then(() => true).catch(() => false)).toBe(false);
      expect(await fs.access(join(packageDir, 'docs')).then(() => true).catch(() => false)).toBe(false);
      expect(await fs.access(join(packageDir, 'README.md')).then(() => true).catch(() => false)).toBe(false);
    }, 10000);

    it('应该成功创建通用驱动包', async () => {
      const packageName = 'test-generic-driver';
      const options = {
        author: 'Test Author',
        description: '测试通用驱动',
        driverType: 'generic' as const
      };

      const packageDir = await DriverUtils.createDriverPackage(packageName, tempDir, options);

      // 验证package.json内容
      const packageJsonPath = join(packageDir, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson: DriverPackageInfo = JSON.parse(packageJsonContent);

      expect(packageJson.name).toBe(packageName);
      expect(packageJson.author).toBe(options.author);
      expect(packageJson.description).toBe(options.description);
      expect(packageJson.keywords).toContain('generic');
      expect(packageJson.driverClass).toBe('TestGenericDriverDriver');
      expect(packageJson.qualityLevel).toBe('experimental');
    }, 10000);

    it('应该正确生成驱动类文件', async () => {
      const packageName = 'driver-class-test';
      const options = {
        author: 'Test Author',
        description: '驱动类测试',
        driverType: 'serial' as const
      };

      const packageDir = await DriverUtils.createDriverPackage(packageName, tempDir, options);

      // 读取生成的驱动类文件
      const driverFileName = 'DriverClassTestDriver.ts';
      const driverFilePath = join(packageDir, 'src', driverFileName);
      const driverContent = await fs.readFile(driverFilePath, 'utf-8');

      expect(driverContent).toContain('export class DriverClassTestDriver');
      expect(driverContent).toContain('extends SerialDriverTemplate');
      expect(driverContent).toContain('DriverClassTestDriver 初始化完成');
    }, 10000);

    it('应该正确生成TypeScript配置', async () => {
      const packageName = 'tsconfig-test';
      const options = {
        author: 'Test Author',
        description: 'TypeScript配置测试',
        driverType: 'network' as const
      };

      const packageDir = await DriverUtils.createDriverPackage(packageName, tempDir, options);

      // 验证tsconfig.json
      const tsconfigPath = join(packageDir, 'tsconfig.json');
      const tsconfigContent = await fs.readFile(tsconfigPath, 'utf-8');
      const tsconfig = JSON.parse(tsconfigContent);

      expect(tsconfig.compilerOptions.target).toBe('ES2020');
      expect(tsconfig.compilerOptions.module).toBe('commonjs');
      expect(tsconfig.compilerOptions.strict).toBe(true);
      expect(tsconfig.compilerOptions.outDir).toBe('./dist');
      expect(tsconfig.compilerOptions.rootDir).toBe('./src');
    }, 10000);
  });

  describe('validateDriverImplementation', () => {
    it('应该成功验证有效驱动', async () => {
      const mockDriver = new MockTestDriver('test');
      const report = await DriverUtils.validateDriverImplementation(mockDriver);

      expect(report).toBeDefined();
      expect(report.driverName).toBe('MockTestDriver');
      expect(report.overallStatus).not.toBe('fail');
      expect(report.score).toBeGreaterThan(0);

      mockDriver.dispose();
    });

    it('应该记录验证过程日志', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const mockDriver = new MockTestDriver('test');
      await DriverUtils.validateDriverImplementation(mockDriver);

      expect(consoleSpy).toHaveBeenCalledWith('开始验证驱动实现...');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('验证完成，评分:'));

      consoleSpy.mockRestore();
      mockDriver.dispose();
    });

    it('应该正确处理验证失败情况', async () => {
      // 创建一个必然失败的驱动
      const FailingDriver = class extends AnalyzerDriverBase {
        get deviceVersion(): string | null { return null; }
        get channelCount(): number { return -1; }
        get maxFrequency(): number { return -1; }
        get blastFrequency(): number { return -1; }
        get bufferSize(): number { return -1; }
        get isNetwork(): boolean { return false; }
        get isCapturing(): boolean { return false; }
        get driverType(): AnalyzerDriverType { return AnalyzerDriverType.Serial; }

        async connect(): Promise<ConnectionResult> {
          return { success: false, error: '连接失败' };
        }
        async disconnect(): Promise<void> {}
        async startCapture(): Promise<CaptureError> { return CaptureError.UnknownError; }
        async stopCapture(): Promise<boolean> { return false; }
        async getStatus(): Promise<DeviceStatus> {
          throw new Error('状态查询失败');
        }
        dispose(): void {}
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const failingDriver = new FailingDriver('test');
      const report = await DriverUtils.validateDriverImplementation(failingDriver);

      expect(report.overallStatus).toBe('fail');
      expect(consoleSpy).toHaveBeenCalledWith('驱动验证失败，存在严重错误');

      consoleSpy.mockRestore();
      failingDriver.dispose();
    });
  });

  describe('testDriverFunctionality', () => {
    it('应该成功测试驱动功能', async () => {
      const mockDriver = new MockTestDriver('test');
      const report = await DriverUtils.testDriverFunctionality(mockDriver, true);

      expect(report).toBeDefined();
      expect(report.driverName).toBe('MockTestDriver');
      expect(report.totalTests).toBeGreaterThan(0);
      expect(typeof report.passedTests).toBe('number');
      expect(typeof report.failedTests).toBe('number');

      mockDriver.dispose();
    }, 15000);

    it('应该支持实际模式和模拟模式', async () => {
      const mockDriver = new MockTestDriver('test');
      
      const mockReport = await DriverUtils.testDriverFunctionality(mockDriver, true);
      const realReport = await DriverUtils.testDriverFunctionality(mockDriver, false);

      expect(mockReport).toBeDefined();
      expect(realReport).toBeDefined();
      
      // 两种模式都应该能运行测试
      expect(mockReport.totalTests).toBeGreaterThan(0);
      expect(realReport.totalTests).toBeGreaterThan(0);

      mockDriver.dispose();
    }, 20000);

    it('应该记录测试过程日志', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const mockDriver = new MockTestDriver('test');
      await DriverUtils.testDriverFunctionality(mockDriver, true);

      expect(consoleSpy).toHaveBeenCalledWith('开始测试驱动功能...');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('测试完成:'));

      consoleSpy.mockRestore();
      mockDriver.dispose();
    }, 15000);
  });

  describe('generateDriverDocumentation', () => {
    it('应该成功生成驱动文档', async () => {
      // 首先创建一个驱动包
      const packageName = 'doc-test-driver';
      const options = {
        author: 'Doc Test Author',
        description: '文档测试驱动',
        driverType: 'serial' as const,
        includeExamples: true,
        includeDocs: true
      };

      const packageDir = await DriverUtils.createDriverPackage(packageName, tempDir, options);

      // 生成文档
      const docPath = await DriverUtils.generateDriverDocumentation(packageDir);

      expect(docPath).toBeDefined();
      expect(await fs.access(docPath).then(() => true).catch(() => false)).toBe(true);

      // 验证文档内容
      const docContent = await fs.readFile(docPath, 'utf-8');
      expect(docContent).toContain(`# ${packageName}`);
      expect(docContent).toContain(options.description);
      expect(docContent).toContain(options.author);
      expect(docContent).toContain('## 安装');
      expect(docContent).toContain('## API 参考');
    }, 15000);

    it('应该支持自定义文档选项', async () => {
      const packageName = 'custom-doc-driver';
      const options = {
        author: 'Custom Author',
        description: '自定义文档驱动',
        driverType: 'network' as const,
        includeDocs: true
      };

      const packageDir = await DriverUtils.createDriverPackage(packageName, tempDir, options);

      const docOptions = {
        includeAPI: false,
        includeExamples: false,
        includeConfiguration: true,
        outputFormat: 'markdown' as const
      };

      const docPath = await DriverUtils.generateDriverDocumentation(packageDir, docOptions);
      const docContent = await fs.readFile(docPath, 'utf-8');

      expect(docContent).toContain('## 配置');
      expect(docContent).not.toContain('## 使用示例');
    }, 15000);

    it('应该处理缺少示例文件的情况', async () => {
      const packageName = 'no-examples-driver';
      const options = {
        author: 'No Examples Author',
        description: '无示例驱动',
        driverType: 'generic' as const,
        includeExamples: false, // 不包含示例
        includeDocs: true
      };

      const packageDir = await DriverUtils.createDriverPackage(packageName, tempDir, options);

      const docPath = await DriverUtils.generateDriverDocumentation(packageDir);
      const docContent = await fs.readFile(docPath, 'utf-8');

      expect(docContent).toContain('暂无示例文件');
    }, 15000);
  });

  describe('analyzePackageDependencies', () => {
    it('应该正确分析包依赖', async () => {
      const packageName = 'deps-test-driver';
      const options = {
        author: 'Deps Test Author',
        description: '依赖测试驱动',
        driverType: 'serial' as const
      };

      const packageDir = await DriverUtils.createDriverPackage(packageName, tempDir, options);
      const analysis = await DriverUtils.analyzePackageDependencies(packageDir);

      expect(analysis).toBeDefined();
      expect(analysis.dependencies).toBeInstanceOf(Array);
      expect(analysis.devDependencies).toBeInstanceOf(Array);
      expect(analysis.missingDependencies).toBeInstanceOf(Array);
      expect(analysis.suggestions).toBeInstanceOf(Array);

      // 检查是否包含基本依赖
      expect(analysis.dependencies.concat(analysis.devDependencies)).toContain('@types/node');
      expect(analysis.dependencies.concat(analysis.devDependencies)).toContain('typescript');
    }, 10000);

    it('应该检测缺失的常见依赖', async () => {
      // 创建一个缺少依赖的package.json
      const testPackageDir = join(tempDir, 'minimal-package');
      await fs.mkdir(testPackageDir, { recursive: true });

      const minimalPackageJson = {
        name: 'minimal-package',
        version: '1.0.0',
        dependencies: {},
        devDependencies: {}
      };

      await fs.writeFile(
        join(testPackageDir, 'package.json'),
        JSON.stringify(minimalPackageJson, null, 2)
      );

      const analysis = await DriverUtils.analyzePackageDependencies(testPackageDir);

      expect(analysis.missingDependencies.length).toBeGreaterThan(0);
      expect(analysis.missingDependencies).toContain('@types/node');
      expect(analysis.missingDependencies).toContain('typescript');
      expect(analysis.suggestions.length).toBeGreaterThan(0);
    }, 10000);

    it('应该提供测试框架建议', async () => {
      const testPackageDir = join(tempDir, 'no-test-package');
      await fs.mkdir(testPackageDir, { recursive: true });

      const packageJsonWithoutTests = {
        name: 'no-test-package',
        version: '1.0.0',
        dependencies: {
          '@types/node': '^18.0.0',
          'typescript': '^4.9.0'
        },
        devDependencies: {}
      };

      await fs.writeFile(
        join(testPackageDir, 'package.json'),
        JSON.stringify(packageJsonWithoutTests, null, 2)
      );

      const analysis = await DriverUtils.analyzePackageDependencies(testPackageDir);

      expect(analysis.suggestions).toContain('建议添加测试框架（如jest）');
    }, 10000);
  });

  describe('checkPackageIntegrity', () => {
    it('应该正确检查完整包的完整性', async () => {
      const packageName = 'integrity-test-driver';
      const options = {
        author: 'Integrity Test Author',
        description: '完整性测试驱动',
        driverType: 'serial' as const,
        includeTests: true,
        includeExamples: true,
        includeDocs: true
      };

      const packageDir = await DriverUtils.createDriverPackage(packageName, tempDir, options);
      const integrity = await DriverUtils.checkPackageIntegrity(packageDir);

      expect(integrity.score).toBeGreaterThan(80);
      expect(integrity.issues.length).toBe(0);
      expect(integrity.recommendations.length).toBeLessThanOrEqual(2); // 可能有一些小建议
    }, 10000);

    it('应该检测缺失的必需文件', async () => {
      const incompletePackageDir = join(tempDir, 'incomplete-package');
      await fs.mkdir(incompletePackageDir, { recursive: true });

      // 只创建部分必需文件
      await fs.writeFile(join(incompletePackageDir, 'package.json'), '{}');

      const integrity = await DriverUtils.checkPackageIntegrity(incompletePackageDir);

      expect(integrity.score).toBeLessThan(80);
      expect(integrity.issues.length).toBeGreaterThan(0);
      expect(integrity.issues).toContain('缺少必需文件: tsconfig.json');
      expect(integrity.issues).toContain('缺少必需文件: README.md');
    }, 10000);

    it('应该检测空的src目录', async () => {
      const emptySrcPackageDir = join(tempDir, 'empty-src-package');
      await fs.mkdir(emptySrcPackageDir, { recursive: true });
      await fs.mkdir(join(emptySrcPackageDir, 'src'), { recursive: true });

      // 创建必需文件但保持src为空
      await fs.writeFile(join(emptySrcPackageDir, 'package.json'), '{}');
      await fs.writeFile(join(emptySrcPackageDir, 'tsconfig.json'), '{}');
      await fs.writeFile(join(emptySrcPackageDir, 'README.md'), '# Test');

      const integrity = await DriverUtils.checkPackageIntegrity(emptySrcPackageDir);

      expect(integrity.issues).toContain('src目录为空');
      expect(integrity.score).toBeLessThan(100);
    }, 10000);

    it('应该给出有用的建议', async () => {
      const basicPackageDir = join(tempDir, 'basic-package');
      await fs.mkdir(basicPackageDir, { recursive: true });
      await fs.mkdir(join(basicPackageDir, 'src'), { recursive: true });

      // 创建基本结构但缺少测试和文档
      await fs.writeFile(join(basicPackageDir, 'package.json'), '{}');
      await fs.writeFile(join(basicPackageDir, 'tsconfig.json'), '{}');
      await fs.writeFile(join(basicPackageDir, 'README.md'), '# Test');
      await fs.writeFile(join(basicPackageDir, 'src', 'index.ts'), 'export {};');

      const integrity = await DriverUtils.checkPackageIntegrity(basicPackageDir);

      expect(integrity.recommendations).toContain('建议添加tests目录和测试文件');
      expect(integrity.recommendations).toContain('建议添加docs目录和文档文件');
    }, 10000);
  });

  describe('辅助功能测试', () => {
    it('应该正确转换PascalCase', async () => {
      // 通过创建包并检查生成的类名来间接测试
      const testCases = [
        'test-driver',
        'test_driver',
        'testDriver',
        'TestDriver'
      ];

      for (const testCase of testCases) {
        const options = {
          author: 'Test Author',
          description: 'PascalCase测试',
          driverType: 'generic' as const
        };

        const packageDir = await DriverUtils.createDriverPackage(testCase, tempDir, options);
        const packageJsonPath = join(packageDir, 'package.json');
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

        // 验证类名是PascalCase格式
        expect(packageJson.driverClass).toMatch(/^[A-Z][a-zA-Z0-9]*Driver$/);
      }
    }, 15000);

    it('应该处理特殊字符的包名', async () => {
      const specialPackageName = 'special-@#$-package';
      const options = {
        author: 'Special Author',
        description: '特殊字符测试',
        driverType: 'serial' as const
      };

      // 应该能够处理而不崩溃
      const packageDir = await DriverUtils.createDriverPackage(specialPackageName, tempDir, options);
      expect(await fs.access(packageDir).then(() => true).catch(() => false)).toBe(true);
    }, 10000);
  });

  describe('错误处理', () => {
    it('应该处理文件系统错误', async () => {
      const readOnlyDir = '/root'; // 通常没有写权限的目录
      
      const options = {
        author: 'Error Test Author',
        description: '错误处理测试',
        driverType: 'serial' as const
      };

      // 应该抛出错误或优雅处理
      await expect(
        DriverUtils.createDriverPackage('error-test', readOnlyDir, options)
      ).rejects.toThrow();
    });

    it('应该处理无效的包路径', async () => {
      await expect(
        DriverUtils.analyzePackageDependencies('/non/existent/path')
      ).rejects.toThrow();

      await expect(
        DriverUtils.checkPackageIntegrity('/non/existent/path')
      ).rejects.toThrow();

      await expect(
        DriverUtils.generateDriverDocumentation('/non/existent/path')
      ).rejects.toThrow();
    });

    it('应该处理损坏的package.json', async () => {
      const corruptedPackageDir = join(tempDir, 'corrupted-package');
      await fs.mkdir(corruptedPackageDir, { recursive: true });
      await fs.writeFile(join(corruptedPackageDir, 'package.json'), '{invalid json');

      await expect(
        DriverUtils.analyzePackageDependencies(corruptedPackageDir)
      ).rejects.toThrow();

      await expect(
        DriverUtils.generateDriverDocumentation(corruptedPackageDir)
      ).rejects.toThrow();
    });
  });
});