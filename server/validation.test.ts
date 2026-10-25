import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cartItemSchema, cartMergeSchema, cartUpdateSchema, checkoutSchema, loginSchema,
  catalogProductSchema, paymentVerificationSchema, profileSchema, registerSchema,
} from './validation.js';

const registration = {
  fullName: 'Spice Customer',
  email: ' Customer@Example.com ',
  mobile: '9876543210',
  password: 'SpicePass1',
  confirmPassword: 'SpicePass1',
};

test('registration validates required fields and normalizes email', () => {
  const result = registerSchema.safeParse(registration);
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.email, 'customer@example.com');
});

test('registration rejects mismatched passwords and invalid Indian mobile numbers', () => {
  assert.equal(registerSchema.safeParse({ ...registration, confirmPassword: 'Different1' }).success, false);
  assert.equal(registerSchema.safeParse({ ...registration, mobile: '12345' }).success, false);
});

test('registration rejects weak passwords and unknown properties', () => {
  assert.equal(registerSchema.safeParse({ ...registration, password: 'weak', confirmPassword: 'weak' }).success, false);
  assert.equal(registerSchema.safeParse({ ...registration, unexpected: 'value' }).success, false);
});

test('login requires a valid email and non-empty password', () => {
  assert.equal(loginSchema.safeParse({ email: 'customer@example.com', password: 'secret' }).success, true);
  assert.equal(loginSchema.safeParse({ email: 'not-an-email', password: 'secret' }).success, false);
  assert.equal(loginSchema.safeParse({ email: 'customer@example.com', password: '' }).success, false);
});

test('profile accepts only validated name and mobile fields', () => {
  assert.equal(profileSchema.safeParse({ fullName: 'Spice Customer', mobile: '9876543210' }).success, true);
  assert.equal(profileSchema.safeParse({ fullName: 'S', mobile: '9876543210' }).success, false);
  assert.equal(profileSchema.safeParse({ fullName: 'Spice Customer', mobile: '1234567890' }).success, false);
});

test('cart item and merge requests enforce integer quantities and safe bounds', () => {
  assert.equal(cartItemSchema.safeParse({ productId: 'black-pepper', weight: '100 g', quantity: 2 }).success, true);
  assert.equal(cartItemSchema.safeParse({ productId: 'black-pepper', weight: '100 g', quantity: 100 }).success, false);
  assert.equal(cartItemSchema.safeParse({ productId: 'black-pepper', weight: '100 g', quantity: 1.5 }).success, false);
  assert.equal(cartUpdateSchema.safeParse({ productId: 'black-pepper', weight: '100 g', quantity: 0 }).success, true);
  assert.equal(cartMergeSchema.safeParse({ items: [{ productId: 'black-pepper', weight: '100 g', quantity: 1 }] }).success, true);
  assert.equal(cartMergeSchema.safeParse({ items: 'not-an-array' }).success, false);
});

test('checkout validates Indian delivery details and requires explicit policy acceptance', () => {
  const address = {
    fullName: 'Spice Customer',
    mobile: '9876543210',
    addressLine1: '12 Market Road',
    addressLine2: '',
    city: 'Chennai',
    state: 'Tamil Nadu',
    postalCode: '600001',
    acceptedPolicies: true,
  };
  assert.equal(checkoutSchema.safeParse(address).success, true);
  assert.equal(checkoutSchema.safeParse({ ...address, acceptedPolicies: false }).success, false);
  assert.equal(checkoutSchema.safeParse({ ...address, postalCode: 'ABC123' }).success, false);
  assert.equal(checkoutSchema.safeParse({ ...address, total: 1 }).success, false);
});

test('payment verification accepts only provider identifiers and a SHA-256 signature', () => {
  const valid = {
    orderId: '507f1f77bcf86cd799439011',
    razorpayOrderId: 'order_12345',
    paymentId: 'pay_12345',
    signature: 'a'.repeat(64),
  };
  assert.equal(paymentVerificationSchema.safeParse(valid).success, true);
  assert.equal(paymentVerificationSchema.safeParse({ ...valid, signature: 'invalid' }).success, false);
  assert.equal(paymentVerificationSchema.safeParse({ ...valid, paid: true }).success, false);
});

test('catalog administration requires a source, bounded integer prices and non-negative inventory', () => {
  const catalogItem = {
    name: 'Verified Pepper',
    tamilName: 'கருமிளகு',
    category: 'Whole Spices',
    image: '/spice-images/black-pepper.jpg',
    imageAlt: 'Peppercorns',
    variants: [{
      weight: '100 g',
      pricePaise: 39900,
      inventory: 8,
      priceSource: 'Owner-approved invoice 2026-10-25',
      inventorySource: 'Physical count 2026-10-25',
      active: true,
    }],
  };
  assert.equal(catalogProductSchema.safeParse(catalogItem).success, true);
  assert.equal(catalogProductSchema.safeParse({
    ...catalogItem,
    variants: [{ ...catalogItem.variants[0], inventory: -1 }],
  }).success, false);
  assert.equal(catalogProductSchema.safeParse({
    ...catalogItem,
    variants: [catalogItem.variants[0], catalogItem.variants[0]],
  }).success, false);
});
