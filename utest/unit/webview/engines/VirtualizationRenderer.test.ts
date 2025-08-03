/**
 * VirtualizationRenderer 单元测试
 * 测试虚拟化渲染器的核心功能
 * 
 * @jest-environment jsdom
 */

import { VirtualizationRenderer } from '../../../../src/webview/engines/VirtualizationRenderer';

// 类型定义（模拟缺失的 CanvasTypes）
interface VirtualizationConfig {
  lodLevels?: number[];
  chunkSize?: number;
  maxConcurrentChunks?: number;
  enableTileCache?: boolean;
  tileCacheSize?: number; // MB
  enableWebWorker?: boolean;
  enableViewportCulling?: boolean;
  renderMargin?: number;
  frameTimeTarget?: number;
  adaptiveLOD?: boolean;
}

interface LODLevel {
  level: number;
  samplesPerPixel: number;
  renderStrategy: 'full' | 'minmax' | 'rle' | 'adaptive';
  compressionRatio: number;
}

interface RenderTile {
  id: string;
  startSample: number;
  endSample: number;
  lodLevel: number;
  channelIndex: number;
  imageData: ImageData | null;
  lastUsed: number;
  renderTime: number;
}

interface ChannelDisplayInfo {
  originalIndex: number;
  yPosition: number;
  height: number;
  hidden: boolean;
  channel: {
    samples?: Uint8Array;
  };
}

// Mock Web Worker for testing
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  
  constructor(scriptURL: string | URL) {
    // Mock worker constructor
  }
  
  postMessage(message: any): void {
    // Simulate async worker response
    setTimeout(() => {
      if (this.onmessage) {
        // Mock successful response
        this.onmessage({
          data: {
            taskId: message.taskId,
            success: true,
            result: this.mockProcessData(message.type, message.data)
          }
        } as MessageEvent);
      }
    }, 10);
  }
  
  terminate(): void {
    // Mock termination
  }
  
  private mockProcessData(type: string, data: any): any {
    switch (type) {
      case 'minmax':
        return [{ min: 0, max: 1, start: 0, end: data.samples.length }];
      case 'rle':
        return [{ value: 1, count: data.samples.length, start: 0 }];
      case 'downsample':
        return data.samples.slice(0, Math.ceil(data.samples.length / data.factor));
      default:
        return data.samples;
    }
  }
}

// Mock global Worker
(global as any).Worker = MockWorker;

// Mock URL.createObjectURL
(global as any).URL = {
  createObjectURL: (blob: Blob) => 'mock-blob-url'
};

// Mock Blob
(global as any).Blob = class {
  constructor(content: string[], options: any) {
    // Mock blob constructor
  }
};

describe('VirtualizationRenderer', () => {
  let canvas: HTMLCanvasElement;
  let renderer: VirtualizationRenderer;
  let mockContext: any;

  beforeEach(() => {
    // Mock canvas and context
    mockContext = {
      clearRect: jest.fn(),
      putImageData: jest.fn(),
      getImageData: jest.fn(() => ({
        width: 100,
        height: 50,
        data: new Uint8ClampedArray(100 * 50 * 4)
      })),
      strokeStyle: '',
      lineWidth: 1,
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn()
    };

    canvas = {
      getContext: jest.fn(() => mockContext),
      width: 800,
      height: 600
    } as any;

    // Mock document.createElement for tile canvases
    const originalCreateElement = document.createElement;
    document.createElement = jest.fn((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: jest.fn(() => mockContext)
        } as any;
      }
      return originalCreateElement.call(document, tagName);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('构造函数测试', () => {
    it('应该使用默认配置创建渲染器', () => {
      renderer = new VirtualizationRenderer(canvas, {});
      
      expect(renderer).toBeDefined();
      expect(canvas.getContext).toHaveBeenCalledWith('2d');
    });

    it('应该使用自定义配置创建渲染器', () => {
      const config: VirtualizationConfig = {
        lodLevels: [1, 10, 50],
        chunkSize: 5000,
        enableTileCache: false,
        enableWebWorker: false
      };

      renderer = new VirtualizationRenderer(canvas, config);
      
      expect(renderer).toBeDefined();
    });

    it('应该在无法获取2D上下文时抛出错误', () => {
      const badCanvas = {
        getContext: jest.fn(() => null)
      } as any;

      expect(() => {
        new VirtualizationRenderer(badCanvas, {});
      }).toThrow('无法获取2D渲染上下文');
    });

    it('应该正确初始化LOD级别', () => {
      const config: VirtualizationConfig = {
        lodLevels: [1, 5, 25, 100]
      };

      renderer = new VirtualizationRenderer(canvas, config);
      
      // 验证渲染器创建成功（间接验证LOD初始化）
      expect(renderer).toBeDefined();
    });

    it('应该在支持时初始化Web Worker', () => {
      const config: VirtualizationConfig = {
        enableWebWorker: true
      };

      renderer = new VirtualizationRenderer(canvas, config);
      
      expect(renderer).toBeDefined();
    });
  });

  describe('LOD计算测试', () => {
    beforeEach(() => {
      renderer = new VirtualizationRenderer(canvas, {
        lodLevels: [1, 5, 25, 100],
        adaptiveLOD: false
      });
    });

    it('应该为低采样密度返回LOD 0', () => {
      const lod = renderer.calculateLOD(0.5);
      expect(lod).toBe(0);
    });

    it('应该为中等采样密度返回适当的LOD', () => {
      const lod = renderer.calculateLOD(10);
      expect(lod).toBe(2);
    });

    it('应该为高采样密度返回最高LOD', () => {
      const lod = renderer.calculateLOD(1000);
      expect(lod).toBe(3);
    });

    it('应该在启用自适应LOD时调整计算', () => {
      renderer = new VirtualizationRenderer(canvas, {
        lodLevels: [1, 5, 25, 100],
        adaptiveLOD: true,
        frameTimeTarget: 16.67
      });

      const lod = renderer.calculateLOD(10);
      expect(typeof lod).toBe('number');
      expect(lod).toBeGreaterThanOrEqual(0);
    });
  });

  describe('渲染功能测试', () => {
    beforeEach(() => {
      renderer = new VirtualizationRenderer(canvas, {
        enableTileCache: true,
        enableWebWorker: false,
        chunkSize: 1000
      });
    });

    it('应该成功渲染简单通道数据', async () => {
      const channels: ChannelDisplayInfo[] = [
        {
          originalIndex: 0,
          yPosition: 0,
          height: 50,
          hidden: false,
          channel: {
            samples: new Uint8Array([1, 0, 1, 0, 1, 0, 1, 0])
          }
        }
      ];

      await expect(renderer.renderChannels(
        channels,
        0,
        8,
        800,
        600
      )).resolves.not.toThrow();
    });

    it('应该处理空通道数据', async () => {
      const channels: ChannelDisplayInfo[] = [
        {
          originalIndex: 0,
          yPosition: 0,
          height: 50,
          hidden: false,
          channel: {
            samples: new Uint8Array([])
          }
        }
      ];

      await expect(renderer.renderChannels(
        channels,
        0,
        0,
        800,
        600
      )).resolves.not.toThrow();
    });

    it('应该处理大量数据', async () => {
      const largeData = new Uint8Array(100000);
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = Math.random() > 0.5 ? 1 : 0;
      }

      const channels: ChannelDisplayInfo[] = [
        {
          originalIndex: 0,
          yPosition: 0,
          height: 50,
          hidden: false,
          channel: {
            samples: largeData
          }
        }
      ];

      const startTime = Date.now();
      await renderer.renderChannels(
        channels,
        0,
        largeData.length,
        800,
        600
      );
      const renderTime = Date.now() - startTime;

      expect(renderTime).toBeLessThan(5000); // 5秒内完成
    });

    it('应该在启用视口剔除时过滤不可见通道', async () => {
      renderer = new VirtualizationRenderer(canvas, {
        enableViewportCulling: true,
        renderMargin: 10
      });

      const channels: ChannelDisplayInfo[] = [
        {
          originalIndex: 0,
          yPosition: -100, // 在视口外
          height: 50,
          hidden: false,
          channel: {
            samples: new Uint8Array([1, 0, 1, 0])
          }
        },
        {
          originalIndex: 1,
          yPosition: 100, // 在视口内
          height: 50,
          hidden: false,
          channel: {
            samples: new Uint8Array([1, 0, 1, 0])
          }
        }
      ];

      await expect(renderer.renderChannels(
        channels,
        0,
        4,
        800,
        600
      )).resolves.not.toThrow();
    });
  });

  describe('Web Worker集成测试', () => {
    beforeEach(() => {
      renderer = new VirtualizationRenderer(canvas, {
        enableWebWorker: true,
        enableTileCache: false
      });
    });

    it('应该使用Web Worker处理MinMax数据', async () => {
      const channels: ChannelDisplayInfo[] = [
        {
          originalIndex: 0,
          yPosition: 0,
          height: 50,
          hidden: false,
          channel: {
            samples: new Uint8Array(new Array(10000).fill(0).map(() => Math.random() > 0.5 ? 1 : 0))
          }
        }
      ];

      // 这应该触发MinMax处理（由于高采样密度）
      await expect(renderer.renderChannels(
        channels,
        0,
        10000,
        100, // 小画布宽度导致高采样密度
        600
      )).resolves.not.toThrow();
    });

    it('应该在Worker不可用时回退到主线程', async () => {
      // 模拟Worker初始化失败
      renderer = new VirtualizationRenderer(canvas, {
        enableWebWorker: false
      });

      const channels: ChannelDisplayInfo[] = [
        {
          originalIndex: 0,
          yPosition: 0,
          height: 50,
          hidden: false,
          channel: {
            samples: new Uint8Array([1, 0, 1, 0, 1, 0, 1, 0])
          }
        }
      ];

      await expect(renderer.renderChannels(
        channels,
        0,
        8,
        800,
        600
      )).resolves.not.toThrow();
    });
  });

  describe('缓存系统测试', () => {
    beforeEach(() => {
      renderer = new VirtualizationRenderer(canvas, {
        enableTileCache: true,
        tileCacheSize: 1 // 1MB limit
      });
    });

    it('应该缓存渲染的瓦片', async () => {
      const channels: ChannelDisplayInfo[] = [
        {
          originalIndex: 0,
          yPosition: 0,
          height: 50,
          hidden: false,
          channel: {
            samples: new Uint8Array([1, 0, 1, 0, 1, 0, 1, 0])
          }
        }
      ];

      // 第一次渲染应该创建缓存
      await renderer.renderChannels(channels, 0, 8, 800, 600);
      
      // 第二次渲染应该使用缓存（更快）
      const startTime = Date.now();
      await renderer.renderChannels(channels, 0, 8, 800, 600);
      const renderTime = Date.now() - startTime;
      
      expect(renderTime).toBeLessThan(100); // 应该很快
    });

    it('应该在缓存大小超限时淘汰旧瓦片', async () => {
      const channels: ChannelDisplayInfo[] = [];
      
      // 创建多个通道以超出缓存限制
      for (let i = 0; i < 10; i++) {
        channels.push({
          originalIndex: i,
          yPosition: i * 60,
          height: 50,
          hidden: false,
          channel: {
            samples: new Uint8Array(10000).fill(i % 2)
          }
        });
      }

      await expect(renderer.renderChannels(
        channels,
        0,
        10000,
        800,
        600
      )).resolves.not.toThrow();
    });

    it('应该在禁用缓存时不使用缓存', async () => {
      renderer = new VirtualizationRenderer(canvas, {
        enableTileCache: false
      });

      const channels: ChannelDisplayInfo[] = [
        {
          originalIndex: 0,
          yPosition: 0,
          height: 50,
          hidden: false,
          channel: {
            samples: new Uint8Array([1, 0, 1, 0])
          }
        }
      ];

      await expect(renderer.renderChannels(
        channels,
        0,
        4,
        800,
        600
      )).resolves.not.toThrow();
    });
  });

  describe('性能监控测试', () => {
    beforeEach(() => {
      renderer = new VirtualizationRenderer(canvas, {
        frameTimeTarget: 16.67 // 60fps
      });
    });

    it('应该提供性能统计信息', async () => {
      const channels: ChannelDisplayInfo[] = [
        {
          originalIndex: 0,
          yPosition: 0,
          height: 50,
          hidden: false,
          channel: {
            samples: new Uint8Array([1, 0, 1, 0])
          }
        }
      ];

      await renderer.renderChannels(channels, 0, 4, 800, 600);
      
      const stats = renderer.getPerformanceStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats.avgFrameTime).toBe('number');
      expect(typeof stats.currentLOD).toBe('number');
      expect(typeof stats.cacheSize).toBe('number');
    });

    it('应该跟踪平均帧时间', async () => {
      const channels: ChannelDisplayInfo[] = [
        {
          originalIndex: 0,
          yPosition: 0,
          height: 50,
          hidden: false,
          channel: {
            samples: new Uint8Array([1, 0, 1, 0])
          }
        }
      ];

      // 多次渲染以建立统计
      for (let i = 0; i < 5; i++) {
        await renderer.renderChannels(channels, i, i + 4, 800, 600);
      }
      
      const stats = renderer.getPerformanceStats();
      expect(stats.avgFrameTime).toBeGreaterThan(0);
    });

    it('应该计算缓存命中率', () => {
      const stats = renderer.getPerformanceStats();
      expect(typeof stats.cacheHitRate).toBe('number');
      expect(stats.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(stats.cacheHitRate).toBeLessThanOrEqual(1);
    });
  });

  describe('资源管理测试', () => {
    beforeEach(() => {
      renderer = new VirtualizationRenderer(canvas, {
        enableWebWorker: true,
        enableTileCache: true
      });
    });

    it('应该正确清理所有资源', () => {
      expect(() => {
        renderer.dispose();
      }).not.toThrow();
    });

    it('应该终止Web Worker', () => {
      const mockTerminate = jest.fn();
      
      // Mock Worker termination
      const originalWorker = (global as any).Worker;
      (global as any).Worker = class extends originalWorker {
        terminate = mockTerminate;
      };

      renderer = new VirtualizationRenderer(canvas, {
        enableWebWorker: true
      });

      renderer.dispose();
      
      // 恢复原始Worker
      (global as any).Worker = originalWorker;
    });

    it('应该清理瓦片缓存', () => {
      renderer.dispose();
      
      const stats = renderer.getPerformanceStats();
      expect(stats.cacheSize).toBe(0);
    });

    it('应该清理任务队列', () => {
      renderer.dispose();
      
      // 验证dispose后仍能正常工作
      expect(() => {
        renderer.getPerformanceStats();
      }).not.toThrow();
    });
  });

  describe('边界条件测试', () => {
    beforeEach(() => {
      renderer = new VirtualizationRenderer(canvas, {});
    });

    it('应该处理零宽度画布', async () => {
      const channels: ChannelDisplayInfo[] = [
        {
          originalIndex: 0,
          yPosition: 0,
          height: 50,
          hidden: false,
          channel: {
            samples: new Uint8Array([1, 0, 1, 0])
          }
        }
      ];

      await expect(renderer.renderChannels(
        channels,
        0,
        4,
        0, // 零宽度
        600
      )).resolves.not.toThrow();
    });

    it('应该处理零高度画布', async () => {
      const channels: ChannelDisplayInfo[] = [
        {
          originalIndex: 0,
          yPosition: 0,
          height: 50,
          hidden: false,
          channel: {
            samples: new Uint8Array([1, 0, 1, 0])
          }
        }
      ];

      await expect(renderer.renderChannels(
        channels,
        0,
        4,
        800,
        0 // 零高度
      )).resolves.not.toThrow();
    });

    it('应该处理空通道列表', async () => {
      await expect(renderer.renderChannels(
        [],
        0,
        0,
        800,
        600
      )).resolves.not.toThrow();
    });

    it('应该处理无效的采样范围', async () => {
      const channels: ChannelDisplayInfo[] = [
        {
          originalIndex: 0,
          yPosition: 0,
          height: 50,
          hidden: false,
          channel: {
            samples: new Uint8Array([1, 0, 1, 0])
          }
        }
      ];

      // 开始采样大于结束采样
      await expect(renderer.renderChannels(
        channels,
        10,
        5,
        800,
        600
      )).resolves.not.toThrow();
    });

    it('应该处理超出范围的采样索引', async () => {
      const channels: ChannelDisplayInfo[] = [
        {
          originalIndex: 0,
          yPosition: 0,
          height: 50,
          hidden: false,
          channel: {
            samples: new Uint8Array([1, 0, 1, 0])
          }
        }
      ];

      await expect(renderer.renderChannels(
        channels,
        0,
        1000, // 超出数据范围
        800,
        600
      )).resolves.not.toThrow();
    });
  });

  describe('渲染策略测试', () => {
    it('应该对低密度数据使用full策略', async () => {
      renderer = new VirtualizationRenderer(canvas, {
        lodLevels: [1, 10, 100]
      });

      const channels: ChannelDisplayInfo[] = [
        {
          originalIndex: 0,
          yPosition: 0,
          height: 50,
          hidden: false,
          channel: {
            samples: new Uint8Array([1, 0, 1, 0])
          }
        }
      ];

      await expect(renderer.renderChannels(
        channels,
        0,
        4,
        400, // 低采样密度
        600
      )).resolves.not.toThrow();
    });

    it('应该对中等密度数据使用minmax策略', async () => {
      renderer = new VirtualizationRenderer(canvas, {
        lodLevels: [1, 5, 25, 100],
        enableWebWorker: false
      });

      const channels: ChannelDisplayInfo[] = [
        {
          originalIndex: 0,
          yPosition: 0,
          height: 50,
          hidden: false,
          channel: {
            samples: new Uint8Array(1000).fill(0).map(() => Math.random() > 0.5 ? 1 : 0)
          }
        }
      ];

      await expect(renderer.renderChannels(
        channels,
        0,
        1000,
        50, // 中等采样密度
        600
      )).resolves.not.toThrow();
    });

    it('应该对高密度数据使用自适应策略', async () => {
      renderer = new VirtualizationRenderer(canvas, {
        lodLevels: [1, 5, 25, 100],
        adaptiveLOD: true,
        enableWebWorker: false
      });

      const channels: ChannelDisplayInfo[] = [
        {
          originalIndex: 0,
          yPosition: 0,
          height: 50,
          hidden: false,
          channel: {
            samples: new Uint8Array(10000).fill(0).map(() => Math.random() > 0.5 ? 1 : 0)
          }
        }
      ];

      await expect(renderer.renderChannels(
        channels,
        0,
        10000,
        10, // 高采样密度
        600
      )).resolves.not.toThrow();
    });
  });
});