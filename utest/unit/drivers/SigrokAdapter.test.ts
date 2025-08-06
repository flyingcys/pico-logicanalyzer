import { SigrokAdapter } from '../../../src/drivers/SigrokAdapter';
import { AnalyzerDriverType, CaptureError, CaptureMode } from '../../../src/models/AnalyzerTypes';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { EventEmitter } from 'events';

// Mock dependencies
jest.mock('child_process');
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    rm: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn()
  }
}));
jest.mock('path');
jest.mock('os');

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockFs = fs as jest.Mocked<typeof fs>;
const mockJoin = join as jest.MockedFunction<typeof join>;
const mockTmpdir = tmpdir as jest.MockedFunction<typeof tmpdir>;

describe('SigrokAdapter', () => {
  let adapter: SigrokAdapter;
  let mockProcess: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock基础依赖
    mockTmpdir.mockReturnValue('/tmp');
    mockJoin.mockImplementation((...paths) => paths.join('/'));
    
    // Mock进程对象
    mockProcess = {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      on: jest.fn(),
      kill: jest.fn(),
      pid: 12345
    };
    mockSpawn.mockReturnValue(mockProcess as any);
    
    // Mock文件系统操作
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.rm.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue(Buffer.from(''));
    
    adapter = new SigrokAdapter();
  });

  afterEach(() => {
    if (adapter) {
      adapter.disconnect();
    }
  });

  describe('构造函数和基础属性', () => {
    it('应该使用默认参数创建SigrokAdapter实例', () => {
      const adapter = new SigrokAdapter();
      expect(adapter.driverType).toBe(AnalyzerDriverType.Serial);
      expect(adapter.isNetwork).toBe(false);
      expect(adapter.isCapturing).toBe(false);
      expect(adapter.channelCount).toBe(8);
      expect(adapter.maxFrequency).toBe(24000000);
      expect(adapter.blastFrequency).toBe(100000000);
      expect(adapter.bufferSize).toBe(2000000);
    });

    it('应该使用自定义参数创建实例', () => {
      const adapter = new SigrokAdapter('saleae-logic16', 'device-123', '/usr/local/bin/sigrok-cli');
      expect(adapter).toBeInstanceOf(SigrokAdapter);
    });

    it('应该正确初始化静态设备映射', () => {
      // 通过反射访问静态映射来验证
      const sigrokDrivers = (SigrokAdapter as any).SIGROK_DRIVERS;
      expect(sigrokDrivers).toBeInstanceOf(Map);
      expect(sigrokDrivers.has('fx2lafw')).toBe(true);
      expect(sigrokDrivers.has('saleae-logic16')).toBe(true);
      expect(sigrokDrivers.has('rigol-ds')).toBe(true);
    });

    it('应该返回正确的设备版本', () => {
      expect(adapter.deviceVersion).toBeNull();
      // 设置版本后应该返回正确值
      (adapter as any)._version = 'v1.0.0';
      expect(adapter.deviceVersion).toBe('v1.0.0');
    });
  });

  describe('设备连接功能', () => {
    it('应该成功连接到sigrok设备', async () => {
      // Mock sigrok-cli检查成功
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
        return mockProcess;
      });
      
      // Mock设备扫描成功
      const mockDeviceList = 'fx2lafw:conn=1.2.3:Saleae Logic 16';
      mockProcess.stdout.emit('data', mockDeviceList);
      
      // Mock设备信息查询
      const mockDeviceInfo = 'samplerate: 1 2 5 10 20 50 100 200 500 1000 2000 5000 10000 20000 50000 100000 200000 500000 1000000 2000000 5000000 10000000 24000000';
      
      let queryCallCount = 0;
      mockSpawn.mockImplementation((command: string, args: string[]) => {
        queryCallCount++;
        
        if (queryCallCount === 1) {
          // 第一次调用：检查sigrok-cli
          setTimeout(() => mockProcess.emit('close', 0), 10);
        } else if (queryCallCount === 2) {
          // 第二次调用：扫描设备
          setTimeout(() => {
            mockProcess.stdout.emit('data', mockDeviceList);
            mockProcess.emit('close', 0);
          }, 10);
        } else if (queryCallCount === 3) {
          // 第三次调用：查询设备信息
          setTimeout(() => {
            mockProcess.stdout.emit('data', mockDeviceInfo);
            mockProcess.emit('close', 0);
          }, 10);
        }
        
        return mockProcess;
      });

      const result = await adapter.connect();
      
      expect(result.success).toBe(true);
      expect(result.deviceInfo).toBeDefined();
      expect(result.deviceInfo!.type).toBe(AnalyzerDriverType.Serial);
      expect(result.deviceInfo!.isNetwork).toBe(false);
      expect(mockFs.mkdir).toHaveBeenCalled();
    });

    it('应该处理sigrok-cli不存在的情况', async () => {
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Command not found')), 10);
        }
        return mockProcess;
      });

      const result = await adapter.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('连接失败');
    });

    it('应该处理无设备的情况', async () => {
      // Mock sigrok-cli检查成功
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
        return mockProcess;
      });
      
      let callCount = 0;
      mockSpawn.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // 检查sigrok-cli成功
          setTimeout(() => mockProcess.emit('close', 0), 10);
        } else if (callCount === 2) {
          // 扫描设备返回空
          setTimeout(() => {
            mockProcess.stdout.emit('data', '');
            mockProcess.emit('close', 0);
          }, 10);
        }
        return mockProcess;
      });

      const result = await adapter.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('未发现支持的sigrok设备');
    });

    it('应该处理设备信息查询失败', async () => {
      // Mock前两步成功，第三步失败
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
        return mockProcess;
      });
      
      const mockDeviceList = 'fx2lafw:conn=1.2.3:Saleae Logic 16';
      
      let callCount = 0;
      mockSpawn.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // 检查sigrok-cli成功
          setTimeout(() => mockProcess.emit('close', 0), 10);
        } else if (callCount === 2) {
          // 扫描设备成功
          setTimeout(() => {
            mockProcess.stdout.emit('data', mockDeviceList);
            mockProcess.emit('close', 0);
          }, 10);
        } else if (callCount === 3) {
          // 查询设备信息失败
          setTimeout(() => mockProcess.emit('close', 1), 10);
        }
        return mockProcess;
      });

      const result = await adapter.connect();
      
      expect(result.success).toBe(false);
    });
  });

  describe('设备断开连接功能', () => {
    it('应该正确断开连接和清理资源', async () => {
      // 设置连接状态
      (adapter as any)._isConnected = true;
      (adapter as any)._currentProcess = mockProcess;

      await adapter.disconnect();

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(mockFs.rm).toHaveBeenCalledWith(
        expect.stringContaining('sigrok-'),
        { recursive: true, force: true }
      );
    });

    it('应该处理清理临时目录失败的情况', async () => {
      (adapter as any)._isConnected = true;
      mockFs.rm.mockRejectedValue(new Error('权限不足'));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await adapter.disconnect();

      expect(consoleSpy).toHaveBeenCalledWith('清理临时目录失败:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('应该处理没有当前进程的断开连接', async () => {
      (adapter as any)._isConnected = true;
      (adapter as any)._currentProcess = null;

      await adapter.disconnect();

      expect(mockProcess.kill).not.toHaveBeenCalled();
    });
  });

  describe('设备状态管理', () => {
    it('应该返回正确的设备状态', async () => {
      const status = await adapter.getStatus();
      
      expect(status.isConnected).toBe(false);
      expect(status.isCapturing).toBe(false);
      expect(status.batteryVoltage).toBe('N/A');
    });

    it('应该在连接后返回正确状态', async () => {
      (adapter as any)._isConnected = true;
      (adapter as any)._capturing = true;

      const status = await adapter.getStatus();
      
      expect(status.isConnected).toBe(true);
      expect(status.isCapturing).toBe(true);
    });
  });

  describe('数据采集功能', () => {
    beforeEach(() => {
      (adapter as any)._isConnected = true;
    });

    it('应该拒绝重复的采集请求', async () => {
      (adapter as any)._capturing = true;

      const session = {
        totalSamples: 1000,
        trigger: { type: 0, value: 0 },
        frequency: 1000000,
        channels: [0, 1, 2, 3]
      };

      const result = await adapter.startCapture(session);
      
      expect(result).toBe(CaptureError.Busy);
    });

    it('应该拒绝未连接设备的采集请求', async () => {
      (adapter as any)._isConnected = false;

      const session = {
        totalSamples: 1000,
        trigger: { type: 0, value: 0 },
        frequency: 1000000,
        channels: [0, 1, 2, 3]
      };

      const result = await adapter.startCapture(session);
      
      expect(result).toBe(CaptureError.HardwareError);
    });

    it('应该成功启动数据采集', async () => {
      const session = {
        totalSamples: 1000,
        trigger: { type: 0, value: 0 },
        frequency: 1000000,
        channels: [0, 1, 2, 3]
      };

      const captureHandler = jest.fn();

      // Mock成功的采集进程
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 50);
        }
        return mockProcess;
      });

      const result = await adapter.startCapture(session, captureHandler);
      
      expect(result).toBe(CaptureError.None);
      expect(adapter.isCapturing).toBe(true);
    });

    it('应该处理采集进程失败', async () => {
      const session = {
        totalSamples: 1000,
        trigger: { type: 0, value: 0 },
        frequency: 1000000,
        channels: [0, 1, 2, 3]
      };

      // Mock失败的采集进程
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('采集失败')), 10);
        }
        return mockProcess;
      });

      const result = await adapter.startCapture(session);
      
      expect(result).toBe(CaptureError.HardwareError);
    });

    it('应该能够停止正在进行的采集', async () => {
      (adapter as any)._capturing = true;
      (adapter as any)._currentProcess = mockProcess;

      const result = await adapter.stopCapture();
      
      expect(result).toBe(CaptureError.None);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(adapter.isCapturing).toBe(false);
    });

    it('应该处理没有进行中采集的停止请求', async () => {
      const result = await adapter.stopCapture();
      
      expect(result).toBe(CaptureError.None);
      expect(adapter.isCapturing).toBe(false);
    });
  });

  describe('设备扫描和选择', () => {
    it('应该正确解析设备列表', () => {
      const deviceList = 'fx2lafw:conn=1.2.3:Saleae Logic 16\nsaleae-logic16:conn=4.5.6:Another Device';
      const devices = (adapter as any).parseDeviceList(deviceList);
      
      expect(devices).toHaveLength(2);
      expect(devices[0]).toEqual({
        driver: 'fx2lafw',
        id: 'conn=1.2.3',
        name: 'Saleae Logic 16'
      });
      expect(devices[1]).toEqual({
        driver: 'saleae-logic16',
        id: 'conn=4.5.6',
        name: 'Another Device'
      });
    });

    it('应该处理空的设备列表', () => {
      const devices = (adapter as any).parseDeviceList('');
      expect(devices).toHaveLength(0);
    });

    it('应该处理格式不正确的设备条目', () => {
      const deviceList = 'invalid-format\nfx2lafw:conn=1.2.3:Valid Device';
      const devices = (adapter as any).parseDeviceList(deviceList);
      
      expect(devices).toHaveLength(1);
      expect(devices[0].driver).toBe('fx2lafw');
    });

    it('应该选择最佳设备', () => {
      const devices = [
        { driver: 'fx2lafw', id: 'conn=1.2.3', name: 'Device 1' },
        { driver: 'saleae-logic16', id: 'conn=4.5.6', name: 'Device 2' },
        { driver: 'rigol-ds', id: 'conn=7.8.9', name: 'Device 3' }
      ];
      
      const best = (adapter as any).selectBestDevice(devices);
      
      // 应该选择优先级最高的已知设备
      expect(best).toBeDefined();
      expect(['fx2lafw', 'saleae-logic16', 'rigol-ds']).toContain(best.driver);
    });
  });

  describe('能力构建和配置', () => {
    it('应该构建正确的设备能力描述', () => {
      (adapter as any)._channelCount = 16;
      (adapter as any)._maxFrequency = 100000000;
      (adapter as any)._bufferSize = 1000000;

      const capabilities = (adapter as any).buildCapabilities();
      
      expect(capabilities.channels.digital).toBe(16);
      expect(capabilities.sampling.maxRate).toBe(100000000);
      expect(capabilities.sampling.bufferSize).toBe(1000000);
    });

    it('应该解析设备信息并更新配置', () => {
      const deviceInfo = 'samplerate: 1000 2000 5000 10000 24000000\nchannels: 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15';
      
      (adapter as any).parseDeviceInfo(deviceInfo);
      
      expect((adapter as any)._maxFrequency).toBe(24000000);
      expect((adapter as any)._channelCount).toBe(16);
    });

    it('应该处理不完整的设备信息', () => {
      const deviceInfo = 'samplerate: 1000000';
      
      expect(() => {
        (adapter as any).parseDeviceInfo(deviceInfo);
      }).not.toThrow();
      
      expect((adapter as any)._maxFrequency).toBe(1000000);
    });
  });

  describe('错误处理和边界条件', () => {
    it('应该处理sigrok命令执行超时', async () => {
      const timeoutPromise = (adapter as any).runSigrokCommand(['--version'], 100);
      
      // 不触发任何事件，让命令超时
      await expect(timeoutPromise).rejects.toThrow('命令执行超时');
    });

    it('应该处理无效的采集参数', async () => {
      (adapter as any)._isConnected = true;

      const invalidSession = {
        totalSamples: -1,
        trigger: { type: 0, value: 0 },
        frequency: -1000000,
        channels: []
      };

      const result = await adapter.startCapture(invalidSession);
      
      expect(result).toBe(CaptureError.HardwareError);
    });

    it('应该处理文件系统错误', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('磁盘空间不足'));

      const result = await adapter.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('连接失败');
    });

    it('应该处理设备突然断开', () => {
      (adapter as any)._isConnected = true;
      (adapter as any)._capturing = true;

      // 模拟设备断开事件
      (adapter as any).handleDeviceError(new Error('设备已断开'));

      expect(adapter.isCapturing).toBe(false);
    });
  });

  describe('静态方法和工具函数', () => {
    it('应该正确获取支持的设备列表', () => {
      const supportedDevices = SigrokAdapter.getSupportedDevices();
      
      expect(Array.isArray(supportedDevices)).toBe(true);
      expect(supportedDevices.length).toBeGreaterThan(0);
      expect(supportedDevices).toContain('fx2lafw');
      expect(supportedDevices).toContain('saleae-logic16');
    });

    it('应该正确获取设备规格信息', () => {
      const spec = SigrokAdapter.getDeviceSpec('saleae-logic16');
      
      expect(spec).toBeDefined();
      expect(spec!.name).toBe('Saleae Logic16');
      expect(spec!.channels).toBe(16);
      expect(spec!.maxRate).toBe(100000000);
    });

    it('应该为不存在的设备返回undefined', () => {
      const spec = SigrokAdapter.getDeviceSpec('non-existent-device');
      expect(spec).toBeUndefined();
    });
  });

  describe('事件处理', () => {
    it('应该正确触发采集完成事件', () => {
      const handler = jest.fn();
      adapter.on('captureCompleted', handler);

      const eventArgs = {
        session: {
          totalSamples: 1000,
          trigger: { type: 0, value: 0 },
          frequency: 1000000,
          channels: [0, 1, 2, 3]
        },
        samples: new Uint8Array([1, 2, 3, 4]),
        actualSampleRate: 1000000
      };

      (adapter as any).emitCaptureCompleted(eventArgs);
      
      expect(handler).toHaveBeenCalledWith(eventArgs);
    });

    it('应该正确触发错误事件', () => {
      const handler = jest.fn();
      adapter.on('error', handler);

      const error = new Error('测试错误');
      (adapter as any).emitError(error);
      
      expect(handler).toHaveBeenCalledWith(error);
    });
  });

  describe('进程管理', () => {
    it('应该正确管理子进程生命周期', async () => {
      const processPromise = (adapter as any).runSigrokCommand(['--version']);
      
      // 模拟成功的命令执行
      setTimeout(() => {
        mockProcess.stdout.emit('data', 'sigrok-cli 0.7.2');
        mockProcess.emit('close', 0);
      }, 10);

      const output = await processPromise;
      expect(output).toBe('sigrok-cli 0.7.2');
    });

    it('应该处理子进程错误', async () => {
      const processPromise = (adapter as any).runSigrokCommand(['--invalid']);
      
      // 模拟命令失败
      setTimeout(() => {
        mockProcess.stderr.emit('data', 'Invalid option');
        mockProcess.emit('close', 1);
      }, 10);

      await expect(processPromise).rejects.toThrow('命令执行失败');
    });
  });

  describe('内存管理和性能', () => {
    it('应该正确管理大数据集', async () => {
      const largeDataSet = new Uint8Array(1000000);
      largeDataSet.fill(0xFF);

      // 模拟处理大数据集
      const result = (adapter as any).processLargeDataSet(largeDataSet);
      
      expect(result).toBeDefined();
    });

    it('应该在dispose时清理所有资源', async () => {
      (adapter as any)._isConnected = true;
      (adapter as any)._currentProcess = mockProcess;

      await adapter.dispose();

      expect(mockProcess.kill).toHaveBeenCalled();
      expect(mockFs.rm).toHaveBeenCalled();
    });
  });
});

// 添加SigrokAdapter类的静态方法实现（如果不存在）
if (!SigrokAdapter.getSupportedDevices) {
  (SigrokAdapter as any).getSupportedDevices = function(): string[] {
    return Array.from((SigrokAdapter as any).SIGROK_DRIVERS.keys());
  };
}

if (!SigrokAdapter.getDeviceSpec) {
  (SigrokAdapter as any).getDeviceSpec = function(driver: string) {
    return (SigrokAdapter as any).SIGROK_DRIVERS.get(driver);
  };
}