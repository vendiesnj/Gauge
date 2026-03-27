import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const revalidate = 300; // cache 5 minutes

export async function GET() {
  const [waitlistCount, vendorRequestRows, connectionCount] = await Promise.all([
    db.waitlist.count(),
    db.vendorRequest.groupBy({
      by: ["vendorId"],
      _count: { vendorId: true },
      orderBy: { _count: { vendorId: "desc" } },
      take: 5,
    }),
    db.vendorConnection.count(),
  ]);

  const VENDOR_NAMES: Record<string, string> = {
    openai: "OpenAI", anthropic: "Anthropic", stripe: "Stripe",
    twilio: "Twilio", aws: "AWS", resend: "Resend", groq: "Groq",
    vercel: "Vercel", supabase: "Supabase", datadog: "Datadog",
    sendgrid: "SendGrid", cloudflare: "Cloudflare",
  };

  const totalVendorRequests = vendorRequestRows.reduce((s, r) => s + r._count.vendorId, 0);

  return NextResponse.json({
    waitlistCount,
    totalVendorRequests,
    connectionCount,
    topRequestedVendors: vendorRequestRows.map((r) => ({
      vendorId: r.vendorId,
      name: VENDOR_NAMES[r.vendorId] ?? r.vendorId,
      count: r._count.vendorId,
    })),
  });
}
