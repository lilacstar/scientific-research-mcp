/**
 * 版本控制服务
 * 集成Git进行版本管理，支持变更摘要和版本对比
 */

import * as fs from 'fs/promises';
import * as path from 'path';

const PAPER_DIR = process.env.PAPER_DIR || path.join(process.cwd(), 'paper');

/**
 * 检查Git是否可用
 */
async function isGitAvailable() {
  try {
    const { execSync } = await import('child_process');
    execSync('git --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查目录是否已初始化Git
 */
async function isGitRepo() {
  try {
    const { execSync } = await import('child_process');
    execSync('git rev-parse --git-dir', { cwd: PAPER_DIR, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 初始化Git仓库
 */
export async function initGitRepo() {
  if (!await isGitAvailable()) {
    return { success: false, message: 'Git 未安装，请先安装 Git' };
  }
  
  if (await isGitRepo()) {
    return { success: true, message: 'Git 仓库已存在' };
  }
  
  try {
    const { execSync } = await import('child_process');
    execSync('git init', { cwd: PAPER_DIR, stdio: 'pipe' });
    
    // 创建.gitignore
    const gitignore = `# 自动备份
*.backup.*
backups/

# 临时文件
*.tmp
*.log

# 系统文件
.DS_Store
Thumbs.db
`;
    await fs.writeFile(path.join(PAPER_DIR, '.gitignore'), gitignore);
    
    // 初始提交
    execSync('git add .', { cwd: PAPER_DIR, stdio: 'pipe' });
    execSync('git commit -m "Initial commit: 论文项目初始化"', { cwd: PAPER_DIR, stdio: 'pipe' });
    
    return { success: true, message: 'Git 仓库初始化成功' };
  } catch (error) {
    return { success: false, message: `Git 初始化失败：${error.message}` };
  }
}

/**
 * 提交更改并创建版本标签
 */
export async function commitChanges(message, tagName = null) {
  if (!await isGitRepo()) {
    await initGitRepo();
  }
  
  try {
    const { execSync } = await import('child_process');
    
    // 添加所有更改
    execSync('git add .', { cwd: PAPER_DIR, stdio: 'pipe' });
    
    // 提交
    execSync(`git commit -m "${message}"`, { cwd: PAPER_DIR, stdio: 'pipe' });
    
    // 创建标签
    if (tagName) {
      execSync(`git tag -a "${tagName}" -m "${message}"`, { cwd: PAPER_DIR, stdio: 'pipe' });
    }
    
    return { success: true, message: '提交成功' };
  } catch (error) {
    // 如果没有更改需要提交
    if (error.message.includes('nothing to commit')) {
      return { success: true, message: '没有需要提交的更改' };
    }
    return { success: false, message: `提交失败：${error.message}` };
  }
}

/**
 * 获取提交历史
 */
export async function getGitLog(limit = 10) {
  try {
    const { execSync } = await import('child_process');
    const output = execSync(
      `git log --pretty=format:"%h|%an|%ad|%s" --date=short -${limit}`,
      { cwd: PAPER_DIR, encoding: 'utf-8' }
    );
    
    const commits = output.split('\n').filter(line => line.trim()).map(line => {
      const [hash, author, date, message] = line.split('|');
      return { hash, author, date, message };
    });
    
    return { success: true, commits };
  } catch (error) {
    return { success: false, message: `获取历史失败：${error.message}` };
  }
}

/**
 * 生成变更摘要
 */
export async function generateChangeSummary(fromRef, toRef = 'HEAD') {
  try {
    const { execSync } = await import('child_process');
    
    // 获取变更统计
    const statOutput = execSync(
      `git diff --stat ${fromRef}..${toRef}`,
      { cwd: PAPER_DIR, encoding: 'utf-8' }
    );
    
    // 获取详细变更
    const diffOutput = execSync(
      `git diff --name-status ${fromRef}..${toRef}`,
      { cwd: PAPER_DIR, encoding: 'utf-8' }
    );
    
    const files = diffOutput.split('\n').filter(line => line.trim()).map(line => {
      const [status, ...filePathParts] = line.split('\t');
      return { status: status.trim(), path: filePathParts.join('\t') };
    });
    
    // 统计变更类型
    const added = files.filter(f => f.status.startsWith('A')).length;
    const modified = files.filter(f => f.status.startsWith('M')).length;
    const deleted = files.filter(f => f.status.startsWith('D')).length;
    
    return {
      success: true,
      summary: statOutput,
      files,
      stats: { added, modified, deleted, total: files.length }
    };
  } catch (error) {
    return { success: false, message: `生成变更摘要失败：${error.message}` };
  }
}

/**
 * 版本对比
 */
export async function compareVersions(version1, version2) {
  try {
    const { execSync } = await import('child_process');
    
    // 获取两个版本之间的差异
    const diffOutput = execSync(
      `git diff ${version1}..${version2} -- .`,
      { cwd: PAPER_DIR, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
    
    // 统计变更
    const addedLines = (diffOutput.match(/^\+/gm) || []).length;
    const removedLines = (diffOutput.match(/^-/gm) || []).length;
    
    return {
      success: true,
      diff: diffOutput,
      stats: {
        addedLines,
        removedLines,
        totalChanges: addedLines + removedLines
      }
    };
  } catch (error) {
    return { success: false, message: `版本对比失败：${error.message}` };
  }
}

/**
 * 列出所有版本标签
 */
export async function listVersionTags() {
  try {
    const { execSync } = await import('child_process');
    const output = execSync('git tag -l --sort=-creatordate', { cwd: PAPER_DIR, encoding: 'utf-8' });
    
    const tags = output.split('\n').filter(tag => tag.trim());
    
    return { success: true, tags };
  } catch (error) {
    return { success: true, tags: [] }; // 没有标签
  }
}

/**
 * 获取当前工作区状态
 */
export async function getWorkingStatus() {
  try {
    const { execSync } = await import('child_process');
    const statusOutput = execSync('git status --short', { cwd: PAPER_DIR, encoding: 'utf-8' });
    
    const changed = statusOutput.split('\n').filter(line => line.trim());
    
    return {
      success: true,
      changed: changed.length > 0,
      changes: changed
    };
  } catch (error) {
    return { success: false, message: `获取状态失败：${error.message}` };
  }
}