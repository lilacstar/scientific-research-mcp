/**
 * PDF 解析服务
 * 使用 pdf-parse 库提取 PDF 文件内容
 */

import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 提取 PDF 文件的文本内容
 * @param {string} filePath - PDF 文件路径
 * @returns {Promise<{text: string, pages: number, metadata: object}>}
 */
export async function extractPdfContent(filePath) {
  try {
    // 解析文件路径
    const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
    
    // 检查文件是否存在
    try {
      await fs.access(fullPath);
    } catch {
      throw new Error(`文件不存在：${filePath}`);
    }

    // 读取 PDF 文件
    const dataBuffer = await fs.readFile(fullPath);
    
    // 解析 PDF
    const result = await pdfParse(dataBuffer);
    
    return {
      text: result.text,
      pages: result.numpages,
      metadata: result.info || {},
      charCount: result.text.length,
      wordCount: result.text.split(/\s+/).filter(w => w.length > 0).length,
      source: filePath
    };
  } catch (error) {
    throw new Error(`PDF 解析失败：${error.message}`);
  }
}

/**
 * 提取 PDF 文件的摘要（前 500 字符）
 * @param {string} filePath - PDF 文件路径
 * @param {number} maxLength - 最大长度
 * @returns {Promise<string>}
 */
export async function extractPdfSummary(filePath, maxLength = 500) {
  const result = await extractPdfContent(filePath);
  
  let summary = result.text.substring(0, maxLength).trim();
  if (result.text.length > maxLength) {
    summary += '...';
  }
  
  return summary;
}

/**
 * 批量提取多个 PDF 文件的内容
 * @param {string[]} filePaths - PDF 文件路径列表
 * @returns {Promise<Array<{source: string, success: boolean, result?: object, error?: string}>}
 */
export async function extractMultiplePdfs(filePaths) {
  const results = [];
  
  for (const filePath of filePaths) {
    try {
      const result = await extractPdfContent(filePath);
      results.push({
        source: filePath,
        success: true,
        result
      });
    } catch (error) {
      results.push({
        source: filePath,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}