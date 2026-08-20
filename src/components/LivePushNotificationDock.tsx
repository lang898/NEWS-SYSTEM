import React, { useState } from 'react';
import {
  Radio,
  ChevronRight,
  X,
  Pause,
  Play,
  Eye,
  SlidersHorizontal,
  Check,
  History,
  ShieldCheck,
  Search,
  Flame,
  Zap,
  Filter,
  Trash2,
} from 'lucide-react';
import { NewsItem, SourceId } from '../types';
import { SOURCES_CONFIG } from '../data/sources';

export interface PushHistoryItem {
  id: string;
  news: NewsItem;
  receivedAt: Date;
  read: boolean;
}

interface LivePushNotificationDockProps {
  currentPush: NewsItem | null;
  history: PushHistoryItem[];
  isLivePushing: boolean;
  onlyImportantPush: boolean;
  onToggleLivePush: () => void;
  onToggleImportantOnly: () => void;
  onSelectNews: (item: NewsItem) => void;
  onDismissCurrent: () => void;
  onClearHistory: () => void;
}

export type ToastDurationOption = '6s' | '12s' | '30s' | 'manual';

export const LivePushNotificationDock: React.FC<LivePushNotificationDockProps> = ({
  currentPush,
  history,
  isLivePushing,
  onlyImportantPush,
  onToggleLivePush,
  onToggleImportantOnly,
  onSelectNews,
  onDismissCurrent,
  onClearHistory,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyFilterUrgency, setHistoryFilterUrgency] = useState<'all' | 'flash' | 'major'>('all');
  const [durationSetting, setDurationSetting] = useState<ToastDurationOption>(() => {
    return (localStorage.getItem('finpulse_toast_duration') as ToastDurationOption) || 'manual';
  });
  const [showSettings, setShowSettings] = useState(false);

  const handleSetDuration = (val: ToastDurationOption) => {
    setDurationSetting(val);
    try {
      localStorage.setItem('finpulse_toast_duration', val);
    } catch {
      // ignore
    }
  };

  const srcConfig = currentPush ? SOURCES_CONFIG[currentPush.sourceId] : null;

  // Filter history records
  const filteredHistory = history.filter((item) => {
    if (historyFilterUrgency !== 'all' && item.news.urgency !== historyFilterUrgency) {
      return false;
    }
    if (historySearchQuery.trim()) {
      const q = historySearchQuery.toLowerCase();
      const matchTitle = (item.news.titleCn || item.news.title).toLowerCase().includes(q);
      const matchSummary = (item.news.summaryCn || item.news.summary).toLowerCase().includes(q);
      const matchSource = (SOURCES_CONFIG[item.news.sourceId]?.nameCn || item.news.sourceId).toLowerCase().includes(q);
      return matchTitle || matchSummary || matchSource;
    }
    return true;
  });

  return (
    <>
      {/* Floating Modern Push Notification Dock (Bottom-Right) */}
      <div
        id="live-push-dock-container"
        className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2.5 select-none"
      >
        {/* Quick History / Control Floating Button Bar */}
        <div className="flex items-center gap-1.5 bg-slate-900/95 backdrop-blur-md text-white px-3 py-1.5 rounded-full border border-slate-700/80 shadow-2xl text-xs">
          {/* Live Push Status Switch */}
          <button
            onClick={onToggleLivePush}
            title={isLivePushing ? '点击暂停突发推送' : '点击开启突发推送'}
            className="flex items-center gap-1.5 pr-2 border-r border-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <span className={`w-2 h-2 rounded-full ${isLivePushing ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
            <span className="font-mono text-[11px]">{isLivePushing ? '7x24 突发' : '推送已暂停'}</span>
            {isLivePushing ? <Pause className="w-3 h-3 text-slate-400" /> : <Play className="w-3 h-3 text-emerald-400" />}
          </button>

          {/* Anti-Loop & Priority Indicator */}
          <span
            className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-900/50 border border-blue-700/40 text-[10px] text-blue-300 font-mono"
            title="已启用防循环推送保护：相同突发新闻仅弹窗一次，杜绝重复刷屏，历史可在记录中回溯"
          >
            <ShieldCheck className="w-3 h-3 text-blue-400" />
            <span>防循环已开启</span>
          </span>

          {/* Settings Trigger */}
          <button
            onClick={() => setShowSettings((p) => !p)}
            title="推送设置：仅推重要 / 弹窗驻留时间"
            className="flex items-center gap-1 px-1.5 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <SlidersHorizontal className="w-3 h-3 text-blue-400" />
            <span className="font-mono text-[10px] text-slate-300">
              {onlyImportantPush ? '仅推重磅' : '全部'}
            </span>
          </button>

          {/* Notification Center History Drawer Trigger */}
          <button
            id="btn-open-push-history"
            onClick={() => setIsHistoryDrawerOpen(true)}
            className="flex items-center gap-1.5 pl-2 border-l border-slate-700 text-slate-300 hover:text-white transition font-medium cursor-pointer"
          >
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px]">推送记录</span>
            {history.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-[10px] font-mono font-bold text-white">
                {history.length}
              </span>
            )}
          </button>
        </div>

        {/* Floating Settings Popover */}
        {showSettings && (
          <div className="bg-slate-900 border border-slate-700 text-slate-100 rounded-2xl p-4 shadow-2xl w-80 space-y-3 animate-fadeIn text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-slate-100 flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-blue-400" />
                <span>突发推送偏好设置</span>
              </span>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            {/* Priority Filter Toggle */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                  <span>仅推送重磅与突发要闻</span>
                </span>
                <button
                  onClick={onToggleImportantOnly}
                  className={`w-9 h-5 rounded-full p-0.5 transition cursor-pointer ${
                    onlyImportantPush ? 'bg-blue-600' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      onlyImportantPush ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">
                开启后仅弹出权威机构 Flash 突发与重大政策，过滤常规简讯。
              </p>
            </div>

            {/* Anti-Loop Notice */}
            <div className="p-2 rounded-xl bg-blue-950/60 border border-blue-800/60 text-[11px] text-blue-200 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">防循环推送机制已激活：</span>
                <p className="text-[10px] text-slate-300 mt-0.5">
                  所有突发要闻仅在首次发生时推送 1 次，严禁轮播循环；往期全部内容随时可在「推送记录」中查阅。
                </p>
              </div>
            </div>

            {/* Toast Duration Settings */}
            <div className="space-y-1.5 pt-1 border-t border-slate-800">
              <span className="text-[11px] font-semibold text-slate-300">弹窗停留时长</span>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { key: 'manual', label: '📌 手动关闭 / 常驻' },
                  { key: '30s', label: '⏱️ 停留 30 秒' },
                  { key: '12s', label: '⏱️ 停留 12 秒' },
                  { key: '6s', label: '⚡ 停留 6 秒' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => handleSetDuration(opt.key as ToastDurationOption)}
                    className={`px-2.5 py-1.5 rounded-lg border text-left flex items-center justify-between transition cursor-pointer ${
                      durationSetting === opt.key
                        ? 'bg-blue-600/30 border-blue-500 text-blue-200 font-bold'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-[10px]">{opt.label}</span>
                    {durationSetting === opt.key && <Check className="w-3 h-3 text-blue-400 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Active Push Card (Enhanced with Hover-Freeze & Click-to-Read) */}
        {currentPush && (
          <div
            id="active-push-toast-card"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="w-[380px] sm:w-[420px] bg-slate-900/95 backdrop-blur-md border-2 border-blue-500/90 text-white rounded-2xl p-4 shadow-2xl shadow-blue-950/60 flex flex-col gap-2.5 transition-all duration-300 transform animate-slideUp group hover:border-blue-400"
          >
            {/* Header: Source, Urgency, Freeze Status & Close Action */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-blue-600 text-white font-bold shrink-0">
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                </span>
                <span className="text-xs font-bold font-mono text-blue-400 tracking-wide uppercase">
                  ⚡ {srcConfig?.nameCn || currentPush.sourceId} 突发首发
                </span>
                {isHovered && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-900/60 text-amber-300 border border-amber-700/60 text-[10px] font-mono">
                    已暂停倒计时
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    onSelectNews(currentPush);
                    onDismissCurrent();
                  }}
                  title="查看完整深度研报"
                  className="p-1 rounded-md text-blue-400 hover:bg-blue-900/40 transition text-xs flex items-center gap-0.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-bold">查看详情</span>
                </button>
                <button
                  onClick={onDismissCurrent}
                  title="关闭此条"
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Title & Preview Content */}
            <div
              onClick={() => {
                onSelectNews(currentPush);
                onDismissCurrent();
              }}
              className="cursor-pointer space-y-1 group"
            >
              <h3 className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-blue-300 transition leading-snug">
                {currentPush.titleCn || currentPush.title}
              </h3>
              {(currentPush.summaryCn || currentPush.summary) && (
                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                  {currentPush.summaryCn || currentPush.summary}
                </p>
              )}
            </div>

            {/* Tags & Action Bar */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {currentPush.assetClasses.slice(0, 3).map((tag, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                    {tag}
                  </span>
                ))}
              </div>
              <button
                onClick={() => {
                  onSelectNews(currentPush);
                  onDismissCurrent();
                }}
                className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-0.5 cursor-pointer"
              >
                <span>研报详情</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-Over Notification Drawer: All Historical Real-Time Pushes */}
      {isHistoryDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 h-full text-slate-100 shadow-2xl flex flex-col border-l border-slate-800 animate-slideLeft">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-600 text-white font-bold">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm">7x24 突发推送历史记录</h3>
                  <p className="text-xs text-slate-400">
                    已按时间归档 {history.length} 条已推送要闻（无循环重复）
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {history.length > 0 && (
                  <button
                    onClick={onClearHistory}
                    className="text-xs text-slate-400 hover:text-rose-400 transition flex items-center gap-1 cursor-pointer"
                    title="清空历史记录"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>清空</span>
                  </button>
                )}
                <button
                  onClick={() => setIsHistoryDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-3 border-b border-slate-800 bg-slate-900/60 space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  placeholder="搜索历史突发新闻、信源或标的..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <button
                  onClick={() => setHistoryFilterUrgency('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                    historyFilterUrgency === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  全部 ({history.length})
                </button>
                <button
                  onClick={() => setHistoryFilterUrgency('flash')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer ${
                    historyFilterUrgency === 'flash'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Zap className="w-3 h-3" />
                  <span>即时突发</span>
                </button>
                <button
                  onClick={() => setHistoryFilterUrgency('major')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer ${
                    historyFilterUrgency === 'major'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Flame className="w-3 h-3" />
                  <span>重磅要闻</span>
                </button>
              </div>
            </div>

            {/* Notification List Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredHistory.length === 0 ? (
                <div className="py-16 text-center text-slate-500 space-y-2">
                  <Radio className="w-8 h-8 mx-auto text-slate-600 animate-pulse" />
                  <p className="text-sm font-medium text-slate-400">
                    {historySearchQuery ? '没有找到符合条件的推送记录' : '暂无推送记录'}
                  </p>
                  <p className="text-xs text-slate-500">
                    当路透、彭博、财新、华尔街见闻有全新突发要闻时，系统将在此自动归档
                  </p>
                </div>
              ) : (
                filteredHistory.map((item) => {
                  const src = SOURCES_CONFIG[item.news.sourceId];
                  const timeFormatted = item.receivedAt.toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        onSelectNews(item.news);
                        setIsHistoryDrawerOpen(false);
                      }}
                      className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/80 hover:bg-slate-800/90 hover:border-blue-500/50 transition cursor-pointer space-y-1.5 group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-blue-400 bg-blue-950/80 border border-blue-800/60 px-2 py-0.5 rounded">
                            {src?.nameCn || item.news.sourceId}
                          </span>
                          {item.news.urgency === 'flash' && (
                            <span className="text-[9px] font-bold text-amber-400 bg-amber-950/60 border border-amber-800/40 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                              <Zap className="w-2.5 h-2.5" />
                              <span>突发</span>
                            </span>
                          )}
                          {item.news.urgency === 'major' && (
                            <span className="text-[9px] font-bold text-rose-400 bg-rose-950/60 border border-rose-800/40 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                              <Flame className="w-2.5 h-2.5" />
                              <span>重磅</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-slate-500">{timeFormatted}</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-100 group-hover:text-blue-300 transition leading-snug">
                        {item.news.titleCn || item.news.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {item.news.summaryCn || item.news.summary}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-3.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono text-[11px] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>防循环去重引擎保护中</span>
              </span>
              <button
                onClick={() => setIsHistoryDrawerOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer"
              >
                返回看板
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
