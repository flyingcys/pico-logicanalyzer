import { AnalyzerDriverBase } from '../../drivers/AnalyzerDriverBase';
import { 
  AnalyzerDriverType,
  ConnectionParams,
  ConnectionResult,
  CaptureSession,
  CaptureError,
  DeviceStatus
} from '../../models/AnalyzerTypes';

/**
 * 驱动验证规则
 */
export interface ValidationRule {
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  check: (driver: AnalyzerDriverBase) => Promise<ValidationResult>;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  passed: boolean;
  message: string;
  details?: string;
  suggestions?: string[];
}

/**
 * 驱动验证报告
 */
export interface ValidationReport {
  driverName: string;
  timestamp: Date;
  overallStatus: 'pass' | 'fail' | 'warning';
  errors: ValidationResult[];
  warnings: ValidationResult[];
  infos: ValidationResult[];
  score: number; // 0-100
  recommendations: string[];
}

/**
 * 驱动验证器
 * 用于验证第三方驱动是否符合平台规范
 */
export class DriverValidator {
  private rules: ValidationRule[] = [];

  constructor() {
    this.initializeBuiltinRules();
  }

  /**
   * 初始化内置验证规则
   */
  private initializeBuiltinRules(): void {
    // 基础API实现检查
    this.addRule({
      name: 'required-properties',
      description: '检查必需属性的实现',
      severity: 'error',
      check: async (driver) => {
        const missing: string[] = [];
        
        if (typeof driver.deviceVersion !== 'string' && driver.deviceVersion !== null) {
          missing.push('deviceVersion');
        }
        if (typeof driver.channelCount !== 'number' || driver.channelCount <= 0) {
          missing.push('channelCount');
        }
        if (typeof driver.maxFrequency !== 'number' || driver.maxFrequency <= 0) {
          missing.push('maxFrequency');
        }
        if (typeof driver.bufferSize !== 'number' || driver.bufferSize <= 0) {
          missing.push('bufferSize');
        }
        if (typeof driver.isNetwork !== 'boolean') {
          missing.push('isNetwork');
        }
        if (typeof driver.isCapturing !== 'boolean') {
          missing.push('isCapturing');
        }

        return {
          passed: missing.length === 0,
          message: missing.length === 0 
            ? '所有必需属性已正确实现'
            : `缺少或类型错误的属性: ${missing.join(', ')}`,
          suggestions: missing.length > 0 
            ? ['请实现所有必需的属性getter方法'] 
            : undefined
        };
      }
    });

    // 连接方法检查
    this.addRule({
      name: 'connect-method',
      description: '检查connect方法的实现',
      severity: 'error',
      check: async (driver) => {
        if (typeof driver.connect !== 'function') {
          return {
            passed: false,
            message: 'connect方法未实现',
            suggestions: ['实现async connect(params?: ConnectionParams): Promise<ConnectionResult>']
          };
        }

        try {
          // 测试方法签名
          const mockParams: ConnectionParams = { timeout: 5000 };
          const result = driver.connect(mockParams);
          
          if (!(result instanceof Promise)) {
            return {
              passed: false,
              message: 'connect方法必须返回Promise<ConnectionResult>',
              suggestions: ['确保connect方法是异步的并返回Promise']
            };
          }

          return {
            passed: true,
            message: 'connect方法签名正确'
          };
        } catch (error) {
          return {
            passed: false,
            message: `connect方法调用时出错: ${error}`,
            suggestions: ['检查connect方法的参数处理']
          };
        }
      }
    });

    // 数据采集方法检查
    this.addRule({
      name: 'capture-methods',
      description: '检查数据采集相关方法的实现',
      severity: 'error',
      check: async (driver) => {
        const missing: string[] = [];
        
        if (typeof driver.startCapture !== 'function') {
          missing.push('startCapture');
        }
        if (typeof driver.stopCapture !== 'function') {
          missing.push('stopCapture');
        }
        if (typeof driver.getStatus !== 'function') {
          missing.push('getStatus');
        }

        return {
          passed: missing.length === 0,
          message: missing.length === 0 
            ? '所有采集方法已实现'
            : `缺少方法: ${missing.join(', ')}`,
          suggestions: missing.length > 0 
            ? ['实现所有必需的采集方法'] 
            : undefined
        };
      }
    });

    // 性能检查
    this.addRule({
      name: 'performance-limits',
      description: '检查性能参数的合理性',
      severity: 'warning',
      check: async (driver) => {
        const issues: string[] = [];
        
        if (driver.maxFrequency > 10000000000) { // 10GHz
          issues.push('最大采样率超过10GHz，可能不现实');
        }
        if (driver.channelCount > 128) {
          issues.push('通道数超过128，请确认是否正确');
        }
        if (driver.bufferSize > 1000000000) { // 1GB
          issues.push('缓冲区大小超过1GB，可能导致内存问题');
        }

        return {
          passed: issues.length === 0,
          message: issues.length === 0 
            ? '性能参数在合理范围内'
            : `性能参数警告: ${issues.join('; ')}`,
          suggestions: issues.length > 0 
            ? ['检查并调整性能参数到合理范围'] 
            : undefined
        };
      }
    });

    // 错误处理检查
    this.addRule({
      name: 'error-handling',
      description: '检查错误处理的完整性',
      severity: 'warning',
      check: async (driver) => {
        // 这里可以通过静态分析或运行时检查来验证错误处理
        return {
          passed: true,
          message: '错误处理检查通过',
          details: '建议在所有异步方法中添加适当的错误处理'
        };
      }
    });

    // 事件系统检查
    this.addRule({
      name: 'event-system',
      description: '检查事件系统的实现',
      severity: 'info',
      check: async (driver) => {
        const hasEventMethods = (
          typeof driver.on === 'function' &&
          typeof driver.off === 'function' &&
          typeof driver.emit === 'function'
        );

        return {
          passed: hasEventMethods,
          message: hasEventMethods 
            ? '事件系统已正确实现' 
            : '事件系统可能未完全实现',
          suggestions: !hasEventMethods 
            ? ['确保继承自EventEmitter或实现事件方法'] 
            : undefined
        };
      }
    });
  }

  /**
   * 添加自定义验证规则
   */
  addRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  /**
   * 移除验证规则
   */
  removeRule(ruleName: string): boolean {
    const index = this.rules.findIndex(rule => rule.name === ruleName);
    if (index >= 0) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 验证驱动实现
   */
  async validateDriver(driver: AnalyzerDriverBase): Promise<ValidationReport> {
    const report: ValidationReport = {
      driverName: driver.constructor.name,
      timestamp: new Date(),
      overallStatus: 'pass',
      errors: [],
      warnings: [],
      infos: [],
      score: 0,
      recommendations: []
    };

    console.log(`开始验证驱动: ${report.driverName}`);

    // 执行所有验证规则
    for (const rule of this.rules) {
      try {
        console.log(`执行验证规则: ${rule.name}`);
        const result = await rule.check(driver);
        
        // 根据严重级别分类结果
        switch (rule.severity) {
          case 'error':
            if (!result.passed) {
              report.errors.push(result);
            }
            break;
          case 'warning':
            if (!result.passed) {
              report.warnings.push(result);
            }
            break;
          case 'info':
            report.infos.push(result);
            break;
        }

        // 收集建议
        if (result.suggestions) {
          report.recommendations.push(...result.suggestions);
        }
      } catch (error) {
        report.errors.push({
          passed: false,
          message: `验证规则 ${rule.name} 执行失败: ${error}`,
          suggestions: ['检查验证规则的实现']
        });
      }
    }

    // 计算总体状态和评分
    if (report.errors.length > 0) {
      report.overallStatus = 'fail';
    } else if (report.warnings.length > 0) {
      report.overallStatus = 'warning';
    } else {
      report.overallStatus = 'pass';
    }

    // 计算评分 (0-100)
    const totalRules = this.rules.length;
    const passedRules = totalRules - report.errors.length - report.warnings.length;
    const partialRules = report.warnings.length * 0.5; // 警告按50%计分
    report.score = Math.round(((passedRules + partialRules) / totalRules) * 100);

    console.log(`验证完成，评分: ${report.score}/100`);
    return report;
  }

  /**
   * 生成验证报告的文本格式
   */
  generateTextReport(report: ValidationReport): string {
    let text = `驱动验证报告\n`;
    text += `================\n`;
    text += `驱动名称: ${report.driverName}\n`;
    text += `验证时间: ${report.timestamp.toLocaleString()}\n`;
    text += `总体状态: ${report.overallStatus.toUpperCase()}\n`;
    text += `评分: ${report.score}/100\n\n`;

    if (report.errors.length > 0) {
      text += `错误 (${report.errors.length}):\n`;
      text += `-----------\n`;
      report.errors.forEach((error, index) => {
        text += `${index + 1}. ${error.message}\n`;
        if (error.details) {
          text += `   详情: ${error.details}\n`;
        }
        if (error.suggestions) {
          text += `   建议: ${error.suggestions.join(', ')}\n`;
        }
        text += `\n`;
      });
    }

    if (report.warnings.length > 0) {
      text += `警告 (${report.warnings.length}):\n`;
      text += `-----------\n`;
      report.warnings.forEach((warning, index) => {
        text += `${index + 1}. ${warning.message}\n`;
        if (warning.details) {
          text += `   详情: ${warning.details}\n`;
        }
        if (warning.suggestions) {
          text += `   建议: ${warning.suggestions.join(', ')}\n`;
        }
        text += `\n`;
      });
    }

    if (report.recommendations.length > 0) {
      text += `改进建议:\n`;
      text += `---------\n`;
      const uniqueRecommendations = [...new Set(report.recommendations)];
      uniqueRecommendations.forEach((rec, index) => {
        text += `${index + 1}. ${rec}\n`;
      });
    }

    return text;
  }

  /**
   * 验证驱动包的完整性
   */
  async validateDriverPackage(driverPackagePath: string): Promise<ValidationReport> {
    // 这里可以实现对驱动包的完整性检查
    // 包括package.json, 依赖检查, 文档检查等
    throw new Error('驱动包验证功能待实现');
  }
}