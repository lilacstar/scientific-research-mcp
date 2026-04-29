/**
 * Verify Content 工具
 * 论文内容准确性与逻辑链验证专家
 */

import * as path from 'path';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { readMetadata, readFile, fileExists } from '../services/file-service.js';
import { generateContent } from '../services/llm-service.js';

const PAPER_DIR = process.env.PAPER_DIR || path.join(process.cwd(), 'paper');

/**
 * 验证论文内容
 */
export async function verifyContent(args) {
  const { mode, target_chapters } = args;

  try {
    const metadata = await readMetadata();

    // 读取待验证内容
    let contentToVerify = '';
    if (mode === 'full') {
      // 优先使用 imported-v2.1_终稿.md（如果存在）
      const importedExists = await fileExists('imported-v2.1_终稿.md');
      if (importedExists) {
        contentToVerify = await readFile('imported-v2.1_终稿.md');
      } else {
        const exists = await fileExists('draft-full.md');
        if (!exists) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ 未找到完整论文草稿。请先使用 paper_coordinator 的 merge 操作合并全文，或导入论文文件。',
              },
            ],
          };
        }
        contentToVerify = await readFile('draft-full.md');
      }
    } else if (mode === 'targeted' && target_chapters) {
      for (const chapter of target_chapters) {
        const exists = await fileExists(`draft-${chapter}.md`);
        if (exists) {
          contentToVerify += await readFile(`draft-${chapter}.md`) + '\n\n';
        }
      }
    }

    // 构建提示词
    const prompt = `请对以下内容进行学术验证：

## 验证模式：${mode}

## 内容

${contentToVerify.substring(0, 6000)}

## 验证内容

1. 论证逻辑链检查
2. 内部一致性检查
3. 事实性陈述检查
4. 常见逻辑谬误检查
5. 表述规范性检查
6. 参考文献来源合法性检查
7. 内部交叉验证检查

## 要求

请列出所有发现的问题，并给出修改建议。`;

    let verificationResult;
    try {
      const response = await generateContent(prompt, '你是一个专业的学术写作助手，擅长论文验证。');
      verificationResult = response.content;
    } catch (error) {
      verificationResult = `⚠️ 验证失败：无法调用 LLM API。请检查 API 配置。`;
    }

    return {
      content: [
        {
          type: 'text',
          text: `🔍 内容验证完成！

**验证模式**：${mode}
${target_chapters ? `**目标章节**：${target_chapters.join(', ')}\n` : ''}
**验证结果**：

${verificationResult}`,
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
      `验证失败：${error instanceof Error ? error.message : String(error)}`
    );
  }
}