import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { AnalyzerDriverBase } from '../../drivers/AnalyzerDriverBase';
import { DriverValidator, ValidationReport } from '../tools/DriverValidator';
import { DriverTester, TestReport } from '../tools/DriverTester';
import { HardwareCapabilityBuilder } from '../tools/HardwareCapabilityBuilder';

/**
 * 驱动包信息
 */
export interface DriverPackageInfo {
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  repository?: string;
  keywords: string[];
  supportedDevices: string[];
  dependencies: Record<string, string>;
  driverClass: string;
  qualityLevel: 'experimental' | 'beta' | 'stable' | 'certified';
}

/**
 * 驱动包结构
 */
export interface DriverPackageStructure {
  packageJson: DriverPackageInfo;
  driverFile: string;
  documentationFiles: string[];
  testFiles: string[];
  exampleFiles: string[];
  licenseFile?: string;
  readmeFile?: string;
}

/**
 * 驱动开发工具函数集合
 */
export class DriverUtils {

  /**
   * 创建驱动包
   */
  static async createDriverPackage(
    packageName: string,
    outputDir: string,
    options: {
      author: string;
      description: string;
      driverType: 'serial' | 'network' | 'generic';
      includeTests?: boolean;
      includeExamples?: boolean;
      includeDocs?: boolean;
    }
  ): Promise<string> {
    console.log(`创建驱动包: ${packageName}`);

    const packageDir = join(outputDir, packageName);

    // 创建目录结构
    await fs.mkdir(packageDir, { recursive: true });
    await fs.mkdir(join(packageDir, 'src'), { recursive: true });

    if (options.includeTests) {
      await fs.mkdir(join(packageDir, 'tests'), { recursive: true });
    }

    if (options.includeExamples) {
      await fs.mkdir(join(packageDir, 'examples'), { recursive: true });
    }

    if (options.includeDocs) {
      await fs.mkdir(join(packageDir, 'docs'), { recursive: true });
    }

    // 生成 package.json
    const packageJson: DriverPackageInfo = {
      name: packageName,
      version: '1.0.0',
      description: options.description,
      author: options.author,
      keywords: ['logic-analyzer', 'driver', options.driverType],
      supportedDevices: [],
      dependencies: {
        '@types/node': '^18.0.0',
        'typescript': '^4.9.0'
      },
      driverClass: `${this.pascalCase(packageName)}Driver`,
      qualityLevel: 'experimental'
    };

    await fs.writeFile(
      join(packageDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // 生成驱动类文件
    const driverContent = await this.generateDriverClass(
      packageJson.driverClass,
      options.driverType
    );

    await fs.writeFile(
      join(packageDir, 'src', `${packageJson.driverClass}.ts`),
      driverContent
    );

    // 生成 TypeScript 配置
    const tsConfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        lib: ['ES2020'],
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', 'tests']
    };

    await fs.writeFile(
      join(packageDir, 'tsconfig.json'),
      JSON.stringify(tsConfig, null, 2)
    );

    // 生成 README.md
    if (options.includeDocs) {
      const readmeContent = this.generateReadme(packageJson, options.driverType);
      await fs.writeFile(join(packageDir, 'README.md'), readmeContent);
    }

    // 生成测试文件
    if (options.includeTests) {
      const testContent = this.generateTestFile(packageJson.driverClass);
      await fs.writeFile(
        join(packageDir, 'tests', `${packageJson.driverClass}.test.ts`),
        testContent
      );
    }

    // 生成示例文件
    if (options.includeExamples) {
      const exampleContent = this.generateExampleFile(packageJson.driverClass);
      await fs.writeFile(
        join(packageDir, 'examples', 'basic-usage.ts'),
        exampleContent
      );
    }

    console.log(`驱动包创建完成: ${packageDir}`);
    return packageDir;
  }

  /**
   * 验证驱动实现
   */
  static async validateDriverImplementation(
    driverInstance: AnalyzerDriverBase
  ): Promise<ValidationReport> {
    console.log('开始验证驱动实现...');

    const validator = new DriverValidator();
    const report = await validator.validateDriver(driverInstance);

    console.log(`验证完成，评分: ${report.score}/100`);

    if (report.overallStatus === 'fail') {
      console.error('驱动验证失败，存在严重错误');
    } else if (report.overallStatus === 'warning') {
      console.warn('驱动验证通过，但存在警告');
    } else {
      console.log('驱动验证完全通过');
    }

    return report;
  }

  /**
   * 测试驱动功能
   */
  static async testDriverFunctionality(
    driverInstance: AnalyzerDriverBase,
    mockMode: boolean = true
  ): Promise<TestReport> {
    console.log('开始测试驱动功能...');

    const tester = new DriverTester(mockMode);
    const report = await tester.runAllTests(driverInstance);

    console.log(`测试完成: ${report.passedTests}/${report.totalTests} 通过`);

    if (report.overallStatus === 'fail') {
      console.error('驱动功能测试失败');
    } else if (report.overallStatus === 'partial') {
      console.warn('驱动功能测试部分通过');
    } else {
      console.log('驱动功能测试完全通过');
    }

    return report;
  }

  /**
   * 生成驱动文档
   */
  static async generateDriverDocumentation(
    driverPackagePath: string,
    options?: {
      includeAPI?: boolean;
      includeExamples?: boolean;
      includeConfiguration?: boolean;
      outputFormat?: 'markdown' | 'html' | 'pdf';
    }
  ): Promise<string> {
    console.log('生成驱动文档...');

    const opts = {
      includeAPI: true,
      includeExamples: true,
      includeConfiguration: true,
      outputFormat: 'markdown' as const,
      ...options
    };

    // 读取包信息
    const packageJsonPath = join(driverPackagePath, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

    // 生成文档内容
    let documentation = '';

    // 标题和基本信息
    documentation += `# ${packageJson.name}\n\n`;
    documentation += `${packageJson.description}\n\n`;
    documentation += `**版本**: ${packageJson.version}\n`;
    documentation += `**作者**: ${packageJson.author}\n`;
    documentation += `**质量等级**: ${packageJson.qualityLevel}\n\n`;

    // 支持的设备
    if (packageJson.supportedDevices && packageJson.supportedDevices.length > 0) {
      documentation += '## 支持的设备\n\n';
      packageJson.supportedDevices.forEach((device: string) => {
        documentation += `- ${device}\n`;
      });
      documentation += '\n';
    }

    // 安装说明
    documentation += '## 安装\n\n';
    documentation += '```bash\n';
    documentation += `npm install ${packageJson.name}\n`;
    documentation += '```\n\n';

    // API文档
    if (opts.includeAPI) {
      documentation += await this.generateAPIDocumentation(driverPackagePath);
    }

    // 配置说明
    if (opts.includeConfiguration) {
      documentation += await this.generateConfigurationDocumentation(packageJson);
    }

    // 示例代码
    if (opts.includeExamples) {
      documentation += await this.generateExampleDocumentation(driverPackagePath);
    }

    // 写入文档文件
    const docsDir = join(driverPackagePath, 'docs');
    await fs.mkdir(docsDir, { recursive: true });

    const docFileName = `${packageJson.name}-guide.${opts.outputFormat}`;
    const docFilePath = join(docsDir, docFileName);

    await fs.writeFile(docFilePath, documentation);

    console.log(`文档生成完成: ${docFilePath}`);
    return docFilePath;
  }

  /**
   * 生成驱动类代码
   */
  private static async generateDriverClass(
    className: string,
    driverType: 'serial' | 'network' | 'generic'
  ): Promise<string> {
    const templates = {
      serial: 'SerialDriverTemplate',
      network: 'NetworkDriverTemplate',
      generic: 'GenericDriverTemplate'
    };

    const templateName = templates[driverType];

    return `import { ${templateName} } from '@pico-logicanalyzer/driver-sdk';

/**
 * ${className}
 * 基于${templateName}的自定义驱动实现
 */
export class ${className} extends ${templateName} {
  constructor(connectionString: string) {
    super(connectionString);
    
    // TODO: 添加自定义初始化逻辑
    console.log('${className} 初始化完成');
  }

  // TODO: 重写需要自定义的方法
  // 例如：
  // protected async initializeDevice(): Promise<void> {
  //   await super.initializeDevice();
  //   // 添加设备特定的初始化代码
  // }

  // TODO: 添加设备特定的方法
  // public async getDeviceSpecificInfo(): Promise<any> {
  //   // 实现设备特定的功能
  // }
}
`;
  }

  /**
   * 生成README文件
   */
  private static generateReadme(
    packageInfo: DriverPackageInfo,
    driverType: string
  ): string {
    return `# ${packageInfo.name}

${packageInfo.description}

## 特性

- 基于成熟的${driverType}驱动模板
- 完整的TypeScript类型支持
- 内置验证和测试框架
- 详细的错误处理和日志记录

## 快速开始

\`\`\`typescript
import { ${packageInfo.driverClass} } from '${packageInfo.name}';

// 创建驱动实例
const driver = new ${packageInfo.driverClass}('your-connection-string');

// 连接设备
const result = await driver.connect();
if (result.success) {
  console.log('设备连接成功:', result.deviceInfo);
} else {
  console.error('连接失败:', result.error);
}
\`\`\`

## API文档

请参阅 [docs/api.md](docs/api.md) 获取完整的API文档。

## 配置

请参阅 [docs/configuration.md](docs/configuration.md) 获取配置说明。

## 示例

查看 [examples/](examples/) 目录获取更多使用示例。

## 开发

\`\`\`bash
# 安装依赖
npm install

# 编译
npm run build

# 运行测试
npm test

# 运行验证
npm run validate
\`\`\`

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。

## 支持

- 邮箱: ${packageInfo.author}
- 主页: ${packageInfo.homepage || 'N/A'}
- 仓库: ${packageInfo.repository || 'N/A'}
`;
  }

  /**
   * 生成测试文件
   */
  private static generateTestFile(className: string): string {
    return `import { ${className} } from '../src/${className}';
import { DriverValidator, DriverTester } from '@pico-logicanalyzer/driver-sdk';

describe('${className}', () => {
  let driver: ${className};

  beforeEach(() => {
    driver = new ${className}('test-connection-string');
  });

  afterEach(async () => {
    if (driver) {
      await driver.disconnect();
      driver.dispose();
    }
  });

  describe('基本功能测试', () => {
    it('应该正确初始化', () => {
      expect(driver).toBeInstanceOf(${className});
      expect(driver.driverType).toBeDefined();
      expect(driver.channelCount).toBeGreaterThan(0);
    });

    it('应该支持连接操作', async () => {
      const result = await driver.connect();
      // 注意：这里可能需要模拟或跳过实际的硬件连接
      expect(result).toHaveProperty('success');
    });
  });

  describe('驱动验证', () => {
    it('应该通过驱动验证', async () => {
      const validator = new DriverValidator();
      const report = await validator.validateDriver(driver);
      
      expect(report.overallStatus).not.toBe('fail');
      expect(report.score).toBeGreaterThan(70);
    });
  });

  describe('功能测试', () => {
    it('应该通过基本功能测试', async () => {
      const tester = new DriverTester(true); // 使用模拟模式
      const report = await tester.runAllTests(driver);
      
      expect(report.overallStatus).not.toBe('fail');
      expect(report.passedTests).toBeGreaterThan(0);
    });
  });
});
`;
  }

  /**
   * 生成示例文件
   */
  private static generateExampleFile(className: string): string {
    return `import { ${className} } from '../src/${className}';
import { 
  CaptureSession, 
  TriggerType,
  AnalyzerChannel 
} from '@pico-logicanalyzer/driver-sdk';

async function basicUsageExample() {
  console.log('=== ${className} 基本使用示例 ===');

  // 创建驱动实例
  const driver = new ${className}('your-device-connection-string');

  try {
    // 连接设备
    console.log('正在连接设备...');
    const connectionResult = await driver.connect();
    
    if (!connectionResult.success) {
      throw new Error(\`连接失败: \${connectionResult.error}\`);
    }

    console.log('设备连接成功:', connectionResult.deviceInfo);

    // 查询设备状态
    const status = await driver.getStatus();
    console.log('设备状态:', status);

    // 配置采集会话
    const captureSession: CaptureSession = {
      captureChannels: [
        { channelNumber: 0, channelName: 'CLK', hidden: false },
        { channelNumber: 1, channelName: 'DATA', hidden: false }
      ],
      frequency: 1000000, // 1MHz
      preTriggerSamples: 1000,
      postTriggerSamples: 1000,
      triggerType: TriggerType.Edge,
      triggerChannel: 0,
      loopCount: 1,
      measureBursts: false
    };

    // 开始采集
    console.log('开始数据采集...');
    const captureResult = await driver.startCapture(captureSession);
    
    if (captureResult === 0) { // CaptureError.None
      console.log('采集启动成功，等待完成...');
      
      // 等待采集完成
      while (driver.isCapturing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log('采集完成');
      
      // 处理采集数据
      for (const channel of captureSession.captureChannels) {
        if (channel.samples) {
          console.log(\`通道 \${channel.channelName}: \${channel.samples.length} 个样本\`);
          
          // 显示前10个样本
          const preview = Array.from(channel.samples.slice(0, 10)).join(', ');
          console.log(\`  前10个样本: [\${preview}]\`);
        }
      }
    } else {
      console.error('采集启动失败，错误代码:', captureResult);
    }

  } catch (error) {
    console.error('示例执行失败:', error);
  } finally {
    // 清理资源
    await driver.disconnect();
    driver.dispose();
  }
}

// 运行示例
if (require.main === module) {
  basicUsageExample().catch(console.error);
}

export { basicUsageExample };
`;
  }

  /**
   * 生成API文档
   */
  private static async generateAPIDocumentation(packagePath: string): Promise<string> {
    let apiDoc = '## API 参考\n\n';

    // 这里可以通过静态分析TypeScript代码来生成API文档
    // 或者使用TSDoc等工具

    apiDoc += '### 构造函数\n\n';
    apiDoc += '```typescript\n';
    apiDoc += 'constructor(connectionString: string)\n';
    apiDoc += '```\n\n';
    apiDoc += '创建驱动实例。\n\n';
    apiDoc += '**参数**:\n';
    apiDoc += '- `connectionString`: 设备连接字符串\n\n';

    apiDoc += '### 方法\n\n';
    apiDoc += '#### connect(params?: ConnectionParams): Promise<ConnectionResult>\n\n';
    apiDoc += '连接到设备。\n\n';

    apiDoc += '#### disconnect(): Promise<void>\n\n';
    apiDoc += '断开设备连接。\n\n';

    apiDoc += '#### getStatus(): Promise<DeviceStatus>\n\n';
    apiDoc += '获取设备状态。\n\n';

    apiDoc += '#### startCapture(session: CaptureSession): Promise<CaptureError>\n\n';
    apiDoc += '开始数据采集。\n\n';

    apiDoc += '#### stopCapture(): Promise<boolean>\n\n';
    apiDoc += '停止数据采集。\n\n';

    return apiDoc;
  }

  /**
   * 生成配置文档
   */
  private static async generateConfigurationDocumentation(packageInfo: DriverPackageInfo): Promise<string> {
    let configDoc = '## 配置\n\n';

    configDoc += '### 连接配置\n\n';
    configDoc += '根据设备类型，连接字符串的格式可能不同：\n\n';
    configDoc += '- **串口设备**: `COM3`, `/dev/ttyUSB0`\n';
    configDoc += '- **网络设备**: `192.168.1.100:5555`, `hostname:port`\n';
    configDoc += '- **USB设备**: `usb:vid:pid`, `usb:serial`\n\n';

    configDoc += '### 设备能力\n\n';
    configDoc += '驱动支持以下设备类型：\n\n';

    if (packageInfo.supportedDevices) {
      packageInfo.supportedDevices.forEach(device => {
        configDoc += `- ${device}\n`;
      });
    }

    configDoc += '\n### 环境变量\n\n';
    configDoc += '可以通过以下环境变量配置驱动行为：\n\n';
    configDoc += '- `LOG_LEVEL`: 日志级别 (debug, info, warn, error)\n';
    configDoc += '- `CONNECTION_TIMEOUT`: 连接超时时间（毫秒）\n';
    configDoc += '- `COMMAND_TIMEOUT`: 命令超时时间（毫秒）\n\n';

    return configDoc;
  }

  /**
   * 生成示例文档
   */
  private static async generateExampleDocumentation(packagePath: string): Promise<string> {
    let exampleDoc = '## 使用示例\n\n';

    // 检查是否有示例文件
    const examplesDir = join(packagePath, 'examples');
    try {
      const files = await fs.readdir(examplesDir);

      for (const file of files) {
        if (file.endsWith('.ts') || file.endsWith('.js')) {
          const filePath = join(examplesDir, file);
          const content = await fs.readFile(filePath, 'utf-8');

          exampleDoc += `### ${file}\n\n`;
          exampleDoc += '```typescript\n';
          exampleDoc += content;
          exampleDoc += '```\n\n';
        }
      }
    } catch (error) {
      exampleDoc += '暂无示例文件。\n\n';
    }

    return exampleDoc;
  }

  /**
   * 转换为PascalCase
   */
  private static pascalCase(str: string): string {
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
      .replace(/^(.)/, (_, c) => c.toUpperCase());
  }

  /**
   * 分析驱动包依赖
   */
  static async analyzePackageDependencies(packagePath: string): Promise<{
    dependencies: string[];
    devDependencies: string[];
    missingDependencies: string[];
    suggestions: string[];
  }> {
    const packageJsonPath = join(packagePath, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

    const result = {
      dependencies: Object.keys(packageJson.dependencies || {}),
      devDependencies: Object.keys(packageJson.devDependencies || {}),
      missingDependencies: [] as string[],
      suggestions: [] as string[]
    };

    // 检查常见的缺失依赖
    const commonDependencies = [
      '@types/node',
      'typescript',
      'jest',
      '@types/jest'
    ];

    for (const dep of commonDependencies) {
      if (!result.dependencies.includes(dep) && !result.devDependencies.includes(dep)) {
        result.missingDependencies.push(dep);
      }
    }

    // 生成建议
    if (result.missingDependencies.length > 0) {
      result.suggestions.push('建议添加缺失的依赖包');
    }

    if (!result.devDependencies.includes('jest') && !result.devDependencies.includes('mocha')) {
      result.suggestions.push('建议添加测试框架（如jest）');
    }

    return result;
  }

  /**
   * 检查驱动包完整性
   */
  static async checkPackageIntegrity(packagePath: string): Promise<{
    score: number;
    issues: string[];
    recommendations: string[];
  }> {
    const result = {
      score: 100,
      issues: [] as string[],
      recommendations: [] as string[]
    };

    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'README.md'
    ];

    // 检查必需文件
    for (const file of requiredFiles) {
      const filePath = join(packagePath, file);
      try {
        await fs.access(filePath);
      } catch {
        result.issues.push(`缺少必需文件: ${file}`);
        result.score -= 20;
      }
    }

    // 检查src目录
    try {
      const srcDir = join(packagePath, 'src');
      const srcFiles = await fs.readdir(srcDir);
      if (srcFiles.length === 0) {
        result.issues.push('src目录为空');
        result.score -= 30;
      }
    } catch {
      result.issues.push('缺少src目录');
      result.score -= 30;
    }

    // 检查测试目录
    try {
      const testDir = join(packagePath, 'tests');
      await fs.access(testDir);
    } catch {
      result.recommendations.push('建议添加tests目录和测试文件');
      result.score -= 10;
    }

    // 检查文档目录
    try {
      const docsDir = join(packagePath, 'docs');
      await fs.access(docsDir);
    } catch {
      result.recommendations.push('建议添加docs目录和文档文件');
      result.score -= 5;
    }

    result.score = Math.max(0, result.score);
    return result;
  }
}
