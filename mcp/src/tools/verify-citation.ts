/**
 * Verify Citation 工具
 * 引用验证工具：验证论文草稿中的引用是否真实存在
 */

import * as path from 'path';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { readMetadata, readFile, fileExists } from '../services/file-service.js';
import { verifyCitation, searchOpenAlex, expandKeywords } from '../services/literature-service.js';

const PAPER_DIR = process.env.PAPER_DIR || path.join(process.cwd(), 'paper');

/**
 * 从文本中提取引用（支持多种格式）
 */
function extractCitations(text: string): Array<{
  fullMatch: string;
  title?: string;
  author?: string;
  year?: number;
  doi?: string;
}> {
  const citations: Array<any> = [];
  
  // DOI 格式：DOI: 10.xxxx/xxxxx
  const doiRegex = /DOI[:\s]*10\.\d{4,}[^\s]*/gi;
  const doiMatches = text.match(doiRegex) || [];
  for (const doi of doiMatches) {
    const cleanDoi = doi.replace(/DOI[:\s]*/i, '');
    citations.push({ fullMatch: doi, doi: cleanDoi });
  }
  
  // 作者 - 年份格式：(Smith et al., 2020) 或 (Smith & Johnson, 2019)
  const authorYearRegex = /\(([A-Z][a-z]+(?:\s+(?:et al\.|[&A-Z][a-z]+))?),?\s*(\d{4})\)/g;
  let match;
  while ((match = authorYearRegex.exec(text)) !== null) {
    const [, author, year] = match;
    citations.push({
      fullMatch: match[0],
      author: author.replace(/\s*et al\.?\s*$/i, '').trim(),
      year: parseInt(year)
    });
  }
  
  // 标题格式："Title of the paper" (2020)
  const titleRegex = /"([^"]+)"\s*\((\d{4})\)/g;
  while ((match = titleRegex.exec(text)) !== null) {
    const [, title, year] = match;
    citations.push({
      fullMatch: match[0],
      title: title.trim(),
      year: parseInt(year)
    });
  }
  
  return citations;
}

/**
 * 验证论文草稿中的引用
 */
export async function verifyCitations(args: {
  draft_content?: string;
  strict_mode?: boolean;
}) {
  const { draft_content, strict_mode = false } = args;

  try {
    const metadata = await readMetadata();

    // 获取待验证内容
    let content = draft_content;
    
    if (!content) {
      // 读取完整草稿
      const fullExists = await fileExists('draft-full.md');
      if (!fullExists) {
        return {
          content: [{
            type: 'text',
            text: '❌ 未找到完整论文草稿。请先使用 paper_coordinator 的 merge 操作合并全文，或提供 draft_content 参数。'
          }]
        };
      }
      content = await readFile('draft-full.md');
    }

    // 提取引用
    const citations = extractCitations(content);
    
    if (citations.length === 0) {
      return {
        content: [{
          type: 'text',
          text: '📋 引用验证结果\n\n**总引用数**：0\n\n未检测到引用。请确保引用格式正确，例如：\n- (Smith et al., 2020)\n- DOI: 10.1038/nature14539\n- "Paper Title" (2020)'
        }]
      };
    }

    // 验证每个引用
    const results: Array<{
      citation: any;
      verified: boolean;
      source: string | null;
      message: string;
      work?: any;
    }> = [];

    for (const citation of citations) {
      const result = await verifyCitation(citation);
      results.push({
        citation,
        verified: result.verified,
        source: result.source,
        message: result.message,
        work: result.work
      });
    }

    // 统计结果
    const verifiedCount = results.filter(r => r.verified).length;
    const unverifiedCount = results.filter(r => !r.verified).length;
    const strictUnverified = strict_mode 
      ? results.filter(r => !r.verified || r.source === null).length
      : unverifiedCount;

    // 生成报告
    let report = `📋 引用验证报告\n\n`;
    report += `**总引用数**：${citations.length}\n\n`;
    report += `**验证结果**：\n`;
    report += `✅ 真实存在：${verifiedCount} 篇\n`;
    if (strict_mode) {
      report += `⚠️ 无法验证：${strictUnverified - (strictUnverified - unverifiedCount)} 篇\n`;
    }
    report += `${strict_mode ? '❌' : '⚠️'} 疑似虚构：${strictUnverified} 篇\n\n`;

    // 详细列表
    if (verifiedCount > 0) {
      report += `---\n\n### ✅ 真实存在的引用\n\n`;
      results.filter(r => r.verified).forEach((r, i) => {
        const work = r.work;
        report += `${i + 1}. **${work?.title || 'Unknown'}**\n`;
        if (work?.authors?.length) report += `   作者：${work.authors.join(', ')}\n`;
        if (work?.year) report += `   年份：${work.year}\n`;
        if (work?.doi) report += `   DOI: ${work.doi}\n`;
        report += `\n`;
      });
    }

    if (unverifiedCount > 0) {
      report += `---\n\n### ${strict_mode ? '❌' : '⚠️'} 无法验证的引用\n\n`;
      results.filter(r => !r.verified).forEach((r, i) => {
        report += `${i + 1}. **${r.citation.fullMatch}**\n`;
        report += `   原因：${r.message}\n`;
        if (r.citation.title) report += `   标题：${r.citation.title}\n`;
        if (r.citation.author) report += `   作者：${r.citation.author}\n`;
        if (r.citation.year) report += `   年份：${r.citation.year}\n`;
        if (r.citation.doi) report += `   DOI: ${r.citation.doi}\n`;
        report += `\n`;
      });
    }

    // 建议
    report += `---\n\n**建议**：\n`;
    if (unverifiedCount > 0) {
      report += `1. 删除或替换无法验证的引用\n`;
      report += `2. 检查引用格式是否正确\n`;
      report += `3. 手动核实这些文献是否存在\n`;
    } else {
      report += `所有引用均已验证为真实存在的文献！\n`;
    }

    return {
      content: [{
        type: 'text',
        text: report
      }]
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        content: [{
          type: 'text',
          text: '❌ 未找到论文项目。请先使用 paper_coordinator 的 init 操作初始化项目。'
        }]
      };
    }
    throw new McpError(
      ErrorCode.InternalError,
      `引用验证失败：${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 验证单个引用
 */
export async function verifySingleCitation(args: {
  title?: string;
  author?: string;
  year?: number;
  doi?: string;
}) {
  try {
    const result = await verifyCitation(args);
    
    if (result.verified) {
      return {
        content: [{
          type: 'text',
          text: `✅ 引用验证通过\n\n**文献信息**：\n- 标题：${result.work?.title || 'N/A'}\n- 作者：${result.work?.authors?.join(', ') || 'N/A'}\n- 年份：${result.work?.year || 'N/A'}\n- 期刊：${result.work?.journal || 'N/A'}\n- DOI: ${result.work?.doi || 'N/A'}\n- 引用次数：${result.work?.citationCount || 0}`
        }]
      };
    } else {
      return {
        content: [{
          type: 'text',
          text: `⚠️ 引用无法验证\n\n**原因**：${result.message}\n\n**提供的信息**：\n- 标题：${args.title || 'N/A'}\n- 作者：${args.author || 'N/A'}\n- 年份：${args.year || 'N/A'}\n- DOI: ${args.doi || 'N/A'}`
        }]
      };
    }
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `引用验证失败：${error instanceof Error ? error.message : String(error)}`
    );
  }
}