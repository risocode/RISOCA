import {z} from 'zod';
import type {Timestamp} from 'firebase/firestore';

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
