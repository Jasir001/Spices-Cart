import { FormEvent, useEffect, useRef, useState } from 'react';
import { apiUrl, serverApiEnabled } from './api';

type CheckoutConfiguration = {
  enabled: boolean;
  reasons: string[];
  razorpayKeyId?: string;
  storeName?: string;
  policies?: { shipping: string; returns: string; privacy: string; terms: string };
};
type ApiError = { error?: string; reasons?: string[] };
type OrderResponse = {
  order: { id: string; status: string; razorpayOrderId: string; totalPaise: number; currency: string };
  payment: { keyId: string; storeName: string; orderId: string; amount: number; currency: string };
};
type PaymentCallback = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  order_id: string;
  handler: (response: PaymentCallback) => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
};

let razorpayScriptPromise: Promise<void> | undefined;

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  const result = await response.json() as T & ApiError;
  if (!response.ok) {
    const reasons = result.reasons?.length ? ` ${result.reasons.join(' ')}` : '';
    throw new Error(`${result.error ?? `Request failed (${response.status}).`}${reasons}`);
  }
  return result;
}

async function getCsrfToken(): Promise<string> {
  const response = await fetch(apiUrl('/api/auth/csrf'), { credentials: 'include' });
  const result = await readResponse<{ csrfToken?: string }>(response);
  if (!result.csrfToken) throw new Error('The server did not provide a security token. Refresh the page and try again.');
  return result.csrfToken;
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (razorpayScriptPromise) return razorpayScriptPromise;
  razorpayScriptPromise = new Promise((resolve, reject) => {
    document.querySelector<HTMLScriptElement>('#razorpay-checkout-script')?.remove();
    const script = document.createElement('script');
    script.id = 'razorpay-checkout-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => window.Razorpay ? resolve() : reject(new Error('The Razorpay checkout script did not initialize.'));
    script.onerror = () => reject(new Error('Could not load Razorpay checkout. Check your connection and try again.'));
    document.body.appendChild(script);
  });
  razorpayScriptPromise = razorpayScriptPromise.catch((error: unknown) => {
    document.querySelector<HTMLScriptElement>('#razorpay-checkout-script')?.remove();
    razorpayScriptPromise = undefined;
    throw error;
  });
  return razorpayScriptPromise;
}

function CommercePageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="store-pages-shell">
      <header className="store-pages-header">
        <a href="/" aria-label="SPICE CART home"><img src="/images/spices-cart-logo.png" alt="SPICE CART — SPICES AND MORE" /></a>
        <nav aria-label="Store navigation">
          <a href="/shop">Shop</a><a href="/cart">Cart</a><a href="/account">Account</a>
        </nav>
      </header>
      <main className="store-pages-main">{children}</main>
      <footer className="store-pages-footer">
        <a href="/">SPICE CART</a><span>SPICES AND MORE</span>
        <nav aria-label="Policies and help">
          <a href="/contact">Contact</a><a href="/shipping">Shipping</a>
          <a href="/returns">Returns</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a>
        </nav>
      </footer>
    </div>
  );
}

export function CheckoutPage() {
  const [configuration, setConfiguration] = useState<CheckoutConfiguration | null>(null);
  const [configurationError, setConfigurationError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const idempotencyKey = useRef('');

  useEffect(() => {
    let cancelled = false;
    if (!serverApiEnabled) {
      setConfigurationError('The API is disabled in this local preview. Set VITE_API_ENABLED=true and start the API to check checkout readiness.');
      setLoading(false);
      return () => { cancelled = true; };
    }
    void fetch(apiUrl('/api/checkout/config'), { credentials: 'include' })
      .then(readResponse<CheckoutConfiguration>)
      .then((result) => { if (!cancelled) setConfiguration(result); })
      .catch((error: unknown) => {
        if (!cancelled) setConfigurationError(error instanceof Error ? error.message : 'Could not check checkout configuration.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const pollOrder = async (orderId: string) => {
    for (let attempt = 0; attempt < 15; attempt += 1) {
      const response = await fetch(apiUrl(`/api/orders/${encodeURIComponent(orderId)}`), { credentials: 'include' });
      const result = await readResponse<{ order: { status: string } }>(response);
      if (result.order.status === 'paid') {
        idempotencyKey.current = '';
        setMessage('Payment confirmed by the signed payment notification. Your order is paid.');
        return;
      }
      if (result.order.status === 'payment_review') {
        setMessage('Razorpay captured a payment, but the order needs manual review. Do not submit payment again; contact the store.');
        return;
      }
      if (result.order.status === 'payment_failed' || result.order.status === 'cancelled') {
        idempotencyKey.current = '';
        setMessage('Payment was not completed. No successful order was recorded.');
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
    }
    setMessage('Payment was verified with the provider, but the signed confirmation is still pending. This order is not yet marked paid; check Order status again shortly.');
  };

  const beginCheckout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !configuration?.enabled) return;
    setSubmitting(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    if (!idempotencyKey.current) idempotencyKey.current = window.crypto.randomUUID();
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(apiUrl('/api/checkout/orders'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'Idempotency-Key': idempotencyKey.current,
        },
        body: JSON.stringify({
          fullName: form.get('fullName'),
          mobile: form.get('mobile'),
          addressLine1: form.get('addressLine1'),
          addressLine2: form.get('addressLine2'),
          city: form.get('city'),
          state: form.get('state'),
          postalCode: form.get('postalCode'),
          acceptedPolicies,
        }),
      });
      const result = await readResponse<OrderResponse>(response);
      await loadRazorpay();
      if (!window.Razorpay) throw new Error('Razorpay checkout is unavailable.');
      const razorpay = new window.Razorpay({
        key: result.payment.keyId,
        amount: result.payment.amount,
        currency: result.payment.currency,
        name: result.payment.storeName,
        order_id: result.payment.orderId,
        handler: (payment) => {
          void (async () => {
            try {
              const token = await getCsrfToken();
              const verifyResponse = await fetch(apiUrl('/api/checkout/verify'), {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
                body: JSON.stringify({
                  orderId: result.order.id,
                  razorpayOrderId: payment.razorpay_order_id,
                  paymentId: payment.razorpay_payment_id,
                  signature: payment.razorpay_signature,
                }),
              });
              await readResponse<{ verified: boolean }>(verifyResponse);
              await pollOrder(result.order.id);
            } catch (error) {
              setMessage(error instanceof Error ? error.message : 'Payment confirmation could not be verified.');
            }
          })();
        },
        modal: { ondismiss: () => setMessage('Payment window closed. The order is not marked paid unless the payment is confirmed by Razorpay.') },
        theme: { color: '#c7a35b' },
      });
      razorpay.open();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Checkout could not be started.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CommercePageLayout>
    <section className="store-message-panel checkout-page" aria-labelledby="checkout-heading">
      <p className="eyebrow">SPICE CART · SECURE CHECKOUT</p>
      <h1 id="checkout-heading">Checkout</h1>
      {loading ? <p role="status">Checking payment, catalog, and store configuration…</p> : null}
      {configurationError ? <p role="alert">{configurationError}</p> : null}
      {configuration && !configuration.enabled ? (
        <>
          <p>Checkout is disabled. No order will be created and no payment can be accepted until every launch requirement is verified.</p>
          <ul className="checkout-reasons">{configuration.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          <p>Current catalog prices are sample listings and cannot be used to charge customers.</p>
        </>
      ) : null}
      {configuration?.enabled ? (
        <form className="checkout-form" onSubmit={(event) => void beginCheckout(event)}>
          <label>Full name<input name="fullName" autoComplete="name" minLength={2} maxLength={100} required /></label>
          <label>Mobile number<input name="mobile" type="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" autoComplete="tel-national" required /></label>
          <label>Address line 1<input name="addressLine1" autoComplete="address-line1" minLength={5} maxLength={200} required /></label>
          <label>Address line 2 (optional)<input name="addressLine2" autoComplete="address-line2" maxLength={200} /></label>
          <div className="checkout-address-row">
            <label>City<input name="city" autoComplete="address-level2" minLength={2} maxLength={100} required /></label>
            <label>State<input name="state" autoComplete="address-level1" minLength={2} maxLength={100} required /></label>
            <label>PIN code<input name="postalCode" inputMode="numeric" pattern="[0-9]{6}" autoComplete="postal-code" required /></label>
          </div>
          <label className="checkout-policy-acceptance">
            <input type="checkbox" checked={acceptedPolicies} onChange={(event) => setAcceptedPolicies(event.target.checked)} required />
            <span>I have read the{' '}
              <a href={configuration.policies?.shipping ?? '/shipping'} target="_blank" rel="noreferrer">shipping</a>,{' '}
              <a href={configuration.policies?.returns ?? '/returns'} target="_blank" rel="noreferrer">returns</a>,{' '}
              <a href={configuration.policies?.privacy ?? '/privacy'} target="_blank" rel="noreferrer">privacy</a>, and{' '}
              <a href={configuration.policies?.terms ?? '/terms'} target="_blank" rel="noreferrer">terms</a> policies.
            </span>
          </label>
          <button className="primary-btn" type="submit" disabled={submitting}>{submitting ? 'Starting secure payment…' : 'Continue to Razorpay'}</button>
        </form>
      ) : null}
      {message && <p className="store-cart-feedback" role="status">{message}</p>}
      <div className="store-page-actions"><a className="secondary-btn" href="/cart">Return to cart</a></div>
    </section>
    </CommercePageLayout>
  );
}

export function OrderStatusPage({ orderId }: { orderId: string }) {
  const [status, setStatus] = useState('Loading order status…');
  useEffect(() => {
    let cancelled = false;
    if (!serverApiEnabled) {
      setStatus('Order status is unavailable in this local browser-only preview.');
      return () => { cancelled = true; };
    }
    void fetch(apiUrl(`/api/orders/${encodeURIComponent(orderId)}`), { credentials: 'include' })
      .then(readResponse<{ order: { status: string } }>)
      .then(({ order }) => { if (!cancelled) setStatus(`Order status: ${order.status.replace(/_/g, ' ')}.`); })
      .catch((error: unknown) => { if (!cancelled) setStatus(error instanceof Error ? error.message : 'Could not load order status.'); });
    return () => { cancelled = true; };
  }, [orderId]);

  return (
    <CommercePageLayout>
    <section className="store-message-panel" aria-labelledby="order-status-heading">
      <p className="eyebrow">SPICE CART · ORDER STATUS</p>
      <h1 id="order-status-heading">Your order</h1>
      <p role="status">{status}</p>
      <div className="store-page-actions"><a className="primary-btn" href="/shop">Continue shopping</a></div>
    </section>
    </CommercePageLayout>
  );
}
