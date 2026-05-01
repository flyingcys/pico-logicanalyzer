## VSIX 发布 smoke 记录

- 记录生成时间：2026-04-30T13:25:25.399Z
- 分支：codex/2026-04-30-next-work
- commit：b11f7249（b11f7249807fa4ad894b8e9815cb223fcbb28b0a）
- 工作区状态：有未提交变更，详见本记录生成时的 git status
- VSIX：vscode-logic-analyzer-1.0.0-beta.0.vsix
- VSIX 大小：0.75 MiB
- VSIX sha256：4011c220d29394892ab3b2684fac0ab07f8d4bab6bfc7e9953fe29689989b384
- 平台：Linux 6.8.0-101-generic linux/x64
- Node.js：v22.20.0
- npm：10.9.3
- VSCode CLI：1.117.0
- 最小 .lac fixture：tests/fixtures/lac/current-lowercase-samples.lac
- 干净用户数据目录：.worktree/release-smoke/user-data
- 扩展目录：.worktree/release-smoke/extensions
- smoke 工作区：.worktree/release-smoke/workspace

### 执行命令

| 命令 | 状态 | 备注 |
| --- | --- | --- |
| `npm run package:dry` | 已通过 | `vsce ls --no-dependencies --no-yarn` 输出 31 个 VSIX 清单条目；该命令不生成可安装 VSIX，也不能替代 GUI smoke |
| `npm run package` | 已通过 | 生成正式 VSIX；不同于 `npm run package:dry`；`vsce package` 再次执行了 `vscode:prepublish` |
| `node scripts/release-smoke-record.js --out docs/release-smoke/<date>-vsix-smoke.md` | 已执行或待执行 | 生成本记录模板 |
| `code --user-data-dir .worktree/release-smoke/user-data --extensions-dir .worktree/release-smoke/extensions --install-extension <vsix>` | pending | 需要真实 VSCode CLI/桌面环境 |
| `code --user-data-dir .worktree/release-smoke/user-data --extensions-dir .worktree/release-smoke/extensions <fixture>` | pending | 需要人工确认 Custom Editor 和 Webview |
| `code --user-data-dir .worktree/release-smoke/user-data --extensions-dir .worktree/release-smoke/extensions --uninstall-extension logic-analyzer-team.vscode-logic-analyzer` | pending | 卸载后检查扩展目录和临时工作区 |

### 自动可验证项

| 项目 | 状态 | 证据 |
| --- | --- | --- |
| commit 可解析 | 通过 | b11f7249807fa4ad894b8e9815cb223fcbb28b0a |
| VSIX 文件存在 | 通过 | vscode-logic-analyzer-1.0.0-beta.0.vsix |
| VSIX sha256 可计算 | 通过 | 4011c220d29394892ab3b2684fac0ab07f8d4bab6bfc7e9953fe29689989b384 |
| Node/npm/平台信息可记录 | 通过 | v22.20.0 / npm 10.9.3 / linux/x64 |
| 最小 .lac fixture 存在 | 通过 | tests/fixtures/lac/current-lowercase-samples.lac |

| smoke 项 | 状态 | 证据 / 截图 | 备注 |
| --- | --- | --- | --- |
| 运行 `npm run package` 生成 VSIX | 已通过 | vscode-logic-analyzer-1.0.0-beta.0.vsix，783457 bytes，sha256 4011c220d29394892ab3b2684fac0ab07f8d4bab6bfc7e9953fe29689989b384 | 终端输出：Packaged 31 files, 765.09KB；同时出现 LICENSE 缺失 warning |
| 干净 VSCode 用户数据目录安装 VSIX | pending | 截图：待填写 | 需要桌面 VSCode 环境 |
| 打开最小 `.lac` 文件 | pending | 截图：待填写 | 使用上方 fixture |
| 无设备环境执行 `Logic Analyzer: Connect Device` | pending | 截图：待填写 | 期望明确错误且不卡死 |
| 执行 `Logic Analyzer: Create Synthetic Capture` | pending | 截图：待填写 | 记录成功或失败路径的可见反馈 |
| 卸载 VSIX 并检查残留 | pending | 截图 / 命令输出：待填写 | 确认无临时工作区文件残留 |

结论：pending。GUI smoke 尚未完成时不得改写为通过。
