import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const secret = request.headers.get('authorization');
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date().toISOString();

  const { data: overdueOrders } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, delivery_scheduled_at, user_id')
    .eq('status', 'in_production')
    .lt('delivery_scheduled_at', now);

  if (!overdueOrders?.length) {
    return NextResponse.json({ checked: true, overdue: 0 });
  }

  for (const order of overdueOrders) {
    const minutesLate = Math.floor(
      (Date.now() - new Date(order.delivery_scheduled_at!).getTime()) / 60000
    );

    console.warn(`[overdue] ${order.order_number} is ${minutesLate} minutes past delivery window`);

    if (minutesLate > 30) {
      await supabaseAdmin
        .from('orders')
        .update({
          delivery_scheduled_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        })
        .eq('id', order.id);
    }
  }

  return NextResponse.json({ checked: true, overdue: overdueOrders.length });
}
