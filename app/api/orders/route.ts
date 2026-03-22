import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import type { Database, CreateOrderRequest } from '@/types';

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const body: CreateOrderRequest = await request.json();
  const { configuration_id, brief } = body;

  if (!configuration_id || !brief) {
    return NextResponse.json({ error: 'configuration_id and brief are required' }, { status: 400 });
  }

  const { data: config, error: configError } = await supabaseAdmin
    .from('output_configurations')
    .select('id, output_type_id, credit_cost, delivery_hours, word_count, email_count')
    .eq('id', configuration_id)
    .single();

  if (configError || !config) {
    return NextResponse.json({ error: 'Invalid configuration_id' }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('credit_balance, tier_id')
    .eq('id', session.user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  if (profile.credit_balance < config.credit_cost) {
    return NextResponse.json({
      error: 'Insufficient credits',
      balance: profile.credit_balance,
      required: config.credit_cost,
    }, { status: 422 });
  }

  const { data: outputType } = await supabaseAdmin
    .from('output_types')
    .select('bible_reference')
    .eq('id', config.output_type_id)
    .single();

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .insert({
      user_id:          session.user.id,
      output_type_id:   config.output_type_id,
      configuration_id: config.id,
      status:           'pending',
      credits_used:     config.credit_cost,
      brief,
      production_bible: outputType?.bible_reference ?? null,
      order_number:     'PENDING',
    })
    .select()
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: 'Order could not be created' }, { status: 500 });
  }

  return NextResponse.json({ order, credits_remaining: profile.credit_balance }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page  = parseInt(searchParams.get('page')  ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const from  = (page - 1) * limit;

  const { data: orders, error, count } = await supabaseAdmin
    .from('order_detail')
    .select('*', { count: 'exact' })
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (error) {
    return NextResponse.json({ error: 'Could not retrieve orders' }, { status: 500 });
  }

  return NextResponse.json({ orders, total: count ?? 0 });
}
