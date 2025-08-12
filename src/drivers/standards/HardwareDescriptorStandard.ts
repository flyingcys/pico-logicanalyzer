/**
 * 硬件描述标准和解析器
 * 定义统一的硬件能力描述格式，支持硬件生态扩展
 */

import { AnalyzerDriverType, CaptureLimits, TriggerType } from '../types/AnalyzerTypes';

/**
 * 硬件能力描述标准
 * 基于原始C#代码的AnalyzerDeviceInfo扩展而来
 */
export interface HardwareDescriptor {
  // 基础设备信息
  device: {
    id: string; // 设备唯一标识符
    name: string; // 设备名称
    manufacturer: string; // 制造商
    model: string; // 型号
    version: string; // 硬件版本
    firmware?: string; // 固件版本
    serialNumber?: string; // 序列号
  };

  // 连接能力
  connectivity: {
    interfaces: ConnectionInterface[]; // 支持的连接接口
    protocols: ProtocolSupport[]; // 支持的通信协议
    networkConfig?: NetworkCapability; // 网络配置能力
  };

  // 采集能力
  capture: {
    channels: ChannelCapability; // 通道能力
    sampling: SamplingCapability; // 采样能力
    triggers: TriggerCapability; // 触发能力
    timing: TimingCapability; // 时序能力
    buffers: BufferCapability; // 缓冲区能力
  };

  // 高级功能
  features: {
    signalGeneration?: boolean; // 信号发生功能
    powerSupply?: PowerSupplyCapability; // 电源输出能力
    voltageMonitoring?: VoltageMonitoringCapability; // 电压监控
    calibration?: CalibrationCapability; // 校准功能
    streaming?: StreamingCapability; // 流式采集
    compression?: CompressionCapability; // 数据压缩
  };

  // 性能参数
  performance: {
    maxSampleRate: number; // 最大采样率 (Hz)
    minSampleRate: number; // 最小采样率 (Hz)
    bandwidth: number; // 带宽 (Hz)
    rise_time?: number; // 上升时间 (ns)
    inputImpedance: number; // 输入阻抗 (Ohm)
    maxVoltage: number; // 最大输入电压 (V)
    minVoltage: number; // 最小输入电压 (V)
    resolution?: number; // ADC分辨率 (bits)
  };

  // 软件支持
  software: {
    driverType: AnalyzerDriverType; // 驱动类型
    apiVersion: string; // API版本
    sdkSupport?: string[]; // 支持的SDK版本
    customDecoders?: boolean; // 自定义解码器支持
    scriptingSupport?: ScriptingSupport; // 脚本支持
  };

  // 元数据
  metadata: {
    created: string; // 创建时间 (ISO 8601)
    modified?: string; // 修改时间 (ISO 8601)
    version: string; // 描述符版本
    schemaVersion: string; // 模式版本
    tags?: string[]; // 标签
    compatibility?: CompatibilityInfo; // 兼容性信息
  };
}

/**
 * 连接接口定义
 */
export interface ConnectionInterface {
  type: 'usb' | 'ethernet' | 'serial' | 'bluetooth' | 'wifi' | 'pcie' | 'custom';
  name: string; // 接口名称
  specification?: string; // 规范版本 (如 "USB 3.0", "Ethernet 1Gbps")
  connectorType?: string; // 连接器类型
  parameters?: { [key: string]: any }; // 接口特定参数
}

/**
 * 协议支持定义
 */
export interface ProtocolSupport {
  name: string; // 协议名称
  version?: string; // 协议版本
  description?: string; // 协议描述
  parameters?: { [key: string]: any }; // 协议参数
}

/**
 * 网络能力定义
 */
export interface NetworkCapability {
  wifi?: {
    standards: string[]; // 支持的WiFi标准
    frequencies: number[]; // 支持的频率
    encryption: string[]; // 支持的加密方式
  };
  ethernet?: {
    speeds: number[]; // 支持的速度 (Mbps)
    duplex: ('half' | 'full')[]; // 双工模式
  };
  protocols: string[]; // 支持的网络协议
}

/**
 * 通道能力定义
 */
export interface ChannelCapability {
  digital: {
    count: number; // 数字通道数量
    maxVoltage: number; // 最大输入电压
    inputModes: ('single-ended' | 'differential')[]; // 输入模式
    termination?: number[]; // 支持的终端匹配阻值
    coupling?: ('dc' | 'ac')[]; // 耦合方式
  };
  analog?: {
    count: number; // 模拟通道数量
    resolution: number; // ADC分辨率 (bits)
    sampleRate: number; // 模拟采样率
    range: [number, number]; // 电压范围 [min, max]
    coupling: ('dc' | 'ac')[]; // 耦合方式
    bandwidth: number; // 带宽 (Hz)
  };
  mixed?: {
    supported: boolean; // 是否支持混合信号
    simultaneousChannels: number; // 同时采集的通道数
  };
}

/**
 * 采样能力定义
 */
export interface SamplingCapability {
  rates: {
    maximum: number; // 最大采样率
    minimum: number; // 最小采样率
    supported: number[]; // 支持的离散采样率
    continuous?: boolean; // 是否支持连续采样率
    step?: number; // 采样率步进
  };
  modes: ('single' | 'continuous' | 'burst' | 'streaming')[]; // 采样模式
  synchronization?: {
    external: boolean; // 外部同步
    master: boolean; // 主机模式
    slave: boolean; // 从机模式
    multiDevice: boolean; // 多设备同步
  };
  precision: {
    timebase: number; // 时基精度 (ppm)
    jitter: number; // 时钟抖动 (ps)
    stability: number; // 稳定性 (ppm/°C)
  };
}

/**
 * 触发能力定义
 */
export interface TriggerCapability {
  types: TriggerType[]; // 支持的触发类型
  channels: {
    digital: number; // 数字触发通道数
    analog?: number; // 模拟触发通道数
    external?: number; // 外部触发通道数
  };
  conditions: TriggerCondition[]; // 支持的触发条件
  modes: TriggerMode[]; // 触发模式
  advanced?: {
    sequentialTrigger: boolean; // 序列触发
    delayedTrigger: boolean; // 延时触发
    conditionalTrigger: boolean; // 条件触发
    patternTrigger: {
      maxWidth: number; // 最大模式宽度
      maskSupport: boolean; // 掩码支持
    };
  };
}

/**
 * 触发条件枚举
 */
export enum TriggerCondition {
  RisingEdge = 'rising-edge',
  FallingEdge = 'falling-edge',
  BothEdges = 'both-edges',
  HighLevel = 'high-level',
  LowLevel = 'low-level',
  Pattern = 'pattern',
  PulseWidth = 'pulse-width',
  Timeout = 'timeout',
  Custom = 'custom'
}

/**
 * 触发模式枚举
 */
export enum TriggerMode {
  Normal = 'normal',
  Auto = 'auto',
  Single = 'single',
  Stop = 'stop',
  Force = 'force'
}

/**
 * 时序能力定义
 */
export interface TimingCapability {
  resolution: number; // 时间分辨率 (ps)
  accuracy: number; // 时间精度 (ppm)
  range: [number, number]; // 时间范围 [min, max] (s)
  referenceClocks: string[]; // 支持的参考时钟
  timestamping?: {
    absolute: boolean; // 绝对时间戳
    relative: boolean; // 相对时间戳
    external: boolean; // 外部时间戳
  };
}

/**
 * 缓冲区能力定义
 */
export interface BufferCapability {
  memory: {
    total: number; // 总内存大小 (bytes)
    perChannel: number; // 每通道内存 (bytes)
    segmented?: boolean; // 分段缓冲区支持
  };
  modes: BufferMode[]; // 缓冲区模式
  compression?: {
    algorithms: ('rle' | 'lz4' | 'custom')[]; // 压缩算法
    ratio: number; // 压缩比
  };
}

/**
 * 缓冲区模式枚举
 */
export enum BufferMode {
  Circular = 'circular',
  Linear = 'linear',
  Segmented = 'segmented',
  Streaming = 'streaming'
}

/**
 * 电源能力定义
 */
export interface PowerSupplyCapability {
  outputs: PowerOutput[]; // 电源输出
  protection: {
    overcurrent: boolean; // 过流保护
    overvoltage: boolean; // 过压保护
    shortCircuit: boolean; // 短路保护
  };
}

/**
 * 电源输出定义
 */
export interface PowerOutput {
  name: string; // 输出名称
  voltage: {
    min: number; // 最小电压
    max: number; // 最大电压
    step: number; // 电压步进
    accuracy: number; // 精度 (%)
  };
  current: {
    max: number; // 最大电流
    accuracy: number; // 精度 (%)
  };
  ripple: number; // 纹波 (mV)
}

/**
 * 电压监控能力定义
 */
export interface VoltageMonitoringCapability {
  channels: number; // 监控通道数
  range: [number, number]; // 电压范围 [min, max]
  resolution: number; // 分辨率 (bits)
  accuracy: number; // 精度 (%)
  updateRate: number; // 更新率 (Hz)
}

/**
 * 校准能力定义
 */
export interface CalibrationCapability {
  automatic: boolean; // 自动校准
  manual: boolean; // 手动校准
  external: boolean; // 外部校准
  frequency: number; // 校准频率 (建议间隔，小时)
  parameters: string[]; // 可校准参数
}

/**
 * 流式采集能力定义
 */
export interface StreamingCapability {
  protocols: ('tcp' | 'udp' | 'usb' | 'custom')[]; // 流式协议
  bandwidth: number; // 流式带宽 (MB/s)
  latency: number; // 延迟 (ms)
  bufferSize: number; // 流式缓冲区大小
}

/**
 * 压缩能力定义
 */
export interface CompressionCapability {
  algorithms: string[]; // 支持的压缩算法
  realtime: boolean; // 实时压缩
  ratio: number; // 平均压缩比
  speed: number; // 压缩速度 (MB/s)
}

/**
 * 脚本支持定义
 */
export interface ScriptingSupport {
  languages: string[]; // 支持的脚本语言
  apis: string[]; // 可用的API
  sandboxed: boolean; // 沙盒执行
  realtime: boolean; // 实时脚本执行
}

/**
 * 兼容性信息
 */
export interface CompatibilityInfo {
  backwardCompatible: string[]; // 向后兼容的版本
  forwardCompatible: string[]; // 向前兼容的版本
  deprecatedFeatures: string[]; // 废弃的功能
  knownIssues: string[]; // 已知问题
}

/**
 * 硬件描述解析器
 * 负责解析和验证硬件描述文件
 */
export class HardwareDescriptorParser {
  private static readonly SCHEMA_VERSION = '1.0.0';
  private static readonly SUPPORTED_VERSIONS = ['1.0.0'];

  /**
   * 解析硬件描述
   */
  static parse(descriptor: string | object): HardwareDescriptor {
    try {
      const parsed = typeof descriptor === 'string' ? JSON.parse(descriptor) : descriptor;

      // 验证描述符
      this.validate(parsed);

      return parsed as HardwareDescriptor;
    } catch (error) {
      throw new Error(`Failed to parse hardware descriptor: ${error}`);
    }
  }

  /**
   * 验证硬件描述
   */
  static validate(descriptor: any): void {
    // 基本结构验证
    if (!descriptor || typeof descriptor !== 'object') {
      throw new Error('Invalid descriptor: must be an object');
    }

    // 必需字段验证
    const requiredFields = [
      'device',
      'connectivity',
      'capture',
      'performance',
      'software',
      'metadata'
    ];

    for (const field of requiredFields) {
      if (!descriptor[field]) {
        throw new Error(`Required field missing: ${field}`);
      }
    }

    // 版本兼容性检查
    if (!this.SUPPORTED_VERSIONS.includes(descriptor.metadata?.schemaVersion)) {
      throw new Error(`Unsupported schema version: ${descriptor.metadata?.schemaVersion}`);
    }

    // 设备信息验证
    this.validateDevice(descriptor.device);

    // 采集能力验证
    this.validateCapture(descriptor.capture);

    // 性能参数验证
    this.validatePerformance(descriptor.performance);
  }

  /**
   * 验证设备信息
   */
  private static validateDevice(device: any): void {
    const required = ['id', 'name', 'manufacturer', 'model', 'version'];
    for (const field of required) {
      if (!device[field] || typeof device[field] !== 'string') {
        throw new Error(`Invalid device.${field}: must be a non-empty string`);
      }
    }
  }

  /**
   * 验证采集能力
   */
  private static validateCapture(capture: any): void {
    // 通道验证
    if (!capture.channels?.digital?.count || capture.channels.digital.count < 1) {
      throw new Error('Invalid capture.channels: must have at least 1 digital channel');
    }

    // 采样率验证
    if (!capture.sampling?.rates?.maximum || capture.sampling.rates.maximum < 1000) {
      throw new Error('Invalid capture.sampling: maximum rate must be at least 1kHz');
    }
  }

  /**
   * 验证性能参数
   */
  private static validatePerformance(performance: any): void {
    if (performance.maxSampleRate <= performance.minSampleRate) {
      throw new Error('Invalid performance: maxSampleRate must be greater than minSampleRate');
    }

    if (performance.maxVoltage <= performance.minVoltage) {
      throw new Error('Invalid performance: maxVoltage must be greater than minVoltage');
    }
  }

  /**
   * 生成默认描述符模板
   */
  static generateTemplate(deviceInfo: {
    id: string;
    name: string;
    manufacturer: string;
    model: string;
  }): HardwareDescriptor {
    return {
      device: {
        id: deviceInfo.id,
        name: deviceInfo.name,
        manufacturer: deviceInfo.manufacturer,
        model: deviceInfo.model,
        version: '1.0.0'
      },
      connectivity: {
        interfaces: [
          {
            type: 'usb',
            name: 'USB 2.0',
            specification: 'USB 2.0'
          }
        ],
        protocols: [
          {
            name: 'Custom Binary Protocol',
            version: '1.0'
          }
        ]
      },
      capture: {
        channels: {
          digital: {
            count: 24,
            maxVoltage: 5.0,
            inputModes: ['single-ended']
          }
        },
        sampling: {
          rates: {
            maximum: 100000000,
            minimum: 1000,
            supported: [1000, 10000, 100000, 1000000, 10000000, 100000000],
            continuous: false
          },
          modes: ['single', 'continuous'],
          precision: {
            timebase: 50, // 50 ppm时基精度
            jitter: 100, // 100 ps时钟抖动
            stability: 2.5 // 2.5 ppm/°C稳定性
          }
        },
        triggers: {
          types: [TriggerType.Edge, TriggerType.Complex],
          channels: {
            digital: 24
          },
          conditions: [
            TriggerCondition.RisingEdge,
            TriggerCondition.FallingEdge,
            TriggerCondition.Pattern
          ],
          modes: [TriggerMode.Normal, TriggerMode.Auto]
        },
        timing: {
          resolution: 10, // 10ps
          accuracy: 50, // 50ppm
          range: [1e-9, 1000], // 1ns to 1000s
          referenceClocks: ['internal', 'external', 'auto'] // 支持的参考时钟源
        },
        buffers: {
          memory: {
            total: 4 * 1024 * 1024, // 4MB
            perChannel: 1024 * 1024 // 1MB
          },
          modes: [BufferMode.Circular, BufferMode.Linear]
        }
      },
      features: {
        signalGeneration: false,
        streaming: {
          protocols: ['usb'],
          bandwidth: 10, // 10MB/s
          latency: 10, // 10ms
          bufferSize: 1024 * 1024
        }
      },
      performance: {
        maxSampleRate: 100000000,
        minSampleRate: 1000,
        bandwidth: 50000000,
        inputImpedance: 1000000,
        maxVoltage: 5.0,
        minVoltage: -5.0
      },
      software: {
        driverType: AnalyzerDriverType.Serial,
        apiVersion: '1.0.0',
        customDecoders: true
      },
      metadata: {
        created: new Date().toISOString(),
        version: '1.0.0',
        schemaVersion: this.SCHEMA_VERSION
      }
    };
  }

  /**
   * 比较两个硬件描述符的兼容性
   */
  static compareCompatibility(
    desc1: HardwareDescriptor,
    desc2: HardwareDescriptor
  ): CompatibilityResult {
    const result: CompatibilityResult = {
      compatible: true,
      issues: [],
      warnings: [],
      score: 1.0
    };

    // 比较基本能力
    if (desc1.capture.channels.digital.count !== desc2.capture.channels.digital.count) {
      result.issues.push('Different digital channel counts');
      result.compatible = false;
      result.score -= 0.2;
    }

    if (desc1.performance.maxSampleRate !== desc2.performance.maxSampleRate) {
      result.warnings.push('Different maximum sample rates');
      result.score -= 0.1;
    }

    // 比较触发能力
    const triggers1 = new Set(desc1.capture.triggers.types);
    const triggers2 = new Set(desc2.capture.triggers.types);
    const commonTriggers = new Set([...triggers1].filter(x => triggers2.has(x)));

    if (commonTriggers.size < Math.min(triggers1.size, triggers2.size)) {
      result.warnings.push('Different trigger capabilities');
      result.score -= 0.05;
    }

    return result;
  }
}

/**
 * 兼容性比较结果
 */
export interface CompatibilityResult {
  compatible: boolean; // 是否兼容
  issues: string[]; // 兼容性问题
  warnings: string[]; // 警告信息
  score: number; // 兼容性评分 (0-1)
}

/**
 * 硬件描述注册表
 * 管理已注册的硬件描述符
 */
export class HardwareDescriptorRegistry {
  private descriptors = new Map<string, HardwareDescriptor>();
  private categories = new Map<string, Set<string>>();

  /**
   * 注册硬件描述符
   */
  register(descriptor: HardwareDescriptor): void {
    // 验证描述符
    HardwareDescriptorParser.validate(descriptor);

    // 注册到注册表
    this.descriptors.set(descriptor.device.id, descriptor);

    // 分类管理
    const category = `${descriptor.device.manufacturer}-${descriptor.device.model}`;
    if (!this.categories.has(category)) {
      this.categories.set(category, new Set());
    }
    this.categories.get(category)!.add(descriptor.device.id);
  }

  /**
   * 获取硬件描述符
   */
  get(deviceId: string): HardwareDescriptor | undefined {
    return this.descriptors.get(deviceId);
  }

  /**
   * 搜索兼容的硬件
   */
  findCompatible(requirements: Partial<HardwareDescriptor>): HardwareDescriptor[] {
    const results: HardwareDescriptor[] = [];

    for (const descriptor of this.descriptors.values()) {
      if (this.matches(descriptor, requirements)) {
        results.push(descriptor);
      }
    }

    return results.sort(
      (a, b) => this.calculateScore(b, requirements) - this.calculateScore(a, requirements)
    );
  }

  /**
   * 检查描述符是否匹配要求
   */
  private matches(
    descriptor: HardwareDescriptor,
    requirements: Partial<HardwareDescriptor>
  ): boolean {
    // 基本匹配逻辑
    if (
      requirements.device?.manufacturer &&
      descriptor.device.manufacturer !== requirements.device.manufacturer
    ) {
      return false;
    }

    if (
      requirements.capture?.channels?.digital?.count &&
      descriptor.capture.channels.digital.count < requirements.capture.channels.digital.count
    ) {
      return false;
    }

    if (
      requirements.performance?.maxSampleRate &&
      descriptor.performance.maxSampleRate < requirements.performance.maxSampleRate
    ) {
      return false;
    }

    return true;
  }

  /**
   * 计算匹配评分
   */
  private calculateScore(
    descriptor: HardwareDescriptor,
    requirements: Partial<HardwareDescriptor>
  ): number {
    let score = 0;

    // 制造商匹配加分
    if (requirements.device?.manufacturer === descriptor.device.manufacturer) {
      score += 10;
    }

    // 型号匹配加分
    if (requirements.device?.model === descriptor.device.model) {
      score += 5;
    }

    // 通道数匹配加分
    if (requirements.capture?.channels?.digital?.count) {
      const req = requirements.capture.channels.digital.count;
      const actual = descriptor.capture.channels.digital.count;
      if (actual >= req) {
        score += Math.max(0, 5 - (actual - req) * 0.1);
      }
    }

    return score;
  }

  /**
   * 获取所有已注册的描述符
   */
  getAll(): HardwareDescriptor[] {
    return Array.from(this.descriptors.values());
  }

  /**
   * 按类别获取描述符
   */
  getByCategory(manufacturer: string, model?: string): HardwareDescriptor[] {
    const results: HardwareDescriptor[] = [];

    for (const descriptor of this.descriptors.values()) {
      if (descriptor.device.manufacturer === manufacturer) {
        if (!model || descriptor.device.model === model) {
          results.push(descriptor);
        }
      }
    }

    return results;
  }

  /**
   * 清理注册表
   */
  clear(): void {
    this.descriptors.clear();
    this.categories.clear();
  }
}

// 导出全局注册表实例
export const hardwareDescriptorRegistry = new HardwareDescriptorRegistry();
