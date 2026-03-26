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
// Uses the organization costs API for actual dollar amounts (requires admin key with usage.read)
export async function fetchOpenAI(key: string): Promise<BillingResult | null> {
  try {
    const now = new Date();
    const startOfMonth = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
    const headers = { Authorization: `Bearer ${key}` };

    // Try the costs API — returns actual USD amounts, not token counts
    const costsRes = await fetch(
      `https://api.openai.com/v1/organization/costs?start_time=${startOfMonth}&bucket_width=1d&limit=31`,
      { headers }
    );

    if (costsRes.ok) {
      const data = await costsRes.json();
      let totalCost = 0;
      for (const bucket of data.data ?? []) {
        for (const result of bucket.results ?? []) {
          totalCost += result.amount?.value ?? 0;
        }
      }
      return {
        vendorId: "openai",
        planName: "Pay-as-you-go",
        monthlySpendUsd: Math.round(totalCost * 100) / 100,
        source: "billing_api",
      };
    }

    // Costs API failed — fall back to usage API with per-model pricing
    const usageRes = await fetch(
      `https://api.openai.com/v1/organization/usage/completions?start_time=${startOfMonth}&limit=100`,
      { headers }
    );

    if (usageRes.ok) {
      const data = await usageRes.json();
      // Per-model pricing ($/1M tokens) — input, output
      const MODEL_PRICING: Record<string, [number, number]> = {
        "gpt-4o":                [2.50,  10.00],
        "gpt-4o-mini":           [0.15,   0.60],
        "gpt-4-turbo":           [10.00, 30.00],
        "gpt-4":                 [30.00, 60.00],
        "o1":                    [15.00, 60.00],
        "o1-mini":               [3.00,  12.00],
        "o3-mini":               [1.10,   4.40],
        "gpt-3.5-turbo":         [0.50,   1.50],
      };
      let totalCost = 0;
      for (const item of data.data ?? []) {
        const model: string = item.model ?? "";
        const modelKey = Object.keys(MODEL_PRICING).find((k) => model.startsWith(k)) ?? "gpt-4o";
        const [inputRate, outputRate] = MODEL_PRICING[modelKey];
        totalCost +=
          ((item.input_tokens ?? 0) / 1_000_000) * inputRate +
          ((item.output_tokens ?? 0) / 1_000_000) * outputRate;
      }
      return {
        vendorId: "openai",
        planName: "Pay-as-you-go",
        monthlySpendUsd: Math.round(totalCost * 100) / 100,
        source: "billing_api",
      };
    }

    // Key valid but no billing scope — return $0 so it shows as connected
    const validRes = await fetch("https://api.openai.com/v1/models?limit=1", { headers });
    if (!validRes.ok) return null;

    return { vendorId: "openai", planName: "Pay-as-you-go", monthlySpendUsd: 0, source: "billing_api" };
  } catch {
    return null;
  }
}

// ─── Anthropic ────────────────────────────────────────────────────────────────
export async function fetchAnthropic(key: string): Promise<BillingResult | null> {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const anthropicHeaders = { "x-api-key": key, "anthropic-version": "2023-06-01" };

    // Per-model pricing ($/1M tokens) — input, output
    const MODEL_PRICING: Record<string, [number, number]> = {
      "claude-opus-4":          [15.00,  75.00],
      "claude-sonnet-4":        [ 3.00,  15.00],
      "claude-3-5-sonnet":      [ 3.00,  15.00],
      "claude-3-5-haiku":       [ 0.80,   4.00],
      "claude-3-opus":          [15.00,  75.00],
      "claude-3-sonnet":        [ 3.00,  15.00],
      "claude-3-haiku":         [ 0.25,   1.25],
      "claude-2":               [ 8.00,  24.00],
    };

    const usageRes = await fetch(
      `https://api.anthropic.com/v1/organizations/usage?start_date=${startOfMonth}`,
      { headers: anthropicHeaders }
    );

    if (usageRes.ok) {
      const data = await usageRes.json();
      let totalCost = 0;
      for (const item of data.data ?? []) {
        const model: string = item.model ?? "";
        const modelKey = Object.keys(MODEL_PRICING).find((k) => model.startsWith(k)) ?? "claude-3-5-sonnet";
        const [inputRate, outputRate] = MODEL_PRICING[modelKey];
        totalCost +=
          ((item.input_tokens ?? 0) / 1_000_000) * inputRate +
          ((item.output_tokens ?? 0) / 1_000_000) * outputRate;
      }
      return {
        vendorId: "anthropic",
        planName: "Pay-as-you-go",
        monthlySpendUsd: Math.round(totalCost * 100) / 100,
        source: "billing_api",
      };
    }

    const validRes = await fetch("https://api.anthropic.com/v1/models", { headers: anthropicHeaders });
    if (!validRes.ok) return null;

    return { vendorId: "anthropic", planName: "Pay-as-you-go", monthlySpendUsd: 0, source: "billing_api" };
  } catch {
    return null;
  }
}

// ─── Stripe ───────────────────────────────────────────────────────────────────
async function fetchStripe(key: string): Promise<BillingResult | null> {
  try {
    const startOfMonth = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);

    // Try balance_transactions (requires Balance: Read)
    const balanceRes = await fetch(
      `https://api.stripe.com/v1/balance_transactions?type=charge&limit=100&created[gte]=${startOfMonth}`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
    if (balanceRes.status === 401) return null; // Key is invalid
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

    // Try charges endpoint (requires Charges: Read)
    const chargesRes = await fetch(
      `https://api.stripe.com/v1/charges?limit=100&created[gte]=${startOfMonth}`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
    if (chargesRes.status === 401) return null;
    if (chargesRes.ok) {
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
    }

    // Key is real (got 403/other, not 401) but lacks read permissions on both endpoints.
    // Still valid — show as connected at $0.
    return {
      vendorId: "stripe",
      planName: "Standard",
      monthlySpendUsd: 0,
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
  } catch (e) {
    console.error("[billing/stripe] exception:", e);
    return null;
  }
}

// ─── Stripe OAuth ─────────────────────────────────────────────────────────────
export async function fetchStripeOAuth(stripeAccountId: string): Promise<BillingResult | null> {
  try {
    const startOfMonth = Math.floor(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000
    );
    const platformKey = process.env.STRIPE_SECRET_KEY!;
    const headers = {
      Authorization: `Bearer ${platformKey}`,
      "Stripe-Account": stripeAccountId,
    };

    const balanceRes = await fetch(
      `https://api.stripe.com/v1/balance_transactions?type=charge&limit=100&created[gte]=${startOfMonth}`,
      { headers }
    );
    if (balanceRes.status === 401) return null;
    if (balanceRes.ok) {
      const data = await balanceRes.json();
      const totalVolume =
        (data.data ?? []).reduce((sum: number, tx: { amount: number }) => sum + tx.amount, 0) / 100;
      const txCount = data.data?.length ?? 0;
      const estimatedFees = totalVolume * 0.029 + txCount * 0.3;
      return {
        vendorId: "stripe",
        planName: "Standard",
        monthlySpendUsd: Math.round(estimatedFees * 100) / 100,
        usageIncluded: Math.round(totalVolume),
        unit: "$ volume processed",
        source: "billing_api",
      };
    }

    const chargesRes = await fetch(
      `https://api.stripe.com/v1/charges?limit=100&created[gte]=${startOfMonth}`,
      { headers }
    );
    if (chargesRes.status === 401) return null;
    if (chargesRes.ok) {
      const chargesData = await chargesRes.json();
      const charges = (chargesData.data ?? []).filter((c: { paid: boolean }) => c.paid);
      const totalVolume =
        charges.reduce((sum: number, c: { amount: number }) => sum + c.amount, 0) / 100;
      const estimatedFees = totalVolume * 0.029 + charges.length * 0.3;
      return {
        vendorId: "stripe",
        planName: "Standard",
        monthlySpendUsd: Math.round(estimatedFees * 100) / 100,
        usageIncluded: Math.round(totalVolume),
        unit: "$ volume processed",
        source: "billing_api",
      };
    }

    return {
      vendorId: "stripe",
      planName: "Standard",
      monthlySpendUsd: 0,
      source: "billing_api",
    };
  } catch {
    return null;
  }
}

// ─── Google Cloud OAuth ────────────────────────────────────────────────────────
export async function fetchGoogleBilling(
  accessToken: string,
  projectIds: string[]
): Promise<BillingResult | null> {
  try {
    // Verify at least one project's billing info is accessible; detailed spend
    // requires BigQuery export and is not available via REST API alone.
    if (projectIds.length > 0) {
      await fetch(
        `https://cloudbilling.googleapis.com/v1/projects/${projectIds[0]}/billingInfo`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
    }

    return {
      vendorId: "google",
      planName: "Google Cloud",
      monthlySpendUsd: 0,
      source: "billing_api",
    };
  } catch {
    return null;
  }
}

// ─── Vercel OAuth ──────────────────────────────────────────────────────────────
export async function fetchVercelBilling(
  accessToken: string,
  teamId: string | null
): Promise<BillingResult | null> {
  try {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const teamParam = teamId ? `?teamId=${teamId}` : "";

    // Vercel's integration OAuth API doesn't expose invoice totals.
    // Use v9 teams endpoint to get plan name at minimum.
    const v9Res = teamId
      ? await fetch(`https://api.vercel.com/v9/teams/${teamId}`, { headers })
      : await fetch("https://api.vercel.com/v2/user", { headers });

    if (v9Res.ok) {
      const data = await v9Res.json();
      const billing = data.billing ?? {};
      const rawPlan: string = billing.planIteration ?? billing.plan ?? data.plan ?? "pro";
      // planIteration "plus" = "Pro+", plain "pro" = "Pro", etc.
      const planLabel = rawPlan === "plus" ? "Pro+" : rawPlan.charAt(0).toUpperCase() + rawPlan.slice(1);
      return {
        vendorId: "vercel",
        planName: `Vercel ${planLabel}`,
        monthlySpendUsd: 0,
        source: "billing_api",
      };
    }

    return {
      vendorId: "vercel",
      planName: "Vercel",
      monthlySpendUsd: 0,
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

export async function fetchBillingFromConnections(
  connections: Array<{ vendorId: string; accessToken: string; metadata: Record<string, unknown> | null }>
): Promise<BillingResult[]> {
  const results = await Promise.all(
    connections.map((conn) => {
      const meta = (conn.metadata ?? {}) as Record<string, unknown>;
      switch (conn.vendorId) {
        case "stripe":
          return fetchStripeOAuth(conn.accessToken);
        case "google": {
          const gcpProjects = (meta.gcpProjects as Array<{ projectId: string }> | undefined) ?? [];
          return fetchGoogleBilling(conn.accessToken, gcpProjects.map((p) => p.projectId));
        }
        case "vercel":
          return fetchVercelBilling(conn.accessToken, (meta.teamId as string) ?? null);
        default:
          return Promise.resolve(null);
      }
    })
  );

  return results.filter((r): r is BillingResult => r !== null);
}
