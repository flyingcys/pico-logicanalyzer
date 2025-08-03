/**
 * 数据导出功能测试设置文件
 * 配置导出测试所需的环境和模拟
 */

import fs from 'fs';
import path from 'path';

// 扩展Jest匹配器
expect.extend({
  toBeValidExportResult(received: any) {
    const pass = received && 
                 typeof received.success === 'boolean' &&
                 typeof received.filename === 'string' &&
                 typeof received.mimeType === 'string' &&
                 typeof received.size === 'number' &&
                 (received.data !== undefined);

    if (pass) {
      return {
        message: () => `期望 ${JSON.stringify(received)} 不是有效的导出结果`,
        pass: true,
      };
    } else {
      return {
        message: () => `期望 ${JSON.stringify(received)} 是有效的导出结果`,
        pass: false,
      };
    }
  },

  toHaveValidCSVFormat(received: string) {
    const lines = received.split('\n');
    const hasHeader = lines[0] && lines[0].includes('Time');
    const hasData = lines.length > 1;
    const validFormat = lines.every(line => 
      !line.trim() || line.split(',').length > 0
    );

    const pass = hasHeader && hasData && validFormat;

    if (pass) {
      return {
        message: () => `期望 CSV 数据格式无效`,
        pass: true,
      };
    } else {
      return {
        message: () => `期望 CSV 数据格式有效，但发现：
          - 有头部: ${hasHeader}
          - 有数据: ${hasData}  
          - 格式正确: ${validFormat}`,
        pass: false,
      };
    }
  },

  toHaveValidVCDFormat(received: string) {
    const requiredSections = [
      '$date',
      '$version', 
      '$timescale',
      '$enddefinitions',
      '$dumpvars'
    ];

    const hasAllSections = requiredSections.every(section => 
      received.includes(section)
    );

    const hasTimeStamps = /#\d+/.test(received);

    const pass = hasAllSections && hasTimeStamps;

    if (pass) {
      return {
        message: () => `期望 VCD 数据格式无效`,
        pass: true,
      };
    } else {
      return {
        message: () => `期望 VCD 数据格式有效，但缺少必需的部分：
          - 所有必需部分: ${hasAllSections}
          - 时间戳: ${hasTimeStamps}`,
        pass: false,
      };
    }
  },

  toHaveValidJSONFormat(received: string) {
    try {
      const parsed = JSON.parse(received);
      const hasMetadata = parsed.metadata !== undefined;
      const hasChannels = parsed.channels !== undefined;
      
      const pass = hasMetadata && hasChannels;

      if (pass) {
        return {
          message: () => `期望 JSON 数据格式无效`,
          pass: true,
        };
      } else {
        return {
          message: () => `期望 JSON 数据格式有效，但缺少：
            - metadata: ${hasMetadata}
            - channels: ${hasChannels}`,
          pass: false,
        };
      }
    } catch (error) {
      return {
        message: () => `期望 JSON 数据格式有效，但解析失败: ${error}`,
        pass: false,
      };
    }
  },

  toBeWithinPerformanceThreshold(received: number, threshold: number) {
    const pass = received <= threshold;
    
    if (pass) {
      return {
        message: () => `期望 ${received}ms 超过性能阈值 ${threshold}ms`,
        pass: true,
      };
    } else {
      return {
        message: () => `期望 ${received}ms 在性能阈值 ${threshold}ms 内`,
        pass: false,
      };
    }
  }
});

// 类型声明扩展
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidExportResult(): R;
      toHaveValidCSVFormat(): R;
      toHaveValidVCDFormat(): R;
      toHaveValidJSONFormat(): R;
      toBeWithinPerformanceThreshold(threshold: number): R;
    }
  }
}

// 全局测试设置
beforeAll(() => {
  // 创建测试临时目录
  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // 设置测试环境变量
  process.env.NODE_ENV = 'test';
  process.env.TEST_MODE = 'export-integration';
  
  // 禁用控制台日志以减少测试输出噪音
  if (process.env.VERBOSE_TESTS !== 'true') {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  }
});

afterAll(() => {
  // 清理测试临时文件
  const tempDir = path.join(__dirname, 'temp');
  if (fs.existsSync(tempDir)) {
    try {
      const files = fs.readdirSync(tempDir);
      files.forEach(file => {
        const filePath = path.join(tempDir, file);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          fs.unlinkSync(filePath);
        }
      });
      
      // 只删除空目录
      if (fs.readdirSync(tempDir).length === 0) {
        fs.rmdirSync(tempDir);
      }
    } catch (error) {
      console.warn('清理测试文件时出错:', error);
    }
  }

  // 恢复console方法
  if (process.env.VERBOSE_TESTS !== 'true') {
    jest.restoreAllMocks();
  }
});

// 每个测试前的设置
beforeEach(() => {
  // 清理模拟调用
  jest.clearAllMocks();
  
  // 重置定时器
  jest.clearAllTimers();
});

// 性能监控工具
export class PerformanceMonitor {
  private startTime: number = 0;
  private markers: Map<string, number> = new Map();

  start(): void {
    this.startTime = Date.now();
    this.markers.clear();
  }

  mark(label: string): void {
    this.markers.set(label, Date.now() - this.startTime);
  }

  getDuration(): number {
    return Date.now() - this.startTime;
  }

  getMarker(label: string): number {
    return this.markers.get(label) || 0;
  }

  getReport(): { [key: string]: number } {
    const report: { [key: string]: number } = {
      total: this.getDuration()
    };
    
    this.markers.forEach((time, label) => {
      report[label] = time;
    });
    
    return report;
  }
}

// 内存监控工具
export class MemoryMonitor {
  private initialMemory: number = 0;
  private peakMemory: number = 0;

  start(): void {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      this.initialMemory = memInfo.usedJSHeapSize;
      this.peakMemory = this.initialMemory;
    }
  }

  update(): void {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      this.peakMemory = Math.max(this.peakMemory, memInfo.usedJSHeapSize);
    }
  }

  getUsage(): { initial: number; peak: number; current: number } {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      return {
        initial: this.initialMemory,
        peak: this.peakMemory,
        current: memInfo.usedJSHeapSize
      };
    }
    
    return { initial: 0, peak: 0, current: 0 };
  }

  getReport(): string {
    const usage = this.getUsage();
    const initialMB = Math.round(usage.initial / 1024 / 1024);
    const peakMB = Math.round(usage.peak / 1024 / 1024);
    const currentMB = Math.round(usage.current / 1024 / 1024);
    
    return `Memory: ${initialMB}MB → ${peakMB}MB (peak) → ${currentMB}MB (current)`;
  }
}

// 测试数据生成工具
export class TestDataGenerator {
  static generateChannelData(
    channelCount: number, 
    sampleCount: number,
    pattern: 'clock' | 'random' | 'sine' | 'square' = 'random'
  ): Uint8Array[] {
    const channels: Uint8Array[] = [];
    
    for (let ch = 0; ch < channelCount; ch++) {
      const samples = new Uint8Array(sampleCount);
      
      for (let i = 0; i < sampleCount; i++) {
        switch (pattern) {
          case 'clock':
            samples[i] = i % 2;
            break;
          case 'sine':
            samples[i] = Math.sin(i * 0.01 + ch * Math.PI / 4) > 0 ? 1 : 0;
            break;
          case 'square':
            samples[i] = Math.floor(i / 100) % 2;
            break;
          case 'random':
          default:
            samples[i] = Math.random() > 0.5 ? 1 : 0;
        }
      }
      
      channels.push(samples);
    }
    
    return channels;
  }

  static generateDecoderResults(
    decoderId: string,
    resultCount: number,
    maxSample: number
  ): any[] {
    const results = [];
    
    for (let i = 0; i < resultCount; i++) {
      const startSample = Math.floor(Math.random() * maxSample * 0.8);
      const endSample = startSample + Math.floor(Math.random() * 100) + 10;
      
      results.push({
        id: `${decoderId}_${i}`,
        decoderId,
        startSample,
        endSample,
        data: {
          type: 'data',
          value: Math.floor(Math.random() * 256)
        },
        annotation: `${decoderId.toUpperCase()} ${i}`,
        level: 'data'
      });
    }
    
    return results;
  }
}

// 导出测试工具
export { PerformanceMonitor, MemoryMonitor, TestDataGenerator };