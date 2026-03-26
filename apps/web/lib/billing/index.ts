/**
 * Billing API query module
 * Keys are used transiently — never stored, discarded after query.
 */

export type BillingResult = {
  vendorId: string;
  planName: string;
  monthlySpendUsd: number;
  usageIncluded?: number;
  unit?: string;
  source: "billing_api";
};

// ─── OpenAI ───────────────────────────────────────────────────────────────────
// Uses the organization usage API (2024+) to get token counts, then estimates cost
async function fetchOpenAI(key: string): Promise<BillingResult | null> {
  try {
    const now = new Date();
    const startOfMonth = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);

    // Try the org usage endpoint (requires usage.read scope)
    const usageRes = await fetch(
      `https://api.openai.com/v1/organization/usage/completions?start_time=${startOfMonth}&limit=100`,
      { headers: { Authorization: `Bearer ${key}` } }
    );

    if (usageRes.ok) {
      const data = await usageRes.json();
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      for (const item of data.data ?? []) {
        totalInputTokens += item.input_tokens ?? 0;
        totalOutputTokens += item.output_tokens ?? 0;
      }
      const estimatedCost = (totalInputTokens / 1_000_000) * 0.15 + (totalOutputTokens / 1_000_000) * 0.60;
      return {
        vendorId: "openai",
        planName: "Pay-as-you-go",
        monthlySpendUsd: Math.round(estimatedCost * 100) / 100,
        source: "billing_api",
      };
    }

    // Fallback: verify the key is valid via models endpoint
    const validRes = await fetch("https://api.openai.com/v1/models?limit=1", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!validRes.ok) return null;

    // Key is valid but no usage data available — return $0 so it shows as detected
    return {
      vendorId: "openai",
      planName: "Pay-as-you-go",
      monthlySpendUsd: 0,
      source: "billing_api",
    };
  } catch {
    return null;
  }
}

// ─── Anthropic ────────────────────────────────────────────────────────────────
async function fetchAnthropic(key: string): Promise<BillingResult | null> {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

    // Try usage API (requires admin key with usage:read scope)
    const usageRes = await fetch(
      `https://api.anthropic.com/v1/organizations/usage?start_date=${startOfMonth}`,
      {
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
      }
    );

    if (usageRes.ok) {
      const data = await usageRes.json();
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      for (const item of data.data ?? []) {
        totalInputTokens += item.input_tokens ?? 0;
        totalOutputTokens += item.output_tokens ?? 0;
      }
      const estimatedCost = (totalInputTokens / 1_000_000) * 3 + (totalOutputTokens / 1_000_000) * 15;
      return {
        vendorId: "anthropic",
        planName: "Pay-as-you-go",
        monthlySpendUsd: Math.round(estimatedCost * 100) / 100,
        source: "billing_api",
      };
    }

    // Fallback: verify key is valid
    const validRes = await fetch("https://api.anthropic.com/v1/models", {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    });
    if (!validRes.ok) return null;

    return {
      vendorId: "anthropic",
      planName: "Pay-as-you-go",
      monthlySpendUsd: 0,
      source: "billing_api",
    };
  } catch {
    return null;
  }
}

// ─── Stripe ───────────────────────────────────────────────────────────────────
async function fetchStripe(key: string): Promise<BillingResult | null> {
  try {
    const startOfMonth = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);

    // Try balance_transactions first (requires Balance: Read)
    const balanceRes = await fetch(
      `https://api.stripe.com/v1/balance_transactions?type=charge&limit=100&created[gte]=${startOfMonth}`,
      { headers: { Authorization: `Bearer ${key}` } }
    );

    if (balanceRes.ok) {
      const data = await balanceRes.json();
      const totalVolume = (data.data ?? []).reduce((sum: number, tx: { amount: number }) => sum + tx.amount, 0) / 100;
      const txCount = data.data?.length ?? 0;
      const estimatedFees = totalVolume * 0.029 + txCount * 0.30;
      return {
        vendorId: "stripe",
        planName: "Standard",
        monthlySpendUsd: Math.round(estimatedFees * 100) / 100,
        usageIncluded: Math.round(totalVolume),
        unit: "$ volume processed",
        source: "billing_api",
      };
    }

    // Fallback: charges endpoint (requires Charges: Read only)
    const chargesRes = await fetch(
      `https://api.stripe.com/v1/charges?limit=100&created[gte]=${startOfMonth}`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
    if (!chargesRes.ok) return null;

    const chargesData = await chargesRes.json();
    const charges = (chargesData.data ?? []).filter((c: { paid: boolean }) => c.paid);
    const totalVolume = charges.reduce((sum: number, c: { amount: number }) => sum + c.amount, 0) / 100;
    const estimatedFees = totalVolume * 0.029 + charges.length * 0.30;

    return {
      vendorId: "stripe",
      planName: "Standard",
      monthlySpendUsd: Math.round(estimatedFees * 100) / 100,
      usageIncluded: Math.round(totalVolume),
      unit: "$ volume processed",
      source: "billing_api",
    };
  } catch {
    return null;
  }
}

// ─── Twilio ───────────────────────────────────────────────────────────────────
// Twilio key format: ACCOUNT_SID:AUTH_TOKEN — we detect the SID (AC...) via pattern
async function fetchTwilio(key: string): Promise<BillingResult | null> {
  try {
    // key may be "ACxxx:authtoken" or just the account SID
    const [accountSid, authToken] = key.includes(":") ? key.split(":") : [key, ""];
    if (!authToken) return null;

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Usage/Records/ThisMonth.json?Category=totalprice`,
      { headers: { Authorization: `Basic ${credentials}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();

    const record = data.usage_records?.[0];
    const spend = record ? parseFloat(record.price ?? "0") : 0;

    return {
      vendorId: "twilio",
      planName: "Pay-as-you-go",
      monthlySpendUsd: Math.round(spend * 100) / 100,
      unit: "this month",
      source: "billing_api",
    };
  } catch {
    return null;
  }
}

// ─── SendGrid ─────────────────────────────────────────────────────────────────
async function fetchSendGrid(key: string): Promise<BillingResult | null> {
  try {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const endDate = now.toISOString().split("T")[0];

    const res = await fetch(
      `https://api.sendgrid.com/v3/stats?start_date=${startDate}&end_date=${endDate}&aggregated_by=month`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();

    const totalRequests = data[0]?.stats?.[0]?.metrics?.requests ?? 0;

    return {
      vendorId: "sendgrid",
      planName: "Pay-as-you-go",
      monthlySpendUsd: 0, // SendGrid free tier, actual cost requires plan lookup
      usageIncluded: totalRequests,
      unit: "emails this month",
      source: "billing_api",
    };
  } catch {
    return null;
  }
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

const BILLING_FETCHERS: Record<string, (key: string) => Promise<BillingResult | null>> = {
  openai:    fetchOpenAI,
  anthropic: fetchAnthropic,
  stripe:    fetchStripe,
  twilio:    fetchTwilio,
  sendgrid:  fetchSendGrid,
};

export async function fetchBillingForKeys(
  rawKeys: Array<{ vendorId: string; value: string }>
): Promise<BillingResult[]> {
  // Deduplicate — use first key found per vendor
  const byVendor = new Map<string, string>();
  for (const { vendorId, value } of rawKeys) {
    if (!byVendor.has(vendorId) && BILLING_FETCHERS[vendorId]) {
      byVendor.set(vendorId, value);
    }
  }

  const results = await Promise.all(
    [...byVendor.entries()].map(([vendorId, key]) => BILLING_FETCHERS[vendorId](key))
  );

  return results.filter((r): r is BillingResult => r !== null);
}
