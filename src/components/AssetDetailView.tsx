import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Star,
  Activity,
  BarChart3,
  Calendar,
  ArrowLeft,
  Share2,
  Sparkles,
  Sliders,
  Ruler,
  Layers,
  Maximize2,
  Minimize2,
  Volume2,
  RefreshCw,
  Info,
  ChevronRight,
  Zap,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  Search,
  ExternalLink,
  Target,
  LineChart,
  Grid,
  ShieldCheck,
  Award,
} from 'lucide-react';
import { MarketQuote, NewsItem } from '../types';
import { SOURCES_CONFIG } from '../data/sources';
import { soundManager } from '../utils/audio';
import { FinancialTradingChart } from './FinancialTradingChart';
import { RechartsCandleChart } from './RechartsCandleChart';
import { ChartNewsMarker } from '../utils/chartDataGenerator';
import { AssetCorrelationHeatmap } from './AssetCorrelationHeatmap';

interface AssetDetailViewProps {
  symbol: string;
  quotes: MarketQuote[];
  news: NewsItem[];
  followedSymbols?: string[];
  onToggleFollowQuote?: (symbol: string) => void;
  onSelectNews?: (item: NewsItem) => void;
  onBack?: () => void;
  onSwitchAsset?: (newSymbol: string) => void;
  onRefreshQuotes?: () => void;
}

export const AssetDetailView: React.FC<AssetDetailViewProps> = ({
  symbol,
  quotes,
  news,
  followedSymbols = [],
  onToggleFollowQuote,
  onSelectNews,
  onBack,
  onSwitchAsset,
  onRefreshQuotes,
}) => {
  const [currentSymbol, setCurrentSymbol] = useState<string>(symbol);
  const [chartEngine, setChartEngine] = useState<'recharts-candles' | 'tradingview'>('recharts-candles');
  const [activeSideTab, setActiveSideTab] = useState<'news' | 'peers' | 'metrics' | 'ai' | 'correlation'>('news');
  const [tickerSearch, setTickerSearch] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Sync internal symbol if prop changes
  useEffect(() => {
    setCurrentSymbol(symbol);
  }, [symbol]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  // Find or synthesize quote
  const currentQuote: MarketQuote = useMemo(() => {
    const found = quotes.find(
      (q) =>
        q.symbol.toUpperCase() === currentSymbol.toUpperCase() ||
        q.name.toUpperCase().includes(currentSymbol.toUpperCase()) ||
        (q.nameCn && q.nameCn.includes(currentSymbol))
    );
    if (found) return found;

    return {
      symbol: currentSymbol,
      name: currentSymbol,
      nameCn: currentSymbol,
      price: 185.5,
      change: 3.25,
      changePercent: 1.78,
      category: 'stock',
      updateTime: '刚刚',
      sparkline: [180, 181, 182, 181.5, 183, 184.2, 185.5],
      high: 187.2,
      low: 179.8,
      amplitude: '4.1%',
      turnover: '$1.42B',
    };
  }, [quotes, currentSymbol]);

  const isFollowed = followedSymbols.includes(currentQuote.symbol);
  const isUp = currentQuote.change >= 0;

  const formatPrice = (val?: number) => {
    if (val === undefined || isNaN(val)) return '--';
    if (val >= 1000) return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (val >= 10) return val.toFixed(2);
    return val.toFixed(4);
  };

  // Correlated News matching this asset or asset class
  const correlatedNews = useMemo(() => {
    const sym = currentQuote.symbol.toLowerCase();
    const name = (currentQuote.name || '').toLowerCase();
    const nameCn = (currentQuote.nameCn || '').toLowerCase();

    // Direct matches by ticker or full name
    const directMatches = news.filter((item) => {
      const inTitle = (item.titleCn || '').toLowerCase() + (item.title || '').toLowerCase();
      const inContent = (item.contentCn || '').toLowerCase() + (item.content || '').toLowerCase();
      const inTags = item.tags.join(' ').toLowerCase();
      const inAssets = item.assetClasses.join(' ').toLowerCase();

      return (
        inTitle.includes(sym) ||
        inTitle.includes(name) ||
        inTitle.includes(nameCn) ||
        inTags.includes(sym) ||
        inTags.includes(name) ||
        inTags.includes(nameCn) ||
        inAssets.includes(sym) ||
        inAssets.includes(name) ||
        inAssets.includes(nameCn) ||
        inContent.includes(sym)
      );
    });

    if (directMatches.length >= 3) {
      return directMatches.slice(0, 10);
    }

    // Macro & Sector fallback matches (e.g. tech/stocks for NVDA, forex for USD/CNH, etc.)
    const sectorKeywords: Record<string, string[]> = {
      stock: ['美股', '科技', '半导体', '纳指', '纳斯达克', '标普', '芯片', '成长股', 'a股', '港股'],
      index: ['美股', '纳指', '标普', '恒指', '沪深', '指数', '股市', '宏观'],
      forex: ['外汇', '汇率', '央行', '美元', '人民币', '日元', '欧元', 'dxy', 'cnh'],
      yield: ['债市', '国债', '收益率', '美债', '央行', '利率', '降息', '加息'],
      commodity: ['商品', '黄金', '原油', '铜', '大宗商品', '白银', '能源'],
      crypto: ['加密', '比特币', '以太坊', 'btc', 'eth', '区块链', 'web3'],
    };

    const targetKeywords = sectorKeywords[currentQuote.category] || ['宏观', '美股', '全球市场'];

    const sectorMatches = news.filter((item) => {
      if (directMatches.some((m) => m.id === item.id)) return false;
      const combined = [
        item.titleCn,
        item.title,
        ...item.tags,
        ...item.assetClasses,
      ]
        .join(' ')
        .toLowerCase();
      return targetKeywords.some((kw) => combined.includes(kw.toLowerCase()));
    });

    return [...directMatches, ...sectorMatches].slice(0, 10);
  }, [news, currentQuote]);

  // Peer & Correlated Assets
  const peerAssets = useMemo(() => {
    if (currentQuote.category === 'crypto') {
      return quotes.filter((q) => q.category === 'crypto' || q.symbol === 'SPX' || q.symbol === 'US10Y');
    }
    if (currentQuote.category === 'forex' || currentQuote.symbol.includes('USD') || currentQuote.symbol.includes('CNH')) {
      return quotes.filter((q) => q.category === 'forex' || q.symbol === 'CN10Y' || q.symbol === 'US10Y' || q.symbol === 'XAU/USD');
    }
    if (currentQuote.category === 'commodity' || currentQuote.symbol.includes('XAU')) {
      return quotes.filter((q) => q.category === 'commodity' || q.symbol === 'USD/CNH' || q.symbol === 'US10Y');
    }
    // Stock peers
    return quotes.filter((q) => q.category === 'stock' || q.category === 'index').slice(0, 7);
  }, [quotes, currentQuote]);

  const handleSelectNewsMarker = (marker: ChartNewsMarker) => {
    // Find matching news or synthesize
    const matched = news.find((n) => n.id === marker.id || (n.titleCn || n.title).includes(marker.title.slice(0, 8)));
    if (matched && onSelectNews) {
      onSelectNews(matched);
    } else if (onSelectNews) {
      onSelectNews({
        id: marker.id,
        sourceId: (marker.source.toLowerCase().includes('bloomberg') ? 'bloomberg' : marker.source.toLowerCase().includes('reuters') ? 'reuters' : marker.source.toLowerCase().includes('ft') ? 'ft' : 'wscn') as any,
        title: marker.title,
        titleCn: marker.title,
        summary: `【${marker.source} 专题研报】针对 ${currentQuote.nameCn || currentQuote.symbol} 的深度事件研判及机构策略跟踪。`,
        summaryCn: `【${marker.source} 专题研报】针对 ${currentQuote.nameCn || currentQuote.symbol} 的深度事件研判及机构策略跟踪。`,
        content: `【${marker.source} 专题研报】针对 ${currentQuote.nameCn || currentQuote.symbol} 的深度事件研判及机构策略跟踪。`,
        contentCn: `【${marker.source} 专题研报】针对 ${currentQuote.nameCn || currentQuote.symbol} 的深度事件研判及机构策略跟踪。`,
        publishedAt: '今日盘中',
        url: 'https://wallstreetcn.com',
        tags: [currentQuote.symbol, '深度分析', marker.source],
        assetClasses: [currentQuote.category],
        sentiment: marker.impact === 'bullish' ? 'bullish' : marker.impact === 'bearish' ? 'bearish' : 'neutral',
        urgency: 'regular',
        author: `${marker.source} 宏观量化组`,
        readCount: 12500,
        unlocked: true,
      });
    }
  };

  return (
    <div className="space-y-4 pb-12 text-slate-800 select-none">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs font-medium flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Header Navigation Bar */}
      <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        {/* Left: Back + Asset Identity + Watchlist */}
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              id="btn-back-to-markets"
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>返回行情中心</span>
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center font-mono font-black text-sm">
              {currentQuote.symbol.slice(0, 3)}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
                  <span>{currentQuote.nameCn || currentQuote.name}</span>
                  <span className="font-mono text-sm text-slate-400">({currentQuote.symbol})</span>
                </h1>

                <button
                  id="btn-toggle-favorite-quote"
                  onClick={() => {
                    onToggleFollowQuote && onToggleFollowQuote(currentQuote.symbol);
                    showToast(isFollowed ? '已取消自选' : '已加入我的自选关注');
                  }}
                  className="p-1 rounded text-slate-400 hover:text-amber-400 transition"
                  title={isFollowed ? '取消关注' : '加入自选'}
                >
                  <Star className={`w-4 h-4 ${isFollowed ? 'fill-amber-400 text-amber-400' : ''}`} />
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  毫秒级高频直连
                </span>
                <span>·</span>
                <span>分类: {currentQuote.category.toUpperCase()}</span>
                <span>·</span>
                <span>更新: {currentQuote.updateTime || '实时'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center/Right: Big Price HUD + Quick Switcher */}
        <div className="flex items-center gap-5">
          {/* Quick Switch Dropdown */}
          <div className="relative">
            <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                id="input-asset-search"
                type="text"
                placeholder="搜索并切换标的 (如 NVDA, BTC...)"
                value={tickerSearch}
                onChange={(e) => setTickerSearch(e.target.value)}
                className="bg-transparent text-white outline-none w-44 text-xs"
              />
            </div>

            {/* Auto-suggest dropdown if searching */}
            {tickerSearch && (
              <div className="absolute left-0 top-full mt-1.5 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1 z-50 max-h-56 overflow-y-auto">
                {quotes
                  .filter(
                    (q) =>
                      q.symbol.toLowerCase().includes(tickerSearch.toLowerCase()) ||
                      (q.nameCn && q.nameCn.toLowerCase().includes(tickerSearch.toLowerCase()))
                  )
                  .map((q) => (
                    <button
                      key={q.symbol}
                      onClick={() => {
                        setCurrentSymbol(q.symbol);
                        onSwitchAsset && onSwitchAsset(q.symbol);
                        setTickerSearch('');
                      }}
                      className="w-full text-left p-2 rounded-lg hover:bg-slate-800 text-xs flex items-center justify-between text-slate-200"
                    >
                      <div>
                        <span className="font-bold text-white mr-1.5">{q.symbol}</span>
                        <span className="text-slate-400 text-[11px]">{q.nameCn || q.name}</span>
                      </div>
                      <span className="font-mono text-slate-300">${formatPrice(q.price)}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Big Live Price */}
          <div className="text-right">
            <div className="text-2xl sm:text-3xl font-mono font-black text-white">
              {formatPrice(currentQuote.price)}
            </div>
            <div
              className={`text-xs font-mono font-bold flex items-center justify-end gap-1 ${
                isUp ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>
                {isUp ? '+' : ''}
                {typeof currentQuote.change === 'number' ? currentQuote.change.toFixed(2) : currentQuote.change} (
                {isUp ? '+' : ''}
                {currentQuote.changePercent.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Primary Pro Chart Area (8 cols) + Right Multi-Tab Intelligence Hub (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Full-Featured Pro Chart & Candlestick Area */}
        <div className="lg:col-span-8 space-y-4">
          {/* Chart Engine Switcher Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-1.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <button
                id="btn-switch-recharts-candles"
                onClick={() => setChartEngine('recharts-candles')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                  chartEngine === 'recharts-candles'
                    ? 'bg-blue-600 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Recharts 宏观烛台 (Candlestick + MA)</span>
              </button>

              <button
                id="btn-switch-tradingview"
                onClick={() => setChartEngine('tradingview')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                  chartEngine === 'tradingview'
                    ? 'bg-blue-600 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Lightweight 逐笔分时引擎</span>
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-400 pr-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Sparkline 实时映射</span>
            </div>
          </div>

          {/* Render Active Chart Engine */}
          {chartEngine === 'recharts-candles' ? (
            <RechartsCandleChart
              symbol={currentQuote.symbol}
              name={currentQuote.nameCn || currentQuote.name}
              quote={currentQuote}
              sparkline={currentQuote.sparkline}
              basePrice={currentQuote.price}
              changePercent={currentQuote.changePercent}
              height={440}
              onRefresh={onRefreshQuotes}
            />
          ) : (
            <FinancialTradingChart
              symbol={currentQuote.symbol}
              name={currentQuote.nameCn || currentQuote.name}
              basePrice={currentQuote.price}
              changePercent={currentQuote.changePercent}
              height={440}
              initialTimeframe="1D"
              showControls={true}
              externalTheme="dark"
              onSelectNewsMarker={handleSelectNewsMarker}
              onRefresh={onRefreshQuotes}
            />
          )}

          {/* Technical Diagnostics & Key Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <div className="text-[11px] text-slate-400 font-sans">开盘价 / 昨收价</div>
              <div className="font-bold text-white text-sm mt-0.5">
                ${formatPrice(currentQuote.openPrice || currentQuote.price * 0.995)} / ${formatPrice(currentQuote.prevClose || currentQuote.price * 0.99)}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <div className="text-[11px] text-slate-400 font-sans">日内最高 / 最低</div>
              <div className="font-bold text-white text-sm mt-0.5">
                <span className="text-emerald-400">${formatPrice(currentQuote.high || currentQuote.price * 1.02)}</span> /{' '}
                <span className="text-rose-400">${formatPrice(currentQuote.low || currentQuote.price * 0.98)}</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <div className="text-[11px] text-slate-400 font-sans">52周波动区间</div>
              <div className="font-bold text-white text-sm mt-0.5">
                ${formatPrice(currentQuote.yearLow || currentQuote.price * 0.72)} ~ ${formatPrice(currentQuote.yearHigh || currentQuote.price * 1.35)}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <div className="text-[11px] text-slate-400 font-sans">总成交额 / 换手率</div>
              <div className="font-bold text-white text-sm mt-0.5">{currentQuote.turnover || '$4.82B (2.4%)'}</div>
            </div>
          </div>
        </div>

        {/* Right Column: Multi-Tab Intelligence Hub (Correlated News, Peer Movers, Metrics, AI Summary) */}
        <div className="lg:col-span-4 space-y-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between min-h-[560px]">
          <div>
            {/* Hub Selector Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold mb-3">
              <button
                id="tab-correlated-news"
                onClick={() => setActiveSideTab('news')}
                className={`flex-1 py-1.5 rounded-lg transition text-center ${
                  activeSideTab === 'news' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                快讯 ({correlatedNews.length})
              </button>
              <button
                id="tab-peers-movers"
                onClick={() => setActiveSideTab('peers')}
                className={`flex-1 py-1.5 rounded-lg transition text-center ${
                  activeSideTab === 'peers' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                联动标的
              </button>
              <button
                id="tab-quant-diagnosis"
                onClick={() => setActiveSideTab('metrics')}
                className={`flex-1 py-1.5 rounded-lg transition text-center ${
                  activeSideTab === 'metrics' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                量化诊断
              </button>
              <button
                id="tab-correlation-matrix"
                onClick={() => setActiveSideTab('correlation')}
                className={`flex-1 py-1.5 rounded-lg transition text-center ${
                  activeSideTab === 'correlation' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                相关热力
              </button>
              <button
                id="tab-ai-macro"
                onClick={() => setActiveSideTab('ai')}
                className={`flex-1 py-1.5 rounded-lg transition text-center ${
                  activeSideTab === 'ai' ? 'bg-purple-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                AI归因
              </button>
            </div>

            {/* Tab 1: Correlated Real-Time News Stream */}
            {activeSideTab === 'news' && (
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {correlatedNews.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    <Info className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                    <p>暂无直接关联快讯，正在持续监测全球信源中</p>
                  </div>
                ) : (
                  correlatedNews.map((item) => {
                    const srcConfig = SOURCES_CONFIG[item.sourceId];
                    return (
                      <div
                        key={item.id}
                        onClick={() => onSelectNews && onSelectNews(item)}
                        className="p-3 rounded-xl bg-slate-50 hover:bg-blue-50/50 border border-slate-200/80 hover:border-blue-300 transition cursor-pointer group shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded">
                              {srcConfig?.nameCn || item.sourceId}
                            </span>
                            {item.urgency === 'flash' && (
                              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                                突发
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">{item.publishedAt}</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition line-clamp-2 leading-relaxed mb-1">
                          {item.titleCn || item.title}
                        </h4>
                        {(item.summaryCn || item.summary) && (
                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-normal">
                            {item.summaryCn || item.summary}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Tab 2: Peer Movers */}
            {activeSideTab === 'peers' && (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                <div className="text-xs text-slate-500 font-medium px-1 mb-2">同板块 / 宏观高度相关标的实时走势</div>
                {peerAssets.map((p) => {
                  const pIsUp = p.change >= 0;
                  return (
                    <div
                      key={p.symbol}
                      onClick={() => {
                        setCurrentSymbol(p.symbol);
                        onSwitchAsset && onSwitchAsset(p.symbol);
                      }}
                      className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                        p.symbol === currentQuote.symbol
                          ? 'bg-blue-50/80 border-blue-300'
                          : 'bg-slate-50/60 hover:bg-slate-100 border-slate-100'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          <span>{p.symbol}</span>
                          <span className="text-[11px] text-slate-500 font-normal">{p.nameCn || p.name}</span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-600">${formatPrice(p.price)}</div>
                      </div>

                      <div
                        className={`text-xs font-mono font-bold px-2 py-1 rounded flex items-center gap-0.5 ${
                          pIsUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                        }`}
                      >
                        {pIsUp ? '+' : ''}
                        {p.changePercent.toFixed(2)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tab 3: Quantitative Metrics */}
            {activeSideTab === 'metrics' && (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-blue-500" />
                    <span>多空动能评分</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>技术面趋势:</span>
                    <span className="font-bold text-emerald-600">强烈看多 (Strong Bullish)</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full w-[78%]"></div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-purple-500" />
                    <span>阶段支撑阻力区间</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>第一阻力位 (R1):</span>
                    <span className="font-mono font-bold text-rose-600">${formatPrice(currentQuote.price * 1.03)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>第一支撑位 (S1):</span>
                    <span className="font-mono font-bold text-emerald-600">${formatPrice(currentQuote.price * 0.97)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Correlation Quick View */}
            {activeSideTab === 'correlation' && (
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1 text-xs">
                <div className="p-3 bg-slate-900 text-white rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-400">大类资产宏观联动 (实时)</span>
                    <span className="text-[10px] font-mono text-slate-400">Pearson r</span>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { name: '现货黄金 (XAU)', sym: 'XAU/USD', r: currentQuote.symbol.includes('JPY') ? -0.68 : -0.78, desc: '反向避险' },
                      { name: '十年期美债 (US10Y)', sym: 'US10Y', r: currentQuote.symbol.includes('JPY') ? 0.88 : -0.35, desc: '利差驱动' },
                      { name: '标普500 (SPX)', sym: 'SPX', r: currentQuote.symbol.includes('JPY') ? 0.45 : 0.68, desc: '风险偏好' },
                      { name: '美元指数 (DXY)', sym: 'DXY', r: currentQuote.symbol.includes('JPY') ? 0.82 : -0.52, desc: '美元流动性' },
                    ].map((item) => (
                      <div
                        key={item.sym}
                        onClick={() => {
                          setCurrentSymbol(item.sym);
                          onSwitchAsset && onSwitchAsset(item.sym);
                        }}
                        className="p-2 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 flex items-center justify-between transition cursor-pointer"
                      >
                        <div>
                          <div className="font-semibold text-slate-200">{item.name}</div>
                          <div className="text-[10px] text-slate-400">{item.desc}</div>
                        </div>
                        <span
                          className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
                            item.r >= 0.3
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : item.r <= -0.3
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {item.r >= 0 ? `+${item.r.toFixed(2)}` : item.r.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-slate-400 pt-1">
                    * 下方全景热力图提供完整矩阵与资金流向研判
                  </div>
                </div>
              </div>
            )}

            {/* Tab 5: AI Macro Briefing */}
            {activeSideTab === 'ai' && (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 text-xs leading-relaxed">
                <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 space-y-2">
                  <div className="font-bold text-purple-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span>Gemini 宏观流动性与技术面共振内参</span>
                  </div>
                  <p className="text-purple-800">
                    综合彭博社、路透社及最新资金流向监测，{currentQuote.nameCn || currentQuote.symbol}{' '}
                    当前处于资金净流入上升通道。布林带上轨扩张，MA均线呈多头排列，短期需关注宏观通胀数据与美联储降息预期扰动。
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Dedicated Macro Capital Flow & Cross-Asset Correlation Heatmap Matrix */}
      <AssetCorrelationHeatmap
        currentQuote={currentQuote}
        allQuotes={quotes}
        onSelectAsset={(newSym) => {
          setCurrentSymbol(newSym);
          if (onSwitchAsset) onSwitchAsset(newSym);
        }}
      />
    </div>
  );
};
