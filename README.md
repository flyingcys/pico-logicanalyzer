# VSCode 逻辑分析器插件

一个专业的 VSCode 逻辑分析器插件，旨在构建硬件生态优先的开放式逻辑分析器平台。

## 当前状态

本项目已具备 VSCode 扩展入口、Vue3 Webview、硬件驱动抽象层、核心协议解码器、`.lac` 文件处理、数据导出服务和多层测试目录。当前仍处于 Beta/工程整备阶段，不应按生产就绪发布。

最近一次质量基线验证结果（2026-04-28）：

- `npm run typecheck` 通过，是当前基础类型门禁。
- `npm run typecheck:strict` 通过，是分阶段 strict gate。
- `npm run test:webview:unit -- --runInBand` 通过，2 个测试套件、37 个测试。
- `npm run build:production` 通过，但 Webview 产物仍有 webpack 体积警告。
- `npm run test:unit -- --silent` 仍需拆分定位长耗时或开放句柄。
- `node scripts/ci-test-runner.js --layer=quick --dry-run` 用于本地验证 CI 执行计划，不会安装依赖或运行长测试。
- 功能声明以 [功能状态矩阵](docs/功能状态矩阵.md) 和 [真实硬件认证矩阵](docs/真实硬件认证矩阵.md) 为准。
- 详细差距见 [logicanalyzer 差距深度分析](docs/logicanalyzer-差距深度分析-2026-04-27.md)，下一阶段并行拆分见 [2026-04-28 并行 Worktree 对齐计划](docs/parallel-worktrees-2026-04-28.md)。

## 🎯 项目愿景

> 让每一个硬件都能发挥最大价值，让每一个开发者都能享受最佳体验。

### 核心使命
构建硬件生态优先的开放式逻辑分析器平台，成为逻辑分析器领域的"通用平台"。

### 战略目标
- 支持10+主流逻辑分析器硬件品牌
- 提供统一的硬件抽象层和开发体验
- 建立第三方驱动开发者生态系统
- 打破硬件厂商锁定，为用户提供选择自由

## ✨ 主要特性

### 🔧 硬件支持
- **Pico Logic 基础驱动**: 已有协议和连接框架，真实采集闭环仍按实验性处理
- **多品牌扩展框架**: Saleae、Rigol、Siglent、sigrok 适配仍需真实硬件认证
- **统一接口**: 标准化的硬件抽象层，简化设备切换

### 📊 数据分析
- **采集模型**: 提供采集会话、通道和 `.lac` 相关模型
- **协议解码**: 内置 I2C、SPI、UART 解码器，后续需要 sigrok golden 对齐
- **波形显示**: Vue3 Webview 和渲染框架已存在，真实大样本交互仍在迁移中

### 🌍 跨平台
- **全平台支持**: Windows、macOS、Linux 完整兼容
- **性能优化**: 针对不同平台优化的性能表现
- **中文本地化**: 完整的中文界面和文档支持

## 🚀 快速开始

### 环境要求

- **VSCode**: 版本 1.74.0 或更高
- **Node.js**: 版本 16.0.0 或更高
- **TypeScript**: 项目依赖 `^4.9.4`

### 安装插件

1. 打开 VSCode
2. 前往扩展市场 (Ctrl+Shift+X)
3. 搜索 "Logic Analyzer"
4. 点击安装

当前仓库仍处于 Beta/工程整备阶段。如需本地体验，请优先从源码构建 VSIX，而不是按生产发布插件使用。

### 连接设备

1. 将逻辑分析器通过 USB 连接到计算机
2. 在 VSCode 中按 `Ctrl+Shift+P` 打开命令面板
3. 输入 "Logic Analyzer: Connect Device"
4. 选择您的设备

### 开始采集

1. 配置采集参数：
   - 采样频率: 1MHz - 100MHz
   - 通道选择: 最多 24 个数字通道
   - 触发条件: 边沿、电平、复合触发

2. 点击 "开始采集" 按钮
3. 查看实时波形数据
4. 使用协议解码器分析数据

## 📋 支持的硬件

| 厂商 | 型号 | 通道数 | 最大频率 | 状态 |
|------|------|--------|----------|------|
| 厂商 | 型号 | 通道数 | 最大频率 | 状态 |
|------|------|--------|----------|------|
| Pico Logic | Pico / Pico W / Pico 2 系列 | 24 | 依固件能力 | 实验性，待真实硬件认证 |
| Saleae | Logic 8 / Logic Pro 16 | 8 / 16 | 依设备能力 | 实验性适配，待认证 |
| Rigol / Siglent | 含逻辑分析能力的示波器型号 | 依型号 | 依型号 | 实验性 SCPI 框架 |
| sigrok | `sigrok-cli` 支持设备 | 依设备 | 依设备 | 实验性外部工具适配 |
| Kingst / DreamSourceLab | 待定 | 待定 | 待定 | 规划中 |

完整状态见 [真实硬件认证矩阵](docs/真实硬件认证矩阵.md)。

## 🔧 协议解码器

### 支持的协议

- **I2C**: 完整的地址、数据解码，错误检测
- **SPI**: 支持多种模式，可配置位序
- **UART**: 波特率自动检测，奇偶校验支持
- **更多协议**: CAN、LIN、I2S、USB、JTAG/SWD 等仍为规划中

### 自定义解码器

支持使用 TypeScript 开发自定义协议解码器：

```typescript
// 示例：自定义协议解码器
class CustomDecoder extends DecoderBase {
  readonly id = 'custom-protocol';
  readonly name = '自定义协议';
  readonly channels = [
    { id: 'clk', name: '时钟', description: '时钟信号' },
    { id: 'data', name: '数据', description: '数据信号' }
  ];

  decode(sampleRate: number, channels: AnalyzerChannel[]): DecoderResult[] {
    // 实现您的解码逻辑
    return [];
  }
}
```

## 🛠️ 开发指南

### 项目结构

```
vscode-logicanalyzer/
├── src/
│   ├── drivers/           # 硬件驱动层
│   ├── decoders/          # 协议解码器
│   ├── webview/           # Vue前端界面
│   └── models/            # 数据模型
├── tests/                 # 测试文件
├── docs/                  # 文档
└── package.json
```

### 构建项目

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建项目
npm run build

# 运行测试
npm test

# 类型检查
npm run typecheck

# 分阶段 strict gate
npm run typecheck:strict

# 代码检查
npm run lint

# 本地质量门禁
npm run validate
```

### 添加新硬件支持

1. 继承 `AnalyzerDriverBase` 基类
2. 实现必要的硬件接口方法
3. 添加设备识别信息
4. 编写单元测试
5. 更新文档

详细开发指南请参考 [开发者文档](docs/developer-guide.md)。

## 📊 性能指标

- **启动时间**: < 2秒
- **波形渲染**: 60fps @ 100万数据点
- **内存使用**: 24小时运行无泄漏
- **多设备同步**: 支持5设备 @ 100MHz

## 🧪 测试覆盖

- **测试目录**: 当前包含单元、集成、性能、压力和端到端测试目录。
- **迁移状态**: 测试从旧 `utest` 目录向 `tests` 目录迁移尚未完全收口，仍有测试文件引用 `../../../utest/mocks/simple-mocks`。
- **当前风险**: 最近一次 `npm run test:unit -- --silent` 超过 3 分钟无输出，需先定位卡住/长耗时测试。
- **发布门槛**: `npm run typecheck`、核心单元测试、集成测试、构建和发布检查均通过后，才可重新声明覆盖率和发布状态。

## 📈 版本历史

### v1.0.0 (计划中，未达到发布门槛)
- ✅ 基础硬件抽象层
- ✅ 核心协议解码器 (I2C/SPI/UART)
- ✅ Vue3 现代化界面
- 🔄 类型错误清零
- 🔄 测试迁移和稳定性收口
- 🔄 发布检查和真实硬件回归验证

### v1.0.0-beta.0 (当前)
- ✅ VSCode 扩展、Vue3 Webview、驱动抽象和基础解码器框架已建立
- 🔄 strict gate、CI 和本地质量门禁恢复中
- 🔄 文档与源码状态同步中
- 🔄 真实硬件认证矩阵待补证据

## 🤝 贡献指南

我们欢迎各种形式的贡献：

### 报告问题
在 [Issues](https://github.com/pico-logicanalyzer/vscode-logic-analyzer/issues) 页面报告 bug 或请求新功能。

### 提交代码
1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 编写文档
改进用户手册、API 文档或添加使用示例。

### 硬件支持
贡献新的硬件驱动或协议解码器。

## 📄 许可证

本项目采用 MIT 许可证。详情请参阅 [LICENSE](LICENSE) 文件。

## 🙏 致谢

感谢以下项目和贡献者：

- **@logicanalyzer/Software**: 提供了 C# 参考实现
- **Saleae Logic**: 优秀的硬件设计启发
- **Vue.js & Element Plus**: 现代化的前端框架
- **VSCode Extension API**: 强大的插件开发平台

## 📞 联系方式

- **项目主页**: [https://github.com/pico-logicanalyzer/vscode-logic-analyzer](https://github.com/pico-logicanalyzer/vscode-logic-analyzer)
- **文档站点**: [https://docs.logicanalyzer-vscode.com](https://docs.logicanalyzer-vscode.com)
- **问题反馈**: [Issues](https://github.com/pico-logicanalyzer/vscode-logic-analyzer/issues)
- **讨论社区**: [Discussions](https://github.com/pico-logicanalyzer/vscode-logic-analyzer/discussions)

---

**Made with ❤️ for the hardware development community**
