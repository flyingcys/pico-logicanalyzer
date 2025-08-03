/**
 * 时间轴渲染器
 * 基于原版的时间轴显示逻辑，提供时间刻度、标尺和时间单位显示
 */

export interface TimeAxisConfig {
  height: number; // 时间轴高度
  position: 'top' | 'bottom'; // 时间轴位置
  showMajorTicks: boolean; // 显示主刻度
  showMinorTicks: boolean; // 显示次刻度
  showLabels: boolean; // 显示时间标签
  showGrid: boolean; // 显示网格线
  tickColor: string; // 刻度颜色
  labelColor: string; // 标签颜色
  gridColor: string; // 网格线颜色
  backgroundColor: string; // 背景色
  font: string; // 字体
  fontSize: number; // 字体大小
  labelFormat: 'auto' | 'samples' | 'time' | 'both'; // 标签格式
  minTickSpacing: number; // 最小刻度间距（像素）
  maxTickSpacing: number; // 最大刻度间距（像素）
}

export interface TimeScale {
  unit: 'ps' | 'ns' | 'µs' | 'ms' | 's';
  factor: number; // 单位转换因子
  baseInterval: number; // 基础间隔
  displayName: string; // 显示名称
}

export interface TickInfo {
  position: number; // 像素位置
  sample: number; // 样本位置
  timestamp: number; // 时间戳（秒）
  label: string; // 显示标签
  type: 'major' | 'minor'; // 刻度类型
  level: number; // 层级（用于嵌套刻度）
}

export class TimeAxisRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: TimeAxisConfig;

  // 时间信息
  private sampleRate = 1000000; // 默认1MHz
  private firstSample = 0;
  private visibleSamples = 1000;
  private timePerPixel = 0.000001; // 每像素时间（秒）

  // 时间单位配置
  private timeScales: TimeScale[] = [
    {
      unit: 'ps',
      factor: 1e12,
      baseInterval: 1e-12,
      displayName: 'ps'
    },
    {
      unit: 'ns',
      factor: 1e9,
      baseInterval: 1e-9,
      displayName: 'ns'
    },
    {
      unit: 'µs',
      factor: 1e6,
      baseInterval: 1e-6,
      displayName: 'µs'
    },
    {
      unit: 'ms',
      factor: 1e3,
      baseInterval: 1e-3,
      displayName: 'ms'
    },
    {
      unit: 's',
      factor: 1,
      baseInterval: 1,
      displayName: 's'
    }
  ];

  // 标尺间隔配置
  private intervalMultipliers = [1, 2, 2.5, 5]; // 1, 2, 5的倍数系列

  constructor(canvas: HTMLCanvasElement, config?: Partial<TimeAxisConfig>) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法获取Canvas 2D上下文');
    }
    this.ctx = ctx;

    this.config = {
      height: 40,
      position: 'top',
      showMajorTicks: true,
      showMinorTicks: true,
      showLabels: true,
      showGrid: false,
      tickColor: '#ffffff',
      labelColor: '#ffffff',
      gridColor: '#404040',
      backgroundColor: '#1e1e1e',
      font: 'monospace',
      fontSize: 12,
      labelFormat: 'auto',
      minTickSpacing: 40,
      maxTickSpacing: 150,
      ...config
    };
  }

  /**
   * 设置时间轴信息
   */
  public setTimeInfo(
    sampleRate: number,
    firstSample: number,
    visibleSamples: number
  ): void {
    this.sampleRate = sampleRate;
    this.firstSample = firstSample;
    this.visibleSamples = visibleSamples;

    // 计算每像素时间
    const canvasWidth = this.canvas.getBoundingClientRect().width;
    const totalTime = visibleSamples / sampleRate;
    this.timePerPixel = totalTime / canvasWidth;
  }

  /**
   * 渲染时间轴
   */
  public render(canvasWidth: number, canvasHeight: number): void {
    this.ctx.save();

    // 设置渲染区域
    const axisY = this.config.position === 'top' ? 0 : canvasHeight - this.config.height;

    // 绘制背景
    if (this.config.backgroundColor) {
      this.ctx.fillStyle = this.config.backgroundColor;
      this.ctx.fillRect(0, axisY, canvasWidth, this.config.height);
    }

    // 计算刻度
    const ticks = this.calculateTicks(canvasWidth);

    // 绘制网格线（如果启用）
    if (this.config.showGrid) {
      this.renderGrid(ticks, canvasWidth, canvasHeight);
    }

    // 绘制刻度
    this.renderTicks(ticks, axisY);

    // 绘制标签
    if (this.config.showLabels) {
      this.renderLabels(ticks, axisY);
    }

    // 绘制时间轴边框
    this.renderAxisBorder(axisY, canvasWidth);

    this.ctx.restore();
  }

  /**
   * 计算时间刻度
   */
  private calculateTicks(canvasWidth: number): TickInfo[] {
    const ticks: TickInfo[] = [];

    // 选择合适的时间单位和间隔
    const timeScale = this.selectTimeScale();
    const tickInterval = this.calculateTickInterval(timeScale, canvasWidth);

    // 计算起始时间（对齐到刻度间隔）
    const startTime = this.firstSample / this.sampleRate;
    const endTime = (this.firstSample + this.visibleSamples) / this.sampleRate;

    const alignedStartTime = Math.floor(startTime / tickInterval) * tickInterval;

    // 生成主刻度
    for (let time = alignedStartTime; time <= endTime + tickInterval; time += tickInterval) {
      const sample = time * this.sampleRate;
      const position = this.sampleToPixel(sample, canvasWidth);

      if (position >= -50 && position <= canvasWidth + 50) {
        ticks.push({
          position,
          sample,
          timestamp: time,
          label: this.formatTimeLabel(time, timeScale),
          type: 'major',
          level: 0
        });
      }
    }

    // 生成次刻度
    if (this.config.showMinorTicks) {
      const minorInterval = tickInterval / 5; // 次刻度间隔是主刻度的1/5

      for (let time = alignedStartTime; time <= endTime + minorInterval; time += minorInterval) {
        const sample = time * this.sampleRate;
        const position = this.sampleToPixel(sample, canvasWidth);

        // 检查是否与主刻度重叠
        const isMainTick = ticks.some(tick =>
          tick.type === 'major' && Math.abs(tick.position - position) < 2
        );

        if (!isMainTick && position >= -50 && position <= canvasWidth + 50) {
          ticks.push({
            position,
            sample,
            timestamp: time,
            label: '',
            type: 'minor',
            level: 1
          });
        }
      }
    }

    return ticks.sort((a, b) => a.position - b.position);
  }

  /**
   * 选择合适的时间单位
   */
  private selectTimeScale(): TimeScale {
    const totalTime = this.visibleSamples / this.sampleRate;

    // 根据总时间选择合适的单位
    for (let i = 0; i < this.timeScales.length; i++) {
      const scale = this.timeScales[i];
      if (totalTime * scale.factor >= 1) {
        return scale;
      }
    }

    // 默认返回最小单位
    return this.timeScales[0];
  }

  /**
   * 计算刻度间隔
   */
  private calculateTickInterval(timeScale: TimeScale, canvasWidth: number): number {
    const totalTime = this.visibleSamples / this.sampleRate;
    const pixelsPerSecond = canvasWidth / totalTime;

    // 目标刻度间距（像素）
    const targetSpacing = (this.config.minTickSpacing + this.config.maxTickSpacing) / 2;

    // 基础时间间隔
    const baseInterval = targetSpacing / pixelsPerSecond;

    // 根据时间单位调整
    const magnitude = Math.pow(10, Math.floor(Math.log10(baseInterval)));

    // 选择合适的倍数
    let bestInterval = magnitude;
    let bestSpacing = Math.abs(pixelsPerSecond * magnitude - targetSpacing);

    for (const multiplier of this.intervalMultipliers) {
      const interval = magnitude * multiplier;
      const spacing = pixelsPerSecond * interval;
      const error = Math.abs(spacing - targetSpacing);

      if (error < bestSpacing &&
          spacing >= this.config.minTickSpacing &&
          spacing <= this.config.maxTickSpacing) {
        bestInterval = interval;
        bestSpacing = error;
      }
    }

    return bestInterval;
  }

  /**
   * 样本转像素坐标
   */
  private sampleToPixel(sample: number, canvasWidth: number): number {
    const samplesPerPixel = this.visibleSamples / canvasWidth;
    return (sample - this.firstSample) / samplesPerPixel;
  }

  /**
   * 格式化时间标签
   */
  private formatTimeLabel(time: number, timeScale: TimeScale): string {
    switch (this.config.labelFormat) {
      case 'samples':
        return Math.round(time * this.sampleRate).toString();

      case 'time':
        return this.formatTime(time, timeScale);

      case 'both':
        const sampleText = Math.round(time * this.sampleRate).toString();
        const timeText = this.formatTime(time, timeScale);
        return `${timeText}\n(${sampleText})`;

      case 'auto':
      default:
        // 自动选择：根据缩放级别决定显示格式
        if (this.timePerPixel < 1e-6) {
          return this.formatTime(time, timeScale);
        } else {
          return this.formatTime(time, timeScale);
        }
    }
  }

  /**
   * 格式化时间显示
   */
  private formatTime(time: number, timeScale: TimeScale): string {
    const value = time * timeScale.factor;

    // 根据值的大小选择合适的精度
    let precision = 0;
    if (Math.abs(value) < 1) {
      precision = 3;
    } else if (Math.abs(value) < 10) {
      precision = 2;
    } else if (Math.abs(value) < 100) {
      precision = 1;
    }

    return `${value.toFixed(precision)} ${timeScale.displayName}`;
  }

  /**
   * 渲染网格线
   */
  private renderGrid(ticks: TickInfo[], canvasWidth: number, canvasHeight: number): void {
    this.ctx.strokeStyle = this.config.gridColor;
    this.ctx.lineWidth = 0.5;
    this.ctx.setLineDash([1, 3]);

    this.ctx.beginPath();

    for (const tick of ticks) {
      if (tick.type === 'major' && tick.position >= 0 && tick.position <= canvasWidth) {
        this.ctx.moveTo(tick.position, 0);
        this.ctx.lineTo(tick.position, canvasHeight);
      }
    }

    this.ctx.stroke();
    this.ctx.setLineDash([]); // 重置线型
  }

  /**
   * 渲染刻度
   */
  private renderTicks(ticks: TickInfo[], axisY: number): void {
    this.ctx.strokeStyle = this.config.tickColor;
    this.ctx.lineWidth = 1;

    this.ctx.beginPath();

    for (const tick of ticks) {
      if (tick.position >= 0 && tick.position <= this.canvas.width) {
        const tickHeight = tick.type === 'major' ? 12 : 6;
        const tickY = this.config.position === 'top' ?
          axisY + this.config.height - tickHeight :
          axisY;

        this.ctx.moveTo(tick.position, tickY);
        this.ctx.lineTo(tick.position, tickY + tickHeight);
      }
    }

    this.ctx.stroke();
  }

  /**
   * 渲染标签
   */
  private renderLabels(ticks: TickInfo[], axisY: number): void {
    this.ctx.fillStyle = this.config.labelColor;
    this.ctx.font = `${this.config.fontSize}px ${this.config.font}`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = this.config.position === 'top' ? 'bottom' : 'top';

    // 标签防重叠检测
    const renderedLabels: { x: number, width: number }[] = [];

    for (const tick of ticks) {
      if (tick.type === 'major' && tick.label &&
          tick.position >= 0 && tick.position <= this.canvas.width) {

        const labelWidth = this.ctx.measureText(tick.label).width;
        const labelX = tick.position;

        // 检查是否与已渲染的标签重叠
        const hasOverlap = renderedLabels.some(rendered =>
          Math.abs(rendered.x - labelX) < (rendered.width + labelWidth) / 2 + 10
        );

        if (!hasOverlap) {
          const labelY = this.config.position === 'top' ?
            axisY + this.config.height - 15 :
            axisY + 15;

          // 处理多行标签
          const lines = tick.label.split('\n');
          lines.forEach((line, index) => {
            const lineY = labelY + index * (this.config.fontSize + 2) *
              (this.config.position === 'top' ? -1 : 1);
            this.ctx.fillText(line, labelX, lineY);
          });

          renderedLabels.push({ x: labelX, width: labelWidth });
        }
      }
    }
  }

  /**
   * 渲染时间轴边框
   */
  private renderAxisBorder(axisY: number, canvasWidth: number): void {
    this.ctx.strokeStyle = this.config.tickColor;
    this.ctx.lineWidth = 1;

    this.ctx.beginPath();

    if (this.config.position === 'top') {
      // 底边框
      this.ctx.moveTo(0, axisY + this.config.height);
      this.ctx.lineTo(canvasWidth, axisY + this.config.height);
    } else {
      // 顶边框
      this.ctx.moveTo(0, axisY);
      this.ctx.lineTo(canvasWidth, axisY);
    }

    this.ctx.stroke();
  }

  /**
   * 获取指定位置的时间信息
   */
  public getTimeAtPosition(x: number, canvasWidth: number): { sample: number, timestamp: number, timeText: string } {
    const samplesPerPixel = this.visibleSamples / canvasWidth;
    const sample = this.firstSample + x * samplesPerPixel;
    const timestamp = sample / this.sampleRate;

    const timeScale = this.selectTimeScale();
    const timeText = this.formatTime(timestamp, timeScale);

    return {
      sample: Math.round(sample),
      timestamp,
      timeText
    };
  }

  /**
   * 获取时间轴高度
   */
  public getHeight(): number {
    return this.config.height;
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<TimeAxisConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  public getConfig(): TimeAxisConfig {
    return { ...this.config };
  }

  /**
   * 自动调整刻度
   */
  public autoScale(canvasWidth: number): void {
    // 根据当前视图自动调整刻度间距
    const totalTime = this.visibleSamples / this.sampleRate;
    const pixelsPerSecond = canvasWidth / totalTime;

    // 调整最小和最大刻度间距
    if (pixelsPerSecond > 1000) {
      // 缩放很大时，增加刻度密度
      this.config.minTickSpacing = 20;
      this.config.maxTickSpacing = 80;
    } else if (pixelsPerSecond < 10) {
      // 缩放很小时，减少刻度密度
      this.config.minTickSpacing = 80;
      this.config.maxTickSpacing = 200;
    } else {
      // 默认设置
      this.config.minTickSpacing = 40;
      this.config.maxTickSpacing = 150;
    }
  }

  /**
   * 导出时间轴配置
   */
  public exportConfig(): any {
    return {
      config: this.config,
      timeScales: this.timeScales,
      intervalMultipliers: this.intervalMultipliers
    };
  }

  /**
   * 导入时间轴配置
   */
  public importConfig(data: any): void {
    if (data.config) {
      this.config = { ...this.config, ...data.config };
    }

    if (data.timeScales) {
      this.timeScales = data.timeScales;
    }

    if (data.intervalMultipliers) {
      this.intervalMultipliers = data.intervalMultipliers;
    }
  }
}
