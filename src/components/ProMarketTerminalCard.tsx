import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Star,
  Activity,
  BarChart3,
  Maximize2,
  Minimize2,
  Layers,
  Sparkles,
  ArrowUpRight,
  Info,
  Sliders,
  DollarSign,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Move,
  RefreshCw,
  Plus,
  Minus
} from 'lucide-react';
import { MarketQuote } from '../types';
import { soundManager } from '../utils/audio';
import { FinancialTradingChart } from './FinancialTradingChart';

export interface MoverItem {
  ticker: string;
  name: string;
  price: number;
  changePercent: number;
  volume?: string;
  category: 'crypto' | 'us' | 'cn' | 'forex' | 'commodity';
}

interface ProMarketTerminalCardProps {
  id?: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  quotes: MarketQuote[];
  defaultSymbol?: string;
  isWatchlistMode?: boolean;
  followedSymbols?: string[];
  onToggleFollow?: (symbol: string) => void;
  onNavigateToFullMarkets?: () => void;
  onOpenAssetDetail?: (symbol: string) => void;
  // Drag & Resize Props
  isFullWidth?: boolean;
  onToggleFullWidth?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

type TimeframeOption = '24H' | '5D' | '1M' | '6M' | 'YTD' | '1Y' | '5Y' | 'ALL';
type ChartStyleOption = 'advanced' | 'line' | 'candles';

export type MarketCategoryTab =
  | 'overview'
  | 'forex'
  | 'commodity'
  | 'yield'
  | 'stock'
  | 'crypto'
  | 'movers'
  | 'watchlist';

export const ProMarketTerminalCard: React.FC<ProMarketTerminalCardProps> = ({
  id,
  title,
  subtitle = '实时聚合',
  icon,
  quotes,
  defaultSymbol = 'BTC/USD',
  isWatchlistMode = false,
  followedSymbols = [],
  onToggleFollow,
  onNavigateToFullMarkets,
  onOpenAssetDetail,
  isFullWidth = false,
  onToggleFullWidth,
  draggable = true,
  onDragStart,
  onDragOver,
  onDrop,
}) => {
  // Active selected quote symbol in this terminal
  const [selectedSymbol, setSelectedSymbol] = useState<string>(() => {
    if (isWatchlistMode && followedSymbols.length > 0) {
      return followedSymbols[0];
    }
    return defaultSymbol;
  });

  const [timeframe, setTimeframe] = useState<TimeframeOption>('24H');
  const [chartStyle, setChartStyle] = useState<ChartStyleOption>('advanced');
  
  // Category tabs state: overview, forex, commodity, yield, stock, crypto, movers, watchlist
  const [activeCategory, setActiveCategory] = useState<MarketCategoryTab>(() => {
    return isWatchlistMode ? 'watchlist' : 'overview';
  });

  const [activeMoverTab, setActiveMoverTab] = useState<'gainers' | 'losers' | 'active'>('gainers');

  // Card Resizing State
  const [customChartHeight, setCustomChartHeight] = useState<number>(160);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; price: number; time: string } | null>(null);

  // Top Movers Curated Lists with comprehensive high-volume asset coverage
  const topGainers: MoverItem[] = useMemo(() => [
    { ticker: 'HTFL', name: 'HeartFlow 医疗智能', price: 42.08, changePercent: 36.50, volume: '$124M', category: 'us' },
    { ticker: 'AAOI', name: '应用光电科技', price: 150.28, changePercent: 18.90, volume: '$89M', category: 'us' },
    { ticker: 'ROOT', name: 'Root 车险科技', price: 178.09, changePercent: 13.97, volume: '$45M', category: 'us' },
    { ticker: 'RDDT', name: 'Reddit 社交科技', price: 136.17, changePercent: 12.60, volume: '$310M', category: 'us' },
    { ticker: 'WING', name: 'Wingstop 餐饮', price: 126.12, changePercent: 12.22, volume: '$78M', category: 'us' },
    { ticker: 'MXL', name: 'MaxLinear 迈凌', price: 84.84, changePercent: 8.18, volume: '$62M', category: 'us' },
    { ticker: 'PLTR', name: 'Palantir 大数据AI', price: 168.45, changePercent: 7.65, volume: '$890M', category: 'us' },
    { ticker: 'SMCI', name: '超微电脑服务器', price: 92.30, changePercent: 6.84, volume: '$450M', category: 'us' },
    { ticker: 'TSM', name: '台积电 TSMC', price: 218.60, changePercent: 5.42, volume: '$1.8B', category: 'us' },
    { ticker: 'BABA', name: '阿里巴巴 港美股', price: 118.50, changePercent: 4.86, volume: '$620M', category: 'cn' },
    { ticker: 'COIN', name: 'Coinbase 数字资产', price: 284.10, changePercent: 4.35, volume: '$580M', category: 'crypto' },
    { ticker: 'AMD', name: '超威半导体 AMD', price: 194.20, changePercent: 3.92, volume: '$1.1B', category: 'us' },
  ], []);

  const topLosers: MoverItem[] = useMemo(() => [
    { ticker: 'BLSH', name: 'Bullish 加密金融', price: 24.39, changePercent: -11.24, volume: '$95M', category: 'us' },
    { ticker: 'DUOL', name: '多邻国 Duolingo', price: 132.83, changePercent: -11.27, volume: '$180M', category: 'us' },
    { ticker: 'OPAD', name: 'Offerpad 房产', price: 9.24, changePercent: -9.80, volume: '$22M', category: 'us' },
    { ticker: 'UCTT', name: 'Ultra Clean 洁净', price: 84.93, changePercent: -8.60, volume: '$41M', category: 'us' },
    { ticker: 'XE', name: 'X-Energy 核电', price: 20.98, changePercent: -7.73, volume: '$34M', category: 'us' },
    { ticker: 'ARM', name: '安谋架构半导体', price: 135.20, changePercent: -5.48, volume: '$420M', category: 'us' },
    { ticker: 'INTC', name: '英特尔 Intel', price: 102.80, changePercent: -4.16, volume: '$2.1B', category: 'us' },
    { ticker: 'QCOM', name: '高通芯片 Qualcomm', price: 168.90, changePercent: -3.85, volume: '$630M', category: 'us' },
    { ticker: 'NIO', name: '蔚来汽车 NIO', price: 4.88, changePercent: -3.72, volume: '$150M', category: 'cn' },
    { ticker: 'SPCX', name: '商业航天核心', price: 140.00, changePercent: -3.20, volume: '$890M', category: 'us' },
  ], []);

  const mostActive: MoverItem[] = useMemo(() => [
    { ticker: 'NVDA', name: '英伟达 NVIDIA', price: 225.54, changePercent: 1.01, volume: '$8.9B', category: 'us' },
    { ticker: 'BTC/USD', name: '比特币现货 Bitcoin', price: 63546.00, changePercent: 2.14, volume: '$28.4B', category: 'crypto' },
    { ticker: 'TSLA', name: '特斯拉 Tesla', price: 248.80, changePercent: 2.35, volume: '$4.2B', category: 'us' },
    { ticker: 'AAPL', name: '苹果 Apple', price: 232.10, changePercent: 0.45, volume: '$3.6B', category: 'us' },
    { ticker: 'NU', name: 'Nu Holdings 银行', price: 15.23, changePercent: 1.30, volume: '$1.4B', category: 'us' },
    { ticker: 'MSFT', name: '微软 Microsoft', price: 448.20, changePercent: 0.62, volume: '$2.8B', category: 'us' },
    { ticker: 'ETH/USD', name: '以太坊 Ethereum', price: 3420.50, changePercent: 1.88, volume: '$14.2B', category: 'crypto' },
    { ticker: 'AMZN', name: '亚马逊 Amazon', price: 198.40, changePercent: 1.15, volume: '$2.3B', category: 'us' },
    { ticker: 'SPX', name: '标普500指数 S&P', price: 5864.20, changePercent: 0.72, volume: '$42.1B', category: 'us' },
    { ticker: 'ONDS', name: 'Ondas 无人机', price: 9.24, changePercent: 0.33, volume: '$580M', category: 'us' },
  ], []);

  // Format Helper for Numbers
  const formatPrice = (val?: number | string) => {
    if (val === undefined || val === null) return '--';
    if (typeof val === 'string') return val;
    if (val >= 1000) return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (val >= 10) return val.toFixed(2);
    if (val >= 1) return val.toFixed(4);
    return val.toFixed(4);
  };

  const formatChange = (val?: number) => {
    if (val === undefined || val === null) return '--';
    if (Math.abs(val) >= 100) return val.toFixed(2);
    if (Math.abs(val) >= 1) return val.toFixed(2);
    return val.toFixed(4);
  };

  // OTC ticker code format helper (e.g., EUR/USD -> EURUSD.OTC, XAU/USD -> XAUUSD.OTC)
  const getDisplayTicker = (sym: string) => {
    const s = sym.toUpperCase();
    if (s === 'DXY') return 'DXY.OTC';
    if (s === 'EUR/USD') return 'EURUSD.OTC';
    if (s === 'USD/JPY') return 'USDJPY.OTC';
    if (s === 'USD/CNH') return 'USDCNH.OTC';
    if (s === 'GBP/USD') return 'GBPUSD.OTC';
    if (s === 'AUD/USD') return 'AUDUSD.OTC';
    if (s === 'USD/HKD') return 'USDHKD.OTC';
    if (s === 'XAU/USD') return 'XAUUSD.OTC';
    if (s === 'XAG/USD') return 'XAGUSD.OTC';
    if (s === 'WTI') return 'USCL.OTC';
    if (s === 'BRENT') return 'UKOIL.OTC';
    if (s === 'COPPER') return 'COPPER.LME';
    if (s === 'NATGAS') return 'NATGAS.NYMEX';
    if (s === 'US10Y') return 'US10Y.BOND';
    if (s === 'US02Y') return 'US02Y.BOND';
    if (s === 'US30Y') return 'US30Y.BOND';
    if (s === 'US05Y') return 'US05Y.BOND';
    if (s === 'CN10Y') return 'CN10Y.BOND';
    if (s === 'SOFR') return 'SOFR.RATE';
    if (s === 'SPX') return 'SPX.INDEX';
    if (s === 'HSTECH') return 'HSTECH.HK';
    if (s === 'CSI300') return '000300.SH';
    if (s === 'HSI') return 'HSI.HK';
    if (s === 'N225') return 'N225.JP';
    return sym;
  };

  // Find or dynamically synthesize a rich MarketQuote object for ANY selected symbol
  const currentQuote: MarketQuote = useMemo(() => {
    // 1. Direct match in provided quotes list
    const found = quotes.find(
      (q) =>
        q.symbol.toUpperCase() === selectedSymbol.toUpperCase() ||
        q.symbol.toUpperCase().includes(selectedSymbol.toUpperCase()) ||
        selectedSymbol.toUpperCase().includes(q.symbol.toUpperCase())
    );
    if (found) return found;

    // 2. Check if it's one of the mover items
    const allMovers = [...topGainers, ...topLosers, ...mostActive];
    const mover = allMovers.find((m) => m.ticker.toUpperCase() === selectedSymbol.toUpperCase());
    if (mover) {
      const isMoverUp = mover.changePercent >= 0;
      const basePrice = mover.price;
      const changeAmount = Number((basePrice * (mover.changePercent / 100)).toFixed(2));
      const openPrice = Number((basePrice - changeAmount).toFixed(2));
      const high = Number((Math.max(basePrice, openPrice) * 1.02).toFixed(2));
      const low = Number((Math.min(basePrice, openPrice) * 0.98).toFixed(2));

      // Generate realistic 9-point intraday curve
      const intraday = [
        { time: '09:30', price: openPrice, volume: 1200 },
        { time: '10:15', price: Number((openPrice + changeAmount * 0.25).toFixed(2)), volume: 1800 },
        { time: '11:00', price: Number((openPrice + changeAmount * 0.45).toFixed(2)), volume: 1400 },
        { time: '11:30', price: Number((openPrice + changeAmount * 0.35).toFixed(2)), volume: 1100 },
        { time: '13:00', price: Number((openPrice + changeAmount * 0.65).toFixed(2)), volume: 1900 },
        { time: '14:00', price: Number((openPrice + changeAmount * 0.85).toFixed(2)), volume: 2200 },
        { time: '15:00', price: Number(high), volume: 2800 },
        { time: '15:30', price: Number((basePrice * 1.005).toFixed(2)), volume: 3100 },
        { time: '16:00', price: basePrice, volume: 4200 },
      ];

      return {
        symbol: mover.ticker,
        name: mover.name,
        nameCn: mover.name,
        category: 'stock',
        price: mover.price,
        change: changeAmount,
        changePercent: mover.changePercent,
        high: high,
        low: low,
        openPrice: openPrice,
        prevClose: openPrice,
        amplitude: `${Math.abs(mover.changePercent * 1.15).toFixed(2)}%`,
        turnover: mover.volume || '$85.0M',
        driverSummary: `${mover.name} 盘中交投活跃，量能放大`,
        yearHigh: Number((basePrice * 1.35).toFixed(2)),
        yearLow: Number((basePrice * 0.55).toFixed(2)),
        sparkline: intraday.map((d) => d.price),
        intradaySeries: intraday,
        fiveDaySeries: [
          { time: '08-11', price: Number((openPrice * 0.94).toFixed(2)) },
          { time: '08-12', price: Number((openPrice * 0.96).toFixed(2)) },
          { time: '08-13', price: Number((openPrice * 0.98).toFixed(2)) },
          { time: '08-14', price: openPrice },
          { time: '08-17', price: basePrice },
        ],
        oneMonthSeries: [
          { time: '07-18', price: Number((openPrice * 0.85).toFixed(2)) },
          { time: '07-25', price: Number((openPrice * 0.90).toFixed(2)) },
          { time: '08-01', price: Number((openPrice * 0.93).toFixed(2)) },
          { time: '08-08', price: openPrice },
          { time: '08-17', price: basePrice },
        ],
        unit: 'USD',
        updateTime: '实时',
      };
    }

    // 3. Fallback to first available quote
    return quotes[0];
  }, [quotes, selectedSymbol, topGainers, topLosers, mostActive]);

  // Handler to smoothly switch asset when user clicks ANY item
  const handleSelectAsset = (sym: string) => {
    setSelectedSymbol(sym);
    soundManager.playNewsPing('normal');
  };

  // Series based on timeframe
  const activeSeries = useMemo(() => {
    if (!currentQuote) return [];
    if (timeframe === '5D' && currentQuote.fiveDaySeries && currentQuote.fiveDaySeries.length > 0) {
      return currentQuote.fiveDaySeries;
    }
    if (timeframe === '1M' && currentQuote.oneMonthSeries && currentQuote.oneMonthSeries.length > 0) {
      return currentQuote.oneMonthSeries;
    }
    if (currentQuote.intradaySeries && currentQuote.intradaySeries.length > 0) {
      return currentQuote.intradaySeries;
    }
    // Generate fallback series from sparkline aligned to current time
    const now = new Date();
    const len = currentQuote.sparkline.length;
    return currentQuote.sparkline.map((val, idx) => {
      const minutesAgo = (len - 1 - idx) * 30;
      const pointDate = new Date(now.getTime() - minutesAgo * 60 * 1000);
      const hStr = String(pointDate.getHours()).padStart(2, '0');
      const mStr = String(pointDate.getMinutes()).padStart(2, '0');
      return {
        time: `${hStr}:${mStr}`,
        price: val,
        volume: 500 + idx * 120,
      };
    });
  }, [currentQuote, timeframe]);

  // Chart SVG Coordinates Math
  const { pathD, fillD, volumeBars, minPrice, maxPrice } = useMemo(() => {
    if (!activeSeries || activeSeries.length < 2) {
      return { pathD: '', fillD: '', volumeBars: [], minPrice: 0, maxPrice: 0 };
    }

    const prices = activeSeries.map((d) => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || (min * 0.01 || 1);
    const padding = range * 0.08;
    const adjustedMin = min - padding;
    const adjustedMax = max + padding;
    const adjustedRange = adjustedMax - adjustedMin;

    const width = 500;
    const height = 180;

    const points = activeSeries.map((d, idx) => {
      const x = (idx / (activeSeries.length - 1)) * width;
      const y = height - ((d.price - adjustedMin) / adjustedRange) * (height - 30) - 20;
      return { x, y, price: d.price, time: d.time, volume: (d as any).volume || 1000 };
    });

    const pathString = points.reduce((acc, p, idx) => {
      return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');

    const fillString = `${pathString} L ${width} ${height} L 0 ${height} Z`;

    const maxVol = Math.max(...points.map((p) => p.volume), 1);
    const volBars = points.map((p) => ({
      x: p.x - 3,
      y: height - (p.volume / maxVol) * 35,
      height: (p.volume / maxVol) * 35,
      width: 6,
    }));

    return {
      pathD: pathString,
      fillD: fillString,
      volumeBars: volBars,
      minPrice: adjustedMin,
      maxPrice: adjustedMax,
    };
  }, [activeSeries]);

  const isUp = currentQuote ? currentQuote.change >= 0 : true;
  const isFollowed = currentQuote ? followedSymbols.includes(currentQuote.symbol) : false;

  // Resizing mouse drag handlers for card height
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const startY = e.clientY;
    const startHeight = customChartHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const newHeight = Math.max(110, Math.min(420, startHeight + deltaY));
      setCustomChartHeight(newHeight);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Core benchmark quotes for the "综览" (Overview) tab matching real terminal layout
  const overviewSymbols = useMemo(() => [
    'DXY',
    'EUR/USD',
    'USD/JPY',
    'XAU/USD',
    'WTI',
    'USD/CNH',
    'US10Y',
    'SPX',
    'HSTECH',
    'NVDA',
    'BTC/USD',
    'ETH/USD',
  ], []);

  // Filtered quotes based on active category
  const filteredCategoryQuotes = useMemo(() => {
    if (activeCategory === 'overview') {
      const list = quotes.filter((q) => overviewSymbols.includes(q.symbol));
      return list.length > 0 ? list : quotes.slice(0, 10);
    }
    if (activeCategory === 'forex') {
      return quotes.filter((q) => q.category === 'forex');
    }
    if (activeCategory === 'commodity') {
      return quotes.filter((q) => q.category === 'commodity');
    }
    if (activeCategory === 'yield') {
      return quotes.filter((q) => q.category === 'yield');
    }
    if (activeCategory === 'stock') {
      return quotes.filter((q) => q.category === 'index' || q.category === 'stock');
    }
    if (activeCategory === 'crypto') {
      return quotes.filter((q) => q.category === 'crypto');
    }
    if (activeCategory === 'watchlist') {
      if (followedSymbols.length === 0) {
        const defaultSymbols = ['SPX', 'HSTECH', 'USD/CNH', 'BTC/USD', 'XAU/USD', 'US10Y', 'NVDA', 'CSI300', 'RDDT', 'HTFL', 'TSLA', 'AAPL'];
        return quotes.filter((q) => defaultSymbols.includes(q.symbol));
      }
      return quotes.filter((q) => followedSymbols.includes(q.symbol));
    }
    return quotes;
  }, [quotes, activeCategory, overviewSymbols, followedSymbols]);

  const categoryTabs: { id: MarketCategoryTab; label: string }[] = useMemo(() => [
    { id: 'overview', label: '综览' },
    { id: 'forex', label: '外汇' },
    { id: 'commodity', label: '商品' },
    { id: 'yield', label: '债券' },
    { id: 'stock', label: '股市' },
    { id: 'crypto', label: '加密' },
    { id: 'movers', label: '榜单' },
    { id: 'watchlist', label: `自选${followedSymbols.length > 0 ? `(${followedSymbols.length})` : ''}` },
  ], [followedSymbols]);

  return (
    <div
      id={id || 'pro-market-terminal'}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`bg-slate-900 text-slate-100 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col justify-start transition-all duration-200 select-none ${
        isFullWidth ? 'col-span-full' : ''
      } ${isFullscreen ? 'fixed inset-4 z-50 overflow-y-auto max-h-[95vh] shadow-2xl' : 'relative'}`}
    >
      {/* Top Terminal Header Bar with Drag Handle & Resize Controls */}
      <div className="px-3.5 py-2.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-3">
        {/* Left: Drag Handle + Title + Live Subtitle */}
        <div className="flex items-center gap-2">
          {draggable && (
            <div
              title="按住拖拽调整组件位置"
              className="p-1 rounded cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-200 hover:bg-slate-800/80 transition"
            >
              <GripVertical className="w-4 h-4" />
            </div>
          )}

          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            {icon || <Activity className="w-4 h-4" />}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                {title}
              </h3>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                {subtitle}
              </span>
            </div>
          </div>
        </div>

        {/* Right Header Actions: Size Switcher (1x/2x), Chart Height (+/-), Fullscreen, Market Center */}
        <div className="flex items-center gap-1.5">
          {/* Height Adjuster (+ / -) */}
          <div className="hidden sm:flex items-center bg-slate-800/90 rounded-lg p-0.5 border border-slate-700/60 text-slate-300 text-xs">
            <button
              onClick={() => setCustomChartHeight((h) => Math.max(120, h - 30))}
              title="缩小图表高度"
              className="p-1 rounded hover:bg-slate-700 hover:text-white transition"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="px-1 text-[10px] font-mono text-slate-400">{customChartHeight}px</span>
            <button
              onClick={() => setCustomChartHeight((h) => Math.min(360, h + 30))}
              title="放大图表高度"
              className="p-1 rounded hover:bg-slate-700 hover:text-white transition"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Width Toggle (1x / 2x) */}
          {onToggleFullWidth && (
            <button
              onClick={onToggleFullWidth}
              title={isFullWidth ? '恢复单栏宽度' : '扩展为通栏全宽'}
              className={`px-2 py-1 rounded-lg text-xs font-mono font-semibold border transition flex items-center gap-1 ${
                isFullWidth
                  ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <span>{isFullWidth ? '2x 通栏' : '1x 单栏'}</span>
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen((prev) => !prev)}
            title={isFullscreen ? '退出全屏' : '全屏聚焦'}
            className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-400 hover:text-white transition"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Markets Navigation (查看更多 >) */}
          {onNavigateToFullMarkets && (
            <button
              onClick={onNavigateToFullMarkets}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-0.5 ml-1 transition"
            >
              <span>查看更多</span>
              <span className="text-[13px]">&gt;</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Terminal Split Body: Left List + Right Interactive Chart */}
      <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-800 flex-1 items-start">
        
        {/* Left Sub-Pane: Category Filter & Asset Table List (~4 cols) */}
        <div className="md:col-span-4 p-2.5 bg-slate-950/40 space-y-2 flex flex-col justify-start">
          
          {/* Main Category Tabs: 综览 / 外汇 / 商品 / 债券 / 股市 / 加密 / 榜单 / 自选 */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar border-b border-slate-800/80">
            {categoryTabs.map((tab) => {
              const isActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveCategory(tab.id);
                    soundManager.playNewsPing('normal');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer relative ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-xs font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <span>{tab.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500 rounded-full"></span>
                  )}
                </button>
              );
            })}
          </div>

          {/* If Movers Tab is active, show Sub-Pill Toggles: 涨幅榜 / 跌幅榜 / 主力活跃 */}
          {activeCategory === 'movers' && (
            <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg text-[11px] font-semibold text-slate-300">
              <button
                onClick={() => setActiveMoverTab('gainers')}
                className={`flex-1 py-1 rounded transition text-center ${
                  activeMoverTab === 'gainers' ? 'bg-red-600 text-white font-bold shadow-xs' : 'hover:text-white'
                }`}
              >
                涨幅榜
              </button>
              <button
                onClick={() => setActiveMoverTab('losers')}
                className={`flex-1 py-1 rounded transition text-center ${
                  activeMoverTab === 'losers' ? 'bg-emerald-600 text-white font-bold shadow-xs' : 'hover:text-white'
                }`}
              >
                跌幅榜
              </button>
              <button
                onClick={() => setActiveMoverTab('active')}
                className={`flex-1 py-1 rounded transition text-center ${
                  activeMoverTab === 'active' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'hover:text-white'
                }`}
              >
                主力活跃
              </button>
            </div>
          )}

          {/* Table Header: 资产 | 现价 | 涨跌 / 涨跌幅 */}
          <div className="grid grid-cols-12 px-2 py-1 text-[11px] font-semibold text-slate-400 border-b border-slate-800/60 select-none">
            <div className="col-span-6">资产</div>
            <div className="col-span-3 text-right">现价</div>
            <div className="col-span-3 text-right">涨跌</div>
          </div>

          {/* Quick Clickable List of Asset Items - Top Aligned with rich density */}
          <div className="space-y-1 overflow-y-auto max-h-[380px] pr-1 focus:outline-none">
            {activeCategory === 'movers' ? (
              // Movers list
              (activeMoverTab === 'gainers' ? topGainers : activeMoverTab === 'losers' ? topLosers : mostActive).map((item) => {
                const itemIsUp = item.changePercent >= 0;
                const isItemActive = currentQuote?.symbol.toUpperCase() === item.ticker.toUpperCase();
                const changeAmt = Number((item.price * (item.changePercent / 100)).toFixed(2));

                return (
                  <div
                    key={item.ticker}
                    onClick={() => handleSelectAsset(item.ticker)}
                    className={`grid grid-cols-12 items-center p-2 rounded-xl border transition cursor-pointer text-xs select-none ${
                      isItemActive
                        ? 'bg-blue-600/25 border-blue-500 text-white shadow-md'
                        : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/90 hover:border-slate-700'
                    }`}
                  >
                    <div className="col-span-6 min-w-0 pr-1">
                      <div className="font-bold text-white text-[12px] truncate">{item.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                        <span>{getDisplayTicker(item.ticker)}</span>
                        {item.volume && <span className="text-[9px] text-slate-500">· {item.volume}</span>}
                      </div>
                    </div>

                    <div className="col-span-3 text-right font-mono font-bold text-slate-100 text-[12px]">
                      {formatPrice(item.price)}
                    </div>

                    <div className="col-span-3 text-right">
                      <div className={`font-mono text-[11px] font-bold ${itemIsUp ? 'text-red-400' : 'text-emerald-400'}`}>
                        {itemIsUp ? '+' : ''}{formatChange(changeAmt)}
                      </div>
                      <div className={`font-mono text-[10px] font-semibold ${itemIsUp ? 'text-red-400/90' : 'text-emerald-400/90'}`}>
                        ({itemIsUp ? '+' : ''}{item.changePercent.toFixed(2)}%)
                      </div>
                    </div>
                  </div>
                );
              })
            ) : filteredCategoryQuotes.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                <Star className="w-6 h-6 mx-auto mb-1 text-slate-600" />
                <p>该分类暂无标的</p>
              </div>
            ) : (
              filteredCategoryQuotes.map((q) => {
                const itemIsUp = q.change >= 0;
                const isItemActive = currentQuote?.symbol === q.symbol;
                return (
                  <div
                    key={q.symbol}
                    onClick={() => handleSelectAsset(q.symbol)}
                    className={`grid grid-cols-12 items-center p-2 rounded-xl border transition cursor-pointer text-xs select-none ${
                      isItemActive
                        ? 'bg-blue-600/25 border-blue-500 text-white shadow-md'
                        : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/90 hover:border-slate-700'
                    }`}
                  >
                    <div className="col-span-6 min-w-0 pr-1">
                      <div className="font-bold text-white text-[12px] truncate">
                        {q.nameCn || q.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        {getDisplayTicker(q.symbol)}
                      </div>
                    </div>

                    <div className="col-span-3 text-right font-mono font-bold text-slate-100 text-[12px]">
                      {formatPrice(q.price)}{q.unit === '%' ? '%' : ''}
                    </div>

                    <div className="col-span-3 text-right">
                      <div className={`font-mono text-[11px] font-bold ${itemIsUp ? 'text-red-400' : 'text-emerald-400'}`}>
                        {itemIsUp ? '+' : ''}{formatChange(q.change)}
                      </div>
                      <div className={`font-mono text-[10px] font-semibold ${itemIsUp ? 'text-red-400/90' : 'text-emerald-400/90'}`}>
                        ({itemIsUp ? '+' : ''}{q.changePercent.toFixed(2)}%)
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Symbol Switcher Pill Bar for Key Markets */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1 flex items-center justify-between">
              <span>主流标的直达 (点击即刻切换)</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {[
                { sym: 'BTC/USD', label: 'Bitcoin' },
                { sym: 'SPX', label: 'S&P 500' },
                { sym: 'HSTECH', label: 'Hang Seng Tech' },
                { sym: 'USD/CNH', label: 'USD/CNH' },
                { sym: 'XAU/USD', label: 'Gold Spot' },
                { sym: 'US10Y', label: 'US 10-Yr' },
                { sym: 'CN10Y', label: '中国10Y' },
                { sym: 'NVDA', label: 'NVDA' },
                { sym: 'RDDT', label: 'RDDT' },
                { sym: 'HTFL', label: 'HTFL' },
              ].map((item) => {
                const isSelected =
                  currentQuote && currentQuote.symbol.toUpperCase() === item.sym.toUpperCase();
                return (
                  <button
                    key={item.sym}
                    onClick={() => handleSelectAsset(item.sym)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Sub-Pane: Rich Pro Interactive Chart & Detailed Asset Statistics (~8 cols) */}
        <div className="md:col-span-8 p-3.5 space-y-3 bg-slate-900/90 flex flex-col justify-between">
          {currentQuote && (
            <div className="space-y-3">
              <FinancialTradingChart
                symbol={currentQuote.symbol}
                name={currentQuote.nameCn || currentQuote.name}
                basePrice={currentQuote.price}
                changePercent={currentQuote.changePercent}
                height={Math.max(260, customChartHeight + 90)}
                initialTimeframe="1D"
                showControls={true}
                externalTheme="dark"
                onOpenAssetDetail={onOpenAssetDetail}
              />

              {/* Comprehensive Market Metrics Table (Clean Formatted Values) */}
              <div className="pt-2 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-sans">市值 / 成交额</div>
                  <div className="font-bold text-slate-200">{currentQuote.turnover || '$1.27T'}</div>
                </div>

                <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-sans">今日振幅 / 开盘</div>
                  <div className="font-bold text-slate-200">
                    {currentQuote.amplitude || '1.85%'} / ${formatPrice(currentQuote.openPrice || currentQuote.price)}
                  </div>
                </div>

                <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-sans">日内最高 / 最低</div>
                  <div className="font-bold text-slate-200">
                    ${formatPrice(currentQuote.high)} / ${formatPrice(currentQuote.low)}
                  </div>
                </div>

                <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-sans">52周最高 / 最低</div>
                  <div className="font-bold text-slate-200">
                    ${currentQuote.yearHigh ? formatPrice(currentQuote.yearHigh) : '--'} / ${currentQuote.yearLow ? formatPrice(currentQuote.yearLow) : '--'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Bottom-Right Corner Resize Drag Handle */}
      <div
        onMouseDown={handleResizeStart}
        title="按住上下拖拽调整图表高度"
        className="absolute right-0 bottom-0 w-4 h-4 cursor-ns-resize flex items-center justify-center text-slate-600 hover:text-blue-400 group transition z-20"
      >
        <svg viewBox="0 0 6 6" className="w-2.5 h-2.5 fill-current">
          <circle cx="5" cy="5" r="0.8" />
          <circle cx="5" cy="2.5" r="0.8" />
          <circle cx="2.5" cy="5" r="0.8" />
        </svg>
      </div>
    </div>
  );
};
