import { NewsItem, SourceId } from '../types';

/**
 * 真实快讯客户端（重构版）
 * ------------------------------------------------------------------
 * 旧版此文件内置了一个手写的"假新闻模板池"，把编造的内容冒充
 * Reuters / Bloomberg / 财新 的报道循环推送 —— 已全部移除。
 *
 * 新版职责：
 * 1. fetchLiveNews()        —— 拉取服务端 /api/news/live 真实聚合池
 * 2. subscribeNewsStream()  —— 订阅 /api/news/stream SSE 直推（自动重连）
 * 3. toNewsItem()           —— 服务端 wire 条目 → 前端 NewsItem 规范化
 *    （epoch 秒在此处按用户本地时区格式化，修复容器 UTC 时区错位）
 */

const VALID_SOURCE_IDS: SourceId[] = ['reuters', 'bloomberg', 'ft', 'wsj', 'wscn', 'cnbc', 'caixin'];

export interface FeedHealthInfo {
  id: string;
  label: string;
  ok: boolean | null;
  lastError: string | null;
}

/**
 * 媒体信源发布地区与时区元数据映射
 */
export interface SourceOriginTimeInfo {
  regionName: string;   // 地区名称，如 "美东 (New York)", "伦敦 (London)", "北京 (Beijing)"
  timeZone: string;     // IANA 时区标识，如 "America/New_York", "Europe/London", "Asia/Shanghai"
  flag: string;         // 国旗或地区标识 emoji
}

export const SOURCE_ORIGIN_TIMEZONES: Record<SourceId, SourceOriginTimeInfo> = {
  reuters: {
    regionName: '美东/伦敦',
    timeZone: 'America/New_York',
    flag: '🇺🇸/🇬🇧',
  },
  bloomberg: {
    regionName: '美东 (纽约)',
    timeZone: 'America/New_York',
    flag: '🇺🇸',
  },
  wsj: {
    regionName: '美东 (纽约)',
    timeZone: 'America/New_York',
    flag: '🇺🇸',
  },
  cnbc: {
    regionName: '美东 (纽约)',
    timeZone: 'America/New_York',
    flag: '🇺🇸',
  },
  ft: {
    regionName: '英国 (伦敦)',
    timeZone: 'Europe/London',
    flag: '🇬🇧',
  },
  wscn: {
    regionName: '中国 (北京)',
    timeZone: 'Asia/Shanghai',
    flag: '🇨🇳',
  },
  caixin: {
    regionName: '中国 (北京)',
    timeZone: 'Asia/Shanghai',
    flag: '🇨🇳',
  },
};

/**
 * 格式化指定时区的时间字符串 (MM-DD HH:mm 或 HH:mm)
 */
export function formatTimeInZone(epochSec: number, timeZone: string, includeDate: boolean = false): string {
  try {
    const d = new Date(epochSec * 1000);
    const formatter = new Intl.DateTimeFormat('zh-CN', {
      timeZone,
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    const month = parts.find((p) => p.type === 'month')?.value || '';
    const day = parts.find((p) => p.type === 'day')?.value || '';
    const hour = parts.find((p) => p.type === 'hour')?.value || '';
    const minute = parts.find((p) => p.type === 'minute')?.value || '';
    
    if (includeDate) {
      return `${month}-${day} ${hour}:${minute}`;
    }
    return `${hour}:${minute}`;
  } catch {
    const d = new Date(epochSec * 1000);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}

/**
 * 获取快讯的多时区深度对照详情（用户本地时区、原始发布地时区、北京时区）
 */
export interface NewsTimezoneComparison {
  timestamp: number;
  userLocalTime: string;          // 用户本地时区短时间，如 "16:27" 或 "08-18 16:27"
  userLocalFull: string;          // 用户本地时区完整时间，如 "2026-08-18 16:27:30"
  userTimeZone: string;           // 用户设备时区，如 "Asia/Shanghai" 或 "America/New_York"
  userUtcOffset: string;          // 用户时区偏差，如 "UTC+8" 或 "UTC-4"
  
  originRegion: string;           // 原始发布地区名称，如 "美东 (纽约)" 或 "英国 (伦敦)"
  originTimeZone: string;         // 原始发布地区 IANA 时区
  originFlag: string;             // 原始地区国旗
  originTime: string;             // 原始时区完整时间，如 "2026-08-18 04:27:30"
  originTimeShort: string;        // 原始时区短时间，如 "04:27" 或 "08-18 04:27"
  originUtcOffset: string;        // 原始时区偏差，如 "UTC-4"
  
  beijingTime: string;            // 北京完整时间，如 "2026-08-18 16:27:30"
  beijingTimeShort: string;       // 北京短时间，如 "16:27" 或 "08-18 16:27"
  beijingUtcOffset: string;       // 北京时区偏差，"UTC+8"
  
  // 时差精确计算 (Origin vs Beijing)
  timeDifferenceHours: number;    // 时差小时数，如 -12、-7、0
  timeDifferenceMinutes: number;  // 时差总分钟数，如 -720
  timeDifferenceTag: string;      // 简写标签，如 "-12h 纽约时差"、"-7h 伦敦时差"、"无时差"
  timeDifferenceText: string;     // 详细文字，如 "美东 (纽约) 比北京时间慢 12 小时 (北京时间快 12h)"
  timeDifferenceShort: string;    // 短说明，如 "慢 12 小时" 或 "快 2 小时" 或 "同属东八区"
  
  sourceEnglishName: string;      // 出处英文名，如 "Reuters", "Bloomberg"
  sourceChineseName: string;      // 出处中文名，如 "路透社", "彭博社"
  relativeTime: string;           // 相对时间，如 "3分钟前"
}

export function getTimezoneOffsetMinutes(timeZone: string, epochSec: number): number {
  try {
    const d = new Date(epochSec * 1000);
    const utcStr = d.toLocaleString('en-US', { timeZone: 'UTC' });
    const tzStr = d.toLocaleString('en-US', { timeZone });
    const diffMs = new Date(tzStr).getTime() - new Date(utcStr).getTime();
    return Math.round(diffMs / 60000);
  } catch {
    return 0;
  }
}

export function formatOffsetString(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMin = Math.abs(offsetMinutes);
  const hours = Math.floor(absMin / 60);
  const mins = absMin % 60;
  return `UTC${sign}${hours}${mins > 0 ? `:${mins}` : ''}`;
}

export function formatFullDateTimeInZone(epochSec: number, timeZone: string): string {
  try {
    const d = new Date(epochSec * 1000);
    const formatter = new Intl.DateTimeFormat('zh-CN', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return formatter.format(d).replace(/\//g, '-');
  } catch {
    const d = new Date(epochSec * 1000);
    return d.toISOString().replace('T', ' ').slice(0, 19);
  }
}

export function getRelativeTimeString(epochSec: number): string {
  const diffSec = Math.max(0, Math.floor(Date.now() / 1000 - epochSec));
  if (diffSec < 60) return '刚刚';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分钟前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}小时前`;
  return `${Math.floor(diffSec / 86400)}天前`;
}

export function getNewsTimezoneComparison(item: { timestamp?: number; publishedAt?: string; sourceId?: SourceId }): NewsTimezoneComparison {
  const ts = typeof item.timestamp === 'number' && item.timestamp > 0
    ? item.timestamp
    : Math.floor(Date.now() / 1000);

  const sourceId = (item.sourceId && SOURCE_ORIGIN_TIMEZONES[item.sourceId]) ? item.sourceId : 'wscn';
  const originInfo = SOURCE_ORIGIN_TIMEZONES[sourceId];

  // User Local Timezone
  let userTimeZone = 'UTC';
  try {
    userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
  } catch {
    userTimeZone = 'Asia/Shanghai';
  }

  const userOffsetMinutes = -new Date().getTimezoneOffset();
  const userOffsetHours = Math.floor(Math.abs(userOffsetMinutes) / 60);
  const userOffsetRemainingMinutes = Math.abs(userOffsetMinutes) % 60;
  const userUtcOffset = `UTC${userOffsetMinutes >= 0 ? '+' : '-'}${userOffsetHours}${userOffsetRemainingMinutes > 0 ? `:${userOffsetRemainingMinutes}` : ''}`;

  const d = new Date(ts * 1000);
  const now = new Date();
  const isSameDayLocal = d.toDateString() === now.toDateString();

  const userLocalTime = formatTimeInZone(ts, userTimeZone, !isSameDayLocal);
  const userLocalFull = formatFullDateTimeInZone(ts, userTimeZone);

  // Origin Time
  const originTime = formatFullDateTimeInZone(ts, originInfo.timeZone);
  const originTimeShort = formatTimeInZone(ts, originInfo.timeZone, !isSameDayLocal);

  // Beijing Time
  const beijingTime = formatFullDateTimeInZone(ts, 'Asia/Shanghai');
  const beijingTimeShort = formatTimeInZone(ts, 'Asia/Shanghai', !isSameDayLocal);

  // Source names map
  const sourceNameMap: Record<SourceId, { en: string; cn: string }> = {
    reuters: { en: 'Reuters', cn: '路透社' },
    bloomberg: { en: 'Bloomberg', cn: '彭博社' },
    wsj: { en: 'The Wall Street Journal', cn: '华尔街日报' },
    ft: { en: 'Financial Times', cn: '英国金融时报' },
    cnbc: { en: 'CNBC', cn: '美国消费者新闻与商业频道' },
    wscn: { en: 'Wallstreetcn', cn: '华尔街见闻' },
    caixin: { en: 'Caixin', cn: '财新网' },
  };

  const names = sourceNameMap[sourceId] || { en: sourceId, cn: sourceId };

  // Calculate precise offset and difference between Origin and Beijing
  const originOffsetMin = getTimezoneOffsetMinutes(originInfo.timeZone, ts);
  const beijingOffsetMin = getTimezoneOffsetMinutes('Asia/Shanghai', ts); // 480 (UTC+8)
  const diffMinutes = originOffsetMin - beijingOffsetMin;
  const diffHours = diffMinutes / 60;

  const originUtcOffset = formatOffsetString(originOffsetMin);
  const beijingUtcOffset = 'UTC+8';

  let timeDifferenceTag = '';
  let timeDifferenceText = '';
  let timeDifferenceShort = '';

  if (diffMinutes === 0) {
    timeDifferenceTag = '与北京无时差 (0h)';
    timeDifferenceText = `${originInfo.regionName}与北京同处东八区 (UTC+8)，无时差`;
    timeDifferenceShort = '与北京无时差';
  } else if (diffMinutes < 0) {
    const absHours = Math.abs(diffHours);
    const absHoursDisplay = Number.isInteger(absHours) ? `${absHours}` : absHours.toFixed(1);
    timeDifferenceTag = `慢 ${absHoursDisplay} 小时 (${diffHours > 0 ? '+' : ''}${diffHours}h)`;
    timeDifferenceText = `${originInfo.regionName}比北京时间慢 ${absHoursDisplay} 小时 (北京时间快 ${absHoursDisplay}h)`;
    timeDifferenceShort = `比北京慢 ${absHoursDisplay}h`;
  } else {
    const hoursDisplay = Number.isInteger(diffHours) ? `${diffHours}` : diffHours.toFixed(1);
    timeDifferenceTag = `快 ${hoursDisplay} 小时 (+${hoursDisplay}h)`;
    timeDifferenceText = `${originInfo.regionName}比北京时间快 ${hoursDisplay} 小时 (北京时间慢 ${hoursDisplay}h)`;
    timeDifferenceShort = `比北京快 ${hoursDisplay}h`;
  }

  return {
    timestamp: ts,
    userLocalTime,
    userLocalFull,
    userTimeZone,
    userUtcOffset,
    originRegion: originInfo.regionName,
    originTimeZone: originInfo.timeZone,
    originFlag: originInfo.flag,
    originTime,
    originTimeShort,
    originUtcOffset,
    beijingTime,
    beijingTimeShort,
    beijingUtcOffset,
    timeDifferenceHours: diffHours,
    timeDifferenceMinutes: diffMinutes,
    timeDifferenceTag,
    timeDifferenceText,
    timeDifferenceShort,
    sourceEnglishName: names.en,
    sourceChineseName: names.cn,
    relativeTime: getRelativeTimeString(ts),
  };
}

/**
 * 获取快讯的双时区对照显示：
 * 1. 发布地区本地时间 (如美东/伦敦)
 * 2. 中国标准时间 (北京时间 CST / UTC+8)
 */
export function getDualTimeDisplay(item: { timestamp?: number; publishedAt?: string; sourceId?: SourceId }): {
  chinaTime: string;          // 北京时间，如 "20:30" 或 "08-18 20:30"
  chinaTimeFull: string;      // 完整北京时间，如 "北京 08-18 20:30"
  originTime: string;         // 原产地时间，如 "08:30" 或 "08-18 08:30"
  originLabel: string;        // 原产地标签，如 "美东 08:30"
  originRegion: string;       // 原产地名称，如 "美东 (纽约)"
  isSameAsChina: boolean;     // 原产地是否就是中国时间
} {
  const ts = typeof item.timestamp === 'number' && item.timestamp > 0
    ? item.timestamp
    : Math.floor(Date.now() / 1000);

  const sourceId = (item.sourceId && SOURCE_ORIGIN_TIMEZONES[item.sourceId]) ? item.sourceId : 'wscn';
  const originInfo = SOURCE_ORIGIN_TIMEZONES[sourceId];

  const now = new Date();
  const itemDate = new Date(ts * 1000);
  const isSameDayInChina = itemDate.toDateString() === now.toDateString();

  const chinaTime = formatTimeInZone(ts, 'Asia/Shanghai', !isSameDayInChina);
  const chinaTimeFull = `北京 ${chinaTime}`;

  const isSameAsChina = originInfo.timeZone === 'Asia/Shanghai';
  const originTime = formatTimeInZone(ts, originInfo.timeZone, !isSameDayInChina);
  const originLabel = `${originInfo.regionName} ${originTime}`;

  return {
    chinaTime,
    chinaTimeFull,
    originTime,
    originLabel,
    originRegion: originInfo.regionName,
    isSameAsChina,
  };
}

export function formatLocalTime(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  const now = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `${hh}:${mm}`;
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${hh}:${mm}`;
}

export function formatNewsTime(item: { publishedAt?: string; timestamp?: number; sourceId?: SourceId }): string {
  if (typeof item.timestamp === 'number') {
    const dual = getDualTimeDisplay(item);
    if (dual.isSameAsChina) {
      return `北京 ${dual.chinaTime}`;
    }
    return `北京 ${dual.chinaTime} · ${dual.originLabel}`;
  }
  if (item.publishedAt && typeof item.publishedAt === 'string') {
    return item.publishedAt;
  }
  return formatLocalTime(Math.floor(Date.now() / 1000));
}

/** 服务端 wire 条目 → 前端 NewsItem（字段防御性兜底，绝不补虚构内容） */
export function toNewsItem(raw: any): NewsItem | null {
  if (!raw || !raw.id || !raw.title) return null;
  const sourceId: SourceId = VALID_SOURCE_IDS.includes(raw.sourceId) ? raw.sourceId : 'wscn';
  const publishedTs = typeof raw.publishedTs === 'number' ? raw.publishedTs : Math.floor(Date.now() / 1000);
  const clusterNote = Array.isArray(raw.clusterSources) && raw.clusterSources.length > 0
    ? `\n\n（另有 ${raw.clusterSources.join('、')} 对同一事件的报道）`
    : '';
  return {
    id: raw.id,
    sourceId,
    title: raw.title,
    titleCn: raw.titleCn || raw.title,
    summary: raw.summary || raw.title,
    summaryCn: raw.summaryCn || raw.summary || raw.title,
    content: (raw.content || raw.summary || raw.title) + clusterNote,
    contentCn: (raw.contentCn || raw.content || raw.summary || raw.title) + clusterNote,
    publishedAt: formatLocalTime(publishedTs),
    timestamp: publishedTs,
    urgency: ['flash', 'major', 'regular', 'alert'].includes(raw.urgency) ? raw.urgency : 'regular',
    sentiment: ['bullish', 'bearish', 'neutral'].includes(raw.sentiment) ? raw.sentiment : 'neutral',
    assetClasses: Array.isArray(raw.assetClasses) ? raw.assetClasses : [],
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    isPremium: false,
    url: typeof raw.url === 'string' ? raw.url : '',
    author: raw.feedLabel || raw.author || undefined,
    unlocked: true,
    // 情绪来源如实透传：keyword-rule 初判 ≠ AI 研判 ≠ 信源事实
    aiSentimentAnalysis: raw.sentimentBy
      ? { sentiment: raw.sentiment, explanation: raw.sentimentBy === 'keyword-rule' ? '关键词规则初判' : undefined }
      : undefined,
  };
}

export interface LiveNewsResult {
  items: NewsItem[];
  feedHealth: FeedHealthInfo[];
}

/** 拉取服务端真实聚合快讯池 */
export async function fetchLiveNews(): Promise<LiveNewsResult> {
  const res = await fetch('/api/news/live', { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`news/live HTTP ${res.status}`);
  const json = await res.json();
  const items = (Array.isArray(json.items) ? json.items : [])
    .map(toNewsItem)
    .filter((n: NewsItem | null): n is NewsItem => n !== null);
  return { items, feedHealth: Array.isArray(json.feedHealth) ? json.feedHealth : [] };
}

/**
 * 订阅 SSE 直推。返回取消函数。
 * EventSource 自带断线重连；此处额外做"彻底失败后指数退避重建"。
 */
export function subscribeNewsStream(onItem: (item: NewsItem) => void): () => void {
  let es: EventSource | null = null;
  let closed = false;
  let retryMs = 3000;

  const connect = () => {
    if (closed) return;
    try {
      es = new EventSource('/api/news/stream');
      es.addEventListener('news', (ev: MessageEvent) => {
        retryMs = 3000;
        try {
          const item = toNewsItem(JSON.parse(ev.data));
          if (item) onItem(item);
        } catch {
          // 单条解析失败不影响流
        }
      });
      es.onerror = () => {
        // EventSource 自身会重试；若连接被彻底关闭则退避重建
        if (es && es.readyState === EventSource.CLOSED && !closed) {
          es.close();
          setTimeout(connect, retryMs);
          retryMs = Math.min(retryMs * 2, 60000);
        }
      };
    } catch {
      setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, 60000);
    }
  };

  connect();
  return () => {
    closed = true;
    if (es) es.close();
  };
}
