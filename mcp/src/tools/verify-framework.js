/**
 * Verify Framework 工具
 * 框架验证工具：检查论文中核心框架/概念的一致性
 * 
 * Phase 3：
 * - 提取全文核心概念
 * - 生成概念一致性报告
 * - 标记前后不一致的表述
 */

import * as path from 'path';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { readMetadata, readFile, fileExists } from '../services/file-service.js';
import { generateContent } from '../services/llm-service.js';

/**
 * 提取论文内容
 */
async function extractContent() {
  // 优先级：imported文件 > draft-full.md > 合并各章节
  const importedExists = await fileExists('imported-v2.1_终稿.md');
  if (importedExists) {
    return await readFile('imported-v2.1_终稿.md');
  }
  
  const draftExists = await fileExists('draft-full.md');
  if (draftExists) {
    return await readFile('draft-full.md');
  }
  
  // 尝试合并各章节
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
 * 构建框架验证提示词
 */
function buildFrameworkPrompt(content) {
  const truncatedContent = content.substring(0, 12000);
  
  return `请对以下学术论文进行框架一致性验证。

## 待验证内容

${truncatedContent}

## 验证要求

### 1. 核心概念提取
请提取文中所有：
- 框架/模型名称（包括缩写、全称）
- 分类体系（如AI路径分类、能力分级等）
- 层级结构定义
- 专业术语及其定义

### 2. 一致性检查
检查以下内容在全文中是否一致：
- 缩写与全称是否对应（如EIDT=Experience-Immersion-Data-Technology）
- 框架层级顺序是否前后统一
- 分类标准是否存在矛盾
- 同一概念在不同章节的表述是否相同

### 3. 输出格式

# 框架一致性报告

## 核心概念清单

| 概念 | 首次出现位置 | 全称 | 缩写 | 各章节表述一致性 |
|------|------------|------|------|----------------|
| ... | ... | ... | ... | ✅一致/⚠️不一致 |

## 不一致项详情

### 问题1：[概念名称]
- **引言中表述**：[...]
- **方法中表述**：[...]
- **结果中表述**：[...]
- **讨论中表述**：[...]
- **严重程度**：高/中/低
- **修改建议**：[...]

## 分类体系检查

| 分类体系 | 定义位置 | 使用位置 | 一致性 | 问题 |
|---------|---------|---------|--------|------|
| ... | ... | ... | ... | ... |

## 总结

- 发现概念总数：X
- 一致概念：X
- 不一致概念：X
- 建议修改位置：[...]
`;
}

/**
 * 验证论文框架一致性
 */
export async function verifyFramework(args = {}) {
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

    const prompt = buildFrameworkPrompt(content);

    let result;
    try {
      const response = await generateContent(prompt, '你是一个专业的学术写作助手，擅长论文框架分析和概念一致性检查。');
      result = response.content;
    } catch (error) {
      result = `⚠️ 验证失败：无法调用 LLM API。请检查 API 配置。错误信息：${error.message}`;
    }

    return {
      content: [{
        type: 'text',
        text: `🔍 框架一致性验证完成\n\n${result}`
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
      `框架验证失败：${error instanceof Error ? error.message : String(error)}`
    );
  }
}