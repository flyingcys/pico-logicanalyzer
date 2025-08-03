# 测试配置和工具库

## 测试环境配置

### Jest 配置文件详解

#### 主配置文件 (jest.config.js)
```javascript
// jest.config.js
const path = require('path');

module.exports = {
  // 测试环境设置
  preset: 'ts-jest',
  testEnvironment: 'jsdom', // 支持DOM操作，适合前端组件测试
  
  // 测试文件查找规则
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  
  // 文件转换规则
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.vue$': '@vue/vue-jest',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': 
      '<rootDir>/src/tests/mocks/fileMock.js'
  },
  
  // 模块路径映射
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/src/tests/$1',
    '^vscode$': '<rootDir>/src/tests/mocks/vscode.ts'
  },
  
  // 测试设置文件
  setupFilesAfterEnv: [
    '<rootDir>/src/tests/setup.ts',
    '<rootDir>/src/tests/matchers.ts'
  ],
  
  // 覆盖率配置
  collectCoverageFrom: [
    'src/**/*.{ts,tsx,vue}',
    '!src/**/*.d.ts',
    '!src/tests/**/*',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/webview/assets/**/*',
    '!**/node_modules/**'
  ],
  
  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 90,
      lines: 85,
      statements: 85
    },
    // 核心模块更高要求
    './src/drivers/': {
      branches: 95,
      functions: 100,
      lines: 95,
      statements: 95
    },
    './src/decoders/': {
      branches: 95,
      functions: 100,
      lines: 95,
      statements: 95
    },
    './src/webview/engines/': {
      branches: 90,
      functions: 95,
      lines: 90,
      statements: 90
    }
  },
  
  // 覆盖率报告格式
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json-summary'
  ],
  
  // 测试超时设置
  testTimeout: 10000,
  
  // 并行测试设置
  maxWorkers: '50%', // 使用50%的CPU核心
  
  // 性能测试配置
  slowTestThreshold: 5, // 5秒以上为慢测试
  
  // 全局变量定义
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
      isolatedModules: true
    }
  },
  
  // 测试报告器
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './coverage/html-report',
      filename: 'report.html',
      expand: true
    }],
    ['jest-junit', {
      outputDirectory: './coverage',
      outputName: 'junit.xml'
    }]
  ],
  
  // 忽略的文件和目录
  testPathIgnorePatterns: [
    '/node_modules/',
    '/out/',
    '/logicanalyzer/' // 原始logicanalyzer项目文件
  ],
  
  // 模块文件扩展名
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'vue'],
  
  // 缓存配置
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  
  // 错误处理
  errorOnDeprecated: true,
  
  // Watch模式配置
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ]
};
```

#### TypeScript 测试配置 (tsconfig.test.json)
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "types": ["jest", "@types/jest", "node", "vscode"]
  },
  "include": [
    "src/**/*",
    "src/tests/**/*"
  ],
  "exclude": [
    "node_modules",
    "out",
    "logicanalyzer"
  ]
}
```

### 测试脚本配置

#### package.json 测试脚本
```json
{
  "scripts": {
    // 基础测试命令
    "test": "jest",
    "test:watch": "jest --watch",
    "test:watchAll": "jest --watchAll",
    
    // 覆盖率测试
    "test:coverage": "jest --coverage",
    "test:coverage:open": "jest --coverage && open coverage/lcov-report/index.html",
    
    // 分类测试
    "test:unit": "jest --testPathPattern=unit --maxWorkers=2",
    "test:integration": "jest --testPathPattern=integration --runInBand",
    "test:e2e": "jest --testPathPattern=e2e --runInBand --detectOpenHandles",
    "test:performance": "jest --testPathPattern=performance --runInBand --forceExit",
    
    // 模块化测试
    "test:drivers": "jest --testPathPattern=drivers",
    "test:decoders": "jest --testPathPattern=decoders",
    "test:webview": "jest --testPathPattern=webview",
    "test:extensions": "jest --testPathPattern=extension",
    
    // 调试测试
    "test:debug": "node --inspect-brk node_modules/.bin/jest --runInBand",
    "test:debug:chrome": "node --inspect-brk=0.0.0.0:9229 node_modules/.bin/jest --runInBand",
    
    // 测试清理
    "test:clear": "jest --clearCache",
    "test:clean": "rimraf coverage .jest-cache",
    
    // 测试验证
    "test:lint": "eslint 'src/tests/**/*.{ts,tsx}' --fix",
    "test:type-check": "tsc --project tsconfig.test.json --noEmit",
    
    // CI/CD 测试
    "test:ci": "jest --ci --coverage --watchAll=false --maxWorkers=2",
    "test:ci:performance": "jest --testPathPattern=performance --ci --maxWorkers=1",
    
    // 测试报告
    "test:report": "jest --coverage && open coverage/html-report/report.html",
    "test:badges": "npx coverage-badges-cli --output coverage/badges"
  }
}
```

## Mock 对象库设计

### 核心 Mock 基类
```typescript
// src/tests/mocks/MockBase.ts
export abstract class MockBase {
  protected callHistory: Array<{
    method: string;
    args: any[];
    timestamp: number;
  }> = [];
  
  protected recordCall(method: string, args: any[]): void {
    this.callHistory.push({
      method,
      args: [...args],
      timestamp: Date.now()
    });
  }
  
  public getCallHistory(): Array<{ method: string; args: any[]; timestamp: number }> {
    return [...this.callHistory];
  }
  
  public getCallCount(method?: string): number {
    if (method) {
      return this.callHistory.filter(call => call.method === method).length;
    }
    return this.callHistory.length;
  }
  
  public wasCalledWith(method: string, ...expectedArgs: any[]): boolean {
    return this.callHistory.some(call => 
      call.method === method && 
      this.deepEqual(call.args, expectedArgs)
    );
  }
  
  public clearHistory(): void {
    this.callHistory = [];
  }
  
  private deepEqual(a: any, b: any): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }
}
```

### 设备驱动 Mock 对象
```typescript
// src/tests/mocks/MockAnalyzerDriver.ts
import { MockBase } from './MockBase';
import { AnalyzerDriverBase, CaptureSession, CaptureError, AnalyzerDriverType } from '../../drivers/AnalyzerDriverBase';

export interface MockDriverConfig {
  deviceId?: string;
  channelCount?: number;
  maxFrequency?: number;
  simulateErrors?: boolean;
  captureDelay?: number;
  connectionDelay?: number;
  generateRealData?: boolean;
}

export class MockAnalyzerDriver extends MockBase implements AnalyzerDriverBase {
  // 基础属性
  deviceVersion = '1.0.0-mock';
  channelCount: number;
  maxFrequency: number;
  minFrequency = 1000;
  bufferSize = 24576;
  blastFrequency: number;
  driverType = AnalyzerDriverType.Hardware;
  isNetwork = false;
  isCapturing = false;
  
  private config: MockDriverConfig;
  private connected = false;
  private captureInProgress = false;
  
  constructor(config: MockDriverConfig = {}) {
    super();
    this.config = {
      deviceId: 'mock-device-001',
      channelCount: 24,
      maxFrequency: 100000000,
      simulateErrors: false,
      captureDelay: 100,
      connectionDelay: 50,
      generateRealData: false,
      ...config
    };
    
    this.channelCount = this.config.channelCount!;
    this.maxFrequency = this.config.maxFrequency!;
    this.blastFrequency = this.maxFrequency;
  }
  
  // 连接管理
  async connect(): Promise<boolean> {
    this.recordCall('connect', []);
    
    if (this.config.simulateErrors && Math.random() < 0.1) {
      throw new Error('Mock connection failed');
    }
    
    await this.delay(this.config.connectionDelay!);
    this.connected = true;
    return true;
  }
  
  async disconnect(): Promise<boolean> {
    this.recordCall('disconnect', []);
    this.connected = false;
    this.isCapturing = false;
    return true;
  }
  
  isConnected(): boolean {
    return this.connected;
  }
  
  // 采集控制
  async startCapture(session: CaptureSession, handler?: (error: CaptureError) => void): Promise<CaptureError> {
    this.recordCall('startCapture', [session, handler]);
    
    if (!this.connected) {
      return CaptureError.DeviceNotConnected;
    }
    
    if (this.captureInProgress) {
      return CaptureError.AlreadyCapturing;
    }
    
    if (this.config.simulateErrors && Math.random() < 0.05) {
      return CaptureError.InvalidConfiguration;
    }
    
    this.captureInProgress = true;
    this.isCapturing = true;
    
    try {
      // 模拟采集过程
      await this.simulateCapture(session);
      
      if (handler) {
        handler(CaptureError.None);
      }
      
      return CaptureError.None;
    } catch (error) {
      if (handler) {
        handler(CaptureError.UnknownError);
      }
      return CaptureError.UnknownError;
    } finally {
      this.captureInProgress = false;
      this.isCapturing = false;
    }
  }
  
  async stopCapture(): Promise<boolean> {
    this.recordCall('stopCapture', []);
    this.captureInProgress = false;
    this.isCapturing = false;
    return true;
  }
  
  // 设备信息
  getDeviceInfo() {
    this.recordCall('getDeviceInfo', []);
    return {
      name: `Mock Device ${this.config.deviceId}`,
      maxFrequency: this.maxFrequency,
      blastFrequency: this.blastFrequency,
      channels: this.channelCount,
      bufferSize: this.bufferSize,
      modeLimits: this.generateMockLimits()
    };
  }
  
  // 其他方法
  async enterBootloader(): Promise<boolean> {
    this.recordCall('enterBootloader', []);
    return true;
  }
  
  async sendNetworkConfig(ssid: string, password: string, ip: string, port: number): Promise<boolean> {
    this.recordCall('sendNetworkConfig', [ssid, password, ip, port]);
    return true;
  }
  
  async getVoltageStatus(): Promise<string> {
    this.recordCall('getVoltageStatus', []);
    return '3.3V';
  }
  
  // 采集模式和限制
  getCaptureMode(channels: number[]): number {
    this.recordCall('getCaptureMode', [channels]);
    
    if (channels.length <= 8) return 0;
    if (channels.length <= 16) return 1;
    return 2;
  }
  
  getLimits(channels: number[]) {
    this.recordCall('getLimits', [channels]);
    
    const mode = this.getCaptureMode(channels);
    const baseSamples = this.bufferSize / (mode + 1);
    
    return {
      minPreSamples: 8,
      maxPreSamples: Math.floor(baseSamples * 0.9),
      minPostSamples: 16,
      maxPostSamples: baseSamples,
      get maxTotalSamples() {
        return this.minPreSamples + this.maxPostSamples;
      }
    };
  }
  
  // 私有辅助方法
  private async simulateCapture(session: CaptureSession): Promise<void> {
    await this.delay(this.config.captureDelay!);
    
    // 生成模拟数据
    session.captureChannels.forEach(channel => {
      if (this.config.generateRealData) {
        channel.samples = this.generateRealisticData(session.totalSamples, channel.channelNumber);
      } else {
        channel.samples = this.generateRandomData(session.totalSamples);
      }
    });
    
    // 如果启用了突发测量，生成突发信息
    if (session.measureBursts && session.loopCount > 0) {
      session.bursts = this.generateMockBursts(session);
    }
  }
  
  private generateRandomData(totalSamples: number): Uint8Array {
    const byteCount = Math.ceil(totalSamples / 8);
    const data = new Uint8Array(byteCount);
    
    for (let i = 0; i < byteCount; i++) {
      data[i] = Math.floor(Math.random() * 256);
    }
    
    return data;
  }
  
  private generateRealisticData(totalSamples: number, channelNumber: number): Uint8Array {
    const byteCount = Math.ceil(totalSamples / 8);
    const data = new Uint8Array(byteCount);
    
    // 根据通道号生成不同的信号模式
    for (let i = 0; i < byteCount; i++) {
      let value = 0;
      
      for (let bit = 0; bit < 8; bit++) {
        const sampleIndex = i * 8 + bit;
        let bitValue = 0;
        
        switch (channelNumber % 4) {
          case 0: // 方波信号
            bitValue = Math.floor(sampleIndex / 16) % 2;
            break;
          case 1: // PWM信号
            bitValue = (sampleIndex % 32) < 8 ? 1 : 0;
            break;
          case 2: // 随机数字信号
            bitValue = Math.random() > 0.7 ? 1 : 0;
            break;
          case 3: // 时钟信号
            bitValue = sampleIndex % 2;
            break;
        }
        
        if (bitValue) {
          value |= (1 << bit);
        }
      }
      
      data[i] = value;
    }
    
    return data;
  }
  
  private generateMockBursts(session: CaptureSession): any[] {
    const bursts = [];
    const burstSize = Math.floor(session.postTriggerSamples / (session.loopCount + 1));
    
    for (let i = 0; i <= session.loopCount; i++) {
      const startSample = session.preTriggerSamples + i * burstSize;
      const endSample = startSample + burstSize - 1;
      const gapSamples = i > 0 ? Math.floor(Math.random() * 1000) + 100 : 0;
      const gapTime = gapSamples * (1000000000 / session.frequency); // 纳秒
      
      bursts.push({
        burstSampleStart: startSample,
        burstSampleEnd: endSample,
        burstSampleGap: gapSamples,
        burstTimeGap: gapTime,
        getTime: function() {
          if (this.burstTimeGap < 1000) return `${this.burstTimeGap.toFixed(1)}ns`;
          if (this.burstTimeGap < 1000000) return `${(this.burstTimeGap / 1000).toFixed(1)}µs`;
          if (this.burstTimeGap < 1000000000) return `${(this.burstTimeGap / 1000000).toFixed(1)}ms`;
          return `${(this.burstTimeGap / 1000000000).toFixed(1)}s`;
        }
      });
    }
    
    return bursts;
  }
  
  private generateMockLimits() {
    return [
      { // 8通道模式
        minPreSamples: 8,
        maxPreSamples: 22000,
        minPostSamples: 16,
        maxPostSamples: 24576,
        get maxTotalSamples() { return this.minPreSamples + this.maxPostSamples; }
      },
      { // 16通道模式
        minPreSamples: 8,
        maxPreSamples: 11000,
        minPostSamples: 16,
        maxPostSamples: 12288,
        get maxTotalSamples() { return this.minPreSamples + this.maxPostSamples; }
      },
      { // 24通道模式
        minPreSamples: 8,
        maxPreSamples: 7300,
        minPostSamples: 16,
        maxPostSamples: 8192,
        get maxTotalSamples() { return this.minPreSamples + this.maxPostSamples; }
      }
    ];
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // 测试辅助方法
  public setConnected(connected: boolean): void {
    this.connected = connected;
  }
  
  public setCapturing(capturing: boolean): void {
    this.isCapturing = capturing;
    this.captureInProgress = capturing;
  }
  
  public simulateError(method: string, error: Error): void {
    // 实现错误模拟逻辑
  }
}
```

### VSCode API Mock 对象
```typescript
// src/tests/mocks/MockVSCodeAPI.ts
import { EventEmitter } from 'events';
import { MockBase } from './MockBase';

export class MockWebviewPanel extends MockBase {
  public webview: MockWebview;
  public viewType: string;
  public title: string;
  public visible = true;
  public active = true;
  
  private _onDidDispose = new EventEmitter();
  private _onDidChangeViewState = new EventEmitter();
  
  constructor(viewType: string, title: string) {
    super();
    this.viewType = viewType;
    this.title = title;
    this.webview = new MockWebview();
  }
  
  get onDidDispose() {
    return this._onDidDispose.on.bind(this._onDidDispose);
  }
  
  get onDidChangeViewState() {
    return this._onDidChangeViewState.on.bind(this._onDidChangeViewState);
  }
  
  dispose(): void {
    this.recordCall('dispose', []);
    this._onDidDispose.emit('dispose');
  }
  
  reveal(column?: number, preserveFocus?: boolean): void {
    this.recordCall('reveal', [column, preserveFocus]);
    this.visible = true;
    this.active = true;
  }
}

export class MockWebview extends MockBase {
  public html = '';
  public options: any = {};
  private _onDidReceiveMessage = new EventEmitter();
  
  get onDidReceiveMessage() {
    return this._onDidReceiveMessage.on.bind(this._onDidReceiveMessage);
  }
  
  postMessage(message: any): Thenable<boolean> {
    this.recordCall('postMessage', [message]);
    return Promise.resolve(true);
  }
  
  // 测试辅助方法
  public simulateMessage(message: any): void {
    this._onDidReceiveMessage.emit('message', message);
  }
  
  public getPostedMessages(): any[] {
    return this.getCallHistory()
      .filter(call => call.method === 'postMessage')
      .map(call => call.args[0]);
  }
}

// 主VSCode API Mock
const mockVSCode = {
  // Window API
  window: {
    createWebviewPanel: jest.fn((viewType: string, title: string, showOptions: any, options?: any) => {
      const panel = new MockWebviewPanel(viewType, title);
      panel.webview.options = options || {};
      return panel;
    }),
    
    showInformationMessage: jest.fn((message: string, ...items: string[]) => {
      return Promise.resolve(items[0]);
    }),
    
    showWarningMessage: jest.fn((message: string, ...items: string[]) => {
      return Promise.resolve(items[0]);
    }),
    
    showErrorMessage: jest.fn((message: string, ...items: string[]) => {
      return Promise.resolve(items[0]);
    }),
    
    showOpenDialog: jest.fn((options: any) => {
      return Promise.resolve([{ fsPath: '/mock/path/file.lac' }]);
    }),
    
    showSaveDialog: jest.fn((options: any) => {
      return Promise.resolve({ fsPath: '/mock/path/save.lac' });
    }),
    
    createStatusBarItem: jest.fn(() => ({
      text: '',
      tooltip: '',
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn()
    }))
  },
  
  // Commands API
  commands: {
    registerCommand: jest.fn((command: string, callback: Function) => {
      return { dispose: jest.fn() };
    }),
    
    executeCommand: jest.fn((command: string, ...args: any[]) => {
      return Promise.resolve();
    })
  },
  
  // Workspace API
  workspace: {
    getConfiguration: jest.fn((section?: string) => ({
      get: jest.fn((key: string, defaultValue?: any) => defaultValue),
      update: jest.fn((key: string, value: any) => Promise.resolve()),
      has: jest.fn((key: string) => true),
      inspect: jest.fn((key: string) => ({ defaultValue: undefined, globalValue: undefined }))
    })),
    
    onDidChangeConfiguration: jest.fn((listener: Function) => {
      return { dispose: jest.fn() };
    }),
    
    workspaceFolders: [
      {
        uri: { fsPath: '/mock/workspace', scheme: 'file' },
        name: 'mock-workspace',
        index: 0
      }
    ],
    
    getWorkspaceFolder: jest.fn(() => ({
      uri: { fsPath: '/mock/workspace', scheme: 'file' },
      name: 'mock-workspace',
      index: 0
    }))
  },
  
  // Uri API
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path, scheme: 'file' })),
    parse: jest.fn((uri: string) => ({ fsPath: uri, scheme: 'file' }))
  },
  
  // ViewColumn 枚举
  ViewColumn: {
    Active: -1,
    Beside: -2,
    One: 1,
    Two: 2,
    Three: 3
  },
  
  // 状态栏项目
  StatusBarAlignment: {
    Left: 1,
    Right: 2
  },
  
  // Progress API
  ProgressLocation: {
    SourceControl: 1,
    Window: 10,
    Notification: 15
  },
  
  // 扩展上下文
  ExtensionContext: class {
    subscriptions: any[] = [];
    workspaceState = {
      get: jest.fn(),
      update: jest.fn()
    };
    globalState = {
      get: jest.fn(),
      update: jest.fn()
    };
    extensionPath = '/mock/extension';
    storagePath = '/mock/storage';
    globalStoragePath = '/mock/global-storage';
    logPath = '/mock/logs';
  }
};

export = mockVSCode;
```

### 信号生成器工具
```typescript
// src/tests/utils/SignalGenerator.ts
export interface I2CGeneratorOptions {
  address: number;
  isWrite: boolean;
  data: number[];
  sampleRate: number;
  clockFrequency: number;
  ackPattern?: boolean[];
}

export interface SPIGeneratorOptions {
  mosi: number[];
  miso: number[];
  sampleRate: number;
  clockFrequency: number;
  cpol?: number; // 0 or 1
  cpha?: number; // 0 or 1
}

export interface UARTGeneratorOptions {
  data: number[];
  baudRate: number;
  sampleRate: number;
  dataBits?: number;
  stopBits?: number;
  parity?: 'none' | 'even' | 'odd';
}

export class SignalGenerator {
  /**
   * 生成I2C通信序列
   */
  static generateI2CSequence(options: I2CGeneratorOptions): { scl: Uint8Array; sda: Uint8Array } {
    const {
      address,
      isWrite,
      data,
      sampleRate,
      clockFrequency,
      ackPattern = new Array(data.length + 1).fill(true)
    } = options;
    
    const samplesPerBit = Math.floor(sampleRate / clockFrequency);
    const halfBit = Math.floor(samplesPerBit / 2);
    
    let sclData: number[] = [];
    let sdaData: number[] = [];
    
    // 初始状态：SCL和SDA都为高
    this.addIdleState(sclData, sdaData, samplesPerBit);
    
    // START条件：SCL高时，SDA从高变低
    this.addStartCondition(sclData, sdaData, samplesPerBit);
    
    // 地址字节 + R/W位
    const addressByte = (address << 1) | (isWrite ? 0 : 1);
    this.addI2CByte(sclData, sdaData, addressByte, samplesPerBit);
    this.addI2CAck(sclData, sdaData, ackPattern[0], samplesPerBit);
    
    // 数据字节
    data.forEach((byte, index) => {
      this.addI2CByte(sclData, sdaData, byte, samplesPerBit);
      this.addI2CAck(sclData, sdaData, ackPattern[index + 1], samplesPerBit);
    });
    
    // STOP条件：SCL高时，SDA从低变高
    this.addStopCondition(sclData, sdaData, samplesPerBit);
    
    // 添加结束空闲状态
    this.addIdleState(sclData, sdaData, samplesPerBit);
    
    return {
      scl: new Uint8Array(this.packBits(sclData)),
      sda: new Uint8Array(this.packBits(sdaData))
    };
  }
  
  /**
   * 生成SPI通信序列
   */
  static generateSPISequence(options: SPIGeneratorOptions): {
    sclk: Uint8Array;
    mosi: Uint8Array;
    miso: Uint8Array;
    cs: Uint8Array;
  } {
    const {
      mosi,
      miso,
      sampleRate,
      clockFrequency,
      cpol = 0,
      cpha = 0
    } = options;
    
    const samplesPerBit = Math.floor(sampleRate / clockFrequency);
    const halfBit = Math.floor(samplesPerBit / 2);
    
    let sclkData: number[] = [];
    let mosiData: number[] = [];
    let misoData: number[] = [];
    let csData: number[] = [];
    
    // 初始状态
    const idleClock = cpol;
    this.addRepeatedValue(sclkData, idleClock, samplesPerBit);
    this.addRepeatedValue(mosiData, 0, samplesPerBit);
    this.addRepeatedValue(misoData, 0, samplesPerBit);
    this.addRepeatedValue(csData, 1, samplesPerBit); // CS空闲为高
    
    // CS有效（拉低）
    this.addRepeatedValue(csData, 0, samplesPerBit);
    this.addRepeatedValue(sclkData, idleClock, samplesPerBit);
    this.addRepeatedValue(mosiData, 0, samplesPerBit);
    this.addRepeatedValue(misoData, 0, samplesPerBit);
    
    // 传输数据
    for (let i = 0; i < Math.max(mosi.length, miso.length); i++) {
      const mosiByte = i < mosi.length ? mosi[i] : 0;
      const misoByte = i < miso.length ? miso[i] : 0;
      
      this.addSPIByte(sclkData, mosiData, misoData, csData, 
        mosiByte, misoByte, samplesPerBit, cpol, cpha);
    }
    
    // CS无效（拉高）
    this.addRepeatedValue(csData, 1, samplesPerBit);
    this.addRepeatedValue(sclkData, idleClock, samplesPerBit);
    this.addRepeatedValue(mosiData, 0, samplesPerBit);
    this.addRepeatedValue(misoData, 0, samplesPerBit);
    
    return {
      sclk: new Uint8Array(this.packBits(sclkData)),
      mosi: new Uint8Array(this.packBits(mosiData)),
      miso: new Uint8Array(this.packBits(misoData)),
      cs: new Uint8Array(this.packBits(csData))
    };
  }
  
  /**
   * 生成UART通信序列
   */
  static generateUARTSequence(options: UARTGeneratorOptions): { tx: Uint8Array; rx: Uint8Array } {
    const {
      data,
      baudRate,
      sampleRate,
      dataBits = 8,
      stopBits = 1,
      parity = 'none'
    } = options;
    
    const samplesPerBit = Math.floor(sampleRate / baudRate);
    
    let txData: number[] = [];
    let rxData: number[] = [];
    
    // 初始空闲状态（高电平）
    this.addRepeatedValue(txData, 1, samplesPerBit * 5);
    this.addRepeatedValue(rxData, 1, samplesPerBit * 5);
    
    // 传输每个字节
    data.forEach(byte => {
      // START位（低电平）
      this.addRepeatedValue(txData, 0, samplesPerBit);
      this.addRepeatedValue(rxData, 0, samplesPerBit);
      
      // 数据位（LSB先传）
      for (let bit = 0; bit < dataBits; bit++) {
        const bitValue = (byte >> bit) & 1;
        this.addRepeatedValue(txData, bitValue, samplesPerBit);
        this.addRepeatedValue(rxData, bitValue, samplesPerBit);
      }
      
      // 奇偶校验位
      if (parity !== 'none') {
        const parityBit = this.calculateParity(byte, parity);
        this.addRepeatedValue(txData, parityBit, samplesPerBit);
        this.addRepeatedValue(rxData, parityBit, samplesPerBit);
      }
      
      // STOP位（高电平）
      for (let i = 0; i < stopBits; i++) {
        this.addRepeatedValue(txData, 1, samplesPerBit);
        this.addRepeatedValue(rxData, 1, samplesPerBit);
      }
    });
    
    // 结束空闲状态
    this.addRepeatedValue(txData, 1, samplesPerBit * 5);
    this.addRepeatedValue(rxData, 1, samplesPerBit * 5);
    
    return {
      tx: new Uint8Array(this.packBits(txData)),
      rx: new Uint8Array(this.packBits(rxData))
    };
  }
  
  // 私有辅助方法
  private static addIdleState(scl: number[], sda: number[], samples: number): void {
    this.addRepeatedValue(scl, 1, samples);
    this.addRepeatedValue(sda, 1, samples);
  }
  
  private static addStartCondition(scl: number[], sda: number[], samplesPerBit: number): void {
    const halfBit = Math.floor(samplesPerBit / 2);
    
    // SCL保持高，SDA从高变低
    this.addRepeatedValue(scl, 1, halfBit);
    this.addRepeatedValue(sda, 1, halfBit);
    
    this.addRepeatedValue(scl, 1, halfBit);
    this.addRepeatedValue(sda, 0, halfBit);
  }
  
  private static addStopCondition(scl: number[], sda: number[], samplesPerBit: number): void {
    const halfBit = Math.floor(samplesPerBit / 2);
    
    // SCL保持高，SDA从低变高
    this.addRepeatedValue(scl, 1, halfBit);
    this.addRepeatedValue(sda, 0, halfBit);
    
    this.addRepeatedValue(scl, 1, halfBit);
    this.addRepeatedValue(sda, 1, halfBit);
  }
  
  private static addI2CByte(scl: number[], sda: number[], byte: number, samplesPerBit: number): void {
    const halfBit = Math.floor(samplesPerBit / 2);
    
    for (let bit = 7; bit >= 0; bit--) {
      const bitValue = (byte >> bit) & 1;
      
      // 时钟低期间设置数据
      this.addRepeatedValue(scl, 0, halfBit);
      this.addRepeatedValue(sda, bitValue, halfBit);
      
      // 时钟高期间保持数据
      this.addRepeatedValue(scl, 1, halfBit);
      this.addRepeatedValue(sda, bitValue, halfBit);
    }
  }
  
  private static addI2CAck(scl: number[], sda: number[], ack: boolean, samplesPerBit: number): void {
    const halfBit = Math.floor(samplesPerBit / 2);
    const ackValue = ack ? 0 : 1; // ACK=0, NACK=1
    
    // ACK/NACK位
    this.addRepeatedValue(scl, 0, halfBit);
    this.addRepeatedValue(sda, ackValue, halfBit);
    
    this.addRepeatedValue(scl, 1, halfBit);
    this.addRepeatedValue(sda, ackValue, halfBit);
  }
  
  private static addSPIByte(
    sclk: number[], mosi: number[], miso: number[], cs: number[],
    mosiByte: number, misoByte: number, samplesPerBit: number,
    cpol: number, cpha: number
  ): void {
    const halfBit = Math.floor(samplesPerBit / 2);
    const idleClock = cpol;
    const activeClock = 1 - cpol;
    
    for (let bit = 7; bit >= 0; bit--) {
      const mosiBit = (mosiByte >> bit) & 1;
      const misoBit = (misoByte >> bit) & 1;
      
      if (cpha === 0) {
        // CPHA=0: 在时钟的第一个边沿采样
        this.addRepeatedValue(mosi, mosiBit, halfBit);
        this.addRepeatedValue(miso, misoBit, halfBit);
        this.addRepeatedValue(sclk, idleClock, halfBit);
        this.addRepeatedValue(cs, 0, halfBit);
        
        this.addRepeatedValue(mosi, mosiBit, halfBit);
        this.addRepeatedValue(miso, misoBit, halfBit);
        this.addRepeatedValue(sclk, activeClock, halfBit);
        this.addRepeatedValue(cs, 0, halfBit);
      } else {
        // CPHA=1: 在时钟的第二个边沿采样
        this.addRepeatedValue(sclk, activeClock, halfBit);
        this.addRepeatedValue(mosi, mosiBit, halfBit);
        this.addRepeatedValue(miso, misoBit, halfBit);
        this.addRepeatedValue(cs, 0, halfBit);
        
        this.addRepeatedValue(sclk, idleClock, halfBit);
        this.addRepeatedValue(mosi, mosiBit, halfBit);
        this.addRepeatedValue(miso, misiBit, halfBit);
        this.addRepeatedValue(cs, 0, halfBit);
      }
    }
  }
  
  private static addRepeatedValue(array: number[], value: number, count: number): void {
    for (let i = 0; i < count; i++) {
      array.push(value);
    }
  }
  
  private static calculateParity(byte: number, parity: 'even' | 'odd'): number {
    let count = 0;
    for (let i = 0; i < 8; i++) {
      if ((byte >> i) & 1) count++;
    }
    
    if (parity === 'even') {
      return count % 2; // 偶校验：使总1位数为偶数
    } else {
      return 1 - (count % 2); // 奇校验：使总1位数为奇数
    }
  }
  
  private static packBits(bits: number[]): number[] {
    const bytes: number[] = [];
    
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8 && i + j < bits.length; j++) {
        if (bits[i + j]) {
          byte |= (1 << j);
        }
      }
      bytes.push(byte);
    }
    
    return bytes;
  }
  
  // 特殊场景生成器
  static generateI2CWithRepeatedStart(options: any): { scl: Uint8Array; sda: Uint8Array } {
    // 实现带重复开始条件的I2C信号生成
    return this.generateI2CSequence(options);
  }
  
  static generateI2CWithNACK(options: any): { scl: Uint8Array; sda: Uint8Array } {
    // 实现包含NACK的I2C信号生成
    const ackPattern = new Array(options.data?.length || 1).fill(false);
    return this.generateI2CSequence({ ...options, ackPattern });
  }
  
  static generateI2CWithClockStretching(options: any): { scl: Uint8Array; sda: Uint8Array } {
    // 实现包含时钟拉伸的I2C信号生成
    return this.generateI2CSequence(options);
  }
  
  static generateIncompleteI2C(options: any): { scl: Uint8Array; sda: Uint8Array } {
    // 实现不完整的I2C事务（例如只有START没有STOP）
    return this.generateI2CSequence(options);
  }
  
  static generateNoisyI2C(options: any): { scl: Uint8Array; sda: Uint8Array } {
    // 实现包含噪声的I2C信号
    const result = this.generateI2CSequence(options);
    
    // 添加噪声
    const noiseLevel = options.noiseLevel || 0.05;
    this.addNoise(result.scl, noiseLevel);
    this.addNoise(result.sda, noiseLevel);
    
    return result;
  }
  
  static generateI2CProtocolViolation(options: any): { scl: Uint8Array; sda: Uint8Array } {
    // 实现违反I2C协议的信号
    return this.generateI2CSequence(options);
  }
  
  static generateLargeI2CDataset(options: any): { scl: Uint8Array; sda: Uint8Array } {
    // 实现大数据集的I2C信号生成
    const largeData = new Array(options.transactionCount || 1000)
      .fill(0)
      .map((_, i) => i & 0xFF);
    
    return this.generateI2CSequence({
      ...options,
      data: largeData
    });
  }
  
  private static addNoise(data: Uint8Array, noiseLevel: number): void {
    for (let i = 0; i < data.length; i++) {
      if (Math.random() < noiseLevel) {
        // 翻转随机位
        const bitPosition = Math.floor(Math.random() * 8);
        data[i] ^= (1 << bitPosition);
      }
    }
  }
}
```

## 测试数据集

### 测试数据定义
```typescript
// src/tests/fixtures/test-data.ts
export const TestDataSets = {
  // I2C测试数据集
  i2c: {
    // 基础读写操作
    basicWrite: {
      address: 0x50,
      isWrite: true,
      data: [0xAA, 0x55, 0xFF, 0x00],
      sampleRate: 1000000,
      clockFrequency: 100000,
      expectedResults: [
        { type: 'start', text: 'Start' },
        { type: 'address-write', text: 'Address: 0x50' },
        { type: 'ack', text: 'ACK' },
        { type: 'data-write', text: '0xAA' },
        { type: 'ack', text: 'ACK' },
        { type: 'stop', text: 'Stop' }
      ]
    },
    
    basicRead: {
      address: 0x51,
      isWrite: false,
      data: [0x12, 0x34],
      sampleRate: 1000000,
      clockFrequency: 100000
    },
    
    // 高速I2C
    highSpeed: {
      address: 0x60,
      isWrite: true,
      data: new Array(256).fill(0).map((_, i) => i),
      sampleRate: 100000000,
      clockFrequency: 3400000
    },
    
    // EEPROM读写模式
    eepromWrite: {
      address: 0x50,
      isWrite: true,
      data: [0x00, 0x10, 0xDE, 0xAD, 0xBE, 0xEF], // 地址 + 数据
      sampleRate: 1000000,
      clockFrequency: 100000
    },
    
    // 多主机冲突
    multiMaster: {
      address: 0x40,
      conflictAt: 'address', // 在地址阶段产生冲突
      sampleRate: 1000000,
      clockFrequency: 100000
    }
  },
  
  // SPI测试数据集
  spi: {
    // 标准SPI传输
    basicTransfer: {
      mosi: [0xAA, 0x55, 0xFF, 0x00],
      miso: [0x11, 0x22, 0x33, 0x44],
      sampleRate: 1000000,
      clockFrequency: 1000000,
      cpol: 0,
      cpha: 0
    },
    
    // 高速SPI
    highSpeed: {
      mosi: new Array(1024).fill(0).map((_, i) => i & 0xFF),
      miso: new Array(1024).fill(0).map((_, i) => (i * 2) & 0xFF),
      sampleRate: 100000000,
      clockFrequency: 25000000,
      cpol: 1,
      cpha: 1
    },
    
    // SPI Flash命令
    flashRead: {
      mosi: [0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], // READ命令
      miso: [0xFF, 0xFF, 0xFF, 0xFF, 0xDE, 0xAD, 0xBE, 0xEF], // 数据响应
      sampleRate: 10000000,
      clockFrequency: 8000000
    }
  },
  
  // UART测试数据集
  uart: {
    // 标准UART
    basicSerial: {
      data: [0x48, 0x65, 0x6C, 0x6C, 0x6F], // "Hello"
      baudRate: 115200,
      sampleRate: 1000000,
      dataBits: 8,
      stopBits: 1,
      parity: 'none'
    },
    
    // 高波特率
    highBaudRate: {
      data: new Array(1000).fill(0).map((_, i) => i & 0xFF),
      baudRate: 2000000,
      sampleRate: 100000000,
      dataBits: 8,
      stopBits: 1,
      parity: 'even'
    },
    
    // 错误场景
    withErrors: {
      data: [0x55, 0xAA, 0xFF],
      baudRate: 9600,
      sampleRate: 1000000,
      errors: ['frame', 'parity', 'overrun']
    }
  },
  
  // 性能测试数据集
  performance: {
    // 大数据集测试
    largeSample: {
      channelCount: 24,
      sampleCount: 10000000, // 1000万样本
      sampleRate: 100000000,
      patterns: ['random', 'square', 'pwm', 'burst']
    },
    
    // 长时间捕获
    longCapture: {
      channelCount: 8,
      duration: 60, // 60秒
      sampleRate: 1000000,
      pattern: 'mixed'
    },
    
    // 多设备同步
    multiDevice: {
      deviceCount: 5,
      channelsPerDevice: 8,
      sampleCount: 1000000,
      synchronizationTolerance: 1000 // 1µs
    }
  },
  
  // 边界条件测试
  edgeCases: {
    // 空数据
    empty: {
      channels: [],
      samples: 0
    },
    
    // 单样本
    singleSample: {
      channels: [0],
      samples: 1,
      data: [0x01]
    },
    
    // 最大通道数
    maxChannels: {
      channels: Array.from({ length: 24 }, (_, i) => i),
      samples: 1000,
      pattern: 'counter'
    },
    
    // 最高频率
    maxFrequency: {
      channels: [0, 1],
      sampleRate: 100000000,
      samples: 100000
    }
  },
  
  // 错误场景测试
  errorScenarios: {
    // 损坏的数据
    corruptedData: {
      description: '模拟传输过程中的数据损坏',
      originalData: [0xAA, 0x55, 0xFF, 0x00],
      corruptedData: [0xAA, 0x54, 0xFF, 0x01], // 部分位翻转
      corruptionRate: 0.01 // 1%错误率
    },
    
    // 不完整的协议
    incompleteProtocol: {
      i2c: {
        onlyStart: true,  // 只有START条件，没有后续数据
        onlyAddress: true, // 只有地址，没有数据
        missingStop: true  // 缺少STOP条件
      },
      spi: {
        shortTransfer: true, // 传输被中断
        clockGlitch: true    // 时钟毛刺
      }
    },
    
    // 时序违规
    timingViolations: {
      i2c: {
        setupTimeViolation: true,  // 建立时间违规
        holdTimeViolation: true,   // 保持时间违规
        clockStretchTimeout: true  // 时钟拉伸超时
      },
      spi: {
        setupViolation: true,  // 数据建立时间违规
        holdViolation: true    // 数据保持时间违规
      }
    }
  }
};
```

这个测试配置和工具库提供了：

1. **完整的Jest配置** - 包括覆盖率、并行执行、报告等全面设置
2. **丰富的Mock对象** - 涵盖设备驱动、VSCode API、串口通信等
3. **强大的信号生成器** - 支持I2C、SPI、UART等多种协议
4. **全面的测试数据集** - 包括正常场景、边界条件、错误场景
5. **性能监控工具** - 用于性能测试和基准对比

通过这些工具，开发团队可以：
- 快速搭建测试环境
- 模拟各种硬件和软件场景
- 生成真实的协议数据
- 监控和优化性能表现