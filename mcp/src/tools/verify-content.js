/**
 * Verify Content 工具
 * 论文内容准确性与逻辑链验证专家
 * 
 * Phase 1 增强：
 * - 框架一致性检查
 * - 分类标准检查
 * - 首尾呼应检查
 * - 内容相关性分析
 */

import * as path from 'path';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { readMetadata, readFile, fileExists } from '../services/file-service.js';
import { generateContent } from '../services/llm-service.js';

const PAPER_DIR = process.env.PAPER_DIR || path.join(process.cwd(), 'paper');

/**
 * 提取论文内容（支持多种来源）
 */
async function extractContent(mode, target_chapters) {
  let content = '';
  
  if (mode === 'full') {
    // 优先级：imported文件 > draft-full.md > 合并各章节
    const importedExists = await fileExists('imported-v2.1_终稿.md');
    if (importedExists) {
      content = await readFile('imported-v2.1_终稿.md');
    } else {
      const draftExists = await fileExists('draft-full.md');
      if (draftExists) {
        content = await readFile('draft-full.md');
      } else {
        // 尝试合并各章节
        const chapters = ['intro', 'methods', 'results', 'discussion', 'conclusion', 'abstract'];
        for (const ch of chapters) {
          const exists = await fileExists(`draft-${ch}.md`);
          if (exists) {
            content += await readFile(`draft-${ch}.md`) + '\n\n';
          }
        }
      }
    }
  } else if (mode === 'targeted' && target_chapters) {
    for (const chapter of target_chapters) {
      const exists = await fileExists(`draft-${chapter}.md`);
      if (exists) {
        content += await readFile(`draft-${chapter}.md`) + '\n\n';
      }
    }
  } else if (mode === 'incremental') {
    // 增量模式：只验证最新修改的章节
    const exists = await fileExists('draft-full.md');
    if (exists) {
      content = await readFile('draft-full.md');
    }
  }
  
  return content;
}

/**
 * 构建验证提示词
 */
function buildVerificationPrompt(mode, content, focusAreas) {
  // 截取内容（避免超出token限制）
  const truncatedContent = content.substring(0, 8000);
  
  const focusAreaMap = {
    'framework': '框架一致性检查',
    'classification': '分类标准检查',
    'conclusion': '首尾呼应检查',
    'relevance': '内容相关性分析',
    'logic': '论证逻辑链检查',
    'consistency': '内部一致性检查',
    'facts': '事实性陈述检查',
    'fallacy': '常见逻辑谬误检查',
    'citation': '参考文献来源合法性检查',
    'crossref': '内部交叉验证检查'
  };
  
  const selectedAreas = focusAreas && focusAreas.length > 0 
    ? focusAreas.map(a => focusAreaMap[a] || a).join('\n')
    : Object.values(focusAreaMap).join('\n');

  return `请对以下学术论文内容进行专业验证：

## 验证模式：${mode}

## 待验证内容

${truncatedContent}

## 验证项目

${selectedAreas}

## 详细检查要求

### 框架一致性检查
1. 提取文中所有框架/模型名称（包括缩写、全称、各层定义）
2. 检查缩写与全称是否对应（如EIDT是否等于Experience-Immersion-Data-Technology）
3. 检查框架层级顺序在全文中是否一致
4. 检查各层定义在不同章节是否相同

### 分类标准检查
1. 提取文中所有分类体系（如AI路径分类、能力分级等）
2. 检查分类标准是否自洽
3. 检查不同分类体系之间的关系是否清晰
4. 标记分类矛盾或模糊之处

### 首尾呼应检查
1. 提取引言中的研究问题
2. 检查结论部分是否逐一回应这些研究问题
3. 标记未回应或回应不充分的研究问题

### 内容相关性分析
1. 识别论文的核心研究主题
2. 标记与核心主题关联度较弱的内容段落
3. 检查案例描述是否聚焦核心主题
4. 标记可能偏离主线的冗余信息

### 论证逻辑链检查
1. 核心论点是否有充分论据支撑
2. 论证过程是否存在逻辑跳跃
3. 结论是否由论据合理推导

### 内部一致性检查
1. 同一概念在全文中表述是否一致
2. 数据、术语、定义是否前后统一
3. 图表与正文描述是否匹配

### 事实性陈述检查
1. 标记文中的具体数据（数字、日期、统计等）
2. 标记需要人工核实的事实性陈述
3. 检查是否存在明显的时间线矛盾

## 输出格式

请按以下格式输出验证报告：

### 验证报告

| 检查项 | 状态 | 问题描述 | 修改建议 |
|--------|------|---------|---------|
| 框架一致性 | ✅通过/⚠️警告/❌错误 | [具体问题] | [修改建议] |
| ... | ... | ... | ... |

### 详细问题列表

**问题1**：[问题描述]
- 位置：[章节/段落]
- 严重程度：高/中/低
- 修改建议：[具体建议]

### 数据核实清单

- [ ] "具体数据1" → 需人工核实
- [x] "已确认数据" → 已验证

### 总结

- 发现问题总数：X
- 高优先级问题：X
- 建议修改章节：X`;
}

/**
 * 解析验证结果（提取结构化信息）
 */
function parseVerificationResult(result) {
  // 统计问题数量
  const errorCount = (result.match(/❌/g) || []).length;
  const warningCount = (result.match(/⚠️/g) || []).length;
  const passCount = (result.match(/✅/g) || []).length;
  
  return {
    errors: errorCount,
    warnings: warningCount,
    passes: passCount,
    total: errorCount + warningCount
  };
}

/**
 * 验证论文内容
 */
export async function verifyContent(args) {
  const { mode, target_chapters, focus } = args;
  
  // focus参数允许指定检查重点：'framework', 'classification', 'conclusion', 'relevance'等
  const focusAreas = focus ? (Array.isArray(focus) ? focus : [focus]) : [];

  try {
    const metadata = await readMetadata();

    // 读取待验证内容
    let contentToVerify = await extractContent(mode, target_chapters);
    
    if (!contentToVerify || contentToVerify.trim().length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: '❌ 未找到完整论文草稿。请先使用 paper_coordinator 的 merge 操作合并全文，或导入论文文件。',
          },
        ],
      };
    }

    // 构建提示词
    const prompt = buildVerificationPrompt(mode, contentToVerify, focusAreas);

    let verificationResult;
    try {
      const response = await generateContent(prompt, '你是一个专业的学术写作助手，擅长论文内容验证和逻辑分析。');
      verificationResult = response.content;
    } catch (error) {
      verificationResult = `⚠️ 验证失败：无法调用 LLM API。请检查 API 配置。错误信息：${error.message}`;
    }

    // 解析结果
    const stats = parseVerificationResult(verificationResult);

    return {
      content: [
        {
          type: 'text',
          text: `🔍 内容验证完成！

**验证模式**：${mode}
${target_chapters ? `**目标章节**：${target_chapters.join(', ')}\n` : ''}
**检查重点**：${focusAreas.length > 0 ? focusAreas.join(', ') : '全部'}

**验证统计**：
- ✅ 通过：${stats.passes}项
- ⚠️ 警告：${stats.warnings}项
- ❌ 错误：${stats.errors}项

---

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