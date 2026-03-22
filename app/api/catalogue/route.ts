import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { data: outputTypes, error } = await supabaseAdmin
    .from('output_types')
    .select(`
      id, slug, name, bible_reference,
      output_configurations (
        id, label, credit_cost,
        word_count, email_count, delivery_hours, sort_order
      )
    `)
    .order('slug');

  if (error) {
    return NextResponse.json({ error: 'Could not load catalogue' }, { status: 500 });
  }

  const catalogue = outputTypes?.map(ot => ({
    ...ot,
    output_configurations: [...(ot.output_configurations ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order
    ),
  }));

  return NextResponse.json({ catalogue });
}
