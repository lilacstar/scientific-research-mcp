/**
 * Verify Citation 工具
 * 引用验证工具：验证论文草稿中的引用是否真实存在
 * 
 * Phase 2 增强：
 * - 本地文献库验证（用户提供PDF）
 * - 引用-内容对应检查
 * - 可疑引用标记
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { readMetadata, readFile, fileExists } from '../services/file-service.js';
import { searchOpenAlex, expandKeywords } from '../services/literature-service.js';

const PAPER_DIR = process.env.PAPER_DIR || path.join(process.cwd(), 'paper');
const REFERENCE_DIR = path.join(PAPER_DIR, 'reference-papers');
const LOCAL_LIBRARY_FILE = path.join(PAPER_DIR, '.local-library.json');

/**
 * 从文本中提取引用（支持多种格式）
 */
function extractCitations(text: string): Array<{
  fullMatch: string;
  title?: string;
  author?: string;
  year?: number;
  doi?: string;
  citationKey?: string;  // 如 [1], [2] 等
  context?: string;       // 引用所在上下文
}> {
  const citations: Array<any> = [];
  
  // DOI 格式：DOI: 10.xxxx/xxxxx
  const doiRegex = /DOI[:\s]*10\.\d{4,}[^\s]*/gi;
  const doiMatches = text.match(doiRegex) || [];
  for (const doi of doiMatches) {
    const cleanDoi = doi.replace(/DOI[:\s]*/i, '');
    citations.push({ fullMatch: doi, doi: cleanDoi });
  }
  
  // GB/T 7714 格式：[1], [2], [1-3], [1,3,5]
  const bracketRegex = /\[(\d+(?:[,\-]\d+)*)\]/g;
  let bracketMatch;
  while ((bracketMatch = bracketRegex.exec(text)) !== null) {
    // 提取引用周围的上下文（前后50字符）
    const start = Math.max(0, bracketMatch.index - 50);
    const end = Math.min(text.length, bracketMatch.index + bracketMatch[0].length + 50);
    const context = text.substring(start, end).trim();
    
    citations.push({
      fullMatch: bracketMatch[0],
      citationKey: bracketMatch[0],
      context: context
    });
  }
  
  // 作者 - 年份格式：(Smith et al., 2020) 或 (Smith & Johnson, 2019)
  const authorYearRegex = /\(([A-Z][a-z]+(?:\s+(?:et al\.|[&A-Z][a-z]+))?),?\s*(\d{4})\)/g;
  let match;
  while ((match = authorYearRegex.exec(text)) !== null) {
    const [, author, year] = match;
    // 提取上下文
    const start = Math.max(0, match.index - 50);
    const end = Math.min(text.length, match.index + match[0].length + 50);
    const context = text.substring(start, end).trim();
    
    citations.push({
      fullMatch: match[0],
      author: author.replace(/\s*et al\.?\s*$/i, '').trim(),
      year: parseInt(year),
      context: context
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
 * 解析参考文献列表，建立引用编号与文献的映射
 */
function parseReferenceList(text: string): Map<string, any> {
  const referenceMap = new Map<string, any>();
  
  // 匹配 [1] 作者. 标题. 期刊, 年份 格式
  const refRegex = /\[(\d+)\]\s*([^\n]+)/g;
  let refMatch;
  while ((refMatch = refRegex.exec(text)) !== null) {
    const [, key, content] = refMatch;
    referenceMap.set(key, {
      key: key,
      raw: content.trim(),
      // 尝试提取标题（通常在作者之后，句号之前）
      title: extractTitleFromReference(content)
    });
  }
  
  return referenceMap;
}

function extractTitleFromReference(ref: string): string | null {
  // 尝试匹配中文文献标题模式
  const cnTitleRegex = /[．.]\s*([^．.]+)[．.]/;
  const match = ref.match(cnTitleRegex);
  return match ? match[1].trim() : null;
}

/**
 * 扫描本地文献目录，建立文献库
 */
async function buildLocalLibrary(): Promise<Map<string, any>> {
  const library = new Map<string, any>();
  
  try {
    // 检查是否已有缓存的文献库
    const libraryExists = await fileExistsInDir(LOCAL_LIBRARY_FILE);
    if (libraryExists) {
      const content = await fs.readFile(LOCAL_LIBRARY_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      for (const [key, value] of Object.entries(parsed)) {
        library.set(key, value);
      }
    }
    
    // 扫描 reference-papers 目录
    const refDirExists = await fileExistsInDir(REFERENCE_DIR);
    if (refDirExists) {
      const files = await fs.readdir(REFERENCE_DIR);
      for (const file of files) {
        if (file.endsWith('.pdf')) {
          const filePath = path.join(REFERENCE_DIR, file);
          const stats = await fs.stat(filePath);
          library.set(file, {
            fileName: file,
            filePath: filePath,
            fileSize: stats.size,
            lastModified: stats.mtime.toISOString()
          });
        }
      }
    }
  } catch (error) {
    console.error('构建本地文献库失败:', error);
  }
  
  return library;
}

async function fileExistsInDir(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查引用是否在本地文献库中存在
 */
async function checkLocalLibrary(citation: any, referenceList: Map<string, any>): Promise<{
  found: boolean;
  source: string | null;
  message: string;
}> {
  // 如果有引用编号（如[1]），检查参考文献列表
  if (citation.citationKey && referenceList.has(citation.citationKey.replace('[', '').replace(']', ''))) {
    const key = citation.citationKey.replace('[', '').replace(']', '');
    const ref = referenceList.get(key);
    return {
      found: true,
      source: `reference-list-${key}`,
      message: `在参考文献列表中找到第${key}条`
    };
  }
  
  // 如果有作者和年份，在本地文献库中搜索
  if (citation.author && citation.year) {
    const library = await buildLocalLibrary();
    for (const [key, paper] of library.entries()) {
      if (paper.title && paper.title.toLowerCase().includes(citation.author.toLowerCase())) {
        return {
          found: true,
          source: `local-library-${key}`,
          message: `在本地文献库中找到：${key}`
        };
      }
    }
  }
  
  return {
    found: false,
    source: null,
    message: '在本地文献库中未找到'
  };
}

/**
 * 验证论文草稿中的引用
 */
export async function verifyCitations(args: {
  draft_content?: string;
  strict_mode?: boolean;
  use_local_library?: boolean;
}) {
  const { draft_content, strict_mode = false, use_local_library = true } = args;

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
    
    // 解析参考文献列表
    const referenceList = parseReferenceList(content);
    
    if (citations.length === 0) {
      return {
        content: [{
          type: 'text',
          text: '📋 引用验证结果\n\n**总引用数**：0\n\n未检测到引用。请确保引用格式正确，例如：\n- (Smith et al., 2020)\n- DOI: 10.1038/nature14539\n- "Paper Title" (2020)\n- [1]（GB/T 7714格式）'
        }]
      };
    }

    let report = `📋 引用验证报告\n\n`;
    report += `**总引用数**：${citations.length}\n`;
    report += `**参考文献列表条目数**：${referenceList.size}\n\n`;
    
    // Phase 2: 本地文献库验证
    let localCheckResults = {
      inReferenceList: 0,
      inLocalLibrary: 0,
      notFound: 0
    };

    const localResults: Array<{
      citation: any;
      found: boolean;
      source: string | null;
      message: string;
    }> = [];

    if (use_local_library) {
      for (const citation of citations) {
        const result = await checkLocalLibrary(citation, referenceList);
        localResults.push({ citation, ...result });
        
        if (result.found) {
          if (result.source?.startsWith('reference-list')) {
            localCheckResults.inReferenceList++;
          } else {
            localCheckResults.inLocalLibrary++;
          }
        } else {
          localCheckResults.notFound++;
        }
      }
    }

    // Phase 2: 引用-内容对应检查
    const contextCheckResults = checkCitationContext(citations, content);

    report += `**本地验证结果**：\n`;
    report += `📖 在参考文献列表中：${localCheckResults.inReferenceList} 条\n`;
    report += `📁 在本地文献库中：${localCheckResults.inLocalLibrary} 条\n`;
    report += `${localCheckResults.notFound > 0 ? '⚠️ 未在本地找到' : '✅ 全部找到'}：${localCheckResults.notFound} 条\n\n`;

    report += `**引用-内容对应检查**：\n`;
    report += `✅ 上下文合理：${contextCheckResults.reasonable} 条\n`;
    report += `${contextCheckResults.suspicious > 0 ? '⚠️ 上下文可疑' : '✅ 无'}：${contextCheckResults.suspicious} 条\n\n`;

    // 可疑引用列表
    const suspiciousCitations = localResults.filter(r => !r.found);
    if (suspiciousCitations.length > 0) {
      report += `---\n\n### ⚠️ 未在本地找到的引用\n\n`;
      suspiciousCitations.forEach((r, i) => {
        report += `${i + 1}. **${r.citation.fullMatch}**\n`;
        report += `   原因：${r.message}\n`;
        if (r.citation.title) report += `   标题：${r.citation.title}\n`;
        if (r.citation.author) report += `   作者：${r.citation.author}\n`;
        if (r.citation.year) report += `   年份：${r.citation.year}\n`;
        if (r.citation.doi) report += `   DOI: ${r.citation.doi}\n`;
        report += `\n`;
      });
      
      report += `**建议**：\n`;
      report += `1. 确认这些文献的PDF是否在 ${REFERENCE_DIR} 目录中\n`;
      report += `2. 如果文献存在，请将PDF放入该目录后重新验证\n`;
      report += `3. 如果文献不存在，请删除或替换该引用\n\n`;
    }

    // 上下文可疑项
    if (contextCheckResults.suspiciousItems.length > 0) {
      report += `---\n\n### ⚠️ 引用-内容对应可疑项\n\n`;
      contextCheckResults.suspiciousItems.forEach((item, i) => {
        report += `${i + 1}. **引用**：${item.citation.fullMatch}\n`;
        report += `   上下文：${item.context}\n`;
        report += `   可疑原因：${item.reason}\n\n`;
      });
    }

    // 参考文献列表与正文引用对照
    report += `---\n\n### 参考文献对照\n\n`;
    report += `**正文引用编号**：`;
    const citedKeys = new Set<string>();
    citations.filter(c => c.citationKey).forEach(c => {
      const key = c.citationKey.replace('[', '').replace(']', '');
      citedKeys.add(key);
    });
    report += Array.from(citedKeys).sort((a, b) => parseInt(a) - parseInt(b)).join(', ') + '\n\n';
    
    report += `**参考文献列表编号**：`;
    const refKeys = Array.from(referenceList.keys());
    report += refKeys.join(', ') + '\n\n';

    // 检查是否有参考文献列表中的编号未被正文引用
    const unreferencedKeys = refKeys.filter(k => !citedKeys.has(k));
    if (unreferencedKeys.length > 0) {
      report += `⚠️ 参考文献列表中存在但正文未引用：${unreferencedKeys.join(', ')}\n\n`;
    }
    
    // 检查是否有正文引用的编号不在参考文献列表中
    const missingKeys = Array.from(citedKeys).filter(k => !refKeys.includes(k));
    if (missingKeys.length > 0) {
      report += `❌ 正文引用了但参考文献列表中缺失：${missingKeys.sort((a, b) => parseInt(a) - parseInt(b)).join(', ')}\n\n`;
    }

    // 建议
    report += `---\n\n**建议**：\n`;
    if (localCheckResults.notFound > 0) {
      report += `1. 将无法验证的文献PDF放入 ${REFERENCE_DIR} 目录\n`;
      report += `2. 删除或替换无法找到的引用\n`;
      report += `3. 检查引用格式是否正确\n`;
    } else {
      report += `所有引用均可在本地文献库或参考文献列表中找到！\n`;
    }
    
    report += `\n**本地文献库信息**：\n`;
    const library = await buildLocalLibrary();
    report += `- 文献目录：${REFERENCE_DIR}\n`;
    report += `- 已收录文献：${library.size} 篇\n`;
    report += `- 提示：将PDF文献放入该目录后，系统会自动收录\n`;

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
 * 检查引用与上下文的对应关系
 */
function checkCitationContext(citations: any[], content: string): {
  reasonable: number;
  suspicious: number;
  suspiciousItems: Array<{
    citation: any;
    context: string;
    reason: string;
  }>;
} {
  const suspiciousItems: Array<any> = [];
  let reasonable = 0;
  let suspicious = 0;

  for (const citation of citations) {
    if (!citation.context) {
      reasonable++;
      continue;
    }

    // 简单规则：检查引用是否出现在不合适的位置
    const context = citation.context.toLowerCase();
    
    // 规则1：检查引用是否只出现在标题中（可能是不恰当的引用）
    if (citation.context.trim().startsWith('#')) {
      suspicious++;
      suspiciousItems.push({
        citation,
        context: citation.context,
        reason: '引用出现在标题中，可能是不恰当的引用位置'
      });
      continue;
    }
    
    // 规则2：检查引用是否紧跟"未""不""没有"等否定词
    if (/(未|不|没有|缺乏|不存在)/.test(context) && /\[\d+\]/.test(citation.context)) {
      // 这可能是正常的否定性引用，标记为可疑但不一定错误
      suspicious++;
      suspiciousItems.push({
        citation,
        context: citation.context,
        reason: '引用与否定词关联，请确认是否恰当'
      });
      continue;
    }
    
    reasonable++;
  }

  return { reasonable, suspicious, suspiciousItems };
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
  // Note: This function now returns a placeholder since the verifyCitation import was removed
  return {
    content: [{
      type: 'text',
      text: `⚠️ 单引用验证功能需要配置 OpenAlex API\n\n**提供的信息**：\n- 标题：${args.title || 'N/A'}\n- 作者：${args.author || 'N/A'}\n- 年份：${args.year || 'N/A'}\n- DOI: ${args.doi || 'N/A'}`
    }]
  };
}
