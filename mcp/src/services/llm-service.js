/**
 * LLM API 服务
 * 封装阿里云 DashScope API 调用逻辑
 */

// 支持环境变量配置（优先使用环境变量，否则使用默认值）
const DASHSCOPE_API_ENDPOINT = process.env.DASHSCOPE_API_ENDPOINT || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const DEFAULT_MODEL = process.env.DASHSCOPE_MODEL || 'qwen3.6-plus';

/**
 * 调用 LLM API 生成内容
 */
export async function generateContent(
  prompt,
  systemPrompt,
  options
) {
  const apiKey = process.env.ALIBABA_CLOUD_API_KEY;
  
  if (!apiKey) {
    throw new Error('ALIBABA_CLOUD_API_KEY environment variable is not set');
  }

  const messages = [];
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  
  messages.push({ role: 'user', content: prompt });

  const controller = new AbortController();
  const timeoutMs = options?.timeout || 180000; // 默认3分钟超时
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(DASHSCOPE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: options?.model || DEFAULT_MODEL,
        messages: messages,
        temperature: options?.temperature || 0.7,
        max_tokens: options?.max_tokens || 16000
      })
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DashScope API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    return {
      content: data.choices[0].message.content,
      model: data.model,
      usage: data.usage
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000} seconds. Consider increasing the timeout setting.`);
    }
    throw error;
  }
}

/**
 * 生成论文章节草稿
 */
export async function generateChapterDraft(
  chapter,
  prompt,
  metadata
) {
  const systemPrompt = `你是一个专业的学术写作助手。请根据用户的要求撰写论文章节。

重要提醒：
1. 所有引用必须来自真实存在的文献
2. 如果不确定文献是否存在，请使用 [待核实] 标记
3. 不要编造论文标题、作者或期刊名称
4. 遵循学术写作规范，使用客观、准确的语言`;

  try {
    const response = await generateContent(prompt, systemPrompt, {
      temperature: 0.7,
      max_tokens: 4000
    });
    return response.content;
  } catch (error) {
    console.error(`Failed to generate chapter draft: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}