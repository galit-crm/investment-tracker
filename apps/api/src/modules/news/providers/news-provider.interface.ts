export interface NewsArticleInput {
  title: string;
  summary: string;
  url: string;
  source: string;
  imageUrl?: string;
  category: string;
  impactLevel: string;
  affectedMarkets: string[];
  affectedAssets: string[];
  tags: string[];
  publishedAt: Date;
}

export interface NewsProvider {
  readonly providerSlug: string;
  fetchArticles(): Promise<NewsArticleInput[]>;
}
