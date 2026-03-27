import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { email, source } = body;

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const normalized = email.trim().toLowerCase();

  // Upsert so duplicate submissions don't error
  try {
    await db.waitlist.upsert({
      where: { email: normalized },
      update: {},
      create: { email: normalized, source: typeof source === "string" ? source : "landing" },
    });
  } catch (err) {
    console.error("[waitlist] db error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  // Send thank you email
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "Adam at Gauge <adam@getgauge.dev>",
      to: normalized,
      subject: "You're on the Gauge waitlist",
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px; color: #0f172a;">
          <div style="font-weight: 800; font-size: 20px; margin-bottom: 24px; background: linear-gradient(135deg, #1a56db, #0ea47a); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
            Gauge
          </div>
          <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 12px;">You're on the list.</h1>
          <p style="color: #475569; line-height: 1.6; margin-bottom: 16px;">
            Thanks for signing up for Gauge — I'm building a tool that connects to your APIs (OpenAI, Stripe, Twilio, AWS) and shows you exactly what you're spending, where you're wasting money, and what cheaper alternatives exist.
          </p>
          <p style="color: #475569; line-height: 1.6; margin-bottom: 16px;">
            I'm in active development and will reach out personally when your spot is ready. Early access users get to shape the product.
          </p>
          <p style="color: #475569; line-height: 1.6; margin-bottom: 32px;">
            — Adam
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin-bottom: 24px;" />
          <p style="color: #94a3b8; font-size: 13px;">
            You signed up at getgauge.dev. Reply to this email with any questions.
          </p>
        </div>
      `,
    }).catch(() => {
      // Don't fail the request if email sending fails
    });
  }

  return NextResponse.json({ ok: true });
}
