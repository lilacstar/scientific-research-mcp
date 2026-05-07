/**
 * 期刊配置服务
 * 读取并应用投稿期刊的配置要求
 * 
 * 配置来源：paper/docs/metadata.json 中的 journalConfig 字段
 */

import * as path from 'path';
import * as fs from 'fs/promises';

const PAPER_DIR = process.env.PAPER_DIR || path.join(process.cwd(), 'paper');
const METADATA_PATH = path.join(PAPER_DIR, 'docs', 'metadata.json');

/**
 * 读取期刊配置
 * @returns {object|null} 期刊配置对象，如果不存在则返回null
 */
export async function readJournalConfig() {
  try {
    const content = await fs.readFile(METADATA_PATH, 'utf-8');
    const metadata = JSON.parse(content);
    return metadata.journalConfig || null;
  } catch {
    return null;
  }
}

/**
 * 获取字数限制提示
 * @returns {string} 字数限制提示文本
 */
export async function getWordLimitInstruction() {
  const config = await readJournalConfig();
  if (!config) {
    return '';
  }
  
  const maxWords = config.maxWords;
  const includeRefs = config.maxWordsIncludeReferences ? '（含参考文献）' : '（不含参考文献）';
  
  return `
## 字数限制要求（重要）
- 全文总字数不得超过 ${maxWords} 字${includeRefs}
- 请在保证内容完整性和逻辑连贯性的前提下，严格控制篇幅
- 优先保留核心论点、关键数据和主要结论
- 删除冗余表述、重复内容和次要铺垫
`;
}

/**
 * 获取标题格式提示
 * @returns {string} 标题格式提示文本
 */
export async function getHeadingFormatInstruction() {
  const config = await readJournalConfig();
  if (!config) {
    return '';
  }
  
  if (config.headingStyle === 'arabic') {
    const maxLevels = config.maxHeadingLevels || 3;
    return `
## 标题格式要求
- 使用阿拉伯数字连续编号
- 标题层级不超过 ${maxLevels} 层
- 一级标题格式：1、2、3...（顶格）
- 二级标题格式：1.1、1.2、2.1、2.2...（用点号分开，顶格）
- 三级标题格式：1.1.1、1.1.2、1.2.1、1.2.2...（用2个点将数字分开，顶格）
`;
  }
  
  return '';
}

/**
 * 获取摘要字数要求提示
 * @returns {string} 摘要字数提示文本
 */
export async function getAbstractWordCountInstruction() {
  const config = await readJournalConfig();
  if (!config) {
    return '';
  }
  
  const minWords = config.abstractMinWords || 400;
  const maxWords = config.abstractMaxWords || 600;
  
  return `
## 摘要字数要求
- 摘要字数应在 ${minWords}-${maxWords} 字之间
- 当前摘要字数如不在此范围，请适当扩充或精简
`;
}

/**
 * 获取关键词数量要求提示
 * @returns {string} 关键词数量提示文本
 */
export async function getKeywordsInstruction() {
  const config = await readJournalConfig();
  if (!config) {
    return '';
  }
  
  const maxKeywords = config.maxKeywords || 6;
  return `
## 关键词要求
- 关键词数量不超过 ${maxKeywords} 个
`;
}

/**
 * 获取完整的投稿要求提示（综合所有配置）
 * @returns {string} 完整投稿要求文本
 */
export async function getFullJournalRequirements() {
  const config = await readJournalConfig();
  if (!config) {
    return '';
  }
  
  let requirements = `
## 投稿期刊要求

### 字数限制
- 全文总字数：≤ ${config.maxWords || '无限制'} 字${config.maxWordsIncludeReferences ? '（含参考文献）' : ''}

### 标题格式
- 编号方式：${config.headingStyle === 'arabic' ? '阿拉伯数字连续编号' : '自定义'}
- 最大层级：${config.maxHeadingLevels || 3} 层
${config.headingFormat ? `- 一级标题：${config.headingFormat.level1}
- 二级标题：${config.headingFormat.level2}
- 三级标题：${config.headingFormat.level3}` : ''}

### 摘要要求
- 字数：${config.abstractMinWords || 400}-${config.abstractMaxWords || 600} 字

### 关键词要求
- 数量：≤ ${config.maxKeywords || 6} 个

### 参考文献
- 格式：${config.referenceStyle || 'GB/T 7714'}
- 位置：${config.referencePosition === 'end' ? '文后注' : '页下注'}
`;

  return requirements;
}