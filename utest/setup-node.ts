/**
 * Node.js环境测试设置
 * 用于Extension相关的测试
 */

// Mock VSCode API
const mockVSCode = {
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn()
  },
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    createWebviewPanel: jest.fn(),
    registerCustomEditorProvider: jest.fn()
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn(),
      update: jest.fn()
    })),
    onDidChangeConfiguration: jest.fn()
  },
  Uri: {
    file: jest.fn((path) => ({ fsPath: path, scheme: 'file' })),
    parse: jest.fn((uri) => ({ fsPath: uri, scheme: 'file' }))
  },
  ViewColumn: {
    One: 1,
    Two: 2,
    Three: 3
  },
  Disposable: {
    from: jest.fn()
  },
  EventEmitter: class MockEventEmitter {
    private listeners: { [event: string]: Function[] } = {};
    
    on(event: string, listener: Function) {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(listener);
    }
    
    emit(event: string, ...args: any[]) {
      if (this.listeners[event]) {
        this.listeners[event].forEach(listener => listener(...args));
      }
    }
    
    dispose() {
      this.listeners = {};
    }
  }
};

// Mock模块
jest.mock('vscode', () => mockVSCode, { virtual: true });

// Mock serialport
jest.mock('serialport', () => ({
  SerialPort: {
    list: jest.fn(() => Promise.resolve([
      {
        path: '/dev/ttyUSB0',
        manufacturer: 'Raspberry Pi Foundation',
        vendorId: '2E8A',
        productId: '0003'
      },
      {
        path: '/dev/ttyUSB1', 
        manufacturer: 'FTDI',
        vendorId: '0403',
        productId: '6001'
      }
    ]))
  }
}));

// Mock文件系统操作
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(() => [])
}));

// Mock path操作
jest.mock('path', () => ({
  resolve: jest.fn((...paths) => paths.join('/')),
  join: jest.fn((...paths) => paths.join('/')),
  dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/')),
  basename: jest.fn((path) => path.split('/').pop()),
  extname: jest.fn((path) => {
    const parts = path.split('.');
    return parts.length > 1 ? '.' + parts.pop() : '';
  })
}));

// 测试工具函数
export function createMockSerialPort() {
  return {
    open: jest.fn(),
    close: jest.fn(),
    write: jest.fn(),
    on: jest.fn(),
    pipe: jest.fn(),
    isOpen: true
  };
}

export function createMockWebviewPanel() {
  return {
    webview: {
      html: '',
      onDidReceiveMessage: jest.fn(),
      postMessage: jest.fn(),
      options: {}
    },
    onDidDispose: jest.fn(),
    dispose: jest.fn(),
    reveal: jest.fn()
  };
}

// 全局测试数据
export const testData = {
  // 测试用的CaptureSession数据
  sampleCaptureSession: {
    frequency: 24000000,
    preTriggerSamples: 1000,
    postTriggerSamples: 9000,
    loopCount: 0,
    measureBursts: false,
    captureChannels: [
      {
        channelNumber: 0,
        channelName: 'CLK',
        hidden: false,
        channelColor: 0xFF0000
      },
      {
        channelNumber: 1,
        channelName: 'DATA',
        hidden: false,
        channelColor: 0x00FF00
      }
    ],
    triggerType: 'Edge',
    triggerChannel: 0,
    triggerInverted: false,
    triggerBitCount: 1,
    triggerPattern: 0
  },
  
  // 测试用的设备信息
  sampleDeviceInfo: {
    name: 'Test Logic Analyzer V1.0',
    maxFrequency: 100000000,
    blastFrequency: 200000000,
    channels: 24,
    bufferSize: 4 * 1024 * 1024,
    modeLimits: [
      {
        minPreSamples: 2,
        maxPreSamples: 409600,
        minPostSamples: 2,
        maxPostSamples: 4096000
      }
    ]
  },
  
  // 测试用的原始样本数据
  sampleChannelData: new Uint8Array([
    0x00, 0x01, 0x01, 0x00, 0x01, 0x01, 0x00, 0x00,
    0x01, 0x01, 0x00, 0x01, 0x00, 0x00, 0x01, 0x01
  ])
};

// 断言辅助函数
export function expectValidCaptureSession(session: any) {
  expect(session).toBeValidCaptureSession();
  expect(session.frequency).toBeGreaterThan(0);
  expect(session.totalSamples).toBeGreaterThan(0);
}

export function expectValidAnalyzerChannel(channel: any) {
  expect(channel).toBeValidAnalyzerChannel();
  expect(channel.channelNumber).toBeGreaterThanOrEqual(0);
  expect(channel.textualChannelNumber).toMatch(/^Channel \d+$/);
}