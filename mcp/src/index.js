#!/usr/bin/env node

/**
 * Scientific Research MCP Server
 * 科学论文写作 MCP 服务器
 * 
 * 基于方案 A：共享核心 + 双端适配
 * - 共享核心：prompts, protocols, references
 * - 双端适配：MCP Server (本文件) + Workbuddy Skills
 */

// 尝试加载 .env 文件（如果存在）
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  const dotenv = await import('dotenv');
  dotenv.config({ path: path.join(__dirname, '../.env') });
} catch {
  // dotenv 未安装或 .env 文件不存在，忽略错误
}

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs/promises';

// ==================== 路径配置 ====================

// 共享核心文件路径
const SHARED_DIR = path.join(__dirname, '../../shared');
const PROMPTS_DIR = path.join(SHARED_DIR, 'prompts');
const PROTOCOLS_DIR = path.join(SHARED_DIR, 'protocols');
const REFERENCES_DIR = path.join(SHARED_DIR, 'references');

// 论文工作区路径（从环境变量或默认位置获取）
const PAPER_DIR = process.env.PAPER_DIR || path.join(process.cwd(), 'paper');

// Workbuddy Skills 路径
const WORKBUDDY_SKILLS_DIR = path.join(__dirname, '../../workbuddy-skills');

// ==================== 工具定义 ====================

const TOOLS = [
  {
    name: 'paper_coordinator',
    description: '科学论文写作总协调器。初始化项目、管理进度、推荐下一步操作、合并全文。',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['init', 'progress', 'recommend', 'merge', 'export', 'check-gate', 'save_version'],
          description: '操作类型：init(初始化) / progress(查看进度) / recommend(推荐下一步) / merge(合并全文) / export(导出) / check-gate(定稿门控检查) / save_version(保存版本)'
        },
        paper_type: {
          type: 'string',
          enum: ['chinese-thesis', 'english-journal', 'chinese-journal'],
          description: '论文类型（初始化时必填）'
        },
        research_topic: {
          type: 'string',
          description: '研究方向/主题（初始化时必填）'
        },
        target_journal: {
          type: 'string',
          description: '投稿期刊名称（可选）'
        },
        has_materials: {
          type: 'boolean',
          description: '是否已有素材（文献、草稿、数据等）'
        },
        material_paths: {
          type: 'array',
          items: { type: 'string' },
          description: '已有素材的文件路径列表'
        },
        wechat_webhook: {
          type: 'string',
          description: '企业微信 Webhook URL（可选）'
        }
      },
      required: ['action']
    }
  },
  {
    name: 'paper_writer',
    description: '论文写作引擎。撰写论文的各个章节（引言、方法、结果、讨论、结论）。',
    inputSchema: {
      type: 'object',
      properties: {
        chapter: {
          type: 'string',
          enum: ['intro', 'methods', 'results', 'discussion', 'conclusion'],
          description: '要撰写的章节'
        },
        content_materials: {
          type: 'string',
          description: '用户提供的内容材料（实验步骤、数据结果等）'
        },
        rewrite: {
          type: 'boolean',
          description: '是否重写已存在的章节'
        }
      },
      required: ['chapter']
    }
  },
  {
    name: 'abstract_writer',
    description: '摘要与标题生成器。基于完整论文内容生成摘要和标题。',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['generate', 'rewrite'],
          description: '操作：generate(生成) / rewrite(重写)'
        }
      },
      required: ['action']
    }
  },
  {
    name: 'paper_polisher',
    description: '论文润色专家。语言润色、翻译语气纠正、格式检查。支持精简模式控制字数。',
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          enum: ['full', 'intro', 'methods', 'results', 'discussion', 'conclusion', 'abstract'],
          description: '润色范围'
        },
        focus: {
          type: 'string',
          enum: ['language', 'format', 'citation', 'all'],
          description: '润色重点'
        },
        mode: {
          type: 'string',
          enum: ['standard', 'concise'],
          description: '润色模式：standard(标准润色) / concise(精简润色，压缩10-20%)'
        }
      },
      required: ['scope']
    }
  },
  {
    name: 'verify_content',
    description: '论文内容准确性与逻辑链验证专家。检查逻辑一致性、事实性陈述可信度、论证链完整性。支持框架一致性、分类标准、首尾呼应等专项检查。',
    inputSchema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['full', 'incremental', 'targeted', 'skip'],
          description: '验证模式：full(全量) / incremental(增量) / targeted(定向) / skip(跳过)'
        },
        target_chapters: {
          type: 'array',
          items: { type: 'string' },
          description: '定向验证的目标章节列表'
        },
        focus: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['framework', 'classification', 'conclusion', 'relevance', 'logic', 'consistency', 'facts', 'fallacy', 'citation', 'crossref']
          },
          description: '验证重点：framework(框架一致性) / classification(分类标准) / conclusion(首尾呼应) / relevance(内容相关性) / logic(论证逻辑) / consistency(内部一致性) / facts(事实性陈述) / fallacy(逻辑谬误) / citation(参考文献) / crossref(交叉验证)'
        }
      },
      required: ['mode']
    }
  },
  {
    name: 'verify_abstract',
    description: '摘要验证专家。检查摘要与正文的一致性、准确性、完整性。',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['verify', 'reverify'],
          description: '操作：verify(验证) / reverify(重新验证)'
        }
      },
      required: ['action']
    }
  },
  {
    name: 'literature_reviewer',
    description: '文献综述撰写专家。处理文献PDF、提取关键信息、撰写文献综述。',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['process_pdfs', 'write_review', 'check_references'],
          description: '操作：process_pdfs(处理PDF) / write_review(撰写综述) / check_references(检查参考文献)'
        },
        pdf_paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'PDF文件路径列表（处理PDF时必填）'
        }
      },
      required: ['action']
    }
  },
  {
    name: 'list_tools',
    description: '列出所有可用的论文写作工具及其功能说明。',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'verify_framework',
    description: '框架验证工具。检查论文中核心框架/概念的一致性，生成概念一致性报告，标记前后不一致的表述。',
    inputSchema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['full'],
          description: '验证模式：full(全量)'
        }
      },
      required: []
    }
  },
  {
    name: 'verify_data',
    description: '数据验证助手。自动提取文中的具体数据（日期、面积、人数等），生成数据核实清单供用户逐项确认。',
    inputSchema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['full'],
          description: '验证模式：full(全量)'
        }
      },
      required: []
    }
  },
  {
    name: 'methodology_checker',
    description: '方法论审查工具。检查研究方法的完整性和合理性，验证样本选择理由，检查效度/信度论述。',
    inputSchema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['full'],
          description: '验证模式：full(全量)'
        }
      },
      required: []
    }
  },
  {
    name: 'verify_citation',
    description: '引用验证工具。验证论文草稿中的引用是否真实存在，消除 LLM 幻觉。支持 DOI、作者 - 年份、标题、GB/T 7714 等格式的引用。支持本地文献库验证（用户提供PDF）。',
    inputSchema: {
      type: 'object',
      properties: {
        draft_content: {
          type: 'string',
          description: '待验证的论文草稿内容（可选，默认读取 draft-full.md）'
        },
        strict_mode: {
          type: 'boolean',
          description: '严格模式：无法验证的引用也标记为可疑（默认 false）'
        },
        use_local_library: {
          type: 'boolean',
          description: '启用本地文献库验证：检查引用是否在参考文献列表或 reference-papers 目录中存在（默认 true）'
        }
      },
      required: []
    }
  },
  {
    name: 'literature_searcher',
    description: '文献检索工具。使用 OpenAlex API 检索英文文献，支持关键词检索、DOI 查询、论文详情获取。',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['search', 'get_by_id', 'get_by_doi'],
          description: '操作类型：search(检索) / get_by_id(按 ID 获取) / get_by_doi(按 DOI 获取)'
        },
        query: {
          type: 'string',
          description: '检索关键词（search 操作必填）'
        },
        id: {
          type: 'string',
          description: 'OpenAlex ID（get_by_id 操作必填）'
        },
        doi: {
          type: 'string',
          description: 'DOI（get_by_doi 操作必填）'
        },
        per_page: {
          type: 'number',
          description: '每页结果数（默认 5，最大 100）'
        }
      },
      required: ['action']
    }
  },
  {
    name: 'material_reader',
    description: '资料读取反馈工具。读取用户上传的各类资料（PDF、DOCX、TXT、MD、URL、文本），并返回每个资料的读取结果（成功/失败）。',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['read', 'log'],
          description: '操作类型：read(读取资料) / log(查看读取日志)'
        },
        materials: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['pdf', 'docx', 'txt', 'md', 'json', 'url', 'text'],
                description: '资料类型'
              },
              path: {
                type: 'string',
                description: '文件路径（文件类型必填）'
              },
              url: {
                type: 'string',
                description: 'URL地址（URL类型必填）'
              },
              content: {
                type: 'string',
                description: '直接提供的文本内容（文本类型使用）'
              }
            },
            required: ['type']
          },
          description: '待读取的资料列表（read操作必填）'
        }
      },
      required: ['action']
    }
  },
  {
    name: 'version_control',
    description: 'Git版本控制工具。管理论文版本、生成变更摘要、版本对比、查看提交历史。',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['init', 'status', 'commit', 'log', 'diff', 'tags', 'summary'],
          description: '操作类型：init(初始化) / status(状态) / commit(提交) / log(历史) / diff(对比) / tags(标签) / summary(变更摘要)'
        },
        message: {
          type: 'string',
          description: '提交信息（commit操作必填）'
        },
        tag: {
          type: 'string',
          description: '版本标签（commit操作可选）'
        },
        from_version: {
          type: 'string',
          description: '起始版本（diff和summary操作必填）'
        },
        to_version: {
          type: 'string',
          description: '目标版本（diff操作必填，默认为HEAD）'
        },
        limit: {
          type: 'number',
          description: '日志条数限制（log操作，默认10）'
        }
      },
      required: ['action']
    }
  },
  {
    name: 'cache_manager',
    description: '缓存管理工具。查看缓存统计、清空缓存、优化性能。',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['stats', 'clear', 'clean'],
          description: '操作类型：stats(统计) / clear(清空) / clean(清理过期)'
        }
      },
      required: ['action']
    }
  }
];

// ==================== MCP Server 类 ====================

class ScientificResearchMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'scientific-research-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // 错误处理
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    // 列出所有可用工具
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOLS,
    }));

    // 处理工具调用
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'paper_coordinator':
          return await this.handlePaperCoordinator(args);
        case 'paper_writer':
          return await this.handlePaperWriter(args);
        case 'abstract_writer':
          return await this.handleAbstractWriter(args);
        case 'paper_polisher':
          return await this.handlePaperPolisher(args);
      case 'methodology_checker':
          return await this.handleMethodologyChecker(args);
        case 'verify_data':
          return await this.handleVerifyData(args);
        case 'verify_framework':
          return await this.handleVerifyFramework(args);
        case 'verify_content':
          return await this.handleVerifyContent(args);
        case 'verify_abstract':
          return await this.handleVerifyAbstract(args);
        case 'literature_reviewer':
          return await this.handleLiteratureReviewer(args);
        case 'list_tools':
          return await this.handleListTools();
        case 'verify_citation':
          return await this.handleVerifyCitation(args);
        case 'literature_searcher':
          return await this.handleLiteratureSearcher(args);
        case 'material_reader':
          return await this.handleMaterialReader(args);
        case 'version_control':
          return await this.handleVersionControl(args);
        case 'cache_manager':
          return await this.handleCacheManager(args);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${name}`
          );
      }
    });
  }

  // ==================== Paper Coordinator ====================

  async handlePaperCoordinator(args) {
    const { action, paper_type, research_topic, target_journal, has_materials, material_paths, wechat_webhook } = args;

    switch (action) {
      case 'init':
        return await this.initProject(paper_type, research_topic, target_journal, has_materials, material_paths, wechat_webhook);
      case 'progress':
        return await this.showProgress();
      case 'recommend':
        return await this.recommendNextStep();
      case 'merge':
        return await this.mergeFullDraft();
      case 'export':
        return await this.exportDraft();
      case 'check-gate':
        return await this.checkGate();
      case 'save_version':
        return await this.saveVersion(args.version, args.description, args.source_file);
      default:
        throw new McpError(
          ErrorCode.InvalidParams,
          `Invalid action: ${action}`
        );
    }
  }

  async initProject(paperType, researchTopic, targetJournal, hasMaterials, materialPaths, wechatWebhook) {
    if (!paperType || !researchTopic) {
      return {
        content: [
          {
            type: 'text',
            text: '❌ 初始化失败：缺少必要参数\n\n请提供：\n- paper_type: 论文类型（chinese-thesis / english-journal / chinese-journal）\n- research_topic: 研究方向/主题\n\n可选参数：\n- target_journal: 投稿期刊名称\n- has_materials: 是否已有素材\n- material_paths: 已有素材的文件路径列表\n- wechat_webhook: 企业微信 Webhook URL',
          },
        ],
      };
    }

    try {
      // 创建论文工作区目录
      await fs.mkdir(PAPER_DIR, { recursive: true });

      // 创建 metadata.json
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
        wechatWebhook: wechatWebhook || '',
        referencePapers: [],
      };

      await fs.writeFile(
        path.join(PAPER_DIR, 'metadata.json'),
        JSON.stringify(metadata, null, 2),
        'utf-8'
      );

      // 创建 progress.md
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

## 验证覆盖率

| 验证类型 | 最后执行版本 | 执行时间 | 状态 | 待核查项 |
|---------|------------|---------|------|---------|
| verify-content（全量） | - | - | 未执行 | - |
| verify-content（增量） | - | - | 未执行 | - |
| verify-abstract | - | - | 未执行 | - |

## 验证记录

<!-- 每次验证后在此追加记录 -->
`;

      await fs.writeFile(
        path.join(PAPER_DIR, 'progress.md'),
        progressContent,
        'utf-8'
      );

      // 创建 outline.md
      await fs.writeFile(
        path.join(PAPER_DIR, 'outline.md'),
        '# 论文大纲\n\n<!-- 由 paper-writer 或用户填充 -->\n',
        'utf-8'
      );

      // 创建 changelog.md
      await fs.writeFile(
        path.join(PAPER_DIR, 'changelog.md'),
        '# 论文变更日志\n\n| 日期 | 版本 | 章节 | 变更摘要 | 操作 Skill |\n|------|------|------|---------|-----------|\n',
        'utf-8'
      );

      // 生成文献检索关键词清单
      await this.generateSearchKeywords(researchTopic, paperType, targetJournal);

      // 处理已有素材
      if (hasMaterials && materialPaths && materialPaths.length > 0) {
        await this.processExistingMaterials(materialPaths);
      }

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
- search-keywords.md - 文献检索关键词清单

**下一步**：
1. 使用 paper/search-keywords.md 中的关键词检索文献
2. 检索完成后，使用 literature-reviewer 处理下载的文献
3. 或直接使用 paper_writer 开始撰写论文章节`,
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

  async generateSearchKeywords(researchTopic, paperType, targetJournal) {
    // 基于研究方向生成结构化的中英文文献检索关键词清单
    const keywords = this.extractKeywords(researchTopic);
    
    const journalPreference = targetJournal ? `\n> 目标期刊：${targetJournal}（关键词已考虑该期刊的学科领域和收录偏好）` : '';
    
    const content = `# 文献检索关键词清单

> 论文主题：${researchTopic}
> 论文类型：${this.getPaperTypeDescription(paperType)}
> 生成日期：${new Date().toISOString().split('T')[0]}
> 说明：请使用以下关键词在对应数据库检索文献，下载 PDF 后提供给 MCP 处理。${journalPreference}

## 子方向一：${keywords[0].name}
- 中文检索词：${keywords[0].cn.join(' AND ')}
- 英文检索词：${keywords[0].en.map(k => `"${k}"`).join(' AND ')}
- 推荐数据库：CNKI / Google Scholar
- 建议文献数量：3-5 篇

## 子方向二：${keywords[1].name}
- 中文检索词：${keywords[1].cn.join(' AND ')}
- 英文检索词：${keywords[1].en.map(k => `"${k}"`).join(' AND ')}
- 推荐数据库：CNKI / Web of Science
- 建议文献数量：3-5 篇

## 子方向三：${keywords[2].name}
- 中文检索词：${keywords[2].cn.join(' AND ')}
- 英文检索词：${keywords[2].en.map(k => `"${k}"`).join(' AND ')}
- 推荐数据库：Google Scholar / Web of Science
- 建议文献数量：3-5 篇

## 检索注意事项
- 中文文献优先在 CNKI 检索，关注近 5 年的期刊论文
- 英文文献优先在 Web of Science / Google Scholar 检索
- 优先选择被引量高、发表在核心/SCI/EI 期刊的文献
- 检索完成后，将 PDF 放入 paper/reference-papers/ 目录
- 提供文献后，使用 literature-reviewer 处理
`;

    await fs.writeFile(path.join(PAPER_DIR, 'search-keywords.md'), content, 'utf-8');
  }

  extractKeywords(topic) {
    // 简化的关键词提取逻辑
    // 实际实现中可以使用 NLP 技术进行更精确的提取
    const words = topic.split(/[\s，,、]+/).filter(w => w.length > 0);
    
    return [
      {
        name: '理论基础',
        cn: [words[0] || '主题', '理论', '框架', '概念'],
        en: [(words[0] || 'topic'), 'theory', 'framework', 'concept']
      },
      {
        name: '技术方法',
        cn: [words[0] || '主题', '方法', '技术', '算法'],
        en: [(words[0] || 'topic'), 'method', 'technique', 'algorithm']
      },
      {
        name: '应用案例',
        cn: [words[0] || '主题', '应用', '案例', '实践'],
        en: [(words[0] || 'topic'), 'application', 'case study', 'practice']
      }
    ];
  }

  getPaperTypeDescription(paperType) {
    const descriptions = {
      'chinese-thesis': '中文学位论文',
      'english-journal': '英文期刊论文',
      'chinese-journal': '中文期刊论文'
    };
    return descriptions[paperType] || paperType;
  }

  async processExistingMaterials(materialPaths) {
    // 处理用户已有的素材（文献、草稿、数据等）
    for (const materialPath of materialPaths) {
      try {
        const content = await fs.readFile(materialPath, 'utf-8');
        const fileName = path.basename(materialPath);
        
        // 根据文件类型进行处理
        if (fileName.endsWith('.md')) {
          // Markdown 文件可能是草稿，复制到 paper 目录
          const destPath = path.join(PAPER_DIR, `imported-${fileName}`);
          await fs.writeFile(destPath, content, 'utf-8');
        }
        // 其他类型的文件可以添加相应的处理逻辑
      } catch (error) {
        console.error(`处理素材失败: ${materialPath}`, error);
      }
    }
  }

  async showProgress() {
    try {
      const metadataPath = path.join(PAPER_DIR, 'metadata.json');
      const progressPath = path.join(PAPER_DIR, 'progress.md');

      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
      const progress = await fs.readFile(progressPath, 'utf-8');

      // 检查验证覆盖率
      const verificationStatus = this.checkVerificationStatus(metadata, progress);

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
- 投稿期刊：${metadata.targetJournal}

**进度详情**：
${progress}

${verificationStatus}`,
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

  checkVerificationStatus(metadata, progress) {
    // 检查验证是否过时
    const lastModified = new Date(metadata.lastModified);
    
    // 从 progress.md 中提取验证信息
    const verifyContentMatch = progress.match(/verify-content.*?\|.*?\|.*?\|.*?\|.*?\|/);
    const verifyAbstractMatch = progress.match(/verify-abstract.*?\|.*?\|.*?\|.*?\|.*?\|/);
    
    let status = '\n⚠️ 验证状态提醒：\n';
    let hasWarning = false;
    
    // 简化的验证状态检查
    if (verifyContentMatch) {
      status += '- verify-content: 请检查执行时间是否晚于最后修改时间\n';
      hasWarning = true;
    }
    
    if (verifyAbstractMatch) {
      status += '- verify-abstract: 请检查执行时间是否晚于最后修改时间\n';
      hasWarning = true;
    }
    
    if (!hasWarning) {
      status = '\n✅ 暂无验证记录，建议完成写作后执行验证。\n';
    }
    
    return status;
  }

  async recommendNextStep() {
    try {
      const metadataPath = path.join(PAPER_DIR, 'metadata.json');
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));

      const recommendations = {
        'topic': '📝 建议：使用 paper/search-keywords.md 中的关键词检索文献，然后使用 literature-reviewer 处理',
        'literature': '📝 建议：使用 paper_writer 开始撰写论文章节',
        'writing': '📝 建议：继续完成剩余章节的写作，每写完一章建议执行 verify_content 验证',
        'abstract': '📝 建议：使用 abstract_writer 生成摘要，然后执行 verify_abstract 验证',
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

  async mergeFullDraft() {
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
        const chapterPath = path.join(PAPER_DIR, chapter.file);
        try {
          const content = await fs.readFile(chapterPath, 'utf-8');
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
      const fullPath = path.join(PAPER_DIR, 'draft-full.md');
      try {
        await fs.access(fullPath);
        const backupPath = path.join(PAPER_DIR, `draft-full-v${Date.now()}.md`);
        await fs.rename(fullPath, backupPath);
      } catch {
        // 文件不存在，无需备份
      }

      await fs.writeFile(fullPath, fullContent, 'utf-8');

      return {
        content: [
          {
            type: 'text',
            text: `✅ 全文合并成功！

**已合并章节**：${mergedCount} 个
**输出文件**：${fullPath}`,
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

  async exportDraft() {
    return {
      content: [
        {
          type: 'text',
          text: `📤 导出功能

**前提条件**：
1. 所有验证已通过（verify_content 和 verify_abstract）
2. 润色已完成（paper_polisher）
3. 全文已合并（paper_coordinator merge）
4. 定稿门控检查已通过（paper_coordinator check-gate）

**PDF 导出**：
\`\`\`bash
python md2pdf.py paper/draft-full.md output/终稿.pdf
\`\`\`

**Word 导出**：
\`\`\`bash
python md2docx.py paper/draft-full.md output/终稿.docx
\`\`\`

**注意**：
- 需安装 fpdf2 (\`pip install fpdf2\`) 用于 PDF 导出
- 需安装 python-docx (\`pip install python-docx\`) 用于 Word 导出`,
        },
      ],
    };
  }

  async checkGate() {
    // Phase 6 增强：定稿门控检查 - 集成所有验证工具 + 质量报告
    try {
      const metadataPath = path.join(PAPER_DIR, 'metadata.json');
      const progressPath = path.join(PAPER_DIR, 'progress.md');
      const qualityReportPath = path.join(PAPER_DIR, 'quality-report.md');
      
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
      const progress = await fs.readFile(progressPath, 'utf-8');
      
      let issues = [];
      let warnings = [];
      let scores = {};
      
      // ==================== 基础检查 ====================
      
      // 检查 1：验证覆盖率
      if (progress.includes('未执行')) {
        issues.push('⚠️ 验证覆盖率不足：存在未执行的验证项');
      }
      
      // 检查 2：致命问题
      if (progress.includes('❌')) {
        issues.push('❌ 存在未解决的致命问题');
      }
      
      // 检查 3：待核查项
      const pendingMatch = progress.match(/待核查项.*?(\d+)/);
      if (pendingMatch && parseInt(pendingMatch[1]) > 0) {
        issues.push(`⚠️ 存在 ${pendingMatch[1]} 个待人工核查项`);
      }
      
      // ==================== Phase 6 增强：检查各验证结果文件 ====================
      
      // 检查 verify_content 结果
      const verifyContentReport = path.join(PAPER_DIR, 'reports', 'verify-content-report.md');
      try {
        await fs.access(verifyContentReport);
        const content = await fs.readFile(verifyContentReport, 'utf-8');
        // 统计错误和警告
        const errors = (content.match(/❌/g) || []).length;
        const warns = (content.match(/⚠️/g) || []).length;
        scores.verifyContent = errors === 0 ? 100 : Math.max(0, 100 - errors * 15 - warns * 5);
        if (errors > 0) {
          issues.push(`❌ verify_content 发现 ${errors} 个错误`);
        }
        if (warns > 0) {
          warnings.push(`⚠️ verify_content 发现 ${warns} 个警告`);
        }
      } catch {
        warnings.push('⚠️ 未找到 verify_content 验证报告，建议先执行验证');
      }
      
      // 检查 verify_framework 结果
      const verifyFrameworkReport = path.join(PAPER_DIR, 'reports', 'verify-framework-report.md');
      try {
        await fs.access(verifyFrameworkReport);
        const content = await fs.readFile(verifyFrameworkReport, 'utf-8');
        const errors = (content.match(/❌/g) || []).length;
        const warns = (content.match(/⚠️/g) || []).length;
        scores.frameworkConsistency = errors === 0 ? 100 : Math.max(0, 100 - errors * 20 - warns * 10);
        if (errors > 0) {
          issues.push(`❌ 框架一致性检查发现 ${errors} 个问题`);
        }
      } catch {
        warnings.push('⚠️ 未找到 verify_framework 验证报告');
      }
      
      // 检查 verify_citation 结果
      const verifyCitationReport = path.join(PAPER_DIR, 'reports', 'verify-citation-report.md');
      try {
        await fs.access(verifyCitationReport);
        const content = await fs.readFile(verifyCitationReport, 'utf-8');
        const notFound = (content.match(/未在本地找到/g) || []).length;
        scores.citationCoverage = notFound === 0 ? 100 : Math.max(0, 100 - notFound * 10);
        if (notFound > 0) {
          warnings.push(`⚠️ 引用验证发现 ${notFound} 条未在本地找到的引用`);
        }
      } catch {
        warnings.push('⚠️ 未找到 verify_citation 验证报告');
      }
      
      // 检查 verify_data 结果
      const verifyDataReport = path.join(PAPER_DIR, 'reports', 'verify-data-report.md');
      try {
        await fs.access(verifyDataReport);
        const content = await fs.readFile(verifyDataReport, 'utf-8');
        const pending = (content.match(/\[ \] 待核实/g) || []).length;
        scores.dataVerification = pending === 0 ? 100 : Math.max(0, 100 - pending * 5);
        if (pending > 0) {
          warnings.push(`⚠️ 数据验证发现 ${pending} 项待人工核实`);
        }
      } catch {
        warnings.push('⚠️ 未找到 verify_data 验证报告');
      }
      
      // 检查 methodology_checker 结果
      const methodologyReport = path.join(PAPER_DIR, 'reports', 'methodology-report.md');
      try {
        await fs.access(methodologyReport);
        const content = await fs.readFile(methodologyReport, 'utf-8');
        const errors = (content.match(/❌/g) || []).length;
        scores.methodology = errors === 0 ? 100 : Math.max(0, 100 - errors * 15);
        if (errors > 0) {
          warnings.push(`⚠️ 方法论审查发现 ${errors} 个问题`);
        }
      } catch {
        warnings.push('⚠️ 未找到 methodology_checker 审查报告');
      }
      
      // ==================== 计算综合评分 ====================
      const scoreKeys = Object.keys(scores);
      const totalScore = scoreKeys.length > 0 
        ? Math.round(scoreKeys.reduce((sum, k) => sum + scores[k], 0) / scoreKeys.length)
        : null;
      
      if (totalScore !== null) {
        scores.overall = totalScore;
      }
      
      // ==================== 生成质量报告 ====================
      const qualityReport = this.generateQualityReport(scores, issues, warnings, progress);
      await fs.writeFile(qualityReportPath, qualityReport, 'utf-8');
      
      // ==================== 判定结果 ====================
      const hasCriticalIssues = issues.some(i => i.startsWith('❌'));
      const tooManyWarnings = issues.length + warnings.length > 5;
      
      if (hasCriticalIssues) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ 定稿门控检查未通过！

**致命问题**：
${issues.filter(i => i.startsWith('❌')).map(i => `- ${i}`).join('\n')}

**其他问题**：
${issues.filter(i => i.startsWith('⚠️')).map(i => `- ${i}`).join('\n')}

**警告**：
${warnings.map(i => `- ${i}`).join('\n')}

${totalScore !== null ? `**综合评分**：${totalScore}/100\n` : ''}
**建议**：
1. 优先解决所有致命问题
2. 处理所有待人工核查项
3. 重新执行门控检查

质量报告已保存至：${qualityReportPath}`,
            },
          ],
        };
      } else if (tooManyWarnings) {
        return {
          content: [
            {
              type: 'text',
              text: `⚠️ 定稿门控检查通过但有较多警告

**问题**：
${issues.map(i => `- ${i}`).join('\n')}

**警告**：
${warnings.map(i => `- ${i}`).join('\n')}

${totalScore !== null ? `**综合评分**：${totalScore}/100\n` : ''}
**建议**：建议处理警告后再导出，但不是强制要求。

质量报告已保存至：${qualityReportPath}`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `✅ 定稿门控检查通过！

${totalScore !== null ? `**综合评分**：${totalScore}/100\n` : ''}
所有检查项均符合要求，可以导出终稿。

${Object.keys(scores).filter(k => k !== 'overall').map(k => {
  const names = {
    verifyContent: '内容验证',
    frameworkConsistency: '框架一致性',
    citationCoverage: '引用覆盖率',
    dataVerification: '数据核实率',
    methodology: '方法论审查'
  };
  return `- ${names[k] || k}：${scores[k]}/100`;
}).join('\n')}

质量报告已保存至：${qualityReportPath}`,
            },
          ],
        };
      }
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
        `门控检查失败：${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Phase 6：生成论文质量报告
   */
  generateQualityReport(scores, issues, warnings, progress) {
    const today = new Date().toISOString().split('T')[0];
    
    const scoreNames = {
      verifyContent: '内容验证',
      frameworkConsistency: '框架一致性',
      citationCoverage: '引用覆盖率',
      dataVerification: '数据核实率',
      methodology: '方法论审查',
      overall: '综合评分'
    };
    
    let report = `# 论文质量报告\n\n`;
    report += `> 生成日期：${today}\n`;
    report += `> 说明：本报告由 MCP Server 自动生成，供定稿前参考\n\n`;
    
    report += `## 一、综合评分\n\n`;
    if (scores.overall !== undefined) {
      const level = scores.overall >= 90 ? '优秀' : scores.overall >= 70 ? '良好' : scores.overall >= 50 ? '合格' : '需改进';
      report += `**综合评分**：${scores.overall}/100（${level}）\n\n`;
    }
    
    report += `| 指标 | 得分 | 说明 |\n`;
    report += `|------|------|------|\n`;
    for (const [key, value] of Object.entries(scores)) {
      if (key !== 'overall') {
        report += `| ${scoreNames[key] || key} | ${value}/100 | ${value >= 80 ? '✅' : value >= 60 ? '⚠️' : '❌'} |\n`;
      }
    }
    
    report += `\n## 二、问题清单\n\n`;
    if (issues.length === 0 && warnings.length === 0) {
      report += `暂无问题。\n`;
    } else {
      report += `### 问题\n\n`;
      issues.forEach((issue, i) => {
        report += `${i + 1}. ${issue}\n`;
      });
      
      report += `\n### 警告\n\n`;
      warnings.forEach((warning, i) => {
        report += `${i + 1}. ${warning}\n`;
      });
    }
    
    report += `\n## 三、改进建议\n\n`;
    if (scores.verifyContent !== undefined && scores.verifyContent < 80) {
      report += `- **内容验证**：建议执行 verify_content 重新验证内容准确性\n`;
    }
    if (scores.frameworkConsistency !== undefined && scores.frameworkConsistency < 80) {
      report += `- **框架一致性**：建议执行 verify_framework 检查框架表述是否一致\n`;
    }
    if (scores.citationCoverage !== undefined && scores.citationCoverage < 80) {
      report += `- **引用覆盖率**：建议将文献PDF放入 reference-papers 目录后执行 verify_citation\n`;
    }
    if (scores.dataVerification !== undefined && scores.dataVerification < 80) {
      report += `- **数据核实**：请逐项核实报告中列出的数据\n`;
    }
    if (scores.methodology !== undefined && scores.methodology < 80) {
      report += `- **方法论**：建议执行 methodology_checker 审查研究方法\n`;
    }
    
    report += `\n## 四、验证记录\n\n`;
    report += progress;
    
    return report;
  }

  async saveVersion(version, description, sourceFile) {
    try {
      // 动态导入 paper-coordinator.js
      const { saveVersion } = await import('./tools/paper-coordinator.js');
      return await saveVersion(version, description, sourceFile);
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ 版本保存失败：${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  // ==================== Paper Writer ====================

  async handlePaperWriter(args) {
    const { chapter, content_materials, rewrite } = args;

    try {
      const metadataPath = path.join(PAPER_DIR, 'metadata.json');
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));

      const chapterNames = {
        'intro': '引言',
        'methods': '方法',
        'results': '结果',
        'discussion': '讨论',
        'conclusion': '结论',
      };

      const chapterName = chapterNames[chapter] || chapter;
      const draftPath = path.join(PAPER_DIR, `draft-${chapter}.md`);

      // 检查章节是否已存在
      try {
        await fs.access(draftPath);
        if (!rewrite) {
          return {
            content: [
              {
                type: 'text',
                text: `⚠️ 章节 "${chapterName}" 已存在。如需重写，请设置 rewrite=true。`,
              },
            ],
          };
        }
      } catch {
        // 文件不存在，可以创建
      }

      // 生成草稿内容
      const result = await this.generateChapterDraft(chapter, metadata, content_materials);
      const draftContent = result.content;
      const usedFallback = result.usedFallback;

      await fs.writeFile(draftPath, draftContent, 'utf-8');

      // 更新进度
      await this.updateProgress(chapter);

      // 构建响应消息
      let responseText = `✅ ${chapterName}草稿已生成！

**输出文件**：${draftPath}

**提示**：建议执行 verify_content 验证内容准确性。`;

      // 如果使用了降级方案，添加用户可见的提示
      if (usedFallback) {
        responseText += `

⚠️ **降级提示**：本次内容生成使用了模板方案（LLM调用失败）。
当前生成的是学术模板草稿，需要您手动填写具体内容。
如需使用AI生成功能，请确保：
1. 已配置 \`ALIBABA_CLOUD_API_KEY\` 环境变量
2. API密钥有效且网络正常`;
      }

      return {
        content: [
          {
            type: 'text',
            text: responseText,
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
        `写作失败：${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async generateChapterDraft(chapter, metadata, contentMaterials) {
    const chapterNames = {
      'intro': '引言',
      'methods': '方法',
      'results': '结果',
      'discussion': '讨论',
      'conclusion': '结论',
    };

    const chapterName = chapterNames[chapter] || chapter;
    
    // 构建提示词
    let prompt = `请撰写一篇学术论文的"${chapterName}"章节。

## 论文信息
- 论文类型：${metadata.paperType}
- 研究方向：${metadata.researchTopic}
- 投稿期刊：${metadata.targetJournal || '未确定'}
`;

    if (contentMaterials) {
      prompt += `
## 用户提供的素材
${contentMaterials}
`;
    }

    prompt += `
## 写作要求
1. 遵循学术写作规范，使用客观、准确的语言
2. 所有断言需有引用支撑
3. 如果不确定文献是否存在，请使用 [待核实] 标记
4. 不要编造论文标题、作者或期刊名称
5. 使用Markdown格式输出
`;

    const systemPrompt = `你是一个专业的学术写作助手。请根据用户的要求撰写论文章节。

重要提醒：
1. 所有引用必须来自真实存在的文献
2. 如果不确定文献是否存在，请使用 [待核实] 标记
3. 不要编造论文标题、作者或期刊名称
4. 遵循学术写作规范，使用客观、准确的语言`;

    let usedFallback = false;
    let content;
    
    try {
      // 尝试调用真实LLM
      const { generateContent } = await import('./services/llm-service.js');
      const response = await generateContent(prompt, systemPrompt, {
        temperature: 0.7,
        max_tokens: 16000
      });
      content = response.content;
    } catch (llmError) {
      console.error(`⚠️ LLM调用失败，已降级使用模板方案：${llmError.message}`);
      usedFallback = true;
      
      // LLM调用失败，返回模板
      const chapterTemplates = {
        'intro': `# 引言

## 研究背景

[在此处撰写研究背景，介绍研究领域的现状和发展趋势]

## 研究现状

[在此处撰写相关研究现状，综述已有研究成果]

## 研究空白

[在此处指出当前研究的不足和待解决的问题]

## 研究目的

[在此处说明本研究的目的和贡献]

本研究旨在${metadata.researchTopic}，解决现有研究中的不足。`,

        'methods': `# 研究方法

## 研究对象

[在此处描述研究对象/材料]

## 研究设计

[在此处描述研究设计类型]

## 数据收集

[在此处描述数据收集方法]

## 数据分析

[在此处描述数据分析方法]`,

        'results': `# 研究结果

## 描述性统计

[在此处呈现样本特征]

## 主要结果

[在此处呈现核心发现]

## 次要结果

[在此处呈现支撑性发现]`,

        'discussion': `# 讨论

## 主要发现总结

[在此处概括核心发现]

## 与已有研究的比较

[在此处与已有研究进行比较]

## 局限性

[在此处列出研究局限性]

## 结论与展望

[在此处总结结论并提出未来方向]`,

        'conclusion': `# 结论

[在此处用1-2句话总结核心发现]

[在此处说明研究的理论和/或实践意义]

[可选：提出未来研究方向]`,
      };

      content = chapterTemplates[chapter] || `# ${chapter}\n\n[待撰写]`;
      
      // 如果有用户提供的内容材料，附加到模板后面
      if (contentMaterials) {
        content += `\n\n## 用户提供的素材\n\n${contentMaterials}`;
      }
    }
    
    return { content, usedFallback };
  }

  async updateProgress(chapter) {
    try {
      const progressPath = path.join(PAPER_DIR, 'progress.md');
      let progress = await fs.readFile(progressPath, 'utf-8');

      const chapterStatus = {
        'intro': '论文写作',
        'methods': '论文写作',
        'results': '论文写作',
        'discussion': '论文写作',
        'conclusion': '论文写作',
      };

      const phase = chapterStatus[chapter];
      if (phase) {
        progress = progress.replace(
          `| ${phase} | 待处理 |`,
          `| ${phase} | 已完成 | ${new Date().toISOString().split('T')[0]} |`
        );
      }

      // 计算进度百分比
      const allChapters = ['intro', 'methods', 'results', 'discussion', 'conclusion'];
      let completedCount = 0;
      
      for (const ch of allChapters) {
        const draftPath = path.join(PAPER_DIR, `draft-${ch}.md`);
        try {
          await fs.access(draftPath);
          completedCount++;
        } catch {
          // 文件不存在
        }
      }

      const progressPercent = Math.round((completedCount / allChapters.length) * 100);
      const today = new Date().toISOString().split('T')[0];
      
      // 添加进度百分比到进度文件
      if (!progress.includes('进度百分比')) {
        const progressWithPercent = progress.replace(
          '## 阶段状态',
          `## 整体进度：${progressPercent}% (${completedCount}/${allChapters.length} 章节)\n\n## 阶段状态`
        );
        progress = progressWithPercent;
      } else {
        // 更新现有的进度百分比
        const percentRegex = /## 整体进度：.*?\n/;
        progress = progress.replace(
          percentRegex,
          `## 整体进度：${progressPercent}% (${completedCount}/${allChapters.length} 章节)\n`
        );
      }

      await fs.writeFile(progressPath, progress, 'utf-8');
    } catch {
      // 更新进度失败不影响主流程
    }
  }

  // ==================== Abstract Writer ====================

  async handleAbstractWriter(args) {
    const { action } = args;

    try {
      const metadataPath = path.join(PAPER_DIR, 'metadata.json');
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));

      if (action === 'generate') {
        const fullPath = path.join(PAPER_DIR, 'draft-full.md');
        try {
          await fs.access(fullPath);
        } catch {
          return {
            content: [
              {
                type: 'text',
                text: '❌ 未找到完整论文草稿。请先使用 paper_coordinator 的 merge 操作合并全文。',
              },
            ],
          };
        }

        // 读取完整论文内容
        const fullContent = await fs.readFile(fullPath, 'utf-8');

        // 构建提示词
        const prompt = `请根据以下论文内容生成摘要和标题。

## 论文信息
- 论文类型：${metadata.paperType}
- 研究方向：${metadata.researchTopic}
- 投稿期刊：${metadata.targetJournal || '未确定'}

## 论文内容
${fullContent.substring(0, 20000)}...

## 输出要求
1. 生成一个吸引人的论文标题
2. 生成400-600字的摘要，包含：
   - 研究背景与目的
   - 研究方法
   - 主要发现
   - 结论与意义
3. 提供5-6个关键词
4. 使用学术写作规范

## 输出格式
# 论文标题

[标题内容]

## 摘要

[摘要内容]

**关键词**：关键词1, 关键词2, 关键词3, 关键词4, 关键词5`;

        const systemPrompt = `你是一个专业的学术写作助手。请根据论文内容生成标题和摘要。`;

        let abstractContent;
        try {
          // 尝试调用真实LLM
          const { generateContent } = await import('./services/llm-service.js');
          const response = await generateContent(prompt, systemPrompt, {
            temperature: 0.5,
            max_tokens: 4000
          });
          abstractContent = response.content;
        } catch (llmError) {
          console.error(`⚠️ LLM调用失败，已降级使用模板方案：${llmError.message}`);
          console.error(`💡 提示：如需使用AI生成内容，请确保已配置 ALIBABA_CLOUD_API_KEY 环境变量`);
          // LLM调用失败，返回模板
          abstractContent = `# 论文标题

[请在此处生成标题]

## 摘要

[请在此处生成400-600字的摘要，包含：
- 研究背景与目的
- 研究方法
- 主要发现
- 结论与意义]

**关键词**：关键词1, 关键词2, 关键词3, 关键词4, 关键词5`;
        }

        const abstractPath = path.join(PAPER_DIR, 'abstract.md');
        await fs.writeFile(abstractPath, abstractContent, 'utf-8');

        // 构建响应消息
        let responseText = `✅ 摘要已生成！

**输出文件**：${abstractPath}

**提示**：请检查生成的摘要内容，然后使用 verify_abstract 验证。`;

        // 检查是否使用了降级模板（如果包含占位符文本）
        if (abstractContent.includes('[请在此处生成') || abstractContent.includes('[请在此处生成400-600字的摘要')) {
          responseText += `

⚠️ **降级提示**：本次摘要生成使用了模板方案（LLM调用失败）。
当前生成的是占位符模板，需要您手动填写摘要内容。
如需使用AI生成功能，请确保：
1. 已配置 \`ALIBABA_CLOUD_API_KEY\` 环境变量
2. API密钥有效且网络正常`;
        }

        return {
          content: [
            {
              type: 'text',
              text: responseText,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `⚠️ 未知操作：${action}。支持的操作：generate, rewrite`,
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
        `摘要生成失败：${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ==================== Methodology Checker ====================

  async handleMethodologyChecker(args) {
    const { mode } = args;

    try {
      // 动态导入 methodology-checker.js
      const { checkMethodology } = await import('./tools/methodology-checker.js');
      return await checkMethodology({ mode });
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ 方法论审查失败：${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  // ==================== Paper Polisher ====================

  async handlePaperPolisher(args) {
    const { scope, focus, mode } = args;

    try {
      // 动态导入 paper-polisher.js
      const { polishPaper } = await import('./tools/paper-polisher.js');
      return await polishPaper({ scope, focus, mode });
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ 润色失败：${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  // ==================== Verify Data ====================

  async handleVerifyData(args) {
    const { mode } = args;

    try {
      // 动态导入 verify-data.js
      const { verifyData } = await import('./tools/verify-data.js');
      return await verifyData({ mode });
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ 数据验证失败：${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  // ==================== Verify Framework ====================

  async handleVerifyFramework(args) {
    const { mode } = args;

    try {
      // 动态导入 verify-framework.js
      const { verifyFramework } = await import('./tools/verify-framework.js');
      return await verifyFramework({ mode });
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ 框架验证失败：${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  // ==================== Verify Content ====================

  async handleVerifyContent(args) {
    const { mode, target_chapters, focus } = args;

    try {
      // 动态导入 verify-content.js
      const { verifyContent } = await import('./tools/verify-content.js');
      return await verifyContent({ mode, target_chapters, focus });
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ 验证失败：${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  // ==================== Verify Abstract ====================

  async handleVerifyAbstract(args) {
    const { action } = args;

    return {
      content: [
        {
          type: 'text',
          text: `🔍 摘要验证功能

**操作**：${action}

**验证内容**：
- 摘要与正文一致性
- 摘要准确性
- 摘要完整性
- 关键词覆盖度

**当前状态**：此功能需要连接 LLM API 进行实际验证。
MCP Server 已准备好接收验证请求。`,
        },
      ],
    };
  }

  // ==================== Verify Citation ====================

  async handleVerifyCitation(args) {
    const { draft_content, strict_mode, use_local_library } = args;

    try {
      // 导入 verify-citation.ts 中的函数
      const { verifyCitations } = await import('./tools/verify-citation.js');
      return await verifyCitations({ draft_content, strict_mode, use_local_library });
    } catch (error) {
      if (error.code === 'ENOENT' || error.message.includes('Cannot find module')) {
        // 如果模块不存在，返回提示信息
        return {
          content: [
            {
              type: 'text',
              text: `🔍 引用验证功能

**功能说明**：
- 验证论文草稿中的引用是否真实存在
- 支持 DOI、作者 - 年份、标题等格式的引用
- 使用 OpenAlex API 进行验证

**使用方法**：
1. 提供 draft_content 参数或使用默认的 draft-full.md
2. 设置 strict_mode=true 进行严格验证

**当前状态**：此功能需要 OpenAlex API 支持。
MCP Server 已准备好接收验证请求。`,
            },
          ],
        };
      }
      throw new McpError(
        ErrorCode.InternalError,
        `引用验证失败：${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ==================== Literature Searcher ====================

  async handleLiteratureSearcher(args) {
    const { action, query, id, doi, per_page, api } = args;

    try {
      // 导入 literature-service.js 中的函数
      const { searchOpenAlex, getWorkById, getWorkByDoi, searchArxiv, getArxivPaperById } = await import('./services/literature-service.js');

      let result;
      switch (action) {
        case 'search':
          if (!query) {
            return {
              content: [
                {
                  type: 'text',
                  text: '❌ 检索需要提供 query 参数。',
                },
              ],
            };
          }
          // 根据 api 参数选择 API，默认 OpenAlex
          if (api === 'arxiv') {
            result = await searchArxiv(query, { max_results: per_page || 5 });
          } else {
            result = await searchOpenAlex(query, { per_page: per_page || 5 });
          }
          break;
        case 'get_by_id':
          if (!id) {
            return {
              content: [
                {
                  type: 'text',
                  text: '❌ 获取论文详情需要提供 id 参数。',
                },
              ],
            };
          }
          // 根据 api 参数选择 API
          if (api === 'arxiv') {
            result = await getArxivPaperById(id);
          } else {
            result = await getWorkById(id);
          }
          break;
        case 'get_by_doi':
          if (!doi) {
            return {
              content: [
                {
                  type: 'text',
                  text: '❌ 获取论文详情需要提供 doi 参数。',
                },
              ],
            };
          }
          result = await getWorkByDoi(doi);
          break;
        default:
          return {
            content: [
              {
                type: 'text',
                text: `⚠️ 未知操作：${action}。支持的操作：search, get_by_id, get_by_doi`,
              },
            ],
          };
      }

      if (!result) {
        return {
          content: [
            {
              type: 'text',
              text: '❌ 未找到论文。',
            },
          ],
        };
      }

      // 格式化输出
      let output = '';
      if (Array.isArray(result.results)) {
        // 检索结果 - 使用字符串拼接避免嵌套模板字符串
        const worksOutput = result.results.map((work, i) => {
          let workText = '**' + (i + 1) + '. ' + (work.title || 'Unknown') + '**\n\n';
          workText += '**作者**：' + (work.authors?.join(', ') || '未知') + '\n';
          workText += '**年份**：' + (work.year || '未知') + '\n';
          workText += '**期刊**：' + (work.journal || '未知') + '\n';
          workText += '**DOI**：' + (work.doi || '未知') + '\n';
          workText += '**引用次数**：' + (work.citationCount || 0) + '\n';
          workText += '**OpenAlex ID**：' + work.id + '\n';
          if (work.abstract) {
            workText += '\n**摘要**：' + work.abstract + '\n';
          }
          workText += '\n---\n';
          return workText;
        }).join('\n');

        output = '📚 文献检索结果\n\n';
        output += '**检索词**：' + query + '\n';
        output += '**找到文献**：' + result.total + ' 篇\n';
        output += '**使用 API**：' + result.api + '\n\n';
        output += '---\n\n';
        output += worksOutput;
        output += '\n**提示**：\n';
        output += '- 使用 verify_citation 工具可以验证引用是否真实存在\n';
        output += '- 使用 get_by_id 或 get_by_doi 可以获取单篇论文的详细信息';
      } else {
        // 单篇论文详情
        output = '📄 论文详情\n\n';
        output += '**标题**：' + result.title + '\n';
        output += '**作者**：' + (result.authors?.join(', ') || '未知') + '\n';
        output += '**年份**：' + (result.year || '未知') + '\n';
        output += '**期刊**：' + (result.journal || '未知') + '\n';
        output += '**DOI**：' + (result.doi || '未知') + '\n';
        output += '**引用次数**：' + (result.citationCount || 0) + '\n';
        if (result.abstract) {
          output += '\n**摘要**：' + result.abstract + '\n';
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `文献检索失败：${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ==================== Material Reader ====================

  async handleMaterialReader(args) {
    const { action, materials } = args;

    try {
      // 动态导入 material-reader.js
      const { readMaterials, listMaterialsLog } = await import('./tools/material-reader.js');
      
      if (action === 'read') {
        return await readMaterials({ materials });
      } else if (action === 'log') {
        return await listMaterialsLog();
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `⚠️ 未知操作：${action}。支持的操作：read, log`,
            },
          ],
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ 资料读取失败：${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  // ==================== Version Control ====================

  async handleVersionControl(args) {
    const { action, message, tag, from_version, to_version, limit } = args;

    try {
      const {
        initGitRepo,
        commitChanges,
        getGitLog,
        generateChangeSummary,
        compareVersions,
        listVersionTags,
        getWorkingStatus
      } = await import('./services/version-control.js');

      let result;
      switch (action) {
        case 'init':
          result = await initGitRepo();
          return {
            content: [{ type: 'text', text: result.success ? `✅ ${result.message}` : `❌ ${result.message}` }]
          };
        case 'status':
          result = await getWorkingStatus();
          if (!result.success) {
            return { content: [{ type: 'text', text: `❌ ${result.message}` }] };
          }
          if (!result.changed) {
            return { content: [{ type: 'text', text: '✅ 工作区干净，没有未提交的更改。' }] };
          }
          return {
            content: [{ type: 'text', text: `📋 工作区状态\n\n**有未提交的更改**：\n${result.changes.map(c => `- ${c}`).join('\n')}` }]
          };
        case 'commit':
          if (!message) {
            return { content: [{ type: 'text', text: '❌ 提交需要提供 message 参数。' }] };
          }
          result = await commitChanges(message, tag || null);
          return {
            content: [{ type: 'text', text: result.success ? `✅ 提交成功\n\n**提交信息**：${message}\n${tag ? `**版本标签**：${tag}` : ''}` : `❌ ${result.message}` }]
          };
        case 'log':
          result = await getGitLog(limit || 10);
          if (!result.success) {
            return { content: [{ type: 'text', text: `❌ ${result.message}` }] };
          }
          if (result.commits.length === 0) {
            return { content: [{ type: 'text', text: '📋 暂无提交历史。' }] };
          }
          return {
            content: [{ type: 'text', text: `📋 提交历史（最近${result.commits.length}条）\n\n${result.commits.map((c, i) => `${i + 1}. **${c.hash}** - ${c.date}\n   ${c.message}`).join('\n\n')}` }]
          };
        case 'diff':
          if (!from_version) {
            return { content: [{ type: 'text', text: '❌ 需要提供 from_version 参数。' }] };
          }
          result = await compareVersions(from_version, to_version || 'HEAD');
          if (!result.success) {
            return { content: [{ type: 'text', text: `❌ ${result.message}` }] };
          }
          return {
            content: [{ type: 'text', text: `📊 版本对比：${from_version} → ${to_version || 'HEAD'}\n\n**新增行**：+${result.stats.addedLines}\n**删除行**：-${result.stats.removedLines}\n**总变更**：${result.stats.totalChanges} 行` }]
          };
        case 'tags':
          result = await listVersionTags();
          if (result.tags.length === 0) {
            return { content: [{ type: 'text', text: '📋 暂无版本标签。' }] };
          }
          return {
            content: [{ type: 'text', text: `🏷️ 版本标签\n\n${result.tags.map(t => `- ${t}`).join('\n')}` }]
          };
        case 'summary':
          if (!from_version) {
            return { content: [{ type: 'text', text: '❌ 需要提供 from_version 参数。' }] };
          }
          result = await generateChangeSummary(from_version, to_version || 'HEAD');
          if (!result.success) {
            return { content: [{ type: 'text', text: `❌ ${result.message}` }] };
          }
          return {
            content: [{ type: 'text', text: `📊 变更摘要：${from_version} → ${to_version || 'HEAD'}\n\n**新增文件**：${result.stats.added}\n**修改文件**：${result.stats.modified}\n**删除文件**：${result.stats.deleted}\n**总变更**：${result.stats.total} 个文件\n\n\`\`\`\n${result.summary}\n\`\`\`` }]
          };
        default:
          return { content: [{ type: 'text', text: `⚠️ 未知操作：${action}` }] };
      }
    } catch (error) {
      return { content: [{ type: 'text', text: `❌ 版本控制操作失败：${error.message}` }] };
    }
  }

  // ==================== Cache Manager ====================

  async handleCacheManager(args) {
    const { action } = args;

    try {
      const { getCacheStats, clearCache } = await import('./services/cache-service.js');

      let result;
      switch (action) {
        case 'stats':
          result = await getCacheStats();
          return {
            content: [{ type: 'text', text: `📊 缓存统计\n\n**总缓存项**：${result.totalEntries}\n**活跃项**：${result.activeEntries}\n**过期项**：${result.expiredEntries}\n**总大小**：${result.totalSizeKB} KB` }]
          };
        case 'clear':
          result = await clearCache();
          return {
            content: [{ type: 'text', text: result ? '✅ 缓存已清空。' : '❌ 清空缓存失败。' }]
          };
        case 'clean':
          // 清理过期缓存由 getCache 自动处理
          return {
            content: [{ type: 'text', text: '💡 过期缓存会在访问时自动清理。使用 clear 操作可以清空所有缓存。' }]
          };
        default:
          return { content: [{ type: 'text', text: `⚠️ 未知操作：${action}` }] };
      }
    } catch (error) {
      return { content: [{ type: 'text', text: `❌ 缓存管理操作失败：${error.message}` }] };
    }
  }

  // ==================== Literature Reviewer ====================

  async handleLiteratureReviewer(args) {
    const { action, pdf_paths } = args;

    if (action === 'process_pdfs') {
      if (!pdf_paths || pdf_paths.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: '❌ 处理 PDF 需要提供 pdf_paths 参数。',
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `📚 文献处理功能

**操作**：处理 ${pdf_paths.length} 个 PDF 文件
**文件列表**：
${pdf_paths.map(p => `- ${p}`).join('\n')}

**功能说明**：
- 提取文献核心论点
- 提取关键数据
- 提取主要结论
- 生成内容索引

**当前状态**：此功能需要 PDF 解析库和 LLM API。
MCP Server 已准备好接收文献处理请求。`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `📚 文献综述功能

**操作**：${action}

**功能说明**：
- 撰写文献综述
- 检查参考文献来源合法性

**当前状态**：此功能需要连接 LLM API 进行实际处理。
MCP Server 已准备好接收文献处理请求。`,
        },
      ],
    };
  }

  // ==================== List Tools ====================

  async handleListTools() {
    const toolsDescription = TOOLS.map(tool => 
      `- **${tool.name}**: ${tool.description}`
    ).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `📋 可用的论文写作工具：

${toolsDescription}

**使用方式**：
1. 首先使用 paper_coordinator 初始化项目
2. 根据推荐依次使用各个工具
3. 完成写作后使用 verify_content 和 verify_abstract 验证
4. 最后使用 paper_polisher 润色并导出`,
        },
      ],
    };
  }

  // ==================== Run Server ====================

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Scientific Research MCP Server running on stdio');
  }
}

const server = new ScientificResearchMCPServer();
server.run().catch(console.error);