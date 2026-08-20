import React, { useState, useEffect } from 'react';
import {
  Zap,
  Volume2,
  VolumeX,
  Sparkles,
  KeyRound,
  Layers,
  Radio,
  Clock,
  TrendingUp,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  BellRing,
  Star,
  Calendar
} from 'lucide-react';
import { MarketQuote, AccountSession, SourceId } from '../types';
import { soundManager } from '../utils/audio';

interface HeaderProps {
  quotes: MarketQuote[];
  sessions: Record<SourceId, AccountSession>;
  isLivePushing: boolean;
  setIsLivePushing: (val: boolean | ((prev: boolean) => boolean)) => void;
  onOpenAccountHub: () => void;
  onOpenCopilot: () => void;
  activeView: 'feed' | 'calendar' | 'matrix' | 'markets' | 'synthesis' | 'accounts' | 'watchlist' | 'asset-detail';
  setActiveView: (view: 'feed' | 'calendar' | 'matrix' | 'markets' | 'synthesis' | 'accounts' | 'watchlist' | 'asset-detail') => void;
  followedNewsIds?: string[];
  followedQuoteSymbols?: string[];
  onSelectTicker?: (symbol: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  quotes,
  sessions,
  isLivePushing,
  setIsLivePushing,
  onOpenAccountHub,
  onOpenCopilot,
  activeView,
  setActiveView,
  followedNewsIds = [],
  followedQuoteSymbols = [],
  onSelectTicker,
}) => {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundManager.setSoundEnabled(next);
    if (next) soundManager.playNewsPing('normal');
  };

  const connectedCount = (Object.values(sessions) as AccountSession[]).filter((s) => s?.isConnected).length;
  const isMarsConnectConnected = sessions.caixin?.isConnected && sessions.caixin?.connectionMethod === 'marsconnect';
  const totalWatchlistCount = followedNewsIds.length + followedQuoteSymbols.length;

  const formatCityTime = (timeZone: string) => {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(currentTime);
  };

  return (
    <header id="main-header" className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      {/* Top Real-time Quotes Ticker Bar (Light Theme) */}
      <div id="ticker-ribbon" className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 overflow-x-auto no-scrollbar flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5 text-emerald-700 font-mono font-semibold shrink-0 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span>MARKET TICKER</span>
        </div>

        <div className="flex items-center gap-6 shrink-0 font-mono">
          {quotes.map((q) => {
            const isUp = q.change >= 0;
            const isFollowed = followedQuoteSymbols.includes(q.symbol);
            return (
              <div
                key={q.symbol}
                onClick={() => onSelectTicker && onSelectTicker(q.symbol)}
                className="flex items-center gap-2 hover:bg-slate-200/60 px-1.5 py-0.5 rounded transition cursor-pointer"
                title="点击进入独立深度走势图与关联情报分析"
              >
                {isFollowed && <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-500" />}
                <span className="text-slate-600 font-medium">{q.name}</span>
                <span className="text-slate-900 font-bold">{q.price.toLocaleString()}</span>
                <span className={`flex items-center text-[11px] font-semibold ${isUp ? 'text-red-600' : 'text-emerald-600'}`}>
                  {isUp ? '+' : ''}{q.changePercent.toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>

        {/* Global Market Clocks */}
        <div className="ml-auto shrink-0 flex items-center gap-3 text-[11px] text-slate-500 border-l border-slate-200 pl-3 font-mono">
          <span className="flex items-center gap-1">
            <span className="text-slate-400">北京</span>
            <span className="text-slate-800 font-semibold">{formatCityTime('Asia/Shanghai')}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="text-slate-400">纽约</span>
            <span className="text-slate-800 font-semibold">{formatCityTime('America/New_York')}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="text-slate-400">伦敦</span>
            <span className="text-slate-800 font-semibold">{formatCityTime('Europe/London')}</span>
          </span>
        </div>
      </div>

      {/* Sleek Dark Pro Navigation Ribbon */}
      <div className="bg-slate-950 text-slate-300 border-b border-slate-800 px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left Portfolio & Category Quick Links */}
        <div className="flex items-center gap-5 font-medium text-xs text-slate-400 overflow-x-auto no-scrollbar py-0.5">
          <span
            className={`cursor-pointer transition hover:text-white ${
              activeView === 'watchlist' ? 'text-white font-bold' : ''
            }`}
            onClick={() => setActiveView('watchlist')}
          >
            My Portfolio
          </span>
          <span
            className={`cursor-pointer transition hover:text-white ${
              activeView === 'feed' ? 'text-white font-bold' : ''
            }`}
            onClick={() => setActiveView('feed')}
          >
            News
          </span>
          <span
            className={`cursor-pointer transition hover:text-white ${
              activeView === 'markets' ? 'text-white font-bold' : ''
            }`}
            onClick={() => setActiveView('markets')}
          >
            Markets
          </span>
          <span
            className={`cursor-pointer transition hover:text-white ${
              activeView === 'calendar' ? 'text-white font-bold' : ''
            }`}
            onClick={() => setActiveView('calendar')}
          >
            Calendars
          </span>
          <span
            className={`cursor-pointer transition hover:text-white ${
              activeView === 'matrix' ? 'text-white font-bold' : ''
            }`}
            onClick={() => setActiveView('matrix')}
          >
            Research
          </span>
          <span
            className={`cursor-pointer transition hover:text-white ${
              activeView === 'synthesis' ? 'text-white font-bold' : ''
            }`}
            onClick={() => setActiveView('synthesis')}
          >
            AI Synthesis
          </span>
        </div>

        {/* Right Status Indicator */}
        <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>MULTI-SOURCE FINANCIAL DESK</span>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-[1720px] w-full mx-auto px-4 sm:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveView('feed')}>
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
                Global FinPulse
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  Terminal Pro
                </span>
              </h1>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              全球多源财经深度情报 · 彭博 / 路透 / 财新(MarsConnect) / FT / WSJ 聚合
            </p>
          </div>
        </div>

        {/* Center: View Navigation Switcher */}
        <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-medium">
          <button
            id="nav-tab-feed"
            onClick={() => setActiveView('feed')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeView === 'feed'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>首页聚合</span>
          </button>
          <button
            id="nav-tab-calendar"
            onClick={() => setActiveView('calendar')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeView === 'calendar'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>财经日历</span>
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
          </button>
          <button
            id="nav-tab-watchlist"
            onClick={() => setActiveView('watchlist')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeView === 'watchlist'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
            <span>我的关注</span>
            {totalWatchlistCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold ${
                activeView === 'watchlist' ? 'bg-white text-blue-600' : 'bg-amber-100 text-amber-800'
              }`}>
                {totalWatchlistCount}
              </span>
            )}
          </button>
          <button
            id="nav-tab-matrix"
            onClick={() => setActiveView('matrix')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeView === 'matrix'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>媒体专栏矩阵</span>
          </button>
          <button
            id="nav-tab-markets"
            onClick={() => setActiveView('markets')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeView === 'markets'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>行情中心</span>
          </button>
          <button
            id="nav-tab-synthesis"
            onClick={() => setActiveView('synthesis')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeView === 'synthesis'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI 宏观内参</span>
          </button>
          <button
            id="nav-tab-accounts"
            onClick={() => setActiveView('accounts')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeView === 'accounts'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>MarsConnect 设置</span>
            {connectedCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-emerald-500 text-white font-mono text-[10px] flex items-center justify-center font-bold">
                {connectedCount}
              </span>
            )}
          </button>
        </nav>

        {/* Right: Controls & Shortcuts */}
        <div className="flex items-center gap-2">
          {/* Live Push Streaming Toggle */}
          <button
            id="btn-toggle-live-push"
            onClick={() => setIsLivePushing((prev) => !prev)}
            title={isLivePushing ? '点击暂停实时推送' : '点击开启实时推送'}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 border transition ${
              isLivePushing
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs'
                : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isLivePushing ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`}></span>
            <span>{isLivePushing ? 'LIVE 推送中' : '推送暂停'}</span>
          </button>

          {/* Sound Alert Toggle */}
          <button
            id="btn-toggle-sound"
            onClick={toggleSound}
            title={soundEnabled ? '突发声音提醒已开启' : '声音提醒已静音'}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 transition"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-blue-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>

          {/* MarsConnect Quick Status Pill */}
          <button
            id="btn-quick-marsconnect-status"
            onClick={onOpenAccountHub}
            className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
              isMarsConnectConnected
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-slate-100 border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${isMarsConnectConnected ? 'text-red-600' : 'text-slate-400'}`} />
            <span>财新 MarsConnect:</span>
            <span className={isMarsConnectConnected ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
              {isMarsConnectConnected ? '已联通' : '未连接'}
            </span>
          </button>

          {/* AI Copilot Button */}
          <button
            id="btn-open-gemini-copilot"
            onClick={onOpenCopilot}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition transform active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 fill-white" />
            <span className="hidden sm:inline">AI 宏观分析师</span>
            <span className="sm:hidden">AI</span>
          </button>
        </div>
      </div>
    </header>
  );
};
