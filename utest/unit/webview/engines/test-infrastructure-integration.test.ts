/**
 * test-infrastructure-integration.ts 集成测试验证
 * 测试基础设施和集成功能的自测验证功能
 * @jest-environment jsdom
 */

import '../../../setup';

// Mock AnnotationTypes
jest.mock('../../../../src/webview/engines/AnnotationTypes', () => ({
  ProtocolAnalyzerSegmentShape: {
    Circle: 0,
    RoundRectangle: 1,
    Hexagon: 2,
    Rectangle: 3
  },
  AnnotationColorManager: {
    getInstance: jest.fn().mockReturnValue({
      getColor: jest.fn((index: number) => `#${(index * 123456 % 16777215).toString(16).padStart(6, '0')}`),
      getContrastTextColor: jest.fn((bgColor: string) => bgColor === '#ff0000' ? '#ffffff' : '#000000')
    })
  }
}));

// Mock console.log to prevent spam output during tests
const originalConsoleLog = console.log;
beforeAll(() => {
  console.log = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
});

describe('test-infrastructure-integration 集成测试验证', () => {
  
  describe('模块导入和基础功能', () => {
    it('应该能够导入集成测试模块', () => {
      expect(() => {
        require('../../../../src/webview/engines/test-infrastructure-integration');
      }).not.toThrow();
    });

    it('应该成功执行集成测试模块', () => {
      // 重置并重新设置console.log mock
      (console.log as jest.Mock).mockClear();
      jest.resetModules();
      
      const testModule = require('../../../../src/webview/engines/test-infrastructure-integration');
      
      // 模块应该存在且没有运行时错误
      expect(testModule).toBeDefined();
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('性能和错误处理', () => {
    it('应该能够重复运行测试', () => {
      // 多次导入应该不会出错
      for (let i = 0; i < 3; i++) {
        expect(() => {
          jest.resetModules();
          require('../../../../src/webview/engines/test-infrastructure-integration');
        }).not.toThrow();
      }
    });

    it('应该在合理时间内完成', () => {
      const startTime = performance.now();
      
      jest.resetModules();
      require('../../../../src/webview/engines/test-infrastructure-integration');
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
    });
  });

  describe('集成测试功能验证', () => {
    it('应该正确初始化测试环境', () => {
      // 验证模块能够正常加载和执行
      expect(() => {
        require('../../../../src/webview/engines/test-infrastructure-integration');
      }).not.toThrow();
    });

    it('应该调用必要的测试功能', () => {
      jest.resetModules();
      require('../../../../src/webview/engines/test-infrastructure-integration');
      
      // 验证console.log被调用，表明测试代码在执行
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('边界条件和异常处理', () => {
    it('应该处理多次初始化', () => {
      // 多次加载同一模块应该是安全的
      for (let i = 0; i < 5; i++) {
        expect(() => {
          require('../../../../src/webview/engines/test-infrastructure-integration');
        }).not.toThrow();
      }
    });

    it('应该正确处理控制台操作', () => {
      const mockConsole = jest.fn();
      const originalConsole = console.log;
      console.log = mockConsole;
      
      try {
        jest.resetModules();
        require('../../../../src/webview/engines/test-infrastructure-integration');
        expect(mockConsole).toHaveBeenCalled();
      } finally {
        console.log = originalConsole;
      }
    });
  });

  describe('性能基准测试', () => {
    it('应该在合理的内存范围内运行', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // 运行多次测试
      for (let i = 0; i < 10; i++) {
        jest.resetModules();
        require('../../../../src/webview/engines/test-infrastructure-integration');
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // 内存增长应该在合理范围内（小于50MB）
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('应该快速完成集成测试', () => {
      const iterations = 50;
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        require('../../../../src/webview/engines/test-infrastructure-integration');
      }
      
      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;
      
      // 平均每次执行应该在100ms以内
      expect(averageTime).toBeLessThan(100);
    });
  });

  describe('模块依赖验证', () => {
    it('应该正确导入所有必需的依赖', () => {
      // 通过成功导入来验证依赖是否正确
      expect(() => {
        jest.resetModules();
        require('../../../../src/webview/engines/test-infrastructure-integration');
      }).not.toThrow();
    });

    it('应该能够与Mock的依赖配合工作', () => {
      // 验证Mock的AnnotationTypes能正常工作
      const { AnnotationColorManager } = require('../../../../src/webview/engines/AnnotationTypes');
      const colorManager = AnnotationColorManager.getInstance();
      
      expect(colorManager).toBeDefined();
      expect(colorManager.getColor).toBeDefined();
      expect(colorManager.getContrastTextColor).toBeDefined();
      
      // 测试具体的Mock功能
      const color = colorManager.getColor(0);
      expect(typeof color).toBe('string');
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
      
      const textColor = colorManager.getContrastTextColor('#ff0000');
      expect(textColor).toBe('#ffffff');
    });
  });
});