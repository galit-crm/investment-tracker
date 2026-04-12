import { Injectable } from '@nestjs/common';
import { NewsProvider, NewsArticleInput } from './news-provider.interface';

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(Math.floor(Math.random() * 14) + 7, Math.floor(Math.random() * 60), 0, 0);
  return d;
}

function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * 3_600_000);
}

const MOCK_ARTICLES: Omit<NewsArticleInput, 'publishedAt'>[] = [
  // ── HIGH IMPACT ──
  {
    title: 'Federal Reserve Holds Rates Steady, Signals Patience Before Cuts',
    summary:
      'The Federal Open Market Committee voted unanimously to keep the federal funds rate in the 5.25–5.50% target range. Chair Powell reiterated that the committee needs greater confidence that inflation is moving sustainably toward 2% before beginning to reduce rates, tempering market expectations for near-term easing.',
    url: 'https://www.reuters.com/markets/us/fed-holds-rates-signals-patience-cuts-demo',
    source: 'Reuters',
    category: 'FED_CENTRAL_BANKS',
    impactLevel: 'HIGH',
    affectedMarkets: ['STOCKS', 'BONDS', 'CRYPTO', 'FOREX'],
    affectedAssets: ['SPY', 'QQQ', 'TLT', 'BTC'],
    tags: ['fed', 'rates', 'fomc', 'monetary-policy'],
  },
  {
    title: 'U.S. CPI Rises 3.4% YoY in March, Above Consensus Estimate of 3.2%',
    summary:
      'The Consumer Price Index climbed 3.4% year-over-year in March, surpassing the 3.2% Wall Street consensus. Core CPI, excluding food and energy, rose 3.8% annually. The hotter-than-expected print pushed Treasury yields sharply higher and dampened rate-cut optimism across financial markets.',
    url: 'https://www.bloomberg.com/news/articles/us-cpi-march-above-estimates-demo',
    source: 'Bloomberg',
    category: 'INFLATION_MACRO',
    impactLevel: 'HIGH',
    affectedMarkets: ['STOCKS', 'BONDS', 'FOREX'],
    affectedAssets: ['SPY', 'TLT', 'GLD', 'DXY'],
    tags: ['cpi', 'inflation', 'macro', 'fed'],
  },
  {
    title: 'NVIDIA Reports Record Q1 Revenue of $26B, Beats Estimates by 18%',
    summary:
      "NVIDIA Corporation posted first-quarter revenue of $26.04 billion, an 18% beat over analyst expectations and up 262% year-over-year. Data center revenue alone reached $22.6 billion. The company raised Q2 guidance to $28 billion, citing insatiable demand for its H100 and upcoming Blackwell GPUs from hyperscalers and sovereign AI projects.",
    url: 'https://www.wsj.com/articles/nvidia-q1-2025-earnings-record-revenue-demo',
    source: 'Wall Street Journal',
    category: 'EARNINGS',
    impactLevel: 'HIGH',
    affectedMarkets: ['STOCKS'],
    affectedAssets: ['NVDA', 'AMD', 'INTC', 'TSM'],
    tags: ['nvda', 'earnings', 'ai', 'semiconductors'],
  },
  {
    title: 'Bitcoin Spot ETFs See Record $1.3B Single-Day Inflow Across U.S. Issuers',
    summary:
      "U.S.-listed Bitcoin exchange-traded funds collectively attracted $1.3 billion in net inflows in a single trading session, shattering the previous record. BlackRock's IBIT led with $735M, followed by Fidelity's FBTC at $290M. Cumulative inflows since January launch have now surpassed $17 billion, reflecting sustained institutional demand.",
    url: 'https://www.coindesk.com/markets/bitcoin-etf-record-inflow-demo',
    source: 'CoinDesk',
    category: 'CRYPTO',
    impactLevel: 'HIGH',
    affectedMarkets: ['CRYPTO'],
    affectedAssets: ['BTC', 'ETH'],
    tags: ['bitcoin', 'etf', 'institutional', 'blackrock'],
  },
  {
    title: 'SEC Approves Spot Ethereum ETFs; Eight Products to Begin Trading',
    summary:
      'The Securities and Exchange Commission approved 19b-4 filings for eight spot Ethereum ETF applications from BlackRock, Fidelity, VanEck, and five others. The products are expected to begin trading within weeks pending S-1 approval. Ethereum surged 15% on the news, crossing $3,800, as analysts projected $5–15B in first-year inflows.',
    url: 'https://www.ft.com/content/sec-approves-spot-ethereum-etfs-demo',
    source: 'Financial Times',
    category: 'REGULATORY',
    impactLevel: 'HIGH',
    affectedMarkets: ['CRYPTO'],
    affectedAssets: ['ETH', 'BTC', 'SOL'],
    tags: ['ethereum', 'etf', 'sec', 'regulatory'],
  },

  // ── MEDIUM IMPACT ──
  {
    title: 'Apple Announces $110B Share Buyback — Largest in Corporate History',
    summary:
      'Apple Inc. authorized a $110 billion stock repurchase program, eclipsing its prior record and surpassing every buyback in U.S. corporate history. The announcement accompanied Q2 results showing $90.8B in revenue, down 4% YoY but ahead of the $90.3B consensus. Services revenue hit an all-time record of $23.9B.',
    url: 'https://www.cnbc.com/apple-110b-buyback-record-q2-earnings-demo',
    source: 'CNBC',
    category: 'EARNINGS',
    impactLevel: 'MEDIUM',
    affectedMarkets: ['STOCKS'],
    affectedAssets: ['AAPL', 'QQQ'],
    tags: ['aapl', 'earnings', 'buyback', 'services'],
  },
  {
    title: 'ECB Cuts Rates by 25bps — First Reduction Since 2019',
    summary:
      'The European Central Bank lowered its key deposit rate by 25 basis points to 3.75%, marking its first rate cut in nearly five years. President Christine Lagarde stressed the decision was data-dependent and that future cuts were not pre-committed. Markets repriced eurozone rate expectations, with the euro weakening modestly against the dollar.',
    url: 'https://www.reuters.com/markets/europe/ecb-cuts-rates-25bps-first-time-2019-demo',
    source: 'Reuters',
    category: 'FED_CENTRAL_BANKS',
    impactLevel: 'MEDIUM',
    affectedMarkets: ['FOREX', 'BONDS', 'STOCKS'],
    affectedAssets: ['EUR', 'EZU'],
    tags: ['ecb', 'rates', 'europe', 'monetary-policy'],
  },
  {
    title: 'U.S. Payrolls Add 272K in May, Unemployment Edges Up to 4.0%',
    summary:
      "May's nonfarm payrolls report showed 272,000 jobs added, well above the 180,000 forecast and the prior month's upwardly revised 165,000. Average hourly earnings rose 4.1% year-over-year. Despite the unemployment rate ticking up to 4.0%, the strong headline number pushed back market pricing for the first Fed rate cut.",
    url: 'https://www.bloomberg.com/news/us-may-jobs-report-272k-payrolls-demo',
    source: 'Bloomberg',
    category: 'INFLATION_MACRO',
    impactLevel: 'MEDIUM',
    affectedMarkets: ['STOCKS', 'BONDS', 'FOREX'],
    affectedAssets: ['SPY', 'TLT', 'DXY'],
    tags: ['jobs', 'payrolls', 'macro', 'employment'],
  },
  {
    title: 'Oil Prices Spike 4% as Middle East Tensions Escalate',
    summary:
      'Brent crude surged above $92 per barrel as geopolitical tensions in the Middle East intensified, raising concerns about potential supply disruptions from the region. Energy stocks outperformed while transportation and consumer discretionary names lagged. Analysts at Goldman Sachs raised their year-end Brent forecast to $96.',
    url: 'https://www.wsj.com/articles/oil-prices-spike-geopolitics-middle-east-demo',
    source: 'Wall Street Journal',
    category: 'GEOPOLITICS',
    impactLevel: 'MEDIUM',
    affectedMarkets: ['COMMODITIES', 'STOCKS'],
    affectedAssets: ['USO', 'XOM', 'CVX', 'GLD'],
    tags: ['oil', 'geopolitics', 'energy', 'brent'],
  },
  {
    title: 'Ethereum Gas Fees Plunge 85% Following Dencun Upgrade',
    summary:
      'Average transaction fees on the Ethereum network fell by over 85% following the successful activation of the Dencun upgrade, which introduced EIP-4844 (proto-danksharding). Layer-2 networks including Arbitrum, Optimism, and Base saw transaction costs drop below $0.01. Developer activity on L2s hit an all-time high post-upgrade.',
    url: 'https://www.coindesk.com/tech/ethereum-dencun-gas-fees-l2-demo',
    source: 'CoinDesk',
    category: 'CRYPTO',
    impactLevel: 'MEDIUM',
    affectedMarkets: ['CRYPTO'],
    affectedAssets: ['ETH', 'ARB', 'OP'],
    tags: ['ethereum', 'dencun', 'l2', 'gas-fees'],
  },
  {
    title: 'Microsoft Cloud Revenue Grows 31% YoY; Azure Market Share Expands',
    summary:
      "Microsoft reported fiscal Q3 revenue of $61.9B, up 17% year-over-year, with Azure and cloud services growing 31%. The company's AI-integrated products, including Copilot across Office 365, are showing strong enterprise adoption. Operating income rose 23% to $27.6B, and the company raised full-year guidance above consensus.",
    url: 'https://www.cnbc.com/microsoft-q3-azure-cloud-revenue-demo',
    source: 'CNBC',
    category: 'EARNINGS',
    impactLevel: 'MEDIUM',
    affectedMarkets: ['STOCKS'],
    affectedAssets: ['MSFT', 'AMZN', 'GOOGL'],
    tags: ['msft', 'earnings', 'cloud', 'ai', 'azure'],
  },
  {
    title: 'Gold Hits All-Time High of $2,450/oz Amid Rate Cut Expectations',
    summary:
      'Gold futures reached a new all-time high of $2,450 per troy ounce, supported by persistent central bank buying, geopolitical uncertainty, and growing expectations for Federal Reserve rate cuts later in the year. ETF outflows stabilized, and positioning data showed hedge funds increasing net long exposure to the precious metal.',
    url: 'https://www.ft.com/content/gold-all-time-high-rate-cuts-demo',
    source: 'Financial Times',
    category: 'MARKET_NEWS',
    impactLevel: 'MEDIUM',
    affectedMarkets: ['COMMODITIES'],
    affectedAssets: ['GLD', 'SLV', 'GDX'],
    tags: ['gold', 'commodities', 'precious-metals', 'inflation-hedge'],
  },

  // ── LOW IMPACT ──
  {
    title: 'Weekly Jobless Claims Fall to 210K, Labor Market Remains Resilient',
    summary:
      'Initial jobless claims for the week ending June 1 came in at 210,000, below the 218,000 consensus and the prior week revised figure of 221,000. Continuing claims also declined. The data reinforces the narrative of a resilient U.S. labor market that continues to absorb higher interest rates without significant deterioration.',
    url: 'https://www.reuters.com/markets/us/weekly-jobless-claims-210k-demo',
    source: 'Reuters',
    category: 'INFLATION_MACRO',
    impactLevel: 'LOW',
    affectedMarkets: ['STOCKS', 'BONDS'],
    affectedAssets: ['SPY'],
    tags: ['jobless-claims', 'labor-market', 'macro'],
  },
  {
    title: 'Solana DEX Volume Surpasses Ethereum for First Time',
    summary:
      'On-chain data shows that decentralized exchange volume on Solana exceeded Ethereum for the first time in history, driven largely by memecoin trading activity and the rapid growth of Jupiter as the dominant DEX aggregator. Solana processed over $4.2B in DEX volume versus Ethereum-mainnet\'s $3.8B in the prior 24-hour period.',
    url: 'https://www.coindesk.com/markets/solana-dex-volume-surpasses-ethereum-demo',
    source: 'CoinDesk',
    category: 'CRYPTO',
    impactLevel: 'LOW',
    affectedMarkets: ['CRYPTO'],
    affectedAssets: ['SOL', 'ETH'],
    tags: ['solana', 'dex', 'defi', 'volume'],
  },
  {
    title: 'S&P 500 Closes Above 5,300 for First Time on AI Enthusiasm',
    summary:
      'The S&P 500 index crossed and closed above the 5,300 milestone for the first time in history, driven by continued enthusiasm for artificial intelligence and strong earnings from the technology sector. The index is up approximately 12% year-to-date, with the Magnificent Seven stocks contributing disproportionately to gains.',
    url: 'https://www.bloomberg.com/news/sp500-5300-record-ai-demo',
    source: 'Bloomberg',
    category: 'MARKET_NEWS',
    impactLevel: 'LOW',
    affectedMarkets: ['STOCKS'],
    affectedAssets: ['SPY', 'QQQ', 'NVDA', 'MSFT', 'AAPL'],
    tags: ['sp500', 'all-time-high', 'ai', 'equities'],
  },
  {
    title: 'Amazon Closes $4B Investment in Anthropic, Deepening AI Partnership',
    summary:
      "Amazon completed its previously announced $4 billion investment in AI safety company Anthropic, which builds Claude. The deal grants Amazon priority access to Anthropic's models via AWS and includes cloud commitments. The investment reflects the accelerating race among cloud giants to secure AI model access and differentiate their platforms.",
    url: 'https://www.wsj.com/articles/amazon-anthropic-4b-investment-demo',
    source: 'Wall Street Journal',
    category: 'MARKET_NEWS',
    impactLevel: 'LOW',
    affectedMarkets: ['STOCKS'],
    affectedAssets: ['AMZN', 'GOOGL', 'MSFT'],
    tags: ['amazon', 'ai', 'anthropic', 'cloud', 'investment'],
  },
  {
    title: 'EU AI Act Officially Enters Into Force — Tech Giants Face Compliance Deadlines',
    summary:
      'The European Union\'s Artificial Intelligence Act formally entered into force, establishing the world\'s first comprehensive regulatory framework for AI. Companies have staggered compliance timelines — prohibited AI systems must be shut down within six months, while high-risk applications have 36 months. Fines can reach €35M or 7% of global revenue.',
    url: 'https://www.ft.com/content/eu-ai-act-enters-force-demo',
    source: 'Financial Times',
    category: 'REGULATORY',
    impactLevel: 'LOW',
    affectedMarkets: ['STOCKS'],
    affectedAssets: ['MSFT', 'GOOGL', 'META', 'AMZN'],
    tags: ['eu', 'ai-regulation', 'compliance', 'tech'],
  },
  {
    title: "China's Manufacturing PMI Rebounds to 51.7, Beating Expectations",
    summary:
      "China's official manufacturing Purchasing Managers' Index rose to 51.7 in May from 50.4 in April, beating the 50.9 consensus and marking the strongest reading in 14 months. New export orders expanded for the first time since January. The data lifted risk sentiment in Asian markets and supported commodity-linked assets.",
    url: 'https://www.reuters.com/world/china/china-manufacturing-pmi-rebounds-may-demo',
    source: 'Reuters',
    category: 'INFLATION_MACRO',
    impactLevel: 'LOW',
    affectedMarkets: ['COMMODITIES', 'STOCKS', 'FOREX'],
    affectedAssets: ['GLD', 'USO', 'FXI'],
    tags: ['china', 'pmi', 'manufacturing', 'macro'],
  },
  {
    title: 'Palantir Technologies Added to S&P 500, Shares Surge 12%',
    summary:
      'Palantir Technologies was officially added to the S&P 500 index, triggering a 12% surge in share price as index-tracking funds were required to buy the stock. The inclusion reflects the company\'s sustained profitability and market capitalization growth, driven by strong demand for its AI Platform (AIP) products across government and commercial sectors.',
    url: 'https://www.cnbc.com/palantir-sp500-index-inclusion-demo',
    source: 'CNBC',
    category: 'MARKET_NEWS',
    impactLevel: 'LOW',
    affectedMarkets: ['STOCKS'],
    affectedAssets: ['PLTR', 'SPY'],
    tags: ['pltr', 'sp500', 'index-inclusion', 'ai'],
  },
  {
    title: 'BlackRock Files to Launch Bitcoin ETF Options Trading on Nasdaq',
    summary:
      'BlackRock filed with the SEC to allow options trading on its iShares Bitcoin Trust (IBIT) ETF on the Nasdaq exchange. If approved, this would enable investors to use leverage and hedging strategies on Bitcoin exposure through regulated options contracts, further deepening institutional access to the asset class.',
    url: 'https://www.coindesk.com/policy/blackrock-bitcoin-etf-options-nasdaq-demo',
    source: 'CoinDesk',
    category: 'CRYPTO',
    impactLevel: 'LOW',
    affectedMarkets: ['CRYPTO'],
    affectedAssets: ['BTC'],
    tags: ['bitcoin', 'etf', 'options', 'blackrock', 'institutional'],
  },
  {
    title: 'PayPal Expands PYUSD Stablecoin to Solana Network for Faster Payments',
    summary:
      "PayPal announced the expansion of its USD-pegged stablecoin PYUSD to the Solana blockchain, citing faster transaction speeds and significantly lower fees compared to Ethereum. The company is targeting business payments and cross-border remittances as key use cases, with integrations planned for PayPal and Venmo's business products.",
    url: 'https://www.bloomberg.com/news/paypal-pyusd-stablecoin-solana-demo',
    source: 'Bloomberg',
    category: 'CRYPTO',
    impactLevel: 'LOW',
    affectedMarkets: ['CRYPTO'],
    affectedAssets: ['SOL', 'PYPL'],
    tags: ['paypal', 'stablecoin', 'solana', 'payments'],
  },
  {
    title: 'Bank of Japan Maintains Yield Curve Control, Yen Weakens Past 155',
    summary:
      "The Bank of Japan left its yield curve control policy unchanged at its April meeting, keeping the 10-year JGB yield ceiling at 1%. The decision disappointed traders expecting further normalization, sending the yen to its weakest level against the dollar since 1990. Japanese equities rallied on the weaker yen, with the Nikkei 225 rising 0.9%.",
    url: 'https://www.ft.com/content/boj-yield-curve-control-yen-demo',
    source: 'Financial Times',
    category: 'FED_CENTRAL_BANKS',
    impactLevel: 'LOW',
    affectedMarkets: ['FOREX', 'STOCKS'],
    affectedAssets: ['DXY', 'EWJ'],
    tags: ['boj', 'japan', 'yen', 'yield-curve'],
  },
];

@Injectable()
export class MockNewsProvider implements NewsProvider {
  readonly providerSlug = 'mock';

  async fetchArticles(): Promise<NewsArticleInput[]> {
    const now = Date.now();
    const dates = [
      hoursAgo(2), hoursAgo(5), hoursAgo(8), hoursAgo(12), hoursAgo(18),
      daysAgo(1), daysAgo(1), daysAgo(2), daysAgo(2), daysAgo(2),
      daysAgo(3), daysAgo(3), daysAgo(3), daysAgo(4), daysAgo(4),
      daysAgo(4), daysAgo(5), daysAgo(5), daysAgo(5), daysAgo(6),
      daysAgo(6), daysAgo(6), daysAgo(7), daysAgo(7), daysAgo(7),
    ];

    return MOCK_ARTICLES.map((article, i) => ({
      ...article,
      publishedAt: dates[i] ?? new Date(now - i * 3_600_000),
    }));
  }
}
