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
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0ece4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ece4;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#faf8f4;border:1px solid #d6cfc4;border-radius:16px;overflow:hidden;">

        <!-- Header bar -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a56db 0%,#0ea47a 100%);padding:24px 32px;">
            <span style="font-weight:900;font-size:22px;color:#ffffff;letter-spacing:-0.03em;">Gauge</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 32px 28px;">
            <h1 style="margin:0 0 6px;font-size:26px;font-weight:800;color:#1a1208;letter-spacing:-0.02em;">
              You're on the list!
            </h1>
            <p style="margin:0 0 20px;font-size:13px;font-weight:600;color:#0ea47a;text-transform:uppercase;letter-spacing:0.06em;">
              Private beta · Gauge
            </p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#4a3f2f;">
              Thanks for signing up! I'm building Gauge to give developers a clear view of what they're actually spending across every API: OpenAI, Stripe, Twilio, AWS, and more.
            </p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#4a3f2f;">
              No more digging through five different dashboards. Connect your keys, see your spend, and find out exactly where you can cut costs!
            </p>
            <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#4a3f2f;">
              I'll reach out personally when your spot is ready. Early users get to shape the product directly. In the meantime, reply to this email with any vendors you want prioritized!
            </p>

            <!-- Divider -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td style="border-top:1px solid #d6cfc4;font-size:0;">&nbsp;</td></tr>
            </table>

            <!-- What to expect -->
            <p style="margin:0 0 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#8a7255;">
              What Gauge tracks
            </p>
            <table cellpadding="0" cellspacing="0" style="width:100%;">
              ${["OpenAI · Anthropic · Groq", "Stripe · Twilio · Resend", "AWS · Vercel · and more"].map(row => `
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#4a3f2f;">
                  <span style="display:inline-block;width:6px;height:6px;background:linear-gradient(135deg,#1a56db,#0ea47a);border-radius:50%;margin-right:10px;vertical-align:middle;"></span>
                  ${row}
                </td>
              </tr>`).join("")}
            </table>

            <p style="margin:28px 0 0;font-size:15px;color:#4a3f2f;">— Adam</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#ede9e0;border-top:1px solid #d6cfc4;padding:16px 32px;">
            <p style="margin:0;font-size:12px;color:#8a7255;line-height:1.6;">
              You signed up at <a href="https://getgauge.dev" style="color:#1a56db;text-decoration:none;">getgauge.dev</a>.
              Reply to this email with any questions. I read every one.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
    }).catch(() => {
      // Don't fail the request if email sending fails
    });
  }

  return NextResponse.json({ ok: true });
}
