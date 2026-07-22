# driver-sdk 定位与测试策略

> 日期：2026-07-22 ｜ 数据源：`coverage/coverage-summary.json`（1972 用例 / 0 失败）+ GitNexus 调用图 + grep 静态依赖
> 关联文档：`docs/单元测试覆盖率分析-2026-07-22.md`、`docs/driver-sdk/DEVELOPER_GUIDE.md`、`docs/覆盖率门禁配置建议.md`

---

## 一、driver-sdk 覆盖现状（逐文件）

`src/driver-sdk/**/*.ts` 整体：**行 8.53% ｜ 分支 3.54% ｜ 函数 6.37% ｜ LOC 2531**。是全仓最大覆盖缺口（见 `单元测试覆盖率分析` 第五节）。

| 子目录 | 文件 | LOC | 行覆盖 | 分支 | 函数 |
|--------|------|----:|-------:|-----:|-----:|
| (根) | `index.ts` | 33 | 0% | 0% | 0% |
| utils | `DriverUtils.ts` | 188 | **55.31%** | 30.23% | 55.55% |
| tools | `DriverTester.ts` | 167 | 26.34% | 25.00% | 33.33% |
| tools | `DriverValidator.ts` | 129 | 0.77% | 0% | 0% |
| tools | `HardwareCapabilityBuilder.ts` | 327 | 0% | 0% | 0% |
| tools | `ProtocolHelper.ts` | 279 | 4.65% | 1.68% | 6.55% |
| testing | `TestFramework.ts` | 218 | 0% | 0% | 0% |
| testing | `AutomatedTestRunner.ts` | 194 | 0% | 0% | 0% |
| templates | `GenericDriverTemplate.ts` | 282 | 0% | 0% | 0% |
| templates | `NetworkDriverTemplate.ts` | 277 | 11.91% | 4.49% | 5.76% |
| templates | `SerialDriverTemplate.ts` | 245 | 0% | 0% | 0% |
| examples | `ExampleNetworkDriver.ts` | 107 | 19.62% | 9.52% | 10.71% |
| examples | `ExampleSerialDriver.ts` | 85 | 0% | 0% | 0% |

现有 driver-sdk 相关测试仅 4 个（均在 `tests/unit/driver-sdk/`）：
- `DriverUtils.release-docs.test.ts`
- `DriverTester.resource.test.ts`
- `ProtocolHelper.resource.test.ts`
- `ExampleNetworkDriver.resource.test.ts`

---

## 二、覆盖构成分析（按文件性质分组）

| 分组 | 文件数 | LOC | 行覆盖（加权） | 性质 | 测试价值 |
|------|------:|----:|-------------:|------|---------|
| **templates** | 3 | 804 | **4.10%** | 代码生成/脚手架模板，大量占位实现 | 低（用快照/产物校验） |
| **examples** | 2 | 192 | 10.94% | 示例驱动，本身是"被测对象" | 低（编译 + smoke） |
| **testing** | 2 | 412 | **0%** | SDK 自带测试框架（TestFramework/AutomatedTestRunner） | 低（工具，间接验证） |
| **tools** | 4 | 902 | 6.43% | ProtocolHelper / HardwareCapabilityBuilder / DriverValidator / DriverTester | **中-高（公共 API）** |
| **utils** | 1 | 188 | **55.31%** | DriverUtils：createDriverPackage / generate* 系列 | 中（已有部分测试） |
| (根) index | 1 | 33 | 0% | 纯 re-export 聚合 | 无（导出表） |

**关键观察**：除 `utils/DriverUtils.ts`（55%）外，其余 12 个文件均低于 27%；7 个文件为 0%。低覆盖高度集中在 **templates（804L）+ testing（412L）= 1216L**，占 driver-sdk 总量的 **48%**——而这两类恰恰是单测 ROI 最低的代码生成模板和测试工具自身。

---

## 三、运行时地位：driver-sdk 是否被插件用到

这是判断"该不该补"的前提。用 GitNexus 调用图 + grep 静态依赖交叉验证：

### 证据 1：插件运行时零引用 driver-sdk

```bash
grep -rn "driver-sdk" src/ --include="*.ts"   # 排除 src/driver-sdk/ 自身后
# 结果：0 条匹配
```

`src/` 下**没有任何源文件 import `driver-sdk`**。插件激活、命令注册、采集、解码、导出、UI 全链路都不依赖它。

### 证据 2：真实驱动直接继承基类，不经 SDK

6 个真实驱动全部直接 import `../AnalyzerDriverBase`，而非通过 driver-sdk：

| 真实驱动 | 继承路径 |
|----------|---------|
| `LogicAnalyzerDriver` | `import { AnalyzerDriverBase } from './AnalyzerDriverBase'` |
| `SaleaeLogicDriver` | 同上（直接） |
| `RigolSiglentDriver` | 同上（直接） |
| `NetworkLogicAnalyzerDriver` | 同上（直接） |
| `MultiAnalyzerDriver` | 同上（直接） |
| `SigrokAdapter` | 同上（直接） |

driver-sdk 的 `index.ts` 虽然 `re-export { AnalyzerDriverBase }`，但运行时驱动并不走这条路径——它们用的是 `src/drivers/AnalyzerDriverBase.ts` 的原生导出。

### 证据 3：GitNexus 调用图——所有 tools 的消费者都在 SDK 内部

对 4 个 tools + DriverUtils 查 `context`（incoming callers）：

| 符号 | 外部运行时调用者 | 调用者位置 | 参与执行流 |
|------|----------------|-----------|-----------|
| `DriverValidator` | 0 | 仅 `TestFramework`、`DriverUtils`（SDK 内部） | `processes: []` |
| `ProtocolHelper` | 0 | 仅 `index.ts`、`Serial/NetworkDriverTemplate`、1 个测试 | `processes: []` |
| `HardwareCapabilityBuilder` | 0 | 仅 `index.ts`、`DriverUtils`（SDK 内部） | `processes: []` |
| `DriverTester` | 0 | 仅 SDK 内部 + 测试 | `processes: []` |
| `DriverUtils` | 0 | 仅 `index.ts` + 1 个测试 | `processes: []` |

**`processes: []`** 意味着这些符号不参与 GitNexus 索引出的任何 300 条执行流——它们是"外向 API 表面"，不是运行时路径。

### 结论：文档宣称 vs 实际运行的落差

| 维度 | 文档宣称（`DEVELOPER_GUIDE.md` / `index.ts`） | 实际（调用图 + grep） |
|------|---------------------------------------------|---------------------|
| 定位 | "为第三方开发者提供完整的驱动开发支持" | 外向 SDK 表面，无运行时消费者 |
| 分发 | `npm install @pico-logicanalyzer/driver-sdk` | 未见独立 npm 包发布迹象，源码内联在主仓 |
| 消费 | 第三方驱动继承/调用 | 主仓 6 个驱动全部绕过 SDK，直连基类 |

---

## 四、两种产品定位下的测试策略

driver-sdk 该不该补覆盖，取决于产品定位决策。两者无法从代码自动推断，需产品负责人拍板。下面给出两种定位下的对应策略。

### 定位 A：driver-sdk 是面向第三方驱动开发者的战略功能

即文档宣称的形态——会作为独立 `@pico-logicanalyzer/driver-sdk` 包发布，支撑外部驱动生态。

**策略：补 tools 公共 API 单测，templates/examples/testing 用替代方式**

- **目标覆盖率**（限定 driver-sdk 内部 glob）：
  - `src/driver-sdk/tools/**/*.ts` → **行 70%**（当前 6.4%，公共 API 必须可靠）
  - `src/driver-sdk/utils/DriverUtils.ts` → **行 80%**（当前 55%，脚手架入口）
  - `src/driver-sdk/templates/**` + `examples/**` + `testing/**` → **不设行覆盖硬指标**，改用产物校验（见第六节）
- **必补文件**（见第五节优先级清单）：DriverValidator、ProtocolHelper、DriverTester、HardwareCapabilityBuilder、DriverUtils
- **额外要求**：发布前对 `index.ts` 导出表面做 API 契约测试（防止 breaking change），并补一个"用 SDK 端到端生成一个最小驱动包"的集成测试

### 定位 B：driver-sdk 仅是内部脚手架

即代码实际呈现的形态——无外部消费者，仅供主仓内部/未来自己参考。

**策略：维持现状 + 少量集成测试，不追求 driver-sdk 覆盖率**

- **不设** driver-sdk 覆盖率门禁（避免逼迫给模板/示例刷无意义单测）
- 仅保留并维护现有 4 个 `*.resource.test.ts`，防止公共 API 类型/形状漂移
- 补 1 个集成测试：`DriverUtils.createDriverPackage()` 生成包结构 + 可编译性校验（这是脚手架唯一有运行时价值的入口）
- templates/examples/testing 维持 0% 可接受——它们是文档性代码

### 推荐

在产品定位明确为 A（并确有独立发包计划）之前，**按定位 B 执行**更符合实际运行时地位，避免在零消费者的 API 表面上过度投入。若未来启动第三方驱动计划，再切换到定位 A，按第五节清单补测。

---

## 五、若决定补测的优先级清单（定位 A 适用）

| 优先级 | 文件 | 当前行覆盖 | 理由 | 预估难度 |
|------:|------|----------:|------|---------|
| **P0** | `tools/DriverValidator.ts` | 0.8% | 公共 API；被 `DriverUtils.validateDriverImplementation`（发布检查流程）引用；规则校验逻辑纯、无 IO，极易测 | 低 |
| **P0** | `tools/ProtocolHelper.ts` | 4.7% | 公共 API；纯计算（协议配置创建/校验/检测/模板生成）；已有 1 个 resource 测试可扩展 | 低 |
| **P1** | `utils/DriverUtils.ts` | 55.3% | 脚手架核心入口（createDriverPackage / generate* 系列）；已有 release-docs 测试，补齐 generate* 分支即可上 80% | 中 |
| **P1** | `tools/DriverTester.ts` | 26.3% | 公共 API；已有 resource 测试，补 `runAllTests` 各分支（连接/采集/状态/断开） | 中 |
| **P2** | `tools/HardwareCapabilityBuilder.ts` | 0% | 公共 API，纯 builder 链式调用；逻辑简单但 327L 量大，测试枯燥 | 中（量大） |
| P3 | `templates/*` | 0–12% | 代码生成模板，**不建议单测**，用第六节快照/产物校验 | — |
| P3 | `examples/*` | 0–20% | 示例，**不建议单测**，用编译 + mock smoke | — |
| P3 | `testing/*` | 0% | 测试工具自身，由使用它的驱动间接验证 | — |

---

## 六、templates / examples / testing 的替代验证方式

这三类（合计 1408L，占 driver-sdk 56%）单测 ROI 极低，但可用更轻的方式保证不退化：

### 1. 快照测试（首选，针对 templates 与 DriverUtils.generate*）

`DriverUtils.createDriverPackage()` / `generateDriverClass()` / `generateReadme()` / `generateTestFile()` 等本质是**代码生成器**。对固定输入做快照：

```typescript
// tests/unit/driver-sdk/createDriverPackage.snapshot.test.ts
it('serial 驱动包生成产物稳定', async () => {
  const pkg = await DriverUtils.createDriverPackage('my-la', tmpDir, {
    driverType: 'serial', includeTests: true, /* ... */
  });
  expect(pkg.generatedFiles).toMatchInlineSnapshot(); // 产物清单快照
  expect(fs.readFileSync(`${tmpDir}/src/MyLaDriver.ts`,'utf8'))
    .toMatchSnapshot(); // 模板内容快照
});
```

一次快照即可覆盖 Generic/Serial/Network 三个模板（804L）的回归防护，远比逐方法单测高效。模板漂移时快照失败，人工 review 后更新。

### 2. 生成产物可编译性校验（针对 templates）

对 `createDriverPackage` 生成的 `.ts` 文件跑 `tsc --noEmit`，确保模板产出的代码可编译、类型正确。可放在独立 npm script，不必进 Jest。

### 3. examples：编译 + mock smoke

examples 依赖真实连接（serial/network），单测价值低。改为：
- **编译期**：`tsc --noEmit` 确保示例类型正确（`tsd` 或 `tsc` 均可）
- **运行期 smoke**：用 mock 连接跑一次 `connect → getStatus → disconnect` 最小路径，验证示例可实例化、不抛同步异常

### 4. testing（TestFramework / AutomatedTestRunner）：间接验证

这是"测试框架的测试框架"。最务实的方式是**用一个最小 fixture 驱动跑通 TestFramework 的 runValidation/runAllTests**，作为 driver-sdk 自身的集成测试——既验证了 testing 模块，又验证了 tools 模块。

### 5. API 表面契约（定位 A 必备）

对 `index.ts` 的所有导出做契约测试，确保不在 minor 版本里删/改公共符号。可用 `tsd` 或自写 `Object.keys(SDK)` 断言导出键集合。

---

## 七、小结

1. driver-sdk 行覆盖 8.53%，是全仓最大缺口，但**低覆盖集中在 templates/testing（48% 体量）这类低 ROI 代码**。
2. 运行时地位明确：**src/ 零引用、6 真实驱动直连基类、所有 tools 的 `processes: []`**——driver-sdk 当前是"外向 API 表面"，不是运行时路径。
3. 文档宣称（第三方战略 SDK）与实际（内部脚手架）存在落差，需产品决策。
4. **推荐**：在独立发包计划落地前按"定位 B"执行——不设 driver-sdk 覆盖门禁，补 1 个 createDriverPackage 集成测试 + 保留现有 resource 测试；templates/examples 改用快照与编译校验。
5. 若定位 A 启动，按第五节 P0→P2 清单补 tools 公共 API 单测，目标 tools 行 70% / utils 80%。

下一步门禁配置见 `docs/覆盖率门禁配置建议.md`。
