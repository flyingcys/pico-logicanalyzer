import matchers from '@testing-library/jest-dom/matchers';
import { afterEach, expect, vi } from 'vitest';

expect.extend(matchers);

const compatJest = Object.assign({}, vi, {
  fn: vi.fn,
  spyOn: vi.spyOn,
  mocked: vi.mocked,
  clearAllMocks: vi.clearAllMocks,
  resetAllMocks: vi.resetAllMocks,
  restoreAllMocks: vi.restoreAllMocks
});

(globalThis as { jest?: unknown }).jest = compatJest;

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});
