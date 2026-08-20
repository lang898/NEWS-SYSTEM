export type SourceId = 'reuters' | 'bloomberg' | 'ft' | 'wsj' | 'wscn' | 'cnbc' | 'caixin';

export type UrgencyLevel = 'flash' | 'major' | 'regular' | 'alert';
export type MarketSentiment = 'bullish' | 'bearish' | 'neutral';

export interface SourceConfig {
  id: SourceId;
  name: string;
  nameCn: string;
  stars: number;
  ratingText: string;
  bestFor: string;
  userReview: string;
  badgeBg: string;
  badgeText: string;
  iconName: string;
  requiresAuthForFull: boolean;
  officialUrl: string;
  supportsMarsConnect?: boolean;
}

export interface ImpactAnalysis {
  equities: string;
  forex: string;
  bonds: string;
  commodities: string;
}

export interface NewsItem {
  id: string;
  sourceId: SourceId;
  title: string;
  titleCn: string;
  summary: string;
  summaryCn: string;
  content: string;
  contentCn: string;
  publishedAt?: string;
  timestamp?: number; // Unix timestamp in seconds for local timezone conversion
  urgency: UrgencyLevel;
  sentiment: MarketSentiment;
  assetClasses: string[];
  tags: string[];
  isPremium: boolean;
  url: string;
  author?: string;
  sourceTier?: 'tier1' | 'tier2' | 'tier3';
  sources?: string[];
  relatedSymbols?: string[];
  aiBullets?: string[];
  aiSentimentAnalysis?: {
    sentiment: MarketSentiment;
    confidence?: number;
    explanation?: string;
    timestamp?: string;
  };
  impactAnalysis?: ImpactAnalysis;
  readCount?: number;
  unlocked?: boolean;
}

export interface MarketQuote {
  symbol: string;
  name: string;
  nameCn: string;
  category: 'index' | 'forex' | 'yield' | 'commodity' | 'crypto' | 'stock';
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  sparkline: number[];
  unit: string;
  updateTime: string;
  openPrice?: number;
  prevClose?: number;
  amplitude?: string;
  turnover?: string;
  driverSummary?: string;
  yearHigh?: number;
  yearLow?: number;
  intradaySeries?: { time: string; price: number; volume?: number }[];
  fiveDaySeries?: { time: string; price: number }[];
  oneMonthSeries?: { time: string; price: number }[];
}

export interface AccountSession {
  sourceId: SourceId;
  isConnected: boolean;
  username?: string;
  accountType?: string;
  expiry?: string;
  connectionMethod?: 'marsconnect' | 'credentials' | 'api_token' | 'sso';
  lastSync?: string;
  authTokenMasked?: string;
}

export interface MacroCalendarEvent {
  id: string;
  date: string; // '2026-08-16', '2026-08-17', etc.
  time: string; // '20:30', '09:30', etc.
  country: string;
  flag: string;
  event: string;
  type?: 'event' | 'data'; // 'event' for speeches/holidays/conferences, 'data' for statistical releases
  category?: 'heavy' | 'macro' | 'forex' | 'commodity' | 'bonds' | 'ashares' | 'hkstocks' | 'usstocks';
  prefix?: string; // e.g. '前瞻', '独家', '决议'
  description?: string;
  actual?: string;
  forecast?: string;
  previous?: string;
  importance: 1 | 2 | 3;
  impact?: 'bullish' | 'bearish' | 'neutral' | 'pending';
  affectAssets?: string[];
  sourceDept?: string;
}

export interface AICopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sourcesReferenced?: SourceId[];
}
