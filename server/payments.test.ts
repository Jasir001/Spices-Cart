import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { verifyCheckoutSignature, verifyWebhookSignature } from './payments.js';
import { checkoutUnavailableReasons } from './store-config.js';

test('Razorpay checkout signature matches the documented order/payment HMAC', () => {
  const secret = 'test-only-secret';
  const signature = createHmac('sha256', secret).update('order_123|pay_456').digest('hex');
  assert.equal(verifyCheckoutSignature('order_123', 'pay_456', signature, secret), true);
  assert.equal(verifyCheckoutSignature('order_wrong', 'pay_456', signature, secret), false);
  assert.equal(verifyCheckoutSignature('order_123', 'pay_456', 'not-hex', secret), false);
});

test('Razorpay webhook signature verifies the exact raw body', () => {
  const secret = 'webhook-test-secret';
  const body = Buffer.from('{"event":"payment.captured"}');
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(verifyWebhookSignature(body, signature, secret), true);
  assert.equal(verifyWebhookSignature(Buffer.from('{"event":"payment.failed"}'), signature, secret), false);
});

test('checkout fails closed when business, payment, policy, or pricing configuration is missing', () => {
  assert.ok(checkoutUnavailableReasons({}).length > 5);
  const configured = {
    CHECKOUT_ENABLED: 'true',
    RAZORPAY_MODE: 'test',
    RAZORPAY_KEY_ID: 'rzp_test_example',
    RAZORPAY_KEY_SECRET: 'example-secret',
    RAZORPAY_WEBHOOK_SECRET: 'example-webhook-secret',
    STORE_NAME: 'Example store',
    STORE_LEGAL_NAME: 'Example Spice Company',
    STORE_ADDRESS: 'Verified test address',
    STORE_CONTACT_EMAIL: 'owner@example.test',
    STORE_CONTACT_PHONE: '+911234567890',
    SHIPPING_POLICY_URL: 'https://example.test/shipping',
    RETURNS_POLICY_URL: 'https://example.test/returns',
    PRIVACY_POLICY_URL: 'https://example.test/privacy',
    TERMS_POLICY_URL: 'https://example.test/terms',
    SHIPPING_FEE_PAISE: '0',
    TAX_RATE_BPS: '0',
  };
  assert.deepEqual(checkoutUnavailableReasons(configured), [
    'Pending-payment inventory reservations do not have an automated expiry and reconciliation process.',
  ]);
  assert.ok(checkoutUnavailableReasons({ ...configured, RAZORPAY_KEY_ID: 'rzp_live_example' })
    .some((reason) => reason.includes('test-mode key')));
  assert.ok(checkoutUnavailableReasons({ ...configured, PRIVACY_POLICY_URL: 'javascript:alert(1)' })
    .some((reason) => reason.includes('HTTPS')));
});
