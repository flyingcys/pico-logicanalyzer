// 调试performance Mock
let performanceCounter = 1000;

const mockNow = () => {
  const current = performanceCounter;
  performanceCounter += 15;
  console.log(`performance.now() called, returning: ${current}`);
  return current;
};

// 替换global performance
Object.defineProperty(global, 'performance', {
  value: { now: mockNow },
  writable: true
});

console.log('Testing performance mock...');
const start = performance.now();
const end = performance.now();
console.log(`start: ${start}, end: ${end}, diff: ${end - start}`);