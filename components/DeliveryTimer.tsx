'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { OrderDetail } from '@/types';

interface TimerState {
  hours:       number;
  minutes:     number;
  seconds:     number;
  progress:    number;
  isDelivered: boolean;
  isOverdue:   boolean;
}

interface DeliveryTimerProps {
  order:           OrderDetail;
  onDelivered?:    (order: OrderDetail) => void;
  pollIntervalMs?: number;
}

function pad(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Africa/Lagos', timeZoneName: 'short',
  });
}

function computeTimerState(order: OrderDetail): TimerState {
  const now         = Date.now();
  const confirmedAt = new Date(order.confirmed_at!).getTime();
  const deliverAt   = new Date(order.delivery_scheduled_at!).getTime();
  const totalMs     = deliverAt - confirmedAt;
  const remainingMs = deliverAt - now;
  const elapsedMs   = now - confirmedAt;

  const isDelivered = order.status === 'delivered';
  const isOverdue   = !isDelivered && remainingMs < 0;

  if (isDelivered) {
    return { hours: 0, minutes: 0, seconds: 0, progress: 1, isDelivered: true, isOverdue: false };
  }

  const progress = Math.min(elapsedMs / totalMs, 1);
  const remaining = Math.max(remainingMs, 0);

  return {
    hours:    remaining / 3600000,
    minutes:  (remaining % 3600000) / 60000,
    seconds:  (remaining % 60000) / 1000,
    progress, isDelivered: false, isOverdue,
  };
}

export default function DeliveryTimer({
  order: initialOrder, onDelivered, pollIntervalMs = 30000,
}: DeliveryTimerProps) {
  const [order, setOrder]               = useState<OrderDetail>(initialOrder);
  const [timer, setTimer]               = useState<TimerState>(() => computeTimerState(initialOrder));
  const [justDelivered, setJustDelivered] = useState(false);
  const tickRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const deliveredRef = useRef(false);

  useEffect(() => {
    tickRef.current = setInterval(() => setTimer(computeTimerState(order)), 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [order]);

  const poll = useCallback(async () => {
    if (deliveredRef.current) return;
    try {
      const res  = await fetch(`/api/orders/${order.id}`);
      const data = await res.json();
      if (!res.ok || !data.order) return;
      const updated: OrderDetail = data.order;
      setOrder(updated);
      if (updated.status === 'delivered' && !deliveredRef.current) {
        deliveredRef.current = true;
        setJustDelivered(true);
        setTimer({ hours: 0, minutes: 0, seconds: 0, progress: 1, isDelivered: true, isOverdue: false });
        if (pollRef.current) clearInterval(pollRef.current);
        if (tickRef.current) clearInterval(tickRef.current);
        onDelivered?.(updated);
      }
    } catch { /* silent retry */ }
  }, [order.id, onDelivered]);

  useEffect(() => {
    if (order.status === 'delivered') return;
    pollRef.current = setInterval(poll, pollIntervalMs);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [poll, pollIntervalMs, order.status]);

  const { hours, minutes, seconds, progress, isDelivered, isOverdue } = timer;
  const displayTime       = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  const deliveryClockTime = order.delivery_scheduled_at ? formatClockTime(order.delivery_scheduled_at) : null;
  const green  = '#4ADE80'; const amber = '#FBB040'; const red = '#F87171';
  const border = '#232838'; const s1 = '#12151C';   const s2 = '#1A1E28';
  const t2     = '#8892A4'; const t3  = '#4A5568';
  const accentColor = isDelivered ? green : isOverdue ? red : amber;
  const statusLabel = isDelivered ? 'DELIVERED.' : isOverdue ? 'DELAYED' : 'DELIVERING';

  return (
    <div style={{ background: s1, border: `1px solid ${border}`, borderTop: `2px solid ${accentColor}`, fontFamily: "'Syne', sans-serif", transition: 'border-top-color 1s ease', width: '100%' }}>
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: "'Inconsolata', monospace", fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: t3 }}>Production Timer</span>
        <span style={{ fontFamily: "'Inconsolata', monospace", fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, padding: '3px 10px', border: `1px solid ${accentColor}33`, color: accentColor, background: `${accentColor}11`, transition: 'all 1s ease' }}>
          {isDelivered ? '● Delivered.' : '● In Production'}
        </span>
      </div>
      <div style={{ padding: '28px 24px' }}>
        <span style={{ fontFamily: "'Inconsolata', monospace", fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: t3, display: 'block', marginBottom: '8px' }}>
          {order.output_type_name} · {order.configuration_label}
        </span>
        <div style={{ fontFamily: "'Inconsolata', monospace", fontSize: '12px', color: t2, marginBottom: '20px' }}>
          Order {order.order_number} · {order.production_bible}
        </div>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '52px', fontWeight: 800, letterSpacing: '-0.02em', color: accentColor, lineHeight: 1, marginBottom: '12px', transition: 'color 1s ease' }}>
          {displayTime}
        </div>
        <span style={{ fontFamily: "'Inconsolata', monospace", fontSize: '9px', letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: accentColor, display: 'block', marginBottom: '20px', transition: 'color 1s ease' }}>
          {statusLabel}
        </span>
        <div style={{ height: '3px', background: border, marginBottom: '20px', position: 'relative' as const, overflow: 'hidden' }}>
          <div style={{ position: 'absolute' as const, top: 0, left: 0, height: '100%', width: `${progress * 100}%`, background: accentColor, transition: 'width 1s linear, background 1s ease' }}/>
        </div>
        <div style={{ background: s2, border: `1px solid ${border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderBottom: `1px solid ${border}` }}>
            <span style={{ fontFamily: "'Inconsolata', monospace", fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: t3 }}>Production</span>
            <span style={{ fontFamily: "'Inconsolata', monospace", fontSize: '10px', color: t2 }}>{order.production_bible}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderBottom: `1px solid ${border}` }}>
            <span style={{ fontFamily: "'Inconsolata', monospace", fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: t3 }}>Credits</span>
            <span style={{ fontFamily: "'Inconsolata', monospace", fontSize: '10px', color: t2 }}>{order.credits_used} credits</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px' }}>
            <span style={{ fontFamily: "'Inconsolata', monospace", fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: t3 }}>{isDelivered ? 'Delivered at' : 'Delivers at'}</span>
            <span style={{ fontFamily: "'Inconsolata', monospace", fontSize: '10px', color: accentColor, transition: 'color 1s ease' }}>
              {isDelivered ? formatClockTime(order.delivered_at!) : deliveryClockTime ?? '—'}
            </span>
          </div>
        </div>
      </div>
      <div style={{ padding: '14px 20px', borderTop: `1px solid ${border}`, background: s2 }}>
        <span style={{ fontFamily: "'Inconsolata', monospace", fontSize: '9px', color: isDelivered ? green : t3, transition: 'color 1s ease' }}>
          {isDelivered ? 'Check your email. Your document has arrived.'
            : isOverdue ? 'Production is taking longer than the confirmed window. Updated delivery time in your email.'
            : 'System running · Nothing required from you'}
        </span>
      </div>
      {justDelivered && <DeliveredOverlay onDismiss={() => setJustDelivered(false)} />}
    </div>
  );
}

function DeliveredOverlay({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(10,11,15,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: '#12151C', border: '1px solid #232838', borderTop: '3px solid #4ADE80', padding: '52px 64px', textAlign: 'center' as const, maxWidth: '400px' }}>
        <div style={{ width: '8px', height: '8px', background: '#4ADE80', borderRadius: '50%', margin: '0 auto 20px' }}/>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '42px', fontWeight: 800, letterSpacing: '-0.02em', color: '#4ADE80', marginBottom: '16px' }}>Delivered.</div>
        <div style={{ fontFamily: "'Lora', serif", fontSize: '14px', fontStyle: 'italic', color: '#8892A4', lineHeight: 1.75 }}>Check your email. Your document has arrived.</div>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  );
}
