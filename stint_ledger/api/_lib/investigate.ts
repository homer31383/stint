// Shared logic for POST /api/investigate: takes up to 4 tickers with their
// moves and asks Claude (Haiku + web search) why they are moving. Used by the
// Vercel function in api/investigate.ts and the dev middleware in
// vite.config.ts, mirroring the api/_lib/yahoo.ts pattern.
//
// The ANTHROPIC_API_KEY never reaches the client: the serverless function
// reads it from the Vercel env, the dev middleware from .env via loadEnv.

import Anthropic from '@anthropic-ai/sdk';

export interface InvestigateTicker {
  symbol: string;
  name?: string;
  changePercent: string; // preformatted, e.g. "+2.34%"
  timeframe: string; // human phrase, e.g. "today", "the past week"
}

export const MAX_TICKERS = 4;

// Validates and clamps an incoming request body. Returns null on anything
// malformed rather than throwing, so callers map it to a 400.
export function parseInvestigateBody(body: unknown): InvestigateTicker[] | null {
  if (!body || typeof body !== 'object') return null;
  const list = (body as { tickers?: unknown }).tickers;
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_TICKERS) return null;
  const out: InvestigateTicker[] = [];
  for (const t of list) {
    if (!t || typeof t !== 'object') return null;
    const { symbol, name, changePercent, timeframe } = t as Record<string, unknown>;
    if (typeof symbol !== 'string' || !symbol.trim()) return null;
    if (typeof changePercent !== 'string' || typeof timeframe !== 'string') return null;
    out.push({
      symbol: symbol.trim().slice(0, 20),
      name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 80) : undefined,
      changePercent: changePercent.slice(0, 16),
      timeframe: timeframe.slice(0, 32),
    });
  }
  return out;
}

const SYSTEM_PROMPT = `You are a market analyst. For each asset the user lists, briefly investigate the price movement over the stated period using web search. Then answer:

1. For each asset individually: what is the most likely driver of this move? (earnings, news, analyst action, sector rotation, macro, or "no specific catalyst - normal volatility")
2. Collectively: is there a common thread connecting these moves (sector, macro event, rates, currency, broad risk-on/off), or are they independent?

Be concise and factual. Clearly separate what is reported fact (cite the source inline as plain text) from your inference. If you cannot find a clear driver, say so plainly rather than speculating. End with a one-sentence bottom line. Respond in plain text paragraphs, no markdown formatting.`;

export async function runInvestigation(
  tickers: InvestigateTicker[],
  apiKey: string,
): Promise<string> {
  const client = new Anthropic({ apiKey });

  const assetLines = tickers
    .map((t) => `- ${t.name || t.symbol} (${t.symbol}): ${t.changePercent} over ${t.timeframe}`)
    .join('\n');

  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    // max_uses bounds latency and cost; a couple of searches per asset is
    // plenty for "why is this moving".
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }],
    messages: [{ role: 'user', content: `Assets:\n${assetLines}` }],
  };

  let response = await client.messages.create(params);

  // pause_turn: the server-side search loop hit its iteration limit mid-turn.
  // Re-send with the assistant turn appended and the server resumes.
  for (let i = 0; i < 3 && response.stop_reason === 'pause_turn'; i++) {
    response = await client.messages.create({
      ...params,
      messages: [...params.messages, { role: 'assistant', content: response.content }],
    });
  }

  // The response interleaves text blocks with web search tool results, and
  // cited prose arrives split across consecutive text blocks (one per cited
  // span). Contiguous text blocks are therefore one passage and concatenate
  // with no separator; only a tool-use boundary starts a new paragraph.
  const passages: string[] = [];
  let current = '';
  for (const b of response.content) {
    if (b.type === 'text') {
      current += b.text;
    } else if (current.trim()) {
      passages.push(current.trim());
      current = '';
    }
  }
  if (current.trim()) passages.push(current.trim());
  const text = passages.join('\n\n');

  if (!text) throw new Error('the analysis came back empty');
  return text;
}

// Anthropic API errors carry .message on a typed error class; anything else
// gets String()ed.
export function extractErrorMessage(e: unknown): string {
  if (e instanceof Anthropic.APIError) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}
