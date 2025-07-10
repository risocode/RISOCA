import {z} from 'zod';
import type {Timestamp} from 'firebase/firestore';
import type {
  AuthenticatorTransportFuture,
  CredentialDeviceType,
} from '@simplewebauthn/typescript-types';

export const InventoryItemSchema = z.object({
  name: z.string().min(1, 'Item name is required.'),
  cost: z.coerce.number().min(0, 'Cost must be non-negative.'),
  price: z.coerce.number().min(0, 'Price must be non-negative.'),
  stock: z.coerce.number().min(0, 'Stock must be non-negative.'),
});

export type InventoryItemInput = z.infer<typeof InventoryItemSchema>;

export type InventoryItem = InventoryItemInput & {
  id: string;
  createdAt: Timestamp;
};

export const SaleItemSchema = z.object({
  itemId: z.string().optional(),
  itemName: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  total: z.number(),
});
export type SaleItem = z.infer<typeof SaleItemSchema>;

export const SaleTransactionSchema = z.object({
  customerName: z.string().optional(),
  items: z.array(SaleItemSchema),
  total: z.number(),
  status: z.enum(['active', 'voided']),
});
export type SaleTransactionInput = z.infer<typeof SaleTransactionSchema>;

export type SaleTransaction = SaleTransactionInput & {
  id: string;
  createdAt: Timestamp;
  receiptNumber: string;
};

export const CustomerSchema = z.object({
  name: z.string().min(1, 'Customer name is required.'),
  status: z.enum(['active', 'deleted']).default('active'),
});

export type CustomerInput = z.infer<typeof CustomerSchema>;

export type Customer = CustomerInput & {
  id: string;
  createdAt: Timestamp;
};

export const LedgerTransactionSchema = z.object({
  customerId: z.string(),
  type: z.enum(['credit', 'payment']),
  amount: z.coerce.number().positive('Amount must not be 0.'),
  description: z.string().optional(),
  items: z.array(SaleItemSchema).optional(),
  paidCreditIds: z.array(z.string()).optional(),
  paidAmount: z.number().optional(), // Amount paid towards a credit
});

export type LedgerTransactionInput = z.infer<typeof LedgerTransactionSchema>;

export type LedgerTransaction = LedgerTransactionInput & {
  id: string;
  createdAt: Timestamp;
  status?: 'active' | 'deleted';
};

export const WalletEntrySchema = z.object({
  date: z.string(),
  startingCash: z.number(),
  endingCash: z.number().nullable(),
  status: z.enum(['open', 'closed']),
  createdAt: z.custom<Timestamp>(),
  closedAt: z.custom<Timestamp>().nullable(),
});

export type WalletEntry = z.infer<typeof WalletEntrySchema> & {
    id: string;
};

// WebAuthn Authenticator Schema
export type Authenticator = {
  id?: string;
  credentialID: string; // Stored as Base64 string
  credentialPublicKey: string; // Stored as Base64 string
  counter: number;
  credentialDeviceType?: CredentialDeviceType;
  credentialBackedUp?: boolean;
  transports?: AuthenticatorTransportFuture[];
  userId: string;
  createdAt: Date; // Use plain Date for client components
};
