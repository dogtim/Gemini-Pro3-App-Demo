import React from 'react';
import { FileAudio, RefreshCw, Loader2 } from 'lucide-react';
import { Episode } from '../types';

interface EpisodeListProps {
  episodes: Episode[];
  onSelectEpisode: (ep: Episode) => void;
  onUploadClick: () => void;
  onRefreshClick: () => void;
  selectedId?: string;
  isRefreshing: boolean;
}

export const EpisodeList: React.FC<EpisodeListProps> = ({ 
  episodes, 
  onSelectEpisode, 
  onUploadClick, 
  onRefreshClick,
  selectedId,
  isRefreshing
}) => {
  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 w-full md:w-80">
      <div className="p-6 border-b border-slate-800">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="bg-gradient-to-r from-purple-500 to-blue-500 w-8 h-8 rounded flex items-center justify-center">
            G
          </span>
          股癌筆記
        </h2>
        <p className="text-xs text-slate-400 mt-1">Powered by Gemini 2.5</p>
      </div>

      <div className="p-4 flex flex-col h-full overflow-hidden">
        <button
          onClick={onUploadClick}
          className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg border border-slate-700 border-dashed flex items-center justify-center gap-2 transition-all mb-4 flex-shrink-0"
        >
          <FileAudio size={18} />
          <span>上傳音訊檔分析</span>
        </button>

        <div className="flex items-center justify-between mb-3 pl-2 flex-shrink-0">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            集數列表
          </div>
          <button 
            onClick={onRefreshClick}
            disabled={isRefreshing}
            className="text-slate-400 hover:text-blue-400 transition-colors p-1 rounded-full hover:bg-slate-800 disabled:opacity-50"
            title="從網路更新最新集數"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin text-blue-400" : ""} />
          </button>
        </div>
        
        <div className="space-y-2 overflow-y-auto flex-1 pr-2 custom-scrollbar">
          {isRefreshing && episodes.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-slate-600" size={24} />
            </div>
          ) : (
            episodes.map((ep) => (
              <button
                key={ep.id}
                onClick={() => onSelectEpisode(ep)}
                className={`w-full text-left p-3 rounded-lg transition-all group border ${
                  selectedId === ep.id
                    ? 'bg-slate-800 border-blue-500/50 shadow-lg shadow-blue-900/20'
                    : 'bg-transparent border-transparent hover:bg-slate-800/50'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-sm font-bold ${selectedId === ep.id ? 'text-blue-400' : 'text-slate-300'}`}>
                    {ep.episodeNumber}
                  </span>
                  <span className="text-[10px] text-slate-500">{ep.date}</span>
                </div>
                <div className="text-sm text-slate-400 truncate group-hover:text-slate-200 transition-colors">
                  {ep.title}
                </div>
              </button>
            ))
          )}
          {episodes.length === 0 && !isRefreshing && (
            <div className="text-center py-8 text-slate-600 text-sm">
              無集數資料，請點擊重新整理
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto p-4 border-t border-slate-800 text-xs text-slate-600 text-center flex-shrink-0">
        此網站為 Demo 用途<br/>資料來源：Gooaye 股癌
      </div>
    </div>
  );
};
