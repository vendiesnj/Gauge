import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchOpenAI } from "@/lib/billing";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    adminKey: string;
    openaiProjectId: string;
    gaugeProjectId: string;
  };

  const { adminKey, openaiProjectId, gaugeProjectId } = body;

  if (!adminKey || !openaiProjectId || !gaugeProjectId)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const project = await db.project.findUnique({
    where: { id: gaugeProjectId },
    include: { org: { include: { memberships: { where: { userId: session.user.id } } } } },
  });
  if (!project || project.org.memberships.length === 0)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const saRes = await fetch(
    `https://api.openai.com/v1/organization/projects/${openaiProjectId}/service_accounts`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "gauge-billing-reader" }),
    }
  );

  if (!saRes.ok) {
    const err = await saRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: err.error?.message ?? "Failed to create service account" },
      { status: saRes.status }
    );
  }

  const saData = await saRes.json();
  const serviceAccountKey: string = saData.api_key?.value;

  if (!serviceAccountKey)
    return NextResponse.json({ error: "No key returned from OpenAI" }, { status: 502 });

  await db.vendorConnection.upsert({
    where: { orgId_vendorId: { orgId: project.orgId, vendorId: "openai" } },
    update: {
      accessToken: serviceAccountKey,
      metadata: { openaiProjectId },
    },
    create: {
      orgId: project.orgId,
      vendorId: "openai",
      accessToken: serviceAccountKey,
      metadata: { openaiProjectId },
    },
  });

  // Use admin key (before it's discarded) to fetch usage data — service account keys lack usage.read
  const billing = await fetchOpenAI(adminKey);
  if (billing) {
    await db.vendorPlan.upsert({
      where: { projectId_vendorId: { projectId: gaugeProjectId, vendorId: "openai" } },
      update: { planName: billing.planName, monthlySpendUsd: billing.monthlySpendUsd, source: "billing_api" },
      create: { projectId: gaugeProjectId, vendorId: "openai", planName: billing.planName, monthlySpendUsd: billing.monthlySpendUsd, source: "billing_api" },
    });
  }

  return NextResponse.json({ connected: true, monthlySpendUsd: billing?.monthlySpendUsd ?? 0 });
}
