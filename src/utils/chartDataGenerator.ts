import { MarketQuote, NewsItem } from '../types';

export interface OHLCVBar {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ma5?: number;
  ma10?: number;
  ma20?: number;
  ma60?: number;
  bollUpper?: number;
  bollMid?: number;
  bollLower?: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHist?: number;
}

export interface ChartNewsMarker {
  time: number; // Unix timestamp in seconds
  id: string;
  title: string;
  source: string;
  category: string;
  impact: 'bullish' | 'bearish' | 'neutral';
}

/**
 * Deterministic pseudo-random number generator for stable chart data
 */
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

/**
 * Deterministic hash from symbol string
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Compute Technical Indicators (MA, Bollinger Bands, RSI, MACD) on any OHLCV dataset
 */
export function computeTechnicalIndicators(bars: OHLCVBar[], precision: number = 2): OHLCVBar[] {
  if (!bars || bars.length === 0) return [];

  // Calculate Moving Averages (MA5, MA10, MA20, MA60)
  for (let i = 0; i < bars.length; i++) {
    // MA5
    if (i >= 4) {
      const slice = bars.slice(i - 4, i + 1);
      bars[i].ma5 = Number((slice.reduce((acc, b) => acc + b.close, 0) / 5).toFixed(precision));
    }
    // MA10
    if (i >= 9) {
      const slice = bars.slice(i - 9, i + 1);
      bars[i].ma10 = Number((slice.reduce((acc, b) => acc + b.close, 0) / 10).toFixed(precision));
    }
    // MA20
    if (i >= 19) {
      const slice = bars.slice(i - 19, i + 1);
      const mean = slice.reduce((acc, b) => acc + b.close, 0) / 20;
      bars[i].ma20 = Number(mean.toFixed(precision));

      // Bollinger Bands (20, 2)
      const variance = slice.reduce((acc, b) => acc + Math.pow(b.close - mean, 2), 0) / 20;
      const stdDev = Math.sqrt(variance);
      bars[i].bollMid = Number(mean.toFixed(precision));
      bars[i].bollUpper = Number((mean + 2 * stdDev).toFixed(precision));
      bars[i].bollLower = Number((mean - 2 * stdDev).toFixed(precision));
    }
    // MA60
    if (i >= 59) {
      const slice = bars.slice(i - 59, i + 1);
      bars[i].ma60 = Number((slice.reduce((acc, b) => acc + b.close, 0) / 60).toFixed(precision));
    }
  }

  // Calculate RSI (14)
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < bars.length; i++) {
    const change = bars[i].close - bars[i - 1].close;
    if (i <= 14) {
      if (change > 0) gains += change;
      else losses += Math.abs(change);
      if (i === 14) {
        const avgGain = gains / 14;
        const avgLoss = losses / 14;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        bars[i].rsi = Number((100 - (100 / (1 + rs))).toFixed(1));
      }
    } else {
      const currentGain = change > 0 ? change : 0;
      const currentLoss = change < 0 ? Math.abs(change) : 0;
      gains = (gains * 13 + currentGain) / 14;
      losses = (losses * 13 + currentLoss) / 14;
      const rs = losses === 0 ? 100 : gains / losses;
      bars[i].rsi = Number((100 - (100 / (1 + rs))).toFixed(1));
    }
  }

  // Calculate MACD (12, 26, 9)
  let ema12 = bars[0].close;
  let ema26 = bars[0].close;
  let dea = 0;

  for (let i = 0; i < bars.length; i++) {
    const c = bars[i].close;
    ema12 = c * (2 / 13) + ema12 * (1 - 2 / 13);
    ema26 = c * (2 / 27) + ema26 * (1 - 2 / 27);
    const dif = ema12 - ema26;

    if (i === 0) {
      dea = dif;
    } else {
      dea = dif * (2 / 10) + dea * (1 - 2 / 10);
    }
    const hist = (dif - dea) * 2;

    bars[i].macd = Number(dif.toFixed(2));
    bars[i].macdSignal = Number(dea.toFixed(2));
    bars[i].macdHist = Number(hist.toFixed(2));
  }

  return bars;
}

/**
 * Fallback generator strictly used when network is offline
 * Stable seed based on hash(symbol) + today's date so history does not rewrite or breathe
 */
export function generateSymbolChartData(
  symbol: string,
  basePrice: number,
  baseChangePercent: number = 0,
  timeframe: string = '1D',
  barsCount: number = 100
): { bars: OHLCVBar[]; markers: ChartNewsMarker[] } {
  // Determine asset precision
  const isForex = symbol.includes('/') && !symbol.includes('BTC') && !symbol.includes('ETH') && !symbol.includes('SOL');
  const isYield = symbol.includes('10Y') || symbol.includes('2Y') || symbol.includes('30Y');
  const isJpy = symbol.includes('JPY');
  const precision = isJpy ? 2 : isYield ? 3 : isForex ? 4 : basePrice > 500 ? 2 : 2;

  // Calculate base volatility
  let volatility = 0.012;
  if (symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('SOL') || symbol.includes('DOGE')) {
    volatility = 0.028;
  } else if (symbol.includes('NVDA') || symbol.includes('TSLA') || symbol.includes('PLTR') || symbol.includes('HTFL')) {
    volatility = 0.022;
  } else if (isForex || isYield) {
    volatility = 0.0035;
  }

  // Determine interval in seconds and timeframe specific characteristics
  let intervalSec = 86400; // default 1D
  let timeframeSeedOffset = 0;
  let timeframeTrendMultiplier = 1;
  switch (timeframe) {
    case '15m':
      intervalSec = 900;
      volatility = volatility * 0.65;
      timeframeSeedOffset = 3041;
      timeframeTrendMultiplier = 0.7;
      break;
    case '1H':
    case '1h':
      intervalSec = 3600;
      volatility = volatility * 0.85;
      timeframeSeedOffset = 4057;
      timeframeTrendMultiplier = 0.9;
      break;
    case '1D':
    case '24H':
      intervalSec = 86400;
      volatility = volatility * 1.2;
      timeframeSeedOffset = 5077;
      timeframeTrendMultiplier = 1.3;
      break;
    case '1W':
    case '5D':
      intervalSec = 86400 * 7;
      volatility = volatility * 1.8;
      timeframeSeedOffset = 6091;
      timeframeTrendMultiplier = 2.0;
      break;
    case '1M':
    case '1Y':
    case 'ALL':
      intervalSec = 86400 * 30;
      volatility = volatility * 2.6;
      timeframeSeedOffset = 7121;
      timeframeTrendMultiplier = 2.8;
      break;
    default:
      intervalSec = 86400;
      timeframeSeedOffset = 5077;
  }

  // Stable seed anchored to symbol hash and calendar date
  const now = new Date();
  const dateKey = `${now.getFullYear()}${now.getMonth()}${now.getDate()}`;
  const seed = (hashString(symbol) % 100000) + parseInt(dateKey, 10) + timeframeSeedOffset;

  const nowSec = Math.floor(Date.now() / 1000);
  const currentIntervalFloor = Math.floor(nowSec / intervalSec) * intervalSec;
  const startTime = currentIntervalFloor - (barsCount - 1) * intervalSec;

  const effectiveChangeRatio = (baseChangePercent / 100) * timeframeTrendMultiplier;
  const startPrice = basePrice / (1 + effectiveChangeRatio);

  const bars: OHLCVBar[] = [];
  let previousClose = startPrice;

  for (let i = 0; i < barsCount; i++) {
    const t = startTime + i * intervalSec;
    const progress = i / (barsCount - 1 || 1);

    const r1 = seededRandom(seed + i * 7);
    const r2 = seededRandom(seed + i * 13);
    const r3 = seededRandom(seed + i * 19);
    const r4 = seededRandom(seed + i * 23);

    const linearTrendPrice = startPrice + (basePrice - startPrice) * progress;
    const bridgeVariance = Math.sin(progress * Math.PI) * volatility * basePrice;
    const harmonicWave = Math.sin(progress * Math.PI * 3 + (seed % 10)) * bridgeVariance * 0.8;
    const randomJitter = (r1 - 0.49) * volatility * basePrice * 0.5;

    let targetBarClose = linearTrendPrice + harmonicWave + randomJitter;
    if (i === barsCount - 1) {
      targetBarClose = basePrice;
    }

    const open = i === 0 ? startPrice : previousClose;
    const close = targetBarClose;

    const barSpread = Math.abs(close - open);
    const upperWick = r2 * (volatility * basePrice * 0.6 + barSpread * 0.4);
    const lowerWick = r3 * (volatility * basePrice * 0.6 + barSpread * 0.4);

    const high = Math.max(open, close) + upperWick;
    const low = Math.max(Math.min(open, close) - lowerWick, 0.0001);

    const baseVol = basePrice > 1000 ? 4000 : 120000;
    const volMultiplier = (1 + r4 * 2.2) * (1 + barSpread / (basePrice * volatility + 0.0001));
    const volume = Math.floor(baseVol * volMultiplier);

    bars.push({
      time: t,
      open: Number(open.toFixed(precision)),
      high: Number(high.toFixed(precision)),
      low: Number(low.toFixed(precision)),
      close: Number(close.toFixed(precision)),
      volume: volume,
    });

    previousClose = close;
  }

  computeTechnicalIndicators(bars, precision);

  // Generate timeline markers (simulated key macro/news events)
  const markers: ChartNewsMarker[] = [];
  if (bars.length > 20) {
    const p1 = Math.floor(bars.length * 0.3);
    const p2 = Math.floor(bars.length * 0.65);
    const p3 = Math.floor(bars.length * 0.88);

    markers.push({
      time: bars[p1].time,
      id: `news-marker-1`,
      title: `${symbol} 核心财报与财测发布，机构持仓异动`,
      source: '彭博社 Bloomberg',
      category: 'earnings',
      impact: bars[p1].close >= bars[p1].open ? 'bullish' : 'bearish',
    });

    markers.push({
      time: bars[p2].time,
      id: `news-marker-2`,
      title: `美联储议息纪要公布：基准利率政策与宏观流动性指引`,
      source: '路透社 Reuters',
      category: 'macro',
      impact: bars[p2].close >= bars[p2].open ? 'bullish' : 'bearish',
    });

    markers.push({
      time: bars[p3].time,
      id: `news-marker-3`,
      title: `行业监管动态与巨头供应链战略更新`,
      source: '华尔街日报 WSJ',
      category: 'policy',
      impact: 'neutral',
    });
  }

  return { bars, markers };
}
