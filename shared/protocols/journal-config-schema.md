# 期刊配置 Schema 定义与常见预设

本文件定义 `metadata.json` 中 `journalConfig` 对象的完整结构，并提供常见中文期刊的预设配置模板。

## Schema 定义

`journalConfig` 是一个可选对象，存储于 `metadata.json` 顶层。所有字段均可选，缺失时各 Skill 使用默认值。

```json
{
  "journalConfig": {
    "name": "期刊名称（字符串，必填，用于展示）",
    "issn": "ISSN 号（字符串，可选）",
    "wordLimit": {
      "total": 0,
      "abstract": 0
    },
    "abstractType": "auto",
    "keywordCount": {
      "min": 0,
      "max": 0
    },
    "citationFormat": "GB/T 7714",
    "sectionRequirements": "",
    "specialNotes": "",
    "submissionUrl": ""
  }
}
```

### 字段详细说明

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `name` | string | 是 | - | 期刊名称，用于各 Skill 展示和通知消息 |
| `issn` | string | 否 | "" | ISSN 号，辅助标识期刊 |
| `wordLimit.total` | int | 否 | 0 | 全文字数上限，0 表示不限制 |
| `wordLimit.abstract` | int | 否 | 0 | 摘要字数上限，0 表示不限制 |
| `abstractType` | string | 否 | "auto" | 摘要类型：`structured`（结构式）、`unstructured`（非结构式）、`auto`（由 abstract-writer 按论文类型自动推荐） |
| `keywordCount.min` | int | 否 | 0 | 关键词最少数量 |
| `keywordCount.max` | int | 否 | 0 | 关键词最多数量，0 表示不限制 |
| `citationFormat` | string | 否 | "GB/T 7714" | 引用格式：`GB/T 7714`、`APA`、`IEEE`、`Vancouver` |
| `sectionRequirements` | string | 否 | "" | 章节结构要求（自由文本，如"需包含'理论框架'节"） |
| `specialNotes` | string | 否 | "" | 其他特殊投稿要求（自由文本） |
| `submissionUrl` | string | 否 | "" | 期刊投稿系统 URL |

### 向后兼容规则

- `journalConfig` 整体缺失或为 `null`：所有 Skill 按默认值运行，行为与 P3 改进前完全一致
- `journalConfig` 存在但某些字段缺失：缺失字段使用上述默认值
- 各 Skill 在加载 journalConfig 时必须先检查是否为 `null`，再做字段级读取

### 各 Skill 使用方式

| Skill | 使用的字段 | 用途 |
|-------|-----------|------|
| paper-writer | `wordLimit.total` | 步骤 7 撰写前将字数约束注入提示词 |
| abstract-writer | `abstractType`, `wordLimit.abstract`, `keywordCount` | 步骤 3 自动确定摘要类型和字数 |
| verify-content | `wordLimit.total`, `citationFormat`, `sectionRequirements`, `specialNotes` | 第八组"期刊要求检查" |
| verify-abstract | `wordLimit.abstract`, `abstractType`, `keywordCount` | 第三组"摘要格式检查"按期刊具体值 |
| paper-polisher | `citationFormat`, `sectionRequirements`, `specialNotes` | 格式规范检查增加期刊约束维度 |

## 常见中文期刊预设

以下预设为通用模板，用户可在 paper-coordinator 初始化时选择，之后根据实际投稿要求微调。

### 预设 1：理工科科技期刊（通用）

适用于中国科技核心期刊、CSCD 期刊等理工科综合类。

```json
{
  "journalConfig": {
    "name": "理工科科技期刊（通用预设）",
    "issn": "",
    "wordLimit": {
      "total": 8000,
      "abstract": 300
    },
    "abstractType": "structured",
    "keywordCount": {
      "min": 3,
      "max": 5
    },
    "citationFormat": "GB/T 7714",
    "sectionRequirements": "引言、方法、结果、讨论、结论",
    "specialNotes": "",
    "submissionUrl": ""
  }
}
```

### 预设 2：社科类 CSSCI 期刊（通用）

适用于社会科学类 CSSCI 来源期刊。

```json
{
  "journalConfig": {
    "name": "社科类CSSCI期刊（通用预设）",
    "issn": "",
    "wordLimit": {
      "total": 12000,
      "abstract": 300
    },
    "abstractType": "unstructured",
    "keywordCount": {
      "min": 3,
      "max": 6
    },
    "citationFormat": "GB/T 7714",
    "sectionRequirements": "",
    "specialNotes": "",
    "submissionUrl": ""
  }
}
```

### 预设 3：教育类期刊（通用）

适用于教育学、教育技术类期刊。

```json
{
  "journalConfig": {
    "name": "教育类期刊（通用预设）",
    "issn": "",
    "wordLimit": {
      "total": 8000,
      "abstract": 200
    },
    "abstractType": "unstructured",
    "keywordCount": {
      "min": 3,
      "max": 5
    },
    "citationFormat": "GB/T 7714",
    "sectionRequirements": "",
    "specialNotes": "",
    "submissionUrl": ""
  }
}
```

### 预设 4：短通讯/简报类

适用于字数要求较少的短文、快报类期刊。

```json
{
  "journalConfig": {
    "name": "短通讯/简报类（通用预设）",
    "issn": "",
    "wordLimit": {
      "total": 4000,
      "abstract": 150
    },
    "abstractType": "unstructured",
    "keywordCount": {
      "min": 2,
      "max": 4
    },
    "citationFormat": "GB/T 7714",
    "sectionRequirements": "",
    "specialNotes": "不要求分章节，可使用连续编号",
    "submissionUrl": ""
  }
}
```

## 配置时机与流程

详见 paper-coordinator SKILL.md 中的"首次初始化"步骤。

简要说明：
1. **初始化时必问**：paper-coordinator 在询问论文类型、研究方向之后，必问"是否已确定投稿期刊？"
2. **已确定**：引导从预设选择或自定义填写，写入 metadata.json
3. **未确定**：`journalConfig` 设为 `null`，后续加载时提醒用户补充
4. **随时可改**：用户任何时候说"我要投XX期刊"即可重新配置
