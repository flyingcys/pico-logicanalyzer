# VSCode 逻辑分析器插件

一个专业的 VSCode 逻辑分析器插件，旨在构建硬件生态优先的开放式逻辑分析器平台。

## 当前状态

本项目已具备 VSCode 扩展入口、Vue3 Webview、硬件驱动抽象层、核心协议解码器、`.lac` 文件处理、数据导出服务和多层测试目录。当前仍处于 Beta/工程整备阶段，不应按生产就绪发布。

最近一次代码审查验证结果（2026-04-27）：

- `npm run build` 可以完成打包，但 webpack 当前使用 `transpileOnly`，构建不会阻塞 TypeScript 类型错误。
- `npm run typecheck` 失败，主要问题在 `driver-sdk/templates/GenericDriverTemplate.ts`、`src/extension.ts`、`src/models/UnifiedDataFormat.ts`、`src/services/DataExportService.ts`、`src/services/stage7-self-test.ts`、`src/utils/MemoryManager.ts`。
- 部分测试仍引用已弃用的 `utest/mocks` 路径，测试迁移未完成。
- 详细现状和下一步见 [当前现状与下一步计划](docs/current-status-and-next-steps-2026-04-27.md)。

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
- **多品牌兼容**: 支持 Saleae Logic、Kingst LA、Pico Logic 等主流硬件
- **统一接口**: 标准化的硬件抽象层，简化设备切换
- **即插即用**: 自动检测和配置支持的逻辑分析器设备

### 📊 数据分析
- **实时采集**: 高速数据捕获，支持最高 100MHz 采样率
- **协议解码**: 内置 I2C、SPI、UART 等常用协议解码器
- **波形显示**: 流畅的 60fps 波形渲染，支持百万数据点

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
| Saleae | Logic 8 | 8 | 100MHz | ✅ 完整支持 |
| Saleae | Logic Pro 16 | 16 | 500MHz | ✅ 完整支持 |
| Kingst | LA1010 | 16 | 200MHz | 🔄 开发中 |
| DreamSourceLab | DSLogic | 16 | 400MHz | 📋 计划中 |
| Pico Logic | Custom | 24 | 100MHz | ✅ 完整支持 |

## 🔧 协议解码器

### 支持的协议

- **I2C**: 完整的地址、数据解码，错误检测
- **SPI**: 支持多种模式，可配置位序
- **UART**: 波特率自动检测，奇偶校验支持
- **1-Wire**: Dallas/Maxim 单总线协议
- **CAN**: 基础帧格式解码

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
├── test/                  # 测试文件
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

# 代码检查
npm run lint
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
- ✅ 测试框架和优化完成
- ✅ 性能基准和内存检测
- 🔄 文档与源码状态同步中

## 🤝 贡献指南

我们欢迎各种形式的贡献：

### 报告问题
在 [Issues](https://github.com/your-repo/vscode-logicanalyzer/issues) 页面报告 bug 或请求新功能。

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

- **项目主页**: [https://github.com/your-repo/vscode-logicanalyzer](https://github.com/your-repo/vscode-logicanalyzer)
- **文档站点**: [https://docs.logicanalyzer-vscode.com](https://docs.logicanalyzer-vscode.com)
- **问题反馈**: [Issues](https://github.com/your-repo/vscode-logicanalyzer/issues)
- **讨论社区**: [Discussions](https://github.com/your-repo/vscode-logicanalyzer/discussions)

---

**Made with ❤️ for the hardware development community**
