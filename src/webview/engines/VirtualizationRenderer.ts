import type { ChannelDisplayInfo } from './ChannelLayoutManager';

// 虚拟化配置接口
interface VirtualizationConfig {
  enableVirtualization: boolean;
  tileSize: number;
  maxCachedTiles: number;
  lodThresholds: number[];
  workerCount: number;
  lodLevels: number[];
  chunkSize: number;
  maxConcurrentChunks: number;
  enableTileCache: boolean;
  enableWebWorker: boolean;
  adaptiveLOD: boolean;
  frameTimeTarget: number;
  enableViewportCulling: boolean;
  renderMargin: number;
  tileCacheSize: number;
}

// LOD级别接口
interface LODLevel {
  level: number;
  samplesPerPixel: number;
  minZoom: number;
  maxZoom: number;
  renderStrategy?: string;
}

// 渲染瓦片接口
interface RenderTile {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  data: ImageData | null;
  isDirty: boolean;
  imageData?: ImageData;
  startSample?: number;
  endSample?: number;
  lodLevel?: number;
  channelIndex?: number;
  lastUsed?: number;
  renderTime?: number;
}

/**
 * 虚拟化渲染器
 *
 * 优化大数据量的渲染性能，支持：
 * - 多级LOD (Level of Detail)
 * - 视口剔除
 * - 瓦片缓存
 * - Web Worker并行处理
 * - 自适应性能调节
 */
export class VirtualizationRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: VirtualizationConfig;

  // LOD系统
  private lodLevels: LODLevel[] = [];
  private currentLOD: number = 0;

  // 瓦片缓存系统
  private tileCache = new Map<string, RenderTile>();
  private tileCacheSize: number = 0;

  // 性能监控
  private frameTimeHistory: number[] = [];
  private avgFrameTime: number = 16.67; // 60fps target

  // 渲染队列和任务管理
  private renderQueue: any[] = [];
  private renderWorker: Worker | null = null;
  private workerTasks = new Map<string, { resolve: Function; reject: Function; timeoutId: NodeJS.Timeout }>();

  constructor(canvas: HTMLCanvasElement, config: VirtualizationConfig) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法获取2D渲染上下文');
    }
    this.ctx = ctx;

    this.config = {
      lodLevels: [1, 5, 25, 100, 500, 2000],
      chunkSize: 10000,
      maxConcurrentChunks: 4,
      enableTileCache: true,
      tileCacheSize: 128, // MB
      enableWebWorker: true,
      enableViewportCulling: true,
      renderMargin: 100,
      frameTimeTarget: 16.67,
      adaptiveLOD: true,
      ...config
    };

    this.initializeLODLevels();

    if (this.config.enableWebWorker && typeof Worker !== 'undefined') {
      this.initializeWebWorker();
    }
  }

  /**
   * 初始化LOD级别
   */
  private initializeLODLevels(): void {
    this.lodLevels = this.config.lodLevels.map((samplesPerPixel, index) => ({
      level: index,
      samplesPerPixel,
      minZoom: index === 0 ? 1 : this.config.lodLevels[index - 1],
      maxZoom: index === this.config.lodLevels.length - 1 ? Infinity : samplesPerPixel * 2,
      renderStrategy: this.selectRenderStrategy(samplesPerPixel)
    }));
  }

  /**
   * 选择渲染策略
   */
  private selectRenderStrategy(samplesPerPixel: number): 'full' | 'minmax' | 'rle' | 'adaptive' {
    if (samplesPerPixel <= 1) {
      return 'full';
    } else if (samplesPerPixel <= 10) {
      return 'minmax';
    } else if (samplesPerPixel <= 100) {
      return 'rle';
    } else {
      return 'adaptive';
    }
  }

  /**
   * 初始化Web Worker
   */
  private initializeWebWorker(): void {
    try {
      // 创建内联Worker
      const workerCode = `
        self.onmessage = function(e) {
          const { taskId, type, data } = e.data;
          
          try {
            let result;
            
            switch (type) {
              case 'minmax':
                result = processMinMax(data);
                break;
              case 'rle':
                result = processRLE(data);
                break;
              case 'downsample':
                result = processDownsample(data);
                break;
              default:
                throw new Error('Unknown task type: ' + type);
            }
            
            self.postMessage({ taskId, success: true, result });
          } catch (error) {
            self.postMessage({ taskId, success: false, error: error.message });
          }
        };
        
        function processMinMax(data) {
          const { samples, chunkSize } = data;
          const result = [];
          
          for (let i = 0; i < samples.length; i += chunkSize) {
            const chunk = samples.slice(i, i + chunkSize);
            let min = 1, max = 0;
            
            for (const sample of chunk) {
              if (sample < min) min = sample;
              if (sample > max) max = sample;
            }
            
            result.push({ min, max, start: i, end: i + chunk.length });
          }
          
          return result;
        }
        
        function processRLE(data) {
          const { samples } = data;
          const result = [];
          let current = samples[0];
          let count = 1;
          
          for (let i = 1; i < samples.length; i++) {
            if (samples[i] === current) {
              count++;
            } else {
              result.push({ value: current, count, start: i - count });
              current = samples[i];
              count = 1;
            }
          }
          
          result.push({ value: current, count, start: samples.length - count });
          return result;
        }
        
        function processDownsample(data) {
          const { samples, factor } = data;
          const result = [];
          
          for (let i = 0; i < samples.length; i += factor) {
            // 简单下采样：取第一个样本
            result.push(samples[i]);
          }
          
          return result;
        }
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      this.renderWorker = new Worker(URL.createObjectURL(blob));

      this.renderWorker.onmessage = (e) => {
        const { taskId, success, result, error } = e.data;
        const task = this.workerTasks.get(taskId);

        if (task) {
          // 清理超时定时器
          clearTimeout(task.timeoutId);
          this.workerTasks.delete(taskId);
          
          if (success) {
            task.resolve(result);
          } else {
            task.reject(new Error(error));
          }
        }
      };

    } catch (error) {
      console.warn('Failed to initialize Web Worker:', error);
      this.renderWorker = null;
    }
  }

  /**
   * 计算当前LOD级别
   */
  public calculateLOD(samplesPerPixel: number): number {
    // 自适应LOD：基于帧时间调整
    if (this.config.adaptiveLOD) {
      const performanceFactor = this.avgFrameTime / this.config.frameTimeTarget;
      samplesPerPixel *= performanceFactor;
    }

    for (let i = 0; i < this.lodLevels.length; i++) {
      if (samplesPerPixel <= this.lodLevels[i].samplesPerPixel) {
        return i;
      }
    }

    return this.lodLevels.length - 1;
  }

  /**
   * 虚拟化渲染主方法
   */
  public async renderChannels(
    channels: ChannelDisplayInfo[],
    startSample: number,
    endSample: number,
    canvasWidth: number,
    canvasHeight: number
  ): Promise<void> {
    const startTime = performance.now();

    // 计算渲染参数
    const samplesPerPixel = (endSample - startSample) / canvasWidth;
    const lodLevel = this.calculateLOD(samplesPerPixel);

    // 视口剔除：只渲染可见通道
    const visibleChannels = this.config.enableViewportCulling ?
      this.cullChannelsByViewport(channels, canvasHeight) :
      channels;

    // 创建渲染任务
    const renderTasks = this.createRenderTasks(
      visibleChannels,
      startSample,
      endSample,
      lodLevel,
      canvasWidth
    );

    // 执行渲染
    await this.executeRenderTasks(renderTasks);

    // 更新性能统计
    const renderTime = performance.now() - startTime;
    this.updatePerformanceStats(renderTime);
  }

  /**
   * 视口剔除
   */
  private cullChannelsByViewport(
    channels: ChannelDisplayInfo[],
    canvasHeight: number
  ): ChannelDisplayInfo[] {
    const margin = this.config.renderMargin;

    return channels.filter(channel => {
      const channelTop = channel.yPosition;
      const channelBottom = channel.yPosition + channel.height;

      // 检查通道是否在可见区域内（包含边距）
      return channelBottom >= -margin && channelTop <= canvasHeight + margin;
    });
  }

  /**
   * 创建渲染任务
   */
  private createRenderTasks(
    channels: ChannelDisplayInfo[],
    startSample: number,
    endSample: number,
    lodLevel: number,
    canvasWidth: number
  ): RenderTask[] {
    const tasks: RenderTask[] = [];
    const samplesPerChunk = this.config.chunkSize;

    for (const channel of channels) {
      // 将通道数据分块处理
      for (let chunkStart = startSample; chunkStart < endSample; chunkStart += samplesPerChunk) {
        const chunkEnd = Math.min(chunkStart + samplesPerChunk, endSample);

        tasks.push({
          id: `${channel.originalIndex}_${chunkStart}_${chunkEnd}_${lodLevel}`,
          channelInfo: channel,
          startSample: chunkStart,
          endSample: chunkEnd,
          lodLevel,
          priority: this.calculateTaskPriority(channel, chunkStart, chunkEnd)
        });
      }
    }

    // 按优先级排序
    tasks.sort((a, b) => b.priority - a.priority);

    return tasks;
  }

  /**
   * 计算任务优先级
   */
  private calculateTaskPriority(
    channel: ChannelDisplayInfo,
    startSample: number,
    endSample: number
  ): number {
    let priority = 100;

    // 可见通道优先级更高
    if (!channel.hidden) {
      priority += 50;
    }

    // 靠近视口中心的优先级更高
    const distanceFromCenter = Math.abs((startSample + endSample) / 2 - (startSample + endSample) / 2);
    priority -= distanceFromCenter * 0.001;

    return priority;
  }

  /**
   * 执行渲染任务
   */
  private async executeRenderTasks(tasks: RenderTask[]): Promise<void> {
    const maxConcurrent = this.config.maxConcurrentChunks;
    const executing: Promise<void>[] = [];

    for (const task of tasks) {
      // 检查缓存
      if (this.config.enableTileCache) {
        const cachedTile = this.getTileFromCache(task.id);
        if (cachedTile && cachedTile.imageData) {
          this.renderCachedTile(cachedTile);
          continue;
        }
      }

      // 限制并发数
      if (executing.length >= maxConcurrent) {
        await Promise.race(executing);
      }

      const taskPromise = this.executeRenderTask(task).then(() => {
        const index = executing.indexOf(taskPromise);
        if (index !== -1) {
          executing.splice(index, 1);
        }
      });

      executing.push(taskPromise);
    }

    // 等待所有任务完成
    await Promise.all(executing);
  }

  /**
   * 执行单个渲染任务
   */
  private async executeRenderTask(task: RenderTask): Promise<void> {
    const lodLevel = this.lodLevels[task.lodLevel];
    const { channel } = task.channelInfo;

    if (!channel.samples) {
      return;
    }

    let processedData: any;

    // 根据LOD策略处理数据
    switch (lodLevel.renderStrategy) {
      case 'full':
        processedData = this.processFullData(channel.samples, task.startSample, task.endSample);
        break;
      case 'minmax':
        processedData = await this.processMinMaxData(channel.samples, task.startSample, task.endSample);
        break;
      case 'rle':
        processedData = await this.processRLEData(channel.samples, task.startSample, task.endSample);
        break;
      case 'adaptive':
        processedData = await this.processAdaptiveData(channel.samples, task.startSample, task.endSample, lodLevel);
        break;
    }

    // 渲染数据到瓦片
    const tileData = this.renderDataToTile(processedData, task);

    // 缓存瓦片
    if (this.config.enableTileCache) {
      this.cacheTile(task.id, tileData);
    }

    // 渲染到主画布
    this.renderTileToCanvas(tileData, task);
  }

  /**
   * 处理完整数据（无压缩）
   */
  private processFullData(samples: Uint8Array, startSample: number, endSample: number): Uint8Array {
    return samples.slice(startSample, endSample);
  }

  /**
   * 处理MinMax数据（压缩）
   */
  private async processMinMaxData(
    samples: Uint8Array,
    startSample: number,
    endSample: number
  ): Promise<any> {
    const chunkSize = Math.max(1, Math.floor((endSample - startSample) / 1000));

    if (this.renderWorker) {
      return this.executeWorkerTask('minmax', {
        samples: samples.slice(startSample, endSample),
        chunkSize
      });
    } else {
      // 回退到主线程处理
      return this.processMinMaxMainThread(samples, startSample, endSample, chunkSize);
    }
  }

  /**
   * 主线程MinMax处理
   */
  private processMinMaxMainThread(
    samples: Uint8Array,
    startSample: number,
    endSample: number,
    chunkSize: number
  ): any[] {
    const result = [];

    for (let i = startSample; i < endSample; i += chunkSize) {
      const chunkEnd = Math.min(i + chunkSize, endSample);
      let min = 1, max = 0;

      for (let j = i; j < chunkEnd; j++) {
        const sample = samples[j];
        if (sample < min) min = sample;
        if (sample > max) max = sample;
      }

      result.push({ min, max, start: i, end: chunkEnd });
    }

    return result;
  }

  /**
   * 处理RLE数据
   */
  private async processRLEData(
    samples: Uint8Array,
    startSample: number,
    endSample: number
  ): Promise<any> {
    if (this.renderWorker) {
      return this.executeWorkerTask('rle', {
        samples: samples.slice(startSample, endSample)
      });
    } else {
      // 回退到主线程处理
      return this.processRLEMainThread(samples, startSample, endSample);
    }
  }

  /**
   * 主线程RLE处理
   */
  private processRLEMainThread(
    samples: Uint8Array,
    startSample: number,
    endSample: number
  ): any[] {
    const result = [];
    let current = samples[startSample];
    let count = 1;

    for (let i = startSample + 1; i < endSample; i++) {
      if (samples[i] === current) {
        count++;
      } else {
        result.push({ value: current, count, start: i - count });
        current = samples[i];
        count = 1;
      }
    }

    result.push({ value: current, count, start: endSample - count });
    return result;
  }

  /**
   * 处理自适应数据
   */
  private async processAdaptiveData(
    samples: Uint8Array,
    startSample: number,
    endSample: number,
    lodLevel: LODLevel
  ): Promise<any> {
    // 根据性能情况动态选择策略
    if (this.avgFrameTime > this.config.frameTimeTarget * 1.5) {
      // 性能不足，使用更激进的压缩
      return this.processRLEData(samples, startSample, endSample);
    } else {
      // 性能充足，使用较好的质量
      return this.processMinMaxData(samples, startSample, endSample);
    }
  }

  /**
   * 执行Worker任务
   */
  private executeWorkerTask(type: string, data: any): Promise<any> {
    if (!this.renderWorker) {
      throw new Error('Worker not available');
    }

    const taskId = `${type}_${Date.now()}_${Math.random()}`;

    return new Promise((resolve, reject) => {
      // 设置超时
      const timeoutId = setTimeout(() => {
        if (this.workerTasks.has(taskId)) {
          this.workerTasks.delete(taskId);
          reject(new Error('Worker task timeout'));
        }
      }, 5000);
      
      this.workerTasks.set(taskId, { resolve, reject, timeoutId });
      this.renderWorker!.postMessage({ taskId, type, data });
    });
  }

  /**
   * 将数据渲染到瓦片
   */
  private renderDataToTile(processedData: any, task: RenderTask): RenderTile {
    // 创建离屏Canvas用于瓦片渲染
    const tileCanvas = document.createElement('canvas');
    const tileWidth = Math.min(this.canvas.width, 1024);
    const tileHeight = task.channelInfo.height;

    tileCanvas.width = tileWidth;
    tileCanvas.height = tileHeight;

    const tileCtx = tileCanvas.getContext('2d')!;

    // 渲染逻辑（简化版）
    this.renderProcessedDataToContext(tileCtx, processedData, task, tileWidth, tileHeight);

    return {
      id: task.id,
      x: 0,
      y: task.channelInfo.yPosition,
      width: tileWidth,
      height: tileHeight,
      data: tileCtx.getImageData(0, 0, tileWidth, tileHeight),
      isDirty: false,
      startSample: task.startSample,
      endSample: task.endSample,
      lodLevel: task.lodLevel,
      channelIndex: task.channelInfo.originalIndex,
      imageData: tileCtx.getImageData(0, 0, tileWidth, tileHeight),
      lastUsed: Date.now(),
      renderTime: 0
    };
  }

  /**
   * 将处理后的数据渲染到Context
   */
  private renderProcessedDataToContext(
    ctx: CanvasRenderingContext2D,
    processedData: any,
    task: RenderTask,
    width: number,
    height: number
  ): void {
    ctx.clearRect(0, 0, width, height);

    // 根据数据类型选择渲染方法
    if (Array.isArray(processedData) && processedData[0]?.min !== undefined) {
      // MinMax数据
      this.renderMinMaxData(ctx, processedData, width, height);
    } else if (Array.isArray(processedData) && processedData[0]?.value !== undefined) {
      // RLE数据
      this.renderRLEData(ctx, processedData, width, height);
    } else {
      // 原始数据
      this.renderRawData(ctx, processedData, width, height);
    }
  }

  /**
   * 渲染MinMax数据
   */
  private renderMinMaxData(
    ctx: CanvasRenderingContext2D,
    minMaxData: any[],
    width: number,
    height: number
  ): void {
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 1;
    ctx.beginPath();

    const pixelsPerChunk = width / minMaxData.length;

    minMaxData.forEach((chunk, index) => {
      const x = index * pixelsPerChunk;

      if (chunk.min === chunk.max) {
        // 稳定信号
        const y = chunk.min ? height * 0.2 : height * 0.8;
        ctx.moveTo(x, y);
        ctx.lineTo(x + pixelsPerChunk, y);
      } else {
        // 变化信号 - 绘制垂直线表示变化
        ctx.moveTo(x, height * 0.2);
        ctx.lineTo(x, height * 0.8);
      }
    });

    ctx.stroke();
  }

  /**
   * 渲染RLE数据
   */
  private renderRLEData(
    ctx: CanvasRenderingContext2D,
    rleData: any[],
    width: number,
    height: number
  ): void {
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 1;
    ctx.beginPath();

    let currentX = 0;
    const totalSamples = rleData.reduce((sum, segment) => sum + segment.count, 0);

    rleData.forEach(segment => {
      const segmentWidth = (segment.count / totalSamples) * width;
      const y = segment.value ? height * 0.2 : height * 0.8;

      ctx.moveTo(currentX, y);
      ctx.lineTo(currentX + segmentWidth, y);

      currentX += segmentWidth;
    });

    ctx.stroke();
  }

  /**
   * 渲染原始数据
   */
  private renderRawData(
    ctx: CanvasRenderingContext2D,
    rawData: Uint8Array,
    width: number,
    height: number
  ): void {
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 1;
    ctx.beginPath();

    const pixelsPerSample = width / rawData.length;

    for (let i = 0; i < rawData.length; i++) {
      const x = i * pixelsPerSample;
      const y = rawData[i] ? height * 0.2 : height * 0.8;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  }

  /**
   * 缓存瓦片
   */
  private cacheTile(tileId: string, tile: RenderTile): void {
    // 检查缓存大小限制
    if (tile.imageData) {
      const tileSize = tile.imageData.width * tile.imageData.height * 4; // RGBA

      while (this.tileCacheSize + tileSize > this.config.tileCacheSize * 1024 * 1024) {
        this.evictOldestTile();
      }

      this.tileCache.set(tileId, tile);
      this.tileCacheSize += tileSize;
    }
  }

  /**
   * 从缓存获取瓦片
   */
  private getTileFromCache(tileId: string): RenderTile | null {
    const tile = this.tileCache.get(tileId);
    if (tile) {
      tile.lastUsed = Date.now();
      return tile;
    }
    return null;
  }

  /**
   * 淘汰最旧的瓦片
   */
  private evictOldestTile(): void {
    let oldestTile: RenderTile | null = null;
    let oldestTileId = '';

    for (const [tileId, tile] of this.tileCache) {
      if (!oldestTile || tile.lastUsed < oldestTile.lastUsed) {
        oldestTile = tile;
        oldestTileId = tileId;
      }
    }

    if (oldestTile && oldestTile.imageData) {
      const tileSize = oldestTile.imageData.width * oldestTile.imageData.height * 4;
      this.tileCacheSize -= tileSize;
      this.tileCache.delete(oldestTileId);
    }
  }

  /**
   * 渲染缓存的瓦片
   */
  private renderCachedTile(tile: RenderTile): void {
    if (tile.imageData) {
      this.ctx.putImageData(tile.imageData, 0, 0); // 简化的位置计算
    }
  }

  /**
   * 将瓦片渲染到主画布
   */
  private renderTileToCanvas(tile: RenderTile, task: RenderTask): void {
    if (tile.imageData) {
      const x = 0; // 简化的X位置计算
      const y = task.channelInfo.yPosition;

      this.ctx.putImageData(tile.imageData, x, y);
    }
  }

  /**
   * 更新性能统计
   */
  private updatePerformanceStats(renderTime: number): void {
    this.frameTimeHistory.push(renderTime);

    // 保持历史记录在合理范围内
    if (this.frameTimeHistory.length > 60) {
      this.frameTimeHistory.shift();
    }

    // 计算平均帧时间
    this.avgFrameTime = this.frameTimeHistory.reduce((sum, time) => sum + time, 0) / this.frameTimeHistory.length;
  }

  /**
   * 获取性能统计
   */
  public getPerformanceStats(): any {
    return {
      avgFrameTime: this.avgFrameTime,
      currentLOD: this.currentLOD,
      cacheSize: this.tileCacheSize,
      cacheHitRate: this.calculateCacheHitRate()
    };
  }

  /**
   * 计算缓存命中率
   */
  private calculateCacheHitRate(): number {
    // 简化实现，实际应该跟踪缓存命中和未命中次数
    return this.tileCache.size > 0 ? 0.8 : 0;
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    // 清理Web Worker
    if (this.renderWorker) {
      this.renderWorker.terminate();
      this.renderWorker = null;
    }

    // 清理缓存
    this.tileCache.clear();
    this.tileCacheSize = 0;

    // 清理任务队列和超时定时器
    this.renderQueue = [];
    
    // 清理所有待处理任务的超时定时器
    for (const task of this.workerTasks.values()) {
      clearTimeout(task.timeoutId);
    }
    this.workerTasks.clear();
  }
}

// 辅助接口
interface RenderTask {
  id: string;
  channelInfo: ChannelDisplayInfo;
  startSample: number;
  endSample: number;
  lodLevel: number;
  priority: number;
}
