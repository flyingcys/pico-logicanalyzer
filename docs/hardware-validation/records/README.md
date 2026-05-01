# 真实设备验证记录

本目录用于追加真实设备验证记录。当前只有 pending 模板和未执行记录，不代表任何 Pico、Pico W、Pico 2、Saleae、Rigol、Siglent 或 sigrok 设备已经通过。

## 当前状态

| 设备范围 | 状态 | 说明 |
| --- | --- | --- |
| Pico LogicAnalyzer / Pico / Pico W / Pico 2 | pending | 需要真实设备型号、固件版本、commit、采集配置、`.lac` 或导出文件 `sha256`、截图和日志。 |
| Saleae Logic 8 / Logic Pro 16 | pending | 需要 Logic 2 API 枚举、采集配置、转换结果、`sha256` 和截图。 |
| Rigol / Siglent 逻辑分析能力 | pending | 需要具体型号、`*IDN?`、采集配置、数据块解析结果、`sha256` 和截图。 |
| sigrok 支持设备 | pending | 需要 `rtk sigrok-cli --scan` 输出、设备连接串、采集结果、转换结果、`sha256` 和截图。 |

当前无设备环境记录：`2026-04-30-hardware-pending.md`。

## 记录命名

建议使用：

```text
YYYY-MM-DD-设备型号-能力.md
```

示例：

```text
2026-05-01-pico-logic-i2c-ui.md
```

## 记录模板

```markdown
# 真实设备验证记录：<设备型号> / <能力>

| 字段 | 内容 |
| --- | --- |
| 记录 ID | hardware-YYYYMMDD-短名称 |
| 日期 | YYYY-MM-DD |
| 状态 | pending / pass / fail / blocked |
| 操作系统 | 发行版和版本 |
| 设备型号 | 真实型号 |
| 序列号 | 可脱敏 |
| 固件版本 | 固件版本或握手返回版本 |
| 扩展版本 | VSIX 或 package 版本 |
| Git commit | 完整 commit |
| 命令或操作路径 | VSCode 命令、CLI 命令或测试脚本 |
| 采集配置 | sampleRateHz、preTriggerSamples、postTriggerSamples、channels、trigger、mode |
| 结果文件 | 路径、类型 |
| sha256 | 结果文件 sha256 |
| 截图或日志 | 路径 |
| 结论 | pending / pass / fail / blocked |
| 问题链接 | issue、PR 或任务链接 |

## 执行记录

- 待填写。

## 备注

- 待填写。
```

## 提升状态规则

- `pending`、`fail` 或 `blocked` 不能提升 [硬件证据矩阵](../../%E7%9C%9F%E5%AE%9E%E7%A1%AC%E4%BB%B6%E8%AE%A4%E8%AF%81%E7%9F%A9%E9%98%B5.md) 中的证据等级。
- `pass` 必须包含具体设备、固件版本、commit、采集配置、结果文件 `sha256`、截图或日志路径。
- 真实设备能力提升前必须同步更新硬件证据矩阵，并保持 README 只引用矩阵中已有证据的状态。
