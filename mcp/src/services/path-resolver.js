/**
 * 路径解析服务
 * 提供智能的文件路径匹配和补全功能
 */

import * as fs from 'fs/promises';
import * as path from 'path';

const PAPER_DIR = process.env.PAPER_DIR || path.join(process.cwd(), 'paper');

/**
 * 智能路径查找
 * 支持模糊匹配和自动搜索
 */
export async function resolvePath(queryPath) {
  // 1. 如果是绝对路径且存在，直接返回
  if (path.isAbsolute(queryPath)) {
    if (await fileExists(queryPath)) {
      return queryPath;
    }
  }

  // 2. 相对于paper目录的路径
  const paperRelative = path.join(PAPER_DIR, queryPath);
  if (await fileExists(paperRelative)) {
    return paperRelative;
  }

  // 3. 在paper目录及其子目录中搜索
  const found = await searchFile(PAPER_DIR, path.basename(queryPath));
  if (found) {
    return found;
  }

  // 4. 如果提供了没有扩展名的路径，尝试常见扩展名
  const extensions = ['.md', '.txt', '.pdf', '.docx', '.json'];
  for (const ext of extensions) {
    const withExt = queryPath + ext;
    const paperRelativeWithExt = path.join(PAPER_DIR, withExt);
    if (await fileExists(paperRelativeWithExt)) {
      return paperRelativeWithExt;
    }
  }

  // 5. 返回null表示未找到
  return null;
}

/**
 * 递归搜索文件
 */
export async function searchFile(dir, fileName) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isFile() && entry.name === fileName) {
        return fullPath;
      }
      
      if (entry.isDirectory()) {
        // 跳过node_modules等目录
        if (['node_modules', '.git', '__pycache__'].includes(entry.name)) {
          continue;
        }
        const found = await searchFile(fullPath, fileName);
        if (found) return found;
      }
    }
  } catch {
    // 忽略无法访问的目录
  }
  
  return null;
}

/**
 * 检查文件是否存在
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 列出指定目录下的所有文件（用于路径补全）
 */
export async function listFilesInDir(dir, pattern = '*') {
  const fullPath = path.isAbsolute(dir) ? dir : path.join(PAPER_DIR, dir);
  const results = [];
  
  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isFile()) {
        if (pattern === '*' || entry.name.includes(pattern)) {
          results.push({
            name: entry.name,
            path: path.join(fullPath, entry.name),
            relativePath: path.relative(PAPER_DIR, path.join(fullPath, entry.name))
          });
        }
      }
    }
  } catch {
    // 忽略无法访问的目录
  }
  
  return results;
}

/**
 * 获取论文工作区目录结构
 */
export async function getPaperDirStructure() {
  const structure = {
    name: 'paper',
    path: PAPER_DIR,
    children: []
  };
  
  try {
    const entries = await fs.readdir(PAPER_DIR, { withFileTypes: true });
    
    for (const entry of entries) {
      const childEntry = {
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file'
      };
      
      if (entry.isDirectory()) {
        childEntry.children = [];
        try {
          const subEntries = await fs.readdir(path.join(PAPER_DIR, entry.name), { withFileTypes: true });
          for (const sub of subEntries) {
            childEntry.children.push({
              name: sub.name,
              type: sub.isDirectory() ? 'directory' : 'file'
            });
          }
        } catch {
          // 忽略
        }
      }
      
      structure.children.push(childEntry);
    }
  } catch {
    // 忽略
  }
  
  return structure;
}