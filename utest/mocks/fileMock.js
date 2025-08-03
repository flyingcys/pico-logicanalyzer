/**
 * 文件操作Mock
 * 用于Jest测试中模拟文件系统操作
 */

module.exports = {
  // 模拟文件读取
  readFileSync: jest.fn((path) => {
    if (path.includes('package.json')) {
      return JSON.stringify({
        name: 'mock-package',
        version: '1.0.0',
        description: 'Mock package for testing'
      });
    }
    if (path.includes('.lac')) {
      return Buffer.from('mock lac file content');
    }
    return 'mock file content';
  }),
  
  // 模拟文件写入
  writeFileSync: jest.fn(),
  
  // 模拟文件存在检查
  existsSync: jest.fn(() => true),
  
  // 模拟目录创建
  mkdirSync: jest.fn(),
  
  // 模拟文件状态获取
  statSync: jest.fn(() => ({
    isFile: () => true,
    isDirectory: () => false,
    size: 1024,
    mtime: new Date(),
    ctime: new Date()
  })),
  
  // 模拟目录读取
  readdirSync: jest.fn(() => ['file1.txt', 'file2.lac', 'subdir']),
  
  // 模拟文件删除
  unlinkSync: jest.fn(),
  
  // 模拟目录删除
  rmdirSync: jest.fn(),
  
  // 模拟文件复制
  copyFileSync: jest.fn(),
  
  // 模拟文件重命名
  renameSync: jest.fn(),
  
  // 模拟路径操作
  join: jest.fn((...paths) => paths.join('/')),
  dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/')),
  basename: jest.fn((path) => path.split('/').pop()),
  extname: jest.fn((path) => {
    const parts = path.split('.');
    return parts.length > 1 ? '.' + parts.pop() : '';
  }),
  
  // 模拟流操作
  createReadStream: jest.fn(() => ({
    on: jest.fn(),
    pipe: jest.fn(),
    close: jest.fn()
  })),
  
  createWriteStream: jest.fn(() => ({
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn()
  })),
  
  // 模拟异步文件操作
  promises: {
    readFile: jest.fn().mockResolvedValue('mock async file content'),
    writeFile: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(true),
    mkdir: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
      size: 1024,
      mtime: new Date(),
      ctime: new Date()
    }),
    readdir: jest.fn().mockResolvedValue(['file1.txt', 'file2.lac']),
    unlink: jest.fn().mockResolvedValue(undefined),
    rmdir: jest.fn().mockResolvedValue(undefined),
    copyFile: jest.fn().mockResolvedValue(undefined),
    rename: jest.fn().mockResolvedValue(undefined)
  }
};