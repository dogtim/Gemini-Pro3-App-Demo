export enum SentimentType {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH',
  NEUTRAL = 'NEUTRAL'
}

export interface CompanySentiment {
  name: string;
  ticker?: string;
  sentiment: SentimentType;
  reason: string;
}

export interface PodcastAnalysis {
  episodeTitle: string;
  summaryPoints: string[];
  companies: CompanySentiment[];
}

export interface Episode {
  id: string;
  title: string;
  date: string;
  episodeNumber: string;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface FearAndGreedIndex {
  score: number;
  rating: string;
  timestamp: string;
}