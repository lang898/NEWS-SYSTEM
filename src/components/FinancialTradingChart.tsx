import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  Time,
  SeriesMarker,
} from 'lightweight-charts';
import {
  TrendingUp,
  TrendingDown,
  Ruler,
  Layers,
  Sparkles,
  Volume2,
  Info,
  Maximize2,
  Minimize2,
  RefreshCw,
  HelpCircle,
  Check,
  X,
  Target,
  BarChart2,
  Sliders,
  ChevronDown,
  Calendar,
  Eye,
  EyeOff,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
} from 'lucide-react';
import { OHLCVBar, ChartNewsMarker, generateSymbolChartData } from '../utils/chartDataGenerator';
import { fetchBinanceKlines, computeTechnicalIndicators } from '../utils/realtimeMarketGateway';
import { soundManager } from '../utils/audio';

export type ChartType = 'candles' | 'line' | 'area' | 'hollow';
export type SubIndicator = 'volume' | 'macd' | 'rsi' | 'none';
export type ColorConvention = 'intl' | 'chinese'; // intl: green up, red down; chinese: red up, green down
export type ChartTheme = 'dark' | 'light';

export interface MeasurementResult {
  startPrice: number;
  endPrice: number;
  deltaPrice: number;
  deltaPercent: number;
  barsCount: number;
  timeSpan: string;
  rangeHigh: number;
  rangeLow: number;
  startIdx: number;
  endIdx: number;
}

interface FinancialTradingChartProps {
  symbol: string;
  name?: string;
  basePrice?: number;
  changePercent?: number;
  height?: number;
  initialTimeframe?: string;
  showControls?: boolean;
  compactMode?: boolean;
  onSelectNewsMarker?: (marker: ChartNewsMarker) => void;
  onOpenAssetDetail?: (symbol: string) => void;
  onRefresh?: () => void;
  externalTheme?: ChartTheme;
}

export const FinancialTradingChart: React.FC<FinancialTradingChartProps> = ({
  symbol,
  name,
  basePrice = 100,
  changePercent = 0,
  height = 420,
  initialTimeframe = '1D',
  showControls = true,
  compactMode = false,
  onSelectNewsMarker,
  onOpenAssetDetail,
  onRefresh,
  externalTheme = 'light',
}) => {
  // Chart visual settings
  const [timeframe, setTimeframe] = useState<string>(initialTimeframe);
  const [chartType, setChartType] = useState<ChartType>('candles');
  const [colorConvention, setColorConvention] = useState<ColorConvention>('intl');
  const [chartTheme, setChartTheme] = useState<ChartTheme>(externalTheme);
  const [subIndicator, setSubIndicator] = useState<SubIndicator>('volume');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshFeedback, setRefreshFeedback] = useState<string | null>(null);

  // Indicators toggle
  const [showMA, setShowMA] = useState<boolean>(true);
  const [showBollinger, setShowBollinger] = useState<boolean>(false);
  const [showNewsMarkers, setShowNewsMarkers] = useState<boolean>(true);
  const [showSupportResistance, setShowSupportResistance] = useState<boolean>(false);

  // Measurement Tool (Ruler) State
  const [isRulerActive, setIsRulerActive] = useState<boolean>(false);
  const [measurePointA, setMeasurePointA] = useState<{ time: number; price: number; index: number } | null>(null);
  const [measurePointB, setMeasurePointB] = useState<{ time: number; price: number; index: number } | null>(null);
  const [measurement, setMeasurement] = useState<MeasurementResult | null>(null);

  // Crosshair live hover values & floating coordinates
  const [hoveredBar, setHoveredBar] = useState<OHLCVBar | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number } | null>(null);
  const [hoveredMarker, setHoveredMarker] = useState<ChartNewsMarker | null>(null);

  // Help / Guide modal
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // DOM Container Refs
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const ma5SeriesRef = useRef<ISeriesApi<any> | null>(null);
  const ma10SeriesRef = useRef<ISeriesApi<any> | null>(null);
  const ma20SeriesRef = useRef<ISeriesApi<any> | null>(null);
  const ma60SeriesRef = useRef<ISeriesApi<any> | null>(null);
  const bollUpperRef = useRef<ISeriesApi<any> | null>(null);
  const bollMidRef = useRef<ISeriesApi<any> | null>(null);
  const bollLowerRef = useRef<ISeriesApi<any> | null>(null);
  const macdDIFRef = useRef<ISeriesApi<any> | null>(null);
  const macdDEARef = useRef<ISeriesApi<any> | null>(null);
  const macdHistRef = useRef<ISeriesApi<any> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<any> | null>(null);

  // Tracking previous symbol & timeframe to fitContent only when necessary
  const prevSymbolRef = useRef<string>(symbol);
  const prevTimeframeRef = useRef<string>(timeframe);

  // Color config based on convention & theme
  const upColor = colorConvention === 'intl' ? '#10b981' : '#ef4444';
  const downColor = colorConvention === 'intl' ? '#ef4444' : '#10b981';
  const isDark = chartTheme === 'dark';

  // Real-time live bars state (fetched from Binance/Gateway when available)
  const [liveRealBars, setLiveRealBars] = useState<OHLCVBar[] | null>(null);
  const [dataSource, setDataSource] = useState<'server-real' | 'binance-real' | 'simulated-feed'>('simulated-feed');
  const [realSourceLabel, setRealSourceLabel] = useState<string>('');

  // Fallback deterministic chart data
  const { bars: simulatedBars, markers } = useMemo(() => {
    return generateSymbolChartData(symbol, basePrice, changePercent, timeframe, 120);
  }, [symbol, basePrice, changePercent, timeframe]);

  // Manual chart data refresh handler
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    soundManager.playNewsPing('normal');

    try {
      const res = await fetch(
        `/api/market/chart?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`,
        { signal: AbortSignal.timeout(9000) }
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.bars) && json.bars.length > 0) {
          setLiveRealBars(computeTechnicalIndicators(json.bars));
          setDataSource('server-real');
          setRealSourceLabel(json.source || '真实行情');
        }
      }
    } catch {
      try {
        const realBars = await fetchBinanceKlines(symbol, timeframe, 120);
        if (realBars && realBars.length > 0) {
          setLiveRealBars(realBars);
          setDataSource('binance-real');
          setRealSourceLabel('Binance Kline');
        }
      } catch {
        // 保持当前数据
      }
    }

    if (onRefresh) {
      onRefresh();
    }

    if (chartInstanceRef.current) {
      try {
        const timeScale = chartInstanceRef.current.timeScale();
        if (typeof (timeScale as any).scrollToRealTime === 'function') {
          (timeScale as any).scrollToRealTime();
        } else if (typeof timeScale.fitContent === 'function') {
          timeScale.fitContent();
        }
      } catch (err) {
        // Silently ignore if timescale isn't ready
      }
    }

    setRefreshFeedback('已同步最新走势');
    setTimeout(() => {
      setIsRefreshing(false);
      setTimeout(() => setRefreshFeedback(null), 2000);
    }, 500);
  };

  // 真实 K 线获取（重构版）：
  // 1) 服务端 /api/market/chart —— 覆盖全部资产（Binance K 线 + Yahoo OHLC）；
  // 2) 服务端不可达 → 加密品种直连 Binance；
  // 3) 全部失败 → 才退回本地模拟示意（图上必须明确标注"模拟示意"）。
  // 严格按时间升序去重排序，防止 Lightweight Charts 在多次拖拽或刷新时报错置灰
  const sanitizeBars = (rawBars: OHLCVBar[]): OHLCVBar[] => {
    if (!Array.isArray(rawBars) || rawBars.length === 0) return [];
    const valid = rawBars.filter((b) => typeof b.time === 'number' && !isNaN(b.time) && !isNaN(b.close));
    const sorted = [...valid].sort((a, b) => a.time - b.time);
    const deduplicated: OHLCVBar[] = [];
    for (const b of sorted) {
      if (deduplicated.length === 0 || deduplicated[deduplicated.length - 1].time !== b.time) {
        deduplicated.push(b);
      }
    }
    return deduplicated;
  };

  useEffect(() => {
    let isCancelled = false;

    const fetchRealData = async () => {
      try {
        const res = await fetch(
          `/api/market/chart?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`,
          { signal: AbortSignal.timeout(9000) }
        );
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.bars) && json.bars.length > 0) {
            if (!isCancelled) {
              const clean = sanitizeBars(json.bars);
              setLiveRealBars(computeTechnicalIndicators(clean));
              setDataSource('server-real');
              setRealSourceLabel(json.source || '真实行情');
            }
            return;
          }
        }
      } catch {
        // 服务端不可达 → 尝试直连
      }

      const realBars = await fetchBinanceKlines(symbol, timeframe, 120);
      if (isCancelled) return;
      if (realBars && realBars.length > 0) {
        const clean = sanitizeBars(realBars);
        setLiveRealBars(clean);
        setDataSource('binance-real');
        setRealSourceLabel('Binance Kline');
      } else {
        setLiveRealBars(null);
        setDataSource('simulated-feed');
        setRealSourceLabel('');
      }
    };

    fetchRealData();
    const interval = setInterval(fetchRealData, 30000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [symbol, timeframe]);

  const bars = useMemo(() => {
    return sanitizeBars(liveRealBars || simulatedBars);
  }, [liveRealBars, simulatedBars]);

  // Keep references to bars & markers for crosshair handlers without recreating listeners
  const barsRef = useRef<OHLCVBar[]>(bars);
  barsRef.current = bars;
  const markersRef = useRef<ChartNewsMarker[]>(markers);
  markersRef.current = markers;
  const isRulerActiveRef = useRef<boolean>(isRulerActive);
  isRulerActiveRef.current = isRulerActive;
  const measurePointARef = useRef(measurePointA);
  measurePointARef.current = measurePointA;
  const measurePointBRef = useRef(measurePointB);
  measurePointBRef.current = measurePointB;

  // Current active bar (last bar or hovered bar)
  const currentDisplayBar = hoveredBar || (bars.length > 0 ? bars[bars.length - 1] : null);

  // Calculate quick stats (High, Low, Amplitude, 24h range)
  const stats = useMemo(() => {
    if (!bars.length) return { high: basePrice, low: basePrice, amplitude: 0, totalVol: 0 };
    const highs = bars.map((b) => b.high);
    const lows = bars.map((b) => b.low);
    const h = Math.max(...highs);
    const l = Math.min(...lows);
    const amp = ((h - l) / l) * 100;
    const vol = bars.reduce((acc, b) => acc + b.volume, 0);
    return { high: h, low: l, amplitude: amp, totalVol: vol };
  }, [bars, basePrice]);

  // Handle Measurement logic when points A and B are set
  useEffect(() => {
    if (!measurePointA) {
      setMeasurement(null);
      return;
    }

    const startIdx = measurePointA.index;
    const endIdx = measurePointB ? measurePointB.index : startIdx;
    const minIdx = Math.min(startIdx, endIdx);
    const maxIdx = Math.max(startIdx, endIdx);
    const rangeBars = bars.slice(minIdx, maxIdx + 1);

    const startP = measurePointA.price;
    const endP = measurePointB ? measurePointB.price : startP;
    const deltaP = endP - startP;
    const deltaPct = (deltaP / (startP || 1)) * 100;
    const rHigh = Math.max(...rangeBars.map((b) => b.high));
    const rLow = Math.min(...rangeBars.map((b) => b.low));

    const totalSeconds = Math.abs(
      (measurePointB ? measurePointB.time : measurePointA.time) - measurePointA.time
    );
    let timeStr = `${rangeBars.length} 根K线`;
    if (totalSeconds >= 86400) {
      timeStr += ` (${Math.round(totalSeconds / 86400)} 天)`;
    } else if (totalSeconds >= 3600) {
      timeStr += ` (${Math.round(totalSeconds / 3600)} 小时)`;
    } else if (totalSeconds > 0) {
      timeStr += ` (${Math.round(totalSeconds / 60)} 分钟)`;
    }

    setMeasurement({
      startPrice: startP,
      endPrice: endP,
      deltaPrice: deltaP,
      deltaPercent: deltaPct,
      barsCount: rangeBars.length,
      timeSpan: timeStr,
      rangeHigh: rHigh,
      rangeLow: rLow,
      startIdx: minIdx,
      endIdx: maxIdx,
    });
  }, [measurePointA, measurePointB, bars]);

  // 1. Initialize & Configure Lightweight Chart Instance
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    // Clean up existing chart
    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
    }

    const chartHeight = height;

    const isIntraday = timeframe.includes('m') || timeframe.includes('H') || timeframe.includes('h');

    const chart = createChart(container, {
      width: container.clientWidth || 600,
      height: chartHeight,
      localization: {
        locale: 'zh-CN',
        dateFormat: 'yyyy/MM/dd',
        timeFormatter: (timestamp: number) => {
          const date = new Date(timestamp * 1000);
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          if (isIntraday) {
            return `${month}/${day} ${hours}:${minutes}`;
          }
          return `${date.getFullYear()}/${month}/${day}`;
        },
      },
      layout: {
        background: {
          type: ColorType.Solid,
          color: isDark ? '#090d16' : '#ffffff',
        },
        textColor: isDark ? '#94a3b8' : '#475569',
        fontSize: 11,
      },
      grid: {
        vertLines: {
          color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
          style: LineStyle.Dotted,
        },
        horzLines: {
          color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
          style: LineStyle.Dotted,
        },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: isDark ? '#60a5fa' : '#3b82f6',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: isDark ? '#1e293b' : '#3b82f6',
        },
        horzLine: {
          color: isDark ? '#60a5fa' : '#3b82f6',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: isDark ? '#1e293b' : '#3b82f6',
        },
      },
      rightPriceScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        scaleMargins: {
          top: 0.1,
          bottom: subIndicator !== 'none' ? 0.3 : 0.1,
        },
      },
      timeScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        timeVisible: isIntraday,
        secondsVisible: false,
        rightOffset: 12,
        tickMarkFormatter: (timestamp: number) => {
          const date = new Date(timestamp * 1000);
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          if (isIntraday) {
            return `${hours}:${minutes}`;
          }
          return `${month}/${day}`;
        },
      },
      handleScroll: true,
      handleScale: true,
    });

    chartInstanceRef.current = chart;

    // Create Main Series
    let mainSeries: ISeriesApi<any>;
    if (chartType === 'candles') {
      mainSeries = chart.addSeries(CandlestickSeries, {
        upColor: upColor,
        downColor: downColor,
        borderVisible: false,
        wickUpColor: upColor,
        wickDownColor: downColor,
        lastValueVisible: true,
        priceLineVisible: true,
      });
    } else if (chartType === 'hollow') {
      mainSeries = chart.addSeries(CandlestickSeries, {
        upColor: 'transparent',
        downColor: downColor,
        borderUpColor: upColor,
        borderDownColor: downColor,
        wickUpColor: upColor,
        wickDownColor: downColor,
        lastValueVisible: true,
        priceLineVisible: true,
      });
    } else if (chartType === 'area') {
      mainSeries = chart.addSeries(AreaSeries, {
        topColor: isDark ? 'rgba(59, 130, 246, 0.4)' : 'rgba(59, 130, 246, 0.3)',
        bottomColor: isDark ? 'rgba(59, 130, 246, 0.0)' : 'rgba(59, 130, 246, 0.0)',
        lineColor: '#3b82f6',
        lineWidth: 2,
        lastValueVisible: true,
        priceLineVisible: true,
      });
    } else {
      mainSeries = chart.addSeries(LineSeries, {
        color: '#3b82f6',
        lineWidth: 2,
        lastValueVisible: true,
        priceLineVisible: true,
      });
    }
    mainSeriesRef.current = mainSeries;

    // MA Lines
    if (showMA) {
      ma5SeriesRef.current = chart.addSeries(LineSeries, {
        color: '#eab308',
        lineWidth: 1,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      ma10SeriesRef.current = chart.addSeries(LineSeries, {
        color: '#06b6d4',
        lineWidth: 1,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      ma20SeriesRef.current = chart.addSeries(LineSeries, {
        color: '#a855f7',
        lineWidth: 2,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      ma60SeriesRef.current = chart.addSeries(LineSeries, {
        color: '#f97316',
        lineWidth: 2,
        lastValueVisible: false,
        priceLineVisible: false,
      });
    } else {
      ma5SeriesRef.current = null;
      ma10SeriesRef.current = null;
      ma20SeriesRef.current = null;
      ma60SeriesRef.current = null;
    }

    // Bollinger Bands
    if (showBollinger) {
      bollUpperRef.current = chart.addSeries(LineSeries, {
        color: '#60a5fa',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      bollMidRef.current = chart.addSeries(LineSeries, {
        color: '#3b82f6',
        lineWidth: 1,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      bollLowerRef.current = chart.addSeries(LineSeries, {
        color: '#60a5fa',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        lastValueVisible: false,
        priceLineVisible: false,
      });
    } else {
      bollUpperRef.current = null;
      bollMidRef.current = null;
      bollLowerRef.current = null;
    }

    // Sub-Indicators
    if (subIndicator === 'volume') {
      const volSeries = chart.addSeries(HistogramSeries, {
        color: '#94a3b8',
        priceFormat: { type: 'volume' },
        priceScaleId: 'vol_pane',
        lastValueVisible: true,
      });
      chart.priceScale('vol_pane').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
      volumeSeriesRef.current = volSeries;
    } else {
      volumeSeriesRef.current = null;
    }

    if (subIndicator === 'macd') {
      macdDIFRef.current = chart.addSeries(LineSeries, {
        color: '#3b82f6',
        lineWidth: 2,
        priceScaleId: 'macd_pane',
        lastValueVisible: false,
        priceLineVisible: false,
      });
      macdDEARef.current = chart.addSeries(LineSeries, {
        color: '#f59e0b',
        lineWidth: 1,
        priceScaleId: 'macd_pane',
        lastValueVisible: false,
        priceLineVisible: false,
      });
      macdHistRef.current = chart.addSeries(HistogramSeries, {
        priceScaleId: 'macd_pane',
        lastValueVisible: false,
      });
      chart.priceScale('macd_pane').applyOptions({
        scaleMargins: { top: 0.75, bottom: 0 },
      });
    } else {
      macdDIFRef.current = null;
      macdDEARef.current = null;
      macdHistRef.current = null;
    }

    if (subIndicator === 'rsi') {
      rsiSeriesRef.current = chart.addSeries(LineSeries, {
        color: '#ec4899',
        lineWidth: 2,
        priceScaleId: 'rsi_pane',
        lastValueVisible: false,
        priceLineVisible: false,
      });
      chart.priceScale('rsi_pane').applyOptions({
        scaleMargins: { top: 0.75, bottom: 0 },
      });
    } else {
      rsiSeriesRef.current = null;
    }

    // Support & Resistance Lines
    if (showSupportResistance && barsRef.current.length > 0) {
      const highs = barsRef.current.map((b) => b.high);
      const lows = barsRef.current.map((b) => b.low);
      const h = Math.max(...highs);
      const l = Math.min(...lows);
      const m = (h + l) / 2;

      mainSeries.createPriceLine({
        price: h,
        color: '#ef4444',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: '阶段阻力',
      });
      mainSeries.createPriceLine({
        price: l,
        color: '#10b981',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: '阶段支撑',
      });
      mainSeries.createPriceLine({
        price: m,
        color: '#94a3b8',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: '平衡线',
      });
    }

    // Subscribe to Crosshair / Tooltip events
    const extractTimestamp = (t: any): number | null => {
      if (typeof t === 'number') return t;
      if (typeof t === 'string') return Math.floor(new Date(t).getTime() / 1000);
      if (t && typeof t === 'object' && 'year' in t) {
        return Math.floor(new Date(t.year, (t.month || 1) - 1, t.day || 1).getTime() / 1000);
      }
      return null;
    };

    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        setHoveredBar(null);
        setHoveredPoint(null);
        setHoveredMarker(null);
        return;
      }

      const paramTs = extractTimestamp(param.time);
      const currentBars = barsRef.current;
      const currentMarkers = markersRef.current;
      const barData = currentBars.find((b) => b.time === paramTs || b.time === param.time);
      if (barData) {
        setHoveredBar(barData);
        setHoveredPoint(param.point);
        const matchedMarker = currentMarkers.find((m) => m.time === barData.time);
        setHoveredMarker(matchedMarker || null);

        // Ruler drag
        if (isRulerActiveRef.current && measurePointARef.current && !measurePointBRef.current) {
          const idx = currentBars.findIndex((b) => b.time === barData.time);
          if (idx !== -1) {
            setMeasurePointB({
              time: barData.time,
              price: barData.close,
              index: idx,
            });
          }
        }
      }
    });

    // Subscribe to Chart Click for Measurement
    chart.subscribeClick((param) => {
      if (!param || !param.time) return;
      const paramTs = extractTimestamp(param.time);
      const currentBars = barsRef.current;
      const barData = currentBars.find((b) => b.time === paramTs || b.time === param.time);
      if (!barData) return;
      const idx = currentBars.findIndex((b) => b.time === barData.time);

      if (isRulerActiveRef.current) {
        soundManager.playNewsPing('normal');
        if (!measurePointARef.current) {
          setMeasurePointA({
            time: barData.time,
            price: barData.close,
            index: idx,
          });
        } else {
          setMeasurePointB({
            time: barData.time,
            price: barData.close,
            index: idx,
          });
        }
      }
    });

    // ResizeObserver for responsive layout
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length > 0 && chartInstanceRef.current) {
        const { width, height } = entries[0].contentRect;
        if (width > 0) {
          chartInstanceRef.current.applyOptions({
            width: width,
            height: height > 0 ? height : chartHeight,
          });
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }
    };
  }, [
    chartType,
    colorConvention,
    chartTheme,
    subIndicator,
    showMA,
    showBollinger,
    showSupportResistance,
    height,
    timeframe,
    upColor,
    downColor,
    isDark,
  ]);

  // 2. Data Sync Effect: Updates series data smoothly WITHOUT recreating chart or resetting zoom
  useEffect(() => {
    if (!chartInstanceRef.current || !mainSeriesRef.current || bars.length === 0) return;

    // Set Main Series Data
    if (chartType === 'candles' || chartType === 'hollow') {
      mainSeriesRef.current.setData(
        bars.map((b) => ({
          time: b.time as Time,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
        }))
      );
    } else {
      mainSeriesRef.current.setData(
        bars.map((b) => ({
          time: b.time as Time,
          value: b.close,
        }))
      );
    }

    // Set MA Data
    if (showMA) {
      if (ma5SeriesRef.current) {
        ma5SeriesRef.current.setData(
          bars.filter((b) => b.ma5 !== undefined).map((b) => ({ time: b.time as Time, value: b.ma5! }))
        );
      }
      if (ma10SeriesRef.current) {
        ma10SeriesRef.current.setData(
          bars.filter((b) => b.ma10 !== undefined).map((b) => ({ time: b.time as Time, value: b.ma10! }))
        );
      }
      if (ma20SeriesRef.current) {
        ma20SeriesRef.current.setData(
          bars.filter((b) => b.ma20 !== undefined).map((b) => ({ time: b.time as Time, value: b.ma20! }))
        );
      }
      if (ma60SeriesRef.current) {
        ma60SeriesRef.current.setData(
          bars.filter((b) => b.ma60 !== undefined).map((b) => ({ time: b.time as Time, value: b.ma60! }))
        );
      }
    }

    // Set Bollinger Bands Data
    if (showBollinger) {
      if (bollUpperRef.current) {
        bollUpperRef.current.setData(
          bars.filter((b) => b.bollUpper !== undefined).map((b) => ({ time: b.time as Time, value: b.bollUpper! }))
        );
      }
      if (bollMidRef.current) {
        bollMidRef.current.setData(
          bars.filter((b) => b.bollMid !== undefined).map((b) => ({ time: b.time as Time, value: b.bollMid! }))
        );
      }
      if (bollLowerRef.current) {
        bollLowerRef.current.setData(
          bars.filter((b) => b.bollLower !== undefined).map((b) => ({ time: b.time as Time, value: b.bollLower! }))
        );
      }
    }

    // Set Sub-Indicator Data
    if (subIndicator === 'volume' && volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(
        bars.map((b) => ({
          time: b.time as Time,
          value: b.volume,
          color: b.close >= b.open ? (upColor === '#10b981' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)') : (upColor === '#10b981' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'),
        }))
      );
    } else if (subIndicator === 'macd') {
      if (macdDIFRef.current) {
        macdDIFRef.current.setData(bars.map((b) => ({ time: b.time as Time, value: b.macd || 0 })));
      }
      if (macdDEARef.current) {
        macdDEARef.current.setData(bars.map((b) => ({ time: b.time as Time, value: b.macdSignal || 0 })));
      }
      if (macdHistRef.current) {
        macdHistRef.current.setData(
          bars.map((b) => ({
            time: b.time as Time,
            value: b.macdHist || 0,
            color: (b.macdHist || 0) >= 0 ? '#10b981' : '#ef4444',
          }))
        );
      }
    } else if (subIndicator === 'rsi' && rsiSeriesRef.current) {
      rsiSeriesRef.current.setData(
        bars.filter((b) => b.rsi !== undefined).map((b) => ({ time: b.time as Time, value: b.rsi! }))
      );
    }

    // Markers on main series
    if (showNewsMarkers && markers.length > 0 && chartType === 'candles') {
      const seriesMarkers: SeriesMarker<Time>[] = markers.map((m) => ({
        time: m.time as Time,
        position: m.impact === 'bullish' ? 'belowBar' : 'aboveBar',
        color: m.impact === 'bullish' ? '#10b981' : m.impact === 'bearish' ? '#ef4444' : '#3b82f6',
        shape: m.impact === 'bullish' ? 'arrowUp' : 'arrowDown',
        text: m.category === 'earnings' ? '📊财报' : m.category === 'macro' ? '🏦美联储' : '⚡重磅',
        id: m.id,
      }));
      try {
        if ((mainSeriesRef.current as any).setMarkers) {
          (mainSeriesRef.current as any).setMarkers(seriesMarkers);
        }
      } catch (e) {
        // Safe fallback
      }
    }

    // Fit content ONLY if the symbol or timeframe changed, preserving user zoom/pan during live ticks
    if (prevSymbolRef.current !== symbol || prevTimeframeRef.current !== timeframe) {
      prevSymbolRef.current = symbol;
      prevTimeframeRef.current = timeframe;
      chartInstanceRef.current.timeScale().fitContent();
    }
  }, [bars, markers, chartType, subIndicator, showMA, showBollinger, showNewsMarkers, symbol, timeframe, upColor]);

  // Format Helpers
  const formatPrice = (val?: number) => {
    if (val === undefined || isNaN(val)) return '--';
    if (val < 1) return val.toFixed(4);
    if (val < 100) return val.toFixed(2);
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (unixSec?: number) => {
    if (!unixSec) return '';
    const d = new Date(unixSec * 1000);
    return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const isUp = changePercent >= 0;

  return (
    <div
      id={`financial-chart-${symbol.replace(/[^a-zA-Z0-9]/g, '_')}`}
      className={`relative flex flex-col rounded-xl border transition-all duration-200 overflow-hidden ${
        isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      } ${isFullscreen ? 'fixed inset-4 z-50 shadow-2xl' : ''}`}
    >
      {/* Sticky Header Top Enclosure: Controls + Floating OHLCV/MA Legend */}
      <div className={`sticky top-0 z-20 backdrop-blur-md border-b select-none transition-colors ${
        isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-slate-50/95 border-slate-200'
      }`}>
        {/* 1. Header Toolbar & Quick Stats */}
        {showControls && (
          <div className={`p-3 border-b flex flex-wrap items-center justify-between gap-2.5 ${
            isDark ? 'border-slate-800/80' : 'border-slate-200/80'
          }`}>
            {/* Symbol Title & Real-time Quote */}
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black tracking-tight text-base">{symbol}</span>
                  {name && <span className="text-xs text-slate-500 font-medium hidden sm:inline">({name})</span>}
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${
                      isUp
                        ? isDark ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60' : 'bg-emerald-100 text-emerald-700'
                        : isDark ? 'bg-rose-950/80 text-rose-400 border border-rose-800/60' : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {isUp ? '+' : ''}
                    {changePercent.toFixed(2)}%
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                      dataSource === 'simulated-feed'
                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    }`}
                    title={
                      dataSource === 'server-real'
                        ? `真实历史 K 线 · 来源: ${realSourceLabel}`
                        : dataSource === 'binance-real'
                          ? '已直连 Binance 交易所官方真实 K 线'
                          : '警告：数据源暂不可用，当前展示为模拟示意走势，非真实行情，请勿据此交易'
                    }
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${dataSource === 'simulated-feed' ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                    <span>
                      {dataSource === 'server-real'
                        ? `真实数据 · ${realSourceLabel.includes('Binance') ? 'Binance' : realSourceLabel.includes('Yahoo') ? 'Yahoo Finance' : '实盘'}`
                        : dataSource === 'binance-real'
                          ? 'Binance 真实数据'
                          : '模拟示意（非真实行情）'}
                    </span>
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  现价: <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{formatPrice(basePrice)}</span>
                </div>
              </div>

              {onOpenAssetDetail && (
                <button
                  id="btn-goto-deep-dive"
                  onClick={() => onOpenAssetDetail(symbol)}
                  className="hidden md:flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/80 border border-blue-200 dark:border-blue-800/60 transition"
                  title="进入该标的独立深度研判页面"
                >
                  <span>独立分析</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Timeframe Bar */}
            <div className="flex items-center bg-slate-200/70 dark:bg-slate-800/90 p-0.5 rounded-lg text-xs font-semibold">
              {['1m', '5m', '15m', '1H', '1D', '1W', '1M'].map((tf) => (
                <button
                  key={tf}
                  id={`btn-timeframe-${tf}`}
                  onClick={() => {
                    soundManager.playNewsPing('normal');
                    setTimeframe(tf);
                  }}
                  className={`px-2 py-1 rounded transition ${
                    timeframe === tf
                      ? isDark ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* Chart Types & Features */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Chart Type Selector */}
              <div className="flex items-center bg-slate-200/70 dark:bg-slate-800/90 p-0.5 rounded-lg text-xs">
                <button
                  id="btn-chart-type-candles"
                  onClick={() => setChartType('candles')}
                  className={`px-2 py-1 rounded font-medium transition ${
                    chartType === 'candles'
                      ? isDark ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                  title="专业蜡烛图(K线)"
                >
                  K线
                </button>
                <button
                  id="btn-chart-type-line"
                  onClick={() => setChartType('area')}
                  className={`px-2 py-1 rounded font-medium transition ${
                    chartType === 'area'
                      ? isDark ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                  title="分时面积图"
                >
                  面积
                </button>
                <button
                  id="btn-chart-type-hollow"
                  onClick={() => setChartType('hollow')}
                  className={`px-2 py-1 rounded font-medium transition ${
                    chartType === 'hollow'
                      ? isDark ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                  title="空心K线"
                >
                  空心
                </button>
              </div>

              {/* Sub-Indicator Switch */}
              <div className="flex items-center bg-slate-200/70 dark:bg-slate-800/90 p-0.5 rounded-lg text-xs">
                {(['volume', 'macd', 'rsi', 'none'] as SubIndicator[]).map((ind) => (
                  <button
                    key={ind}
                    id={`btn-sub-indicator-${ind}`}
                    onClick={() => setSubIndicator(ind)}
                    className={`px-1.5 py-1 rounded font-medium capitalize transition ${
                      subIndicator === ind
                        ? isDark ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {ind === 'volume' ? '成交量' : ind === 'macd' ? 'MACD' : ind === 'rsi' ? 'RSI' : '隐藏'}
                  </button>
                ))}
              </div>

              {/* Measurement Ruler Tool Toggle */}
              <button
                id="btn-toggle-ruler-tool"
                onClick={() => {
                  soundManager.playNewsPing('normal');
                  const next = !isRulerActive;
                  setIsRulerActive(next);
                  if (!next) {
                    setMeasurePointA(null);
                    setMeasurePointB(null);
                    setMeasurement(null);
                  }
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                  isRulerActive
                    ? 'bg-amber-500 text-white border-amber-600 shadow-sm ring-2 ring-amber-300'
                    : isDark
                    ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
                title="标尺测距：点击图表上任意两点测量涨跌点数、涨跌幅、K线跨度与时间"
              >
                <Ruler className="w-3.5 h-3.5" />
                <span>标尺测距</span>
              </button>

              {/* Support/Resistance Lines Toggle */}
              <button
                id="btn-toggle-support-resistance"
                onClick={() => setShowSupportResistance(!showSupportResistance)}
                className={`px-2 py-1 rounded-lg text-xs font-medium border transition ${
                  showSupportResistance
                    ? 'bg-purple-600 text-white border-purple-700'
                    : isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-400'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
                title="关键支撑位/阻力位标线"
              >
                支撑阻力
              </button>

              {/* Color Convention (Intl Green-Up vs Chinese Red-Up) */}
              <button
                id="btn-toggle-color-convention"
                onClick={() => setColorConvention(colorConvention === 'intl' ? 'chinese' : 'intl')}
                className={`px-2 py-1 rounded-lg text-xs font-medium border transition ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                }`}
                title="切换涨跌配色习惯"
              >
                {colorConvention === 'intl' ? '国际色 (绿涨红跌)' : '国内色 (红涨绿跌)'}
              </button>

              {/* Manual Refresh Button */}
              <button
                id="btn-chart-manual-refresh"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                  isRefreshing
                    ? 'bg-blue-600/20 text-blue-400 border-blue-500/40'
                    : isDark
                    ? 'bg-slate-800/90 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-blue-600'
                }`}
                title="立即刷新获取该标的最新行情与K线走势数据"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
                <span>{isRefreshing ? '正在同步...' : '刷新走势'}</span>
              </button>

              {/* Beginner Guide / Explain Button */}
              <button
                id="btn-open-chart-guide"
                onClick={() => setIsGuideOpen(true)}
                className="p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition"
                title="指标与走势解读指南（小白速懂）"
              >
                <HelpCircle className="w-4 h-4" />
              </button>

              {/* Fullscreen Toggle */}
              <button
                id="btn-toggle-fullscreen"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition"
                title={isFullscreen ? '退出全屏' : '全屏专业看盘'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Refresh Success Toast/Pill */}
        {refreshFeedback && (
          <div className="absolute top-14 right-4 z-40 bg-slate-900/90 text-emerald-400 border border-emerald-500/40 text-xs px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5 animate-in fade-in slide-in-from-top-2 duration-200 font-medium font-sans backdrop-blur-sm">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>{refreshFeedback}</span>
          </div>
        )}

        {/* 2. OHLCV Bar Hover Legend (Float Bar Data - Fixed at Top) */}
        <div className={`px-3 py-1.5 text-xs flex flex-wrap items-center gap-x-4 gap-y-1 font-mono transition ${
          isDark ? 'text-slate-300' : 'text-slate-700'
        }`}>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-sans">时间:</span>
            <span className="font-semibold">{formatDate(currentDisplayBar?.time)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-400">开:</span>
            <span>{formatPrice(currentDisplayBar?.open)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-400">高:</span>
            <span className="text-emerald-500 font-semibold">{formatPrice(currentDisplayBar?.high)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-400">低:</span>
            <span className="text-rose-500 font-semibold">{formatPrice(currentDisplayBar?.low)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-400">收:</span>
            <span className="font-bold">{formatPrice(currentDisplayBar?.close)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-400">量:</span>
            <span>{currentDisplayBar?.volume?.toLocaleString() || '--'}</span>
          </div>

          {/* MA values indicators (Clean non-intrusive top indicators with color tags) */}
          {showMA && currentDisplayBar && (
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-300 dark:border-slate-700 text-[11px]">
              <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                MA5: {formatPrice(currentDisplayBar.ma5)}
              </span>
              <span className="inline-flex items-center gap-1 text-cyan-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                MA10: {formatPrice(currentDisplayBar.ma10)}
              </span>
              <span className="inline-flex items-center gap-1 text-purple-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                MA20: {formatPrice(currentDisplayBar.ma20)}
              </span>
              <span className="inline-flex items-center gap-1 text-orange-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                MA60: {formatPrice(currentDisplayBar.ma60)}
              </span>
            </div>
          )}

          {/* Sub-Indicator values */}
          {subIndicator === 'rsi' && currentDisplayBar?.rsi !== undefined && (
            <div className="flex items-center gap-1 pl-2 border-l border-slate-300 dark:border-slate-700 text-pink-500 text-[11px]">
              <span>RSI(14): {currentDisplayBar.rsi}</span>
            </div>
          )}
        </div>

        {/* 3. Interactive Ruler Measurement Overlay Banner */}
        {isRulerActive && (
          <div className="bg-amber-500 text-slate-950 px-3 py-1.5 flex items-center justify-between text-xs font-semibold shadow-inner z-20">
            <div className="flex items-center gap-2 flex-wrap">
              <Ruler className="w-4 h-4 animate-pulse text-slate-900" />
              <span>
                {!measurePointA
                  ? '【标尺已激活】请在图表上点击第一个基准锚点 (Point A)'
                  : !measurePointB
                  ? '【移动并点击第二个点】实时测量区间跨度与盈亏幅度'
                  : '【测量完成】'}
              </span>

              {measurement && (
                <div className="flex items-center gap-3 bg-slate-950 text-amber-300 px-2.5 py-0.5 rounded font-mono text-xs">
                  <span>
                    变动: <strong className={measurement.deltaPrice >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {measurement.deltaPrice >= 0 ? '+' : ''}
                      {formatPrice(measurement.deltaPrice)} ({measurement.deltaPercent >= 0 ? '+' : ''}
                      {measurement.deltaPercent.toFixed(2)}%)
                    </strong>
                  </span>
                  <span>跨度: {measurement.timeSpan}</span>
                  <span>区间极值: {formatPrice(measurement.rangeLow)} ~ {formatPrice(measurement.rangeHigh)}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-reset-measure"
                onClick={() => {
                  setMeasurePointA(null);
                  setMeasurePointB(null);
                  setMeasurement(null);
                }}
                className="px-2 py-0.5 bg-slate-900 text-white rounded text-[11px] hover:bg-slate-800 transition"
              >
                重新测量
              </button>
              <button
                id="btn-close-measure"
                onClick={() => {
                  setIsRulerActive(false);
                  setMeasurePointA(null);
                  setMeasurePointB(null);
                  setMeasurement(null);
                }}
                className="p-1 hover:bg-amber-600 rounded transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Main Canvas Chart Container */}
      <div
        className="relative w-full flex-1 min-h-[300px] select-none"
        style={{ height: `${height}px` }}
        onMouseLeave={() => {
          setHoveredBar(null);
          setHoveredPoint(null);
          setHoveredMarker(null);
        }}
      >
        <div ref={chartContainerRef} className="w-full h-full select-none" />

        {/* Dynamic Floating OHLCV Crosshair Tooltip */}
        {hoveredBar && hoveredPoint && (
          <div
            className="pointer-events-none absolute z-30 transition-transform duration-75 ease-out"
            style={{
              left: `${Math.min(Math.max(hoveredPoint.x + 16, 12), (chartContainerRef.current?.clientWidth || 500) - 210)}px`,
              top: `${Math.min(Math.max(hoveredPoint.y - 40, 10), height - 160)}px`,
            }}
          >
            <div className={`p-2.5 rounded-xl border shadow-2xl backdrop-blur-md text-xs font-mono w-48 space-y-1.5 transition-all ${
              isDark
                ? 'bg-slate-900/95 border-slate-700/80 text-slate-200'
                : 'bg-white/95 border-slate-200 text-slate-800'
            }`}>
              <div className="flex items-center justify-between border-b pb-1 dark:border-slate-800 text-[11px]">
                <span className="font-sans font-semibold text-slate-500 dark:text-slate-400">
                  {formatDate(hoveredBar.time)}
                </span>
                <span className={`font-bold ${
                  hoveredBar.close >= hoveredBar.open
                    ? (upColor === '#10b981' ? 'text-emerald-500' : 'text-rose-500')
                    : (upColor === '#10b981' ? 'text-rose-500' : 'text-emerald-500')
                }`}>
                  {hoveredBar.close >= hoveredBar.open ? '+' : ''}
                  {(((hoveredBar.close - hoveredBar.open) / hoveredBar.open) * 100).toFixed(2)}%
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">开盘</span>
                  <span>{formatPrice(hoveredBar.open)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">最高</span>
                  <span className="text-emerald-500">{formatPrice(hoveredBar.high)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">最低</span>
                  <span className="text-rose-500">{formatPrice(hoveredBar.low)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">收盘</span>
                  <span className="font-bold">{formatPrice(hoveredBar.close)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 border-t pt-1 dark:border-slate-800">
                <span>成交量:</span>
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {hoveredBar.volume?.toLocaleString() || '--'}
                </span>
              </div>

              {showMA && (hoveredBar.ma5 || hoveredBar.ma10) && (
                <div className="flex items-center justify-between text-[10px] text-slate-400 border-t pt-1 dark:border-slate-800">
                  <span className="text-amber-400">MA5: {formatPrice(hoveredBar.ma5)}</span>
                  <span className="text-cyan-400">MA10: {formatPrice(hoveredBar.ma10)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hovered News Event Marker Tooltip Card */}
        {hoveredMarker && (
          <div className="absolute top-3 right-3 max-w-xs z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-2.5 rounded-xl border border-blue-200 dark:border-blue-800 shadow-xl text-xs transition animate-in fade-in">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold text-[10px]">
                {hoveredMarker.source}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">{formatDate(hoveredMarker.time)}</span>
            </div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 mb-1.5">
              {hoveredMarker.title}
            </div>
            {onSelectNewsMarker && (
              <button
                id="btn-view-marker-news"
                onClick={() => onSelectNewsMarker(hoveredMarker)}
                className="w-full py-1 text-center font-bold text-[11px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 rounded-lg hover:bg-blue-100 transition flex items-center justify-center gap-1"
              >
                <span>阅读该节点重磅深度研报</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 5. Beginner-Friendly Indicator & Technical Guide Modal */}
      {isGuideOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
                <HelpCircle className="w-5 h-5 text-blue-500" />
                <span>新手速懂：走势图、K线与技术指标解读指南</span>
              </div>
              <button
                id="btn-close-guide-modal"
                onClick={() => setIsGuideOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-blue-500" />
                  <span>1. 什么是蜡烛图 (K线 / Candlesticks)？</span>
                </div>
                <p>
                  一根K线记录了一个时间周期（如1天或1小时）内的四个关键价格：<strong>开盘价(Open)</strong>、<strong>最高价(High)</strong>、<strong>最低价(Low)</strong> 与 <strong>收盘价(Close)</strong>。收盘价高于开盘价代表上涨（阳线），反之为下跌（阴线）。上下两端的细线称为“影线”，代表曾触及的最高与最低极值。
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                  <span>2. 移动平均线 (MA5 / MA10 / MA20 / MA60)</span>
                </div>
                <p>
                  均线是将过去特定天数的收盘价取平均值连接成的平滑曲线。<strong>MA5/10</strong> 代表短期动能，<strong>MA20</strong> 对应月线生命线，<strong>MA60</strong> 代表中长期牛熊分水岭。当短周期均线上穿长周期均线时，通常称为“金叉（看多信号）”。
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Ruler className="w-4 h-4 text-emerald-500" />
                  <span>3. 标尺测距工具 (Ruler) 如何使用？</span>
                </div>
                <p>
                  点击顶部工具栏的<strong>【标尺测距】</strong>按钮，依次在图表上点击买入点与卖出点（或任意两个高低点），系统将自动为您精确计算出该区间的<strong>真实涨跌金额、涨跌百分比、经历K线周期数与时间跨度</strong>。
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span>4. 底部副图指标 (MACD 与 RSI)</span>
                </div>
                <p>
                  <strong>RSI(相对强弱指标)</strong>：数值介于0~100。高于70代表处于“超买区”（警惕回调），低于30代表“超卖区”（存在反弹动能）。<br/>
                  <strong>MACD</strong>：利用快慢平滑均线差值判断行情背离与动能强弱。
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                id="btn-got-it-guide"
                onClick={() => setIsGuideOpen(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition"
              >
                我已了解，开始看盘
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
