/**
 * TypeScript代码生成器
 * 基于Python解码器分析结果自动生成TypeScript代码
 * 为Python→TypeScript转换提供自动化支持
 */

import { ConversionPlan, DecoderMetadata, PythonClassInfo, PythonMethodInfo } from './PythonDecoderAnalyzer';

export interface CodeGenerationOptions {
  /** 是否添加详细注释 */
  includeComments: boolean;
  /** 是否生成类型声明 */
  generateTypes: boolean;
  /** 是否包含测试代码 */
  includeTests: boolean;
  /** 目标ES版本 */
  targetES: 'ES2020' | 'ES2021' | 'ES2022';
  /** 代码风格 */
  codeStyle: 'standard' | 'prettier';
}

export interface GeneratedCode {
  /** 主解码器文件 */
  decoderCode: string;
  /** 类型定义文件 */
  typesCode?: string;
  /** 测试文件 */
  testCode?: string;
  /** 生成统计 */
  stats: {
    linesGenerated: number;
    methodsConverted: number;
    typesGenerated: number;
    complexityHandled: string;
  };
}

/**
 * TypeScript代码生成器类
 */
export class TypeScriptCodeGenerator {
  private options: CodeGenerationOptions;
  private indentSize = 2;

  constructor(options: Partial<CodeGenerationOptions> = {}) {
    this.options = {
      includeComments: true,
      generateTypes: true,
      includeTests: false,
      targetES: 'ES2020',
      codeStyle: 'prettier',
      ...options
    };
  }

  /**
   * 根据转换计划生成TypeScript代码
   */
  public generateFromPlan(plan: ConversionPlan): GeneratedCode {
    console.log(`🔧 生成TypeScript代码: ${plan.metadata.name}`);

    const decoderCode = this.generateDecoderClass(plan);
    const typesCode = this.options.generateTypes ? this.generateTypeDefinitions(plan) : undefined;
    const testCode = this.options.includeTests ? this.generateTestCode(plan) : undefined;

    const stats = {
      linesGenerated: decoderCode.split('\n').length,
      methodsConverted: plan.classInfo.methods.length,
      typesGenerated: this.countGeneratedTypes(plan),
      complexityHandled: plan.complexity.level
    };

    console.log(`✅ 代码生成完成: ${stats.linesGenerated}行, ${stats.methodsConverted}方法`);

    return {
      decoderCode,
      typesCode,
      testCode,
      stats
    };
  }

  /**
   * 生成解码器类代码
   */
  private generateDecoderClass(plan: ConversionPlan): string {
    const { metadata, classInfo } = plan;
    let code = '';

    // 文件头注释
    if (this.options.includeComments) {
      code += this.generateFileHeader(metadata);
    }

    // 导入语句
    code += this.generateImports(plan);
    code += '\n';

    // 类型定义（如果内联）
    if (!this.options.generateTypes) {
      code += this.generateInlineTypes(plan);
      code += '\n';
    }

    // 类定义开始
    code += this.generateClassHeader(plan);
    code += '\n';

    // 属性定义
    code += this.generateProperties(plan);
    code += '\n';

    // 构造函数
    code += this.generateConstructor(plan);
    code += '\n';

    // 方法定义
    for (const method of classInfo.methods) {
      code += this.generateMethod(method, plan);
      code += '\n';
    }

    // 类定义结束
    code += '}\n';

    return this.formatCode(code);
  }

  /**
   * 生成文件头注释
   */
  private generateFileHeader(metadata: DecoderMetadata): string {
    const lines = [
      '/**',
      ` * ${metadata.name}`,
      ` * ${metadata.description}`,
      ' * ',
      ' * 自动从Python解码器转换生成',
      ` * 支持通道: ${metadata.channels.map(c => c.name).join(', ')}`,
      ` * 配置选项: ${metadata.options.length}个`,
      ' */'
    ];
    return `${lines.join('\n')}\n\n`;
  }

  /**
   * 生成导入语句
   */
  private generateImports(plan: ConversionPlan): string {
    const imports = [
      "import { DecoderBase, DecoderResult, WaitCondition, WaitResult } from '../base/DecoderBase';",
      "import { AnalyzerChannel } from '../../models/CaptureModels';",
      "import { DecoderOptionValue } from '../DecoderManager';"
    ];

    if (this.options.generateTypes) {
      imports.push(`import { ${plan.metadata.id.toUpperCase()}DecoderOptions } from './types/${plan.metadata.id}Types';`);
    }

    return imports.join('\n');
  }

  /**
   * 生成内联类型定义
   */
  private generateInlineTypes(plan: ConversionPlan): string {
    if (plan.metadata.options.length === 0) return '';

    let code = `export interface ${plan.metadata.id.toUpperCase()}DecoderOptions {\n`;

    for (const option of plan.metadata.options) {
      if (this.options.includeComments) {
        code += `  /** ${option.description} */\n`;
      }

      const typeStr = this.mapPythonTypeToTypeScript(option.type, option.values);
      code += `  ${option.id}: ${typeStr};\n`;
    }

    code += '}\n';
    return code;
  }

  /**
   * 生成类头部
   */
  private generateClassHeader(plan: ConversionPlan): string {
    const { metadata, classInfo } = plan;
    let code = '';

    if (this.options.includeComments) {
      code += '/**\n';
      code += ` * ${metadata.name}解码器\n`;
      code += ` * 基于原Python ${classInfo.className}类实现\n`;
      code += ' */\n';
    }

    const className = `${metadata.id.charAt(0).toUpperCase() + metadata.id.slice(1)}Decoder`;
    code += `export class ${className} extends DecoderBase {\n`;

    return code;
  }

  /**
   * 生成属性定义
   */
  private generateProperties(plan: ConversionPlan): string {
    let code = '';
    const indent = ' '.repeat(this.indentSize);

    // 基础属性
    code += `${indent}public readonly id = '${plan.metadata.id}';\n`;
    code += `${indent}public readonly name = '${plan.metadata.name}';\n`;
    code += `${indent}public readonly channels = ${JSON.stringify(plan.metadata.channels, null, 2).split('\n').join(`\n${indent}`)};\n`;
    code += `${indent}public readonly annotations = ${JSON.stringify(plan.metadata.annotations)};\n`;
    code += '\n';

    // 私有属性（从Python类属性转换）
    for (const attr of plan.classInfo.attributes) {
      code += `${indent}private ${attr}: unknown;\n`;
    }

    return code;
  }

  /**
   * 生成构造函数
   */
  private generateConstructor(plan: ConversionPlan): string {
    const indent = ' '.repeat(this.indentSize);
    let code = '';

    if (this.options.includeComments) {
      code += `${indent}/**\n`;
      code += `${indent} * 构造${plan.metadata.name}解码器\n`;
      code += `${indent} */\n`;
    }

    code += `${indent}constructor() {\n`;
    code += `${indent}  super();\n`;

    // 初始化属性
    for (const attr of plan.classInfo.attributes) {
      code += `${indent}  this.${attr} = null;\n`;
    }

    code += `${indent}}\n`;

    return code;
  }

  /**
   * 生成方法代码
   */
  private generateMethod(method: PythonMethodInfo, plan: ConversionPlan): string {
    const indent = ' '.repeat(this.indentSize);
    let code = '';

    // 跳过构造函数（已单独处理）
    if (method.name === '__init__') return '';

    if (this.options.includeComments) {
      code += `${indent}/**\n`;
      code += `${indent} * ${method.name}方法\n`;
      if (method.apiCalls.wait > 0 || method.apiCalls.put > 0) {
        code += `${indent} * API调用: ${method.apiCalls.wait} wait, ${method.apiCalls.put} put\n`;
      }
      code += `${indent} */\n`;
    }

    // 方法签名
    const methodName = method.name === 'decode' ? 'decode' : method.name;
    const params = this.convertMethodParameters(method, plan);
    const returnType = this.convertReturnType(method);

    const visibility = method.isCoreAPI ? 'public' : 'private';
    const asyncModifier = method.apiCalls.wait > 0 ? 'async ' : '';

    code += `${indent}${visibility} ${asyncModifier}${methodName}(${params})${returnType} {\n`;

    // 方法体
    const methodBody = this.convertMethodBody(method, plan);
    code += methodBody.split('\n').map(line => line ? `${indent}  ${line}` : '').join('\n');
    code += '\n';

    code += `${indent}}\n`;

    return code;
  }

  /**
   * 转换方法参数
   */
  private convertMethodParameters(method: PythonMethodInfo, plan: ConversionPlan): string {
    if (method.name === 'decode') {
      return [
        'sampleRate: number',
        'channels: AnalyzerChannel[]',
        'options: DecoderOptionValue[]'
      ].join(', ');
    }

    return method.parameters
      .filter(param => param !== 'self')
      .map(param => {
        const [name, defaultValue] = param.split('=').map(p => p.trim());
        const type = this.inferParameterType(param, defaultValue);
        const optional = defaultValue ? '?' : '';
        return `${name}${optional}: ${type}`;
      })
      .join(', ');
  }

  /**
   * 转换返回类型
   */
  private convertReturnType(method: PythonMethodInfo): string {
    if (method.name === 'decode') {
      return ': Promise<DecoderResult[]>';
    }

    if (method.apiCalls.wait > 0) {
      return ': Promise<void>';
    }

    return method.returnType ? `: ${this.mapPythonTypeToTypeScript(method.returnType)}` : ': void';
  }

  /**
   * 转换方法体
   */
  private convertMethodBody(method: PythonMethodInfo, plan: ConversionPlan): string {
    if (method.name === 'decode') {
      return this.generateDecodeMethodBody(plan);
    }

    // 简单的方法体转换
    let { body } = method;

    // Python到TypeScript的基本转换
    body = body.replace(/self\./g, 'this.');
    body = body.replace(/def\s+\w+\s*\([^)]*\):/g, '');

    // 条件语句转换
    body = body.replace(/if\s+(.+?)\s*:/g, 'if ($1) {');
    body = body.replace(/elif\s+(.+?)\s*:/g, '} else if ($1) {');
    body = body.replace(/\belif\b/g, '} else if');
    body = body.replace(/else\s*:/g, '} else {');

    // Python 比较运算符转换
    body = body.replace(/\bis\s+True\b/g, '=== true');
    body = body.replace(/\bis\s+False\b/g, '=== false');
    body = body.replace(/\bis\s+None\b/g, '=== null');
    body = body.replace(/\bis\s+not\s+None\b/g, '!== null');
    body = body.replace(/\s==\s/g, ' === ');
    body = body.replace(/\s!=\s/g, ' !== ');

    // Python 字面量转换
    body = body.replace(/\bTrue\b/g, 'true');
    body = body.replace(/\bFalse\b/g, 'false');
    body = body.replace(/\bNone\b/g, 'null');

    // Python 逻辑运算符转换
    body = body.replace(/\band\b/g, '&&');
    body = body.replace(/\bor\b/g, '||');
    body = body.replace(/\bnot\s+/g, '!');

    // 返回语句转换
    body = body.replace(/return\s+None/g, 'return null;');
    body = body.replace(/return\s+([^;\n]+)$/gm, 'return $1;');

    // API调用转换
    body = body.replace(/this\.wait\s*\(/g, 'await this.wait(');
    body = body.replace(/this\.put\s*\(/g, 'this.put(');

    return body || this.generateDecodeMethodBody(plan);
  }

  /**
   * 生成decode方法体
   * 实现基于注解的解码逻辑生成 - 支持Python到TS转换覆盖
   */
  private generateDecodeMethodBody(plan: ConversionPlan): string {
    const indent = ' '.repeat(this.indentSize);
    let code = '';

    code += `${indent}// 解码器生成逻辑 - Python到TypeScript转换实现（已TDD修复，简化版本）\n`;
    code += `${indent}// 结果数组初始化\n`;
    code += `${indent}const results: DecoderResult[] = [];\n\n`;

    code += `${indent}// 根据通道和注解生成解码调用逻辑\n`;
    if (plan.metadata.channels.length > 0 && plan.metadata.annotations.length > 0) {
      code += `${indent}// 简化状态机基础\n`;
      code += `${indent}const [channel0, channel1] = channels;\n\n`;

      code += `${indent}// 主解码循环\n`;
      code += `${indent}while (this.hasMoreSamples()) {\n`;
      code += `${indent}  try {\n`;
      code += `${indent}    await this.wait({ 0: 'high' });\n`;
      code += `${indent}    this.put(this.sampleIndex, this.sampleIndex, { type: 'annotation' as const });\n`;
      code += `${indent}  } catch (error: unknown) {\n`;
      code += `${indent}    if ((error as Error).message === 'End of samples reached') {\n`;
      code += `${indent}      break;\n`;
      code += `${indent}    }\n`;
      code += `${indent}    throw error;\n`;
      code += `${indent}  }\n`;
      code += `${indent}}\n\n`;
    } else {
      code += `${indent}  // 基础解码逻辑 - 无注解\n`;
      code += `${indent}  await this.wait({ 0: 'high' });\n`;
      code += `${indent}  this.put(0, 0, { type: 'annotation' as const });\n\n`;
      code += `${indent}}\n\n`;
    }

    return code;
  }

  /**
   * 推断参数类型
   */
  private inferParameterType(param: string, defaultValue?: string): string {
    if (!defaultValue) return 'unknown';

    if (defaultValue === 'true' || defaultValue === 'false' ||
        defaultValue === 'True' || defaultValue === 'False') {
      return 'boolean';
    }

    if (/^\d+$/.test(defaultValue)) {
      return 'number';
    }

    if (defaultValue.startsWith('"') || defaultValue.startsWith("'")) {
      return 'string';
    }

    if (defaultValue.startsWith('[')) {
      return 'unknown[]';
    }

    return 'unknown';
  }

  /**
   * 映射Python类型到TypeScript
   */
  private mapPythonTypeToTypeScript(pythonType: string, values?: unknown[]): string {
    switch (pythonType) {
      case 'int': return 'number';
      case 'str': return 'string';
      case 'bool': return 'boolean';
      case 'list':
        if (values && values.length > 0) {
          const valueTypes = values.map(v => typeof v === 'string' ? `'${v}'` : typeof v);
          return `(${[...new Set(valueTypes)].join(' | ')})[]`;
        }
        return 'unknown[]';
      default: return 'unknown';
    }
  }

  /**
   * 生成类型定义文件
   */
  private generateTypeDefinitions(plan: ConversionPlan): string {
    let code = '';

    code += `// ${plan.metadata.name} 类型定义\n`;
    code += '// 自动生成，请勿手动修改\n\n';

    // 配置选项接口
    if (plan.metadata.options.length > 0) {
      code += `export interface ${plan.metadata.id.toUpperCase()}DecoderOptions {\n`;

      for (const option of plan.metadata.options) {
        code += `  /** ${option.description} */\n`;
        const type = this.mapPythonTypeToTypeScript(option.type, option.values);
        code += `  ${option.id}: ${type};\n`;
      }

      code += '}\n\n';
    }

    // 通道配置接口
    code += `export interface ${plan.metadata.id.toUpperCase()}ChannelConfig {\n`;
    for (const channel of plan.metadata.channels) {
      code += `  /** ${channel.description} */\n`;
      code += `  ${channel.name.toLowerCase()}${!channel.required ? '?' : ''}: number;\n`;
    }
    code += '}\n';

    return code;
  }

  /**
   * 生成测试代码
   */
  private generateTestCode(plan: ConversionPlan): string {
    const className = `${plan.metadata.id.charAt(0).toUpperCase() + plan.metadata.id.slice(1)}Decoder`;

    let code = '';
    code += `// ${plan.metadata.name} 测试文件\n`;
    code += `import { ${className} } from '../${className}';\n`;
    code += 'import { generateTestChannelData } from \'../../testing/TestDataGenerator\';\n\n';

    code += `describe('${className}', () => {\n`;
    code += `  let decoder: ${className};\n\n`;

    code += '  beforeEach(() => {\n';
    code += `    decoder = new ${className}();\n`;
    code += '  });\n\n';

    code += '  test(\'应该正确初始化\', () => {\n';
    code += `    expect(decoder.id).toBe('${plan.metadata.id}');\n`;
    code += `    expect(decoder.name).toBe('${plan.metadata.name}');\n`;
    code += '  });\n\n';

    code += '  test(\'应该正确解码数据\', async () => {\n';
    code += `    const testData = generateTestChannelData(1000, ${plan.metadata.channels.length});\n`;
    code += '    const results = await decoder.decode(1000000, testData, []);\n';
    code += '    expect(Array.isArray(results)).toBe(true);\n';
    code += '  });\n';

    code += '});\n';

    return code;
  }

  /**
   * 统计生成的类型数量
   */
  private countGeneratedTypes(plan: ConversionPlan): number {
    let count = 0;
    if (plan.metadata.options.length > 0) count++; // Options interface
    count++; // Channel config interface
    return count;
  }

  /**
   * 格式化代码
   */
  private formatCode(code: string): string {
    if (this.options.codeStyle === 'prettier') {
      // 简单的代码格式化
      return `${code
        .replace(/\n\n\n+/g, '\n\n') // 删除多余空行
        .replace(/^[ \t]+$/gm, '') // 删除空行的空白字符
        .trim()}\n`;
    }

    return code;
  }

  /**
   * 批量生成代码
   */
  public async batchGenerate(plans: ConversionPlan[]): Promise<Map<string, GeneratedCode>> {
    console.log(`🔧 开始批量生成 ${plans.length} 个解码器...`);

    const results = new Map<string, GeneratedCode>();

    for (const plan of plans) {
      try {
        const generated = this.generateFromPlan(plan);
        results.set(plan.metadata.id, generated);
      } catch (error: unknown) {
        const planId = plan?.metadata?.id || 'unknown';
        console.error(`❌ 生成代码失败 ${planId}:`, error);
      }
    }

    console.log(`✅ 批量生成完成: ${results.size}/${plans.length} 成功`);
    return results;
  }
}
