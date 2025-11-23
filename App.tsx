import React, { useState, useEffect } from 'react';
import { EpisodeList } from './components/EpisodeList';
import { AnalysisResult } from './components/AnalysisResult';
import { MarketIndicators } from './components/MarketIndicators';
import { PTTDashboard } from './components/PTTDashboard';
import { Episode, PodcastAnalysis } from './types';
import { analyzePodcast, fetchRecentEpisodes } from './services/geminiService';
import { Loader2, UploadCloud, AlertCircle, Menu, X, Mic, BarChart3 } from 'lucide-react';

type Tab = 'podcast' | 'indicators';

const App: React.FC = () => {
  // Tab State
  const [activeTab, setActiveTab] = useState<Tab>('podcast');

  // Podcast State
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | undefined>();
  const [analysisData, setAnalysisData] = useState<PodcastAnalysis | null>(null);
  const [sources, setSources] = useState<{ title: string; uri: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshingList, setIsRefreshingList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSelectEpisode = async (episode: Episode) => {
    setSelectedEpisodeId(episode.id);
    setUploadMode(false);
    setAnalysisData(null);
    setError(null);
    setIsLoading(true);
    setMobileMenuOpen(false);

    try {
      // Simulate fetching by using Gemini Search Grounding
      // We pass the episode number and title to help Gemini find it on the web
      const query = `${episode.episodeNumber} ${episode.title}`;
      const result = await analyzePodcast(query);

      if (result.data) {
        setAnalysisData(result.data);
        setSources(result.sources);
      } else {
        setError("無法透過搜尋找到該集數的詳細資訊，請稍後再試或上傳音檔。");
      }
    } catch (err) {
      setError("AI 分析過程中發生錯誤，請檢查 API Key 或網路連線。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshEpisodes = async () => {
    setIsRefreshingList(true);
    try {
      const newEpisodes = await fetchRecentEpisodes();
      if (newEpisodes && newEpisodes.length > 0) {
        setEpisodes(newEpisodes);
      } else {
        console.warn("No new episodes found via search");
      }
    } catch (e) {
      console.error("Failed to refresh episodes", e);
    } finally {
      setIsRefreshingList(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      setError("請上傳音訊檔案 (MP3, M4A, WAV 等)");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      if (!confirm("檔案較大 (>25MB)，可能會導致瀏覽器卡頓或記憶體不足。是否繼續？")) {
        return;
      }
    }

    setIsLoading(true);
    setError(null);
    setAnalysisData(null);
    setSelectedEpisodeId(undefined);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64String = (reader.result as string).split(',')[1];
        try {
          const result = await analyzePodcast("Uploaded Audio", base64String);
          if (result.data) {
            setAnalysisData(result.data);
            setSources([]);
          } else {
            setError("AI 無法解讀此音訊檔案。");
          }
        } catch (apiErr) {
          console.error(apiErr);
          setError("分析失敗。請確認檔案格式或長度是否支援。");
        } finally {
          setIsLoading(false);
        }
      };
      reader.onerror = () => {
        setError("讀取檔案失敗");
        setIsLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError("發生未預期的錯誤");
      setIsLoading(false);
    }
  };

  const toggleUploadMode = () => {
    setUploadMode(true);
    setSelectedEpisodeId(undefined);
    setAnalysisData(null);
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    handleRefreshEpisodes();
  }, []);

  // --- RENDER HELPERS ---

  const renderPodcastView = () => (
    <div className="flex h-full w-full relative overflow-hidden">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="absolute inset-0 z-40 bg-slate-950/90 md:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`absolute z-50 h-full transition-transform duration-300 md:relative md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <EpisodeList
          episodes={episodes}
          onSelectEpisode={handleSelectEpisode}
          selectedId={selectedEpisodeId}
          onUploadClick={toggleUploadMode}
          onRefreshClick={handleRefreshEpisodes}
          isRefreshing={isRefreshingList}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full">

        {/* Mobile Header for Sidebar Toggle */}
        <div className="md:hidden flex items-center p-4 border-b border-slate-800 bg-slate-900 flex-shrink-0">
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-300">
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
          <span className="ml-2 font-bold text-lg">股癌筆記</span>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 animate-pulse">
              <Loader2 className="animate-spin text-blue-500" size={48} />
              <p className="text-slate-400 font-medium">
                {uploadMode ? "正在聆聽並分析音檔..." : "正在搜尋並整理重點..."}
              </p>
              <p className="text-xs text-slate-600">這可能需要幾秒鐘的時間</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="bg-red-500/10 p-4 rounded-full mb-4">
                <AlertCircle className="text-red-500" size={40} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">發生錯誤</h3>
              <p className="text-slate-400 max-w-md">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-6 px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition-colors"
              >
                重試
              </button>
            </div>
          ) : !analysisData && !uploadMode ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center opacity-50">
              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                <Menu className="text-slate-500" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-slate-300 mb-2">請選擇集數或上傳音檔</h2>
              <p className="text-slate-500 max-w-md">
                從左側選單選擇最新集數，透過 AI 搜尋整理重點，或者上傳您下載的 Podcast 音檔進行深度分析。
              </p>
            </div>
          ) : uploadMode && !analysisData ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="w-full max-w-xl p-10 border-2 border-dashed border-slate-700 rounded-2xl bg-slate-900/50 hover:bg-slate-900 hover:border-blue-500/50 transition-all group cursor-pointer relative">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="flex flex-col items-center pointer-events-none">
                  <div className="p-4 bg-slate-800 rounded-full mb-4 group-hover:scale-110 transition-transform">
                    <UploadCloud className="text-blue-400" size={40} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">上傳 Podcast 音檔</h3>
                  <p className="text-slate-400 mb-4">支援 MP3, M4A, WAV</p>
                  <p className="text-xs text-slate-600 bg-slate-950 px-3 py-1 rounded-full border border-slate-800">
                    注意：瀏覽器內處理，建議檔案大小小於 25MB
                  </p>
                </div>
              </div>
            </div>
          ) : analysisData ? (
            <AnalysisResult analysis={analysisData} sources={sources} />
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Navigation Tabs */}
      <div className="flex-shrink-0 bg-slate-950 border-b border-slate-800 flex items-center justify-center p-4 gap-6">
        <button
          onClick={() => setActiveTab('podcast')}
          className={`px-6 py-3 rounded-2xl flex items-center gap-2 transition-all duration-200 ${activeTab === 'podcast'
              ? 'bg-gradient-to-br from-blue-600 to-blue-400 text-white shadow-lg shadow-blue-500/20 transform scale-105'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
        >
          <Mic size={20} />
          <span className="font-bold">股癌 Podcast</span>
        </button>

        <button
          onClick={() => setActiveTab('indicators')}
          className={`px-6 py-3 rounded-2xl flex items-center gap-2 transition-all duration-200 ${activeTab === 'indicators'
              ? 'bg-gradient-to-br from-blue-600 to-blue-400 text-white shadow-lg shadow-blue-500/20 transform scale-105'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
        >
          <BarChart3 size={20} />
          <span className="font-bold">各項投資指標</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'podcast' ? renderPodcastView() : <PTTDashboard />}
      </div>
    </div>
  );
};

export default App;