import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jar = await cookies();
  const savedState = jar.get("oauth_state")?.value;
  const returnedState = req.nextUrl.searchParams.get("state");
  const code = req.nextUrl.searchParams.get("code");

  if (!savedState || savedState !== returnedState)
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });

  const projectId = savedState.split(":")[0];

  jar.delete("oauth_state");

  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { org: { include: { memberships: { where: { userId: session.user.id } } } } },
  });
  if (!project || project.org.memberships.length === 0)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const redirectUri = `${process.env.NEXT_PUBLIC_URL}/api/connect/google/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: code!,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok)
    return NextResponse.json({ error: "Token exchange failed" }, { status: 502 });

  const tokenData = await tokenRes.json();
  const accessToken: string = tokenData.access_token;
  const refreshToken: string | undefined = tokenData.refresh_token;
  const tokenExpiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000)
    : null;

  // Fetch GCP projects
  const projectsRes = await fetch(
    "https://cloudresourcemanager.googleapis.com/v1/projects?filter=lifecycleState:ACTIVE",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const projectsData = projectsRes.ok ? await projectsRes.json() : {};
  const gcpProjects = (projectsData.projects ?? []).map((p: { projectId: string; name: string }) => ({
    projectId: p.projectId,
    name: p.name,
  }));

  await db.vendorConnection.upsert({
    where: { orgId_vendorId: { orgId: project.orgId, vendorId: "google" } },
    update: {
      accessToken,
      refreshToken: refreshToken ?? null,
      tokenExpiresAt,
      metadata: { gcpProjects },
    },
    create: {
      orgId: project.orgId,
      vendorId: "google",
      accessToken,
      refreshToken: refreshToken ?? null,
      tokenExpiresAt,
      metadata: { gcpProjects },
    },
  });

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_URL}/projects/${projectId}?connected=google`
  );
}
