/**
 * Verify Data 工具
 * 数据验证助手：自动提取文中的具体数据，生成数据核实清单
 * 
 * Phase 4：
 * - 自动提取数值型事实
 * - 生成数据核实清单供用户确认
 * - 标记需要人工核实的数据
 */

import * as path from 'path';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { readMetadata, readFile, fileExists } from '../services/file-service.js';
import { generateContent } from '../services/llm-service.js';

/**
 * 提取论文内容
 */
async function extractContent() {
  const importedExists = await fileExists('imported-v2.1_终稿.md');
  if (importedExists) {
    return await readFile('imported-v2.1_终稿.md');
  }
  
  const draftExists = await fileExists('draft-full.md');
  if (draftExists) {
    return await readFile('draft-full.md');
  }
  
  const chapters = ['intro', 'methods', 'results', 'discussion', 'conclusion', 'abstract'];
  let content = '';
  for (const ch of chapters) {
    const exists = await fileExists(`draft-${ch}.md`);
    if (exists) {
      content += await readFile(`draft-${ch}.md`) + '\n\n';
    }
  }
  return content;
}

/**
 * 使用正则表达式提取数据
 */
function extractDataWithRegex(content) {
  const dataItems = [];
  
  // 日期模式：2021年、2021年12月、2021-12-01
  const datePatterns = [
    /(\d{4})年(\d{1,2})月(\d{1,2})日/g,
    /(\d{4})年(\d{1,2})月/g,
    /(\d{4})年/g,
    /(\d{4})-(\d{1,2})-(\d{1,2})/g
  ];
  
  // 数值模式：面积、人数、百分比等
  const numberPatterns = [
    /约?(\d[\d,]*[.]?\d*)\s*(平方米|平米|亩|公顷|公里|米|厘米|个|人|篇|家|所|项|次|倍|%)?/g,
    /(\d+\.?\d*)%\s*的/g,
    /达[到]?(\d[\d,]*[.]?\d*)/g,
    /超过(\d[\d,]*[.]?\d*)/g,
    /近(\d[\d,]*[.]?\d*)/g,
    /约(\d[\d,]*[.]?\d*)/g,
    /(\d{4})年(?:至|-)(\d{4})年/g
  ];
  
  // 提取日期
  for (const pattern of datePatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      // 获取上下文（前后100字符）
      const start = Math.max(0, match.index - 50);
      const end = Math.min(content.length, match.index + match[0].length + 50);
      const context = content.substring(start, end).trim();
      
      dataItems.push({
        type: '日期',
        value: match[0],
        context: context,
        chapter: detectChapter(context),
        verified: false
      });
    }
  }
  
  // 提取数值
  for (const pattern of numberPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const start = Math.max(0, match.index - 50);
      const end = Math.min(content.length, match.index + match[0].length + 50);
      const context = content.substring(start, end).trim();
      
      // 过滤掉明显的非数据（如版本号）
      if (!/v\d+\.\d+/.test(context) && !/\$\d+/.test(context)) {
        dataItems.push({
          type: '数值',
          value: match[0],
          context: context,
          chapter: detectChapter(context),
          verified: false
        });
      }
    }
  }
  
  return dataItems;
}

/**
 * 检测数据所属章节
 */
function detectChapter(context) {
  if (context.includes('# 引言') || context.includes('研究背景')) return '引言';
  if (context.includes('# 方法') || context.includes('研究设计')) return '方法';
  if (context.includes('# 结果') || context.includes('研究发现')) return '结果';
  if (context.includes('# 讨论')) return '讨论';
  if (context.includes('# 结论')) return '结论';
  if (context.includes('# 摘要')) return '摘要';
  return '未知章节';
}

/**
 * 去重数据项
 */
function deduplicateData(items) {
  const unique = new Map();
  for (const item of items) {
    const key = item.value + '|' + item.context.substring(0, 50);
    if (!unique.has(key)) {
      unique.set(key, item);
    }
  }
  return Array.from(unique.values());
}

/**
 * 构建数据验证提示词
 */
function buildDataVerificationPrompt(content, extractedData) {
  const truncatedContent = content.substring(0, 8000);
  
  return `请对以下学术论文中的数据进行验证分析：

## 待验证内容

${truncatedContent}

## 已提取的数据项（共${extractedData.length}项）

${extractedData.slice(0, 50).map((d, i) => `${i + 1}. [${d.type}] ${d.value} (${d.chapter})`).join('\n')}

## 验证要求

### 1. 数据完整性检查
- 数据是否有明确的来源支撑
- 数据之间的逻辑关系是否合理

### 2. 数据一致性检查
- 同一数据在全文中是否一致
- 计算结果是否正确（如百分比、平均值等）

### 3. 输出格式

# 数据验证报告

## 数据核实清单

| 序号 | 数据类型 | 数值 | 章节 | 需人工核实 | 备注 |
|------|---------|------|------|-----------|------|
| 1 | 日期 | ... | ... | [ ] | ... |
| 2 | 数值 | ... | ... | [ ] | ... |

## 可疑数据

### 可疑数据1
- **数据**：[...]
- **位置**：[...]
- **可疑原因**：[...]
- **建议**：[...]

## 总结

- 提取数据总数：X
- 需人工核实：X
- 可疑数据：X
`;
}

/**
 * 验证论文数据
 */
export async function verifyData(args = {}) {
  const { mode = 'full' } = args;

  try {
    const metadata = await readMetadata();
    const content = await extractContent();
    
    if (!content || content.trim().length === 0) {
      return {
        content: [{
          type: 'text',
          text: '❌ 未找到完整论文草稿。请先使用 paper_coordinator 的 merge 操作合并全文。'
        }]
      };
    }

    // 使用正则表达式提取数据
    const extractedData = extractDataWithRegex(content);
    const uniqueData = deduplicateData(extractedData);

    const prompt = buildDataVerificationPrompt(content, uniqueData);

    let result;
    try {
      const response = await generateContent(prompt, '你是一个专业的学术写作助手，擅长论文数据验证和事实核查。');
      result = response.content;
    } catch (error) {
      // 如果LLM调用失败，返回提取的数据清单
      result = generateDataChecklist(uniqueData);
    }

    return {
      content: [{
        type: 'text',
        text: `🔍 数据验证完成\n\n**提取数据项**：${uniqueData.length}项\n\n${result}`
      }]
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        content: [{
          type: 'text',
          text: '❌ 未找到论文项目。请先使用 paper_coordinator 的 init 操作初始化项目。'
        }]
      };
    }
    throw new McpError(
      ErrorCode.InternalError,
      `数据验证失败：${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 生成数据核实清单（降级方案）
 */
function generateDataChecklist(data) {
  let checklist = '## 数据核实清单\n\n';
  checklist += '请逐项核实以下数据的准确性：\n\n';
  checklist += '| 序号 | 数据类型 | 数值 | 章节 | 状态 |\n';
  checklist += '|------|---------|------|------|------|\n';
  
  data.slice(0, 30).forEach((item, index) => {
    checklist += `| ${index + 1} | ${item.type} | ${item.value} | ${item.chapter} | [ ] 待核实 |\n`;
  });
  
  checklist += '\n### 使用说明\n';
  checklist += '- [ ] 表示待核实\n';
  checklist += '- [x] 表示已核实\n';
  checklist += '- [-] 表示确认有误\n';
  
  return checklist;
}