import { createHmac, timingSafeEqual } from 'node:crypto';

type RazorpayOrderResponse = {
  id: string;
  amount: number;
  currency: string;
  status: string;
};

type RazorpayPaymentResponse = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
};

function safeEqualHex(expected: string, supplied: string): boolean {
  if (!/^[a-f\d]+$/i.test(expected) || !/^[a-f\d]+$/i.test(supplied)) return false;
  const expectedBytes = Buffer.from(expected, 'hex');
  const suppliedBytes = Buffer.from(supplied, 'hex');
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqualHex(expected, signature);
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqualHex(expected, signature);
}

async function razorpayRequest<T>(path: string, keyId: string, keySecret: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!response.ok) {
    console.error('Razorpay API request failed.', response.status);
    throw new Error('The payment provider could not process the request.');
  }
  return response.json() as Promise<T>;
}

export async function createRazorpayOrder(
  amount: number,
  receipt: string,
  keyId: string,
  keySecret: string,
): Promise<RazorpayOrderResponse> {
  const order = await razorpayRequest<RazorpayOrderResponse>('/orders', keyId, keySecret, {
    method: 'POST',
    body: JSON.stringify({ amount, currency: 'INR', receipt }),
  });
  if (order.amount !== amount || order.currency !== 'INR' || order.status !== 'created' || !order.id) {
    throw new Error('The payment provider returned an invalid order response.');
  }
  return order;
}

export async function getRazorpayPayment(
  paymentId: string,
  keyId: string,
  keySecret: string,
): Promise<RazorpayPaymentResponse> {
  return razorpayRequest<RazorpayPaymentResponse>(`/payments/${encodeURIComponent(paymentId)}`, keyId, keySecret);
}
