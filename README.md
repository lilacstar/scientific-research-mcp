# Scientific Research MCP Server

> 🎓 基于 AI 的科学论文写作 MCP 服务器，支持文献检索、论文撰写、内容验证、润色导出等全流程功能。

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0-brightgreen.svg)]()

---

科学论文写作 MCP 服务器，基于方案 A：共享核心 + 双端适配。

**当前版本**：v1.1.0

## 项目结构

```
scientific-research-mcp/
├── mcp/                    # MCP Server 实现
│   ├── src/
│   │   ├── index.js        # 主入口文件
│   │   ├── services/       # 服务模块
│   │   │   ├── literature-service.js  # 文献检索服务
│   │   │   ├── llm-service.js         # LLM 服务
│   │   │   └── file-service.js        # 文件服务
│   │   │   ├── cache-service.js       # 缓存服务
│   │   │   ├── version-control.js     # Git版本控制
│   │   │   ├── notification-service.js# 通知服务
│   │   │   └── pdf-service.js         # PDF解析服务
│   │   └── tools/          # 工具模块
│   │       ├── literature-reviewer.js # 文献综述撰写
│   │       └── verify-citation.ts     # 引用验证
│   ├── package.json
│   └── tsconfig.json
├── shared/                 # 共享核心文件
│   ├── prompts/            # 提示词模板
│   ├── protocols/          # 协议定义
│   └── references/         # 参考资料
├── workbuddy-skills/       # Workbuddy Skills 实现
│   ├── paper-coordinator/  # 论文协调器 Skill
│   │   ├── skill.json      # Skill 定义
│   │   └── index.js        # Skill 实现
│   ├── paper-writer/       # 论文写作引擎 Skill
│   │   ├── skill.json
│   │   └── index.js
│   └── README.md           # Skills 使用说明
└── paper/                  # 论文工作区（运行时创建）
```

## 功能特性

### 1. Paper Coordinator（论文协调器）
- 项目初始化：收集论文信息，创建共享工作区
- 进度管理：追踪写作进度，推荐下一步操作
- 全文合并：将各章节草稿合并为完整论文
- 定稿门控：检查验证覆盖率，确保论文质量
- 文献检索关键词生成：基于研究方向生成中英文关键词清单

### 2. Paper Writer（论文写作引擎）
- 撰写论文章节：引言、方法、结果、讨论、结论
- 支持用户提供素材进行辅助写作
- 支持章节重写功能

### 3. Abstract Writer（摘要生成器）
- 基于完整论文生成摘要和标题
- 支持摘要重写功能

### 4. Paper Polisher（论文润色专家）
- 语言润色：纠正语法错误、改进表达
- 格式检查：确保符合期刊格式要求
- 引用检查：验证引用格式一致性

### 5. Verify Content（内容验证专家）
- 论证逻辑链检查
- 内部一致性检查
- 事实性陈述检查
- 参考文献来源合法性检查

### 6. Verify Abstract（摘要验证专家）
- 摘要与正文一致性检查
- 摘要准确性检查
- 关键词覆盖度检查

### 7. Literature Reviewer（文献综述专家）
- 处理文献 PDF，提取关键信息
- 基于真实文献撰写综述（消除 LLM 幻觉）
- 检查参考文献来源合法性

### 8. Literature Searcher（文献检索工具）⭐ v1.1.0 新增
- 使用 OpenAlex、arXiv、Crossref API 检索文献
- 支持关键词检索、DOI 查询、论文详情获取
- 自动根据关键词语言选择 API

### 9. Verify Citation（引用验证工具）⭐ v1.1.0 新增
- 验证论文草稿中的引用是否真实存在
- 支持 DOI、作者-年份、标题等格式的引用
- 使用 OpenAlex API 进行验证

### 10. List Tools（工具列表）
- 列出所有可用的论文写作工具及其功能说明

## 安装配置

### 1. 安装依赖

```bash
cd mcp
npm install
```

### 2. 配置 cline_mcp_settings.json

**配置文件位置**：`C:\Users\Think\AppData\Roaming\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`

**正确的配置格式**（只包含 `command`、`args`、`env` 属性）：

```json
{
  "mcpServers": {
    "scientific-research-mcp": {
      "command": "node",
      "args": [
        "d:\\Workspace\\scientific-research-mcp\\mcp\\src\\index.js"
      ],
      "env": {
        "PAPER_DIR": "d:\\Workspace\\scientific-research-mcp\\paper"
      }
    }
  }
}
```

> **注意**：Cline 扩展的 MCP 配置**不支持** `autoApprove`、`disabled`、`timeout`、`type` 等属性，添加这些属性会导致 "Invalid MCP settings schema" 错误。

### 3. 使用方式

在 Cline 中使用 MCP 工具：

```javascript
// 初始化项目
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

// 查看进度
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "paper_coordinator",
  arguments: {
    action: "progress"
  }
});

// 推荐下一步操作
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "paper_coordinator",
  arguments: {
    action: "recommend"
  }
});

// 撰写论文章节
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "paper_writer",
  arguments: {
    chapter: "intro",
    content_materials: "用户提供的素材内容"
  }
});

// 生成摘要
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "abstract_writer",
  arguments: {
    action: "generate"
  }
});

// 验证内容
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "verify_content",
  arguments: {
    mode: "full"
  }
});

// 合并全文
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "paper_coordinator",
  arguments: {
    action: "merge"
  }
});

// 列出所有可用工具
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "list_tools",
  arguments: {}
});
```

## 工作流程

1. **初始化**：使用 `paper_coordinator` 的 `init` 操作初始化项目
2. **文献调研**：使用生成的关键词清单检索文献，然后使用 `literature_reviewer` 处理
3. **论文写作**：使用 `paper_writer` 依次撰写各章节
4. **内容验证**：使用 `verify_content` 验证每章内容
5. **摘要生成**：使用 `abstract_writer` 生成摘要
6. **摘要验证**：使用 `verify_abstract` 验证摘要
7. **论文润色**：使用 `paper_polisher` 进行润色
8. **全文合并**：使用 `paper_coordinator` 的 `merge` 操作合并全文
9. **定稿检查**：使用 `paper_coordinator` 的 `check-gate` 操作进行门控检查
10. **导出**：使用 `paper_coordinator` 的 `export` 操作导出论文

## 文献检索 API 策略（v1.1.0 新增）

### API 选择策略

| 关键词语言 | 使用 API | 降级策略 |
|-----------|---------|---------|
| **中文** | Crossref → OpenAlex | Crossref 未找到 → OpenAlex → 返回空结果 |
| **英文** | OpenAlex → arXiv | OpenAlex 未找到 → arXiv → 返回空结果 |

### 支持的 API

| API | 中文支持 | 英文支持 | 需要 Key | 覆盖范围 |
|-----|---------|---------|---------|---------|
| **Crossref** | ✅ 完整 | ✅ 完整 | ❌ 免费 | 1.3 亿篇论文 |
| **OpenAlex** | ⚠️ 有限 | ✅ 完整 | ❌ 免费 | 2.4 亿篇论文 |
| **arXiv** | ❌ 无 | ✅ 完整 | ❌ 免费 | 计算机/物理/数学 |
| **CNKI** | ✅ 完整 | ⚠️ 有限 | ✅ 需要 | 中文文献（待实现） |
| **万方数据** | ✅ 完整 | ⚠️ 有限 | ✅ 需要 | 中文文献（待实现） |

### 使用示例

#### 中文论文检索
```javascript
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "literature_searcher",
  arguments: {
    action: "search",
    query: "森林可视化",
    per_page: 5
  }
});
// 自动使用 Crossref → OpenAlex 降级策略
```

#### 英文论文检索
```javascript
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "literature_searcher",
  arguments: {
    action: "search",
    query: "forest stand structure",
    per_page: 5
  }
});
// 自动使用 OpenAlex → arXiv 降级策略
```

#### 手动指定 API
```javascript
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "literature_searcher",
  arguments: {
    action: "search",
    query: "3D visualization",
    api: "arxiv",  // 手动指定使用 arXiv
    per_page: 5
  }
});
```

#### 引用验证
```javascript
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "verify_citation",
  arguments: {
    draft_content: "根据 Smith 等人的研究 [10.1038/nature12345]...",
    strict_mode: false
  }
});
```

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PAPER_DIR` | 论文工作区路径 | `./paper` |
| `ALIBABA_CLOUD_API_KEY` | 阿里云 DashScope API 密钥 | - |
| `CNKI_API_KEY` | CNKI API 密钥（待实现） | - |
| `WANFANG_API_KEY` | 万方数据 API 密钥（待实现） | - |

## LLM 配置

### 当前 LLM 配置

| 配置项 | 说明 |
|--------|------|
| API 提供商 | 阿里云 DashScope |
| 默认模型 | qwen3.5-plus |
| API 端点 | `https://coding.dashscope.aliyuncs.com/v1/chat/completions` |

### 如何修改成你自己的大模型连接

详见 [LLM_CONNECTION.md](LLM_CONNECTION.md)

**快速修改步骤**：

1. 编辑 `mcp/src/services/llm-service.js`，修改 API 端点和模型：
   ```javascript
   const DASHSCOPE_API_ENDPOINT = 'https://your-api-endpoint.com/v1/chat/completions';
   const DEFAULT_MODEL = 'your-model-name';
   ```

2. 修改环境变量名称：
   ```javascript
   const apiKey = process.env.YOUR_API_KEY_NAME;
   ```

3. 更新 `cline_mcp_settings.json`：
   ```json
   {
     "env": {
       "YOUR_API_KEY_NAME": "your-actual-api-key-here"
     }
   }
   ```

4. 重启 MCP Server

## 故障排除

### Invalid MCP settings schema 错误

**问题原因**：配置文件中包含了不支持的属性（如 `autoApprove`、`disabled`、`timeout`、`type`）。

**解决方法**：
1. 打开 `cline_mcp_settings.json`
2. 删除 `autoApprove`、`disabled`、`timeout`、`type` 等属性
3. 只保留 `command`、`args`、`env` 属性
4. 重新加载 VSCode 窗口

### 服务器未注册

**问题原因**：VSCode 未重新加载或配置文件格式错误。

**解决方法**：
1. 按 `Ctrl + Shift + P`
2. 输入 `Developer: Reload Window`
3. 重新加载后，使用 `MCP: List Servers` 查看服务器是否已注册

### 连接失败

**问题原因**：服务器启动失败或路径配置错误。

**解决方法**：
1. 手动启动服务器测试：`node "d:\Workspace\scientific-research-mcp\mcp\src\index.js"`
2. 检查是否显示 "Scientific Research MCP Server running on stdio"
3. 检查 `command` 和 `args` 路径是否正确

## 许可证

MIT

## 版本历史

详见 [CHANGELOG.md](CHANGELOG.md)