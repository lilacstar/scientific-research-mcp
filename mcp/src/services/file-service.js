/**
 * 文件操作服务
 * 封装论文工作区的文件读写操作
 * 
 * 目录结构：
 * paper/
 * ├── current/      - 当前终稿
 * ├── versions/     - 历史版本
 * ├── drafts/       - 写作草稿
 * ├── backups/      - 自动备份
 * ├── docs/         - 项目文档
 * └── reports/      - 验证报告
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
 * 自动备份文件
 * 在修改文件前创建带时间戳的备份副本
 */
export async function autoBackup(filePath) {
  const exists = await fileExists(filePath);
  if (!exists) {
    return false; // 文件不存在，无需备份
  }
  
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);
  const dirName = path.dirname(filePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const backupPath = path.join(dirName, `${baseName}.backup.${timestamp}${ext}`);
  
  await copyFile(filePath, backupPath);
  return true;
}
