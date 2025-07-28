import { HardwareCompatibilityDatabase } from './HardwareCompatibilityDatabase';
import { DatabaseManager } from './DatabaseManager';
import { DeviceInfo } from '../models/AnalyzerTypes';
import { AnalyzerDriverBase } from '../drivers/AnalyzerDriverBase';

/**
 * 数据库集成工具
 * 提供驱动系统与兼容性数据库的集成功能
 */
export class DatabaseIntegration {
  private static instance: DatabaseIntegration | null = null;
  private database: HardwareCompatibilityDatabase;
  private manager: DatabaseManager;
  private isInitialized: boolean = false;

  private constructor() {
    this.database = new HardwareCompatibilityDatabase();
    this.manager = new DatabaseManager();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): DatabaseIntegration {
    if (!DatabaseIntegration.instance) {
      DatabaseIntegration.instance = new DatabaseIntegration();
    }
    return DatabaseIntegration.instance;
  }

  /**
   * 初始化数据库集成
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.database.initialize();
      await this.manager.initialize();
      this.isInitialized = true;
      
      console.log('数据库集成已初始化');
    } catch (error) {
      console.error('数据库集成初始化失败:', error);
      throw error;
    }
  }

  /**
   * 增强的设备发现
   * 结合数据库信息进行智能设备匹配
   */
  async enhancedDeviceDiscovery(deviceInfo: Partial<DeviceInfo>): Promise<{
    recommendedDrivers: string[];
    compatibilityInfo: any[];
    confidence: number;
    connectionStrings: string[];
    setupInstructions: string[];
  }> {
    await this.initialize();

    // 使用智能匹配获取推荐
    const matchResult = await this.manager.smartDeviceMatching(deviceInfo);
    
    const recommendedDrivers: string[] = [];
    const compatibilityInfo: any[] = [];
    const connectionStrings: string[] = [];
    const setupInstructions: string[] = [];

    // 处理精确匹配
    for (const match of matchResult.exactMatches) {
      recommendedDrivers.push(match.driverCompatibility.primaryDriver);
      compatibilityInfo.push({
        deviceId: match.deviceId,
        manufacturer: match.manufacturer,
        model: match.model,
        compatibilityLevel: match.driverCompatibility.compatibilityLevel,
        validationScore: match.testStatus.testResults.driverValidation,
        userRating: match.communityFeedback.userRating,
        knownIssues: match.driverCompatibility.knownIssues,
        workarounds: match.driverCompatibility.workarounds
      });
      
      connectionStrings.push(match.connectionOptions.defaultConnectionString);
      
      // 生成设置说明
      setupInstructions.push(...this.generateSetupInstructions(match));
    }

    // 处理部分匹配
    for (const match of matchResult.partialMatches) {
      if (!recommendedDrivers.includes(match.driverCompatibility.primaryDriver)) {
        recommendedDrivers.push(match.driverCompatibility.primaryDriver);
      }
    }

    // 添加建议的驱动
    recommendedDrivers.push(...matchResult.suggestedDrivers);

    // 去重
    const uniqueDrivers = [...new Set(recommendedDrivers)];
    const uniqueConnections = [...new Set(connectionStrings)];

    return {
      recommendedDrivers: uniqueDrivers,
      compatibilityInfo,
      confidence: matchResult.confidence,
      connectionStrings: uniqueConnections,
      setupInstructions
    };
  }

  /**
   * 生成设置说明
   */
  private generateSetupInstructions(deviceEntry: any): string[] {
    const instructions: string[] = [];
    
    // 基于设备类别生成说明
    switch (deviceEntry.category) {
      case 'usb-la':
        instructions.push('1. 将设备通过USB连接到计算机');
        instructions.push('2. 等待设备驱动安装完成');
        if (deviceEntry.connectionOptions.connectionParameters?.baudRate) {
          instructions.push(`3. 配置串口参数: ${deviceEntry.connectionOptions.connectionParameters.baudRate} bps`);
        }
        break;
        
      case 'network-la':
        instructions.push('1. 确保设备连接到网络');
        instructions.push(`2. 配置设备IP地址或使用默认地址: ${deviceEntry.connectionOptions.defaultConnectionString}`);
        instructions.push('3. 检查网络连通性');
        break;
        
      case 'benchtop':
        instructions.push('1. 通过以太网或USB连接设备');
        instructions.push('2. 配置设备网络设置（如适用）');
        instructions.push('3. 等待设备启动完成');
        break;
    }

    // 添加已知问题的解决方案
    if (deviceEntry.driverCompatibility.workarounds?.length > 0) {
      instructions.push('', '已知问题解决方案:');
      deviceEntry.driverCompatibility.workarounds.forEach((workaround: string, index: number) => {
        instructions.push(`${index + 1}. ${workaround}`);
      });
    }

    return instructions;
  }

  /**
   * 驱动性能预测
   * 基于历史数据预测驱动性能
   */
  async predictDriverPerformance(
    driverName: string, 
    deviceInfo: Partial<DeviceInfo>
  ): Promise<{
    expectedPerformance: {
      connectionTime: number;
      captureTime: number;
      reliability: 'excellent' | 'good' | 'fair' | 'poor';
      userSatisfaction: number;
    };
    riskFactors: string[];
    optimizationSuggestions: string[];
  }> {
    await this.initialize();

    // 查询相似设备的历史性能数据
    const similarDevices = await this.database.queryDevices({
      manufacturer: deviceInfo.manufacturer,
      driverName: driverName
    });

    if (similarDevices.length === 0) {
      return {
        expectedPerformance: {
          connectionTime: 5000, // 默认值
          captureTime: 10000,
          reliability: 'fair',
          userSatisfaction: 3.0
        },
        riskFactors: ['缺少历史数据', '未经验证的驱动组合'],
        optimizationSuggestions: ['建议进行完整测试', '考虑使用已验证的备选驱动']
      };
    }

    // 计算平均性能指标
    const avgValidationScore = similarDevices.reduce((sum, device) => 
      sum + device.testStatus.testResults.driverValidation, 0) / similarDevices.length;
    
    const avgUserRating = similarDevices.reduce((sum, device) => 
      sum + device.communityFeedback.userRating, 0) / similarDevices.length;

    // 收集风险因素
    const riskFactors: string[] = [];
    const optimizationSuggestions: string[] = [];

    similarDevices.forEach(device => {
      device.driverCompatibility.knownIssues.forEach(issue => {
        if (!riskFactors.includes(issue)) {
          riskFactors.push(issue);
        }
      });
    });

    // 基于验证分数生成建议
    if (avgValidationScore < 70) {
      optimizationSuggestions.push('驱动验证分数较低，建议使用备选驱动');
    }
    if (avgUserRating < 3.5) {
      optimizationSuggestions.push('用户满意度较低，建议查看用户反馈');
    }

    // 可靠性评估
    let reliability: 'excellent' | 'good' | 'fair' | 'poor' = 'fair';
    if (avgValidationScore >= 90 && avgUserRating >= 4.5) {
      reliability = 'excellent';
    } else if (avgValidationScore >= 80 && avgUserRating >= 4.0) {
      reliability = 'good';
    } else if (avgValidationScore < 60 || avgUserRating < 3.0) {
      reliability = 'poor';
    }

    return {
      expectedPerformance: {
        connectionTime: Math.max(1000, 5000 - (avgValidationScore - 50) * 50),
        captureTime: Math.max(2000, 10000 - (avgValidationScore - 50) * 100),
        reliability,
        userSatisfaction: avgUserRating
      },
      riskFactors,
      optimizationSuggestions
    };
  }

  /**
   * 自动测试结果更新
   * 驱动测试完成后自动更新数据库
   */
  async updateTestResults(
    deviceId: string,
    driverName: string,
    testResults: {
      validationScore: number;
      functionalScore: number;
      performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
      connectionTime: number;
      captureTime: number;
      reliability: 'excellent' | 'good' | 'fair' | 'poor';
    }
  ): Promise<void> {
    await this.initialize();

    try {
      await this.database.updateTestResults(deviceId, {
        driverValidation: testResults.validationScore,
        functionalTests: testResults.functionalScore,
        performanceGrade: testResults.performanceGrade,
        reliability: testResults.reliability
      });

      console.log(`测试结果已更新: ${deviceId} (${driverName})`);
    } catch (error) {
      console.error('更新测试结果失败:', error);
    }
  }

  /**
   * 社区反馈集成
   * 收集和处理用户反馈
   */
  async submitUserFeedback(
    deviceId: string,
    feedback: {
      rating: number;
      comment: string;
      issues?: string[];
      driverUsed?: string;
      setupDifficulty?: 'easy' | 'medium' | 'hard';
      performanceSatisfaction?: number;
    }
  ): Promise<void> {
    await this.initialize();

    try {
      await this.database.addUserFeedback(
        deviceId, 
        feedback.rating, 
        feedback.comment, 
        feedback.issues || []
      );

      // 如果反馈包含性能信息，更新性能统计
      if (feedback.performanceSatisfaction !== undefined) {
        // 这里可以添加更复杂的性能统计更新逻辑
        console.log(`用户性能反馈已记录: ${feedback.performanceSatisfaction}/5`);
      }

      console.log(`用户反馈已提交: ${deviceId} (评分: ${feedback.rating})`);
    } catch (error) {
      console.error('提交用户反馈失败:', error);
    }
  }

  /**
   * 生成兼容性报告
   */
  async generateCompatibilityReport(format: 'html' | 'markdown' | 'json' = 'html'): Promise<string> {
    await this.initialize();

    const stats = await this.database.getStatistics();
    const allDevices = await this.database.queryDevices({});

    if (format === 'json') {
      return JSON.stringify({
        statistics: stats,
        devices: allDevices,
        generatedAt: new Date().toISOString()
      }, null, 2);
    }

    const timestamp = new Date().toLocaleString();
    
    if (format === 'markdown') {
      let report = `# 硬件兼容性报告\n\n`;
      report += `**生成时间**: ${timestamp}\n\n`;
      
      report += `## 总体统计\n\n`;
      report += `- 总设备数: ${stats.totalDevices}\n`;
      report += `- 平均用户评分: ${stats.averageUserRating.toFixed(2)}/5.0\n\n`;
      
      report += `## 设备类别分布\n\n`;
      Object.entries(stats.devicesByCategory).forEach(([category, count]) => {
        report += `- ${category}: ${count}\n`;
      });
      
      report += `\n## 制造商分布\n\n`;
      Object.entries(stats.devicesByManufacturer).forEach(([manufacturer, count]) => {
        report += `- ${manufacturer}: ${count}\n`;
      });

      report += `\n## 认证级别分布\n\n`;
      Object.entries(stats.certificationLevels).forEach(([level, count]) => {
        report += `- ${level}: ${count}\n`;
      });

      return report;
    }

    // HTML格式
    let html = `<!DOCTYPE html>
<html>
<head>
    <title>硬件兼容性报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .section { margin-bottom: 30px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
        .stat-card { background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
        .stat-number { font-size: 2em; font-weight: bold; color: #007acc; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .excellent { color: #28a745; }
        .good { color: #17a2b8; }
        .fair { color: #ffc107; }
        .poor { color: #dc3545; }
    </style>
</head>
<body>
    <div class="header">
        <h1>硬件兼容性报告</h1>
        <p><strong>生成时间:</strong> ${timestamp}</p>
    </div>

    <div class="section">
        <h2>总体统计</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${stats.totalDevices}</div>
                <div>总设备数</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.averageUserRating.toFixed(1)}</div>
                <div>平均用户评分</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>设备类别分布</h2>
        <table>
            <tr><th>类别</th><th>数量</th><th>百分比</th></tr>
            ${Object.entries(stats.devicesByCategory).map(([category, count]) => `
                <tr>
                    <td>${category}</td>
                    <td>${count}</td>
                    <td>${((count / stats.totalDevices) * 100).toFixed(1)}%</td>
                </tr>
            `).join('')}
        </table>
    </div>

    <div class="section">
        <h2>制造商分布</h2>
        <table>
            <tr><th>制造商</th><th>设备数</th><th>市场占有率</th></tr>
            ${Object.entries(stats.devicesByManufacturer).map(([manufacturer, count]) => `
                <tr>
                    <td>${manufacturer}</td>
                    <td>${count}</td>
                    <td>${((count / stats.totalDevices) * 100).toFixed(1)}%</td>
                </tr>
            `).join('')}
        </table>
    </div>

    <div class="section">
        <h2>设备详细信息</h2>
        <table>
            <tr>
                <th>设备</th>
                <th>制造商</th>
                <th>主驱动</th>
                <th>兼容性</th>
                <th>验证分数</th>
                <th>用户评分</th>
                <th>认证级别</th>
            </tr>
            ${allDevices.map(device => `
                <tr>
                    <td>${device.model}</td>
                    <td>${device.manufacturer}</td>
                    <td>${device.driverCompatibility.primaryDriver}</td>
                    <td>${device.driverCompatibility.compatibilityLevel}</td>
                    <td>${device.testStatus.testResults.driverValidation}</td>
                    <td>${device.communityFeedback.userRating.toFixed(1)}</td>
                    <td>${device.testStatus.certificationLevel}</td>
                </tr>
            `).join('')}
        </table>
    </div>

    <div class="section">
        <p><em>此报告由VSCode逻辑分析器硬件兼容性数据库自动生成</em></p>
    </div>
</body>
</html>`;

    return html;
  }

  /**
   * 批量导入设备数据
   */
  async batchImportDevices(devices: any[], validateBeforeImport: boolean = true): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }> {
    await this.initialize();

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const device of devices) {
      try {
        if (validateBeforeImport) {
          // 基本验证
          if (!device.deviceId || !device.manufacturer || !device.model) {
            errors.push(`设备 ${device.deviceId || 'unknown'} 缺少必填字段`);
            skipped++;
            continue;
          }
        }

        await this.database.addOrUpdateDevice(device);
        imported++;
      } catch (error) {
        errors.push(`导入设备 ${device.deviceId} 失败: ${error}`);
        skipped++;
      }
    }

    console.log(`批量导入完成: ${imported} 成功, ${skipped} 跳过, ${errors.length} 错误`);

    return { imported, skipped, errors };
  }

  /**
   * 获取数据库实例（用于高级操作）
   */
  getDatabase(): HardwareCompatibilityDatabase {
    return this.database;
  }

  /**
   * 获取管理器实例（用于高级操作）
   */
  getManager(): DatabaseManager {
    return this.manager;
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.database.dispose();
    this.manager.dispose();
    this.isInitialized = false;
  }
}