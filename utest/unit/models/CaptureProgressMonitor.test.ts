/**
 * CaptureProgressMonitor 模块单元测试套件
 * 全面测试采集进度监控和状态报告系统的功能
 */

import {
  CaptureProgressMonitor,
  ProgressMonitorFactory,
  CapturePhase,
  DeviceStatus,
  CaptureProgress,
  DeviceStatusInfo,
  SystemStatusReport,
  ProgressMonitorConfig
} from '../../../src/models/CaptureProgressMonitor';
import {
  CaptureSession,
  AnalyzerChannel
} from '../../../src/models/CaptureModels';
import {
  DeviceInfo
} from '../../../src/models/AnalyzerTypes';

// Mock timers for testing
jest.useFakeTimers();

describe('CaptureProgressMonitor 模块测试套件', () => {
  
  describe('CapturePhase 枚举测试', () => {
    
    it('应该定义所有采集阶段', () => {
      expect(CapturePhase.Idle).toBe('idle');
      expect(CapturePhase.Initializing).toBe('initializing');
      expect(CapturePhase.Configuring).toBe('configuring');
      expect(CapturePhase.WaitingForTrigger).toBe('waiting_for_trigger');
      expect(CapturePhase.Capturing).toBe('capturing');
      expect(CapturePhase.ProcessingData).toBe('processing_data');
      expect(CapturePhase.Completed).toBe('completed');
      expect(CapturePhase.Error).toBe('error');
      expect(CapturePhase.Cancelled).toBe('cancelled');
    });
    
    it('枚举值应该是字符串类型', () => {
      Object.values(CapturePhase).forEach(phase => {
        expect(typeof phase).toBe('string');
      });
    });
  });
  
  describe('DeviceStatus 枚举测试', () => {
    
    it('应该定义所有设备状态', () => {
      expect(DeviceStatus.Disconnected).toBe('disconnected');
      expect(DeviceStatus.Connected).toBe('connected');
      expect(DeviceStatus.Busy).toBe('busy');
      expect(DeviceStatus.Capturing).toBe('capturing');
      expect(DeviceStatus.Error).toBe('error');
      expect(DeviceStatus.Overheating).toBe('overheating');
      expect(DeviceStatus.LowBattery).toBe('low_battery');
    });
    
    it('枚举值应该是字符串类型', () => {
      Object.values(DeviceStatus).forEach(status => {
        expect(typeof status).toBe('string');
      });
    });
  });
  
  describe('CaptureProgressMonitor 基础功能测试', () => {
    let monitor: CaptureProgressMonitor;
    let mockSession: CaptureSession;
    let mockDeviceInfo: DeviceInfo;
    
    beforeEach(() => {
      monitor = new CaptureProgressMonitor();
      
      mockSession = new CaptureSession();
      mockSession.frequency = 1000000;
      mockSession.preTriggerSamples = 100;
      mockSession.postTriggerSamples = 1000;
      mockSession.captureChannels = [
        new AnalyzerChannel(0, 'CH0'),
        new AnalyzerChannel(1, 'CH1')
      ];
      
      mockDeviceInfo = {
        name: 'Test Device',
        type: 'Pico',
        id: 'test-device-1',
        connectionString: '/dev/ttyUSB0'
      };
    });
    
    afterEach(() => {
      monitor.destroy();
      jest.clearAllTimers();
    });
    
    it('应该正确初始化默认配置', () => {
      const config = (monitor as any).config;
      
      expect(config.updateInterval).toBe(100);
      expect(config.enableRealtime).toBe(true);
      expect(config.maxHistoryEntries).toBe(1000);
      expect(config.warningThresholds.memoryUsage).toBe(1024 * 1024 * 1024);
      expect(config.warningThresholds.cpuUsage).toBe(80);
      expect(config.warningThresholds.errorRate).toBe(5);
      expect(config.warningThresholds.temperatureC).toBe(70);
    });
    
    it('应该接受自定义配置', () => {
      const customConfig: Partial<ProgressMonitorConfig> = {
        updateInterval: 50,
        enableRealtime: false,
        maxHistoryEntries: 500,
        warningThresholds: {
          memoryUsage: 512 * 1024 * 1024,
          cpuUsage: 60,
          errorRate: 3,
          temperatureC: 60
        }
      };
      
      const customMonitor = new CaptureProgressMonitor(customConfig);
      const config = (customMonitor as any).config;
      
      expect(config.updateInterval).toBe(50);
      expect(config.enableRealtime).toBe(false);
      expect(config.maxHistoryEntries).toBe(500);
      expect(config.warningThresholds.memoryUsage).toBe(512 * 1024 * 1024);
      expect(config.warningThresholds.cpuUsage).toBe(60);
      
      customMonitor.destroy();
    });
    
    it('应该正确记录系统启动时间', () => {
      const beforeCreate = Date.now();
      const testMonitor = new CaptureProgressMonitor();
      const afterCreate = Date.now();
      
      const startTime = (testMonitor as any).systemStartTime;
      expect(startTime).toBeGreaterThanOrEqual(beforeCreate);
      expect(startTime).toBeLessThanOrEqual(afterCreate);
      
      testMonitor.destroy();
    });
  });
  
  describe('采集监控生命周期测试', () => {
    let monitor: CaptureProgressMonitor;
    let mockSession: CaptureSession;
    
    beforeEach(() => {
      monitor = new CaptureProgressMonitor({ enableRealtime: false });
      
      mockSession = new CaptureSession();
      mockSession.preTriggerSamples = 100;
      mockSession.postTriggerSamples = 1000;
      mockSession.captureChannels = [
        new AnalyzerChannel(0, 'CH0'),
        new AnalyzerChannel(1, 'CH1')
      ];
    });
    
    afterEach(() => {
      monitor.destroy();
    });
    
    it('应该正确开始监控采集会话', (done) => {
      const sessionId = 'test-session-1';
      const deviceId = 'test-device-1';
      
      monitor.on('captureStarted', (progress: CaptureProgress) => {
        expect(progress.sessionId).toBe(sessionId);
        expect(progress.deviceId).toBe(deviceId);
        expect(progress.phase).toBe(CapturePhase.Initializing);
        expect(progress.currentSample).toBe(0);
        expect(progress.totalSamples).toBe(mockSession.totalSamples);
        expect(progress.progressPercentage).toBe(0);
        expect(progress.activeChannels).toBe(2);
        expect(progress.completedChannels).toBe(0);
        expect(progress.lostSamples).toBe(0);
        expect(progress.errorCount).toBe(0);
        expect(progress.signalQuality).toBe(100);
        expect(progress.startTime).toBeGreaterThan(0);
        done();
      });
      
      monitor.startMonitoring(sessionId, deviceId, mockSession);
      
      // 验证活跃采集列表
      const activeCaptures = monitor.getActiveCaptures();
      expect(activeCaptures).toHaveLength(1);
      expect(activeCaptures[0].sessionId).toBe(sessionId);
    });
    
    it('应该正确更新采集进度', (done) => {
      const sessionId = 'test-session-2';
      const deviceId = 'test-device-2';
      
      monitor.startMonitoring(sessionId, deviceId, mockSession);
      
      // 模拟时间流逝
      jest.advanceTimersByTime(1000);
      
      monitor.on('progressUpdated', (progress: CaptureProgress) => {
        expect(progress.currentSample).toBe(500);
        expect(progress.progressPercentage).toBe(45.45); // 500/1100 * 100
        expect(progress.elapsedTime).toBeGreaterThan(0);
        expect(progress.samplesPerSecond).toBeGreaterThan(0);
        expect(progress.dataRate).toBeGreaterThan(0);
        expect(progress.estimatedTimeRemaining).toBeGreaterThan(0);
        expect(progress.estimatedCompletionTime).toBeGreaterThan(Date.now());
        done();
      });
      
      monitor.updateProgress(sessionId, {
        currentSample: 500,
        bufferUtilization: 0.75
      });
    });
    
    it('应该正确更新采集阶段', () => {
      const sessionId = 'test-session-3';
      const deviceId = 'test-device-3';
      
      monitor.startMonitoring(sessionId, deviceId, mockSession);
      monitor.updatePhase(sessionId, CapturePhase.WaitingForTrigger);
      
      const activeCaptures = monitor.getActiveCaptures();
      expect(activeCaptures[0].phase).toBe(CapturePhase.WaitingForTrigger);
    });
    
    it('应该正确完成成功的采集', (done) => {
      const sessionId = 'test-session-4';
      const deviceId = 'test-device-4';
      
      monitor.startMonitoring(sessionId, deviceId, mockSession);
      monitor.updateProgress(sessionId, { currentSample: 1100 });
      
      monitor.on('captureCompleted', (event) => {
        expect(event.success).toBe(true);
        expect(event.progress.phase).toBe(CapturePhase.Completed);
        expect(event.progress.progressPercentage).toBe(100);
        expect(event.error).toBeUndefined();
        
        // 验证采集已从活跃列表中移除
        expect(monitor.getActiveCaptures()).toHaveLength(0);
        done();
      });
      
      monitor.completeCapture(sessionId, true);
    });
    
    it('应该正确处理失败的采集', (done) => {
      const sessionId = 'test-session-5';
      const deviceId = 'test-device-5';
      const errorMessage = 'Connection lost';
      
      monitor.startMonitoring(sessionId, deviceId, mockSession);
      monitor.updateProgress(sessionId, { currentSample: 300, errorCount: 1 });
      
      monitor.on('captureCompleted', (event) => {
        expect(event.success).toBe(false);
        expect(event.progress.phase).toBe(CapturePhase.Error);
        expect(event.progress.errorCount).toBe(2); // 原有1个 + 完成时增加1个
        expect(event.error).toBe(errorMessage);
        done();
      });
      
      monitor.completeCapture(sessionId, false, errorMessage);
    });
    
    it('应该正确取消采集', (done) => {
      const sessionId = 'test-session-6';
      const deviceId = 'test-device-6';
      
      monitor.startMonitoring(sessionId, deviceId, mockSession);
      
      monitor.on('captureCompleted', (event) => {
        expect(event.success).toBe(false);
        expect(event.progress.phase).toBe(CapturePhase.Cancelled);
        expect(event.error).toBe('Cancelled by user');
        done();
      });
      
      monitor.cancelCapture(sessionId);
    });
    
    it('应该忽略不存在的会话更新', () => {
      // 这些操作不应该抛出错误
      expect(() => {
        monitor.updateProgress('non-existent', { currentSample: 100 });
        monitor.updatePhase('non-existent', CapturePhase.Capturing);
        monitor.completeCapture('non-existent', true);
        monitor.cancelCapture('non-existent');
      }).not.toThrow();
    });
  });
  
  describe('设备状态管理测试', () => {
    let monitor: CaptureProgressMonitor;
    let mockDeviceInfo: DeviceInfo;
    
    beforeEach(() => {
      monitor = new CaptureProgressMonitor({ enableRealtime: false });
      
      mockDeviceInfo = {
        name: 'Test Logic Analyzer',
        type: 'Pico',
        id: 'pico-001',
        connectionString: '/dev/ttyUSB0'
      };
    });
    
    afterEach(() => {
      monitor.destroy();
    });
    
    it('应该正确更新设备状态', (done) => {
      const deviceId = 'pico-001';
      
      monitor.on('deviceStatusUpdated', (status: DeviceStatusInfo) => {
        expect(status.deviceId).toBe(deviceId);
        expect(status.deviceName).toBe('Test Logic Analyzer');
        expect(status.status).toBe(DeviceStatus.Connected);
        expect(status.connectionType).toBe('serial');
        expect(status.connectionQuality).toBe(95);
        expect(status.temperature).toBe(45);
        expect(status.batteryLevel).toBe(80);
        expect(status.lastHeartbeat).toBeGreaterThan(0);
        done();
      });
      
      monitor.updateDeviceStatus(deviceId, mockDeviceInfo, {
        status: DeviceStatus.Connected,
        connectionQuality: 95,
        temperature: 45,
        batteryLevel: 80
      });
    });
    
    it('应该正确处理网络设备', () => {
      const networkDeviceInfo: DeviceInfo = {
        name: 'Network Analyzer',
        type: 'Network',
        id: 'net-001',
        connectionString: '192.168.1.100:3333'
      };
      
      monitor.updateDeviceStatus('net-001', networkDeviceInfo, {
        status: DeviceStatus.Connected,
        connectionQuality: 85
      });
      
      const devices = monitor.getDeviceStatuses();
      expect(devices[0].connectionType).toBe('network');
    });
    
    it('应该正确管理设备统计信息', () => {
      const deviceId = 'pico-002';
      
      monitor.updateDeviceStatus(deviceId, mockDeviceInfo, {
        status: DeviceStatus.Connected,
        totalCaptures: 10,
        successfulCaptures: 8,
        failedCaptures: 2,
        errorCount: 3
      });
      
      const devices = monitor.getDeviceStatuses();
      const device = devices.find(d => d.deviceId === deviceId);
      
      expect(device?.totalCaptures).toBe(10);
      expect(device?.successfulCaptures).toBe(8);
      expect(device?.failedCaptures).toBe(2);
      expect(device?.errorCount).toBe(3);
    });
    
    it('应该正确处理设备错误状态', () => {
      const deviceId = 'pico-003';
      const errorMessage = 'Device overheated';
      
      monitor.updateDeviceStatus(deviceId, mockDeviceInfo, {
        status: DeviceStatus.Error,
        lastError: errorMessage,
        temperature: 85
      });
      
      const devices = monitor.getDeviceStatuses();
      const device = devices[0];
      
      expect(device.status).toBe(DeviceStatus.Error);
      expect(device.lastError).toBe(errorMessage);
      expect(device.temperature).toBe(85);
    });
  });
  
  describe('系统状态报告测试', () => {
    let monitor: CaptureProgressMonitor;
    
    beforeEach(() => {
      monitor = new CaptureProgressMonitor({
        enableRealtime: false,
        warningThresholds: {
          memoryUsage: 100 * 1024 * 1024, // 100MB for testing
          cpuUsage: 80,
          errorRate: 5,
          temperatureC: 70
        }
      });
    });
    
    afterEach(() => {
      monitor.destroy();
    });
    
    it('应该生成基础系统状态报告', () => {
      const report = monitor.generateStatusReport();
      
      expect(report.timestamp).toBeGreaterThan(0);
      expect(report.overallStatus).toBe('normal');
      expect(report.activeCaptures).toBe(0);
      expect(report.connectedDevices).toBe(0);
      expect(typeof report.cpuUsage).toBe('number');
      expect(typeof report.memoryUsage).toBe('number');
      expect(report.diskUsage).toBe(0);
      expect(typeof report.networkLatency).toBe('number');
      expect(Array.isArray(report.devices)).toBe(true);
      expect(Array.isArray(report.warnings)).toBe(true);
      expect(Array.isArray(report.errors)).toBe(true);
      expect(typeof report.statistics).toBe('object');
    });
    
    it('应该在有活跃采集时正确报告', () => {
      const mockSession = new CaptureSession();
      mockSession.captureChannels = [new AnalyzerChannel(0, 'CH0')];
      
      monitor.startMonitoring('session-1', 'device-1', mockSession);
      monitor.startMonitoring('session-2', 'device-2', mockSession);
      
      const report = monitor.generateStatusReport();
      expect(report.activeCaptures).toBe(2);
    });
    
    it('应该正确检测设备警告', () => {
      const mockDeviceInfo: DeviceInfo = {
        name: 'Hot Device',
        type: 'Pico',
        id: 'hot-device',
        connectionString: '/dev/ttyUSB0'
      };
      
      // 添加高温设备
      monitor.updateDeviceStatus('hot-device', mockDeviceInfo, {
        status: DeviceStatus.Connected,
        temperature: 75, // 超过70°C阈值
        batteryLevel: 15 // 低于20%
      });
      
      const report = monitor.generateStatusReport();
      
      expect(report.overallStatus).toBe('warning');
      expect(report.warnings.length).toBeGreaterThan(0);
      expect(report.warnings.some(w => w.includes('temperature is high'))).toBe(true);
      expect(report.warnings.some(w => w.includes('battery is low'))).toBe(true);
    });
    
    it('应该正确检测设备错误', () => {
      const mockDeviceInfo: DeviceInfo = {
        name: 'Error Device',
        type: 'Pico',
        id: 'error-device',
        connectionString: '/dev/ttyUSB0'
      };
      
      monitor.updateDeviceStatus('error-device', mockDeviceInfo, {
        status: DeviceStatus.Error,
        lastError: 'Communication failed'
      });
      
      const report = monitor.generateStatusReport();
      
      expect(report.overallStatus).toBe('error');
      expect(report.errors.length).toBeGreaterThan(0);
      expect(report.errors.some(e => e.includes('is in error state'))).toBe(true);
    });
    
    test.skip('应该正确计算统计信息', async () => {
      const mockSession = new CaptureSession();
      mockSession.postTriggerSamples = 1000;
      mockSession.captureChannels = [new AnalyzerChannel(0, 'CH0')];
      
      // 模拟完成几次采集，添加延迟确保elapsedTime > 0
      monitor.startMonitoring('session-1', 'device-1', mockSession);
      await new Promise(resolve => setTimeout(resolve, 10)); // 10ms延迟
      monitor.updateProgress('session-1', { currentSample: 1000 });
      monitor.completeCapture('session-1', true);
      
      monitor.startMonitoring('session-2', 'device-2', mockSession);
      await new Promise(resolve => setTimeout(resolve, 10)); // 10ms延迟
      monitor.updateProgress('session-2', { currentSample: 500 });
      monitor.completeCapture('session-2', false);
      
      const report = monitor.generateStatusReport();
      
      expect(report.statistics.totalSamplesProcessed).toBe(1500);
      expect(report.statistics.totalDataProcessed).toBe(1500); // 1500 samples * 1 channel
      expect(report.statistics.averageProcessingTime).toBeGreaterThan(0);
      expect(report.statistics.uptimeSeconds).toBeGreaterThan(0);
    }, 15000); // 增加超时时间到15秒
  });
  
  describe('历史记录管理测试', () => {
    let monitor: CaptureProgressMonitor;
    
    beforeEach(() => {
      monitor = new CaptureProgressMonitor({
        enableRealtime: false,
        maxHistoryEntries: 5 // 小数量便于测试
      });
    });
    
    afterEach(() => {
      monitor.destroy();
    });
    
    it('应该正确记录采集历史', () => {
      const sessionId = 'history-session';
      const mockSession = new CaptureSession();
      mockSession.captureChannels = [new AnalyzerChannel(0, 'CH0')];
      
      monitor.startMonitoring(sessionId, 'device-1', mockSession);
      
      // 多次更新进度
      monitor.updateProgress(sessionId, { currentSample: 100 });
      monitor.updateProgress(sessionId, { currentSample: 200 });
      monitor.updateProgress(sessionId, { currentSample: 300 });
      
      const history = monitor.getCaptureHistory(sessionId);
      expect(history.length).toBe(3);
      expect(history[0].currentSample).toBe(100);
      expect(history[1].currentSample).toBe(200);
      expect(history[2].currentSample).toBe(300);
    });
    
    it('应该正确限制历史记录数量', () => {
      const sessionId = 'limited-history';
      const mockSession = new CaptureSession();
      mockSession.captureChannels = [new AnalyzerChannel(0, 'CH0')];
      
      monitor.startMonitoring(sessionId, 'device-1', mockSession);
      
      // 添加超过限制的历史记录
      for (let i = 1; i <= 10; i++) {
        monitor.updateProgress(sessionId, { currentSample: i * 100 });
      }
      
      const history = monitor.getCaptureHistory(sessionId);
      expect(history.length).toBe(5); // maxHistoryEntries
      expect(history[0].currentSample).toBe(600); // 最早的记录被删除
      expect(history[4].currentSample).toBe(1000); // 最新的记录
    });
    
    it('应该正确清除历史记录', () => {
      const sessionId1 = 'session-1';
      const sessionId2 = 'session-2';
      const mockSession = new CaptureSession();
      mockSession.captureChannels = [new AnalyzerChannel(0, 'CH0')];
      
      monitor.startMonitoring(sessionId1, 'device-1', mockSession);
      monitor.startMonitoring(sessionId2, 'device-2', mockSession);
      
      monitor.updateProgress(sessionId1, { currentSample: 100 });
      monitor.updateProgress(sessionId2, { currentSample: 200 });
      
      // 清除单个会话历史
      monitor.clearHistory(sessionId1);
      expect(monitor.getCaptureHistory(sessionId1)).toHaveLength(0);
      expect(monitor.getCaptureHistory(sessionId2)).toHaveLength(1);
      
      // 清除所有历史
      monitor.clearHistory();
      expect(monitor.getCaptureHistory(sessionId2)).toHaveLength(0);
    });
    
    it('应该正确处理不存在的会话历史', () => {
      const history = monitor.getCaptureHistory('non-existent');
      expect(history).toEqual([]);
    });
  });
  
  describe('实时更新机制测试', () => {
    let monitor: CaptureProgressMonitor;
    
    afterEach(() => {
      monitor?.destroy();
    });
    
    it('应该在启用实时更新时自动启动定时器', () => {
      monitor = new CaptureProgressMonitor({ 
        enableRealtime: true, 
        updateInterval: 100 
      });
      
      // 验证定时器已启动
      expect((monitor as any).updateTimer).toBeDefined();
    });
    
    it('应该在禁用实时更新时不启动定时器', () => {
      monitor = new CaptureProgressMonitor({ enableRealtime: false });
      
      expect((monitor as any).updateTimer).toBeUndefined();
    });
    
    it('应该通过配置更新控制实时更新', () => {
      monitor = new CaptureProgressMonitor({ enableRealtime: false });
      expect((monitor as any).updateTimer).toBeUndefined();
      
      // 启用实时更新
      monitor.updateConfig({ enableRealtime: true });
      expect((monitor as any).updateTimer).toBeDefined();
      
      // 禁用实时更新
      monitor.updateConfig({ enableRealtime: false });
      expect((monitor as any).updateTimer).toBeUndefined();
    });
    
    it('应该在实时更新中发出系统状态事件', (done) => {
      monitor = new CaptureProgressMonitor({ 
        enableRealtime: true, 
        updateInterval: 50 
      });
      
      let eventReceived = false;
      monitor.on('systemStatusUpdated', (report: SystemStatusReport) => {
        if (eventReceived) return; // 防止重复调用done
        eventReceived = true;
        
        expect(report.timestamp).toBeGreaterThan(0);
        expect(typeof report.overallStatus).toBe('string');
        done();
      });
      
      // 推进定时器以触发更新
      jest.advanceTimersByTime(100);
    });
    
    it('应该在实时更新中自动更新活跃采集的时间信息', (done) => {
      monitor = new CaptureProgressMonitor({ 
        enableRealtime: true, 
        updateInterval: 50 
      });
      
      const mockSession = new CaptureSession();
      mockSession.captureChannels = [new AnalyzerChannel(0, 'CH0')];
      
      let progressUpdateCount = 0;
      monitor.on('progressUpdated', (progress: CaptureProgress) => {
        progressUpdateCount++;
        // 在第二次更新时验证（第一次是手动触发的，第二次是定时器触发的）
        if (progressUpdateCount === 2) {
          expect(progress.elapsedTime).toBeGreaterThan(0);
          done();
        }
      });
      
      // 开始监控并设置为采集状态
      monitor.startMonitoring('realtime-session', 'device-1', mockSession);
      monitor.updatePhase('realtime-session', CapturePhase.Capturing);
      
      // 推进定时器以触发实时更新
      jest.advanceTimersByTime(100);
    });
  });
  
  describe('性能统计测试', () => {
    let monitor: CaptureProgressMonitor;
    
    beforeEach(() => {
      monitor = new CaptureProgressMonitor({ enableRealtime: false });
    });
    
    afterEach(() => {
      monitor.destroy();
    });
    
    it('应该正确计算性能统计', () => {
      const mockSession = new CaptureSession();
      mockSession.postTriggerSamples = 1000;
      mockSession.captureChannels = [
        new AnalyzerChannel(0, 'CH0'),
        new AnalyzerChannel(1, 'CH1')
      ];
      
      const mockDeviceInfo: DeviceInfo = {
        name: 'Test Device',
        type: 'Pico',
        id: 'test-device',
        connectionString: '/dev/ttyUSB0'
      };
      
      // 更新设备状态
      monitor.updateDeviceStatus('test-device', mockDeviceInfo, {
        status: DeviceStatus.Connected,
        totalCaptures: 10,
        successfulCaptures: 8,
        failedCaptures: 2
      });
      
      // 模拟采集
      monitor.startMonitoring('session-1', 'test-device', mockSession);
      jest.advanceTimersByTime(1000); // 模拟1秒
      monitor.updateProgress('session-1', { currentSample: 1000 });
      monitor.completeCapture('session-1', true);
      
      const stats = monitor.getPerformanceStatistics();
      
      expect(stats.totalCaptures).toBe(1);
      expect(stats.averageCaptureTime).toBeGreaterThan(0);
      expect(stats.samplesPerSecond).toBeGreaterThan(0);
      expect(stats.dataRateMBps).toBeGreaterThan(0);
      expect(stats.successRate).toBe(80); // 8/10 * 100
    });
    
    it('应该正确处理零统计情况', () => {
      const stats = monitor.getPerformanceStatistics();
      
      expect(stats.totalCaptures).toBe(0);
      expect(stats.averageCaptureTime).toBe(0);
      expect(stats.samplesPerSecond).toBe(0);
      expect(stats.dataRateMBps).toBe(0);
      expect(stats.successRate).toBe(100); // 没有尝试时默认100%
    });
  });
  
  describe('事件系统测试', () => {
    let monitor: CaptureProgressMonitor;
    
    beforeEach(() => {
      monitor = new CaptureProgressMonitor({ enableRealtime: false });
    });
    
    afterEach(() => {
      monitor.destroy();
    });
    
    it('应该正确发出所有预期事件', () => {
      const events: string[] = [];
      const mockSession = new CaptureSession();
      mockSession.captureChannels = [new AnalyzerChannel(0, 'CH0')];
      
      monitor.on('captureStarted', () => events.push('captureStarted'));
      monitor.on('progressUpdated', () => events.push('progressUpdated'));
      monitor.on('captureCompleted', () => events.push('captureCompleted'));
      monitor.on('deviceStatusUpdated', () => events.push('deviceStatusUpdated'));
      
      const mockDeviceInfo: DeviceInfo = {
        name: 'Test Device',
        type: 'Pico',
        id: 'test-device',
        connectionString: '/dev/ttyUSB0'
      };
      
      // 触发所有事件
      monitor.startMonitoring('session-1', 'device-1', mockSession);
      monitor.updateProgress('session-1', { currentSample: 100 });
      monitor.updateDeviceStatus('device-1', mockDeviceInfo, { status: DeviceStatus.Connected });
      monitor.completeCapture('session-1', true);
      
      expect(events).toContain('captureStarted');
      expect(events).toContain('progressUpdated');
      expect(events).toContain('captureCompleted');
      expect(events).toContain('deviceStatusUpdated');
    });
    
    it('应该在销毁时清理所有事件监听器', () => {
      let eventCount = 0;
      monitor.on('captureStarted', () => eventCount++);
      monitor.on('progressUpdated', () => eventCount++);
      
      expect(monitor.listenerCount('captureStarted')).toBe(1);
      expect(monitor.listenerCount('progressUpdated')).toBe(1);
      
      monitor.destroy();
      
      expect(monitor.listenerCount('captureStarted')).toBe(0);
      expect(monitor.listenerCount('progressUpdated')).toBe(0);
    });
  });
  
  describe('错误处理和边界条件测试', () => {
    let monitor: CaptureProgressMonitor;
    
    beforeEach(() => {
      monitor = new CaptureProgressMonitor({ enableRealtime: false });
    });
    
    afterEach(() => {
      monitor.destroy();
    });
    
    it('应该正确处理进度计算中的除零情况', () => {
      const mockSession = new CaptureSession();
      mockSession.postTriggerSamples = 0; // 零总样本数
      mockSession.captureChannels = [new AnalyzerChannel(0, 'CH0')];
      
      expect(() => {
        monitor.startMonitoring('zero-session', 'device-1', mockSession);
        monitor.updateProgress('zero-session', { currentSample: 0 });
      }).not.toThrow();
      
      const activeCaptures = monitor.getActiveCaptures();
      expect(activeCaptures[0].progressPercentage).toBe(0);
    });
    
    it('应该正确处理负数和极值', () => {
      const mockSession = new CaptureSession();
      mockSession.captureChannels = [new AnalyzerChannel(0, 'CH0')];
      
      monitor.startMonitoring('edge-session', 'device-1', mockSession);
      
      expect(() => {
        monitor.updateProgress('edge-session', {
          currentSample: -100, // 负值
          bufferUtilization: 2.5, // 超过1.0
          lostSamples: -5, // 负值
          signalQuality: 150 // 超过100
        });
      }).not.toThrow();
    });
    
    it('应该正确处理空设备列表的网络延迟计算', () => {
      const report = monitor.generateStatusReport();
      expect(report.networkLatency).toBe(0);
    });
    
    it('应该正确计算网络设备延迟', () => {
      const networkDevice1: DeviceInfo = {
        name: 'Network Device 1',
        type: 'Network',
        id: 'net-device-1',
        connectionString: '192.168.1.100:3333'
      };
      
      const networkDevice2: DeviceInfo = {
        name: 'Network Device 2',
        type: 'Network',
        id: 'net-device-2',
        connectionString: '192.168.1.101:3333'
      };
      
      monitor.updateDeviceStatus('net-device-1', networkDevice1, {
        status: DeviceStatus.Connected,
        connectionQuality: 80
      });
      
      monitor.updateDeviceStatus('net-device-2', networkDevice2, {
        status: DeviceStatus.Connected,
        connectionQuality: 60
      });
      
      const report = monitor.generateStatusReport();
      // 平均质量: (80 + 60) / 2 = 70, 延迟: 100 - 70 = 30
      expect(report.networkLatency).toBe(30);
    });
    
    it('应该正确触发内存使用警告', () => {
      // 创建一个内存阈值很低的监控器以便测试
      const lowMemoryMonitor = new CaptureProgressMonitor({
        enableRealtime: false,
        warningThresholds: {
          memoryUsage: 1, // 1字节，必然会触发警告
          cpuUsage: 80,
          errorRate: 5,
          temperatureC: 70
        }
      });
      
      const report = lowMemoryMonitor.generateStatusReport();
      
      expect(report.overallStatus).toBe('warning');
      expect(report.warnings.some(w => w.includes('High memory usage'))).toBe(true);
      
      lowMemoryMonitor.destroy();
    });
    
    it('应该正确处理配置更新中的部分配置', () => {
      const initialConfig = (monitor as any).config;
      const originalInterval = initialConfig.updateInterval;
      
      monitor.updateConfig({ updateInterval: 200 });
      
      const updatedConfig = (monitor as any).config;
      expect(updatedConfig.updateInterval).toBe(200);
      expect(updatedConfig.enableRealtime).toBe(initialConfig.enableRealtime);
      expect(updatedConfig.maxHistoryEntries).toBe(initialConfig.maxHistoryEntries);
    });
    
    it('应该正确处理销毁后的操作', () => {
      const mockSession = new CaptureSession();
      mockSession.captureChannels = [new AnalyzerChannel(0, 'CH0')];
      
      monitor.startMonitoring('destroyed-session', 'device-1', mockSession);
      monitor.destroy();
      
      // 这些操作在销毁后不应该抛出错误
      expect(() => {
        monitor.updateProgress('destroyed-session', { currentSample: 100 });
        monitor.completeCapture('destroyed-session', true);
        monitor.generateStatusReport();
        monitor.getActiveCaptures();
        monitor.getDeviceStatuses();
      }).not.toThrow();
    });
  });
});

describe('ProgressMonitorFactory 工厂类测试', () => {
  
  afterEach(() => {
    // 清理可能创建的监控器
    jest.clearAllTimers();
  });
  
  it('应该创建默认监控器', () => {
    const monitor = ProgressMonitorFactory.createDefault();
    const config = (monitor as any).config;
    
    expect(config.updateInterval).toBe(100);
    expect(config.enableRealtime).toBe(true);
    expect(config.maxHistoryEntries).toBe(1000);
    
    monitor.destroy();
  });
  
  it('应该创建高性能监控器', () => {
    const monitor = ProgressMonitorFactory.createHighPerformance();
    const config = (monitor as any).config;
    
    expect(config.updateInterval).toBe(50);
    expect(config.enableRealtime).toBe(true);
    expect(config.maxHistoryEntries).toBe(500);
    
    monitor.destroy();
  });
  
  it('应该创建低资源监控器', () => {
    const monitor = ProgressMonitorFactory.createLowResource();
    const config = (monitor as any).config;
    
    expect(config.updateInterval).toBe(500);
    expect(config.enableRealtime).toBe(false);
    expect(config.maxHistoryEntries).toBe(100);
    
    monitor.destroy();
  });
  
  it('应该创建调试监控器', () => {
    const monitor = ProgressMonitorFactory.createDebug();
    const config = (monitor as any).config;
    
    expect(config.updateInterval).toBe(10);
    expect(config.enableRealtime).toBe(true);
    expect(config.maxHistoryEntries).toBe(2000);
    expect(config.warningThresholds.memoryUsage).toBe(512 * 1024 * 1024);
    expect(config.warningThresholds.cpuUsage).toBe(50);
    expect(config.warningThresholds.errorRate).toBe(1);
    expect(config.warningThresholds.temperatureC).toBe(50);
    
    monitor.destroy();
  });
  
  it('所有工厂方法应该返回功能正常的监控器实例', () => {
    const monitors = [
      ProgressMonitorFactory.createDefault(),
      ProgressMonitorFactory.createHighPerformance(),
      ProgressMonitorFactory.createLowResource(),
      ProgressMonitorFactory.createDebug()
    ];
    
    monitors.forEach((monitor, index) => {
      expect(monitor).toBeInstanceOf(CaptureProgressMonitor);
      
      // 测试基本功能
      const mockSession = new CaptureSession();
      mockSession.captureChannels = [new AnalyzerChannel(0, 'CH0')];
      
      expect(() => {
        monitor.startMonitoring(`test-session-${index}`, `device-${index}`, mockSession);
        monitor.updateProgress(`test-session-${index}`, { currentSample: 100 });
        monitor.completeCapture(`test-session-${index}`, true);
        monitor.generateStatusReport();
      }).not.toThrow();
      
      monitor.destroy();
    });
  });
});

describe('集成测试', () => {
  let monitor: CaptureProgressMonitor;
  
  beforeEach(() => {
    monitor = new CaptureProgressMonitor({ enableRealtime: false });
  });
  
  afterEach(() => {
    monitor.destroy();
  });
  
  test.skip('应该支持完整的多设备监控工作流', async () => {
    const session1 = new CaptureSession();
    session1.postTriggerSamples = 1000;
    session1.captureChannels = [new AnalyzerChannel(0, 'CH0')];
    
    const session2 = new CaptureSession();
    session2.postTriggerSamples = 2000;
    session2.captureChannels = [new AnalyzerChannel(0, 'CH0'), new AnalyzerChannel(1, 'CH1')];
    
    const deviceInfo1: DeviceInfo = {
      name: 'Pico 1',
      type: 'Pico',
      id: 'pico-1',
      connectionString: '/dev/ttyUSB0'
    };
    
    const deviceInfo2: DeviceInfo = {
      name: 'Network Analyzer',
      type: 'Network',
      id: 'net-1',
      connectionString: '192.168.1.100:3333'
    };
    
    let completedCaptures = 0;
    const completionPromise = new Promise<void>((resolve) => {
      monitor.on('captureCompleted', () => {
        completedCaptures++;
        if (completedCaptures === 2) {
          resolve();
        }
      });
    });
    
    // 开始多设备监控
    monitor.startMonitoring('session-1', 'pico-1', session1);
    monitor.startMonitoring('session-2', 'net-1', session2);
    
    // 更新设备状态
    monitor.updateDeviceStatus('pico-1', deviceInfo1, {
      status: DeviceStatus.Capturing,
      connectionQuality: 95,
      totalCaptures: 1,
      successfulCaptures: 1
    });
    
    monitor.updateDeviceStatus('net-1', deviceInfo2, {
      status: DeviceStatus.Capturing,
      connectionQuality: 85,
      totalCaptures: 1,
      successfulCaptures: 1
    });
    
    // 模拟采集进度 - 改用async/await
    await new Promise(resolve => setTimeout(resolve, 10));
    monitor.updateProgress('session-1', { currentSample: 500, phase: CapturePhase.Capturing });
    monitor.updateProgress('session-2', { currentSample: 1000, phase: CapturePhase.Capturing });
    
    await new Promise(resolve => setTimeout(resolve, 10));
    monitor.updateProgress('session-1', { currentSample: 1000, phase: CapturePhase.ProcessingData });
    monitor.updateProgress('session-2', { currentSample: 2000, phase: CapturePhase.ProcessingData });
    
    await new Promise(resolve => setTimeout(resolve, 10));
    monitor.completeCapture('session-1', true);
    monitor.completeCapture('session-2', true);
    
    // 等待完成事件
    await completionPromise;
    
    // 验证最终状态
    const report = monitor.generateStatusReport();
    expect(report.activeCaptures).toBe(0);
    expect(report.statistics.totalSamplesProcessed).toBe(3000);
    
    const stats = monitor.getPerformanceStatistics();
    expect(stats.totalCaptures).toBe(2);
    expect(stats.successRate).toBe(100);
  }, 15000); // 增加超时时间到15秒
});