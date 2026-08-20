import React, { useState } from 'react';
import {
  Star,
  Bookmark,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Trash2,
  Clock,
  ExternalLink,
  ChevronRight,
  Search,
  Filter,
  Share2,
  Copy,
  CheckCircle2,
  Activity,
  Layers,
  Volume2,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { NewsItem, MarketQuote, SourceId, AccountSession } from '../types';
import { SOURCES_CONFIG } from '../data/sources';

interface WatchlistSectionProps {
  news: NewsItem[];
  quotes: MarketQuote[];
  followedNewsIds: string[];
  followedQuoteSymbols: string[];
  onToggleFollowNews: (newsId: string) => void;
  onToggleFollowQuote: (symbol: string) => void;
  onSelectNews: (item: NewsItem) => void;
  sessions: Record<SourceId, AccountSession>;
  onOpenAccountHub: (sourceId?: SourceId) => void;
  onFilterByAsset?: (assetName: string) => void;
}

export const WatchlistSection: React.FC<WatchlistSectionProps> = ({
  news,
  quotes,
  followedNewsIds,
  followedQuoteSymbols,
  onToggleFollowNews,
  onToggleFollowQuote,
  onSelectNews,
  sessions,
  onOpenAccountHub,
  onFilterByAsset,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'news' | 'quotes'>('news');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSentiment, setSelectedSentiment] = useState<string>('all');
  const [copied, setCopied] = useState(false);

  const followedNews = news.filter((n) => followedNewsIds.includes(n.id));
  const followedQuotes = quotes.filter((q) => followedQuoteSymbols.includes(q.symbol));

  // Filtered followed news
  const filteredFollowedNews = followedNews.filter((item) => {
    if (selectedSentiment !== 'all' && item.sentiment !== selectedSentiment) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        item.title.toLowerCase().includes(q) ||
        item.titleCn.toLowerCase().includes(q) ||
        item.summaryCn.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q)) ||
        item.assetClasses.some((a) => a.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  // Calculate sentiment stats for followed news
  const bullishCount = followedNews.filter((n) => n.sentiment === 'bullish').length;
  const bearishCount = followedNews.filter((n) => n.sentiment === 'bearish').length;
  const flashCount = followedNews.filter((n) => n.urgency === 'flash').length;

  const handleExportWatchlist = () => {
    let report = `=== Global FinPulse 我的关注内参 ===\n生成时间: ${new Date().toLocaleString()}\n\n`;
    report += `【自选追踪资产 (${followedQuotes.length} 支)】\n`;
    followedQuotes.forEach((q) => {
      report += `• ${q.nameCn} (${q.symbol}): ${q.price} (${q.changePercent >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%)\n`;
    });
    report += `\n【关注重点情报 (${followedNews.length} 篇)】\n`;
    followedNews.forEach((n, idx) => {
      report += `${idx + 1}. [${SOURCES_CONFIG[n.sourceId]?.nameCn}] ${n.titleCn}\n   要点: ${(n.aiBullets || []).join('; ')}\n   链接: ${n.url}\n\n`;
    });

    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div id="watchlist-main-section" className="space-y-4">
      {/* Top Banner with Stats & Actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-500 border border-amber-200">
              <Star className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>我的自选与个人追踪列表 (My Watchlist)</span>
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  本地安全持久化存储 (LocalStorage)
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                已实时同步您在快讯流与行情看板中星标收藏的资产与要闻，方便一键集中研判与导出。
              </p>
            </div>
          </div>
        </div>

        {/* Stats Pill Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
            <span className="text-slate-500">已追踪快讯:</span>
            <span className="font-bold font-mono text-blue-600">{followedNews.length}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
            <span className="text-slate-500">自选行情标的:</span>
            <span className="font-bold font-mono text-amber-600">{followedQuotes.length}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
            <span className="text-slate-500">利多/利空比:</span>
            <span className="font-bold font-mono text-emerald-600">{bullishCount}</span>
            <span className="text-slate-400">/</span>
            <span className="font-bold font-mono text-red-600">{bearishCount}</span>
          </div>

          <button
            onClick={handleExportWatchlist}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '已复制自选研报' : '一键导出追踪报告'}</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs: News vs Quotes */}
      <div className="flex items-center justify-between gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('news')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'news'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>重点追踪资讯 ({followedNews.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('quotes')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'quotes'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>自选行情标的 ({followedQuotes.length})</span>
          </button>
        </div>

        {activeSubTab === 'news' && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="在已关注资讯中搜索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
              />
            </div>
            <select
              value={selectedSentiment}
              onChange={(e) => setSelectedSentiment(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg px-2 py-1 focus:outline-hidden"
            >
              <option value="all">全部情绪</option>
              <option value="bullish">偏多 (Bullish)</option>
              <option value="bearish">偏空 (Bearish)</option>
              <option value="neutral">中性 (Neutral)</option>
            </select>
          </div>
        )}
      </div>

      {/* Content for Followed Quotes */}
      {activeSubTab === 'quotes' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {followedQuotes.length === 0 ? (
            <div className="col-span-full py-12 text-center bg-white border border-slate-200 rounded-xl p-8 text-slate-400">
              <Star className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium">暂无自选行情资产</p>
              <p className="text-xs text-slate-400 mt-1">
                您可以在行情看板或顶部 Ticker 中点击星标 ★，将感兴趣的外汇、股票、商品加入自选追踪。
              </p>
            </div>
          ) : (
            followedQuotes.map((q) => {
              const isUp = q.change >= 0;
              return (
                <div
                  key={q.symbol}
                  className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 shadow-xs flex flex-col justify-between transition"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 text-sm">{q.name}</span>
                        <span className="text-xs text-slate-500 font-mono">({q.symbol})</span>
                      </div>
                      <button
                        onClick={() => onToggleFollowQuote(q.symbol)}
                        className="text-amber-500 hover:text-slate-400 transition"
                        title="取消自选"
                      >
                        <Star className="w-4 h-4 fill-amber-400" />
                      </button>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="text-lg font-bold font-mono text-slate-900">{q.price.toLocaleString()}</span>
                      <span className={`text-sm font-mono font-bold ${isUp ? 'text-red-600' : 'text-emerald-600'}`}>
                        {isUp ? '+' : ''}{q.changePercent.toFixed(2)}%
                      </span>
                    </div>

                    <div className="mt-2 text-[11px] text-slate-500 flex justify-between font-mono">
                      <span>最高: {q.high}</span>
                      <span>最低: {q.low}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400 font-mono">{q.category}</span>
                    {onFilterByAsset && (
                      <button
                        onClick={() => onFilterByAsset(q.name)}
                        className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5"
                      >
                        <span>关联资讯</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Content for Followed News */}
      {activeSubTab === 'news' && (
        <div className="space-y-3">
          {filteredFollowedNews.length === 0 ? (
            <div className="py-12 text-center bg-white border border-slate-200 rounded-xl p-8 text-slate-400">
              <Bookmark className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium">暂无符合条件的关注资讯</p>
              <p className="text-xs text-slate-400 mt-1">
                点击快讯流中每条新闻右下方的“关注”或星标 ★，即可实时沉淀在此。
              </p>
            </div>
          ) : (
            filteredFollowedNews.map((item) => {
              const src = SOURCES_CONFIG[item.sourceId];
              return (
                <div
                  key={item.id}
                  onClick={() => onSelectNews(item)}
                  className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 shadow-xs transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                        {item.publishedAt}
                      </span>
                      {src && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium border ${src.badgeBg}`}>
                          {src.nameCn}
                        </span>
                      )}
                      {item.sentiment === 'bullish' && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          偏多
                        </span>
                      )}
                      {item.sentiment === 'bearish' && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-red-50 text-red-700 border border-red-200">
                          偏空
                        </span>
                      )}
                      {item.tags.map((tag, idx) => (
                        <span key={idx} className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 hover:text-blue-600 transition">
                      {item.titleCn}
                    </h4>

                    {item.summaryCn && (
                      <p className="text-xs text-slate-600 line-clamp-2">
                        {item.summaryCn}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFollowNews(item.id);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-xs font-medium flex items-center gap-1 transition"
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                      <span>取消关注</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectNews(item);
                      }}
                      className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1 transition shadow-xs"
                    >
                      <span>阅读全文</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
