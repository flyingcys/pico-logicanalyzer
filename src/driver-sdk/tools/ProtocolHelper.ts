/**
 * 协议帮助工具
 * 提供常见通信协议的实现助手函数和逻辑分析器协议解码功能
 */

/**
 * 协议定义接口
 */
export interface ProtocolDefinition {
  name: string;
  version: string;
  commands: {
    [commandName: string]: {
      opcode: number;
      parameters: string[];
    };
  };
  responses: {
    [responseName: string]: {
      code: number;
      format: string;
    };
  };
}

/**
 * 协议处理器接口
 */
export interface ProtocolHandler {
  handleCommand(command: string, parameters: any[]): Promise<any>;
  handleResponse(response: any): any;
}

/**
 * 命令构建器接口
 */
export interface CommandBuilder {
  setCommand(command: string): this;
  addParameter(name: string, value: any): this;
  build(): Buffer | string;
}

/**
 * 响应解析器接口
 */
export interface ResponseParser {
  parse(data: Buffer | string): {
    success: boolean;
    data?: any;
    error?: string;
  };
}

/**
 * 串口协议配置
 */
export interface SerialConfig {
  baudRate: number;
  dataBits: 7 | 8;
  stopBits: 1 | 2;
  parity: 'none' | 'even' | 'odd' | 'mark' | 'space';
  flowControl: 'none' | 'hardware' | 'software';
  timeout: number;
}

/**
 * TCP/UDP网络配置
 */
export interface NetworkConfig {
  host: string;
  port: number;
  timeout: number;
  keepAlive?: boolean;
  noDelay?: boolean;
  family?: 4 | 6; // IPv4 or IPv6
}

/**
 * SCPI命令结构
 */
export interface SCPICommand {
  command: string;
  parameters?: string[];
  isQuery: boolean;
  timeout?: number;
}

/**
 * 数据包结构
 */
export interface DataPacket {
  header: Buffer;
  payload: Buffer;
  checksum?: number;
  timestamp?: number;
}

/**
 * 协议配置基础接口
 */
export interface ProtocolConfig {
  type: string;
  [key: string]: any;
}

/**
 * 协议验证结果
 */
export interface ProtocolValidationResult {
  isValid: boolean;
  protocol?: string;
  errors: string[];
  warnings?: string[];
}

/**
 * I2C协议配置
 */
export interface I2CConfig extends ProtocolConfig {
  type: 'I2C';
  clockPin: number;
  dataPin: number;
  clockFrequency: number;
  addressBits: 7 | 10;
}

/**
 * SPI协议配置
 */
export interface SPIConfig extends ProtocolConfig {
  type: 'SPI';
  clockPin: number;
  mosiPin: number;
  misoPin: number;
  selectPin: number;
  clockFrequency: number;
  mode: 0 | 1 | 2 | 3;
  bitOrder: 'MSB' | 'LSB';
}

/**
 * UART协议配置
 */
export interface UARTConfig extends ProtocolConfig {
  type: 'UART';
  txPin: number;
  rxPin: number;
  baudRate: number;
  dataBits: 5 | 6 | 7 | 8;
  stopBits: 1 | 2;
  parity: 'none' | 'even' | 'odd';
}

/**
 * CAN协议配置
 */
export interface CANConfig extends ProtocolConfig {
  type: 'CAN';
  canHighPin: number;
  canLowPin: number;
  baudRate: number;
}

/**
 * 协议检测结果
 */
export interface ProtocolDetectionResult {
  detectedProtocols: string[];
  confidence: number;
  suggestedConfigs?: ProtocolConfig[];
}

/**
 * I2C配置建议
 */
export interface I2CConfigSuggestions {
  clockFrequencies: number[];
  addressBitOptions: number[];
  commonConfigurations: Partial<I2CConfig>[];
}

/**
 * 协议配置建议
 */
export interface ProtocolConfigSuggestions {
  minimumChannels: number;
  recommendedChannels: number[];
  recommendedFrequencies: number[];
  commonConfigurations: ProtocolConfig[];
}

/**
 * 协议数据结构
 */
export interface ProtocolData {
  frames: any[];
  timing: {
    clockPeriod?: number;
    setupTime?: number;
    holdTime?: number;
  };
  metadata?: any;
}

/**
 * 协议时序分析结果
 */
export interface ProtocolTiming {
  clockPeriod: number;
  setupTime: number;
  holdTime: number;
  frequency: number;
}

/**
 * 协议错误
 */
export interface ProtocolError {
  type: string;
  message: string;
  position: number;
  severity: 'error' | 'warning';
}

/**
 * 协议帮助工具类
 */
export class ProtocolHelper {
  private registeredProtocols: Map<string, ProtocolDefinition> = new Map();
  private supportedProtocols: string[] = ['I2C', 'SPI', 'UART', 'CAN'];

  constructor() {
    // 初始化支持的协议
  }

  /**
   * 获取支持的协议列表
   */
  getSupportedProtocols(): string[] {
    return [...this.supportedProtocols];
  }

  /**
   * 检查协议是否支持
   */
  isProtocolSupported(protocol: string): boolean {
    return this.supportedProtocols.includes(protocol);
  }

  /**
   * 创建I2C配置
   */
  createI2CConfig(config: I2CConfig): I2CConfig {
    return {
      type: 'I2C',
      clockPin: config.clockPin,
      dataPin: config.dataPin,
      clockFrequency: config.clockFrequency,
      addressBits: config.addressBits
    };
  }

  /**
   * 验证I2C配置
   */
  validateI2CConfig(config: I2CConfig): ProtocolValidationResult {
    const errors: string[] = [];

    if (config.clockPin === undefined || config.clockPin < 0) {
      errors.push('时钟引脚无效');
    }

    if (config.dataPin === undefined || config.dataPin < 0) {
      errors.push('数据引脚无效');
    }

    if (config.clockPin === config.dataPin) {
      errors.push('时钟引脚和数据引脚不能相同');
    }

    if (config.clockFrequency === undefined || config.clockFrequency <= 0) {
      errors.push('时钟频率无效');
    }

    if (config.addressBits !== 7 && config.addressBits !== 10) {
      errors.push('地址位数必须是7或10位');
    }

    return {
      isValid: errors.length === 0,
      protocol: 'I2C',
      errors
    };
  }

  /**
   * 获取I2C配置建议
   */
  getI2CConfigSuggestions(): I2CConfigSuggestions {
    return {
      clockFrequencies: [100000, 400000, 1000000], // 标准模式, 快速模式, 高速模式
      addressBitOptions: [7, 10],
      commonConfigurations: [
        { clockFrequency: 100000, addressBits: 7 },
        { clockFrequency: 400000, addressBits: 7 }
      ]
    };
  }

  /**
   * 创建SPI配置
   */
  createSPIConfig(config: SPIConfig): SPIConfig {
    return {
      type: 'SPI',
      clockPin: config.clockPin,
      mosiPin: config.mosiPin,
      misoPin: config.misoPin,
      selectPin: config.selectPin,
      clockFrequency: config.clockFrequency,
      mode: config.mode,
      bitOrder: config.bitOrder
    };
  }

  /**
   * 验证SPI配置
   */
  validateSPIConfig(config: SPIConfig): ProtocolValidationResult {
    const errors: string[] = [];
    const pins = [config.clockPin, config.mosiPin, config.misoPin, config.selectPin];

    // 检查引脚冲突
    const uniquePins = new Set(pins);
    if (uniquePins.size !== pins.length) {
      errors.push('SPI引脚不能重复使用');
    }

    // 检查模式
    if (![0, 1, 2, 3].includes(config.mode)) {
      errors.push('SPI模式必须是0-3之间');
    }

    // 检查频率
    if (config.clockFrequency <= 0) {
      errors.push('时钟频率必须大于0');
    }

    return {
      isValid: errors.length === 0,
      protocol: 'SPI',
      errors
    };
  }

  /**
   * 创建UART配置
   */
  createUARTConfig(config: UARTConfig): UARTConfig {
    return {
      type: 'UART',
      txPin: config.txPin,
      rxPin: config.rxPin,
      baudRate: config.baudRate,
      dataBits: config.dataBits,
      stopBits: config.stopBits,
      parity: config.parity
    };
  }

  /**
   * 验证UART配置
   */
  validateUARTConfig(config: UARTConfig): ProtocolValidationResult {
    const errors: string[] = [];

    if (config.baudRate <= 0) {
      errors.push('波特率必须大于0');
    }

    if (![5, 6, 7, 8].includes(config.dataBits)) {
      errors.push('数据位必须是5-8位');
    }

    if (![1, 2].includes(config.stopBits)) {
      errors.push('停止位必须是1或2位');
    }

    return {
      isValid: errors.length === 0,
      protocol: 'UART',
      errors
    };
  }

  /**
   * 验证通用协议配置
   */
  validateProtocolConfig(config: ProtocolConfig): ProtocolValidationResult {
    if (!config.type) {
      return {
        isValid: false,
        errors: ['协议类型不能为空']
      };
    }

    if (!this.isProtocolSupported(config.type)) {
      return {
        isValid: false,
        errors: [`不支持的协议类型: ${config.type}`]
      };
    }

    switch (config.type) {
      case 'I2C':
        return this.validateI2CConfig(config as I2CConfig);
      case 'SPI':
        return this.validateSPIConfig(config as SPIConfig);
      case 'UART':
        return this.validateUARTConfig(config as UARTConfig);
      default:
        return {
          isValid: false,
          errors: [`未实现的协议验证: ${config.type}`]
        };
    }
  }

  /**
   * 检测协议
   */
  detectProtocol(sampleData: Uint8Array, channelCount: number): ProtocolDetectionResult {
    const detectedProtocols: string[] = [];
    let confidence = 0;

    if (sampleData.length === 0) {
      return { detectedProtocols: [], confidence: 0 };
    }

    // 简单的协议检测逻辑
    if (channelCount >= 2) {
      // 可能是I2C
      detectedProtocols.push('I2C');
      confidence = Math.max(confidence, 0.6);
    }

    if (channelCount >= 4) {
      // 可能是SPI
      detectedProtocols.push('SPI');
      confidence = Math.max(confidence, 0.7);
    }

    if (channelCount >= 2) {
      // 可能是UART
      detectedProtocols.push('UART');
      confidence = Math.max(confidence, 0.5);
    }

    return { detectedProtocols, confidence };
  }

  /**
   * 生成I2C解码器模板
   */
  generateI2CDecoderTemplate(config: Partial<I2CConfig>): string {
    return `// I2C Decoder Template
const i2cDecoder = {
  protocol: 'I2C',
  clockPin: ${config.clockPin || 0},
  dataPin: ${config.dataPin || 1},
  clockFrequency: ${config.clockFrequency || 100000}
};`;
  }

  /**
   * 生成SPI解码器模板
   */
  generateSPIDecoderTemplate(config: Partial<SPIConfig>): string {
    return `// SPI Decoder Template
const spiDecoder = {
  protocol: 'SPI',
  clockPin: ${config.clockPin || 0},
  mosiPin: ${config.mosiPin || 1},
  misoPin: ${config.misoPin || 2},
  selectPin: ${config.selectPin || 3}
};`;
  }

  /**
   * 生成UART解码器模板
   */
  generateUARTDecoderTemplate(config: Partial<UARTConfig>): string {
    return `// UART Decoder Template
const uartDecoder = {
  protocol: 'UART',
  txPin: ${config.txPin || 0},
  rxPin: ${config.rxPin || 1},
  baudRate: ${config.baudRate || 115200}
};`;
  }

  /**
   * 获取协议配置建议
   */
  getProtocolConfigSuggestions(protocol: string, hardwareCapability: any): ProtocolConfigSuggestions {
    const suggestions: ProtocolConfigSuggestions = {
      minimumChannels: 2,
      recommendedChannels: [],
      recommendedFrequencies: [],
      commonConfigurations: []
    };

    switch (protocol) {
      case 'I2C':
        suggestions.minimumChannels = 2;
        suggestions.recommendedChannels = [0, 1];
        suggestions.recommendedFrequencies = [100000, 400000];
        break;
      case 'SPI':
        suggestions.minimumChannels = 4;
        suggestions.recommendedChannels = [0, 1, 2, 3];
        suggestions.recommendedFrequencies = [1000000, 10000000];
        break;
      case 'UART':
        suggestions.minimumChannels = 2;
        suggestions.recommendedChannels = [0, 1];
        suggestions.recommendedFrequencies = [9600, 115200];
        break;
    }

    return suggestions;
  }

  /**
   * 将采样数据转换为协议数据
   */
  convertSampleDataToProtocol(sampleData: Uint8Array, config: ProtocolConfig): ProtocolData {
    return {
      frames: [],
      timing: {
        clockPeriod: 1000,
        setupTime: 100,
        holdTime: 100
      },
      metadata: {
        protocol: config.type,
        sampleCount: sampleData.length
      }
    };
  }

  /**
   * 分析协议时序
   */
  analyzeProtocolTiming(sampleData: Uint8Array, sampleRate: number): ProtocolTiming {
    const clockPeriod = 1000000 / sampleRate; // 微秒
    return {
      clockPeriod,
      setupTime: clockPeriod * 0.1,
      holdTime: clockPeriod * 0.1,
      frequency: sampleRate
    };
  }

  /**
   * 检测协议错误
   */
  detectProtocolErrors(sampleData: Uint8Array, config: ProtocolConfig): ProtocolError[] {
    const errors: ProtocolError[] = [];

    // 简单的错误检测
    if (sampleData.length === 0) {
      errors.push({
        type: 'NO_DATA',
        message: '没有采样数据',
        position: 0,
        severity: 'error'
      });
    }

    return errors;
  }

  /**
   * 注册协议定义
   */
  registerProtocol(protocol: ProtocolDefinition): void {
    this.registeredProtocols.set(protocol.name, protocol);
  }

  /**
   * 获取已注册的协议列表
   */
  getRegisteredProtocols(): string[] {
    return Array.from(this.registeredProtocols.keys());
  }

  /**
   * 构建协议命令
   */
  buildCommand(protocolName: string, commandName: string, parameters: any[] = []): Buffer {
    const protocol = this.registeredProtocols.get(protocolName);
    if (!protocol) {
      throw new Error(`未找到协议: ${protocolName}`);
    }

    const command = protocol.commands[commandName];
    if (!command) {
      throw new Error(`未找到命令: ${commandName}`);
    }

    // 简单的二进制命令构建
    const buffer = Buffer.alloc(4 + parameters.length * 4);
    buffer.writeUInt32BE(command.opcode, 0);

    parameters.forEach((param, index) => {
      if (typeof param === 'number') {
        buffer.writeUInt32BE(param, 4 + index * 4);
      }
    });

    return buffer;
  }

  /**
   * 解析协议响应
   */
  parseResponse(protocolName: string, data: Buffer): any {
    const protocol = this.registeredProtocols.get(protocolName);
    if (!protocol) {
      throw new Error(`未找到协议: ${protocolName}`);
    }

    // 简单的响应解析 - 从第一个字节读取响应代码
    const responseCode = data.readUInt8(0);

    // 查找匹配的响应
    for (const [name, response] of Object.entries(protocol.responses)) {
      if (response.code === responseCode) {
        return { type: name, data: data.slice(1) };
      }
    }

    return { type: 'UNKNOWN', data };
  }

  /**
   * 验证协议消息
   */
  validateMessage(protocolName: string, commandName: string, parameters: any[]): boolean {
    const protocol = this.registeredProtocols.get(protocolName);
    if (!protocol) return false;

    const command = protocol.commands[commandName];
    if (!command) return false;

    return parameters.length === command.parameters.length;
  }

  /**
   * SCPI协议助手
   */
  static scpi = {
    /**
     * 构建SCPI命令字符串
     */
    buildCommand(command: string, parameters?: (string | number)[]): string {
      let cmd = command.trim();
      if (parameters && parameters.length > 0) {
        cmd += ` ${parameters.map(p => {
          if (typeof p === 'string' && p.includes(' ')) {
            return `"${p}"`;
          }
          return p.toString();
        }).join(',')}`;
      }
      return `${cmd}\n`;
    },

    /**
     * 解析SCPI响应
     */
    parseResponse(response: string): {
      isError: boolean;
      value?: string | number;
      error?: string;
    } {
      const trimmed = response.trim();

      // 检查是否是错误响应
      if (trimmed.startsWith('+') || trimmed.startsWith('-')) {
        const match = trimmed.match(/^([+-]\d+),?"?([^"]*)"?$/);
        if (match) {
          const errorCode = parseInt(match[1]);
          const errorMessage = match[2];

          return {
            isError: errorCode !== 0,
            error: errorCode !== 0 ? errorMessage : undefined
          };
        }
      }

      // 尝试解析为数值
      const numberValue = parseFloat(trimmed);
      if (!isNaN(numberValue)) {
        return {
          isError: false,
          value: numberValue
        };
      }

      // 返回字符串值
      return {
        isError: false,
        value: trimmed
      };
    },

    /**
     * 常用SCPI命令
     */
    commands: {
      identify: '*IDN?',
      reset: '*RST',
      clear: '*CLS',
      operationComplete: '*OPC?',
      selfTest: '*TST?',
      getError: 'SYST:ERR?'
    }
  };

  /**
   * 二进制协议助手
   */
  static binary = {
    /**
     * 创建数据包
     */
    createPacket(
      command: number,
      payload: Buffer,
      includeChecksum: boolean = true
    ): Buffer {
      const header = Buffer.alloc(8);
      header.writeUInt16BE(0x55AA, 0); // 同步字节
      header.writeUInt16BE(command, 2); // 命令
      header.writeUInt32BE(payload.length, 4); // 负载长度

      let packet = Buffer.concat([header, payload]);

      if (includeChecksum) {
        const checksum = this.calculateChecksum(packet);
        const checksumBuffer = Buffer.alloc(2);
        checksumBuffer.writeUInt16BE(checksum, 0);
        packet = Buffer.concat([packet, checksumBuffer]);
      }

      return packet;
    },

    /**
     * 解析数据包
     */
    parsePacket(data: Buffer): DataPacket | null {
      if (data.length < 8) return null;

      // 检查同步字节
      const sync = data.readUInt16BE(0);
      if (sync !== 0x55AA) return null;

      const command = data.readUInt16BE(2);
      const payloadLength = data.readUInt32BE(4);

      if (data.length < 8 + payloadLength) return null;

      const header = data.subarray(0, 8);
      const payload = data.subarray(8, 8 + payloadLength);

      return {
        header,
        payload,
        timestamp: Date.now()
      };
    },

    /**
     * 计算校验和
     */
    calculateChecksum(data: Buffer): number {
      let checksum = 0;
      for (let i = 0; i < data.length; i++) {
        checksum ^= data[i];
      }
      return checksum;
    },

    /**
     * 验证校验和
     */
    verifyChecksum(data: Buffer, expectedChecksum: number): boolean {
      const calculatedChecksum = this.calculateChecksum(data);
      return calculatedChecksum === expectedChecksum;
    },

    /**
     * 转义特殊字节 (类似OutputPacket实现)
     */
    escapeBytes(data: Buffer, escapeMap: Map<number, Buffer>): Buffer {
      const result: Buffer[] = [];

      for (let i = 0; i < data.length; i++) {
        const byte = data[i];
        if (escapeMap.has(byte)) {
          result.push(escapeMap.get(byte)!);
        } else {
          result.push(Buffer.from([byte]));
        }
      }

      return Buffer.concat(result);
    },

    /**
     * 反转义特殊字节
     */
    unescapeBytes(data: Buffer, unescapeMap: Map<number, number>): Buffer {
      const result: number[] = [];
      let i = 0;

      while (i < data.length) {
        const byte = data[i];
        if (unescapeMap.has(byte) && i + 1 < data.length) {
          const nextByte = data[i + 1];
          const unescaped = unescapeMap.get(byte);
          if (unescaped !== undefined) {
            result.push(nextByte ^ 0xF0); // 假设使用0xF0作为转义XOR
            i += 2;
            continue;
          }
        }
        result.push(byte);
        i++;
      }

      return Buffer.from(result);
    }
  };

  /**
   * JSON协议助手
   */
  static json = {
    /**
     * 创建JSON命令
     */
    createCommand(
      command: string,
      parameters?: Record<string, any>,
      id?: string | number
    ): string {
      const jsonObj: any = {
        command,
        timestamp: Date.now()
      };

      if (parameters) {
        jsonObj.parameters = parameters;
      }

      if (id !== undefined) {
        jsonObj.id = id;
      }

      return `${JSON.stringify(jsonObj)}\n`;
    },

    /**
     * 解析JSON响应
     */
    parseResponse(response: string): {
      success: boolean;
      command?: string;
      data?: any;
      error?: string;
      id?: string | number;
    } {
      try {
        const obj = JSON.parse(response.trim());

        return {
          success: obj.success !== false,
          command: obj.command,
          data: obj.data || obj.result,
          error: obj.error,
          id: obj.id
        };
      } catch (error) {
        return {
          success: false,
          error: `JSON解析失败: ${error}`
        };
      }
    },

    /**
     * 创建成功响应
     */
    createSuccess(data?: any, id?: string | number): string {
      const response: any = {
        success: true,
        timestamp: Date.now()
      };

      if (data !== undefined) {
        response.data = data;
      }

      if (id !== undefined) {
        response.id = id;
      }

      return `${JSON.stringify(response)}\n`;
    },

    /**
     * 创建错误响应
     */
    createError(error: string, id?: string | number): string {
      const response: any = {
        success: false,
        error,
        timestamp: Date.now()
      };

      if (id !== undefined) {
        response.id = id;
      }

      return `${JSON.stringify(response)}\n`;
    }
  };

  /**
   * HTTP协议助手
   */
  static http = {
    /**
     * 构建REST API URL
     */
    buildUrl(baseUrl: string, endpoint: string, params?: Record<string, string>): string {
      const url = new URL(endpoint, baseUrl);

      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }

      return url.toString();
    },

    /**
     * 创建基本认证头
     */
    createAuthHeader(username: string, password: string): string {
      const credentials = Buffer.from(`${username}:${password}`).toString('base64');
      return `Basic ${credentials}`;
    },

    /**
     * 解析Content-Type
     */
    parseContentType(contentType: string): {
      type: string;
      charset?: string;
      boundary?: string;
    } {
      const parts = contentType.split(';').map(part => part.trim());
      const type = parts[0];
      const result: any = { type };

      for (let i = 1; i < parts.length; i++) {
        const [key, value] = parts[i].split('=');
        if (key && value) {
          result[key.trim()] = value.trim().replace(/"/g, '');
        }
      }

      return result;
    }
  };

  /**
   * 串口协议助手
   */
  static serial = {
    /**
     * 计算常见波特率的最佳配置
     */
    getBaudRateConfig(targetBaudRate: number): SerialConfig {
      const standardRates = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];
      const closestRate = standardRates.reduce((prev, curr) =>
        Math.abs(curr - targetBaudRate) < Math.abs(prev - targetBaudRate) ? curr : prev
      );

      return {
        baudRate: closestRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none',
        timeout: 1000
      };
    },

    /**
     * 创建AT命令
     */
    createATCommand(command: string, parameters?: string[]): string {
      let atCmd = `AT${command}`;
      if (parameters && parameters.length > 0) {
        atCmd += parameters.join(',');
      }
      return `${atCmd}\r\n`;
    },

    /**
     * 解析AT响应
     */
    parseATResponse(response: string): {
      isOK: boolean;
      isError: boolean;
      data?: string[];
      errorCode?: number;
    } {
      const lines = response.split('\r\n').filter(line => line.trim());
      const lastLine = lines[lines.length - 1];

      if (lastLine === 'OK') {
        return {
          isOK: true,
          isError: false,
          data: lines.slice(0, -1)
        };
      }

      if (lastLine.startsWith('ERROR') || lastLine.startsWith('+CME ERROR')) {
        const errorMatch = lastLine.match(/ERROR:?\s*(\d+)?/);
        return {
          isOK: false,
          isError: true,
          errorCode: errorMatch?.[1] ? parseInt(errorMatch[1]) : undefined
        };
      }

      return {
        isOK: false,
        isError: false,
        data: lines
      };
    }
  };

  /**
   * 通用工具函数
   */
  static utils = {
    /**
     * 创建超时Promise
     */
    createTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage?: string): Promise<T> {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(timeoutMessage || '操作超时')), timeoutMs)
        )
      ]);
    },

    /**
     * 重试机制
     */
    async retry<T>(
      operation: () => Promise<T>,
      maxAttempts: number = 3,
      delayMs: number = 1000
    ): Promise<T> {
      let lastError: Error | undefined;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await operation();
        } catch (error) {
          lastError = error as Error;

          if (attempt === maxAttempts) {
            throw lastError;
          }

          // 指数退避延迟
          const delay = delayMs * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      throw lastError;
    },

    /**
     * 缓冲区转十六进制字符串
     */
    bufferToHex(buffer: Buffer, separator: string = ' '): string {
      return Array.from(buffer)
        .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
        .join(separator);
    },

    /**
     * 十六进制字符串转缓冲区
     */
    hexToBuffer(hex: string): Buffer {
      const cleaned = hex.replace(/[^0-9A-Fa-f]/g, '');
      if (cleaned.length % 2 !== 0) {
        throw new Error('十六进制字符串长度必须是偶数');
      }

      const bytes: number[] = [];
      for (let i = 0; i < cleaned.length; i += 2) {
        bytes.push(parseInt(cleaned.substr(i, 2), 16));
      }

      return Buffer.from(bytes);
    },

    /**
     * 等待条件满足
     */
    async waitFor(
      condition: () => boolean | Promise<boolean>,
      timeoutMs: number = 5000,
      intervalMs: number = 100
    ): Promise<void> {
      const startTime = Date.now();

      while (Date.now() - startTime < timeoutMs) {
        const result = await condition();
        if (result) {
          return;
        }

        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }

      throw new Error('等待条件超时');
    },

    /**
     * 限制并发数
     */
    async limitConcurrency<T>(
      tasks: (() => Promise<T>)[],
      maxConcurrency: number
    ): Promise<T[]> {
      const results: T[] = [];
      const executing: Promise<any>[] = [];

      for (const task of tasks) {
        const promise = task().then(result => {
          results.push(result);
          executing.splice(executing.indexOf(promise), 1);
          return result;
        });

        executing.push(promise);

        if (executing.length >= maxConcurrency) {
          await Promise.race(executing);
        }
      }

      await Promise.all(executing);
      return results;
    }
  };
}
