import React, { useState } from 'react';
import {
  Search,
  SlidersHorizontal,
  Flame,
  Globe2,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Volume2,
  Bookmark,
  Share2,
  Radio,
  Tag,
  Clock,
  Layers,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Lock,
  Star,
  RefreshCw,
  HelpCircle,
  BrainCircuit,
  Minus,
  Languages,
  BookOpen,
  Building2,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { NewsItem, SourceId, AccountSession, MarketSentiment } from '../types';
import { SOURCES_CONFIG } from '../data/sources';
import {
  formatNewsTime,
  getDualTimeDisplay,
  getNewsTimezoneComparison,
  NewsTimezoneComparison,
} from '../utils/realtimeNewsSync';

interface SentimentDetail {
  sentiment: MarketSentiment;
  score?: number;
  confidence?: number;
  explanation?: string;
  loading?: boolean;
  analyzedBy?: string;
}

interface ItemTranslationState {
  title?: string;
  summary?: string;
  loading?: boolean;
  active?: boolean;
  error?: string;
}

interface NewsFeedStreamProps {
  news: NewsItem[];
  selectedSource: SourceId | 'all';
  onSelectSource: (src: SourceId | 'all') => void;
  sessions: Record<SourceId, AccountSession>;
  onSelectNews: (item: NewsItem) => void;
  onOpenAccountHub: (sourceId?: SourceId) => void;
  followedNewsIds?: string[];
  onToggleFollowNews?: (newsId: string) => void;
}

const getSourceIcon = (sourceId: SourceId, className: string = 'w-3.5 h-3.5') => {
  switch (sourceId) {
    case 'reuters':
      return <Globe2 className={`${className} text-amber-400`} />;
    case 'bloomberg':
      return <TrendingUp className={`${className} text-blue-400`} />;
    case 'ft':
      return <BookOpen className={`${className} text-rose-400`} />;
    case 'wsj':
      return <Building2 className={`${className} text-emerald-400`} />;
    case 'caixin':
      return <ShieldAlert className={`${className} text-red-400`} />;
    case 'wscn':
      return <Zap className={`${className} text-sky-400`} />;
    case 'cnbc':
      return <Radio className={`${className} text-purple-400`} />;
    default:
      return <Globe2 className={`${className} opacity-80`} />;
  }
};

export const NewsFeedStream: React.FC<NewsFeedStreamProps> = ({
  news,
  selectedSource,
  onSelectSource,
  sessions,
  onSelectNews,
  onOpenAccountHub,
  followedNewsIds = [],
  onToggleFollowNews,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('all');
  const [selectedSentiment, setSelectedSentiment] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [languageMode, setLanguageMode] = useState<'zh' | 'bilingual' | 'en'>('zh');
  const [onlyFollowed, setOnlyFollowed] = useState<boolean>(false);
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState<boolean>(false);
  const [sentimentMap, setSentimentMap] = useState<Record<string, SentimentDetail>>({});
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);
  const [hoveredTimeNewsId, setHoveredTimeNewsId] = useState<string | null>(null);

  // Per-item translation state for instant inline translate
  const [translationsMap, setTranslationsMap] = useState<Record<string, ItemTranslationState>>({});

  // Helper to detect if a text contains non-Chinese characters primarily (e.g. English)
  const isEnglishOrForeign = (item: NewsItem): boolean => {
    const text = (item.title || '') + ' ' + (item.summary || '');
    const cjkCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const totalChars = text.replace(/\s+/g, '').length;
    return totalChars > 0 && cjkCount / totalChars < 0.25;
  };

  // Instant Translate Handler for an individual card in the feed
  const handleTranslateItem = async (item: NewsItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const existing = translationsMap[item.id];

    // If already translated and not loading, toggle between translated and original view
    if (existing?.title && existing?.summary) {
      setTranslationsMap((prev) => ({
        ...prev,
        [item.id]: {
          ...prev[item.id],
          active: !prev[item.id].active,
        },
      }));
      return;
    }

    // Set loading state
    setTranslationsMap((prev) => ({
      ...prev,
      [item.id]: {
        ...prev[item.id],
        loading: true,
        error: undefined,
      },
    }));

    try {
      const response = await fetch('/api/gemini/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title || item.titleCn,
          content: item.content || item.summary || item.summaryCn,
          targetLang: 'zh',
        }),
      });

      const data = await response.json();
      if (data.success) {
        setTranslationsMap((prev) => ({
          ...prev,
          [item.id]: {
            title: data.translatedTitle || data.translatedText || item.titleCn || item.title,
            summary: data.translatedContent || data.translatedText || item.summaryCn || item.summary,
            loading: false,
            active: true,
          },
        }));
      } else {
        throw new Error(data.error || '翻译失败');
      }
    } catch (err: any) {
      console.warn('Translate item failed:', err);
      setTranslationsMap((prev) => ({
        ...prev,
        [item.id]: {
          ...prev[item.id],
          loading: false,
          error: '翻译异常，已保留原文',
          title: item.titleCn || item.title,
          summary: item.summaryCn || item.summary,
          active: true,
        },
      }));
    }
  };

  // Trigger Gemini AI sentiment analysis on snippet summary for a specific news item
  const handleAnalyzeSnippetSentiment = async (item: NewsItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    // Set loading state
    setSentimentMap((prev) => ({
      ...prev,
      [item.id]: {
        ...(prev[item.id] || { sentiment: item.sentiment }),
        loading: true,
      },
    }));

    try {
      const src = SOURCES_CONFIG[item.sourceId];
      const response = await fetch('/api/gemini/sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.titleCn || item.title,
          summary: item.summaryCn || item.summary,
          sourceName: src?.nameCn || '权威财经',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSentimentMap((prev) => ({
          ...prev,
          [item.id]: {
            sentiment: (data.sentiment as MarketSentiment) || item.sentiment,
            score: data.score,
            confidence: data.confidence,
            explanation: data.explanation,
            loading: false,
            analyzedBy: data.analyzedBy || 'Gemini 3.7 Flash',
          },
        }));
      } else {
        throw new Error('API request failed');
      }
    } catch (err) {
      console.warn('Gemini sentiment analysis fallback:', err);
      setSentimentMap((prev) => ({
        ...prev,
        [item.id]: {
          sentiment: item.sentiment,
          explanation: item.sentiment === 'bullish' ? '核心数据或流动性催化偏多' : item.sentiment === 'bearish' ? '估值与下行压力扰动偏空' : '宏观供需均衡震荡',
          loading: false,
          analyzedBy: 'Gemini Baseline',
        },
      }));
    }
  };

  // Batch analyze currently visible news items with Gemini AI
  const handleBatchAnalyzeVisible = async () => {
    setIsBatchAnalyzing(true);
    const targetItems = filteredNews.slice(0, 8);
    for (const item of targetItems) {
      await handleAnalyzeSnippetSentiment(item);
    }
    setIsBatchAnalyzing(false);
  };

  // Collect all unique tags
  const allTags = Array.from(new Set(news.flatMap((n) => n.tags || [])));

  // Filter news
  const filteredNews = news.filter((item) => {
    const activeSentiment = sentimentMap[item.id]?.sentiment || item.sentiment;
    if (onlyFollowed && !followedNewsIds.includes(item.id)) return false;
    if (selectedSource !== 'all' && item.sourceId !== selectedSource) return false;
    if (selectedUrgency !== 'all' && item.urgency !== selectedUrgency) return false;
    if (selectedSentiment !== 'all' && activeSentiment !== selectedSentiment) return false;
    if (selectedTag !== 'all' && !item.tags.includes(selectedTag)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q) || item.titleCn.toLowerCase().includes(q);
      const matchSummary = item.summary.toLowerCase().includes(q) || item.summaryCn.toLowerCase().includes(q);
      const matchTag = item.tags.some((t) => t.toLowerCase().includes(q));
      const matchAsset = item.assetClasses.some((a) => a.toLowerCase().includes(q));
      if (!matchTitle && !matchSummary && !matchTag && !matchAsset) return false;
    }
    return true;
  });

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'flash':
        return (
          <span className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-600 text-rose-300 font-mono text-[10px] font-bold flex items-center gap-1 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            🚨 特别突发 (Flash)
          </span>
        );
      case 'major':
        return (
          <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-600 text-amber-300 font-mono text-[10px] font-bold flex items-center gap-1">
            🔴 重大要闻 (Major)
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono text-[10px]">
            🔵 市场动态
          </span>
        );
    }
  };

  /**
   * Dedicated Gemini AI Sentiment Badge placed next to headlines
   */
  const renderHeadlineSentimentBadge = (item: NewsItem) => {
    const analysis = sentimentMap[item.id];
    const sentiment = analysis?.sentiment || item.sentiment;
    const isLoading = analysis?.loading;
    const explanation = analysis?.explanation;

    if (isLoading) {
      return (
        <span
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/70 border border-amber-700/80 text-amber-300 font-mono text-[11px] font-bold animate-pulse align-middle"
          title="Gemini AI 正在研判摘要情绪..."
        >
          <Sparkles className="w-3 h-3 text-amber-400 animate-spin" />
          <span>AI 研判中</span>
        </span>
      );
    }

    if (sentiment === 'bullish') {
      return (
        <span
          onClick={(e) => {
            e.stopPropagation();
            setActiveTooltipId(activeTooltipId === item.id ? null : item.id);
          }}
          className="group/sentiment relative inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-700/90 text-emerald-300 font-mono text-[11px] font-bold tracking-tight shadow-sm hover:shadow-emerald-900/40 transition-all cursor-pointer select-none align-middle"
          title={explanation ? `Gemini AI 摘要研判：${explanation} (点击重测/查看)` : 'Gemini AI 情绪研判：利多 (Bullish) - 点击查看详情'}
        >
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>利多</span>
          <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-900/90 text-emerald-200 border border-emerald-600/50 font-sans flex items-center gap-0.5">
            <Sparkles className="w-2.5 h-2.5 text-emerald-300" />
            AI
          </span>

          {/* Quick interactive trigger icon */}
          <button
            onClick={(e) => handleAnalyzeSnippetSentiment(item, e)}
            className="opacity-0 group-hover/sentiment:opacity-100 ml-0.5 p-0.5 hover:text-emerald-100 transition"
            title="重新触发 Gemini AI 研判摘要"
          >
            <RefreshCw className="w-2.5 h-2.5" />
          </button>
        </span>
      );
    }

    if (sentiment === 'bearish') {
      return (
        <span
          onClick={(e) => {
            e.stopPropagation();
            setActiveTooltipId(activeTooltipId === item.id ? null : item.id);
          }}
          className="group/sentiment relative inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-950/90 hover:bg-rose-900 border border-rose-700/90 text-rose-300 font-mono text-[11px] font-bold tracking-tight shadow-sm hover:shadow-rose-900/40 transition-all cursor-pointer select-none align-middle"
          title={explanation ? `Gemini AI 摘要研判：${explanation} (点击重测/查看)` : 'Gemini AI 情绪研判：承压 (Bearish) - 点击查看详情'}
        >
          <TrendingDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>承压</span>
          <span className="text-[9px] px-1 py-0.2 rounded bg-rose-900/90 text-rose-200 border border-rose-600/50 font-sans flex items-center gap-0.5">
            <Sparkles className="w-2.5 h-2.5 text-rose-300" />
            AI
          </span>

          <button
            onClick={(e) => handleAnalyzeSnippetSentiment(item, e)}
            className="opacity-0 group-hover/sentiment:opacity-100 ml-0.5 p-0.5 hover:text-rose-100 transition"
            title="重新触发 Gemini AI 研判摘要"
          >
            <RefreshCw className="w-2.5 h-2.5" />
          </button>
        </span>
      );
    }

    // Default neutral
    return (
      <span
        onClick={(e) => {
          e.stopPropagation();
          setActiveTooltipId(activeTooltipId === item.id ? null : item.id);
        }}
        className="group/sentiment relative inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800/90 hover:bg-zinc-750 border border-zinc-700 text-zinc-300 font-mono text-[11px] font-bold tracking-tight shadow-sm transition-all cursor-pointer select-none align-middle"
        title={explanation ? `Gemini AI 摘要研判：${explanation} (点击重测/查看)` : 'Gemini AI 情绪研判：中性 (Neutral) - 点击查看详情'}
      >
        <Minus className="w-3 h-3 text-zinc-400 shrink-0" />
        <span>中性</span>
        <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-700 text-zinc-300 border border-zinc-600 font-sans flex items-center gap-0.5">
          <Sparkles className="w-2.5 h-2.5 text-zinc-300" />
          AI
        </span>

        <button
          onClick={(e) => handleAnalyzeSnippetSentiment(item, e)}
          className="opacity-0 group-hover/sentiment:opacity-100 ml-0.5 p-0.5 hover:text-zinc-100 transition"
          title="重新触发 Gemini AI 研判摘要"
        >
          <RefreshCw className="w-2.5 h-2.5" />
        </button>
      </span>
    );
  };

  const handleSpeak = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div id="news-feed-stream-container" className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3.5 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索全球突发新闻、央行决议、股票代码 (如 SPX, 离岸人民币, TSMC)..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300"
              >
                ✕
              </button>
            )}
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs">
            <button
              onClick={() => setLanguageMode('zh')}
              className={`px-2.5 py-1 rounded-lg transition font-medium ${
                languageMode === 'zh' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              中文精译
            </button>
            <button
              onClick={() => setLanguageMode('bilingual')}
              className={`px-2.5 py-1 rounded-lg transition font-medium ${
                languageMode === 'bilingual' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              中英双语
            </button>
            <button
              onClick={() => setLanguageMode('en')}
              className={`px-2.5 py-1 rounded-lg transition font-medium ${
                languageMode === 'en' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Original EN
            </button>
          </div>
        </div>

        {/* Filter Badges Row & Gemini AI Batch Trigger */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Watchlist Toggle */}
            <button
              onClick={() => setOnlyFollowed(!onlyFollowed)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition flex items-center gap-1.5 ${
                onlyFollowed
                  ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow-md shadow-amber-500/20'
                  : 'bg-zinc-950/90 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${onlyFollowed ? 'fill-zinc-950 text-zinc-950' : 'text-amber-400'}`} />
              <span>仅看我的关注 ({followedNewsIds.length})</span>
            </button>

            {/* Urgency */}
            <div className="flex items-center gap-1 bg-zinc-950/80 px-2 py-1 rounded-lg border border-zinc-800">
              <span className="text-[11px] text-zinc-500">时效:</span>
              {['all', 'flash', 'major'].map((u) => (
                <button
                  key={u}
                  onClick={() => setSelectedUrgency(u)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                    selectedUrgency === u ? 'bg-zinc-800 text-amber-300 font-bold' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {u === 'all' ? '全部' : u === 'flash' ? '🚨 突发' : '🔴 重大'}
                </button>
              ))}
            </div>

            {/* Sentiment */}
            <div className="flex items-center gap-1 bg-zinc-950/80 px-2 py-1 rounded-lg border border-zinc-800">
              <span className="text-[11px] text-zinc-500">情绪:</span>
              {['all', 'bullish', 'bearish', 'neutral'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSentiment(s)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                    selectedSentiment === s ? 'bg-zinc-800 text-amber-300 font-bold' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {s === 'all' ? '全部' : s === 'bullish' ? '🟢 利多' : s === 'bearish' ? '🔴 承压' : '⚪ 中性'}
                </button>
              ))}
            </div>

            {/* Quick Tag pills */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              <button
                onClick={() => setSelectedTag('all')}
                className={`px-2 py-0.5 rounded text-[11px] border transition shrink-0 ${
                  selectedTag === 'all'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-semibold'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                全部主题
              </button>
              {allTags.slice(0, 6).map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTag(selectedTag === t ? 'all' : t)}
                  className={`px-2 py-0.5 rounded text-[11px] border transition shrink-0 ${
                    selectedTag === t
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-semibold'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  #{t}
                </button>
              ))}
            </div>
          </div>

          {/* Gemini AI Batch Sentiment Trigger Button */}
          <button
            onClick={handleBatchAnalyzeVisible}
            disabled={isBatchAnalyzing}
            className="px-3 py-1 rounded-lg bg-linear-to-r from-amber-500/20 to-amber-600/30 hover:from-amber-500/30 hover:to-amber-600/40 border border-amber-500/50 text-amber-300 text-[11px] font-bold flex items-center gap-1.5 transition shadow-sm hover:shadow-amber-500/20 disabled:opacity-50 shrink-0"
            title="利用 Gemini AI 自动解析并研判当前流中摘要的利多/承压/中性情绪"
          >
            <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${isBatchAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isBatchAnalyzing ? 'Gemini 批量研判中...' : '✨ Gemini 摘要情绪全研判'}</span>
          </button>
        </div>
      </div>

      {/* Stream List */}
      <div className="space-y-3">
        {filteredNews.length === 0 ? (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-400">
            <Radio className="w-8 h-8 text-zinc-600 mx-auto mb-2 animate-pulse" />
            <p className="text-sm font-medium">{news.length === 0 ? '正在连接实时快讯源（RSS/API 聚合中）…' : '未找到符合当前筛选条件的财经资讯'}</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedUrgency('all');
                setSelectedSentiment('all');
                setSelectedTag('all');
                onSelectSource('all');
              }}
              className="mt-3 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold"
            >
              重置全部过滤条件
            </button>
          </div>
        ) : (
          filteredNews.map((item) => {
            const src = SOURCES_CONFIG[item.sourceId];
            const session = sessions[item.sourceId];
            const isUnlocked = !item.isPremium || session?.isConnected;
            const sentimentData = sentimentMap[item.id];
            const isTooltipOpen = activeTooltipId === item.id;
            const itemTrans = translationsMap[item.id];
            const hasActiveTranslation = Boolean(itemTrans?.active && itemTrans?.title);

            // Dual-time & Timezone comparison calculation
            const dualTime = getDualTimeDisplay(item);
            const tzComparison = getNewsTimezoneComparison(item);

            // Foreign Language Check
            const foreignItem = isEnglishOrForeign(item);

            let displayTitle = languageMode === 'en' ? item.title : item.titleCn;
            let displaySummary = languageMode === 'en' ? item.summary : item.summaryCn;

            if (hasActiveTranslation) {
              displayTitle = itemTrans.title || displayTitle;
              displaySummary = itemTrans.summary || displaySummary;
            }

            return (
              <div
                key={item.id}
                id={`news-card-${item.id}`}
                onClick={() => onSelectNews(item)}
                className="bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800/80 hover:border-amber-500/40 rounded-2xl p-4 sm:p-5 transition shadow-lg hover:shadow-2xl cursor-pointer group relative"
              >
                {/* Source Badge, Origin/China Dual Time, Urgency */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Media badge / 出处 */}
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSource(item.sourceId);
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold border flex items-center gap-1.5 transition ${src.badgeBg}`}
                      title={`出处媒体：${src.nameCn} (${src.name}) - 点击筛选`}
                    >
                      <Globe2 className="w-3.5 h-3.5 opacity-80" />
                      <span>{src.nameCn}</span>
                      {item.author && item.author !== src.nameCn && (
                        <span className="text-[10px] opacity-80 font-normal">· {item.author}</span>
                      )}
                      {item.sources && item.sources.length > 1 ? (
                        <span className="text-[10px] px-1 py-0.2 rounded bg-zinc-800 text-amber-300 font-mono">
                          +{item.sources.length}家联合
                        </span>
                      ) : (
                        <span className="text-[10px] opacity-75 font-mono">({src.ratingText})</span>
                      )}
                    </span>

                    {item.sourceTier === 'tier1' && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-600/80 text-emerald-300 font-mono text-[10px] font-bold">
                        Tier 1 权威一手
                      </span>
                    )}

                    {/* Urgency */}
                    {getUrgencyBadge(item.urgency)}
                  </div>

                  {/* Right Header: Dual Time (China + Origin Reference Time) & Action Buttons */}
                  <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
                    {/* Dual Time Pill */}
                    <div
                      className="flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-800/90 rounded-lg px-2.5 py-1 text-[11px]"
                      title={`发布时间：北京时间 ${dualTime.chinaTime} ${!dualTime.isSameAsChina ? `| 原产地参考 (${dualTime.originRegion}) ${dualTime.originTime}` : ''}`}
                    >
                      <Clock className="w-3.5 h-3.5 text-amber-400/90" />
                      <span className="text-zinc-200 font-semibold">{dualTime.chinaTimeFull}</span>
                      {!dualTime.isSameAsChina && (
                        <>
                          <span className="text-zinc-600">·</span>
                          <span className="text-amber-300/80">{dualTime.originLabel}</span>
                        </>
                      )}
                    </div>

                    {/* Dedicated Translate Button on the Card Header */}
                    <button
                      id={`btn-translate-top-${item.id}`}
                      onClick={(e) => handleTranslateItem(item, e)}
                      disabled={itemTrans?.loading}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition cursor-pointer select-none ${
                        hasActiveTranslation
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 font-bold hover:bg-amber-500/30 ring-1 ring-amber-500/30'
                          : 'bg-zinc-950 hover:bg-zinc-800 border-zinc-800 text-zinc-300 hover:text-amber-300 hover:border-zinc-700'
                      }`}
                      title={hasActiveTranslation ? '已转换为中文，点击切换回原文' : '点击调用 Gemini AI 将标题与正文实时翻译为专业中文'}
                    >
                      <Languages className={`w-3.5 h-3.5 ${itemTrans?.loading ? 'animate-spin text-amber-400' : 'text-amber-400'}`} />
                      <span>
                        {itemTrans?.loading ? '翻译中...' : hasActiveTranslation ? '已译中文' : '翻译'}
                      </span>
                    </button>

                    {/* Unlock / MarsConnect status pill */}
                    {item.sourceId === 'caixin' && item.isPremium ? (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenAccountHub('caixin');
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono border flex items-center gap-1 ${
                          session?.isConnected
                            ? 'bg-red-950/80 border-red-700 text-red-300'
                            : 'bg-zinc-950 border-zinc-700 text-zinc-400 hover:text-red-300'
                        }`}
                      >
                        <ShieldCheck className="w-3 h-3 text-red-400" />
                        {session?.isConnected ? 'MarsConnect 已解锁' : 'MarsConnect VIP'}
                      </span>
                    ) : item.isPremium ? (
                      <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-zinc-300 text-[10px] font-mono flex items-center gap-1">
                        {session?.isConnected ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            已授权
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3 text-amber-400" />
                            订阅解锁
                          </>
                        )}
                      </span>
                    ) : null}

                    {/* Follow/Star Button */}
                    {onToggleFollowNews && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFollowNews(item.id);
                        }}
                        className={`p-1.5 rounded-lg border transition ${
                          followedNewsIds.includes(item.id)
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500 hover:text-zinc-950'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-amber-300 hover:border-zinc-700'
                        }`}
                        title={followedNewsIds.includes(item.id) ? '已加入我的关注，点击取消' : '加入我的关注清单'}
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${
                            followedNewsIds.includes(item.id) ? 'fill-amber-400 text-amber-400' : ''
                          }`}
                        />
                      </button>
                    )}
                  </div>
                </div>

                {/* Headline with Integrated Gemini Sentiment Badge */}
                <div className="flex flex-wrap items-baseline gap-2 mb-1.5">
                  {renderHeadlineSentimentBadge(item)}
                  <h3 className="text-base sm:text-lg font-bold text-zinc-100 group-hover:text-amber-300 transition leading-snug flex-1">
                    {displayTitle}
                  </h3>
                </div>

                {/* Active Translation Indicator Banner */}
                {hasActiveTranslation && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mb-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 font-medium">
                    <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Gemini AI 实时中文金融翻译</span>
                    <span className="text-zinc-600">·</span>
                    <button
                      type="button"
                      onClick={(e) => handleTranslateItem(item, e)}
                      className="text-zinc-400 hover:text-zinc-100 underline text-[10px] cursor-pointer"
                    >
                      切换查看原文
                    </button>
                  </div>
                )}

                {/* Optional Expandable Tooltip / Explanation Popover for Gemini Sentiment */}
                {isTooltipOpen && sentimentData?.explanation && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mb-2.5 p-2.5 rounded-xl bg-zinc-950 border border-amber-500/40 text-xs text-amber-200/90 flex items-start gap-2 animate-fadeIn shadow-lg"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-0.5">
                      <div className="font-bold text-amber-300 flex items-center justify-between">
                        <span>Gemini AI 摘要研判逻辑 ({sentimentData.analyzedBy || 'Gemini 3.7 Flash'})</span>
                        {sentimentData.confidence && (
                          <span className="font-mono text-[10px] text-zinc-400">置信度 {(sentimentData.confidence * 100).toFixed(0)}%</span>
                        )}
                      </div>
                      <p className="text-zinc-300 leading-relaxed">{sentimentData.explanation}</p>
                    </div>
                  </div>
                )}

                {/* Bilingual Sub-title if bilingual mode */}
                {languageMode === 'bilingual' && item.title !== item.titleCn && (
                  <p className="text-xs text-zinc-400 font-serif italic mt-1">{item.title}</p>
                )}

                {/* Summary */}
                <p className="text-xs sm:text-sm text-zinc-300 mt-2 line-clamp-2 leading-relaxed">
                  {displaySummary}
                </p>

                {/* AI 3-Bullet Quick Highlights */}
                {item.aiBullets && item.aiBullets.length > 0 && (
                  <div className="mt-3 bg-zinc-950/70 rounded-xl p-3 border border-zinc-800/80">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 mb-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Gemini AI 核心研判要点：</span>
                    </div>
                    <ul className="space-y-1">
                      {item.aiBullets.map((bullet, idx) => (
                        <li key={idx} className="text-xs text-zinc-300 flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80 mt-1.5 shrink-0"></span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Bottom Metadata Bar: Publishing Source & User Local Publishing Time with Multi-Timezone Hover Popover */}
                <div className="mt-3.5 pt-3 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                  {/* Left: Publishing Source & Local Time Badge */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Publishing Source Tag */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSource(item.sourceId);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition cursor-pointer hover:opacity-90 shadow-xs ${src.badgeBg}`}
                      title={`发布来源：${tzComparison.sourceEnglishName} (${tzComparison.sourceChineseName}) - 点击筛选`}
                    >
                      {getSourceIcon(item.sourceId, 'w-3.5 h-3.5 shrink-0')}
                      <span className="text-[11px] opacity-75">来源:</span>
                      <span className="font-bold">{tzComparison.sourceEnglishName}</span>
                      <span className="text-[10px] opacity-80 font-mono">({tzComparison.sourceChineseName})</span>
                    </div>

                    {/* Publishing Time in User Local Timezone with Interactive Hover Popover */}
                    <div
                      className="relative inline-block"
                      onMouseEnter={() => setHoveredTimeNewsId(item.id)}
                      onMouseLeave={() => setHoveredTimeNewsId((prev) => (prev === item.id ? null : prev))}
                      onClick={(e) => {
                        e.stopPropagation();
                        setHoveredTimeNewsId((prev) => (prev === item.id ? null : item.id));
                      }}
                    >
                      <div
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono border flex items-center gap-1.5 cursor-pointer transition select-none ${
                          hoveredTimeNewsId === item.id
                            ? 'bg-amber-950/80 border-amber-500/80 text-amber-200 ring-1 ring-amber-500/50 shadow-md'
                            : 'bg-zinc-950 hover:bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-amber-300 hover:border-zinc-700'
                        }`}
                        title="悬停或点击查看【原始发布地时间】与【北京时间】完整对照"
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-[11px] text-zinc-400 font-sans">发布时间:</span>
                        <span className="font-semibold text-zinc-100">{tzComparison.userLocalTime}</span>
                        <span className="text-[10px] text-zinc-400 font-sans">({tzComparison.userUtcOffset})</span>
                        <span className="text-zinc-600 text-[10px]">·</span>
                        <span className="text-amber-400/90 text-[10px] font-sans">{tzComparison.relativeTime}</span>
                      </div>

                      {/* Multi-Timezone Hover Popover Box with Exact Time Difference Calculation */}
                      {hoveredTimeNewsId === item.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute bottom-full left-0 mb-2.5 z-50 w-80 sm:w-96 p-3.5 rounded-xl bg-zinc-950/98 backdrop-blur-md border border-amber-500/70 shadow-2xl shadow-black text-zinc-200 text-xs animate-fadeIn space-y-2.5 pointer-events-auto ring-1 ring-amber-500/30"
                        >
                          {/* Tooltip Header */}
                          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                            <div className="flex items-center gap-1.5 font-bold text-amber-300">
                              <Globe2 className="w-4 h-4 text-amber-400" />
                              <span>时区与时差智能校准</span>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono font-semibold">
                              {tzComparison.timeDifferenceTag}
                            </span>
                          </div>

                          {/* Time Difference Summary Alert */}
                          <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-500/30 flex items-start gap-2">
                            <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                              <div className="text-[11px] font-bold text-amber-200 flex items-center gap-1.5">
                                <span>与北京时间时差：</span>
                                <span className="text-amber-300 font-mono">{tzComparison.timeDifferenceShort}</span>
                              </div>
                              <div className="text-[11px] text-zinc-300 font-sans leading-tight">
                                {tzComparison.timeDifferenceText}
                              </div>
                            </div>
                          </div>

                          {/* Time Comparison Matrix */}
                          <div className="space-y-2 font-mono">
                            {/* Origin Publishing Time */}
                            <div className="p-2 rounded-lg bg-zinc-900/90 border border-zinc-800/90 space-y-0.5">
                              <div className="flex items-center justify-between text-[11px] text-zinc-400 font-sans">
                                <span className="flex items-center gap-1">
                                  <span>{tzComparison.originFlag}</span>
                                  <span className="font-semibold text-zinc-200">
                                    媒体发源地时间 ({tzComparison.originRegion})
                                  </span>
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-amber-300 font-mono font-medium">
                                  {tzComparison.originUtcOffset}
                                </span>
                              </div>
                              <div className="text-xs font-bold text-amber-300 flex items-center justify-between">
                                <span>{tzComparison.originTime}</span>
                                <span className="text-[10px] text-zinc-500 font-sans font-normal">
                                  {tzComparison.originTimeZone.split('/')[1] || tzComparison.originTimeZone}
                                </span>
                              </div>
                            </div>

                            {/* China Beijing Time */}
                            <div className="p-2 rounded-lg bg-zinc-900/90 border border-emerald-500/30 space-y-0.5">
                              <div className="flex items-center justify-between text-[11px] text-zinc-400 font-sans">
                                <span className="flex items-center gap-1">
                                  <span>🇨🇳</span>
                                  <span className="font-semibold text-zinc-100">中国北京时间 (CST)</span>
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-mono font-medium">
                                  {tzComparison.beijingUtcOffset}
                                </span>
                              </div>
                              <div className="text-xs font-bold text-emerald-300 flex items-center justify-between">
                                <span>{tzComparison.beijingTime}</span>
                                <span className="text-[10px] text-emerald-400/80 font-sans font-medium">
                                  Asia/Shanghai
                                </span>
                              </div>
                            </div>

                            {/* User Local Device Time */}
                            <div className="p-2 rounded-lg bg-zinc-900/70 border border-zinc-800 space-y-0.5">
                              <div className="flex items-center justify-between text-[11px] text-zinc-400 font-sans">
                                <span className="flex items-center gap-1">
                                  <span>💻</span>
                                  <span className="font-semibold text-zinc-300">您当前设备本地时间</span>
                                </span>
                                <span className="text-[10px] text-zinc-400 font-bold font-mono">
                                  {tzComparison.userUtcOffset}
                                </span>
                              </div>
                              <div className="text-xs font-bold text-zinc-200 flex items-center justify-between">
                                <span>{tzComparison.userLocalFull}</span>
                                <span className="text-[10px] text-zinc-400 font-sans font-normal">
                                  {tzComparison.userTimeZone}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Footer of Tooltip */}
                          <div className="pt-1.5 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-400 font-sans">
                            <span className="truncate">
                              出处: {tzComparison.sourceEnglishName} ({tzComparison.sourceChineseName})
                            </span>
                            <span className="text-emerald-400 flex items-center gap-1 font-medium shrink-0">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>权威时钟同步</span>
                            </span>
                          </div>

                          {/* Caret arrow */}
                          <div className="absolute top-full left-6 -mt-px w-2.5 h-2.5 bg-zinc-950 border-r border-b border-amber-500/70 rotate-45"></div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Actions: Translate, Read Aloud, Details */}
                  <div className="flex items-center gap-2">
                    {/* Dedicated Translate Button in footer */}
                    <button
                      id={`btn-translate-bottom-${item.id}`}
                      onClick={(e) => handleTranslateItem(item, e)}
                      disabled={itemTrans?.loading}
                      className={`text-xs flex items-center gap-1.5 font-medium px-2.5 py-1 rounded-lg border transition cursor-pointer select-none ${
                        hasActiveTranslation
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30 ring-1 ring-amber-500/30'
                          : 'bg-zinc-950 hover:bg-zinc-800 text-zinc-300 hover:text-amber-300 border-zinc-800 hover:border-zinc-700'
                      }`}
                      title={hasActiveTranslation ? '已转换为中文，点击切换回原文' : '点击调用 Gemini AI 将标题与正文实时翻译为专业中文'}
                    >
                      <Languages className={`w-3.5 h-3.5 ${itemTrans?.loading ? 'animate-spin text-amber-400' : 'text-amber-400'}`} />
                      <span>{itemTrans?.loading ? '翻译中...' : hasActiveTranslation ? '已译中文' : '翻译'}</span>
                    </button>

                    {/* Read Aloud Button */}
                    <button
                      onClick={(e) => handleSpeak(displayTitle + '。' + displaySummary, e)}
                      className="p-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition"
                      title="语音朗读新闻"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>

                    {/* View Details */}
                    <div className="flex items-center gap-1 text-xs text-amber-400 font-bold group-hover:translate-x-0.5 transition">
                      <span>展开全文与宏观影响</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>

                {/* Penetrated Assets & Tags Mini Bar */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-[11px] text-zinc-500">穿透标的:</span>
                  {item.assetClasses.map((asset) => (
                    <span
                      key={asset}
                      className="px-2 py-0.5 rounded bg-zinc-800/90 text-amber-300 font-mono text-[11px] font-medium border border-zinc-700"
                    >
                      {asset}
                    </span>
                  ))}
                  {item.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded bg-zinc-950 text-zinc-400 text-[10px]">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

