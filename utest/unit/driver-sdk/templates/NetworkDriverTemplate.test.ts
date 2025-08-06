import { NetworkDriverTemplate, ProtocolType } from '../../../../src/driver-sdk/templates/NetworkDriverTemplate';
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
    network: {
      createTcpConnection: jest.fn(),
      createUdpSocket: jest.fn(),
      validateHost: jest.fn().mockReturnValue(true),
      validatePort: jest.fn().mockReturnValue(true)
    }
  }
}));

// Mock net module
const mockSocket = {
  connect: jest.fn(),
  write: jest.fn(),
  end: jest.fn(),
  destroy: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
  connected: false
};

jest.mock('net', () => ({
  Socket: jest.fn().mockImplementation(() => mockSocket)
}));

// Mock dgram module
const mockUdpSocket = {
  send: jest.fn(),
  close: jest.fn(),
  on: jest.fn(),
  bind: jest.fn(),
  address: jest.fn().mockReturnValue({ port: 12345 })
};

jest.mock('dgram', () => ({
  createSocket: jest.fn().mockImplementation(() => mockUdpSocket)
}));

describe('NetworkDriverTemplate', () => {
  let driver: NetworkDriverTemplate;
  const host = '192.168.1.100';
  const port = 5555;

  beforeEach(() => {
    driver = new NetworkDriverTemplate(host, port, ProtocolType.TCP);
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    if (driver) {
      driver.dispose();
    }
    jest.restoreAllMocks();
  });

  describe('构造函数和初始化', () => {
    it('应该正确初始化网络驱动模板', () => {
      expect(driver).toBeDefined();
      expect(driver.deviceVersion).toBeNull();
      expect(driver.channelCount).toBe(16);
      expect(driver.maxFrequency).toBe(100000000);
      expect(driver.blastFrequency).toBe(200000000);
      expect(driver.bufferSize).toBe(10000000);
      expect(driver.isNetwork).toBe(true);
      expect(driver.isCapturing).toBe(false);
      expect(driver.driverType).toBe(AnalyzerDriverType.Network);
    });

    it('应该使用默认TCP协议', () => {
      const defaultDriver = new NetworkDriverTemplate(host, port);
      expect(defaultDriver).toBeDefined();
    });

    it('应该支持UDP协议', () => {
      const udpDriver = new NetworkDriverTemplate(host, port, ProtocolType.UDP);
      expect(udpDriver).toBeDefined();
    });

    it('应该支持HTTP协议', () => {
      const httpDriver = new NetworkDriverTemplate(host, port, ProtocolType.HTTP);
      expect(httpDriver).toBeDefined();
    });

    it('应该支持WebSocket协议', () => {
      const wsDriver = new NetworkDriverTemplate(host, port, ProtocolType.WEBSOCKET);
      expect(wsDriver).toBeDefined();
    });

    it('应该支持认证令牌', () => {
      const authDriver = new NetworkDriverTemplate(host, port, ProtocolType.TCP, 'auth-token-123');
      expect(authDriver).toBeDefined();
    });
  });

  describe('TCP连接', () => {
    beforeEach(() => {
      driver = new NetworkDriverTemplate(host, port, ProtocolType.TCP);
    });

    it('应该成功建立TCP连接', async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        mockSocket.connected = true;
        setTimeout(() => callback(), 0);
        return mockSocket;
      });

      // Mock设备初始化响应
      jest.spyOn(driver as any, 'sendNetworkCommand')
        .mockResolvedValueOnce({ success: true, data: 'OK' }) // HELLO
        .mockResolvedValueOnce({ success: true, data: 'NetworkDevice,v1.0,SN123' }) // *IDN?
        .mockResolvedValueOnce({ success: true, data: '16' }) // CHANNELS?
        .mockResolvedValueOnce({ success: true, data: '100000000' }) // MAXRATE?
        .mockResolvedValueOnce({ success: true, data: '10000000' }); // BUFFER?

      const result = await driver.connect();

      expect(result.success).toBe(true);
      expect(result.deviceInfo).toBeDefined();
      expect(result.deviceInfo?.name).toBe('NetworkDevice,v1.0,SN123');
      expect(result.deviceInfo?.type).toBe(AnalyzerDriverType.Network);
      expect(result.deviceInfo?.isNetwork).toBe(true);
      expect(mockSocket.connect).toHaveBeenCalledWith(port, host, expect.any(Function));
    });

    it('应该处理TCP连接失败', async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        setTimeout(() => {
          const error = new Error('连接被拒绝');
          mockSocket.on.mock.calls.find(call => call[0] === 'error')?.[1](error);
        }, 0);
        return mockSocket;
      });

      const result = await driver.connect();

      expect(result.success).toBe(false);
      expect(result.error).toContain('连接被拒绝');
    });

    it('应该处理连接超时', async () => {
      mockSocket.connect.mockImplementation(() => {
        // 不调用回调，模拟超时
        return mockSocket;
      });

      const result = await driver.connect({ timeout: 1000 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('连接超时');
    });

    it('应该设置TCP事件监听器', async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        mockSocket.connected = true;
        setTimeout(() => callback(), 0);
        return mockSocket;
      });

      jest.spyOn(driver as any, 'sendNetworkCommand').mockResolvedValue({ success: true, data: 'OK' });

      await driver.connect();

      expect(mockSocket.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
    });
  });

  describe('UDP连接', () => {
    beforeEach(() => {
      driver = new NetworkDriverTemplate(host, port, ProtocolType.UDP);
    });

    it('应该成功建立UDP连接', async () => {
      mockUdpSocket.bind.mockImplementation((callback) => {
        setTimeout(() => callback(), 0);
      });

      jest.spyOn(driver as any, 'sendNetworkCommand').mockResolvedValue({ success: true, data: 'OK' });

      const result = await driver.connect();

      expect(result.success).toBe(true);
      expect(mockUdpSocket.bind).toHaveBeenCalled();
      expect(mockUdpSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockUdpSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('应该处理UDP绑定失败', async () => {
      mockUdpSocket.bind.mockImplementation((callback) => {
        setTimeout(() => callback(new Error('绑定失败')), 0);
      });

      const result = await driver.connect();

      expect(result.success).toBe(false);
      expect(result.error).toContain('绑定失败');
    });
  });

  describe('HTTP连接', () => {
    beforeEach(() => {
      driver = new NetworkDriverTemplate(host, port, ProtocolType.HTTP);
    });

    it('应该成功建立HTTP连接', async () => {
      // Mock HTTP请求成功
      jest.spyOn(driver as any, 'sendHttpRequest').mockResolvedValue({
        success: true,
        data: { status: 'connected', version: 'HTTP-Device v1.0' }
      });

      const result = await driver.connect();

      expect(result.success).toBe(true);
      expect(result.deviceInfo?.name).toContain('HTTP-Device v1.0');
    });

    it('应该处理HTTP连接失败', async () => {
      jest.spyOn(driver as any, 'sendHttpRequest').mockRejectedValue(new Error('HTTP连接失败'));

      const result = await driver.connect();

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP连接失败');
    });
  });

  describe('WebSocket连接', () => {
    beforeEach(() => {
      driver = new NetworkDriverTemplate(host, port, ProtocolType.WEBSOCKET);
    });

    it('应该成功建立WebSocket连接', async () => {
      // Mock WebSocket连接成功
      jest.spyOn(driver as any, 'connectWebSocket').mockResolvedValue(true);
      jest.spyOn(driver as any, 'sendNetworkCommand').mockResolvedValue({ success: true, data: 'OK' });

      const result = await driver.connect();

      expect(result.success).toBe(true);
    });

    it('应该处理WebSocket连接失败', async () => {
      jest.spyOn(driver as any, 'connectWebSocket').mockRejectedValue(new Error('WebSocket连接失败'));

      const result = await driver.connect();

      expect(result.success).toBe(false);
      expect(result.error).toContain('WebSocket连接失败');
    });
  });

  describe('认证处理', () => {
    beforeEach(() => {
      driver = new NetworkDriverTemplate(host, port, ProtocolType.TCP, 'test-token');
    });

    it('应该发送认证令牌', async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        mockSocket.connected = true;
        setTimeout(() => callback(), 0);
        return mockSocket;
      });

      const sendCommandSpy = jest.spyOn(driver as any, 'sendNetworkCommand')
        .mockResolvedValueOnce({ success: true, data: 'AUTH_OK' }) // 认证
        .mockResolvedValue({ success: true, data: 'OK' }); // 其他命令

      await driver.connect();

      expect(sendCommandSpy).toHaveBeenCalledWith('AUTH', { token: 'test-token' });
    });

    it('应该处理认证失败', async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        mockSocket.connected = true;
        setTimeout(() => callback(), 0);
        return mockSocket;
      });

      jest.spyOn(driver as any, 'sendNetworkCommand')
        .mockResolvedValueOnce({ success: false, error: 'Invalid token' });

      const result = await driver.connect();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid token');
    });
  });

  describe('设备断开连接', () => {
    it('应该断开TCP连接', async () => {
      driver = new NetworkDriverTemplate(host, port, ProtocolType.TCP);
      (driver as any)._tcpSocket = mockSocket;
      (driver as any)._isConnected = true;

      await driver.disconnect();

      expect(mockSocket.removeAllListeners).toHaveBeenCalled();
      expect(mockSocket.end).toHaveBeenCalled();
    });

    it('应该断开UDP连接', async () => {
      driver = new NetworkDriverTemplate(host, port, ProtocolType.UDP);
      (driver as any)._udpSocket = mockUdpSocket;
      (driver as any)._isConnected = true;

      await driver.disconnect();

      expect(mockUdpSocket.close).toHaveBeenCalled();
    });

    it('应该在断开前停止采集', async () => {
      (driver as any)._capturing = true;
      const stopCaptureSpy = jest.spyOn(driver, 'stopCapture').mockResolvedValue(true);

      await driver.disconnect();

      expect(stopCaptureSpy).toHaveBeenCalled();
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
      (driver as any)._isConnected = true;
      jest.spyOn(driver as any, 'sendNetworkCommand')
        .mockResolvedValueOnce({ success: true, data: { status: 'READY', voltage: '12V' } });

      const status = await driver.getStatus();

      expect(status.isConnected).toBe(true);
      expect(status.batteryVoltage).toBe('12V');
    });

    it('应该处理状态查询异常', async () => {
      (driver as any)._isConnected = true;
      jest.spyOn(driver as any, 'sendNetworkCommand')
        .mockRejectedValue(new Error('网络错误'));

      const status = await driver.getStatus();

      expect(status.errorStatus).toContain('网络错误');
    });
  });

  describe('数据采集', () => {
    let session: CaptureSession;

    beforeEach(async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        mockSocket.connected = true;
        setTimeout(() => callback(), 0);
        return mockSocket;
      });

      jest.spyOn(driver as any, 'sendNetworkCommand').mockResolvedValue({ success: true, data: 'OK' });
      await driver.connect();

      session = {
        frequency: 10000000,
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

    it('应该验证采集参数', async () => {
      // 超过最大频率
      const invalidSession = {
        ...session,
        frequency: 300000000 // 超过maxFrequency
      };

      const result = await driver.startCapture(invalidSession);
      expect(result).toBe(CaptureError.BadParams);
    });

    it('应该配置网络采集参数', async () => {
      const sendCommandSpy = jest.spyOn(driver as any, 'sendNetworkCommand');

      await driver.startCapture(session);

      expect(sendCommandSpy).toHaveBeenCalledWith('CONFIGURE', {
        frequency: 10000000,
        channels: [0, 1],
        samples: 10000,
        trigger: { type: 0, channel: 0 }
      });
      expect(sendCommandSpy).toHaveBeenCalledWith('START_CAPTURE');
    });

    it('应该处理采集启动失败', async () => {
      jest.spyOn(driver as any, 'sendNetworkCommand')
        .mockRejectedValue(new Error('网络配置失败'));

      const result = await driver.startCapture(session);
      expect(result).toBe(CaptureError.UnexpectedError);
      expect(driver.isCapturing).toBe(false);
    });
  });

  describe('采集监控', () => {
    let session: CaptureSession;

    beforeEach(async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        mockSocket.connected = true;
        setTimeout(() => callback(), 0);
        return mockSocket;
      });

      jest.spyOn(driver as any, 'sendNetworkCommand').mockResolvedValue({ success: true, data: 'OK' });
      await driver.connect();

      session = {
        frequency: 10000000,
        preTriggerSamples: 1000,
        postTriggerSamples: 9000,
        captureChannels: [{ channelNumber: 0, samples: new Uint8Array() }]
      };
    });

    it('应该监控采集进度直到完成', async () => {
      const sendCommandSpy = jest.spyOn(driver as any, 'sendNetworkCommand')
        .mockResolvedValue({ success: true, data: 'OK' })
        .mockResolvedValueOnce({ success: true, data: { status: 'COMPLETE', progress: 100 } }); // STATUS

      const readDataSpy = jest.spyOn(driver as any, 'readNetworkCaptureData').mockResolvedValue();

      await driver.startCapture(session);

      // 等待监控完成
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(readDataSpy).toHaveBeenCalled();
    });

    it('应该处理采集错误状态', async () => {
      jest.spyOn(driver as any, 'sendNetworkCommand')
        .mockResolvedValue({ success: true, data: 'OK' })
        .mockResolvedValueOnce({ success: true, data: { status: 'ERROR', error: 'Hardware fault' } }); // STATUS

      await driver.startCapture(session);

      // 等待错误处理
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(driver.emitCaptureCompleted).toHaveBeenCalledWith({
        success: false,
        session,
        error: 'Hardware fault'
      });
    });

    it('应该处理监控网络异常', async () => {
      jest.spyOn(driver as any, 'sendNetworkCommand')
        .mockResolvedValue({ success: true, data: 'OK' })
        .mockRejectedValueOnce(new Error('网络中断')); // STATUS

      await driver.startCapture(session);

      // 等待异常处理
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(driver.emitCaptureCompleted).toHaveBeenCalledWith({
        success: false,
        session,
        error: expect.stringContaining('网络中断')
      });
    });
  });

  describe('网络数据读取', () => {
    let session: CaptureSession;

    beforeEach(async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        mockSocket.connected = true;
        setTimeout(() => callback(), 0);
        return mockSocket;
      });

      jest.spyOn(driver as any, 'sendNetworkCommand').mockResolvedValue({ success: true, data: 'OK' });
      await driver.connect();

      session = {
        frequency: 10000000,
        preTriggerSamples: 100,
        postTriggerSamples: 900,
        captureChannels: [
          { channelNumber: 0, samples: new Uint8Array() },
          { channelNumber: 1, samples: new Uint8Array() }
        ]
      };
    });

    it('应该成功读取网络采集数据', async () => {
      const mockData = {
        channels: [
          { channel: 0, data: Buffer.from([1, 0, 1, 0, 1]).toString('base64') },
          { channel: 1, data: Buffer.from([0, 1, 0, 1, 0]).toString('base64') }
        ],
        metadata: { samples: 1000, timestamp: Date.now() }
      };

      jest.spyOn(driver as any, 'sendNetworkCommand')
        .mockResolvedValueOnce({ success: true, data: mockData });

      await (driver as any).readNetworkCaptureData(session);

      expect(session.captureChannels[0].samples).toEqual(new Uint8Array([1, 0, 1, 0, 1]));
      expect(session.captureChannels[1].samples).toEqual(new Uint8Array([0, 1, 0, 1, 0]));
      expect(driver.isCapturing).toBe(false);
      expect(driver.emitCaptureCompleted).toHaveBeenCalledWith({
        success: true,
        session
      });
    });

    it('应该处理大数据分块传输', async () => {
      // Mock大数据分块
      const largeData = new Array(1000).fill(0).map((_, i) => i % 2);
      const mockData = {
        channels: [
          { channel: 0, data: Buffer.from(largeData).toString('base64') }
        ],
        metadata: { samples: 1000, chunks: 2 }
      };

      jest.spyOn(driver as any, 'sendNetworkCommand')
        .mockResolvedValueOnce({ success: true, data: mockData });

      session.captureChannels = [{ channelNumber: 0, samples: new Uint8Array() }];

      await (driver as any).readNetworkCaptureData(session);

      expect(session.captureChannels[0].samples).toHaveLength(1000);
    });

    it('应该处理数据读取失败', async () => {
      jest.spyOn(driver as any, 'sendNetworkCommand')
        .mockRejectedValue(new Error('数据传输失败'));

      await (driver as any).readNetworkCaptureData(session);

      expect(driver.emitCaptureCompleted).toHaveBeenCalledWith({
        success: false,
        session,
        error: expect.stringContaining('数据传输失败')
      });
    });
  });

  describe('采集停止', () => {
    beforeEach(async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        mockSocket.connected = true;
        setTimeout(() => callback(), 0);
        return mockSocket;
      });

      jest.spyOn(driver as any, 'sendNetworkCommand').mockResolvedValue({ success: true, data: 'OK' });
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

    it('应该处理停止网络异常', async () => {
      (driver as any)._capturing = true;
      jest.spyOn(driver as any, 'sendNetworkCommand')
        .mockRejectedValue(new Error('网络停止失败'));

      const result = await driver.stopCapture();
      expect(result).toBe(false);
    });
  });

  describe('引导加载程序', () => {
    beforeEach(async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        mockSocket.connected = true;
        setTimeout(() => callback(), 0);
        return mockSocket;
      });

      jest.spyOn(driver as any, 'sendNetworkCommand').mockResolvedValue({ success: true, data: 'OK' });
      await driver.connect();
    });

    it('应该支持网络引导加载程序', async () => {
      jest.spyOn(driver as any, 'sendNetworkCommand')
        .mockResolvedValueOnce({ success: true, data: 'BOOTLOADER_READY' });

      const result = await driver.enterBootloader();
      expect(result).toBe(true);
    });

    it('应该处理引导加载程序失败', async () => {
      jest.spyOn(driver as any, 'sendNetworkCommand')
        .mockRejectedValue(new Error('引导失败'));

      const result = await driver.enterBootloader();
      expect(result).toBe(false);
    });
  });

  describe('网络配置', () => {
    beforeEach(async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        mockSocket.connected = true;
        setTimeout(() => callback(), 0);
        return mockSocket;
      });

      jest.spyOn(driver as any, 'sendNetworkCommand').mockResolvedValue({ success: true, data: 'OK' });
      await driver.connect();
    });

    it('应该支持发送网络配置', async () => {
      const result = await driver.sendNetworkConfig('TestAP', 'password123', '192.168.1.50', 8080);
      expect(result).toBe(true);
    });

    it('应该处理配置发送失败', async () => {
      jest.spyOn(driver as any, 'sendNetworkCommand')
        .mockRejectedValue(new Error('配置失败'));

      const result = await driver.sendNetworkConfig('TestAP', 'password123', '192.168.1.50', 8080);
      expect(result).toBe(false);
    });
  });

  describe('电压状态', () => {
    it('应该查询网络设备电压状态', async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        mockSocket.connected = true;
        setTimeout(() => callback(), 0);
        return mockSocket;
      });

      jest.spyOn(driver as any, 'sendNetworkCommand')
        .mockResolvedValue({ success: true, data: 'OK' })
        .mockResolvedValueOnce({ success: true, data: { voltage: '5.0V' } }); // VOLTAGE查询

      await driver.connect();
      const voltage = await driver.getVoltageStatus();

      expect(voltage).toBe('5.0V');
    });

    it('应该处理电压查询异常', async () => {
      jest.spyOn(driver as any, 'sendNetworkCommand')
        .mockRejectedValue(new Error('查询失败'));

      const voltage = await driver.getVoltageStatus();
      expect(voltage).toBe('ERROR');
    });
  });

  describe('网络命令管理', () => {
    beforeEach(async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        mockSocket.connected = true;
        setTimeout(() => callback(), 0);
        return mockSocket;
      });

      jest.spyOn(driver as any, 'sendNetworkCommand').mockResolvedValue({ success: true, data: 'OK' });
      await driver.connect();
    });

    it('应该发送TCP命令', async () => {
      driver = new NetworkDriverTemplate(host, port, ProtocolType.TCP);
      (driver as any)._tcpSocket = mockSocket;
      (driver as any)._isConnected = true;

      mockSocket.write.mockImplementation((data, callback) => {
        setTimeout(() => callback?.(), 0);
      });

      // Mock响应
      setTimeout(() => {
        const response = JSON.stringify({ id: 1, success: true, data: 'PONG' });
        (driver as any).handleTcpResponse(Buffer.from(response + '\n'));
      }, 50);

      const result = await (driver as any).sendNetworkCommand('PING');
      expect(result.data).toBe('PONG');
    });

    it('应该发送UDP命令', async () => {
      driver = new NetworkDriverTemplate(host, port, ProtocolType.UDP);
      (driver as any)._udpSocket = mockUdpSocket;
      (driver as any)._isConnected = true;

      mockUdpSocket.send.mockImplementation((data, port, host, callback) => {
        setTimeout(() => callback?.(null), 0);
      });

      // Mock响应
      setTimeout(() => {
        const response = JSON.stringify({ id: 1, success: true, data: 'PONG' });
        (driver as any).handleUdpResponse(Buffer.from(response), { address: host, port });
      }, 50);

      const result = await (driver as any).sendNetworkCommand('PING');
      expect(result.data).toBe('PONG');
    });

    it('应该处理命令超时', async () => {
      driver = new NetworkDriverTemplate(host, port, ProtocolType.TCP);
      (driver as any)._tcpSocket = mockSocket;
      (driver as any)._isConnected = true;

      mockSocket.write.mockImplementation((data, callback) => {
        setTimeout(() => callback?.(), 0);
      });

      // 不发送响应，测试超时
      await expect((driver as any).sendNetworkCommand('SLOW', {}, 100))
        .rejects.toThrow('命令超时');
    });
  });

  describe('硬件能力', () => {
    it('应该构建正确的网络硬件能力描述', async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        mockSocket.connected = true;
        setTimeout(() => callback(), 0);
        return mockSocket;
      });

      jest.spyOn(driver as any, 'sendNetworkCommand').mockResolvedValue({ success: true, data: 'OK' });

      const result = await driver.connect();
      const capabilities = result.deviceInfo?.capabilities;

      expect(capabilities).toBeDefined();
      expect(capabilities.channels.digital).toBe(16);
      expect(capabilities.connectivity.interfaces).toEqual(['ethernet']);
      expect(capabilities.connectivity.protocols).toContain('tcp');
      expect(capabilities.features.remoteAccess).toBe(true);
    });
  });

  describe('资源清理', () => {
    it('应该正确清理网络资源', async () => {
      const disconnectSpy = jest.spyOn(driver, 'disconnect').mockResolvedValue();

      driver.dispose();

      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('应该清理待处理的命令', () => {
      (driver as any)._pendingCommands.set(1, {
        resolve: jest.fn(),
        reject: jest.fn(),
        timeout: setTimeout(() => {}, 1000)
      });

      driver.dispose();

      expect((driver as any)._pendingCommands.size).toBe(0);
    });
  });

  describe('边界条件测试', () => {
    it('应该处理无效主机地址', () => {
      const invalidDriver = new NetworkDriverTemplate('', port);
      expect(invalidDriver).toBeDefined();
    });

    it('应该处理无效端口号', () => {
      const invalidDriver = new NetworkDriverTemplate(host, -1);
      expect(invalidDriver).toBeDefined();
    });

    it('应该处理空认证令牌', () => {
      const noAuthDriver = new NetworkDriverTemplate(host, port, ProtocolType.TCP, '');
      expect(noAuthDriver).toBeDefined();
    });

    it('应该处理网络中断', async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        mockSocket.connected = true;
        setTimeout(() => callback(), 0);
        return mockSocket;
      });

      jest.spyOn(driver as any, 'sendNetworkCommand').mockResolvedValue({ success: true, data: 'OK' });
      await driver.connect();

      // 模拟网络中断
      (driver as any).handleNetworkDisconnect();

      expect((driver as any)._isConnected).toBe(false);
    });

    it('应该处理大量并发命令', async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        mockSocket.connected = true;
        setTimeout(() => callback(), 0);
        return mockSocket;
      });

      jest.spyOn(driver as any, 'sendNetworkCommand').mockResolvedValue({ success: true, data: 'OK' });
      await driver.connect();

      // 发送多个并发命令
      const promises = Array.from({ length: 10 }, (_, i) =>
        (driver as any).sendNetworkCommand(`CMD${i}`)
      );

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });

    it('应该处理恶意数据包', () => {
      const maliciousData = Buffer.from('{"id":"invalid","exec":"rm -rf /"}');

      // 应该不执行恶意代码
      expect(() => {
        (driver as any).handleTcpResponse(maliciousData);
      }).not.toThrow();
    });
  });
});