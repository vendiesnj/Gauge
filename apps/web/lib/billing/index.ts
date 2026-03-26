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
export async function fetchOpenAI(key: string): Promise<BillingResult | null> {
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

    // 1. Try invoices — most reliable source of actual charges
    const invoicesRes = await fetch(
      `https://api.vercel.com/v2/payment/invoices${teamParam}`,
      { headers }
    );
    console.log("[vercel billing] invoices status:", invoicesRes.status);
    if (invoicesRes.ok) {
      const invoicesData = await invoicesRes.json();
      console.log("[vercel billing] invoices body:", JSON.stringify(invoicesData).slice(0, 500));
      const invoices: Array<{ total: number; period?: { start: number; end: number }; state?: string }> =
        invoicesData.invoices ?? invoicesData ?? [];
      const latest = invoices.find((inv) => inv.state !== "draft") ?? invoices[0];
      if (latest && latest.total > 0) {
        return {
          vendorId: "vercel",
          planName: "Vercel Pro",
          monthlySpendUsd: Math.round(latest.total * 100) / 100,
          source: "billing_api",
        };
      }
    } else {
      const errBody = await invoicesRes.text();
      console.log("[vercel billing] invoices error:", errBody.slice(0, 300));
    }

    // 2. Try /v2/billing — sometimes has period totals
    const billingRes = await fetch(
      `https://api.vercel.com/v2/billing${teamParam}`,
      { headers }
    );
    console.log("[vercel billing] billing status:", billingRes.status);
    if (billingRes.ok) {
      const data = await billingRes.json();
      console.log("[vercel billing] billing body:", JSON.stringify(data).slice(0, 500));
      const spend =
        data.billing?.period?.total ??
        data.period?.total ??
        data.total ??
        0;
      if (spend > 0) {
        return {
          vendorId: "vercel",
          planName: "Vercel Pro",
          monthlySpendUsd: Math.round(Number(spend) * 100) / 100,
          source: "billing_api",
        };
      }
    } else {
      const errBody = await billingRes.text();
      console.log("[vercel billing] billing error:", errBody.slice(0, 300));
    }

    // 3. Fall back to plan name from team/user info
    const teamRes = teamId
      ? await fetch(`https://api.vercel.com/v2/teams/${teamId}`, { headers })
      : await fetch("https://api.vercel.com/v2/user", { headers });
    console.log("[vercel billing] team/user status:", teamRes.status);
    if (teamRes.ok) {
      const teamData = await teamRes.json();
      console.log("[vercel billing] team/user body:", JSON.stringify(teamData).slice(0, 300));
      const plan: string = teamData.plan ?? teamData.user?.defaultTeamId ?? "pro";
      return {
        vendorId: "vercel",
        planName: `Vercel ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
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
