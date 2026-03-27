import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchAWS } from "@/lib/billing";
import { encrypt } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    accessKeyId: string;
    secretKey: string;
    gaugeProjectId: string;
  };

  const { accessKeyId, secretKey, gaugeProjectId } = body;
  if (!accessKeyId || !secretKey || !gaugeProjectId)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const project = await db.project.findUnique({
    where: { id: gaugeProjectId },
    include: { org: { include: { memberships: { where: { userId: session.user.id } } } } },
  });
  if (!project || project.org.memberships.length === 0)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const combinedKey = `${accessKeyId}:${secretKey}`;
  const billing = await fetchAWS(combinedKey);
  if (billing === null)
    return NextResponse.json({ error: "Could not connect — check credentials and try again" }, { status: 400 });

  await db.vendorConnection.upsert({
    where: { orgId_vendorId: { orgId: project.orgId, vendorId: "aws" } },
    update: {
      accessToken: accessKeyId,
      encryptedAdminKey: process.env.ENCRYPTION_KEY ? encrypt(combinedKey) : null,
    },
    create: {
      orgId: project.orgId,
      vendorId: "aws",
      accessToken: accessKeyId,
      encryptedAdminKey: process.env.ENCRYPTION_KEY ? encrypt(combinedKey) : null,
    },
  });

  await db.vendorPlan.upsert({
    where: { projectId_vendorId: { projectId: gaugeProjectId, vendorId: "aws" } },
    update: { planName: billing.planName, monthlySpendUsd: billing.monthlySpendUsd, source: "billing_api" },
    create: { projectId: gaugeProjectId, vendorId: "aws", planName: billing.planName, monthlySpendUsd: billing.monthlySpendUsd, source: "billing_api" },
  });

  return NextResponse.json({
    connected: true,
    monthlySpendUsd: billing.monthlySpendUsd,
    billingAccess: billing.billingAccess,
    verifyError: billing.verifyError,
  });
}
