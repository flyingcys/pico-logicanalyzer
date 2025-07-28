/**
 * 协议帮助工具
 * 提供常见通信协议的实现助手函数
 */

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
 * 协议帮助工具类
 */
export class ProtocolHelper {

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
        cmd += ' ' + parameters.map(p => {
          if (typeof p === 'string' && p.includes(' ')) {
            return `"${p}"`;
          }
          return p.toString();
        }).join(',');
      }
      return cmd + '\n';
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
      
      return JSON.stringify(jsonObj) + '\n';
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
      
      return JSON.stringify(response) + '\n';
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
      
      return JSON.stringify(response) + '\n';
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
      return atCmd + '\r\n';
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