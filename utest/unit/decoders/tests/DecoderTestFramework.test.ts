/**
 * DecoderTestFramework 单元测试
 * 测试解码器测试框架的各项功能
 */

import {
  DecoderTestFramework,
  DecoderTestCase,
  TestResult,
  runDecoderTests
} from '../../../../src/decoders/tests/DecoderTestFramework';
import { DecoderManager } from '../../../../src/decoders/DecoderManager';
import { I2CDecoder } from '../../../../src/decoders/protocols/I2CDecoder';
import { ChannelData, DecoderResult, DecoderOptionValue } from '../../../../src/decoders/types';

// Mock DecoderManager
jest.mock('../../../../src/decoders/DecoderManager');
jest.mock('../../../../src/decoders/protocols/I2CDecoder');

describe('DecoderTestFramework', () => {
  let testFramework: DecoderTestFramework;
  let mockDecoderManager: jest.Mocked<DecoderManager>;

  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks();
    
    // 创建mock DecoderManager实例
    mockDecoderManager = {
      registerDecoder: jest.fn(),
      executeDecoder: jest.fn(),
      dispose: jest.fn()
    } as any;

    // Mock DecoderManager构造函数
    (DecoderManager as jest.MockedClass<typeof DecoderManager>).mockImplementation(() => mockDecoderManager);

    testFramework = new DecoderTestFramework();
  });

  afterEach(() => {
    testFramework.dispose();
  });

  describe('构造函数', () => {
    it('应该创建 DecoderManager 实例', () => {
      expect(DecoderManager).toHaveBeenCalled();
    });

    it('应该注册I2C解码器', () => {
      expect(mockDecoderManager.registerDecoder).toHaveBeenCalledWith('i2c', I2CDecoder);
    });
  });

  describe('createTestChannels', () => {
    it('应该创建正确格式的测试通道数据', () => {
      const patterns = [
        [1, 0, 1, 0],
        [0, 1, 0, 1]
      ];

      const channels = testFramework.createTestChannels(patterns);

      expect(channels).toHaveLength(2);
      expect(channels[0]).toEqual({
        channelNumber: 0,
        channelName: 'Channel 0',
        samples: new Uint8Array([1, 0, 1, 0])
      });
      expect(channels[1]).toEqual({
        channelNumber: 1,
        channelName: 'Channel 1', 
        samples: new Uint8Array([0, 1, 0, 1])
      });
    });

    it('应该处理空模式数组', () => {
      const channels = testFramework.createTestChannels([]);
      expect(channels).toHaveLength(0);
    });

    it('应该处理单个通道', () => {
      const patterns = [[1, 1, 0, 0]];
      const channels = testFramework.createTestChannels(patterns);

      expect(channels).toHaveLength(1);
      expect(channels[0].channelNumber).toBe(0);
      expect(channels[0].samples).toEqual(new Uint8Array([1, 1, 0, 0]));
    });
  });

  describe('generateI2CWriteTestData', () => {
    it('应该生成包含SCL和SDA通道的I2C数据', () => {
      const channels = testFramework.generateI2CWriteTestData();

      expect(channels).toHaveLength(2);
      expect(channels[0]).toEqual({
        channelNumber: 0,
        channelName: 'SCL',
        samples: expect.any(Uint8Array)
      });
      expect(channels[1]).toEqual({
        channelNumber: 1,
        channelName: 'SDA',
        samples: expect.any(Uint8Array)
      });
    });

    it('应该生成200个样本的数据', () => {
      const channels = testFramework.generateI2CWriteTestData();
      
      expect(channels[0].samples).toHaveLength(200);
      expect(channels[1].samples).toHaveLength(200);
    });

    it('应该以初始高电平状态开始', () => {
      const channels = testFramework.generateI2CWriteTestData();
      const sclData = channels[0].samples;
      const sdaData = channels[1].samples;

      // 前10个样本应该都是高电平
      for (let i = 0; i < 10; i++) {
        expect(sclData[i]).toBe(1);
        expect(sdaData[i]).toBe(1);
      }
    });

    it('应该包含START条件', () => {
      const channels = testFramework.generateI2CWriteTestData();
      const sclData = channels[0].samples;
      const sdaData = channels[1].samples;

      // START条件: SCL保持高，SDA从高变低
      expect(sclData[10]).toBe(1);
      expect(sdaData[10]).toBe(0);
    });
  });

  describe('createI2CWriteTestCase', () => {
    it('应该创建有效的I2C写操作测试用例', () => {
      const testCase = testFramework.createI2CWriteTestCase();

      expect(testCase).toEqual({
        name: 'I2C Write Operation',
        description: 'Test I2C write operation with address 0x50 and data 0xAB',
        sampleRate: 1000000,
        channels: expect.any(Array),
        options: [{ optionIndex: 0, value: 'shifted' }],
        expectedResults: expect.any(Array),
        shouldSucceed: true
      });
    });

    it('应该包含正确的预期结果', () => {
      const testCase = testFramework.createI2CWriteTestCase();

      expect(testCase.expectedResults).toHaveLength(6);
      expect(testCase.expectedResults[0]).toEqual({ annotationType: 0, values: ['Start', 'S'] });
      expect(testCase.expectedResults[1]).toEqual({ annotationType: 7, rawData: 0x50 });
      expect(testCase.expectedResults[2]).toEqual({ annotationType: 3, values: ['ACK', 'A'] });
      expect(testCase.expectedResults[3]).toEqual({ annotationType: 9, rawData: 0xab });
      expect(testCase.expectedResults[4]).toEqual({ annotationType: 3, values: ['ACK', 'A'] });
      expect(testCase.expectedResults[5]).toEqual({ annotationType: 2, values: ['Stop', 'P'] });
    });
  });

  describe('runTestCase', () => {
    let testCase: DecoderTestCase;

    beforeEach(() => {
      testCase = {
        name: 'Test Case',
        description: 'Test Description',
        sampleRate: 1000000,
        channels: [
          { channelNumber: 0, channelName: 'SCL', samples: new Uint8Array([1, 0, 1]) },
          { channelNumber: 1, channelName: 'SDA', samples: new Uint8Array([1, 1, 0]) }
        ],
        options: [],
        expectedResults: [
          { annotationType: 0, values: ['Start', 'S'] }
        ],
        shouldSucceed: true
      };
    });

    it('应该成功运行测试用例', async () => {
      const mockResults: DecoderResult[] = [
        {
          startSample: 0,
          endSample: 10,
          annotationType: 0,
          values: ['Start', 'S']
        }
      ];

      mockDecoderManager.executeDecoder.mockResolvedValue({
        decoderName: 'i2c',
        results: mockResults,
        executionTime: 5,
        success: true
      });

      const result = await testFramework.runTestCase(testCase, 'i2c');

      expect(result.passed).toBe(true);
      expect(result.testName).toBe('Test Case');
      expect(result.actualResultCount).toBe(1);
      expect(result.expectedResultCount).toBe(1);
      expect(mockDecoderManager.executeDecoder).toHaveBeenCalledWith(
        'i2c',
        1000000,
        testCase.channels,
        []
      );
    });

    it('应该处理解码器执行失败', async () => {
      mockDecoderManager.executeDecoder.mockResolvedValue({
        decoderName: 'i2c',
        results: [],
        executionTime: 0,
        success: false,
        error: 'Decoder error'
      });

      const result = await testFramework.runTestCase(testCase, 'i2c');

      expect(result.passed).toBe(false);
      expect(result.error).toBe('Decoder error');
      expect(result.actualResultCount).toBe(0);
    });

    it('应该处理异常情况', async () => {
      mockDecoderManager.executeDecoder.mockRejectedValue(new Error('Test error'));

      const result = await testFramework.runTestCase(testCase, 'i2c');

      expect(result.passed).toBe(false);
      expect(result.error).toBe('Test error');
      expect(result.actualResultCount).toBe(0);
    });

    it('应该验证结果不匹配的情况', async () => {
      const mockResults: DecoderResult[] = [
        {
          startSample: 0,
          endSample: 10,
          annotationType: 1, // 不匹配的类型
          values: ['Wrong', 'W']
        }
      ];

      mockDecoderManager.executeDecoder.mockResolvedValue({
        decoderName: 'i2c',
        results: mockResults,
        executionTime: 5,
        success: true
      });

      const result = await testFramework.runTestCase(testCase, 'i2c');

      expect(result.passed).toBe(false);
      expect(result.error).toBe('Validation failed');
      expect(result.details).toContain('Result 0: annotation type mismatch: expected 0, got 1');
    });

    it('应该验证结果数量不匹配', async () => {
      const mockResults: DecoderResult[] = []; // 空结果

      mockDecoderManager.executeDecoder.mockResolvedValue({
        decoderName: 'i2c',
        results: mockResults,
        executionTime: 5,
        success: true
      });

      const result = await testFramework.runTestCase(testCase, 'i2c');

      expect(result.passed).toBe(false);
      expect(result.error).toBe('Result count mismatch: expected 1, got 0');
    });

    it('应该验证rawData不匹配的情况', async () => {
      const testCaseWithRawData: DecoderTestCase = {
        name: 'Test Case with Raw Data',
        description: 'Test Description',
        sampleRate: 1000000,
        channels: [
          { channelNumber: 0, channelName: 'SCL', samples: new Uint8Array([1, 0, 1]) },
          { channelNumber: 1, channelName: 'SDA', samples: new Uint8Array([1, 1, 0]) }
        ],
        options: [],
        expectedResults: [
          { annotationType: 0, values: ['Start', 'S'], rawData: 0x50 }
        ],
        shouldSucceed: true
      };

      const mockResults: DecoderResult[] = [
        {
          startSample: 0,
          endSample: 10,
          annotationType: 0,
          values: ['Start', 'S'],
          rawData: 0x60 // 不匹配的rawData
        }
      ];

      mockDecoderManager.executeDecoder.mockResolvedValue({
        decoderName: 'i2c',
        results: mockResults,
        executionTime: 5,
        success: true
      });

      const result = await testFramework.runTestCase(testCaseWithRawData, 'i2c');

      expect(result.passed).toBe(false);
      expect(result.error).toBe('Validation failed');
      expect(result.details).toContain('Result 0: raw data mismatch: expected 80, got 96');
    });

    it('应该验证values不匹配的情况', async () => {
      const mockResults: DecoderResult[] = [
        {
          startSample: 0,
          endSample: 10,
          annotationType: 0,
          values: ['Different', 'D'] // 不包含预期值的数组
        }
      ];

      mockDecoderManager.executeDecoder.mockResolvedValue({
        decoderName: 'i2c',
        results: mockResults,
        executionTime: 5,
        success: true
      });

      const result = await testFramework.runTestCase(testCase, 'i2c');

      expect(result.passed).toBe(false);
      expect(result.error).toBe('Validation failed');
      expect(result.details).toContain('Result 0: value mismatch: expected to contain "Start", got "Different"');
    });

    it('应该处理空values数组的情况', async () => {
      const mockResults: DecoderResult[] = [
        {
          startSample: 0,
          endSample: 10,
          annotationType: 0,
          values: [] // 空值数组
        }
      ];

      mockDecoderManager.executeDecoder.mockResolvedValue({
        decoderName: 'i2c',
        results: mockResults,
        executionTime: 5,
        success: true
      });

      const result = await testFramework.runTestCase(testCase, 'i2c');

      expect(result.passed).toBe(false);
      expect(result.error).toBe('Validation failed');
      expect(result.details).toContain('Result 0: value mismatch: expected to contain "Start", got "undefined"');
    });

    it('应该处理无expectedResults.values的情况', async () => {
      const testCaseWithoutExpectedValues: DecoderTestCase = {
        name: 'Test Case without expected values',
        description: 'Test Description',
        sampleRate: 1000000,
        channels: [
          { channelNumber: 0, channelName: 'SCL', samples: new Uint8Array([1, 0, 1]) },
          { channelNumber: 1, channelName: 'SDA', samples: new Uint8Array([1, 1, 0]) }
        ],
        options: [],
        expectedResults: [
          { annotationType: 0 } // 没有values字段
        ],
        shouldSucceed: true
      };

      const mockResults: DecoderResult[] = [
        {
          startSample: 0,
          endSample: 10,
          annotationType: 0,
          values: ['Start', 'S']
        }
      ];

      mockDecoderManager.executeDecoder.mockResolvedValue({
        decoderName: 'i2c',
        results: mockResults,
        executionTime: 5,
        success: true
      });

      const result = await testFramework.runTestCase(testCaseWithoutExpectedValues, 'i2c');

      expect(result.passed).toBe(true); // 应该通过，因为没有values验证
    });
  });

  describe('runI2CTests', () => {
    it('应该运行所有I2C测试用例', async () => {
      const mockResults: DecoderResult[] = [
        {
          startSample: 0,
          endSample: 10,
          annotationType: 0,
          values: ['Start', 'S']
        }
      ];

      mockDecoderManager.executeDecoder.mockResolvedValue({
        decoderName: 'i2c',
        results: mockResults,
        executionTime: 5,
        success: true
      });

      const results = await testFramework.runI2CTests();

      expect(results).toHaveLength(1);
      expect(results[0].testName).toBe('I2C Write Operation');
      expect(mockDecoderManager.executeDecoder).toHaveBeenCalledTimes(1);
    });

    it('应该处理多个测试用例', async () => {
      // 模拟运行多个测试的情况
      mockDecoderManager.executeDecoder.mockResolvedValue({
        decoderName: 'i2c',
        results: [],
        executionTime: 5,
        success: true
      });

      const results = await testFramework.runI2CTests();

      expect(results).toHaveLength(1); // 目前只有一个测试用例
      expect(mockDecoderManager.executeDecoder).toHaveBeenCalledTimes(1);
    });
  });

  describe('printTestResults', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('应该打印成功的测试结果', () => {
      const results: TestResult[] = [
        {
          testName: 'Test 1',
          passed: true,
          executionTime: 10.5,
          actualResultCount: 5,
          expectedResultCount: 5
        }
      ];

      testFramework.printTestResults(results);

      expect(consoleSpy).toHaveBeenCalledWith('\n=== 解码器测试结果 ===');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Test 1');
      expect(consoleSpy).toHaveBeenCalledWith('   执行时间: 10.50ms');
      expect(consoleSpy).toHaveBeenCalledWith('   结果数量: 5/5');
      expect(consoleSpy).toHaveBeenCalledWith('=== 总计 ===');
      expect(consoleSpy).toHaveBeenCalledWith('通过: 1/1');
      expect(consoleSpy).toHaveBeenCalledWith('总执行时间: 10.50ms');
      expect(consoleSpy).toHaveBeenCalledWith('平均执行时间: 10.50ms');
    });

    it('应该打印失败的测试结果', () => {
      const results: TestResult[] = [
        {
          testName: 'Test 1',
          passed: false,
          executionTime: 5.25,
          actualResultCount: 3,
          expectedResultCount: 5,
          error: 'Test failed',
          details: ['Detail 1', 'Detail 2']
        }
      ];

      testFramework.printTestResults(results);

      expect(consoleSpy).toHaveBeenCalledWith('❌ Test 1');
      expect(consoleSpy).toHaveBeenCalledWith('   执行时间: 5.25ms');
      expect(consoleSpy).toHaveBeenCalledWith('   结果数量: 3/5');
      expect(consoleSpy).toHaveBeenCalledWith('   错误: Test failed');
      expect(consoleSpy).toHaveBeenCalledWith('   详情: Detail 1');
      expect(consoleSpy).toHaveBeenCalledWith('   详情: Detail 2');
      expect(consoleSpy).toHaveBeenCalledWith('通过: 0/1');
    });

    it('应该处理空结果数组', () => {
      testFramework.printTestResults([]);

      expect(consoleSpy).toHaveBeenCalledWith('通过: 0/0');
      expect(consoleSpy).toHaveBeenCalledWith('总执行时间: 0.00ms');
      // 注意：当结果数组为空时，不会输出平均执行时间，因为分母为0
    });

    it('应该计算正确的统计信息', () => {
      const results: TestResult[] = [
        {
          testName: 'Test 1',
          passed: true,
          executionTime: 10,
          actualResultCount: 5,
          expectedResultCount: 5
        },
        {
          testName: 'Test 2',
          passed: false,
          executionTime: 20,
          actualResultCount: 3,
          expectedResultCount: 5,
          error: 'Failed'
        }
      ];

      testFramework.printTestResults(results);

      expect(consoleSpy).toHaveBeenCalledWith('通过: 1/2');
      expect(consoleSpy).toHaveBeenCalledWith('总执行时间: 30.00ms');
      expect(consoleSpy).toHaveBeenCalledWith('平均执行时间: 15.00ms');
    });
  });

  describe('dispose', () => {
    it('应该调用 DecoderManager 的 dispose 方法', () => {
      testFramework.dispose();
      expect(mockDecoderManager.dispose).toHaveBeenCalled();
    });
  });

  describe('类型接口', () => {
    it('DecoderTestCase 接口应该有正确的结构', () => {
      const testCase: DecoderTestCase = {
        name: 'Test',
        description: 'Description',
        sampleRate: 1000000,
        channels: [],
        expectedResults: [],
        shouldSucceed: true
      };

      expect(testCase.name).toBe('Test');
      expect(testCase.description).toBe('Description');
      expect(testCase.sampleRate).toBe(1000000);
      expect(testCase.channels).toEqual([]);
      expect(testCase.expectedResults).toEqual([]);
      expect(testCase.shouldSucceed).toBe(true);
    });

    it('TestResult 接口应该有正确的结构', () => {
      const result: TestResult = {
        testName: 'Test',
        passed: true,
        executionTime: 10,
        actualResultCount: 5,
        expectedResultCount: 5,
        error: 'Error',
        details: ['Detail']
      };

      expect(result.testName).toBe('Test');
      expect(result.passed).toBe(true);
      expect(result.executionTime).toBe(10);
      expect(result.actualResultCount).toBe(5);
      expect(result.expectedResultCount).toBe(5);
      expect(result.error).toBe('Error');
      expect(result.details).toEqual(['Detail']);
    });
  });
});

describe('runDecoderTests', () => {
  let consoleSpy: jest.SpyInstance;
  let mockDecoderManager: jest.Mocked<DecoderManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    mockDecoderManager = {
      registerDecoder: jest.fn(),
      executeDecoder: jest.fn(),
      dispose: jest.fn()
    } as any;

    (DecoderManager as jest.MockedClass<typeof DecoderManager>).mockImplementation(() => mockDecoderManager);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('应该运行解码器测试并打印结果', async () => {
    mockDecoderManager.executeDecoder.mockResolvedValue({
      decoderName: 'i2c',
      results: [],
      executionTime: 5,
      success: true
    });

    await runDecoderTests();

    expect(consoleSpy).toHaveBeenCalledWith('开始运行解码器测试...');
    expect(consoleSpy).toHaveBeenCalledWith('\n=== 解码器测试结果 ===');
    expect(mockDecoderManager.dispose).toHaveBeenCalled();
  });

  it('应该在异常情况下仍然调用dispose', async () => {
    mockDecoderManager.executeDecoder.mockRejectedValue(new Error('Test error'));

    // runDecoderTests()使用try-finally结构，不会重新抛出异常
    await runDecoderTests();
    expect(mockDecoderManager.dispose).toHaveBeenCalled();
  });
});