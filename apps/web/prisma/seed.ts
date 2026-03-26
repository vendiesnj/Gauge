/**
 * Gauge – Vendor Pricing Tier Seed
 *
 * Prices verified as of early 2025. Run after migration:
 *   pnpm exec prisma db seed
 *
 * Update this file when vendor pricing changes.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaPg(pool as any);
const db = new PrismaClient({ adapter });

type TierInput = {
  vendorId: string;
  tierName: string;
  tierOrder: number;
  monthlyBaseUsd?: number;
  usageUnit: string;
  usageUnitLabel: string;
  includedUnits?: number;
  pricePerUnit?: number;
  unitBatchSize?: number;
  maxUnits?: number;
  isFreeTier?: boolean;
  isMostPopular?: boolean;
  percentageRate?: number;
  perTxFeeUsd?: number;
  notes?: string;
  sourceUrl?: string;
};

const tiers: TierInput[] = [

  // ─── OpenAI ──────────────────────────────────────────────────────────────────
  // No subscription tiers — model choice IS the tier decision.
  {
    vendorId: "openai", tierName: "GPT-4o mini", tierOrder: 0,
    usageUnit: "tokens_1m", usageUnitLabel: "1M tokens",
    pricePerUnit: 0.375, unitBatchSize: 1,   // blended avg input+output
    notes: "Input $0.15/1M, output $0.60/1M. Best for high-volume tasks.",
    sourceUrl: "https://openai.com/pricing",
  },
  {
    vendorId: "openai", tierName: "GPT-4o", tierOrder: 1, isMostPopular: true,
    usageUnit: "tokens_1m", usageUnitLabel: "1M tokens",
    pricePerUnit: 10.0, unitBatchSize: 1,   // blended avg
    notes: "Input $5/1M, output $15/1M. Best frontier model.",
    sourceUrl: "https://openai.com/pricing",
  },
  {
    vendorId: "openai", tierName: "GPT-4o (Batch API)", tierOrder: 2,
    usageUnit: "tokens_1m", usageUnitLabel: "1M tokens",
    pricePerUnit: 5.0, unitBatchSize: 1,
    notes: "50% cheaper via Batch API — 24h turnaround, async only.",
    sourceUrl: "https://openai.com/pricing",
  },

  // ─── Anthropic ───────────────────────────────────────────────────────────────
  {
    vendorId: "anthropic", tierName: "Claude 3 Haiku", tierOrder: 0,
    usageUnit: "tokens_1m", usageUnitLabel: "1M tokens",
    pricePerUnit: 1.0, unitBatchSize: 1,   // blended
    notes: "Input $0.80/1M, output $4/1M. Fastest, cheapest.",
    sourceUrl: "https://www.anthropic.com/pricing",
  },
  {
    vendorId: "anthropic", tierName: "Claude 3.5 Sonnet", tierOrder: 1, isMostPopular: true,
    usageUnit: "tokens_1m", usageUnitLabel: "1M tokens",
    pricePerUnit: 9.0, unitBatchSize: 1,   // blended
    notes: "Input $3/1M, output $15/1M. Best intelligence/cost balance.",
    sourceUrl: "https://www.anthropic.com/pricing",
  },
  {
    vendorId: "anthropic", tierName: "Claude 3 Opus", tierOrder: 2,
    usageUnit: "tokens_1m", usageUnitLabel: "1M tokens",
    pricePerUnit: 45.0, unitBatchSize: 1,  // blended
    notes: "Input $15/1M, output $75/1M. Highest capability.",
    sourceUrl: "https://www.anthropic.com/pricing",
  },

  // ─── Groq ─────────────────────────────────────────────────────────────────────
  {
    vendorId: "groq", tierName: "Llama 3.1 8B", tierOrder: 0,
    usageUnit: "tokens_1m", usageUnitLabel: "1M tokens",
    pricePerUnit: 0.05, unitBatchSize: 1,
    notes: "Fastest, cheapest. Good for classification and extraction.",
    sourceUrl: "https://groq.com/pricing",
  },
  {
    vendorId: "groq", tierName: "Llama 3.3 70B", tierOrder: 1, isMostPopular: true,
    usageUnit: "tokens_1m", usageUnitLabel: "1M tokens",
    pricePerUnit: 0.59, unitBatchSize: 1,
    notes: "$0.59/1M tokens. Near-GPT-4 quality at a fraction of the cost.",
    sourceUrl: "https://groq.com/pricing",
  },

  // ─── SendGrid ────────────────────────────────────────────────────────────────
  {
    vendorId: "sendgrid", tierName: "Free", tierOrder: 0, isFreeTier: true,
    usageUnit: "emails", usageUnitLabel: "emails/mo",
    includedUnits: 3000, maxUnits: 3000,
    notes: "100 emails/day cap. No credit card required.",
    sourceUrl: "https://sendgrid.com/pricing",
  },
  {
    vendorId: "sendgrid", tierName: "Essentials 50k", tierOrder: 1,
    monthlyBaseUsd: 19.95,
    usageUnit: "emails", usageUnitLabel: "emails/mo",
    includedUnits: 50000,
    notes: "No overage — must upgrade for more volume.",
    sourceUrl: "https://sendgrid.com/pricing",
  },
  {
    vendorId: "sendgrid", tierName: "Essentials 100k", tierOrder: 2,
    monthlyBaseUsd: 34.95,
    usageUnit: "emails", usageUnitLabel: "emails/mo",
    includedUnits: 100000,
    sourceUrl: "https://sendgrid.com/pricing",
  },
  {
    vendorId: "sendgrid", tierName: "Pro 100k", tierOrder: 3, isMostPopular: true,
    monthlyBaseUsd: 89.95,
    usageUnit: "emails", usageUnitLabel: "emails/mo",
    includedUnits: 100000,
    pricePerUnit: 1.0, unitBatchSize: 1000,
    notes: "Includes dedicated IP + sub-user management.",
    sourceUrl: "https://sendgrid.com/pricing",
  },

  // ─── Resend ──────────────────────────────────────────────────────────────────
  {
    vendorId: "resend", tierName: "Free", tierOrder: 0, isFreeTier: true,
    usageUnit: "emails", usageUnitLabel: "emails/mo",
    includedUnits: 3000, maxUnits: 3000,
    notes: "100 emails/day cap. 1 custom domain.",
    sourceUrl: "https://resend.com/pricing",
  },
  {
    vendorId: "resend", tierName: "Pro", tierOrder: 1, isMostPopular: true,
    monthlyBaseUsd: 20,
    usageUnit: "emails", usageUnitLabel: "emails/mo",
    includedUnits: 50000,
    pricePerUnit: 1.0, unitBatchSize: 1000,
    notes: "Unlimited domains. $1/1k emails after 50k.",
    sourceUrl: "https://resend.com/pricing",
  },
  {
    vendorId: "resend", tierName: "Scale", tierOrder: 2,
    monthlyBaseUsd: 90,
    usageUnit: "emails", usageUnitLabel: "emails/mo",
    includedUnits: 100000,
    pricePerUnit: 1.0, unitBatchSize: 1000,
    sourceUrl: "https://resend.com/pricing",
  },

  // ─── Mailgun ─────────────────────────────────────────────────────────────────
  {
    vendorId: "mailgun", tierName: "Free Trial", tierOrder: 0, isFreeTier: true,
    usageUnit: "emails", usageUnitLabel: "emails/mo",
    includedUnits: 100, maxUnits: 100,
    notes: "Sandbox only. Not for production.",
    sourceUrl: "https://www.mailgun.com/pricing",
  },
  {
    vendorId: "mailgun", tierName: "Foundation", tierOrder: 1,
    monthlyBaseUsd: 35,
    usageUnit: "emails", usageUnitLabel: "emails/mo",
    includedUnits: 50000,
    pricePerUnit: 0.8, unitBatchSize: 1000,
    sourceUrl: "https://www.mailgun.com/pricing",
  },
  {
    vendorId: "mailgun", tierName: "Scale", tierOrder: 2, isMostPopular: true,
    monthlyBaseUsd: 90,
    usageUnit: "emails", usageUnitLabel: "emails/mo",
    includedUnits: 100000,
    pricePerUnit: 0.7, unitBatchSize: 1000,
    sourceUrl: "https://www.mailgun.com/pricing",
  },

  // ─── Twilio SMS ───────────────────────────────────────────────────────────────
  {
    vendorId: "twilio", tierName: "Pay-as-you-go (US)", tierOrder: 0,
    usageUnit: "sms", usageUnitLabel: "SMS messages",
    pricePerUnit: 0.0079, unitBatchSize: 1,
    notes: "US outbound. Inbound $0.0075. No monthly fee.",
    sourceUrl: "https://www.twilio.com/en-us/sms/pricing/us",
  },
  {
    vendorId: "twilio", tierName: "Short Code (US)", tierOrder: 1,
    monthlyBaseUsd: 500,
    usageUnit: "sms", usageUnitLabel: "SMS messages",
    pricePerUnit: 0.005, unitBatchSize: 1,
    notes: "Short codes: $500/mo + $0.005/SMS. Best for high volume.",
    sourceUrl: "https://www.twilio.com/en-us/sms/pricing/us",
  },

  // ─── Stripe ──────────────────────────────────────────────────────────────────
  {
    vendorId: "stripe", tierName: "Standard", tierOrder: 0, isMostPopular: true,
    usageUnit: "transaction_volume_usd", usageUnitLabel: "$ transaction volume",
    percentageRate: 0.029, perTxFeeUsd: 0.30,
    notes: "2.9% + $0.30 per successful card charge. No monthly fee.",
    sourceUrl: "https://stripe.com/pricing",
  },
  {
    vendorId: "stripe", tierName: "Interchange+ (Custom)", tierOrder: 1,
    usageUnit: "transaction_volume_usd", usageUnitLabel: "$ transaction volume",
    percentageRate: 0.015, perTxFeeUsd: 0.15,
    notes: "Negotiated rates available at ~$250k+/mo volume.",
    sourceUrl: "https://stripe.com/pricing",
  },

  // ─── Auth0 ────────────────────────────────────────────────────────────────────
  {
    vendorId: "auth0", tierName: "Free", tierOrder: 0, isFreeTier: true,
    usageUnit: "mau", usageUnitLabel: "MAU",
    includedUnits: 7500, maxUnits: 7500,
    notes: "7,500 MAU. Social login, MFA. No credit card.",
    sourceUrl: "https://auth0.com/pricing",
  },
  {
    vendorId: "auth0", tierName: "Essentials", tierOrder: 1,
    monthlyBaseUsd: 35,
    usageUnit: "mau", usageUnitLabel: "MAU",
    includedUnits: 500,
    pricePerUnit: 0.07, unitBatchSize: 1,
    notes: "$35/mo includes 500 MAU. $0.07/MAU after.",
    sourceUrl: "https://auth0.com/pricing",
  },
  {
    vendorId: "auth0", tierName: "Professional", tierOrder: 2, isMostPopular: true,
    monthlyBaseUsd: 240,
    usageUnit: "mau", usageUnitLabel: "MAU",
    includedUnits: 5000,
    pricePerUnit: 0.048, unitBatchSize: 1,
    notes: "$240/mo includes 5k MAU. $0.048/MAU after. Custom domains.",
    sourceUrl: "https://auth0.com/pricing",
  },

  // ─── Clerk ────────────────────────────────────────────────────────────────────
  {
    vendorId: "clerk", tierName: "Free", tierOrder: 0, isFreeTier: true,
    usageUnit: "mau", usageUnitLabel: "MAU",
    includedUnits: 10000, maxUnits: 10000,
    notes: "10,000 MAU. All core auth features included.",
    sourceUrl: "https://clerk.com/pricing",
  },
  {
    vendorId: "clerk", tierName: "Pro", tierOrder: 1, isMostPopular: true,
    monthlyBaseUsd: 25,
    usageUnit: "mau", usageUnitLabel: "MAU",
    includedUnits: 10000,
    pricePerUnit: 0.02, unitBatchSize: 1,
    notes: "$25/mo includes 10k MAU. $0.02/MAU after. Custom domain, orgs.",
    sourceUrl: "https://clerk.com/pricing",
  },
  {
    vendorId: "clerk", tierName: "Enterprise", tierOrder: 2,
    monthlyBaseUsd: 350,
    usageUnit: "mau", usageUnitLabel: "MAU",
    includedUnits: 50000,
    pricePerUnit: 0.007, unitBatchSize: 1,
    notes: "SSO/SAML, enterprise SLAs, dedicated support.",
    sourceUrl: "https://clerk.com/pricing",
  },

  // ─── Sentry ──────────────────────────────────────────────────────────────────
  {
    vendorId: "sentry", tierName: "Developer", tierOrder: 0, isFreeTier: true,
    usageUnit: "events_1k", usageUnitLabel: "k errors/mo",
    includedUnits: 5, maxUnits: 5,
    notes: "5k errors/mo, 1 user, 30-day retention.",
    sourceUrl: "https://sentry.io/pricing",
  },
  {
    vendorId: "sentry", tierName: "Team", tierOrder: 1, isMostPopular: true,
    monthlyBaseUsd: 29,
    usageUnit: "events_1k", usageUnitLabel: "k errors/mo",
    includedUnits: 50,
    pricePerUnit: 0.50, unitBatchSize: 1,
    notes: "$29/mo includes 50k errors. $0.50/1k additional.",
    sourceUrl: "https://sentry.io/pricing",
  },
  {
    vendorId: "sentry", tierName: "Business", tierOrder: 2,
    monthlyBaseUsd: 89,
    usageUnit: "events_1k", usageUnitLabel: "k errors/mo",
    includedUnits: 100,
    pricePerUnit: 0.35, unitBatchSize: 1,
    notes: "$89/mo includes 100k errors. Better rate at scale.",
    sourceUrl: "https://sentry.io/pricing",
  },

  // ─── Datadog ─────────────────────────────────────────────────────────────────
  {
    vendorId: "datadog", tierName: "Free", tierOrder: 0, isFreeTier: true,
    usageUnit: "hosts", usageUnitLabel: "hosts",
    includedUnits: 5, maxUnits: 5,
    notes: "5 hosts, 1 day retention, core metrics only.",
    sourceUrl: "https://www.datadoghq.com/pricing",
  },
  {
    vendorId: "datadog", tierName: "Pro", tierOrder: 1, isMostPopular: true,
    usageUnit: "hosts", usageUnitLabel: "hosts",
    pricePerUnit: 15, unitBatchSize: 1,
    notes: "$15/host/mo (annual). 15-month data retention, APM add-on available.",
    sourceUrl: "https://www.datadoghq.com/pricing",
  },
  {
    vendorId: "datadog", tierName: "Enterprise", tierOrder: 2,
    usageUnit: "hosts", usageUnitLabel: "hosts",
    pricePerUnit: 23, unitBatchSize: 1,
    notes: "$23/host/mo. Custom retention, priority support, CSPM.",
    sourceUrl: "https://www.datadoghq.com/pricing",
  },

  // ─── Vercel ──────────────────────────────────────────────────────────────────
  {
    vendorId: "vercel", tierName: "Hobby", tierOrder: 0, isFreeTier: true,
    usageUnit: "deploys", usageUnitLabel: "deployments/mo",
    includedUnits: 6000,
    notes: "Free for personal/non-commercial use. 100GB bandwidth.",
    sourceUrl: "https://vercel.com/pricing",
  },
  {
    vendorId: "vercel", tierName: "Pro", tierOrder: 1, isMostPopular: true,
    monthlyBaseUsd: 20,
    usageUnit: "deploys", usageUnitLabel: "deployments/mo",
    includedUnits: 6000,
    notes: "$20/mo per seat. Commercial use, 1TB bandwidth, preview environments.",
    sourceUrl: "https://vercel.com/pricing",
  },

  // ─── Supabase ────────────────────────────────────────────────────────────────
  {
    vendorId: "supabase", tierName: "Free", tierOrder: 0, isFreeTier: true,
    usageUnit: "gb_storage", usageUnitLabel: "GB storage",
    includedUnits: 0.5, maxUnits: 0.5,
    notes: "500MB DB, 1GB file storage, 50k MAU auth, 2 projects.",
    sourceUrl: "https://supabase.com/pricing",
  },
  {
    vendorId: "supabase", tierName: "Pro", tierOrder: 1, isMostPopular: true,
    monthlyBaseUsd: 25,
    usageUnit: "gb_storage", usageUnitLabel: "GB storage",
    includedUnits: 8,
    pricePerUnit: 0.125, unitBatchSize: 1,
    notes: "$25/mo includes 8GB DB, 250GB bandwidth. $0.125/GB over.",
    sourceUrl: "https://supabase.com/pricing",
  },
  {
    vendorId: "supabase", tierName: "Team", tierOrder: 2,
    monthlyBaseUsd: 599,
    usageUnit: "gb_storage", usageUnitLabel: "GB storage",
    includedUnits: 100,
    pricePerUnit: 0.125, unitBatchSize: 1,
    notes: "SOC2, SSO, priority support, HIPAA add-on.",
    sourceUrl: "https://supabase.com/pricing",
  },

  // ─── Neon ─────────────────────────────────────────────────────────────────────
  {
    vendorId: "neon", tierName: "Free", tierOrder: 0, isFreeTier: true,
    usageUnit: "gb_storage", usageUnitLabel: "GB storage",
    includedUnits: 0.5, maxUnits: 0.5,
    notes: "0.5 GB storage, 1 project, 1 branch. Autosuspend after 5 min.",
    sourceUrl: "https://neon.tech/pricing",
  },
  {
    vendorId: "neon", tierName: "Launch", tierOrder: 1,
    monthlyBaseUsd: 19,
    usageUnit: "gb_storage", usageUnitLabel: "GB storage",
    includedUnits: 10,
    pricePerUnit: 0.15, unitBatchSize: 1,
    notes: "$19/mo includes 10GB. Good for early-stage.",
    sourceUrl: "https://neon.tech/pricing",
  },
  {
    vendorId: "neon", tierName: "Scale", tierOrder: 2, isMostPopular: true,
    monthlyBaseUsd: 69,
    usageUnit: "gb_storage", usageUnitLabel: "GB storage",
    includedUnits: 50,
    pricePerUnit: 0.15, unitBatchSize: 1,
    notes: "$69/mo includes 50GB. Autoscaling compute, no suspend.",
    sourceUrl: "https://neon.tech/pricing",
  },

  // ─── Algolia ─────────────────────────────────────────────────────────────────
  {
    vendorId: "algolia", tierName: "Free", tierOrder: 0, isFreeTier: true,
    usageUnit: "requests_1k", usageUnitLabel: "k search requests/mo",
    includedUnits: 10, maxUnits: 10,
    notes: "10k requests + 10k records. 1 app.",
    sourceUrl: "https://www.algolia.com/pricing",
  },
  {
    vendorId: "algolia", tierName: "Grow (Pay-as-you-go)", tierOrder: 1,
    usageUnit: "requests_1k", usageUnitLabel: "k search requests/mo",
    includedUnits: 10,
    pricePerUnit: 0.50, unitBatchSize: 1,
    notes: "First 10k free. $0.50/1k requests after. No monthly fee.",
    sourceUrl: "https://www.algolia.com/pricing",
  },
  {
    vendorId: "algolia", tierName: "Premium", tierOrder: 2, isMostPopular: true,
    monthlyBaseUsd: 100,
    usageUnit: "requests_1k", usageUnitLabel: "k search requests/mo",
    includedUnits: 1000,
    pricePerUnit: 0.10, unitBatchSize: 1,
    notes: "Better unit economics at scale. AI reranking, analytics.",
    sourceUrl: "https://www.algolia.com/pricing",
  },

  // ─── Upstash Redis ────────────────────────────────────────────────────────────
  {
    vendorId: "upstash", tierName: "Free", tierOrder: 0, isFreeTier: true,
    usageUnit: "requests_1k", usageUnitLabel: "k commands/day",
    includedUnits: 10,
    notes: "10k commands/day, 256MB, 1 DB. Ideal for caching.",
    sourceUrl: "https://upstash.com/pricing",
  },
  {
    vendorId: "upstash", tierName: "Pay-as-you-go", tierOrder: 1, isMostPopular: true,
    usageUnit: "requests_1k", usageUnitLabel: "k commands/mo",
    pricePerUnit: 0.20, unitBatchSize: 1,
    notes: "$0.20/100k commands. No monthly fee. Global replication available.",
    sourceUrl: "https://upstash.com/pricing",
  },
  {
    vendorId: "upstash", tierName: "Pro", tierOrder: 2,
    monthlyBaseUsd: 180,
    usageUnit: "requests_1k", usageUnitLabel: "k commands/mo",
    includedUnits: 5000,
    pricePerUnit: 0.10, unitBatchSize: 1,
    notes: "Better rate at 5M+ commands/mo. Dedicated, low latency.",
    sourceUrl: "https://upstash.com/pricing",
  },

  // ─── Pinecone ─────────────────────────────────────────────────────────────────
  {
    vendorId: "pinecone", tierName: "Free", tierOrder: 0, isFreeTier: true,
    usageUnit: "requests_1k", usageUnitLabel: "k read units/mo",
    includedUnits: 0, // serverless pay-per-use starts with some free
    notes: "Serverless free tier. 2M read units/mo, 2M write units/mo.",
    sourceUrl: "https://www.pinecone.io/pricing",
  },
  {
    vendorId: "pinecone", tierName: "Serverless (Standard)", tierOrder: 1, isMostPopular: true,
    usageUnit: "requests_1k", usageUnitLabel: "k read units/mo",
    pricePerUnit: 0.096, unitBatchSize: 1,
    notes: "$0.096/1M read units. $0.05/1M write. Fully serverless.",
    sourceUrl: "https://www.pinecone.io/pricing",
  },
  {
    vendorId: "pinecone", tierName: "Standard (Dedicated)", tierOrder: 2,
    monthlyBaseUsd: 70,
    usageUnit: "requests_1k", usageUnitLabel: "k read units/mo",
    notes: "Dedicated pods from $70/mo. Predictable performance.",
    sourceUrl: "https://www.pinecone.io/pricing",
  },
];

async function main() {
  console.log(`Seeding ${tiers.length} pricing tiers for ${new Set(tiers.map((t) => t.vendorId)).size} vendors…`);

  let upserted = 0;
  for (const tier of tiers) {
    await db.vendorPricingTier.upsert({
      where: { vendorId_tierName: { vendorId: tier.vendorId, tierName: tier.tierName } },
      update: {
        tierOrder: tier.tierOrder,
        monthlyBaseUsd: tier.monthlyBaseUsd ?? 0,
        usageUnit: tier.usageUnit,
        usageUnitLabel: tier.usageUnitLabel,
        includedUnits: tier.includedUnits ?? 0,
        pricePerUnit: tier.pricePerUnit ?? null,
        unitBatchSize: tier.unitBatchSize ?? 1,
        maxUnits: tier.maxUnits ?? null,
        isFreeTier: tier.isFreeTier ?? false,
        isMostPopular: tier.isMostPopular ?? false,
        percentageRate: tier.percentageRate ?? null,
        perTxFeeUsd: tier.perTxFeeUsd ?? null,
        notes: tier.notes ?? null,
        sourceUrl: tier.sourceUrl ?? null,
        lastVerifiedAt: new Date(),
      },
      create: {
        vendorId: tier.vendorId,
        tierName: tier.tierName,
        tierOrder: tier.tierOrder,
        monthlyBaseUsd: tier.monthlyBaseUsd ?? 0,
        usageUnit: tier.usageUnit,
        usageUnitLabel: tier.usageUnitLabel,
        includedUnits: tier.includedUnits ?? 0,
        pricePerUnit: tier.pricePerUnit ?? null,
        unitBatchSize: tier.unitBatchSize ?? 1,
        maxUnits: tier.maxUnits ?? null,
        isFreeTier: tier.isFreeTier ?? false,
        isMostPopular: tier.isMostPopular ?? false,
        percentageRate: tier.percentageRate ?? null,
        perTxFeeUsd: tier.perTxFeeUsd ?? null,
        notes: tier.notes ?? null,
        sourceUrl: tier.sourceUrl ?? null,
      },
    });
    upserted++;
  }

  console.log(`✓ ${upserted} tiers seeded.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
