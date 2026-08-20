import React, { useState } from 'react';
import {
  X,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Volume2,
  Copy,
  Clock,
  Star,
  Globe2,
  Languages,
  RotateCcw
} from 'lucide-react';
import { NewsItem, SourceConfig, AccountSession, SourceId } from '../types';
import { SOURCES_CONFIG } from '../data/sources';
import { getDualTimeDisplay } from '../utils/realtimeNewsSync';

interface ArticleModalProps {
  news: NewsItem | null;
  onClose: () => void;
  sessions: Record<SourceId, AccountSession>;
  onOpenAccountHub: (sourceId?: SourceId) => void;
  isFollowed?: boolean;
  onToggleFollowNews?: (newsId: string) => void;
}

export const ArticleModal: React.FC<ArticleModalProps> = ({
  news,
  onClose,
  sessions,
  onOpenAccountHub,
  isFollowed = false,
  onToggleFollowNews,
}) => {
  const [langView, setLangView] = useState<'zh' | 'en'>('zh');
  const [copied, setCopied] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [deepAiResult, setDeepAiResult] = useState<any>(null);

  // Full-article translation state
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedArticle, setTranslatedArticle] = useState<{
    title?: string;
    content?: string;
    translatedBy?: string;
  } | null>(null);

  if (!news) return null;

  const src: SourceConfig = SOURCES_CONFIG[news.sourceId];
  const session = sessions[news.sourceId];
  const isUnlocked = !news.isPremium || session?.isConnected;

  // Dual-timezone calculation
  const dualTime = getDualTimeDisplay(news);

  // Detect if original source text is English or foreign language
  const isForeign = (() => {
    const raw = (news.title || '') + ' ' + (news.content || news.summary || '');
    const cjk = (raw.match(/[\u4e00-\u9fa5]/g) || []).length;
    const total = raw.replace(/\s+/g, '').length;
    return total > 0 && cjk / total < 0.25;
  })();

  const handleCopy = () => {
    const activeTitle = langView === 'zh'
      ? (translatedArticle?.title || news.titleCn)
      : news.title;
    const text = `${activeTitle}\n\n出处媒体：${src.nameCn} (${src.name})\n发布时间：北京时间 ${dualTime.chinaTimeFull} · ${dualTime.originLabel}\n原始链接：${news.url}\n\n核心要点：\n${(deepAiResult?.bullets || news.aiBullets || []).join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Full-text translation trigger
  const handleTranslateFullArticle = async () => {
    if (translatedArticle) {
      // Toggle to translated view
      setLangView('zh');
      return;
    }

    setIsTranslating(true);
    try {
      const response = await fetch('/api/gemini/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: news.title,
          content: news.content || news.summary,
          targetLang: 'zh',
        }),
      });

      const data = await response.json();
      if (data.success) {
        setTranslatedArticle({
          title: data.translatedTitle || news.titleCn,
          content: data.translatedContent || data.translatedText || news.contentCn,
          translatedBy: data.translatedBy || 'Gemini 3.7 Flash',
        });
        setLangView('zh');
      } else {
        throw new Error(data.error || '翻译失败');
      }
    } catch (e: any) {
      console.error('Full article translate error:', e);
      setTranslatedArticle({
        title: news.titleCn || news.title,
        content: news.contentCn || news.content,
        translatedBy: '系统备用翻译',
      });
      setLangView('zh');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleRunAiAnalysis = async () => {
    setIsSummarizing(true);
    try {
      const response = await fetch('/api/gemini/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: news.titleCn || news.title,
          content: news.contentCn || news.content,
          sourceName: src.nameCn,
        }),
      });
      const data = await response.json();
      setDeepAiResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSpeak = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const textToRead = (langView === 'zh'
        ? (translatedArticle?.content || news.contentCn)
        : news.content) || news.summaryCn;
      const utterance = new SpeechSynthesisUtterance(textToRead);
      utterance.lang = langView === 'zh' ? 'zh-CN' : 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  const impact = deepAiResult?.impact || news.impactAnalysis;
  const currentTitle = langView === 'zh'
    ? (translatedArticle?.title || news.titleCn)
    : news.title;
  const currentContent = langView === 'zh'
    ? (translatedArticle?.content || news.contentCn || news.summaryCn)
    : (news.content || news.summary);

  return (
    <div
      id="article-detail-modal"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col my-auto relative text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="sticky top-0 bg-white/95 border-b border-slate-200 px-5 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 z-10 backdrop-blur-md">
          {/* Source Attribution & Dual-Time Info */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2.5 py-1 rounded-md text-xs font-bold border flex items-center gap-1.5 ${src.badgeBg}`}>
              <Globe2 className="w-3.5 h-3.5 opacity-80" />
              <span>{src.nameCn}</span>
              <span className="text-[10px] opacity-75 font-mono">({src.ratingText})</span>
            </span>

            {/* Dual Time Pill */}
            <div
              className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-600 font-mono"
              title={`发布时间：北京时间 ${dualTime.chinaTime} ${!dualTime.isSameAsChina ? `| 原产地参考 (${dualTime.originRegion}) ${dualTime.originTime}` : ''}`}
            >
              <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="font-semibold text-slate-800">{dualTime.chinaTimeFull}</span>
              {!dualTime.isSameAsChina && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-600">{dualTime.originLabel}</span>
                </>
              )}
            </div>

            {news.author && news.author !== src.nameCn && (
              <span className="text-xs text-slate-500 font-normal">· {news.author}</span>
            )}
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2">
            {/* Direct Translate Button */}
            <button
              onClick={handleTranslateFullArticle}
              disabled={isTranslating}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition ${
                translatedArticle
                  ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:text-blue-600'
              }`}
              title="一键使用 Gemini AI 翻译全文为专业中文"
            >
              <Languages className={`w-3.5 h-3.5 ${isTranslating ? 'animate-spin text-blue-600' : 'text-blue-600'}`} />
              <span>{isTranslating ? '翻译中...' : translatedArticle ? '已译中文' : '全文翻译 (中文)'}</span>
            </button>

            {/* Language Switch */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setLangView('zh')}
                className={`px-2.5 py-0.5 rounded font-medium transition ${
                  langView === 'zh' ? 'bg-blue-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                中文
              </button>
              <button
                onClick={() => setLangView('en')}
                className={`px-2.5 py-0.5 rounded font-medium transition ${
                  langView === 'en' ? 'bg-blue-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Original EN
              </button>
            </div>

            {/* Star / Follow button */}
            {onToggleFollowNews && (
              <button
                onClick={() => onToggleFollowNews(news.id)}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-1.5 ${
                  isFollowed
                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 hover:text-amber-600'
                }`}
                title={isFollowed ? '取消关注' : '加入我的关注'}
              >
                <Star className={`w-3.5 h-3.5 ${isFollowed ? 'fill-amber-400 text-amber-500' : 'text-slate-400'}`} />
                <span className="hidden sm:inline">{isFollowed ? '已关注' : '关注'}</span>
              </button>
            )}

            <button
              onClick={handleSpeak}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 hover:text-blue-600 transition"
              title="朗读正文"
            >
              <Volume2 className="w-4 h-4" />
            </button>

            <button
              onClick={handleCopy}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 hover:text-blue-600 transition"
              title="复制资讯及要点"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-500 hover:text-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Article Header with Translation Notice */}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
              {currentTitle}
            </h1>
            {langView === 'zh' && news.title !== currentTitle && (
              <p className="text-xs text-slate-500 font-serif italic mt-2">
                英文原标题: {news.title}
              </p>
            )}
            {translatedArticle?.translatedBy && langView === 'zh' && (
              <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-[11px] text-blue-700 font-medium">
                <Sparkles className="w-3 h-3 text-blue-500" />
                <span>已由 {translatedArticle.translatedBy} 翻译为中文金融术语规范版</span>
              </div>
            )}
          </div>

          {/* Account / MarsConnect Status Banner */}
          {news.isPremium && (
            <div
              className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                isUnlocked
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
            >
              <div className="flex items-center gap-3">
                {isUnlocked ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <Lock className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <div>
                  <h4 className="text-xs font-bold">
                    {isUnlocked
                      ? `已通过 ${session?.connectionMethod === 'marsconnect' ? 'MarsConnect 插件' : session?.username || '专属授权'} 解锁全文权限`
                      : `此内容为 ${src.nameCn} 深度专栏/独家付费资讯`}
                  </h4>
                  <p className="text-[11px] opacity-90 mt-0.5">
                    {isUnlocked
                      ? '已为您自动调取高阶机构专栏与图表完整正文。'
                      : '您可以随时配置登录该媒体账户或启动 MarsConnect 插件联通。'}
                  </p>
                </div>
              </div>

              {!isUnlocked && (
                <button
                  onClick={() => onOpenAccountHub(news.sourceId)}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition"
                >
                  {src.supportsMarsConnect ? '使用 MarsConnect 联通' : '登录/授权此媒体'}
                </button>
              )}
            </div>
          )}

          {/* AI Key Insights Bullet Points */}
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600" />
                Gemini 30秒宏观研报提炼 (Key Takeaways)
              </span>
              <button
                onClick={handleRunAiAnalysis}
                disabled={isSummarizing}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
              >
                {isSummarizing ? '分析中...' : '重新深度研判'}
              </button>
            </div>

            <ul className="space-y-1.5 text-xs text-slate-700">
              {(deepAiResult?.bullets || deepAiResult?.keyTakeaways || news.aiBullets || []).map((bullet: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>
                  <span className="leading-relaxed">{bullet}</span>
                </li>
              ))}
            </ul>

            {impact && (
              <div className="mt-3 pt-2.5 border-t border-blue-200/80 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="bg-white p-2 rounded-lg border border-blue-100">
                  <div className="text-slate-500 font-medium text-[10px]">外汇及利率影响</div>
                  <div className="font-bold text-slate-800 mt-0.5">{impact.forex || '中性平稳'}</div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-blue-100">
                  <div className="text-slate-500 font-medium text-[10px]">股市与板块效应</div>
                  <div className="font-bold text-slate-800 mt-0.5">{impact.equities || '结构性分化'}</div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-blue-100">
                  <div className="text-slate-500 font-medium text-[10px]">大宗商品与债市</div>
                  <div className="font-bold text-slate-800 mt-0.5">{impact.commodities || '供需主导'}</div>
                </div>
              </div>
            )}
          </div>

          {/* Article Text Content */}
          <div className="space-y-4 text-slate-700 leading-relaxed text-sm sm:text-base font-normal">
            <div className={`whitespace-pre-line space-y-4 ${langView === 'en' ? 'font-serif text-slate-800' : ''}`}>
              {currentContent}
            </div>
          </div>

          {/* Bottom Footer Details */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400">出处媒体:</span>
              <span className="font-semibold text-slate-700">{src.nameCn} ({src.name})</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-400">标签:</span>
              {news.tags.map((t, idx) => (
                <span key={idx} className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  #{t}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {isForeign && (
                <button
                  onClick={handleTranslateFullArticle}
                  disabled={isTranslating}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium flex items-center gap-1.5 transition border border-blue-200"
                >
                  <Languages className="w-3.5 h-3.5" />
                  <span>{translatedArticle ? '重新翻译' : '翻译全文'}</span>
                </button>
              )}

              {news.url && (
                <a
                  href={news.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-blue-600 font-medium flex items-center gap-1.5 transition"
                >
                  <span>查看原网页</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
