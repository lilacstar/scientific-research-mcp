# API 使用指南

**版本**：v1.1.0

本文档详细说明 Scientific Research MCP Server 支持的文献检索 API 及其使用策略。

---

## 支持的 API 列表

| API | 中文支持 | 英文支持 | 需要 Key | 覆盖范围 | 速率限制 |
|-----|---------|---------|---------|---------|---------|
| **Crossref** | ✅ 完整 | ✅ 完整 | ❌ 免费 | 1.3 亿篇论文 | 10 次/秒 |
| **OpenAlex** | ⚠️ 有限 | ✅ 完整 | ❌ 免费 | 2.4 亿篇论文 | 10 次/秒 |
| **arXiv** | ❌ 无 | ✅ 完整 | ❌ 免费 | 计算机/物理/数学 | 3 秒/次 |
| **CNKI** | ✅ 完整 | ⚠️ 有限 | ✅ 需要 | 中文文献 | 待实现 |
| **万方数据** | ✅ 完整 | ⚠️ 有限 | ✅ 需要 | 中文文献 | 待实现 |

---

## API 选择策略

### 自动选择逻辑

系统根据关键词语言自动选择 API：

```javascript
// 中文关键词 → Crossref → OpenAlex（降级）
// 英文关键词 → OpenAlex → arXiv（降级）
```

### 选择流程图

```
用户输入关键词
       ↓
检测是否包含中文？
       ↓
  ┌────┴────┐
 是         否
  ↓         ↓
Crossref   OpenAlex
  ↓         ↓
未找到？    未找到？
  ↓         ↓
OpenAlex   arXiv
  ↓         ↓
未找到？    未找到？
  ↓         ↓
返回空结果  返回空结果
```

---

## 各 API 详细说明

### 1. Crossref API

**特点**：
- 覆盖 1.3 亿篇论文
- 支持中英文关键词检索
- 免费、无需 API Key
- 适合中文论文查验

**速率限制**：
- 10 次/秒
- 需要设置 User-Agent 请求头

**返回字段**：
- `title`：论文标题
- `author`：作者列表
- `DOI`：数字对象标识符
- `published`：出版日期
- `abstract`：摘要（部分论文）

**使用示例**：
```javascript
// 自动使用 Crossref（中文关键词）
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "literature_searcher",
  arguments: {
    action: "search",
    query: "森林可视化",
    per_page: 5
  }
});
```

---

### 2. OpenAlex API

**特点**：
- 覆盖 2.4 亿篇论文
- 英文文献检索主力
- 免费、无需 API Key
- 提供引用次数、开放获取信息

**速率限制**：
- 10 次/秒

**返回字段**：
- `id`：OpenAlex ID（如 W1234567890）
- `title`：论文标题
- `authors`：作者列表
- `year`：出版年份
- `journal`：期刊名称
- `doi`：DOI
- `citationCount`：引用次数
- `abstract`：摘要
- `isOa`：是否开放获取
- `oaUrl`：开放获取 URL
- `topics`：主题标签

**使用示例**：
```javascript
// 自动使用 OpenAlex（英文关键词）
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "literature_searcher",
  arguments: {
    action: "search",
    query: "forest stand structure",
    per_page: 5
  }
});

// 根据 DOI 获取论文详情
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "literature_searcher",
  arguments: {
    action: "get_by_doi",
    doi: "10.1038/nature12345"
  }
});
```

---

### 3. arXiv API

**特点**：
- 覆盖计算机、物理、数学等领域
- 最新预印本论文
- 免费、无需 API Key
- 提供 PDF 下载链接

**速率限制**：
- 请求间隔不少于 3 秒
- 需要设置 User-Agent 请求头

**返回字段**：
- `id`：arXiv ID（如 2506.13389v1）
- `title`：论文标题
- `authors`：作者列表
- `year`：出版年份
- `doi`：DOI（部分论文）
- `abstract`：摘要
- `link`：论文链接（含 PDF）
- `category`：分类标签

**使用示例**：
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

// 根据 arXiv ID 获取论文详情
use_mcp_tool({
  server_name: "scientific-research-mcp",
  tool_name: "literature_searcher",
  arguments: {
    action: "get_by_id",
    id: "2506.13389v1",
    api: "arxiv"
  }
});
```

---

### 4. CNKI API（待实现）

**计划特点**：
- 中文文献最全
- 需要机构授权
- 需要配置 `CNKI_API_KEY`

**环境变量**：
```bash
CNKI_API_KEY=your_api_key_here
```

---

### 5. 万方数据 API（待实现）

**计划特点**：
- 中文文献覆盖
- 需要机构授权
- 需要配置 `WANFANG_API_KEY`

**环境变量**：
```bash
WANFANG_API_KEY=your_api_key_here
```

---

## 降级处理策略

### 零结果处理

当主 API 返回零结果时，系统会自动执行以下操作：

1. **扩展关键词**
   - 移除修饰词（based on, using, approach 等）
   - 拆分长关键词（取前 3 个词、后 3 个词）

2. **尝试降级 API**
   - 中文：Crossref → OpenAlex
   - 英文：OpenAlex → arXiv

3. **提示用户**
   - 如果所有 API 都未找到，提示用户：
     - 尝试更换关键词
     - 手动提供参考文献列表
     - 继续生成（引用标记为 [待核实]）

### 错误处理

| 错误类型 | 处理方式 |
|---------|---------|
| API 请求失败 | 尝试降级 API |
| 速率限制 | 等待后重试 |
| 零结果 | 扩展关键词重试 |
| 所有 API 失败 | 返回空结果，提示用户 |

---

## 引用验证机制

### verify_citation 工具

**验证流程**：
```
用户提供引用信息
       ↓
有 DOI？ → 用 DOI 从 OpenAlex 验证
       ↓
无 DOI？ → 用标题从 OpenAlex 检索并匹配
       ↓
匹配成功？ → verified: true
       ↓
匹配失败？ → verified: false
```

**匹配算法**：
- 标题相似度 > 0.8（基于 Levenshtein 编辑距离）
- 作者相似度 > 0.7
- 年份匹配（如果提供）

**使用示例**：
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

---

## 最佳实践

### 1. 中文论文检索
- 优先使用 Crossref（覆盖 1.3 亿篇，支持中文）
- 如果结果不相关，尝试 OpenAlex

### 2. 英文论文检索
- 优先使用 OpenAlex（覆盖 2.4 亿篇）
- 如果需要最新预印本，补充使用 arXiv

### 3. 计算机领域论文
- OpenAlex + arXiv 组合使用
- arXiv 提供最新预印本

### 4. 引用验证
- 优先使用 DOI 验证（最准确）
- 无 DOI 时使用标题匹配
- 开启严格模式标记所有可疑引用

---

## 常见问题

### Q: 为什么中文检索结果不相关？
A: Crossref 主要收录有 DOI 的论文，部分中文文献可能未注册 DOI。建议：
- 尝试使用英文关键词
- 使用 OpenAlex 作为降级选项
- 手动提供参考文献列表

### Q: arXiv 检索为什么慢？
A: arXiv 要求请求间隔不少于 3 秒，这是官方速率限制。建议：
- 批量检索时添加延迟
- 优先使用 OpenAlex，arXiv 作为补充

### Q: 如何获取全文 PDF？
A: 当前版本仅支持元数据检索。PDF 下载功能计划在 v2.0.0 实现。

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.1.0 | 2026-04-23 | 添加 Crossref 和 arXiv API |
| v1.0.0 | 2026-04-20 | 初始版本，支持 OpenAlex |