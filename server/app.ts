import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import express, { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { products, type Product as StoreProduct } from '../shared/catalog.js';
import { CartItem } from './models/CartItem.js';
import { Order } from './models/Order.js';
import { PaymentWebhookEvent } from './models/PaymentWebhookEvent.js';
import { Product, type ProductRecord } from './models/Product.js';
import { User, UserRecord } from './models/User.js';
import { getRazorpayPayment, verifyCheckoutSignature, verifyWebhookSignature, createRazorpayOrder } from './payments.js';
import { checkoutUnavailableReasons, publicStoreConfiguration, readStoreConfiguration } from './store-config.js';
import {
  cartItemSchema, cartMergeSchema, cartUpdateSchema, catalogProductSchema, checkoutSchema, loginSchema,
  paymentVerificationSchema, profileSchema, registerSchema,
} from './validation.js';

declare module 'express-serve-static-core' {
  interface Request {
    authenticatedUser?: UserRecord;
    cartScopeKey?: string;
  }
}

function safeProfile(user: UserRecord) {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    mobile: user.mobile,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  };
}

function asyncRoute(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void>,
) {
  return (request: Request, response: Response, next: NextFunction) => {
    void handler(request, response, next).catch(next);
  };
}

function sessionRegenerate(request: Request): Promise<void> {
  const cartId = request.session.cartId;
  return new Promise((resolve, reject) => {
    request.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }
      if (cartId) request.session.cartId = cartId;
      resolve();
    });
  });
}

function sessionDestroy(request: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.destroy((error) => error ? reject(error) : resolve());
  });
}

function isDuplicateKeyError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 11000);
}

class CheckoutConflictError extends Error {}

type CheckoutLine = {
  productId: string;
  name: string;
  weight: string;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
};

function findCatalogVariant(productId: string, weight: string) {
  return products.find((product) => product.id === productId)?.variants
    .find((variant) => variant.weight === weight);
}

async function getCartVariant(productId: string, weight: string): Promise<{ allowed: boolean; stock?: number } | undefined> {
  const configured = await Product.findOne({ id: productId }).select('variants').lean();
  if (configured) {
    const variant = configured.variants.find((item) => item.weight === weight);
    return variant ? { allowed: variant.active && variant.priceVerified, stock: variant.inventory } : undefined;
  }
  return findCatalogVariant(productId, weight) ? { allowed: true } : undefined;
}

async function existingCartQuantity(scopeKey: string, productId: string, weight: string): Promise<number> {
  const item = await CartItem.findOne({ scopeKey, productId, weight }).select('quantity').lean();
  return item?.quantity ?? 0;
}

async function mongoTransactionReadiness(): Promise<string | undefined> {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return 'The product database is not connected.';
  }
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid') return 'Checkout requires MongoDB replica-set transactions.';
    return undefined;
  } catch (error) {
    console.error('Could not verify MongoDB transaction support.', error instanceof Error ? error.name : 'UnknownError');
    return 'MongoDB transaction support could not be verified.';
  }
}

async function checkoutReasons(): Promise<string[]> {
  const reasons = checkoutUnavailableReasons();
  const transactionReason = await mongoTransactionReadiness();
  if (transactionReason) reasons.push(transactionReason);
  return reasons;
}

function publicOrder(order: {
  _id: { toString(): string };
  status: string;
  items: unknown[];
  subtotalPaise: number;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
  currency: string;
  razorpayOrderId: string;
}) {
  return {
    id: order._id.toString(),
    status: order.status,
    items: order.items,
    subtotalPaise: order.subtotalPaise,
    shippingPaise: order.shippingPaise,
    taxPaise: order.taxPaise,
    totalPaise: order.totalPaise,
    currency: order.currency,
    razorpayOrderId: order.razorpayOrderId,
  };
}

function publicProduct(product: ProductRecord): StoreProduct {
  const variants = product.variants.map((variant) => ({
    weight: variant.weight,
    price: variant.pricePaise / 100,
    available: variant.active && variant.priceVerified && variant.inventory > 0,
  }));
  return {
    id: product.id,
    name: product.name,
    tamilName: product.tamilName,
    category: product.category,
    ...(product.image ? { image: product.image } : {}),
    imageAlt: product.imageAlt,
    variants,
    isDemo: false,
    orderable: variants.some((variant) => variant.available),
  };
}

function demoProduct(product: StoreProduct): StoreProduct {
  return {
    ...product,
    isDemo: true,
    orderable: false,
    variants: product.variants.map((variant) => ({ ...variant, available: false })),
  };
}

function cartLines(scopeKey: string) {
  return CartItem.find({ scopeKey }).sort({ createdAt: 1 }).select('productId weight quantity -_id').lean();
}

async function addCartQuantity(scopeKey: string, productId: string, weight: string, quantity: number) {
  const query = { scopeKey, productId, weight };
  const updated = await CartItem.findOneAndUpdate(
    { ...query, quantity: { $lte: 99 - quantity } },
    { $inc: { quantity } },
    { new: true },
  );
  if (updated) return updated;

  const existing = await CartItem.findOne(query);
  if (existing) return null;

  try {
    return await CartItem.create({ ...query, quantity });
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    return CartItem.findOneAndUpdate(
      { ...query, quantity: { $lte: 99 - quantity } },
      { $inc: { quantity } },
      { new: true },
    );
  }
}

async function mergeGuestCart(request: Request, userId: string) {
  const cartId = request.session.cartId;
  if (!cartId) return;
  const guestScope = `guest:${cartId}`;
  const userScope = `user:${userId}`;
  const guestItems = await CartItem.find({ scopeKey: guestScope }).lean();
  for (const item of guestItems) {
    const variant = await getCartVariant(item.productId, item.weight);
    if (!variant?.allowed) continue;
    const currentQuantity = await existingCartQuantity(userScope, item.productId, item.weight);
    const availableQuantity = variant.stock === undefined ? 99 : Math.max(0, variant.stock - currentQuantity);
    const quantityToMerge = Math.min(item.quantity, availableQuantity);
    if (quantityToMerge < 1) continue;
    const merged = await addCartQuantity(userScope, item.productId, item.weight, quantityToMerge);
    if (!merged) {
      await CartItem.updateOne(
        { scopeKey: userScope, productId: item.productId, weight: item.weight },
        { $set: { quantity: 99 } },
      );
    }
  }
  await CartItem.deleteMany({ scopeKey: guestScope });
}

async function cartPayload(request: Request) {
  return {
    items: await cartLines(request.cartScopeKey!),
    persistence: 'mongodb',
    scope: request.session.userId ? 'customer' : 'guest',
  };
}

export function createApp(sessionStore: session.Store, clientOrigin: string, sessionSecret: string) {
  const app = express();
  const cookieName = 'spice_cart_session';
  app.disable('x-powered-by');
  app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        formAction: ["'self'", 'https://api.razorpay.com'],
        frameAncestors: ["'self'"],
        frameSrc: ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        connectSrc: ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
      },
    },
  }));
  app.post('/api/payments/razorpay/webhook', express.raw({ type: 'application/json', limit: '64kb' }), asyncRoute(async (request, response) => {
    const rawBody = request.body;
    const signature = request.get('x-razorpay-signature');
    const eventId = request.get('x-razorpay-event-id');
    const configuration = readStoreConfiguration();
    if (!Buffer.isBuffer(rawBody) || !signature || !eventId || !configuration.razorpayWebhookSecret) {
      response.status(400).json({ error: 'The payment webhook request is incomplete.' });
      return;
    }
    if (!/^[a-zA-Z0-9_-]{1,160}$/.test(eventId)) {
      response.status(400).json({ error: 'The payment webhook event ID is invalid.' });
      return;
    }
    if (!verifyWebhookSignature(rawBody, signature, configuration.razorpayWebhookSecret)) {
      response.status(400).json({ error: 'The payment webhook signature is invalid.' });
      return;
    }
    let payload: {
      event?: string;
      payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string; status?: string } } };
    };
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as typeof payload;
    } catch {
      response.status(400).json({ error: 'The payment webhook payload is invalid.' });
      return;
    }
    const payment = payload.payload?.payment?.entity;
    if (!payload.event || payload.event.length > 100 || !payment?.order_id || !payment.id || !Number.isSafeInteger(payment.amount)) {
      response.status(400).json({ error: 'The payment webhook payload is incomplete.' });
      return;
    }
    if (!['payment.captured', 'payment.failed', 'order.paid'].includes(payload.event)) {
      response.json({ received: true, ignored: true });
      return;
    }

    const mongoSession = await mongoose.startSession();
    try {
      await mongoSession.withTransaction(async () => {
        await PaymentWebhookEvent.create([{
          eventId,
          eventType: payload.event!,
          orderId: payment.order_id,
        }], { session: mongoSession });

        const order = await Order.findOne({ razorpayOrderId: payment.order_id }).session(mongoSession);
        if (!order || order.totalPaise !== payment.amount || payment.currency !== order.currency) {
          throw new Error('The payment webhook does not match a recorded order.');
        }

        if (payload.event === 'payment.captured' || payload.event === 'order.paid') {
          if (payment.status !== 'captured') throw new Error('The payment provider has not captured this payment.');
          const paid = await Order.updateOne(
            { _id: order._id, status: 'pending_payment' },
            { $set: { status: 'paid', razorpayPaymentId: payment.id } },
            { session: mongoSession },
          );
          if (paid.modifiedCount !== 1 && order.status !== 'paid') {
            await Order.updateOne(
              { _id: order._id, status: { $ne: 'paid' } },
              { $set: { status: 'payment_review', razorpayPaymentId: payment.id } },
              { session: mongoSession },
            );
          }
        } else if (payload.event === 'payment.failed') {
          if (payment.status !== 'failed') throw new Error('The payment provider has not marked this payment as failed.');
          const failed = await Order.findOneAndUpdate(
            { _id: order._id, status: 'pending_payment' },
            { $set: { status: 'payment_failed', razorpayPaymentId: payment.id } },
            { new: true, session: mongoSession },
          );
          if (failed) {
            for (const item of failed.items) {
              const restored = await Product.updateOne(
                { id: item.productId, 'variants.weight': item.weight },
                { $inc: { 'variants.$.inventory': item.quantity } },
                { session: mongoSession },
              );
              if (restored.modifiedCount !== 1) throw new Error('Reserved inventory could not be restored after payment failure.');
            }
          }
        }
        await PaymentWebhookEvent.updateOne({ eventId }, { $set: { processedAt: new Date() } }, { session: mongoSession });
      });
      response.json({ received: true });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        response.json({ received: true, duplicate: true });
        return;
      }
      throw error;
    } finally {
      await mongoSession.endSession();
    }
  }));
  app.use(cors({
    origin: clientOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
  }));
  app.use(express.json({ limit: '16kb', type: 'application/json' }));
  app.use(session({
    name: cookieName,
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000,
      path: '/',
    },
  }));

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts. Please try again later.' },
  });
  const cartLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many cart updates. Please try again later.' },
  });
  const checkoutLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many checkout attempts. Please try again later.' },
  });
  const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many catalog changes. Please try again later.' },
  });

  const requireCsrf = (request: Request, response: Response, next: NextFunction) => {
    const requestOrigin = request.get('origin');
    if (requestOrigin && requestOrigin !== clientOrigin) {
      response.status(403).json({ error: 'Request origin is not allowed.' });
      return;
    }
    const supplied = request.get('x-csrf-token');
    const expected = request.session.csrfToken;
    if (!supplied || !expected) {
      response.status(403).json({ error: 'Your session expired. Refresh the page and try again.' });
      return;
    }
    const suppliedBytes = Buffer.from(supplied);
    const expectedBytes = Buffer.from(expected);
    if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) {
      response.status(403).json({ error: 'Your session expired. Refresh the page and try again.' });
      return;
    }
    next();
  };

  const requireUser = asyncRoute(async (request, response, next) => {
    if (!request.session.userId) {
      response.status(401).json({ error: 'Please sign in to continue.' });
      return;
    }
    const user = await User.findOne({ _id: request.session.userId, status: 'active' });
    if (!user) {
      await sessionDestroy(request);
      response.clearCookie(cookieName, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
      response.status(401).json({ error: 'Please sign in to continue.' });
      return;
    }
    request.authenticatedUser = user;
    next();
  });

  const requireAdmin = (request: Request, response: Response, next: NextFunction) => {
    const allowedIds = new Set((process.env.ADMIN_USER_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => mongoose.isValidObjectId(id)));
    if (!request.authenticatedUser || !allowedIds.has(request.authenticatedUser._id.toString())) {
      response.status(403).json({ error: 'Administrator access is not configured for this account.' });
      return;
    }
    next();
  };

  const resolveCartScope = asyncRoute(async (request, response, next) => {
    if (request.session.userId) {
      const user = await User.findOne({ _id: request.session.userId, status: 'active' });
      if (!user) {
        response.status(401).json({ error: 'Please sign in again before using your saved cart.' });
        return;
      }
      request.cartScopeKey = `user:${user._id.toString()}`;
    } else {
      if (!request.session.cartId) request.session.cartId = randomBytes(32).toString('hex');
      request.cartScopeKey = `guest:${request.session.cartId}`;
    }
    next();
  });

  app.get('/api/health', (_request, response) => {
    response.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
      status: mongoose.connection.readyState === 1 ? 'ok' : 'unavailable',
    });
  });

  app.get('/api/store/config', (_request, response) => {
    response.json(publicStoreConfiguration());
  });

  app.get('/api/products', asyncRoute(async (_request, response) => {
    const configuredProducts = mongoose.connection.readyState === 1 ? await Product.find().lean() : [];
    const configuredById = new Map(configuredProducts.map((product) => [product.id, product]));
    const configuredCatalog = products.map((sample) => {
      const configured = configuredById.get(sample.id);
      return configured ? publicProduct(configured) : demoProduct(sample);
    });
    const sampleIds = new Set(products.map((product) => product.id));
    configuredCatalog.push(...configuredProducts
      .filter((product) => !sampleIds.has(product.id))
      .map((product) => publicProduct(product)));
    response.json({
      items: configuredCatalog,
      source: configuredProducts.length ? 'database-with-sample-preview' : 'sample-catalog',
      ...(mongoose.connection.readyState !== 1 ? { warning: 'MongoDB is unavailable; all returned products are sample listings.' } : {}),
    });
  }));

  app.get('/api/products/:id', asyncRoute(async (request, response) => {
    const requestedId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const configured = mongoose.connection.readyState === 1
      ? await Product.findOne({ id: requestedId }).lean()
      : null;
    const product = configured ? publicProduct(configured) : products.find((item) => item.id === requestedId);
    if (!product) {
      response.status(404).json({ error: 'Product not found.' });
      return;
    }
    response.json({
      product: configured ? product : demoProduct(product),
      source: configured ? 'database' : 'sample-catalog',
    });
  }));

  app.get('/api/checkout/config', asyncRoute(async (_request, response) => {
    const reasons = await checkoutReasons();
    const storeConfiguration = readStoreConfiguration();
    const store = publicStoreConfiguration();
    response.json({
      enabled: reasons.length === 0,
      reasons,
      ...(reasons.length === 0
        ? {
          razorpayKeyId: storeConfiguration.razorpayKeyId,
          storeName: storeConfiguration.storeName,
          policies: {
            shipping: store.shippingPolicyUrl,
            returns: store.returnsPolicyUrl,
            privacy: store.privacyPolicyUrl,
            terms: store.termsPolicyUrl,
          },
        }
        : {}),
    });
  }));

  app.put('/api/admin/products/:id', adminLimiter, requireCsrf, requireUser, requireAdmin, asyncRoute(async (request, response) => {
    const productId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productId) || productId.length > 80) {
      response.status(400).json({ error: 'Product ID must be a lowercase URL-safe slug.' });
      return;
    }
    const parsed = catalogProductSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: 'Please supply verified product, price, and inventory details.',
        fields: parsed.error.issues.map((issue) => ({ field: issue.path.map(String).join('.'), message: issue.message })),
      });
      return;
    }
    const now = new Date();
    const product = await Product.findOneAndUpdate(
      { id: productId },
      {
        $set: {
          ...parsed.data,
          variants: parsed.data.variants.map((variant) => ({
            ...variant,
            priceVerified: true,
            priceVerifiedAt: now,
            inventoryVerifiedAt: now,
          })),
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    response.json({ product: product ? publicProduct(product) : null });
  }));

  const requireCheckoutEnabled = asyncRoute(async (_request, response, next) => {
    const reasons = await checkoutReasons();
    if (reasons.length) {
      response.status(503).json({
        error: 'Checkout is not available. No order or payment was created.',
        reasons,
      });
      return;
    }
    next();
  });

  app.post('/api/checkout/orders', checkoutLimiter, requireCheckoutEnabled, requireCsrf, requireUser, resolveCartScope, asyncRoute(async (request, response) => {
    const parsed = checkoutSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: 'Please check the delivery address and accept the store policies.',
        fields: parsed.error.issues.map((issue) => ({ field: String(issue.path[0] ?? ''), message: issue.message })),
      });
      return;
    }
    const idempotencyKey = request.get('idempotency-key');
    if (!idempotencyKey || !/^[\w-]{16,100}$/.test(idempotencyKey)) {
      response.status(400).json({ error: 'A valid checkout idempotency key is required.' });
      return;
    }
    const userId = request.authenticatedUser!._id;
    const existing = await Order.findOne({ userId, idempotencyKey });
    if (existing) {
      if (existing.status !== 'pending_payment') {
        response.status(409).json({ error: 'This checkout attempt has already been completed or failed. Start a new checkout.' });
        return;
      }
      response.status(200).json({
        order: publicOrder(existing),
        payment: {
          keyId: readStoreConfiguration().razorpayKeyId,
          storeName: readStoreConfiguration().storeName,
          orderId: existing.razorpayOrderId,
          amount: existing.totalPaise,
          currency: existing.currency,
        },
      });
      return;
    }

    const items = await CartItem.find({ scopeKey: request.cartScopeKey ?? `user:${userId.toString()}` }).lean();
    if (!items.length) {
      response.status(400).json({ error: 'Your cart is empty.' });
      return;
    }
    const productIds = [...new Set(items.map((item) => item.productId))];
    const catalog = await Product.find({ id: { $in: productIds } }).lean();
    const productMap = new Map(catalog.map((item) => [item.id, item]));
    const orderItems: CheckoutLine[] = [];
    for (const item of items) {
      const product = productMap.get(item.productId);
      const variant = product?.variants.find((entry) => entry.weight === item.weight);
      if (!product || !variant || !variant.active || !variant.priceVerified) {
        response.status(409).json({ error: 'One or more cart items do not have verified, active prices and inventory. No payment was created.' });
        return;
      }
      if (variant.inventory < item.quantity) {
        response.status(409).json({ error: `Insufficient stock for ${product.name} (${variant.weight}). No payment was created.` });
        return;
      }
      const lineTotalPaise = variant.pricePaise * item.quantity;
      if (!Number.isSafeInteger(lineTotalPaise)) {
        response.status(400).json({ error: 'Order amount exceeds supported limits.' });
        return;
      }
      orderItems.push({
        productId: product.id,
        name: product.name,
        weight: variant.weight,
        quantity: item.quantity,
        unitPricePaise: variant.pricePaise,
        lineTotalPaise,
      });
    }
    const configuration = readStoreConfiguration();
    const subtotalPaise = orderItems.reduce((total, item) => total + item.lineTotalPaise, 0);
    const taxPaise = Math.round(subtotalPaise * configuration.taxRateBasisPoints / 10000);
    const totalPaise = subtotalPaise + configuration.shippingFeePaise + taxPaise;
    if (![subtotalPaise, taxPaise, totalPaise].every(Number.isSafeInteger) || totalPaise < 100) {
      response.status(400).json({ error: 'The configured order total is invalid.' });
      return;
    }
    if (totalPaise > 100000000) {
      response.status(400).json({ error: 'Order total exceeds the supported payment limit.' });
      return;
    }

    const razorpayOrder = await createRazorpayOrder(totalPaise, randomUUID().replace(/-/g, '').slice(0, 32), configuration.razorpayKeyId, configuration.razorpayKeySecret);
    const mongoSession = await mongoose.startSession();
    let createdOrder: InstanceType<typeof Order> | undefined;
    try {
      await mongoSession.withTransaction(async () => {
        for (const item of orderItems) {
          const reserved = await Product.updateOne(
            {
              id: item.productId,
              variants: { $elemMatch: { weight: item.weight, active: true, priceVerified: true, pricePaise: item.unitPricePaise, inventory: { $gte: item.quantity } } },
            },
            { $inc: { 'variants.$.inventory': -item.quantity } },
            { session: mongoSession },
          );
          if (reserved.modifiedCount !== 1) throw new CheckoutConflictError(`Price or inventory changed for ${item.name}. Please review your cart.`);
        }
        const subtotal = orderItems.reduce((total, item) => total + item.lineTotalPaise, 0);
        const tax = Math.round(subtotal * configuration.taxRateBasisPoints / 10000);
        const total = subtotal + configuration.shippingFeePaise + tax;
        if (total !== razorpayOrder.amount) throw new Error('The order total changed before inventory was reserved.');
        [createdOrder] = await Order.create([{
          userId,
          idempotencyKey,
          items: orderItems,
          shippingAddress: {
            fullName: parsed.data.fullName,
            mobile: parsed.data.mobile,
            addressLine1: parsed.data.addressLine1,
            addressLine2: parsed.data.addressLine2,
            city: parsed.data.city,
            state: parsed.data.state,
            postalCode: parsed.data.postalCode,
          },
          subtotalPaise: subtotal,
          shippingPaise: configuration.shippingFeePaise,
          taxPaise: tax,
          totalPaise: total,
          currency: 'INR',
          status: 'pending_payment',
          razorpayOrderId: razorpayOrder.id,
        }], { session: mongoSession });
      });
    } catch (error) {
      if (error instanceof CheckoutConflictError) {
        response.status(409).json({ error: `${error.message} No order or payment was recorded.` });
        return;
      }
      if (isDuplicateKeyError(error)) {
        response.status(409).json({ error: 'This checkout attempt was already received. Retry with the same request key.' });
        return;
      }
      throw error;
    } finally {
      await mongoSession.endSession();
    }

    if (!createdOrder) throw new Error('The order could not be saved.');
    response.status(201).json({
      order: publicOrder(createdOrder),
      payment: {
        keyId: configuration.razorpayKeyId,
        storeName: configuration.storeName,
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
    });
  }));

  app.post('/api/checkout/verify', checkoutLimiter, requireCheckoutEnabled, requireCsrf, requireUser, asyncRoute(async (request, response) => {
    const parsed = paymentVerificationSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'The payment verification details are invalid.' });
      return;
    }
    const order = await Order.findOne({ _id: parsed.data.orderId, userId: request.authenticatedUser!._id });
    if (!order || order.razorpayOrderId !== request.body.razorpayOrderId) {
      response.status(404).json({ error: 'The payment order could not be found.' });
      return;
    }
    const configuration = readStoreConfiguration();
    if (!verifyCheckoutSignature(order.razorpayOrderId, parsed.data.paymentId, parsed.data.signature, configuration.razorpayKeySecret)) {
      response.status(400).json({ error: 'The payment signature could not be verified.' });
      return;
    }
    const payment = await getRazorpayPayment(parsed.data.paymentId, configuration.razorpayKeyId, configuration.razorpayKeySecret);
    if (payment.order_id !== order.razorpayOrderId || payment.amount !== order.totalPaise
      || payment.currency !== order.currency || payment.status !== 'captured') {
      response.status(409).json({ error: 'The payment provider has not confirmed a captured payment for this order.' });
      return;
    }
    response.json({ verified: true, status: order.status, message: 'Payment verified with the provider; waiting for the signed payment webhook to confirm the order.' });
  }));

  app.get('/api/orders/:id', requireUser, asyncRoute(async (request, response) => {
    if (!mongoose.isValidObjectId(request.params.id)) {
      response.status(404).json({ error: 'Order not found.' });
      return;
    }
    const order = await Order.findOne({ _id: request.params.id, userId: request.authenticatedUser!._id });
    if (!order) {
      response.status(404).json({ error: 'Order not found.' });
      return;
    }
    response.json({ order: publicOrder(order) });
  }));

  app.get('/api/auth/csrf', (request, response, next) => {
    if (!request.session.csrfToken) request.session.csrfToken = randomBytes(32).toString('hex');
    request.session.save((error) => {
      if (error) {
        next(error);
        return;
      }
      response.json({ csrfToken: request.session.csrfToken });
    });
  });

  app.get('/api/cart', cartLimiter, resolveCartScope, asyncRoute(async (request, response) => {
    response.json(await cartPayload(request));
  }));

  app.post('/api/cart/items', cartLimiter, requireCsrf, resolveCartScope, asyncRoute(async (request, response) => {
    const parsed = cartItemSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: 'Please choose a valid product, pack size, and quantity.',
        fields: parsed.error.issues.map((issue) => ({ field: String(issue.path[0] ?? ''), message: issue.message })),
      });
      return;
    }
    const { productId, weight, quantity } = parsed.data;
    const variant = await getCartVariant(productId, weight);
    if (!variant || !variant.allowed) {
      response.status(400).json({ error: 'That product pack is not available in the catalog.' });
      return;
    }
    if (variant.stock !== undefined
      && await existingCartQuantity(request.cartScopeKey!, productId, weight) + quantity > variant.stock) {
      response.status(409).json({ error: 'The requested quantity is greater than current verified stock.' });
      return;
    }
    const item = await addCartQuantity(request.cartScopeKey!, productId, weight, quantity);
    if (!item) {
      response.status(409).json({ error: 'The cart quantity limit for this pack is 99.' });
      return;
    }
    response.json(await cartPayload(request));
  }));

  app.post('/api/cart/merge', cartLimiter, requireCsrf, resolveCartScope, asyncRoute(async (request, response) => {
    const parsed = cartMergeSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'The saved cart contains invalid items.' });
      return;
    }
    for (const item of parsed.data.items) {
      const variant = await getCartVariant(item.productId, item.weight);
      if (!variant || !variant.allowed) {
        response.status(400).json({ error: 'The saved cart contains a product pack not available in the catalog.' });
        return;
      }
      if (variant.stock !== undefined) {
        const existingQuantity = await existingCartQuantity(request.cartScopeKey!, item.productId, item.weight);
        if (Math.max(existingQuantity, item.quantity) > variant.stock) {
          response.status(409).json({ error: 'The saved cart contains more than current verified stock.' });
          return;
        }
      }
    }
    for (const item of parsed.data.items) {
      await CartItem.findOneAndUpdate(
        { scopeKey: request.cartScopeKey, productId: item.productId, weight: item.weight },
        { $max: { quantity: item.quantity }, $setOnInsert: { scopeKey: request.cartScopeKey } },
        { upsert: true, new: true },
      );
    }
    response.json(await cartPayload(request));
  }));

  app.patch('/api/cart/items', cartLimiter, requireCsrf, resolveCartScope, asyncRoute(async (request, response) => {
    const parsed = cartUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'Please choose a valid product pack and quantity.' });
      return;
    }
    const { productId, weight, quantity } = parsed.data;
    const variant = await getCartVariant(productId, weight);
    if (!variant || !variant.allowed) {
      response.status(400).json({ error: 'That product pack is not available in the catalog.' });
      return;
    }
    if (variant.stock !== undefined && quantity > variant.stock) {
      response.status(409).json({ error: 'The requested quantity is greater than current verified stock.' });
      return;
    }
    if (quantity === 0) {
      await CartItem.deleteOne({ scopeKey: request.cartScopeKey, productId, weight });
    } else {
      const updated = await CartItem.findOneAndUpdate(
        { scopeKey: request.cartScopeKey, productId, weight },
        { $set: { quantity } },
        { new: true, runValidators: true },
      );
      if (!updated) {
        response.status(404).json({ error: 'That item is no longer in your cart.' });
        return;
      }
    }
    response.json(await cartPayload(request));
  }));

  app.delete('/api/cart/items', cartLimiter, requireCsrf, resolveCartScope, asyncRoute(async (request, response) => {
    const parsed = cartItemSchema.pick({ productId: true, weight: true }).safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'Please choose a valid product pack.' });
      return;
    }
    await CartItem.deleteOne({ scopeKey: request.cartScopeKey, ...parsed.data });
    response.json(await cartPayload(request));
  }));

  app.delete('/api/cart', cartLimiter, requireCsrf, resolveCartScope, asyncRoute(async (request, response) => {
    await CartItem.deleteMany({ scopeKey: request.cartScopeKey });
    response.json(await cartPayload(request));
  }));

  app.post('/api/auth/register', authLimiter, requireCsrf, asyncRoute(async (request, response) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: 'Please check the registration details.',
        fields: parsed.error.issues.map((issue) => ({ field: String(issue.path[0] ?? ''), message: issue.message })),
      });
      return;
    }
    const { fullName, email, mobile, password } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 12);
    let user: UserRecord;
    try {
      user = await User.create({ fullName, email, mobile, passwordHash });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        response.status(409).json({ error: 'An account with this email already exists.' });
        return;
      }
      throw error;
    }

    await sessionRegenerate(request);
    request.session.userId = user._id.toString();
    request.session.csrfToken = randomBytes(32).toString('hex');
    await mergeGuestCart(request, user._id.toString());
    await new Promise<void>((resolve, reject) => {
      request.session.save((error) => error ? reject(error) : resolve());
    });
    response.status(201).json({ user: safeProfile(user), csrfToken: request.session.csrfToken });
  }));

  app.post('/api/auth/login', authLimiter, requireCsrf, asyncRoute(async (request, response) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: 'Please check the sign-in details.',
        fields: parsed.error.issues.map((issue) => ({ field: String(issue.path[0] ?? ''), message: issue.message })),
      });
      return;
    }
    const user = await User.findOne({ email: parsed.data.email }).select('+passwordHash');
    const passwordMatches = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;
    if (!user || !passwordMatches || user.status !== 'active') {
      response.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    await sessionRegenerate(request);
    request.session.userId = user._id.toString();
    request.session.csrfToken = randomBytes(32).toString('hex');
    await mergeGuestCart(request, user._id.toString());
    await new Promise<void>((resolve, reject) => {
      request.session.save((error) => error ? reject(error) : resolve());
    });
    response.json({ user: safeProfile(user), csrfToken: request.session.csrfToken });
  }));

  app.get('/api/auth/me', requireUser, (request, response) => {
    response.json({ user: safeProfile(request.authenticatedUser as UserRecord) });
  });

  app.patch('/api/auth/me', requireCsrf, requireUser, asyncRoute(async (request, response) => {
    const parsed = profileSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: 'Please check the profile details.',
        fields: parsed.error.issues.map((issue) => ({ field: String(issue.path[0] ?? ''), message: issue.message })),
      });
      return;
    }
    const updated = await User.findByIdAndUpdate(
      request.authenticatedUser?._id,
      { $set: parsed.data },
      { new: true, runValidators: true },
    );
    if (!updated) {
      response.status(401).json({ error: 'Please sign in to continue.' });
      return;
    }
    response.json({ user: safeProfile(updated) });
  }));

  app.post('/api/auth/logout', requireCsrf, asyncRoute(async (request, response) => {
    if (!request.session.userId) {
      response.status(401).json({ error: 'Please sign in to continue.' });
      return;
    }
    await sessionDestroy(request);
    response.clearCookie(cookieName, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
    response.status(204).end();
  }));

  const webRoot = path.resolve(process.cwd(), process.env.WEB_ROOT ?? 'dist');
  if (existsSync(path.join(webRoot, 'index.html'))) {
    app.use(express.static(webRoot, {
      index: false,
      maxAge: process.env.NODE_ENV === 'production' ? '1y' : 0,
      setHeaders: (response, filePath) => {
        if (/\.[a-f0-9]{8,}\./i.test(path.basename(filePath))) {
          response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          response.setHeader('Cache-Control', 'no-cache');
        }
      },
    }));
    app.get('/{*path}', (request, response, next) => {
      if (!request.accepts('html')) {
        response.status(404).json({ error: 'Not found.' });
        return;
      }
      response.sendFile(path.join(webRoot, 'index.html'), (error) => {
        if (error) next(error);
      });
    });
  }

  app.use((_request, response) => response.status(404).json({ error: 'Not found.' }));

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    console.error('Request failed.', error instanceof Error ? error.name : 'UnknownError');
    if (response.headersSent) return;
    if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.parse.failed') {
      response.status(400).json({ error: 'Request body must be valid JSON.' });
      return;
    }
    if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large') {
      response.status(413).json({ error: 'Request body is too large.' });
      return;
    }
    if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
      response.status(400).json({ error: 'The submitted information is invalid.' });
      return;
    }
    response.status(503).json({ error: 'The service is temporarily unavailable. Please try again later.' });
  };
  app.use(errorHandler);
  return app;
}

export { MongoStore };
