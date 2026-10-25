import mongoose, { InferSchemaType, Model, Types } from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  productId: { type: String, required: true, maxlength: 80 },
  name: { type: String, required: true, maxlength: 160 },
  weight: { type: String, required: true, maxlength: 40 },
  quantity: { type: Number, required: true, min: 1, max: 99, validate: Number.isInteger },
  unitPricePaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  lineTotalPaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
}, { _id: false });

const shippingAddressSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  mobile: { type: String, required: true, match: /^[6-9]\d{9}$/ },
  addressLine1: { type: String, required: true, trim: true, maxlength: 200 },
  addressLine2: { type: String, trim: true, maxlength: 200, default: '' },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  state: { type: String, required: true, trim: true, maxlength: 100 },
  postalCode: { type: String, required: true, match: /^\d{6}$/ },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  idempotencyKey: { type: String, required: true, maxlength: 100 },
  items: { type: [orderItemSchema], required: true, validate: (items: unknown[]) => items.length > 0 },
  shippingAddress: { type: shippingAddressSchema, required: true },
  subtotalPaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  shippingPaise: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  taxPaise: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  totalPaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  currency: { type: String, required: true, enum: ['INR'], default: 'INR' },
  status: {
    type: String,
    required: true,
    enum: ['pending_payment', 'paid', 'payment_failed', 'payment_review', 'cancelled', 'fulfilled'],
    default: 'pending_payment',
  },
  razorpayOrderId: { type: String, required: true },
  razorpayPaymentId: { type: String },
}, { timestamps: true });

orderSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
orderSchema.index({ razorpayOrderId: 1 }, { unique: true });
orderSchema.index({ userId: 1, createdAt: -1 });

export type OrderRecord = InferSchemaType<typeof orderSchema> & { _id: Types.ObjectId };
export const Order: Model<OrderRecord> = mongoose.models.Order as Model<OrderRecord>
  ?? mongoose.model<OrderRecord>('Order', orderSchema);
