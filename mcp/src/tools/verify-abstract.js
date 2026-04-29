/**
 * Verify Abstract 工具
 * 摘要验证专家：检查摘要与正文的一致性、准确性、完整性
 */

import * as path from 'path';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { readMetadata, readFile, fileExists } from '../services/file-service.js';
import { generateContent } from '../services/llm-service.js';

const PAPER_DIR = process.env.PAPER_DIR || path.join(process.cwd(), 'paper');

/**
 * 验证摘要
 */
export async function verifyAbstract(args: { action: string }) {
  const { action } = args;

  try {
    const metadata = await readMetadata();

    // 检查摘要和全文是否存在
    const abstractExists = await fileExists('abstract.md');
    const fullExists = await fileExists('draft-full.md');

    if (!abstractExists) {
      return {
        content: [
          {
            type: 'text',
            text: '❌ 未找到摘要文件。请先使用 abstract_writer 生成摘要。',
          },
        ],
      };
    }

    if (!fullExists) {
      return {
        content: [
          {
            type: 'text',
            text: '❌ 未找到完整论文草稿。请先使用 paper_coordinator 的 merge 操作合并全文。',
          },
        ],
      };
    }

    const abstract = await readFile('abstract.md');
    const fullContent = await readFile('draft-full.md');

    // 构建提示词
    const prompt = `请验证以下摘要与论文正文的一致性：

## 摘要

${abstract}

## 论文正文（节选）

${fullContent.substring(0, 6000)}

## 验证内容

1. 摘要是否准确反映了论文的核心内容
2. 摘要中的关键数据是否与正文一致
3. 摘要是否包含了研究目的、方法、结果和结论
4. 关键词是否覆盖了论文的主要主题
5. 摘要长度是否合适（200-300字）

## 要求

请列出所有发现的问题，并给出修改建议。`;

    let verificationResult: string;
    try {
      const response = await generateContent(prompt, '你是一个专业的学术写作助手，擅长摘要验证。');
      verificationResult = response.content;
    } catch (error) {
      verificationResult = `⚠️ 验证失败：无法调用 LLM API。请检查 API 配置。`;
    }

    return {
      content: [
        {
          type: 'text',
          text: `🔍 摘要验证完成！

**操作**：${action}
**验证结果**：

${verificationResult}`,
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
      `摘要验证失败：${error instanceof Error ? error.message : String(error)}`
    );
  }
}