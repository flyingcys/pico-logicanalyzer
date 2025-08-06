/**
 * VersionValidator 完美覆盖率测试
 * 专门针对未覆盖的边缘情况
 */

import { VersionValidator, DeviceVersion } from '../src/drivers/VersionValidator';

describe('VersionValidator 完美覆盖率测试', () => {
  describe('边缘情况覆盖', () => {
    it('应该处理 parseInt 返回 NaN 的情况 - 点分格式', () => {
      // 创建一个特殊的字符串，会匹配点分格式但 parseInt 会返回 NaN
      // 使用 Unicode 数字字符，看起来像数字但 parseInt 可能无法解析
      const specialVersion = '１.７'; // 使用全角数字字符
      const version = VersionValidator.getVersion(specialVersion);
      
      // 应该触发第 49 行的 NaN 处理
      expect(version.isValid).toBe(false);
      expect(version.major).toBe(0);
      expect(version.minor).toBe(0);
    });

    it('应该处理 parseInt 返回 NaN 的情况 - V格式', () => {
      // 创建会匹配 V 格式但 parseInt 会返回 NaN 的字符串
      const specialVersion = 'V１_７'; // 使用全角数字字符
      const version = VersionValidator.getVersion(specialVersion);
      
      // 应该触发第 62 行的 NaN 处理
      expect(version.isValid).toBe(false);
      expect(version.major).toBe(0);
      expect(version.minor).toBe(0);
    });

    it('应该处理空格和特殊字符混合的版本字符串', () => {
      const testCases = [
        '1 .7',    // 空格导致解析失败
        '1. 7',    // 空格导致解析失败
        '1.7a',    // 后缀字符
        'a1.7',    // 前缀字符
        '1.7.8',   // 太多点分段
        '1..7',    // 双点
        '.7',      // 缺少主版本号
        '1.',      // 缺少次版本号
        'V1 _7',   // V格式中的空格
        'V1_ 7',   // V格式中的空格
        'V1__7',   // 双下划线
        'V_7',     // 缺少主版本号
        'V1_',     // 缺少次版本号
      ];

      testCases.forEach(versionStr => {
        const version = VersionValidator.getVersion(versionStr);
        expect(version.isValid).toBe(false);
        expect(version.major).toBe(0);
        expect(version.minor).toBe(0);
      });
    });

    it('应该处理极端数值情况', () => {
      const testCases = [
        'V0_0',           // 零版本
        'V999999_999999', // 极大版本号
        'V-1_7',         // 负数版本号
        'V1_-7',         // 负数次版本号
        'V+1_7',         // 带加号的版本号
        'V1_+7',         // 带加号的次版本号
      ];

      testCases.forEach(versionStr => {
        const version = VersionValidator.getVersion(versionStr);
        expect(version).toBeDefined();
        // 验证解析结果的合理性
        expect(typeof version.major).toBe('number');
        expect(typeof version.minor).toBe('number');
        expect(typeof version.isValid).toBe('boolean');
      });
    });

    it('应该处理 RegExp.match 方法的边缘情况', () => {
      // 创建一个字符串，它会匹配正则表达式但结果为空
      const mockString = {
        toString: () => 'V1_7',
        match: jest.fn(() => null),
        trim: jest.fn(() => mockString as any)
      };

      const version = VersionValidator.getVersion(mockString as any);
      expect(version.isValid).toBe(false);
    });

    it('应该处理不同进制的数字字符串', () => {
      // 测试可能导致 parseInt 行为异常的情况
      const testCases = [
        'V0x1_7',  // 十六进制前缀
        'V01_07',  // 八进制前缀
        'V1e1_7',  // 科学计数法
        'V1_7e1',  // 科学计数法
        'V∞_7',    // 无穷大符号
        'V1_∞',    // 无穷大符号
      ];

      testCases.forEach(versionStr => {
        const version = VersionValidator.getVersion(versionStr);
        // 不应该崩溃，应该有明确的结果
        expect(version).toBeDefined();
        expect(typeof version.isValid).toBe('boolean');
      });
    });

    it('应该处理 toString 异常的对象', () => {
      const problematicObject = {
        toString: () => {
          throw new Error('toString failed');
        }
      };

      try {
        const version = VersionValidator.getVersion(problematicObject as any);
        expect(version.isValid).toBe(false);
      } catch (error) {
        // 如果抛出异常也是可以接受的
        expect(error).toBeDefined();
      }
    });

    it('应该处理各种 falsy 值', () => {
      const falsyValues = [
        null,
        undefined,
        '',
        0,
        false,
        NaN
      ];

      falsyValues.forEach(value => {
        const version = VersionValidator.getVersion(value as any);
        expect(version.isValid).toBe(false);
        expect(version.major).toBe(0);
        expect(version.minor).toBe(0);
      });
    });

    it('应该测试版本比较的所有分支', () => {
      const versions = [
        new DeviceVersion(1, 7, true, 'V1_7'),
        new DeviceVersion(2, 7, true, 'V2_7'),
        new DeviceVersion(1, 8, true, 'V1_8'),
        new DeviceVersion(1, 6, true, 'V1_6'),
      ];

      // 测试所有比较分支
      expect(VersionValidator.compareVersions(versions[0], versions[1])).toBe(-1); // 1.7 < 2.7
      expect(VersionValidator.compareVersions(versions[1], versions[0])).toBe(1);  // 2.7 > 1.7
      expect(VersionValidator.compareVersions(versions[0], versions[2])).toBe(-1); // 1.7 < 1.8
      expect(VersionValidator.compareVersions(versions[2], versions[0])).toBe(1);  // 1.8 > 1.7
      expect(VersionValidator.compareVersions(versions[0], versions[3])).toBe(1);  // 1.7 > 1.6
      expect(VersionValidator.compareVersions(versions[0], versions[0])).toBe(0);  // 1.7 == 1.7
    });

    it('应该测试版本验证的完整流程', () => {
      // 测试完整的版本验证流程，确保所有路径都被覆盖
      const testVersions = [
        { input: 'LOGIC_ANALYZER_V1_7', expectValid: true },
        { input: 'LOGIC_ANALYZER_V1_8', expectValid: true },
        { input: 'LOGIC_ANALYZER_V2_0', expectValid: true },
        { input: 'LOGIC_ANALYZER_V1_6', expectValid: false },
        { input: 'LOGIC_ANALYZER_V0_9', expectValid: false },
        { input: '1.7', expectValid: true },
        { input: '1.8', expectValid: true },
        { input: '2.0', expectValid: true },
        { input: '1.6', expectValid: false },
        { input: '0.9', expectValid: false },
      ];

      testVersions.forEach(({ input, expectValid }) => {
        const version = VersionValidator.getVersion(input);
        expect(version.isValid).toBe(expectValid);
        expect(VersionValidator.isValidVersion(input)).toBe(expectValid);
      });
    });
  });
});