#!/usr/bin/env node

/**
 * 硬件兼容性数据库管理工具
 * 提供命令行接口来管理硬件兼容性数据库
 */

import { Command } from 'commander';
import { promises as fs } from 'fs';
import { join } from 'path';
import { HardwareCompatibilityDatabase, DeviceCompatibilityEntry } from '../src/database/HardwareCompatibilityDatabase';
import { DatabaseManager } from '../src/database/DatabaseManager';

const program = new Command();

// 版本信息
program
  .name('manage-database')
  .description('VSCode 逻辑分析器硬件兼容性数据库管理工具')
  .version('1.0.0');

// 查询设备
program
  .command('query')
  .description('查询兼容设备')
  .option('-m, --manufacturer <name>', '制造商名称')
  .option('-M, --model <name>', '设备型号')
  .option('-c, --category <type>', '设备类别')
  .option('-d, --driver <name>', '驱动名称')
  .option('-l, --compatibility <level>', '兼容性级别')
  .option('-s, --min-score <score>', '最低验证分数', '0')
  .option('-f, --format <format>', '输出格式', 'table')
  .option('-o, --output <file>', '输出文件')
  .action(async (options) => {
    console.log('🔍 查询硬件兼容性数据库...\n');

    try {
      const database = new HardwareCompatibilityDatabase();
      await database.initialize();

      const query = {
        manufacturer: options.manufacturer,
        model: options.model,
        category: options.category,
        driverName: options.driver,
        compatibilityLevel: options.compatibility,
        minValidationScore: parseInt(options.minScore) || 0
      };

      const results = await database.queryDevices(query);

      if (results.length === 0) {
        console.log('❌ 没有找到匹配的设备');
        return;
      }

      console.log(`✅ 找到 ${results.length} 个匹配的设备:\n`);

      if (options.format === 'json') {
        const output = JSON.stringify(results, null, 2);
        if (options.output) {
          await fs.writeFile(options.output, output);
          console.log(`📄 结果已保存到: ${options.output}`);
        } else {
          console.log(output);
        }
      } else {
        // 表格格式输出
        const table = results.map(device => ({
          'Device ID': device.deviceId,
          'Manufacturer': device.manufacturer,
          'Model': device.model,
          'Category': device.category,
          'Primary Driver': device.driverCompatibility.primaryDriver,
          'Compatibility': device.driverCompatibility.compatibilityLevel,
          'Validation Score': device.testStatus.testResults.driverValidation,
          'User Rating': device.communityFeedback.userRating.toFixed(1),
          'Support Status': device.metadata.supportStatus
        }));

        console.table(table);

        if (options.output) {
          const csvHeader = Object.keys(table[0]).join(',');
          const csvRows = table.map(row => Object.values(row).join(','));
          const csvContent = [csvHeader, ...csvRows].join('\n');
          
          await fs.writeFile(options.output, csvContent);
          console.log(`\n📄 结果已保存到: ${options.output}`);
        }
      }

    } catch (error) {
      console.error('❌ 查询失败:', error);
      process.exit(1);
    }
  });

// 添加设备
program
  .command('add <deviceFile>')
  .description('添加新设备到数据库')
  .option('-f, --format <format>', '输入文件格式', 'json')
  .action(async (deviceFile, options) => {
    console.log(`📥 添加设备到数据库: ${deviceFile}`);

    try {
      const database = new HardwareCompatibilityDatabase();
      await database.initialize();

      const fileContent = await fs.readFile(deviceFile, 'utf-8');
      
      if (options.format === 'json') {
        const deviceData = JSON.parse(fileContent);
        
        if (Array.isArray(deviceData)) {
          // 批量添加
          for (const device of deviceData) {
            await database.addOrUpdateDevice(device);
          }
          console.log(`✅ 已添加 ${deviceData.length} 个设备`);
        } else {
          // 单个设备
          await database.addOrUpdateDevice(deviceData);
          console.log(`✅ 已添加设备: ${deviceData.manufacturer} ${deviceData.model}`);
        }
      }

    } catch (error) {
      console.error('❌ 添加设备失败:', error);
      process.exit(1);
    }
  });

// 更新设备
program
  .command('update <deviceId>')
  .description('更新设备信息')
  .option('-t, --test-results <file>', '测试结果文件')
  .option('-f, --feedback <rating>:<comment>', '用户反馈 (评分:评论)')
  .action(async (deviceId, options) => {
    console.log(`🔄 更新设备: ${deviceId}`);

    try {
      const database = new HardwareCompatibilityDatabase();
      await database.initialize();

      if (options.testResults) {
        const testData = JSON.parse(await fs.readFile(options.testResults, 'utf-8'));
        await database.updateTestResults(deviceId, testData);
        console.log('✅ 测试结果已更新');
      }

      if (options.feedback) {
        const [rating, comment] = options.feedback.split(':');
        await database.addUserFeedback(deviceId, parseFloat(rating), comment || '');
        console.log('✅ 用户反馈已添加');
      }

    } catch (error) {
      console.error('❌ 更新失败:', error);
      process.exit(1);
    }
  });

// 删除设备
program
  .command('remove <deviceId>')
  .description('从数据库中删除设备')
  .option('--confirm', '确认删除', false)
  .action(async (deviceId, options) => {
    if (!options.confirm) {
      console.log('⚠️  请使用 --confirm 参数确认删除操作');
      return;
    }

    console.log(`🗑️  删除设备: ${deviceId}`);

    try {
      const database = new HardwareCompatibilityDatabase();
      await database.initialize();

      const success = await database.removeDevice(deviceId);
      
      if (success) {
        console.log('✅ 设备已删除');
      } else {
        console.log('❌ 设备不存在');
      }

    } catch (error) {
      console.error('❌ 删除失败:', error);
      process.exit(1);
    }
  });

// 数据库统计
program
  .command('stats')
  .description('显示数据库统计信息')
  .option('-f, --format <format>', '输出格式', 'text')
  .option('-o, --output <file>', '输出文件')
  .action(async (options) => {
    console.log('📊 数据库统计信息...\n');

    try {
      const database = new HardwareCompatibilityDatabase();
      await database.initialize();

      const stats = await database.getStatistics();

      if (options.format === 'json') {
        const output = JSON.stringify(stats, null, 2);
        if (options.output) {
          await fs.writeFile(options.output, output);
          console.log(`📄 统计信息已保存到: ${options.output}`);
        } else {
          console.log(output);
        }
      } else {
        console.log('🏠 总体统计:');
        console.log(`├─ 总设备数: ${stats.totalDevices}`);
        console.log(`├─ 平均用户评分: ${stats.averageUserRating.toFixed(2)}/5.0`);
        console.log('└─ 数据库健康状态: 良好\n');

        console.log('📱 设备类别分布:');
        Object.entries(stats.devicesByCategory).forEach(([category, count]) => {
          const categoryNames: Record<string, string> = {
            'usb-la': 'USB逻辑分析器',
            'network-la': '网络逻辑分析器',
            'benchtop': '台式设备',
            'mixed-signal': '混合信号',
            'protocol-analyzer': '协议分析器'
          };
          console.log(`├─ ${categoryNames[category] || category}: ${count}`);
        });

        console.log('\n🏭 制造商分布:');
        Object.entries(stats.devicesByManufacturer).forEach(([manufacturer, count]) => {
          console.log(`├─ ${manufacturer}: ${count}`);
        });

        console.log('\n🏆 认证级别分布:');
        Object.entries(stats.certificationLevels).forEach(([level, count]) => {
          const levelNames: Record<string, string> = {
            'certified': '已认证',
            'verified': '已验证',
            'community': '社区支持',
            'experimental': '实验性'
          };
          console.log(`├─ ${levelNames[level] || level}: ${count}`);
        });

        if (options.output) {
          const textOutput = `数据库统计信息 (${new Date().toLocaleString()})
===========================================

总体统计:
- 总设备数: ${stats.totalDevices}
- 平均用户评分: ${stats.averageUserRating.toFixed(2)}/5.0

设备类别分布:
${Object.entries(stats.devicesByCategory).map(([cat, count]) => `- ${cat}: ${count}`).join('\n')}

制造商分布:
${Object.entries(stats.devicesByManufacturer).map(([mfg, count]) => `- ${mfg}: ${count}`).join('\n')}

认证级别分布:
${Object.entries(stats.certificationLevels).map(([level, count]) => `- ${level}: ${count}`).join('\n')}`;

          await fs.writeFile(options.output, textOutput);
          console.log(`\n📄 统计信息已保存到: ${options.output}`);
        }
      }

    } catch (error) {
      console.error('❌ 获取统计信息失败:', error);
      process.exit(1);
    }
  });

// 设备发现
program
  .command('discover')
  .description('自动发现设备并更新数据库')
  .option('--dry-run', '仅显示将要执行的操作，不实际更新', false)
  .action(async (options) => {
    console.log('🔍 开始自动设备发现...\n');

    try {
      const manager = new DatabaseManager();
      await manager.initialize();

      if (options.dryRun) {
        console.log('🧪 干运行模式 - 不会实际更新数据库\n');
      }

      const results = options.dryRun ? 
        { discovered: 0, updated: 0, added: 0 } :
        await manager.discoverAndUpdateDevices();

      console.log('\n📊 发现结果:');
      console.log(`├─ 已发现设备: ${results.discovered}`);
      console.log(`├─ 已更新条目: ${results.updated}`);
      console.log(`└─ 新增条目: ${results.added}`);

      if (!options.dryRun && (results.updated > 0 || results.added > 0)) {
        console.log('\n✅ 数据库已更新');
      }

      manager.dispose();

    } catch (error) {
      console.error('❌ 设备发现失败:', error);
      process.exit(1);
    }
  });

// 数据库验证
program
  .command('validate')
  .description('验证数据库完整性')
  .option('--fix', '自动修复发现的问题', false)
  .action(async (options) => {
    console.log('🔍 验证数据库完整性...\n');

    try {
      const manager = new DatabaseManager();
      await manager.initialize();

      const validation = await manager.validateDatabaseIntegrity();

      if (validation.isValid) {
        console.log('✅ 数据库完整性验证通过');
      } else {
        console.log('❌ 数据库存在问题:');
        validation.issues.forEach(issue => {
          console.log(`   • ${issue}`);
        });
      }

      if (validation.fixedIssues.length > 0) {
        console.log('\n🔧 已自动修复的问题:');
        validation.fixedIssues.forEach(fix => {
          console.log(`   • ${fix}`);
        });
      }

      manager.dispose();

      if (!validation.isValid && !options.fix) {
        console.log('\n💡 使用 --fix 参数自动修复部分问题');
        process.exit(1);
      }

    } catch (error) {
      console.error('❌ 验证失败:', error);
      process.exit(1);
    }
  });

// 数据库导出
program
  .command('export <outputFile>')
  .description('导出数据库')
  .option('-f, --format <format>', '导出格式', 'json')
  .action(async (outputFile, options) => {
    console.log(`📤 导出数据库到: ${outputFile}`);

    try {
      const database = new HardwareCompatibilityDatabase();
      await database.initialize();

      const data = await database.exportDatabase(options.format as 'json' | 'csv');
      await fs.writeFile(outputFile, data);

      console.log('✅ 数据库导出完成');

    } catch (error) {
      console.error('❌ 导出失败:', error);
      process.exit(1);
    }
  });

// 数据库导入
program
  .command('import <inputFile>')
  .description('导入数据库')
  .option('-f, --format <format>', '导入格式', 'json')
  .option('--merge', '合并模式（保留现有数据）', true)
  .option('--replace', '替换模式（清空现有数据）', false)
  .action(async (inputFile, options) => {
    console.log(`📥 从文件导入数据库: ${inputFile}`);

    try {
      const database = new HardwareCompatibilityDatabase();
      await database.initialize();

      const data = await fs.readFile(inputFile, 'utf-8');
      const merge = options.replace ? false : options.merge;

      await database.importDatabase(data, options.format as 'json' | 'csv', merge);

      console.log('✅ 数据库导入完成');

    } catch (error) {
      console.error('❌ 导入失败:', error);
      process.exit(1);
    }
  });

// 创建设备模板
program
  .command('template <deviceType>')
  .description('创建设备条目模板')
  .option('-o, --output <file>', '输出文件', 'device-template.json')
  .action(async (deviceType, options) => {
    console.log(`📝 创建设备模板: ${deviceType}`);

    const templates: Record<string, Partial<DeviceCompatibilityEntry>> = {
      'usb-la': {
        category: 'usb-la',
        identifiers: {
          vendorId: '0000',
          productId: '0000',
          serialPattern: 'DEV*'
        },
        capabilities: {
          channels: {
            digital: 8,
            analog: 0,
            maxVoltage: 5.0,
            inputImpedance: 1000000,
            thresholdVoltages: [1.5, 3.3, 5.0]
          },
          sampling: {
            maxRate: 25000000,
            minRate: 1000,
            supportedRates: [1000, 10000, 100000, 1000000, 25000000],
            bufferSize: 1000000,
            streamingSupport: false,
            compressionSupport: false
          },
          triggers: {
            types: ['edge', 'pattern'],
            maxChannels: 8,
            advancedTriggers: false,
            triggerPosition: true
          },
          protocol: {
            supportedProtocols: ['uart', 'spi', 'i2c'],
            hardwareDecoding: false,
            customProtocols: false
          },
          advanced: {
            memorySegmentation: false,
            externalClock: false,
            calibration: false,
            selfTest: false
          }
        },
        connectionOptions: {
          defaultConnectionString: 'COM3',
          alternativeConnections: ['COM1', 'COM2'],
          connectionParameters: {
            baudRate: 115200,
            timeout: 5000
          }
        }
      },
      'network-la': {
        category: 'network-la',
        identifiers: {
          networkSignature: 'device-*',
          scpiIdnResponse: 'MANUFACTURER,MODEL*'
        },
        connectionOptions: {
          defaultConnectionString: '192.168.1.100:8080',
          alternativeConnections: ['localhost:8080'],
          connectionParameters: {
            protocol: 'HTTP',
            timeout: 10000
          }
        }
      }
    };

    const template = {
      deviceId: 'your-device-id',
      manufacturer: 'Your Manufacturer',
      model: 'Your Model',
      version: '1.0',
      ...templates[deviceType],
      driverCompatibility: {
        primaryDriver: 'YourDriver',
        alternativeDrivers: [],
        driverVersion: '2.0.0',
        compatibilityLevel: 'experimental',
        knownIssues: [],
        workarounds: []
      },
      testStatus: {
        lastTested: new Date().toISOString(),
        testResults: {
          driverValidation: 0,
          functionalTests: 0,
          performanceGrade: 'F',
          reliability: 'poor'
        },
        certificationLevel: 'experimental'
      },
      communityFeedback: {
        userRating: 3.0,
        reportCount: 0,
        commonIssues: [],
        userComments: []
      },
      metadata: {
        addedDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        maintainer: 'Your Name',
        supportStatus: 'active'
      }
    };

    await fs.writeFile(options.output, JSON.stringify(template, null, 2));
    console.log(`✅ 模板已创建: ${options.output}`);
    console.log('💡 请编辑模板文件并使用 "add" 命令将其添加到数据库');
  });

// 错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  process.exit(1);
});

// 解析命令行参数
program.parse();

// 如果没有提供命令，显示帮助
if (!process.argv.slice(2).length) {
  program.outputHelp();
}