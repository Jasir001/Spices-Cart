import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp, MongoStore } from './app.js';
import { CartItem } from './models/CartItem.js';
import { Order } from './models/Order.js';
import { PaymentWebhookEvent } from './models/PaymentWebhookEvent.js';
import { Product } from './models/Product.js';
import { User } from './models/User.js';

const port = Number(process.env.PORT ?? 5000);
const host = process.env.HOST ?? (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
const mongoUri = process.env.MONGODB_URI;
const sessionSecret = process.env.SESSION_SECRET;
const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:3000';

if (!mongoUri) throw new Error('MONGODB_URI is required to start the authentication API.');
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must contain at least 32 characters.');
}
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.');

await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
await User.init();
await CartItem.init();
await Product.init();
await Order.init();
await PaymentWebhookEvent.init();
console.info('MongoDB connection established.');

const store = MongoStore.create({
  client: mongoose.connection.getClient(),
  collectionName: 'sessions',
  ttl: 60 * 60,
  autoRemove: 'native',
});
const app = createApp(store, clientOrigin, sessionSecret);
const server = app.listen(port, host, () => {
  console.info(`SPICE CART authentication API listening on ${host}:${port}.`);
});

async function shutdown(signal: string) {
  console.info(`Received ${signal}; shutting down.`);
  server.close(async (error) => {
    if (error) {
      console.error('HTTP server shutdown failed.', error.name);
      process.exitCode = 1;
    }
    await store.close();
    await mongoose.disconnect();
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
