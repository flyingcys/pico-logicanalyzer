/**
 * 简化的Mock实现 - 基于分析报告的重构建议
 * 遵循：Mock使用不超过每文件5个，简化复杂的手动Mock实现
 */

// 1. VSCode Mock - 增强版本，支持ConfigurationManager测试
export const mockVSCode = {
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
    getConfiguration: jest.fn(() => ({ 
      get: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined)
    })),
    onDidChangeConfiguration: jest.fn()
  },
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn()
  },
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn()
  },
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3
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
  pipe: jest.fn(),
  emit: jest.fn(),  // 添加emit方法用于事件模拟
  isOpen: false  // 添加isOpen属性用于测试
};

// 3. 网络Socket Mock - 基于真实LogicAnalyzerDriver架构设计
export const mockSocket = {
  connect: jest.fn().mockImplementation((port: number, host: string, callback?: () => void) => {
    // 模拟真实的异步连接过程
    setTimeout(() => {
      callback && callback();
    }, 10);
  }),
  write: jest.fn().mockImplementation((data: Buffer, callback?: (error?: Error) => void) => {
    // 模拟真实的写入过程
    setTimeout(() => {
      callback && callback();
    }, 5);
    return true;
  }),
  on: jest.fn(),
  destroy: jest.fn(),
  emit: jest.fn(),
  pipe: jest.fn(), // 稍后设置返回值以避免循环引用
  readyState: 'closed',
  // 添加模拟设备响应的方法
  mockDeviceResponse: jest.fn().mockImplementation(() => {
    // 模拟真实的设备信息响应格式（基于parseDeviceInfo的需求）
    const responses = [
      'Logic Analyzer v1.2.3',  // 版本信息
      'FREQ:100000000',         // 频率信息，格式必须匹配regFreq
      'BLASTFREQ:200000000',    // 突发频率，格式必须匹配regBlast  
      'BUFFER:96000',           // 缓冲区大小，格式必须匹配regBuf
      'CHANNELS:24'             // 通道数，格式必须匹配regChan
    ];
    
    // 模拟ReadlineParser的行为，逐行发送响应
    const lineParser = mockSocket.pipe.mock.calls[0]?.[0];
    if (lineParser && lineParser.emit) {
      responses.forEach((response, index) => {
        setTimeout(() => {
          lineParser.emit('data', response);
        }, index * 10);
      });
    }
  })
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

// 修复pipe方法的循环引用问题
mockSocket.pipe.mockReturnValue(mockSocket);

// Mock工厂函数 - 标准化Mock创建
export const createMockAnalyzerDriver = () => mockHardwareDriver;
export const createMockVSCodeAPI = () => mockVSCode;