import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import session from 'express-session';
import { createApp } from './app.js';

test('production app serves SPA routes and exposes a database readiness check', {
  skip: !existsSync('dist/index.html'),
}, async () => {
  const app = createApp(new session.MemoryStore(), 'http://localhost:3000', 'test-session-secret-that-is-at-least-32-characters');
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;

  try {
    const routeResponse = await fetch(`${origin}/products/ceylon-cinnamon`, {
      headers: { Accept: 'text/html' },
    });
    assert.equal(routeResponse.status, 200);
    assert.match(await routeResponse.text(), /SPICE CART — SPICES AND MORE/);

    const productsResponse = await fetch(`${origin}/api/products`, {
      headers: { Origin: 'http://localhost:3000' },
    });
    assert.equal(productsResponse.status, 200);
    assert.equal(productsResponse.headers.get('access-control-allow-origin'), 'http://localhost:3000');
    assert.match(productsResponse.headers.get('content-security-policy') ?? '', /checkout\.razorpay\.com/);
    const catalog = await productsResponse.json() as { items: { id: string; isDemo: boolean; orderable: boolean }[] };
    assert.equal(catalog.items.length, 12);
    assert.equal(catalog.items[0].isDemo, true);
    assert.equal(catalog.items[0].orderable, false);

    const productResponse = await fetch(`${origin}/api/products/black-pepper`);
    assert.equal(productResponse.status, 200);
    assert.equal((await productResponse.json() as { product: { id: string } }).product.id, 'black-pepper');
    assert.equal((await fetch(`${origin}/api/products/not-a-product`)).status, 404);

    const checkoutConfig = await fetch(`${origin}/api/checkout/config`);
    assert.equal(checkoutConfig.status, 200);
    assert.equal((await checkoutConfig.json() as { enabled: boolean }).enabled, false);

    const disabledCheckout = await fetch(`${origin}/api/checkout/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(disabledCheckout.status, 503);
    assert.match((await disabledCheckout.json() as { error: string }).error, /No order or payment was created/);

    const csrfResponse = await fetch(`${origin}/api/auth/csrf`);
    assert.equal(csrfResponse.status, 200);
    assert.match((await csrfResponse.json() as { csrfToken: string }).csrfToken, /^[a-f\d]{64}$/);
    assert.equal((await fetch(`${origin}/api/auth/me`)).status, 401);
    const cartWithoutCsrf = await fetch(`${origin}/api/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: 'black-pepper', weight: '100 g', quantity: 1 }),
    });
    assert.equal(cartWithoutCsrf.status, 403);

    const malformedJson = await fetch(`${origin}/api/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"productId":',
    });
    assert.equal(malformedJson.status, 400);
    assert.deepEqual(await malformedJson.json(), { error: 'Request body must be valid JSON.' });

    const healthResponse = await fetch(`${origin}/api/health`);
    assert.equal(healthResponse.status, 503);
    assert.deepEqual(await healthResponse.json(), { status: 'unavailable' });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
