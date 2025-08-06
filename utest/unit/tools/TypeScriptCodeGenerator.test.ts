/**
 * TypeScriptCodeGenerator 模块测试
 * 测试 Python 到 TypeScript 代码生成器的全部功能
 * 目标：从 0% 覆盖率提升到 95%+ 覆盖率
 */

import { 
  TypeScriptCodeGenerator, 
  CodeGenerationOptions, 
  GeneratedCode 
} from '../../../src/tools/TypeScriptCodeGenerator';
import { 
  ConversionPlan, 
  DecoderMetadata, 
  PythonClassInfo, 
  PythonMethodInfo 
} from '../../../src/tools/PythonDecoderAnalyzer';

describe('TypeScriptCodeGenerator', () => {
  let generator: TypeScriptCodeGenerator;
  let mockPlan: ConversionPlan;
  let mockMetadata: DecoderMetadata;
  let mockClassInfo: PythonClassInfo;

  beforeEach(() => {
    // 创建标准测试数据
    mockMetadata = {
      id: 'i2c',
      name: 'I2C协议解码器',
      description: '用于解码I2C总线数据的协议分析器',
      channels: [
        {
          name: 'SDA',
          required: true,
          description: '数据线'
        },
        {
          name: 'SCL',
          required: true,
          description: '时钟线'
        },
        {
          name: 'CS',
          required: false,
          description: '片选信号'
        }
      ],
      options: [
        {
          id: 'baudrate',
          name: '波特率',
          type: 'int',
          default: 100000,
          description: 'I2C总线速度'
        },
        {
          id: 'address_format',
          name: '地址格式',
          type: 'list',
          default: '7-bit',
          description: '地址位数格式',
          values: ['7-bit', '10-bit']
        },
        {
          id: 'show_ack',
          name: '显示ACK',
          type: 'bool',
          default: true,
          description: '是否显示应答信号'
        },
        {
          id: 'device_name',
          name: '设备名称',
          type: 'str',
          default: 'Unknown',
          description: '设备识别名称'
        }
      ],
      annotations: ['start', 'stop', 'address', 'data', 'ack', 'nack']
    };

    mockClassInfo = {
      className: 'I2CDecoder',
      baseClass: 'Decoder',
      docstring: 'I2C protocol decoder implementation',
      attributes: ['last_sda', 'last_scl', 'state', 'current_byte', 'bit_count'],
      methods: [
        {
          name: '__init__',
          parameters: ['self'],
          body: 'self.state = "IDLE"\nself.bit_count = 0',
          isCoreAPI: true,
          apiCalls: { wait: 0, put: 0, other: [] }
        },
        {
          name: 'decode',
          parameters: ['self', 'ss', 'es', 'data'],
          returnType: 'list',
          body: 'results = []\nreturn results',
          isCoreAPI: true,
          apiCalls: { wait: 5, put: 3, other: ['get_channel'] }
        },
        {
          name: 'wait_for_edge',
          parameters: ['self', 'pin', 'edge_type="rising"'],
          body: 'return self.wait({pin: edge_type})',
          isCoreAPI: false,
          apiCalls: { wait: 1, put: 0, other: [] }
        },
        {
          name: 'parse_address',
          parameters: ['self', 'data', 'format="7-bit"'],
          returnType: 'int',
          body: 'if format == "7-bit":\n    return data >> 1\nelse:\n    return data',
          isCoreAPI: false,
          apiCalls: { wait: 0, put: 1, other: [] }
        }
      ],
      imports: ['from decoder import Decoder', 'import struct']
    };

    mockPlan = {
      sourcePath: '/path/to/i2c_decoder.py',
      targetPath: '/path/to/I2CDecoder.ts',
      metadata: mockMetadata,
      classInfo: mockClassInfo,
      complexity: {
        level: 'medium',
        score: 6.5,
        factors: ['api_calls', 'state_machine', 'multiple_channels']
      },
      steps: [
        {
          order: 1,
          description: '生成类结构',
          type: 'structure',
          automated: true
        },
        {
          order: 2,
          description: '转换API调用',
          type: 'api',
          automated: true
        },
        {
          order: 3,
          description: '实现业务逻辑',
          type: 'logic',
          automated: false
        }
      ]
    };
  });

  describe('构造函数和配置', () => {
    it('应该使用默认配置创建实例', () => {
      generator = new TypeScriptCodeGenerator();
      
      // 通过生成代码验证默认配置
      const result = generator.generateFromPlan(mockPlan);
      
      expect(result.decoderCode).toContain('/**');  // includeComments: true
      expect(result.typesCode).toBeDefined();       // generateTypes: true
      expect(result.testCode).toBeUndefined();      // includeTests: false
    });

    it('应该使用自定义配置创建实例', () => {
      const customOptions: CodeGenerationOptions = {
        includeComments: false,
        generateTypes: false,
        includeTests: true,
        targetES: 'ES2022',
        codeStyle: 'standard'
      };
      
      generator = new TypeScriptCodeGenerator(customOptions);
      const result = generator.generateFromPlan(mockPlan);
      
      expect(result.decoderCode).not.toContain('/**'); // 无注释
      expect(result.typesCode).toBeUndefined();        // 无类型文件
      expect(result.testCode).toBeDefined();           // 有测试文件
    });

    it('应该支持部分配置覆盖', () => {
      const partialOptions = {
        includeTests: true,
        targetES: 'ES2021' as const
      };
      
      generator = new TypeScriptCodeGenerator(partialOptions);
      const result = generator.generateFromPlan(mockPlan);
      
      expect(result.testCode).toBeDefined();           // 覆盖的配置生效
      expect(result.typesCode).toBeDefined();          // 默认配置保持
    });
  });

  describe('generateFromPlan 主要功能', () => {
    beforeEach(() => {
      generator = new TypeScriptCodeGenerator();
    });

    it('应该生成完整的 TypeScript 代码', () => {
      const result = generator.generateFromPlan(mockPlan);
      
      expect(result).toMatchObject({
        decoderCode: expect.any(String),
        typesCode: expect.any(String),
        testCode: undefined,
        stats: {
          linesGenerated: expect.any(Number),
          methodsConverted: mockClassInfo.methods.length,
          typesGenerated: expect.any(Number),
          complexityHandled: 'medium'
        }
      });
      
      expect(result.decoderCode.length).toBeGreaterThan(100);
      expect(result.stats.linesGenerated).toBeGreaterThan(10);
    });

    it('应该正确处理复杂度统计', () => {
      // 测试简单复杂度
      const simplePlan = { ...mockPlan };
      simplePlan.complexity = { level: 'simple', score: 2.0, factors: ['basic_structure'] };
      
      const result = generator.generateFromPlan(simplePlan);
      expect(result.stats.complexityHandled).toBe('simple');
      
      // 测试复杂复杂度
      const complexPlan = { ...mockPlan };
      complexPlan.complexity = { level: 'complex', score: 9.5, factors: ['nested_state', 'multiple_protocols'] };
      
      const result2 = generator.generateFromPlan(complexPlan);
      expect(result2.stats.complexityHandled).toBe('complex');
    });

    it('应该生成正确的统计信息', () => {
      const result = generator.generateFromPlan(mockPlan);
      
      expect(result.stats.methodsConverted).toBe(4); // __init__, decode, wait_for_edge, parse_address
      expect(result.stats.typesGenerated).toBe(2);   // Options interface + Channel config interface
      expect(result.stats.linesGenerated).toBeGreaterThan(30);
    });
  });

  describe('文件头注释生成', () => {
    beforeEach(() => {
      generator = new TypeScriptCodeGenerator({ includeComments: true });
    });

    it('应该生成包含元数据的文件头', () => {
      const result = generator.generateFromPlan(mockPlan);
      
      expect(result.decoderCode).toContain('/**');
      expect(result.decoderCode).toContain('I2C协议解码器');
      expect(result.decoderCode).toContain('用于解码I2C总线数据的协议分析器');
      expect(result.decoderCode).toContain('自动从Python解码器转换生成');
      expect(result.decoderCode).toContain('支持通道: SDA, SCL, CS');
      expect(result.decoderCode).toContain('配置选项: 4个');
    });

    it('应该处理没有通道的情况', () => {
      const planWithoutChannels = { ...mockPlan };
      planWithoutChannels.metadata = { ...mockMetadata };
      planWithoutChannels.metadata.channels = [];
      
      const result = generator.generateFromPlan(planWithoutChannels);
      expect(result.decoderCode).toContain('支持通道: ');
      expect(result.decoderCode).toContain('配置选项: 4个');
    });

    it('应该处理没有配置选项的情况', () => {
      const planWithoutOptions = { ...mockPlan };
      planWithoutOptions.metadata = { ...mockMetadata };
      planWithoutOptions.metadata.options = [];
      
      const result = generator.generateFromPlan(planWithoutOptions);
      expect(result.decoderCode).toContain('配置选项: 0个');
    });
  });

  describe('导入语句生成', () => {
    it('应该生成基础导入语句', () => {
      generator = new TypeScriptCodeGenerator({ generateTypes: false });
      const result = generator.generateFromPlan(mockPlan);
      
      expect(result.decoderCode).toContain("import { DecoderBase, DecoderResult, WaitCondition, WaitResult } from '../base/DecoderBase';");
      expect(result.decoderCode).toContain("import { AnalyzerChannel } from '../../models/CaptureModels';");
      expect(result.decoderCode).toContain("import { DecoderOptionValue } from '../DecoderManager';");
    });

    it('应该在生成类型文件时添加类型导入', () => {
      generator = new TypeScriptCodeGenerator({ generateTypes: true });
      const result = generator.generateFromPlan(mockPlan);
      
      expect(result.decoderCode).toContain("import { I2CDecoderOptions } from './types/i2cTypes';");
    });
  });

  describe('类型定义生成', () => {
    beforeEach(() => {
      generator = new TypeScriptCodeGenerator();
    });

    it('应该生成独立的类型定义文件', () => {
      const result = generator.generateFromPlan(mockPlan);
      
      expect(result.typesCode).toBeDefined();
      expect(result.typesCode).toContain('I2C协议解码器 类型定义');
      expect(result.typesCode).toContain('自动生成，请勿手动修改');
      expect(result.typesCode).toContain('export interface I2CDecoderOptions');
      expect(result.typesCode).toContain('export interface I2CChannelConfig');
    });

    it('应该正确映射配置选项类型', () => {
      const result = generator.generateFromPlan(mockPlan);
      
      expect(result.typesCode).toContain('baudrate: number;');          // int -> number
      expect(result.typesCode).toContain('show_ack: boolean;');         // bool -> boolean
      expect(result.typesCode).toContain('device_name: string;');       // str -> string
      expect(result.typesCode).toContain("address_format: ('7-bit' | '10-bit')[];"); // list with values
    });

    it('应该生成通道配置接口', () => {
      const result = generator.generateFromPlan(mockPlan);
      
      expect(result.typesCode).toContain('sda: number;');   // required channel
      expect(result.typesCode).toContain('scl: number;');   // required channel
      expect(result.typesCode).toContain('cs?: number;');   // optional channel
      expect(result.typesCode).toContain('/** 数据线 */');
      expect(result.typesCode).toContain('/** 时钟线 */');
      expect(result.typesCode).toContain('/** 片选信号 */');
    });

    it('应该处理没有配置选项的情况', () => {
      const planWithoutOptions = { ...mockPlan };
      planWithoutOptions.metadata = { ...mockMetadata };
      planWithoutOptions.metadata.options = [];
      
      const result = generator.generateFromPlan(planWithoutOptions);
      
      expect(result.typesCode).not.toContain('I2CDecoderOptions');
      expect(result.typesCode).toContain('I2CChannelConfig'); // 通道配置仍然存在
    });
  });

  describe('内联类型生成', () => {
    beforeEach(() => {
      generator = new TypeScriptCodeGenerator({ generateTypes: false });
    });

    it('应该在主文件中生成内联类型', () => {
      const result = generator.generateFromPlan(mockPlan);
      
      expect(result.typesCode).toBeUndefined();
      expect(result.decoderCode).toContain('export interface I2CDecoderOptions');
      expect(result.decoderCode).toContain('baudrate: number;');
      expect(result.decoderCode).toContain('show_ack: boolean;');
    });

    it('应该处理没有配置选项时不生成内联类型', () => {
      const planWithoutOptions = { ...mockPlan };
      planWithoutOptions.metadata = { ...mockMetadata };
      planWithoutOptions.metadata.options = [];
      
      const result = generator.generateFromPlan(planWithoutOptions);
      
      expect(result.decoderCode).not.toContain('export interface I2CDecoderOptions');
    });
  });

  describe('类定义生成', () => {
    beforeEach(() => {
      generator = new TypeScriptCodeGenerator();
    });

    it('应该生成正确的类头部', () => {
      const result = generator.generateFromPlan(mockPlan);
      
      expect(result.decoderCode).toContain('/**');
      expect(result.decoderCode).toContain('I2C协议解码器解码器');
      expect(result.decoderCode).toContain('基于原Python I2CDecoder类实现');
      expect(result.decoderCode).toContain('export class I2cDecoder extends DecoderBase');
    });

    it('应该生成基础属性', () => {
      const result = generator.generateFromPlan(mockPlan);
      
      expect(result.decoderCode).toContain("public readonly id = 'i2c';");
      expect(result.decoderCode).toContain("public readonly name = 'I2C协议解码器';");
      expect(result.decoderCode).toContain('public readonly channels =');
      expect(result.decoderCode).toContain('public readonly annotations =');
    });

    it('应该生成私有属性', () => {
      const result = generator.generateFromPlan(mockPlan);
      
      expect(result.decoderCode).toContain('private last_sda: any;');
      expect(result.decoderCode).toContain('private last_scl: any;');
      expect(result.decoderCode).toContain('private state: any;');
      expect(result.decoderCode).toContain('private current_byte: any;');
      expect(result.decoderCode).toContain('private bit_count: any;');
    });
  });

  describe('构造函数生成', () => {
    beforeEach(() => {
      generator = new TypeScriptCodeGenerator();
    });

    it('应该生成带注释的构造函数', () => {
      const result = generator.generateFromPlan(mockPlan);
      
      expect(result.decoderCode).toContain('/**');
      expect(result.decoderCode).toContain('构造I2C协议解码器解码器');
      expect(result.decoderCode).toContain('constructor() {');
      expect(result.decoderCode).toContain('super();');
    });

    it('应该初始化所有属性', () => {
      const result = generator.generateFromPlan(mockPlan);
      
      expect(result.decoderCode).toContain('this.last_sda = null;');
      expect(result.decoderCode).toContain('this.last_scl = null;');
      expect(result.decoderCode).toContain('this.state = null;');
      expect(result.decoderCode).toContain('this.current_byte = null;');
      expect(result.decoderCode).toContain('this.bit_count = null;');
    });

    it('应该处理没有属性的情况', () => {
      const planWithoutAttrs = { ...mockPlan };
      planWithoutAttrs.classInfo = { ...mockClassInfo };
      planWithoutAttrs.classInfo.attributes = [];
      
      const result = generator.generateFromPlan(planWithoutAttrs);
      
      expect(result.decoderCode).toContain('constructor() {');
      expect(result.decoderCode).toContain('super();');
      expect(result.decoderCode).not.toContain('this. = null;');
    });
  });

  describe('方法生成', () => {
    beforeEach(() => {
      generator = new TypeScriptCodeGenerator();
    });

    it('应该跳过 __init__ 方法', () => {
      const result = generator.generateFromPlan(mockPlan);
      
      // 不应该有 __init__ 方法，只有 constructor
      expect(result.decoderCode).not.toContain('__init__(');
      expect(result.decoderCode).toContain('constructor()');
    });

    it('应该生成 decode 方法', () => {
      const result = generator.generateFromPlan(mockPlan);
      
      expect(result.decoderCode).toContain('public async decode(');
      expect(result.decoderCode).toContain('sampleRate: number');
      expect(result.decoderCode).toContain('channels: AnalyzerChannel[]');
      expect(result.decoderCode).toContain('options: DecoderOptionValue[]');
      expect(result.decoderCode).toContain(': Promise<DecoderResult[]>');
    });

    it('应该生成私有方法', () => {
      const result = generator.generateFromPlan(mockPlan);
      
      expect(result.decoderCode).toContain('private async wait_for_edge(');
      expect(result.decoderCode).toContain('private parse_address(');
    });

    it('应该处理异步方法', () => {
      const result = generator.generateFromPlan(mockPlan);
      
      // wait_for_edge 有 wait 调用，应该是异步的
      expect(result.decoderCode).toContain('private async wait_for_edge(');
      expect(result.decoderCode).toContain(': Promise<void>');
      
      // parse_address 没有 wait 调用，应该是同步的
      expect(result.decoderCode).toContain('private parse_address(');
      expect(result.decoderCode).not.toContain('async parse_address(');
    });

    it('应该处理方法参数', () => {
      const result = generator.generateFromPlan(mockPlan);
      
      expect(result.decoderCode).toContain('wait_for_edge(pin: any, edge_type?: string)');
      expect(result.decoderCode).toContain('parse_address(data: any, format?: string)');
    });
  });

  describe('方法体转换', () => {
    beforeEach(() => {
      generator = new TypeScriptCodeGenerator();
    });

    it('应该生成标准的 decode 方法体', () => {
      const result = generator.generateFromPlan(mockPlan);
      
      expect(result.decoderCode).toContain('const results: DecoderResult[] = [];');
      expect(result.decoderCode).toContain('const config = this.parseOptions(options);');
      expect(result.decoderCode).toContain('// TODO: 根据原Python代码实现具体的解码逻辑');
      expect(result.decoderCode).toContain('return results;');
    });

    it('应该转换 Python 到 TypeScript 语法', () => {
      // 创建包含更多Python语法的方法
      const pythonMethod: PythonMethodInfo = {
        name: 'complex_method',
        parameters: ['self', 'value'],
        body: `if value is True and self.state == "ACTIVE":
    self.wait({0: 'r'})
    self.put(start, end, ['data', value])
elif value is False or self.state != "IDLE":
    return None
else:
    return not self.enabled and (value > 0)`,
        isCoreAPI: false,
        apiCalls: { wait: 1, put: 1, other: [] }
      };

      const complexPlan = { ...mockPlan };
      complexPlan.classInfo = { ...mockClassInfo };
      complexPlan.classInfo.methods = [pythonMethod];

      const result = generator.generateFromPlan(complexPlan);

      expect(result.decoderCode).toContain('if (value === true && this.state === "ACTIVE") {');
      expect(result.decoderCode).toContain('await this.wait(');
      expect(result.decoderCode).toContain('this.put(');
      expect(result.decoderCode).toContain('} else if (value === false || this.state !== "IDLE") {');
      expect(result.decoderCode).toContain('return null;');
      expect(result.decoderCode).toContain('} else {');
      expect(result.decoderCode).toContain('return !this.enabled && (value > 0)');
    });

    it('应该处理空方法体', () => {
      const emptyMethod: PythonMethodInfo = {
        name: 'empty_method',
        parameters: ['self'],
        body: '',
        isCoreAPI: false,
        apiCalls: { wait: 0, put: 0, other: [] }
      };

      const emptyPlan = { ...mockPlan };
      emptyPlan.classInfo = { ...mockClassInfo };
      emptyPlan.classInfo.methods = [emptyMethod];

      const result = generator.generateFromPlan(emptyPlan);

      expect(result.decoderCode).toContain('private empty_method(): void {');
      expect(result.decoderCode).toContain('// TODO: 实现方法逻辑');
    });
  });

  describe('类型推断和映射', () => {
    beforeEach(() => {
      generator = new TypeScriptCodeGenerator();
    });

    it('应该推断参数类型', () => {
      const methodWithTypes: PythonMethodInfo = {
        name: 'typed_method',
        parameters: ['self', 'count=10', 'enabled=True', 'name="default"', 'items=[]'],
        body: 'pass',
        isCoreAPI: false,
        apiCalls: { wait: 0, put: 0, other: [] }
      };

      const typedPlan = { ...mockPlan };
      typedPlan.classInfo = { ...mockClassInfo };
      typedPlan.classInfo.methods = [methodWithTypes];

      const result = generator.generateFromPlan(typedPlan);

      expect(result.decoderCode).toContain('typed_method(count?: number, enabled?: boolean, name?: string, items?: any[])');
    });

    it('应该映射 Python 类型到 TypeScript', () => {
      const result = generator.generateFromPlan(mockPlan);

      expect(result.typesCode).toContain('baudrate: number;');      // int -> number
      expect(result.typesCode).toContain('show_ack: boolean;');     // bool -> boolean  
      expect(result.typesCode).toContain('device_name: string;');   // str -> string
      expect(result.typesCode).toContain("address_format: ('7-bit' | '10-bit')[];"); // list with values
    });

    it('应该处理没有值的列表类型', () => {
      const listOption = {
        id: 'protocols',
        name: '协议列表',
        type: 'list' as const,
        default: [],
        description: '支持的协议'
      };

      const listPlan = { ...mockPlan };
      listPlan.metadata = { ...mockMetadata };
      listPlan.metadata.options.push(listOption);

      const result = generator.generateFromPlan(listPlan);

      expect(result.typesCode).toContain('protocols: any[];');
    });
  });

  describe('测试代码生成', () => {
    beforeEach(() => {
      generator = new TypeScriptCodeGenerator({ includeTests: true });
    });

    it('应该生成基础测试文件', () => {
      const result = generator.generateFromPlan(mockPlan);

      expect(result.testCode).toBeDefined();
      expect(result.testCode).toContain('I2C协议解码器 测试文件');
      expect(result.testCode).toContain('import { I2cDecoder } from \'../I2cDecoder\';');
      expect(result.testCode).toContain('import { generateTestChannelData }');
    });

    it('应该生成基础测试用例', () => {
      const result = generator.generateFromPlan(mockPlan);

      expect(result.testCode).toContain('describe(\'I2cDecoder\', () => {');
      expect(result.testCode).toContain('let decoder: I2cDecoder;');
      expect(result.testCode).toContain('decoder = new I2cDecoder();');
      expect(result.testCode).toContain('test(\'应该正确初始化\', () => {');
      expect(result.testCode).toContain('expect(decoder.id).toBe(\'i2c\');');
      expect(result.testCode).toContain('expect(decoder.name).toBe(\'I2C协议解码器\');');
    });

    it('应该生成解码测试用例', () => {
      const result = generator.generateFromPlan(mockPlan);

      expect(result.testCode).toContain('test(\'应该正确解码数据\', async () => {');
      expect(result.testCode).toContain('const testData = generateTestChannelData(1000, 3);'); // 3个通道
      expect(result.testCode).toContain('const results = await decoder.decode(1000000, testData, []);');
      expect(result.testCode).toContain('expect(Array.isArray(results)).toBe(true);');
    });
  });

  describe('代码格式化', () => {
    it('应该使用 prettier 风格格式化', () => {
      generator = new TypeScriptCodeGenerator({ codeStyle: 'prettier' });
      const result = generator.generateFromPlan(mockPlan);

      // 检查没有多余的空行和正确的缩进
      expect(result.decoderCode).not.toContain('\n\n\n');
      expect(result.decoderCode.endsWith('\n')).toBe(true);
      expect(result.decoderCode.trim().length).toBeGreaterThan(0);
    });

    it('应该支持 standard 风格', () => {
      generator = new TypeScriptCodeGenerator({ codeStyle: 'standard' });
      const result = generator.generateFromPlan(mockPlan);

      // standard 风格应该不做额外格式化
      expect(result.decoderCode).toBeDefined();
      expect(result.decoderCode.length).toBeGreaterThan(100);
    });
  });

  describe('批量生成功能', () => {
    beforeEach(() => {
      generator = new TypeScriptCodeGenerator();
    });

    it('应该成功批量生成多个解码器', async () => {
      const spiPlan: ConversionPlan = {
        ...mockPlan,
        metadata: {
          ...mockMetadata,
          id: 'spi',
          name: 'SPI协议解码器'
        }
      };

      const uartPlan: ConversionPlan = {
        ...mockPlan,
        metadata: {
          ...mockMetadata,
          id: 'uart',
          name: 'UART协议解码器'
        }
      };

      const plans = [mockPlan, spiPlan, uartPlan];
      const results = await generator.batchGenerate(plans);

      expect(results.size).toBe(3);
      expect(results.has('i2c')).toBe(true);
      expect(results.has('spi')).toBe(true);
      expect(results.has('uart')).toBe(true);

      const i2cResult = results.get('i2c')!;
      expect(i2cResult.decoderCode).toContain('I2cDecoder');
      expect(i2cResult.stats.methodsConverted).toBe(4);
    });

    it('应该处理批量生成中的错误', async () => {
      // 创建一个会导致错误的计划
      const errorPlan: ConversionPlan = {
        ...mockPlan,
        metadata: null as any // 故意设置为null导致错误
      };

      const plans = [mockPlan, errorPlan];
      
      // 模拟console.error以验证错误处理
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const results = await generator.batchGenerate(plans);

      expect(results.size).toBe(1); // 只有一个成功
      expect(results.has('i2c')).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ 生成代码失败'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('应该返回空结果当所有计划都失败时', async () => {
      const errorPlan1: ConversionPlan = {
        ...mockPlan,
        metadata: null as any
      };
      const errorPlan2: ConversionPlan = {
        ...mockPlan,
        classInfo: null as any
      };

      const plans = [errorPlan1, errorPlan2];
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const results = await generator.batchGenerate(plans);

      expect(results.size).toBe(0);
      expect(consoleSpy).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });
  });

  describe('边界条件和错误处理', () => {
    beforeEach(() => {
      generator = new TypeScriptCodeGenerator();
    });

    it('应该处理空的通道列表', () => {
      const emptyChannelsPlan = { ...mockPlan };
      emptyChannelsPlan.metadata = { ...mockMetadata };
      emptyChannelsPlan.metadata.channels = [];

      const result = generator.generateFromPlan(emptyChannelsPlan);

      expect(result.decoderCode).toContain('public readonly channels = [];');
      expect(result.typesCode).toContain('export interface I2CChannelConfig {');
      expect(result.typesCode).toContain('}'); // 空接口但格式正确
    });

    it('应该处理空的配置选项', () => {
      const emptyOptionsPlan = { ...mockPlan };
      emptyOptionsPlan.metadata = { ...mockMetadata };
      emptyOptionsPlan.metadata.options = [];

      const result = generator.generateFromPlan(emptyOptionsPlan);

      expect(result.typesCode).not.toContain('I2CDecoderOptions');
      expect(result.stats.typesGenerated).toBe(1); // 只有 ChannelConfig
    });

    it('应该处理空的方法列表', () => {
      const emptyMethodsPlan = { ...mockPlan };
      emptyMethodsPlan.classInfo = { ...mockClassInfo };
      emptyMethodsPlan.classInfo.methods = [];

      const result = generator.generateFromPlan(emptyMethodsPlan);

      expect(result.decoderCode).toContain('export class I2cDecoder extends DecoderBase');
      expect(result.decoderCode).toContain('constructor()');
      expect(result.stats.methodsConverted).toBe(0);
    });

    it('应该处理空的类属性', () => {
      const emptyAttrsPlan = { ...mockPlan };
      emptyAttrsPlan.classInfo = { ...mockClassInfo };
      emptyAttrsPlan.classInfo.attributes = [];

      const result = generator.generateFromPlan(emptyAttrsPlan);

      expect(result.decoderCode).toContain('constructor() {');
      expect(result.decoderCode).toContain('super();');
      expect(result.decoderCode).not.toContain('this. = null;');
    });

    it('应该处理没有注释配置', () => {
      generator = new TypeScriptCodeGenerator({ includeComments: false });
      const result = generator.generateFromPlan(mockPlan);

      expect(result.decoderCode).not.toContain('/**');
      expect(result.decoderCode).not.toContain('* I2C协议解码器');
      expect(result.decoderCode).toContain('export class I2cDecoder');
    });
  });

  describe('控制台输出测试', () => {
    beforeEach(() => {
      generator = new TypeScriptCodeGenerator();
    });

    it('应该输出生成进度信息', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      generator.generateFromPlan(mockPlan);

      expect(consoleSpy).toHaveBeenCalledWith('🔧 生成TypeScript代码: I2C协议解码器');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/✅ 代码生成完成: \d+行, 4方法/)
      );

      consoleSpy.mockRestore();
    });

    it('应该输出批量生成进度信息', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await generator.batchGenerate([mockPlan]);

      expect(consoleSpy).toHaveBeenCalledWith('🔧 开始批量生成 1 个解码器...');
      expect(consoleSpy).toHaveBeenCalledWith('✅ 批量生成完成: 1/1 成功');

      consoleSpy.mockRestore();
    });
  });
});