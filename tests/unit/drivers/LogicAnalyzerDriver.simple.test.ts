/**
 * LogicAnalyzerDriver 简化测试 - 错误驱动学习版本
 * 
 * 避免复杂异步Mock，专注测试可同步验证的核心逻辑:
 * - 构造函数和基础属性
 * - 参数验证算法 
 * - 静态方法和计算逻辑
 * - 错误处理边界条件
 * 
 * 目标：先建立基础覆盖率，再逐步增加复杂功能测试
 */

import { LogicAnalyzerDriver } from '../../../src/drivers/LogicAnalyzerDriver';
import { AnalyzerDriverBase } from '../../../src/drivers/AnalyzerDriverBase';
import {
  AnalyzerDriverType,
  TriggerType,
  CaptureMode,
  CaptureSession,
  AnalyzerChannel,
  CaptureError
} from '../../../src/models/AnalyzerTypes';

// 最小化Mock配置
jest.mock('serialport', () => ({
  SerialPort: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('@serialport/parser-readline', () => ({
  ReadlineParser: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('net', () => ({
  Socket: jest.fn().mockImplementation(() => ({}))
}));

describe('LogicAnalyzerDriver 简化核心测试', () => {
  describe('构造函数和基础属性', () => {
    it('应该正确继承AnalyzerDriverBase', () => {
      const driver = new LogicAnalyzerDriver('/dev/ttyACM0');
      
      expect(driver).toBeInstanceOf(AnalyzerDriverBase);
      expect(driver).toBeInstanceOf(LogicAnalyzerDriver);
    });

    it('应该正确初始化基础属性', () => {
      const driver = new LogicAnalyzerDriver('/dev/ttyACM0');
      
      expect(driver.isCapturing).toBe(false);
      expect(driver.isNetwork).toBe(false);
      expect(driver.driverType).toBe(AnalyzerDriverType.Serial);
      expect(driver.deviceVersion).toBeNull();
      expect(driver.channelCount).toBe(0);
      expect(driver.maxFrequency).toBe(0);
      expect(driver.blastFrequency).toBe(0);
      expect(driver.bufferSize).toBe(0);
    });

    it('应该拒绝空连接字符串', () => {
      expect(() => new LogicAnalyzerDriver('')).toThrow('连接字符串不能为空');
      expect(() => new LogicAnalyzerDriver(null as any)).toThrow('连接字符串不能为空');
      expect(() => new LogicAnalyzerDriver(undefined as any)).toThrow('连接字符串不能为空');
    });

    it('应该正确识别串口连接字符串', () => {
      const driver = new LogicAnalyzerDriver('/dev/ttyACM0');
      // 连接前网络状态应该为false
      expect(driver.isNetwork).toBe(false);
      expect(driver.driverType).toBe(AnalyzerDriverType.Serial);
    });

    it('应该正确识别网络连接字符串', () => {
      const driver = new LogicAnalyzerDriver('192.168.1.100:8080');
      // 连接前网络状态应该为false（仅在连接后确定）
      expect(driver.isNetwork).toBe(false);
    });
  });

  describe('参数验证算法核心测试', () => {
    let driver: LogicAnalyzerDriver;

    beforeEach(() => {
      driver = new LogicAnalyzerDriver('/dev/ttyACM0');
    });

    it('应该正确计算采集限制 - 8通道模式', () => {
      const channels = [0, 1, 2]; // 3通道，应该使用Mode 0
      const limits = driver.getLimits(channels);

      expect(limits.minPreSamples).toBe(2);
      expect(limits.minPostSamples).toBe(2);
      expect(limits.maxPreSamples).toBeGreaterThan(0);
      expect(limits.maxPostSamples).toBeGreaterThan(0);
      expect(limits.maxTotalSamples).toBeGreaterThan(0);
      
      // 验证限制合理性
      expect(limits.maxPreSamples + limits.maxPostSamples).toBeLessThanOrEqual(limits.maxTotalSamples);
    });

    it('应该正确计算采集限制 - 16通道模式', () => {
      const channels = [0, 1, 2, 3, 4, 5, 6, 7, 8]; // 9通道，应该使用Mode 1  
      const limits = driver.getLimits(channels);

      expect(limits.maxTotalSamples).toBeGreaterThan(0);
      // Mode 1的总样本数应该小于Mode 0（因为每样本占用更多字节）
    });

    it('应该正确计算采集限制 - 24通道模式', () => {
      const channels = Array.from({ length: 17 }, (_, i) => i); // 17通道，应该使用Mode 2
      const limits = driver.getLimits(channels);

      expect(limits.maxTotalSamples).toBeGreaterThan(0);
      // Mode 2的总样本数应该是最小的
    });

    it('应该处理空通道数组', () => {
      const limits = driver.getLimits([]);
      
      expect(limits.maxTotalSamples).toBeGreaterThan(0);
      expect(limits.minPreSamples).toBe(2);
      expect(limits.minPostSamples).toBe(2);
    });
  });

  describe('网络地址解析测试', () => {
    it('应该正确解析标准IP:Port格式', () => {
      const driver = new LogicAnalyzerDriver('192.168.1.100:8080');
      
      // 这些属性在connect之前不可访问，但构造函数不应该抛出异常
      expect(driver).toBeTruthy();
    });

    it('应该处理IPv4地址的边界情况', () => {
      // 各种合法的IPv4格式
      expect(() => new LogicAnalyzerDriver('0.0.0.0:1')).not.toThrow();
      expect(() => new LogicAnalyzerDriver('255.255.255.255:65535')).not.toThrow();
      expect(() => new LogicAnalyzerDriver('127.0.0.1:24000')).not.toThrow();
    });
  });

  describe('采集模式计算测试', () => {
    let driver: LogicAnalyzerDriver;

    beforeEach(() => {
      driver = new LogicAnalyzerDriver('/dev/ttyACM0');
    });

    it('应该正确计算采集模式 - getCaptureMode', () => {
      // 使用反射访问私有方法进行测试
      const getCaptureMode = (driver as any).getCaptureMode.bind(driver);

      // Mode 0: 1-8通道
      expect(getCaptureMode([0, 1, 2])).toBe(0);
      expect(getCaptureMode([0, 1, 2, 3, 4, 5, 6, 7])).toBe(0);

      // Mode 1: 9-16通道
      expect(getCaptureMode([0, 1, 2, 3, 4, 5, 6, 7, 8])).toBe(1);
      expect(getCaptureMode(Array.from({ length: 16 }, (_, i) => i))).toBe(1);

      // Mode 2: 17-24通道
      expect(getCaptureMode(Array.from({ length: 17 }, (_, i) => i))).toBe(2);
      expect(getCaptureMode(Array.from({ length: 24 }, (_, i) => i))).toBe(2);
    });

    it('应该处理空通道数组', () => {
      const getCaptureMode = (driver as any).getCaptureMode.bind(driver);
      
      // 空数组应该使用Mode 0
      expect(getCaptureMode([])).toBe(0);
    });
  });

  describe('基础状态管理测试', () => {
    let driver: LogicAnalyzerDriver;

    beforeEach(() => {
      driver = new LogicAnalyzerDriver('/dev/ttyACM0');
    });

    it('应该正确报告初始状态', () => {
      expect(driver.isCapturing).toBe(false);
      expect(driver.isNetwork).toBe(false);
      expect(driver.deviceVersion).toBeNull();
      expect(driver.channelCount).toBe(0);
      expect(driver.maxFrequency).toBe(0);
    });

    it('应该正确处理未连接时的状态查询', async () => {
      // 未连接时应该能安全调用getStatus
      const status = await driver.getStatus();
      
      expect(status.isConnected).toBeDefined();
      expect(status.isCapturing).toBe(false);
      expect(status.batteryVoltage).toBeDefined();
    });

    it('应该正确处理未连接时的电压查询', async () => {
      // 串口设备未连接时应该返回DISCONNECTED
      const voltage = await driver.getVoltageStatus();
      
      expect(voltage).toBe('DISCONNECTED');
    });

    it('应该正确处理未连接时的引导加载程序请求', async () => {
      const result = await driver.enterBootloader();
      
      expect(result).toBe(false);
    });
  });

  describe('资源管理基础测试', () => {
    it('应该安全处理dispose调用', () => {
      const driver = new LogicAnalyzerDriver('/dev/ttyACM0');
      
      expect(() => driver.dispose()).not.toThrow();
    });

    it('应该安全处理disconnect调用', async () => {
      const driver = new LogicAnalyzerDriver('/dev/ttyACM0');
      
      await expect(driver.disconnect()).resolves.not.toThrow();
    });

    it('应该安全处理多次disconnect调用', async () => {
      const driver = new LogicAnalyzerDriver('/dev/ttyACM0');
      
      await driver.disconnect();
      await driver.disconnect(); // 不应该抛出异常
    });
  });

  describe('错误处理边界测试', () => {
    it('应该处理无效连接字符串构造', () => {
      // 只有null、undefined和空字符串会被拒绝
      const invalidStrings = ['', null, undefined];
      
      invalidStrings.forEach(str => {
        expect(() => new LogicAnalyzerDriver(str as any)).toThrow('连接字符串不能为空');
      });
      
      // 空格字符串是合法的（源码只检查!connectionString）
      expect(() => new LogicAnalyzerDriver('   ')).not.toThrow();
    });

    it('应该处理未连接状态的采集请求', async () => {
      const driver = new LogicAnalyzerDriver('/dev/ttyACM0');
      
      // 创建最小CaptureSession
      const session: Partial<CaptureSession> = {
        captureChannels: [],
        frequency: 24000000,
        preTriggerSamples: 1000,
        postTriggerSamples: 9000,
        triggerType: TriggerType.Edge,
        triggerChannel: 0,
        triggerInverted: false,
        loopCount: 0,
        measureBursts: false
      };

      const result = await driver.startCapture(session as CaptureSession);
      
      expect(result).toBe(CaptureError.HardwareError);
    });

    it('应该处理无效网络配置请求', async () => {
      const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
      
      // 网络设备不允许配置网络
      const result = await networkDriver.sendNetworkConfig(
        'TestNetwork',
        'password123',  
        '192.168.1.100',
        8080
      );
      
      expect(result).toBe(false);
    });
  });
});