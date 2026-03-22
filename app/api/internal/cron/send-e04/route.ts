import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendE04 } from '@/lib/email';

export async function GET(request: NextRequest) {
  const secret = request.headers.get('authorization');
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date().toISOString();

  const { data: pending } = await supabaseAdmin
    .from('scheduled_emails')
    .select('id, order_id')
    .eq('type', 'e04')
    .eq('sent', false)
    .lt('send_after', now)
    .limit(20);

  if (!pending?.length) {
    return NextResponse.json({ sent: 0 });
  }

  let sent = 0;
  for (const job of pending) {
    try {
      const { data: order } = await supabaseAdmin
        .from('order_detail')
        .select('*')
        .eq('id', job.order_id)
        .single();

      if (!order) continue;

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('credit_balance')
        .eq('id', order.user_id)
        .single();

      await sendE04(order, profile?.credit_balance ?? 0);

      await supabaseAdmin
        .from('scheduled_emails')
        .update({ sent: true, sent_at: new Date().toISOString() })
        .eq('id', job.id);

      sent++;
    } catch (err) {
      console.error('[e04-scheduler] Failed for order', job.order_id, err);
    }
  }

  return NextResponse.json({ sent });
}
