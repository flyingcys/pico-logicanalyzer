# Decoder Parity Auto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以串行、可验证的方式修复当前仓库已有协议分析器的 P0 parity 缺口，并把修复结果固化到中文文档和测试中。

**Architecture:** 先补文档和最小公共底座，再按 `I2C -> SPI -> UART -> CAN -> LIN -> I2S -> Streaming I2C` 的顺序逐个协议修复。每个协议都由独立 subagent 实现，主线程负责场景约束、结果复核、回归验证和推进顺序控制。

**Tech Stack:** TypeScript、Jest、VSCode extension、decoder framework、git worktree

---

### Task 1: 文档与基线

**Files:**
- Modify: `docs/协议分析器现状与logicanalyzer对齐分析-2026-04-29.md`
- Create: `docs/superpowers/specs/2026-04-29-decoder-parity-auto-design.md`
- Create: `docs/superpowers/plans/2026-04-29-decoder-parity-auto.md`

- [ ] **Step 1: 写入执行策略与设计文档**

把串行顺序、subagent 约束、P0/P1/P2 边界写入文档与 spec。

- [ ] **Step 2: 验证文档已落盘**

Run: `rtk rg -n "本轮自动修复执行策略|I2C|Streaming I2C" docs/协议分析器现状与logicanalyzer对齐分析-2026-04-29.md docs/superpowers/specs/2026-04-29-decoder-parity-auto-design.md docs/superpowers/plans/2026-04-29-decoder-parity-auto.md`
Expected: 能看到执行策略和协议顺序。

### Task 2: I2C P0

**Files:**
- Modify: `src/decoders/protocols/I2CDecoder.ts`
- Modify: `src/decoders/DecoderRegistry.ts`
- Modify: `tests/unit/decoders/protocols/I2CDecoder.test.ts`
- Modify: `tests/unit/decoders/DecoderSigrokGolden.test.ts`
- Modify: `tests/unit/decoders/DecoderParityCore.test.ts`

- [ ] **Step 1: 写一个失败测试，覆盖 I2C 当前 P0 缺口**

优先覆盖以下之一：
- `bit` 注释缺失
- `Read/Write` 位注释缺失
- `registerAllDecoders()` 未注册常规 `i2c`
- `decode()` 通道顺序硬编码

- [ ] **Step 2: 运行定向测试并确认失败**

Run: `rtk npx jest --runInBand tests/unit/decoders/protocols/I2CDecoder.test.ts tests/unit/decoders/DecoderParityCore.test.ts tests/unit/decoders/DecoderSigrokGolden.test.ts`
Expected: 新增用例 FAIL，且失败原因对应目标缺口。

- [ ] **Step 3: 做最小修复**

只修新增失败测试要求的最小行为，并保持现有通过用例不回退。

- [ ] **Step 4: 重新运行 I2C 定向测试**

Run: `rtk npx jest --runInBand tests/unit/decoders/protocols/I2CDecoder.test.ts tests/unit/decoders/DecoderParityCore.test.ts tests/unit/decoders/DecoderSigrokGolden.test.ts`
Expected: 全部 PASS。

### Task 3: SPI P0

**Files:**
- Modify: `src/decoders/protocols/SPIDecoder.ts`
- Modify: `tests/unit/decoders/protocols/SPIDecoder.test.ts`
- Modify: `tests/unit/decoders/DecoderParityCore.test.ts`
- Modify: `tests/unit/decoders/DecoderSigrokGolden.test.ts`

- [ ] **Step 1: 写一个失败测试，覆盖 SPI 当前 P0 缺口**

优先覆盖以下之一：
- decoder 实例复用导致选项泄漏
- `CLK` 缺失语义不对齐
- 当前 transfer/warning 输出边界错误

- [ ] **Step 2: 运行定向测试并确认失败**

Run: `rtk npx jest --runInBand tests/unit/decoders/protocols/SPIDecoder.test.ts tests/unit/decoders/DecoderParityCore.test.ts tests/unit/decoders/DecoderSigrokGolden.test.ts`
Expected: 新增用例 FAIL。

- [ ] **Step 3: 做最小修复**

- [ ] **Step 4: 重新运行 SPI 定向测试**

Run: `rtk npx jest --runInBand tests/unit/decoders/protocols/SPIDecoder.test.ts tests/unit/decoders/DecoderParityCore.test.ts tests/unit/decoders/DecoderSigrokGolden.test.ts`
Expected: 全部 PASS。

### Task 4: UART P0

**Files:**
- Modify: `src/decoders/protocols/UARTDecoder.ts`
- Modify: `src/decoders/DecoderRegistry.ts`
- Modify: `tests/unit/decoders/protocols/UARTDecoder.test.ts`
- Modify: `tests/unit/decoders/DecoderParityCore.test.ts`
- Modify: `tests/unit/decoders/DecoderSigrokGolden.test.ts`

- [ ] **Step 1: 写一个失败测试，覆盖 UART 当前 P0 缺口**

优先覆盖以下之一：
- `registerAllDecoders()` 未注册 `uart`
- packet 硬编码 16 字节行为
- `handleIdle()` / `handleFrame()` 未落地导致的可观测缺口

- [ ] **Step 2: 运行定向测试并确认失败**

Run: `rtk npx jest --runInBand tests/unit/decoders/protocols/UARTDecoder.test.ts tests/unit/decoders/DecoderParityCore.test.ts tests/unit/decoders/DecoderSigrokGolden.test.ts`
Expected: 新增用例 FAIL。

- [ ] **Step 3: 做最小修复**

- [ ] **Step 4: 重新运行 UART 定向测试**

Run: `rtk npx jest --runInBand tests/unit/decoders/protocols/UARTDecoder.test.ts tests/unit/decoders/DecoderParityCore.test.ts tests/unit/decoders/DecoderSigrokGolden.test.ts`
Expected: 全部 PASS。

### Task 5: CAN P0

**Files:**
- Modify: `src/decoders/protocols/CANDecoder.ts`
- Modify: `tests/unit/decoders/DecoderSigrokGolden.test.ts`

- [ ] **Step 1: 写一个失败测试，覆盖 CAN 当前 P0 缺口**

优先覆盖以下之一：
- 连续多帧只吃首帧
- 真实位流边界处理错误

- [ ] **Step 2: 运行定向测试并确认失败**

Run: `rtk npx jest --runInBand tests/unit/decoders/DecoderSigrokGolden.test.ts`
Expected: 新增用例 FAIL。

- [ ] **Step 3: 做最小修复**

- [ ] **Step 4: 重新运行 CAN 定向测试**

Run: `rtk npx jest --runInBand tests/unit/decoders/DecoderSigrokGolden.test.ts`
Expected: 相关 CAN 用例 PASS，现有 decoder golden 不回退。

### Task 6: LIN P0

**Files:**
- Modify: `src/decoders/protocols/LINDecoder.ts`
- Modify: `tests/unit/decoders/DecoderSigrokGolden.test.ts`

- [ ] **Step 1: 写一个失败测试，覆盖 LIN 当前 P0 缺口**

优先覆盖以下之一：
- header-only/无响应 场景不兼容
- `data_length` 强依赖导致错误

- [ ] **Step 2: 运行定向测试并确认失败**

Run: `rtk npx jest --runInBand tests/unit/decoders/DecoderSigrokGolden.test.ts`
Expected: 新增用例 FAIL。

- [ ] **Step 3: 做最小修复**

- [ ] **Step 4: 重新运行 LIN 定向测试**

Run: `rtk npx jest --runInBand tests/unit/decoders/DecoderSigrokGolden.test.ts`
Expected: 相关 LIN 用例 PASS。

### Task 7: I2S P0

**Files:**
- Modify: `src/decoders/protocols/I2SDecoder.ts`
- Modify: `tests/unit/decoders/DecoderSigrokGolden.test.ts`

- [ ] **Step 1: 写一个失败测试，覆盖 I2S 当前 P0 缺口**

优先覆盖以下之一：
- 32 位高位为 1 的值被解释为负数
- 首字同步行为错误
- annotation 类型/文案与当前约定不稳定

- [ ] **Step 2: 运行定向测试并确认失败**

Run: `rtk npx jest --runInBand tests/unit/decoders/DecoderSigrokGolden.test.ts`
Expected: 新增用例 FAIL。

- [ ] **Step 3: 做最小修复**

- [ ] **Step 4: 重新运行 I2S 定向测试**

Run: `rtk npx jest --runInBand tests/unit/decoders/DecoderSigrokGolden.test.ts`
Expected: 相关 I2S 用例 PASS。

### Task 8: Streaming I2C P0

**Files:**
- Modify: `src/decoders/DecoderManager.ts`
- Modify: `src/decoders/protocols/StreamingI2CDecoder.ts`
- Modify: `tests/unit/decoders/DecoderParityCore.test.ts`

- [ ] **Step 1: 写一个失败测试，覆盖 Streaming I2C 当前 P0 缺口**

优先覆盖以下之一：
- `i2c` 推荐 streaming 但不会命中 `streaming_i2c`
- 跨块状态行为在最小复现实例下错误

- [ ] **Step 2: 运行定向测试并确认失败**

Run: `rtk npx jest --runInBand tests/unit/decoders/DecoderParityCore.test.ts`
Expected: 新增用例 FAIL。

- [ ] **Step 3: 做最小修复**

- [ ] **Step 4: 重新运行 Streaming I2C 定向测试**

Run: `rtk npx jest --runInBand tests/unit/decoders/DecoderParityCore.test.ts`
Expected: 相关 streaming 用例 PASS。

### Task 9: 最终回归与文档收口

**Files:**
- Modify: `docs/协议分析器现状与logicanalyzer对齐分析-2026-04-29.md`

- [ ] **Step 1: 回写每个协议已关闭的缺口和剩余项**

- [ ] **Step 2: 运行 decoder 总回归**

Run: `rtk npx jest --runInBand tests/unit/decoders/protocols/I2CDecoder.test.ts tests/unit/decoders/protocols/SPIDecoder.test.ts tests/unit/decoders/protocols/UARTDecoder.test.ts tests/unit/decoders/DecoderParityCore.test.ts tests/unit/decoders/DecoderSigrokGolden.test.ts`
Expected: 全部 PASS。

- [ ] **Step 3: 运行 git 状态检查**

Run: `rtk git status --short`
Expected: 只出现本轮预期修改。
