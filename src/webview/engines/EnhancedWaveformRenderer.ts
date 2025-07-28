/**
 * 增强版波形渲染器 - 集成解码结果可视化
 * 基于WaveformRenderer，添加解码结果注释显示功能
 */

import { WaveformRenderer, RenderStats } from './WaveformRenderer';
import { AnnotationRenderer } from './AnnotationRenderer';
import {
  AnnotationsGroup,
  SigrokAnnotation,
  SigrokAnnotationSegment,
  ProtocolAnalyzerSegmentShape,
  AnnotationColorManager
} from './AnnotationTypes';
import { AnalyzerChannel } from '../../models/CaptureModels';

export interface DecoderResult {
  decoderId: string;
  decoderName: string;
  results: DecoderAnnotation[];
}

export interface DecoderAnnotation {
  startSample: number;
  endSample: number;
  annotationType: string;
  values: string[];
  rawData?: any;
}

export interface WaveformRenderConfig {
  showDecoderResults: boolean;
  annotationHeight: number;
  separateAnnotationArea: boolean;
  annotationAreaHeight: number;
  overlayAnnotations: boolean;
}

export class EnhancedWaveformRenderer extends WaveformRenderer {
  private annotationRenderer: AnnotationRenderer | null = null;
  private annotationCanvas: HTMLCanvasElement | null = null;
  private decoderResults: Map<string, DecoderResult> = new Map();
  private config: WaveformRenderConfig;
  
  constructor(
    canvas: HTMLCanvasElement, 
    config?: Partial<WaveformRenderConfig>
  ) {
    super(canvas);
    
    this.config = {
      showDecoderResults: true,
      annotationHeight: 24,
      separateAnnotationArea: true,
      annotationAreaHeight: 200,
      overlayAnnotations: false,
      ...config
    };
    
    this.setupAnnotationRenderer();
  }
  
  /**
   * 设置注释渲染器
   */
  private setupAnnotationRenderer(): void {
    if (!this.config.showDecoderResults) return;
    
    if (this.config.separateAnnotationArea) {
      // 创建独立的注释Canvas
      this.createAnnotationCanvas();
    }
  }
  
  /**
   * 创建注释Canvas
   */
  private createAnnotationCanvas(): void {
    const container = this.canvas.parentElement;
    if (!container) return;
    
    // 创建注释Canvas
    this.annotationCanvas = document.createElement('canvas');
    this.annotationCanvas.className = 'annotation-canvas';
    this.annotationCanvas.style.cssText = `
      width: 100%;
      height: ${this.config.annotationAreaHeight}px;
      border-top: 1px solid #333;
      background: #1a1a1a;
      display: block;
    `;
    
    // 插入到波形Canvas下方
    container.appendChild(this.annotationCanvas);
    
    // 创建注释渲染器
    this.annotationRenderer = new AnnotationRenderer(this.annotationCanvas);
    
    // 设置Canvas尺寸
    this.resizeAnnotationCanvas();
  }
  
  /**
   * 调整注释Canvas尺寸
   */
  private resizeAnnotationCanvas(): void {
    if (!this.annotationCanvas || !this.annotationRenderer) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    this.annotationCanvas.width = rect.width * dpr;
    this.annotationCanvas.height = this.config.annotationAreaHeight * dpr;
    this.annotationCanvas.style.width = `${rect.width}px`;
    this.annotationCanvas.style.height = `${this.config.annotationAreaHeight}px`;
    
    const ctx = this.annotationCanvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }
  
  /**
   * 重写父类的resize方法
   */
  public resize(): void {
    super.resize();
    this.resizeAnnotationCanvas();
  }
  
  /**
   * 添加解码器结果
   */
  public addDecoderResults(results: DecoderResult[]): void {
    this.beginUpdate();
    
    // 清除现有结果
    this.decoderResults.clear();
    
    // 添加新结果
    for (const result of results) {
      this.decoderResults.set(result.decoderId, result);
    }
    
    // 更新注释渲染器
    this.updateAnnotationRenderer();
    
    this.endUpdate();
  }
  
  /**
   * 移除解码器结果
   */
  public removeDecoderResults(decoderId: string): void {
    if (this.decoderResults.delete(decoderId)) {
      this.updateAnnotationRenderer();
      this.invalidateVisual();
    }
  }
  
  /**
   * 清除所有解码器结果
   */
  public clearDecoderResults(): void {
    this.decoderResults.clear();
    
    if (this.annotationRenderer) {
      this.annotationRenderer.clearAnnotations();
    }
    
    this.invalidateVisual();
  }
  
  /**
   * 更新注释渲染器
   */
  private updateAnnotationRenderer(): void {
    if (!this.annotationRenderer) return;
    
    this.annotationRenderer.beginUpdate();
    this.annotationRenderer.clearAnnotations();
    
    // 转换解码器结果为注释组
    const colorManager = AnnotationColorManager.getInstance();
    let colorIndex = 0;
    
    for (const [decoderId, result] of this.decoderResults) {
      const annotationsGroup: AnnotationsGroup = {
        groupId: decoderId,
        groupName: result.decoderName,
        groupColor: colorManager.getColor(colorIndex++),
        annotations: this.convertToAnnotations(result)
      };
      
      this.annotationRenderer.addAnnotationsGroup(annotationsGroup);
    }
    
    this.annotationRenderer.endUpdate();
  }
  
  /**
   * 转换解码器结果为注释格式
   */
  private convertToAnnotations(result: DecoderResult): SigrokAnnotation[] {
    const annotationMap = new Map<string, SigrokAnnotationSegment[]>();
    
    // 按注释类型分组
    for (const annotation of result.results) {
      const type = annotation.annotationType;
      if (!annotationMap.has(type)) {
        annotationMap.set(type, []);
      }
      
      const segment: SigrokAnnotationSegment = {
        firstSample: annotation.startSample,
        lastSample: annotation.endSample,
        typeId: this.getTypeId(type),
        value: annotation.values,
        shape: this.determineShape(annotation.endSample - annotation.startSample)
      };
      
      annotationMap.get(type)!.push(segment);
    }
    
    // 转换为SigrokAnnotation数组
    const annotations: SigrokAnnotation[] = [];
    let annotationIndex = 0;
    
    for (const [type, segments] of annotationMap) {
      annotations.push({
        annotationId: `${result.decoderId}_${annotationIndex++}`,
        annotationName: type,
        decoderId: result.decoderId,
        segments: segments.sort((a, b) => a.firstSample - b.firstSample)
      });
    }
    
    return annotations;
  }
  
  /**
   * 获取注释类型ID
   */
  private getTypeId(typeName: string): number {
    // 基于类型名称生成一个稳定的ID
    let hash = 0;
    for (let i = 0; i < typeName.length; i++) {
      const char = typeName.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash) % 64;
  }
  
  /**
   * 确定段形状
   */
  private determineShape(sampleCount: number): ProtocolAnalyzerSegmentShape {
    if (sampleCount < 2) {
      return ProtocolAnalyzerSegmentShape.Circle;
    } else if (sampleCount < 10) {
      return ProtocolAnalyzerSegmentShape.RoundRectangle;
    } else {
      return ProtocolAnalyzerSegmentShape.Hexagon;
    }
  }
  
  /**
   * 重写父类的updateVisibleSamples方法
   */
  public updateVisibleSamples(firstSample: number, visibleSamples: number): void {
    super.updateVisibleSamples(firstSample, visibleSamples);
    
    // 同步更新注释渲染器
    if (this.annotationRenderer) {
      this.annotationRenderer.updateVisibleSamples(firstSample, visibleSamples);
    }
  }
  
  /**
   * 重写父类的setUserMarker方法
   */
  public setUserMarker(marker: number | null): void {
    super.setUserMarker(marker);
    
    // 同步更新注释渲染器
    if (this.annotationRenderer) {
      this.annotationRenderer.setUserMarker(marker);
    }
  }
  
  /**
   * 重写父类的render方法，添加注释渲染支持
   */
  public render(): RenderStats {
    const stats = super.render();
    
    // 渲染注释（如果启用overlay模式）
    if (this.config.overlayAnnotations && this.decoderResults.size > 0) {
      this.renderOverlayAnnotations();
    }
    
    return stats;
  }
  
  /**
   * 渲染叠加注释
   */
  private renderOverlayAnnotations(): void {
    const ctx = this.ctx;
    const canvasWidth = this.canvas.getBoundingClientRect().width;
    const canvasHeight = this.canvas.getBoundingClientRect().height;
    
    // 在波形下方绘制解码结果
    const annotationAreaY = canvasHeight - 100;
    const annotationHeight = 20;
    
    ctx.save();
    
    // 设置字体
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    let currentY = annotationAreaY;
    
    for (const [decoderId, result] of this.decoderResults) {
      // 绘制解码器标签
      ctx.fillStyle = '#ffffff';
      ctx.fillText(result.decoderName, 5, currentY + annotationHeight / 2);
      
      // 绘制注释段
      for (const annotation of result.results.slice(0, 5)) { // 限制显示数量
        const startX = (annotation.startSample / this.visibleSamples) * canvasWidth;
        const endX = (annotation.endSample / this.visibleSamples) * canvasWidth;
        const width = Math.max(endX - startX, 2);
        
        // 绘制背景
        ctx.fillStyle = 'rgba(64, 158, 255, 0.3)';
        ctx.fillRect(startX, currentY, width, annotationHeight);
        
        // 绘制边框
        ctx.strokeStyle = '#409eff';
        ctx.lineWidth = 1;
        ctx.strokeRect(startX, currentY, width, annotationHeight);
        
        // 绘制文本
        if (width > 30) {
          ctx.fillStyle = '#409eff';
          const text = annotation.values[0] || '';
          const maxWidth = width - 4;
          ctx.fillText(text, startX + 2, currentY + annotationHeight / 2);
        }
      }
      
      currentY += annotationHeight + 2;
    }
    
    ctx.restore();
  }
  
  /**
   * 导出解码数据
   */
  public exportDecoderData(format: 'json' | 'csv' | 'txt' = 'json'): string {
    const exportData: any = {
      timestamp: new Date().toISOString(),
      format,
      decoders: []
    };
    
    for (const [decoderId, result] of this.decoderResults) {
      const decoderData = {
        id: decoderId,
        name: result.decoderName,
        annotations: result.results.map(annotation => ({
          type: annotation.annotationType,
          startSample: annotation.startSample,
          endSample: annotation.endSample,
          duration: annotation.endSample - annotation.startSample,
          values: annotation.values,
          rawData: annotation.rawData
        }))
      };
      
      exportData.decoders.push(decoderData);
    }
    
    switch (format) {
      case 'json':
        return JSON.stringify(exportData, null, 2);
        
      case 'csv':
        return this.exportToCsv(exportData);
        
      case 'txt':
        return this.exportToText(exportData);
        
      default:
        return JSON.stringify(exportData, null, 2);
    }
  }
  
  /**
   * 导出为CSV格式
   */
  private exportToCsv(data: any): string {
    let csv = 'Decoder,Type,StartSample,EndSample,Duration,Value\n';
    
    for (const decoder of data.decoders) {
      for (const annotation of decoder.annotations) {
        const value = annotation.values.join(' | ').replace(/"/g, '""');
        csv += `"${decoder.name}","${annotation.type}",${annotation.startSample},${annotation.endSample},${annotation.duration},"${value}"\n`;
      }
    }
    
    return csv;
  }
  
  /**
   * 导出为文本格式
   */
  private exportToText(data: any): string {
    let text = `Logic Analyzer Decoder Results\n`;
    text += `Generated: ${data.timestamp}\n`;
    text += `Format: ${data.format}\n\n`;
    
    for (const decoder of data.decoders) {
      text += `=== ${decoder.name} (${decoder.id}) ===\n`;
      
      for (const annotation of decoder.annotations) {
        text += `  [${annotation.startSample}-${annotation.endSample}] ${annotation.type}: ${annotation.values.join(' ')}\n`;
      }
      
      text += '\n';
    }
    
    return text;
  }
  
  /**
   * 获取注释统计信息
   */
  public getAnnotationStats(): {
    totalDecoders: number;
    totalAnnotations: number;
    annotationsByDecoder: { [key: string]: number };
    annotationsByType: { [key: string]: number };
  } {
    const stats = {
      totalDecoders: this.decoderResults.size,
      totalAnnotations: 0,
      annotationsByDecoder: {} as { [key: string]: number },
      annotationsByType: {} as { [key: string]: number }
    };
    
    for (const [decoderId, result] of this.decoderResults) {
      stats.annotationsByDecoder[result.decoderName] = result.results.length;
      stats.totalAnnotations += result.results.length;
      
      for (const annotation of result.results) {
        const type = annotation.annotationType;
        stats.annotationsByType[type] = (stats.annotationsByType[type] || 0) + 1;
      }
    }
    
    return stats;
  }
  
  /**
   * 清理资源
   */
  public dispose(): void {
    super.dispose();
    
    if (this.annotationRenderer) {
      this.annotationRenderer.dispose();
    }
    
    if (this.annotationCanvas && this.annotationCanvas.parentElement) {
      this.annotationCanvas.parentElement.removeChild(this.annotationCanvas);
    }
  }
}