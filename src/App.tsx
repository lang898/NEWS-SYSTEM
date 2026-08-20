import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { SourceRatingsBanner } from './components/SourceRatingsBanner';
import { NewsFeedStream } from './components/NewsFeedStream';
import { MarketTickerOverview } from './components/MarketTickerOverview';
import { SourceMatrixView } from './components/SourceMatrixView';
import { MacroSynthesisView } from './components/MacroSynthesisView';
import { CalendarScheduleView } from './components/CalendarScheduleView';
import { MarsConnectHubModal } from './components/MarsConnectHubModal';
import { ArticleModal } from './components/ArticleModal';
import { AICopilotDrawer } from './components/AICopilotDrawer';
import { WatchlistSection } from './components/WatchlistSection';
import { HomeAggregatorDashboard } from './components/HomeAggregatorDashboard';
import { AssetDetailView } from './components/AssetDetailView';
import { INITIAL_NEWS } from './data/initialNews';
import { INITIAL_QUOTES } from './data/quotes';
import { SOURCES_CONFIG } from './data/sources';
import { NewsItem, MarketQuote, AccountSession, SourceId } from './types';
import { soundManager } from './utils/audio';
import { fetchLiveForexAndCryptoRates, applyLiveRatesToQuotes } from './utils/realtimeMarketSync';
import { fetchLiveNews, subscribeNewsStream } from './utils/realtimeNewsSync';
import { LivePushNotificationDock, PushHistoryItem, ToastDurationOption } from './components/LivePushNotificationDock';
import { Sparkles, Radio, Zap, BellRing, KeyRound, ShieldCheck, Star, Calendar } from 'lucide-react';

export default function App() {
  const [news, setNews] = useState<NewsItem[]>(INITIAL_NEWS);
  const [quotes, setQuotes] = useState<MarketQuote[]>(INITIAL_QUOTES);
  const [selectedSource, setSelectedSource] = useState<SourceId | 'all'>('all');
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [isLivePushing, setIsLivePushing] = useState<boolean>(true);
  const [onlyImportantPush, setOnlyImportantPush] = useState<boolean>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('finpulse_push_important_only') : null;
    return saved !== null ? saved === 'true' : true;
  });
  const [activeView, setActiveView] = useState<'feed' | 'calendar' | 'matrix' | 'markets' | 'synthesis' | 'accounts' | 'watchlist' | 'asset-detail'>('feed');
  const [activeAssetSymbol, setActiveAssetSymbol] = useState<string>('NVDA');
  const [isAccountHubOpen, setIsAccountHubOpen] = useState(false);
  const [accountHubTargetSource, setAccountHubTargetSource] = useState<SourceId | undefined>(undefined);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [currentPushItem, setCurrentPushItem] = useState<NewsItem | null>(null);
  const [pushHistory, setPushHistory] = useState<PushHistoryItem[]>([]);
  const pushTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Watchlist State with LocalStorage Persistence
  const [followedNewsIds, setFollowedNewsIds] = useState<string[]>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('finpulse_watchlist_news') : null;
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return [];
  });

  const [followedQuoteSymbols, setFollowedQuoteSymbols] = useState<string[]>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('finpulse_watchlist_quotes') : null;
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return ['CN10Y', 'USD/CNH', 'SPX', 'US10Y'];
  });

  // Save watchlist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('finpulse_watchlist_news', JSON.stringify(followedNewsIds));
    } catch (e) {
      console.error(e);
    }
  }, [followedNewsIds]);

  useEffect(() => {
    try {
      localStorage.setItem('finpulse_watchlist_quotes', JSON.stringify(followedQuoteSymbols));
    } catch (e) {
      console.error(e);
    }
  }, [followedQuoteSymbols]);

  const handleToggleFollowNews = (newsId: string) => {
    setFollowedNewsIds((prev) => {
      const exists = prev.includes(newsId);
      const updated = exists ? prev.filter((id) => id !== newsId) : [...prev, newsId];
      soundManager.playNewsPing('normal');
      return updated;
    });
  };

  const handleToggleFollowQuote = (symbol: string) => {
    setFollowedQuoteSymbols((prev) => {
      const exists = prev.includes(symbol);
      const updated = exists ? prev.filter((s) => s !== symbol) : [...prev, symbol];
      soundManager.playNewsPing('normal');
      return updated;
    });
  };

  // Initialize Account Sessions from localStorage or defaults
  const [sessions, setSessions] = useState<Record<SourceId, AccountSession>>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('finpulse_sessions') : null;
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    // 诚实默认值：全部未连接。
    // 账号联通仅为演示功能（服务端返回 simulated: true 的演示会话），
    // 不应预填任何伪造的 Bloomberg/Reuters/财新 VIP 账户。
    return {
      caixin: { sourceId: 'caixin', isConnected: false },
      bloomberg: { sourceId: 'bloomberg', isConnected: false },
      reuters: { sourceId: 'reuters', isConnected: false },
      ft: { sourceId: 'ft', isConnected: false },
      wsj: { sourceId: 'wsj', isConnected: false },
      wscn: { sourceId: 'wscn', isConnected: false },
      cnbc: { sourceId: 'cnbc', isConnected: false },
    };
  });

  // Save sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('finpulse_sessions', JSON.stringify(sessions));
    } catch {
      // ignore
    }
  }, [sessions]);

  // Real-time external rates polling (live FX & Crypto syncing from public endpoints & server gateway)
  const syncLiveMarketRates = useCallback(async () => {
    try {
      const liveRates = await fetchLiveForexAndCryptoRates();
      if (Object.keys(liveRates).length > 0) {
        setQuotes((prevQuotes) => applyLiveRatesToQuotes(prevQuotes, liveRates));
      }
    } catch (err) {
      console.warn('Real-time rate sync fallback active:', err);
    }
  }, []);

  useEffect(() => {
    // Run immediate sync on load
    syncLiveMarketRates();

    // High-frequency polling (every 3 seconds) for live interbank & crypto rates
    const liveSyncTimer = setInterval(syncLiveMarketRates, 3000);

    return () => {
      clearInterval(liveSyncTimer);
    };
  }, [syncLiveMarketRates]);

  // 说明：旧版此处有一个 1.5 秒"微震荡"定时器，用正弦函数伪造价格波动。
  // 它会让显示价与任何真实数据源对不上、涨跌幅无意义闪动、并把伪造的
  // 高低价永久写入当日 high/low —— 已彻底移除。
  // 盘面的"活感"现在来自真实数据：加密品种为 Binance 实时行情，
  // 其余品种按数据源的真实更新频率刷新。

  // ==================================================================
  // 真实快讯管线：初始拉取 /api/news/live 聚合池 + SSE 直推订阅
  //（旧版由前端假新闻模板池循环"推送"，已移除）
  // ==================================================================
  const knownNewsIdsRef = useRef<Set<string>>(new Set());
  const pushQueueRef = useRef<NewsItem[]>([]);
  const currentPushRef = useRef<NewsItem | null>(null);
  currentPushRef.current = currentPushItem;
  const isLivePushingRef = useRef(isLivePushing);
  isLivePushingRef.current = isLivePushing;
  const onlyImportantPushRef = useRef(onlyImportantPush);
  onlyImportantPushRef.current = onlyImportantPush;

  const showPushItem = useCallback((item: NewsItem) => {
    setCurrentPushItem(item);
    soundManager.playNewsPing(item.urgency === 'flash' ? 'flash' : 'major');

    const savedDuration = (localStorage.getItem('finpulse_toast_duration') as ToastDurationOption) || 'manual';
    if (pushTimerRef.current) {
      clearTimeout(pushTimerRef.current);
      pushTimerRef.current = null;
    }
    if (savedDuration !== 'manual') {
      const msMap: Record<string, number> = { '6s': 6000, '12s': 12000, '30s': 30000 };
      pushTimerRef.current = setTimeout(() => {
        // 自动关闭后出队下一条（若有）
        const next = pushQueueRef.current.shift() || null;
        setCurrentPushItem(next);
        if (next) showPushItem(next);
      }, msMap[savedDuration] || 12000);
    }
  }, []);

  /** 新到快讯统一入口：入 feed、入历史、按需弹窗（队列化，绝不互相覆盖丢失） */
  const ingestFreshNews = useCallback((items: NewsItem[]) => {
    const fresh = items.filter((n) => !knownNewsIdsRef.current.has(n.id));
    if (fresh.length === 0) return;
    for (const n of fresh) knownNewsIdsRef.current.add(n.id);

    setNews((prev) => [...fresh, ...prev].slice(0, 200));

    setPushHistory((prev) => [
      ...fresh.map((n) => ({
        id: `push-hist-${n.id}`,
        news: n,
        receivedAt: new Date(),
        read: false,
      })),
      ...prev,
    ].slice(0, 80));

    if (!isLivePushingRef.current) return;
    const pushable = fresh.filter((n) =>
      onlyImportantPushRef.current ? n.urgency === 'flash' || n.urgency === 'major' : true
    );
    if (pushable.length === 0) return;

    if (!currentPushRef.current) {
      const [first, ...rest] = pushable;
      pushQueueRef.current.push(...rest.slice(0, 5));
      showPushItem(first);
    } else {
      pushQueueRef.current.push(...pushable.slice(0, 5));
      pushQueueRef.current = pushQueueRef.current.slice(0, 8);
    }
  }, [showPushItem]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: NodeJS.Timeout | null = null;

    // 1) 初始加载真实聚合池（失败 20 秒后重试）
    const loadInitial = async () => {
      try {
        const { items } = await fetchLiveNews();
        if (cancelled) return;
        for (const n of items) knownNewsIdsRef.current.add(n.id);
        setNews(items);
      } catch (e) {
        console.warn('news/live initial fetch failed, retrying in 20s:', e);
        if (!cancelled) retryTimer = setTimeout(loadInitial, 20000);
      }
    };
    loadInitial();

    // 2) SSE 直推订阅（新条目亚秒级到达前端；服务端 75s 抓取一轮 RSS）
    const unsubscribe = subscribeNewsStream((item) => {
      if (!cancelled) ingestFreshNews([item]);
    });

    // 3) 兜底轮询（3 分钟一次，防 SSE 被中间代理掐断时漏条）
    const fallbackPoll = setInterval(async () => {
      try {
        const { items } = await fetchLiveNews();
        if (!cancelled) ingestFreshNews(items);
      } catch {
        // 静默；下轮再试
      }
    }, 180000);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      clearInterval(fallbackPoll);
      unsubscribe();
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, [ingestFreshNews]);

  const handleDismissCurrentPush = () => {
    if (pushTimerRef.current) {
      clearTimeout(pushTimerRef.current);
    }
    // 关闭当前后出队下一条
    const next = pushQueueRef.current.shift() || null;
    setCurrentPushItem(next);
    if (next) showPushItem(next);
  };

  const handleToggleImportantOnly = () => {
    setOnlyImportantPush((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('finpulse_push_important_only', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleClearHistory = () => {
    setPushHistory([]);
  };

  const handleOpenAccountHub = (srcId?: SourceId) => {
    setAccountHubTargetSource(srcId);
    setIsAccountHubOpen(true);
  };

  const handleUpdateSession = (sourceId: SourceId, session: AccountSession) => {
    setSessions((prev) => ({
      ...prev,
      [sourceId]: session,
    }));
  };

  return (
    <div id="finpulse-root-app" className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Header & Sticky Navigation */}
      <Header
        quotes={quotes}
        sessions={sessions}
        isLivePushing={isLivePushing}
        setIsLivePushing={setIsLivePushing}
        onOpenAccountHub={() => handleOpenAccountHub()}
        onOpenCopilot={() => setIsCopilotOpen(true)}
        activeView={activeView}
        setActiveView={setActiveView}
        followedNewsIds={followedNewsIds}
        followedQuoteSymbols={followedQuoteSymbols}
        onSelectTicker={(sym) => {
          setActiveAssetSymbol(sym);
          setActiveView('asset-detail');
        }}
      />

      {/* Live Push Notification Dock & Notification Drawer */}
      <LivePushNotificationDock
        currentPush={currentPushItem}
        history={pushHistory}
        isLivePushing={isLivePushing}
        onToggleLivePush={() => setIsLivePushing((p) => !p)}
        onSelectNews={(item) => setSelectedNews(item)}
        onDismissCurrent={handleDismissCurrentPush}
        onClearHistory={() => setPushHistory([])}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto px-4 sm:px-8 py-4 space-y-4">
        {/* View 0: Dedicated My Watchlist (我的关注) Center */}
        {activeView === 'watchlist' && (
          <WatchlistSection
            news={news}
            quotes={quotes}
            followedNewsIds={followedNewsIds}
            followedQuoteSymbols={followedQuoteSymbols}
            onToggleFollowNews={handleToggleFollowNews}
            onToggleFollowQuote={handleToggleFollowQuote}
            onSelectNews={(item) => setSelectedNews(item)}
            sessions={sessions}
            onOpenAccountHub={handleOpenAccountHub}
            onFilterByAsset={(symbol) => {
              setActiveAssetSymbol(symbol);
              setActiveView('asset-detail');
            }}
          />
        )}

        {/* View 1: Wallstreetcn-Style Unified Aggregator Dashboard (首页聚合 - High Signal Core Dashboard) */}
        {activeView === 'feed' && (
          <HomeAggregatorDashboard
            news={news}
            quotes={quotes}
            sessions={sessions}
            onSelectNews={(item) => setSelectedNews(item)}
            onOpenAccountHub={handleOpenAccountHub}
            onOpenCopilot={() => setIsCopilotOpen(true)}
            followedNewsIds={followedNewsIds}
            followedQuoteSymbols={followedQuoteSymbols}
            onToggleFollowNews={handleToggleFollowNews}
            onToggleFollowQuote={handleToggleFollowQuote}
            onNavigateToView={(view) => setActiveView(view)}
            onOpenAssetDetail={(symbol) => {
              setActiveAssetSymbol(symbol);
              setActiveView('asset-detail');
            }}
          />
        )}

        {/* View 2: High-Frequency Macro & Event Calendar (财经日历 & 本周重磅日程) */}
        {activeView === 'calendar' && (
          <CalendarScheduleView
            followedEventIds={followedNewsIds}
            onToggleFollowEvent={(id) => handleToggleFollowNews(id)}
          />
        )}

        {/* View 3: Dedicated Multi-Column Source Matrix View (with Media Ratings Banner) */}
        {activeView === 'matrix' && (
          <div className="space-y-5">
            <SourceRatingsBanner
              selectedSource={selectedSource}
              onSelectSource={(src) => setSelectedSource(src)}
              sessions={sessions}
              onOpenAccountHub={handleOpenAccountHub}
            />
            <SourceMatrixView
              news={news}
              sessions={sessions}
              onSelectNews={(item) => setSelectedNews(item)}
              onOpenAccountHub={handleOpenAccountHub}
              followedNewsIds={followedNewsIds}
              onToggleFollowNews={handleToggleFollowNews}
            />
          </div>
        )}

        {/* View 4: Global Markets & Macro Calendar */}
        {activeView === 'markets' && (
          <MarketTickerOverview
            quotes={quotes}
            news={news}
            onSelectAsset={(symbol) => {
              setActiveAssetSymbol(symbol);
            }}
            onNavigateToDetail={(symbol) => {
              setActiveAssetSymbol(symbol);
              setActiveView('asset-detail');
            }}
            followedQuoteSymbols={followedQuoteSymbols}
            onToggleFollowQuote={handleToggleFollowQuote}
          />
        )}

        {/* View 5: AI Cross-Source Macro Synthesis Report */}
        {activeView === 'synthesis' && <MacroSynthesisView news={news} />}

        {/* View 6: Unified Accounts & MarsConnect Hub Tab */}
        {activeView === 'accounts' && (
          <div className="space-y-5">
            <SourceRatingsBanner
              selectedSource={selectedSource}
              onSelectSource={(src) => setSelectedSource(src)}
              sessions={sessions}
              onOpenAccountHub={handleOpenAccountHub}
            />
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-blue-600" />
                    <span>多媒体账号一站式集成与 MarsConnect 插件联通中心</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    “有账户的就登录，没账户的也可以以后想要登录的时候在这一个网站登录就可以了”
                  </p>
                </div>
                <button
                  onClick={() => handleOpenAccountHub()}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs"
                >
                  打开完整授权配置窗
                </button>
              </div>

              {/* Grid of sources with direct auth status */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.values(SOURCES_CONFIG).map((src) => {
                  const s = sessions[src.id];
                  return (
                    <div
                      key={src.id}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-900">{src.nameCn}</span>
                        {s?.isConnected ? (
                          <span className="text-emerald-600 text-xs font-mono font-bold flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            已联通
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs font-mono">未配置</span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600">
                        {s?.isConnected ? (
                          <div className="space-y-1 font-mono text-[11px]">
                            <div>账户: <strong className="text-slate-900">{s.username}</strong></div>
                            <div>权限: <strong className="text-blue-600">{s.accountType}</strong></div>
                            <div>通道: <strong className="text-slate-700">{s.connectionMethod}</strong></div>
                          </div>
                        ) : (
                          <p>随时点击配置此媒体订阅账号，解锁独家付费文章与机构级研报。</p>
                        )}
                      </div>

                      <button
                        onClick={() => handleOpenAccountHub(src.id)}
                        className="w-full py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold transition"
                      >
                        {s?.isConnected ? '管理连接 / 重新验证' : '配置 / 登录账号'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* View 7: Dedicated Asset Deep Dive with Measurement Tools & Correlated News */}
        {activeView === 'asset-detail' && (
          <AssetDetailView
            symbol={activeAssetSymbol}
            quotes={quotes}
            news={news}
            followedSymbols={followedQuoteSymbols}
            onToggleFollowQuote={handleToggleFollowQuote}
            onSelectNews={(item) => setSelectedNews(item)}
            onBack={() => setActiveView('markets')}
            onSwitchAsset={(sym) => setActiveAssetSymbol(sym)}
            onRefreshQuotes={syncLiveMarketRates}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-5 px-4 text-center text-xs text-slate-500">
        <div className="max-w-[1720px] w-full mx-auto px-4 sm:px-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">Global FinPulse</span>
            <span>· 全球财经情报多源实时推送与行情终端</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono text-slate-500">
            <span>Reuters</span>
            <span>Bloomberg</span>
            <span>Caixin (MarsConnect)</span>
            <span>Financial Times</span>
            <span>WSJ</span>
            <span>Wallstreetcn</span>
            <span>CNBC</span>
          </div>
        </div>
      </footer>

      {/* 7x24 Live Breaking Push Notification Dock & History Center */}
      <LivePushNotificationDock
        currentPush={currentPushItem}
        history={pushHistory}
        isLivePushing={isLivePushing}
        onlyImportantPush={onlyImportantPush}
        onToggleLivePush={() => setIsLivePushing((p) => !p)}
        onToggleImportantOnly={handleToggleImportantOnly}
        onSelectNews={(item) => setSelectedNews(item)}
        onDismissCurrent={handleDismissCurrentPush}
        onClearHistory={handleClearHistory}
      />

      {/* Full Article Reader Modal */}
      <ArticleModal
        news={selectedNews}
        onClose={() => setSelectedNews(null)}
        sessions={sessions}
        onOpenAccountHub={handleOpenAccountHub}
        isFollowed={selectedNews ? followedNewsIds.includes(selectedNews.id) : false}
        onToggleFollowNews={handleToggleFollowNews}
      />

      {/* MarsConnect & Account Gateway Modal */}
      <MarsConnectHubModal
        isOpen={isAccountHubOpen}
        onClose={() => setIsAccountHubOpen(false)}
        sessions={sessions}
        onUpdateSession={handleUpdateSession}
        targetSourceId={accountHubTargetSource}
      />

      {/* AI Macro Copilot Drawer */}
      <AICopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
      />
    </div>
  );
}
