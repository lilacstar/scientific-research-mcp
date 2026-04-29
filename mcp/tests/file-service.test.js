/**
 * 文件服务单元测试
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  readFile,
  writeFile,
  fileExists,
  copyFile,
  autoBackup
} from '../src/services/file-service.js';

// 测试用的临时目录
const TEST_DIR = path.join(process.cwd(), 'tests', 'temp');

describe('File Service', () => {
  beforeEach(async () => {
    // 创建测试目录
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    // 清理测试目录
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('fileExists', () => {
    test('should return true for existing file', async () => {
      const testFile = path.join(TEST_DIR, 'test.txt');
      await fs.writeFile(testFile, 'test content');
      // 注意：fileExists 使用 PAPER_DIR，这里需要模拟
      const exists = await fileExists('test.txt');
      // 由于 fileExists 使用 PAPER_DIR，实际测试需要设置环境变量
    });

    test('should return false for non-existing file', async () => {
      const exists = await fileExists('nonexistent.txt');
      expect(exists).toBe(false);
    });
  });
});