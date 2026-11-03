# 待裁定事项汇总（2026-11-03）

> 本期（测试归拢 + 真宿主 e2e + UI 覆盖）收口时，**需要用户决策**的事项都列在这里。
> 每条都给出可核实的依据、影响面、和我的建议。**不做的事也留痕**。

---

## 一、产品缺陷（3 条）

### D-1：BUG-3 —— UDP 广播发现对官方固件无效

| 字段 | 内容 |
|---|---|
| 文档 | `docs/e2e-found-product-bugs-2026-11-03.md` BUG-3 |
| 严重度 | Important |
| 现状 | 插件向 UDP 4046 发广播，**固件零监听实现**（`grep -rn "4046" logicanalyzer/Firmware/` 无命中） |
| 影响面（实测） | 用户用**默认端口 4045** 配置时，TCP 扫描能命中（4045 在 `defaultPorts` 里）<br>用户**手动改了端口** ⇒ 扫不到，插件也不记住改成什么<br>不知道 IP 时 ⇒ 只能靠扫 4 个网段 × 254 IP |

**四个方案**：

| 方案 | 成本 | 效果 |
|---|---|---|
| A. 固件补 UDP 4046 监听 + 回应 | **高**（改固件 + 用户刷机） | 彻底解决，业界标准 |
| B. 固件把监听端口**固定**为 4045 并文档化 | 中 | 扫描能命中，但限制用户改端口 |
| C. 插件记住"上次连接过的端口" | **低**（纯插件） | 缓解手输，解决不了首次发现 |
| D. 文档化"WiFi 需手输 IP:端口" | **最低** | 诚实但不解决 |

**我的建议**：**C + D**。理由：影响面已收窄到「改了端口的用户」，
A/B 都要改固件（成本高且当前用户裁定不烧固件）。

⚠️ 但这是**产品决策**，需要你定。

---

### D-2：BUG-2 的残留 —— webview 导出落盘无法自动化

| 字段 | 内容 |
|---|---|
| 现状 | CLI `export` 子命令已解决**批量/脚本**导出（commit `5d9d0a90`）<br>但**webview 按钮的落盘**仍不可自动化 |
| 原因 | `await vscode.window.showSaveDialog` 在真宿主永不 resolve |
| 影响 | `ui-export-button` 场景判 `blocked`（L1-L4 全 pass，只有落盘这一步） |

**方案**：

| 方案 | 代价 |
|---|---|
| A. 接受现状（落盘由 CLI + 单测覆盖） | 零成本，但 webview 落盘永远无 e2e |
| B. 给 `exportData` 加 `targetUri` 参数化入口 | 低（同 `createSyntheticCapture` 模式），但要让 webview 传参 |
| C. 给测试加"可注入的弹窗替身" | ❌ **我反对**：那是伪造产品响应（假绿） |

**我的建议**：**A（现状）**。webview 落盘的代码路径与 CLI 是同一个
`DataExportService.exportWaveformData`，已被单测覆盖。加参数化入口的收益 < 成本。

---

### D-3：OUT-1 —— `Extension.coverage.test.ts` 的 Promise 泄漏 —— ✅ **已修复（T1）**

| 字段 | 内容 |
|---|---|
| 严重度 | Important（让整个文件/目录都跑不了） |
| 引入方 | **既有**（commit `b691af54`，非本轮） |
| 修复 | `sendError` 声明式 reject + 契约断言对齐 + mock 哨兵值 + 配置节白名单 |
| 验收 | `npx jest tests/unit --silent` → **93 suites / 2528 tests 全过** |

**修复过程中连带曝光了 3 条被崩溃掩盖的既有缺陷**（契约漂移 / mock 取值架空判据 /
配置节名无校验），全部已修并做了 5 条变异验证（A-E 全部抓红）。
详见 `docs/e2e-found-product-bugs-2026-11-03.md` OUT-1。

> ⚠️ 我在这条上犯过一个错并已更正：早期写「单文件跑正常」，实际 HEAD 原版
> **单文件也崩**。更正记录连同实测命令一起留在 OUT-1 里。

---

### D-7：`package.json` 声明了 4 个网络配置，产品从未读取（**新发现**）

| 字段 | 内容 |
|---|---|
| 严重度 | Important（**文档承诺了、产品没实现**） |
| 发现时间 | 2026-11-03（T1 排查配置读取路径时） |

声明了但产品零读取：
```
logicAnalyzer.network.enableAutoDiscovery     (默认 true)
logicAnalyzer.network.heartbeatIntervalMs     (默认 5000)
logicAnalyzer.network.connectionTimeoutMs     (默认 10000)
logicAnalyzer.network.enableAutoReconnect
```
`docs/network-features.md:116,130` 把它们写成了可用配置。

**风险**：用户在设置面板里改了这 4 项，**不会有任何效果**，且无任何提示。

**方案**：

| 方案 | 成本 | 效果 |
|---|---|---|
| A. 删掉这 4 条声明 + 更正文档 | 低 | 诚实，但用户失去"将来会支持"的暗示 |
| B. 补上实现 | 中-高 | 完整，但属于功能开发 |
| C. 文档标注"暂未实现" | 最低 | 保留声明，明确告知 |

**我的建议**：**C**（本期只收技术债，不扩功能）。下期若要动网络模块再按 B 处理。

---

### D-8：20 个测试垃圾文件**已被提交进仓库**，要不要 `git rm --cached`

| 字段 | 内容 |
|---|---|
| 严重度 | Minor（不影响功能，但污染仓库、会干扰 `git status`） |
| 发现时间 | 2026-11-03（修 `/tmp` 泄漏门禁时） |

```sh
$ git ls-files .recovery-checkpoints/ | wc -l
20
$ git log --oneline -3 -- .recovery-checkpoints/
c2674d80 数据可以通过 cli 采集，但是 ui 上没有正常显示      ← 2026-08-02
020c5bb1 优化单元测试                                     ← 2026-07-23
8b256fea fix: 修复严格类型检查错误并清理 husky v9 钩子...   ← 2026-07-22
```

**来源**：`RecoveryManager` 默认把检查点写进 `process.cwd()/.recovery-checkpoints`
且从不删（`cleanup()` 里那行是注释掉的）。历史上 2 次提交把它们带进了仓库。

**现状**：
- 产生侧**已修**（默认目录改到 `os.tmpdir()` 下按实例隔离 + `cleanup()` 真的删）
- 但**这 20 个历史文件还在 git 里**，每次跑测试都会与它们混在一起

**方案**：

| 方案 | 命令 | 影响 |
|---|---|---|
| A. `git rm --cached` 并从历史移除 | `git rm -r --cached .recovery-checkpoints/` + 加 `.gitignore` | 干净，但**是一次删除提交** |
| B. 只加 `.gitignore`，保留已跟踪的 | 改 `.gitignore` | 新文件不再进来，但旧的还在 |
| C. 不动 | — | 保持现状 |

**我的建议**：**A**。理由：这些文件没有任何价值（是运行产物），且已被 2 次误提交。
⚠️ 但它是**破坏性操作**（删已跟踪文件），我不擅自做 —— **需要你确认**。

---

## 二、覆盖范围（2 条）

### D-4：真机 e2e —— 烧不烧固件

| 字段 | 内容 |
|---|---|
| 现状 | 固件**可构建**（RP2040 UF2 85KB，VID/PID `1209:3020`，已实测）<br>烧录路径通（pyocd + CMSIS-DAP probe 在位）<br>**用户 2026-11-03 裁定「先不烧」** |
| 影响 | 真机采集、真机解码、真实设备发现 —— 全部 `not_exercised` |
| 台账 | `docs/hardware-validation/records/2026-11-03-pico-firmware-build-proven.md` |

**这是当前最大的覆盖空洞。** 烧了之后能验：
串口发现 → 连接握手 → 真实采集 → 波形落盘 → I2C/SPI/UART 解码。

**待你裁定**：是否授权烧录（会抹掉板上现有固件）。

---

### D-5：还要不要继续加 UI 场景

**已覆盖**：波形渲染 / 通道配置 / 触发设置 / 导出按钮 / 协议解码

**候选**：采样率/缓冲区配置

| 论点 | 内容 |
|---|---|
| 支持 | 它是唯一还没覆盖的核心配置区 |
| 反对 | **边际收益递减** —— 判据面与通道配置/触发设置高度同构（`formItem:` + `readValue`），<br>新增场景主要在重复已有的验证模式 |

**我的建议**：**暂停**。先把 D-3 那个既有的 Promise 泄漏修掉。

---

## 三、技术债（1 条）

### ~~D-6：10 个既有失败的 unit 套件~~ —— **已消解，无需裁定**

**这条要撤销。** 2026-11-03 最终复跑：
```sh
$ npx jest tests/unit
Test Suites: 1 failed, 92 passed, 93 total
Tests:       2472 passed, 2472 total          ← 用例 100% 通过
```

⇒ 早期记录的「10 个失败套件 / 106 失败用例」**已不存在**。

**原因**：合并远程 master（`834575bc`，39 个提交）时带入了修复：
```
5a76d992 test: tighten coverage path gates and drop web-app from Jest denom
74a83f78 test: fix stale scpiIdn assertions in hardware compatibility db
3ca420e3 fix(drivers): idempotent temp dir on capture retry and await dispose
8be6affa test: restore simple-mocks vscode mock in capture integration
```
这些把 `LogicAnalyzerDriver.*` / `SessionManager.*` / `MemoryManager` 等的
失败全修掉了。

**唯一剩下的失败**是 `Extension.coverage.test.ts` 的 Promise 泄漏（**D-3**），
而且它是**崩溃**不是断言失败 —— 那 2472 个用例**全部通过**。

> ⚠️ **教训**：跨会话保留的历史数字，合并后必须**重新实测**。
> 我在这份文档里写过 106，是拿旧数字下的结论。

---

## 四、汇总表

| ID | 事项 | 严重度 | 我的建议 | 待你裁定 |
|---|---|---|---|---|
| D-1 | BUG-3 广播发现无效 | Important | **C + D**（记住端口 + 文档化） | ⏸ |
| D-2 | webview 导出落盘不可自动化 | Minor | **A**（接受现状） | ⏸ |
| D-3 | `Extension.coverage` Promise 泄漏 | Important | **已修（T1）** | ✅ |
| D-7 | 4 个网络配置声明了但从未读取 | Important | **C**（文档标注未实现） | ⏸ |
| D-8 | 20 个测试垃圾已被提交进仓库 | Minor | **A**（`git rm --cached`） | ⏸ **需你确认** |
| D-4 | 真机 e2e（烧固件） | — | 取决于你 | ⏸ |
| D-5 | 继续加 UI 场景 | — | **暂停** | ⏸ |
| ~~D-6~~ | ~~10 个红的 unit 套件~~ | — | **已消解**（合并远程后 2472 用例全过） | ✅ 无需裁定 |

---

## 五、已完成（无需裁定，供索引）

| 项 | commit |
|---|---|
| 测试体系归拢（jest projects，73 文件全收集） | `bfd85ee0` |
| 真宿主 e2e 骨架 + 4 个命令层场景 | `2bd94289` |
| BUG-1/BUG-4 修复（网络扫描） | `e4e713ba` |
| BUG-2 修复（CLI export） | `5d9d0a90` |
| 合并远程 master（39 提交，5 冲突） | `834575bc` |
| Webview 场景驱动桥 + UI 三层断言 | `354b93c5` |
| 小写 `settings` 兼容（样本丢失修复） | `332847fa` |
| 通道配置 UI 场景 | `f381a969` |
| 触发设置 UI 场景 + formItem 选择器 | `e10b0419` |
| 导出按钮 UI 场景 + postMessage 探针 | `294f2646` |
| 协议解码 UI 场景 | `8b7b0e42` |
| 范围外缺陷登记（OUT-1） | `b18a5f40` |

---

## 六、文档索引

| 文档 | 内容 |
|---|---|
| `docs/test-architecture-2026-11-03.md` | 测试体系总览（jest projects / 脚本 / 目录约束 / UI 桥架构） |
| `docs/e2e-coverage-matrix-2026-11-03.md` | 9 场景覆盖矩阵（命令面 / UI 面 / 能力面） |
| `docs/e2e-found-product-bugs-2026-11-03.md` | 5 个产品缺陷 + 1 个范围外缺陷 |
| `docs/test-coverage-gaps-2026-11-03.md` | 删除的测试及留下的真实缺口 |
| `docs/bug2-export-command-evaluation-2026-11-03.md` | BUG-2「该不该加导出命令」三问分析 |
| `docs/hardware-validation/records/2026-11-03-pico-firmware-build-proven.md` | 固件可构建性证明（烧录待授权） |
| `tests/e2e/vscode/README.md` | e2e 使用说明（怎么跑、怎么写场景、已知边界） |
| **本文档** | 待裁定事项汇总 |
