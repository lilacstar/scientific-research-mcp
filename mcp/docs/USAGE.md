# Scientific Research MCP Server - 使用教程

## 目录

1. [快速入门](#快速入门)
2. [完整工作流](#完整工作流)
3. [高级用法](#高级用法)
4. [最佳实践](#最佳实践)
5. [常见问题](#常见问题)

---

## 快速入门

### 步骤 1：安装和配置

确保已安装 Node.js 和配置好环境变量。

```bash
cd mcp
npm install
```

### 步骤 2：设置 API 密钥

在 `.env` 文件或环境变量中设置：

```bash
ALIBABA_CLOUD_API_KEY=your-api-key-here
```

### 步骤 3：初始化项目

使用 `paper_coordinator` 工具初始化项目：

```
paper_coordinator(
  action="init",
  paper_type="chinese-journal",
  research_topic="沉浸式数字科普场景构建研究"
)
```

---

## 完整工作流

### 阶段 1：项目初始化

```javascript
// 1. 初始化项目
paper_coordinator({
  action: "init",
  paper_type: "chinese-journal",
  research_topic: "沉浸式数字科普场景构建研究"
})

// 2. 查看当前进度
paper_coordinator({ action: "progress" })

// 3. 获取推荐下一步
paper_coordinator({ action: "recommend" })
```

### 阶段 2：文献综述

```javascript
// 1. 处理文献 PDF
literature_reviewer({
  action: "process_pdfs",
  pdf_paths: ["/path/to/paper1.pdf", "/path/to/paper2.pdf"]
})

// 2. 撰写文献综述
literature_reviewer({ action: "write_review" })

// 3. 检索更多文献
literature_searcher({
  action: "search",
  query: "immersive science popularization",
  per_page: 5
})
```

### 阶段 3：论文写作

```javascript
// 按顺序撰写各章节
paper_writer({ chapter: "intro" })
paper_writer({ chapter: "methods" })
paper_writer({ chapter: "results" })
paper_writer({ chapter: "discussion" })
paper_writer({ chapter: "conclusion" })
```

### 阶段 4：摘要生成

```javascript
// 基于完整论文生成摘要和标题
abstract_writer({ action: "generate" })
```

### 阶段 5：内容验证

```javascript
// 1. 验证论文内容
verify_content({ mode: "full" })

// 2. 验证摘要
verify_abstract({ action: "verify" })

// 3. 验证引用
verify_citation({ strict_mode: true })
```

### 阶段 6：润色和导出

```javascript
// 1. 润色全文
paper_polisher({ scope: "full", focus: "all" })

// 2. 合并全文
paper_coordinator({ action: "merge" })

// 3. 导出
paper_coordinator({ action: "export" })
```

---

## 高级用法

### 自定义章节写作

```javascript
// 提供已有材料辅助写作
paper_writer({
  chapter: "methods",
  content_materials: `
已有实验数据：
- 样本量：1200
- 涵盖城市：北京、上海、广州
- 数据收集期：2023.01-2025.03
  `,
  rewrite: false
})
```

### 分章节润色

```javascript
// 仅润色引言部分
paper_polisher({ scope: "intro", focus: "language" })

// 仅润色方法部分
paper_polisher({ scope: "methods", focus: "format" })
```

### 定稿门控检查

```javascript
// 执行定稿门控检查
paper_coordinator({ action: "check-gate" })
```

---

## 最佳实践

### 1. 逐步写作

建议按以下顺序撰写论文：
1. 引言（intro）
2. 方法（methods）
3. 结果（results）
4. 讨论（discussion）
5. 结论（conclusion）

### 2. 及时验证

每完成一个章节后，建议执行 `verify_content` 验证内容准确性。

### 3. 备份管理

工具会自动创建备份文件，格式为：
- `文件名.backup.日期.md`

### 4. 文献管理

- 使用 `literature_searcher` 检索真实文献
- 使用 `verify_citation` 验证引用真实性
- 确保所有引用来自真实发表的文献

---

## 常见问题

### Q: 如何重置项目？

A: 删除 `paper/` 目录并重新执行 `paper_coordinator` 的 `init` 操作。

### Q: 润色后内容丢失怎么办？

A: 工具会自动创建备份文件，检查 `*.backup.*.md` 文件。

### Q: 如何切换论文类型？

A: 需要重新初始化项目，当前项目的元数据会被覆盖。

### Q: LLM API 调用失败怎么办？

A: 检查 `ALIBABA_CLOUD_API_KEY` 是否正确，网络连接是否正常。

### Q: 如何添加外部文献？

A: 将 PDF 文件放入 `paper/` 目录，使用 `literature_reviewer` 的 `process_pdfs` 操作。

---

*最后更新：2026-04-26*