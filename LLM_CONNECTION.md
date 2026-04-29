# LLM 连接配置指南

> 本指南帮助其他使用者配置自己的大模型连接。

**版本**：v1.2.0

---

## 当前配置

| 配置项 | 说明 |
|--------|------|
| API 提供商 | 阿里云 DashScope |
| 默认模型 | qwen3.5-plus |
| API 端点 | `https://coding.dashscope.aliyuncs.com/v1/chat/completions` |
| 环境变量 | `ALIBABA_CLOUD_API_KEY` |
| 温度（temperature） | 0.7 |
| 最大 Token（max_tokens） | 4000 |

---

## 如何修改成你自己的大模型连接

### 步骤 1：修改 API 端点和模型

编辑 `mcp/src/services/llm-service.js` 文件，修改第 6-7 行：

```javascript
// 修改前
const DASHSCOPE_API_ENDPOINT = 'https://coding.dashscope.aliyuncs.com/v1/chat/completions';
const DEFAULT_MODEL = 'qwen3.5-plus';

// 修改后（示例：OpenAI）
const DASHSCOPE_API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o';
```

### 步骤 2：修改环境变量名称

编辑 `mcp/src/services/llm-service.js` 文件，修改第 41 行：

```javascript
// 修改前
const apiKey = process.env.ALIBABA_CLOUD_API_KEY;

// 修改后（示例：OpenAI）
const apiKey = process.env.OPENAI_API_KEY;
```

### 步骤 3：更新 cline_mcp_settings.json

编辑 MCP 配置文件，添加你的 API Key：

```json
{
  "mcpServers": {
    "scientific-research-mcp": {
      "command": "node",
      "args": ["d:\\Workspace\\scientific-research-mcp\\mcp\\src\\index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-your-actual-api-key-here"
      }
    }
  }
}
```

### 步骤 4：重启 MCP Server

在 VSCode 中重新加载窗口（`Ctrl + Shift + P` → `Developer: Reload Window`）。

---

## 常见模型配置示例

### OpenAI GPT-4

```javascript
// mcp/src/services/llm-service.js
const DASHSCOPE_API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o';
// 环境变量：OPENAI_API_KEY
```

```json
// cline_mcp_settings.json
{
  "env": {
    "OPENAI_API_KEY": "sk-your-api-key-here"
  }
}
```

### Anthropic Claude

```javascript
// mcp/src/services/llm-service.js
const DASHSCOPE_API_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';
// 环境变量：ANTHROPIC_API_KEY
```

```json
// cline_mcp_settings.json
{
  "env": {
    "ANTHROPIC_API_KEY": "sk-ant-your-api-key-here"
  }
}
```

### Google Gemini

```javascript
// mcp/src/services/llm-service.js
const DASHSCOPE_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const DEFAULT_MODEL = 'gemini-2.0-flash';
// 环境变量：GOOGLE_API_KEY
```

```json
// cline_mcp_settings.json
{
  "env": {
    "GOOGLE_API_KEY": "AIzaSy-your-api-key-here"
  }
}
```

### 本地 Ollama

```javascript
// mcp/src/services/llm-service.js
const DASHSCOPE_API_ENDPOINT = 'http://localhost:11434/api/chat';
const DEFAULT_MODEL = 'llama3';
// 无需 API Key
```

```json
// cline_mcp_settings.json
{
  "env": {}
}
```

---

## 注意事项

### 1. API 请求格式差异

不同 API 提供商的请求格式可能不同。当前实现使用 OpenAI 兼容格式：

```javascript
// 当前请求格式（OpenAI 兼容）
{
  "model": "gpt-4o",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "temperature": 0.7,
  "max_tokens": 4000
}
```

如果你的目标 API 使用不同格式，需要修改 `generateContent()` 函数中的请求体。

### 2. 响应格式差异

不同 API 提供商的响应格式可能不同。当前实现解析 OpenAI 兼容格式：

```javascript
// 当前响应解析（OpenAI 兼容）
const data = await response.json();
return {
  content: data.choices[0].message.content,
  model: data.model,
  usage: data.usage
};
```

如果你的目标 API 使用不同响应格式，需要修改解析逻辑。

### 3. 建议先测试 API 连通性

在集成到 MCP Server 之前，建议先用 `curl` 或 Postman 测试 API 连通性：

```bash
# OpenAI 示例
curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-api-key-here" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

---

## 模型参数调优

| 参数 | 默认值 | 说明 | 建议范围 |
|------|--------|------|---------|
| `temperature` | 0.7 | 创造性程度，越高越随机 | 0.0 - 1.0 |
| `max_tokens` | 4000 | 单次生成上限 | 1000 - 8000 |

**调优建议**：
- 学术论文写作：`temperature: 0.5-0.7`（保持客观准确）
- 创意写作：`temperature: 0.8-1.0`（增加创造性）
- 代码生成：`temperature: 0.2-0.4`（保持精确性）

---

## 常见问题

### Q: 如何确认 API Key 配置正确？
A: 启动 MCP Server 后，使用 `list_tools` 工具测试。如果配置错误，会在日志中看到 API 认证失败的提示。

### Q: 多个 MCP Server 共用同一个 API Key 怎么办？
A: 可以在系统环境变量中设置 API Key，而不是在 `cline_mcp_settings.json` 中设置。

### Q: 如何切换模型而不修改代码？
A: 可以在 `generateContent()` 调用时通过 `options.model` 参数指定模型，但这需要修改调用该函数的代码。

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.2.0 | 2026-04-24 | 添加 LLM 连接配置指南 |