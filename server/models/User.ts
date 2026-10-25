import mongoose, { InferSchemaType, Model, Types } from 'mongoose';

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  mobile: { type: String, required: true, match: /^[6-9]\d{9}$/ },
  passwordHash: { type: String, required: true, select: false },
  status: { type: String, enum: ['active', 'disabled'], default: 'active', required: true },
  emailVerified: { type: Boolean, default: false, required: true },
}, { timestamps: true });

userSchema.index({ email: 1 }, { unique: true });

export type UserRecord = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
export const User: Model<UserRecord> = mongoose.models.User as Model<UserRecord>
  ?? mongoose.model<UserRecord>('User', userSchema);
