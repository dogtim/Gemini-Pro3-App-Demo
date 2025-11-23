
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from 'dotenv';
import path from 'path';

// Load env vars from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const apiKey = process.env.GEMINI_API_KEY;
const client = apiKey ? new GoogleGenAI({ apiKey }) : null;

export type Sentiment = 'Bullish' | 'Bearish' | 'Neutral';

export interface SentimentResult {
    sentiment: Sentiment;
    reason: string;
}

export interface Opinion {
    type: Sentiment;
    content: string;
}

export interface ArticleAnalysisResult {
    sentiment: Sentiment;
    reason: string;
    opinions: Opinion[];
}

export async function analyzeSentimentWithLLM(title: string, content: string): Promise<SentimentResult> {
    if (!client) {
        console.warn("No GEMINI_API_KEY found, falling back to keyword analysis");
        return analyzeSentimentKeyword(title + " " + content);
    }

    try {
        const prompt = `
      你是一個專業的台股分析師。請分析以下 PTT 股票版貼文的「多空情緒」。
      
      標題: ${title}
      內容與推文:
      ${content.substring(0, 2000)} ... (內容過長截斷)

      請根據標題與推文內容（特別是推文的反應），判斷整體情緒是：
      - Bullish (看多/做多)
      - Bearish (看空/做空)
      - Neutral (中立/觀望/無明確方向)

      並提供一個簡短的理由（20字以內），說明為什麼。

      請直接回傳 JSON 格式：
      {
        "sentiment": "Bullish" | "Bearish" | "Neutral",
        "reason": "簡短理由"
      }
    `;

        const response = await client.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: {
                parts: [{ text: prompt }]
            },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        sentiment: { type: Type.STRING, enum: ["Bullish", "Bearish", "Neutral"] },
                        reason: { type: Type.STRING }
                    },
                    required: ["sentiment", "reason"]
                }
            }
        });

        let result: SentimentResult | null = null;
        const text = response.text;

        if (text) {
            try {
                result = JSON.parse(text) as SentimentResult;
            } catch (e) {
                console.error("Failed to parse JSON from LLM", text);
            }
        }

        return result || { sentiment: 'Neutral', reason: '無法解析 AI 回應' };

    } catch (error) {
        console.error("LLM Analysis failed:", error);
        return analyzeSentimentKeyword(title);
    }
}

export async function analyzeArticleWithLLM(title: string, content: string): Promise<ArticleAnalysisResult> {
    if (!client) {
        return { sentiment: 'Neutral', reason: 'No API Key', opinions: [] };
    }

    try {
        const prompt = `
      你是一個專業的台股分析師。請深入分析以下 PTT 股票版貼文。
      
      標題: ${title}
      內容與推文:
      ${content.substring(0, 5000)} ...

      請執行以下任務：
      1. 判斷整體多空情緒 (Bullish/Bearish/Neutral)。
      2. 提供判斷理由。
      3. **統整推文中的不同意見**，並將其分類為：
         - 看多 (Bullish): 認為會漲、支持做多的觀點。
         - 看空 (Bearish): 認為會跌、建議做空或逃跑的觀點。
         - 中立 (Neutral): 觀望、嘲諷或無關的觀點。
      
      請列出最具代表性的意見（每個分類最多 3 點）。

      請直接回傳 JSON 格式：
      {
        "sentiment": "Bullish" | "Bearish" | "Neutral",
        "reason": "整體判斷理由",
        "opinions": [
           { "type": "Bullish", "content": "觀點內容" },
           { "type": "Bearish", "content": "觀點內容" },
           ...
        ]
      }
    `;

        const response = await client.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: {
                parts: [{ text: prompt }]
            },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        sentiment: { type: Type.STRING, enum: ["Bullish", "Bearish", "Neutral"] },
                        reason: { type: Type.STRING },
                        opinions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    type: { type: Type.STRING, enum: ["Bullish", "Bearish", "Neutral"] },
                                    content: { type: Type.STRING }
                                },
                                required: ["type", "content"]
                            }
                        }
                    },
                    required: ["sentiment", "reason", "opinions"]
                }
            }
        });

        let result: ArticleAnalysisResult | null = null;
        const text = response.text;

        if (text) {
            try {
                result = JSON.parse(text) as ArticleAnalysisResult;
            } catch (e) {
                console.error("Failed to parse JSON from LLM", text);
            }
        }

        return result || { sentiment: 'Neutral', reason: '無法解析 AI 回應', opinions: [] };

    } catch (error) {
        console.error("LLM Article Analysis failed:", error);
        return { sentiment: 'Neutral', reason: 'Analysis Error', opinions: [] };
    }
}


// Fallback keyword analysis
function analyzeSentimentKeyword(text: string): SentimentResult {
    const BULLISH_KEYWORDS = ["多", "做多", "看多", "買進", "飛", "噴"];
    const BEARISH_KEYWORDS = ["空", "做空", "看空", "賣出", "崩", "逃"];

    let bullishCount = 0;
    let bearishCount = 0;
    const normalizedText = text.toLowerCase();

    BULLISH_KEYWORDS.forEach(k => { if (normalizedText.includes(k)) bullishCount++; });
    BEARISH_KEYWORDS.forEach(k => { if (normalizedText.includes(k)) bearishCount++; });

    if (bullishCount > bearishCount) return { sentiment: 'Bullish', reason: '關鍵字判定：多方詞彙較多' };
    if (bearishCount > bullishCount) return { sentiment: 'Bearish', reason: '關鍵字判定：空方詞彙較多' };
    return { sentiment: 'Neutral', reason: '關鍵字判定：中立或無明顯關鍵字' };
}

export const analyzeSentiment = analyzeSentimentKeyword; // Keep for backward compatibility if needed
