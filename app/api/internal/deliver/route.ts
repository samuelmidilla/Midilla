import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendE02, sendE03 } from '@/lib/email';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-midilla-internal');
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData       = await request.formData();
  const orderId        = formData.get('order_id') as string;
  const file           = formData.get('document') as File;
  const wordCountRaw   = formData.get('actual_word_count');
  const actualWordCount = wordCountRaw ? parseInt(wordCountRaw as string) : null;

  if (!orderId || !file) {
    return NextResponse.json({ error: 'order_id and document are required' }, { status: 400 });
  }

  const { data: order } = await supabaseAdmin
    .from('order_detail')
    .select('*')
    .eq('id', orderId)
    .single();

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (!['confirmed', 'in_production'].includes(order.status)) {
    return NextResponse.json(
      { error: `Order is in status "${order.status}" — cannot deliver` },
      { status: 422 }
    );
  }

  if (order.status === 'confirmed') {
    await supabaseAdmin.rpc('start_production', { p_order_id: orderId });
    await sendE02(order);
  }

  const ext      = file.name.split('.').pop()?.toLowerCase() ?? 'pdf';
  const typePart = order.output_type_name.replace(/\s+/g, '');
  const filename = `MIDILLA_${order.order_number}_${typePart}.${ext}`;

  const bytes  = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const mimeType = ext === 'pdf' ? 'application/pdf'
    : ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : 'application/octet-stream';

  const storagePath = `orders/${orderId}/${filename}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from('deliverables')
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: 'Storage upload failed' }, { status: 500 });
  }

  const { data: delivered, error: deliverError } = await supabaseAdmin
    .rpc('deliver_order', {
      p_order_id:          orderId,
      p_delivery_filename: filename,
      p_actual_word_count: actualWordCount,
    });

  if (deliverError) {
    return NextResponse.json({ error: deliverError.message }, { status: 422 });
  }

  const { data: deliveredOrder } = await supabaseAdmin
    .from('order_detail')
    .select('*')
    .eq('id', orderId)
    .single();

  await sendE03(deliveredOrder!, buffer);

  await supabaseAdmin
    .from('scheduled_emails')
    .insert({
      order_id:   orderId,
      type:       'e04',
      send_after: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      sent:       false,
    });

  return NextResponse.json({
    delivered: true,
    order_number: deliveredOrder!.order_number,
    delivery_filename: filename,
    delivered_at: deliveredOrder!.delivered_at,
  });
}
