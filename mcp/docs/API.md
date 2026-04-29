# Scientific Research MCP Server - API 文档

## 概述

Scientific Research MCP Server 是一个基于 Model Context Protocol (MCP) 的科学论文写作助手。它提供了一系列工具，帮助研究人员完成从项目初始化到论文导出的全流程工作。

## 快速开始

### 安装

```bash
cd mcp
npm install
npm run build
```

### 配置

在 Claude Desktop 或支持 MCP 的客户端中添加配置：

```json
{
  "mcpServers": {
    "scientific-research-mcp": {
      "command": "node",
      "args": ["path/to/mcp/src/index.js"],
      "env": {
        "ALIBABA_CLOUD_API_KEY": "your-api-key",
        "PAPER_DIR": "./paper"
      }
    }
  }
}
```

### 环境变量

| 变量名 | 描述 | 默认值 |
|:---|:---|:---|
| `ALIBABA_CLOUD_API_KEY` | 阿里云 DashScope API 密钥（必填） | - |
| `PAPER_DIR` | 论文工作区目录 | `./paper` |

---

## 工具列表

### 1. paper_coordinator

**描述**：论文写作总协调器，用于初始化项目、管理进度、推荐下一步操作、合并全文。

**输入参数**：

| 参数 | 类型 | 必填 | 描述 |
|:---|:---|:---:|:---|
| `action` | string | ✅ | 操作类型：`init` / `progress` / `recommend` / `merge` / `export` / `check-gate` |
| `paper_type` | string | ❌ | 论文类型：`chinese-thesis` / `english-journal` / `chinese-journal` |
| `research_topic` | string | ❌ | 研究方向/主题 |
| `target_journal` | string | ❌ | 投稿期刊名称 |
| `has_materials` | boolean | ❌ | 是否已有素材 |
| `material_paths` | string[] | ❌ | 已有素材的文件路径列表 |
| `wechat_webhook` | string | ❌ | 企业微信 Webhook URL |

**示例**：

```javascript
// 初始化项目
{
  "action": "init",
  "paper_type": "chinese-journal",
  "research_topic": "沉浸式数字科普场景构建研究"
}

// 查看进度
{
  "action": "progress"
}

// 获取推荐
{
  "action": "recommend"
}

// 合并全文
{
  "action": "merge"
}
```

**输出示例**：

```
✅ 项目初始化完成！

**论文类型**：中文期刊
**研究方向**：沉浸式数字科普场景构建研究
**工作区**：./paper
```

---

### 2. paper_writer

**描述**：论文写作引擎，用于撰写论文的各个章节。

**输入参数**：

| 参数 | 类型 | 必填 | 描述 |
|:---|:---|:---:|:---|
| `chapter` | string | ✅ | 章节：`intro` / `methods` / `results` / `discussion` / `conclusion` |
| `content_materials` | string | ❌ | 用户提供的材料 |
| `rewrite` | boolean | ❌ | 是否重写已存在的章节 |

**示例**：

```javascript
{
  "chapter": "intro",
  "content_materials": "已有实验数据：样本量1200，涵盖5个城市...",
  "rewrite": false
}
```

---

### 3. abstract_writer

**描述**：摘要与标题生成器，基于完整论文内容生成摘要和标题。

**输入参数**：

| 参数 | 类型 | 必填 | 描述 |
|:---|:---|:---:|:---|
| `action` | string | ✅ | 操作：`generate` / `rewrite` |

**示例**：

```javascript
{
  "action": "generate"
}
```

---

### 4. paper_polisher

**描述**：论文润色专家，用于语言润色、翻译语气纠正、格式检查。

**输入参数**：

| 参数 | 类型 | 必填 | 描述 |
|:---|:---|:---:|:---|
| `scope` | string | ✅ | 润色范围：`full` / `intro` / `methods` / `results` / `discussion` / `conclusion` / `abstract` |
| `focus` | string | ❌ | 润色重点：`language` / `format` / `citation` / `all` |

**示例**：

```javascript
{
  "scope": "full",
  "focus": "all"
}
```

**输出示例**：

```
✅ 论文润色完成！

**润色范围**：full
**润色重点**：all
**处理块数**：8 块
**成功**：8 块
**失败**：0 块
**输出文件**：draft-full-polished.md
```

---

### 5. verify_content

**描述**：论文内容准确性与逻辑链验证专家。

**输入参数**：

| 参数 | 类型 | 必填 | 描述 |
|:---|:---|:---:|:---|
| `mode` | string | ✅ | 验证模式：`full` / `incremental` / `targeted` / `skip` |
| `target_chapters` | string[] | ❌ | 定向验证的目标章节列表 |

**示例**：

```javascript
{
  "mode": "full"
}
```

---

### 6. verify_abstract

**描述**：摘要验证专家，检查摘要与正文的一致性、准确性、完整性。

**输入参数**：

| 参数 | 类型 | 必填 | 描述 |
|:---|:---|:---:|:---|
| `action` | string | ✅ | 操作：`verify` / `reverify` |

**示例**：

```javascript
{
  "action": "verify"
}
```

---

### 7. literature_reviewer

**描述**：文献综述撰写专家，处理文献 PDF、提取关键信息、撰写文献综述。

**输入参数**：

| 参数 | 类型 | 必填 | 描述 |
|:---|:---|:---:|:---|
| `action` | string | ✅ | 操作：`process_pdfs` / `write_review` / `check_references` |
| `pdf_paths` | string[] | ❌ | PDF 文件路径列表 |

**示例**：

```javascript
{
  "action": "process_pdfs",
  "pdf_paths": ["/path/to/paper1.pdf", "/path/to/paper2.pdf"]
}
```

---

### 8. verify_citation

**描述**：引用验证工具，验证论文草稿中的引用是否真实存在。

**输入参数**：

| 参数 | 类型 | 必填 | 描述 |
|:---|:---|:---:|:---|
| `draft_content` | string | ❌ | 待验证的论文草稿内容 |
| `strict_mode` | boolean | ❌ | 严格模式 |

**示例**：

```javascript
{
  "strict_mode": true
}
```

---

### 9. literature_searcher

**描述**：文献检索工具，使用 OpenAlex API 检索英文文献。

**输入参数**：

| 参数 | 类型 | 必填 | 描述 |
|:---|:---|:---:|:---|
| `action` | string | ✅ | 操作：`search` / `get_by_id` / `get_by_doi` |
| `query` | string | ❌ | 检索关键词 |
| `id` | string | ❌ | OpenAlex ID |
| `doi` | string | ❌ | DOI |
| `per_page` | number | ❌ | 每页结果数 |

**示例**：

```javascript
{
  "action": "search",
  "query": "immersive science popularization",
  "per_page": 5
}
```

---

### 10. list_tools

**描述**：列出所有可用的论文写作工具及其功能说明。

**输入参数**：无

**示例**：

```javascript
{}
```

---

## 文件结构

```
paper/
├── metadata.json          # 项目元数据
├── progress.md            # 进度文件
├── outline.md             # 论文大纲
├── draft-intro.md         # 章节草稿
├── draft-methods.md
├── draft-results.md
├── draft-discussion.md
├── draft-conclusion.md
├── draft-full.md          # 合并后的全文
├── draft-full-polished.md # 润色后的全文
└── references/            # 参考文献
```

---

## 错误处理

所有工具在失败时会返回错误信息，格式如下：

```
❌ 错误描述

**建议**：解决方案提示
```

---

## 版本历史

| 版本 | 日期 | 更新内容 |
|:---|:---|:---|
| 1.0.0 | 2026-04-24 | 初始版本 |
| 1.1.0 | 2026-04-26 | 修复长文本截断问题、添加自动备份机制 |

---

*最后更新：2026-04-26*