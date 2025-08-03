/**
 * InteractionEngine 100%完美覆盖率测试
 * 专门针对未覆盖的代码路径进行测试，实现100%覆盖率
 * 目标：覆盖行225-232, 303-318
 * 
 * @jest-environment jsdom
 */

import {
  InteractionEngine,
  InteractionConfig,
  ViewportState,
  InteractionEvent
} from '../../../../src/webview/engines/InteractionEngine';

// Mock Performance API
Object.defineProperty(global, 'performance', {
  value: {
    now: jest.fn(() => 1000)
  },
  writable: true
});

describe('InteractionEngine - 完美覆盖率测试', () => {
  let canvas: HTMLCanvasElement;
  let engine: InteractionEngine;
  let mockGetBoundingClientRect: jest.Mock;

  beforeEach(() => {
    // Mock canvas getBoundingClientRect
    mockGetBoundingClientRect = jest.fn(() => ({
      left: 0,
      top: 0,
      width: 800,
      height: 600
    }));

    // Create mock canvas
    canvas = {
      getBoundingClientRect: mockGetBoundingClientRect,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      style: {
        cursor: 'default'
      },
      tabIndex: 0
    } as any;

    engine = new InteractionEngine(canvas);
  });

  afterEach(() => {
    if (engine) {
      engine.dispose();
    }
    jest.clearAllMocks();
  });

  describe('键盘快捷键未覆盖路径测试', () => {
    it('应该覆盖Minus键的缩放功能 - 行225-228', () => {
      const onKeyDown = (canvas.addEventListener as jest.Mock).mock.calls
        .find(call => call[0] === 'keydown')[1];

      const mockKeyboardEvent = {
        code: 'Minus',
        ctrlKey: true,
        metaKey: false,
        preventDefault: jest.fn()
      };

      const initialZoom = engine.getViewport().zoomLevel;
      
      onKeyDown(mockKeyboardEvent);
      
      const finalZoom = engine.getViewport().zoomLevel;
      expect(finalZoom).toBeGreaterThan(initialZoom); // 1.25倍表示缩小
      expect(mockKeyboardEvent.preventDefault).toHaveBeenCalled();
    });

    it('应该覆盖NumpadSubtract键的缩放功能 - 行225-228', () => {
      const onKeyDown = (canvas.addEventListener as jest.Mock).mock.calls
        .find(call => call[0] === 'keydown')[1];

      const mockKeyboardEvent = {
        code: 'NumpadSubtract',
        ctrlKey: false,
        metaKey: true, // 使用metaKey而不是ctrlKey
        preventDefault: jest.fn()
      };

      const initialZoom = engine.getViewport().zoomLevel;
      
      onKeyDown(mockKeyboardEvent);
      
      const finalZoom = engine.getViewport().zoomLevel;
      expect(finalZoom).toBeGreaterThan(initialZoom);
      expect(mockKeyboardEvent.preventDefault).toHaveBeenCalled();
    });

    it('应该覆盖Digit0键的重置功能 - 行230-234', () => {
      // 先修改视图状态
      engine.zoom(3.0);
      engine.pan(200);
      
      const onKeyDown = (canvas.addEventListener as jest.Mock).mock.calls
        .find(call => call[0] === 'keydown')[1];

      const mockKeyboardEvent = {
        code: 'Digit0',
        ctrlKey: true,
        metaKey: false,
        preventDefault: jest.fn()
      };

      onKeyDown(mockKeyboardEvent);
      
      const viewport = engine.getViewport();
      expect(viewport.zoomLevel).toBe(1);
      expect(viewport.centerSample).toBe(500);
      expect(mockKeyboardEvent.preventDefault).toHaveBeenCalled();
    });

    it('应该覆盖Numpad0键的重置功能 - 行230-234', () => {
      // 先修改视图状态
      engine.zoom(2.5);
      engine.pan(-100);
      
      const onKeyDown = (canvas.addEventListener as jest.Mock).mock.calls
        .find(call => call[0] === 'keydown')[1];

      const mockKeyboardEvent = {
        code: 'Numpad0',
        ctrlKey: false,
        metaKey: true, // 使用metaKey
        preventDefault: jest.fn()
      };

      onKeyDown(mockKeyboardEvent);
      
      const viewport = engine.getViewport();
      expect(viewport.zoomLevel).toBe(1);
      expect(viewport.centerSample).toBe(500);
      expect(mockKeyboardEvent.preventDefault).toHaveBeenCalled();
    });
  });

  describe('选择功能未覆盖路径测试', () => {
    it('应该覆盖updateSelection的早期返回路径 - 行303', () => {
      // 创建选择事件监听器
      const selectEventListener = jest.fn();
      engine.addEventListener('select', selectEventListener);

      // 直接调用私有方法来测试未覆盖的路径
      const engineAny = engine as any;
      
      // 场景1：isSelecting为false时应该早期返回
      engineAny.isSelecting = false;
      engineAny.selectionStart = 100;
      engineAny.updateSelection(200);
      
      // 应该没有发出任何事件，因为早期返回了
      expect(selectEventListener).not.toHaveBeenCalled();
      
      // 场景2：selectionStart为null时应该早期返回
      engineAny.isSelecting = true;
      engineAny.selectionStart = null;
      engineAny.updateSelection(200);
      
      // 应该仍然没有发出任何事件
      expect(selectEventListener).not.toHaveBeenCalled();
    });

    it('应该覆盖updateSelection的正常执行路径 - 行305-311', () => {
      const selectEventListener = jest.fn();
      engine.addEventListener('select', selectEventListener);

      const engineAny = engine as any;
      
      // 设置正确的选择状态
      engineAny.isSelecting = true;
      engineAny.selectionStart = 100;
      
      // 调用updateSelection
      engineAny.updateSelection(200);
      
      // 应该发出选择更新事件
      expect(selectEventListener).toHaveBeenCalledWith({
        type: 'select',
        data: {
          type: 'update',
          startSample: expect.any(Number),
          endSample: expect.any(Number)
        },
        timestamp: expect.any(Number)
      });
    });

    it('应该覆盖endSelection的早期返回路径 - 行318', () => {
      const selectEventListener = jest.fn();
      engine.addEventListener('select', selectEventListener);

      const engineAny = engine as any;
      
      // 场景：isSelecting为false时应该早期返回
      engineAny.isSelecting = false;
      engineAny.selectionStart = 100;
      engineAny.selectionEnd = 200;
      
      engineAny.endSelection();
      
      // 应该没有发出任何事件，因为早期返回了
      expect(selectEventListener).not.toHaveBeenCalled();
    });

    it('应该测试完整的选择流程包含updateSelection', () => {
      const selectEventListener = jest.fn();
      engine.addEventListener('select', selectEventListener);

      // 模拟完整的选择流程
      const onMouseDown = (canvas.addEventListener as jest.Mock).mock.calls
        .find(call => call[0] === 'mousedown')[1];
      const onMouseMove = (canvas.addEventListener as jest.Mock).mock.calls
        .find(call => call[0] === 'mousemove')[1];
      const onMouseUp = (canvas.addEventListener as jest.Mock).mock.calls
        .find(call => call[0] === 'mouseup')[1];

      const startEvent = {
        clientX: 100,
        clientY: 50,
        button: 0,
        ctrlKey: true,
        preventDefault: jest.fn()
      };

      // 开始选择
      onMouseDown(startEvent);
      expect(selectEventListener).toHaveBeenCalledWith({
        type: 'select',
        data: expect.objectContaining({
          type: 'start'
        }),
        timestamp: expect.any(Number)
      });

      // 移动鼠标以触发updateSelection
      const moveEvent = {
        clientX: 200,
        clientY: 50,
        button: 0,
        ctrlKey: true,
        preventDefault: jest.fn()
      };
      onMouseMove(moveEvent);
      
      // 应该触发update事件
      expect(selectEventListener).toHaveBeenCalledWith({
        type: 'select',
        data: expect.objectContaining({
          type: 'update'
        }),
        timestamp: expect.any(Number)
      });

      // 结束选择
      onMouseUp(moveEvent);
      
      // 应该触发end事件
      expect(selectEventListener).toHaveBeenCalledWith({
        type: 'select',
        data: expect.objectContaining({
          type: 'end'
        }),
        timestamp: expect.any(Number)
      });
    });
  });

  describe('边界条件和特殊场景测试', () => {
    it('应该处理同时按下Ctrl和Meta键的情况', () => {
      const onKeyDown = (canvas.addEventListener as jest.Mock).mock.calls
        .find(call => call[0] === 'keydown')[1];

      const mockKeyboardEvent = {
        code: 'Equal',
        ctrlKey: true,
        metaKey: true, // 同时按下两个修饰键
        preventDefault: jest.fn()
      };

      const initialZoom = engine.getViewport().zoomLevel;
      
      onKeyDown(mockKeyboardEvent);
      
      // 应该仍然执行缩放操作
      const finalZoom = engine.getViewport().zoomLevel;
      expect(finalZoom).not.toBe(initialZoom);
      expect(mockKeyboardEvent.preventDefault).toHaveBeenCalled();
    });

    it('应该处理选择区域反向拖拽', () => {
      const selectEventListener = jest.fn();
      engine.addEventListener('select', selectEventListener);

      const engineAny = engine as any;
      
      // 设置反向选择（end < start）
      engineAny.isSelecting = true;
      engineAny.selectionStart = 300; // 起始点在右边
      
      engineAny.updateSelection(100); // 结束点在左边
      
      // 验证Min/Max逻辑正确处理了反向选择
      expect(selectEventListener).toHaveBeenCalledWith({
        type: 'select',
        data: {
          type: 'update',
          startSample: expect.any(Number),
          endSample: expect.any(Number)
        },
        timestamp: expect.any(Number)
      });

      // 验证startSample <= endSample
      const callData = selectEventListener.mock.calls[0][0].data;
      expect(callData.startSample).toBeLessThanOrEqual(callData.endSample);
    });

    it('应该处理极端的键盘事件组合', () => {
      const onKeyDown = (canvas.addEventListener as jest.Mock).mock.calls
        .find(call => call[0] === 'keydown')[1];

      // 测试所有未覆盖的键盘事件
      const testCases = [
        { code: 'Minus', ctrlKey: true, metaKey: false },
        { code: 'NumpadSubtract', ctrlKey: false, metaKey: true },
        { code: 'Digit0', ctrlKey: true, metaKey: false },
        { code: 'Numpad0', ctrlKey: false, metaKey: true }
      ];

      testCases.forEach(testCase => {
        const mockEvent = {
          ...testCase,
          preventDefault: jest.fn()
        };

        expect(() => {
          onKeyDown(mockEvent);
        }).not.toThrow();

        expect(mockEvent.preventDefault).toHaveBeenCalled();
      });
    });
  });
});