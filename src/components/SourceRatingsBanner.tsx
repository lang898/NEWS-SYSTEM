import React from 'react';
import { Star, ExternalLink, ShieldCheck, CheckCircle2, Lock, ArrowRight, Radio, Filter } from 'lucide-react';
import { SOURCES_CONFIG } from '../data/sources';
import { SourceId, AccountSession } from '../types';

interface SourceRatingsBannerProps {
  selectedSource: SourceId | 'all';
  onSelectSource: (source: SourceId | 'all') => void;
  sessions: Record<SourceId, AccountSession>;
  onOpenAccountHub: (sourceId?: SourceId) => void;
}

export const SourceRatingsBanner: React.FC<SourceRatingsBannerProps> = ({
  selectedSource,
  onSelectSource,
  sessions,
  onOpenAccountHub,
}) => {
  const sourcesList = Object.values(SOURCES_CONFIG);

  return (
    <div id="source-ratings-matrix-section" className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-600"></span>
              全球顶尖财经媒体多源矩阵与权威评价
            </h2>
            <span className="text-[11px] text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              7大核心源全覆盖
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            根据专业度、突发时效与深度评级，点击任意媒体卡片即可快速过滤专属情报流或直连登录鉴权
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-filter-all-sources"
            onClick={() => onSelectSource('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              selectedSource === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>全部多源聚合 ({sourcesList.length})</span>
          </button>
        </div>
      </div>

      {/* Grid of the rated sources */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {sourcesList.map((src) => {
          const isSelected = selectedSource === src.id;
          const session = sessions[src.id];
          const isConnected = session?.isConnected;

          return (
            <div
              key={src.id}
              id={`source-card-${src.id}`}
              onClick={() => onSelectSource(isSelected ? 'all' : src.id)}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between relative group ${
                isSelected
                  ? 'bg-blue-50/60 border-blue-500 shadow-xs ring-1 ring-blue-500/30'
                  : 'bg-slate-50 border-slate-200/80 hover:border-slate-300 hover:bg-white'
              }`}
            >
              <div>
                {/* Header: Name + Stars + Auth Pill */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition">
                        {src.name}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">{src.nameCn}</span>
                    </div>
                    {/* Stars */}
                    <div className="flex items-center gap-1 mt-0.5 text-amber-500 text-xs font-mono">
                      <span>{src.ratingText}</span>
                      <span className="text-[10px] text-slate-400">({src.stars}分)</span>
                    </div>
                  </div>

                  {/* Connection / Auth status */}
                  <div className="shrink-0">
                    {src.supportsMarsConnect ? (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenAccountHub('caixin');
                        }}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-md flex items-center gap-1 border transition ${
                          isConnected
                            ? 'bg-red-50 border-red-300 text-red-700 font-semibold'
                            : 'bg-slate-200 border-slate-300 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        <ShieldCheck className="w-3 h-3 text-red-600" />
                        {isConnected ? 'MarsConnect已联' : 'MarsConnect授权'}
                      </span>
                    ) : src.requiresAuthForFull ? (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenAccountHub(src.id);
                        }}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-md flex items-center gap-1 border transition ${
                          isConnected
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-semibold'
                            : 'bg-slate-200 border-slate-300 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        {isConnected ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <Lock className="w-3 h-3" />}
                        {isConnected ? '已登录' : '可登录账户'}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-200 text-slate-600 border border-slate-300">
                        公开源
                      </span>
                    )}
                  </div>
                </div>

                {/* User rating comment */}
                <div className="mt-1.5 p-2 rounded-lg bg-white border border-slate-200 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <span className="text-amber-500 font-bold">★ 专家评语:</span>
                    <span>{src.userReview}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 line-clamp-1">
                    🎯 优势: {src.bestFor}
                  </div>
                </div>
              </div>

              {/* Bottom Quick Controls */}
              <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1 text-slate-400">
                  <Radio className="w-3 h-3 text-blue-600" />
                  <span>{isSelected ? '正在展示此源' : '点击筛选快讯'}</span>
                </span>
                <a
                  href={src.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-blue-600 flex items-center gap-0.5 text-slate-400"
                >
                  <span>官网</span>
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
