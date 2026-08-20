import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Radio,
  Star,
  Search,
  Sparkles,
  Layers,
  Clock,
  ExternalLink,
  Volume2,
  Share2,
  Calendar,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Zap,
  Flame,
  Filter,
  Check,
  TrendingUp,
  TrendingDown,
  Globe2,
  Building2,
  DollarSign,
  Coins,
  BarChart3,
  Bookmark,
  ArrowUpRight,
  GripVertical,
  Move,
  LayoutGrid,
  Columns,
  RotateCcw,
  Sliders
} from 'lucide-react';
import { NewsItem, MarketQuote, SourceId, AccountSession } from '../types';
import { SOURCES_CONFIG } from '../data/sources';
import { COMPREHENSIVE_CALENDAR_EVENTS } from '../data/calendarData';
import { soundManager } from '../utils/audio';
import { formatNewsTime } from '../utils/realtimeNewsSync';
import { ProMarketTerminalCard } from './ProMarketTerminalCard';

interface HomeAggregatorDashboardProps {
  news: NewsItem[];
  quotes: MarketQuote[];
  sessions: Record<SourceId, AccountSession>;
  onSelectNews: (item: NewsItem) => void;
  onOpenAccountHub: (sourceId?: SourceId) => void;
  onOpenCopilot: () => void;
  followedNewsIds?: string[];
  followedQuoteSymbols?: string[];
  onToggleFollowNews: (newsId: string) => void;
  onToggleFollowQuote: (symbol: string) => void;
  onNavigateToView?: (view: 'feed' | 'matrix' | 'markets' | 'synthesis' | 'accounts' | 'watchlist' | 'calendar' | 'asset-detail') => void;
  onOpenAssetDetail?: (symbol: string) => void;
}

export type TimelineCategory =
  | 'custom'
  | 'yaowen'
  | 'ashares'
  | 'usstocks'
  | 'hkstocks'
  | 'forex'
  | 'commodities'
  | 'bonds'
  | 'centralbank';

export type CardWidgetId =
  | 'terminal-key-assets'
  | 'terminal-watchlist'
  | 'macro-calendar'
  | 'marsconnect'
  | 'ai-analyst';

export const HomeAggregatorDashboard: React.FC<HomeAggregatorDashboardProps> = ({
  news,
  quotes,
  sessions,
  onSelectNews,
  onOpenAccountHub,
  onOpenCopilot,
  followedNewsIds = [],
  followedQuoteSymbols = [],
  onToggleFollowNews,
  onToggleFollowQuote,
  onNavigateToView,
  onOpenAssetDetail,
}) => {
  // Category tabs matching the screenshot
  const [activeCategory, setActiveCategory] = useState<TimelineCategory>('yaowen');
  // "只看重要" toggle switch
  const [onlyImportant, setOnlyImportant] = useState<boolean>(false);
  // Source filter
  const [selectedSource, setSelectedSource] = useState<SourceId | 'all'>('all');
  // Search query
  const [searchQuery, setSearchQuery] = useState<string>('');
  // Expanded news IDs for accordion "展开 / 收起"
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  // Audio speech playing item
  const [playingId, setPlayingId] = useState<string | null>(null);
  // Toast notification for follow action
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // Sidebar calendar widget tab: 'daily' vs 'weekly'
  const [sidebarCalendarTab, setSidebarCalendarTab] = useState<'daily' | 'weekly'>('daily');

  // Drag & Resizable Layout State (Persistent)
  const [leftColPct, setLeftColPct] = useState<number>(() => {
    const saved = localStorage.getItem('mars_dashboard_left_col_pct');
    return saved ? Number(saved) : 38;
  });

  const [cardOrder, setCardOrder] = useState<CardWidgetId[]>(() => {
    const saved = localStorage.getItem('mars_dashboard_card_order');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return [
      'terminal-key-assets',
      'terminal-watchlist',
      'macro-calendar',
      'marsconnect',
      'ai-analyst',
    ];
  });

  const [fullWidthCards, setFullWidthCards] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('mars_dashboard_full_width');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return {};
  });

  const [draggedCardId, setDraggedCardId] = useState<CardWidgetId | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<CardWidgetId | null>(null);
  const [isResizingColumn, setIsResizingColumn] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('mars_dashboard_left_col_pct', String(leftColPct));
  }, [leftColPct]);

  useEffect(() => {
    localStorage.setItem('mars_dashboard_card_order', JSON.stringify(cardOrder));
  }, [cardOrder]);

  useEffect(() => {
    localStorage.setItem('mars_dashboard_full_width', JSON.stringify(fullWidthCards));
  }, [fullWidthCards]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePlayTTS = (item: NewsItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingId === item.id) {
      soundManager.stopTTS();
      setPlayingId(null);
    } else {
      const textToRead = `${item.titleCn}。${item.summaryCn || item.contentCn || ''}`;
      soundManager.speakChinese(textToRead);
      setPlayingId(item.id);
    }
  };

  const handleShare = (item: NewsItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${item.titleCn} - ${item.url}`);
      showToast('已复制新闻链接到剪贴板！');
    }
  };

  // Toggle card 1x / 2x full width
  const toggleCardFullWidth = (id: CardWidgetId) => {
    setFullWidthCards((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      return next;
    });
  };

  // Drag and Drop Card Reordering Handlers
  const handleCardDragStart = (id: CardWidgetId, e: React.DragEvent) => {
    setDraggedCardId(id);
    e.dataTransfer.setData('text/plain', id);
  };

  const handleCardDragOver = (id: CardWidgetId, e: React.DragEvent) => {
    e.preventDefault();
    if (dragOverCardId !== id) {
      setDragOverCardId(id);
    }
  };

  const handleCardDrop = (targetId: CardWidgetId, e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedCardId || draggedCardId === targetId) {
      setDraggedCardId(null);
      setDragOverCardId(null);
      return;
    }

    const newOrder = [...cardOrder];
    const draggedIdx = newOrder.indexOf(draggedCardId);
    const targetIdx = newOrder.indexOf(targetId);

    if (draggedIdx !== -1 && targetIdx !== -1) {
      newOrder.splice(draggedIdx, 1);
      newOrder.splice(targetIdx, 0, draggedCardId);
      setCardOrder(newOrder);
      showToast('已重新排列组件顺序！');
      soundManager.playNewsPing('normal');
    }

    setDraggedCardId(null);
    setDragOverCardId(null);
  };

  // Draggable Column Divider Mouse Handling
  const handleColumnResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingColumn(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const offsetX = moveEvent.clientX - rect.left;
      const pct = Math.max(25, Math.min(75, Math.round((offsetX / rect.width) * 100)));
      setLeftColPct(pct);
    };

    const onMouseUp = () => {
      setIsResizingColumn(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Reset to Default Layout
  const handleResetLayout = () => {
    setLeftColPct(38);
    setCardOrder([
      'terminal-key-assets',
      'terminal-watchlist',
      'macro-calendar',
      'marsconnect',
      'ai-analyst',
    ]);
    setFullWidthCards({});
    showToast('已恢复默认工作台排版');
  };

  // Categories definition matching screenshot
  const categoriesList: { id: TimelineCategory; label: string; countBadge?: number }[] = [
    { id: 'custom', label: '定制', countBadge: followedNewsIds.length },
    { id: 'yaowen', label: '要闻' },
    { id: 'ashares', label: 'A股' },
    { id: 'usstocks', label: '美股' },
    { id: 'hkstocks', label: '港股' },
    { id: 'forex', label: '外汇' },
    { id: 'commodities', label: '商品' },
    { id: 'bonds', label: '债市' },
    { id: 'centralbank', label: '央行' },
  ];

  // Filter News
  const filteredTimelineNews = useMemo(() => {
    return news.filter((item) => {
      // 1. Only Important switch
      if (onlyImportant) {
        if (item.urgency !== 'major' && item.urgency !== 'flash' && !item.isPremium) {
          return false;
        }
      }

      // 2. Category matching
      if (activeCategory === 'custom') {
        if (!followedNewsIds.includes(item.id)) return false;
      } else if (activeCategory === 'yaowen') {
        // 要闻 includes all major news
      } else if (activeCategory === 'ashares') {
        const match =
          item.tags.some((t) => t.includes('A股') || t.includes('一级市场')) ||
          item.assetClasses.some((a) => a.includes('A股') || a.includes('科创'));
        if (!match) return false;
      } else if (activeCategory === 'usstocks') {
        const match =
          item.tags.some((t) => t.includes('美股') || t.includes('美国企业')) ||
          item.assetClasses.some(
            (a) => a.includes('美股') || a.includes('标普') || a.includes('纳斯达克')
          );
        if (!match) return false;
      } else if (activeCategory === 'hkstocks') {
        const match =
          item.tags.some((t) => t.includes('港股') || t.includes('亚太')) ||
          item.assetClasses.some(
            (a) => a.includes('港股') || a.includes('恒生') || a.includes('亚太')
          );
        if (!match) return false;
      } else if (activeCategory === 'forex') {
        const match =
          item.tags.some((t) => t.includes('外汇') || t.includes('汇率')) ||
          item.assetClasses.some(
            (a) => a.includes('外汇') || a.includes('CNH') || a.includes('DXY')
          );
        if (!match) return false;
      } else if (activeCategory === 'commodities') {
        const match =
          item.tags.some(
            (t) =>
              t.includes('商品') ||
              t.includes('黄金') ||
              t.includes('原油') ||
              t.includes('碳酸锂')
          ) ||
          item.assetClasses.some(
            (a) =>
              a.includes('商品') ||
              a.includes('黄金') ||
              a.includes('原油') ||
              a.includes('碳酸锂')
          );
        if (!match) return false;
      } else if (activeCategory === 'bonds') {
        const match =
          item.tags.some((t) => t.includes('债') || t.includes('固收') || t.includes('收益率')) ||
          item.assetClasses.some((a) => a.includes('债') || a.includes('利率'));
        if (!match) return false;
      } else if (activeCategory === 'centralbank') {
        const match =
          item.tags.some((t) => t.includes('央行') || t.includes('利率') || t.includes('中间价')) ||
          item.assetClasses.some((a) => a.includes('央行') || a.includes('利率'));
        if (!match) return false;
      }

      // 3. Source filter
      if (selectedSource !== 'all' && item.sourceId !== selectedSource) {
        return false;
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle =
          (item.titleCn || '').toLowerCase().includes(q) ||
          (item.title || '').toLowerCase().includes(q);
        const inSummary =
          (item.summaryCn || '').toLowerCase().includes(q) ||
          (item.summary || '').toLowerCase().includes(q);
        const inTag = item.tags.some((t) => t.toLowerCase().includes(q));
        if (!inTitle && !inSummary && !inTag) return false;
      }

      return true;
    });
  }, [news, onlyImportant, activeCategory, followedNewsIds, selectedSource, searchQuery]);

  // Current Date Header Formatter (e.g. 08月17日 星期一)
  const formattedDate = useMemo(() => {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const weekDay = weekDays[d.getDay()];
    return `${month}月${day}日 ${weekDay}`;
  }, []);

  // Render Individual Draggable Widgets
  const renderWidget = (id: CardWidgetId) => {
    const isFull = !!fullWidthCards[id];
    const isDragged = draggedCardId === id;
    const isDragOver = dragOverCardId === id;

    const wrapperClass = `transition-all duration-200 ${
      isFull ? 'col-span-full' : 'col-span-1'
    } ${isDragged ? 'opacity-40 scale-95' : ''} ${
      isDragOver ? 'ring-2 ring-blue-500 rounded-2xl ring-offset-2 scale-[1.01]' : ''
    }`;

    switch (id) {
      case 'terminal-key-assets':
        return (
          <div
            key={id}
            className={wrapperClass}
            onDragOver={(e) => handleCardDragOver(id, e)}
            onDrop={(e) => handleCardDrop(id, e)}
          >
            <ProMarketTerminalCard
              id="terminal-card-key-assets"
              title="今日重点资产盘面"
              subtitle="实时聚合"
              quotes={quotes}
              defaultSymbol="BTC/USD"
              followedSymbols={followedQuoteSymbols}
              onToggleFollow={onToggleFollowQuote}
              onNavigateToFullMarkets={() => onNavigateToView?.('markets')}
              onOpenAssetDetail={onOpenAssetDetail}
              isFullWidth={isFull}
              onToggleFullWidth={() => toggleCardFullWidth(id)}
              draggable={true}
              onDragStart={(e) => handleCardDragStart(id, e)}
            />
          </div>
        );

      case 'terminal-watchlist':
        return (
          <div
            key={id}
            className={wrapperClass}
            onDragOver={(e) => handleCardDragOver(id, e)}
            onDrop={(e) => handleCardDrop(id, e)}
          >
            <ProMarketTerminalCard
              id="terminal-card-watchlist"
              title="我的自选与追踪"
              subtitle="自选监控"
              icon={<Star className="w-4 h-4 fill-amber-400 text-amber-400" />}
              quotes={quotes}
              defaultSymbol={followedQuoteSymbols.length > 0 ? followedQuoteSymbols[0] : 'SPX'}
              isWatchlistMode={true}
              followedSymbols={followedQuoteSymbols}
              onToggleFollow={onToggleFollowQuote}
              onNavigateToFullMarkets={() => onNavigateToView?.('watchlist')}
              onOpenAssetDetail={onOpenAssetDetail}
              isFullWidth={isFull}
              onToggleFullWidth={() => toggleCardFullWidth(id)}
              draggable={true}
              onDragStart={(e) => handleCardDragStart(id, e)}
            />
          </div>
        );

      case 'macro-calendar':
        return (
          <div
            key={id}
            draggable
            onDragStart={(e) => handleCardDragStart(id, e)}
            onDragOver={(e) => handleCardDragOver(id, e)}
            onDrop={(e) => handleCardDrop(id, e)}
            className={`bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3 ${wrapperClass}`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div
                  title="按住拖拽调整组件位置"
                  className="p-1 rounded cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  <GripVertical className="w-4 h-4" />
                </div>
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                  <Calendar className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">财经宏观日程</h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleCardFullWidth(id)}
                  title={isFull ? '恢复单栏' : '扩展通栏'}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono border transition ${
                    isFull ? 'bg-blue-50 border-blue-300 text-blue-600 font-bold' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {isFull ? '2x 通栏' : '1x 单栏'}
                </button>
                <button
                  onClick={() => onNavigateToView && onNavigateToView('calendar')}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 hover:underline"
                >
                  <span>完整日历</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Sub-tabs: 今日日程 vs 本周重点 (Separated daily vs weekly lists) */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-semibold max-w-sm">
              <button
                onClick={() => setSidebarCalendarTab('daily')}
                className={`flex-1 py-1.5 rounded-lg transition text-center cursor-pointer ${
                  sidebarCalendarTab === 'daily'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                今日日程 (8月17日)
              </button>
              <button
                onClick={() => setSidebarCalendarTab('weekly')}
                className={`flex-1 py-1.5 rounded-lg transition text-center cursor-pointer ${
                  sidebarCalendarTab === 'weekly'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                本周前瞻 (8/16-8/22)
              </button>
            </div>

            {/* List Matching the Card Layout */}
            <div className="space-y-2.5">
              {(sidebarCalendarTab === 'daily'
                ? COMPREHENSIVE_CALENDAR_EVENTS.filter((e) => e.date === '2026-08-17')
                : COMPREHENSIVE_CALENDAR_EVENTS.filter(
                    (e) => e.importance === 3 && e.date !== '2026-08-17'
                  )
              )
                .slice(0, 5)
                .map((evt) => {
                  const isToday = evt.date === '2026-08-17';
                  return (
                    <div
                      key={evt.id}
                      onClick={() => onNavigateToView && onNavigateToView('calendar')}
                      className="p-3 rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-white hover:border-blue-300 hover:shadow-xs transition cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-800 text-xs flex items-center gap-1">
                            <span className="text-[10px] px-1 py-0.2 rounded bg-slate-200 text-slate-700 font-bold">
                              {evt.country}
                            </span>
                            {evt.date.slice(5)} {evt.time}
                          </span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-600 text-white">
                          {isToday ? '今日重磅' : '重磅前瞻'}
                        </span>
                      </div>

                      <div className="font-bold text-slate-900 text-xs sm:text-[13px] leading-snug">
                        {evt.event}
                      </div>

                      <div className="flex items-center justify-between text-slate-500 mt-2 pt-2 border-t border-slate-200/60 font-mono text-xs">
                        <span>{evt.previous ? `前值: ${evt.previous}` : evt.prefix || '重要数据发布'}</span>
                        <span className="text-blue-600 font-bold">
                          {evt.forecast ? `预期: ${evt.forecast}` : '查看详情 →'}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>

            <button
              onClick={() => onNavigateToView && onNavigateToView('calendar')}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition text-center cursor-pointer"
            >
              {sidebarCalendarTab === 'daily'
                ? '查看今日完整日程与公布值 →'
                : `查看本周全部 ${COMPREHENSIVE_CALENDAR_EVENTS.length} 项宏观日程 →`}
            </button>
          </div>
        );

      case 'marsconnect':
        return (
          <div
            key={id}
            draggable
            onDragStart={(e) => handleCardDragStart(id, e)}
            onDragOver={(e) => handleCardDragOver(id, e)}
            onDrop={(e) => handleCardDrop(id, e)}
            className={`bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between ${wrapperClass}`}
          >
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5 text-slate-800 font-bold text-sm">
                  <div
                    title="按住拖拽调整组件位置"
                    className="p-1 rounded cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>多源数据与 MarsConnect</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleCardFullWidth(id)}
                    title={isFull ? '恢复单栏' : '扩展通栏'}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono border transition ${
                      isFull ? 'bg-blue-50 border-blue-300 text-blue-600 font-bold' : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {isFull ? '2x 通栏' : '1x 单栏'}
                  </button>
                  <button
                    onClick={() => onOpenAccountHub()}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    授权设置
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    <span className="font-medium text-slate-800">财新 MarsConnect 插件</span>
                  </div>
                  <span
                    className={`text-[11px] font-bold ${
                      sessions.caixin?.isConnected ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {sessions.caixin?.isConnected ? '已联通' : '未授权'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span className="font-medium text-slate-800">彭博社 Bloomberg Anywhere</span>
                  </div>
                  <span
                    className={`text-[11px] font-bold ${
                      sessions.bloomberg?.isConnected ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {sessions.bloomberg?.isConnected ? '已联通' : '未授权'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'ai-analyst':
        return (
          <div
            key={id}
            draggable
            onDragStart={(e) => handleCardDragStart(id, e)}
            onDragOver={(e) => handleCardDragOver(id, e)}
            onDrop={(e) => handleCardDrop(id, e)}
            className={`bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border border-blue-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between ${wrapperClass}`}
          >
            <div>
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-blue-100">
                <div className="flex items-center gap-2">
                  <div
                    title="按住拖拽调整组件位置"
                    className="p-1 rounded cursor-grab active:cursor-grabbing text-blue-400 hover:text-blue-700 transition"
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">Gemini 宏观量化分析助手</h3>
                </div>
                <button
                  onClick={() => toggleCardFullWidth(id)}
                  title={isFull ? '恢复单栏' : '扩展通栏'}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono border transition ${
                    isFull ? 'bg-blue-200 border-blue-300 text-blue-800 font-bold' : 'text-slate-600 hover:bg-blue-100'
                  }`}
                >
                  {isFull ? '2x 通栏' : '1x 单栏'}
                </button>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                随时提炼多源财经异动逻辑、深度解析央行利率决议与全球股债汇联动效应。
              </p>
            </div>
            <button
              onClick={onOpenCopilot}
              className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>打开 AI 宏观内参助手</span>
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div ref={containerRef} className="space-y-3 pb-12 text-slate-800">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs font-medium flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Layout Control & Presets Toolbar (Drag / Resize indicator & quick presets) */}
      <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-600">
          <div className="p-1 rounded bg-blue-50 text-blue-600">
            <LayoutGrid className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-slate-800">专业可定制工作台</span>
          <span className="text-slate-400 hidden sm:inline">|</span>
          <span className="text-[11px] text-slate-500 hidden sm:inline flex items-center gap-1">
            <Move className="w-3 h-3 text-blue-500" />
            支持横向分栏拖拽宽度、组件拖曳排序与大小缩放
          </span>
        </div>

        {/* Quick Ratio Presets */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400 font-mono hidden md:inline">分栏预设:</span>
          {[
            { pct: 30, label: '30:70 经典图表' },
            { pct: 40, label: '40:60 均衡视窗' },
            { pct: 50, label: '50:50 对半均分' },
            { pct: 65, label: '65:35 快讯主导' },
          ].map((preset) => {
            const isActive = Math.abs(leftColPct - preset.pct) <= 3;
            return (
              <button
                key={preset.pct}
                onClick={() => setLeftColPct(preset.pct)}
                className={`px-2 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {preset.label}
              </button>
            );
          })}

          {/* Reset Button */}
          <button
            onClick={handleResetLayout}
            title="恢复初始排版"
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition flex items-center gap-1 text-xs ml-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">重置</span>
          </button>
        </div>
      </div>

      {/* Main Resizable Split Layout Container */}
      <div className="flex flex-col lg:flex-row gap-0 items-start relative w-full">
        
        {/* Left Column: The Timeline News Stream */}
        <div
          style={{ width: `${leftColPct}%` }}
          className="w-full lg:w-auto space-y-3 shrink-0 lg:pr-3 transition-all duration-75"
        >
          {/* 1. Category Bar (定制 | 要闻 | A股 | 美股 | 港股 | 外汇 | 商品 | 债市 | 央行) */}
          <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-xs flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1 shrink-0">
              {categoriesList.map((cat) => {
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <span>{cat.label}</span>
                    {cat.countBadge !== undefined && cat.countBadge > 0 && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                          isActive ? 'bg-white text-blue-600' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {cat.countBadge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Sub-Header Toolbar: Date Title & "只看重要" Switch Toggle */}
          <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 shadow-xs flex items-center justify-between">
            {/* Left: Date Display & Live Pulse */}
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-blue-50 text-blue-600 border border-blue-100">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-slate-900 text-xs sm:text-sm">{formattedDate}</span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                <span>7x24 实时流接入</span>
              </span>
            </div>

            {/* Right: "只看重要" Toggle Switch */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-700 select-none">只看重要</span>
              <button
                type="button"
                onClick={() => setOnlyImportant((prev) => !prev)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  onlyImportant ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    onlyImportant ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 3. Search & Source Filter Row */}
          <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-xs flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="搜索快讯关键词、标的、政策..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-lg text-xs outline-none transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Source select dropdown */}
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none hover:bg-slate-100 transition"
            >
              <option value="all">全部信源</option>
              {Object.values(SOURCES_CONFIG).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Timeline News List Feed with Clean Left Timeline Vertical Rail */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs min-h-[500px]">
            {filteredTimelineNews.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs space-y-2">
                <Radio className="w-8 h-8 mx-auto text-slate-300 animate-pulse" />
                <p className="font-medium text-slate-700">当前分类暂无快讯</p>
                <p className="text-slate-400 text-[11px]">可切换分类或关闭"只看重要"过滤开关</p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-4">
                {/* Continuous Left Timeline Vertical Rail Line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-[1.5px] bg-slate-200" />

                {filteredTimelineNews.map((item) => {
                  const isFollowed = followedNewsIds.includes(item.id);
                  const isExpanded = expandedIds[item.id] || false;
                  const isTTSPlaying = playingId === item.id;
                  const timeString = formatNewsTime(item);
                  const sourceConfig = SOURCES_CONFIG[item.sourceId];

                  const isMajor = item.urgency === 'major' || item.urgency === 'flash';

                  return (
                    <div
                      key={item.id}
                      onClick={() => onSelectNews(item)}
                      className="relative group cursor-pointer"
                    >
                      {/* Timeline Node Point on Vertical Rail */}
                      <div
                        className={`absolute -left-[24px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white transition-all shadow-xs ${
                          isMajor ? 'bg-red-500 ring-2 ring-red-200' : 'bg-slate-400 group-hover:bg-blue-500'
                        }`}
                      />

                      {/* Content Card with Border and Padding */}
                      <div className="p-3 rounded-xl border border-slate-200 bg-white group-hover:border-blue-400 group-hover:shadow-xs transition duration-150 space-y-2">
                        {/* Meta Header Row: Time + Source Badge + Urgency Flash Pill */}
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-slate-900 text-[13px]">
                              {timeString}
                            </span>

                            {/* Source Badge with Logo dot */}
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{
                                  backgroundColor:
                                    sourceConfig?.tier === 'enterprise' ? '#2563eb' : '#dc2626',
                                }}
                              />
                              {item.sourceName}
                            </span>

                            {/* Urgency Pill if flash or major */}
                            {isMajor && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 flex items-center gap-0.5">
                                <Flame className="w-2.5 h-2.5" />
                                重磅
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Title text */}
                        <h4
                          className={`font-bold text-slate-900 leading-snug text-xs sm:text-[13px] group-hover:text-blue-600 transition ${
                            isMajor ? 'text-red-950 font-black' : ''
                          }`}
                        >
                          {item.titleCn || item.title}
                        </h4>

                        {/* Summary / Snippet */}
                        {(item.summaryCn || item.contentCn) && (
                          <div className="text-xs text-slate-600 leading-relaxed">
                            {isExpanded ? (
                              <p className="mt-1">{item.summaryCn || item.contentCn}</p>
                            ) : (
                              <p className="line-clamp-2">{item.summaryCn || item.contentCn}</p>
                            )}
                          </div>
                        )}

                        {/* Bottom Actions Row: Tags + TTS + Follow + Expand + Share */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                          {/* Tags */}
                          <div className="flex items-center gap-1 flex-wrap max-w-[65%]">
                            {item.tags.slice(0, 3).map((tag, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.2 rounded bg-slate-50 text-slate-500 border border-slate-100 text-[10px]"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>

                          {/* Quick Tool Icons */}
                          <div className="flex items-center gap-2">
                            {/* Read aloud TTS */}
                            <button
                              onClick={(e) => handlePlayTTS(item, e)}
                              title={isTTSPlaying ? '停止朗读' : '朗读快讯'}
                              className={`p-1 rounded transition hover:bg-slate-100 ${
                                isTTSPlaying ? 'text-blue-600 bg-blue-50 animate-pulse' : 'hover:text-slate-700'
                              }`}
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Accordion Expand / Collapse */}
                            {(item.summaryCn || item.contentCn) && (
                              <button
                                onClick={(e) => toggleExpand(item.id, e)}
                                title={isExpanded ? '收起详情' : '展开全文'}
                                className="flex items-center gap-0.5 hover:text-slate-700 transition"
                              >
                                {isExpanded ? (
                                  <>
                                    <span>收起</span>
                                    <ChevronUp className="w-3 h-3" />
                                  </>
                                ) : (
                                  <>
                                    <span>展开</span>
                                    <ChevronDown className="w-3 h-3" />
                                  </>
                                )}
                              </button>
                            )}

                            {/* Follow Star */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleFollowNews(item.id);
                                showToast(isFollowed ? '已取消关注' : '已加入我的关注！');
                              }}
                              title={isFollowed ? '取消关注' : '加入我的关注'}
                              className={`flex items-center gap-0.5 transition px-1 py-0.5 rounded ${
                                isFollowed ? 'text-amber-600 font-bold bg-amber-50' : 'hover:text-amber-600'
                              }`}
                            >
                              <Star
                                className={`w-3 h-3 ${
                                  isFollowed ? 'fill-amber-400 text-amber-500' : ''
                                }`}
                              />
                              <span>{isFollowed ? '已关注' : '关注'}</span>
                            </button>

                            {/* Share */}
                            <button
                              onClick={(e) => handleShare(item, e)}
                              title="分享快讯"
                              className="flex items-center gap-0.5 hover:text-blue-600 transition px-1 py-0.5 rounded"
                            >
                              <Share2 className="w-3 h-3" />
                              <span>分享</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Draggable Column Resizer Divider (Interactive Handle) */}
        <div
          onMouseDown={handleColumnResizeStart}
          title="按住左右拖拽调整左右分栏宽度比例"
          className="hidden lg:flex items-center justify-center w-3 hover:w-3.5 group cursor-col-resize h-full min-h-[600px] shrink-0 select-none py-10 transition-all z-20"
        >
          <div
            className={`w-1 rounded-full transition-all duration-150 h-full ${
              isResizingColumn
                ? 'bg-blue-600 w-1.5 shadow-md shadow-blue-500/50'
                : 'bg-slate-200 group-hover:bg-blue-400 group-hover:w-1.5'
            }`}
          />
        </div>

        {/* Right Column: Pro Market Terminals + Widgets Grid */}
        <div
          style={{ width: `calc(${100 - leftColPct}% - 12px)` }}
          className="w-full lg:w-auto shrink-0 space-y-4 lg:pl-2"
        >
          {/* Dynamic Grid for Draggable Widgets */}
          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
            {cardOrder.map((widgetId) => renderWidget(widgetId))}
          </div>
        </div>

      </div>
    </div>
  );
};
