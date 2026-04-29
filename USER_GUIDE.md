# 用户使用指南

**版本**：v1.1.0

欢迎使用 Scientific Research MCP Server！本指南帮助你快速上手并进行论文写作。

---

## 快速开始

### 1. 安装依赖

```bash
cd d:\Workspace\scientific-research-mcp\mcp
npm install
```

### 2. 配置 MCP 设置

编辑 `cline_mcp_settings.json`：

```json
{
  "mcpServers": {
    "scientific-research-mcp": {
      "command": "node",
      "args": ["d:\\Workspace\\scientific-research-mcp\\mcp\\src\\index.js"],
      "env": {
        "PAPER_DIR": "d:\\Workspace\\scientific-research-mcp\\paper"
      }
    }
  }
}
```

### 3. 初始化项目

```javascript
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "paper_coordinator",
  arguments: {
    action: "init",
    paper_type: "chinese-journal",
    research_topic: "沉浸式数字科普场景构建研究",
    target_journal: "未确定"
  }
});
```

---

## 文献检索使用

### 自动检索（推荐）

系统会根据关键词语言自动选择 API：

```javascript
// 中文关键词 → 自动使用 Crossref → OpenAlex
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "literature_searcher",
  arguments: {
    action: "search",
    query: "森林可视化",
    per_page: 5
  }
});

// 英文关键词 → 自动使用 OpenAlex → arXiv
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "literature_searcher",
  arguments: {
    action: "search",
    query: "forest stand structure",
    per_page: 5
  }
});
```

### 手动指定 API

```javascript
// 手动指定使用 arXiv
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "literature_searcher",
  arguments: {
    action: "search",
    query: "3D visualization",
    api: "arxiv",
    per_page: 5
  }
});
```

### 获取论文详情

```javascript
// 根据 DOI 获取
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "literature_searcher",
  arguments: {
    action: "get_by_doi",
    doi: "10.1038/nature12345"
  }
});

// 根据 OpenAlex ID 获取
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "literature_searcher",
  arguments: {
    action: "get_by_id",
    id: "W1234567890"
  }
});
```

---

## 文献综述撰写

### 基于真实文献撰写综述

```javascript
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "literature_reviewer",
  arguments: {
    action: "write_review",
    topic: "沉浸式数字科普场景构建"
  }
});
```

**工作流程**：
1. 系统自动检索真实文献
2. 格式化文献列表
3. 基于真实文献生成综述
4. 输出到 `paper/literature-review.md`

**重要提示**：
- 只引用检索到的真实文献
- 每篇引用标注 OpenAlex ID 或 DOI
- 如果文献不足，系统会提示补充方向

---

## 引用验证

### 验证论文草稿中的引用

```javascript
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "verify_citation",
  arguments: {
    draft_content: "根据 Smith 等人的研究 [10.1038/nature12345]，沉浸式技术...",
    strict_mode: false
  }
});
```

**验证结果**：
- `verified: true` - 引用真实存在
- `verified: false` - 引用无法验证，标记为可疑

**严格模式**：
- `strict_mode: false` - 只标记明确不存在的引用
- `strict_mode: true` - 无法验证的引用也标记为可疑

---

## 论文写作流程

### 1. 撰写论文章节

```javascript
// 撰写引言
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "paper_writer",
  arguments: {
    chapter: "intro",
    content_materials: "用户提供的素材内容"
  }
});

// 撰写方法
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "paper_writer",
  arguments: {
    chapter: "methods"
  }
});

// 撰写结果
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "paper_writer",
  arguments: {
    chapter: "results"
  }
});

// 撰写讨论
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "paper_writer",
  arguments: {
    chapter: "discussion"
  }
});

// 撰写结论
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "paper_writer",
  arguments: {
    chapter: "conclusion"
  }
});
```

### 2. 验证内容

```javascript
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "verify_content",
  arguments: {
    mode: "full"
  }
});
```

### 3. 生成摘要

```javascript
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "abstract_writer",
  arguments: {
    action: "generate"
  }
});
```

### 4. 合并全文

```javascript
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "paper_coordinator",
  arguments: {
    action: "merge"
  }
});
```

### 5. 定稿检查

```javascript
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "paper_coordinator",
  arguments: {
    action: "check-gate"
  }
});
```

---

## 完整工作流示例

```javascript
// 1. 初始化项目
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "paper_coordinator",
  arguments: {
    action: "init",
    paper_type: "chinese-journal",
    research_topic: "沉浸式数字科普场景构建研究"
  }
});

// 2. 检索文献
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "literature_searcher",
  arguments: {
    action: "search",
    query: "沉浸式 数字科普 场景构建",
    per_page: 10
  }
});

// 3. 撰写文献综述
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "literature_reviewer",
  arguments: {
    action: "write_review",
    topic: "沉浸式数字科普场景构建"
  }
});

// 4. 撰写论文章节
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "paper_writer",
  arguments: {
    chapter: "intro"
  }
});

// 5. 验证内容
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "verify_content",
  arguments: {
    mode: "full"
  }
});

// 6. 生成摘要
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "abstract_writer",
  arguments: {
    action: "generate"
  }
});

// 7. 合并全文
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "paper_coordinator",
  arguments: {
    action: "merge"
  }
});

// 8. 定稿检查
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "paper_coordinator",
  arguments: {
    action: "check-gate"
  }
});
```

---

## 常见问题

### Q: 如何查看写作进度？
A: 使用 `paper_coordinator` 的 `progress` 操作：
```javascript
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "paper_coordinator",
  arguments: {
    action: "progress"
  }
});
```

### Q: 如何获取下一步操作建议？
A: 使用 `paper_coordinator` 的 `recommend` 操作：
```javascript
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "paper_coordinator",
  arguments: {
    action: "recommend"
  }
});
```

### Q: 如何列出所有可用工具？
A: 使用 `list_tools` 工具：
```javascript
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "list_tools",
  arguments: {}
});
```

### Q: 文献检索结果为空怎么办？
A: 系统会自动尝试以下操作：
1. 扩展关键词（移除修饰词、拆分长关键词）
2. 尝试降级 API
3. 如果仍为空，提示用户手动提供参考文献

### Q: 引用验证失败怎么办？
A: 如果 `verify_citation` 返回 `verified: false`：
1. 检查 DOI 或标题是否正确
2. 尝试手动检索文献
3. 如果文献确实不存在，删除该引用

---

## 文件说明

| 文件 | 说明 |
|------|------|
| `paper/metadata.json` | 项目元数据 |
| `paper/progress.md` | 写作进度 |
| `paper/outline.md` | 论文大纲 |
| `paper/search-keywords.md` | 文献检索关键词清单 |
| `paper/literature-review.md` | 文献综述 |
| `paper/draft-intro.md` | 引言草稿 |
| `paper/draft-methods.md` | 方法草稿 |
| `paper/draft-results.md` | 结果草稿 |
| `paper/draft-discussion.md` | 讨论草稿 |
| `paper/draft-conclusion.md` | 结论草稿 |
| `paper/draft-full.md` | 完整论文草稿 |
| `paper/abstract.md` | 摘要 |

---

## LLM 配置

### 当前 LLM 配置

| 配置项 | 说明 |
|--------|------|
| API 提供商 | 阿里云 DashScope |
| 默认模型 | qwen3.5-plus |
| API 端点 | `https://coding.dashscope.aliyuncs.com/v1/chat/completions` |
| 环境变量 | `ALIBABA_CLOUD_API_KEY` |

### 如何修改成你自己的大模型连接

详见 [LLM_CONNECTION.md](LLM_CONNECTION.md)

### 常见模型配置示例

#### OpenAI GPT-4

```javascript
// 修改 mcp/src/services/llm-service.js
const DASHSCOPE_API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o';
// 环境变量改为 OPENAI_API_KEY
```

```json
// 修改 cline_mcp_settings.json
{
  "env": {
    "OPENAI_API_KEY": "sk-your-api-key-here"
  }
}
```

#### Anthropic Claude

```javascript
// 修改 mcp/src/services/llm-service.js
const DASHSCOPE_API_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';
// 环境变量改为 ANTHROPIC_API_KEY
```

```json
// 修改 cline_mcp_settings.json
{
  "env": {
    "ANTHROPIC_API_KEY": "sk-ant-your-api-key-here"
  }
}
```

#### Google Gemini

```javascript
// 修改 mcp/src/services/llm-service.js
const DASHSCOPE_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const DEFAULT_MODEL = 'gemini-2.0-flash';
// 环境变量改为 GOOGLE_API_KEY
```

```json
// 修改 cline_mcp_settings.json
{
  "env": {
    "GOOGLE_API_KEY": "AIzaSy-your-api-key-here"
  }
}
```

#### 本地 Ollama

```javascript
// 修改 mcp/src/services/llm-service.js
const DASHSCOPE_API_ENDPOINT = 'http://localhost:11434/api/chat';
const DEFAULT_MODEL = 'llama3';
// 无需 API Key
```

```json
// 修改 cline_mcp_settings.json
{
  "env": {}
}
```

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.2.0 | 2026-04-24 | 添加 LLM 连接配置指南 |
| v1.1.0 | 2026-04-23 | 添加 Crossref 和 arXiv API、literature_searcher 和 verify_citation 工具 |
| v1.0.0 | 2026-04-20 | 初始版本 |
