/**
 * 简化的Mock实现 - 基于分析报告的重构建议
 * 遵循：Mock使用不超过每文件5个，简化复杂的手动Mock实现
 */

// 1. VSCode Mock - 最基础版本
export const mockVSCode = {
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
    getConfiguration: jest.fn(() => ({ get: jest.fn() }))
  },
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn()
  },
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn()
  }
};

// 2. 序列端口Mock - 简化版本
export const mockSerialPort = {
  list: jest.fn().mockResolvedValue([
    { path: '/dev/ttyUSB0', manufacturer: 'Test' }
  ]),
  open: jest.fn().mockImplementation((callback) => callback && callback()),
  close: jest.fn().mockImplementation((callback) => callback && callback()),
  write: jest.fn().mockImplementation((data, callback) => callback && callback()),
  on: jest.fn(),
  pipe: jest.fn()
};

// 3. 网络Socket Mock - 简化版本  
export const mockSocket = {
  connect: jest.fn().mockImplementation((port, host, callback) => callback && callback()),
  write: jest.fn().mockReturnValue(true),
  on: jest.fn(),
  destroy: jest.fn()
};

// 4. 文件系统Mock - 简化版本
export const mockFS = {
  readFile: jest.fn().mockImplementation((path, callback) => 
    callback(null, Buffer.from('mock file content'))),
  writeFile: jest.fn().mockImplementation((path, data, callback) => 
    callback && callback()),
  existsSync: jest.fn().mockReturnValue(true)
};

// 5. 硬件驱动Mock - 简化版本
export const mockHardwareDriver = {
  connect: jest.fn().mockResolvedValue({ success: true }),
  disconnect: jest.fn().mockResolvedValue(true),
  startCapture: jest.fn().mockResolvedValue({ success: true }),
  stopCapture: jest.fn().mockResolvedValue(true),
  getDeviceInfo: jest.fn().mockReturnValue({
    name: 'Mock Device',
    channels: 24,
    maxFrequency: 100000000
  })
};

// Mock工厂函数 - 标准化Mock创建
export const createMockAnalyzerDriver = () => mockHardwareDriver;
export const createMockVSCodeAPI = () => mockVSCode;