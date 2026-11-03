# 真实设备验证记录：2026-11-03 固件可构建性已证明，烧录待授权

| 字段 | 内容 |
| --- | --- |
| 记录 ID | hardware-20261103-firmware-build-proven |
| 日期 | 2026-11-03 |
| 状态 | **blocked / 待授权写板**（不是 `not_exercised`，也不是 `fail`） |
| 结论 | 逻辑分析器固件在**本机现有工具链下可成功构建**出 RP2040 版 `.uf2`。**未烧录**，因为写板是不可逆外向操作，用户于 2026-11-03 裁定「先不烧」 |
| 硬件 | Raspberry Pi Pico（RP2040），USB `2e8a:0009`，serial `7170E4E18EE324D6`，`/dev/ttyACM6` |
| 另接设备 | `2e8a:000c` Debugprobe on Pico（CMSIS-DAP），serial `B080A63EF48BC6E2`，`/dev/ttyACM4` |
| 操作系统 | Linux 6.8.0-138-generic |
| Git commit | 见 `git log -1`（本记录落盘时的 HEAD） |

## 一、为什么这条记录必须存在

`docs/hardware-validation/records/2026-04-30-hardware-pending.md` 写的是「无设备环境」。
**那个结论在 2026-11-03 已部分过期**：设备在位，但跑的不是逻辑分析器固件。

按「不做出无痕」纪律：**「暂时不做」也要留证据**，否则后人会当成「没做过」而从头重来一遍，
或者反过来当成「做不了」而永久放弃。

## 二、已证明的事（可复现）

### 2.1 板上当前固件不是逻辑分析器

2026-11-03 按插件真实协议发 ID 请求（`OutputPacket` 无数据 → `55 AA 00 AA 55`，
见 `src/drivers/AnalyzerDriverBase.ts:186`）：

```
两路（/dev/ttyACM6、/dev/ttyACM4）均 0 字节返回
另试：\r\n + Ctrl-C（MicroPython REPL）、dtr/rts=true、1200bps touch —— 全部无响应
```

固件若在跑，应回 5 行：
```
LOGIC_ANALYZER_<BOARD>_<VER>
FREQ:<n>
BLASTFREQ:<n>
BUFFER:<n>
CHANNELS:<n>
```
（源码：`logicanalyzer/Firmware/LogicAnalyzer_V2/LogicAnalyzer.c:246-263`）

⇒ 当前板上固件**不是**逻辑分析器（也不是 MicroPython）。

### 2.2 固件源码可以构建出 RP2040 版

仓库自带 `logicanalyzer/Firmware/LogicAnalyzer_V2/`，默认配置是
`BOARD_TYPE "BOARD_PICO_2"` + `TURBO_MODE 1`（rp2350 / 200MHz / 384KB）——
**与实际插着的 RP2040 不符**。改成 `BOARD_TYPE "BOARD_PICO"` + `TURBO_MODE 0` 后：

```sh
cmake -S <fw-copy> -B build -G Ninja \
      -DPICO_BOARD=pico -DPICO_PLATFORM=rp2040 \
      -DCMAKE_BUILD_TYPE=Release \
      -DPICO_SDK_PATH=/home/share/samba/pico/pico-sdk \
      -DPICO_TOOLCHAIN_PATH=/opt/gcc-arm-none-eabi-10-2020-q4-major
cmake --build build -j8
# EXIT=0
```

产物：
```
build/LogicAnalyzer.elf   888.7K
build/LogicAnalyzer.uf2    85.0K
strings LogicAnalyzer.uf2 | grep LOGIC_ANALYZER
  → LOGIC_ANALYZER_PICO_V6_0
```

USB 标识（`CMakeLists.txt:137`）：
```
USBD_VID=0x1209  USBD_PID=0x3020
```
**正是插件 `SerialDetector.classifyPort` 认的正版 ID**（`HardwareDriverManager.ts:829`）。

### 2.3 三条曾被误判为「环境缺口」的依赖，实测都不需要

| 曾被当作缺口 | 实测 |
| --- | --- |
| 需要 gcc 12+ | ❌ 不需要。`/opt/gcc-arm-none-eabi-10-2020-q4-major`（gcc 10.2.1）编 rp2040 成功 |
| 需要手装 picotool | ❌ 不需要。CMake 自动 `Downloading Picotool` 到 `build/_deps/picotool` |
| 需要 `~/.pico-sdk/toolchain` | ❌ 不需要。直接传 `PICO_TOOLCHAIN_PATH` 即可 |
| 板上设备 ID 对不上（`2e8a:0009` ≠ `2e8a:0003`） | ✅ 是事实，但**烧上固件后 VID/PID 会变成 `1209:3020`**，那时就能被产品发现 |

### 2.4 烧录路径也通（未执行）

- `picotool`：`/tmp/pico2-freertos-*/_deps/picotool-build/picotool`（v2.3.1）
  ⚠️ 该副本**编译时未启 USB 支持**（`picotool version` 自述），要烧录需重新构建带 USB 的版本，或用 SWD。
- SWD：本机有 `pyocd`（`/home/cys/.local/bin/pyocd`，`import pyocd` 成功）+ Debugprobe（`2e8a:000c`）。
- 1200bps touch：试过一次**未进 BOOTSEL**（lsusb 仍是 `2e8a:0009`）。可能因为当前固件不是
  `stdio_usb` 那套，也可能需要更精确的时序 —— 未深究。

## 三、未做的事及原因

| 未做 | 原因 |
| --- | --- |
| 烧录固件 | **用户 2026-11-03 裁定「先不烧，硬件层挂起」**。写板抹掉板上现有固件，属不可逆外向操作，必须授权 |
| 真机采集 e2e | 依赖上一条 |
| `SerialDetector` 支持 `2e8a:0009` | 不需要。烧上固件后是 `1209:3020`，白名单本来就认 |

## 四、授权后要做什么（给后人照做）

1. 按 §2.2 构建 RP2040 版 `.uf2`
2. 进 BOOTSEL（按住 BOOTSEL 插 USB，或 `picotool reboot -f -u`，或 SWD `pyocd` 烧）
3. 拷 `.uf2` 到 RPI-RP2 盘
4. 验证：`serialport.list()` 应出现 `vendorId: '1209', productId: '3020'`
5. 再按 §2.1 发 ID 请求，应回 5 行
6. 此时可在 `tests/e2e/vscode/scenarios/hardware/` 下加真机场景，
   判据用**回读 `.lac` 的样本位串**（不是"命令返回了"）

## 五、与 e2e 的关系

真机 e2e 目前**不在**第一批交付内。`tests/e2e/vscode/` 的场景全部 `needsHardware: false`，
硬件相关 oracle 登记为 `not_exercised` 并带原因，**不会伪装成通过**。

状态提升条件：④ 完成后，把本记录状态从 `blocked / 待授权` 改为 `pass`，
并另建 `YYYY-MM-DD-Pico-USB采集.md` 记录采集参数、`.lac` 路径、sha256、截图。
