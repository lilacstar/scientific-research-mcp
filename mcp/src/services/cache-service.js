/**
 * 缓存服务
 * 提供文献检索结果、LLM响应等缓存机制
 * 减少重复请求开销，提升性能
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

const PAPER_DIR = process.env.PAPER_DIR || path.join(process.cwd(), 'paper');
const CACHE_DIR = path.join(PAPER_DIR, '.cache');
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24小时

/**
 * 确保缓存目录存在
 */
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch {
    // 目录已存在
  }
}

/**
 * 生成缓存键
 */
function generateCacheKey(key) {
  return crypto.createHash('md5').update(key).digest('hex');
}

/**
 * 获取缓存文件路径
 */
function getCacheFilePath(cacheKey) {
  return path.join(CACHE_DIR, `${cacheKey}.json`);
}

/**
 * 获取缓存数据
 * @param {string} key - 缓存键
 * @param {number} ttl - 过期时间（毫秒），默认24小时
 * @returns {Promise<any|null>} 缓存数据，过期或不存在返回null
 */
export async function getCache(key, ttl = DEFAULT_TTL) {
  try {
    await ensureCacheDir();
    const cacheKey = generateCacheKey(key);
    const cachePath = getCacheFilePath(cacheKey);
    
    const content = await fs.readFile(cachePath, 'utf-8');
    const cacheEntry = JSON.parse(content);
    
    // 检查是否过期
    const now = Date.now();
    if (now - cacheEntry.timestamp > ttl) {
      // 缓存过期，删除
      await fs.unlink(cachePath);
      return null;
    }
    
    cacheEntry.hitCount = (cacheEntry.hitCount || 0) + 1;
    cacheEntry.lastAccessed = now;
    await fs.writeFile(cachePath, JSON.stringify(cacheEntry));
    
    return cacheEntry.data;
  } catch {
    return null;
  }
}

/**
 * 设置缓存数据
 * @param {string} key - 缓存键
 * @param {any} data - 缓存数据
 */
export async function setCache(key, data) {
  try {
    await ensureCacheDir();
    const cacheKey = generateCacheKey(key);
    const cachePath = getCacheFilePath(cacheKey);
    
    const cacheEntry = {
      key,
      data,
      timestamp: Date.now(),
      hitCount: 0,
      lastAccessed: Date.now()
    };
    
    await fs.writeFile(cachePath, JSON.stringify(cacheEntry, null, 2));
    return true;
  } catch {
    return false;
  }
}

/**
 * 删除缓存
 * @param {string} key - 缓存键
 */
export async function deleteCache(key) {
  try {
    const cacheKey = generateCacheKey(key);
    const cachePath = getCacheFilePath(cacheKey);
    await fs.unlink(cachePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 清空所有缓存
 */
export async function clearCache() {
  try {
    await ensureCacheDir();
    const entries = await fs.readdir(CACHE_DIR);
    for (const entry of entries) {
      await fs.unlink(path.join(CACHE_DIR, entry));
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取缓存统计信息
 */
export async function getCacheStats() {
  try {
    await ensureCacheDir();
    const entries = await fs.readdir(CACHE_DIR);
    
    let totalSize = 0;
    let totalEntries = 0;
    let expiredEntries = 0;
    const now = Date.now();
    
    for (const entry of entries) {
      if (entry.endsWith('.json')) {
        totalEntries++;
        const filePath = path.join(CACHE_DIR, entry);
        const stat = await fs.stat(filePath);
        totalSize += stat.size;
        
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const cacheEntry = JSON.parse(content);
          if (now - cacheEntry.timestamp > DEFAULT_TTL) {
            expiredEntries++;
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
    
    return {
      totalEntries,
      expiredEntries,
      activeEntries: totalEntries - expiredEntries,
      totalSizeKB: (totalSize / 1024).toFixed(2)
    };
  } catch {
    return { totalEntries: 0, expiredEntries: 0, activeEntries: 0, totalSizeKB: 0 };
  }
}

/**
 * 带缓存的函数包装器
 * @param {Function} fn - 要缓存的函数
 * @param {string} keyPrefix - 缓存键前缀
 * @param {number} ttl - 缓存时间（毫秒）
 */
export function withCache(fn, keyPrefix, ttl = DEFAULT_TTL) {
  return async (...args) => {
    const cacheKey = `${keyPrefix}:${JSON.stringify(args)}`;
    
    // 尝试从缓存获取
    const cached = await getCache(cacheKey, ttl);
    if (cached !== null) {
      return { data: cached, fromCache: true };
    }
    
    // 执行函数并缓存结果
    const result = await fn(...args);
    await setCache(cacheKey, result);
    
    return { data: result, fromCache: false };
  };
}

/**
 * 批量执行函数（支持并发控制）
 * @param {Array} items - 待处理项
 * @param {Function} fn - 处理函数
 * @param {number} concurrency - 并发数，默认3
 */
export async function batchProcess(items, fn, concurrency = 3) {
  const results = [];
  
  // 分批处理
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(item => fn(item))
    );
    results.push(...batchResults);
  }
  
  return results;
}