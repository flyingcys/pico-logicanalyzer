/**
 * 硬件能力构建器
 * 帮助开发者构建标准化的硬件能力描述
 */

/**
 * 通道能力配置
 */
export interface ChannelCapability {
  digital: number;              // 数字通道数
  analog?: number;              // 模拟通道数 (可选)
  maxVoltage: number;           // 最大输入电压 (V)
  minVoltage?: number;          // 最小输入电压 (V)
  inputImpedance: number;       // 输入阻抗 (Ω)
  thresholdVoltage?: number;    // 阈值电压 (V)
  differentialInputs?: boolean; // 是否支持差分输入
}

/**
 * 采样能力配置
 */
export interface SamplingCapability {
  maxRate: number;              // 最大采样率 (Hz)
  minRate: number;              // 最小采样率 (Hz)
  supportedRates?: number[];    // 支持的固定采样率列表
  bufferSize: number;           // 缓冲区大小 (样本数)
  streamingSupport: boolean;    // 是否支持流式采集
  compressionSupport?: boolean; // 是否支持数据压缩
  realTimePreview?: boolean;    // 是否支持实时预览
}

/**
 * 触发能力配置
 */
export interface TriggerCapability {
  types: number[];              // 支持的触发类型 [0=Edge, 1=Complex, 2=Fast, 3=Blast]
  maxChannels: number;          // 最大触发通道数
  patternWidth: number;         // 模式匹配位宽
  sequentialSupport: boolean;   // 是否支持序列触发
  conditions: string[];         // 支持的触发条件
  advancedTriggers?: {
    pulseWidth?: boolean;       // 脉宽触发
    runtTrigger?: boolean;      // Runt触发
    setupHold?: boolean;        // 建立保持时间触发
    timeout?: boolean;          // 超时触发
  };
}

/**
 * 连接能力配置
 */
export interface ConnectivityCapability {
  interfaces: string[];         // 连接接口 ['usb', 'ethernet', 'wifi', 'serial']
  protocols: string[];          // 支持的协议 ['scpi', 'custom', 'rest']
  networkConfig?: {
    staticIP?: boolean;         // 是否支持静态IP
    dhcp?: boolean;             // 是否支持DHCP
    discovery?: boolean;        // 是否支持自动发现
    encryption?: boolean;       // 是否支持加密连接
  };
}

/**
 * 特性能力配置
 */
export interface FeatureCapability {
  signalGeneration?: boolean;   // 信号发生功能
  powerSupply?: boolean;        // 电源供应功能
  voltageMonitoring?: boolean;  // 电压监控功能
  protocolDecoding?: boolean;   // 协议解码功能
  mathFunctions?: boolean;      // 数学运算功能
  measurements?: boolean;       // 自动测量功能
  export?: {
    formats?: string[];         // 支持的导出格式
    compression?: boolean;      // 导出压缩支持
  };
}

/**
 * 完整的硬件能力描述
 */
export interface HardwareCapability {
  channels: ChannelCapability;
  sampling: SamplingCapability;
  triggers: TriggerCapability;
  connectivity: ConnectivityCapability;
  features: FeatureCapability;
  metadata?: {
    manufacturer?: string;      // 制造商
    model?: string;            // 型号
    revision?: string;         // 硬件版本
    calibrationDate?: Date;    // 校准日期
    certifications?: string[]; // 认证信息
  };
}

/**
 * 测试兼容的硬件能力描述（匹配测试期望的结构）
 */
export interface HardwareCapabilities {
  deviceName?: string;
  manufacturer?: string;
  firmwareVersion?: string;
  hardwareVersion?: string;
  channels: {
    digitalChannels: number;
    analogChannels?: number;
    maxVoltage: number;
    minVoltage?: number;
    inputImpedance: number;
    thresholdVoltage?: number;
    differentialInputs?: boolean;
  };
  sampling: {
    maxSampleRate: number;
    minSampleRate: number;
    supportedRates?: number[];
    maxBufferSize: number;
    streamingSupport?: boolean;
    compressionSupport?: boolean;
    realTimePreview?: boolean;
  };
  triggers: {
    supportedTypes: string[];
    maxChannels: number;
    patternWidth?: number;
    sequentialSupport?: boolean;
    conditions?: string[];
    advancedTriggers?: {
      pulseWidth?: boolean;
      runtTrigger?: boolean;
      setupHold?: boolean;
      timeout?: boolean;
    };
  };
  connection: {
    supportedTypes: string[];
    protocols?: string[];
    networkConfig?: {
      staticIP?: boolean;
      dhcp?: boolean;
      discovery?: boolean;
      encryption?: boolean;
    };
  };
  features: {
    signalGeneration?: boolean;
    powerSupply?: boolean;
    voltageMonitoring?: boolean;
    protocolDecoding?: boolean;
    mathFunctions?: boolean;
    measurements?: boolean;
    export?: {
      formats?: string[];
      compression?: boolean;
    };
  };
  clock?: {
    internalClock?: boolean;
    externalClockSupport?: boolean;
    supportedFrequencies?: number[];
  };
  synchronization?: {
    supported?: boolean;
    maxDevices?: number;
  };
}

/**
 * 预定义的硬件模板
 */
export enum HardwareTemplate {
  BASIC_USB_LA = 'basic-usb-la',
  PROFESSIONAL_LA = 'professional-la',
  MIXED_SIGNAL = 'mixed-signal',
  NETWORK_LA = 'network-la',
  HIGH_SPEED_LA = 'high-speed-la'
}

/**
 * 硬件能力构建器类
 */
export class HardwareCapabilityBuilder {
  private capability: Partial<HardwareCapability> = {};

  constructor(template?: HardwareTemplate) {
    if (template) {
      this.applyTemplate(template);
    }
  }

  /**
   * 应用预定义模板
   */
  applyTemplate(template: HardwareTemplate): this {
    switch (template) {
      case HardwareTemplate.BASIC_USB_LA:
        this.capability = {
          channels: {
            digital: 8,
            maxVoltage: 5.0,
            inputImpedance: 1000000
          },
          sampling: {
            maxRate: 24000000,
            minRate: 1000,
            bufferSize: 1000000,
            streamingSupport: false
          },
          triggers: {
            types: [0, 1], // Edge, Complex
            maxChannels: 8,
            patternWidth: 8,
            sequentialSupport: false,
            conditions: ['rising', 'falling', 'high', 'low']
          },
          connectivity: {
            interfaces: ['usb'],
            protocols: ['custom']
          },
          features: {
            signalGeneration: false,
            powerSupply: false,
            voltageMonitoring: false,
            protocolDecoding: true
          }
        };
        break;

      case HardwareTemplate.PROFESSIONAL_LA:
        this.capability = {
          channels: {
            digital: 32,
            maxVoltage: 5.0,
            minVoltage: -5.0,
            inputImpedance: 1000000,
            thresholdVoltage: 1.4,
            differentialInputs: true
          },
          sampling: {
            maxRate: 1000000000,
            minRate: 1000,
            bufferSize: 100000000,
            streamingSupport: true,
            compressionSupport: true,
            realTimePreview: true
          },
          triggers: {
            types: [0, 1, 2, 3], // All types
            maxChannels: 32,
            patternWidth: 32,
            sequentialSupport: true,
            conditions: ['rising', 'falling', 'high', 'low', 'change'],
            advancedTriggers: {
              pulseWidth: true,
              runtTrigger: true,
              setupHold: true,
              timeout: true
            }
          },
          connectivity: {
            interfaces: ['usb', 'ethernet'],
            protocols: ['scpi', 'custom'],
            networkConfig: {
              staticIP: true,
              dhcp: true,
              discovery: true,
              encryption: true
            }
          },
          features: {
            signalGeneration: true,
            powerSupply: true,
            voltageMonitoring: true,
            protocolDecoding: true,
            mathFunctions: true,
            measurements: true,
            export: {
              formats: ['csv', 'vcd', 'sr', 'lac'],
              compression: true
            }
          }
        };
        break;

      case HardwareTemplate.MIXED_SIGNAL:
        this.capability = {
          channels: {
            digital: 16,
            analog: 4,
            maxVoltage: 20.0,
            minVoltage: -20.0,
            inputImpedance: 1000000,
            differentialInputs: true
          },
          sampling: {
            maxRate: 500000000,
            minRate: 1000,
            bufferSize: 50000000,
            streamingSupport: true,
            realTimePreview: true
          },
          triggers: {
            types: [0, 1, 2],
            maxChannels: 20,
            patternWidth: 16,
            sequentialSupport: true,
            conditions: ['rising', 'falling', 'high', 'low', 'change', 'analog_level'],
            advancedTriggers: {
              pulseWidth: true,
              timeout: true
            }
          },
          connectivity: {
            interfaces: ['usb', 'ethernet'],
            protocols: ['scpi', 'custom']
          },
          features: {
            signalGeneration: true,
            powerSupply: false,
            voltageMonitoring: true,
            protocolDecoding: true,
            mathFunctions: true,
            measurements: true
          }
        };
        break;

      case HardwareTemplate.NETWORK_LA:
        this.capability = {
          channels: {
            digital: 16,
            maxVoltage: 3.3,
            inputImpedance: 1000000
          },
          sampling: {
            maxRate: 100000000,
            minRate: 1000,
            bufferSize: 10000000,
            streamingSupport: true,
            compressionSupport: true
          },
          triggers: {
            types: [0, 1],
            maxChannels: 16,
            patternWidth: 16,
            sequentialSupport: false,
            conditions: ['rising', 'falling', 'high', 'low']
          },
          connectivity: {
            interfaces: ['ethernet', 'wifi'],
            protocols: ['rest', 'websocket'],
            networkConfig: {
              staticIP: true,
              dhcp: true,
              discovery: true,
              encryption: false
            }
          },
          features: {
            signalGeneration: false,
            powerSupply: false,
            voltageMonitoring: false,
            protocolDecoding: true,
            export: {
              formats: ['json', 'csv'],
              compression: true
            }
          }
        };
        break;

      case HardwareTemplate.HIGH_SPEED_LA:
        this.capability = {
          channels: {
            digital: 64,
            maxVoltage: 3.3,
            inputImpedance: 50, // 高速信号通常用50Ω
            thresholdVoltage: 1.65
          },
          sampling: {
            maxRate: 10000000000, // 10GHz
            minRate: 100000,
            bufferSize: 1000000000,
            streamingSupport: true,
            compressionSupport: true,
            realTimePreview: false // 高速模式通常不支持实时预览
          },
          triggers: {
            types: [0, 2], // Edge, Fast
            maxChannels: 64,
            patternWidth: 64,
            sequentialSupport: false,
            conditions: ['rising', 'falling']
          },
          connectivity: {
            interfaces: ['usb3', 'pcie'],
            protocols: ['custom']
          },
          features: {
            signalGeneration: false,
            powerSupply: false,
            voltageMonitoring: false,
            protocolDecoding: true
          }
        };
        break;

      default:
        throw new Error(`未知的硬件模板: ${template}`);
    }

    return this;
  }

  /**
   * 设置通道能力
   */
  setChannelCapability(channels: Partial<ChannelCapability>): this {
    this.capability.channels = {
      ...this.capability.channels,
      ...channels
    } as ChannelCapability;
    return this;
  }

  /**
   * 设置采样能力
   */
  setSamplingCapability(sampling: Partial<SamplingCapability>): this {
    this.capability.sampling = {
      ...this.capability.sampling,
      ...sampling
    } as SamplingCapability;
    return this;
  }

  /**
   * 设置触发能力
   */
  setTriggerCapability(triggers: Partial<TriggerCapability>): this {
    this.capability.triggers = {
      ...this.capability.triggers,
      ...triggers
    } as TriggerCapability;
    return this;
  }

  /**
   * 设置连接能力
   */
  setConnectivityCapability(connectivity: Partial<ConnectivityCapability>): this {
    this.capability.connectivity = {
      ...this.capability.connectivity,
      ...connectivity
    } as ConnectivityCapability;
    return this;
  }

  /**
   * 设置特性能力
   */
  setFeatureCapability(features: Partial<FeatureCapability>): this {
    this.capability.features = {
      ...this.capability.features,
      ...features
    } as FeatureCapability;
    return this;
  }

  /**
   * 设置元数据
   */
  setMetadata(metadata: HardwareCapability['metadata']): this {
    this.capability.metadata = {
      ...this.capability.metadata,
      ...metadata
    };
    return this;
  }

  // 便捷的设备信息设置方法
  setDeviceName(name: string): this {
    if (!this.capability.metadata) {
      this.capability.metadata = {};
    }
    this.capability.metadata.model = name;
    return this;
  }

  setManufacturer(manufacturer: string): this {
    if (!this.capability.metadata) {
      this.capability.metadata = {};
    }
    this.capability.metadata.manufacturer = manufacturer;
    return this;
  }

  setFirmwareVersion(version: string): this {
    if (!this.capability.metadata) {
      this.capability.metadata = {};
    }
    this.capability.metadata.revision = version;
    return this;
  }

  setHardwareVersion(version: string): this {
    // 在metadata中存储硬件版本信息
    if (!this.capability.metadata) {
      this.capability.metadata = {};
    }
    if (!this.capability.metadata.certifications) {
      this.capability.metadata.certifications = [];
    }
    this.capability.metadata.certifications.push(`HW_VER:${version}`);
    return this;
  }

  // 便捷的通道配置方法
  setChannelCount(count: number): this {
    if (!this.capability.channels) {
      this.capability.channels = {} as ChannelCapability;
    }
    this.capability.channels.digital = count;
    return this;
  }

  setMaxVoltage(voltage: number): this {
    if (!this.capability.channels) {
      this.capability.channels = {} as ChannelCapability;
    }
    this.capability.channels.maxVoltage = voltage;
    return this;
  }

  setMinVoltage(voltage: number): this {
    if (!this.capability.channels) {
      this.capability.channels = {} as ChannelCapability;
    }
    this.capability.channels.minVoltage = voltage;
    return this;
  }

  setInputImpedance(impedance: number): this {
    if (!this.capability.channels) {
      this.capability.channels = {} as ChannelCapability;
    }
    this.capability.channels.inputImpedance = impedance;
    return this;
  }

  // 便捷的采样配置方法
  setMaxSampleRate(rate: number): this {
    if (!this.capability.sampling) {
      this.capability.sampling = {} as SamplingCapability;
    }
    this.capability.sampling.maxRate = rate;
    return this;
  }

  setMinSampleRate(rate: number): this {
    if (!this.capability.sampling) {
      this.capability.sampling = {} as SamplingCapability;
    }
    this.capability.sampling.minRate = rate;
    return this;
  }

  setSupportedSampleRates(rates: number[]): this {
    if (!this.capability.sampling) {
      this.capability.sampling = {} as SamplingCapability;
    }
    this.capability.sampling.supportedRates = rates;
    return this;
  }

  setMaxBufferSize(size: number): this {
    if (!this.capability.sampling) {
      this.capability.sampling = {} as SamplingCapability;
    }
    this.capability.sampling.bufferSize = size;
    return this;
  }

  // 便捷的触发配置方法
  addTriggerType(type: string, options: any): this {
    if (!this.capability.triggers) {
      this.capability.triggers = {} as TriggerCapability;
    }
    if (!this.capability.triggers.types) {
      this.capability.triggers.types = [];
    }
    if (!this.capability.triggers.conditions) {
      this.capability.triggers.conditions = [];
    }

    // 根据类型添加相应的触发能力
    switch (type) {
      case 'edge':
        if (!this.capability.triggers.types.includes(0)) {
          this.capability.triggers.types.push(0);
        }
        if (options.supportedEdges) {
          this.capability.triggers.conditions = [
            ...this.capability.triggers.conditions,
            ...options.supportedEdges
          ];
        }
        break;
      case 'level':
        if (!this.capability.triggers.types.includes(1)) {
          this.capability.triggers.types.push(1);
        }
        if (options.supportedLevels) {
          this.capability.triggers.conditions = [
            ...this.capability.triggers.conditions,
            ...options.supportedLevels
          ];
        }
        break;
      case 'pulse':
        if (!this.capability.triggers.types.includes(2)) {
          this.capability.triggers.types.push(2);
        }
        if (!this.capability.triggers.advancedTriggers) {
          this.capability.triggers.advancedTriggers = {};
        }
        this.capability.triggers.advancedTriggers.pulseWidth = true;
        break;
    }
    return this;
  }

  setMaxTriggerChannels(count: number): this {
    if (!this.capability.triggers) {
      this.capability.triggers = {} as TriggerCapability;
    }
    this.capability.triggers.maxChannels = count;
    return this;
  }

  // 便捷的连接配置方法
  addConnectionType(type: string, options: any): this {
    if (!this.capability.connectivity) {
      this.capability.connectivity = {} as ConnectivityCapability;
    }
    if (!this.capability.connectivity.interfaces) {
      this.capability.connectivity.interfaces = [];
    }
    if (!this.capability.connectivity.protocols) {
      this.capability.connectivity.protocols = [];
    }

    // 添加连接类型
    if (!this.capability.connectivity.interfaces.includes(type)) {
      this.capability.connectivity.interfaces.push(type);
    }

    // 根据类型配置特定选项
    switch (type) {
      case 'serial':
        if (!this.capability.connectivity.protocols.includes('custom')) {
          this.capability.connectivity.protocols.push('custom');
        }
        break;
      case 'usb':
        if (!this.capability.connectivity.protocols.includes('custom')) {
          this.capability.connectivity.protocols.push('custom');
        }
        break;
      case 'ethernet':
        if (options.supportedProtocols) {
          this.capability.connectivity.protocols = [
            ...this.capability.connectivity.protocols,
            ...options.supportedProtocols
          ];
        }
        if (!this.capability.connectivity.networkConfig) {
          this.capability.connectivity.networkConfig = {};
        }
        this.capability.connectivity.networkConfig.staticIP = true;
        this.capability.connectivity.networkConfig.dhcp = true;
        break;
    }

    return this;
  }

  /**
   * 验证能力配置的完整性
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查必需字段
    if (!this.capability.channels) {
      errors.push('缺少通道配置');
    } else {
      if (!this.capability.channels.digital || this.capability.channels.digital <= 0) {
        errors.push('数字通道数必须大于0');
      }
      if (!this.capability.channels.maxVoltage) {
        errors.push('缺少最大输入电压');
      }
      if (!this.capability.channels.inputImpedance) {
        errors.push('缺少输入阻抗');
      }
    }

    if (!this.capability.sampling) {
      errors.push('缺少采样配置');
    } else {
      if (!this.capability.sampling.maxRate || this.capability.sampling.maxRate <= 0) {
        errors.push('最大采样率必须大于0');
      }
      if (!this.capability.sampling.minRate || this.capability.sampling.minRate <= 0) {
        errors.push('最小采样率必须大于0');
      }
      if (this.capability.sampling.maxRate <= this.capability.sampling.minRate) {
        errors.push('最大采样率必须大于最小采样率');
      }
      if (!this.capability.sampling.bufferSize || this.capability.sampling.bufferSize <= 0) {
        errors.push('缓冲区大小必须大于0');
      }
    }

    if (!this.capability.triggers) {
      errors.push('缺少触发配置');
    } else {
      if (!this.capability.triggers.types || this.capability.triggers.types.length === 0) {
        errors.push('必须支持至少一种触发类型');
      }
      if (!this.capability.triggers.maxChannels || this.capability.triggers.maxChannels <= 0) {
        errors.push('最大触发通道数必须大于0');
      }
    }

    if (!this.capability.connectivity) {
      errors.push('缺少连接配置');
    } else {
      if (!this.capability.connectivity.interfaces || this.capability.connectivity.interfaces.length === 0) {
        errors.push('必须支持至少一种连接接口');
      }
      if (!this.capability.connectivity.protocols || this.capability.connectivity.protocols.length === 0) {
        errors.push('必须支持至少一种通信协议');
      }
    }

    if (!this.capability.features) {
      errors.push('缺少特性配置');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 构建最终的硬件能力描述
   */
  build(): HardwareCapabilities {
    // 转换为测试兼容的格式
    const result: HardwareCapabilities = {
      deviceName: this.capability.metadata?.model,
      manufacturer: this.capability.metadata?.manufacturer,
      firmwareVersion: this.capability.metadata?.revision,
      hardwareVersion: this.extractHardwareVersion(),
      channels: {
        digitalChannels: this.capability.channels?.digital || 0,
        analogChannels: this.capability.channels?.analog,
        maxVoltage: this.capability.channels?.maxVoltage || 0,
        minVoltage: this.capability.channels?.minVoltage,
        inputImpedance: this.capability.channels?.inputImpedance || 0,
        thresholdVoltage: this.capability.channels?.thresholdVoltage,
        differentialInputs: this.capability.channels?.differentialInputs
      },
      sampling: {
        maxSampleRate: this.capability.sampling?.maxRate || 0,
        minSampleRate: this.capability.sampling?.minRate || 0,
        supportedRates: this.capability.sampling?.supportedRates,
        maxBufferSize: this.capability.sampling?.bufferSize || 0,
        streamingSupport: this.capability.sampling?.streamingSupport,
        compressionSupport: this.capability.sampling?.compressionSupport,
        realTimePreview: this.capability.sampling?.realTimePreview
      },
      triggers: {
        supportedTypes: this.convertTriggerTypes(),
        maxChannels: this.capability.triggers?.maxChannels || 0,
        patternWidth: this.capability.triggers?.patternWidth,
        sequentialSupport: this.capability.triggers?.sequentialSupport,
        conditions: this.capability.triggers?.conditions,
        advancedTriggers: this.capability.triggers?.advancedTriggers
      },
      connection: {
        supportedTypes: this.capability.connectivity?.interfaces || [],
        protocols: this.capability.connectivity?.protocols,
        networkConfig: this.capability.connectivity?.networkConfig
      },
      features: {
        signalGeneration: this.capability.features?.signalGeneration,
        powerSupply: this.capability.features?.powerSupply,
        voltageMonitoring: this.capability.features?.voltageMonitoring,
        protocolDecoding: this.capability.features?.protocolDecoding,
        mathFunctions: this.capability.features?.mathFunctions,
        measurements: this.capability.features?.measurements,
        export: this.capability.features?.export
      },
      clock: this.extractClockConfig(),
      synchronization: this.extractSyncConfig()
    };

    return result;
  }

  private extractHardwareVersion(): string | undefined {
    const certifications = this.capability.metadata?.certifications;
    if (!certifications) return undefined;

    const hwVerEntry = certifications.find(cert => cert.startsWith('HW_VER:'));
    return hwVerEntry ? hwVerEntry.replace('HW_VER:', '') : undefined;
  }

  private convertTriggerTypes(): string[] {
    const types = this.capability.triggers?.types || [];
    const typeNames: string[] = [];

    // 将数字类型转换为字符串类型
    if (types.includes(0)) typeNames.push('edge');
    if (types.includes(1)) typeNames.push('level');
    if (types.includes(2)) typeNames.push('pulse');
    if (types.includes(3)) typeNames.push('blast');

    return typeNames;
  }

  private clockConfig: any = {};
  private syncConfig: any = {};

  private extractClockConfig(): any {
    return Object.keys(this.clockConfig).length > 0 ? this.clockConfig : undefined;
  }

  private extractSyncConfig(): any {
    return Object.keys(this.syncConfig).length > 0 ? this.syncConfig : undefined;
  }

  // 时钟配置方法
  setInternalClock(supported: boolean): this {
    this.clockConfig.internalClock = supported;
    return this;
  }

  setExternalClockSupport(supported: boolean): this {
    this.clockConfig.externalClockSupport = supported;
    return this;
  }

  setClockFrequencies(frequencies: number[]): this {
    this.clockConfig.supportedFrequencies = frequencies;
    return this;
  }

  // 同步配置方法
  setSynchronizationSupport(supported: boolean): this {
    this.syncConfig.supported = supported;
    return this;
  }

  setMultiDeviceSupport(maxDevices: number): this {
    this.syncConfig.maxDevices = maxDevices;
    return this;
  }

  // JSON导入导出方法
  exportAsJSON(capabilities: HardwareCapabilities): string {
    return JSON.stringify(capabilities, null, 2);
  }

  importFromJSON(json: string): HardwareCapabilities {
    return JSON.parse(json) as HardwareCapabilities;
  }

  /**
   * 导出为JSON格式
   */
  toJSON(): string {
    return JSON.stringify(this.build(), null, 2);
  }

  /**
   * 从JSON导入配置
   */
  static fromJSON(json: string): HardwareCapabilityBuilder {
    const capability = JSON.parse(json) as HardwareCapability;
    const builder = new HardwareCapabilityBuilder();
    builder.capability = capability;
    return builder;
  }

  /**
   * 比较两个硬件能力配置
   */
  static compare(
    capability1: HardwareCapability,
    capability2: HardwareCapability
  ): {
    compatible: boolean;
    differences: string[];
    score: number; // 兼容性评分 0-100
  } {
    const differences: string[] = [];
    let score = 100;

    // 比较通道数
    if (capability1.channels.digital !== capability2.channels.digital) {
      differences.push(`数字通道数不同: ${capability1.channels.digital} vs ${capability2.channels.digital}`);
      score -= 10;
    }

    // 比较采样率
    if (capability1.sampling.maxRate !== capability2.sampling.maxRate) {
      differences.push(`最大采样率不同: ${capability1.sampling.maxRate} vs ${capability2.sampling.maxRate}`);
      score -= 15;
    }

    // 比较触发类型
    const trigger1Types = new Set(capability1.triggers.types);
    const trigger2Types = new Set(capability2.triggers.types);
    const commonTriggers = [...trigger1Types].filter(t => trigger2Types.has(t));

    if (commonTriggers.length === 0) {
      differences.push('没有共同的触发类型');
      score -= 20;
    } else if (commonTriggers.length < Math.max(trigger1Types.size, trigger2Types.size)) {
      differences.push('触发类型部分兼容');
      score -= 5;
    }

    // 比较连接接口
    const interface1 = new Set(capability1.connectivity.interfaces);
    const interface2 = new Set(capability2.connectivity.interfaces);
    const commonInterfaces = [...interface1].filter(i => interface2.has(i));

    if (commonInterfaces.length === 0) {
      differences.push('没有共同的连接接口');
      score -= 25;
    }

    return {
      compatible: differences.length === 0,
      differences,
      score: Math.max(0, score)
    };
  }
}
