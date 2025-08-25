/**
 * Mock硬件接口实现
 * 
 * 功能：
 * - 模拟硬件连接和数据采集
 * - 保持协议正确性
 * - 支持测试场景定制
 */

/**
 * Mock硬件接口定义
 */
interface MockHardwareInterface {
  isConnected: boolean;
  deviceId: string;
  capabilities: {
    channels: number;
    maxSampleRate: number;
  };
  
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  simulateDataCapture(samples: number): Promise<Uint8Array>;
}

/**
 * 创建标准Mock硬件实例
 */
function createMockHardware(): MockHardwareInterface {
  return {
    isConnected: false,
    deviceId: `test-device-${Date.now()}`,
    capabilities: {
      channels: 8,
      maxSampleRate: 24000000
    },
    
    async connect(): Promise<boolean> {
      // 模拟连接延迟
      await new Promise(resolve => setTimeout(resolve, 100));
      this.isConnected = true;
      return true;
    },
    
    async disconnect(): Promise<void> {
      await new Promise(resolve => setTimeout(resolve, 50));
      this.isConnected = false;
    },
    
    async simulateDataCapture(samples: number): Promise<Uint8Array> {
      if (!this.isConnected) {
        throw new Error('设备未连接');
      }
      
      // 生成模拟数据
      const data = new Uint8Array(samples);
      for (let i = 0; i < samples; i++) {
        data[i] = Math.floor(Math.random() * 256);
      }
      return data;
    }
  };
}

/**
 * 生成测试数据工具函数
 */
function generateTestSampleData(samples: number = 1000): Uint8Array {
  const data = new Uint8Array(samples);
  
  // 生成有模式的测试数据（便于验证）
  for (let i = 0; i < samples; i++) {
    // 简单的周期性模式
    data[i] = (i % 256);
  }
  
  return data;
}

export { MockHardwareInterface, createMockHardware, generateTestSampleData };