/**
 * Paper Polisher 工具
 * 论文润色专家：语言润色、翻译语气纠正、格式检查
 */

import * as path from 'path';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { readMetadata, readFile, writeFile, fileExists, autoBackup, autoArchiveOldVersions } from '../services/file-service.js';
import { generateContent } from '../services/llm-service.js';
import { getWordLimitInstruction, getHeadingFormatInstruction, getFullJournalRequirements } from '../services/journal-config-service.js';

const PAPER_DIR = process.env.PAPER_DIR || path.join(process.cwd(), 'paper');

/**
 * 将长文本按章节分割成块
 */
function splitIntoChunks(content, maxChunkSize = 4000) {
  // 尝试按章节分割
  const chapterRegex = /^(#{1,3}\s+.+)$/gm;
  const chapters = content.split(chapterRegex);
  
  if (chapters.length > 2) {
    // 有章节标记，按章节分组
    const chunks = [];
    let currentChunk = '';
    
    for (let i = 0; i < chapters.length; i++) {
      const part = chapters[i];
      if (part.match(chapterRegex)) {
        // 遇到新章节，保存当前块
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = '';
        }
      }
      currentChunk += part;
    }
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    return chunks;
  }
  
  // 没有章节标记，按固定大小分割
  const chunks = [];
  let start = 0;
  while (start < content.length) {
    const end = Math.min(start + maxChunkSize, content.length);
    // 尝试在段落边界分割
    let splitPoint = content.lastIndexOf('\n\n', end);
    if (splitPoint <= start) {
      splitPoint = content.lastIndexOf('\n', end);
    }
    if (splitPoint <= start) {
      splitPoint = end;
    }
    chunks.push(content.substring(start, splitPoint));
    start = splitPoint;
  }
  return chunks;
}

/**
 * 计算中文字符数
 */
function countChineseChars(text) {
  const matches = text.match(/[\u4e00-\u9fff]/g);
  return matches ? matches.length : 0;
}

/**
 * 对单个块进行润色
 */
async function polishChunk(chunk, focus, chunkIndex, totalChunks, mode = 'standard') {
  const isConcise = mode === 'concise';
  
  // 获取期刊配置提示
  const wordLimitInstruction = await getWordLimitInstruction();
  const headingFormatInstruction = await getHeadingFormatInstruction();
  
  const conciseInstruction = isConcise ? `

## 精简要求（重要）
1. 删除冗余表述（如"可以说"、"不难发现"、"众所周知"、"值得注意的是"等填充词）
2. 合并语义重复的句子，避免重复阐述同一观点
3. 使用更简洁的学术表达替代啰嗦表述（如"非常重要"→"重要"，"具有十分重要的意义"→"具有重要意义"）
4. 删除不必要的过渡句和冗余修饰语
5. 目标：在保证内容完整性和学术性的前提下，将字数压缩10-20%
6. 优先保留核心论点、数据支撑和关键结论，精简次要的铺垫和过渡内容` : '';

  const prompt = `请对以下内容进行学术润色：

## 润色重点：${focus || 'all'}
## 润色模式：${isConcise ? '精简模式（润色+压缩）' : '标准模式（仅润色）'}
## 当前进度：第 ${chunkIndex + 1}/${totalChunks} 块

## 内容

${chunk}

## 要求

1. 纠正语法错误
2. 改进表达方式
3. 确保学术语气
4. 检查格式一致性
5. 验证引用格式（GB/T 7714）
6. 保持原文的章节结构和标题不变${conciseInstruction}
${wordLimitInstruction}${headingFormatInstruction}
7. 只返回润色后的内容，不要添加任何额外说明`;

  try {
    const response = await generateContent(prompt, '你是一个专业的学术写作助手，擅长论文润色。', {
      max_tokens: 16000,
      timeout: 180000 // 3分钟超时
    });
    
    return response.content;
  } catch (llmError) {
    console.error(`⚠️ LLM调用失败，已降级使用模板方案：${llmError.message}`);
    console.error(`💡 提示：如需使用AI润色功能，请确保已配置 ALIBABA_CLOUD_API_KEY 环境变量`);
    
    // LLM调用失败，返回原文
    throw new Error(`LLM调用失败，无法进行润色：${llmError.message}`);
  }
}

/**
 * 论文润色
 */
export async function polishPaper(args) {
  const { scope, focus, mode = 'standard' } = args;

  try {
    const metadata = await readMetadata();

    // 读取待润色内容
    let contentToPolish = '';
    if (scope === 'full') {
      // 优先使用 current/ 目录下的终稿
      const currentFile = 'current/v2.2_终稿.md';
      const currentExists = await fileExists(currentFile);
      if (currentExists) {
        contentToPolish = await readFile(currentFile);
      } else {
        const exists = await fileExists('drafts/draft-full.md');
        if (!exists) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ 未找到完整论文草稿。请先使用 paper_coordinator 的 merge 操作合并全文，或导入论文文件到 current/ 目录。',
              },
            ],
          };
        }
        contentToPolish = await readFile('drafts/draft-full.md');
      }
    } else {
      const exists = await fileExists(`draft-${scope}.md`);
      if (!exists) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ 未找到章节草稿：${scope}。请先使用 paper_writer 撰写章节。`,
            },
          ],
        };
      }
      contentToPolish = await readFile(`draft-${scope}.md`);
    }

    // 统计原始字数
    const originalWordCount = countChineseChars(contentToPolish);

    // 分割成块
    const chunks = splitIntoChunks(contentToPolish, 4000);
    const totalChunks = chunks.length;
    
    let successCount = 0;
    let failCount = 0;

    // 逐块润色
    let llmFailed = false;
    const polishedChunks = [];
    for (let i = 0; i < chunks.length; i++) {
      try {
        const polishedChunk = await polishChunk(chunks[i], focus, i, totalChunks, mode);
        polishedChunks.push(polishedChunk);
        successCount++;
      } catch (error) {
        if (error.message.includes('LLM调用失败')) {
          llmFailed = true;
        }
        console.error(`第 ${i + 1} 块润色失败，使用原文:`, error.message);
        polishedChunks.push(chunks[i]);
        failCount++;
      }
    }

    // 合并所有润色后的块
    const polishedContent = polishedChunks.join('');

    // 统计润色后字数
    const polishedWordCount = countChineseChars(polishedContent);
    const wordCountDiff = polishedWordCount - originalWordCount;
    const wordCountChangePercent = ((wordCountDiff / originalWordCount) * 100).toFixed(1);

    // 写入润色后的内容前自动备份
    const outputFile = scope === 'full' ? 'draft-full-polished.md' : `draft-${scope}-polished.md`;
    const backupResult = await autoBackup(outputFile);
    
    // 检查备份结果，备份失败则中止操作
    if (!backupResult.success) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ 润色操作已取消！备份失败，无法安全修改文件。

**失败原因**：${backupResult.reason}

**请检查**：
1. 磁盘空间是否充足
2. 文件权限是否正确
3. 文件是否被其他程序占用
4. 文件路径是否正确

备份成功后才能继续修改。`,
          },
        ],
      };
    }
    
    await writeFile(outputFile, polishedContent);
    
    // 自动归档旧版本到 versions/ 目录
    try {
      const { autoArchiveOldVersions } = await import('../services/file-service.js');
      const archiveResult = await autoArchiveOldVersions(outputFile);
      if (archiveResult.success && archiveResult.archivedFiles.length > 0) {
        statusMessage += `\n\n📦 **自动归档**：已将旧版本归档至 versions/ 目录（${archiveResult.archivedFiles.join(', ')}）`;
      }
    } catch {
      // 归档失败不影响主流程
    }

    // 构建状态消息
    const modeLabel = mode === 'concise' ? '精简模式（润色+压缩）' : '标准模式（仅润色）';
    let statusMessage = `✅ 论文润色完成！

**润色范围**：${scope}
**润色模式**：${modeLabel}
**润色重点**：${focus || 'all'}
**处理块数**：${totalChunks} 块
**成功**：${successCount} 块
**失败**：${failCount} 块
**输出文件**：${outputFile}

---

### 📊 字数统计

| 项目 | 数值 |
|:---|:---:|
| 润色前 | ${originalWordCount.toLocaleString()} 字 |
| 润色后 | ${polishedWordCount.toLocaleString()} 字 |
| 变化 | ${wordCountDiff > 0 ? '+' : ''}${wordCountDiff.toLocaleString()} 字（${wordCountDiff > 0 ? '+' : ''}${wordCountChangePercent}%） |`;

    if (failCount > 0) {
      statusMessage += `\n\n⚠️ **注意**：有 ${failCount} 块润色失败，已使用原文内容。`;
    }

    if (mode === 'concise' && wordCountDiff > 0) {
      statusMessage += `\n\n⚠️ **注意**：精简模式下字数仍有所增加，建议手动进一步精简或尝试分段润色。`;
    }

    // 如果LLM调用失败，添加明确的降级提示
    if (llmFailed) {
      statusMessage += `\n\n⚠️ **降级提示**：本次润色有 ${failCount} 块因LLM调用失败而使用原文内容。
如需使用AI润色功能，请确保：
1. 已配置 \`ALIBABA_CLOUD_API_KEY\` 环境变量
2. API密钥有效且网络正常
3. 当前使用的是模板方案降级输出`;
    }

    statusMessage += `\n\n**提示**：请检查润色后的内容，确认无误后替换原文。`;

    // 检查是否符合期刊字数要求
    const journalConfig = await (async () => {
      try {
        const { readJournalConfig } = await import('../services/journal-config-service.js');
        return await readJournalConfig();
      } catch {
        return null;
      }
    })();
    
    if (journalConfig && journalConfig.maxWords) {
      const wordLimit = journalConfig.maxWords;
      const wordStatus = polishedWordCount <= wordLimit ? '✅' : '❌';
      statusMessage += `\n\n### 📋 期刊字数检查\n${wordStatus} 当前字数 ${polishedWordCount.toLocaleString()} 字，期刊限制 ≤${wordLimit.toLocaleString()} 字${polishedWordCount > wordLimit ? `（**超出 ${wordLimit - polishedWordCount > 0 ? (polishedWordCount - wordLimit).toLocaleString() : '0'} 字**）` : ''}`;
    }

    // 版本保存提示
    statusMessage += `\n\n💡 **版本管理**：建议使用 \`paper_coordinator\` 的 \`save_version\` 操作保存当前版本。`;

    return {
      content: [
        {
          type: 'text',
          text: statusMessage,
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
      `润色失败：${error instanceof Error ? error.message : String(error)}`
    );
  }
}
