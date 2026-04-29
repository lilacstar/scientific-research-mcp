/**
 * Paper Writer Skill for WorkBuddy
 * 论文写作引擎
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SHARED_DIR = path.resolve(__dirname, '../../shared');
const PROMPTS_DIR = path.join(SHARED_DIR, 'prompts');
const REFERENCES_DIR = path.join(SHARED_DIR, 'references');
const PAPER_DIR = process.env.PAPER_DIR || path.join(process.cwd(), 'paper');

export const config = {
  name: 'paper-writer',
  version: '1.0.0',
  description: '论文写作引擎',
  sharedCore: '../../shared'
};

const CHAPTER_NAMES = {
  'intro': '引言',
  'methods': '方法',
  'results': '结果',
  'discussion': '讨论',
  'conclusion': '结论'
};

export async function execute(input) {
  const { chapter, contentMaterials, rewrite } = input;

  if (!chapter || !CHAPTER_NAMES[chapter]) {
    return { success: false, message: `无效的章节: ${chapter}` };
  }

  const draftPath = path.join(PAPER_DIR, `draft-${chapter}.md`);

  // 检查是否存在
  try {
    await fs.access(draftPath);
    if (!rewrite) {
      return { success: false, message: `章节 "${CHAPTER_NAMES[chapter]}" 已存在，设置 rewrite=true 以重写` };
    }
  } catch {
    // 文件不存在，可以创建
  }

  // 读取写作提示
  let promptTemplate = '';
  try {
    promptTemplate = await fs.readFile(path.join(PROMPTS_DIR, 'paper-writer-prompt.md'), 'utf-8');
  } catch {
    promptTemplate = '# 论文写作提示词\n\n请使用学术写作规范撰写论文。';
  }

  // 读取元数据
  let metadata = {};
  try {
    metadata = JSON.parse(await fs.readFile(path.join(PAPER_DIR, 'metadata.json'), 'utf-8'));
  } catch {
    // 使用默认值
  }

  // 构建提示词
  const prompt = buildWritingPrompt(chapter, metadata, contentMaterials, promptTemplate);

  // 这里应该调用LLM，如果LLM不可用则返回模板
  let content;
  try {
    const { generateContent } = await import('../../mcp/src/services/llm-service.js');
    const response = await generateContent(prompt, '你是一个专业的学术写作助手。', {
      temperature: 0.7,
      max_tokens: 16000
    });
    content = response.content;
  } catch {
    // LLM不可用，返回模板
    content = getChapterTemplate(chapter, metadata);
  }

  await fs.writeFile(draftPath, content, 'utf-8');

  return {
    success: true,
    message: `${CHAPTER_NAMES[chapter]}草稿已生成`,
    outputFile: draftPath,
    usedLLM: content !== getChapterTemplate(chapter, metadata)
  };
}

function buildWritingPrompt(chapter, metadata, contentMaterials, template) {
  let prompt = `请撰写论文"${CHAPTER_NAMES[chapter]}"章节。\n\n`;
  prompt += `论文类型：${metadata.paperType || '未指定'}\n`;
  prompt += `研究方向：${metadata.researchTopic || '未指定'}\n\n`;

  if (contentMaterials) {
    prompt += `## 用户素材\n\n${contentMaterials}\n\n`;
  }

  prompt += `## 写作规范\n\n请参考以下提示词模板：\n${template}`;
  return prompt;
}

function getChapterTemplate(chapter, metadata) {
  const templates = {
    'intro': `# 引言\n\n## 研究背景\n\n[在此处撰写研究背景]\n\n## 研究现状\n\n[在此处撰写相关研究现状]\n\n## 研究空白\n\n[在此处指出当前研究的不足]\n\n## 研究目的\n\n[在此处说明本研究的目的和贡献]\n\n本研究旨在${metadata.researchTopic || '探索该领域'}。`,
    'methods': `# 研究方法\n\n## 研究对象\n\n[在此处描述研究对象/材料]\n\n## 研究设计\n\n[在此处描述研究设计类型]\n\n## 数据收集\n\n[在此处描述数据收集方法]\n\n## 数据分析\n\n[在此处描述数据分析方法]`,
    'results': `# 研究结果\n\n## 描述性统计\n\n[在此处呈现样本特征]\n\n## 主要结果\n\n[在此处呈现核心发现]\n\n## 次要结果\n\n[在此处呈现支撑性发现]`,
    'discussion': `# 讨论\n\n## 主要发现总结\n\n[在此处概括核心发现]\n\n## 与已有研究的比较\n\n[在此处与已有研究进行比较]\n\n## 局限性\n\n[在此处列出研究局限性]\n\n## 结论与展望\n\n[在此处总结结论并提出未来方向]`,
    'conclusion': `# 结论\n\n[在此处用1-2句话总结核心发现]\n\n[在此处说明研究的理论和/或实践意义]\n\n[可选：提出未来研究方向]`
  };
  return templates[chapter] || `# ${chapter}\n\n[待撰写]`;
}