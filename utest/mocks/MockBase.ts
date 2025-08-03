/**
 * Mock基类
 * 提供所有Mock对象的通用功能
 */

export interface MethodCall {
  method: string;
  args: any[];
  timestamp: number;
}

export class MockBase {
  private _methodCalls: MethodCall[] = [];
  
  /**
   * 记录方法调用
   */
  protected recordCall(method: string, args: any[]): void {
    this._methodCalls.push({
      method,
      args: args.map(arg => this._cloneArg(arg)),
      timestamp: Date.now()
    });
  }
  
  /**
   * 获取方法调用历史
   */
  public getMethodCalls(): MethodCall[] {
    return [...this._methodCalls];
  }
  
  /**
   * 获取特定方法的调用次数
   */
  public getCallCount(method: string): number {
    return this._methodCalls.filter(call => call.method === method).length;
  }
  
  /**
   * 获取最后一次方法调用
   */
  public getLastCall(method?: string): MethodCall | undefined {
    if (method) {
      const calls = this._methodCalls.filter(call => call.method === method);
      return calls[calls.length - 1];
    }
    return this._methodCalls[this._methodCalls.length - 1];
  }
  
  /**
   * 获取特定方法的所有调用
   */
  public getCallsFor(method: string): MethodCall[] {
    return this._methodCalls.filter(call => call.method === method);
  }
  
  /**
   * 检查方法是否被调用过
   */
  public wasMethodCalled(method: string): boolean {
    return this._methodCalls.some(call => call.method === method);
  }
  
  /**
   * 检查方法是否以特定参数被调用过
   */
  public wasCalledWith(method: string, expectedArgs: any[]): boolean {
    return this._methodCalls.some(call => 
      call.method === method && 
      this._argsMatch(call.args, expectedArgs)
    );
  }
  
  /**
   * 清除调用历史
   */
  public clearHistory(): void {
    this._methodCalls = [];
  }
  
  /**
   * 重置Mock状态
   */
  public reset(): void {
    this.clearHistory();
  }
  
  /**
   * 验证方法调用序列
   */
  public verifyCallSequence(expectedSequence: string[]): boolean {
    if (this._methodCalls.length !== expectedSequence.length) {
      return false;
    }
    
    return this._methodCalls.every((call, index) => 
      call.method === expectedSequence[index]
    );
  }
  
  /**
   * 获取调用统计信息
   */
  public getCallStatistics(): { [method: string]: number } {
    const stats: { [method: string]: number } = {};
    
    for (const call of this._methodCalls) {
      stats[call.method] = (stats[call.method] || 0) + 1;
    }
    
    return stats;
  }
  
  // 私有辅助方法
  private _cloneArg(arg: any): any {
    try {
      if (arg === null || arg === undefined) {
        return arg;
      }
      
      if (typeof arg === 'function') {
        return '[Function]';
      }
      
      if (arg instanceof Date) {
        return new Date(arg.getTime());
      }
      
      if (arg instanceof Array) {
        return arg.map(item => this._cloneArg(item));
      }
      
      if (typeof arg === 'object') {
        return JSON.parse(JSON.stringify(arg));
      }
      
      return arg;
    } catch (error) {
      return '[Uncloneable Object]';
    }
  }
  
  private _argsMatch(actual: any[], expected: any[]): boolean {
    if (actual.length !== expected.length) {
      return false;
    }
    
    return actual.every((arg, index) => 
      this._deepEqual(arg, expected[index])
    );
  }
  
  private _deepEqual(a: any, b: any): boolean {
    if (a === b) {
      return true;
    }
    
    if (a == null || b == null) {
      return a === b;
    }
    
    if (typeof a !== typeof b) {
      return false;
    }
    
    if (typeof a === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      
      if (keysA.length !== keysB.length) {
        return false;
      }
      
      return keysA.every(key => 
        keysB.includes(key) && this._deepEqual(a[key], b[key])
      );
    }
    
    return false;
  }
}