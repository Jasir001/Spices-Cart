import mongoose, { InferSchemaType, Model } from 'mongoose';

const paymentWebhookEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, maxlength: 160 },
  eventType: { type: String, required: true, maxlength: 100 },
  orderId: { type: String, maxlength: 100 },
  processedAt: { type: Date },
}, { timestamps: true });

export type PaymentWebhookEventRecord = InferSchemaType<typeof paymentWebhookEventSchema>;
export const PaymentWebhookEvent: Model<PaymentWebhookEventRecord> =
  mongoose.models.PaymentWebhookEvent as Model<PaymentWebhookEventRecord>
  ?? mongoose.model<PaymentWebhookEventRecord>('PaymentWebhookEvent', paymentWebhookEventSchema);
