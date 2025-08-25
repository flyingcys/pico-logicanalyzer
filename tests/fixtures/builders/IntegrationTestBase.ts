/**
 * 集成测试基类 - P2架构核心组件
 * 
 * 功能：
 * - 环境隔离：临时目录和动态端口分配
 * - 资源管理：自动化的setup/cleanup流程
 * - 测试工具集成：标准化Mock和工具函数
 * 
 * 遵循质量标准:
 * - 文件大小 < 200行 ✅
 * - Mock数量 < 5个 ✅
 * - 专注环境隔离和资源管理
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as tmp from 'tmp';
import * as portfinder from 'portfinder';
import { ConfigurationManager } from '../../../src/services/ConfigurationManager';
import { LogicAnalyzerDriver } from '../../../src/drivers/LogicAnalyzerDriver';
import { MockHardwareInterface, createMockHardware } from '../utils/MockHardware';
import { waitForCondition, createTestFile, setupTestConfiguration } from '../utils/TestUtils';

// 清理临时目录配置
tmp.setGracefulCleanup();

/**
 * 测试环境隔离配置
 */
interface TestEnvironment {
  tempDir: string;
  testPort: number;
  configPath: string;
  dataPath: string;
}

/**
 * 集成测试抽象基类
 * 提供环境隔离、资源管理和测试工具
 */
abstract class IntegrationTestBase {
  protected testEnv!: TestEnvironment;
  protected mockHardware!: MockHardwareInterface;
  protected configManager!: ConfigurationManager;
  
  /**
   * 测试前置环境搭建
   */
  async beforeEach(): Promise<void> {
    // 创建隔离的临时目录
    const tempDirObj = tmp.dirSync({ unsafeCleanup: true });
    
    // 动态分配测试端口
    const testPort = await portfinder.getPortPromise({
      port: 3000,
      stopPort: 9999
    });
    
    // 构建测试环境
    this.testEnv = {
      tempDir: tempDirObj.name,
      testPort,
      configPath: path.join(tempDirObj.name, 'config'),
      dataPath: path.join(tempDirObj.name, 'data')
    };
    
    // 创建必要的子目录
    await fs.ensureDir(this.testEnv.configPath);
    await fs.ensureDir(this.testEnv.dataPath);
    
    // 初始化Mock硬件和配置管理器
    this.mockHardware = createMockHardware();
    this.configManager = await this.createTestConfigManager();
  }
  
  /**
   * 测试后置资源清理
   */
  async afterEach(): Promise<void> {
    try {
      // 断开Mock硬件连接
      if (this.mockHardware?.isConnected) {
        await this.mockHardware.disconnect();
      }
      
      // 清理配置管理器
      if (this.configManager) {
        await this.configManager.dispose();
      }
      
      // 临时目录由tmp模块自动清理
    } catch (error) {
      console.warn('集成测试清理警告:', error);
    }
  }
  
  /**
   * 创建测试专用的配置管理器
   */
  protected async createTestConfigManager(): Promise<ConfigurationManager> {
    const configManager = new ConfigurationManager();
    
    // 使用隔离的配置路径
    await configManager.initialize();
    
    // 设置测试默认配置
    await setupTestConfiguration(configManager);
    
    return configManager;
  }
  
  /**
   * 创建测试用的LogicAnalyzerDriver实例
   */
  protected createTestDriver(connectionString?: string): LogicAnalyzerDriver {
    const testConnection = connectionString || `localhost:${this.testEnv.testPort}`;
    return new LogicAnalyzerDriver(testConnection);
  }
  
  /**
   * 创建临时测试文件 - 便捷封装
   */
  protected async createTestFile(filename: string, content: Buffer | string): Promise<string> {
    return createTestFile(this.testEnv.dataPath, filename, content);
  }
  
  /**
   * 等待异步操作完成 - 便捷封装
   */
  protected async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    timeoutMs: number = 5000,
    intervalMs: number = 100
  ): Promise<void> {
    return waitForCondition(condition, timeoutMs, intervalMs);
  }
  
  /**
   * 获取测试环境信息
   */
  protected getTestEnvironment(): TestEnvironment {
    return { ...this.testEnv };
  }
  
  /**
   * 获取Mock硬件实例 - 公共访问方法
   */
  public getMockHardware(): MockHardwareInterface {
    return this.mockHardware;
  }
  
  /**
   * 获取配置管理器实例 - 公共访问方法
   */
  public getConfigManager(): ConfigurationManager {
    return this.configManager;
  }
  
  /**
   * 创建测试文件 - 公共访问方法
   */
  public async createTestFilePublic(filename: string, content: Buffer | string): Promise<string> {
    return this.createTestFile(filename, content);
  }
}

export { IntegrationTestBase, TestEnvironment, MockHardwareInterface };