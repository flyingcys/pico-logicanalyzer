/**
 * Python解码器分析工具
 * 分析原@logicanalyzer/Software的Python解码器代码
 * 为自动转换到TypeScript提供结构化分析
 */

export interface PythonMethodInfo {
  /** 方法名 */
  name: string;
  /** 参数列表 */
  parameters: string[];
  /** 返回类型 */
  returnType?: string;
  /** 方法体代码 */
  body: string;
  /** 是否为核心API方法 */
  isCoreAPI: boolean;
  /** API调用统计 */
  apiCalls: {
    wait: number;
    put: number;
    other: string[];
  };
}

export interface PythonClassInfo {
  /** 类名 */
  className: string;
  /** 基类 */
  baseClass?: string;
  /** 类文档字符串 */
  docstring?: string;
  /** 类属性 */
  attributes: string[];
  /** 方法列表 */
  methods: PythonMethodInfo[];
  /** 导入依赖 */
  imports: string[];
}

export interface DecoderMetadata {
  /** 解码器ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 支持的通道数 */
  channels: Array<{
    name: string;
    required: boolean;
    description: string;
  }>;
  /** 配置选项 */
  options: Array<{
    id: string;
    name: string;
    type: 'int' | 'str' | 'bool' | 'list';
    default: any;
    description: string;
    values?: any[];
  }>;
  /** 输出注释类型 */
  annotations: string[];
}

export interface ConversionPlan {
  /** 原Python文件路径 */
  sourcePath: string;
  /** 目标TypeScript文件路径 */
  targetPath: string;
  /** 解码器元数据 */
  metadata: DecoderMetadata;
  /** 类信息 */
  classInfo: PythonClassInfo;
  /** 转换复杂度评估 */
  complexity: {
    level: 'simple' | 'medium' | 'complex';
    score: number;
    factors: string[];
  };
  /** 转换步骤 */
  steps: Array<{
    order: number;
    description: string;
    type: 'structure' | 'api' | 'logic' | 'validation';
    automated: boolean;
  }>;
}

/**
 * Python解码器分析工具类
 */
export class PythonDecoderAnalyzer {
  private coreAPIMethods = ['wait', 'put', 'decode', '__init__'];
  private commonPatterns = new Map<string, RegExp>();

  constructor() {
    this.initializePatterns();
  }

  /**
   * 初始化解析模式
   */
  private initializePatterns(): void {
    this.commonPatterns.set('class_definition', /^class\s+(\w+)(?:\(([^)]+)\))?:/);
    this.commonPatterns.set('method_definition', /^\s*def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:/);
    this.commonPatterns.set('docstring', /^\s*"""([^"]*(?:"[^"]*)*?)"""/s);
    this.commonPatterns.set('wait_call', /self\.wait\s*\(/g);
    this.commonPatterns.set('put_call', /self\.put\s*\(/g);
    this.commonPatterns.set('import_statement', /^(?:from\s+\S+\s+)?import\s+(.+)$/);
    this.commonPatterns.set('attribute_assignment', /^\s*self\.(\w+)\s*=/);
    this.commonPatterns.set('annotation_types', /self\.put\s*\(\s*\d+\s*,\s*\d+\s*,\s*(\d+)/g);
  }

  /**
   * 分析Python解码器文件
   */
  public analyzePythonDecoder(pythonCode: string, filePath: string): ConversionPlan {
    console.log(`🔍 分析Python解码器: ${filePath}`);

    // 解析类信息
    const classInfo = this.parseClassStructure(pythonCode);

    // 提取元数据
    const metadata = this.extractDecoderMetadata(classInfo, pythonCode);

    // 评估复杂度
    const complexity = this.assessComplexity(classInfo, pythonCode);

    // 生成转换步骤
    const steps = this.generateConversionSteps(classInfo, complexity);

    const plan: ConversionPlan = {
      sourcePath: filePath,
      targetPath: this.generateTargetPath(filePath, metadata.id),
      metadata,
      classInfo,
      complexity,
      steps
    };

    console.log(`✅ 分析完成: ${metadata.name} (复杂度: ${complexity.level})`);
    return plan;
  }

  /**
   * 解析Python类结构
   */
  private parseClassStructure(pythonCode: string): PythonClassInfo {
    const lines = pythonCode.split('\n');
    const classInfo: PythonClassInfo = {
      className: '',
      attributes: [],
      methods: [],
      imports: []
    };

    let currentMethod: Partial<PythonMethodInfo> | null = null;
    let currentIndent = 0;
    let inClass = false;
    let inMethod = false;
    let methodBody: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // 解析导入语句
      const importMatch = this.commonPatterns.get('import_statement')?.exec(trimmedLine);
      if (importMatch && !inClass) {
        classInfo.imports.push(importMatch[1]);
        continue;
      }

      // 解析类定义
      const classMatch = this.commonPatterns.get('class_definition')?.exec(trimmedLine);
      if (classMatch) {
        classInfo.className = classMatch[1];
        classInfo.baseClass = classMatch[2];
        inClass = true;

        // 尝试解析下一行的文档字符串
        if (i + 1 < lines.length) {
          const docMatch = this.commonPatterns.get('docstring')?.exec(lines[i + 1]);
          if (docMatch) {
            classInfo.docstring = docMatch[1].trim();
          }
        }
        continue;
      }

      if (!inClass) continue;

      // 解析方法定义
      const methodMatch = this.commonPatterns.get('method_definition')?.exec(line);
      if (methodMatch) {
        // 保存前一个方法
        if (currentMethod) {
          this.finalizeMethod(currentMethod, methodBody, classInfo);
        }

        // 开始新方法
        currentMethod = {
          name: methodMatch[1],
          parameters: methodMatch[2] ? methodMatch[2].split(',').map(p => p.trim()) : [],
          returnType: methodMatch[3],
          body: '',
          isCoreAPI: this.coreAPIMethods.includes(methodMatch[1]),
          apiCalls: { wait: 0, put: 0, other: [] }
        };

        inMethod = true;
        methodBody = [];
        currentIndent = line.search(/\S/);
        continue;
      }

      // 收集方法体或类属性
      if (inMethod && currentMethod) {
        const lineIndent = line.search(/\S/);
        if (lineIndent > currentIndent || trimmedLine === '') {
          methodBody.push(line);
        } else {
          // 方法结束
          this.finalizeMethod(currentMethod, methodBody, classInfo);
          currentMethod = null;
          inMethod = false;
          methodBody = [];
        }
      }

      // 解析类属性
      if (inClass && !inMethod) {
        const attrMatch = this.commonPatterns.get('attribute_assignment')?.exec(line);
        if (attrMatch) {
          classInfo.attributes.push(attrMatch[1]);
        }
      }
    }

    // 处理最后一个方法
    if (currentMethod) {
      this.finalizeMethod(currentMethod, methodBody, classInfo);
    }

    return classInfo;
  }

  /**
   * 完成方法解析
   */
  private finalizeMethod(
    methodInfo: Partial<PythonMethodInfo>,
    methodBody: string[],
    classInfo: PythonClassInfo
  ): void {
    const body = methodBody.join('\n');
    const waitCalls = (body.match(this.commonPatterns.get('wait_call')!) || []).length;
    const putCalls = (body.match(this.commonPatterns.get('put_call')!) || []).length;

    const completeMethod: PythonMethodInfo = {
      name: methodInfo.name!,
      parameters: methodInfo.parameters!,
      returnType: methodInfo.returnType,
      body,
      isCoreAPI: methodInfo.isCoreAPI!,
      apiCalls: {
        wait: waitCalls,
        put: putCalls,
        other: this.extractOtherAPICalls(body)
      }
    };

    classInfo.methods.push(completeMethod);
  }

  /**
   * 提取其他API调用
   */
  private extractOtherAPICalls(body: string): string[] {
    const otherCalls: string[] = [];
    const patterns = [
      /self\.(\w+)\s*\(/g,
      /(\w+)\s*\(/g
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(body)) !== null) {
        const methodName = match[1];
        if (!['wait', 'put', 'self'].includes(methodName) &&
            !otherCalls.includes(methodName)) {
          otherCalls.push(methodName);
        }
      }
    });

    return otherCalls;
  }

  /**
   * 提取解码器元数据
   */
  private extractDecoderMetadata(classInfo: PythonClassInfo, pythonCode: string): DecoderMetadata {
    // 从类名生成ID
    const id = classInfo.className.toLowerCase().replace(/decoder$/, '');

    // 从文档字符串或类名生成显示名称
    const name = classInfo.docstring?.split('\n')[0] ||
                 classInfo.className.replace(/([A-Z])/g, ' $1').trim();

    // 解析通道信息（通常在__init__或decode方法中定义）
    const channels = this.extractChannelInfo(classInfo);

    // 解析配置选项（通常在__init__方法中定义）
    const options = this.extractConfigOptions(classInfo);

    // 提取注释类型（从put调用中分析）
    const annotations = this.extractAnnotationTypes(pythonCode);

    return {
      id,
      name,
      description: classInfo.docstring || `${name} Protocol Decoder`,
      channels,
      options,
      annotations
    };
  }

  /**
   * 提取通道信息
   */
  private extractChannelInfo(classInfo: PythonClassInfo): DecoderMetadata['channels'] {
    const channels: DecoderMetadata['channels'] = [];

    // 分析decode方法的参数
    const decodeMethod = classInfo.methods.find(m => m.name === 'decode');
    if (decodeMethod) {
      // 通过参数名推断通道
      decodeMethod.parameters.forEach(param => {
        if (param !== 'self' && !param.includes('=')) {
          channels.push({
            name: param.toUpperCase(),
            required: true,
            description: `${param.toUpperCase()} signal line`
          });
        }
      });
    }

    // 如果没有找到通道，添加默认通道
    if (channels.length === 0) {
      channels.push(
        { name: 'CLK', required: true, description: 'Clock signal' },
        { name: 'DATA', required: true, description: 'Data signal' }
      );
    }

    return channels;
  }

  /**
   * 提取配置选项
   */
  private extractConfigOptions(classInfo: PythonClassInfo): DecoderMetadata['options'] {
    const options: DecoderMetadata['options'] = [];

    // 分析__init__方法中的选项
    const initMethod = classInfo.methods.find(m => m.name === '__init__');
    if (initMethod) {
      // 通过默认参数值推断选项
      initMethod.parameters.forEach(param => {
        const [name, defaultValue] = param.split('=').map(p => p.trim());
        if (defaultValue && name !== 'self') {
          let type: 'int' | 'str' | 'bool' | 'list' = 'str';
          let parsedDefault: any = defaultValue.replace(/['"]/g, '');

          if (defaultValue === 'True' || defaultValue === 'False') {
            type = 'bool';
            parsedDefault = defaultValue === 'True';
          } else if (/^\d+$/.test(defaultValue)) {
            type = 'int';
            parsedDefault = parseInt(defaultValue);
          } else if (defaultValue.startsWith('[')) {
            type = 'list';
            parsedDefault = [];
          }

          options.push({
            id: name,
            name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            type,
            default: parsedDefault,
            description: `${name} configuration option`
          });
        }
      });
    }

    return options;
  }

  /**
   * 提取注释类型
   */
  private extractAnnotationTypes(pythonCode: string): string[] {
    const annotations = new Set<string>();
    const pattern = this.commonPatterns.get('annotation_types')!;
    let match;

    while ((match = pattern.exec(pythonCode)) !== null) {
      const annotationType = parseInt(match[1]);
      switch (annotationType) {
        case 0: annotations.add('Start'); break;
        case 1: annotations.add('Address'); break;
        case 2: annotations.add('Data'); break;
        case 3: annotations.add('ACK/NACK'); break;
        case 4: annotations.add('Stop'); break;
        default: annotations.add(`Type ${annotationType}`);
      }
    }

    return Array.from(annotations);
  }

  /**
   * 评估转换复杂度
   */
  private assessComplexity(classInfo: PythonClassInfo, pythonCode: string): ConversionPlan['complexity'] {
    let score = 0;
    const factors: string[] = [];

    // 方法数量
    const methodCount = classInfo.methods.length;
    if (methodCount > 10) {
      score += 3;
      factors.push(`多方法 (${methodCount}个)`);
    } else if (methodCount > 5) {
      score += 2;
      factors.push(`中等方法数 (${methodCount}个)`);
    } else {
      score += 1;
      factors.push(`少量方法 (${methodCount}个)`);
    }

    // API调用复杂度
    const totalWaitCalls = classInfo.methods.reduce((sum, m) => sum + m.apiCalls.wait, 0);
    const totalPutCalls = classInfo.methods.reduce((sum, m) => sum + m.apiCalls.put, 0);

    if (totalWaitCalls > 20 || totalPutCalls > 15) {
      score += 3;
      factors.push(`复杂状态机 (${totalWaitCalls} wait, ${totalPutCalls} put)`);
    } else if (totalWaitCalls > 10 || totalPutCalls > 8) {
      score += 2;
      factors.push(`中等状态机 (${totalWaitCalls} wait, ${totalPutCalls} put)`);
    } else {
      score += 1;
      factors.push(`简单状态机 (${totalWaitCalls} wait, ${totalPutCalls} put)`);
    }

    // 代码长度
    const codeLength = pythonCode.length;
    if (codeLength > 5000) {
      score += 2;
      factors.push(`大型文件 (${Math.round(codeLength / 1000)}K字符)`);
    } else if (codeLength > 2000) {
      score += 1;
      factors.push(`中型文件 (${Math.round(codeLength / 1000)}K字符)`);
    }

    // 外部依赖
    const externalImports = classInfo.imports.filter(imp =>
      !imp.startsWith('.') && !['sys', 'os', 're', 'math'].includes(imp)
    );
    if (externalImports.length > 0) {
      score += 2;
      factors.push(`外部依赖 (${externalImports.join(', ')})`);
    }

    // 确定复杂度等级
    let level: 'simple' | 'medium' | 'complex';
    if (score <= 4) {
      level = 'simple';
    } else if (score <= 8) {
      level = 'medium';
    } else {
      level = 'complex';
    }

    return { level, score, factors };
  }

  /**
   * 生成转换步骤
   */
  private generateConversionSteps(
    classInfo: PythonClassInfo,
    complexity: ConversionPlan['complexity']
  ): ConversionPlan['steps'] {
    const steps: ConversionPlan['steps'] = [];
    let order = 1;

    // 基础结构转换
    steps.push({
      order: order++,
      description: '创建TypeScript类结构和接口定义',
      type: 'structure',
      automated: true
    });

    steps.push({
      order: order++,
      description: '转换类属性和构造函数',
      type: 'structure',
      automated: true
    });

    // API转换
    steps.push({
      order: order++,
      description: '转换wait()和put()核心API调用',
      type: 'api',
      automated: true
    });

    // 逻辑转换
    for (const method of classInfo.methods.filter(m => m.isCoreAPI)) {
      steps.push({
        order: order++,
        description: `转换${method.name}方法逻辑`,
        type: 'logic',
        automated: complexity.level === 'simple'
      });
    }

    // 非核心方法转换
    const helperMethods = classInfo.methods.filter(m => !m.isCoreAPI);
    if (helperMethods.length > 0) {
      steps.push({
        order: order++,
        description: `转换${helperMethods.length}个辅助方法`,
        type: 'logic',
        automated: false
      });
    }

    // 验证和测试
    steps.push({
      order: order++,
      description: '添加类型注解和编译验证',
      type: 'validation',
      automated: true
    });

    steps.push({
      order: order++,
      description: '生成测试用例和功能验证',
      type: 'validation',
      automated: false
    });

    return steps;
  }

  /**
   * 生成目标文件路径
   */
  private generateTargetPath(sourcePath: string, decoderId: string): string {
    const fileName = `${decoderId.charAt(0).toUpperCase() + decoderId.slice(1)}Decoder.ts`;
    return `src/decoders/protocols/${fileName}`;
  }

  /**
   * 生成转换报告
   */
  public generateAnalysisReport(plans: ConversionPlan[]): string {
    let report = '# Python解码器分析报告\n\n';

    // 概览统计
    report += '## 分析概览\n\n';
    report += `- 分析解码器数量: ${plans.length}\n`;
    report += `- 简单转换: ${plans.filter(p => p.complexity.level === 'simple').length}\n`;
    report += `- 中等复杂度: ${plans.filter(p => p.complexity.level === 'medium').length}\n`;
    report += `- 复杂转换: ${plans.filter(p => p.complexity.level === 'complex').length}\n\n`;

    // 按复杂度分类
    const byComplexity = {
      simple: plans.filter(p => p.complexity.level === 'simple'),
      medium: plans.filter(p => p.complexity.level === 'medium'),
      complex: plans.filter(p => p.complexity.level === 'complex')
    };

    Object.entries(byComplexity).forEach(([level, levelPlans]) => {
      if (levelPlans.length === 0) return;

      report += `## ${level.toUpperCase()}复杂度解码器\n\n`;
      levelPlans.forEach(plan => {
        report += `### ${plan.metadata.name}\n`;
        report += `- **ID**: ${plan.metadata.id}\n`;
        report += `- **源文件**: ${plan.sourcePath}\n`;
        report += `- **目标文件**: ${plan.targetPath}\n`;
        report += `- **复杂度评分**: ${plan.complexity.score}/10\n`;
        report += `- **复杂度因素**: ${plan.complexity.factors.join(', ')}\n`;
        report += `- **通道数**: ${plan.metadata.channels.length}\n`;
        report += `- **配置选项**: ${plan.metadata.options.length}\n`;
        report += `- **方法数**: ${plan.classInfo.methods.length}\n`;
        report += `- **转换步骤**: ${plan.steps.length}步 (${plan.steps.filter(s => s.automated).length}自动化)\n\n`;
      });
    });

    // 转换建议
    report += '## 转换建议\n\n';
    report += '### 优先级建议\n';
    report += '1. **第一批转换**: 简单复杂度解码器，可自动化转换\n';
    report += '2. **第二批转换**: 中等复杂度解码器，需要部分手动调整\n';
    report += '3. **第三批转换**: 复杂解码器，需要重点关注和手动优化\n\n';

    // 自动化可行性
    const automatedSteps = plans.reduce((sum, p) => sum + p.steps.filter(s => s.automated).length, 0);
    const totalSteps = plans.reduce((sum, p) => sum + p.steps.length, 0);
    const automationRate = (automatedSteps / totalSteps * 100).toFixed(1);

    report += '### 自动化可行性\n';
    report += `- 总转换步骤: ${totalSteps}\n`;
    report += `- 可自动化步骤: ${automatedSteps}\n`;
    report += `- 自动化率: ${automationRate}%\n\n`;

    return report;
  }

  /**
   * 批量分析Python解码器
   */
  public async batchAnalyze(decoderFiles: Array<{ path: string; content: string }>): Promise<ConversionPlan[]> {
    console.log(`🔍 开始批量分析 ${decoderFiles.length} 个Python解码器...`);

    const plans: ConversionPlan[] = [];

    for (const file of decoderFiles) {
      try {
        const plan = this.analyzePythonDecoder(file.content, file.path);
        plans.push(plan);
      } catch (error) {
        console.error(`❌ 分析文件失败 ${file.path}:`, error);
      }
    }

    console.log(`✅ 批量分析完成: ${plans.length}/${decoderFiles.length} 成功`);
    return plans;
  }
}
