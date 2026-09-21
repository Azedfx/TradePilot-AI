import { Injectable } from '@nestjs/common';
import { BaseSkill } from './base.skill';
import { ResearchContext, SkillResult } from './skill.types';
import { McpClientService } from '../market-data/mcp-client.service';
import { MarketDataService } from '../market-data/market-data.service';
import { parseMcpJson } from './mcp.util';

interface FeedArticle {
  title?: string;
  link?: string;
  url?: string;
  pubDate?: string;
  published?: string;
  source?: string;
  summary?: string;
  description?: string;
}

/**
 * News skill - aggregates headlines around the researched symbols.
 * Primary: Bitget datahub MCP `news_feed` (44 RSS feeds, keyless).
 * Fallback: Google News RSS.
 */
@Injectable()
export class NewsSkill extends BaseSkill {
  readonly name = 'news';

  constructor(
    private readonly mcp: McpClientService,
    private readonly marketData: MarketDataService,
  ) {
    super();
  }

  async run(context: ResearchContext): Promise<SkillResult> {
    // Stocks: Google News equity query first (MCP crypto feeds are a weak
    // match for NVDA/AAPL). Crypto: MCP crypto feeds first.
    if (context.assetType === 'us-stock') {
      const fromRss = await this.fetchFromRss(context);
      if (fromRss.length > 0) {
        return this.buildResult(
          'news',
          `Gathered ${fromRss.length} equity headline(s) for ${context.symbols.join(
            ', ',
          )}.`,
          { headlines: fromRss, source: 'google-news-rss' },
        );
      }
    }

    try {
      const headlines = await this.fetchFromMcp(context);
      if (headlines.length > 0) {
        return this.buildResult(
          'news',
          `Gathered ${headlines.length} live headline(s) for ${context.symbols.join(
            ', ',
          )} via the Bitget news feed.`,
          { headlines, source: 'mcp' },
        );
      }
    } catch {
      // fall through to RSS fallback
    }

    const headlines = await this.fetchFromRss(context);
    return this.buildResult(
      'news',
      headlines.length
        ? `Gathered ${headlines.length} headline(s) from the public news feed.`
        : 'No fresh headlines found for the requested symbols.',
      { headlines, source: headlines.length ? 'google-news-rss' : 'empty' },
    );
  }

  private async fetchFromMcp(
    context: ResearchContext,
  ): Promise<Headline[]> {
    const limit = 5;
    // Equity desk: prefer TradFi / macro / tech feeds. Crypto desk: crypto feeds.
    const feedKeys =
      context.assetType === 'us-stock'
        ? 'cnbc,fed,bbc_world,guardian,npr,aljazeera,techcrunch,theverge,wired,reddit_economics,hackernews'
        : 'cointelegraph,coindesk,decrypt,blockworks,watcherguru,cryptonews_com,messari';

    const keyword = context.symbols.join(' ');
    const text = await this.mcp.callTool(
      'news_feed',
      {
        action: 'latest',
        feeds: feedKeys,
        keyword,
        limit,
      },
      8,
    );

    const parsed = parseMcpJson<Array<{ feed: string; items: FeedArticle[] }>>(
      text,
    );
    if (!parsed) return [];

    const headlines: Headline[] = [];
    for (const group of parsed) {
      for (const item of group.items ?? []) {
        headlines.push({
          title: item.title ?? 'Untitled',
          url: item.link ?? item.url ?? null,
          source: item.source ?? group.feed,
          publishedAt: item.pubDate ?? item.published ?? item.pubDate ?? '',
          summary: item.summary ?? item.description ?? '',
          sentiment: 'neutral',
        });
      }
    }

    const unique = new Map<string, Headline>();
    for (const h of headlines) unique.set(h.title.toLowerCase(), h);
    return [...unique.values()];
  }

  private async fetchFromRss(
    context: ResearchContext,
  ): Promise<Headline[]> {
    // For US stocks, prefer equity-oriented Google News queries (earnings,
    // stock) before a bare ticker — avoids crypto-feed pollution on NVDA/AAPL.
    const qualifier =
      context.assetType === 'us-stock'
        ? 'stock OR earnings OR equity'
        : 'crypto';
    const query = `${context.symbols.join(' ')} ${qualifier}`.trim();
    const articles = await this.marketData.fetchGoogleNews(query, 5);
    return articles.map((a) => ({
      title: a.title,
      url: a.url,
      source: a.source || 'Google News',
      publishedAt: a.publishedAt,
      summary: a.summary ?? '',
      sentiment: 'neutral',
    }));
  }
}

interface Headline {
  title: string;
  url: string | null;
  source: string;
  publishedAt: string;
  summary: string;
  sentiment: string;
}