import mongoose, { InferSchemaType, Model } from 'mongoose';

const productVariantSchema = new mongoose.Schema({
  weight: { type: String, required: true, trim: true, maxlength: 40 },
  pricePaise: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  inventory: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  priceVerified: { type: Boolean, required: true, default: false },
  priceSource: { type: String, required: true, trim: true, maxlength: 300 },
  priceVerifiedAt: { type: Date, required: true },
  inventorySource: { type: String, required: true, trim: true, maxlength: 300 },
  inventoryVerifiedAt: { type: Date, required: true },
  active: { type: Boolean, required: true, default: false },
}, { _id: false });

const productSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  tamilName: { type: String, required: true, trim: true, maxlength: 160 },
  category: { type: String, required: true, trim: true, maxlength: 80 },
  image: { type: String, maxlength: 500 },
  imageAlt: { type: String, required: true, trim: true, maxlength: 300 },
  variants: {
    type: [productVariantSchema],
    required: true,
    validate: {
      validator: (variants: { weight: string }[]) =>
        variants.length > 0 && new Set(variants.map((variant) => variant.weight)).size === variants.length,
      message: 'Product variants must be non-empty and have unique pack sizes.',
    },
  },
}, { timestamps: true });

export type ProductRecord = InferSchemaType<typeof productSchema>;
export const Product: Model<ProductRecord> = mongoose.models.Product as Model<ProductRecord>
  ?? mongoose.model<ProductRecord>('Product', productSchema);
