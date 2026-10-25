import mongoose from 'mongoose';
import { createApp, MongoStore } from '../server/dist/server/app.js';
import { CartItem } from '../server/dist/server/models/CartItem.js';
import { Order } from '../server/dist/server/models/Order.js';
import { PaymentWebhookEvent } from '../server/dist/server/models/PaymentWebhookEvent.js';
import { Product } from '../server/dist/server/models/Product.js';
import { User } from '../server/dist/server/models/User.js';

let appPromise;

const safeConfigurationErrors = new Set([
  'MONGODB_URI is required to run the API on Vercel.',
  'SESSION_SECRET must contain at least 32 characters.',
  'CLIENT_ORIGIN must be set to the exact deployed site origin.',
]);

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const mongoUri = process.env.MONGODB_URI;
      const sessionSecret = process.env.SESSION_SECRET;
      const clientOrigin = process.env.CLIENT_ORIGIN;

      if (!mongoUri) {
        throw new Error('MONGODB_URI is required to run the API on Vercel.');
      }
      if (!sessionSecret || sessionSecret.length < 32) {
        throw new Error('SESSION_SECRET must contain at least 32 characters.');
      }
      if (!clientOrigin) {
        throw new Error('CLIENT_ORIGIN must be set to the exact deployed site origin.');
      }

      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 10000,
      });
      await User.init();
      await CartItem.init();
      await Product.init();
      await Order.init();
      await PaymentWebhookEvent.init();

      const store = MongoStore.create({
        client: mongoose.connection.getClient(),
        collectionName: 'sessions',
        ttl: 60 * 60,
        autoRemove: 'native',
      });

      return createApp(store, clientOrigin, sessionSecret);
    })();
  }

  try {
    return await appPromise;
  } catch (error) {
    appPromise = undefined;
    throw error;
  }
}

export default async function handler(request, response) {
  try {
    const app = await getApp();
    await new Promise((resolve, reject) => {
      response.once('finish', () => resolve());
      response.once('close', () => resolve());
      app(request, response, (error) => {
        if (error) reject(error);
      });
    });
  } catch (error) {
    const detail = error instanceof Error && safeConfigurationErrors.has(error.message)
      ? error.message
      : error instanceof Error ? error.name : 'UnknownError';
    console.error('Vercel API request failed.', detail);
    if (!response.headersSent) {
      response.statusCode = 503;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({ error: 'The service is temporarily unavailable. Please try again later.' }));
    }
  }
}
