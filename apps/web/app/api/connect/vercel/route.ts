import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId)
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });

  const randomHex = crypto.randomBytes(16).toString("hex");
  const state = `${projectId}:${randomHex}`;

  const jar = await cookies();
  jar.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const params = new URLSearchParams({
    client_id: process.env.VERCEL_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_URL}/api/connect/vercel/callback`,
    state,
  });

  return NextResponse.redirect(
    `https://vercel.com/integrations/${process.env.VERCEL_INTEGRATION_SLUG}/new?${params.toString()}`
  );
}
