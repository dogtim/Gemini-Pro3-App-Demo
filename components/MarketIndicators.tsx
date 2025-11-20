import React, { useEffect, useState } from 'react';
import { fetchFearAndGreedIndex } from '../services/geminiService';
import { FearAndGreedIndex } from '../types';
import { Loader2, RefreshCw } from 'lucide-react';

export const MarketIndicators: React.FC = () => {
  const [data, setData] = useState<FearAndGreedIndex | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await fetchFearAndGreedIndex();
      setData(result);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Gauge Helper
  const getRotation = (score: number) => {
    // Map 0-100 to -180deg to 0deg (for a semi-circle)
    // Actually, let's do a 180 degree arc from left to right.
    // 0 = -90deg (left), 50 = 0deg (top), 100 = 90deg (right) relative to center top?
    // Let's stick to a standard SVG path calculation.
    // 0 -> 180 deg (left side)
    // 100 -> 0 deg (right side)
    // Current implementation logic: 
    // 0 should be at 9 o'clock position (180 deg)
    // 100 should be at 3 o'clock position (0 deg)
    // Wait, standard CSS rotate starts at 3 o'clock (0deg) and goes clockwise.
    // So we want 0 (score) => 180deg (left)
    // 100 (score) => 0deg (right) ?? No, usually gauges go clockwise.
    // Let's do: 0 (Extreme Fear) = 180deg
    // 100 (Extreme Greed) = 360deg (or 0)
    
    // Let's map score 0-100 to angle -90deg to 90deg for the needle
    return (score / 100) * 180 - 90; 
  };

  const getScoreColor = (score: number) => {
    if (score < 25) return '#ef4444'; // Extreme Fear (Red)
    if (score < 45) return '#f97316'; // Fear (Orange)
    if (score < 55) return '#eab308'; // Neutral (Yellow)
    if (score < 75) return '#84cc16'; // Greed (Light Green)
    return '#22c55e'; // Extreme Greed (Green)
  };

  return (
    <div className="w-full h-full bg-slate-950 p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-white">市場情緒指標</h2>
          <button 
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-blue-400 hover:bg-slate-700 transition-all"
          >
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Fear & Greed Index Card */}
          <div className="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"></div>
             
             <h3 className="text-3xl font-bold text-slate-900 mb-2">Fear & Greed Index</h3>
             <p className="text-slate-500 text-sm mb-8 text-center">
               What emotion is driving the market now? <br/>
               <span className="text-xs opacity-70">Data fetched via Google Search Grounding</span>
             </p>

             {loading ? (
               <div className="h-64 flex items-center justify-center">
                 <Loader2 className="animate-spin text-slate-400" size={48} />
               </div>
             ) : data ? (
               <div className="relative w-full max-w-[300px] aspect-[2/1.2] flex flex-col items-center">
                 {/* Gauge SVG */}
                 <svg viewBox="0 0 200 110" className="w-full overflow-visible">
                   {/* Gradient Definition */}
                   <defs>
                     <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                       <stop offset="0%" stopColor="#ef4444" /> {/* Extreme Fear */}
                       <stop offset="25%" stopColor="#f97316" /> {/* Fear */}
                       <stop offset="50%" stopColor="#eab308" /> {/* Neutral */}
                       <stop offset="75%" stopColor="#84cc16" /> {/* Greed */}
                       <stop offset="100%" stopColor="#22c55e" /> {/* Extreme Greed */}
                     </linearGradient>
                   </defs>
                   
                   {/* Background Arc */}
                   <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#f1f5f9" strokeWidth="20" strokeLinecap="round" />
                   
                   {/* Colored Arc (Full gradient) */}
                   <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#gaugeGradient)" strokeWidth="20" strokeLinecap="round" />
                   
                   {/* Needle */}
                   <g style={{ transform: `rotate(${getRotation(data.score)}deg)`, transformOrigin: '100px 100px', transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                      <line x1="100" y1="100" x2="100" y2="30" stroke="#1e293b" strokeWidth="4" />
                      <circle cx="100" cy="100" r="6" fill="#1e293b" />
                   </g>
                   
                   {/* Labels */}
                   <text x="15" y="120" fontSize="10" fill="#ef4444" textAnchor="middle" fontWeight="bold">EXTREME FEAR</text>
                   <text x="185" y="120" fontSize="10" fill="#22c55e" textAnchor="middle" fontWeight="bold">EXTREME GREED</text>
                 </svg>

                 {/* Score Display */}
                 <div className="flex flex-col items-center -mt-4">
                    <span className="text-5xl font-black text-slate-800" style={{ color: getScoreColor(data.score) }}>
                      {Math.round(data.score)}
                    </span>
                    <span className="text-lg font-medium text-slate-600 uppercase tracking-wide">
                      {data.rating}
                    </span>
                 </div>

                 <div className="mt-6 text-xs text-slate-400">
                    Last updated: {data.timestamp}
                 </div>
               </div>
             ) : (
               <div className="text-red-500">Failed to load data</div>
             )}
          </div>

          {/* Placeholder for future indicators */}
          <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 flex flex-col items-center justify-center text-center opacity-50 hover:opacity-100 transition-opacity">
              <div className="text-4xl mb-4">📈</div>
              <h3 className="text-xl font-bold text-white">更多指標即將推出</h3>
              <p className="text-slate-400 mt-2">台股大盤 P/E, VIX 指數...</p>
          </div>
        </div>
      </div>
    </div>
  );
};