# 测试体系健康度治理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立稳定、分层、可执行的双入口测试与关键路径覆盖率门禁。

**Architecture:** Jest 配置按测试目录分层，Vitest 负责 web-app 覆盖率。关键模块使用路径阈值，集成测试使用 Mock 硬件驱动贯通真实序列化、解码和 Provider 合同；压力测试移出常规门禁。

**Tech Stack:** TypeScript、Jest、ts-jest、Vitest、Vue Test Utils、Pinia、VSCode mock。

## Global Constraints

- web-app 和 VSCode 插件必须使用同一套前端业务代码，入口不同。
- 不连接真实硬件、网络设备或 Sigrok CLI。
- 新增行为先写失败测试，再写最小实现。
- 所有 Markdown 使用中文。
- 不以低全局覆盖率阈值替代关键路径门禁。

---

### Task 1: 分离 Jest 测试层级

**Files:**
- Modify: `jest.config.js`
- Modify: `package.json`
- Modify: `.github/workflows/quality-gate.yml`
- Test: `tests/unit/quality/QualityGateConfig.test.ts`

**Interfaces:**
- Consumes: Jest `testMatch` 与 npm scripts。
- Produces: `test:unit`、`test:integration`、`test:stress` 三个互斥命令。

- [ ] **Step 1: 写失败配置测试**

```ts
expect(packageJson.scripts['test:unit']).toContain('tests/unit');
expect(packageJson.scripts['test:unit']).not.toContain('stress');
expect(workflow).toContain('npm run test:unit');
```

- [ ] **Step 2: 运行失败测试**

Run: `npx jest tests/unit/quality/QualityGateConfig.test.ts --runInBand`

Expected: FAIL，脚本或 workflow 未定义分层命令。

- [ ] **Step 3: 最小配置实现**

```json
{
  "test:unit": "jest --testPathPattern=tests/unit --runInBand",
  "test:integration": "jest --testPathPattern=tests/integration --runInBand",
  "test:stress": "jest --testPathPattern=tests/stress --runInBand"
}
```

在 CI 中依次调用 `test:unit`、`test:integration` 和 `test:web:coverage`；压力命令不放入常规 PR workflow。

- [ ] **Step 4: 验证通过**

Run: `npm run test:unit -- --listTests`

Expected: 输出不含 `tests/stress/`、`tests/performance/`。

- [ ] **Step 5: 提交**

```bash
git add jest.config.js package.json .github/workflows/quality-gate.yml tests/unit/quality/QualityGateConfig.test.ts
git commit -m "test: separate unit integration and stress gates"
```

### Task 2: 补齐三个前端入口测试

**Files:**
- Create: `src/web-app/src/main-web.test.ts`（若已存在则扩展）
- Create: `tests/unit/frontend/main-html.entry.test.ts`
- Create: `tests/unit/frontend/main-vscode.entry.test.ts`
- Modify: `src/web-app/vite.config.ts`

**Interfaces:**
- Consumes: `createFrontendApp({ host, bootstrap })`、`createWebApp({ host, bootstrap })`。
- Produces: 三入口均验证 `mount('#app')` 与 `host.ready()`。

- [ ] **Step 1: 写入口失败测试**

```ts
vi.mock('../platform/bootstrap/createFrontendApp', () => ({
  createFrontendApp: vi.fn(() => ({ app: { mount: vi.fn() }, host: { ready: vi.fn() } }))
}));
await import('../../../src/frontend/app/main-html');
expect(createFrontendApp).toHaveBeenCalledOnce();
expect(mount).toHaveBeenCalledWith('#app');
expect(ready).toHaveBeenCalledOnce();
```

- [ ] **Step 2: 验证失败**

Run: `npx jest tests/unit/frontend/main-html.entry.test.ts tests/unit/frontend/main-vscode.entry.test.ts --runInBand`

Expected: FAIL，入口测试文件不存在。

- [ ] **Step 3: 实现入口测试与路径阈值**

为 HTML、VSCode 增加上述 mock 启动测试；保留 web `main-web.ts` 的 100% 阈值，并为两个入口添加 Jest 路径阈值。

- [ ] **Step 4: 验证通过**

Run: `npx jest tests/unit/frontend/main-html.entry.test.ts tests/unit/frontend/main-vscode.entry.test.ts --coverage --runInBand`

Expected: PASS，三个入口覆盖率均为 100%。

- [ ] **Step 5: 提交**

```bash
git add src/web-app/src/main-web.test.ts tests/unit/frontend/main-html.entry.test.ts tests/unit/frontend/main-vscode.entry.test.ts jest.config.js src/web-app/vite.config.ts
git commit -m "test: cover frontend entrypoints"
```

### Task 3: 覆盖通道映射验证

**Files:**
- Create: `tests/unit/decoders/ChannelMapping.test.ts`
- Modify: `src/decoders/ChannelMapping.ts`
- Modify: `jest.config.js`

**Interfaces:**
- Consumes: `ChannelMappingManager` 公开映射、验证、导入导出接口。
- Produces: 映射失败返回明确错误，成功映射可往返。

- [ ] **Step 1: 写失败行为测试**

```ts
expect(() => manager.validateMapping(i2cMappingWithoutSda)).toThrow(/SDA/);
expect(() => manager.validateMapping(duplicateChannelMapping)).toThrow(/重复/);
expect(() => manager.importMappings('{bad json}')).toThrow();
expect(manager.importMappings(manager.exportMappings())).toEqual(expectedMappings);
```

- [ ] **Step 2: 验证失败**

Run: `npx jest tests/unit/decoders/ChannelMapping.test.ts --runInBand`

Expected: FAIL，当前未覆盖错误合同或行为不一致。

- [ ] **Step 3: 最小实现**

只在测试证明的缺口中补充验证；坏导入返回可识别错误，不能部分写入已有映射。

- [ ] **Step 4: 验证通过与门禁**

Run: `npx jest tests/unit/decoders/ChannelMapping.test.ts --coverage --runInBand`

Expected: PASS；在 `jest.config.js` 为 `ChannelMapping.ts` 添加不低于实测结果的路径阈值。

- [ ] **Step 5: 提交**

```bash
git add src/decoders/ChannelMapping.ts tests/unit/decoders/ChannelMapping.test.ts jest.config.js
git commit -m "test: cover channel mapping validation"
```

### Task 4: 覆盖 DecoderManager 与 Sigrok 失败清理

**Files:**
- Create: `tests/unit/decoders/DecoderManager.cleanup.test.ts`
- Modify: `tests/unit/drivers/SigrokAdapter.comprehensive.test.ts`
- Modify: `src/decoders/DecoderManager.ts`（仅当失败测试证明资源未清理）
- Modify: `src/drivers/SigrokAdapter.ts`（仅当失败测试证明资源未清理）

**Interfaces:**
- Consumes: DecoderManager 的启动、停止、dispose；SigrokAdapter 的 spawn 包装。
- Produces: 任意 stop/dispose/spawn 失败后任务表、监听器、临时目录均清理。

- [ ] **Step 1: 写失败测试**

```ts
await expect(manager.stopDecoder(idWithThrowingStop)).rejects.toThrow('stop failed');
expect(manager.getActiveDecoders()).not.toContainEqual(expect.objectContaining({ id }));

child.emit('error', new Error('spawn failed'));
await expect(adapter.startCapture(session)).rejects.toThrow('spawn failed');
expect(removeTempDir).toHaveBeenCalledOnce();
```

- [ ] **Step 2: 验证失败**

Run: `npx jest tests/unit/decoders/DecoderManager.cleanup.test.ts tests/unit/drivers/SigrokAdapter.comprehensive.test.ts --runInBand`

Expected: FAIL，任务表或临时资源未清理。

- [ ] **Step 3: 最小实现**

在既有 `finally` 清理块中删除任务、释放实例与临时目录；禁止吞掉原始错误。

- [ ] **Step 4: 验证通过**

Run: `npx jest tests/unit/decoders/DecoderManager.cleanup.test.ts tests/unit/drivers/SigrokAdapter.comprehensive.test.ts --runInBand`

Expected: PASS，重复 `close`/`error` 不产生第二次 resolve 或泄漏。

- [ ] **Step 5: 提交**

```bash
git add src/decoders/DecoderManager.ts src/drivers/SigrokAdapter.ts tests/unit/decoders/DecoderManager.cleanup.test.ts tests/unit/drivers/SigrokAdapter.comprehensive.test.ts
git commit -m "test: cover decoder and sigrok cleanup failures"
```

### Task 5: 建立采集到 Provider 集成链路

**Files:**
- Modify: `tests/integration/core-flows/hardware-capture.integration.test.ts`
- Modify: `tests/fixtures/mocks/vscode.ts`
- Modify: `src/providers/LACEditorProvider.ts`（仅当合同测试失败）

**Interfaces:**
- Consumes: Mock `LogicAnalyzerDriver`、`LACFileFormat.serialize/parse`、`DecoderManager`、`LACEditorProvider`。
- Produces: `documentLoaded` 或 `documentUpdate` 消息，载荷含 samples、channels、decoder annotations。

- [ ] **Step 1: 写失败集成测试**

```ts
const capture = await mockDriver.capture({ channels: [0, 1], samples: 8 });
const lac = LACFileFormat.serialize(LACFileFormat.createFromCaptureSession(capture, undefined, true));
await provider.resolveCustomTextEditor(documentFrom(lac), panel, token);
expect(panel.webview.postMessage).toHaveBeenCalledWith(
  expect.objectContaining({ type: 'documentLoaded', data: expect.objectContaining({ Samples: expect.any(Array) }) })
);
```

- [ ] **Step 2: 验证失败**

Run: `npx jest tests/integration/core-flows/hardware-capture.integration.test.ts --runInBand`

Expected: FAIL，当前测试仅断言 mock Buffer，未经过 LAC 与 Provider。

- [ ] **Step 3: 最小实现**

复用现有 mock 和 Provider 测试辅助函数；只补齐真实链路所需的 mock 合同。

- [ ] **Step 4: 验证通过**

Run: `npm run test:integration`

Expected: PASS，样本、通道和 Provider 消息完整保留。

- [ ] **Step 5: 提交**

```bash
git add tests/integration/core-flows/hardware-capture.integration.test.ts tests/fixtures/mocks/vscode.ts src/providers/LACEditorProvider.ts
git commit -m "test: cover capture to provider integration"
```

### Task 6: 完整门禁验证

**Files:**
- Modify: `jest.config.js`（仅当验收显示路径阈值与实测不一致）
- Modify: `.github/workflows/quality-gate.yml`（仅当命令缺失）

**Interfaces:**
- Consumes: Task 1 至 Task 5 的 scripts、阈值和测试。
- Produces: 本地与 CI 一致的验证命令。

- [ ] **Step 1: 运行单元门禁**

Run: `npm run test:unit -- --coverage`

Expected: PASS；输出不含 stress/performance/e2e 测试路径。

- [ ] **Step 2: 运行集成门禁**

Run: `npm run test:integration`

Expected: PASS。

- [ ] **Step 3: 运行 Web 门禁**

Run: `npm --prefix src/web-app run test:coverage`

Expected: PASS；`main-web.ts` 为 100%。

- [ ] **Step 4: 运行构建与静态检查**

Run: `npm run typecheck && npm run lint && npm --prefix src/web-app run build`

Expected: 三个命令均以 0 退出。

- [ ] **Step 5: 检查变更影响并提交**

Run: `git diff --check && node .gitnexus/run.cjs status`

Expected: 无空白错误，GitNexus 索引可用。

```bash
git add jest.config.js package.json .github/workflows/quality-gate.yml src/web-app tests
git commit -m "test: harden layered quality gates"
```
