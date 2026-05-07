/**
 * Abstract Writer 工具
 * 摘要与标题生成器：基于完整论文内容生成摘要和标题
 */

import * as path from 'path';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { readMetadata, readFile, writeFile, fileExists } from '../services/file-service.js';
import { generateContent } from '../services/llm-service.js';
import { getAbstractWordCountInstruction, getKeywordsInstruction } from '../services/journal-config-service.js';

const PAPER_DIR = process.env.PAPER_DIR || path.join(process.cwd(), 'paper');

/**
 * 生成或重写摘要
 */
export async function writeAbstract(args) {
  const { action } = args;

  try {
    const metadata = await readMetadata();

    if (action === 'generate' || action === 'rewrite') {
      const exists = await fileExists('draft-full.md');
      
      if (!exists) {
        return {
          content: [
            {
              type: 'text',
              text: '❌ 未找到完整论文草稿。请先使用 paper_coordinator 的 merge 操作合并全文。',
            },
          ],
        };
      }

      const fullContent = await readFile('draft-full.md');
      const abstractPath = path.join(PAPER_DIR, 'abstract.md');

      // 获取期刊配置的字数和关键词要求
      const abstractWordCountInstruction = await getAbstractWordCountInstruction();
      const keywordsInstruction = await getKeywordsInstruction();

      const prompt = `请根据以下论文内容生成摘要和标题：

## 论文内容

${fullContent.substring(0, 8000)}

## 要求

1. 生成一个简洁有力的论文标题
2. 撰写中文摘要${abstractWordCountInstruction || '（200-300字）'}
3. 提取关键词${keywordsInstruction || '（5个）'}
4. 摘要应包含研究目的、方法、结果和结论`;

      let abstractContent;
      try {
        const response = await generateContent(prompt, '你是一个专业的学术写作助手。');
        abstractContent = response.content;
      } catch (error) {
        abstractContent = `# 摘要

## 摘要

[在此处生成摘要内容]

**关键词**：[关键词1], [关键词2], [关键词3], [关键词4], [关键词5]`;
      }

      await writeFile('abstract.md', abstractContent);

      return {
        content: [
          {
            type: 'text',
            text: `✅ 摘要已生成！

**输出文件**：${abstractPath}

**提示**：请根据完整论文内容填写摘要，然后使用 verify_abstract 验证。`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `⚠️ 未知操作：${action}。支持的操作：generate, rewrite`,
        },
      ],
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
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
      `摘要生成失败：${error instanceof Error ? error.message : String(error)}`
    );
  }
}