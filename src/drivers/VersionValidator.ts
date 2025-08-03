/**
 * 版本信息结构
 */
export class DeviceVersion {
  constructor(
    public major: number,
    public minor: number,
    public isValid: boolean,
    public versionString: string
  ) {}
}

/**
 * 设备版本验证器
 * 基于C# VersionValidator的TypeScript移植
 */
export class VersionValidator {
  // 支持的最低版本
  public static readonly MAJOR_VERSION = 1;
  public static readonly MINOR_VERSION = 7;

  /**
   * 解析和验证设备版本
   * @param versionString 从设备返回的版本字符串
   * @returns 版本信息对象
   */
  public static getVersion(versionString?: string): DeviceVersion {
    if (!versionString || typeof versionString !== 'string') {
      return new DeviceVersion(0, 0, false, '');
    }

    const cleanVersion = versionString.trim();

    // 解析版本格式: "LOGIC_ANALYZER_V1_7" 或类似格式
    const versionMatch = cleanVersion.match(/V(\d+)_(\d+)/i);

    if (!versionMatch || versionMatch.length < 3) {
      // 如果没有匹配到标准格式，尝试其他格式
      const alternativeMatch = cleanVersion.match(/(\d+)\.(\d+)/);

      if (!alternativeMatch || alternativeMatch.length < 3) {
        return new DeviceVersion(0, 0, false, cleanVersion);
      }

      const major = parseInt(alternativeMatch[1], 10);
      const minor = parseInt(alternativeMatch[2], 10);

      if (isNaN(major) || isNaN(minor)) {
        return new DeviceVersion(0, 0, false, cleanVersion);
      }

      const isValid = (major > this.MAJOR_VERSION) ||
                     (major === this.MAJOR_VERSION && minor >= this.MINOR_VERSION);

      return new DeviceVersion(major, minor, isValid, cleanVersion);
    }

    const major = parseInt(versionMatch[1], 10);
    const minor = parseInt(versionMatch[2], 10);

    if (isNaN(major) || isNaN(minor)) {
      return new DeviceVersion(0, 0, false, cleanVersion);
    }

    // 检查版本是否符合最低要求
    const isValid = (major > this.MAJOR_VERSION) ||
                   (major === this.MAJOR_VERSION && minor >= this.MINOR_VERSION);

    return new DeviceVersion(major, minor, isValid, cleanVersion);
  }

  /**
   * 检查版本字符串是否有效
   * @param versionString 版本字符串
   * @returns 是否有效
   */
  public static isValidVersion(versionString?: string): boolean {
    const version = this.getVersion(versionString);
    return version.isValid;
  }

  /**
   * 获取支持的最低版本字符串
   * @returns 最低版本字符串
   */
  public static getMinimumVersionString(): string {
    return `V${this.MAJOR_VERSION}_${this.MINOR_VERSION}`;
  }

  /**
   * 比较两个版本
   * @param version1 版本1
   * @param version2 版本2
   * @returns 1 if version1 > version2, -1 if version1 < version2, 0 if equal
   */
  public static compareVersions(version1: DeviceVersion, version2: DeviceVersion): number {
    if (version1.major > version2.major) return 1;
    if (version1.major < version2.major) return -1;

    if (version1.minor > version2.minor) return 1;
    if (version1.minor < version2.minor) return -1;

    return 0;
  }
}

/**
 * 设备连接异常
 * 对应C# DeviceConnectionException
 */
export class DeviceConnectionException extends Error {
  constructor(message: string, public deviceVersion?: string) {
    super(message);
    this.name = 'DeviceConnectionException';
  }
}
