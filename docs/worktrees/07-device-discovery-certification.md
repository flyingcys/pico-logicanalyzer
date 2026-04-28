# Worktree 07：设备发现和硬件认证矩阵

## 当前基线

来源：`docs/parallel-worktrees-2026-04-28.md` 中 07 拆分。

- 目标：统一 Pico、网络、Saleae、Rigol/Siglent、sigrok 的发现口径和认证记录。
- 范围内：设备发现、驱动注册、硬件能力描述、认证脚本、认证矩阵、设备数据库校验。
- 范围外：不改单个 Pico 采集协议；不做采集 UI。
- 启动时状态：`## parallel/07-device-discovery-certification`

## 范围内

- `src/drivers/HardwareDriverManager.ts`
- `src/services/WiFiDeviceDiscovery.ts`
- `package.json`
- `tests/unit/drivers/HardwareDriverManager.business.test.ts`
- `tests/unit/services/WiFiDeviceDiscovery.comprehensive.test.ts`
- `docs/真实硬件认证矩阵.md`
- `docs/功能状态矩阵.md`
- `docs/network-features.md`

## 范围外

- Pico 串口/TCP 采集状态机、命令帧和二进制流读取。
- Webview 设备连接按钮、采集配置表单和 host bridge。
- Saleae、Rigol/Siglent、sigrok 的真实采集协议修复。

## 接口契约

`HardwareDriverManager.getDiscoveryProfiles()` 返回统一发现配置：

| id | 检测口径 | 认证口径 |
| --- | --- | --- |
| `pico-logic-analyzer` | USB VID/PID `1209/3020` | fixture 级别，仍需真实硬件记录 |
| `network-pico` | TCP `4045`，需要 Pico 版本握手 | experimental，端口开放不等于认证通过 |
| `saleae-logic` | Logic 2 API `10429` | framework，只代表适配框架可用 |
| `rigol-siglent-scpi` | SCPI `5555/5025/111` 与 `*IDN?` | framework，只代表检测口径可执行 |
| `sigrok-cli` | `sigrok-cli --scan` | framework，只代表外部工具链可检测 |

`NetworkDetector.getDefaultPorts()` 当前返回 `[4045, 10429, 5555, 5025, 111]`。`NetworkDetector.fromProbeResult()` 只在握手确认后把 Pico TCP 标为高置信设备；单纯端口开放只生成待验证候选。

`WiFiDeviceDiscovery` 和 VSCode 配置项 `logicAnalyzer.network.defaultPorts` 使用同一端口集合，避免服务默认值、文档和驱动检测口径漂移。

## 执行日志

- 阶段 1：梳理发现口径，确认原版 Pico LogicAnalyzer USB 精准 ID 为 `1209/3020`，普通 Raspberry Pi Pico `2E8A/0003` 只能作为待握手候选。
- 阶段 2：新增统一发现 profile，明确网络端口、握手方式、适配状态和认证等级。
- 阶段 3：补 `HardwareDriverManager.business.test.ts` 和 `WiFiDeviceDiscovery.comprehensive.test.ts`，覆盖发现 profile、网络端口集合、Pico TCP 握手与端口开放候选差异。
- 阶段 4：更新认证矩阵和功能状态文档，避免把 Saleae/SCPI/sigrok 框架描述成真实硬件认证通过。

## 验收结论

已通过：

- `npm exec -- jest tests/unit/drivers/HardwareDriverManager.business.test.ts --runInBand`
- `npm exec -- jest tests/unit/services/WiFiDeviceDiscovery.comprehensive.test.ts --runInBand --testNamePattern="应该提供正确的默认配置"`
- `npm run typecheck`
- `npm run db:validate`

仍有限制：

- 未连接真实 Pico W、Saleae、Rigol/Siglent 或 sigrok 设备。
- `NetworkDetector.detect()` 当前仍以端口探测为第一步，后续应把真实握手探测接入扫描循环。
- `npm run test:drivers -- --runInBand` 当前不是本 worktree 的干净验收信号：运行 19 个 driver 测试套件时仍有既有失败，包括 `AnalyzerDriverBase.comprehensive.test.ts` 的通道断言和 `HardwareDriverManager.comprehensive.test.ts` 的旧 mock/超时断言。本 worktree 新增和改动路径已由上面的定向测试覆盖。
- `db:validate` 会校验现有数据库完整性；命令输出显示“3 个问题, 0 个已修复”但仍返回通过，真实认证等级仍依赖人工记录追加。
