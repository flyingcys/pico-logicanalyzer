/**
 * 集成测试工具函数
 * 
 * 功能：
 * - 异步条件等待
 * - 文件操作工具
 * - 测试配置管理
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { ConfigurationManager } from '../../../src/services/ConfigurationManager';

/**
 * 等待异步条件的工具函数
 */
async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  throw new Error(`等待条件超时: ${timeoutMs}ms`);
}

/**
 * 创建测试文件
 */
async function createTestFile(dataPath: string, filename: string, content: Buffer | string): Promise<string> {
  const filePath = path.join(dataPath, filename);
  await fs.writeFile(filePath, content);
  return filePath;
}

/**
 * 设置测试配置
 */
async function setupTestConfiguration(configManager: ConfigurationManager): Promise<void> {
  // 基础设备配置
  await configManager.set('autoDetectDevices', false);
  await configManager.set('defaultSampleRate', 1000000);
  
  // 网络测试配置
  await configManager.set('network.enableAutoDiscovery', false);
  await configManager.set('network.scanTimeoutMs', 1000);
  await configManager.set('network.maxConcurrentConnections', 5);
}

export { waitForCondition, createTestFile, setupTestConfiguration };