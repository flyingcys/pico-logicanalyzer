import { SerialDriverTemplate } from '../../../../src/driver-sdk/templates/SerialDriverTemplate';
import {
  AnalyzerDriverType,
  CaptureError,
  CaptureSession,
  ConnectionParams,
  DeviceStatus
} from '../../../../src/models/AnalyzerTypes';

// Mock dependencies
jest.mock('../../../../src/drivers/AnalyzerDriverBase', () => ({
  AnalyzerDriverBase: class {
    minFrequency = 1000;
    once = jest.fn();
    emitCaptureCompleted = jest.fn();
    dispose = jest.fn();
  }
}));

jest.mock('../../../../src/driver-sdk/tools/ProtocolHelper', () => ({
  ProtocolHelper: {
    serial: {
      getBaudRateConfig: jest.fn().mockReturnValue({
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none'
      })
    }
  }
}));

// Mock SerialPort
const mockSerialPort = {
  open: jest.fn(),
  write: jest.fn(),
  close: jest.fn(),
  on: jest.fn(),
  isOpen: true
};

const mockSerialPortList = jest.fn().mockResolvedValue([
  { path: 'COM3', manufacturer: 'Test', serialNumber: '123' },
  { path: 'COM4', manufacturer: 'Mock', serialNumber: '456' }
]);

jest.mock('serialport', () => ({
  SerialPort: jest.fn().mockImplementation(() => mockSerialPort),
  __esModule: true
}));

describe('SerialDriverTemplate', () => {
  let driver: SerialDriverTemplate;
  const portPath = 'COM3';
  const baudRate = 115200;

  beforeEach(() => {
    driver = new SerialDriverTemplate(portPath, baudRate);
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Mock serialport loading
    jest.spyOn(driver as any, 'loadSerialPort').mockResolvedValue({
      SerialPort: jest.fn().mockImplementation(() => mockSerialPort)
    });
  });

  afterEach(() => {
    if (driver) {
      driver.dispose();
    }
    jest.restoreAllMocks();
  });

  describe('构造函数和初始化', () => {
    it('应该正确初始化串口驱动模板', () => {
      expect(driver).toBeDefined();
      expect(driver.deviceVersion).toBeNull();
      expect(driver.channelCount).toBe(8);
      expect(driver.maxFrequency).toBe(24000000);
      expect(driver.blastFrequency).toBe(100000000);
      expect(driver.bufferSize).toBe(1000000);
      expect(driver.isNetwork).toBe(false);
      expect(driver.isCapturing).toBe(false);
      expect(driver.driverType).toBe(AnalyzerDriverType.Serial);
    });

    it('应该使用默认波特率', () => {
      const defaultDriver = new SerialDriverTemplate('COM1');
      expect(defaultDriver).toBeDefined();
    });

    it('应该使用自定义波特率', () => {
      const customDriver = new SerialDriverTemplate('COM1', 9600);
      expect(customDriver).toBeDefined();
    });
  });

  describe('串口库加载', () => {
    it('应该成功加载serialport库', async () => {
      const realLoadSerialPort = SerialDriverTemplate.prototype['loadSerialPort'];
      const testDriver = new SerialDriverTemplate('COM1');
      
      // 恢复真实的loadSerialPort方法进行测试
      (testDriver as any).loadSerialPort = realLoadSerialPort;
      
      // Mock import成功
      jest.doMock('serialport', () => ({ SerialPort: jest.fn() }), { virtual: true });
      
      await expect((testDriver as any).loadSerialPort()).resolves.toBeDefined();
    });

    it('应该处理serialport库缺失', async () => {
      const testDriver = new SerialDriverTemplate('COM1');
      const realLoadSerialPort = SerialDriverTemplate.prototype['loadSerialPort'];
      (testDriver as any).loadSerialPort = realLoadSerialPort;
      
      // Mock import失败
      jest.doMock('serialport', () => {
        throw new Error('Cannot find module');
      }, { virtual: true });
      
      await expect((testDriver as any).loadSerialPort()).rejects.toThrow('serialport库未安装');
    });
  });

  describe('设备连接', () => {
    it('应该成功连接串口设备', async () => {
      mockSerialPort.open.mockImplementation((callback) => {
        setTimeout(() => callback(null), 0);
      });
      
      // Mock设备初始化和查询
      jest.spyOn(driver as any, 'sendRawCommand')
        .mockResolvedValueOnce(Buffer.from('OK')) // *RST
        .mockResolvedValueOnce(Buffer.from('OK')) // *CLS
        .mockResolvedValueOnce(Buffer.from('TestDevice,Model1,123,v1.0')) // *IDN?
        .mockResolvedValueOnce(Buffer.from('8')) // CHANNELS?
        .mockResolvedValueOnce(Buffer.from('24000000')) // MAXRATE?
        .mockResolvedValueOnce(Buffer.from('1000000')); // BUFFER?
      
      const result = await driver.connect();
      
      expect(result.success).toBe(true);
      expect(result.deviceInfo).toBeDefined();
      expect(result.deviceInfo?.name).toBe('TestDevice Model1 (v1.0)');
      expect(result.deviceInfo?.type).toBe(AnalyzerDriverType.Serial);
      expect(result.deviceInfo?.connectionPath).toBe(portPath);
      expect(result.deviceInfo?.isNetwork).toBe(false);
      expect(mockSerialPort.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(mockSerialPort.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockSerialPort.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('应该处理串口打开失败', async () => {
      mockSerialPort.open.mockImplementation((callback) => {
        setTimeout(() => callback(new Error('串口占用')), 0);
      });
      
      const result = await driver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('串口打开失败');
    });

    it('应该处理设备初始化失败', async () => {
      mockSerialPort.open.mockImplementation((callback) => {
        setTimeout(() => callback(null), 0);
      });
      
      jest.spyOn(driver as any, 'sendRawCommand').mockRejectedValue(new Error('初始化失败'));
      
      const result = await driver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('初始化失败');
    });

    it('应该使用自定义连接参数', async () => {
      mockSerialPort.open.mockImplementation((callback) => {
        setTimeout(() => callback(null), 0);
      });
      
      jest.spyOn(driver as any, 'sendRawCommand').mockResolvedValue(Buffer.from('OK'));
      
      const params: ConnectionParams = {
        timeout: 10000,
        retries: 3
      };
      
      const result = await driver.connect(params);
      expect(result.success).toBe(true);
    });
  });

  describe('串口数据处理', () => {
    beforeEach(async () => {
      mockSerialPort.open.mockImplementation((callback) => {
        setTimeout(() => callback(null), 0);
      });
      jest.spyOn(driver as any, 'sendRawCommand').mockResolvedValue(Buffer.from('OK'));
      await driver.connect();
    });

    it('应该处理接收到的数据', () => {
      const testData = Buffer.from('test response\n');
      (driver as any).handleSerialData(testData);
      
      // 验证数据被添加到响应缓冲区
      expect((driver as any)._responseBuffer).toEqual(testData);
    });

    it('应该处理完整的响应包', () => {
      const handleResponseSpy = jest.spyOn(driver as any, 'handleResponse');
      
      // 模拟包含完整响应的数据
      const completeData = Buffer.from('response1\nresponse2\n');
      (driver as any)._responseBuffer = Buffer.alloc(0);
      (driver as any).processResponseBuffer = SerialDriverTemplate.prototype['processResponseBuffer'];
      
      (driver as any).handleSerialData(completeData);
      (driver as any).processResponseBuffer();
      
      expect(handleResponseSpy).toHaveBeenCalledTimes(2);
    });

    it('应该处理串口错误', () => {
      const testError = new Error('串口通信错误');
      (driver as any)._commandQueue = [
        { timeout: setTimeout(() => {}, 1000), reject: jest.fn() }
      ];
      
      (driver as any).handleSerialError(testError);
      
      expect((driver as any)._isConnected).toBe(false);
      expect((driver as any)._commandQueue).toHaveLength(0);
    });

    it('应该处理串口关闭', () => {
      (driver as any).handleSerialClose();
      expect((driver as any)._isConnected).toBe(false);
    });
  });

  describe('设备信息查询', () => {
    beforeEach(async () => {
      mockSerialPort.open.mockImplementation((callback) => {
        setTimeout(() => callback(null), 0);
      });
    });

    it('应该正确解析设备标识信息', () => {
      const idn = 'TestManufacturer,TestModel,SN123,v2.0';
      (driver as any).parseDeviceIdentification(idn);
      expect(driver.deviceVersion).toBe('TestManufacturer TestModel (v2.0)');
    });

    it('应该处理简化的设备标识', () => {
      const idn = 'SimpleDevice';
      (driver as any).parseDeviceIdentification(idn);
      expect(driver.deviceVersion).toBe('SimpleDevice');
    });

    it('应该处理部分设备标识', () => {
      const idn = 'Manufacturer,Model';
      (driver as any).parseDeviceIdentification(idn);
      expect(driver.deviceVersion).toBe('Manufacturer Model');
    });

    it('应该查询设备能力', async () => {
      jest.spyOn(driver as any, 'sendRawCommand')
        .mockResolvedValueOnce(Buffer.from('16')) // CHANNELS?
        .mockResolvedValueOnce(Buffer.from('50000000')) // MAXRATE?
        .mockResolvedValueOnce(Buffer.from('2000000')); // BUFFER?
      
      await (driver as any).queryDeviceCapabilities();
      
      expect(driver.channelCount).toBe(16);
      expect(driver.maxFrequency).toBe(50000000);
      expect(driver.bufferSize).toBe(2000000);
    });

    it('应该处理能力查询失败', async () => {
      jest.spyOn(driver as any, 'sendRawCommand').mockRejectedValue(new Error('查询失败'));
      
      await expect((driver as any).queryDeviceCapabilities()).resolves.toBeUndefined();
    });
  });

  describe('设备断开连接', () => {
    beforeEach(async () => {
      mockSerialPort.open.mockImplementation((callback) => {
        setTimeout(() => callback(null), 0);
      });
      jest.spyOn(driver as any, 'sendRawCommand').mockResolvedValue(Buffer.from('OK'));
      await driver.connect();
    });

    it('应该成功断开连接', async () => {
      mockSerialPort.close.mockImplementation((callback) => {
        setTimeout(() => callback(), 0);
      });
      
      await expect(driver.disconnect()).resolves.toBeUndefined();
      expect(mockSerialPort.close).toHaveBeenCalled();
    });

    it('应该在断开前停止采集', async () => {
      (driver as any)._capturing = true;
      const stopCaptureSpy = jest.spyOn(driver, 'stopCapture').mockResolvedValue(true);
      
      mockSerialPort.close.mockImplementation((callback) => {
        setTimeout(() => callback(), 0);
      });
      
      await driver.disconnect();
      expect(stopCaptureSpy).toHaveBeenCalled();
    });

    it('应该处理未连接状态的断开', async () => {
      (driver as any)._serialPort = null;
      await expect(driver.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('设备状态查询', () => {
    it('应该返回未连接状态', async () => {
      const status = await driver.getStatus();
      
      expect(status.isConnected).toBe(false);
      expect(status.isCapturing).toBe(false);
      expect(status.batteryVoltage).toBe('N/A');
    });

    it('应该查询连接设备状态', async () => {
      mockSerialPort.open.mockImplementation((callback) => {
        setTimeout(() => callback(null), 0);
      });
      
      jest.spyOn(driver as any, 'sendRawCommand')
        .mockResolvedValueOnce(Buffer.from('OK')) // *RST
        .mockResolvedValueOnce(Buffer.from('OK')) // *CLS
        .mockResolvedValueOnce(Buffer.from('TestDevice,Model1,123,v1.0')) // *IDN?
        .mockResolvedValueOnce(Buffer.from('READY')) // STATUS?
        .mockResolvedValueOnce(Buffer.from('3.3V')); // VOLTAGE?
      
      await driver.connect();
      const status = await driver.getStatus();
      
      expect(status.isConnected).toBe(true);
      expect(status.batteryVoltage).toBe('3.3V');
    });

    it('应该处理状态查询异常', async () => {
      (driver as any)._isConnected = true;
      jest.spyOn(driver as any, 'sendRawCommand').mockRejectedValue(new Error('查询失败'));
      
      const status = await driver.getStatus();
      expect(status.errorStatus).toContain('查询失败');
    });
  });

  describe('数据采集', () => {
    let session: CaptureSession;

    beforeEach(async () => {
      mockSerialPort.open.mockImplementation((callback) => {
        setTimeout(() => callback(null), 0);
      });
      jest.spyOn(driver as any, 'sendRawCommand').mockResolvedValue(Buffer.from('OK'));
      await driver.connect();
      
      session = {
        frequency: 1000000,
        preTriggerSamples: 1000,
        postTriggerSamples: 9000,
        captureChannels: [
          { channelNumber: 0, samples: new Uint8Array() },
          { channelNumber: 1, samples: new Uint8Array() }
        ],
        triggerType: 0,
        triggerChannel: 0
      };
    });

    it('应该成功开始采集', async () => {
      const result = await driver.startCapture(session);
      expect(result).toBe(CaptureError.None);
      expect(driver.isCapturing).toBe(true);
    });

    it('应该拒绝重复采集', async () => {
      await driver.startCapture(session);
      const result = await driver.startCapture(session);
      expect(result).toBe(CaptureError.Busy);
    });

    it('应该拒绝在未连接时采集', async () => {
      await driver.disconnect();
      const result = await driver.startCapture(session);
      expect(result).toBe(CaptureError.HardwareError);
    });

    it('应该配置采集会话', async () => {
      const sendRawCommandSpy = jest.spyOn(driver as any, 'sendRawCommand');
      
      await driver.startCapture(session);
      
      expect(sendRawCommandSpy).toHaveBeenCalledWith(Buffer.from('RATE 1000000\n'));
      expect(sendRawCommandSpy).toHaveBeenCalledWith(Buffer.from('CHANNELS 0,1\n'));
      expect(sendRawCommandSpy).toHaveBeenCalledWith(Buffer.from('SAMPLES 10000\n'));
      expect(sendRawCommandSpy).toHaveBeenCalledWith(Buffer.from('TRIGGER 0 0\n'));
      expect(sendRawCommandSpy).toHaveBeenCalledWith(Buffer.from('START\n'));
    });

    it('应该处理采集启动失败', async () => {
      jest.spyOn(driver as any, 'sendRawCommand').mockRejectedValue(new Error('启动失败'));
      
      const result = await driver.startCapture(session);
      expect(result).toBe(CaptureError.UnexpectedError);
      expect(driver.isCapturing).toBe(false);
    });
  });

  describe('采集监控', () => {
    let session: CaptureSession;

    beforeEach(async () => {
      mockSerialPort.open.mockImplementation((callback) => {
        setTimeout(() => callback(null), 0);
      });
      jest.spyOn(driver as any, 'sendRawCommand').mockResolvedValue(Buffer.from('OK'));
      await driver.connect();
      
      session = {
        frequency: 1000000,
        preTriggerSamples: 1000,
        postTriggerSamples: 9000,
        captureChannels: [{ channelNumber: 0, samples: new Uint8Array() }]
      };
    });

    it('应该监控采集进度直到完成', async () => {
      const sendRawCommandSpy = jest.spyOn(driver as any, 'sendRawCommand')
        .mockResolvedValue(Buffer.from('OK'))
        .mockResolvedValueOnce(Buffer.from('COMPLETE')); // CAPTURE_STATUS?
      
      const readCaptureDataSpy = jest.spyOn(driver as any, 'readCaptureData').mockResolvedValue();
      
      await driver.startCapture(session);
      
      // 等待监控完成
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(readCaptureDataSpy).toHaveBeenCalled();
    });

    it('应该处理采集错误状态', async () => {
      jest.spyOn(driver as any, 'sendRawCommand')
        .mockResolvedValue(Buffer.from('OK'))
        .mockResolvedValueOnce(Buffer.from('ERROR')); // CAPTURE_STATUS?
      
      await driver.startCapture(session);
      
      // 等待错误处理
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(driver.emitCaptureCompleted).toHaveBeenCalledWith({
        success: false,
        session
      });
    });

    it('应该处理监控异常', async () => {
      jest.spyOn(driver as any, 'sendRawCommand')
        .mockResolvedValue(Buffer.from('OK'))
        .mockRejectedValueOnce(new Error('监控失败')); // CAPTURE_STATUS?
      
      await driver.startCapture(session);
      
      // 等待异常处理
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(driver.emitCaptureCompleted).toHaveBeenCalledWith({
        success: false,
        session
      });
    });
  });

  describe('数据读取和解析', () => {
    let session: CaptureSession;

    beforeEach(async () => {
      mockSerialPort.open.mockImplementation((callback) => {
        setTimeout(() => callback(null), 0);
      });
      jest.spyOn(driver as any, 'sendRawCommand').mockResolvedValue(Buffer.from('OK'));
      await driver.connect();
      
      session = {
        frequency: 1000000,
        preTriggerSamples: 100,
        postTriggerSamples: 900,
        captureChannels: [
          { channelNumber: 0, samples: new Uint8Array() },
          { channelNumber: 1, samples: new Uint8Array() }
        ]
      };
    });

    it('应该成功读取采集数据', async () => {
      const testData1 = Buffer.from([1, 0, 1, 0, 1]);
      const testData2 = Buffer.from([0, 1, 0, 1, 0]);
      
      jest.spyOn(driver as any, 'sendRawCommand')
        .mockResolvedValueOnce(testData1) // DATA 0
        .mockResolvedValueOnce(testData2); // DATA 1
      
      await (driver as any).readCaptureData(session);
      
      expect(session.captureChannels[0].samples).toEqual(new Uint8Array([1, 0, 1, 0, 1]));
      expect(session.captureChannels[1].samples).toEqual(new Uint8Array([0, 1, 0, 1, 0]));
      expect(driver.isCapturing).toBe(false);
      expect(driver.emitCaptureCompleted).toHaveBeenCalledWith({
        success: true,
        session
      });
    });

    it('应该正确解析通道数据', () => {
      const rawData = Buffer.from([1, 0, 255, 0, 128]);
      const parsed = (driver as any).parseChannelData(rawData);
      
      expect(parsed).toEqual(new Uint8Array([1, 0, 1, 0, 1]));
    });

    it('应该处理数据读取异常', async () => {
      jest.spyOn(driver as any, 'sendRawCommand').mockRejectedValue(new Error('读取失败'));
      
      await (driver as any).readCaptureData(session);
      
      expect(driver.emitCaptureCompleted).toHaveBeenCalledWith({
        success: false,
        session
      });
    });
  });

  describe('采集停止', () => {
    beforeEach(async () => {
      mockSerialPort.open.mockImplementation((callback) => {
        setTimeout(() => callback(null), 0);
      });
      jest.spyOn(driver as any, 'sendRawCommand').mockResolvedValue(Buffer.from('OK'));
      await driver.connect();
    });

    it('应该成功停止采集', async () => {
      (driver as any)._capturing = true;
      
      const result = await driver.stopCapture();
      
      expect(result).toBe(true);
      expect(driver.isCapturing).toBe(false);
    });

    it('应该处理重复停止', async () => {
      const result = await driver.stopCapture();
      expect(result).toBe(true);
    });

    it('应该处理停止异常', async () => {
      (driver as any)._capturing = true;
      jest.spyOn(driver as any, 'sendRawCommand').mockRejectedValue(new Error('停止失败'));
      
      const result = await driver.stopCapture();
      expect(result).toBe(false);
    });
  });

  describe('引导加载程序', () => {
    beforeEach(async () => {
      mockSerialPort.open.mockImplementation((callback) => {
        setTimeout(() => callback(null), 0);
      });
      jest.spyOn(driver as any, 'sendRawCommand').mockResolvedValue(Buffer.from('OK'));
      await driver.connect();
    });

    it('应该成功进入引导加载程序', async () => {
      const result = await driver.enterBootloader();
      expect(result).toBe(true);
    });

    it('应该处理引导加载程序异常', async () => {
      jest.spyOn(driver as any, 'sendRawCommand').mockRejectedValue(new Error('引导失败'));
      
      const result = await driver.enterBootloader();
      expect(result).toBe(false);
    });
  });

  describe('命令队列管理', () => {
    beforeEach(async () => {
      mockSerialPort.open.mockImplementation((callback) => {
        setTimeout(() => callback(null), 0);
      });
      jest.spyOn(driver as any, 'sendRawCommand').mockResolvedValue(Buffer.from('OK'));
      await driver.connect();
    });

    it('应该发送原始命令', async () => {
      const command = Buffer.from('TEST\n');
      
      // Mock写入成功
      mockSerialPort.write.mockImplementation((data, callback) => {
        setTimeout(() => callback(null), 0);
      });
      
      // Mock响应处理
      setTimeout(() => {
        (driver as any).handleResponse(Buffer.from('OK'));
      }, 50);
      
      const response = await (driver as any).sendRawCommand(command);
      expect(response).toEqual(Buffer.from('OK'));
    });

    it('应该处理命令超时', async () => {
      const command = Buffer.from('SLOW\n');
      
      mockSerialPort.write.mockImplementation((data, callback) => {
        setTimeout(() => callback(null), 0);
      });
      
      // 不发送响应，测试超时
      await expect((driver as any).sendRawCommand(command, 100)).rejects.toThrow('命令超时');
    });

    it('应该处理写入错误', async () => {
      const command = Buffer.from('ERROR\n');
      
      mockSerialPort.write.mockImplementation((data, callback) => {
        setTimeout(() => callback(new Error('写入失败')), 0);
      });
      
      await expect((driver as any).sendRawCommand(command)).rejects.toThrow('写入失败');
    });

    it('应该处理命令队列', () => {
      (driver as any)._commandQueue = [];
      (driver as any)._isProcessingCommand = false;
      (driver as any)._serialPort = mockSerialPort;
      
      mockSerialPort.write.mockImplementation((data, callback) => {
        setTimeout(() => callback(null), 0);
      });
      
      // 添加命令到队列
      const command = {
        command: Buffer.from('TEST'),
        resolve: jest.fn(),
        reject: jest.fn(),
        timeout: setTimeout(() => {}, 1000)
      };
      (driver as any)._commandQueue.push(command);
      
      (driver as any).processCommandQueue();
      
      expect(mockSerialPort.write).toHaveBeenCalledWith(Buffer.from('TEST'), expect.any(Function));
    });
  });

  describe('静态方法', () => {
    it('应该获取可用串口列表', async () => {
      // Mock SerialPort.list
      const mockList = [
        { path: 'COM1', manufacturer: 'Test1', serialNumber: '001' },
        { path: 'COM2', manufacturer: 'Test2', serialNumber: '002' }
      ];
      
      jest.doMock('serialport', () => ({
        SerialPort: {
          list: jest.fn().mockResolvedValue(mockList)
        }
      }), { virtual: true });
      
      const ports = await SerialDriverTemplate.getAvailablePorts();
      expect(ports).toHaveLength(2);
      expect(ports[0]).toEqual({
        path: 'COM1',
        manufacturer: 'Test1',
        serialNumber: '001'
      });
    });

    it('应该处理串口列表查询失败', async () => {
      jest.doMock('serialport', () => {
        throw new Error('模块未找到');
      }, { virtual: true });
      
      const ports = await SerialDriverTemplate.getAvailablePorts();
      expect(ports).toEqual([]);
    });
  });

  describe('硬件能力', () => {
    it('应该构建正确的硬件能力描述', async () => {
      mockSerialPort.open.mockImplementation((callback) => {
        setTimeout(() => callback(null), 0);
      });
      jest.spyOn(driver as any, 'sendRawCommand').mockResolvedValue(Buffer.from('OK'));
      
      const result = await driver.connect();
      const capabilities = result.deviceInfo?.capabilities;
      
      expect(capabilities).toBeDefined();
      expect(capabilities.channels.digital).toBe(8);
      expect(capabilities.connectivity.interfaces).toEqual(['serial']);
      expect(capabilities.features.voltageMonitoring).toBe(true);
    });
  });

  describe('资源清理', () => {
    it('应该正确清理资源', async () => {
      const disconnectSpy = jest.spyOn(driver, 'disconnect').mockResolvedValue();
      
      driver.dispose();
      
      expect(disconnectSpy).toHaveBeenCalled();
    });
  });

  describe('边界条件测试', () => {
    it('应该处理空端口路径', () => {
      const emptyDriver = new SerialDriverTemplate('');
      expect(emptyDriver).toBeDefined();
    });

    it('应该处理无效波特率', () => {
      const invalidDriver = new SerialDriverTemplate('COM1', -1);
      expect(invalidDriver).toBeDefined();
    });

    it('应该处理空响应缓冲区', () => {
      (driver as any)._responseBuffer = Buffer.alloc(0);
      (driver as any).processResponseBuffer();
      // 应该不抛出异常
    });

    it('应该处理无效触发配置', async () => {
      mockSerialPort.open.mockImplementation((callback) => {
        setTimeout(() => callback(null), 0);
      });
      jest.spyOn(driver as any, 'sendRawCommand').mockResolvedValue(Buffer.from('OK'));
      await driver.connect();
      
      const session: CaptureSession = {
        frequency: 1000000,
        preTriggerSamples: 1000,
        postTriggerSamples: 9000,
        captureChannels: [{ channelNumber: 0, samples: new Uint8Array() }]
        // 没有设置triggerType和triggerChannel
      };
      
      const result = await driver.startCapture(session);
      expect(result).toBe(CaptureError.None);
    });
  });
});