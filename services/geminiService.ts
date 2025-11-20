import { GoogleGenAI, Type } from "@google/genai";
import { PodcastAnalysis, SentimentType, Episode, FearAndGreedIndex } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found. Please set process.env.API_KEY.");
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
 * Uses Gemini Search Grounding to find the latest episodes of the podcast.
 */
export const fetchRecentEpisodes = async (): Promise<Episode[]> => {
  const client = getClient();
  const modelId = "gemini-2.5-flash";

  const systemInstruction = `
    你是一個資料擷取助手。請利用 Google Search 搜尋「股癌 Gooaye Podcast」在 Apple Podcasts (https://podcasts.apple.com/us/podcast/gooaye-%E8%82%A1%E7%99%8C/id1500839292) 或 SoundOn 等平台上的最新集數資訊。
    請找出最新的 10 集節目。
    
    對於每一集，請提供：
    1. 集數編號 (例如 "EP531")。如果標題包含集數，請提取出來。
    2. 完整標題 (例如 "EP531 測試標題")。
    3. 發布日期 (格式 YYYY-MM-DD)。
    
    【重要】請直接回傳純 JSON 格式字串，格式為 Array，不要包含 markdown 標記。
    格式範例：
    [
      { "id": "unique_id_1", "episodeNumber": "EP531", "title": "EP531 標題...", "date": "2024-01-01" }
    ]
    id 可以使用集數編號。
    請確保按照日期從新到舊排序。
  `;

  try {
    const response = await client.models.generateContent({
      model: modelId,
      contents: {
        parts: [{ text: "列出目前網路上 Gooaye 股癌 Podcast 最新的 10 集列表，請確保資訊來自 Apple Podcast 頁面。" }],
      },
      config: {
        systemInstruction: systemInstruction,
        tools: [{ googleSearch: {} }],
      },
    });

    let jsonText = response.text || "";
    
    // Clean up markdown
    jsonText = jsonText.replace(/```json\s*/g, "").replace(/```\s*/g, "");
    const firstOpen = jsonText.indexOf("[");
    const lastClose = jsonText.lastIndexOf("]");
    
    if (firstOpen !== -1 && lastClose !== -1) {
      jsonText = jsonText.substring(firstOpen, lastClose + 1);
      const episodes = JSON.parse(jsonText) as Episode[];
      return episodes;
    }
    
    return [];
  } catch (error) {
    console.error("Failed to fetch recent episodes", error);
    return [];
  }
};

/**
 * Fetches the current Fear and Greed Index using Gemini Search Grounding.
 */
export const fetchFearAndGreedIndex = async (): Promise<FearAndGreedIndex | null> => {
  const client = getClient();
  const modelId = "gemini-2.5-flash";

  const systemInstruction = `
    You are a financial data assistant. Search specifically for the current "CNN Fear and Greed Index".
    
    Return the CURRENT score (0-100) and the CURRENT rating description (e.g., "Extreme Fear", "Greed").
    Also include the "Last updated" time if available.
    
    IMPORTANT: Return ONLY raw JSON. No Markdown.
    Format:
    {
      "score": 50,
      "rating": "Neutral",
      "timestamp": "Nov 19 at 5:00 PM ET"
    }
  `;

  try {
    const response = await client.models.generateContent({
      model: modelId,
      contents: {
        parts: [{ text: "What is the current CNN Fear and Greed Index score today? Search for the latest data." }],
      },
      config: {
        systemInstruction: systemInstruction,
        tools: [{ googleSearch: {} }],
      },
    });

    let jsonText = response.text || "";
    
    // Clean up markdown
    jsonText = jsonText.replace(/```json\s*/g, "").replace(/```\s*/g, "");
    const firstOpen = jsonText.indexOf("{");
    const lastClose = jsonText.lastIndexOf("}");
    
    if (firstOpen !== -1 && lastClose !== -1) {
      jsonText = jsonText.substring(firstOpen, lastClose + 1);
      const data = JSON.parse(jsonText) as FearAndGreedIndex;
      return data;
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch Fear & Greed Index", error);
    return null;
  }
};
