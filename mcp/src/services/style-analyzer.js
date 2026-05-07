/**
 * 写作风格分析服务
 * 从参考论文中提取写作风格特征，用于指导论文写作
 */

import * as fs from 'fs/promises';
import * as path from 'path';

const STYLE_REFERENCES_DIR = process.env.STYLE_REFERENCES_DIR || 
  path.join(process.cwd(), 'paper', 'style-references');

/**
 * 风格特征数据结构
 */
export const StyleProfile = {
  // 句式特征
  sentencePatterns: {
    // 常用句式模板
    summaryPatterns: [],      // 总结句式，如"在XX方面，本文提出了..."
    transitionPatterns: [],   // 过渡句式，如"围绕上述问题..."
    limitationPatterns: [],   // 局限性表述，如"受XX限制..."
  },
  // 段落组织
  paragraphStructure: {
    openingStyle: '',         // 开头方式
    progressionStyle: '',     // 展开方式（递进/并列/对比）
    closingStyle: '',         // 结尾方式
  },
  // 词汇偏好
  vocabularyPreferences: {
    formalTerms: [],          // 正式学术用语
    transitionWords: [],      // 过渡词
    hedgeWords: [],           // 模糊限制语
  },
  // 论述逻辑
  argumentationLogic: {
    problemStatement: '',     // 问题陈述方式
    evidencePresentation: '', // 证据呈现方式
    conclusionDrawing: '',    // 结论推导方式
  },
  // 引用风格
  citationStyle: {
    inTextFormat: '',         // 文内引用格式
    referenceFormat: '',      // 参考文献格式
  },
};

/**
 * 分析参考论文PDF，提取写作风格特征
 * @param {string[]} pdfPaths - PDF文件路径数组
 * @returns {Promise<object>} 风格特征分析结果
 */
export async function analyzeWritingStyle(pdfPaths) {
  const results = [];
  
  for (const pdfPath of pdfPaths) {
    try {
      const fullPath = path.isAbsolute(pdfPath) ? pdfPath : path.join(process.cwd(), pdfPath);
      
      // 检查文件是否存在
      try {
        await fs.access(fullPath);
      } catch {
        results.push({
          path: pdfPath,
          success: false,
          reason: '文件不存在',
        });
        continue;
      }
      
      // 提取PDF文本
      const text = await extractPdfText(fullPath);
      
      if (!text || text.trim().length === 0) {
        results.push({
          path: pdfPath,
          success: false,
          reason: '无法提取文本内容',
        });
        continue;
      }
      
      // 分析风格特征
      const profile = extractStyleFeatures(text);
      
      results.push({
        path: pdfPath,
        success: true,
        profile,
        textLength: text.length,
      });
    } catch (error) {
      results.push({
        path: pdfPath,
        success: false,
        reason: error.message,
      });
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  
  return {
    success: successCount > 0,
    totalFiles: pdfPaths.length,
    successCount,
    failedCount: pdfPaths.length - successCount,
    profiles: results.filter(r => r.success),
    failures: results.filter(r => !r.success),
  };
}

/**
 * 提取PDF文本内容
 * @param {string} pdfPath - PDF文件路径
 * @returns {Promise<string>} 提取的文本文本
 */
async function extractPdfText(pdfPath) {
  const { execFile } = await import('child_process');
  const util = await import('util');
  const execFileAsync = util.promisify(execFile);
  
  try {
    // 尝试使用python + pdfplumber提取
    const pythonScript = `
import sys
import pdfplumber

try:
    with pdfplumber.open('${pdfPath.replace(/\\/g, '\\\\')}') as pdf:
        text = '\\n'.join([page.extract_text() or '' for page in pdf.pages])
        print(text)
except Exception as e:
    print(f'ERROR: {e}', file=sys.stderr)
    sys.exit(1)
`;
    const { stdout } = await execFileAsync('python', ['-c', pythonScript], {
      maxBuffer: 50 * 1024 * 1024, // 50MB
    });
    return stdout;
  } catch (error) {
    // 如果pdfplumber不可用，尝试pdfminer
    try {
      const { stdout } = await execFileAsync('python', [
        '-c',
        `
import sys
try:
    from pdfminer.high_level import extract_text
    text = extract_text('${pdfPath.replace(/\\/g, '\\\\')}')
    print(text)
except ImportError:
    print('ERROR: pdfminer not available', file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f'ERROR: {e}', file=sys.stderr)
    sys.exit(1)
`
      ], { maxBuffer: 50 * 1024 * 1024 });
      return stdout;
    } catch (innerError) {
      throw new Error(`PDF文本提取失败：${error.message}`);
    }
  }
}

/**
 * 从文本中提取写作风格特征
 * @param {string} text - 论文文本
 * @returns {object} 风格特征
 */
function extractStyleFeatures(text) {
  const profile = { ...StyleProfile };
  
  // 提取总结句式
  profile.sentencePatterns.summaryPatterns = extractSummaryPatterns(text);
  
  // 提取过渡模式
  profile.sentencePatterns.transitionPatterns = extractTransitionPatterns(text);
  
  // 提取局限性表述
  profile.sentencePatterns.limitationPatterns = extractLimitationPatterns(text);
  
  // 提取段落组织特征
  profile.paragraphStructure = extractParagraphStructure(text);
  
  // 提取词汇偏好
  profile.vocabularyPreferences = extractVocabularyPreferences(text);
  
  // 提取论述逻辑
  profile.argumentationLogic = extractArgumentationLogic(text);
  
  return profile;
}

/**
 * 提取总结句式模式
 */
function extractSummaryPatterns(text) {
  const patterns = [];
  
  // 匹配"在XX方面"句式
  const inAspectRegex = /在(?:[\u4e00-\u9fff]+?)(?:方面|层面)[，,、]?(?:本文|本研究)?(?:提出|归纳|构建|设计|探讨)/g;
  const matches = text.match(inAspectRegex);
  if (matches) {
    patterns.push(...matches.slice(0, 10));
  }
  
  // 匹配"围绕XX"句式
  const aroundRegex = /围绕[\u4e00-\u9fff、]+[，,，]?/g;
  const aroundMatches = text.match(aroundRegex);
  if (aroundMatches) {
    patterns.push(...aroundMatches.slice(0, 10));
  }
  
  return [...new Set(patterns)];
}

/**
 * 提取过渡模式
 */
function extractTransitionPatterns(text) {
  const transitions = [];
  
  // 常见过渡词
  const transitionWords = [
    '围绕', '总体来看', '近年来', '此外', '同时', '然而', 
    '基于上述', '在此基础上', '进一步', '需要强调的是',
    '一是', '二是', '三是', '四是', '五是',
  ];
  
  for (const word of transitionWords) {
    const regex = new RegExp(word, 'g');
    const matches = text.match(regex);
    if (matches && matches.length >= 2) {
      transitions.push({ word, frequency: matches.length });
    }
  }
  
  return transitions;
}

/**
 * 提取局限性表述模式
 */
function extractLimitationPatterns(text) {
  const patterns = [];
  
  // 匹配"受XX限制"句式
  const limitationRegex = /受[\u4e00-\u9fff、]+限制[，,，]?/g;
  const matches = text.match(limitationRegex);
  if (matches) {
    patterns.push(...matches);
  }
  
  // 匹配"仍存在一定局限"句式
  const limitationRegex2 = /仍存在[\u4e00-\u9fff、]*局限/g;
  const matches2 = text.match(limitationRegex2);
  if (matches2) {
    patterns.push(...matches2);
  }
  
  return [...new Set(patterns)];
}

/**
 * 提取段落组织特征
 */
function extractParagraphStructure(text) {
  // 分析段落开头方式
  const openings = [];
  const paragraphStarts = text.split('\n').filter(p => p.trim().length > 20);
  
  for (const para of paragraphStarts.slice(0, 50)) {
    if (para.startsWith('围绕')) {
      openings.push('问题导向式');
    } else if (para.startsWith('在')) {
      openings.push('范围界定式');
    } else if (para.startsWith('总体') || para.startsWith('综合')) {
      openings.push('总结式');
    } else {
      openings.push('直接陈述式');
    }
  }
  
  // 统计展开方式
  const progressionCounts = {
    '递进式': 0,
    '并列式': 0,
    '对比式': 0,
  };
  
  // 检测"一是...二是..."等并列结构
  const parallelRegex = /一是[\s\S]*?二是[\s\S]*?(?:三是)?/g;
  const parallelMatches = text.match(parallelRegex);
  if (parallelMatches) {
    progressionCounts['并列式'] = parallelMatches.length;
  }
  
  // 检测"首先...其次...最后"等递进结构
  const progressiveRegex = /首先[\s\S]*?其次[\s\S]*?(?:最后)?/g;
  const progressiveMatches = text.match(progressiveRegex);
  if (progressiveMatches) {
    progressionCounts['递进式'] = progressiveMatches.length;
  }
  
  const dominantOpening = getMostCommon(openings);
  const dominantProgression = Object.entries(progressionCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || '混合式';
  
  return {
    openingStyle: dominantOpening || '混合式',
    progressionStyle: dominantProgression,
    closingStyle: '总结展望式',  // 默认值
  };
}

/**
 * 提取词汇偏好
 */
function extractVocabularyPreferences(text) {
  const formalTerms = [];
  const transitionWords = [];
  
  // 提取学术用语
  const academicTermRegex = /(?:提出|构建|归纳|探讨|验证|分析|总结|设计)[\u4e00-\u9fff]{2,6}/g;
  const termMatches = text.match(academicTermRegex);
  if (termMatches) {
    formalTerms.push(...new Set(termMatches).slice(0, 20));
  }
  
  // 提取过渡词使用频率
  const commonTransitions = ['然而', '此外', '同时', '因此', '基于', '围绕', '总体'];
  for (const word of commonTransitions) {
    const regex = new RegExp(word, 'g');
    const count = (text.match(regex) || []).length;
    if (count > 0) {
      transitionWords.push({ word, count });
    }
  }
  
  return {
    formalTerms: formalTerms.slice(0, 15),
    transitionWords: transitionWords.sort((a, b) => b.count - a.count).slice(0, 10),
    hedgeWords: ['一定程度上', '较为', '相对', '可能', '往往'],  // 常见模糊限制语
  };
}

/**
 * 提取论述逻辑特征
 */
function extractArgumentationLogic(text) {
  // 分析问题陈述方式
  let problemStatement = '直接陈述式';
  if (text.includes('围绕') && text.includes('问题')) {
    problemStatement = '问题导向式';
  } else if (text.includes('然而') && text.includes('不足')) {
    problemStatement = '对比引出式';
  }
  
  // 分析证据呈现方式
  let evidencePresentation = '案例支撑式';
  if (text.includes('案例') && text.includes('表明')) {
    evidencePresentation = '案例归纳式';
  } else if (text.includes('实证') || text.includes('验证')) {
    evidencePresentation = '实证支撑式';
  }
  
  // 分析结论推导方式
  let conclusionDrawing = '归纳总结式';
  if (text.includes('综上所述') || text.includes('总体')) {
    conclusionDrawing = '综合归纳式';
  } else if (text.includes('研究表明')) {
    conclusionDrawing = '证据推导式';
  }
  
  return {
    problemStatement,
    evidencePresentation,
    conclusionDrawing,
  };
}

/**
 * 获取数组中最常见的元素
 */
function getMostCommon(arr) {
  if (arr.length === 0) return null;
  const counts = {};
  for (const item of arr) {
    counts[item] = (counts[item] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * 生成风格应用指导
 * @param {object} styleProfile - 风格特征
 * @returns {string} 风格应用指导文本
 */
export function generateStyleGuidance(styleProfile) {
  if (!styleProfile) {
    return '未提供写作风格参考，将使用默认学术写作规范。';
  }
  
  const lines = [];
  
  lines.push('### 写作风格指导（基于参考论文）');
  lines.push('');
  
  // 句式指导
  if (styleProfile.sentencePatterns?.summaryPatterns?.length > 0) {
    lines.push('#### 推荐句式');
    lines.push('总结句式：');
    styleProfile.sentencePatterns.summaryPatterns.slice(0, 3).forEach(p => {
      lines.push(`- "${p}"`);
    });
    lines.push('');
  }
  
  // 过渡词指导
  if (styleProfile.vocabularyPreferences?.transitionWords?.length > 0) {
    lines.push('#### 推荐过渡词');
    styleProfile.vocabularyPreferences.transitionWords.slice(0, 5).forEach(t => {
      lines.push(`- ${t.word}（使用${t.count}次）`);
    });
    lines.push('');
  }
  
  // 段落组织指导
  if (styleProfile.paragraphStructure) {
    lines.push('#### 段落组织建议');
    lines.push(`- 开头方式：${styleProfile.paragraphStructure.openingStyle}`);
    lines.push(`- 展开方式：${styleProfile.paragraphStructure.progressionStyle}`);
    lines.push('');
  }
  
  // 局限性表述指导
  if (styleProfile.sentencePatterns?.limitationPatterns?.length > 0) {
    lines.push('#### 局限性表述参考');
    styleProfile.sentencePatterns.limitationPatterns.forEach(p => {
      lines.push(`- "${p}"`);
    });
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * 检查风格参考目录中的PDF文件
 * @returns {Promise<string[]>} PDF文件路径数组
 */
export async function listStyleReferences() {
  try {
    await fs.access(STYLE_REFERENCES_DIR);
    const files = await fs.readdir(STYLE_REFERENCES_DIR);
    return files
      .filter(f => f.toLowerCase().endsWith('.pdf'))
      .map(f => path.join(STYLE_REFERENCES_DIR, f));
  } catch {
    return [];
  }
}

/**
 * 获取风格分析摘要（用于快速预览）
 * @param {object} styleProfile - 风格特征
 * @returns {string} 摘要文本
 */
export function getStyleSummary(styleProfile) {
  if (!styleProfile) {
    return '无风格参考';
  }
  
  const parts = [];
  
  if (styleProfile.sentencePatterns?.summaryPatterns?.length > 0) {
    parts.push(`总结句式${styleProfile.sentencePatterns.summaryPatterns.length}种`);
  }
  
  if (styleProfile.vocabularyPreferences?.transitionWords?.length > 0) {
    parts.push(`常用过渡词${styleProfile.vocabularyPreferences.transitionWords.length}个`);
  }
  
  if (styleProfile.paragraphStructure?.openingStyle) {
    parts.push(`段落开头偏好：${styleProfile.paragraphStructure.openingStyle}`);
  }
  
  return parts.length > 0 ? parts.join('，') : '风格分析完成';
}