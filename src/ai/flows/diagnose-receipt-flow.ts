'use server';
/**
 * @fileOverview A receipt diagnosis AI agent.
 *
 * - diagnoseReceipt - A function that handles the receipt diagnosis process.
 * - DiagnoseReceiptInput - The input type for the diagnoseReceipt function.
 * - DiagnoseReceiptOutput - The return type for the diagnoseReceipt function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const DiagnoseReceiptInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a receipt, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type DiagnoseReceiptInput = z.infer<typeof DiagnoseReceiptInputSchema>;

const DiagnoseReceiptOutputSchema = z.object({
  merchantName: z.string().describe('The name of the merchant or store.'),
  transactionDate: z
    .string()
    .describe('The date of the transaction in YYYY-MM-DD format.'),
  total: z.number().describe('The final total amount of the receipt.'),
  items: z
    .array(
      z.object({
        name: z.string().describe('The name of the item purchased.'),
        price: z.number().describe('The price of the item.'),
      })
    )
    .describe('A list of items purchased.'),
  category: z
    .string()
    .describe(
      'The category of the expense. Examples: Groceries, Dining, Travel, Shopping, Utilities, Entertainment, Other.'
    ),
});
export type DiagnoseReceiptOutput = z.infer<typeof DiagnoseReceiptOutputSchema>;

export async function diagnoseReceipt(
  input: DiagnoseReceiptInput
): Promise<DiagnoseReceiptOutput> {
  return diagnoseReceiptFlow(input);
}

const prompt = ai.definePrompt({
  name: 'diagnoseReceiptPrompt',
  input: {schema: DiagnoseReceiptInputSchema},
  output: {schema: DiagnoseReceiptOutputSchema},
  prompt: `You are an expert receipt scanner. Analyze the provided receipt image and extract the following information: the merchant's name, the transaction date, a list of all items with their prices, the final total amount, and a relevant category for the expense.

Ensure the date is in YYYY-MM-DD format.
Choose the most appropriate category from this list: Groceries, Dining, Travel, Shopping, Utilities, Entertainment, Other.

Photo: {{media url=photoDataUri}}`,
});

const diagnoseReceiptFlow = ai.defineFlow(
  {
    name: 'diagnoseReceiptFlow',
    inputSchema: DiagnoseReceiptInputSchema,
    outputSchema: DiagnoseReceiptOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
