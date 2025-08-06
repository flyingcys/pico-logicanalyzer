/**
 * 交互引擎 - 处理缩放和平移交互功能
 * 基于原版的用户交互逻辑，提供流畅的缩放和平移体验
 */

export interface InteractionConfig {
  enableZoom: boolean;
  enablePan: boolean;
  enableSelection: boolean;
  zoomSensitivity: number; // 缩放敏感度
  panSensitivity: number; // 平移敏感度
  minZoomLevel: number; // 最小缩放级别
  maxZoomLevel: number; // 最大缩放级别
}

export interface ViewportState {
  startSample: number;
  endSample: number;
  samplesPerPixel: number;
  pixelsPerSample: number;
  zoomLevel: number;
  centerSample: number;
}

export interface InteractionEvent {
  type: 'zoom' | 'pan' | 'select' | 'marker';
  data: any;
  timestamp: number;
}

export class InteractionEngine {
  private canvas: HTMLCanvasElement;
  private config: InteractionConfig;
  private viewport: ViewportState;

  // 交互状态
  private isDragging = false;
  private isSelecting = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private lastMouseX = 0;
  private lastMouseY = 0;

  // 事件监听器
  private eventListeners: Map<string, ((event: InteractionEvent) => void)[]> = new Map();

  // 选择区域
  private selectionStart: number | null = null;
  private selectionEnd: number | null = null;

  constructor(canvas: HTMLCanvasElement, config?: Partial<InteractionConfig>) {
    this.canvas = canvas;

    // 默认配置
    this.config = {
      enableZoom: true,
      enablePan: true,
      enableSelection: true,
      zoomSensitivity: 0.1,
      panSensitivity: 1.0,
      minZoomLevel: 0.01,
      maxZoomLevel: 1000.0,
      ...config
    };

    // 初始视口状态
    this.viewport = {
      startSample: 0,
      endSample: 1000,
      samplesPerPixel: 1,
      pixelsPerSample: 1,
      zoomLevel: 1,
      centerSample: 500
    };

    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 鼠标事件
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.addEventListener('wheel', this.onWheel.bind(this));
    this.canvas.addEventListener('dblclick', this.onDoubleClick.bind(this));

    // 键盘事件
    this.canvas.addEventListener('keydown', this.onKeyDown.bind(this));
    this.canvas.tabIndex = 0; // 使canvas可以接收键盘事件

    // 触摸事件（移动设备支持）
    this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
    this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
    this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this));

    // 防止右键菜单
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /**
   * 鼠标按下事件
   */
  private onMouseDown(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    this.dragStartX = x;
    this.dragStartY = y;
    this.lastMouseX = x;
    this.lastMouseY = y;

    if (event.button === 0) { // 左键
      if (event.ctrlKey || event.metaKey) {
        // Ctrl+左键：开始选择
        if (this.config.enableSelection) {
          this.startSelection(x);
        }
      } else {
        // 左键：开始拖拽平移
        if (this.config.enablePan) {
          this.isDragging = true;
          this.setCursor('grabbing');
        }
      }
    }

    // 防止文本选择
    event.preventDefault();
  }

  /**
   * 鼠标移动事件
   */
  private onMouseMove(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const deltaX = x - this.lastMouseX;
    const deltaY = y - this.lastMouseY;

    if (this.isDragging) {
      // 平移操作
      this.pan(-deltaX * this.config.panSensitivity);
    } else if (this.isSelecting) {
      // 更新选择区域
      this.updateSelection(x);
    } else {
      // 更新鼠标光标样式
      this.updateCursor(event);
    }

    this.lastMouseX = x;
    this.lastMouseY = y;
  }

  /**
   * 鼠标抬起事件
   */
  private onMouseUp(event: MouseEvent): void {
    if (this.isDragging) {
      this.isDragging = false;
      this.setCursor('default');
    }

    if (this.isSelecting) {
      this.endSelection();
    }
  }

  /**
   * 滚轮事件
   */
  private onWheel(event: WheelEvent): void {
    if (!this.config.enableZoom) return;

    event.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;

    // 计算缩放中心点（鼠标位置对应的样本索引）
    const centerSample = this.pixelToSample(mouseX);

    // 计算缩放因子
    // deltaY < 0: 向上滚动 = 放大 (zoom in)
    // deltaY > 0: 向下滚动 = 缩小 (zoom out)
    const zoomFactor = event.deltaY < 0 ?
      (1 + this.config.zoomSensitivity) :
      (1 - this.config.zoomSensitivity);

    this.zoomAtPoint(centerSample, zoomFactor);
  }

  /**
   * 双击事件
   */
  private onDoubleClick(event: MouseEvent): void {
    // 双击缩放到鼠标位置
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const centerSample = this.pixelToSample(mouseX);

    // 如果当前已经放大，则缩小；否则放大
    const currentZoom = this.viewport.zoomLevel;
    const targetZoom = currentZoom > 1.5 ? 0.5 : 2.0;
    const zoomFactor = targetZoom / currentZoom;

    this.zoomAtPoint(centerSample, zoomFactor);
  }

  /**
   * 键盘事件
   */
  private onKeyDown(event: KeyboardEvent): void {
    switch (event.code) {
      case 'ArrowLeft':
        this.pan(-50); // 向左平移
        break;
      case 'ArrowRight':
        this.pan(50); // 向右平移
        break;
      case 'Equal':
      case 'NumpadAdd':
        if (event.ctrlKey || event.metaKey) {
          this.zoom(0.8); // 放大
          event.preventDefault();
        }
        break;
      case 'Minus':
      case 'NumpadSubtract':
        if (event.ctrlKey || event.metaKey) {
          this.zoom(1.25); // 缩小
          event.preventDefault();
        }
        break;
      case 'Digit0':
      case 'Numpad0':
        if (event.ctrlKey || event.metaKey) {
          this.resetView(); // 重置视图
          event.preventDefault();
        }
        break;
    }
  }

  /**
   * 触摸开始事件
   */
  private onTouchStart(event: TouchEvent): void {
    event.preventDefault();

    if (event.touches.length === 1) {
      // 单指触摸 - 模拟鼠标按下
      const touch = event.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;

      this.dragStartX = x;
      this.lastMouseX = x;
      this.isDragging = true;
    }
  }

  /**
   * 触摸移动事件
   */
  private onTouchMove(event: TouchEvent): void {
    event.preventDefault();

    if (event.touches.length === 1 && this.isDragging) {
      // 单指平移
      const touch = event.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;

      const deltaX = x - this.lastMouseX;
      this.pan(-deltaX * this.config.panSensitivity);

      this.lastMouseX = x;
    }
  }

  /**
   * 触摸结束事件
   */
  private onTouchEnd(event: TouchEvent): void {
    this.isDragging = false;
  }

  /**
   * 开始选择
   */
  private startSelection(x: number): void {
    this.isSelecting = true;
    this.selectionStart = this.pixelToSample(x);
    this.selectionEnd = this.selectionStart;

    this.emitEvent('select', {
      type: 'start',
      startSample: this.selectionStart,
      endSample: this.selectionEnd
    });
  }

  /**
   * 更新选择区域
   */
  private updateSelection(x: number): void {
    if (!this.isSelecting || this.selectionStart === null) return;

    this.selectionEnd = this.pixelToSample(x);

    this.emitEvent('select', {
      type: 'update',
      startSample: Math.min(this.selectionStart, this.selectionEnd),
      endSample: Math.max(this.selectionStart, this.selectionEnd)
    });
  }

  /**
   * 结束选择
   */
  private endSelection(): void {
    if (!this.isSelecting) return;

    this.isSelecting = false;

    if (this.selectionStart !== null && this.selectionEnd !== null) {
      this.emitEvent('select', {
        type: 'end',
        startSample: Math.min(this.selectionStart, this.selectionEnd),
        endSample: Math.max(this.selectionStart, this.selectionEnd)
      });
    }
  }

  /**
   * 平移视图
   */
  public pan(deltaPixels: number): void {
    const deltaSamples = deltaPixels * this.viewport.samplesPerPixel;

    this.viewport.startSample += deltaSamples;
    this.viewport.endSample += deltaSamples;
    this.viewport.centerSample += deltaSamples;

    this.updateViewport();

    this.emitEvent('pan', {
      deltaSamples,
      viewport: { ...this.viewport }
    });
  }

  /**
   * 缩放视图
   */
  public zoom(factor: number): void {
    const newZoomLevel = this.viewport.zoomLevel * factor;

    // 限制缩放范围
    if (newZoomLevel < this.config.minZoomLevel || newZoomLevel > this.config.maxZoomLevel) {
      return;
    }

    this.zoomAtPoint(this.viewport.centerSample, factor);
  }

  /**
   * 在指定点缩放
   */
  public zoomAtPoint(centerSample: number, factor: number): void {
    const newZoomLevel = this.viewport.zoomLevel * factor;

    // 限制缩放范围
    if (newZoomLevel < this.config.minZoomLevel || newZoomLevel > this.config.maxZoomLevel) {
      return;
    }

    const canvasWidth = this.canvas.getBoundingClientRect().width;
    const currentSamplesRange = this.viewport.endSample - this.viewport.startSample;
    const newSamplesRange = currentSamplesRange * factor;

    // 保持中心点不变
    this.viewport.startSample = centerSample - newSamplesRange / 2;
    this.viewport.endSample = centerSample + newSamplesRange / 2;
    this.viewport.zoomLevel = newZoomLevel;
    this.viewport.centerSample = centerSample;

    this.updateViewport();

    this.emitEvent('zoom', {
      factor,
      direction: factor > 1 ? 'in' : 'out',
      centerSample,
      viewport: { ...this.viewport }
    });
  }

  /**
   * 重置视图
   */
  public resetView(): void {
    this.viewport.startSample = 0;
    this.viewport.endSample = 1000;
    this.viewport.zoomLevel = 1;
    this.viewport.centerSample = 500;

    this.updateViewport();

    this.emitEvent('zoom', {
      factor: 1,
      centerSample: this.viewport.centerSample,
      viewport: { ...this.viewport }
    });
  }

  /**
   * 更新视口计算值
   */
  private updateViewport(): void {
    const canvasWidth = this.canvas.getBoundingClientRect().width;
    const samplesRange = this.viewport.endSample - this.viewport.startSample;

    this.viewport.samplesPerPixel = samplesRange / canvasWidth;
    this.viewport.pixelsPerSample = canvasWidth / samplesRange;
  }

  /**
   * 像素坐标转样本索引
   */
  private pixelToSample(x: number): number {
    return this.viewport.startSample + x * this.viewport.samplesPerPixel;
  }

  /**
   * 样本索引转像素坐标
   */
  private sampleToPixel(sample: number): number {
    return (sample - this.viewport.startSample) / this.viewport.samplesPerPixel;
  }

  /**
   * 更新鼠标光标样式
   */
  private updateCursor(event: MouseEvent): void {
    if (event.ctrlKey || event.metaKey) {
      this.setCursor('crosshair'); // 选择模式
    } else {
      this.setCursor('grab'); // 平移模式
    }
  }

  /**
   * 添加事件监听器
   */
  public addEventListener(type: string, listener: (event: InteractionEvent) => void): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type)!.push(listener);
  }

  /**
   * 移除事件监听器
   */
  public removeEventListener(type: string, listener: (event: InteractionEvent) => void): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 发出事件
   */
  private emitEvent(type: string, data: any): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      const event: InteractionEvent = {
        type: type as any,
        data,
        timestamp: performance.now()
      };

      listeners.forEach(listener => listener(event));
    }
  }

  /**
   * 获取当前视口状态
   */
  public getViewport(): ViewportState {
    return { ...this.viewport };
  }

  /**
   * 设置视口状态
   */
  public setViewport(viewport: Partial<ViewportState>): void {
    this.viewport = { ...this.viewport, ...viewport };
    this.updateViewport();
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<InteractionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置 - 测试兼容方法
   */
  public getConfig(): InteractionConfig {
    return { ...this.config };
  }

  /**
   * 事件监听器 - 测试兼容方法
   */
  public on(event: string, callback: (data: any) => void): void {
    this.addEventListener(event, callback);
  }

  /**
   * 获取选择区域
   */
  public getSelection(): { start: number, end: number } | null {
    if (this.selectionStart !== null && this.selectionEnd !== null) {
      return {
        start: Math.min(this.selectionStart, this.selectionEnd),
        end: Math.max(this.selectionStart, this.selectionEnd)
      };
    }
    return null;
  }

  /**
   * 清除选择区域
   */
  public clearSelection(): void {
    this.selectionStart = null;
    this.selectionEnd = null;
    this.isSelecting = false;

    this.emitEvent('select', {
      type: 'clear'
    });
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    // 移除事件监听器
    this.canvas.removeEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.removeEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.removeEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.removeEventListener('wheel', this.onWheel.bind(this));
    this.canvas.removeEventListener('dblclick', this.onDoubleClick.bind(this));
    this.canvas.removeEventListener('keydown', this.onKeyDown.bind(this));
    this.canvas.removeEventListener('touchstart', this.onTouchStart.bind(this));
    this.canvas.removeEventListener('touchmove', this.onTouchMove.bind(this));
    this.canvas.removeEventListener('touchend', this.onTouchEnd.bind(this));

    // 清理事件监听器映射
    this.eventListeners.clear();

    // 重置状态
    this.isDragging = false;
    this.isSelecting = false;
    this.selectionStart = null;
    this.selectionEnd = null;
  }

  /**
   * 安全设置Canvas cursor样式，支持测试环境
   */
  private setCursor(cursorStyle: string): void {
    if (this.canvas.style) {
      this.canvas.style.cursor = cursorStyle;
    }
  }
}
