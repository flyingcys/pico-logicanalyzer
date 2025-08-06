/**
 * Jest自定义匹配器
 * 为解码器测试提供专用的断言方法
 */

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidDecoderResult(): R;
      toBeValidI2CFrame(): R;
      toBeValidSPIFrame(): R;
      toBeValidUARTFrame(): R;
      toBeValidChannelData(): R;
      toHaveAnnotation(type: string, data?: any): R;
    }
  }
}

// 验证解码器结果格式
expect.extend({
  toBeValidDecoderResult(received) {
    const pass = received &&
      typeof received.startSample === 'number' &&
      typeof received.endSample === 'number' &&
      received.startSample >= 0 &&
      received.endSample >= received.startSample &&
      Array.isArray(received.annotations);

    if (pass) {
      return {
        message: () => '验证解码器结果格式正确',
        pass: true,
      };
    } else {
      return {
        message: () => `期望是有效的解码器结果，但收到: ${JSON.stringify(received)}`,
        pass: false,
      };
    }
  },

  // 验证I2C帧格式
  toBeValidI2CFrame(received) {
    const pass = received &&
      typeof received.type === 'string' &&
      ['start', 'address', 'data', 'ack', 'nack', 'stop'].includes(received.type) &&
      typeof received.startSample === 'number' &&
      typeof received.endSample === 'number';

    if (pass) {
      return {
        message: () => '验证I2C帧格式正确',
        pass: true,
      };
    } else {
      return {
        message: () => `期望是有效的I2C帧，但收到: ${JSON.stringify(received)}`,
        pass: false,
      };
    }
  },

  // 验证SPI帧格式
  toBeValidSPIFrame(received) {
    const pass = received &&
      typeof received.mosi === 'number' &&
      typeof received.miso === 'number' &&
      typeof received.startSample === 'number' &&
      typeof received.endSample === 'number';

    if (pass) {
      return {
        message: () => '验证SPI帧格式正确',
        pass: true,
      };
    } else {
      return {
        message: () => `期望是有效的SPI帧，但收到: ${JSON.stringify(received)}`,
        pass: false,
      };
    }
  },

  // 验证UART帧格式
  toBeValidUARTFrame(received) {
    const pass = received &&
      typeof received.data === 'number' &&
      typeof received.startSample === 'number' &&
      typeof received.endSample === 'number' &&
      received.data >= 0 && received.data <= 511; // 9位最大值

    if (pass) {
      return {
        message: () => '验证UART帧格式正确',
        pass: true,
      };
    } else {
      return {
        message: () => `期望是有效的UART帧，但收到: ${JSON.stringify(received)}`,
        pass: false,
      };
    }
  },

  // 验证通道数据格式
  toBeValidChannelData(received) {
    const pass = received &&
      Array.isArray(received) &&
      received.every((sample: any) => typeof sample === 'number' && sample >= 0);

    if (pass) {
      return {
        message: () => '验证通道数据格式正确',
        pass: true,
      };
    } else {
      return {
        message: () => `期望是有效的通道数据，但收到: ${JSON.stringify(received)}`,
        pass: false,
      };
    }
  },

  // 验证是否包含特定注释
  toHaveAnnotation(received, type: string, data?: any) {
    if (!Array.isArray(received.annotations)) {
      return {
        message: () => `期望结果包含注释数组，但收到: ${JSON.stringify(received)}`,
        pass: false,
      };
    }

    const hasType = received.annotations.some((ann: any) => 
      Array.isArray(ann) && ann[0] === type
    );

    if (!hasType) {
      return {
        message: () => `期望结果包含类型 '${type}' 的注释，但没有找到`,
        pass: false,
      };
    }

    if (data !== undefined) {
      const hasData = received.annotations.some((ann: any) => 
        Array.isArray(ann) && ann[0] === type && ann[1] === data
      );

      if (!hasData) {
        return {
          message: () => `期望结果包含类型 '${type}' 且数据为 '${data}' 的注释，但没有找到`,
          pass: false,
        };
      }
    }

    return {
      message: () => `验证注释存在且正确`,
      pass: true,
    };
  },
});

export {};