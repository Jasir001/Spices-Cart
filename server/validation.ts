import { z } from 'zod';

const passwordSchema = z.string()
  .min(8)
  .max(128)
  .regex(/[a-z]/, 'Password must include a lowercase letter.')
  .regex(/[A-Z]/, 'Password must include an uppercase letter.')
  .regex(/\d/, 'Password must include a number.');

const emailSchema = z.string()
  .trim()
  .email()
  .max(254)
  .transform((email) => email.toLowerCase());

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: emailSchema,
  mobile: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number.'),
  password: passwordSchema,
  confirmPassword: z.string().min(1),
}).strict().refine((value) => value.password === value.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
}).strict();

export const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  mobile: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number.'),
}).strict();

export const cartItemSchema = z.object({
  productId: z.string().trim().min(1).max(80),
  weight: z.string().trim().min(1).max(40),
  quantity: z.number().int().min(1).max(99),
}).strict();

export const cartUpdateSchema = cartItemSchema.extend({
  quantity: z.number().int().min(0).max(99),
});

export const cartMergeSchema = z.object({
  items: z.array(cartItemSchema).max(100),
}).strict();

export const checkoutSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  mobile: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number.'),
  addressLine1: z.string().trim().min(5).max(200),
  addressLine2: z.string().trim().max(200).optional().default(''),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  postalCode: z.string().trim().regex(/^\d{6}$/, 'Enter a valid 6-digit Indian PIN code.'),
  acceptedPolicies: z.literal(true),
}).strict();

export const paymentVerificationSchema = z.object({
  orderId: z.string().trim().min(5).max(100),
  razorpayOrderId: z.string().trim().min(5).max(100),
  paymentId: z.string().trim().min(5).max(100),
  signature: z.string().trim().regex(/^[a-f\d]{64}$/i),
}).strict();

export const catalogProductSchema = z.object({
  name: z.string().trim().min(2).max(160),
  tamilName: z.string().trim().min(1).max(160),
  category: z.string().trim().min(2).max(80),
  image: z.string().trim().max(500).optional(),
  imageAlt: z.string().trim().min(2).max(300),
  variants: z.array(z.object({
    weight: z.string().trim().min(1).max(40),
    pricePaise: z.number().int().positive().max(100000000),
    inventory: z.number().int().min(0).max(1000000),
    priceSource: z.string().trim().min(5).max(300),
    inventorySource: z.string().trim().min(5).max(300),
    active: z.boolean(),
  }).strict()).min(1).max(50),
}).strict().refine(
  (product) => new Set(product.variants.map((variant) => variant.weight)).size === product.variants.length,
  { message: 'Pack sizes must be unique.', path: ['variants'] },
);

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
