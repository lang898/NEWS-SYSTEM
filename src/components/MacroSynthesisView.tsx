import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  RefreshCw,
  Layers,
  ArrowRight,
  TrendingUp,
  ShieldAlert,
  Compass,
  FileText,
  Copy,
  CheckCircle2,
  PieChart
} from 'lucide-react';
import { NewsItem } from '../types';

interface MacroSynthesisViewProps {
  news: NewsItem[];
}

export const MacroSynthesisView: React.FC<MacroSynthesisViewProps> = ({ news }) => {
  const [loading, setLoading] = useState(false);
  const [synthesisData, setSynthesisData] = useState<any>(null);
  const [selectedTopic, setSelectedTopic] = useState('全球流动性与大类资产跨区域轮动');
  const [copied, setCopied] = useState(false);

  const predefinedTopics = [
    '全球流动性与大类资产跨区域轮动',
    '美联储与中国央行货币政策分化与汇率传导',
    'AI算力基础设施资本开支回报率与半导体链条',
    '大西洋两岸财政赤字与全球主权债务供给压力',
  ];

  const fetchSynthesis = async (topic: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/gemini/macro-synthesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          activeNewsList: news,
        }),
      });
      const data = await res.json();
      if (data.synthesis) {
        setSynthesisData(data.synthesis);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSynthesis(selectedTopic);
  }, []);

  const handleCopyReport = () => {
    if (!synthesisData) return;
    const text = `【Global FinPulse 宏观交叉研报 - ${synthesisData.theme || selectedTopic}】\n生成时间: ${new Date().toLocaleString()}\n\n【核心共识与核心异同】\n${synthesisData.executiveSummary || ''}\n\n【各源论点交叉】\n${(synthesisData.sourceCrossChecks || []).map((s: any) => `• ${s.sourceName}: ${s.keyPerspective}`).join('\n')}\n\n【股债汇传导映射】\n${(synthesisData.transmissionChain || []).join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="macro-synthesis-view" className="space-y-4 text-slate-800">
      {/* Header & Topic Selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Gemini 多源跨平台宏观交叉研报与传导映射
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                实时对比彭博、路透、财新、FT及WSJ对同一热点话题的核心分歧与共识
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchSynthesis(selectedTopic)}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'AI 正在比对全网信源...' : '重新生成交叉研报'}</span>
          </button>

          <button
            onClick={handleCopyReport}
            disabled={!synthesisData}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '已复制研报' : '复制研报全文'}</span>
          </button>
        </div>
      </div>

      {/* Preset Topics */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <span className="text-xs text-slate-400 font-medium shrink-0">研判主题:</span>
        {predefinedTopics.map((topic) => (
          <button
            key={topic}
            onClick={() => {
              setSelectedTopic(topic);
              fetchSynthesis(topic);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition ${
              selectedTopic === topic
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            {topic}
          </button>
        ))}
      </div>

      {/* Main Report Body */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3 shadow-xs">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <h4 className="text-sm font-bold text-slate-800">Gemini 正在跨源交叉比对...</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            正在抓取路透社全球通胀模型、彭博社量化观点、财新宏观特稿与FT政治经济观察并构建股债汇联动矩阵。
          </p>
        </div>
      ) : synthesisData ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Executive Summary & Cross Checks */}
          <div className="lg:col-span-8 space-y-4">
            {/* Executive Summary */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>核心共识与宏观异同提炼 (Executive Synthesis)</span>
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-xl border border-slate-200">
                {synthesisData.executiveSummary}
              </p>
            </div>

            {/* Source Cross-Checks */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>各源独家论点对比 (Multi-Source Cross Examination)</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(synthesisData.sourceCrossChecks || []).map((sc: any, idx: number) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{sc.sourceName}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        {sc.stance || '观点对比'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {sc.keyPerspective}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Transmission Chain & Trading Implications */}
          <div className="lg:col-span-4 space-y-4">
            {/* Transmission Chain */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Compass className="w-4 h-4 text-blue-600" />
                <span>股债汇大类资产传导路径</span>
              </h3>
              <div className="space-y-2 text-xs">
                {(synthesisData.transmissionChain || []).map((step: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px] shrink-0 font-mono">
                      {idx + 1}
                    </span>
                    <span className="text-slate-700 leading-relaxed pt-0.5">{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk & Alpha Alert */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 shadow-xs space-y-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <h4 className="text-xs font-bold text-amber-900">宏观尾部风险与敞口提示</h4>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                {synthesisData.riskWarning || '需密切防范地缘意外事件引发的大宗商品波动加剧及跨币种流动性挤压风险。'}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
