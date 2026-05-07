#!/usr/bin/env node
/**
 * 使用 GitHub Contents API 批量上传文件到仓库
 * 绕过 Git 协议限制
 *
 * 使用方法：
 * 1. 复制 .env.local.example 为 .env.local
 * 2. 填写 GITHUB_TOKEN、GITHUB_OWNER、GITHUB_REPO
 * 3. 运行: node mcp/scripts/upload-to-github.js
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 从 .env.local 加载环境变量
async function loadEnv() {
  const envPath = path.resolve(__dirname, '../../.env.local');
  try {
    const content = await fs.readFile(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').trim();
        if (key && value) {
          process.env[key.trim()] = value;
        }
      }
    });
  } catch (e) {
    console.error('❌ 错误: 未找到 .env.local 文件');
    console.error('   请复制 .env.local.example 为 .env.local 并填写配置');
    process.exit(1);
  }
}

const REPO_OWNER = process.env.GITHUB_OWNER;
const REPO_NAME = process.env.GITHUB_REPO;
const TOKEN = process.env.GITHUB_TOKEN;
const BRANCH = 'main';
const BASE_DIR = path.resolve(__dirname, '../..');

// 需要上传的文件列表
const FILES = [
  '.env.local.example',
  '.gitignore',
  'API_GUIDE.md',
  'CHANGELOG.md',
  'LLM_CONNECTION.md',
  'README.md',
  'USER_GUIDE.md',
  'mcp/.env.example',
  'mcp/docs/API.md',
  'mcp/docs/TROUBLESHOOTING.md',
  'mcp/docs/USAGE.md',
  'mcp/package-lock.json',
  'mcp/package.json',
  'mcp/src/index.js',
  'mcp/src/services/cache-service.js',
  'mcp/src/services/file-service.js',
  'mcp/src/services/literature-service.js',
  'mcp/src/services/llm-service.js',
  'mcp/src/services/notification-service.js',
  'mcp/src/services/path-resolver.js',
  'mcp/src/services/pdf-service.js',
  'mcp/src/services/version-control.js',
  'mcp/src/tools/abstract-writer.js',
  'mcp/src/tools/list-tools.js',
  'mcp/src/tools/literature-reviewer.js',
  'mcp/src/tools/material-reader.js',
  'mcp/src/tools/paper-coordinator.js',
  'mcp/src/tools/paper-polisher.js',
  'mcp/src/tools/paper-writer.js',
  'mcp/src/tools/verify-abstract.js',
  'mcp/src/tools/verify-citation.ts',
  'mcp/src/tools/verify-content.js',
  'mcp/tests/file-service.test.js',
  'mcp/tsconfig.json',
  'package-lock.json',
  'package.json',
  'shared/prompts/paper-writer-prompt.md',
  'shared/protocols/checklists.md',
  'shared/protocols/journal-config-schema.md',
  'shared/protocols/progress-update-protocol.md',
  'shared/protocols/reference-papers-schema.md',
  'shared/references/chapter-context-rules.md',
  'shared/references/chinese-cliche-list.md',
  'shared/references/style-guide.md',
  'workbuddy-skills/README.md',
  'workbuddy-skills/paper-coordinator/index.js',
  'workbuddy-skills/paper-coordinator/skill.json',
  'workbuddy-skills/paper-writer/index.js',
  'workbuddy-skills/paper-writer/skill.json'
];

/**
 * 将文件内容编码为 base64
 */
function encodeBase64(content) {
  return Buffer.from(content).toString('base64');
}

/**
 * 上传单个文件到 GitHub
 */
async function uploadFile(filePath, content, sha = null) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`;
  
  const payload = {
    message: `Add ${filePath}`,
    content: encodeBase64(content),
    branch: BRANCH
  };
  
  if (sha) {
    payload.sha = sha;
  }
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`上传失败 ${filePath}: ${response.status} - ${error}`);
  }
  
  const result = await response.json();
  console.log(`✅ ${filePath}`);
  return result;
}

/**
 * 获取文件的 SHA（如果已存在）
 */
async function getFileSha(filePath) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}?ref=${BRANCH}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.sha;
    }
  } catch (e) {
    // 文件不存在
  }
  return null;
}

/**
 * 主函数
 */
async function main() {
  await loadEnv();
  
  // 验证必要的环境变量
  if (!TOKEN) {
    console.error('❌ 错误: 未在 .env.local 中配置 GITHUB_TOKEN');
    process.exit(1);
  }
  if (!REPO_OWNER) {
    console.error('❌ 错误: 未在 .env.local 中配置 GITHUB_OWNER');
    process.exit(1);
  }
  if (!REPO_NAME) {
    console.error('❌ 错误: 未在 .env.local 中配置 GITHUB_REPO');
    process.exit(1);
  }
  
  console.log(`开始上传文件到 GitHub...`);
  console.log(`仓库: https://github.com/${REPO_OWNER}/${REPO_NAME}\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const filePath of FILES) {
    try {
      const fullPath = path.join(BASE_DIR, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      
      // 检查文件是否已存在
      const sha = await getFileSha(filePath);
      
      await uploadFile(filePath, content, sha);
      successCount++;
      
      // 避免 API 限流，添加小延迟
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`❌ ${filePath}: ${error.message}`);
      failCount++;
    }
  }
  
  console.log(`\n上传完成！`);
  console.log(`成功: ${successCount}, 失败: ${failCount}`);
  console.log(`仓库地址: https://github.com/${REPO_OWNER}/${REPO_NAME}`);
}

main().catch(console.error);