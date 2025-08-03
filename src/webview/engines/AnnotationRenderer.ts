/**
 * 解码结果注释渲染器
 * 基于原版 AnnotationViewer.AnnotationRenderer 的完整TypeScript实现
 */

import {
  AnnotationsGroup,
  SigrokAnnotation,
  SigrokAnnotationSegment,
  ProtocolAnalyzerSegmentShape,
  AnnotationRenderConfig,
  AnnotationColors,
  AnnotationColorManager,
  AnnotationTooltip,
  DEFAULT_ANNOTATION_CONFIG,
  DEFAULT_ANNOTATION_COLORS
} from './AnnotationTypes';

export class AnnotationRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: AnnotationRenderConfig;
  private colors: AnnotationColors;
  private colorManager: AnnotationColorManager;

  // 状态管理
  private annotations: AnnotationsGroup[] = [];
  private firstSample = 0;
  private visibleSamples = 0;
  private userMarker: number | null = null;
  private isUpdating = false;

  // 交互状态
  private currentTooltip: AnnotationTooltip | null = null;
  private lastTooltipSegment: SigrokAnnotationSegment | null = null;

  constructor(canvas: HTMLCanvasElement, config?: Partial<AnnotationRenderConfig>) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法获取Canvas 2D上下文');
    }
    this.ctx = ctx;

    this.config = { ...DEFAULT_ANNOTATION_CONFIG, ...config };
    this.colors = { ...DEFAULT_ANNOTATION_COLORS };
    this.colorManager = AnnotationColorManager.getInstance();

    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mouseleave', this.onMouseLeave.bind(this));
  }

  /**
   * 鼠标移动事件处理 - 基于原版的tooltip功能
   */
  private onMouseMove(event: MouseEvent): void {
    if (this.annotations.length === 0) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const sampleWidth = (rect.width - this.config.annotationNameWidth) / this.visibleSamples;
    const overSample = Math.floor((x - this.config.annotationNameWidth) / sampleWidth) + this.firstSample;
    const row = Math.floor(y / this.config.annotationHeight);

    // 查找对应的注释段
    let currentRow = 0;
    for (const group of this.annotations) {
      for (const annotation of group.annotations) {
        if (currentRow === row) {
          const segment = annotation.segments.find(s =>
            (s.firstSample <= overSample && s.lastSample > overSample) ||
            s.firstSample === overSample
          );

          if (segment) {
            this.showTooltip({
              segment,
              annotation,
              position: { x: event.clientX, y: event.clientY },
              visible: true
            });
            return;
          }
        }
        currentRow++;
      }
    }

    this.hideTooltip();
  }

  /**
   * 鼠标离开事件处理
   */
  private onMouseLeave(): void {
    this.hideTooltip();
  }

  /**
   * 显示工具提示
   */
  private showTooltip(tooltip: AnnotationTooltip): void {
    if (this.currentTooltip?.segment === tooltip.segment &&
        this.lastTooltipSegment === tooltip.segment) {
      return;
    }

    this.hideTooltip();

    const tooltipEl = document.createElement('div');
    tooltipEl.id = 'annotation-tooltip';
    tooltipEl.className = 'annotation-tooltip';
    tooltipEl.style.cssText = `
      position: fixed;
      left: ${tooltip.position.x + 10}px;
      top: ${tooltip.position.y - 10}px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
      z-index: 10000;
      pointer-events: none;
      max-width: 300px;
      word-wrap: break-word;
      border: 1px solid #555;
    `;

    const text = tooltip.segment.value[0] || 'Unknown';
    const sampleCount = tooltip.segment.lastSample - tooltip.segment.firstSample;
    const duration = this.formatDuration(sampleCount);

    tooltipEl.innerHTML = `
      <div><strong>Type:</strong> ${tooltip.annotation.annotationName}</div>
      <div><strong>Value:</strong> ${text}</div>
      <div><strong>Samples:</strong> ${sampleCount} (${duration})</div>
      <div><strong>Range:</strong> ${tooltip.segment.firstSample}-${tooltip.segment.lastSample}</div>
    `;

    document.body.appendChild(tooltipEl);

    this.currentTooltip = tooltip;
    this.lastTooltipSegment = tooltip.segment;
  }

  /**
   * 隐藏工具提示
   */
  private hideTooltip(): void {
    const existing = document.getElementById('annotation-tooltip');
    if (existing) {
      existing.remove();
    }
    this.currentTooltip = null;
  }

  /**
   * 格式化持续时间显示
   */
  private formatDuration(sampleCount: number): string {
    if (this.visibleSamples === 0) return '';

    // 这里需要实际的采样率信息，暂时用估算
    const estimatedFreq = 100000000; // 100MHz
    const seconds = sampleCount / estimatedFreq;

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
   * 更新可见样本范围
   */
  public updateVisibleSamples(firstSample: number, visibleSamples: number): void {
    this.firstSample = firstSample;
    this.visibleSamples = visibleSamples;

    if (!this.isUpdating) {
      this.render();
    }
  }

  /**
   * 设置用户标记
   */
  public setUserMarker(marker: number | null): void {
    this.userMarker = marker;

    if (!this.isUpdating) {
      this.render();
    }
  }

  /**
   * 添加注释组
   */
  public addAnnotationsGroup(group: AnnotationsGroup): void {
    this.annotations.push(group);
    this.updateCanvasHeight();
    this.render();
  }

  /**
   * 清除所有注释
   */
  public clearAnnotations(): void {
    this.annotations = [];
    this.updateCanvasHeight();
    this.render();
  }

  /**
   * 开始批量更新
   */
  public beginUpdate(): void {
    this.isUpdating = true;
  }

  /**
   * 结束批量更新
   */
  public endUpdate(): void {
    this.isUpdating = false;
    this.render();
  }

  /**
   * 更新Canvas高度
   */
  private updateCanvasHeight(): void {
    const totalAnnotations = this.annotations.reduce(
      (sum, group) => sum + group.annotations.length, 0
    );
    const requiredHeight = totalAnnotations * this.config.annotationHeight;

    if (this.canvas.height !== requiredHeight) {
      this.canvas.height = requiredHeight;
      this.canvas.style.height = `${requiredHeight}px`;
    }
  }

  /**
   * 主渲染方法 - 基于原版的Render方法
   */
  public render(): void {
    const totalAnnotations = this.annotations.reduce(
      (sum, group) => sum + group.annotations.length, 0
    );

    if (totalAnnotations === 0) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    this.updateCanvasHeight();

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    // 清除画布
    this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 绘制背景区域
    const nameAreaWidth = this.config.annotationNameWidth;
    const dataAreaX = nameAreaWidth;
    const dataAreaWidth = canvasWidth - nameAreaWidth;

    // 绘制名称区域背景
    this.ctx.fillStyle = this.colors.bgChannelColors[1];
    this.ctx.fillRect(0, 0, nameAreaWidth, canvasHeight);

    // 绘制数据区域背景
    this.ctx.fillStyle = this.colors.bgChannelColors[0];
    this.ctx.fillRect(dataAreaX, 0, dataAreaWidth, canvasHeight);

    // 绘制边框
    this.ctx.strokeStyle = this.colors.borderColor;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(0, 0, nameAreaWidth, canvasHeight);
    this.ctx.strokeRect(dataAreaX, 0, dataAreaWidth, canvasHeight);

    // 计算样本比例
    const sampleRatio = (dataAreaWidth - 2) / this.visibleSamples;

    // 渲染注释
    let annotationIndex = 0;
    for (const group of this.annotations) {
      for (const annotation of group.annotations) {
        const y = annotationIndex * this.config.annotationHeight;

        const nameRect = {
          x: 1,
          y: y + 1,
          width: nameAreaWidth - 2,
          height: this.config.annotationHeight - 2
        };

        const dataRect = {
          x: dataAreaX + 1,
          y: y + 1,
          width: dataAreaWidth - 2,
          height: this.config.annotationHeight - 2
        };

        this.renderAnnotation(group, annotation, nameRect, dataRect, sampleRatio);
        annotationIndex++;
      }
    }

    // 绘制用户标记线
    if (this.userMarker !== null) {
      const lineX = (this.userMarker - this.firstSample) * sampleRatio + dataAreaX + 1;
      this.ctx.strokeStyle = '#00ffff';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 3]);
      this.ctx.beginPath();
      this.ctx.moveTo(lineX, 0);
      this.ctx.lineTo(lineX, canvasHeight);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
  }

  /**
   * 渲染单个注释 - 基于原版的RenderAnnotation方法
   */
  private renderAnnotation(
    group: AnnotationsGroup,
    annotation: SigrokAnnotation,
    nameRect: { x: number; y: number; width: number; height: number },
    dataRect: { x: number; y: number; width: number; height: number },
    sampleRatio: number
  ): void {
    // 渲染名称区域
    this.renderAnnotationName(group, annotation, nameRect);

    // 渲染数据区域
    this.renderAnnotationData(annotation, dataRect, sampleRatio);
  }

  /**
   * 渲染注释名称区域
   */
  private renderAnnotationName(
    group: AnnotationsGroup,
    annotation: SigrokAnnotation,
    nameRect: { x: number; y: number; width: number; height: number }
  ): void {
    const { ctx } = this;

    // 保存上下文
    ctx.save();

    // 设置裁剪区域
    ctx.rect(nameRect.x, nameRect.y, nameRect.width, nameRect.height);
    ctx.clip();

    // 绘制圆形指示器
    const circleX = nameRect.x + 8;
    const circleY = nameRect.y + nameRect.height / 2;
    const circleRadius = 6;

    ctx.fillStyle = group.groupColor;
    ctx.strokeStyle = this.colors.borderColor;
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.arc(circleX, circleY, circleRadius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // 绘制文本
    const textX = nameRect.x + 20;
    const textY = nameRect.y + nameRect.height / 2;

    ctx.fillStyle = this.colors.textColor;
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const maxTextWidth = nameRect.width - 22;
    let displayText = annotation.annotationName;

    // 截断过长的文本
    while (ctx.measureText(displayText).width > maxTextWidth && displayText.length > 0) {
      displayText = displayText.slice(0, -1);
    }

    if (displayText.length < annotation.annotationName.length) {
      displayText += '...';
    }

    ctx.fillText(displayText, textX, textY);

    // 恢复上下文
    ctx.restore();
  }

  /**
   * 渲染注释数据区域
   */
  private renderAnnotationData(
    annotation: SigrokAnnotation,
    dataRect: { x: number; y: number; width: number; height: number },
    sampleRatio: number
  ): void {
    const { ctx } = this;

    // 保存上下文
    ctx.save();

    // 设置裁剪区域
    ctx.rect(dataRect.x, dataRect.y, dataRect.width, dataRect.height);
    ctx.clip();

    // 获取可见范围内的段
    const lastSample = this.firstSample + this.visibleSamples - 1;
    const visibleSegments = annotation.segments.filter(s =>
      s.lastSample >= this.firstSample && s.firstSample <= lastSample
    );

    // 渲染每个段
    for (const segment of visibleSegments) {
      const xStart = (segment.firstSample - this.firstSample) * sampleRatio;
      const xEnd = (segment.lastSample - this.firstSample) * sampleRatio;
      const samples = segment.lastSample - segment.firstSample;

      let segmentRect: { x: number; y: number; width: number; height: number };

      // 确定形状类型
      if (samples < 2) {
        segment.shape = ProtocolAnalyzerSegmentShape.Circle;
        segmentRect = {
          x: dataRect.x + xStart,
          y: dataRect.y,
          width: dataRect.height,
          height: dataRect.height
        };
      } else {
        const width = xEnd - xStart;
        segmentRect = {
          x: dataRect.x + xStart,
          y: dataRect.y,
          width,
          height: dataRect.height
        };

        if (width < this.config.minShapeWidth) {
          segment.shape = ProtocolAnalyzerSegmentShape.RoundRectangle;
        } else {
          segment.shape = ProtocolAnalyzerSegmentShape.Hexagon;
        }
      }

      this.renderSegment(segment, segmentRect);
    }

    // 恢复上下文
    ctx.restore();
  }

  /**
   * 渲染单个段 - 基于原版的RenderSegment方法
   */
  private renderSegment(
    segment: SigrokAnnotationSegment,
    renderArea: { x: number; y: number; width: number; height: number }
  ): void {
    const { ctx } = this;
    const color = this.colorManager.getColor(segment.typeId);
    const textColor = this.colorManager.getContrastTextColor(color);

    const midY = renderArea.y + renderArea.height / 2;
    const rectHeight = renderArea.height - 2;
    const topY = renderArea.y + 1;
    const bottomY = topY + rectHeight;

    let margin = 0;

    // 根据形状类型绘制
    ctx.fillStyle = color;
    ctx.strokeStyle = this.colors.borderColor;
    ctx.lineWidth = this.config.borderWidth;

    switch (segment.shape) {
      case ProtocolAnalyzerSegmentShape.Hexagon:
        this.drawHexagon(ctx, renderArea, midY, topY, bottomY);
        margin = 10;
        break;

      case ProtocolAnalyzerSegmentShape.Rectangle:
        ctx.fillRect(renderArea.x, renderArea.y, renderArea.width, renderArea.height);
        ctx.strokeRect(renderArea.x, renderArea.y, renderArea.width, renderArea.height);
        margin = 2;
        break;

      case ProtocolAnalyzerSegmentShape.RoundRectangle:
        this.drawRoundedRect(ctx, renderArea, 5);
        margin = 2;
        break;

      case ProtocolAnalyzerSegmentShape.Circle:
        ctx.beginPath();
        ctx.arc(
          renderArea.x + renderArea.width / 2,
          renderArea.y + renderArea.height / 2,
          Math.min(renderArea.width, renderArea.height) / 2 - 1,
          0, 2 * Math.PI
        );
        ctx.fill();
        ctx.stroke();
        margin = 2;
        break;
    }

    // 绘制文本
    this.renderSegmentText(segment, renderArea, textColor, margin);
  }

  /**
   * 绘制六边形
   */
  private drawHexagon(
    ctx: CanvasRenderingContext2D,
    renderArea: { x: number; y: number; width: number; height: number },
    midY: number,
    topY: number,
    bottomY: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(renderArea.x, midY);
    ctx.lineTo(renderArea.x + 5, topY);
    ctx.lineTo(renderArea.x + renderArea.width - 5, topY);
    ctx.lineTo(renderArea.x + renderArea.width, midY);
    ctx.lineTo(renderArea.x + renderArea.width - 5, bottomY);
    ctx.lineTo(renderArea.x + 5, bottomY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  /**
   * 绘制圆角矩形
   */
  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    renderArea: { x: number; y: number; width: number; height: number },
    radius: number
  ): void {
    ctx.beginPath();
    ctx.roundRect(renderArea.x, renderArea.y, renderArea.width, renderArea.height, radius);
    ctx.fill();
    ctx.stroke();
  }

  /**
   * 渲染段文本
   */
  private renderSegmentText(
    segment: SigrokAnnotationSegment,
    renderArea: { x: number; y: number; width: number; height: number },
    textColor: string,
    margin: number
  ): void {
    const { ctx } = this;
    const availableWidth = renderArea.width - margin * 2;

    if (availableWidth <= 0) return;

    // 找到最适合的文本
    const bestText = this.getBestText(availableWidth, segment.value, textColor);
    if (!bestText) return;

    // 绘制文本
    ctx.fillStyle = textColor;
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textX = renderArea.x + renderArea.width / 2;
    const textY = renderArea.y + renderArea.height / 2;

    ctx.fillText(bestText, textX, textY);
  }

  /**
   * 获取最适合宽度的文本
   */
  private getBestText(availableWidth: number, possibleValues: string[], textColor: string): string | null {
    const { ctx } = this;
    ctx.font = '12px "Segoe UI", sans-serif';

    for (const value of possibleValues) {
      if (ctx.measureText(value).width <= availableWidth) {
        return value;
      }
    }

    return null;
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    this.canvas.removeEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.removeEventListener('mouseleave', this.onMouseLeave.bind(this));
    this.hideTooltip();
  }
}
