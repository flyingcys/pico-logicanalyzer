/**
 * test-infrastructure-integration 增强测试
 * 直接调用源文件中的各个测试函数来提高覆盖率
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

// Mock console.log to capture output
const originalConsoleLog = console.log;
const mockConsoleLog = jest.fn();

beforeAll(() => {
  console.log = mockConsoleLog;
});

afterAll(() => {
  console.log = originalConsoleLog;
});

describe('test-infrastructure-integration 增强测试 - 直接函数调用', () => {
  
  beforeEach(() => {
    mockConsoleLog.mockClear();
  });

  describe('直接调用各个测试函数', () => {
    let testModule: any;

    beforeEach(() => {
      // 重置模块以确保每次测试都是干净的状态
      jest.resetModules();
      testModule = require('../../../../src/webview/engines/test-infrastructure-integration');
    });

    it('应该能够调用 testAnnotationTypes 函数', () => {
      expect(() => {
        const result = testModule.testAnnotationTypes();
        expect(typeof result).toBe('boolean');
      }).not.toThrow();
    });

    it('应该能够调用 testAnnotationRenderer 函数', () => {
      expect(() => {
        const result = testModule.testAnnotationRenderer();
        expect(typeof result).toBe('boolean');
      }).not.toThrow();
    });

    it('应该能够调用 testEnhancedWaveformRenderer 函数', () => {
      expect(() => {
        const result = testModule.testEnhancedWaveformRenderer();
        expect(typeof result).toBe('boolean');
      }).not.toThrow();
    });

    it('应该能够调用 testDecoderStatusMonitor 函数', () => {
      expect(() => {
        const result = testModule.testDecoderStatusMonitor();
        expect(typeof result).toBe('boolean');
      }).not.toThrow();
    });

    it('应该能够调用 testPerformanceAnalyzer 函数', () => {
      expect(() => {
        const result = testModule.testPerformanceAnalyzer();
        expect(typeof result).toBe('boolean');
      }).not.toThrow();
    });

    it('应该能够调用 testDataExporter 函数', () => {
      expect(() => {
        const result = testModule.testDataExporter();
        expect(typeof result).toBe('boolean');
      }).not.toThrow();
    });

    it('应该能够调用 testMainIntegration 函数', () => {
      expect(() => {
        const result = testModule.testMainIntegration();
        expect(typeof result).toBe('boolean');
      }).not.toThrow();
    });
  });

  describe('runAllTests 函数调用', () => {
    it('应该能够完整执行 runAllTests 函数', async () => {
      jest.resetModules();
      const testModule = require('../../../../src/webview/engines/test-infrastructure-integration');
      
      await expect(testModule.runAllTests()).resolves.not.toThrow();
      
      // 验证控制台输出包含预期的测试信息
      expect(mockConsoleLog).toHaveBeenCalledWith('🚀 开始基础设施和集成功能自测验证...');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('='));
    });

    it('应该在 runAllTests 中执行所有7个测试', async () => {
      jest.resetModules();
      const testModule = require('../../../../src/webview/engines/test-infrastructure-integration');
      
      await testModule.runAllTests();
      
      // 验证测试结果输出
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('测试结果:'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('通过率:'));
    });
  });

  describe('各个测试函数的详细验证', () => {
    let testModule: any;

    beforeEach(() => {
      jest.resetModules();
      testModule = require('../../../../src/webview/engines/test-infrastructure-integration');
    });

    it('testAnnotationTypes 应该测试颜色管理器功能', () => {
      const result = testModule.testAnnotationTypes();
      
      expect(result).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith('📊 测试1: 注释类型系统');
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ 颜色管理器正常工作');
    });

    it('testAnnotationRenderer 应该执行渲染器测试', () => {
      const result = testModule.testAnnotationRenderer();
      
      expect(result).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith('📊 测试2: 注释渲染器模拟测试');
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ 注释渲染器类型检查通过');
    });

    it('testEnhancedWaveformRenderer 应该验证解码结果数据结构', () => {
      const result = testModule.testEnhancedWaveformRenderer();
      
      expect(result).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith('📊 测试3: 增强版波形渲染器接口');
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ 解码结果数据结构验证通过');
    });

    it('testDecoderStatusMonitor 应该测试状态监控数据', () => {
      const result = testModule.testDecoderStatusMonitor();
      
      expect(result).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith('📊 测试4: 解码器状态监控');
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ 解码器状态数据结构验证通过');
    });

    it('testPerformanceAnalyzer 应该测试性能分析数据', () => {
      const result = testModule.testPerformanceAnalyzer();
      
      expect(result).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith('📊 测试5: 性能分析工具');
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ 性能瓶颈数据结构验证通过');
    });

    it('testDataExporter 应该测试数据导出功能', () => {
      const result = testModule.testDataExporter();
      
      expect(result).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith('📊 测试6: 数据导出功能');
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ CSV格式导出数据生成成功');
    });

    it('testMainIntegration 应该验证主界面集成', () => {
      const result = testModule.testMainIntegration();
      
      expect(result).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith('📊 测试7: 主界面集成验证');
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ 事件处理函数验证通过');
    });
  });

  describe('错误处理和边界条件测试', () => {
    it('应该能够多次运行测试而不出错', async () => {
      const testModule = require('../../../../src/webview/engines/test-infrastructure-integration');
      
      // 连续运行多次测试
      for (let i = 0; i < 3; i++) {
        await expect(testModule.runAllTests()).resolves.not.toThrow();
      }
    });

    it('应该能够独立运行每个测试函数', () => {
      const testModule = require('../../../../src/webview/engines/test-infrastructure-integration');
      
      const testFunctions = [
        'testAnnotationTypes',
        'testAnnotationRenderer', 
        'testEnhancedWaveformRenderer',
        'testDecoderStatusMonitor',
        'testPerformanceAnalyzer',
        'testDataExporter',
        'testMainIntegration'
      ];

      testFunctions.forEach(funcName => {
        expect(() => {
          const result = testModule[funcName]();
          expect(typeof result).toBe('boolean');
        }).not.toThrow();
      });
    });

    it('应该处理连续的测试调用', () => {
      const testModule = require('../../../../src/webview/engines/test-infrastructure-integration');
      
      // 连续调用同一个测试函数
      for (let i = 0; i < 5; i++) {
        expect(() => {
          testModule.testAnnotationTypes();
        }).not.toThrow();
      }
    });
  });

  describe('性能验证测试', () => {
    it('应该在合理时间内完成所有测试', async () => {
      const testModule = require('../../../../src/webview/engines/test-infrastructure-integration');
      
      const startTime = performance.now();
      await testModule.runAllTests();
      const endTime = performance.now();
      
      // 测试应该在2秒内完成
      expect(endTime - startTime).toBeLessThan(2000);
    });

    it('应该在合理时间内完成单个测试', () => {
      const testModule = require('../../../../src/webview/engines/test-infrastructure-integration');
      
      const startTime = performance.now();
      testModule.testAnnotationTypes();
      const endTime = performance.now();
      
      // 单个测试应该在100ms内完成
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('模块导出验证', () => {
    it('应该导出所有预期的函数', () => {
      const testModule = require('../../../../src/webview/engines/test-infrastructure-integration');
      
      const expectedExports = [
        'testAnnotationTypes',
        'testAnnotationRenderer',
        'testEnhancedWaveformRenderer', 
        'testDecoderStatusMonitor',
        'testPerformanceAnalyzer',
        'testDataExporter',
        'testMainIntegration',
        'runAllTests'
      ];

      expectedExports.forEach(exportName => {
        expect(testModule).toHaveProperty(exportName);
        expect(typeof testModule[exportName]).toBe('function');
      });
    });
  });

  describe('测试输出验证', () => {
    it('应该输出正确的测试摘要信息', async () => {
      const testModule = require('../../../../src/webview/engines/test-infrastructure-integration');
      
      await testModule.runAllTests();
      
      // 验证关键输出信息
      expect(mockConsoleLog).toHaveBeenCalledWith('🎊 基础设施和集成功能自测验证完成');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('📦 已创建的组件和文件:'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('🚀 基础设施和集成工作已完成'));
    });

    it('应该为每个测试输出详细信息', async () => {
      const testModule = require('../../../../src/webview/engines/test-infrastructure-integration');
      
      await testModule.runAllTests();
      
      // 验证每个测试的分隔线
      const separatorCalls = mockConsoleLog.mock.calls.filter(call => 
        call[0] && call[0].includes('-'.repeat(40))
      );
      expect(separatorCalls.length).toBeGreaterThan(0);
    });
  });
});