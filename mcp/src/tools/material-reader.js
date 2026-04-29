/**
 * Material Reader 工具
 * 资料读取反馈专家：读取用户上传的各类资料，并返回每个资料的读取结果
 */

import * as path from 'path';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { readFile, writeFile, fileExists, ensurePaperDir } from '../services/file-service.js';
import { extractPdfContent } from '../services/pdf-service.js';

const PAPER_DIR = process.env.PAPER_DIR || path.join(process.cwd(), 'paper');
const REFERENCES_DIR = path.join(PAPER_DIR, 'references');

/**
 * 读取单个资料并返回结果
 */
async function readSingleMaterial(material) {
  const { type, path: filePath, url, content } = material;
  const result = {
    type,
    source: filePath || url || '直接文本',
    status: 'pending',
    summary: '',
    error: null,
    metadata: {}
  };

  try {
    switch (type) {
      case 'text':
        // 直接文本内容
        result.status = 'success';
        result.summary = `直接提供的文本内容（${content?.length || 0}字符）`;
        result.metadata.contentPreview = content?.substring(0, 200) + (content?.length > 200 ? '...' : '');
        break;

      case 'url':
        // URL内容需要通过fetch获取
        if (!url) {
          throw new Error('URL类型需要提供url参数');
        }
        result.status = 'success';
        result.summary = `URL: ${url}（需要外部工具获取内容）`;
        result.metadata.url = url;
        break;

      case 'pdf':
        // PDF文件使用专用解析服务
        if (!filePath) {
          throw new Error('文件类型需要提供path参数');
        }
        
        const pdfFullPath = path.isAbsolute(filePath) 
          ? filePath 
          : path.join(PAPER_DIR, filePath);
        
        const pdfExists = await fileExistsRelative(pdfFullPath);
        if (!pdfExists) {
          throw new Error(`文件不存在：${pdfFullPath}`);
        }

        const pdfResult = await extractPdfContent(pdfFullPath);
        result.status = 'success';
        result.summary = `成功读取PDF文件（${pdfResult.pages}页，${pdfResult.wordCount}词，${pdfResult.charCount}字符）`;
        result.metadata.contentPreview = pdfResult.text.substring(0, 300) + (pdfResult.text.length > 300 ? '...' : '');
        result.metadata.pages = pdfResult.pages;
        result.metadata.wordCount = pdfResult.wordCount;
        result.metadata.charCount = pdfResult.charCount;
        result.metadata.fullText = pdfResult.text;
        break;

      case 'docx':
      case 'md':
      case 'txt':
      case 'json':
        // 其他文件类型直接读取
        if (!filePath) {
          throw new Error('文件类型需要提供path参数');
        }
        
        const fullPath = path.isAbsolute(filePath) 
          ? filePath 
          : path.join(PAPER_DIR, filePath);
        
        const exists = await fileExistsRelative(fullPath);
        if (!exists) {
          throw new Error(`文件不存在：${fullPath}`);
        }

        const fileContent = await readFileContent(fullPath, type);
        result.status = 'success';
        result.summary = `成功读取${type.toUpperCase()}文件（${fileContent.length}字符）`;
        result.metadata.contentPreview = fileContent.substring(0, 300) + (fileContent.length > 300 ? '...' : '');
        result.metadata.charCount = fileContent.length;
        break;

      default:
        throw new Error(`不支持的资料类型：${type}`);
    }
  } catch (error) {
    result.status = 'failed';
    result.error = error.message;
    result.summary = `读取失败：${error.message}`;
  }

  return result;
}

/**
 * 检查文件是否存在（支持绝对路径和相对路径）
 */
async function fileExistsRelative(filePath) {
  const fs = await import('fs/promises');
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 读取文件内容（支持多种类型）
 */
async function readFileContent(filePath, type) {
  const fs = await import('fs/promises');
  const content = await fs.readFile(filePath, 'utf-8');
  return content;
}

/**
 * 记录资料读取日志
 */
async function logMaterials(results) {
  const logPath = path.join(PAPER_DIR, 'docs', 'materials-log.md');
  const date = new Date().toISOString().split('T')[0];
  
  let logContent = `# 资料读取日志\n\n最后更新：${date}\n\n`;
  logContent += '| 序号 | 类型 | 路径/URL | 状态 | 摘要 |\n';
  logContent += '|------|------|---------|------|------|\n';
  
  results.forEach((result, index) => {
    const statusIcon = result.status === 'success' ? '✅' : '❌';
    logContent += `| ${index + 1} | ${result.type} | ${result.source} | ${statusIcon} ${result.status} | ${result.summary} |\n`;
  });
  
  logContent += `\n**统计**：共${results.length}份资料，成功${results.filter(r => r.status === 'success').length}份，失败${results.filter(r => r.status === 'failed').length}份\n`;
  
  try {
    const existingLog = await readFile('docs/materials-log.md');
    logContent = existingLog + '\n\n---\n\n' + logContent.replace('# 资料读取日志\n\n', '');
  } catch {
    // 日志文件不存在，创建新的
  }
  
  await writeFile('docs/materials-log.md', logContent);
}

/**
 * 格式化读取结果为人类可读的文本
 */
function formatResults(results) {
  const successCount = results.filter(r => r.status === 'success').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  
  let output = `📚 资料读取结果汇总\n\n`;
  output += `| 序号 | 类型 | 路径/URL | 状态 | 摘要 |\n`;
  output += `|------|------|---------|------|------|\n`;
  
  results.forEach((result, index) => {
    const statusIcon = result.status === 'success' ? '✅' : '❌';
    output += `| ${index + 1} | ${result.type} | ${result.source} | ${statusIcon} ${result.status} | ${result.summary} |\n`;
  });
  
  output += `\n**统计**：共${results.length}份资料，成功${successCount}份，失败${failedCount}份\n`;
  
  // 添加失败详情
  const failedItems = results.filter(r => r.status === 'failed');
  if (failedItems.length > 0) {
    output += `\n**失败详情**：\n\n`;
    failedItems.forEach(item => {
      output += `- ❌ ${item.source}：${item.error}\n`;
    });
    output += `\n💡 **建议**：请检查失败的资料路径是否正确，或文件是否可正常访问。\n`;
  }
  
  // 添加成功详情
  const successItems = results.filter(r => r.status === 'success');
  if (successItems.length > 0) {
    output += `\n**成功读取详情**：\n\n`;
    successItems.forEach((item, index) => {
      output += `- ✅ ${item.source}\n`;
      if (item.metadata.contentPreview) {
        output += `   内容预览：${item.metadata.contentPreview}\n`;
      }
    });
  }
  
  return output;
}

/**
 * 主函数：处理资料读取请求
 */
export async function readMaterials(args) {
  const { materials } = args;
  
  if (!materials || materials.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ 请提供需要读取的资料列表

**支持的文件类型**：
- PDF：{"type": "pdf", "path": "path/to/file.pdf"}
- DOCX：{"type": "docx", "path": "path/to/file.docx"}
- MD/TXT：{"type": "txt", "path": "path/to/file.txt"}
- URL：{"type": "url", "url": "https://example.com"}
- 文本：{"type": "text", "content": "直接提供的文本"}

**示例**：
\`\`\`json
{
  "materials": [
    {"type": "pdf", "path": "references/paper1.pdf"},
    {"type": "docx", "path": "docs/投稿要求.docx"},
    {"type": "url", "url": "https://example.com/article"}
  ]
}
\`\`\``
        }
      ]
    };
  }
  
  try {
    await ensurePaperDir();
    
    const results = [];
    for (const material of materials) {
      const result = await readSingleMaterial(material);
      results.push(result);
    }
    
    // 记录日志
    await logMaterials(results);
    
    // 格式化输出
    const formattedOutput = formatResults(results);
    
    return {
      content: [
        {
          type: 'text',
          text: formattedOutput
        }
      ]
    };
    
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `资料读取失败：${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 列出已读取的资料日志
 */
export async function listMaterialsLog() {
  try {
    const logContent = await readFile('docs/materials-log.md');
    return {
      content: [
        {
          type: 'text',
          text: `📋 资料读取日志\n\n${logContent}`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: '📋 暂无资料读取日志。请使用 material_reader 工具读取资料。'
        }
      ]
    };
  }
}