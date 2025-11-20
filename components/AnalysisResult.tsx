import React from 'react';
import { TrendingUp, TrendingDown, Minus, ExternalLink, FileText, CheckCircle2 } from 'lucide-react';
import { PodcastAnalysis, SentimentType } from '../types';

interface AnalysisResultProps {
  analysis: PodcastAnalysis;
  sources: { title: string; uri: string }[];
}

export const AnalysisResult: React.FC<AnalysisResultProps> = ({ analysis, sources }) => {
  const bullishCompanies = analysis.companies.filter(c => c.sentiment === SentimentType.BULLISH);
  const bearishCompanies = analysis.companies.filter(c => c.sentiment === SentimentType.BEARISH);
  
  // Taiwan specific: Red is Up/Good, Green is Down/Bad
  const bullColor = "text-stock-up"; 
  const bullBg = "bg-red-500/10 border-red-500/20";
  const bearColor = "text-stock-down";
  const bearBg = "bg-green-500/10 border-green-500/20";

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8 pb-20">
      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20">
          <CheckCircle2 size={14} />
          AI 分析完成
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
          {analysis.episodeTitle || "未知集數"}
        </h1>
      </div>

      {/* Summary Section */}
      <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FileText className="text-purple-400" size={20} />
          本集重點整理
        </h3>
        <ul className="space-y-3">
          {analysis.summaryPoints.map((point, idx) => (
            <li key={idx} className="flex items-start gap-3 text-slate-300 leading-relaxed">
              <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-purple-500 mt-2.5" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bullish Column */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <TrendingUp className="text-stock-up" size={24} />
            看好 / 多頭觀點
          </h3>
          {bullishCompanies.length === 0 ? (
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 text-sm italic">
              本集未特別提及看好標的
            </div>
          ) : (
            bullishCompanies.map((item, idx) => (
              <div key={idx} className={`p-5 rounded-xl border transition-all hover:shadow-md hover:shadow-red-900/10 ${bullBg}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="font-bold text-white text-lg">
                    {item.name}
                    {item.ticker && <span className="ml-2 text-sm font-mono text-slate-400">({item.ticker})</span>}
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded bg-slate-950 ${bullColor}`}>
                    BULLISH
                  </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {item.reason}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Bearish Column */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <TrendingDown className="text-stock-down" size={24} />
            看壞 / 疑慮 / 觀望
          </h3>
          {bearishCompanies.length === 0 ? (
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 text-sm italic">
              本集未特別提及看壞標的
            </div>
          ) : (
            bearishCompanies.map((item, idx) => (
              <div key={idx} className={`p-5 rounded-xl border transition-all hover:shadow-md hover:shadow-green-900/10 ${bearBg}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="font-bold text-white text-lg">
                    {item.name}
                    {item.ticker && <span className="ml-2 text-sm font-mono text-slate-400">({item.ticker})</span>}
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded bg-slate-950 ${bearColor}`}>
                    BEARISH
                  </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {item.reason}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Sources / Disclaimer */}
      {sources.length > 0 && (
        <div className="mt-8 pt-6 border-t border-slate-800">
          <h4 className="text-sm font-medium text-slate-400 mb-3">AI 參考資料來源</h4>
          <div className="flex flex-wrap gap-3">
            {sources.map((source, idx) => (
              <a 
                key={idx} 
                href={source.uri} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 hover:underline bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800 transition-colors"
              >
                <ExternalLink size={10} />
                <span className="truncate max-w-[200px]">{source.title || source.uri}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
