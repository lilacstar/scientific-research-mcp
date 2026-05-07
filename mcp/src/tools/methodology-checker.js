/**
 * Methodology Checker 工具
 * 方法论审查工具：检查研究方法的完整性和合理性
 * 
 * Phase 5：
 * - 检查研究方法描述的完整性
 * - 验证样本选择理由是否充分
 * - 检查效度/信度论述是否存在
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
 * 构建方法论审查提示词
 */
function buildMethodologyPrompt(content) {
  const truncatedContent = content.substring(0, 12000);
  
  return `请对以下学术论文进行方法论审查。

## 待审查内容

${truncatedContent}

## 审查要求

### 1. 研究方法完整性
检查以下内容是否完整描述：
- 研究设计类型（如案例研究、实验研究、调查研究等）
- 研究对象/样本选择方法及理由
- 数据收集方法
- 数据分析方法
- 研究工具/仪器的有效性

### 2. 样本选择合理性
- 样本量是否合理
- 抽样方法是否科学
- 样本代表性是否有说明
- 选择标准是否明确

### 3. 效度与信度
- 内部效度：研究结果是否可靠
- 外部效度：研究结果是否可推广
- 信度：研究方法是否可重复
- 是否有讨论研究局限性

### 4. 编码规则（如适用）
- 是否有明确的编码体系
- 编码过程是否规范
- 是否有编码一致性检验

### 5. 输出格式

# 方法论审查报告

## 研究方法完整性

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 研究设计类型 | ✅完整/⚠️部分/❌缺失 | [...] |
| 样本选择方法 | ✅完整/⚠️部分/❌缺失 | [...] |
| 数据收集方法 | ✅完整/⚠️部分/❌缺失 | [...] |
| 数据分析方法 | ✅完整/⚠️部分/❌缺失 | [...] |
| 研究工具有效性 | ✅完整/⚠️部分/❌缺失 | [...] |

## 样本选择合理性

- **样本量**：[...]
- **抽样方法**：[...]
- **代表性说明**：[有/无]
- **选择标准**：[明确/不明确]

## 效度与信度

| 类型 | 论述情况 | 问题 |
|------|---------|------|
| 内部效度 | 有/无 | [...] |
| 外部效度 | 有/无 | [...] |
| 信度 | 有/无 | [...] |
| 局限性讨论 | 有/无 | [...] |

## 编码规则（如适用）

- **编码体系**：[有/无]
- **编码过程**：[规范/不规范]
- **一致性检验**：[有/无]

## 问题清单

### 问题1
- **类型**：研究方法/样本选择/效度信度/编码规则
- **描述**：[...]
- **严重程度**：高/中/低
- **建议**：[...]

## 总结

- 完整项：X
- 部分项：X
- 缺失项：X
- 总体评价：[...]
`;
}

/**
 * 审查论文方法论
 */
export async function checkMethodology(args = {}) {
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

    const prompt = buildMethodologyPrompt(content);

    let result;
    try {
      const response = await generateContent(prompt, '你是一个专业的学术写作助手，擅长论文方法论审查和研究设计评估。');
      result = response.content;
    } catch (error) {
      result = `⚠️ 审查失败：无法调用 LLM API。请检查 API 配置。错误信息：${error.message}`;
    }

    return {
      content: [{
        type: 'text',
        text: `🔍 方法论审查完成\n\n${result}`
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
      `方法论审查失败：${error instanceof Error ? error.message : String(error)}`
    );
  }
}