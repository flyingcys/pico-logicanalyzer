/**
 * CaptureProgressMonitor 核心功能测试
 * 
 * 专注测试@src源码中的真实采集监控逻辑：
 * - 采集会话监控管理
 * - 进度更新和阶段转换
 * - 设备状态跟踪
 * - 性能统计和报告
 * 
 * 设计原则：
 * - 测试真实业务逻辑，不追求覆盖率数字
 * - 最小化Mock，专注源码验证
 * - 验证监控系统的核心算法
 */

import { 
  CaptureProgressMonitor,
  ProgressMonitorFactory,
  CapturePhase,
  DeviceStatus,
  CaptureProgress,
  DeviceStatusInfo
} from '../../../src/models/CaptureProgressMonitor';
import { 
  CaptureSession, 
  AnalyzerChannel 
} from '../../../src/models/CaptureModels';
import { 
  DeviceInfo,
  CaptureError,
  AnalyzerDriverType,
  TriggerType
} from '../../../src/models/AnalyzerTypes';

describe('CaptureProgressMonitor 核心功能测试', () => {
  let monitor: CaptureProgressMonitor;
  let testSession: CaptureSession;
  let testDeviceInfo: DeviceInfo;

  beforeEach(() => {
    monitor = new CaptureProgressMonitor({
      updateInterval: 50, // 快速更新用于测试
      enableRealtime: false, // 关闭定时器避免测试干扰
      maxHistoryEntries: 100
    });

    // 创建标准测试会话
    testSession = new CaptureSession();
    testSession.frequency = 1000000;
    testSession.preTriggerSamples = 1000;
    testSession.postTriggerSamples = 9000;
    testSession.captureChannels = [
      new AnalyzerChannel(0, 'CLK'),
      new AnalyzerChannel(1, 'DATA')
    ];

    // 创建测试设备信息
    testDeviceInfo = {
      name: 'Test Logic Analyzer',
      version: 'V1_7',
      type: AnalyzerDriverType.Network,
      connectionPath: '192.168.1.100:8080',
      isNetwork: true,
      capabilities: {
        metadata: {
          manufacturer: 'Test Corp',
          model: 'LA-2400',
          description: 'Test Logic Analyzer'
        },
        channels: {
          digital: 24,
          maxVoltage: 5.0,
          inputImpedance: 1000000
        },
        sampling: {
          maxRate: 100000000,
          minRate: 1000,
          supportedRates: [1000, 10000, 100000, 1000000, 10000000, 100000000],
          bufferSize: 96000,
          streamingSupport: true
        },
        triggers: {
          types: [TriggerType.Edge, TriggerType.Complex],
          maxChannels: 24,
          patternWidth: 16,
          sequentialSupport: false,
          conditions: []
        },
        connectivity: {
          interfaces: ['ethernet'],
          protocols: ['custom']
        },
        features: {
          signalGeneration: false,
          powerSupply: false,
          i2cSniffer: false,
          canSupport: false,
          customDecoders: true,
          voltageMonitoring: false
        }
      }
    };
  });

  afterEach(() => {
    monitor.destroy();
  });

  describe('采集会话监控管理', () => {
    it('应该能够开始监控新的采集会话', () => {
      const sessionId = 'test-session-001';
      const deviceId = 'device-001';

      monitor.startMonitoring(sessionId, deviceId, testSession);

      const activeCaptures = monitor.getActiveCaptures();
      expect(activeCaptures).toHaveLength(1);
      expect(activeCaptures[0].sessionId).toBe(sessionId);
      expect(activeCaptures[0].deviceId).toBe(deviceId);
      expect(activeCaptures[0].phase).toBe(CapturePhase.Initializing);
      expect(activeCaptures[0].totalSamples).toBe(10000); // preTrigger + postTrigger
    });

    it('应该能够监控多个并发采集会话', () => {
      const sessions = [
        { sessionId: 'session-001', deviceId: 'device-001' },
        { sessionId: 'session-002', deviceId: 'device-002' },
        { sessionId: 'session-003', deviceId: 'device-001' } // 同设备多会话
      ];

      sessions.forEach(({ sessionId, deviceId }) => {
        monitor.startMonitoring(sessionId, deviceId, testSession);
      });

      const activeCaptures = monitor.getActiveCaptures();
      expect(activeCaptures).toHaveLength(3);
      
      const sessionIds = activeCaptures.map(capture => capture.sessionId);
      expect(sessionIds).toContain('session-001');
      expect(sessionIds).toContain('session-002');
      expect(sessionIds).toContain('session-003');
    });

    it('应该正确初始化采集进度信息', () => {
      const sessionId = 'init-test-session';
      const deviceId = 'init-test-device';

      monitor.startMonitoring(sessionId, deviceId, testSession);

      const progress = monitor.getActiveCaptures()[0];
      expect(progress.currentSample).toBe(0);
      expect(progress.progressPercentage).toBe(0);
      expect(progress.activeChannels).toBe(2); // CLK + DATA
      expect(progress.completedChannels).toBe(0);
      expect(progress.lostSamples).toBe(0);
      expect(progress.errorCount).toBe(0);
      expect(typeof progress.startTime).toBe('number');
    });
  });

  describe('进度更新和阶段转换', () => {
    beforeEach(() => {
      monitor.startMonitoring('test-session', 'test-device', testSession);
    });

    it('应该能够更新采集进度', () => {
      const updates = {
        currentSample: 5000,
        progressPercentage: 50,
        samplesPerSecond: 1000000,
        dataRate: 250000,
        bufferUtilization: 0.5
      };

      monitor.updateProgress('test-session', updates);

      const progress = monitor.getActiveCaptures()[0];
      expect(progress.currentSample).toBe(5000);
      expect(progress.progressPercentage).toBe(50);
      expect(progress.samplesPerSecond).toBe(1000000);
      expect(progress.dataRate).toBe(250000);
      expect(progress.bufferUtilization).toBe(0.5);
    });

    it('应该能够更新采集阶段', () => {
      const phases = [
        CapturePhase.Configuring,
        CapturePhase.WaitingForTrigger,
        CapturePhase.Capturing,
        CapturePhase.ProcessingData
      ];

      phases.forEach(phase => {
        monitor.updatePhase('test-session', phase);
        const progress = monitor.getActiveCaptures()[0];
        expect(progress.phase).toBe(phase);
      });
    });

    it('应该正确计算经过时间', () => {
      const startTime = Date.now();
      
      // 更新进度，源码会自动计算elapsedTime
      monitor.updateProgress('test-session', {
        currentSample: 1000
      });

      const progress = monitor.getActiveCaptures()[0];
      // 验证elapsedTime已被计算且为正数
      expect(progress.elapsedTime).toBeGreaterThanOrEqual(0);
      expect(typeof progress.elapsedTime).toBe('number');
    });

    it('应该能够处理质量指标更新', () => {
      const qualityUpdates = {
        lostSamples: 10,
        errorCount: 2,
        signalQuality: 95
      };

      monitor.updateProgress('test-session', qualityUpdates);

      const progress = monitor.getActiveCaptures()[0];
      expect(progress.lostSamples).toBe(10);
      expect(progress.errorCount).toBe(2);
      expect(progress.signalQuality).toBe(95);
    });
  });

  describe('采集完成和取消管理', () => {
    beforeEach(() => {
      monitor.startMonitoring('complete-test', 'test-device', testSession);
    });

    it('应该能够完成成功的采集', () => {
      monitor.completeCapture('complete-test', true);

      const activeCaptures = monitor.getActiveCaptures();
      expect(activeCaptures).toHaveLength(0); // 完成后从活动列表移除

      const history = monitor.getCaptureHistory('complete-test');
      expect(history).toHaveLength(1);
      expect(history[0].phase).toBe(CapturePhase.Completed);
    });

    it('应该能够处理失败的采集', () => {
      const errorMessage = 'Hardware connection lost';
      monitor.completeCapture('complete-test', false, errorMessage);

      const activeCaptures = monitor.getActiveCaptures();
      expect(activeCaptures).toHaveLength(0);

      const history = monitor.getCaptureHistory('complete-test');
      expect(history).toHaveLength(1);
      expect(history[0].phase).toBe(CapturePhase.Error);
    });

    it('应该能够取消进行中的采集', () => {
      monitor.updatePhase('complete-test', CapturePhase.Capturing);
      
      monitor.cancelCapture('complete-test');

      const activeCaptures = monitor.getActiveCaptures();
      expect(activeCaptures).toHaveLength(0);

      const history = monitor.getCaptureHistory('complete-test');
      expect(history.length).toBeGreaterThan(0);
      // 最后一个历史记录应该是取消状态
      expect(history[history.length - 1].phase).toBe(CapturePhase.Cancelled);
    });

    it('应该能够处理不存在会话的完成请求', () => {
      expect(() => {
        monitor.completeCapture('nonexistent-session', true);
      }).not.toThrow();

      expect(() => {
        monitor.cancelCapture('nonexistent-session');
      }).not.toThrow();
    });
  });

  describe('设备状态跟踪', () => {
    it('应该能够更新设备状态', () => {
      const deviceId = 'status-test-device';
      const statusUpdate = {
        status: DeviceStatus.Connected,
        connectionType: 'network' as const,
        connectionQuality: 95,
        lastHeartbeat: Date.now(),
        temperature: 45.5,
        batteryLevel: 85
      };

      monitor.updateDeviceStatus(deviceId, testDeviceInfo, statusUpdate);

      const deviceStatuses = monitor.getDeviceStatuses();
      expect(deviceStatuses).toHaveLength(1);
      expect(deviceStatuses[0].deviceId).toBe(deviceId);
      expect(deviceStatuses[0].status).toBe(DeviceStatus.Connected);
      expect(deviceStatuses[0].temperature).toBe(45.5);
      expect(deviceStatuses[0].batteryLevel).toBe(85);
    });

    it('应该能够跟踪多个设备状态', () => {
      const devices = [
        { id: 'device-001', status: DeviceStatus.Connected },
        { id: 'device-002', status: DeviceStatus.Busy },
        { id: 'device-003', status: DeviceStatus.Error }
      ];

      devices.forEach(({ id, status }) => {
        monitor.updateDeviceStatus(id, testDeviceInfo, {
          status,
          connectionType: 'network' as const,
          connectionQuality: 90,
          lastHeartbeat: Date.now()
        });
      });

      const deviceStatuses = monitor.getDeviceStatuses();
      expect(deviceStatuses).toHaveLength(3);
      
      const statusMap = new Map(deviceStatuses.map(d => [d.deviceId, d.status]));
      expect(statusMap.get('device-001')).toBe(DeviceStatus.Connected);
      expect(statusMap.get('device-002')).toBe(DeviceStatus.Busy);
      expect(statusMap.get('device-003')).toBe(DeviceStatus.Error);
    });

    it('应该能够处理设备错误状态', () => {
      const deviceId = 'error-device';
      const errorUpdate = {
        status: DeviceStatus.Error,
        connectionType: 'network' as const,
        connectionQuality: 0,
        lastHeartbeat: Date.now()
      };

      monitor.updateDeviceStatus(deviceId, testDeviceInfo, errorUpdate);

      const device = monitor.getDeviceStatuses()[0];
      expect(device.status).toBe(DeviceStatus.Error);
      expect(device.connectionType).toBe('network');
      expect(device.connectionQuality).toBe(0);
    });
  });

  describe('系统状态报告生成', () => {
    beforeEach(() => {
      // 设置测试场景
      monitor.startMonitoring('session-001', 'device-001', testSession);
      monitor.startMonitoring('session-002', 'device-002', testSession);
      
      monitor.updateDeviceStatus('device-001', testDeviceInfo, {
        status: DeviceStatus.Capturing,
        connectionType: 'network' as const,
        connectionQuality: 85,
        lastHeartbeat: Date.now(),
        temperature: 55.0,
        batteryLevel: 70
      });
      
      monitor.updateDeviceStatus('device-002', testDeviceInfo, {
        status: DeviceStatus.Connected,
        connectionType: 'usb' as const,
        connectionQuality: 95,
        lastHeartbeat: Date.now(),
        temperature: 40.0,
        batteryLevel: 90
      });
    });

    it('应该生成完整的系统状态报告', () => {
      const report = monitor.generateStatusReport();

      expect(report.activeCaptures).toBe(2);
      expect(report.connectedDevices).toBe(2);
      expect(typeof report.overallStatus).toBe('string');
      expect(typeof report.cpuUsage).toBe('number');
      expect(typeof report.timestamp).toBe('number');
    });

    it('应该在报告中包含设备健康状态', () => {
      const report = monitor.generateStatusReport();

      expect(['normal', 'warning', 'error']).toContain(report.overallStatus);
      expect(Array.isArray(report.devices)).toBe(true);
      expect(typeof report.memoryUsage).toBe('number');
    });

    it('应该在报告中包含性能指标', () => {
      const report = monitor.generateStatusReport();

      expect(typeof report.cpuUsage).toBe('number');
      expect(typeof report.memoryUsage).toBe('number');
      expect(typeof report.networkLatency).toBe('number');
    });
  });

  describe('性能统计和历史管理', () => {
    it('应该能够获取性能统计', () => {
      // 模拟一些采集完成
      monitor.startMonitoring('perf-test-1', 'device-001', testSession);
      monitor.completeCapture('perf-test-1', true);

      monitor.startMonitoring('perf-test-2', 'device-001', testSession);
      monitor.completeCapture('perf-test-2', true);

      const stats = monitor.getPerformanceStatistics();

      expect(typeof stats.totalCaptures).toBe('number');
      expect(typeof stats.averageCaptureTime).toBe('number');
      expect(typeof stats.samplesPerSecond).toBe('number');
      expect(typeof stats.successRate).toBe('number');
    });

    it('应该能够清理采集历史', () => {
      monitor.startMonitoring('history-test', 'device-001', testSession);
      monitor.completeCapture('history-test', true);

      let history = monitor.getCaptureHistory('history-test');
      expect(history).toHaveLength(1);

      monitor.clearHistory('history-test');
      history = monitor.getCaptureHistory('history-test');
      expect(history).toHaveLength(0);
    });

    it('应该能够清理所有历史', () => {
      monitor.startMonitoring('history-1', 'device-001', testSession);
      monitor.startMonitoring('history-2', 'device-002', testSession);
      monitor.completeCapture('history-1', true);
      monitor.completeCapture('history-2', true);

      monitor.clearHistory(); // 清理所有

      expect(monitor.getCaptureHistory('history-1')).toHaveLength(0);
      expect(monitor.getCaptureHistory('history-2')).toHaveLength(0);
    });
  });

  describe('配置管理', () => {
    it('应该能够更新监控器配置', () => {
      const newConfig = {
        updateInterval: 200,
        maxHistoryEntries: 500,
        enableRealtime: true
      };

      monitor.updateConfig(newConfig);

      // 通过行为验证配置更新（无法直接访问私有config）
      // 这里验证配置更新不会抛出错误
      expect(() => {
        monitor.startMonitoring('config-test', 'device-001', testSession);
      }).not.toThrow();
    });

    it('应该能够处理部分配置更新', () => {
      const partialConfig = {
        maxHistoryEntries: 50
      };

      expect(() => {
        monitor.updateConfig(partialConfig);
      }).not.toThrow();
    });
  });

  describe('工厂方法测试', () => {
    it('应该能够创建默认监控器', () => {
      const defaultMonitor = ProgressMonitorFactory.createDefault();
      
      expect(defaultMonitor).toBeInstanceOf(CaptureProgressMonitor);
      
      // 验证默认监控器功能正常
      defaultMonitor.startMonitoring('factory-test', 'device-001', testSession);
      expect(defaultMonitor.getActiveCaptures()).toHaveLength(1);
      
      defaultMonitor.destroy();
    });

    it('应该能够创建高性能监控器', () => {
      const highPerfMonitor = ProgressMonitorFactory.createHighPerformance();
      
      expect(highPerfMonitor).toBeInstanceOf(CaptureProgressMonitor);
      
      highPerfMonitor.startMonitoring('high-perf-test', 'device-001', testSession);
      expect(highPerfMonitor.getActiveCaptures()).toHaveLength(1);
      
      highPerfMonitor.destroy();
    });

    it('应该能够创建低资源监控器', () => {
      const lowResourceMonitor = ProgressMonitorFactory.createLowResource();
      
      expect(lowResourceMonitor).toBeInstanceOf(CaptureProgressMonitor);
      
      lowResourceMonitor.startMonitoring('low-resource-test', 'device-001', testSession);
      expect(lowResourceMonitor.getActiveCaptures()).toHaveLength(1);
      
      lowResourceMonitor.destroy();
    });

    it('应该能够创建调试监控器', () => {
      const debugMonitor = ProgressMonitorFactory.createDebug();
      
      expect(debugMonitor).toBeInstanceOf(CaptureProgressMonitor);
      
      debugMonitor.startMonitoring('debug-test', 'device-001', testSession);
      expect(debugMonitor.getActiveCaptures()).toHaveLength(1);
      
      debugMonitor.destroy();
    });
  });

  describe('边界条件和错误处理', () => {
    it('应该处理空设备ID的更新请求', () => {
      expect(() => {
        monitor.updateDeviceStatus('', testDeviceInfo, { status: DeviceStatus.Connected });
      }).not.toThrow();
    });

    it('应该处理无效会话ID的进度更新', () => {
      expect(() => {
        monitor.updateProgress('invalid-session', { currentSample: 1000 });
      }).not.toThrow();
    });

    it('应该正确处理资源清理', () => {
      monitor.startMonitoring('cleanup-test', 'device-001', testSession);
      
      expect(() => {
        monitor.destroy();
      }).not.toThrow();
      
      // 销毁后应该清空所有数据
      expect(monitor.getActiveCaptures()).toHaveLength(0);
      expect(monitor.getDeviceStatuses()).toHaveLength(0);
    });

    it('应该处理极大数值的进度更新', () => {
      monitor.startMonitoring('large-value-test', 'device-001', testSession);
      
      const largeUpdate = {
        currentSample: Number.MAX_SAFE_INTEGER,
        totalSamples: Number.MAX_SAFE_INTEGER,
        samplesPerSecond: 1e9 // 1GHz
      };

      expect(() => {
        monitor.updateProgress('large-value-test', largeUpdate);
      }).not.toThrow();
    });
  });
});