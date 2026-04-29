/**
 * Paper Writer 工具
 * 论文写作引擎：撰写论文的各个章节（引言、方法、结果、讨论、结论）
 */

import * as path from 'path';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { readMetadata, readPromptTemplate, readReference, writeChapterDraft, fileExists, copyFile, autoBackup } from '../services/file-service.js';
import { generateChapterDraft as generateWithLLM } from '../services/llm-service.js';

const PAPER_DIR = process.env.PAPER_DIR || path.join(process.cwd(), 'paper');

const CHAPTER_NAMES: Record<string, string> = {
  'intro': '引言',
  'methods': '方法',
  'results': '结果',
  'discussion': '讨论',
  'conclusion': '结论',
};

/**
 * 撰写论文章节
 */
export async function writeChapter(args: {
  chapter: string;
  content_materials?: string;
  rewrite?: boolean;
}) {
  const { chapter, content_materials, rewrite } = args;

  try {
    // 检查项目是否已初始化
    const metadata = await readMetadata();
    const chapterName = CHAPTER_NAMES[chapter] || chapter;
    const draftPath = path.join(PAPER_DIR, `draft-${chapter}.md`);

    // 检查章节是否已存在
    const exists = await fileExists(`draft-${chapter}.md`);
    if (exists && !rewrite) {
      return {
        content: [
          {
            type: 'text',
            text: `⚠️ 章节 "${chapterName}" 已存在。如需重写，请设置 rewrite=true。`,
          },
        ],
      };
    }

    // 构建提示词
    let prompt = `# ${chapterName}写作任务\n\n`;
    prompt += `请根据以下要求撰写${chapterName}：\n\n`;
    prompt += `论文类型：${metadata.paperType}\n`;
    prompt += `研究方向：${metadata.researchTopic}\n\n`;

    if (content_materials) {
      prompt += `## 用户提供的材料\n\n${content_materials}\n\n`;
    }

    prompt += `## 写作要求\n\n`;
    prompt += `1. 遵循学术写作规范\n`;
    prompt += `2. 使用客观、准确的语言\n`;
    prompt += `3. 所有断言需有引用支撑\n`;
    prompt += `4. 引用必须来自真实存在的文献，如不确定请标记 [待核实]\n`;
    prompt += `5. 符合${chapterName}的结构要求\n`;

    // 读取写作规范
    try {
      const styleGuide = await readReference('style-guide.md');
      prompt += `\n## 写作规范\n\n${styleGuide}\n`;
    } catch {
      // 参考资料不存在，跳过
    }

    // 调用 LLM 生成内容
    let draftContent: string;
    try {
      draftContent = await generateWithLLM(chapter, prompt, metadata);
    } catch (error) {
      // LLM 调用失败，返回模板
      draftContent = getChapterTemplate(chapter);
    }

    // 写入草稿文件前自动备份
    await autoBackup(`draft-${chapter}.md`);
    await writeChapterDraft(chapter, draftContent);

    // 更新进度
    await updateProgress(chapter);

    return {
      content: [
        {
          type: 'text',
          text: `✅ ${chapterName}草稿已生成！

**输出文件**：${draftPath}

**提示**：建议执行 verify_content 验证内容准确性。`,
        },
      ],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        content: [
          {
            type: 'text',
            text: '❌ 未找到论文项目。请先使用 paper_coordinator 的 init 操作初始化项目。',
          },
        ],
      };
    }
    throw new McpError(
      ErrorCode.InternalError,
      `写作失败：${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 获取章节模板（LLM 调用失败时的降级方案）
 */
function getChapterTemplate(chapter: string): string {
  const chapterTemplates: Record<string, string> = {
    'intro': `# 引言

## 研究背景

[在此处撰写研究背景]

## 研究现状

[在此处撰写相关研究现状]

## 研究空白

[在此处指出当前研究的不足]

## 研究目的

[在此处说明本研究的目的和贡献]`,

    'methods': `# 研究方法

## 研究对象

[在此处描述研究对象/材料]

## 研究设计

[在此处描述研究设计类型]

## 数据收集

[在此处描述数据收集方法]

## 数据分析

[在此处描述数据分析方法]`,

    'results': `# 研究结果

## 描述性统计

[在此处呈现样本特征]

## 主要结果

[在此处呈现核心发现]

## 次要结果

[在此处呈现支撑性发现]`,

    'discussion': `# 讨论

## 主要发现总结

[在此处概括核心发现]

## 与已有研究的比较

[在此处与已有研究进行比较]

## 局限性

[在此处列出研究局限性]

## 结论与展望

[在此处总结结论并提出未来方向]`,

    'conclusion': `# 结论

[在此处用1-2句话总结核心发现]

[在此处说明研究的理论和/或实践意义]

[可选：提出未来研究方向]`,
  };

  return chapterTemplates[chapter] || `# ${chapter}\n\n[待撰写]`;
}

/**
 * 更新写作进度
 */
async function updateProgress(chapter: string) {
  try {
    const { readProgress, writeProgress } = await import('../services/file-service.js');
    const progress = await readProgress();

    const chapterStatus: Record<string, string> = {
      'intro': '论文写作',
      'methods': '论文写作',
      'results': '论文写作',
      'discussion': '论文写作',
      'conclusion': '论文写作',
    };

    const phase = chapterStatus[chapter];
    if (phase) {
      const updatedProgress = progress.replace(
        `| ${phase} | 待处理 |`,
        `| ${phase} | 进行中 | ${new Date().toISOString().split('T')[0]} |`
      );
      await writeProgress(updatedProgress);
    }
  } catch {
    // 更新进度失败不影响主流程
  }
}