/**
 * 文件操作服务
 * 封装论文工作区的文件读写操作
 * 
 * ## 目录结构：
 * paper/
 * ├── current/      - 当前终稿（最新版本）
 * ├── versions/     - 历史版本归档
 * ├── drafts/       - 写作草稿
 * ├── backups/      - 自动备份（修改前）
 * ├── docs/         - 项目文档
 * ├── references/   - 参考文献原始文件
 * └── reports/      - 验证报告
 * 
 * ## 文件命名规范：
 * 详见 paper/docs/文件命名规范.md
 * 
 * 当前有效版本格式：v{主版本}.{次版本}_{描述}.md
 * - 主版本：重大变更（如重构、大量重写）
 * - 次版本：小修改（如精简、格式调整）
 * - 描述：版本特征说明（如 终稿、精简版、投稿格式版）
 * 
 * **最新有效版本**永远是 current/ 目录下版本号最高的文件。
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { resolvePath } from './path-resolver.js';

const PAPER_DIR = process.env.PAPER_DIR || path.join(process.cwd(), 'paper');

// 子目录路径
const CURRENT_DIR = path.join(PAPER_DIR, 'current');
const VERSIONS_DIR = path.join(PAPER_DIR, 'versions');
const DRAFTS_DIR = path.join(PAPER_DIR, 'drafts');
const BACKUPS_DIR = path.join(PAPER_DIR, 'backups');
const DOCS_DIR = path.join(PAPER_DIR, 'docs');
const REPORTS_DIR = path.join(PAPER_DIR, 'reports');

/**
 * 确保所有子目录存在
 */
export async function ensurePaperDir() {
  await fs.mkdir(CURRENT_DIR, { recursive: true });
  await fs.mkdir(VERSIONS_DIR, { recursive: true });
  await fs.mkdir(DRAFTS_DIR, { recursive: true });
  await fs.mkdir(BACKUPS_DIR, { recursive: true });
  await fs.mkdir(DOCS_DIR, { recursive: true });
  await fs.mkdir(REPORTS_DIR, { recursive: true });
}

/**
 * 读取文件内容（自动解析路径）
 */
export async function readFile(filePath) {
  // 如果路径包含子目录标识，直接拼接
  if (filePath.startsWith('current/') || filePath.startsWith('versions/') || 
      filePath.startsWith('drafts/') || filePath.startsWith('backups/') ||
      filePath.startsWith('docs/') || filePath.startsWith('reports/')) {
    const fullPath = path.join(PAPER_DIR, filePath);
    return await fs.readFile(fullPath, 'utf-8');
  }
  // 默认路径映射：draft-*.md → drafts/，metadata.json → docs/ 等
  if (filePath.startsWith('draft-')) {
    const fullPath = path.join(DRAFTS_DIR, filePath);
    return await fs.readFile(fullPath, 'utf-8');
  }
  if (filePath === 'metadata.json' || filePath === 'progress.md' || 
      filePath === 'outline.md' || filePath === 'changelog.md' ||
      filePath === 'search-keywords.md') {
    const fullPath = path.join(DOCS_DIR, filePath);
    return await fs.readFile(fullPath, 'utf-8');
  }
  // 向后兼容：尝试原始路径
  const fullPath = path.join(PAPER_DIR, filePath);
  return await fs.readFile(fullPath, 'utf-8');
}

/**
 * 写入文件内容（自动解析路径）
 */
export async function writeFile(filePath, content, encoding = 'utf-8') {
  let fullPath;
  if (filePath.startsWith('current/') || filePath.startsWith('versions/') || 
      filePath.startsWith('drafts/') || filePath.startsWith('backups/') ||
      filePath.startsWith('docs/') || filePath.startsWith('reports/')) {
    fullPath = path.join(PAPER_DIR, filePath);
  } else if (filePath.startsWith('draft-')) {
    fullPath = path.join(DRAFTS_DIR, filePath);
  } else if (filePath === 'metadata.json' || filePath === 'progress.md' || 
      filePath === 'outline.md' || filePath === 'changelog.md' ||
      filePath === 'search-keywords.md') {
    fullPath = path.join(DOCS_DIR, filePath);
  } else {
    fullPath = path.join(PAPER_DIR, filePath);
  }
  await fs.writeFile(fullPath, content, encoding);
}

/**
 * 检查文件是否存在
 */
export async function fileExists(filePath) {
  const fullPath = path.join(PAPER_DIR, filePath);
  try {
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 读取元数据
 */
export async function readMetadata() {
  const content = await readFile('metadata.json');
  return JSON.parse(content);
}

/**
 * 写入元数据
 */
export async function writeMetadata(metadata) {
  await writeFile('metadata.json', JSON.stringify(metadata, null, 2));
}

/**
 * 读取进度文件
 */
export async function readProgress() {
  return await readFile('progress.md');
}

/**
 * 写入进度文件
 */
export async function writeProgress(content) {
  await writeFile('progress.md', content);
}

/**
 * 读取章节草稿
 */
export async function readChapterDraft(chapter) {
  return await readFile(`draft-${chapter}.md`);
}

/**
 * 写入章节草稿
 */
export async function writeChapterDraft(chapter, content) {
  await writeFile(`draft-${chapter}.md`, content);
}

/**
 * 读取参考资料
 */
export async function readReference(filePath) {
  const SHARED_DIR = path.join(__dirname, '../../../shared');
  const REFERENCES_DIR = path.join(SHARED_DIR, 'references');
  const fullPath = path.join(REFERENCES_DIR, filePath);
  return await fs.readFile(fullPath, 'utf-8');
}

/**
 * 读取提示词模板
 */
export async function readPromptTemplate(filePath) {
  const SHARED_DIR = path.join(__dirname, '../../../shared');
  const PROMPTS_DIR = path.join(SHARED_DIR, 'prompts');
  const fullPath = path.join(PROMPTS_DIR, filePath);
  return await fs.readFile(fullPath, 'utf-8');
}

/**
 * 复制文件（用于自动备份）
 */
export async function copyFile(sourcePath, destPath) {
  const fullSourcePath = path.join(PAPER_DIR, sourcePath);
  const fullDestPath = path.join(PAPER_DIR, destPath);
  await fs.copyFile(fullSourcePath, fullDestPath);
}

/**
 * 获取完整文件路径
 */
function getFullPath(filePath) {
  if (filePath.startsWith('current/') || filePath.startsWith('versions/') || 
      filePath.startsWith('drafts/') || filePath.startsWith('backups/') ||
      filePath.startsWith('docs/') || filePath.startsWith('reports/')) {
    return path.join(PAPER_DIR, filePath);
  }
  if (filePath.startsWith('draft-')) {
    return path.join(DRAFTS_DIR, filePath);
  }
  if (filePath === 'metadata.json' || filePath === 'progress.md' || 
      filePath === 'outline.md' || filePath === 'changelog.md' ||
      filePath === 'search-keywords.md') {
    return path.join(DOCS_DIR, filePath);
  }
  return path.join(PAPER_DIR, filePath);
}

/**
 * 解析版本号字符串
 * @param {string} filename - 文件名
 * @returns {string|null} 版本号字符串或null
 */
export function parseVersion(filename) {
  const match = filename.match(/^v(\d+\.\d+)_/);
  return match ? match[1] : null;
}

/**
 * 比较两个版本号
 * @param {string} v1 - 版本号1
 * @param {string} v2 - 版本号2
 * @returns {number} 1 if v1>v2, -1 if v1<v2, 0 if equal
 */
export function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

/**
 * 自动归档旧版本
 * 在写入新版本到 current/ 前，将当前目录中的旧版本归档至 versions/
 * 
 * @param {string} newFilename - 新文件名（如 v2.4_精简版.md）
 * @returns {Promise<object>} 归档结果
 */
export async function autoArchiveOldVersions(newFilename) {
  try {
    const newVersion = parseVersion(newFilename);
    if (!newVersion) {
      return { success: false, reason: '无法解析新版本号', archivedFiles: [] };
    }
    
    // 读取 current/ 目录
    const currentFiles = await fs.readdir(CURRENT_DIR);
    const versionedFiles = currentFiles.filter(f => f.endsWith('.md') && parseVersion(f));
    
    const archivedFiles = [];
    
    for (const file of versionedFiles) {
      const oldVersion = parseVersion(file);
      // 如果旧版本号小于新版本号，归档
      if (oldVersion && compareVersions(oldVersion, newVersion) < 0) {
        const sourcePath = path.join(CURRENT_DIR, file);
        const destPath = path.join(VERSIONS_DIR, file);
        await fs.copyFile(sourcePath, destPath);
        await fs.unlink(sourcePath); // 删除原文件
        archivedFiles.push(file);
      }
    }
    
    return { success: true, archivedFiles };
  } catch (error) {
    return { success: false, reason: error.message, archivedFiles: [] };
  }
}

/**
 * 自动备份文件
 * 在修改文件前创建带时间戳的备份副本
 * 
 * @param {string} filePath - 要备份的文件路径
 * @param {object} options - 可选参数
 * @param {number} options.maxRetries - 最大重试次数（默认3）
 * @param {number} options.retryDelay - 重试延迟毫秒（默认1000）
 * @returns {Promise<object>} 备份结果
 *   - success: 是否成功
 *   - backupPath: 备份文件完整路径
 *   - reason: 失败原因
 *   - fileSize: 备份文件大小（字节）
 */
export async function autoBackup(filePath, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const retryDelay = options.retryDelay || 1000;
  
  const fullPath = getFullPath(filePath);
  
  // 检查原文件是否存在
  try {
    await fs.access(fullPath);
  } catch {
    return { 
      success: false, 
      reason: '文件不存在',
      backupPath: null 
    };
  }
  
  // 获取原文件大小（用于验证备份完整性）
  let originalSize;
  try {
    const stats = await fs.stat(fullPath);
    originalSize = stats.size;
  } catch (error) {
    return { 
      success: false, 
      reason: `无法读取文件信息：${error.message}`,
      backupPath: null 
    };
  }
  
  // 生成备份路径
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);
  const dirName = path.dirname(filePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `${baseName}.backup.${timestamp}${ext}`;
  const fullBackupPath = path.join(PAPER_DIR, dirName, backupFileName);
  
  // 尝试备份（带重试）
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 确保备份目录存在
      await fs.mkdir(path.dirname(fullBackupPath), { recursive: true });
      
      // 复制文件
      await fs.copyFile(fullPath, fullBackupPath);
      
      // 验证备份文件
      const backupStats = await fs.stat(fullBackupPath);
      
      // 检查备份文件大小是否一致
      if (backupStats.size !== originalSize) {
        throw new Error(`备份文件大小不一致（原文件：${originalSize}字节，备份：${backupStats.size}字节）`);
      }
      
      // 备份成功
      return { 
        success: true,
        backupPath: fullBackupPath,
        fileSize: backupStats.size,
        timestamp: timestamp
      };
      
    } catch (error) {
      // 最后一次尝试失败
      if (attempt === maxRetries) {
        return { 
          success: false, 
          reason: `备份失败（已重试${maxRetries}次）：${error.message}`,
          backupPath: null 
        };
      }
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
    }
  }
}
