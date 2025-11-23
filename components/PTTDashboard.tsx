
import React, { useState } from 'react';
import axios from 'axios';
import { RefreshCw, TrendingUp, TrendingDown, Minus, ExternalLink, AlertCircle } from 'lucide-react';

interface PTTPost {
    title: string;
    author: string;
    date: string;
    link: string;
    pushCount: string;
    stockId: string | null;
    sentiment: 'Bullish' | 'Bearish' | 'Neutral';
    reason?: string;
    category: 'Target' | 'Other';
}

interface Opinion {
    type: 'Bullish' | 'Bearish' | 'Neutral';
    content: string;
}

interface SingleAnalysis {
    title: string;
    sentiment: 'Bullish' | 'Bearish' | 'Neutral';
    reason: string;
    opinions: Opinion[];
}

export const PTTDashboard: React.FC = () => {
    const [posts, setPosts] = useState<PTTPost[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Single URL Analysis State
    const [urlInput, setUrlInput] = useState('');
    const [isAnalyzingUrl, setIsAnalyzingUrl] = useState(false);
    const [singleAnalysis, setSingleAnalysis] = useState<SingleAnalysis | null>(null);

    const fetchPTTData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axios.get('http://localhost:3001/api/ptt-sentiment');
            if (response.data.success) {
                setPosts(response.data.data);
                setLastUpdated(new Date());
            } else {
                setError('Failed to fetch data');
            }
        } catch (err) {
            console.error(err);
            setError('無法連接到後端伺服器。請確認您已執行 "npm run server"。');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnalyzeUrl = async () => {
        if (!urlInput) return;
        setIsAnalyzingUrl(true);
        setSingleAnalysis(null);
        try {
            const response = await axios.post('http://localhost:3001/api/analyze-url', { url: urlInput });
            if (response.data.success) {
                setSingleAnalysis(response.data.data);
            }
        } catch (err) {
            console.error(err);
            alert('分析失敗，請確認網址是否正確');
        } finally {
            setIsAnalyzingUrl(false);
        }
    };

    // Calculate stats
    const bullishCount = posts.filter(p => p.sentiment === 'Bullish').length;
    const bearishCount = posts.filter(p => p.sentiment === 'Bearish').length;
    const totalCount = bullishCount + bearishCount; // Exclude neutral for ratio
    const bullishPercentage = totalCount > 0 ? Math.round((bullishCount / totalCount) * 100) : 0;
    const bearishPercentage = totalCount > 0 ? 100 - bullishPercentage : 0;

    return (
        <div className="h-full flex flex-col p-6 overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-1">PTT 股市版指標</h2>
                    <p className="text-slate-400 text-sm">
                        即時爬取 PTT Stock 版 [標的] 與熱門文章，利用 AI 分析多空情緒
                        {lastUpdated && <span className="ml-2 text-slate-500">Last updated: {lastUpdated.toLocaleTimeString()}</span>}
                    </p>
                </div>
                <button
                    onClick={fetchPTTData}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                    {isLoading ? 'AI 分析中...' : '更新數據'}
                </button>
            </div>

            {/* Single URL Analysis Section */}
            <div className="bg-slate-900 rounded-xl p-6 mb-6 border border-slate-800 flex-shrink-0">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <ExternalLink size={20} className="text-blue-400" />
                    單篇深度分析
                </h3>
                <div className="flex gap-4 mb-4">
                    <input
                        type="text"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="輸入 PTT 文章網址 (e.g., https://www.ptt.cc/bbs/Stock/...)"
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                    <button
                        onClick={handleAnalyzeUrl}
                        disabled={isAnalyzingUrl || !urlInput}
                        className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                        {isAnalyzingUrl ? '分析中...' : 'AI 分析'}
                    </button>
                </div>

                {singleAnalysis && (
                    <div className="bg-slate-950/50 rounded-lg p-4 border border-slate-800 animate-in fade-in slide-in-from-top-2">
                        <div className="flex justify-between items-start mb-4">
                            <h4 className="font-bold text-lg text-slate-200">{singleAnalysis.title}</h4>
                            <span className={`px-3 py-1 rounded text-sm font-bold ${singleAnalysis.sentiment === 'Bullish' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                    singleAnalysis.sentiment === 'Bearish' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                        'bg-slate-700 text-slate-400 border border-slate-600'
                                }`}>
                                {singleAnalysis.sentiment}
                            </span>
                        </div>
                        <p className="text-slate-400 mb-4 text-sm bg-slate-900 p-3 rounded border border-slate-800">
                            <span className="text-blue-400 font-bold">AI 總結：</span> {singleAnalysis.reason}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-red-950/20 p-3 rounded border border-red-900/30">
                                <h5 className="text-red-400 font-bold mb-2 flex items-center gap-1"><TrendingUp size={16} /> 看多觀點</h5>
                                <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
                                    {singleAnalysis.opinions.filter(o => o.type === 'Bullish').map((o, i) => (
                                        <li key={i}>{o.content}</li>
                                    ))}
                                    {singleAnalysis.opinions.filter(o => o.type === 'Bullish').length === 0 && <li>無明顯看多觀點</li>}
                                </ul>
                            </div>
                            <div className="bg-green-950/20 p-3 rounded border border-green-900/30">
                                <h5 className="text-green-400 font-bold mb-2 flex items-center gap-1"><TrendingDown size={16} /> 看空觀點</h5>
                                <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
                                    {singleAnalysis.opinions.filter(o => o.type === 'Bearish').map((o, i) => (
                                        <li key={i}>{o.content}</li>
                                    ))}
                                    {singleAnalysis.opinions.filter(o => o.type === 'Bearish').length === 0 && <li>無明顯看空觀點</li>}
                                </ul>
                            </div>
                            <div className="bg-slate-800/30 p-3 rounded border border-slate-700/50">
                                <h5 className="text-slate-400 font-bold mb-2 flex items-center gap-1"><Minus size={16} /> 中立/其他</h5>
                                <ul className="list-disc list-inside text-xs text-slate-500 space-y-1">
                                    {singleAnalysis.opinions.filter(o => o.type === 'Neutral').map((o, i) => (
                                        <li key={i}>{o.content}</li>
                                    ))}
                                    {singleAnalysis.opinions.filter(o => o.type === 'Neutral').length === 0 && <li>無明顯中立觀點</li>}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 flex items-center gap-3 text-red-400 flex-shrink-0">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                </div>
            )}

            {/* Sentiment Meter */}
            {posts.length > 0 && (
                <div className="bg-slate-900 rounded-xl p-6 mb-6 border border-slate-800 flex-shrink-0">
                    <div className="flex justify-between items-end mb-2">
                        <div className="flex items-center gap-2 text-red-500">
                            <TrendingUp size={24} />
                            <span className="text-2xl font-bold">{bullishCount}</span>
                            <span className="text-sm font-medium">看多 (Bullish)</span>
                        </div>
                        <div className="flex items-center gap-2 text-green-500">
                            <span className="text-sm font-medium">看空 (Bearish)</span>
                            <span className="text-2xl font-bold">{bearishCount}</span>
                            <TrendingDown size={24} />
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden flex">
                        <div
                            className="h-full bg-red-500 transition-all duration-1000 ease-out"
                            style={{ width: `${bullishPercentage}%` }}
                        />
                        <div
                            className="h-full bg-green-500 transition-all duration-1000 ease-out"
                            style={{ width: `${bearishPercentage}%` }}
                        />
                    </div>

                    <div className="flex justify-between mt-2 text-xs text-slate-500">
                        <span>{bullishPercentage}% 多方情緒</span>
                        <span>{bearishPercentage}% 空方情緒</span>
                    </div>
                </div>
            )}

            {/* Stock Table */}
            <div className="flex-1 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-800 font-medium text-slate-400 grid grid-cols-12 gap-4">
                    <div className="col-span-2">日期</div>
                    <div className="col-span-1">分類</div>
                    <div className="col-span-1">代號</div>
                    <div className="col-span-4">標題</div>
                    <div className="col-span-1 text-center">推噓</div>
                    <div className="col-span-3 text-center">AI 情緒分析</div>
                </div>

                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    {posts.length === 0 && !isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <p>尚無數據，請點擊「更新數據」開始爬取與分析</p>
                        </div>
                    ) : (
                        posts.map((post, index) => (
                            <div
                                key={index}
                                className="grid grid-cols-12 gap-4 p-4 border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors items-center text-sm"
                            >
                                <div className="col-span-2 text-slate-400">{post.date}</div>
                                <div className="col-span-1">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${post.category === 'Target'
                                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                        : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                        }`}>
                                        {post.category === 'Target' ? '標的' : '其他'}
                                    </span>
                                </div>
                                <div className="col-span-1 font-mono text-blue-400">{post.stockId || '-'}</div>
                                <div className="col-span-4 font-medium text-slate-200 truncate">
                                    <a href={post.link} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 flex items-center gap-1 group">
                                        {post.title}
                                        <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </a>
                                </div>
                                <div className={`col-span-1 text-center font-mono ${post.pushCount === '爆' ? 'text-red-500 font-bold' :
                                    parseInt(post.pushCount) > 50 ? 'text-red-400' :
                                        parseInt(post.pushCount) < 0 ? 'text-green-400' : 'text-slate-400'
                                    }`}>
                                    {post.pushCount || '0'}
                                </div>
                                <div className="col-span-3 flex flex-col items-center justify-center gap-1">
                                    {post.sentiment === 'Bullish' && (
                                        <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-bold border border-red-500/30">
                                            看多
                                        </span>
                                    )}
                                    {post.sentiment === 'Bearish' && (
                                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-bold border border-green-500/30">
                                            看空
                                        </span>
                                    )}
                                    {post.sentiment === 'Neutral' && (
                                        <span className="px-2 py-1 bg-slate-700 text-slate-400 rounded text-xs border border-slate-600">
                                            中立
                                        </span>
                                    )}
                                    {post.reason && (
                                        <span className="text-[10px] text-slate-500 text-center leading-tight max-w-[150px]">
                                            {post.reason}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
