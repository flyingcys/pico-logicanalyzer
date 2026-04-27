import path from 'node:path';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/webview'),
      '@components': path.resolve(__dirname, 'src/webview/components'),
      '@stores': path.resolve(__dirname, 'src/webview/stores'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@drivers': path.resolve(__dirname, 'src/drivers'),
      '@models': path.resolve(__dirname, 'src/models'),
      vscode: path.resolve(__dirname, 'tests/fixtures/mocks/vscode.ts')
    }
  },
  test: {
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['tests/setup/vitest.setup.ts'],
    exclude: [
      'node_modules/**',
      'out/**',
      'dist/**',
      'coverage/**',
      'tests/e2e/**',
      'tests/integration/**',
      'tests/performance/**',
      'tests/stress/**',
      'tests/unit/extension/**',
      'tests/unit/database/**',
      'tests/unit/decoders/**',
      'tests/unit/tools/**',
      'tests/unit/models/BinaryDataParser.test.ts',
      'tests/unit/models/CaptureProgressMonitor.core.test.ts',
      'tests/unit/models/DataStreamProcessor.test.ts',
      'tests/unit/models/LACFileFormat.test.ts',
      'tests/unit/models/TriggerProcessor.core.test.ts',
      'tests/unit/services/NetworkStabilityService.accurate.test.ts',
      'tests/unit/services/SessionManager.accurate.test.ts',
      'tests/unit/services/SessionManager.enhanced.test.ts',
      'tests/unit/services/WorkspaceManager.accurate.test.ts',
      'tests/unit/drivers/HardwareDriverManager.business.test.ts',
      'tests/unit/drivers/HardwareDriverManager.comprehensive.test.ts',
      'tests/unit/drivers/LogicAnalyzerDriver.accurate.test.ts',
      'tests/unit/drivers/LogicAnalyzerDriver.business.test.ts',
      'tests/unit/drivers/LogicAnalyzerDriver.comprehensive.test.ts',
      'tests/unit/drivers/LogicAnalyzerDriver.enhanced.test.ts',
      'tests/unit/drivers/LogicAnalyzerDriver.simple.test.ts',
      'tests/unit/drivers/LogicAnalyzerDriver.test.ts',
      'tests/unit/drivers/MultiAnalyzerDriver.comprehensive.test.ts',
      'tests/unit/drivers/NetworkLogicAnalyzerDriver.business.test.ts',
      'tests/unit/drivers/NetworkLogicAnalyzerDriver.comprehensive.test.ts',
      'tests/unit/drivers/RigolSiglentDriver.comprehensive.test.ts',
      'tests/unit/drivers/SaleaeLogicDriver.comprehensive.test.ts',
      'tests/unit/drivers/SigrokAdapter.comprehensive.test.ts'
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'html']
    }
  }
});
