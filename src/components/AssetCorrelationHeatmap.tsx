import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  ArrowRightLeft,
  ShieldCheck,
  Zap,
  Info,
  ChevronRight,
  Maximize2,
  Sparkles,
  HelpCircle,
  Eye,
  Sliders,
  Check,
} from 'lucide-react';
import { MarketQuote } from '../types';
import {
  getAssetCorrelation,
  diagnoseCapitalFlow,
  CorrelationPairResult,
  MacroFlowInsight,
} from '../utils/correlationEngine';

interface AssetCorrelationHeatmapProps {
  currentQuote: MarketQuote;
  allQuotes: MarketQuote[];
  onSelectAsset?: (symbol: string) => void;
  compact?: boolean;
  theme?: 'dark' | 'light';
}

type TimeWindow = '24H' | '5D' | '1M';

export const AssetCorrelationHeatmap: React.FC<AssetCorrelationHeatmapProps> = ({
  currentQuote,
  allQuotes,
  onSelectAsset,
  compact = false,
  theme = 'dark',
}) => {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('24H');
  const [viewMode, setViewMode] = useState<'focused' | 'matrix'>('focused');
  const [hoveredPair, setHoveredPair] = useState<CorrelationPairResult | null>(null);
  const [selectedBenchmark, setSelectedBenchmark] = useState<string>('US10Y');
  const [showFormulaGuide, setShowFormulaGuide] = useState<boolean>(false);

  // List of core benchmark assets to compare against
  const coreBenchmarkSymbols = useMemo(() => [
    'XAU/USD', // 现货黄金 (避险 / 通胀)
    'SPX',     // 标普500 (美股权益 / 风险偏好)
    'US10Y',   // 十年期美债 (全球无风险利率)
    'DXY',     // 美元指数 (美元流动性)
    'USD/JPY', // 美元兑日元 (套息交易 / 亚洲外汇锚)
    'WTI',     // 原油 (大宗商品 / 实体需求)
    'BTC/USD', // 比特币 (另类高 Beta 流动性)
    'USD/CNH', // 离岸人民币 (中国资产 / 贸易流)
  ], []);

  // Assemble unique list of assets for the matrix (currentQuote + core benchmarks)
  const matrixQuotes: MarketQuote[] = useMemo(() => {
    const list: MarketQuote[] = [];
    
    // Put current asset first
    list.push(currentQuote);

    // Add remaining benchmark quotes
    for (const sym of coreBenchmarkSymbols) {
      if (sym.toUpperCase() === currentQuote.symbol.toUpperCase()) continue;
      
      const found = allQuotes.find(
        (q) => q.symbol.toUpperCase() === sym.toUpperCase()
      );
      if (found) {
        list.push(found);
      } else {
        // Fallback synthetic representation
        list.push({
          symbol: sym,
          name: sym,
          nameCn: getBenchmarkNameCn(sym),
          category: getBenchmarkCategory(sym),
          price: getBenchmarkDefaultPrice(sym),
          change: 0.15,
          changePercent: 0.42,
          high: 100,
          low: 95,
          sparkline: [95, 96, 97, 98, 99, 100],
          unit: '点',
          updateTime: '实时',
        });
      }
    }

    return list.slice(0, 7); // Keep top 6-7 items for optimal matrix layout
  }, [currentQuote, allQuotes, coreBenchmarkSymbols]);

  // Compute 1-to-N correlations (Current asset vs all core benchmarks)
  const focusedCorrelations: CorrelationPairResult[] = useMemo(() => {
    return matrixQuotes
      .filter((q) => q.symbol !== currentQuote.symbol)
      .map((q) => getAssetCorrelation(currentQuote, q, timeWindow));
  }, [currentQuote, matrixQuotes, timeWindow]);

  // Compute Full N x N Matrix
  const matrixData = useMemo(() => {
    const grid: CorrelationPairResult[][] = [];
    for (let i = 0; i < matrixQuotes.length; i++) {
      const row: CorrelationPairResult[] = [];
      for (let j = 0; j < matrixQuotes.length; j++) {
        row.push(getAssetCorrelation(matrixQuotes[i], matrixQuotes[j], timeWindow));
      }
      grid.push(row);
    }
    return grid;
  }, [matrixQuotes, timeWindow]);

  // Macro Capital Flow Diagnostic summary
  const flowInsight: MacroFlowInsight = useMemo(() => {
    return diagnoseCapitalFlow(currentQuote, allQuotes);
  }, [currentQuote, allQuotes]);

  // Active highlighted pair for inspection
  const activePairResult = useMemo(() => {
    if (hoveredPair) return hoveredPair;
    const found = focusedCorrelations.find((p) => p.assetB === selectedBenchmark);
    return found || focusedCorrelations[0] || null;
  }, [hoveredPair, focusedCorrelations, selectedBenchmark]);

  // Helper to get heatmap color based on correlation coefficient (-1 to +1)
  const getCellColorClass = (r: number) => {
    if (r === 1.0) return 'bg-slate-700/80 text-slate-300 font-bold'; // diagonal self
    if (r >= 0.75) return 'bg-emerald-600 text-white font-bold shadow-xs';
    if (r >= 0.5) return 'bg-emerald-700/80 text-emerald-100 font-bold';
    if (r >= 0.25) return 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/40';
    if (r > -0.25 && r < 0.25) return 'bg-slate-900/90 text-slate-400 border border-slate-800';
    if (r <= -0.75) return 'bg-rose-600 text-white font-bold shadow-xs';
    if (r <= -0.5) return 'bg-rose-700/80 text-rose-100 font-bold';
    if (r <= -0.25) return 'bg-rose-950/70 text-rose-300 border border-rose-800/40';
    return 'bg-slate-900 text-slate-400';
  };

  const getCellTextColor = (r: number) => {
    if (r >= 0.3) return 'text-emerald-400';
    if (r <= -0.3) return 'text-rose-400';
    return 'text-slate-400';
  };

  return (
    <div
      id="asset-correlation-matrix-card"
      className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-xl text-slate-100 space-y-4"
    >
      {/* 1. Header Bar: Title, Mode Toggles, Time Window */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <ArrowRightLeft className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">
                多资产价格相关性矩阵 (Cross-Asset Correlation)
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-semibold">
                Pearson r 热力图
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              实时测算 <strong className="text-blue-300">{currentQuote.nameCn || currentQuote.symbol}</strong> 与黄金、美债、标普等全球大类资产联动关系及资金流向
            </p>
          </div>
        </div>

        {/* Action Controls: View Switcher (Focused vs Full Matrix) & Time Window */}
        <div className="flex items-center gap-2">
          {/* Formula / Legend Help */}
          <button
            onClick={() => setShowFormulaGuide((p) => !p)}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition border border-slate-800"
            title="查看相关系数与资金流向解读指南"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setViewMode('focused')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                viewMode === 'focused'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              当前标的聚焦
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                viewMode === 'matrix'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              全景 NxN 矩阵
            </button>
          </div>

          {/* Time Window (24H / 5D / 1M) */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs font-mono">
            {(['24H', '5D', '1M'] as TimeWindow[]).map((w) => (
              <button
                key={w}
                onClick={() => setTimeWindow(w)}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition ${
                  timeWindow === w
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Formula & Reading Guide Modal/Drawer if opened */}
      {showFormulaGuide && (
        <div className="p-3 bg-blue-950/40 border border-blue-500/30 rounded-xl text-xs text-blue-200 space-y-2 animate-in fade-in duration-150">
          <div className="font-bold flex items-center gap-1.5 text-blue-300">
            <Info className="w-3.5 h-3.5" />
            <span>相关系数 (Pearson Correlation r) 判定标准与资金流向指南</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono">
            <div className="p-2 rounded bg-slate-950/60 border border-emerald-500/30 text-emerald-300">
              <div className="font-bold">+0.70 ~ +1.00 (强正相关)</div>
              <div className="text-slate-300 text-[10px] mt-0.5">
                同向共振。资金受同一宏观主线驱动（如利差驱动的 USD/JPY 与美债收益率）。
              </div>
            </div>
            <div className="p-2 rounded bg-slate-950/60 border border-slate-700 text-slate-300">
              <div className="font-bold">-0.30 ~ +0.30 (低相关/独立)</div>
              <div className="text-slate-300 text-[10px] mt-0.5">
                走势相互独立。具备极佳的资产配置分散化与降低组合波动价值。
              </div>
            </div>
            <div className="p-2 rounded bg-slate-950/60 border border-rose-500/30 text-rose-300">
              <div className="font-bold">-0.70 ~ -1.00 (强负相关)</div>
              <div className="text-slate-300 text-[10px] mt-0.5">
                经典跷跷板。资金在两资产间反向对流，具备极高对冲避险有效性（如黄金与美债收益率）。
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Main Content: Mode A (Focused Table + Cards) OR Mode B (Heatmap Grid) */}
      {viewMode === 'focused' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
          
          {/* Left Column: Focused Correlation Ranking Table (~7 cols) */}
          <div className="lg:col-span-7 space-y-2">
            <div className="text-xs font-semibold text-slate-400 flex items-center justify-between px-1">
              <span>{currentQuote.nameCn || currentQuote.symbol} 与核心基准资产相关性排布</span>
              <span className="font-mono text-[10px] text-slate-500">点击查看详细资金流向</span>
            </div>

            <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
              {focusedCorrelations.map((pair) => {
                const isSelected = selectedBenchmark === pair.assetB;
                const r = pair.correlation;
                const isPositive = r >= 0;
                const absR = Math.abs(r);

                return (
                  <div
                    key={pair.assetB}
                    onClick={() => {
                      setSelectedBenchmark(pair.assetB);
                      setHoveredPair(pair);
                    }}
                    className={`p-2.5 rounded-xl border transition cursor-pointer select-none ${
                      isSelected
                        ? 'bg-blue-950/50 border-blue-500 shadow-md'
                        : 'bg-slate-900/70 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      
                      {/* Asset B Name & Ticker */}
                      <div className="min-w-[130px] flex items-center gap-2">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${
                            r >= 0.6
                              ? 'bg-emerald-500 ring-2 ring-emerald-500/20'
                              : r <= -0.6
                              ? 'bg-rose-500 ring-2 ring-rose-500/20'
                              : 'bg-slate-500'
                          }`}
                        />
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1">
                            <span>{pair.nameB}</span>
                            <span className="text-[10px] font-mono text-slate-400">({pair.assetB})</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-sans">
                            {pair.relationship === 'strong_positive' && '强同向共振'}
                            {pair.relationship === 'moderate_positive' && '中度正相关'}
                            {pair.relationship === 'neutral' && '低度相关/独立'}
                            {pair.relationship === 'moderate_negative' && '中度反向对冲'}
                            {pair.relationship === 'strong_negative' && '强逆向跷跷板'}
                          </div>
                        </div>
                      </div>

                      {/* Visual Correlation Bar Metric */}
                      <div className="flex-1 max-w-[140px] hidden sm:block">
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex relative">
                          {/* Center Divider at 0 */}
                          <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-slate-600 z-10" />
                          
                          {/* Left Bar (Negative) */}
                          <div className="w-1/2 h-full flex justify-end">
                            {!isPositive && (
                              <div
                                className="h-full bg-rose-500 rounded-l-full transition-all duration-300"
                                style={{ width: `${Math.min(absR * 100, 100)}%` }}
                              />
                            )}
                          </div>

                          {/* Right Bar (Positive) */}
                          <div className="w-1/2 h-full flex justify-start">
                            {isPositive && (
                              <div
                                className="h-full bg-emerald-500 rounded-r-full transition-all duration-300"
                                style={{ width: `${Math.min(absR * 100, 100)}%` }}
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Numeric Pearson r Pill */}
                      <div className="text-right flex items-center gap-2">
                        <span
                          className={`font-mono text-xs px-2 py-0.5 rounded-lg border font-bold ${
                            r >= 0.3
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : r <= -0.3
                              ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {r >= 0 ? `+${r.toFixed(2)}` : r.toFixed(2)}
                        </span>
                        
                        <ChevronRight className={`w-3.5 h-3.5 text-slate-500 transition ${isSelected ? 'text-blue-400 translate-x-0.5' : ''}`} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected Pair Deep-Dive Inspector (~5 cols) */}
          <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-3 flex flex-col justify-between min-h-[340px]">
            {activePairResult ? (
              <>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <span className="text-blue-400">{activePairResult.nameA}</span>
                      <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-emerald-400">{activePairResult.nameB}</span>
                    </div>

                    <span className={`font-mono text-xs font-bold ${getCellTextColor(activePairResult.correlation)}`}>
                      r = {activePairResult.correlation >= 0 ? `+${activePairResult.correlation.toFixed(2)}` : activePairResult.correlation.toFixed(2)}
                    </span>
                  </div>

                  {/* Relationship Tag & Key Narrative */}
                  <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-200 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>{activePairResult.interpretation}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {activePairResult.flowDirection}
                    </p>
                  </div>

                  {/* Quantitative Metrics Bar: Hedge Power & Confidence */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400 font-sans">对冲避险有效性</div>
                      <div className="text-sm font-bold text-white mt-0.5 flex items-center justify-between">
                        <span>{activePairResult.hedgeEffectiveness}%</span>
                        <ShieldCheck className={`w-3.5 h-3.5 ${activePairResult.hedgeEffectiveness >= 70 ? 'text-emerald-400' : 'text-slate-500'}`} />
                      </div>
                    </div>

                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400 font-sans">统计置信度 (95% CI)</div>
                      <div className="text-sm font-bold text-emerald-400 mt-0.5">
                        {(activePairResult.pValConfidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Action to switch or follow */}
                {onSelectAsset && (
                  <button
                    id="btn-switch-to-benchmark"
                    onClick={() => onSelectAsset(activePairResult.assetB)}
                    className="w-full py-1.5 px-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <span>切换至 {activePairResult.nameB} 深度分析</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            ) : (
              <div className="text-center py-10 text-slate-500 text-xs">
                请选择左侧标的查看详细联动分析
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Mode B: Full N x N Interactive Heatmap Grid */
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-400 flex items-center justify-between px-1">
            <span>核心宏观资产多对多交叉相关系数矩阵 (N x N)</span>
            <span className="font-mono text-[10px] text-slate-500">悬停查看任意两个资产之间的联动逻辑</span>
          </div>

          <div className="overflow-x-auto pb-2">
            <table className="w-full border-collapse text-center select-none font-mono text-xs">
              <thead>
                <tr>
                  <th className="p-2 text-left font-sans text-[11px] text-slate-400 border-b border-slate-800 bg-slate-950/80 sticky left-0 z-20">
                    标的资产
                  </th>
                  {matrixQuotes.map((q) => (
                    <th
                      key={q.symbol}
                      className="p-2 border-b border-slate-800 font-bold text-slate-300 min-w-[70px] max-w-[90px]"
                    >
                      <div className="truncate text-[11px] font-sans">{q.nameCn || q.name}</div>
                      <div className="text-[9px] text-slate-500 font-mono truncate">{q.symbol}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixData.map((row, rowIdx) => {
                  const rowQuote = matrixQuotes[rowIdx];
                  const isCurrentRow = rowQuote.symbol === currentQuote.symbol;

                  return (
                    <tr key={rowQuote.symbol} className="border-b border-slate-900">
                      {/* Left sticky asset label */}
                      <td className={`p-2 text-left font-sans text-xs sticky left-0 z-10 border-r border-slate-800 ${
                        isCurrentRow ? 'bg-blue-950/80 text-blue-300 font-bold' : 'bg-slate-950 text-slate-300'
                      }`}>
                        <div className="flex items-center gap-1.5">
                          {isCurrentRow && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>}
                          <span className="truncate">{rowQuote.nameCn || rowQuote.name}</span>
                        </div>
                        <div className="text-[9px] font-mono text-slate-500">{rowQuote.symbol}</div>
                      </td>

                      {/* Matrix cells */}
                      {row.map((cell, colIdx) => {
                        const colQuote = matrixQuotes[colIdx];
                        const isDiagonal = rowIdx === colIdx;
                        const r = cell.correlation;
                        const isHovered =
                          hoveredPair?.assetA === cell.assetA && hoveredPair?.assetB === cell.assetB;

                        return (
                          <td
                            key={colQuote.symbol}
                            onMouseEnter={() => setHoveredPair(cell)}
                            onClick={() => {
                              setSelectedBenchmark(colQuote.symbol);
                              setHoveredPair(cell);
                            }}
                            className={`p-2 cursor-pointer transition-all duration-150 relative ${
                              isHovered ? 'ring-2 ring-blue-400 z-10 scale-105 shadow-lg' : ''
                            }`}
                          >
                            <div
                              className={`py-1.5 px-1 rounded-lg text-center transition ${getCellColorClass(r)}`}
                            >
                              <span className="font-mono text-xs font-bold">
                                {isDiagonal ? '1.00' : r >= 0 ? `+${r.toFixed(2)}` : r.toFixed(2)}
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Matrix Cell Hover Legend Card */}
          {hoveredPair && hoveredPair.assetA !== hoveredPair.assetB && (
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/80 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <span className="text-blue-400 font-bold">{hoveredPair.nameA}</span>
                <span className="text-slate-500">与</span>
                <span className="text-emerald-400 font-bold">{hoveredPair.nameB}</span>
                <span className="text-slate-400">相关系数:</span>
                <span className={`font-mono font-bold text-sm ${getCellTextColor(hoveredPair.correlation)}`}>
                  r = {hoveredPair.correlation >= 0 ? `+${hoveredPair.correlation.toFixed(2)}` : hoveredPair.correlation.toFixed(2)}
                </span>
                <span className="text-[11px] text-slate-300 font-sans">({hoveredPair.interpretation})</span>
              </div>

              <div className="text-[11px] text-slate-400 italic">
                {hoveredPair.flowDirection}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Bottom Macro Capital Flow Synthesis Banner (资金流向研判) */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/60 via-slate-900 to-purple-950/60 border border-blue-800/40 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-white">资金流向与宏观驱动研判</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
              {flowInsight.regimeTitle}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
            <span>置信度:</span>
            <span className="font-bold text-emerald-400">{flowInsight.confidenceScore}%</span>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed font-sans">
          {flowInsight.capitalFlowNarrative}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80">
          <span className="text-[10px] text-slate-400 font-semibold">核心驱动因素:</span>
          {flowInsight.keyDrivers.map((driver, idx) => (
            <span
              key={idx}
              className="text-[10px] px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-sans"
            >
              {driver}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

// Helpers for synthetic fallback data
function getBenchmarkNameCn(sym: string): string {
  const map: Record<string, string> = {
    'XAU/USD': '现货黄金',
    'SPX': '标普500',
    'US10Y': '十年期美债',
    'DXY': '美元指数',
    'USD/JPY': '美元/日元',
    'WTI': 'WTI原油',
    'BTC/USD': '比特币',
    'USD/CNH': '离岸人民币',
    'NVDA': '英伟达',
    'HSTECH': '恒生科技',
  };
  return map[sym] || sym;
}

function getBenchmarkCategory(sym: string): MarketQuote['category'] {
  if (sym.includes('/')) return sym.includes('BTC') ? 'crypto' : 'forex';
  if (sym === 'XAU/USD' || sym === 'WTI') return 'commodity';
  if (sym === 'US10Y') return 'yield';
  return 'index';
}

function getBenchmarkDefaultPrice(sym: string): number {
  const map: Record<string, number> = {
    'XAU/USD': 2478.5,
    'SPX': 5978.4,
    'US10Y': 4.385,
    'DXY': 104.25,
    'USD/JPY': 154.62,
    'WTI': 76.85,
    'BTC/USD': 94520,
    'USD/CNH': 7.248,
  };
  return map[sym] || 100;
}
