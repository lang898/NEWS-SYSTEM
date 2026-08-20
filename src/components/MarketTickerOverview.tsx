import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  AlertCircle,
  Star,
  Maximize2,
  BarChart3,
  Ruler,
  Layers,
  ChevronRight,
  Sparkles,
  Search,
  ExternalLink,
} from 'lucide-react';
import { MarketQuote, NewsItem } from '../types';
import { MACRO_CALENDAR_EVENTS } from '../data/quotes';
import { AssetDetailView } from './AssetDetailView';

interface MarketTickerOverviewProps {
  quotes: MarketQuote[];
  news?: NewsItem[];
  onSelectAsset?: (symbol: string) => void;
  onNavigateToDetail?: (symbol: string) => void;
  followedQuoteSymbols?: string[];
  onToggleFollowQuote?: (symbol: string) => void;
}

export const MarketTickerOverview: React.FC<MarketTickerOverviewProps> = ({
  quotes,
  news = [],
  onSelectAsset,
  onNavigateToDetail,
  followedQuoteSymbols = [],
  onToggleFollowQuote,
}) => {
  const [activeCategory, setActiveCategory] = useState<
    'all' | 'watchlist' | 'index' | 'stock' | 'forex' | 'yield' | 'commodity' | 'crypto'
  >('all');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NVDA');
  const [viewMode, setViewMode] = useState<'split' | 'grid' | 'fullDetail'>('split');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredQuotes = quotes.filter((q) => {
    // Category match
    const catMatch =
      activeCategory === 'all'
        ? true
        : activeCategory === 'watchlist'
        ? followedQuoteSymbols.includes(q.symbol)
        : q.category === activeCategory;

    // Search query match
    if (!searchQuery.trim()) return catMatch;
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      q.symbol.toLowerCase().includes(query) ||
      q.name.toLowerCase().includes(query) ||
      (q.nameCn && q.nameCn.toLowerCase().includes(query));

    return catMatch && matchesSearch;
  });

  const handleAssetClick = (symbol: string) => {
    setSelectedSymbol(symbol);
    if (onSelectAsset) {
      onSelectAsset(symbol);
    }
  };

  const renderMiniSparkline = (points: number[], isUp: boolean) => {
    if (!points || points.length < 2) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const width = 80;
    const height = 28;

    const coords = points.map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((p - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const strokeColor = isUp ? '#dc2626' : '#16a34a';

    return (
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={coords.join(' ')}
        />
      </svg>
    );
  };

  return (
    <div id="market-ticker-dashboard-section" className="space-y-4 text-slate-800 animate-fadeIn">
      
      {/* Top Filter & Toolbar Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Category Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {[
            { id: 'all', label: '全部市场标的' },
            { id: 'watchlist', label: `★ 我的自选 (${followedQuoteSymbols.length})` },
            { id: 'stock', label: '异动股票与热门个股' },
            { id: 'index', label: '股票指数 (A股/港股/美股)' },
            { id: 'forex', label: '外汇与汇率 (Forex)' },
            { id: 'commodity', label: '大宗商品 (Commodity)' },
            { id: 'yield', label: '国债收益率 (Yields)' },
            { id: 'crypto', label: '加密货币 (Crypto)' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* View Mode Switcher + Search */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜索标的 / 代码..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none hover:bg-slate-100 transition w-36 sm:w-48"
            />
          </div>

          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-mono">
            <button
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 rounded-lg transition ${
                viewMode === 'split' ? 'bg-white text-blue-600 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="走势图与标的列表联动"
            >
              分栏交互图表
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1 rounded-lg transition ${
                viewMode === 'grid' ? 'bg-white text-blue-600 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="纯网格卡片概览"
            >
              全景网格
            </button>
          </div>
        </div>
      </div>

      {/* Prominent Deep Dive Section (Active when in split mode or fullDetail) */}
      {viewMode === 'split' && (
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <AssetDetailView
            symbol={selectedSymbol}
            quotes={quotes}
            news={news}
            followedSymbols={followedQuoteSymbols}
            onToggleFollowQuote={onToggleFollowQuote}
            onSwitchAsset={(newSym) => setSelectedSymbol(newSym)}
          />
        </div>
      )}

      {/* Quotes Grid Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-xs text-slate-600 uppercase tracking-wider">
            点击任意资产卡片即可实时刷新上方走势图与深度数据 ({filteredQuotes.length} 标的)
          </h3>
          <span className="text-[11px] font-mono text-emerald-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            毫秒级高频行情已连接
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredQuotes.map((q) => {
            const isUp = q.change >= 0;
            const isFollowed = followedQuoteSymbols.includes(q.symbol);
            const isSelected = selectedSymbol === q.symbol;

            return (
              <div
                key={q.symbol}
                onClick={() => handleAssetClick(q.symbol)}
                className={`border rounded-xl p-3.5 shadow-xs transition cursor-pointer flex flex-col justify-between group ${
                  isSelected
                    ? 'bg-blue-50/50 border-blue-500 ring-2 ring-blue-200'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition">
                        {q.nameCn || q.name}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">({q.symbol})</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {onToggleFollowQuote && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFollowQuote(q.symbol);
                          }}
                          className="text-slate-400 hover:text-amber-500 transition p-1"
                          title={isFollowed ? '取消自选' : '加入自选追踪'}
                        >
                          <Star className={`w-3.5 h-3.5 ${isFollowed ? 'fill-amber-400 text-amber-500' : ''}`} />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onNavigateToDetail) {
                            onNavigateToDetail(q.symbol);
                          } else {
                            handleAssetClick(q.symbol);
                          }
                        }}
                        className="text-slate-400 hover:text-blue-600 transition p-1"
                        title="打开独立走势图页面"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-baseline justify-between">
                    <div>
                      <div className="text-lg font-bold font-mono text-slate-900">
                        {typeof q.price === 'number' && q.price >= 1000
                          ? q.price.toLocaleString()
                          : q.price}
                      </div>
                      <div
                        className={`text-xs font-mono font-bold mt-0.5 flex items-center gap-0.5 ${
                          isUp ? 'text-red-600' : 'text-emerald-600'
                        }`}
                      >
                        {isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        <span>
                          {isUp ? '+' : ''}
                          {typeof q.change === 'number' ? q.change.toFixed(2) : q.change} (
                          {isUp ? '+' : ''}
                          {typeof q.changePercent === 'number' ? q.changePercent.toFixed(2) : q.changePercent}%)
                        </span>
                      </div>
                    </div>

                    {/* Sparkline */}
                    <div className="shrink-0">{renderMiniSparkline(q.sparkline, isUp)}</div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>高: {q.high} / 低: {q.low}</span>
                  <span className="text-blue-600 font-semibold group-hover:underline">点击查看走势 →</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Macro Calendar Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900">全球关键宏观财经日历 (Macro Calendar)</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">数据来源: Reuters & Bloomberg 数据流</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {MACRO_CALENDAR_EVENTS.map((evt) => (
            <div key={evt.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-blue-600">{evt.time}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    evt.importance === 3
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {evt.country} · {evt.importance === 3 ? '高影响' : '中影响'}
                </span>
              </div>

              <div className="font-semibold text-xs text-slate-800 line-clamp-2">{evt.event}</div>

              <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-200/80 text-[11px] font-mono text-slate-500">
                <div>
                  <div className="text-[10px] text-slate-400">前值</div>
                  <div className="text-slate-700 font-medium">{evt.previous || '--'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">预测</div>
                  <div className="text-blue-600 font-medium">{evt.forecast || '--'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">公布</div>
                  <div className="text-slate-800 font-bold">{evt.actual || '待公布'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

