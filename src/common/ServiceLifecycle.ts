/**
 * 统一服务生命周期管理接口
 * 定义所有服务类的标准生命周期方法和状态管理
 */

/**
 * 服务状态枚举
 */
/* eslint-disable no-unused-vars */
export enum ServiceState {
  NotInitialized = 'not_initialized',
  Initializing = 'initializing',
  Ready = 'ready',
  Error = 'error',
  Disposing = 'disposing',
  Disposed = 'disposed'
}
/* eslint-enable no-unused-vars */

/**
 * 服务初始化选项
 */
export interface ServiceInitOptions {
  timeout?: number;           // 初始化超时时间（毫秒）
  retryCount?: number;        // 重试次数
  dependencies?: string[];    // 依赖的其他服务
  config?: Record<string, any>; // 初始化配置
}

/**
 * 服务初始化结果
 */
export interface ServiceInitResult {
  success: boolean;
  state: ServiceState;
  error?: Error;
  metadata?: Record<string, any>;
}

/**
 * 服务销毁选项
 */
export interface ServiceDisposeOptions {
  force?: boolean;           // 强制销毁，即使有错误
  timeout?: number;          // 销毁超时时间
  cleanup?: boolean;         // 是否清理资源
}

/**
 * 统一服务生命周期接口
 * 所有服务类都应该实现此接口
 */
export interface IServiceLifecycle {
  /**
   * 服务名称（用于日志和调试）
   */
  readonly serviceName: string;

  /**
   * 当前服务状态
   */
  readonly state: ServiceState;

  /**
   * 服务是否已初始化
   */
  readonly isInitialized: boolean;

  /**
   * 服务是否准备就绪
   */
  readonly isReady: boolean;

  /**
   * 异步初始化服务
   * @param _options 初始化选项
   * @returns 初始化结果
   */
  initialize(_options?: ServiceInitOptions): Promise<ServiceInitResult>;

  /**
   * 异步销毁服务
   * @param _options 销毁选项
   * @returns 销毁是否成功
   */
  dispose(_options?: ServiceDisposeOptions): Promise<boolean>;

  /**
   * 重启服务（先销毁再初始化）
   * @param _options 重启选项
   * @returns 重启结果
   */
  restart?(_options?: ServiceInitOptions): Promise<ServiceInitResult>;

  /**
   * 健康检查
   * @returns 服务健康状态
   */
  healthCheck?(): Promise<boolean>;

  /**
   * 获取服务元数据
   * @returns 服务的元数据信息
   */
  getMetadata?(): Record<string, any>;
}

/**
 * 服务生命周期基类
 * 提供标准的生命周期管理实现
 */
export abstract class ServiceLifecycleBase implements IServiceLifecycle {
  protected _state: ServiceState = ServiceState.NotInitialized;
  protected _initPromise?: Promise<ServiceInitResult>;
  protected _disposePromise?: Promise<boolean>;
  protected _metadata: Record<string, any> = {};
  protected _activeTimeouts: Set<NodeJS.Timeout> = new Set();
  public readonly serviceName: string;

  constructor(
    serviceName: string
  ) {
    // 存储服务名称
    this.serviceName = serviceName;
    // 使用serviceName进行初始化日志
    this.updateMetadata({
      serviceName,
      initTimestamp: Date.now()
    });
  }

  /**
   * 当前服务状态
   */
  get state(): ServiceState {
    return this._state;
  }

  /**
   * 服务是否已初始化
   */
  get isInitialized(): boolean {
    return this._state !== ServiceState.NotInitialized;
  }

  /**
   * 服务是否准备就绪
   */
  get isReady(): boolean {
    return this._state === ServiceState.Ready;
  }

  /**
   * 异步初始化服务
   */
  async initialize(options: ServiceInitOptions = {}): Promise<ServiceInitResult> {
    // 如果正在初始化，返回当前的初始化Promise
    if (this._initPromise) {
      return this._initPromise;
    }

    // 如果已经初始化，直接返回成功
    if (this.isReady) {
      return {
        success: true,
        state: this._state
      };
    }

    // 执行初始化
    this._initPromise = this._performInitialization(options);
    return this._initPromise;
  }

  /**
   * 异步销毁服务
   */
  async dispose(options: ServiceDisposeOptions = {}): Promise<boolean> {
    // 如果正在销毁，返回当前的销毁Promise
    if (this._disposePromise) {
      return this._disposePromise;
    }

    // 如果已经销毁，直接返回成功
    if (this._state === ServiceState.Disposed) {
      return true;
    }

    // 执行销毁
    this._disposePromise = this._performDispose(options);
    return this._disposePromise;
  }

  /**
   * 重启服务
   */
  async restart(options: ServiceInitOptions = {}): Promise<ServiceInitResult> {
    await this.dispose();
    this._initPromise = undefined;
    this._disposePromise = undefined;
    return this.initialize(options);
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    return this.isReady;
  }

  /**
   * 获取服务元数据
   */
  getMetadata(): Record<string, any> {
    return {
      ...this._metadata,
      serviceName: this.serviceName,
      state: this._state,
      isInitialized: this.isInitialized,
      isReady: this.isReady
    };
  }

  /**
   * 执行具体的初始化逻辑（子类实现）
   */
  protected async _performInitialization(options: ServiceInitOptions): Promise<ServiceInitResult> {
    try {
      this._state = ServiceState.Initializing;

      // 设置超时
      const timeout = options.timeout || 30000; // 默认30秒
      let timeoutId: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          this._activeTimeouts.delete(timeoutId);
          reject(new Error(`服务初始化超时: ${this.serviceName}`));
        }, timeout);
        this._activeTimeouts.add(timeoutId);
      });

      // 执行子类的初始化逻辑
      const initPromise = this.onInitialize(options);
      
      try {
        await Promise.race([initPromise, timeoutPromise]);
        // 初始化成功，清理超时
        if (timeoutId) {
          clearTimeout(timeoutId);
          this._activeTimeouts.delete(timeoutId);
        }
      } catch (error) {
        // 初始化失败，确保清理超时
        if (timeoutId) {
          clearTimeout(timeoutId);
          this._activeTimeouts.delete(timeoutId);
        }
        throw error;
      }

      this._state = ServiceState.Ready;
      return {
        success: true,
        state: this._state
      };

    } catch (error) {
      this._state = ServiceState.Error;
      return {
        success: false,
        state: this._state,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * 执行具体的销毁逻辑
   */
  protected async _performDispose(options: ServiceDisposeOptions): Promise<boolean> {
    try {
      this._state = ServiceState.Disposing;

      // 设置超时
      const timeout = options.timeout || 10000; // 默认10秒
      let timeoutId: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          this._activeTimeouts.delete(timeoutId);
          reject(new Error(`服务销毁超时: ${this.serviceName}`));
        }, timeout);
        this._activeTimeouts.add(timeoutId);
      });

      // 执行子类的销毁逻辑
      const disposePromise = this.onDispose(options);
      
      try {
        await Promise.race([disposePromise, timeoutPromise]);
        // 销毁成功，清理超时
        if (timeoutId) {
          clearTimeout(timeoutId);
          this._activeTimeouts.delete(timeoutId);
        }
      } catch (error) {
        // 销毁失败，确保清理超时
        if (timeoutId) {
          clearTimeout(timeoutId);
          this._activeTimeouts.delete(timeoutId);
        }
        throw error;
      }

      this._state = ServiceState.Disposed;
      // 确保清理所有定时器
      this.cleanupActiveTimeouts();
      return true;

    } catch (error) {
      if (options.force) {
        this._state = ServiceState.Disposed;
        // 强制销毁时也要清理定时器
        this.cleanupActiveTimeouts();
        return true;
      }
      this._state = ServiceState.Error;
      return false;
    }
  }

  /**
   * 清理所有活跃的定时器
   */
  protected cleanupActiveTimeouts(): void {
    for (const timeoutId of this._activeTimeouts) {
      clearTimeout(timeoutId);
    }
    this._activeTimeouts.clear();
  }

  /**
   * 子类实现的初始化逻辑
   */
  protected abstract onInitialize(_options: ServiceInitOptions): Promise<void>;

  /**
   * 子类实现的销毁逻辑
   */
  protected abstract onDispose(_options: ServiceDisposeOptions): Promise<void>;

  /**
   * 更新服务元数据
   */
  protected updateMetadata(metadata: Record<string, any>): void {
    this._metadata = { ...this._metadata, ...metadata };
  }
}

/**
 * 服务管理器
 * 管理多个服务的生命周期
 */
export class ServiceManager {
  private services: Map<string, IServiceLifecycle> = new Map();
  private dependencies: Map<string, string[]> = new Map();

  /**
   * 注册服务
   */
  registerService(service: IServiceLifecycle, dependencies: string[] = []): void {
    this.services.set(service.serviceName, service);
    this.dependencies.set(service.serviceName, dependencies);
  }

  /**
   * 获取服务
   */
  getService<T extends IServiceLifecycle>(serviceName: string): T | undefined {
    return this.services.get(serviceName) as T;
  }

  /**
   * 初始化所有服务（按依赖顺序）
   */
  async initializeAll(options: ServiceInitOptions = {}): Promise<Map<string, ServiceInitResult>> {
    const results = new Map<string, ServiceInitResult>();
    const initialized = new Set<string>();

    // 递归初始化服务及其依赖
    const initializeService = async (serviceName: string): Promise<ServiceInitResult> => {
      if (initialized.has(serviceName)) {
        return results.get(serviceName)!;
      }

      const service = this.services.get(serviceName);
      if (!service) {
        throw new Error(`服务未找到: ${serviceName}`);
      }

      // 先初始化依赖服务
      const deps = this.dependencies.get(serviceName) || [];
      for (const dep of deps) {
        await initializeService(dep);
      }

      // 初始化当前服务
      const result = await service.initialize(options);
      results.set(serviceName, result);
      initialized.add(serviceName);

      return result;
    };

    // 初始化所有服务
    for (const serviceName of this.services.keys()) {
      await initializeService(serviceName);
    }

    return results;
  }

  /**
   * 销毁所有服务（按反向依赖顺序）
   */
  async disposeAll(options: ServiceDisposeOptions = {}): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    // 反向顺序销毁
    const serviceNames = Array.from(this.services.keys()).reverse();
    for (const serviceName of serviceNames) {
      const service = this.services.get(serviceName)!;
      const result = await service.dispose(options);
      results.set(serviceName, result);
    }

    return results;
  }

  /**
   * 获取所有服务的健康状态
   */
  async getHealthStatus(): Promise<Map<string, boolean>> {
    const status = new Map<string, boolean>();

    for (const [name, service] of this.services) {
      try {
        const health = await service.healthCheck?.() || service.isReady;
        status.set(name, health);
      } catch {
        status.set(name, false);
      }
    }

    return status;
  }
}

// 全局服务管理器实例
export const globalServiceManager = new ServiceManager();
