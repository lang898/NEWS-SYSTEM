import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Star,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BarChart2,
  Activity,
  ArrowUpRight,
  Check,
  Share2,
  X
} from 'lucide-react';
import { MarketQuote } from '../types';
import { soundManager } from '../utils/audio';
import { FinancialTradingChart } from './FinancialTradingChart';

interface KeyAssetsOverviewCardProps {
  quotes: MarketQuote[];
  followedQuoteSymbols?: string[];
  onToggleFollowQuote?: (symbol: string) => void;
  onNavigateToFullMarkets?: () => void;
}

type TimeframeType = '1D' | '5D' | '1M';

export const KeyAssetsOverviewCard: React.FC<KeyAssetsOverviewCardProps> = ({
  quotes,
  followedQuoteSymbols = [],
  onToggleFollowQuote,
  onNavigateToFullMarkets,
}) => {
  // Default to null (collapsed) so it doesn't occupy excessive vertical space on load
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeType>('1D');
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  // Priority assets to display in the streamlined bar
  const prioritySymbols = ['SPX', 'HSTECH', 'USD/CNH', 'CSI300', 'XAU/USD', 'US10Y', 'NDX', 'BTC/USD'];

  const curatedKeyAssets = useMemo(() => {
    const keyQuotes: MarketQuote[] = [];
    prioritySymbols.forEach((sym) => {
      const found = quotes.find((q) => q.symbol === sym);
      if (found) keyQuotes.push(found);
    });
    return keyQuotes;
  }, [quotes]);

  const activeQuote = useMemo(() => {
    if (!expandedSymbol) return null;
    return quotes.find((q) => q.symbol === expandedSymbol) || null;
  }, [quotes, expandedSymbol]);

  const handleCardClick = (symbol: string) => {
    soundManager.playNewsPing('normal');
    if (expandedSymbol === symbol) {
      setExpandedSymbol(null);
    } else {
      setExpandedSymbol(symbol);
      setHoveredPointIndex(null);
    }
  };

  // Render ultra-compact mini sparkline
  const renderMiniSparkline = (sparkline: number[], isUp: boolean) => {
    if (!sparkline || sparkline.length < 2) return null;
    const min = Math.min(...sparkline);
    const max = Math.max(...sparkline);
    const range = max - min || 1;
    const width = 56;
    const height = 18;
    const points = sparkline
      .map((val, idx) => {
        const x = (idx / (sparkline.length - 1)) * width;
        const y = height - ((val - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
      })
      .join(' ');

    const strokeColor = isUp ? '#dc2626' : '#16a34a';

    return (
      <svg width={width} height={height} className="overflow-visible shrink-0">
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  };

  // Build chart points for expanded detailed view
  const currentChartData = useMemo(() => {
    if (!activeQuote) return [];
    if (selectedTimeframe === '5D' && activeQuote.fiveDaySeries) {
      return activeQuote.fiveDaySeries;
    }
    if (selectedTimeframe === '1M' && activeQuote.oneMonthSeries) {
      return activeQuote.oneMonthSeries;
    }
    if (activeQuote.intradaySeries && activeQuote.intradaySeries.length > 0) {
      return activeQuote.intradaySeries;
    }
    return activeQuote.sparkline.map((val, idx) => ({
      time: `时点 ${idx + 1}`,
      price: val,
    }));
  }, [activeQuote, selectedTimeframe]);

  return (
    <div id="key-assets-overview-panel" className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-xs space-y-2.5">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 bg-slate-900 text-white px-3.5 py-1.5 rounded-lg shadow-lg text-xs font-medium flex items-center gap-1.5 animate-bounce">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header bar: Compact title + Action */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-blue-50 text-blue-600 border border-blue-100">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">
              今日重点资产盘面
            </h2>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              实时聚合
            </span>
            <span className="text-[11px] text-slate-400 hidden md:inline">
              (点击卡片快速展开/收起分时走势)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToFullMarkets && (
            <button
              onClick={onNavigateToFullMarkets}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5 hover:underline"
            >
              <span>行情中心</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Visual Compact Cards Grid (Single-row responsive dense layout) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {curatedKeyAssets.map((q) => {
          const isUp = q.change >= 0;
          const isSelected = expandedSymbol === q.symbol;
          const isFollowed = followedQuoteSymbols.includes(q.symbol);

          let marketTag = '美股';
          if (q.symbol === 'HSTECH' || q.symbol === 'HSI') marketTag = '港股';
          else if (q.symbol === 'USD/CNH') marketTag = '离岸';
          else if (q.symbol === 'CSI300') marketTag = 'A股';
          else if (q.symbol === 'XAU/USD') marketTag = '黄金';
          else if (q.symbol === 'US10Y') marketTag = '美债';
          else if (q.symbol === 'BTC/USD') marketTag = '加密';

          return (
            <div
              key={q.symbol}
              onClick={() => handleCardClick(q.symbol)}
              className={`px-2.5 py-2 rounded-lg border transition cursor-pointer flex flex-col justify-between select-none relative group ${
                isSelected
                  ? 'bg-blue-50/80 border-blue-500 shadow-xs ring-1 ring-blue-400'
                  : isFollowed
                  ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                  : 'bg-slate-50/80 border-slate-200/80 hover:bg-white hover:border-blue-300 hover:shadow-xs'
              }`}
            >
              {/* Top row: Tag + Name + Star */}
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-slate-200/70 text-slate-600 shrink-0">
                    {marketTag}
                  </span>
                  <span className="text-xs font-semibold text-slate-800 truncate" title={q.nameCn}>
                    {q.nameCn.replace(/（.*）|\(.*\)/, '')}
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onToggleFollowQuote) onToggleFollowQuote(q.symbol);
                  }}
                  title={isFollowed ? '取消关注' : '关注该资产'}
                  className="p-0.5 text-slate-300 hover:text-amber-500 transition shrink-0"
                >
                  <Star className={`w-3 h-3 ${isFollowed ? 'fill-amber-400 text-amber-500' : ''}`} />
                </button>
              </div>

              {/* Bottom row: Price + Change % + Mini Sparkline */}
              <div className="mt-1.5 flex items-center justify-between gap-1">
                <div>
                  <div className="text-xs sm:text-[13px] font-bold font-mono text-slate-900 leading-tight">
                    {q.price > 100 ? q.price.toLocaleString() : q.price.toFixed(4)}
                  </div>
                  <div className={`text-[10px] font-mono font-bold flex items-center gap-0.5 leading-none mt-0.5 ${
                    isUp ? 'text-red-600' : 'text-emerald-600'
                  }`}>
                    {isUp ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                    <span>{isUp ? '+' : ''}{q.changePercent.toFixed(2)}%</span>
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-end">
                  {renderMiniSparkline(q.sparkline, isUp)}
                  <span className={`text-[9px] font-medium mt-0.5 ${isSelected ? 'text-blue-600 font-bold' : 'text-slate-400 group-hover:text-blue-600'}`}>
                    {isSelected ? '收起 ▲' : '走势 ▼'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded Streamlined Trend Chart */}
      {activeQuote && (
        <div className="p-3 sm:p-4 rounded-xl bg-slate-900 text-white border border-slate-800 shadow-md relative overflow-hidden transition-all space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-400/20">
                <BarChart2 className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-white">
                  {activeQuote.nameCn}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  ({activeQuote.symbol})
                </span>
                <span className={`px-1.5 py-0.2 rounded font-mono font-bold text-xs ${
                  activeQuote.change >= 0
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}>
                  {activeQuote.price.toLocaleString()} ({activeQuote.change >= 0 ? '+' : ''}{activeQuote.changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(`【${activeQuote.nameCn}行情】最新: ${activeQuote.price} (涨跌: ${activeQuote.changePercent}%)`);
                    showToast('已复制资产快报');
                  }
                }}
                className="p-1 rounded bg-white/5 hover:bg-white/15 text-slate-300 transition"
                title="复制行情"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setExpandedSymbol(null)}
                className="p-1 rounded bg-white/5 hover:bg-white/15 text-slate-300 transition"
                title="收起图表"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* TradingView Financial Trading Chart Component */}
          <FinancialTradingChart
            symbol={activeQuote.symbol}
            name={activeQuote.nameCn}
            basePrice={activeQuote.price}
            changePercent={activeQuote.changePercent}
            height={260}
            initialTimeframe="1D"
            showControls={true}
            externalTheme="dark"
          />

          {/* Compact 1-line stats & driver */}
          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Sparkles className="w-3 h-3 text-blue-400 shrink-0" />
              <span className="text-slate-400">驱动归因:</span>
              <span className="text-slate-200 font-medium line-clamp-1">
                {activeQuote.driverSummary || '宏观流动性与产业基本面共振'}
              </span>
            </div>

            <div className="flex items-center gap-3 font-mono text-slate-400 text-[10px]">
              <span>开盘: <strong className="text-slate-200">{activeQuote.openPrice || activeQuote.price}</strong></span>
              <span>最高: <strong className="text-red-400">{activeQuote.high}</strong></span>
              <span>最低: <strong className="text-emerald-400">{activeQuote.low}</strong></span>
              <span>振幅: <strong className="text-slate-200">{activeQuote.amplitude || '1.2%'}</strong></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
