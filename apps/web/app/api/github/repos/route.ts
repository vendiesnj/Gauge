import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await db.account.findFirst({
    where: { userId: session.user.id, provider: "github" },
    select: { access_token: true },
  });

  if (!account?.access_token)
    return NextResponse.json({ error: "No GitHub token found" }, { status: 400 });

  const res = await fetch(
    "https://api.github.com/user/repos?sort=updated&per_page=100&type=all",
    {
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (!res.ok)
    return NextResponse.json({ error: "GitHub API error" }, { status: 502 });

  const repos = await res.json();

  return NextResponse.json({
    repos: repos.map((r: { id: number; full_name: string; name: string; owner: { login: string }; private: boolean; description: string | null; pushed_at: string }) => ({
      id: r.id,
      fullName: r.full_name,
      name: r.name,
      owner: r.owner.login,
      private: r.private,
      description: r.description,
      pushedAt: r.pushed_at,
    })),
  });
}
