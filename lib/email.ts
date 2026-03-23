import { Resend } from 'resend';
import type { OrderDetail } from '@/types';

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM   = 'MIDILLA <orders@midilla.com>';

function formatDeliveryTime(iso: string, timezone = 'Africa/Lagos'): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
    timeZone: timezone, timeZoneName: 'short',
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

function emailShell(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<style>
body{margin:0;padding:0;background:#0A0B0F;font-family:Georgia,'Times New Roman',serif;}
.wrap{max-width:600px;margin:0 auto;padding:0;}
.header{background:#0A0B0F;border-top:3px solid #4ADE80;padding:28px 36px 24px;border-bottom:1px solid #232838;}
.wordmark{font-family:Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.06em;color:#F8FAFC;text-transform:uppercase;}
.body{background:#12151C;padding:32px 36px;border:1px solid #232838;border-top:none;}
.footer{background:#0A0B0F;padding:16px 36px;border-top:1px solid #232838;}
.footer-text{font-family:Arial,sans-serif;font-size:10px;color:#4A5568;letter-spacing:0.06em;}
p{font-size:14px;color:#8892A4;line-height:1.85;margin:0 0 14px;}
.receipt{background:#1A1E28;border:1px solid #232838;margin:20px 0;}
.receipt-row{display:flex;justify-content:space-between;padding:9px 14px;border-bottom:1px solid #232838;}
.receipt-row:last-child{border-bottom:none;}
.receipt-label{font-family:Arial,sans-serif;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:#4A5568;}
.receipt-val{font-family:'Courier New',monospace;font-size:10px;color:#8892A4;}
.receipt-val.green{color:#4ADE80;}
.receipt-val.amber{color:#FBB040;}
.btn{display:inline-block;background:#4ADE80;color:#0A0B0F;font-family:Arial,sans-serif;font-size:12px;font-weight:700;padding:12px 24px;text-decoration:none;margin-top:8px;}
.btn.ghost{background:transparent;border:1px solid #232838;color:#8892A4;}
.mono{font-family:'Courier New',monospace;font-size:12px;color:#E2E8F0;}
</style>
</head>
<body>
<div class="wrap">
<div class="header"><div class="wordmark">MIDILLA</div></div>
<div class="body">${body}</div>
<div class="footer"><div class="footer-text">MIDILLA · Production System · midilla.com</div></div>
</div>
</body>
</html>`;
}

export async function sendE01(order: OrderDetail): Promise<void> {
  const deliveryTime = formatDeliveryTime(order.delivery_scheduled_at!);
  const deliveryDate = formatDate(order.delivery_scheduled_at!);
  const subject = `Order Confirmed — ${order.order_number}`;
  const preheader = `${order.output_type_name} · ${order.configuration_label} · Delivers at ${deliveryTime}`;
  const html = emailShell(`
    <p>Your order has been received and confirmed.</p>
    <div class="receipt">
      <div class="receipt-row"><span class="receipt-label">Order Reference</span><span class="receipt-val">${order.order_number}</span></div>
      <div class="receipt-row"><span class="receipt-label">Output Type</span><span class="receipt-val">${order.output_type_name}</span></div>
      <div class="receipt-row"><span class="receipt-label">Configuration</span><span class="receipt-val">${order.configuration_label}</span></div>
      <div class="receipt-row"><span class="receipt-label">Credits Used</span><span class="receipt-val">${order.credits_used} credits</span></div>
      <div class="receipt-row"><span class="receipt-label">Confirmed Delivery</span><span class="receipt-val amber">${deliveryTime} · ${deliveryDate}</span></div>
      <div class="receipt-row"><span class="receipt-label">Production Standard</span><span class="receipt-val">${order.production_bible}</span></div>
    </div>
    <p>Your delivery timer is active on the platform. The system is running. Nothing is required from you.</p>
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/order/${order.id}" class="btn">View Order Status →</a>
  `);
  await resend.emails.send({ from: FROM, to: order.user_email, subject, html, headers: { 'X-Preheader': preheader } });
}

export async function sendE02(order: OrderDetail): Promise<void> {
  const deliveryTime = formatDeliveryTime(order.delivery_scheduled_at!);
  const deliveryDate = formatDate(order.delivery_scheduled_at!);
  const subject = `${order.order_number} — In Production`;
  const preheader = `Delivers at ${deliveryTime} · Still on schedule`;
  const html = emailShell(`
    <p>Your ${order.output_type_name.toLowerCase()} is in production.</p>
    <div class="receipt">
      <div class="receipt-row"><span class="receipt-label">Order</span><span class="receipt-val">${order.order_number}</span></div>
      <div class="receipt-row"><span class="receipt-label">Status</span><span class="receipt-val amber">In Production</span></div>
      <div class="receipt-row"><span class="receipt-label">Delivery</span><span class="receipt-val amber">${deliveryTime} · ${deliveryDate}</span></div>
    </div>
    <p>The delivery time is confirmed: <span class="mono">${deliveryTime}</span>. Nothing has changed. Nothing is required from you.</p>
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/order/${order.id}" class="btn">View Delivery Timer →</a>
  `);
  await resend.emails.send({ from: FROM, to: order.user_email, subject, html, headers: { 'X-Preheader': preheader } });
}

export async function sendE03(order: OrderDetail, attachmentBuffer: Buffer): Promise<void> {
  const subject = 'Delivered.';
  const preheader = `${order.order_number} · ${order.output_type_name} · ${order.configuration_label} · Attached`;
  const deliveredAt = formatDeliveryTime(order.delivered_at!);
  const deliveredDate = formatDate(order.delivered_at!);
  const ext = order.delivery_filename?.split('.').pop()?.toLowerCase() ?? 'pdf';
  const mimeType = ext === 'pdf' ? 'application/pdf'
    : ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : 'application/octet-stream';
  const html = emailShell(`
    <p>Your ${order.output_type_name.toLowerCase()} is attached.</p>
    <div class="receipt">
      <div class="receipt-row"><span class="receipt-label">Order Reference</span><span class="receipt-val">${order.order_number}</span></div>
      <div class="receipt-row"><span class="receipt-label">Output Type</span><span class="receipt-val">${order.output_type_name}</span></div>
      <div class="receipt-row"><span class="receipt-label">Configuration</span><span class="receipt-val">${order.configuration_label}</span></div>
      ${order.actual_word_count ? `<div class="receipt-row"><span class="receipt-label">Actual Word Count</span><span class="receipt-val green">${order.actual_word_count.toLocaleString()} words</span></div>` : ''}
      <div class="receipt-row"><span class="receipt-label">Production Standard</span><span class="receipt-val">${order.production_bible}</span></div>
      <div class="receipt-row"><span class="receipt-label">Delivery Timestamp</span><span class="receipt-val green">${deliveredAt} · ${deliveredDate}</span></div>
      <div class="receipt-row"><span class="receipt-label">Attachment</span><span class="receipt-val">${order.delivery_filename}</span></div>
    </div>
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/order/${order.id}/download" class="btn">Download Document →</a>
  `);
  await resend.emails.send({
    from: FROM, to: order.user_email, subject, html,
    headers: { 'X-Preheader': preheader },
    attachments: [{ filename: order.delivery_filename!, content: attachmentBuffer, content_type: mimeType }],
  });
}

export async function sendE04(order: OrderDetail, creditBalance: number): Promise<void> {
  const daysSinceDelivery = Math.floor((Date.now() - new Date(order.delivered_at!).getTime()) / (1000 * 60 * 60 * 24));
  const subject = `${order.order_number} — Follow-Through`;
  const preheader = `Your ${order.output_type_name.toLowerCase()} was delivered ${daysSinceDelivery} days ago.`;
  const html = emailShell(`
    <p>Your ${order.output_type_name.toLowerCase()} was delivered ${daysSinceDelivery} days ago. Order ${order.order_number}.</p>
    <p>If you have deployed the document and are ready to place a second order, the system is available. Your credit balance is <span class="mono">${creditBalance} credits</span>.</p>
    <p>If you have a question about the delivery — a specific element you want to adjust or a format question — contact support with your order reference and a description of what you need.</p>
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/order/new" class="btn ghost">Place Next Order →</a>
  `);
  await resend.emails.send({ from: FROM, to: order.user_email, subject, html, headers: { 'X-Preheader': preheader } });
}
