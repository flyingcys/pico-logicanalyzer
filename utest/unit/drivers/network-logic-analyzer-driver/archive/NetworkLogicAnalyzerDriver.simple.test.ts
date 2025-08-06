/**
 * NetworkLogicAnalyzerDriver 简化单元测试
 * 先测试基本功能，确保测试框架正常工作
 */

import { NetworkLogicAnalyzerDriver } from '../../../src/drivers/NetworkLogicAnalyzerDriver';
import { AnalyzerDriverType } from '../../../src/models/AnalyzerTypes';

// Mock网络模块
jest.mock('net');
jest.mock('dgram');

describe('NetworkLogicAnalyzerDriver - 基本功能', () => {
  let driver: NetworkLogicAnalyzerDriver;

  beforeEach(() => {
    // 创建测试实例
    driver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080, 'tcp' as any, 'json' as any);
  });

  describe('构造函数和基本属性', () => {
    it('应该正确初始化基本属性', () => {
      expect(driver.driverType).toBe(AnalyzerDriverType.Network);
      expect(driver.isNetwork).toBe(true);
      expect(driver.channelCount).toBe(8);
      expect(driver.maxFrequency).toBe(40000000);
      expect(driver.blastFrequency).toBe(80000000);
      expect(driver.bufferSize).toBe(8000000);
      expect(driver.isCapturing).toBe(false);
      expect(driver.deviceVersion).toBeNull();
    });

    it('应该支持不同的构造参数', () => {
      const tcpDriver = new NetworkLogicAnalyzerDriver('127.0.0.1', 9000, 'tcp' as any, 'binary' as any, 'token123');
      expect(tcpDriver.driverType).toBe(AnalyzerDriverType.Network);
      expect(tcpDriver.isNetwork).toBe(true);

      const udpDriver = new NetworkLogicAnalyzerDriver('10.0.0.1', 5000, 'udp' as any, 'csv' as any);
      expect(udpDriver.driverType).toBe(AnalyzerDriverType.Network);
      expect(udpDriver.isNetwork).toBe(true);

      const wsDriver = new NetworkLogicAnalyzerDriver('example.com', 3000, 'websocket' as any, 'raw' as any);
      expect(wsDriver.driverType).toBe(AnalyzerDriverType.Network);
      expect(wsDriver.isNetwork).toBe(true);
    });
  });

  describe('基本方法存在性检查', () => {
    it('应该包含所有必需的方法', () => {
      expect(typeof driver.connect).toBe('function');
      expect(typeof driver.disconnect).toBe('function');
      expect(typeof driver.getStatus).toBe('function');
      expect(typeof driver.startCapture).toBe('function');
      expect(typeof driver.stopCapture).toBe('function');
      expect(typeof driver.enterBootloader).toBe('function');
      expect(typeof driver.sendNetworkConfig).toBe('function');
      expect(typeof driver.getVoltageStatus).toBe('function');
      expect(typeof driver.dispose).toBe('function');
    });
  });

  describe('未连接状态的方法调用', () => {
    it('应该在未连接时返回正确的状态', async () => {
      const status = await driver.getStatus();
      expect(status.isConnected).toBe(false);
      expect(status.isCapturing).toBe(false);
      expect(status.batteryVoltage).toBe('N/A');
    });

    it('应该在未连接时拒绝采集', async () => {
      const mockSession = {
        isActive: false,
        captureChannels: [],
        frequency: 40000000,
        triggerType: 0,
        triggerChannel: 0,
        triggerInverted: false,
        triggerPattern: 0,
        triggerBitCount: 1,
        preTriggerSamples: 1000,
        postTriggerSamples: 9000,
        loopCount: 1,
        measureBursts: false,
        mode: 0,
        bursts: undefined
      };

      const result = await driver.startCapture(mockSession as any);
      expect(result).toBe('HardwareError'); // CaptureError.HardwareError
    });
  });

  describe('资源清理', () => {
    it('应该正确清理资源', () => {
      expect(() => driver.dispose()).not.toThrow();
    });
  });
});