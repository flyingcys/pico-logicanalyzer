/**
 * 标记工具 - 基于原版的SampleMarker功能
 * 处理用户标记、时间测量和分析功能
 */

import { AnalyzerChannel } from '../../models/CaptureModels';

export interface Marker {
  id: string;
  name: string;
  sample: number;
  timestamp: number; // 时间戳（秒）
  color: string;
  type: 'user' | 'trigger' | 'burst' | 'cursor' | 'measurement';
  visible: boolean;
  locked: boolean; // 是否锁定位置
  description?: string;
  channelIndex?: number; // 关联的通道索引
}

export interface MarkerPair {
  id: string;
  startMarker: Marker;
  endMarker: Marker;
  name: string;
  color: string;
  measurementType: 'time' | 'frequency' | 'pulse_width' | 'period' | 'custom';
  visible: boolean;
}

export interface MeasurementResult {
  id: string;
  type: 'time' | 'frequency' | 'pulse_width' | 'period' | 'custom';
  value: number;
  unit: string;
  displayText: string;
  startSample: number;
  endSample: number;
  sampleRate: number;
  accuracy: number; // 测量精度
}

export interface MarkerConfig {
  showLabels: boolean;
  showValues: boolean;
  labelFont: string;
  labelSize: number;
  markerWidth: number;
  snapToEdge: boolean; // 是否自动吸附到边沿
  snapTolerance: number; // 吸附容差
  enableDragging: boolean;
  showCrosshair: boolean;
}

export class MarkerTools {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: MarkerConfig;

  // 标记管理
  private markers: Map<string, Marker> = new Map();
  private markerPairs: Map<string, MarkerPair> = new Map();
  private nextMarkerId = 1;

  // 交互状态
  private draggedMarker: Marker | null = null;
  private dragOffset = { x: 0, y: 0 };
  private hoveredMarker: Marker | null = null;

  // 采样和时间信息
  private sampleRate = 1000000; // 默认1MHz
  private firstSample = 0;
  private visibleSamples = 1000;
  private channels: AnalyzerChannel[] = [];

  // 事件监听器
  private eventListeners: Map<string, ((data: any) => void)[]> = new Map();

  constructor(canvas: HTMLCanvasElement, config: Partial<MarkerConfig> = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.config = {
      showLabels: true,
      showValues: true,
      labelFont: 'Arial',
      labelSize: 12,
      markerWidth: 2,
      snapToEdge: true,
      snapTolerance: 5,
      enableDragging: true,
      showCrosshair: true,
      ...config
    };
  }

  /**
   * 初始化事件监听器
   */
  public initializeEventListeners(): void {
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('click', this.handleClick.bind(this));
    this.canvas.addEventListener('dblclick', this.handleDoubleClick.bind(this));
    this.canvas.addEventListener('contextmenu', this.handleContextMenu.bind(this));
  }

  /**
   * 设置采样信息
   */
  public setSampleInfo(sampleRate: number, firstSample: number, visibleSamples: number, channels: AnalyzerChannel[]): void {
    this.sampleRate = sampleRate;
    this.firstSample = firstSample;
    this.visibleSamples = visibleSamples;
    this.channels = channels;
  }

  /**
   * 添加标记
   */
  public addMarker(sample: number, type: Marker['type'] = 'user', name?: string, color?: string): Marker {
    const id = `marker_${this.nextMarkerId++}`;
    const timestamp = sample / this.sampleRate;

    const marker: Marker = {
      id,
      name: name || `标记 ${this.nextMarkerId - 1}`,
      sample,
      timestamp,
      color: color || this.getDefaultMarkerColor(type),
      type,
      visible: true,
      locked: false
    };

    this.markers.set(id, marker);
    this.emit('marker-added', marker);
    this.render();

    return marker;
  }

  /**
   * 移除标记
   */
  public removeMarker(markerId: string): boolean {
    const marker = this.markers.get(markerId);
    if (!marker) {
      return false;
    }

    this.markers.delete(markerId);
    this.emit('marker-removed', marker);
    this.render();

    return true;
  }

  /**
   * 更新标记位置
   */
  public updateMarker(markerId: string, sample: number): boolean {
    const marker = this.markers.get(markerId);
    if (!marker || marker.locked) {
      return false;
    }

    marker.sample = sample;
    marker.timestamp = sample / this.sampleRate;

    this.emit('marker-updated', marker);
    this.render();

    return true;
  }

  /**
   * 创建标记对
   */
  public createMarkerPair(startSample: number, endSample: number, type: MarkerPair['measurementType'] = 'time'): MarkerPair {
    const startMarker = this.addMarker(startSample, 'cursor', '开始', '#00ff00');
    const endMarker = this.addMarker(endSample, 'cursor', '结束', '#ff0000');

    const id = `pair_${this.nextMarkerId++}`;
    const pair: MarkerPair = {
      id,
      startMarker,
      endMarker,
      name: `测量对 ${this.nextMarkerId - 1}`,
      color: '#409eff',
      measurementType: type,
      visible: true
    };

    this.markerPairs.set(id, pair);
    this.emit('marker-pair-created', pair);
    this.render();

    return pair;
  }

  /**
   * 测量标记对之间的值
   */
  public measureMarkerPair(pairId: string): MeasurementResult | null {
    const pair = this.markerPairs.get(pairId);
    if (!pair) {
      return null;
    }

    const startSample = Math.min(pair.startMarker.sample, pair.endMarker.sample);
    const endSample = Math.max(pair.startMarker.sample, pair.endMarker.sample);
    const sampleDiff = endSample - startSample;

    let value: number;
    let unit: string;
    let displayText: string;

    switch (pair.measurementType) {
      case 'time':
        value = sampleDiff / this.sampleRate;
        unit = this.getTimeUnit(value);
        displayText = this.formatTime(value);
        break;

      case 'frequency':
        const period = sampleDiff / this.sampleRate;
        value = period > 0 ? 1 / period : 0;
        unit = 'Hz';
        displayText = this.formatFrequency(value);
        break;

      case 'custom':
        value = sampleDiff;
        unit = 'samples';
        displayText = `${sampleDiff} 样本`;
        break;

      default:
        value = sampleDiff / this.sampleRate;
        unit = 's';
        displayText = this.formatTime(value);
    }

    const result: MeasurementResult = {
      id: `measurement_${Date.now()}`,
      type: pair.measurementType,
      value,
      unit,
      displayText,
      startSample,
      endSample,
      sampleRate: this.sampleRate,
      accuracy: this.calculateAccuracy(sampleDiff)
    };

    this.emit('measurement-completed', result);
    return result;
  }

  /**
   * 渲染所有标记
   */
  public render(): void {
    // 清除画布
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 渲染标记对
    for (const pair of this.markerPairs.values()) {
      if (pair.visible) {
        this.renderMarkerPair(pair);
      }
    }

    // 渲染单个标记
    for (const marker of this.markers.values()) {
      if (marker.visible) {
        this.renderMarker(marker);
      }
    }

    // 渲染十字游标
    if (this.config.showCrosshair && this.hoveredMarker) {
      this.renderCrosshair();
    }
  }

  /**
   * 渲染单个标记
   */
  private renderMarker(marker: Marker): void {
    const x = this.sampleToCanvasX(marker.sample);

    if (x < 0 || x > this.canvas.width) {
      return; // 标记不在可见范围内
    }

    this.ctx.save();

    // 绘制标记线
    this.ctx.strokeStyle = marker.color;
    this.ctx.lineWidth = this.config.markerWidth;
    this.ctx.setLineDash(marker.type === 'trigger' ? [5, 5] : []);

    this.ctx.beginPath();
    this.ctx.moveTo(x, 0);
    this.ctx.lineTo(x, this.canvas.height);
    this.ctx.stroke();

    // 绘制标记标签
    if (this.config.showLabels) {
      this.renderMarkerLabel(marker, x);
    }

    // 绘制标记值
    if (this.config.showValues) {
      this.renderMarkerValue(marker, x);
    }

    this.ctx.restore();
  }

  /**
   * 渲染标记对
   */
  private renderMarkerPair(pair: MarkerPair): void {
    const startX = this.sampleToCanvasX(pair.startMarker.sample);
    const endX = this.sampleToCanvasX(pair.endMarker.sample);

    if (Math.max(startX, endX) < 0 || Math.min(startX, endX) > this.canvas.width) {
      return; // 标记对不在可见范围内
    }

    this.ctx.save();

    // 绘制测量区域
    const leftX = Math.min(startX, endX);
    const rightX = Math.max(startX, endX);

    this.ctx.fillStyle = `${pair.color}20`; // 半透明填充
    this.ctx.fillRect(leftX, 0, rightX - leftX, this.canvas.height);

    // 绘制边界线
    this.ctx.strokeStyle = pair.color;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([]);

    this.ctx.beginPath();
    this.ctx.moveTo(leftX, 0);
    this.ctx.lineTo(leftX, this.canvas.height);
    this.ctx.moveTo(rightX, 0);
    this.ctx.lineTo(rightX, this.canvas.height);
    this.ctx.stroke();

    // 绘制测量结果
    const measurement = this.measureMarkerPair(pair.id);
    if (measurement) {
      this.renderMeasurementResult(measurement, leftX, rightX);
    }

    this.ctx.restore();
  }

  /**
   * 渲染标记标签
   */
  private renderMarkerLabel(marker: Marker, x: number): void {
    this.ctx.font = `${this.config.labelSize}px ${this.config.labelFont}`;
    this.ctx.fillStyle = marker.color;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';

    const text = marker.name;
    const textWidth = this.ctx.measureText(text).width;

    // 绘制标签背景
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.fillRect(x - textWidth / 2 - 2, 5, textWidth + 4, this.config.labelSize + 4);

    // 绘制标签文本
    this.ctx.fillStyle = marker.color;
    this.ctx.fillText(text, x, 7);
  }

  /**
   * 渲染标记值
   */
  private renderMarkerValue(marker: Marker, x: number): void {
    this.ctx.font = `${this.config.labelSize - 2}px ${this.config.labelFont}`;
    this.ctx.fillStyle = '#666666';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';

    const timeText = this.formatTime(marker.timestamp);
    const sampleText = `样本: ${marker.sample}`;

    this.ctx.fillText(timeText, x, this.config.labelSize + 15);
    this.ctx.fillText(sampleText, x, this.config.labelSize + 30);
  }

  /**
   * 渲染测量结果
   */
  private renderMeasurementResult(measurement: MeasurementResult, leftX: number, rightX: number): void {
    const centerX = (leftX + rightX) / 2;
    const y = this.canvas.height / 2;

    this.ctx.font = `bold ${this.config.labelSize + 2}px ${this.config.labelFont}`;
    this.ctx.fillStyle = '#409eff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const text = measurement.displayText;
    const textWidth = this.ctx.measureText(text).width;

    // 绘制结果背景
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    this.ctx.fillRect(centerX - textWidth / 2 - 5, y - this.config.labelSize / 2 - 2, textWidth + 10, this.config.labelSize + 4);

    // 绘制边框
    this.ctx.strokeStyle = '#409eff';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(centerX - textWidth / 2 - 5, y - this.config.labelSize / 2 - 2, textWidth + 10, this.config.labelSize + 4);

    // 绘制结果文本
    this.ctx.fillStyle = '#409eff';
    this.ctx.fillText(text, centerX, y);
  }

  /**
   * 渲染十字游标
   */
  private renderCrosshair(): void {
    // 这里可以实现十字游标的渲染逻辑
    // 暂时先留空，可以在后续需要时实现
  }

  /**
   * 鼠标事件处理
   */
  private handleMouseDown(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const marker = this.getMarkerAtPosition(x, y);
    if (marker && this.config.enableDragging && !marker.locked) {
      this.draggedMarker = marker;
      this.dragOffset.x = x - this.sampleToCanvasX(marker.sample);
      this.dragOffset.y = y;
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (this.draggedMarker) {
      // 拖拽标记
      const newX = x - this.dragOffset.x;
      const newSample = this.canvasXToSample(newX);

      if (this.config.snapToEdge) {
        const snappedSample = this.snapToNearestEdge(newSample);
        this.updateMarker(this.draggedMarker.id, snappedSample);
      } else {
        this.updateMarker(this.draggedMarker.id, newSample);
      }

      this.canvas.style.cursor = 'grabbing';
    } else {
      // 检查悬停状态
      const hoveredMarker = this.getMarkerAtPosition(x, y);
      if (hoveredMarker !== this.hoveredMarker) {
        this.hoveredMarker = hoveredMarker;
        this.canvas.style.cursor = hoveredMarker ? 'grab' : 'default';
        this.render();
      }
    }
  }

  private handleMouseUp(event: MouseEvent): void {
    if (this.draggedMarker) {
      this.emit('marker-drag-end', this.draggedMarker);
      this.draggedMarker = null;
      this.canvas.style.cursor = 'default';
    }
  }

  private handleClick(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const sample = this.canvasXToSample(x);

    if (event.ctrlKey || event.metaKey) {
      // Ctrl+点击创建新标记
      this.addMarker(sample, 'user');
    }
  }

  private handleDoubleClick(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const sample = this.canvasXToSample(x);

    // 双击创建测量对
    const existingMarkers = Array.from(this.markers.values()).filter(m => m.type === 'cursor');
    if (existingMarkers.length === 1) {
      this.createMarkerPair(existingMarkers[0].sample, sample);
    }
  }

  private handleContextMenu(event: MouseEvent): void {
    event.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const marker = this.getMarkerAtPosition(x, y);
    if (marker) {
      this.emit('marker-context-menu', { marker, x: event.clientX, y: event.clientY });
    }
  }

  /**
   * 工具方法
   */
  private sampleToCanvasX(sample: number): number {
    const relativeSample = sample - this.firstSample;
    return (relativeSample / this.visibleSamples) * this.canvas.width;
  }

  private canvasXToSample(x: number): number {
    const relativeSample = (x / this.canvas.width) * this.visibleSamples;
    return Math.round(this.firstSample + relativeSample);
  }

  private getMarkerAtPosition(x: number, y: number): Marker | null {
    const tolerance = 5;

    for (const marker of this.markers.values()) {
      if (!marker.visible) continue;

      const markerX = this.sampleToCanvasX(marker.sample);
      if (Math.abs(x - markerX) <= tolerance) {
        return marker;
      }
    }

    return null;
  }

  private snapToNearestEdge(sample: number): number {
    // 简化的边沿吸附算法
    // 在实际实现中，这里应该分析信号数据找到最近的边沿
    return Math.round(sample);
  }

  private getDefaultMarkerColor(type: Marker['type']): string {
    const colors = {
      user: '#409eff',
      trigger: '#f56c6c',
      burst: '#e6a23c',
      cursor: '#67c23a',
      measurement: '#909399'
    };
    return colors[type] || '#409eff';
  }

  private formatTime(seconds: number): string {
    if (seconds >= 1) {
      return `${seconds.toFixed(3)}s`;
    } else if (seconds >= 0.001) {
      return `${(seconds * 1000).toFixed(3)}ms`;
    } else if (seconds >= 0.000001) {
      return `${(seconds * 1000000).toFixed(3)}μs`;
    } else {
      return `${(seconds * 1000000000).toFixed(3)}ns`;
    }
  }

  private formatFrequency(hz: number): string {
    if (hz >= 1000000000) {
      return `${(hz / 1000000000).toFixed(3)}GHz`;
    } else if (hz >= 1000000) {
      return `${(hz / 1000000).toFixed(3)}MHz`;
    } else if (hz >= 1000) {
      return `${(hz / 1000).toFixed(3)}kHz`;
    }
    return `${hz.toFixed(3)}Hz`;
  }

  private getTimeUnit(seconds: number): string {
    if (seconds >= 1) return 's';
    if (seconds >= 0.001) return 'ms';
    if (seconds >= 0.000001) return 'μs';
    return 'ns';
  }

  private calculateAccuracy(sampleCount: number): number {
    // 简化的精度计算
    return Math.min(0.95, Math.max(0.1, sampleCount / 1000));
  }

  /**
   * 事件系统
   */
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }

  public on(event: string, listener: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  public off(event: string, listener: (data: any) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 导出功能
   */
  public exportMarkers(): any {
    return {
      markers: Array.from(this.markers.values()),
      markerPairs: Array.from(this.markerPairs.values()),
      timestamp: new Date().toISOString()
    };
  }

  public importMarkers(data: any): void {
    this.markers.clear();
    this.markerPairs.clear();

    if (data.markers) {
      data.markers.forEach((marker: Marker) => {
        this.markers.set(marker.id, marker);
      });
    }

    if (data.markerPairs) {
      data.markerPairs.forEach((pair: MarkerPair) => {
        this.markerPairs.set(pair.id, pair);
      });
    }

    this.render();
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    // 移除事件监听器
    this.canvas.removeEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.removeEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.removeEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.removeEventListener('click', this.handleClick.bind(this));
    this.canvas.removeEventListener('dblclick', this.handleDoubleClick.bind(this));
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu.bind(this));

    // 清空数据
    this.markers.clear();
    this.markerPairs.clear();
    this.eventListeners.clear();
  }
}
