/**
 * Jest自定义匹配器
 * 为逻辑分析器测试场景提供专用的断言方法
 */

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinPerformanceBudget(maxDuration: number): R;
      toHaveValidChannelData(): R;
      toBeValidI2CDecodeResult(): R;
      toBeValidSPIDecodeResult(): R;
      toBeValidUARTDecodeResult(): R;
      toHaveMemoryLeakBelow(threshold: number): R;
      toRenderWithinFPS(targetFPS: number): R;
    }
  }
}

// 扩展Jest匹配器
expect.extend({
  /**
   * 验证操作是否在性能预算内完成
   */
  toBeWithinPerformanceBudget(received: number, maxDuration: number) {
    const pass = received <= maxDuration;
    if (pass) {
      return {
        message: () =>
          `预期 ${received}ms 不应在性能预算 ${maxDuration}ms 内`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `预期 ${received}ms 应在性能预算 ${maxDuration}ms 内，超出了 ${(received - maxDuration).toFixed(2)}ms`,
        pass: false,
      };
    }
  },

  /**
   * 验证通道数据是否有效
   */
  toHaveValidChannelData(received: any) {
    const isValid = received &&
      typeof received.channelNumber === 'number' &&
      typeof received.channelName === 'string' &&
      typeof received.hidden === 'boolean' &&
      (received.samples instanceof Uint8Array || received.samples === undefined);

    if (isValid) {
      return {
        message: () => `预期通道数据无效`,
        pass: true,
      };
    } else {
      return {
        message: () => `预期通道数据有效，但收到: ${JSON.stringify(received)}`,
        pass: false,
      };
    }
  },

  /**
   * 验证I2C解码结果是否有效
   */
  toBeValidI2CDecodeResult(received: any[]) {
    const isValid = Array.isArray(received) &&
      received.every(result => 
        result.startSample !== undefined &&
        result.endSample !== undefined &&
        result.annotationType !== undefined &&
        Array.isArray(result.values)
      );

    // I2C解码器使用数字类型的annotationType
    // 0=start, 1=repeat-start, 2=stop, 3=ack, 4=nack, 5=bit, 6=address-read, 7=address-write, 8=data-read, 9=data-write, 10=warning
    const validAnnotationTypes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const hasValidTypes = received.every(result => 
      validAnnotationTypes.includes(result.annotationType)
    );

    if (isValid && hasValidTypes) {
      return {
        message: () => `预期I2C解码结果无效`,
        pass: true,
      };
    } else {
      return {
        message: () => `预期有效的I2C解码结果，但收到无效数据`,
        pass: false,
      };
    }
  },

  /**
   * 验证SPI解码结果是否有效
   */
  toBeValidSPIDecodeResult(received: any[]) {
    const isValid = Array.isArray(received) &&
      received.every(result => 
        result.startSample !== undefined &&
        result.endSample !== undefined &&
        result.annotationType !== undefined &&
        Array.isArray(result.values)
      );

    // SPI解码器使用数字类型的annotationType
    // 根据SPI解码器的注释定义，通常包括数据字节、CS状态等
    const validAnnotationTypes = Array.from({length: 20}, (_, i) => i); // 支持0-19的annotationType
    const hasValidTypes = received.every(result => 
      validAnnotationTypes.includes(result.annotationType)
    );

    if (isValid && hasValidTypes) {
      return {
        message: () => `预期SPI解码结果无效`,
        pass: true,
      };
    } else {
      return {
        message: () => `预期有效的SPI解码结果，但收到无效数据`,
        pass: false,
      };
    }
  },

  /**
   * 验证UART解码结果是否有效
   */
  toBeValidUARTDecodeResult(received: any[]) {
    const isValid = Array.isArray(received) &&
      received.every(result => 
        result.startSample !== undefined &&
        result.endSample !== undefined &&
        result.annotationType !== undefined &&
        Array.isArray(result.values)
      );

    // UART解码器使用数字类型的annotationType
    // 根据UART解码器的注释定义，通常包括起始位、数据位、停止位等
    const validAnnotationTypes = Array.from({length: 20}, (_, i) => i); // 支持0-19的annotationType
    const hasValidTypes = received.every(result => 
      validAnnotationTypes.includes(result.annotationType)
    );

    if (isValid && hasValidTypes) {
      return {
        message: () => `预期UART解码结果无效`,
        pass: true,
      };
    } else {
      return {
        message: () => `预期有效的UART解码结果，但收到无效数据`,
        pass: false,
      };
    }
  },

  /**
   * 验证内存泄漏是否在阈值以下
   */
  toHaveMemoryLeakBelow(received: { memoryGrowth: number; leakDetected: boolean }, threshold: number) {
    const pass = !received.leakDetected && received.memoryGrowth < threshold;
    
    if (pass) {
      return {
        message: () => `预期内存增长 ${received.memoryGrowth} bytes 应超过阈值 ${threshold} bytes`,
        pass: true,
      };
    } else {
      return {
        message: () => `预期无内存泄漏且增长 < ${threshold} bytes，但实际增长 ${received.memoryGrowth} bytes，泄漏检测: ${received.leakDetected}`,
        pass: false,
      };
    }
  },

  /**
   * 验证渲染是否达到目标FPS
   */
  toRenderWithinFPS(received: { averageFPS: number; droppedFrames: number }, targetFPS: number) {
    const pass = received.averageFPS >= targetFPS && received.droppedFrames <= targetFPS * 0.05; // 允许5%掉帧
    
    if (pass) {
      return {
        message: () => `预期FPS ${received.averageFPS} 不应达到目标 ${targetFPS}`,
        pass: true,
      };
    } else {
      return {
        message: () => `预期FPS >= ${targetFPS}，但实际 ${received.averageFPS.toFixed(2)}，掉帧 ${received.droppedFrames}`,
        pass: false,
      };
    }
  },
});

export {};