import mongoose, { InferSchemaType, Model } from 'mongoose';

const cartItemSchema = new mongoose.Schema({
  scopeKey: { type: String, required: true, maxlength: 100 },
  productId: { type: String, required: true, maxlength: 80 },
  weight: { type: String, required: true, maxlength: 40 },
  quantity: { type: Number, required: true, min: 1, max: 99, validate: Number.isInteger },
}, { timestamps: true });

cartItemSchema.index({ scopeKey: 1, productId: 1, weight: 1 }, { unique: true });
cartItemSchema.index({ scopeKey: 1 });
cartItemSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export type CartItemRecord = InferSchemaType<typeof cartItemSchema>;
export const CartItem: Model<CartItemRecord> = mongoose.models.CartItem as Model<CartItemRecord>
  ?? mongoose.model<CartItemRecord>('CartItem', cartItemSchema);
