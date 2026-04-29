# 跨章节约束规则

本文件定义 paper-writer 在写作不同章节时必须遵守的跨章节约束。这些规则基于 `paper/chapter-context.md` 中记录的已完成章节的结构化摘要。

## 约束规则表

| 写作章节 | 必读上下文 | 硬性约束 |
|---------|-----------|---------|
| methods | intro | 研究设计必须能回答 intro 中提出的研究问题；变量定义必须与 intro 中的核心概念对应 |
| results | intro + methods | 呈现的数据必须回答 intro 中的研究问题；统计方法必须与 methods 中描述的一致 |
| discussion | intro + methods + results | 必须解读 results 中所有主要发现（逐条覆盖）；不得引入 results 中未出现的新数据或新结果；结论范围不得超出 results 证据能支撑的范围 |
| conclusion | discussion 的上下文摘要 | 不得引入 discussion 未提及的新观点或新结论；结论范围不得超出 discussion 末段 |

## 通用约束（所有章节）

1. **术语一致性**：所有章节使用的术语必须与 intro 上下文摘要中的"核心变量/概念"一致，不得对同一概念使用不同名称
2. **引用一致性**：引用的文献编号必须在参考文献列表中存在（与 verify-content 悬空引用检查联动）
3. **数据一致性**：任何在多个章节中出现的数字、统计数据必须完全一致

## 约束执行方式

- 约束检查在章节写作完成后自动执行（paper-writer 通用写作流程步骤 7b）
- 发现违反约束时，直接在章节草稿中标注 `[⚠️ 跨章节约束违反：...]` 并给出修改建议
- 用户可选择立即修改或标记为"待修订"

## chapter-context.md 不存在时的降级策略

如果 `paper/chapter-context.md` 不存在（向后兼容老项目），paper-writer 降级为读取所有已完成的 `paper/draft-*.md` 文件，但无法执行结构化的约束检查。此时在输出中提示："未检测到章节上下文摘要文件（chapter-context.md），跨章节约束检查已跳过。建议后续章节写作前先补充生成该文件。"
