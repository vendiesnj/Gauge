import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchOpenAI } from "@/lib/billing";
import { encrypt } from "@/lib/crypto";

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

  // Validate the key works before storing it
  const billing = await fetchOpenAI(adminKey);
  if (billing === null)
    return NextResponse.json({ error: "Invalid key or insufficient permissions" }, { status: 400 });

  await db.vendorConnection.upsert({
    where: { orgId_vendorId: { orgId: project.orgId, vendorId: "openai" } },
    update: {
      accessToken: adminKey,
      encryptedAdminKey: process.env.ENCRYPTION_KEY ? encrypt(adminKey) : null,
      metadata: { openaiProjectId },
    },
    create: {
      orgId: project.orgId,
      vendorId: "openai",
      accessToken: adminKey,
      encryptedAdminKey: process.env.ENCRYPTION_KEY ? encrypt(adminKey) : null,
      metadata: { openaiProjectId },
    },
  });

  await db.vendorPlan.upsert({
    where: { projectId_vendorId: { projectId: gaugeProjectId, vendorId: "openai" } },
    update: { planName: billing.planName, monthlySpendUsd: billing.monthlySpendUsd, source: "billing_api" },
    create: { projectId: gaugeProjectId, vendorId: "openai", planName: billing.planName, monthlySpendUsd: billing.monthlySpendUsd, source: "billing_api" },
  });

  return NextResponse.json({ connected: true, monthlySpendUsd: billing.monthlySpendUsd });
}
