/**
 * Paper Coordinator 工具
 * 论文写作总协调器：初始化项目、管理进度、推荐下一步操作、合并全文、导出
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ensurePaperDir, readMetadata, writeMetadata, readProgress, writeProgress, readFile, writeFile, fileExists } from '../services/file-service.js';

const PAPER_DIR = process.env.PAPER_DIR || path.join(process.cwd(), 'paper');

/**
 * 初始化论文项目
 */
export async function initProject(paperType, researchTopic, targetJournal) {
  if (!paperType || !researchTopic) {
    return {
      content: [
        {
          type: 'text',
          text: '❌ 初始化失败：缺少必要参数\n\n请提供：\n- paper_type: 论文类型（chinese-thesis / english-journal / chinese-journal）\n- research_topic: 研究方向/主题\n\n可选参数：\n- target_journal: 投稿期刊名称',
        },
      ],
    };
  }

  try {
    await ensurePaperDir();

    const metadata = {
      paperType,
      language: paperType === 'english-journal' ? 'en' : 'zh',
      researchTopic,
      targetJournal: targetJournal || '未确定',
      citationStyle: 'GB/T 7714',
      journalConfig: null,
      currentPhase: 'topic',
      version: 'v1',
      createdAt: new Date().toISOString().split('T')[0],
      lastModified: new Date().toISOString().split('T')[0],
      wechatWebhook: '',
      referencePapers: [],
    };

    await writeMetadata(metadata);

    const progressContent = `# 论文写作进度

## 阶段状态

| 阶段 | 状态 | 最后更新 |
|------|------|---------|
| 文献调研 | 待处理 | - |
| 研究设计 | 待处理 | - |
| 数据分析 | 待处理 | - |
| 论文写作 | 待处理 | - |
| 摘要标题 | 待处理 | - |
| 审校润色 | 待处理 | - |
`;

    await writeProgress(progressContent);
    await writeFile('outline.md', '# 论文大纲\n\n<!-- 由 paper-writer 或用户填充 -->\n');
    await writeFile('changelog.md', '# 论文变更日志\n\n| 日期 | 版本 | 章节 | 变更摘要 | 操作 Skill |\n|------|------|------|---------|-----------|\n');

    return {
      content: [
        {
          type: 'text',
          text: `✅ 论文项目初始化成功！

**项目信息**：
- 论文类型：${paperType}
- 研究方向：${researchTopic}
- 投稿期刊：${targetJournal || '未确定'}
- 工作区：${PAPER_DIR}

**已创建文件**：
- metadata.json - 项目元数据
- progress.md - 写作进度
- outline.md - 论文大纲
- changelog.md - 变更日志

**下一步**：使用 paper_writer 开始撰写论文章节。`,
        },
      ],
    };
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `初始化失败：${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 显示论文写作进度
 */
export async function showProgress() {
  try {
    const metadata = await readMetadata();
    const progress = await readProgress();

    return {
      content: [
        {
          type: 'text',
          text: `📊 论文写作进度

**项目信息**：
- 论文类型：${metadata.paperType}
- 研究方向：${metadata.researchTopic}
- 当前版本：${metadata.version}
- 最后修改：${metadata.lastModified}

**进度详情**：
${progress}`,
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
      `读取进度失败：${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 推荐下一步操作
 */
export async function recommendNextStep() {
  try {
    const metadata = await readMetadata();

    const recommendations = {
      'topic': '📝 建议：使用 literature_reviewer 进行文献调研',
      'literature': '📝 建议：使用 paper_writer 开始撰写论文章节',
      'writing': '📝 建议：继续完成剩余章节的写作',
      'abstract': '📝 建议：使用 abstract_writer 生成摘要',
      'polish': '📝 建议：使用 paper_polisher 进行润色',
      'verify': '📝 建议：使用 verify_content 进行内容验证',
      'export': '📝 建议：使用 paper_coordinator 的 export 操作导出论文',
    };

    const recommendation = recommendations[metadata.currentPhase] || '📝 建议：使用 paper_coordinator 的 init 操作初始化项目';

    return {
      content: [
        {
          type: 'text',
          text: `${recommendation}\n\n当前阶段：${metadata.currentPhase}`,
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
      `获取推荐失败：${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 合并全文草稿
 */
export async function mergeFullDraft() {
  try {
    const chapters = [
      { file: 'draft-intro.md', name: '引言' },
      { file: 'draft-methods.md', name: '方法' },
      { file: 'draft-results.md', name: '结果' },
      { file: 'draft-discussion.md', name: '讨论' },
      { file: 'draft-conclusion.md', name: '结论' },
    ];

    let fullContent = '# 论文完整草稿\n\n';
    let mergedCount = 0;

    for (const chapter of chapters) {
      try {
        const content = await readFile(chapter.file);
        fullContent += `\n---\n\n## ${chapter.name}\n\n${content}`;
        mergedCount++;
      } catch (error) {
    if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    }

    if (mergedCount === 0) {
      return {
        content: [
          {
            type: 'text',
            text: '⚠️ 没有可合并的章节草稿。请先使用 paper_writer 撰写章节。',
          },
        ],
      };
    }

    // 备份已存在的完整草稿
    try {
      const existingContent = await readFile('draft-full.md');
      const backupPath = path.join(PAPER_DIR, `draft-full-v${Date.now()}.md`);
      await fs.writeFile(backupPath, existingContent, 'utf-8');
    } catch {
      // 文件不存在，无需备份
    }

    await writeFile('draft-full.md', fullContent);

    return {
      content: [
        {
          type: 'text',
          text: `✅ 全文合并成功！

**已合并章节**：${mergedCount} 个
**输出文件**：${path.join(PAPER_DIR, 'draft-full.md')}

**合并内容**：
${chapters.filter(c => {
  try {
    require('fs').accessSync(path.join(PAPER_DIR, c.file));
    return true;
  } catch {
    return false;
  }
}).map(c => `- ${c.name}`).join('\n')}`,
        },
      ],
    };
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `合并全文失败：${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 保存论文版本
 */
export async function saveVersion(version, description, sourceFile) {
  try {
    const metadata = await readMetadata();
    
    // 确定源文件（默认从 current/ 目录）
    const defaultSource = 'current/v2.2_终稿.md';
    const actualSource = sourceFile || defaultSource;
    
    // 检查源文件是否存在
    const sourceExists = await fileExists(actualSource);
    if (!sourceExists) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ 未找到源文件：${actualSource}\n\n请确保论文终稿存在，或指定正确的源文件名称。`,
          },
        ],
      };
    }
    
    // 生成版本号（如未提供）
    let actualVersion = version;
    if (!actualVersion) {
      // 从现有版本号推断下一个
      const currentVersion = metadata.version || 'v1';
      const versionMatch = currentVersion.match(/v(\d+)\.(\d+)/);
      if (versionMatch) {
        const major = parseInt(versionMatch[1]);
        const minor = parseInt(versionMatch[2]) + 1;
        actualVersion = `v${major}.${minor}`;
      } else {
        actualVersion = 'v2.0';
      }
    }
    
    // 生成版本描述（如未提供）
    const actualDescription = description || '未命名版本';
    
    // 生成目标文件名（保存到 versions/ 目录）
    const targetFileName = `versions/${actualVersion}_${actualDescription}.md`;
    const targetPath = path.join(PAPER_DIR, targetFileName);
    
    // 复制文件
    const content = await readFile(actualSource);
    await fs.writeFile(targetPath, content, 'utf-8');
    
    // 更新metadata版本号
    metadata.version = actualVersion;
    metadata.lastModified = new Date().toISOString().split('T')[0];
    await writeMetadata(metadata);
    
    // 追加到changelog
    const changelogEntry = `## ${actualVersion}（${new Date().toISOString().split('T')[0]}）- ${actualDescription}

**产物文件**：\`${targetFileName}\`

### 修改操作
- [待填写]

---

`;
    
    try {
      const existingChangelog = await readFile('changelog.md');
      const newChangelog = changelogEntry + existingChangelog.replace(/^# 论文变更日志.*/m, '# 论文变更日志\n');
      await writeFile('changelog.md', newChangelog);
    } catch {
      await writeFile('changelog.md', `# 论文变更日志\n\n${changelogEntry}`);
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ 版本保存成功！

**版本号**：${actualVersion}
**版本描述**：${actualDescription}
**产物文件**：\`${targetFileName}\`
**源文件**：\`${actualSource}\`

💡 **提示**：请在 changelog.md 中补充本次版本的修改操作。`,
        },
      ],
    };
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `版本保存失败：${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 导出论文
 */
export async function exportDraft() {
  return {
    content: [
      {
        type: 'text',
        text: `📤 导出功能

当前支持以下导出方式：

**PDF 导出**：
\`\`\`bash
python md2pdf.py paper/draft-full.md output/终稿.pdf
\`\`\`

**Word 导出**：
\`\`\`bash
python md2docx.py paper/draft-full.md output/终稿.docx
\`\`\`

**前提条件**：
- PDF：需安装 fpdf2 (\`pip install fpdf2\`)
- Word：需安装 python-docx (\`pip install python-docx\`)

**注意**：导出前请确保：
1. 所有验证已通过（verify_content 和 verify_abstract）
2. 润色已完成（paper_polisher）
3. 全文已合并（paper_coordinator merge）`,
      },
    ],
  };
}