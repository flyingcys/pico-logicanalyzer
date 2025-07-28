/**
 * 解码器测试框架
 * 用于验证TypeScript解码器实现的正确性
 */

import { DecoderBase } from '../DecoderBase';
import { DecoderManager } from '../DecoderManager';
import { I2CDecoder } from '../protocols/I2CDecoder';
import { ChannelData, DecoderResult, DecoderOptionValue } from '../types';

/**
 * 测试用例定义
 */
export interface DecoderTestCase {
  /** 测试名称 */
  name: string;
  /** 测试描述 */
  description: string;
  /** 采样率 */
  sampleRate: number;
  /** 通道数据 */
  channels: ChannelData[];
  /** 解码器选项 */
  options?: DecoderOptionValue[];
  /** 预期结果 */
  expectedResults: Partial<DecoderResult>[];
  /** 是否应该成功 */
  shouldSucceed: boolean;
}

/**
 * 测试结果
 */
export interface TestResult {
  /** 测试用例名称 */
  testName: string;
  /** 是否通过 */
  passed: boolean;
  /** 执行时间 */
  executionTime: number;
  /** 实际结果数量 */
  actualResultCount: number;
  /** 预期结果数量 */
  expectedResultCount: number;
  /** 错误信息 */
  error?: string;
  /** 详细信息 */
  details?: string[];
}

/**
 * 解码器测试框架
 */
export class DecoderTestFramework {
  private decoderManager: DecoderManager;

  constructor() {
    this.decoderManager = new DecoderManager();
    this.registerDecoders();
  }

  /**
   * 注册解码器
   */
  private registerDecoders(): void {
    this.decoderManager.registerDecoder('i2c', I2CDecoder);
  }

  /**
   * 创建测试通道数据
   * @param patterns 数据模式数组
   * @returns 通道数据数组
   */
  public createTestChannels(patterns: number[][]): ChannelData[] {
    return patterns.map((pattern, index) => ({
      channelNumber: index,
      channelName: `Channel ${index}`,
      samples: new Uint8Array(pattern)
    }));
  }

  /**
   * 生成I2C测试数据
   * 生成典型的I2C写操作: START + 地址(0x50) + 写位 + ACK + 数据(0xAB) + ACK + STOP
   */
  public generateI2CWriteTestData(): ChannelData[] {
    const sampleCount = 200;
    const sclData = new Uint8Array(sampleCount);
    const sdaData = new Uint8Array(sampleCount);

    let sampleIndex = 0;

    // 初始状态: SCL=1, SDA=1
    for (let i = 0; i < 10; i++) {
      sclData[sampleIndex] = 1;
      sdaData[sampleIndex] = 1;
      sampleIndex++;
    }

    // START条件: SCL=1, SDA=1->0
    sclData[sampleIndex] = 1;
    sdaData[sampleIndex] = 0;
    sampleIndex++;

    // 地址字节 0x50 (0101 0000) + 写位(0) = 0xA0
    const addressByte = 0xa0; // 0x50 << 1 | 0
    for (let bit = 7; bit >= 0; bit--) {
      // SCL低电平
      sclData[sampleIndex] = 0;
      sdaData[sampleIndex] = (addressByte >> bit) & 1;
      sampleIndex++;

      // SCL高电平（数据采样）
      sclData[sampleIndex] = 1;
      sdaData[sampleIndex] = (addressByte >> bit) & 1;
      sampleIndex++;
    }

    // ACK位
    sclData[sampleIndex] = 0;
    sdaData[sampleIndex] = 0; // ACK
    sampleIndex++;
    sclData[sampleIndex] = 1;
    sdaData[sampleIndex] = 0; // ACK
    sampleIndex++;

    // 数据字节 0xAB
    const dataByte = 0xab;
    for (let bit = 7; bit >= 0; bit--) {
      // SCL低电平
      sclData[sampleIndex] = 0;
      sdaData[sampleIndex] = (dataByte >> bit) & 1;
      sampleIndex++;

      // SCL高电平（数据采样）
      sclData[sampleIndex] = 1;
      sdaData[sampleIndex] = (dataByte >> bit) & 1;
      sampleIndex++;
    }

    // ACK位
    sclData[sampleIndex] = 0;
    sdaData[sampleIndex] = 0; // ACK
    sampleIndex++;
    sclData[sampleIndex] = 1;
    sdaData[sampleIndex] = 0; // ACK
    sampleIndex++;

    // STOP条件: SCL=1, SDA=0->1
    sclData[sampleIndex] = 1;
    sdaData[sampleIndex] = 0;
    sampleIndex++;
    sclData[sampleIndex] = 1;
    sdaData[sampleIndex] = 1;
    sampleIndex++;

    // 填充剩余样本
    for (let i = sampleIndex; i < sampleCount; i++) {
      sclData[i] = 1;
      sdaData[i] = 1;
    }

    return [
      { channelNumber: 0, channelName: 'SCL', samples: sclData },
      { channelNumber: 1, channelName: 'SDA', samples: sdaData }
    ];
  }

  /**
   * 创建I2C写操作测试用例
   */
  public createI2CWriteTestCase(): DecoderTestCase {
    return {
      name: 'I2C Write Operation',
      description: 'Test I2C write operation with address 0x50 and data 0xAB',
      sampleRate: 1000000, // 1MHz
      channels: this.generateI2CWriteTestData(),
      options: [{ optionIndex: 0, value: 'shifted' }], // address_format
      expectedResults: [
        { annotationType: 0, values: ['Start', 'S'] }, // START
        { annotationType: 7, rawData: 0x50 }, // ADDRESS WRITE
        { annotationType: 3, values: ['ACK', 'A'] }, // ACK
        { annotationType: 9, rawData: 0xab }, // DATA WRITE
        { annotationType: 3, values: ['ACK', 'A'] }, // ACK
        { annotationType: 2, values: ['Stop', 'P'] } // STOP
      ],
      shouldSucceed: true
    };
  }

  /**
   * 运行单个测试用例
   */
  public async runTestCase(testCase: DecoderTestCase, decoderId: string): Promise<TestResult> {
    const startTime = performance.now();

    try {
      const result = await this.decoderManager.executeDecoder(
        decoderId,
        testCase.sampleRate,
        testCase.channels,
        testCase.options || []
      );

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      if (!result.success) {
        return {
          testName: testCase.name,
          passed: false,
          executionTime,
          actualResultCount: 0,
          expectedResultCount: testCase.expectedResults.length,
          error: result.error || 'Unknown error'
        };
      }

      // 验证结果
      const validationResult = this.validateResults(result.results, testCase.expectedResults);

      return {
        testName: testCase.name,
        passed: validationResult.passed,
        executionTime,
        actualResultCount: result.results.length,
        expectedResultCount: testCase.expectedResults.length,
        error: validationResult.error,
        details: validationResult.details
      };
    } catch (error) {
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      return {
        testName: testCase.name,
        passed: false,
        executionTime,
        actualResultCount: 0,
        expectedResultCount: testCase.expectedResults.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 验证解码结果
   */
  private validateResults(
    actualResults: DecoderResult[],
    expectedResults: Partial<DecoderResult>[]
  ): { passed: boolean; error?: string; details?: string[] } {
    const details: string[] = [];

    if (actualResults.length !== expectedResults.length) {
      return {
        passed: false,
        error: `Result count mismatch: expected ${expectedResults.length}, got ${actualResults.length}`,
        details
      };
    }

    for (let i = 0; i < expectedResults.length; i++) {
      const actual = actualResults[i];
      const expected = expectedResults[i];

      // 检查注释类型
      if (
        expected.annotationType !== undefined &&
        actual.annotationType !== expected.annotationType
      ) {
        details.push(
          `Result ${i}: annotation type mismatch: expected ${expected.annotationType}, got ${actual.annotationType}`
        );
      }

      // 检查原始数据
      if (expected.rawData !== undefined && actual.rawData !== expected.rawData) {
        details.push(
          `Result ${i}: raw data mismatch: expected ${expected.rawData}, got ${actual.rawData}`
        );
      }

      // 检查值数组（部分匹配）
      if (expected.values && actual.values) {
        const expectedFirstValue = expected.values[0];
        const actualFirstValue = actual.values[0];
        if (expectedFirstValue && !actualFirstValue?.includes(expectedFirstValue)) {
          details.push(
            `Result ${i}: value mismatch: expected to contain "${expectedFirstValue}", got "${actualFirstValue}"`
          );
        }
      }
    }

    const passed = details.length === 0;
    return {
      passed,
      error: passed ? undefined : 'Validation failed',
      details: details.length > 0 ? details : undefined
    };
  }

  /**
   * 运行所有I2C测试
   */
  public async runI2CTests(): Promise<TestResult[]> {
    const testCases = [this.createI2CWriteTestCase()];

    const results: TestResult[] = [];

    for (const testCase of testCases) {
      const result = await this.runTestCase(testCase, 'i2c');
      results.push(result);
    }

    return results;
  }

  /**
   * 打印测试结果
   */
  public printTestResults(results: TestResult[]): void {
    console.log('\n=== 解码器测试结果 ===');

    let passedCount = 0;
    let totalTime = 0;

    for (const result of results) {
      totalTime += result.executionTime;

      if (result.passed) {
        passedCount++;
        console.log(`✅ ${result.testName}`);
        console.log(`   执行时间: ${result.executionTime.toFixed(2)}ms`);
        console.log(`   结果数量: ${result.actualResultCount}/${result.expectedResultCount}`);
      } else {
        console.log(`❌ ${result.testName}`);
        console.log(`   执行时间: ${result.executionTime.toFixed(2)}ms`);
        console.log(`   结果数量: ${result.actualResultCount}/${result.expectedResultCount}`);
        console.log(`   错误: ${result.error}`);
        if (result.details) {
          result.details.forEach(detail => console.log(`   详情: ${detail}`));
        }
      }
      console.log('');
    }

    console.log('=== 总计 ===');
    console.log(`通过: ${passedCount}/${results.length}`);
    console.log(`总执行时间: ${totalTime.toFixed(2)}ms`);
    console.log(`平均执行时间: ${(totalTime / results.length).toFixed(2)}ms`);
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    this.decoderManager.dispose();
  }
}

// 导出便捷函数
export async function runDecoderTests(): Promise<void> {
  const testFramework = new DecoderTestFramework();

  try {
    console.log('开始运行解码器测试...');
    const results = await testFramework.runI2CTests();
    testFramework.printTestResults(results);
  } finally {
    testFramework.dispose();
  }
}
