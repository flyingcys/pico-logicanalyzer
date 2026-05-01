# VSCode 逻辑分析器插件

一个专业的 VSCode 逻辑分析器插件，旨在构建硬件生态优先的开放式逻辑分析器平台。

## 当前状态

本项目已具备 VSCode 扩展入口、Vue3 Webview、硬件驱动抽象层、核心协议解码器、`.lac` 文件处理、数据导出服务和多层测试目录。当前仍处于 Beta/工程整备阶段，不应按生产就绪发布。

最近一次质量基线验证结果（2026-04-30）：

- `rtk npm run typecheck` 通过，是当前基础类型门禁。
- `rtk npm run typecheck:strict` 通过，是分阶段 strict gate；当前覆盖 `src/models/*.ts`、`src/decoders/*.ts`，以及少量 driver/service/frontend core 低耦合入口，不代表全仓库 strict 完成。
- `rtk npm run lint` 通过，本次未输出 warning。
- `rtk npm run test:webview:unit -- --runInBand` 通过，3 个测试套件、98 个测试；`ts-jest isolatedModules` 配置 warning 已迁移处理。
- `rtk npm run test:decoders -- --runInBand` 通过，10 个测试套件、196 个测试；解码器内部进度、注册和停止日志默认由 `PICO_DECODER_DEBUG` 开关静默。
- `rtk npm run test:ci:quick -- --skip-install` 通过，14 个 quick 核心测试文件、373 个测试，暂不阻断测试 0 个。
- `rtk npm run test:ci:standard -- --skip-install` 通过，18 个测试文件、383 个测试。
- `rtk npm run test:ci:full -- --skip-install` 通过，22 个测试文件、393 个测试，用时约 7.5 分钟。
- `rtk npm run package:dry` 通过；该脚本中的 `vsce ls` 会执行 `vscode:prepublish`，因此实际触发了 `rtk npm run build:production`，这不是 `package.json` 中 `package:dry` 脚本文本直接串联构建命令。Webview 运行时入口约 2.23 MiB，已拆出 `element-plus`、`vue-vendor`、`i18n` 等 chunk，仍需继续关注 bundle 预算。
- `rtk npm run test:unit -- --silent` 不作为当前发布证据；发布检查优先使用 quick/standard/full 分层命令。
- `rtk npm run validate:local` 用于本地快速门禁；`rtk node scripts/ci-test-runner.js --layer=quick --dry-run` 可查看 CI 执行计划，不会安装依赖或运行长测试。
- Quick 层暂不阻断测试数量为 0，详见 [发布门槛](docs/release-gate.md)。
- 功能声明以 [功能状态矩阵](docs/功能状态矩阵.md) 和 [硬件证据矩阵](docs/%E7%9C%9F%E5%AE%9E%E7%A1%AC%E4%BB%B6%E8%AE%A4%E8%AF%81%E7%9F%A9%E9%98%B5.md) 为准。
- 发布检查以 [发布门槛](docs/release-gate.md) 和 [文档状态索引](docs/文档状态索引.md) 为准。
- 2026-04-30 当前有效状态基线见 [当前状态复盘与下一步工作实施计划](docs/superpowers/plans/2026-04-30-current-status-review-and-next-work.md)。
- 2026-04-28 的 review、I2C 闭环拆分和并行 worktree 计划只作为历史背景；引用时必须同时核对当前状态基线、功能矩阵和硬件矩阵。

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
- **多品牌扩展框架**: Saleae、Rigol、Siglent、sigrok 适配仍为 framework / experimental，真实设备记录为 pending
- **统一接口**: 标准化的硬件抽象层，简化设备切换

### 📊 数据分析
- **采集模型**: 提供采集会话、通道和 `.lac` 相关模型
- **协议解码**: 内置 I2C、SPI、UART、CAN、LIN、I2S 解码器，后续继续扩充真实 sigrok golden 样本
- **波形显示**: Vue3 Webview 和渲染框架已存在，真实大样本交互仍在迁移中

### 🌍 跨平台
- **跨平台目标**: Windows、macOS、Linux 均在支持范围内，发布前仍需按 release gate 验证
- **性能优化**: 已建立性能优化方向，发布口径以实际门禁和 smoke 结果为准
- **中文本地化**: 中文界面和文档持续维护

## 本地体验 / 开发验证流程

### 环境要求

- **VSCode**: 版本 1.74.0 或更高
- **Node.js**: 版本 16.0.0 或更高
- **TypeScript**: 项目依赖 `^4.9.4`

### 本地构建

当前仓库仍处于 Beta/工程整备阶段。本节用于源码构建、本地调试和开发验证，不表示面向普通用户的发布流程。

```bash
# 安装依赖
rtk npm install

# 开发模式
rtk npm run dev

# 构建项目
rtk npm run build

# 运行测试
rtk npm test

# 类型检查
rtk npm run typecheck

# 分阶段 strict gate
rtk npm run typecheck:strict

# 代码检查
rtk npm run lint

# 本地质量门禁
rtk npm run validate

# 查看 quick/standard/full 分层测试计划
rtk node scripts/ci-test-runner.js --layer=quick --dry-run
```

### 真实设备验证

真实设备连接、采集和协议解码需要按 [硬件证据矩阵](docs/%E7%9C%9F%E5%AE%9E%E7%A1%AC%E4%BB%B6%E8%AE%A4%E8%AF%81%E7%9F%A9%E9%98%B5.md) 记录设备型号、固件版本、commit、采集配置、结果文件、sha256、截图和结论。没有这些记录前，只能按 fixture、framework、experimental 或 pending 引用。

### 采集路径

以下仅作为待验证操作路径，不表示真实设备已经通过：

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
| Pico Logic | Pico / Pico W / Pico 2 系列 | 24 | 依固件能力 | fixture / experimental，真实设备记录 pending |
| Saleae | Logic 8 / Logic Pro 16 | 8 / 16 | 依设备能力 | framework / experimental，真实设备记录 pending |
| Rigol / Siglent | 含逻辑分析能力的示波器型号 | 依型号 | 依型号 | framework / experimental |
| sigrok | `sigrok-cli` 支持设备 | 依设备 | 依设备 | framework / experimental |
| Kingst / DreamSourceLab | 待定 | 待定 | 待定 | pending |

完整状态见 [硬件证据矩阵](docs/%E7%9C%9F%E5%AE%9E%E7%A1%AC%E4%BB%B6%E8%AE%A4%E8%AF%81%E7%9F%A9%E9%98%B5.md)。

## 🔧 协议解码器

### 支持的协议

- **I2C**: 地址、数据解码和错误检测
- **SPI**: 支持多种模式，可配置位序
- **UART**: 波特率自动检测，奇偶校验支持
- **CAN / LIN / I2S**: 已有 TypeScript 解码器和 golden 测试入口，仍需更多真实采样样本扩充
- **更多协议**: USB、JTAG/SWD 等仍为 pending 或外部工具过渡能力

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

### 添加新硬件支持

1. 继承 `AnalyzerDriverBase` 基类
2. 实现必要的硬件接口方法
3. 添加设备识别信息
4. 编写单元测试
5. 更新文档

详细开发指南请参考 [开发者文档](docs/developer-guide.md)。

## 📊 性能指标

以下为目标指标或历史规划指标，当前发布说明只能引用已运行门禁和 smoke 结果：

- **启动时间目标**: < 2秒
- **波形渲染目标**: 60fps @ 100万数据点
- **内存目标**: 长时间运行无明显泄漏
- **多设备同步目标**: 多设备同步能力仍为 experimental，真实设备记录 pending

## 🧪 测试覆盖

- **测试目录**: 当前包含单元、集成、性能、压力和端到端测试目录。
- **迁移状态**: CI 覆盖的旧 `utest/mocks` 引用已迁移到 `tests/fixtures/mocks`；旧 `docs/utest/*` 仅作为历史资料。
- **当前风险**: 全量 `rtk npm run test:unit` 曾长时间无输出，发布证据应优先使用 `rtk npm run test:ci:quick|standard|full` 分层命令；Full 层仍依赖 `--forceExit` 收口部分长耗时测试。
- **发布门槛**: `rtk npm run validate:local`、分层测试、`rtk npm run build:production`、`rtk npm run package:dry` 和 VSIX smoke test 均通过后，才可重新声明覆盖率和发布状态。

## 📈 版本历史

本节条目只表示代码框架、fixture 或 Beta 层面的工程状态，不表示正式发布或真实设备通过。

### v1.0.0 (计划中，未达到发布门槛)
- ✅ 基础硬件抽象层
- ✅ 核心协议解码器 (I2C/SPI/UART)
- ✅ Vue3 现代化界面
- 🔄 类型错误清零
- 🔄 测试迁移和稳定性收口
- 🔄 发布检查和真实设备回归验证

### v1.0.0-beta.0 (当前)
- ✅ VSCode 扩展、Vue3 Webview、驱动抽象和基础解码器框架已建立
- 🔄 strict gate、CI 和本地质量门禁恢复中
- 🔄 文档与源码状态同步中
- 🔄 真实设备记录为 pending，等待补充 fixture 之外的可追溯证据

## 🤝 贡献指南

我们欢迎各种形式的贡献：

### 报告问题
在 [Issues](https://github.com/pico-logicanalyzer/vscode-logic-analyzer/issues) 页面报告 bug 或请求新功能。

### 提交代码
1. Fork 本仓库
2. 创建功能分支 (`rtk git checkout -b feature/amazing-feature`)
3. 提交更改 (`rtk git commit -m 'Add amazing feature'`)
4. 推送到分支 (`rtk git push origin feature/amazing-feature`)
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
