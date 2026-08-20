import { MarketQuote } from '../types';

/**
 * 实时行情同步与聚合层（纯真实数据 & 严格 Epoch 时间戳架构）
 * ------------------------------------------------------------------
 * 核心准则：
 * 1. 彻底清除所有合成 K 线、布朗桥插值、伪造价差与随机抖动逻辑；
 * 2. 100% 依赖真实行情源：服务端 /api/market/rates 聚合网关（Yahoo Finance 真实 OHLC + Binance 真实 K 线 / 24hr Ticker + 新浪银行间外汇/ECB）；
 * 3. 后端 / 协议层传输严格保持为 Epoch Unix 秒时间戳（timestamp: number），消除后端时区格式化导致的显示漂移与数据不自洽；
 * 4. 所有时分秒、日期等展示格式化，统一在前端根据用户本地时区（Intl / Local Date）计算渲染；
 * 5. 缺失数据字段诚实保持 undefined，UI 统一展示 "—"，不凭空编造。
 */

export interface LiveRateDetail {
  price: number;
  change?: number;
  changePercent?: number;
  high?: number;
  low?: number;
  open?: number;
  prevClose?: number;
  sparkline?: number[];
  intradaySeries?: Array<{ time: string; price: number; volume?: number }>;
  timestamp?: number;   // Epoch Unix 秒时间戳
  stale?: boolean;
  approximate?: boolean;
  source?: string;
}

// 本地真实 tick 环形缓冲（仅用于极端离线断网时保留用户已接收到的真实 tick，绝不补噪）
const realTickBuffer = new Map<string, Array<{ t: number; p: number }>>();
const TICK_BUFFER_MAX = 120;

function pushRealTick(symbol: string, price: number, nowSec: number) {
  const buf = realTickBuffer.get(symbol) || [];
  const last = buf[buf.length - 1];
  // 30 秒内仅保留最新 tick 避免过度冗余
  if (last && nowSec - last.t < 30) {
    buf[buf.length - 1] = { t: nowSec, p: price };
  } else {
    buf.push({ t: nowSec, p: price });
  }
  // 保留最近 24 小时内的真实 tick
  const cutoff = nowSec - 86400;
  const trimmed = buf.filter((x) => x.t >= cutoff).slice(-TICK_BUFFER_MAX);
  realTickBuffer.set(symbol, trimmed);
}

function realSparkline(symbol: string): number[] | undefined {
  const buf = realTickBuffer.get(symbol);
  if (!buf || buf.length < 2) return undefined;
  return buf.map((x) => x.p);
}

/**
 * 将 Epoch 秒时间戳序列转换为前端用户本地时区 HH:mm 格式
 * 严格基于用户本地系统时区 (User's Local Timezone)，彻底解决服务器时区漂移问题
 */
function localizeIntradaySeries(
  series: Array<{ time: number | string; price: number; volume?: number }>
): Array<{ time: string; price: number; volume?: number }> {
  return series.map((pt) => {
    if (typeof pt.time === 'number') {
      const d = new Date(pt.time * 1000);
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return {
        time: `${hours}:${minutes}`,
        price: pt.price,
        volume: pt.volume,
      };
    }
    return pt as { time: string; price: number; volume?: number };
  });
}

/**
 * 格式化本地用户时区的时间字符串 (HH:mm:ss)
 */
export function formatLocalTime(epochSec?: number): string {
  const d = epochSec ? new Date(epochSec * 1000) : new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/**
 * 主同步入口：服务端 Yahoo/Binance 真实聚合优先，客户端官方 API 直连兜底。
 * 不包含任何合成 K 线或数学模拟生成逻辑。
 */
export async function fetchLiveForexAndCryptoRates(): Promise<Partial<Record<string, LiveRateDetail>>> {
  const rates: Partial<Record<string, LiveRateDetail>> = {};
  const nowSec = Math.floor(Date.now() / 1000);

  // 1. 服务端真实聚合网关（Yahoo Finance 真实 1d/5m OHLC + Binance 真实实时 K 线）
  try {
    const serverRes = await fetch('/api/market/rates', { signal: AbortSignal.timeout(6000) });
    if (serverRes.ok) {
      const json = await serverRes.json();
      if (json.success && json.rates) {
        for (const [sym, item] of Object.entries<any>(json.rates)) {
          const price = typeof item.price === 'number' ? item.price : parseFloat(item.price);
          if (isNaN(price) || price <= 0) continue;
          
          pushRealTick(sym, price, nowSec);

          const itemTimestamp = typeof item.timestamp === 'number' ? item.timestamp : nowSec;

          rates[sym] = {
            price,
            // 真实字段映射，缺失保持 undefined，绝不虚构
            change: typeof item.change === 'number' ? item.change : undefined,
            changePercent: typeof item.changePercent === 'number' ? item.changePercent : undefined,
            high: typeof item.high === 'number' ? Math.max(item.high, price) : undefined,
            low: typeof item.low === 'number' ? Math.min(item.low, price) : undefined,
            open: typeof item.open === 'number' ? item.open : undefined,
            prevClose: typeof item.prevClose === 'number' ? item.prevClose : undefined,
            sparkline:
              Array.isArray(item.intradaySeries) && item.intradaySeries.length >= 5
                ? item.intradaySeries.map((x: any) => x.price)
                : realSparkline(sym),
            intradaySeries:
              Array.isArray(item.intradaySeries) && item.intradaySeries.length > 0
                ? localizeIntradaySeries(item.intradaySeries)
                : undefined,
            timestamp: itemTimestamp,
            stale: Boolean(item.stale),
            approximate: Boolean(item.approximate),
            source: item.source || 'Yahoo Finance / Binance Live',
          };
        }
        if (Object.keys(rates).length > 0) return rates;
      }
    }
  } catch {
    // 服务端异常时降级至客户端直连真实官方 API
  }

  // 2. 客户端兜底 A：Binance 官方公共 API 直连（真实 24hr Ticker）
  try {
    const cryptoRes = await fetch(
      'https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT","SOLUSDT","DOGEUSDT","BNBUSDT","XRPUSDT"]',
      { signal: AbortSignal.timeout(4000) }
    );
    if (cryptoRes.ok) {
      const data = await cryptoRes.json();
      if (Array.isArray(data)) {
        const symMap: Record<string, string> = {
          BTCUSDT: 'BTC/USD',
          ETHUSDT: 'ETH/USD',
          SOLUSDT: 'SOL/USD',
          DOGEUSDT: 'DOGE/USD',
          BNBUSDT: 'BNB/USD',
          XRPUSDT: 'XRP/USD',
        };
        for (const item of data) {
          const symbol = symMap[item.symbol];
          if (!symbol) continue;
          const price = parseFloat(item.lastPrice);
          if (isNaN(price) || price <= 0) continue;

          pushRealTick(symbol, price, nowSec);
          rates[symbol] = {
            price,
            change: parseFloat(item.priceChange),
            changePercent: parseFloat(item.priceChangePercent),
            high: parseFloat(item.highPrice),
            low: parseFloat(item.lowPrice),
            open: parseFloat(item.openPrice),
            prevClose: parseFloat(item.prevPrice || item.openPrice),
            sparkline: realSparkline(symbol),
            timestamp: nowSec,
            source: 'Binance 直连官方源',
          };
        }
      }
    }
  } catch {
    // absorbed
  }

  // 3. 客户端兜底 B：open.er-api 外汇中间汇率（日频真实中间价，只给 price，不伪造涨跌）
  try {
    const fxRes = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(4000) });
    if (fxRes.ok) {
      const data = await fxRes.json();
      const fx = data?.rates || {};
      const put = (symbol: string, val: number | undefined, digits: number) => {
        if (typeof val !== 'number' || isNaN(val) || rates[symbol]) return;
        const price = Number(val.toFixed(digits));
        pushRealTick(symbol, price, nowSec);
        rates[symbol] = {
          price,
          sparkline: realSparkline(symbol),
          timestamp: nowSec,
          approximate: true,
          source: 'open.er-api 真实中间价（日频）',
        };
      };
      put('USD/JPY', fx.JPY, 2);
      put('EUR/USD', fx.EUR ? 1 / fx.EUR : undefined, 4);
      put('GBP/USD', fx.GBP ? 1 / fx.GBP : undefined, 4);
      put('AUD/USD', fx.AUD ? 1 / fx.AUD : undefined, 4);
      put('USD/CNH', fx.CNH || fx.CNY, 4);
      put('USD/HKD', fx.HKD, 4);
    }
  } catch {
    // absorbed
  }

  return rates;
}

/**
 * 把真实行情应用到 quotes 状态。
 * 1. 仅覆盖已真实获取到的字段，缺失字段保留原状并诚实标注；
 * 2. 所有时间标签统一由前端基于当前本地时间与返回的 Epoch 时间戳渲染；
 * 3. 绝不插值或合成虚假 K 线数据。
 */
export function applyLiveRatesToQuotes(
  prevQuotes: MarketQuote[],
  liveRates: Partial<Record<string, LiveRateDetail>>
): MarketQuote[] {
  const now = new Date();
  const localTimeStr = formatLocalTime(Math.floor(now.getTime() / 1000));

  return prevQuotes.map((quote) => {
    const live = liveRates[quote.symbol];
    if (!live || !live.price || isNaN(live.price)) {
      return quote;
    }

    const newPrice = live.price;
    const openPrice = live.open ?? quote.openPrice;
    const prevClose = live.prevClose ?? quote.prevClose;

    // 涨跌幅计算口径：优先真实行情源直接给出的 change，缺失且有真实昨收时按公允计算，否则不改动
    let newChange = quote.change;
    let newChangePercent = quote.changePercent;
    if (typeof live.change === 'number') {
      newChange = live.change;
      newChangePercent = typeof live.changePercent === 'number'
        ? live.changePercent
        : prevClose && prevClose > 0 ? Number(((live.change / prevClose) * 100).toFixed(2)) : quote.changePercent;
    } else if (typeof prevClose === 'number' && prevClose > 0 && !live.approximate) {
      newChange = Number((newPrice - prevClose).toFixed(quote.category === 'forex' ? 4 : quote.category === 'yield' ? 3 : 2));
      newChangePercent = Number(((newPrice - prevClose) / prevClose * 100).toFixed(2));
    }

    // sparkline：优先真实 Yahoo/Binance 历史序列，其次追加本地真实累积 tick，绝不补噪
    let newSparkline: number[] = quote.sparkline;
    if (live.sparkline && live.sparkline.length >= 2) {
      newSparkline = live.sparkline.slice(-40);
    } else if (quote.sparkline && quote.sparkline.length > 0) {
      newSparkline = [...quote.sparkline.slice(-39), newPrice];
    } else {
      newSparkline = [newPrice];
    }

    // 分时序列：优先真实 Yahoo 1d/5m 分时序列，无则在现有分时后追加真实本地点
    let newIntradaySeries = quote.intradaySeries;
    if (live.intradaySeries && live.intradaySeries.length > 0) {
      newIntradaySeries = live.intradaySeries;
    } else if (quote.intradaySeries && quote.intradaySeries.length > 0) {
      const curHourMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const lastPoint = quote.intradaySeries[quote.intradaySeries.length - 1];
      if (lastPoint.time === curHourMin) {
        newIntradaySeries = [...quote.intradaySeries.slice(0, -1), { ...lastPoint, price: newPrice }];
      } else {
        newIntradaySeries = [...quote.intradaySeries.slice(-119), { time: curHourMin, price: newPrice }];
      }
    }

    // 本地时间格式化渲染更新标签
    const timeFormatted = live.timestamp ? formatLocalTime(live.timestamp) : localTimeStr;
    const statusLabel = live.approximate
      ? `参考价 (${timeFormatted})`
      : live.stale
        ? `延迟 (${timeFormatted})`
        : `实时 (${timeFormatted})`;

    return {
      ...quote,
      price: newPrice,
      change: newChange,
      changePercent: newChangePercent,
      high: typeof live.high === 'number' ? live.high : quote.high,
      low: typeof live.low === 'number' ? live.low : quote.low,
      openPrice: openPrice,
      prevClose: prevClose,
      sparkline: newSparkline,
      intradaySeries: newIntradaySeries,
      updateTime: statusLabel,
    };
  });
}
