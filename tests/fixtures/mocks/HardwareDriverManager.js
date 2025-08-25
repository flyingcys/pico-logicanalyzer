/**
 * 硬件驱动管理器模拟 - 有状态版本
 */

// 初始驱动列表
let registeredDrivers = [
  {
    id: 'pico-logic-analyzer',
    name: 'Pico Logic Analyzer',
    description: 'Mock driver for testing',
    version: '1.0.0',
    priority: 100,
    supportedDevices: ['serial', 'network']
  },
  {
    id: 'saleae-logic',
    name: 'Saleae Logic',
    description: 'Mock Saleae driver',
    version: '1.0.0',
    priority: 90,
    supportedDevices: ['usb']
  },
  {
    id: 'rigol-siglent',
    name: 'Rigol/Siglent',
    description: 'Mock Rigol/Siglent driver',
    version: '1.0.0',
    priority: 80,
    supportedDevices: ['network']
  },
  {
    id: 'sigrok-adapter',
    name: 'Sigrok Adapter',
    description: 'Mock Sigrok adapter',
    version: '1.0.0',
    priority: 70,
    supportedDevices: ['usb']
  },
  {
    id: 'network-analyzer',
    name: 'Network Logic Analyzer',
    description: 'Mock network analyzer',
    version: '1.0.0',
    priority: 60,
    supportedDevices: ['network']
  }
];

const mockHardwareDriverManager = {
  // 现有方法
  detectHardware: jest.fn().mockResolvedValue([]),
  connectToDevice: jest.fn().mockResolvedValue({
    success: true,
    deviceInfo: { name: 'Mock Device' }
  }),
  dispose: jest.fn().mockResolvedValue(undefined),
  isConnected: jest.fn().mockReturnValue(false),
  getConnectedDevice: jest.fn().mockReturnValue(null),
  startCapture: jest.fn().mockResolvedValue({ success: true }),
  stopCapture: jest.fn().mockResolvedValue({ success: true }),
  getAvailableDrivers: jest.fn().mockReturnValue([]),
  registerDriver: jest.fn().mockImplementation((driver) => {
    // 真正添加到驱动列表
    registeredDrivers.push(driver);
    return true;
  }),
  unregisterDriver: jest.fn().mockImplementation((driverId) => {
    // 真正从驱动列表中移除
    const index = registeredDrivers.findIndex(d => d.id === driverId);
    if (index >= 0) {
      registeredDrivers.splice(index, 1);
      return true;
    }
    return false;
  }),
  
  // 缺少的方法
  matchDriver: jest.fn().mockReturnValue(null),
  createDriver: jest.fn().mockReturnValue(null),
  disconnectCurrentDevice: jest.fn().mockResolvedValue({ success: true }),
  
  // 测试期望的方法 - 返回当前状态
  getRegisteredDrivers: jest.fn().mockImplementation(() => {
    // 按优先级排序返回
    return [...registeredDrivers].sort((a, b) => b.priority - a.priority);
  }),
  
  // 设备连接管理方法
  isDeviceConnected: jest.fn().mockReturnValue(false),
  getCurrentDevice: jest.fn().mockReturnValue(null),
  getCurrentDeviceInfo: jest.fn().mockReturnValue(null),
  getActiveConnections: jest.fn().mockReturnValue(new Map()),
  
  // 多设备驱动方法
  createMultiDeviceDriver: jest.fn().mockImplementation((connectionStrings) => {
    if (!connectionStrings || connectionStrings.length < 2) {
      throw new Error('多设备驱动需要2-5个连接字符串');
    }
    if (connectionStrings.length > 5) {
      throw new Error('多设备驱动需要2-5个连接字符串');
    }
    return { type: 'multi', connections: connectionStrings };
  }),
  
  // Sigrok支持方法
  getSupportedSigrokDevices: jest.fn().mockReturnValue([
    { driver: 'fx2lafw', name: 'fx2lafw', channels: 16, maxRate: 24000000 }
  ])
};

// Mock类定义
class MockHardwareDriverManager {
  constructor() {
    Object.assign(this, mockHardwareDriverManager);
  }
}

class MockSerialDetector {
  async detect() {
    return [];
  }
}

class MockNetworkDetector {
  async detect() {
    return [];
  }
}

class MockSaleaeDetector {
  async detect() {
    return [];
  }
}

class MockSigrokDetector {
  async detect() {
    return [];
  }
}

class MockRigolSiglentDetector {
  async detect() {
    return [];
  }
}

// 创建一个真正的MockHardwareDriverManager实例
const mockInstance = new MockHardwareDriverManager();

module.exports = {
  hardwareDriverManager: mockInstance,
  HardwareDriverManager: MockHardwareDriverManager,
  SerialDetector: MockSerialDetector,
  NetworkDetector: MockNetworkDetector,
  SaleaeDetector: MockSaleaeDetector,
  SigrokDetector: MockSigrokDetector,
  RigolSiglentDetector: MockRigolSiglentDetector
};