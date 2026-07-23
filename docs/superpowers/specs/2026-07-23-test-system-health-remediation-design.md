# 测试体系健康度治理设计

## 背景

当前测试体系已具备 Web 入口覆盖、LAC/I2C/SPI 关键路径门禁，以及基础 CI 执行点。但根 Jest 套件仍把单元、集成、压力测试混在同一匹配范围内；全仓覆盖率约为行 20%、分支 17%，不能代表关键业务可靠性。部分硬件适配、通道映射、资源清理和完整采集链路缺少可重复验证。

## 目标

1. 单元测试、集成测试、压力测试职责分离，默认门禁快速且稳定。
2. Web 应用与 VSCode 插件共享前端代码的两个入口均有自动化启动验证。
3. 覆盖率门禁只约束具备稳定测试的关键路径，并按模块逐步扩大范围。
4. 采集、保存、LAC 解析、解码、Provider 更新的主链路具备可重复集成测试。
5. 外部进程和异步资源清理失败路径具备确定性回归测试。

## 非目标

1. 不以降低全仓覆盖率阈值伪造质量提升。
2. 不要求 CI 连接真实硬件、真实 Sigrok CLI 或网络设备。
3. 不在本轮重构全部历史测试文件。

## 测试分层

| 层级 | 范围 | 运行方式 | 成功标准 |
| --- | --- | --- | --- |
| 单元 | 纯函数、Store、协议解码、驱动参数构造 | Jest，默认 CI | 无压力计时、无外部进程、稳定通过 |
| 组件 | Vue 组件和 HostAdapter 边界 | Jest/Vitest jsdom | 两入口均覆盖挂载、注入、失败反馈 |
| 集成 | Mock 驱动贯通采集到 Provider | Jest integration 项目 | 覆盖数据格式与消息合同 |
| 压力 | 大数据、内存、恢复和长时流处理 | 独立脚本或夜间 CI | 不阻塞 PR 单元门禁 |

## 门禁策略

1. `test:unit` 只匹配 `tests/unit/**`，不包含 `tests/stress/**`、`tests/performance/**`、`tests/e2e/**`。
2. `test:integration` 只匹配 `tests/integration/**`，作为 PR 的独立阶段。
3. 压力与性能测试保留独立命令；常规 PR 不运行 GB 数据负载。
4. Jest 覆盖率仅对稳定关键模块设路径阈值：LAC、I2C、SPI；每补齐一个模块的行为测试，才新增其路径阈值。
5. Vitest 对 `src/web-app/src/**` 采集覆盖率，并对 `main-web.ts` 保持 100% 门禁；VSCode 与 HTML 入口应有相应启动测试。

## 优先问题

### P0：测试执行模型

根 Jest 的 `testMatch` 需要分离单元、集成、压力范围。压力测试长时间运行和资源副作用不能影响覆盖率门禁的确定性。

### P0：共享入口合同

Web 已验证 `main-web.ts`。仍需为 `main-vscode.ts` 与 `main-html.ts` 建立真实入口测试，断言 App 创建、Host 注入、mount 和 `ready()`；三个入口复用同一断言模型。

### P1：关键业务空白

`ChannelMappingManager` 应测试必选通道、重复通道、越界、跨解码器冲突、坏导入与双向映射。`DecoderManager` 应测试停止、dispose 抛错和多个任务的最终清理。`SigrokAdapter` 应测试 spawn error、非零退出、重复 close/error 和临时文件清理。

### P1：主链路集成

现有硬件采集集成测试需替换为真实模块组合：Mock `LogicAnalyzerDriver` 产生样本，`LACFileFormat` 持久化并读取，`DecoderManager` 执行解码，`LACEditorProvider` 发布更新消息。断言样本、通道、解码结果和错误消息均不丢失。

## 验收标准

1. PR CI 中单元、集成、Web 覆盖率三项命令均独立执行。
2. 常规单元门禁不执行 `tests/stress/**`。
3. Web、HTML、VSCode 三个入口均有启动回归测试。
4. ChannelMapping、DecoderManager 清理、Sigrok 异常链各有行为测试。
5. 采集到 Provider 的集成测试不依赖真实硬件。
6. 所有新增门禁使用真实覆盖率报告验证，不依赖日志断言。
