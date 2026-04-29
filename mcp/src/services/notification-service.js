/**
 * 通知服务
 * 支持企业微信 Webhook 通知，用于推送论文写作进度和重要事件
 */

/**
 * 发送企业微信 Webhook 通知
 * @param {string} webhookUrl - 企业微信 Webhook URL
 * @param {string} title - 通知标题
 * @param {string} content - 通知内容
 * @param {string} type - 通知类型：info/success/warning/error
 * @returns {Promise<boolean>} 发送结果
 */
export async function sendWechatNotification(webhookUrl, title, content, type = 'info') {
  // TODO: 实现企业微信 Webhook 通知
  // 预留占位，后续完善
  
  if (!webhookUrl) {
    console.log(`[通知预留] ${title}: ${content}`);
    return false;
  }

  // 企业微信 Webhook 消息格式
  const messageTypes = {
    info: '📢',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  };

  const emoji = messageTypes[type] || '📢';

  const payload = {
    msgtype: 'markdown',
    markdown: {
      content: `${emoji} **${title}**\n\n${content}`
    }
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000) // 5秒超时
    });

    if (!response.ok) {
      console.error(`[通知发送失败] HTTP ${response.status}`);
      return false;
    }

    const result = await response.json();
    if (result.errcode === 0) {
      console.log(`[通知发送成功] ${title}`);
      return true;
    } else {
      console.error(`[通知发送失败] ${result.errmsg}`);
      return false;
    }
  } catch (error) {
    console.error(`[通知发送异常] ${error.message}`);
    return false;
  }
}

/**
 * 发送章节完成通知
 */
export async function notifyChapterCompleted(webhookUrl, chapterName) {
  const title = '论文章节完成';
  const content = `章节 **${chapterName}** 已撰写完成！\n\n请及时检查内容并继续后续写作。`;
  return await sendWechatNotification(webhookUrl, title, content, 'success');
}

/**
 * 发送润色完成通知
 */
export async function notifyPolishCompleted(webhookUrl, scope, wordCount) {
  const title = '论文润色完成';
  const content = `润色范围：**${scope}**\n润色后字数：${wordCount}\n\n请检查润色结果并确认是否采用。`;
  return await sendWechatNotification(webhookUrl, title, content, 'success');
}

/**
 * 发送验证完成通知
 */
export async function notifyVerificationCompleted(webhookUrl, result) {
  const title = '论文验证完成';
  const content = `验证结果：${result}\n\n请查看验证报告了解详细信息。`;
  return await sendWechatNotification(webhookUrl, title, content, 'info');
}

/**
 * 发送论文合并完成通知
 */
export async function notifyMergeCompleted(webhookUrl, chapterCount) {
  const title = '论文全文合并完成';
  const content = `已合并 **${chapterCount}** 个章节。\n\n全文草稿已生成，建议进行整体审校。`;
  return await sendWechatNotification(webhookUrl, title, content, 'success');
}

/**
 * 发送论文导出通知
 */
export async function notifyExportReady(webhookUrl) {
  const title = '论文导出就绪';
  const content = `论文已通过所有验证和润色。\n\n可以执行导出操作生成终稿。`;
  return await sendWechatNotification(webhookUrl, title, content, 'success');
}

/**
 * 发送错误通知
 */
export async function notifyError(webhookUrl, errorMessage) {
  const title = '论文写作系统错误';
  const content = `发生错误：${errorMessage}\n\n请检查系统状态并重试操作。`;
  return await sendWechatNotification(webhookUrl, title, content, 'error');
}

/**
 * 通知管理器
 * 统一管理所有通知的发送
 */
export class NotificationManager {
  constructor(webhookUrl) {
    this.webhookUrl = webhookUrl;
    this.enabled = !!webhookUrl;
  }

  /**
   * 发送通知（如果启用了 Webhook）
   */
  async send(title, content, type = 'info') {
    if (!this.enabled) {
      // 预留占位：控制台输出
      console.log(`[通知预留][${type}] ${title}: ${content}`);
      return false;
    }
    return await sendWechatNotification(this.webhookUrl, title, content, type);
  }

  /**
   * 章节完成通知
   */
  async chapterCompleted(chapterName) {
    return await notifyChapterCompleted(this.webhookUrl, chapterName);
  }

  /**
   * 润色完成通知
   */
  async polishCompleted(scope, wordCount) {
    return await notifyPolishCompleted(this.webhookUrl, scope, wordCount);
  }

  /**
   * 验证完成通知
   */
  async verificationCompleted(result) {
    return await notifyVerificationCompleted(this.webhookUrl, result);
  }

  /**
   * 合并完成通知
   */
  async mergeCompleted(chapterCount) {
    return await notifyMergeCompleted(this.webhookUrl, chapterCount);
  }

  /**
   * 导出就绪通知
   */
  async exportReady() {
    return await notifyExportReady(this.webhookUrl);
  }

  /**
   * 错误通知
   */
  async error(errorMessage) {
    return await notifyError(this.webhookUrl, errorMessage);
  }
}

/**
 * 创建通知管理器实例
 */
export function createNotificationManager() {
  const webhookUrl = process.env.WECHAT_WEBHOOK || '';
  return new NotificationManager(webhookUrl);
}