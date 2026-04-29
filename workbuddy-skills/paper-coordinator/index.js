/**
 * Paper Coordinator Skill for WorkBuddy
 * 科学论文写作总协调器
 * 
 * 此Skill与MCP Server共享核心文件，实现双端适配
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 共享核心路径
const SHARED_DIR = path.resolve(__dirname, '../../shared');
const PROMPTS_DIR = path.join(SHARED_DIR, 'prompts');
const PROTOCOLS_DIR = path.join(SHARED_DIR, 'protocols');
const REFERENCES_DIR = path.join(SHARED_DIR, 'references');

// 论文工作区路径
const PAPER_DIR = process.env.PAPER_DIR || path.join(process.cwd(), 'paper');

/**
 * Skill配置
 */
export const config = {
  name: 'paper-coordinator',
  version: '1.0.0',
  description: '科学论文写作总协调器',
  sharedCore: '../../shared'
};

/**
 * Skill主函数
 */
export async function execute(input) {
  const { action, paperType, researchTopic, targetJournal } = input;

  switch (action) {
    case 'init':
      return await initProject(paperType, researchTopic, targetJournal);
    case 'progress':
      return await showProgress();
    case 'recommend':
      return await recommendNextStep();
    case 'merge':
      return await mergeFullDraft();
    case 'export':
      return await exportDraft();
    case 'check-gate':
      return await checkGate();
    case 'save-version':
      return await saveVersion(input.version, input.description, input.sourceFile);
    default:
      return { success: false, message: `未知操作: ${action}` };
  }
}

/**
 * 初始化论文项目
 */
async function initProject(paperType, researchTopic, targetJournal) {
  if (!paperType || !researchTopic) {
    return {
      success: false,
      message: '缺少必要参数：paperType, researchTopic'
    };
  }

  await fs.mkdir(PAPER_DIR, { recursive: true });

  const metadata = {
    paperType,
    language: paperType === 'english-journal' ? 'en' : 'zh',
    researchTopic,
    targetJournal: targetJournal || '未确定',
    citationStyle: 'GB/T 7714',
    currentPhase: 'topic',
    version: 'v1',
    createdAt: new Date().toISOString().split('T')[0],
    lastModified: new Date().toISOString().split('T')[0]
  };

  await fs.writeFile(
    path.join(PAPER_DIR, 'metadata.json'),
    JSON.stringify(metadata, null, 2),
    'utf-8'
  );

  // 读取共享协议
  const progressProtocol = await fs.readFile(
    path.join(PROTOCOLS_DIR, 'progress-update-protocol.md'),
    'utf-8'
  );

  await fs.writeFile(
    path.join(PAPER_DIR, 'progress.md'),
    generateProgressContent(progressProtocol),
    'utf-8'
  );

  return {
    success: true,
    message: `论文项目初始化成功！研究方向：${researchTopic}`,
    paperDir: PAPER_DIR
  };
}

/**
 * 生成进度内容
 */
function generateProgressContent(protocol) {
  return `# 论文写作进度

## 阶段状态

| 阶段 | 状态 | 最后更新 |
|------|------|---------|
| 文献调研 | 待处理 | - |
| 研究设计 | 待处理 | - |
| 数据分析 | 待处理 | - |
| 论文写作 | 待处理 | - |
| 摘要标题 | 待处理 | - |
| 审校润色 | 待处理 | - |
`;
}

/**
 * 显示进度
 */
async function showProgress() {
  try {
    const metadata = JSON.parse(
      await fs.readFile(path.join(PAPER_DIR, 'metadata.json'), 'utf-8')
    );
    const progress = await fs.readFile(path.join(PAPER_DIR, 'progress.md'), 'utf-8');

    return {
      success: true,
      metadata,
      progress
    };
  } catch (error) {
    return {
      success: false,
      message: '未找到论文项目，请先初始化'
    };
  }
}

/**
 * 推荐下一步
 */
async function recommendNextStep() {
  try {
    const metadata = JSON.parse(
      await fs.readFile(path.join(PAPER_DIR, 'metadata.json'), 'utf-8')
    );

    const recommendations = {
      'topic': '使用literature-reviewer进行文献调研',
      'literature': '使用paper-writer开始撰写论文章节',
      'writing': '继续完成剩余章节的写作',
      'abstract': '使用abstract-writer生成摘要',
      'polish': '使用paper-polisher进行润色',
      'verify': '使用verify-content进行内容验证',
      'export': '使用export导出论文'
    };

    return {
      success: true,
      recommendation: recommendations[metadata.currentPhase] || '初始化项目',
      currentPhase: metadata.currentPhase
    };
  } catch (error) {
    return {
      success: false,
      message: '未找到论文项目'
    };
  }
}

/**
 * 合并全文
 */
async function mergeFullDraft() {
  const chapters = [
    { file: 'draft-intro.md', name: '引言' },
    { file: 'draft-methods.md', name: '方法' },
    { file: 'draft-results.md', name: '结果' },
    { file: 'draft-discussion.md', name: '讨论' },
    { file: 'draft-conclusion.md', name: '结论' }
  ];

  let fullContent = '# 论文完整草稿\n\n';
  let mergedCount = 0;

  for (const chapter of chapters) {
    try {
      const content = await fs.readFile(path.join(PAPER_DIR, chapter.file), 'utf-8');
      fullContent += `\n---\n\n## ${chapter.name}\n\n${content}`;
      mergedCount++;
    } catch {
      // 章节不存在，跳过
    }
  }

  if (mergedCount === 0) {
    return { success: false, message: '没有可合并的章节' };
  }

  await fs.writeFile(path.join(PAPER_DIR, 'draft-full.md'), fullContent, 'utf-8');

  return {
    success: true,
    message: `已合并 ${mergedCount} 个章节`,
    outputFile: 'draft-full.md'
  };
}

/**
 * 导出草稿
 */
async function exportDraft() {
  return {
    success: true,
    message: '导出功能需要安装额外的依赖（fpdf2或python-docx）',
    commands: [
      'python md2pdf.py paper/draft-full.md output/终稿.pdf',
      'python md2docx.py paper/draft-full.md output/终稿.docx'
    ]
  };
}

/**
 * 定稿门控检查
 */
async function checkGate() {
  try {
    const progress = await fs.readFile(path.join(PAPER_DIR, 'progress.md'), 'utf-8');
    
    const issues = [];
    if (progress.includes('未执行')) {
      issues.push('验证覆盖率不足：存在未执行的验证项');
    }
    if (progress.includes('❌')) {
      issues.push('存在未解决的致命问题');
    }

    if (issues.length === 0) {
      return { success: true, message: '定稿门控检查通过！' };
    }

    return {
      success: false,
      message: '定稿门控检查未通过',
      issues
    };
  } catch (error) {
    return { success: false, message: '未找到论文项目' };
  }
}

/**
 * 保存版本
 */
async function saveVersion(version, description, sourceFile) {
  try {
    const source = sourceFile || 'current/v2.2_终稿.md';
    const content = await fs.readFile(path.join(PAPER_DIR, source), 'utf-8');
    
    const targetFile = `versions/${version}_${description}.md`;
    await fs.writeFile(path.join(PAPER_DIR, targetFile), content, 'utf-8');

    return {
      success: true,
      message: `版本 ${version} 已保存`,
      outputFile: targetFile
    };
  } catch (error) {
    return { success: false, message: `版本保存失败: ${error.message}` };
  }
}