// 简单测试performance Mock是否工作
let performanceCounter = 1000;

const mockPerformance = {
  now: () => {
    console.log('performance.now called, current counter:', performanceCounter);
    const current = performanceCounter;
    performanceCounter += 10;
    return current;
  }
};

// 替换全局performance对象
Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true
});

console.log('Testing performance mock...');
const start = performance.now();
console.log('start:', start);
const end = performance.now();
console.log('end:', end);
console.log('difference:', end - start);