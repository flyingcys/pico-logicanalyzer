/**
 * 硬件驱动管理器模拟
 */

const mockHardwareDriverManager = {
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
  registerDriver: jest.fn(),
  unregisterDriver: jest.fn()
};

module.exports = {
  hardwareDriverManager: mockHardwareDriverManager
};