/**
 * 文献检索服务
 * 支持多 API 源：OpenAlex、arXiv、Crossref
 * 中文查验主力：Crossref + OpenAlex
 * 英文查验主力：OpenAlex → arXiv（降级）
 */

const APIS = {
  openalex: {
    name: 'OpenAlex',
    base: 'https://api.openalex.org',
    requiresKey: false,
    chineseSupport: 'limited',
    englishSupport: 'full'
  },
  arxiv: {
    name: 'arXiv',
    base: 'http://export.arxiv.org/api',
    requiresKey: false,
    chineseSupport: 'none',
    englishSupport: 'full',
    note: '需要设置 User-Agent 请求头，请求间隔不少于 3 秒'
  },
  crossref: {
    name: 'Crossref',
    base: 'https://api.crossref.org',
    requiresKey: false,
    chineseSupport: 'full',
    englishSupport: 'full',
    note: '免费、无需 API Key，覆盖 1.3 亿篇论文'
  },
  // 预留扩展：
  // cnki: { name: 'CNKI', base: '...', requiresKey: true, chineseSupport: 'full', englishSupport: 'limited' },
  // wanfang: { name: '万方数据', base: '...', requiresKey: true, chineseSupport: 'full', englishSupport: 'limited' }
};

/**
 * 检测文本是否包含中文
 */
function containsChinese(text) {
  if (!text) return false;
  return /[\u4e00-\u9fa5]/.test(text);
}

/**
 * 根据关键词语言和论文类型自动选择 API
 * 中文查验主力：Crossref → OpenAlex（降级）
 * 英文查验主力：OpenAlex → arXiv（降级）
 * @param {string} query - 检索关键词
 * @param {string} paperType - 论文类型 (chinese-thesis / english-journal / chinese-journal)
 * @returns {string} API 名称
 */
export function selectApi(query, paperType) {
  const isChinese = containsChinese(query);
  const isChinesePaper = paperType?.startsWith('chinese');
  
  // 中文关键词 - 使用 Crossref + OpenAlex 降级策略
  if (isChinese) {
    // 如果有 CNKI Key，优先使用
    if (process.env.CNKI_API_KEY) {
      console.log('使用 CNKI API 检索中文文献');
      return 'cnki';
    }
    // 如果有万方 Key，使用万方
    if (process.env.WANFANG_API_KEY) {
      console.log('使用万方数据 API 检索中文文献');
      return 'wanfang';
    }
    // 默认使用 Crossref + OpenAlex 降级策略
    return 'crossref_openalex';
  }
  
  // 英文关键词 - 优先 OpenAlex，查不到再用 arXiv
  return 'openalex_arxiv';
}

/**
 * 统一文献检索接口
 * 中文查验降级策略：Crossref → OpenAlex → 返回空结果
 * 英文查验降级策略：OpenAlex → arXiv → 返回空结果
 * @param {string} query - 检索关键词
 * @param {string} paperType - 论文类型
 * @param {object} options - 检索选项
 * @returns {Promise<object>} 检索结果
 */
export async function searchLiterature(query, paperType, options = {}) {
  const api = selectApi(query, paperType);
  
  switch (api) {
    case 'openalex':
      return searchOpenAlex(query, options);
      
    case 'openalex_arxiv':
      // 英文论文查验降级策略：先用 OpenAlex，查不到再用 arXiv
      try {
        const openAlexResult = await searchOpenAlex(query, options);
        if (openAlexResult.total > 0) {
          console.log(`OpenAlex 找到 ${openAlexResult.total} 篇文献`);
          return openAlexResult;
        }
      } catch (error) {
        console.warn(`OpenAlex 检索失败：${error.message}，尝试 arXiv`);
      }
      
      // OpenAlex 未找到或失败，尝试 arXiv
      try {
        const arxivResult = await searchArxiv(query, options);
        if (arxivResult.total > 0) {
          console.log(`arXiv 找到 ${arxivResult.total} 篇文献`);
          return arxivResult;
        }
      } catch (error) {
        console.warn(`arXiv 检索失败：${error.message}`);
      }
      
      // 两个 API 都未找到，返回空结果
      return {
        api: 'OpenAlex/arXiv',
        total: 0,
        results: []
      };
      
    case 'crossref_openalex':
      // 中文论文查验降级策略：先用 Crossref，查不到再用 OpenAlex
      try {
        const crossrefResult = await searchCrossref(query, options);
        if (crossrefResult.total > 0) {
          console.log(`Crossref 找到 ${crossrefResult.total} 篇文献`);
          return crossrefResult;
        }
      } catch (error) {
        console.warn(`Crossref 检索失败：${error.message}，尝试 OpenAlex`);
      }
      
      // Crossref 未找到或失败，尝试 OpenAlex
      try {
        const openAlexResult = await searchOpenAlex(query, options);
        if (openAlexResult.total > 0) {
          console.log(`OpenAlex 找到 ${openAlexResult.total} 篇文献`);
          return openAlexResult;
        }
      } catch (error) {
        console.warn(`OpenAlex 检索失败：${error.message}`);
      }
      
      // 两个 API 都未找到，返回空结果
      return {
        api: 'Crossref/OpenAlex',
        total: 0,
        results: []
      };
      
    case 'cnki':
      return searchCnki(query, options);
    case 'wanfang':
      return searchWanfang(query, options);
    default:
      throw new Error(`Unknown API: ${api}`);
  }
}

/**
 * OpenAlex API 检索实现
 * @param {string} query - 检索关键词
 * @param {object} options - 检索选项
 * @param {number} options.per_page - 每页结果数（默认 5，最大 100）
 * @param {string} options.fields - 返回字段
 * @returns {Promise<object>} 检索结果
 */
export async function searchOpenAlex(query, options = {}) {
  const { per_page = 5, fields = 'title,authors,year,abstract,citationCount' } = options;
  
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=${per_page}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`OpenAlex API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      api: 'OpenAlex',
      total: data.meta?.count || 0,
      results: (data.results || []).map(work => ({
        id: work.id,
        title: work.display_name || work.title,
        authors: (work.authorships || []).map(a => a.author?.display_name || a.author?.raw_author_name).filter(Boolean),
        year: work.publication_year,
        journal: work.primary_location?.source?.display_name,
        doi: work.doi,
        citationCount: work.cited_by_count,
        abstract: formatAbstract(work.abstract_inverted_index),
        isOa: work.open_access?.is_oa,
        oaUrl: work.open_access?.oa_url,
        topics: (work.topics || []).map(t => t.display_name).slice(0, 5)
      }))
    };
  } catch (error) {
    throw new Error(`OpenAlex 检索失败：${error.message}`);
  }
}

/**
 * 格式化摘要（OpenAlex 返回的是倒排索引格式）
 */
function formatAbstract(abstractIndex) {
  if (!abstractIndex) return null;
  
  if (typeof abstractIndex === 'string') {
    return abstractIndex;
  }
  
  // 倒排索引格式：{ "word": [position1, position2], ... }
  if (typeof abstractIndex === 'object') {
    const entries = [];
    for (const [word, positions] of Object.entries(abstractIndex)) {
      if (Array.isArray(positions)) {
        positions.forEach(pos => entries.push({ word, pos }));
      } else {
        entries.push({ word, pos: positions });
      }
    }
    
    // 按位置排序
    entries.sort((a, b) => a.pos - b.pos);
    
    // 重组摘要
    return entries.map(e => e.word).join(' ');
  }
  
  return null;
}

/**
 * 根据 DOI 获取论文详情
 * @param {string} doi - DOI
 * @returns {Promise<object>} 论文详情
 */
export async function getWorkByDoi(doi) {
  const url = `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      return null;
    }
    
    const work = await response.json();
    
    return {
      id: work.id,
      title: work.display_name || work.title,
      authors: (work.authorships || []).map(a => a.author?.display_name).filter(Boolean),
      year: work.publication_year,
      journal: work.primary_location?.source?.display_name,
      doi: work.doi,
      citationCount: work.cited_by_count,
      abstract: formatAbstract(work.abstract_inverted_index)
    };
  } catch (error) {
    return null;
  }
}

/**
 * 根据 OpenAlex ID 获取论文详情
 * @param {string} id - OpenAlex ID (如 W1234567890)
 * @returns {Promise<object>} 论文详情
 */
export async function getWorkById(id) {
  const url = `https://api.openalex.org/works/${id}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      return null;
    }
    
    const work = await response.json();
    
    return {
      id: work.id,
      title: work.display_name || work.title,
      authors: (work.authorships || []).map(a => a.author?.display_name).filter(Boolean),
      year: work.publication_year,
      journal: work.primary_location?.source?.display_name,
      doi: work.doi,
      citationCount: work.cited_by_count,
      abstract: formatAbstract(work.abstract_inverted_index)
    };
  } catch (error) {
    return null;
  }
}

/**
 * Crossref API 检索实现
 * @param {string} query - 检索关键词
 * @param {object} options - 检索选项
 * @param {number} options.rows - 每页结果数（默认 5，最大 1000）
 * @returns {Promise<object>} 检索结果
 */
export async function searchCrossref(query, options = {}) {
  const { rows = 5 } = options;
  
  // Crossref API 需要设置 User-Agent
  const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${rows}&select=title,author,DOI,published,abstract`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ScientificResearchMCP/1.0 (Academic Research Tool)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Crossref API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      api: 'Crossref',
      total: data.message?.['total-results'] || 0,
      results: (data.message?.items || []).map(item => ({
        id: item.DOI,
        title: item.title?.[0] || null,
        authors: (item.author || []).map(a => `${a.given || ''} ${a.family || ''}`.trim()).filter(Boolean),
        year: item.published?.['date-parts']?.[0]?.[0] || null,
        journal: item.container?.title?.[0] || null,
        doi: item.DOI,
        citationCount: 0, // Crossref 不直接提供引用次数
        abstract: item.abstract || null,
        link: item.link?.[0]?.URL || `https://doi.org/${item.DOI}`
      }))
    };
  } catch (error) {
    throw new Error(`Crossref 检索失败：${error.message}`);
  }
}

/**
 * 根据 DOI 从 Crossref 获取论文详情
 * @param {string} doi - DOI
 * @returns {Promise<object>} 论文详情
 */
export async function getCrossrefWorkByDoi(doi) {
  const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ScientificResearchMCP/1.0 (Academic Research Tool)'
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    const item = data.message;
    
    return {
      id: item.DOI,
      title: item.title?.[0] || null,
      authors: (item.author || []).map(a => `${a.given || ''} ${a.family || ''}`.trim()).filter(Boolean),
      year: item.published?.['date-parts']?.[0]?.[0] || null,
      journal: item.container?.title?.[0] || null,
      doi: item.DOI,
      citationCount: 0,
      abstract: item.abstract || null,
      link: item.link?.[0]?.URL || `https://doi.org/${item.DOI}`
    };
  } catch (error) {
    return null;
  }
}

/**
 * CNKI API 检索实现（预留）
 * @param {string} query - 检索关键词
 * @param {object} options - 检索选项
 * @returns {Promise<object>} 检索结果
 */
export async function searchCnki(query, options = {}) {
  // TODO: 实现 CNKI API 调用
  // 需要配置 CNKI_API_KEY 环境变量
  if (!process.env.CNKI_API_KEY) {
    throw new Error('CNKI API 需要配置 CNKI_API_KEY 环境变量');
  }
  
  // 预留实现
  throw new Error('CNKI API 尚未实现，待后续扩展');
}

/**
 * 万方数据 API 检索实现（预留）
 * @param {string} query - 检索关键词
 * @param {object} options - 检索选项
 * @returns {Promise<object>} 检索结果
 */
export async function searchWanfang(query, options = {}) {
  // TODO: 实现万方数据 API 调用
  // 需要配置 WANFANG_API_KEY 环境变量
  if (!process.env.WANFANG_API_KEY) {
    throw new Error('万方数据 API 需要配置 WANFANG_API_KEY 环境变量');
  }
  
  // 预留实现
  throw new Error('万方数据 API 尚未实现，待后续扩展');
}

/**
 * 验证引用是否真实存在
 * @param {object} citation - 引用信息
 * @param {string} citation.title - 论文标题
 * @param {string} citation.author - 作者
 * @param {number} citation.year - 年份
 * @param {string} citation.doi - DOI
 * @returns {Promise<object>} 验证结果
 */
export async function verifyCitation(citation) {
  // 有 DOI 时用 DOI 验证（最准确）
  if (citation.doi) {
    const work = await getWorkByDoi(citation.doi);
    if (work) {
      return {
        verified: true,
        source: 'OpenAlex',
        work: work,
        message: 'DOI 验证通过'
      };
    }
    return {
      verified: false,
      source: null,
      work: null,
      message: 'DOI 不存在'
    };
  }
  
  // 有标题时用标题验证
  if (citation.title) {
    const searchResult = await searchOpenAlex(citation.title, { per_page: 5 });
    
    if (searchResult.total > 0) {
      // 检查是否有匹配的结果
      for (const result of searchResult.results) {
        const titleMatch = calculateSimilarity(result.title, citation.title) > 0.8;
        const authorMatch = !citation.author || 
          result.authors.some(a => calculateSimilarity(a.toLowerCase(), citation.author.toLowerCase()) > 0.7);
        const yearMatch = !citation.year || result.year === citation.year;
        
        if (titleMatch && authorMatch && yearMatch) {
          return {
            verified: true,
            source: 'OpenAlex',
            work: result,
            message: '文献验证通过'
          };
        }
      }
    }
    
    return {
      verified: false,
      source: null,
      work: null,
      message: '无法匹配到真实文献'
    };
  }
  
  return {
    verified: false,
    source: null,
    work: null,
    message: '缺少必要信息（标题或 DOI）'
  };
}

/**
 * 计算字符串相似度（简单实现）
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * 计算编辑距离
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * arXiv API 检索实现
 * @param {string} query - 检索关键词
 * @param {object} options - 检索选项
 * @param {number} options.max_results - 最大结果数（默认 5，最大 100）
 * @returns {Promise<object>} 检索结果
 */
export async function searchArxiv(query, options = {}) {
  const { max_results = 5 } = options;
  
  // arXiv API 需要设置 User-Agent，且请求间隔不少于 3 秒
  const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=${max_results}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ScientificResearchMCP/1.0 (Academic Research Tool)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.status}`);
    }
    
    const xmlText = await response.text();
    const results = parseArxivXML(xmlText);
    
    return {
      api: 'arXiv',
      total: results.total,
      results: results.entries
    };
  } catch (error) {
    throw new Error(`arXiv 检索失败：${error.message}`);
  }
}

/**
 * 解析 arXiv API 返回的 XML 数据
 * @param {string} xmlText - XML 文本
 * @returns {object} 解析后的结果
 */
function parseArxivXML(xmlText) {
  const entries = [];
  
  // 提取 totalResults
  const totalMatch = xmlText.match(/<opensearch:totalResults>(\d+)<\/opensearch:totalResults>/);
  const total = totalMatch ? parseInt(totalMatch[1]) : 0;
  
  // 提取每个 entry
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let entryMatch;
  
  while ((entryMatch = entryRegex.exec(xmlText)) !== null) {
    const entryXml = entryMatch[1];
    
    // 提取各字段
    const idMatch = entryXml.match(/<id>(.*?)<\/id>/);
    const titleMatch = entryXml.match(/<title>(.*?)<\/title>/);
    const summaryMatch = entryXml.match(/<summary>(.*?)<\/summary>/);
    const publishedMatch = entryXml.match(/<published>(.*?)<\/published>/);
    const linkMatch = entryXml.match(/<link href="(.*?)" rel="alternate"/);
    const doiMatch = entryXml.match(/<arxiv:doi>(.*?)<\/arxiv:doi>/);
    
    // 提取作者列表
    const authors = [];
    const authorRegex = /<author>\s*<name>(.*?)<\/name>\s*<\/author>/g;
    let authorMatch;
    while ((authorMatch = authorRegex.exec(entryXml)) !== null) {
      authors.push(authorMatch[1]);
    }
    
    // 提取分类
    const categoryMatch = entryXml.match(/<arxiv:primary_category term="(.*?)"\/>/);
    
    entries.push({
      id: idMatch ? idMatch[1] : null,
      title: titleMatch ? titleMatch[1].replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>') : null,
      authors: authors,
      year: publishedMatch ? new Date(publishedMatch[1]).getFullYear() : null,
      journal: null, // arXiv 不直接提供期刊信息
      doi: doiMatch ? doiMatch[1] : null,
      citationCount: 0, // arXiv 不提供引用次数
      abstract: summaryMatch ? summaryMatch[1].trim() : null,
      link: linkMatch ? linkMatch[1] : null,
      category: categoryMatch ? categoryMatch[1] : null
    });
  }
  
  return { total, entries };
}

/**
 * 根据 arXiv ID 获取论文详情
 * @param {string} id - arXiv ID (如 2506.13389v1)
 * @returns {Promise<object>} 论文详情
 */
export async function getArxivPaperById(id) {
  const url = `http://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ScientificResearchMCP/1.0 (Academic Research Tool)'
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const xmlText = await response.text();
    const results = parseArxivXML(xmlText);
    
    return results.entries.length > 0 ? results.entries[0] : null;
  } catch (error) {
    return null;
  }
}

/**
 * 扩展关键词（用于零结果时的降级处理）
 * @param {string} query - 原始关键词
 * @returns {string[]} 扩展后的关键词列表
 */
export function expandKeywords(query) {
  const expanded = [];
  
  // 移除修饰词，保留核心词
  const coreWords = query
    .replace(/based on/g, '')
    .replace(/using/g, '')
    .replace(/approach/g, '')
    .replace(/method/g, '')
    .replace(/study/g, '')
    .replace(/analysis/g, '')
    .replace(/research/g, '')
    .trim();
  
  if (coreWords && coreWords !== query) {
    expanded.push(coreWords);
  }
  
  // 拆分长关键词
  const words = query.split(/\s+/);
  if (words.length > 3) {
    // 取前 3 个词
    expanded.push(words.slice(0, 3).join(' '));
    // 取后 3 个词
    expanded.push(words.slice(-3).join(' '));
  }
  
  return expanded.filter(k => k.length > 3);
}