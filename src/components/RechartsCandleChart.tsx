import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Sliders,
  Layers,
  RefreshCw,
  Check,
  BarChart2,
  Clock,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Database,
  Radio,
} from 'lucide-react';
import { MarketQuote } from '../types';
import { soundManager } from '../utils/audio';
import { generateSymbolChartData, computeTechnicalIndicators, OHLCVBar } from '../utils/chartDataGenerator';

export interface CandleDataPoint {
  time: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isUp: boolean;
  candleBottom: number;
  candleHeight: number;
  ma5?: number;
  ma10?: number;
  ma20?: number;
  ma60?: number;
}

interface RechartsCandleChartProps {
  symbol: string;
  name?: string;
  quote?: MarketQuote;
  sparkline?: number[];
  basePrice?: number;
  changePercent?: number;
  height?: number;
  onRefresh?: () => void;
}

export const RechartsCandleChart: React.FC<RechartsCandleChartProps> = ({
  symbol,
  name,
  quote,
  sparkline = [],
  basePrice = 100,
  changePercent = 0,
  height = 420,
  onRefresh,
}) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'15m' | '1H' | '1D' | '5D' | '1M'>('1D');
  const [colorConvention, setColorConvention] = useState<'intl' | 'chinese'>('intl'); // intl: green up / red down; chinese: red up / green down
  const [showMA5, setShowMA5] = useState(true);
  const [showMA10, setShowMA10] = useState(true);
  const [showMA20, setShowMA20] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // 真实 K 线（服务端 /api/market/chart：Binance + Yahoo OHLC）
  const [realBars, setRealBars] = useState<Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }> | null>(null);
  const [isRealData, setIsRealData] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/market/chart?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(selectedTimeframe)}`,
          { signal: AbortSignal.timeout(9000) }
        );
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && json.success && Array.isArray(json.bars) && json.bars.length > 0) {
            setRealBars(json.bars);
            setIsRealData(true);
            return;
          }
        }
        if (!cancelled) { setRealBars(null); setIsRealData(false); }
      } catch {
        if (!cancelled) { setRealBars(null); setIsRealData(false); }
      }
    };
    load();
    const t = setInterval(load, 45000);
    return () => { cancelled = true; clearInterval(t); };
  }, [symbol, selectedTimeframe]);

  const price = quote ? quote.price : basePrice;
  const changePct = quote ? quote.changePercent : changePercent;

  const isForex = symbol.includes('/') && !symbol.includes('BTC') && !symbol.includes('ETH');
  const isYield = symbol.includes('10Y') || symbol.includes('2Y');
  const isJpy = symbol.includes('JPY');
  const precision = isJpy ? 2 : isYield ? 3 : isForex ? 4 : price > 500 ? 2 : 2;

  const upColor = colorConvention === 'intl' ? '#10b981' : '#ef4444';
  const downColor = colorConvention === 'intl' ? '#ef4444' : '#10b981';

  const handleRefresh = async () => {
    setIsRefreshing(true);
    soundManager.playNewsPing('normal');
    if (onRefresh) {
      onRefresh();
    }
    try {
      const res = await fetch(
        `/api/market/chart?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(selectedTimeframe)}`,
        { signal: AbortSignal.timeout(9000) }
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.bars) && json.bars.length > 0) {
          setRealBars(json.bars);
          setIsRealData(true);
        }
      }
    } catch {
      // ignore
    }
    setRefreshFeedback('已同步最新真实行情与分时K线');
    setTimeout(() => {
      setIsRefreshing(false);
      setTimeout(() => setRefreshFeedback(null), 2000);
    }, 500);
  };

  // Generate synchronized OHLCV dataset
  const candleData: CandleDataPoint[] = useMemo(() => {
    // 0. 最高优先级：服务端真实 OHLC（Binance / Yahoo）
    if (realBars && realBars.length > 0) {
      const points: CandleDataPoint[] = realBars.map((b) => {
        const d = new Date(b.time * 1000);
        const timeLabel = selectedTimeframe === '15m' || selectedTimeframe === '1H' || selectedTimeframe === '1D'
          ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
          : `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return {
          time: timeLabel,
          timestamp: b.time * 1000,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
          volume: b.volume || 0,
          isUp: b.close >= b.open,
          candleBottom: Math.min(b.open, b.close),
          candleHeight: Math.max(Math.abs(b.close - b.open), 0.0001),
        } as CandleDataPoint;
      });
      for (let i = 0; i < points.length; i++) {
        if (i >= 4) points[i].ma5 = Number((points.slice(i - 4, i + 1).reduce((a, p) => a + p.close, 0) / 5).toFixed(precision));
        if (i >= 9) points[i].ma10 = Number((points.slice(i - 9, i + 1).reduce((a, p) => a + p.close, 0) / 10).toFixed(precision));
        if (i >= 19) points[i].ma20 = Number((points.slice(i - 19, i + 1).reduce((a, p) => a + p.close, 0) / 20).toFixed(precision));
      }
      return points;
    }

    // 1. If intraday 15m/1H requested and quote has rich intradaySeries
    const barsCount = selectedTimeframe === '15m' ? 36 : selectedTimeframe === '1H' ? 48 : selectedTimeframe === '5D' ? 40 : 60;
    const { bars: rawBars } = generateSymbolChartData(symbol, price, changePct, selectedTimeframe, barsCount);

    // Compute MA indicators on raw bars
    computeTechnicalIndicators(rawBars, precision);

    return rawBars.map((b) => {
      const d = new Date(b.time * 1000);
      let timeLabel = '';
      if (selectedTimeframe === '15m' || selectedTimeframe === '1H') {
        timeLabel = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      } else {
        timeLabel = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }

      return {
        time: timeLabel,
        timestamp: b.time * 1000,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume || 1000,
        isUp: b.close >= b.open,
        candleBottom: Math.min(b.open, b.close),
        candleHeight: Math.max(Math.abs(b.close - b.open), 0.0001),
        ma5: b.ma5,
        ma10: b.ma10,
        ma20: b.ma20,
        ma60: b.ma60,
      };
    });
  }, [symbol, price, changePct, selectedTimeframe, quote, precision, realBars]);

  // Compute Domain for Y-Axis
  const yDomain = useMemo(() => {
    if (candleData.length === 0) return [0, 100];
    const highs = candleData.map((d) => d.high);
    const lows = candleData.map((d) => d.low);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const padding = (max - min) * 0.08 || min * 0.01;
    return [
      Number((min - padding).toFixed(precision)),
      Number((max + padding).toFixed(precision)),
    ];
  }, [candleData, precision]);

  const formatPrice = (val?: number) => {
    if (val === undefined || isNaN(val)) return '--';
    if (val >= 1000) return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return val.toFixed(precision);
  };

  const latestPoint = candleData[candleData.length - 1] || null;
  const activeDisplayPoint = (hoveredIndex !== null && candleData[hoveredIndex]) ? candleData[hoveredIndex] : latestPoint;

  // Max volume for proportional volume bars
  const maxVolume = useMemo(() => {
    return Math.max(...candleData.map((d) => d.volume), 1);
  }, [candleData]);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-xl text-slate-100 flex flex-col justify-between select-none">
      {/* Top Toolbar & Quick HUD */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-800/80">
        {/* Left: Timeframe selectors + convention toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            {(['15m', '1H', '1D', '5D', '1M'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => {
                  setSelectedTimeframe(tf);
                  soundManager.playNewsPing('normal');
                }}
                className={`px-2.5 py-1 rounded text-xs font-semibold font-mono transition ${
                  selectedTimeframe === tf
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <button
            onClick={() => setColorConvention((c) => (c === 'intl' ? 'chinese' : 'intl'))}
            className="px-2 py-1 rounded-md text-[11px] bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition flex items-center gap-1 font-sans"
            title="切换涨跌配色习惯"
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: upColor }}></span>
            <span>{colorConvention === 'intl' ? '国际配色 (绿涨红跌)' : '国内配色 (红涨绿跌)'}</span>
          </button>
        </div>

        {/* Right: MA Toggles + Refresh */}
        <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
          <button
            onClick={() => setShowMA5((p) => !p)}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition flex items-center gap-1 ${
              showMA5 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-900 text-slate-500 border border-slate-800'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span>MA5: {activeDisplayPoint?.ma5 ? formatPrice(activeDisplayPoint.ma5) : '--'}</span>
          </button>

          <button
            onClick={() => setShowMA10((p) => !p)}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition flex items-center gap-1 ${
              showMA10 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-900 text-slate-500 border border-slate-800'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            <span>MA10: {activeDisplayPoint?.ma10 ? formatPrice(activeDisplayPoint.ma10) : '--'}</span>
          </button>

          <button
            onClick={() => setShowMA20((p) => !p)}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition flex items-center gap-1 ${
              showMA20 ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-slate-900 text-slate-500 border border-slate-800'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            <span>MA20: {activeDisplayPoint?.ma20 ? formatPrice(activeDisplayPoint.ma20) : '--'}</span>
          </button>

          <button
            onClick={() => setShowVolume((p) => !p)}
            className={`px-2 py-0.5 rounded text-[11px] transition ${
              showVolume ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40' : 'bg-slate-900 text-slate-500 border border-slate-800'
            }`}
          >
            成交量
          </button>

          <button
            id="btn-recharts-refresh"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition flex items-center gap-1 border ${
              isRefreshing
                ? 'bg-blue-600/20 text-blue-400 border-blue-500/40'
                : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-700'
            }`}
            title="即时同步最新行情与K线"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
            <span>{isRefreshing ? '同步中' : '即时同步'}</span>
          </button>
        </div>
      </div>

      {/* Floating HUD Information Bar */}
      {activeDisplayPoint && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-1.5 mb-2 bg-slate-900/80 border border-slate-800/80 rounded-xl text-xs font-mono">
          <div className="flex items-center gap-3">
            <span className="text-slate-400 font-sans font-medium">{activeDisplayPoint.time}</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">开:</span>
              <span className="text-slate-200 font-bold">{formatPrice(activeDisplayPoint.open)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">高:</span>
              <span className="font-bold text-emerald-400">{formatPrice(activeDisplayPoint.high)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">低:</span>
              <span className="font-bold text-rose-400">{formatPrice(activeDisplayPoint.low)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">收:</span>
              <span className="font-bold text-white">${formatPrice(activeDisplayPoint.close)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">涨跌幅:</span>
            <span
              className={`font-bold flex items-center gap-0.5 ${
                activeDisplayPoint.close >= activeDisplayPoint.open ? (colorConvention === 'intl' ? 'text-emerald-400' : 'text-rose-400') : (colorConvention === 'intl' ? 'text-rose-400' : 'text-emerald-400')
              }`}
            >
              {activeDisplayPoint.close >= activeDisplayPoint.open ? '+' : ''}
              {(((activeDisplayPoint.close - activeDisplayPoint.open) / (activeDisplayPoint.open || 1)) * 100).toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      {/* Main SVG Candlestick Canvas + Recharts MA Overlay */}
      <div className="w-full relative" style={{ height: `${height}px` }}>
        {/* SVG Candlestick & Volume Renderer Layer */}
        <div className="absolute inset-0 w-full h-full pointer-events-none z-10">
          <svg className="w-full h-full overflow-visible">
            {candleData.map((d, i) => {
              const count = candleData.length;
              const plotWidth = 100; // in %
              const leftPct = (i / (count - 1 || 1)) * 92 + 2; // leave margin for right axis
              const barWidthPct = Math.max(Math.min(75 / count, 3), 0.8);

              // Map prices to Y percentages
              const [yMin, yMax] = yDomain;
              const range = yMax - yMin || 1;
              const chartBottomPadding = showVolume ? 25 : 8; // % reserved for volume at bottom
              const chartTopPadding = 5; // %
              const usableHeight = 100 - chartBottomPadding - chartTopPadding;

              const getY = (val: number) => {
                const normalized = (val - yMin) / range;
                return chartTopPadding + (1 - normalized) * usableHeight;
              };

              const openY = getY(d.open);
              const closeY = getY(d.close);
              const highY = getY(d.high);
              const lowY = getY(d.low);

              const topBody = Math.min(openY, closeY);
              const bodyHeight = Math.max(Math.abs(closeY - openY), 0.4);

              const candleColor = d.isUp ? upColor : downColor;

              return (
                <g key={i} className="transition-opacity hover:opacity-80">
                  {/* High - Low Shadow Wick Line */}
                  <line
                    x1={`${leftPct}%`}
                    y1={`${highY}%`}
                    x2={`${leftPct}%`}
                    y2={`${lowY}%`}
                    stroke={candleColor}
                    strokeWidth={1.25}
                    strokeLinecap="round"
                  />

                  {/* Real Open - Close Candlestick Body */}
                  <rect
                    x={`calc(${leftPct}% - ${barWidthPct / 2}%)`}
                    y={`${topBody}%`}
                    width={`${barWidthPct}%`}
                    height={`${bodyHeight}%`}
                    fill={candleColor}
                    stroke={candleColor}
                    strokeWidth={0.75}
                    rx={1}
                  />

                  {/* Volume Bar at Bottom */}
                  {showVolume && (
                    <rect
                      x={`calc(${leftPct}% - ${barWidthPct / 2}%)`}
                      y={`${100 - (d.volume / maxVolume) * 20}%`}
                      width={`${barWidthPct}%`}
                      height={`${(d.volume / maxVolume) * 20}%`}
                      fill={candleColor}
                      opacity={0.35}
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Underlying Recharts Layer for Coordinate Grid, MA Lines, Axes & Interaction Tooltip */}
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={candleData}
            margin={{ top: 12, right: 12, left: 10, bottom: 6 }}
            onMouseMove={(state) => {
              if (state && state.activeTooltipIndex !== undefined) {
                setHoveredIndex(state.activeTooltipIndex);
              }
            }}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />}

            <XAxis
              dataKey="time"
              stroke="#64748b"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />

            <YAxis
              domain={yDomain}
              orientation="right"
              stroke="#64748b"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickFormatter={(v) => formatPrice(v)}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />

            {/* Base Reference Line at current live price */}
            {price && (
              <ReferenceLine
                y={price}
                stroke="rgba(59, 130, 246, 0.5)"
                strokeDasharray="3 3"
                label={{
                  value: `现价 $${formatPrice(price)}`,
                  fill: '#60a5fa',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
            )}

            {/* Invisible Bar to establish interaction domain */}
            <Bar dataKey="candleHeight" fill="transparent" isAnimationActive={false} />

            {/* MA5 Line */}
            {showMA5 && (
              <Line
                type="monotone"
                dataKey="ma5"
                stroke="#f59e0b"
                strokeWidth={1.75}
                dot={false}
                isAnimationActive={false}
              />
            )}

            {/* MA10 Line */}
            {showMA10 && (
              <Line
                type="monotone"
                dataKey="ma10"
                stroke="#06b6d4"
                strokeWidth={1.75}
                dot={false}
                isAnimationActive={false}
              />
            )}

            {/* MA20 Line */}
            {showMA20 && (
              <Line
                type="monotone"
                dataKey="ma20"
                stroke="#a855f7"
                strokeWidth={1.75}
                dot={false}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Sync Status Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isRealData ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
          <span className={`font-medium ${isRealData ? 'text-slate-300' : 'text-amber-400'}`}>
            {isRealData ? '真实历史 K 线（Binance / Yahoo Finance）' : '模拟示意走势（数据源暂不可用，非真实行情）'}
          </span>
          <span>·</span>
          <span>{candleData.length} 根 K线聚合</span>
        </div>

        <div className="flex items-center gap-2 text-slate-400">
          <span>现价: <strong className="text-white font-bold">${formatPrice(price)}</strong></span>
          <span>·</span>
          <span className={changePct >= 0 ? (colorConvention === 'intl' ? 'text-emerald-400' : 'text-rose-400') : (colorConvention === 'intl' ? 'text-rose-400' : 'text-emerald-400')}>
            {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
};
