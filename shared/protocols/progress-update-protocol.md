# 进度更新协议（v1.2）

本文件定义了所有生产 Skill 完成后更新 `paper/progress.md` 的统一协议。每个 Skill **必须**在流程结束时按本协议执行进度更新，不得跳过。

**v1.1 新增**：修订类型标注协议（第"修订类型标注"节），供 paper-writer 和 paper-polisher 使用，verify-content 和 verify-abstract 读取。
**v1.2 新增**：定稿门控检查协议（第"定稿门控检查"节），供 paper-coordinator 在导出前使用。

## 阶段状态表更新规则

### 更新时机

每个生产 Skill 完成核心任务后，**立即**更新 `paper/progress.md` 的"阶段状态"表中对应行。

### 更新字段

| 字段 | 格式 | 说明 |
|------|------|------|
| 状态 | `{已完成状态}` | 见下方各 Skill 的状态值定义 |
| 最后更新 | `YYYY-MM-DD` | 当天日期 |

### 各 Skill 状态值定义

| Skill | 对应阶段行 | 状态值 |
|-------|-----------|--------|
| `literature-reviewer` | 文献调研 | `已完成` |
| `paper-writer` | 论文写作 | `已完成（{全部章节名}）` 或 `进行中（{已完成章节名}）` |
| `abstract-writer` | 摘要标题 | `已完成（含摘要）` |
| `paper-polisher` | 审校润色 | `已完成（{版本号}润色终稿）` |

### 章节级进度（paper-writer 专用）

当 paper-writer 完成单个章节时，状态值示例：
- 完成引言：`进行中（intro）`
- 完成引言+方法：`进行中（intro, methods）`
- 完成全部五个章节：`已完成（intro, methods, results, discussion, conclusion）`

## 版本号同步规则

每个生产 Skill 在执行进度更新时，**必须同时**检查 `paper/metadata.json` 的 `version` 字段，确保 progress.md 中记录的状态与当前版本一致。

如果 `metadata.json` 的 `lastModified` 晚于阶段状态表的"最后更新"日期，说明存在不一致，应在状态值中附加当前版本号，例如：`已完成（v1.5）`。

## 验证记录表更新规则（verify-content / verify-abstract 专用）

验证 Skill 的验证记录表更新已有定义（见各 Skill 步骤 6），此处不再重复。本协议仅补充：

- 每次追加验证记录行时，**同时**更新"阶段状态"表中对应验证类型的最后更新时间（如有独立行）
- 如果验证发现致命问题，在对应的阶段状态行添加 `❌ 致命问题未解决` 后缀

## 变更日志更新规则（paper-writer 专用）

paper-writer 在步骤 7.5（版本对比自动化）中，每次章节草稿写入后：
1. 读取上一版本草稿（如存在）
2. 用 LLM 文本比对提取变更摘要
3. 追加写入 `paper/changelog.md`

详见 paper-writer SKILL.md 步骤 7.5。

## 修订类型标注协议（v1.1 新增）

### 目的

验证 Skill（verify-content / verify-abstract）通过读取修订类型标注来决定验证范围（跳过/定向/核心组/全量），从而减少不必要的 token 消耗。修订类型标注由生产 Skill（paper-writer / paper-polisher）自动写入，用户无需手动操作。

### 适用 Skill

| 写入方 | 读取方 |
|--------|--------|
| paper-writer v1.7+ | verify-content v1.8+, verify-abstract v1.5+ |
| paper-polisher v1.6+ | verify-content v1.8+, verify-abstract v1.5+ |

### 四种修订类型

| 类型 | 标识符 | 定义 | 典型场景 |
|------|--------|------|---------|
| 纯措辞润色 | `polish` | 仅修改措辞、语法、标点、排版，不改变任何实质性内容 | paper-polisher 的典型输出 |
| 定向修复 | `fix` | 修复验证报告中标注的特定问题（事实错误、引用缺失等），不涉及未标注内容的修改 | 用户根据 verify 报告逐一修复 |
| 内容变动 | `revise` | 新增、删除或修改段落/数据/论点，但未改变整体结构 | 新增案例、补充数据、调整论证 |
| 大重构 | `restructure` | 章节重写、结构调整、论点重排，影响面超过一个章节 | 重写讨论部分、合并/拆分章节 |

### 标注写入位置

在 `paper/progress.md` 阶段状态表中对应行的状态值后附加修订类型标注，格式为 `|revision:{type}`。

**示例**：

```
| 论文写作 | 进行中（intro, methods）|revision:revise | 2026-04-21 |
| 审校润色 | 已完成（v1.9润色终稿）|revision:polish | 2026-04-21 |
```

### 标注写入规则

1. **AI 自动判断**：paper-writer 在步骤 9（进度更新）时，AI 根据本次写作的实际变更内容判断修订类型并写入。paper-polisher 在步骤 5a（进度更新）时同理。
2. **判断优先级**：当一次操作同时涉及多种类型时，取**影响最大**的类型。优先级：`restructure > revise > fix > polish`。例如润色时顺带修复了一个引用错误，仍标注为 `polish`（因为主要操作是润色）。
3. **覆盖写入**：每次生产 Skill 完成后覆盖上一次的标注。progress.md 中始终保留最近一次的修订类型。
4. **首次写作**：paper-writer 首次写作全部章节时，标注为 `restructure`（从无到有属于最大变动）。
5. **abstract-writer 不写入标注**：摘要验证的触发逻辑独立于修订类型，由 verify-abstract 根据摘要是否变化自行判断。

### 向后兼容

如果 `progress.md` 中找不到 `|revision:` 标注（旧版本 Skill 未写入），验证 Skill 自动降级为版本号变化规则（verify-content v1.2 的原有逻辑），不会阻断任何流程。

## 定稿门控检查协议（v1.2 新增）

### 目的

在用户准备导出最终稿件（PDF/Word）之前，paper-coordinator 强制执行定稿门控检查，确保论文满足最低质量标准。如果检查不通过，阻止导出并给出明确的不通过原因和修复建议。

### 触发条件

当用户在 paper-coordinator 中请求执行以下操作时，自动触发定稿门控检查：
- 导出 PDF（`python md2pdf.py`）
- 导出 Word（`python md2docx.py`）
- 合并全文为最终草稿（`paper/draft-full.md`）并标注为"终稿"

如果用户只是合并全文查看（非终稿），不触发门控检查。

### 检查清单

定稿门控按顺序执行以下三项检查：

**检查 1：验证覆盖率是否为"当前"**

读取 `paper/progress.md` 的"验证覆盖率"表格，检查：
- `verify-content` 的状态是否为"✅ 当前"（非"⚠️ 过时"、非"未执行"、非"❌ 致命问题未解决"）
- `verify-abstract` 的状态是否为"✅ 当前"

**不通过条件**：任一验证类型状态不是"✅ 当前"

**检查 2：是否存在未关闭的致命问题**

读取 `paper/review-report.md`，检查最近的 verify-content 和 verify-abstract 报告中是否存在未关闭的致命（致命）问题。

判断方法：扫描报告中严重程度为"致命"的问题条目，如果问题条目中未包含"已修复""已处理""已解决"等关闭标记，视为未关闭。

**不通过条件**：存在至少 1 条未关闭的致命问题

**检查 3：是否存在未处理的"待人工核查"项**

读取 `paper/progress.md` 的"验证覆盖率"表格，检查"待核查项"列是否有大于 0 的值。

**不通过条件**：任一验证类型的"待核查项"数量 > 0

### 检查结果处理

**全部通过**：

三项检查全部通过后，允许执行导出操作。输出以下确认信息：

```
✅ 定稿门控检查通过：
- 验证覆盖率：verify-content ✅ 当前（YYYY-MM-DD），verify-abstract ✅ 当前（YYYY-MM-DD）
- 致命问题：无未关闭项
- 待核查项：0

可以安全导出。正在执行导出...
```

**任一不通过**：

如果任一项检查不通过，**阻止导出操作**，并输出以下格式的报告：

```markdown
❌ 定稿门控检查未通过，无法导出：

**检查 1 - 验证覆盖率**：
- verify-content：⚠️ 过时（上次执行于 v1.3，当前版本 v1.5）
- verify-abstract：✅ 当前
→ 建议执行 verify-content 重新验证

**检查 2 - 致命问题**：
- 第 3 组事实性陈述发现 1 条致命问题未关闭："[问题摘要]"
→ 建议使用 paper-writer 修复后重新验证

**检查 3 - 待核查项**：
- verify-content 存在 3 条"待人工核查"项未处理
→ 请逐条核查后，在 review-report.md 中标注处理结果

**修复建议**：
1. 先处理致命问题（最高优先级）
2. 逐条核查"待人工核查"项并标注处理结果
3. 重新执行验证确认问题已解决
4. 重新执行导出
```

只有标注为"不通过"的检查项需要展示，通过的检查项可以简略带过。

### 用户覆盖机制

如果用户明确表示"我知道有问题，仍然要导出"（例如需要导出草稿给导师审阅），允许用户覆盖门控，但：
1. 必须在导出文件名中附加"-草稿"标记（如 `v1.5_终稿-草稿.docx`）
2. 在导出后追加提醒："该稿件未通过定稿门控检查，建议修复问题后重新导出正式版"

## 里程碑通知模板

以下模板供 verify-content 和 verify-abstract 在全量验证的中间节点使用：

### verify-content 里程碑通知

每完成一组检查清单（共 7 组）发送一次：

```powershell
$body = [System.Text.Encoding]::UTF8.GetBytes('{"msgtype":"markdown","markdown":{"content":"## 论文写作助手\n> **内容验证** 进度更新\n> 论文主题：{researchTopic}\n> 已完成：{X}/7 组检查\n> {发现问题描述或"未发现致命问题"}\n> 当前时间：{当前时间}"}}')
Invoke-RestMethod -Uri "WEBHOOK_URL" -Method Post -ContentType "application/json; charset=utf-8" -Body $body
```

其中 `{发现问题描述}` 的规则：
- 该组未发现问题：`"未发现致命问题"`
- 该组发现问题：`"已发现 Y 处问题（致命 A / 重要 B / 轻微 C）"`

### verify-abstract 里程碑通知

每完成一组检查（共 5 组）发送一次：

```powershell
$body = [System.Text.Encoding]::UTF8.GetBytes('{"msgtype":"markdown","markdown":{"content":"## 论文写作助手\n> **摘要验证** 进度更新\n> 论文主题：{researchTopic}\n> 已完成：{X}/5 组检查\n> {发现问题描述或"未发现致命问题"}\n> 当前时间：{当前时间}"}}')
Invoke-RestMethod -Uri "WEBHOOK_URL" -Method Post -ContentType "application/json; charset=utf-8" -Body $body
```

其中 `{发现问题描述}` 的规则同上。
