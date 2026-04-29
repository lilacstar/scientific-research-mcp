/**
 * List Tools 工具
 * 列出所有可用的论文写作工具及其功能说明
 */

/**
 * 列出所有工具
 */
export async function listTools() {
  const tools = [
    {
      name: 'paper_coordinator',
      description: '科学论文写作总协调器。初始化项目、管理进度、推荐下一步操作、合并全文、导出。',
      actions: ['init', 'progress', 'recommend', 'merge', 'export']
    },
    {
      name: 'paper_writer',
      description: '论文写作引擎。撰写论文的各个章节（引言、方法、结果、讨论、结论）。',
      chapters: ['intro', 'methods', 'results', 'discussion', 'conclusion']
    },
    {
      name: 'abstract_writer',
      description: '摘要与标题生成器。基于完整论文内容生成摘要和标题。',
      actions: ['generate', 'rewrite']
    },
    {
      name: 'paper_polisher',
      description: '论文润色专家。语言润色、翻译语气纠正、格式检查。支持精简模式（concise）控制字数，压缩10-20%。',
      scopes: ['full', 'intro', 'methods', 'results', 'discussion', 'conclusion', 'abstract'],
      focuses: ['language', 'format', 'citation', 'all']
    },
    {
      name: 'verify_content',
      description: '论文内容准确性与逻辑链验证专家。检查逻辑一致性、事实性陈述可信度、论证链完整性。',
      modes: ['full', 'incremental', 'targeted', 'skip']
    },
    {
      name: 'verify_abstract',
      description: '摘要验证专家。检查摘要与正文的一致性、准确性、完整性。',
      actions: ['verify', 'reverify']
    },
    {
      name: 'literature_reviewer',
      description: '文献综述撰写专家。处理文献PDF、提取关键信息、撰写文献综述。',
      actions: ['process_pdfs', 'write_review', 'check_references']
    },
    {
      name: 'list_tools',
      description: '列出所有可用的论文写作工具及其功能说明。'
    }
  ];

  const toolsList = tools.map(tool => {
    let text = `## ${tool.name}\n\n${tool.description}\n`;
    if ('actions' in tool) {
      text += `\n**支持的操作**：${tool.actions.join(', ')}\n`;
    }
    if ('chapters' in tool) {
      text += `\n**支持的章节**：${tool.chapters.join(', ')}\n`;
    }
    if ('scopes' in tool) {
      text += `\n**润色范围**：${tool.scopes.join(', ')}\n`;
      text += `**润色重点**：${tool.focuses.join(', ')}\n`;
      text += `**润色模式**：standard(标准) / concise(精简)\n`;
    }
    if ('modes' in tool) {
      text += `\n**验证模式**：${tool.modes.join(', ')}\n`;
    }
    return text;
  }).join('\n---\n\n');

  return {
    content: [
      {
        type: 'text',
        text: `📋 可用的论文写作工具：\n\n${toolsList}\n\n**使用方式**：\n1. 首先使用 paper_coordinator 初始化项目\n2. 根据推荐依次使用各个工具\n3. 完成写作后使用 verify_content 和 verify_abstract 验证\n4. 最后使用 paper_polisher 润色并导出`,
      },
    ],
  };
}