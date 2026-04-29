# WorkBuddy Skills for Scientific Research

科学论文写作 WorkBuddy Skills，与 MCP Server 共享核心文件。

## 架构设计

```
scientific-research-mcp/
├── shared/                 # 共享核心（MCP 和 Skills 共用）
│   ├── prompts/            # 提示词模板
│   ├── protocols/          # 协议定义
│   └── references/         # 参考资料
├── mcp/                    # MCP Server 实现
└── workbuddy-skills/       # WorkBuddy Skills 实现
```

## 可用的 Skills

| Skill | 描述 | 功能 |
|-------|------|------|
| paper-coordinator | 论文协调器 | 初始化项目、管理进度、合并全文 |
| paper-writer | 论文写作引擎 | 撰写各章节（引言/方法/结果/讨论/结论） |
| paper-polisher | 论文润色 | 语言润色、格式检查 |
| abstract-writer | 摘要生成 | 基于论文生成摘要和标题 |
| literature-reviewer | 文献综述 | 处理PDF、撰写综述 |
| verify-content | 内容验证 | 逻辑链检查、一致性检查 |

## 共享核心文件

每个 Skill 通过 `sharedCore` 字段引用共享目录：

```json
{
  "sharedCore": "../../shared",
  "dependencies": {
    "prompts": ["../../shared/prompts/paper-writer-prompt.md"],
    "protocols": ["../../shared/protocols/progress-update-protocol.md"],
    "references": ["../../shared/references/style-guide.md"]
  }
}
```

## 使用方式

### 在 WorkBuddy 中使用

```javascript
// 初始化项目
const result = await skills.execute('paper-coordinator', {
  action: 'init',
  paperType: 'chinese-journal',
  researchTopic: '沉浸式数字科普场景构建研究'
});

// 撰写章节
const chapter = await skills.execute('paper-writer', {
  chapter: 'intro',
  contentMaterials: '用户提供的素材'
});

// 润色论文
const polished = await skills.execute('paper-polisher', {
  scope: 'full',
  focus: 'all'
});
```

### 与 MCP Server 的关系

- **MCP Server**: 通过 MCP 协议提供工具调用
- **WorkBuddy Skills**: 作为独立插件运行
- **共享核心**: 两者使用相同的 prompts、protocols 和 references

## 开发新 Skill

1. 创建目录：`workbuddy-skills/my-skill/`
2. 创建 `skill.json` 定义文件
3. 创建 `index.js` 实现文件
4. 确保引用 `sharedCore` 中的共享文件

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PAPER_DIR | 论文工作区路径 | ./paper |
| ALIBABA_CLOUD_API_KEY | LLM API 密钥 | - |