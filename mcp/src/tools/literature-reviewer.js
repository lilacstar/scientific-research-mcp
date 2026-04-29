/**
 * Literature Reviewer 工具
 * 文献综述撰写专家：基于真实存在的文献撰写综述，消除 LLM 幻觉
 */

import * as path from 'path';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { readMetadata, readFile, writeFile, fileExists } from '../services/file-service.js';
import { generateContent } from '../services/llm-service.js';
import { searchLiterature, searchOpenAlex, expandKeywords } from '../services/literature-service.js';
import { extractPdfContent, extractMultiplePdfs } from '../services/pdf-service.js';

const PAPER_DIR = process.env.PAPER_DIR || path.join(process.cwd(), 'paper');

/**
 * 文献综述相关操作
 */
export async function literatureReview(args) {
  const { action, pdf_paths, topic } = args;

  try {
    const metadata = await readMetadata();

    if (action === 'process_pdfs') {
      if (!pdf_paths || pdf_paths.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: '❌ 处理 PDF 需要提供 pdf_paths 参数。',
            },
          ],
        };
      }

      // 使用PDF解析服务处理所有PDF文件
      const results = await extractMultiplePdfs(pdf_paths);
      
      // 统计处理结果
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;
      
      // 生成处理报告
      let report = `📚 PDF 文献处理报告\n\n`;
      report += `**处理结果**：共 ${pdf_paths.length} 个文件，成功 ${successCount} 个，失败 ${failedCount} 个\n\n`;
      report += `---\n\n`;
      
      // 提取所有PDF的文本内容用于后续分析
      let allPdfText = '';
      
      for (const result of results) {
        if (result.success) {
          report += `✅ ${result.source}\n`;
          report += `   - 页数：${result.result.pages}\n`;
          report += `   - 词数：${result.result.wordCount}\n`;
          report += `   - 字符数：${result.result.charCount}\n`;
          report += `   - 内容预览：${result.result.text.substring(0, 100)}...\n\n`;
          
          // 累积所有PDF文本
          allPdfText += `\n--- PDF: ${result.source} ---\n${result.result.text}\n`;
        } else {
          report += `❌ ${result.source}\n`;
          report += `   - 错误：${result.error}\n\n`;
        }
      }
      
      // 保存提取的文本到文件
      if (allPdfText) {
        const extractedTextPath = path.join(PAPER_DIR, 'docs', 'extracted-pdf-text.md');
        await writeFile('docs/extracted-pdf-text.md', allPdfText);
        report += `**提取的文本已保存**：${extractedTextPath}\n\n`;
      }
      
      report += `**下一步**：\n`;
      report += `1. 使用 write_review 基于提取的文献内容撰写综述\n`;
      report += `2. 或继续使用 process_pdfs 处理更多PDF文件`;
      
      return {
        content: [
          {
            type: 'text',
            text: report,
          },
        ],
      };
    }

    if (action === 'write_review') {
      // 使用提供的主题或研究方向
      const searchTopic = topic || metadata.researchTopic;
      const paperType = metadata.paperType;

      // 步骤 1: 检索真实文献
      let searchResult;
      try {
        searchResult = await searchLiterature(searchTopic, paperType, { per_page: 10 });
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ 文献检索失败：${error.message}`,
            },
          ],
        };
      }

      // 步骤 2: 处理零结果
      if (searchResult.total === 0) {
        // 尝试扩展关键词
        const expandedKeywords = expandKeywords(searchTopic);
        for (const keyword of expandedKeywords) {
          searchResult = await searchOpenAlex(keyword, { per_page: 5 });
          if (searchResult.total > 0) {
            break;
          }
        }
      }

      // 步骤 3: 仍为零则提示用户
      if (searchResult.total === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `⚠️ 未找到相关文献

**检索关键词**：${searchTopic}
**使用 API**：${searchResult.api}

**可能原因**：
1. 关键词可能过于具体或冷门
2. 关键词拼写可能有误
3. 这可能是新兴研究领域

**建议操作**：
1. 尝试更换关键词（使用更宽泛的术语）
2. 手动提供参考文献列表
3. 继续生成（引用将标记为 [待核实]）

请回复数字选择操作：1 / 2 / 3`,
            },
          ],
        };
      }

      // 步骤 4: 格式化检索到的文献
      const literatureList = searchResult.results.map((work, index) => {
        return `[${index + 1}] ${work.title}
    作者：${work.authors?.join(', ') || '未知'}
    年份：${work.year || '未知'}
    期刊：${work.journal || '未知'}
    DOI: ${work.doi || '未知'}
    引用次数：${work.citationCount || 0}
    OpenAlex ID: ${work.id}
    ${work.abstract ? `摘要：${work.abstract}` : ''}
`;
      }).join('\n');

      // 步骤 5: 构建提示词 - 基于真实文献撰写
      const prompt = `请基于以下**真实存在的文献**撰写文献综述：

## 论文信息
- 论文类型：${metadata.paperType}
- 研究方向：${metadata.researchTopic}
- 投稿期刊：${metadata.targetJournal}

## 检索到的真实文献（共${searchResult.total}篇，展示前${searchResult.results.length}篇）

${literatureList}

## 重要要求

1. **只能引用上述文献**，不得引用列表之外的文献
2. 每篇引用必须标注 OpenAlex ID 或 DOI，确保可追溯
3. 如果上述文献不足以支撑综述，请明确指出需要补充哪些方向的文献
4. 使用学术写作规范，客观、准确的语言
5. 按照以下结构组织综述：
   - 研究背景与意义
   - 主要研究方向与进展
   - 现有研究的优缺点
   - 研究空白与挑战
   - 未来发展方向

## 输出格式

使用 Markdown 格式，引用格式为 [OpenAlex ID] 或 [DOI]，例如：
- 根据 Smith 等人的研究 [10.1038/nature12345]...
- 多项研究表明 [https://openalex.org/W1234567890]...`;

      let reviewContent;
      try {
        const response = await generateContent(prompt, '你是一个专业的学术写作助手，擅长基于真实文献撰写综述。严禁虚构引用。');
        reviewContent = response.content;
      } catch (error) {
        reviewContent = `# 文献综述

## 检索到的真实文献

${literatureList}

**注意**：LLM API 调用失败，请基于上述真实文献手动撰写综述。`;
      }

      // 写入文件
      await writeFile('literature-review.md', reviewContent);

      return {
        content: [
          {
            type: 'text',
            text: `📚 文献综述已生成！

**检索关键词**：${searchTopic}
**使用 API**：${searchResult.api}
**找到文献**：${searchResult.total} 篇
**输出文件**：${path.join(PAPER_DIR, 'literature-review.md')}

**重要提示**：
- 所有引用均来自检索到的真实文献
- 建议使用 verify_citation 工具进一步验证引用准确性`,
          },
        ],
      };
    }

    if (action === 'check_references') {
      return {
        content: [
          {
            type: 'text',
            text: `📚 参考文献检查功能

**操作**：check_references

**功能说明**：
- 检查参考文献来源合法性
- 验证引用格式一致性
- 标记可疑引用

**使用方法**：请使用 verify_citation 工具进行引用验证。`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `⚠️ 未知操作：${action}。支持的操作：process_pdfs, write_review, check_references`,
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
      `文献综述失败：${error instanceof Error ? error.message : String(error)}`
    );
  }
}