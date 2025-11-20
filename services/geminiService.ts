import { GoogleGenAI, Type } from "@google/genai";
import { PodcastAnalysis, SentimentType, Episode, FearAndGreedIndex } from "../types";
import axios from 'axios';
import fetchJsonp from 'fetch-jsonp';

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found. Please set GEMINI_API_KEY in .env.local file.");
  }
  return new GoogleGenAI({ apiKey });
};

// Schema for structured output (Used only when NOT using tools/search)
const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    episodeTitle: { type: Type.STRING, description: "The inferred title or episode number of the podcast." },
    summaryPoints: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "A list of 3-5 key takeaways or summary points from the episode.",
    },
    companies: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Company name mentioned." },
          ticker: { type: Type.STRING, description: "Stock ticker symbol if available (e.g., 2330, NVDA)." },
          sentiment: { 
            type: Type.STRING, 
            enum: [SentimentType.BULLISH, SentimentType.BEARISH, SentimentType.NEUTRAL],
            description: "The host's sentiment towards this company." 
          },
          reason: { type: Type.STRING, description: "Brief explanation of why the host feels this way." },
        },
        required: ["name", "sentiment", "reason"],
      },
      description: "List of companies mentioned with specific bullish or bearish sentiment.",
    },
  },
  required: ["episodeTitle", "summaryPoints", "companies"],
};

export interface AnalysisResponse {
  data: PodcastAnalysis | null;
  sources: { title: string; uri: string }[];
}

/**
 * Analyzes a podcast episode.
 * If audioBase64 is provided, it uses multimodal analysis.
 * If not, it uses Google Search Grounding to find information about the episode query.
 */
export const analyzePodcast = async (
  query: string,
  audioBase64?: string
): Promise<AnalysisResponse> => {
  const client = getClient();
  
  const isSearchMode = !audioBase64;

  // Prompt strategy depends on input type
  let systemInstruction = `
    你是一個專業的金融分析師，專門負責整理「Gooaye 股癌」Podcast 的重點筆記。
    請根據提供的資訊（音訊或搜尋結果），整理出該集的重點摘要。
    特別注意主持人提到的公司、股票代號，以及他對這些公司的看法是「看好 (Bullish)」還是「看壞/疑慮 (Bearish)」。
    如果是中性看法則標記為 Neutral。
    請使用繁體中文回答。
  `;

  // If using search, we cannot enforce JSON schema via config (API limitation), 
  // so we must strictly ask for it in the prompt.
  if (isSearchMode) {
    systemInstruction += `
    【重要】請直接回傳純 JSON 格式字串，不要包含 markdown 標記 (如 \`\`\`json)。
    JSON 格式必須符合：
    {
      "episodeTitle": "標題",
      "summaryPoints": ["重點1", "重點2"],
      "companies": [
        { "name": "公司", "ticker": "代號", "sentiment": "BULLISH", "reason": "原因" }
      ]
    }
    `;
  }

  const modelId = "gemini-2.5-flash";
  
  const tools = [];
  // If no audio, we rely on search to "grab" the episode content from the web
  if (isSearchMode) {
    tools.push({ googleSearch: {} });
  }

  const parts: any[] = [];
  
  if (audioBase64) {
    parts.push({
      inlineData: {
        mimeType: "audio/mp3", // Gemini handles most audio types
        data: audioBase64,
      },
    });
    parts.push({
      text: "請分析這段錄音檔。請忽略開頭的閒聊，專注於市場分析與個股看法的段落。",
    });
  } else {
    parts.push({
      text: `請搜尋並分析「股癌 Gooaye Podcast ${query}」的內容重點。請盡量找出該集數提到的具體標的與觀點。`,
    });
  }

  const config: any = {
    systemInstruction: systemInstruction,
    tools: tools.length > 0 ? tools : undefined,
  };

  // Only apply responseSchema when NOT using tools to avoid 400 error
  if (!isSearchMode) {
    config.responseMimeType = "application/json";
    config.responseSchema = analysisSchema;
  }

  try {
    const response = await client.models.generateContent({
      model: modelId,
      contents: {
        parts: parts,
      },
      config: config,
    });

    let jsonText = response.text || "";
    let parsedData: PodcastAnalysis | null = null;
    
    if (jsonText) {
      try {
        // Helper to clean up Markdown code blocks if they appear despite instructions
        if (isSearchMode) {
           jsonText = jsonText.replace(/```json\s*/g, "").replace(/```\s*/g, "");
           const firstOpen = jsonText.indexOf("{");
           const lastClose = jsonText.lastIndexOf("}");
           if (firstOpen !== -1 && lastClose !== -1) {
             jsonText = jsonText.substring(firstOpen, lastClose + 1);
           }
        }
        parsedData = JSON.parse(jsonText) as PodcastAnalysis;
      } catch (e) {
        console.error("Failed to parse JSON", e, jsonText);
      }
    }

    // Extract grounding chunks if search was used
    const sources: { title: string; uri: string }[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({ title: chunk.web.title, uri: chunk.web.uri });
        }
      });
    }

    return {
      data: parsedData,
      sources: sources,
    };

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

/**
 * Fetches the latest episodes from the podcast RSS feed.
 * Step 1: Get RSS feed URL from iTunes API using JSONP (to bypass CORS)
 * Step 2: Parse RSS feed XML to get episodes
 * No Gemini API needed for this function.
 */
export const fetchRecentEpisodes = async (): Promise<Episode[]> => {
  try {
    // Step 1: Get the RSS feed URL from iTunes API using JSONP
    const podcastId = '1500839292';
    const lookupUrl = `https://itunes.apple.com/lookup?id=${podcastId}`;
    
    const lookupResponse = await fetchJsonp(lookupUrl);
    const data = await lookupResponse.json();
    const feedUrl = data.results?.[0]?.feedUrl;
    
    if (!feedUrl) {
      throw new Error('Feed URL not found in iTunes API response');
    }
    
    console.log('RSS Feed URL:', feedUrl);
    
    // Step 2: Fetch and parse the RSS feed XML using CORS proxy
    // Try multiple CORS proxies in case one fails
    const corsProxies = [
      'https://api.allorigins.win/raw?url=',
      'https://corsproxy.io/?',
    ];
    
    let xmlText = '';
    let lastError: any = null;
    
    for (const corsProxy of corsProxies) {
      try {
        const proxiedFeedUrl = corsProxy + encodeURIComponent(feedUrl);
        console.log('Trying proxy:', corsProxy);
        
        const rssResponse = await fetch(proxiedFeedUrl);
        
        if (!rssResponse.ok) {
          throw new Error(`HTTP error! status: ${rssResponse.status}`);
        }
        
        xmlText = await rssResponse.text();
        console.log('Successfully fetched RSS feed, length:', xmlText.length);
        break; // Success, exit loop
      } catch (error) {
        console.warn(`Failed with proxy ${corsProxy}:`, error);
        lastError = error;
        continue; // Try next proxy
      }
    }
    
    if (!xmlText) {
      throw lastError || new Error('All CORS proxies failed');
    }

    // Parse XML using DOMParser (browser-native)
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    // Check for parsing errors
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error('Failed to parse RSS XML');
    }
    
    // Extract episode items
    const items = xmlDoc.querySelectorAll('item');
    const episodes: Episode[] = [];
    
    // Process up to 10 episodes
    for (let i = 0; i < Math.min(items.length, 10); i++) {
      const item = items[i];
      
      const title = item.querySelector('title')?.textContent || '';
      const pubDate = item.querySelector('pubDate')?.textContent || '';
      const itunesEpisode = item.querySelector('episode')?.textContent || '';
      
      // Try to extract episode number from title (e.g., "EP531")
      const episodeNumberMatch = title.match(/EP(\d+)/i);
      let episodeNumber = '';
      
      if (episodeNumberMatch) {
        episodeNumber = `EP${episodeNumberMatch[1]}`;
      } else if (itunesEpisode) {
        episodeNumber = `EP${itunesEpisode}`;
      } else {
        // Fallback: use index
        episodeNumber = `EP${items.length - i}`;
      }
      
      // Format date
      const date = pubDate
        ? new Date(pubDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      
      episodes.push({
        id: episodeNumber,
        episodeNumber: episodeNumber,
        title: title,
        date: date,
      });
    }
    
    return episodes;
    
  } catch (error) {
    console.error("Failed to fetch recent episodes from RSS", error);
    
    // Return mock data as fallback
    return [
      { id: "EP531", episodeNumber: "EP531", title: "EP531 - 最新集數 (Mock)", date: new Date().toISOString().split('T')[0] },
      { id: "EP530", episodeNumber: "EP530", title: "EP530 - 上一集 (Mock)", date: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0] },
    ];
  }
};

/**
 * Fetches the current Fear and Greed Index directly from CNN.
 * No Gemini API needed for this function.
 */
export const fetchFearAndGreedIndex = async (): Promise<FearAndGreedIndex | null> => {
  try {
    // CNN Fear and Greed Index API endpoint
    const apiUrl = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';
    
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    if (data && data.fear_and_greed) {
      const currentData = data.fear_and_greed;
      
      return {
        score: currentData.score,
        rating: currentData.rating,
        timestamp: currentData.timestamp || new Date().toISOString(),
      };
    }
    
    return null;
  } catch (error) {
    console.error("Failed to fetch Fear & Greed Index from CNN API", error);
    
    // Return mock data as fallback
    return {
      score: 50,
      rating: "Neutral",
      timestamp: new Date().toISOString(),
    };
  }
};
