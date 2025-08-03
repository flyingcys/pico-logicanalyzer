import { DriverValidator, ValidationRule, ValidationResult, ValidationReport } from '../../../../src/driver-sdk/tools/DriverValidator';
import { AnalyzerDriverBase } from '../../../../src/drivers/AnalyzerDriverBase';
import {
  AnalyzerDriverType,
  ConnectionParams,
  ConnectionResult,
  CaptureSession,
  CaptureError,
  DeviceStatus,
  TriggerType
} from '../../../../src/models/AnalyzerTypes';

// Mock 驱动类用于测试
class MockValidDriver extends AnalyzerDriverBase {
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

// 有问题的驱动类用于测试
class MockInvalidDriver extends AnalyzerDriverBase {
  get deviceVersion(): string | null { return null; }
  get channelCount(): number { return -1; } // 无效值
  get maxFrequency(): number { return -1; } // 无效值
  get blastFrequency(): number { return 200000000; }
  get bufferSize(): number { return -1; } // 无效值
  get isNetwork(): boolean { return false; }
  get isCapturing(): boolean { return false; }
  get driverType(): AnalyzerDriverType { return AnalyzerDriverType.Serial; }

  // 缺少connect方法实现
  async connect(params?: ConnectionParams): Promise<ConnectionResult> {
    return {
      success: false,
      error: '连接方法未正确实现'
    };
  }

  async disconnect(): Promise<void> {}

  async startCapture(session: CaptureSession): Promise<CaptureError> {
    return CaptureError.UnknownError;
  }

  async stopCapture(): Promise<boolean> {
    return false;
  }

  async getStatus(): Promise<DeviceStatus> {
    return {
      isConnected: false,
      isCapturing: false,
      lastError: 'Mock error',
      batteryLevel: 0,
      temperature: 0
    };
  }

  dispose(): void {}
}

// 性能超限的驱动类
class MockHighPerformanceDriver extends AnalyzerDriverBase {
  get deviceVersion(): string | null { return 'v2.0.0'; }
  get channelCount(): number { return 256; } // 超过128
  get maxFrequency(): number { return 20000000000; } // 超过10GHz
  get blastFrequency(): number { return 40000000000; }
  get bufferSize(): number { return 2000000000; } // 超过1GB
  get isNetwork(): boolean { return true; }
  get isCapturing(): boolean { return false; }
  get driverType(): AnalyzerDriverType { return AnalyzerDriverType.Network; }

  async connect(params?: ConnectionParams): Promise<ConnectionResult> {
    return { success: true, deviceInfo: { name: 'High Performance Device' } };
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

describe('DriverValidator', () => {
  let validator: DriverValidator;

  beforeEach(() => {
    validator = new DriverValidator();
  });

  describe('构造函数和初始化', () => {
    it('应该正确初始化验证器', () => {
      expect(validator).toBeInstanceOf(DriverValidator);
    });

    it('应该包含内置验证规则', () => {
      // 通过验证一个有效驱动来检查规则是否正确加载
      const mockDriver = new MockValidDriver('test');
      expect(() => validator.validateDriver(mockDriver)).not.toThrow();
    });
  });

  describe('验证规则管理', () => {
    it('应该能够添加自定义验证规则', () => {
      const customRule: ValidationRule = {
        name: 'custom-test-rule',
        description: '自定义测试规则',
        severity: 'info',
        check: async (driver) => ({
          passed: true,
          message: '自定义规则通过'
        })
      };

      validator.addRule(customRule);
      
      // 验证规则是否被添加
      const mockDriver = new MockValidDriver('test');
      return validator.validateDriver(mockDriver).then(report => {
        const customResult = report.infos.find(info => info.message === '自定义规则通过');
        expect(customResult).toBeDefined();
      });
    });

    it('应该能够移除验证规则', () => {
      const customRule: ValidationRule = {
        name: 'removable-rule',
        description: '可移除的规则',
        severity: 'info',
        check: async (driver) => ({
          passed: true,
          message: '将被移除的规则'
        })
      };

      validator.addRule(customRule);
      const removed = validator.removeRule('removable-rule');
      
      expect(removed).toBe(true);
      
      // 验证规则是否被移除
      const mockDriver = new MockValidDriver('test');
      return validator.validateDriver(mockDriver).then(report => {
        const removedResult = report.infos.find(info => info.message === '将被移除的规则');
        expect(removedResult).toBeUndefined();
      });
    });

    it('移除不存在的规则应该返回false', () => {
      const removed = validator.removeRule('non-existent-rule');
      expect(removed).toBe(false);
    });
  });

  describe('驱动验证 - 有效驱动', () => {
    let mockDriver: MockValidDriver;

    beforeEach(() => {
      mockDriver = new MockValidDriver('test');
    });

    afterEach(() => {
      mockDriver.dispose();
    });

    it('应该验证有效驱动并返回通过状态', async () => {
      const report = await validator.validateDriver(mockDriver);

      expect(report).toBeDefined();
      expect(report.driverName).toBe('MockValidDriver');
      expect(report.overallStatus).toBe('pass');
      expect(report.errors).toHaveLength(0);
      expect(report.score).toBeGreaterThan(80);
    });

    it('应该验证必需属性', async () => {
      const report = await validator.validateDriver(mockDriver);

      // 应该通过必需属性检查
      const propertyResult = report.errors.find(e => e.message.includes('缺少或类型错误的属性'));
      expect(propertyResult).toBeUndefined();
    });

    it('应该验证连接方法', async () => {
      const report = await validator.validateDriver(mockDriver);

      // 连接方法应该被正确验证
      const hasConnectionErrors = report.errors.some(e => e.message.includes('connect方法'));
      expect(hasConnectionErrors).toBe(false);
    });

    it('应该验证采集方法', async () => {
      const report = await validator.validateDriver(mockDriver);

      // 采集方法应该被正确验证
      const hasCaptureErrors = report.errors.some(e => e.message.includes('缺少方法'));
      expect(hasCaptureErrors).toBe(false);
    });

    it('应该生成性能参数警告检查', async () => {
      const report = await validator.validateDriver(mockDriver);

      // 对于正常参数，不应有性能警告
      const hasPerformanceWarnings = report.warnings.some(w => w.message.includes('性能参数警告'));
      expect(hasPerformanceWarnings).toBe(false);
    });
  });

  describe('驱动验证 - 无效驱动', () => {
    let mockDriver: MockInvalidDriver;

    beforeEach(() => {
      mockDriver = new MockInvalidDriver('test');
    });

    afterEach(() => {
      mockDriver.dispose();
    });

    it('应该检测无效驱动并返回失败状态', async () => {
      const report = await validator.validateDriver(mockDriver);

      expect(report.overallStatus).toBe('fail');
      expect(report.errors.length).toBeGreaterThan(0);
      expect(report.score).toBeLessThan(60);
    });

    it('应该检测无效的必需属性', async () => {
      const report = await validator.validateDriver(mockDriver);

      const propertyError = report.errors.find(e => e.message.includes('缺少或类型错误的属性'));
      expect(propertyError).toBeDefined();
      expect(propertyError?.message).toContain('channelCount');
      expect(propertyError?.message).toContain('maxFrequency');
      expect(propertyError?.message).toContain('bufferSize');
    });

    it('应该检测连接方法问题', async () => {
      const report = await validator.validateDriver(mockDriver);

      // 由于connect方法抛出异常，应该有相关错误
      const connectionError = report.errors.find(e => e.message.includes('connect方法'));
      expect(connectionError).toBeDefined();
    });
  });

  describe('驱动验证 - 性能超限驱动', () => {
    let mockDriver: MockHighPerformanceDriver;

    beforeEach(() => {
      mockDriver = new MockHighPerformanceDriver('test');
    });

    afterEach(() => {
      mockDriver.dispose();
    });

    it('应该检测性能参数超限并给出警告', async () => {
      const report = await validator.validateDriver(mockDriver);

      expect(report.overallStatus).toBe('warning');
      expect(report.warnings.length).toBeGreaterThan(0);
      
      const performanceWarning = report.warnings.find(w => w.message.includes('性能参数警告'));
      expect(performanceWarning).toBeDefined();
      expect(performanceWarning?.message).toContain('最大采样率超过10GHz');
      expect(performanceWarning?.message).toContain('通道数超过128');
      expect(performanceWarning?.message).toContain('缓冲区大小超过1GB');
    });

    it('性能警告不应影响基本验证', async () => {
      const report = await validator.validateDriver(mockDriver);

      // 应该没有严重错误，只有警告
      expect(report.errors).toHaveLength(0);
      expect(report.score).toBeGreaterThan(50); // 有警告但仍有合理分数
    });
  });

  describe('验证报告生成', () => {
    it('应该生成包含所有必需字段的验证报告', async () => {
      const mockDriver = new MockValidDriver('test');
      const report = await validator.validateDriver(mockDriver);

      expect(report.driverName).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.overallStatus).toMatch(/^(pass|fail|warning)$/);
      expect(report.errors).toBeInstanceOf(Array);
      expect(report.warnings).toBeInstanceOf(Array);
      expect(report.infos).toBeInstanceOf(Array);
      expect(typeof report.score).toBe('number');
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
      expect(report.recommendations).toBeInstanceOf(Array);

      mockDriver.dispose();
    });

    it('应该正确计算评分', async () => {
      const validDriver = new MockValidDriver('test');
      const invalidDriver = new MockInvalidDriver('test');

      const validReport = await validator.validateDriver(validDriver);
      const invalidReport = await validator.validateDriver(invalidDriver);

      expect(validReport.score).toBeGreaterThan(invalidReport.score);
      expect(validReport.score).toBeGreaterThan(80);
      expect(invalidReport.score).toBeLessThan(50);

      validDriver.dispose();
      invalidDriver.dispose();
    });
  });

  describe('文本报告生成', () => {
    it('应该生成可读的文本报告', async () => {
      const mockDriver = new MockValidDriver('test');
      const report = await validator.validateDriver(mockDriver);
      const textReport = validator.generateTextReport(report);

      expect(textReport).toContain('驱动验证报告');
      expect(textReport).toContain('MockValidDriver');
      expect(textReport).toContain(report.overallStatus.toUpperCase());
      expect(textReport).toContain(`${report.score}/100`);

      mockDriver.dispose();
    });

    it('文本报告应该包含错误详情', async () => {
      const mockDriver = new MockInvalidDriver('test');
      const report = await validator.validateDriver(mockDriver);
      const textReport = validator.generateTextReport(report);

      expect(textReport).toContain('错误');
      if (report.errors.length > 0) {
        expect(textReport).toContain(report.errors[0].message);
      }

      mockDriver.dispose();
    });

    it('文本报告应该包含警告详情', async () => {
      const mockDriver = new MockHighPerformanceDriver('test');
      const report = await validator.validateDriver(mockDriver);
      const textReport = validator.generateTextReport(report);

      if (report.warnings.length > 0) {
        expect(textReport).toContain('警告');
        expect(textReport).toContain(report.warnings[0].message);
      }

      mockDriver.dispose();
    });

    it('文本报告应该包含改进建议', async () => {
      const mockDriver = new MockInvalidDriver('test');
      const report = await validator.validateDriver(mockDriver);
      const textReport = validator.generateTextReport(report);

      if (report.recommendations.length > 0) {
        expect(textReport).toContain('改进建议');
      }

      mockDriver.dispose();
    });
  });

  describe('异常处理', () => {
    it('应该处理验证规则执行异常', async () => {
      const faultyRule: ValidationRule = {
        name: 'faulty-rule',
        description: '有问题的规则',
        severity: 'error',
        check: async (driver) => {
          throw new Error('规则执行异常');
        }
      };

      validator.addRule(faultyRule);

      const mockDriver = new MockValidDriver('test');
      const report = await validator.validateDriver(mockDriver);

      // 应该捕获异常并转换为错误报告
      const faultyError = report.errors.find(e => e.message.includes('验证规则 faulty-rule 执行失败'));
      expect(faultyError).toBeDefined();

      mockDriver.dispose();
    });

    it('验证包功能应该抛出未实现异常', async () => {
      await expect(validator.validateDriverPackage('test-path')).rejects.toThrow('驱动包验证功能待实现');
    });
  });

  describe('边界条件测试', () => {
    it('应该处理空驱动名称', async () => {
      // 创建一个匿名类
      const AnonymousDriver = class extends AnalyzerDriverBase {
        get deviceVersion(): string | null { return 'v1.0.0'; }
        get channelCount(): number { return 8; }
        get maxFrequency(): number { return 100000000; }
        get blastFrequency(): number { return 200000000; }
        get bufferSize(): number { return 1000000; }
        get isNetwork(): boolean { return false; }
        get isCapturing(): boolean { return false; }
        get driverType(): AnalyzerDriverType { return AnalyzerDriverType.Serial; }

        async connect(): Promise<ConnectionResult> {
          return { success: true, deviceInfo: { name: 'Anonymous Device' } };
        }
        async disconnect(): Promise<void> {}
        async startCapture(): Promise<CaptureError> { return CaptureError.None; }
        async stopCapture(): Promise<boolean> { return true; }
        async getStatus(): Promise<DeviceStatus> {
          return { isConnected: true, isCapturing: false, lastError: null, batteryLevel: 100, temperature: 25 };
        }
        dispose(): void {}
      };

      const anonymousDriver = new AnonymousDriver('test');
      const report = await validator.validateDriver(anonymousDriver);

      expect(report.driverName).toBeDefined();
      expect(report.driverName.length).toBeGreaterThan(0);

      anonymousDriver.dispose();
    });

    it('应该处理极限性能参数', async () => {
      const ExtremeDriver = class extends AnalyzerDriverBase {
        get deviceVersion(): string | null { return 'v1.0.0'; }
        get channelCount(): number { return Number.MAX_SAFE_INTEGER; }
        get maxFrequency(): number { return Number.MAX_SAFE_INTEGER; }
        get blastFrequency(): number { return Number.MAX_SAFE_INTEGER; }
        get bufferSize(): number { return Number.MAX_SAFE_INTEGER; }
        get isNetwork(): boolean { return false; }
        get isCapturing(): boolean { return false; }
        get driverType(): AnalyzerDriverType { return AnalyzerDriverType.Serial; }

        async connect(): Promise<ConnectionResult> {
          return { success: true, deviceInfo: { name: 'Extreme Device' } };
        }
        async disconnect(): Promise<void> {}
        async startCapture(): Promise<CaptureError> { return CaptureError.None; }
        async stopCapture(): Promise<boolean> { return true; }
        async getStatus(): Promise<DeviceStatus> {
          return { isConnected: true, isCapturing: false, lastError: null, batteryLevel: 100, temperature: 25 };
        }
        dispose(): void {}
      };

      const extremeDriver = new ExtremeDriver('test');
      const report = await validator.validateDriver(extremeDriver);

      // 应该生成性能警告
      expect(report.warnings.length).toBeGreaterThan(0);
      const performanceWarning = report.warnings.find(w => w.message.includes('性能参数警告'));
      expect(performanceWarning).toBeDefined();

      extremeDriver.dispose();
    });
  });
});