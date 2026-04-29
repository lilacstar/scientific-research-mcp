# CHANGELOG

## v1.2.0（2026-04-24）

### 新增功能

#### 1. LLM 连接配置指南
- 新建 `LLM_CONNECTION.md` 文档
- 面向其他使用者的 LLM 连接配置指南
- 包含 OpenAI GPT-4、Anthropic Claude、Google Gemini、本地 Ollama 等配置示例
- 详细说明如何修改 API 端点、模型和环境变量

#### 2. 文档更新
- 更新 `README.md`，添加 LLM 配置说明
- 更新 `USER_GUIDE.md`，添加 LLM 配置示例
- 更新 `CHANGELOG.md`，添加 v1.2.0 版本记录

### 文件变更

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `LLM_CONNECTION.md` | 新增 | LLM 连接配置指南 |
| `README.md` | 更新 | 添加 LLM 配置说明 |
| `USER_GUIDE.md` | 更新 | 添加 LLM 配置示例 |
| `CHANGELOG.md` | 更新 | 添加 v1.2.0 版本记录 |

---

## v1.1.0（2026-04-23）

### 新增功能

#### 1. Crossref API 集成
- 新增 `searchCrossref()` 函数，支持中文关键词检索
- 新增 `getCrossrefWorkByDoi()` 函数，根据 DOI 获取论文详情
- 覆盖 1.3 亿篇论文，支持中英文文献
- 免费、无需 API Key

#### 2. arXiv API 集成
- 新增 `searchArxiv()` 函数，支持英文关键词检索
- 新增 `getArxivPaperById()` 函数，根据 arXiv ID 获取论文详情
- 新增 `parseArxivXML()` 函数，解析 arXiv API 返回的 XML 数据
- 覆盖计算机、物理、数学等领域论文
- 免费、无需 API Key

#### 3. Literature Searcher 工具
- 新增 `literature_searcher` MCP 工具
- 支持 `search`（检索）、`get_by_id`（按 ID 获取）、`get_by_doi`（按 DOI 获取）操作
- 支持手动指定 API（`api` 参数）
- 自动根据关键词语言选择 API

#### 4. Verify Citation 工具
- 新增 `verify_citation` MCP 工具
- 验证论文草稿中的引用是否真实存在
- 支持 DOI、作者-年份、标题等格式的引用
- 使用 OpenAlex API 进行验证
- 支持严格模式（`strict_mode` 参数）

### API 策略更新

#### API 选择策略
- **中文关键词**：Crossref → OpenAlex（降级）
- **英文关键词**：OpenAlex → arXiv（降级）

#### 降级处理逻辑
1. 主 API 检索失败或返回零结果时，自动尝试降级 API
2. 扩展关键词重试（移除修饰词、拆分长关键词）
3. 所有 API 都未找到时，返回空结果并提示用户

### 文件变更

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `mcp/src/services/literature-service.js` | 修改 | 添加 Crossref 和 arXiv API 支持 |
| `mcp/src/index.js` | 修改 | 注册 `literature_searcher` 和 `verify_citation` 工具 |
| `mcp/src/tools/verify-citation.ts` | 新增 | 引用验证工具实现 |
| `README.md` | 更新 | 添加新工具使用说明 |
| `CHANGELOG.md` | 新增 | 版本变更日志 |
| `API_GUIDE.md` | 新增 | API 使用指南 |
| `USER_GUIDE.md` | 新增 | 用户使用指南 |

---

## v1.0.0（2026-04-20）

### 初始版本

#### 核心功能
- Paper Coordinator（论文协调器）
- Paper Writer（论文写作引擎）
- Abstract Writer（摘要生成器）
- Paper Polisher（论文润色专家）
- Verify Content（内容验证专家）
- Verify Abstract（摘要验证专家）
- Literature Reviewer（文献综述专家）
- List Tools（工具列表）

#### API 支持
- OpenAlex API 集成（英文文献检索）

#### 文件结构
- `mcp/src/index.js` - 主入口文件
- `mcp/src/services/literature-service.js` - 文献检索服务
- `mcp/src/services/llm-service.js` - LLM 服务
- `mcp/src/services/file-service.js` - 文件服务
- `mcp/src/tools/literature-reviewer.js` - 文献综述撰写
- `shared/` - 共享核心文件
- `workbuddy-skills/` - Workbuddy Skills 实现

---

## 版本规划

### v2.0.0（计划中）
- CNKI API 集成
- 万方数据 API 集成
- PDF 解析功能
- 文献自动下载
- 智能推荐参考文献