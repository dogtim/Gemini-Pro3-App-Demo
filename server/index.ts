
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { analyzeSentimentWithLLM, analyzeArticleWithLLM } from './analyzer';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

interface PTTPost {
    title: string;
    author: string;
    date: string;
    link: string;
    pushCount: string;
    stockId: string | null;
    sentiment: 'Bullish' | 'Bearish' | 'Neutral';
    reason: string;
    category: 'Target' | 'Other';
}

// Helper to fetch a single page
async function fetchPTTPage(url: string): Promise<string> {
    try {
        const response = await axios.get(url, {
            headers: {
                Cookie: 'over18=1', // Bypass age verification
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        return '';
    }
}

app.post('/api/analyze-url', async (req, res) => {
    const { url } = req.body;
    if (!url || !url.includes('ptt.cc')) {
        return res.status(400).json({ success: false, error: 'Invalid URL' });
    }

    try {
        const html = await fetchPTTPage(url);
        if (!html) {
            return res.status(500).json({ success: false, error: 'Failed to fetch page' });
        }

        const $ = cheerio.load(html);
        const title = $('.article-metaline-right .article-meta-value').text() || $('.article-metaline .article-meta-value').eq(1).text() || 'Unknown Title';

        // Remove metadata lines to get clean content
        $('.article-metaline').remove();
        $('.article-metaline-right').remove();

        // Get main content
        const mainContent = $('#main-content').text().trim();

        // Get pushes (comments)
        let pushes = '';
        $('.push').each((_, el) => {
            const pushTag = $(el).find('.push-tag').text().trim();
            const pushContent = $(el).find('.push-content').text().trim();
            pushes += `${pushTag} ${pushContent}\n`;
        });

        const fullContent = mainContent + "\n\n推文:\n" + pushes;

        const analysis = await analyzeArticleWithLLM(title, fullContent);

        res.json({ success: true, data: { title, ...analysis } });

    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ success: false, error: 'Analysis failed' });
    }
});

app.get('/api/ptt-sentiment', async (req, res) => {
    try {
        const posts: PTTPost[] = [];
        let currentUrl = 'https://www.ptt.cc/bbs/Stock/index.html';

        // Fetch 3 pages
        for (let i = 0; i < 3; i++) {
            const html = await fetchPTTPage(currentUrl);
            if (!html) break;

            const $ = cheerio.load(html);
            const pagePosts: any[] = [];

            // Parse posts list first
            $('.r-ent').each((_, element) => {
                const titleEl = $(element).find('.title a');
                if (titleEl.length === 0) return; // Deleted post

                const title = titleEl.text().trim();
                const link = 'https://www.ptt.cc' + titleEl.attr('href');
                const author = $(element).find('.author').text().trim();
                const date = $(element).find('.date').text().trim();
                const pushCountText = $(element).find('.nrec').text().trim();

                let pushCountVal = 0;
                if (pushCountText === '爆') {
                    pushCountVal = 100; // Treat '爆' as > 99
                } else if (pushCountText) {
                    pushCountVal = parseInt(pushCountText, 10);
                    if (isNaN(pushCountVal)) pushCountVal = 0;
                }

                let category: 'Target' | 'Other' | null = null;
                if (title.includes('[標的]')) {
                    category = 'Target';
                } else if (pushCountVal > 20) {
                    category = 'Other';
                }

                if (category) {
                    pagePosts.push({
                        title,
                        link,
                        author,
                        date,
                        pushCountText,
                        category
                    });
                }
            });

            // Process filtered posts to get details and sentiment
            // Limit to avoid hitting rate limits too hard (e.g. process first 5 matching posts per page)
            const postsToAnalyze = pagePosts.slice(0, 5);

            for (const p of postsToAnalyze) {
                // Fetch detail page
                const detailHtml = await fetchPTTPage(p.link);
                let sentimentResult = { sentiment: 'Neutral', reason: '無法讀取內容' } as any;

                if (detailHtml) {
                    const $detail = cheerio.load(detailHtml);
                    // Remove metadata lines to get clean content
                    $detail('.article-metaline').remove();
                    $detail('.article-metaline-right').remove();

                    // Get main content
                    const mainContent = $detail('#main-content').text().trim();

                    // Get pushes (comments)
                    let pushes = '';
                    $detail('.push').each((_, el) => {
                        const pushTag = $detail(el).find('.push-tag').text().trim();
                        const pushContent = $detail(el).find('.push-content').text().trim();
                        pushes += `${pushTag} ${pushContent}\n`;
                    });

                    const fullContent = mainContent + "\n\n推文:\n" + pushes;

                    // Analyze with LLM
                    sentimentResult = await analyzeSentimentWithLLM(p.title, fullContent);
                }

                // Extract Stock ID
                const stockIdMatch = p.title.match(/\b\d{4}\b/);
                const stockId = stockIdMatch ? stockIdMatch[0] : null;

                posts.push({
                    title: p.title,
                    author: p.author,
                    date: p.date,
                    link: p.link,
                    pushCount: p.pushCountText,
                    stockId,
                    sentiment: sentimentResult.sentiment,
                    reason: sentimentResult.reason,
                    category: p.category
                });
            }

            // Get previous page link
            const prevLink = $('.btn-group-paging a').eq(1).attr('href');
            if (prevLink) {
                currentUrl = 'https://www.ptt.cc' + prevLink;
            } else {
                break;
            }
        }

        res.json({ success: true, data: posts });
    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch PTT data' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
