/**
 * Vendor price monitoring via Jina Reader.
 *
 * Jina Reader (r.jina.ai) converts any URL to clean markdown — free, no API key.
 * We fetch each vendor's public pricing page, run a regex extractor, and return
 * the parsed rate. The Inngest cron compares this to VendorPricingTier and logs
 * changes to PriceChangeLog.
 */

export interface MonitoredRate {
  vendorId: string;
  tierName: string;        // internal label, e.g. "gpt-4o-input"
  displayName: string;     // human label, e.g. "GPT-4o (input)"
  unit: string;            // e.g. "per 1M tokens"
  unitBatchSize: number;   // how many units the price covers (1M tokens = 1_000_000)
  pricingUrl: string;
  /** Extract price from Jina markdown. Return null if not found. */
  extract: (markdown: string) => number | null;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

/** Pull the first dollar amount near a keyword in markdown. */
function findPrice(markdown: string, ...keywords: string[]): number | null {
  const lower = markdown.toLowerCase();
  for (const kw of keywords) {
    const idx = lower.indexOf(kw.toLowerCase());
    if (idx === -1) continue;
    // Search a window of 300 chars around the keyword for a price
    const window = markdown.slice(Math.max(0, idx - 50), idx + 250);
    const match = window.match(/\$\s*(\d+(?:\.\d+)?)/);
    if (match) return parseFloat(match[1]);
  }
  return null;
}

// ─── Monitored vendor rates ───────────────────────────────────────────────────

export const MONITORED_RATES: MonitoredRate[] = [

  // ── OpenAI ─────────────────────────────────────────────────────────────────
  {
    vendorId: "openai",
    tierName: "gpt-4o-input",
    displayName: "GPT-4o (input)",
    unit: "per 1M tokens",
    unitBatchSize: 1_000_000,
    pricingUrl: "https://openai.com/api/pricing/",
    extract: (md) => findPrice(md, "gpt-4o\n", "gpt-4o |", "GPT-4o input"),
  },
  {
    vendorId: "openai",
    tierName: "gpt-4o-mini-input",
    displayName: "GPT-4o mini (input)",
    unit: "per 1M tokens",
    unitBatchSize: 1_000_000,
    pricingUrl: "https://openai.com/api/pricing/",
    extract: (md) => findPrice(md, "gpt-4o mini\n", "gpt-4o-mini input", "4o mini"),
  },

  // ── Anthropic ──────────────────────────────────────────────────────────────
  {
    vendorId: "anthropic",
    tierName: "claude-sonnet-input",
    displayName: "Claude Sonnet (input)",
    unit: "per 1M tokens",
    unitBatchSize: 1_000_000,
    pricingUrl: "https://www.anthropic.com/pricing",
    extract: (md) => findPrice(md, "claude-sonnet", "Sonnet input", "sonnet\n$3", "3.5 sonnet"),
  },
  {
    vendorId: "anthropic",
    tierName: "claude-haiku-input",
    displayName: "Claude Haiku (input)",
    unit: "per 1M tokens",
    unitBatchSize: 1_000_000,
    pricingUrl: "https://www.anthropic.com/pricing",
    extract: (md) => findPrice(md, "claude-haiku", "Haiku input", "haiku\n$"),
  },

  // ── Groq ───────────────────────────────────────────────────────────────────
  {
    vendorId: "groq",
    tierName: "llama3-70b-input",
    displayName: "Llama 3.3 70B (input)",
    unit: "per 1M tokens",
    unitBatchSize: 1_000_000,
    pricingUrl: "https://groq.com/pricing/",
    extract: (md) => findPrice(md, "llama-3.3-70b", "llama3-70b", "70b versatile", "70b input"),
  },
  {
    vendorId: "groq",
    tierName: "llama3-8b-input",
    displayName: "Llama 3.1 8B (input)",
    unit: "per 1M tokens",
    unitBatchSize: 1_000_000,
    pricingUrl: "https://groq.com/pricing/",
    extract: (md) => findPrice(md, "llama-3.1-8b", "llama3-8b", "8b instant", "8b input"),
  },

  // ── Mistral ────────────────────────────────────────────────────────────────
  {
    vendorId: "mistral",
    tierName: "mistral-small-input",
    displayName: "Mistral Small (input)",
    unit: "per 1M tokens",
    unitBatchSize: 1_000_000,
    pricingUrl: "https://mistral.ai/technology/",
    extract: (md) => findPrice(md, "mistral small", "small input"),
  },
  {
    vendorId: "mistral",
    tierName: "mistral-large-input",
    displayName: "Mistral Large (input)",
    unit: "per 1M tokens",
    unitBatchSize: 1_000_000,
    pricingUrl: "https://mistral.ai/technology/",
    extract: (md) => findPrice(md, "mistral large", "large input"),
  },

  // ── Twilio ─────────────────────────────────────────────────────────────────
  {
    vendorId: "twilio",
    tierName: "sms-outbound-us",
    displayName: "SMS Outbound (US)",
    unit: "per SMS",
    unitBatchSize: 1,
    pricingUrl: "https://www.twilio.com/en-us/sms/pricing/us",
    extract: (md) => findPrice(md, "outbound", "send sms", "outgoing"),
  },

  // ── Resend ─────────────────────────────────────────────────────────────────
  {
    vendorId: "resend",
    tierName: "email-pro",
    displayName: "Email (Pro tier)",
    unit: "per email",
    unitBatchSize: 1,
    pricingUrl: "https://resend.com/pricing",
    extract: (md) => findPrice(md, "per email", "additional email", "/email"),
  },

  // ── Stripe ─────────────────────────────────────────────────────────────────
  {
    vendorId: "stripe",
    tierName: "card-processing",
    displayName: "Card Processing",
    unit: "% per transaction",
    unitBatchSize: 1,
    pricingUrl: "https://stripe.com/pricing",
    // Stripe's rate is a percentage — look for "2.9%" pattern
    extract: (md) => {
      const match = md.match(/(\d+\.\d+)\s*%\s*\+/);
      return match ? parseFloat(match[1]) / 100 : null;
    },
  },

  // ── Vercel ─────────────────────────────────────────────────────────────────
  {
    vendorId: "vercel",
    tierName: "pro-monthly",
    displayName: "Pro plan",
    unit: "per month",
    unitBatchSize: 1,
    pricingUrl: "https://vercel.com/pricing",
    extract: (md) => findPrice(md, "pro\n", "pro plan", "$20", "per member"),
  },
];

// ─── Fetcher ─────────────────────────────────────────────────────────────────

const JINA_BASE = "https://r.jina.ai/";
const PAGE_CACHE = new Map<string, string>(); // cache within a single run

export async function fetchPricingPage(url: string): Promise<string | null> {
  if (PAGE_CACHE.has(url)) return PAGE_CACHE.get(url)!;
  try {
    const res = await fetch(`${JINA_BASE}${url}`, {
      headers: {
        "Accept": "text/plain",
        "X-Return-Format": "markdown",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    PAGE_CACHE.set(url, text);
    return text;
  } catch {
    return null;
  }
}

export async function fetchCurrentRate(rate: MonitoredRate): Promise<number | null> {
  const markdown = await fetchPricingPage(rate.pricingUrl);
  if (!markdown) return null;
  return rate.extract(markdown);
}
