import React from 'react';
import { ExternalLink, ShieldCheck, CheckCircle2, Lock, Sparkles, ChevronRight, Clock, Star } from 'lucide-react';
import { NewsItem, SourceId, AccountSession } from '../types';
import { SOURCES_CONFIG } from '../data/sources';

interface SourceMatrixViewProps {
  news: NewsItem[];
  sessions: Record<SourceId, AccountSession>;
  onSelectNews: (item: NewsItem) => void;
  onOpenAccountHub: (sourceId?: SourceId) => void;
  followedNewsIds?: string[];
  onToggleFollowNews?: (newsId: string) => void;
}

export const SourceMatrixView: React.FC<SourceMatrixViewProps> = ({
  news,
  sessions,
  onSelectNews,
  onOpenAccountHub,
  followedNewsIds = [],
  onToggleFollowNews,
}) => {
  const sourcesList = Object.values(SOURCES_CONFIG);

  return (
    <div id="source-matrix-full-view" className="space-y-4 text-slate-800">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-600"></span>
            7大权威财经媒体专栏矩阵看板
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            按源分栏实时追踪：路透社 (全球宏观/央行) · 彭博社 (机构观点/金融市场) · 财新 (MarsConnect独家特稿) · FT (深度政治经济) · WSJ (美国经济/大科技) · 见闻 (即时快讯) · CNBC (美股盘中)
          </p>
        </div>

        <button
          onClick={() => onOpenAccountHub()}
          className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition"
        >
          统一多账号与 MarsConnect 授权中心
        </button>
      </div>

      {/* Multi-Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {sourcesList.map((src) => {
          const session = sessions[src.id];
          const isConnected = session?.isConnected;
          const srcNews = news.filter((n) => n.sourceId === src.id);

          return (
            <div
              key={src.id}
              className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-xs space-y-3"
            >
              {/* Column Header */}
              <div className="pb-3 border-b border-slate-200 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-sm text-slate-900">{src.nameCn}</h3>
                      <span className="text-xs text-slate-400 font-medium">({src.name})</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                      {src.bestFor}
                    </div>
                  </div>

                  {src.supportsMarsConnect ? (
                    <button
                      onClick={() => onOpenAccountHub('caixin')}
                      className={`text-[10px] px-2 py-0.5 rounded-md font-mono flex items-center gap-1 border transition ${
                        isConnected
                          ? 'bg-red-50 text-red-700 border-red-300 font-bold'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      <ShieldCheck className="w-3 h-3" />
                      <span>{isConnected ? 'MarsConnect通' : 'MarsConnect'}</span>
                    </button>
                  ) : src.requiresAuthForFull ? (
                    <button
                      onClick={() => onOpenAccountHub(src.id)}
                      className={`text-[10px] px-2 py-0.5 rounded-md font-mono flex items-center gap-1 border transition ${
                        isConnected
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {isConnected ? <CheckCircle2 className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      <span>{isConnected ? '已直连' : '登录'}</span>
                    </button>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 font-mono">
                      即时聚合
                    </span>
                  )}
                </div>

                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-[11px]">
                  <span>★ {src.userReview}</span>
                </div>
              </div>

              {/* News Stream in this Column */}
              <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[420px] pr-1">
                {srcNews.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">暂无最新资讯</p>
                ) : (
                  srcNews.map((item) => {
                    const isFollowed = followedNewsIds.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => onSelectNews(item)}
                        className="p-2.5 rounded-lg bg-slate-50 hover:bg-blue-50/50 border border-slate-200/80 hover:border-blue-300 transition cursor-pointer space-y-1.5 group"
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {item.publishedAt}
                          </span>
                          {onToggleFollowNews && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleFollowNews(item.id);
                              }}
                              className="text-slate-400 hover:text-amber-500 p-0.5"
                              title={isFollowed ? '取消关注' : '加入关注'}
                            >
                              <Star className={`w-3 h-3 ${isFollowed ? 'fill-amber-400 text-amber-500' : ''}`} />
                            </button>
                          )}
                        </div>

                        <h4 className="text-xs font-semibold text-slate-800 group-hover:text-blue-600 transition line-clamp-2">
                          {item.titleCn}
                        </h4>

                        {item.summaryCn && (
                          <p className="text-[11px] text-slate-500 line-clamp-2">
                            {item.summaryCn}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Column Footer */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                <span>共 {srcNews.length} 篇最新快讯</span>
                <a
                  href={src.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-blue-600 flex items-center gap-0.5 text-slate-400"
                >
                  <span>访问官方</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
