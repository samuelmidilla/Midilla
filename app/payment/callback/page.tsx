'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

type CallbackState =
  | { status: 'verifying' }
  | { status: 'success'; purpose: string; tier_slug: string | null; credits_added: number | null }
  | { status: 'failed'; reason: string };

function PaymentCallbackContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const reference    = searchParams.get('reference');

  const [state, setState] = useState<CallbackState>({ status: 'verifying' });

  useEffect(() => {
    if (!reference) {
      setState({ status: 'failed', reason: 'No payment reference found in URL.' });
      return;
    }

    async function verify() {
      try {
        const res  = await fetch(`/api/payments/verify?reference=${reference}`);
        const data = await res.json();

        if (!res.ok || !data.verified) {
          setState({ status: 'failed', reason: data.error ?? 'Payment could not be verified.' });
          return;
        }

        setState({
          status:        'success',
          purpose:       data.purpose,
          tier_slug:     data.tier_slug,
          credits_added: data.credits_added,
        });

        setTimeout(() => router.push('/dashboard'), 3000);
      } catch {
        setState({ status: 'failed', reason: 'Verification request failed.' });
      }
    }

    verify();
  }, [reference, router]);

  return (
    <div style={{
      minHeight: '100vh', background: '#0A0B0F',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Lora', serif",
    }}>
      <div style={{
        background: '#12151C', border: '1px solid #232838',
        padding: '48px 52px', maxWidth: '480px', width: '100%',
        borderTop: state.status === 'success' ? '3px solid #4ADE80'
          : state.status === 'failed' ? '3px solid #F87171'
          : '3px solid #FBB040',
      }}>
        {state.status === 'verifying' && (
          <>
            <Label color="#FBB040">Verifying Payment</Label>
            <Heading>One moment.</Heading>
            <Body>Confirming your payment reference with Paystack.</Body>
          </>
        )}

        {state.status === 'success' && state.purpose === 'subscription' && (
          <>
            <Label color="#4ADE80">Payment Confirmed</Label>
            <Heading>{state.tier_slug === 'professional' ? 'Professional' : 'Starter'} tier active.</Heading>
            <Body>Your credits have been allocated. Redirecting to your dashboard.</Body>
            <Receipt>
              <ReceiptRow label="Tier" value={state.tier_slug === 'professional' ? 'Professional · 250 credits' : 'Starter · 60 credits'} />
              <ReceiptRow label="Status" value="Active" green />
              <ReceiptRow label="Next billing" value="30 days from today" />
            </Receipt>
          </>
        )}

        {state.status === 'success' && state.purpose === 'topup' && (
          <>
            <Label color="#4ADE80">Top-Up Confirmed</Label>
            <Heading>Credits added.</Heading>
            <Body>{state.credits_added} credits have been added to your balance. Redirecting to your dashboard.</Body>
          </>
        )}

        {state.status === 'failed' && (
          <>
            <Label color="#F87171">Payment Not Confirmed</Label>
            <Heading>Payment was not processed.</Heading>
            <Body>{state.reason}</Body>
            <Body>No credits were allocated. Your account has not been changed.</Body>
            <button onClick={() => router.push('/pricing')} style={{
              display: 'block', marginTop: '24px', padding: '12px 24px',
              background: 'transparent', border: '1px solid #232838',
              color: '#8892A4', fontFamily: "'Syne', sans-serif",
              fontSize: '12px', fontWeight: 700, cursor: 'crosshair', width: '100%',
            }}>
              Return to Pricing →
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh', background: '#0A0B0F',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          background: '#12151C', border: '1px solid #232838',
          borderTop: '3px solid #FBB040',
          padding: '48px 52px', maxWidth: '480px', width: '100%',
        }}>
          <div style={{ fontFamily: "'Inconsolata', monospace", fontSize: '9px', letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: '#FBB040', marginBottom: '14px' }}>
            Verifying Payment
          </div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '24px', fontWeight: 800, color: '#F8FAFC' }}>
            One moment.
          </div>
        </div>
      </div>
    }>
      <PaymentCallbackContent />
    </Suspense>
  );
}

function Label({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "'Inconsolata', monospace", fontSize: '9px', letterSpacing: '0.22em', textTransform: 'uppercase' as const, color, marginBottom: '14px' }}>
      {children}
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', color: '#F8FAFC', marginBottom: '14px' }}>
      {children}
    </div>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: "'Lora', serif", fontSize: '14px', color: '#8892A4', lineHeight: 1.85, marginBottom: '12px' }}>
      {children}
    </p>
  );
}

function Receipt({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#1A1E28', border: '1px solid #232838', marginTop: '24px' }}>
      {children}
    </div>
  );
}

function ReceiptRow({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #232838' }}>
      <span style={{ fontFamily: "'Inconsolata', monospace", fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#4A5568' }}>
        {label}
      </span>
      <span style={{ fontFamily: "'Inconsolata', monospace", fontSize: '10px', color: green ? '#4ADE80' : '#8892A4' }}>
        {value}
      </span>
    </div>
  );
}
