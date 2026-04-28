/**
 * sigrok 对齐契约
 * 用于集中描述 golden fixture 格式和后续协议扩展策略。
 */

export type DecoderGoldenProtocol = 'i2c' | 'spi' | 'uart' | 'can' | 'lin' | 'i2s';

export type DecoderGoldenCategory = 'normal' | 'error' | 'boundary';

export type DecoderGoldenInputKind =
  | 'logic-channels'
  | 'i2c-operations'
  | 'spi-transfer'
  | 'can-frame'
  | 'lin-frame'
  | 'i2s-words';

export interface DecoderGoldenExpectedSegment {
  annotationType: number;
  values: string[];
  rawData?: number;
}

export interface DecoderGoldenCase {
  id: string;
  protocol: DecoderGoldenProtocol;
  category: DecoderGoldenCategory;
  sampleRate: number;
  input: {
    kind: DecoderGoldenInputKind;
    [key: string]: unknown;
  };
  options: Array<{ optionIndex: number; value: unknown }>;
  expected: DecoderGoldenExpectedSegment[];
}

export type DecoderImplementationStrategy = 'typescript' | 'external-sigrok';

export interface DecoderExtensionPlan {
  id: string;
  title: string;
  priority: number;
  implementation: DecoderImplementationStrategy;
  minimumInterfaces: string[];
  fixtureScope: string[];
  rationale: string;
}

const DECODER_EXTENSION_ROADMAP: DecoderExtensionPlan[] = [
  {
    id: 'can',
    title: 'CAN 2.0A/2.0B',
    priority: 1,
    implementation: 'typescript',
    minimumInterfaces: [
      'dominant/recessive 位流输入',
      '标准与扩展 ID 注释',
      'RTR/IDE/DLC/data/CRC/ACK 字段输出',
      'stuff bit 与 CRC 错误注释'
    ],
    fixtureScope: ['标准数据帧', '扩展 ID 帧', 'CRC/stuff 错误帧'],
    rationale: '汽车和工业调试需求最高，状态机边界清晰，适合先做本地 TypeScript 实现。'
  },
  {
    id: 'lin',
    title: 'LIN',
    priority: 2,
    implementation: 'typescript',
    minimumInterfaces: [
      'break/sync/PID 检测',
      'classic/enhanced checksum 选项',
      '受保护 ID 与校验错误输出',
      '与 UART 字节流级联输入契约'
    ],
    fixtureScope: ['主机头', '从机响应', 'checksum 错误'],
    rationale: '可复用 UART 字节层输出，是验证级联解码能力的低成本下一步。'
  },
  {
    id: 'i2s',
    title: 'I2S',
    priority: 3,
    implementation: 'typescript',
    minimumInterfaces: [
      'SCK/WS/SD 通道映射',
      '左右声道样本输出',
      'word length 与 justification 选项',
      'MSB/LSB 边界样本对齐'
    ],
    fixtureScope: ['16-bit stereo', '24-bit stereo', 'word-select 边界错位'],
    rationale: '与 SPI 类同步采样模型接近，可扩展音频调试场景。'
  },
  {
    id: 'usb',
    title: 'USB low/full speed',
    priority: 4,
    implementation: 'external-sigrok',
    minimumInterfaces: [
      'D+/D- 差分输入映射',
      'packet/token/data/handshake 输出模型',
      '外部 sigrok JSON 注释归一化',
      '本地 TS packet 类型稳定后再替换核心层'
    ],
    fixtureScope: ['reset/idle', 'token+data+ack', 'bit-stuff 错误'],
    rationale: 'USB 物理层、NRZI、bit stuffing 和协议栈复杂度高，先桥接外部 sigrok 降低 parity 风险。'
  },
  {
    id: 'jtag-swd',
    title: 'JTAG/SWD',
    priority: 5,
    implementation: 'external-sigrok',
    minimumInterfaces: [
      'TCK/TMS/TDI/TDO 或 SWCLK/SWDIO 映射',
      'TAP 状态与 IR/DR 注释',
      'ACK/turnaround/parity 错误输出',
      '后续本地 TS 状态机切换点'
    ],
    fixtureScope: ['JTAG IDCODE', 'SWD read/write', 'turnaround/parity 错误'],
    rationale: '调试总线价值高但状态空间大，先保留外部 sigrok 对照源。'
  }
];

export function getDecoderExtensionRoadmap(): DecoderExtensionPlan[] {
  return DECODER_EXTENSION_ROADMAP.map(item => ({
    ...item,
    minimumInterfaces: [...item.minimumInterfaces],
    fixtureScope: [...item.fixtureScope]
  }));
}

export function getDecoderExtensionPlan(id: string): DecoderExtensionPlan | undefined {
  return getDecoderExtensionRoadmap().find(item => item.id === id);
}

export function getExternalSigrokProtocolIds(): string[] {
  return DECODER_EXTENSION_ROADMAP
    .filter(item => item.implementation === 'external-sigrok')
    .map(item => item.id);
}
