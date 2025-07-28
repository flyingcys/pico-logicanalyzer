/**
 * Canvas波形渲染引擎
 * 基于原版 LogicAnalyzer SampleViewer 的精确 TypeScript 实现
 * 严格遵循原版的架构设计和渲染逻辑
 */

import {
  UnifiedCaptureData,
  ViewRange,
  RenderParams,
  ChannelInfo
} from '../../models/UnifiedDataFormat';
import { AnalyzerChannel } from '../../models/CaptureModels';

// 基于原版的接口定义
export interface ISampleDisplay {
  firstSample: number;
  visibleSamples: number;
  updateVisibleSamples(firstSample: number, visibleSamples: number): void;
}

export interface IRegionDisplay {
  regions: SampleRegion[];
  addRegion(region: SampleRegion): void;
  addRegions(regions: SampleRegion[]): void;
  removeRegion(region: SampleRegion): boolean;
  clearRegions(): void;
}

export interface IMarkerDisplay {
  userMarker: number | null;
  setUserMarker(marker: number | null): void;
}

// 基于原版的数据结构
export interface SampleRegion {
  firstSample: number;
  lastSample: number;
  sampleCount: number; // Math.abs(lastSample - firstSample)
  regionName: string;
  regionColor: string; // CSS color string
}

export interface Interval {
  value: boolean;
  start: number;
  end: number;
  duration: number; // 时间 (秒)
}

export interface ChannelRenderStatus {
  firstSample: number;
  sampleCount: number;
  value: number; // 0 or 1
}

// 渲染统计信息
export interface RenderStats {
  renderTime: number; // 渲染耗时 (ms)
  samplesRendered: number; // 渲染的样本数
  fps: number; // 帧率
  memoryUsage: number; // 内存占用 (MB)
}

// 波形渲染配置
export interface WaveformConfig {
  colors: AnalyzerColors;
  channelHeight: number;
  minChannelHeight: number;
  lineWidth: number;
  showSamplePoints: boolean;
  enableOptimization: boolean;
  refreshRate: number; // FPS
}

// 颜色配置 - 基于原版 AnalyzerColors
export interface AnalyzerColors {
  bgChannelColors: string[]; // 交替背景颜色
  palette: string[]; // 通道颜色调色板
  sampleLineColor: string; // 采样线颜色
  sampleDashColor: string; // 采样虚线颜色
  triggerLineColor: string; // 触发线颜色
  burstLineColor: string; // 突发线颜色
  userLineColor: string; // 用户标记线颜色
  errorColor: string;
  textColor: string;
}

export class WaveformRenderer implements ISampleDisplay, IRegionDisplay, IMarkerDisplay {
  // 基于原版的核心属性
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  // 基于原版的数据属性
  private channels: AnalyzerChannel[] | null = null;
  private intervals: Interval[][] = []; // 每个通道的时间间隔
  private sampleFrequency = 0; // 采样频率
  
  // ISampleDisplay 接口实现
  public firstSample = 0;
  public visibleSamples = 0;
  
  // IRegionDisplay 接口实现
  public regions: SampleRegion[] = [];
  
  // IMarkerDisplay 接口实现
  public userMarker: number | null = null;
  
  // 其他关键属性
  public preSamples = 0; // 触发前样本数
  public bursts: number[] | null = null; // 突发采集位置
  
  // 控制标志
  private updating = false;
  
  // 样式配置 - 基于原版
  private readonly MIN_CHANNEL_HEIGHT = 48;
  private colors: AnalyzerColors = {
    bgChannelColors: ['#242424', '#1c1c1c'],
    palette: [
      '#ff7333', '#33ff57', '#3357ff', '#ff33a1', '#ffbd33', '#33fff6',
      '#bd33ff', '#57ff33', '#5733ff', '#33ffbd', '#ff33bd', '#ff5733'
      // 简化调色板，实际可扩展至64色
    ],
    sampleLineColor: '#3c3c3c',
    sampleDashColor: '#3c3c3c60',
    triggerLineColor: '#ffffff',
    burstLineColor: '#f0ffff',
    userLineColor: '#00ffff',
    errorColor: '#ff0000',
    textColor: '#ffffff'
  };
  
  // 性能监控
  private renderStats: RenderStats = {
    renderTime: 0,
    samplesRendered: 0,
    fps: 0,
    memoryUsage: 0
  };
  
  // 动画控制
  private lastFrameTime = 0;
  private frameCount = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法获取Canvas 2D上下文');
    }
    this.ctx = ctx;
    
    this.setupCanvasSettings();
    this.setupEventListeners();
  }
  
  /**
   * 设置事件监听器 - 基于原版的鼠标交互
   */
  private setupEventListeners(): void {
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mouseenter', this.onMouseEnter.bind(this));
    this.canvas.addEventListener('mouseleave', this.onMouseLeave.bind(this));
  }
  
  /**
   * 鼠标移动事件处理 - 基于原版的tooltip功能
   */
  private onMouseMove(event: MouseEvent): void {
    if (this.intervals.length === 0 || !this.channels) {
      return;
    }
    
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const sampleWidth = rect.width / this.visibleSamples;
    const curSample = Math.floor(x / sampleWidth) + this.firstSample;
    
    const visibleChannels = this.channels.filter(c => !c.hidden);
    const curChan = Math.floor(y / (rect.height / visibleChannels.length));
    
    if (curChan >= visibleChannels.length) {
      return;
    }
    
    const chan = visibleChannels[curChan];
    let idx = -1;
    for (let i = 0; i < this.channels.length; i++) {
      if (this.channels[i] === chan) {
        idx = i;
        break;
      }
    }
    
    if (idx === -1) {
      return;
    }
    
    const interval = this.intervals[idx].find(i => i.start <= curSample && i.end > curSample);
    
    if (interval) {
      const duration = this.formatTime(interval.duration);
      const sampleCount = interval.end - interval.start;
      const tooltip = `State: ${interval.value ? 'High' : 'Low'}\nLength: ${duration} (${sampleCount} samples)`;
      
      this.showTooltip(tooltip, event.clientX, event.clientY);
    } else {
      this.hideTooltip();
    }
  }
  
  private onMouseEnter(event: MouseEvent): void {
    // 可以添加鼠标进入处理
  }
  
  private onMouseLeave(event: MouseEvent): void {
    this.hideTooltip();
  }
  
  /**
   * 显示tooltip - 简单实现
   */
  private showTooltip(text: string, x: number, y: number): void {
    // 简单的tooltip实现，可以后续扩展为更复杂的UI组件
    const existingTooltip = document.getElementById('waveform-tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
    }
    
    const tooltip = document.createElement('div');
    tooltip.id = 'waveform-tooltip';
    tooltip.style.position = 'fixed';
    tooltip.style.left = `${x + 10}px`;
    tooltip.style.top = `${y - 10}px`;
    tooltip.style.background = 'rgba(0, 0, 0, 0.8)';
    tooltip.style.color = 'white';
    tooltip.style.padding = '4px 8px';
    tooltip.style.borderRadius = '4px';
    tooltip.style.fontSize = '12px';
    tooltip.style.fontFamily = 'monospace';
    tooltip.style.zIndex = '1000';
    tooltip.style.whiteSpace = 'pre-line';
    tooltip.textContent = text;
    
    document.body.appendChild(tooltip);
  }
  
  /**
   * 隐藏tooltip
   */
  private hideTooltip(): void {
    const tooltip = document.getElementById('waveform-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  }
  
  /**
   * 格式化时间显示
   */
  private formatTime(seconds: number): string {
    if (seconds < 1e-6) {
      return `${(seconds * 1e9).toFixed(2)} ns`;
    } else if (seconds < 1e-3) {
      return `${(seconds * 1e6).toFixed(2)} µs`;
    } else if (seconds < 1) {
      return `${(seconds * 1e3).toFixed(2)} ms`;
    } else {
      return `${seconds.toFixed(2)} s`;
    }
  }

  /**
   * 设置通道数据和采样频率 - 基于原版的 SetChannels 方法
   */
  public setChannels(channels: AnalyzerChannel[] | null, sampleFrequency: number): void {
    this.channels = channels;
    this.sampleFrequency = sampleFrequency;
    
    this.computeIntervals();
    this.invalidateVisual();
  }
  
  /**
   * 计算时间间隔 - 基于原版的 ComputeIntervals 方法
   */
  private computeIntervals(): void {
    this.intervals = [];
    
    if (!this.channels) {
      return;
    }
    
    for (let channelIndex = 0; channelIndex < this.channels.length; channelIndex++) {
      const channel = this.channels[channelIndex];
      const channelIntervals: Interval[] = [];
      
      if (!channel.samples || channel.samples.length === 0) {
        this.intervals.push(channelIntervals);
        continue;
      }
      
      let lastSample = channel.samples[0];
      let lastSampleIndex = 0;
      
      for (let curSample = 1; curSample < channel.samples.length; curSample++) {
        const sample = channel.samples[curSample];
        
        if (sample !== lastSample) {
          const interval: Interval = {
            value: lastSample !== 0,
            start: lastSampleIndex,
            end: curSample,
            duration: (curSample - lastSampleIndex) / this.sampleFrequency
          };
          
          channelIntervals.push(interval);
          
          lastSample = sample;
          lastSampleIndex = curSample;
        }
      }
      
      // 添加最后一个间隔
      const lastInterval: Interval = {
        value: lastSample !== 0,
        start: lastSampleIndex,
        end: channel.samples.length,
        duration: (channel.samples.length - lastSampleIndex) / this.sampleFrequency
      };
      
      channelIntervals.push(lastInterval);
      this.intervals.push(channelIntervals);
    }
  }

  /**
   * 设置Canvas渲染参数
   */
  private setupCanvasSettings(): void {
    // 高DPI支持
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    this.ctx.scale(dpr, dpr);

    // 基本渲染设置
    this.ctx.imageSmoothingEnabled = false; // 数字信号通常不需要平滑
    this.ctx.lineCap = 'square';
    this.ctx.lineJoin = 'miter';
  }
  
  /**
   * 开始更新 - 基于原版的 BeginUpdate
   */
  public beginUpdate(): void {
    this.updating = true;
  }
  
  /**
   * 结束更新 - 基于原版的 EndUpdate
   */
  public endUpdate(): void {
    this.updating = false;
    this.invalidateVisual();
  }
  
  /**
   * 触发重绘 - 基于原版的 InvalidateVisual
   */
  public invalidateVisual(): void {
    if (!this.updating) {
      requestAnimationFrame(() => this.render());
    }
  }

  /**
   * 主渲染方法 - 基于原版的 Render 方法
   */
  public render(): RenderStats {
    const startTime = performance.now();
    
    if (!this.channels || this.channels.length === 0 || 
        !this.channels[0].samples || this.channels[0].samples.length === 0) {
      return this.renderStats;
    }
    
    const visibleChannels = this.channels.filter(c => !c.hidden);
    const channelCount = visibleChannels.length;
    
    if (channelCount === 0) {
      return this.renderStats;
    }
    
    // 更新最小高度
    const minSize = channelCount * this.MIN_CHANNEL_HEIGHT;
    if (this.canvas.parentElement && parseFloat(this.canvas.style.minHeight || '0') !== minSize) {
      this.canvas.style.minHeight = `${minSize}px`;
    }
    
    // 计算显示参数
    const canvasRect = this.canvas.getBoundingClientRect();
    const canvasWidth = canvasRect.width;
    const canvasHeight = canvasRect.height;
    
    if (this.visibleSamples === 0 || this.updating) {
      return this.renderStats;
    }
    
    const channelHeight = canvasHeight / channelCount;
    const sampleWidth = canvasWidth / this.visibleSamples;
    const margin = channelHeight / 5;
    
    const lastSample = Math.min(this.visibleSamples + this.firstSample, 
                                visibleChannels[0].samples!.length);
    
    // 清除画布
    this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // 绘制背景 - 交替颜色
    for (let chan = 0; chan < channelCount; chan++) {
      this.ctx.fillStyle = this.colors.bgChannelColors[chan % 2];
      this.ctx.fillRect(0, chan * channelHeight, canvasWidth, channelHeight);
    }
    
    // 绘制区域高亮
    this.renderRegions(sampleWidth, canvasHeight);
    
    // 准备通道渲染状态
    const renders: ChannelRenderStatus[] = new Array(channelCount);
    
    // 主要采样循环 - 基于原版的逐样本渲染逻辑
    for (let curSample = this.firstSample; curSample < lastSample; curSample++) {
      const lineX = (curSample - this.firstSample) * sampleWidth;
      
      // 绘制采样线 (在低缩放级别)
      if (this.visibleSamples < 201) {
        this.ctx.strokeStyle = this.colors.sampleLineColor;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(lineX + sampleWidth / 2, 0);
        this.ctx.lineTo(lineX + sampleWidth / 2, canvasHeight);
        this.ctx.stroke();
        
        if (this.visibleSamples < 101) {
          this.ctx.strokeStyle = this.colors.sampleDashColor;
          this.ctx.beginPath();
          this.ctx.moveTo(lineX, 0);
          this.ctx.lineTo(lineX, canvasHeight);
          this.ctx.stroke();
        }
      }
      
      // 绘制触发线
      if (curSample === this.preSamples) {
        this.ctx.strokeStyle = this.colors.triggerLineColor;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(lineX, 0);
        this.ctx.lineTo(lineX, canvasHeight);
        this.ctx.stroke();
      }
      
      // 绘制突发线
      if (this.bursts && this.bursts.includes(curSample)) {
        this.ctx.strokeStyle = this.colors.burstLineColor;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 3]);
        this.ctx.beginPath();
        this.ctx.moveTo(lineX, 0);
        this.ctx.lineTo(lineX, canvasHeight);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }
      
      // 绘制用户标记线
      if (this.userMarker !== null && this.userMarker === curSample) {
        this.ctx.strokeStyle = this.colors.userLineColor;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 3]);
        this.ctx.beginPath();
        this.ctx.moveTo(lineX, 0);
        this.ctx.lineTo(lineX, canvasHeight);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }
      
      // 处理通道渲染状态
      if (curSample === this.firstSample) {
        // 初始化渲染状态
        for (let chan = 0; chan < channelCount; chan++) {
          renders[chan] = {
            firstSample: curSample,
            sampleCount: 1,
            value: visibleChannels[chan].samples![curSample]
          };
        }
      } else {
        // 检查状态变化
        for (let chan = 0; chan < channelCount; chan++) {
          const currentValue = visibleChannels[chan].samples![curSample];
          
          if (renders[chan].value !== currentValue) {
            // 渲染之前的状态
            this.renderChannelSegment(renders[chan], chan, visibleChannels[chan], 
                                    channelHeight, margin, sampleWidth);
            
            // 更新状态
            renders[chan] = {
              firstSample: curSample,
              sampleCount: 1,
              value: currentValue
            };
          } else {
            renders[chan].sampleCount++;
          }
        }
      }
    }
    
    // 渲染最后的状态段
    for (let chan = 0; chan < channelCount; chan++) {
      this.renderChannelSegment(renders[chan], chan, visibleChannels[chan], 
                               channelHeight, margin, sampleWidth);
    }
    
    // 如果用户标记在最后一个样本位置
    if (this.userMarker !== null && this.userMarker === lastSample) {
      const lineX = (lastSample - this.firstSample) * sampleWidth;
      this.ctx.strokeStyle = this.colors.userLineColor;
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 3]);
      this.ctx.beginPath();
      this.ctx.moveTo(lineX, 0);
      this.ctx.lineTo(lineX, canvasHeight);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
    
    // 更新统计信息
    const endTime = performance.now();
    this.renderStats.renderTime = endTime - startTime;
    this.renderStats.samplesRendered = (lastSample - this.firstSample) * channelCount;
    this.updateFPS();
    
    return { ...this.renderStats };
  }

  /**
   * 渲染通道段 - 基于原版的通道渲染逻辑
   */
  private renderChannelSegment(
    render: ChannelRenderStatus, 
    channelIndex: number, 
    channel: AnalyzerChannel,
    channelHeight: number, 
    margin: number, 
    sampleWidth: number
  ): void {
    const yHi = channelIndex * channelHeight + margin;
    const yLo = yHi + channelHeight - margin * 2;
    
    const xStart = (render.firstSample - this.firstSample) * sampleWidth;
    const xEnd = render.sampleCount * sampleWidth + xStart;
    
    // 获取通道颜色
    const channelColor = this.getChannelColor(channel);
    
    this.ctx.strokeStyle = channelColor;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    
    // 绘制水平线
    if (render.value !== 0) {
      this.ctx.moveTo(xStart, yHi);
      this.ctx.lineTo(xEnd, yHi);
    } else {
      this.ctx.moveTo(xStart, yLo);
      this.ctx.lineTo(xEnd, yLo);
    }
    
    // 绘制垂直转换线 (在状态变化点)
    if (render.sampleCount === 1) {
      this.ctx.moveTo(xEnd, yHi);
      this.ctx.lineTo(xEnd, yLo);
    }
    
    this.ctx.stroke();
  }
  
  /**
   * 获取通道颜色 - 基于原版的颜色逻辑
   */
  private getChannelColor(channel: AnalyzerChannel): string {
    if (channel.channelColor !== null && channel.channelColor !== undefined) {
      // 如果通道有自定义颜色，转换为CSS颜色
      const colorValue = channel.channelColor;
      const r = (colorValue >> 16) & 0xFF;
      const g = (colorValue >> 8) & 0xFF;
      const b = colorValue & 0xFF;
      return `rgb(${r}, ${g}, ${b})`;
    }
    
    // 使用调色板颜色
    return this.colors.palette[channel.channelNumber % this.colors.palette.length];
  }
  
  /**
   * 渲染区域高亮 - 基于原版的区域显示
   */
  private renderRegions(sampleWidth: number, canvasHeight: number): void {
    for (const region of this.regions) {
      const first = Math.min(region.firstSample, region.lastSample);
      const start = (first - this.firstSample) * sampleWidth;
      const end = sampleWidth * region.sampleCount;
      
      this.ctx.fillStyle = region.regionColor;
      this.ctx.fillRect(start, 0, end, canvasHeight);
    }
  }

  // ISampleDisplay 接口实现
  public updateVisibleSamples(firstSample: number, visibleSamples: number): void {
    this.firstSample = firstSample;
    this.visibleSamples = visibleSamples;
    
    if (!this.updating) {
      this.invalidateVisual();
    }
  }
  
  // IRegionDisplay 接口实现
  public addRegion(region: SampleRegion): void {
    this.regions.push(region);
    this.invalidateVisual();
  }
  
  public addRegions(regions: SampleRegion[]): void {
    this.regions.push(...regions);
    this.invalidateVisual();
  }
  
  public removeRegion(region: SampleRegion): boolean {
    const index = this.regions.indexOf(region);
    if (index !== -1) {
      this.regions.splice(index, 1);
      this.invalidateVisual();
      return true;
    }
    return false;
  }
  
  public clearRegions(): void {
    this.regions = [];
    this.invalidateVisual();
  }
  
  // IMarkerDisplay 接口实现
  public setUserMarker(marker: number | null): void {
    this.userMarker = marker;
    
    if (!this.updating) {
      this.invalidateVisual();
    }
  }


  /**
   * 更新FPS统计
   */
  private updateFPS(): void {
    const now = performance.now();
    if (this.lastFrameTime > 0) {
      const delta = now - this.lastFrameTime;
      this.renderStats.fps = 1000 / delta;
    }
    this.lastFrameTime = now;
    this.frameCount++;
  }
  
  /**
   * 更新颜色配置
   */
  public updateColors(colors: Partial<AnalyzerColors>): void {
    this.colors = { ...this.colors, ...colors };
    this.invalidateVisual();
  }
  
  /**
   * 设置突发数据
   */
  public setBursts(bursts: number[] | null): void {
    this.bursts = bursts;
    this.invalidateVisual();
  }
  
  /**
   * 设置触发前样本数
   */
  public setPreSamples(preSamples: number): void {
    this.preSamples = preSamples;
    this.invalidateVisual();
  }

  /**
   * 获取渲染统计
   */
  public getRenderStats(): RenderStats {
    return { ...this.renderStats };
  }
  
  /**
   * 清理资源
   */
  public dispose(): void {
    // 移除事件监听器
    this.canvas.removeEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.removeEventListener('mouseenter', this.onMouseEnter.bind(this));
    this.canvas.removeEventListener('mouseleave', this.onMouseLeave.bind(this));
    
    // 清理tooltip
    this.hideTooltip();
    
    // 清理数据
    this.channels = null;
    this.intervals = [];
    this.regions = [];
  }
  
  /**
   * 重新调整Canvas大小
   */
  public resize(): void {
    this.setupCanvasSettings();
    this.invalidateVisual();
  }
}
