
'use server';

import type {
  VerifiedRegistrationResponse,
  VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import {
  generateRegistrationOptions as generateRegistrationOptionsSWA,
  verifyRegistrationResponse,
  generateAuthenticationOptions as generateAuthenticationOptionsSWA,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorDevice,
} from '@simplewebauthn/server/script/deps';

import {
  diagnoseReceipt,
  type DiagnoseReceiptInput,
  type DiagnoseReceiptOutput,
} from '@/ai/flows/diagnose-receipt-flow';
import {db} from '@/lib/firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
  setDoc,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import type {
  InventoryItemInput,
  LedgerTransaction,
  LedgerTransactionInput,
  SaleTransactionInput,
  SaleItem,
  DiagnoseReceiptInputWithSource,
} from '@/lib/schemas';
import {format} from 'date-fns';
import {v4 as uuidv4} from 'uuid';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

const rpID = process.env.RP_ID!;
const rpOrigin = process.env.RP_ORIGIN!;

// --- Passkey Actions ---

export async function getAuthenticators() {
  const q = query(collection(db, 'authenticators'));
  const querySnapshot = await getDocs(q);
  const authenticators: AuthenticatorDevice[] = [];
  querySnapshot.forEach((doc) => {
    authenticators.push(doc.data() as AuthenticatorDevice);
  });
  return authenticators;
}

export async function saveAuthenticator(authenticator: AuthenticatorDevice) {
  // This transaction ensures atomicity: delete all old keys, then add the new one.
  // This enforces a "one-device-only" rule for passkeys.
  await runTransaction(db, async (transaction) => {
    // 1. Query for all existing authenticators
    const authQuery = query(collection(db, 'authenticators'));
    const querySnapshot = await getDocs(authQuery);

    // 2. Delete each existing authenticator within the transaction
    querySnapshot.forEach((doc) => {
      transaction.delete(doc.ref);
    });

    // 3. Add the new authenticator
    const newAuthenticatorRef = doc(collection(db, 'authenticators'));
    transaction.set(newAuthenticatorRef, authenticator);
  });
}

export async function generateRegistrationOptions() {
  const authenticators = await getAuthenticators();
  const options = await generateRegistrationOptionsSWA({
    rpName: 'RiSoCa',
    rpID,
    userName: 'risoca_user',
    attestationType: 'none',
    excludeCredentials: authenticators.map((auth) => ({
      id: auth.credentialID,
      type: 'public-key',
      transports: auth.transports,
    })),
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'preferred',
    },
  });
  return options;
}

export async function verifyNewRegistration(
  registrationResponse: RegistrationResponseJSON,
  challenge: string
) {
  let verification: VerifiedRegistrationResponse;
  try {
    verification = await verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge: challenge,
      expectedOrigin: rpOrigin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch (error) {
    console.error('Verification failed:', error);
    return {verified: false, error: (error as Error).message};
  }

  const {verified, registrationInfo} = verification;
  if (verified && registrationInfo) {
    const {credentialPublicKey, credentialID, counter} = registrationInfo;
    const newAuthenticator: AuthenticatorDevice = {
      credentialID,
      credentialPublicKey,
      counter,
      transports: registrationResponse.response.transports,
    };
    await saveAuthenticator(newAuthenticator);
  }

  return {verified};
}

export async function generateAuthenticationOptions() {
  const authenticators = await getAuthenticators();
  const options = await generateAuthenticationOptionsSWA({
    rpID,
    allowCredentials: authenticators.map((auth) => ({
      id: auth.credentialID,
      type: 'public-key',
      transports: auth.transports,
    })),
    userVerification: 'preferred',
  });
  return options;
}

export async function verifyAuthentication(
  authenticationResponse: AuthenticationResponseJSON,
  challenge: string
) {
  const authenticators = await getAuthenticators();
  const bodyCredID = authenticationResponse.id;
  const authenticator = authenticators.find((auth) => {
    // The credentialID from the browser is a base64url-encoded string.
    // The stored credentialID is an object that needs to be converted to a Buffer,
    // then to a base64url-encoded string for comparison.
    const storedCredIDBase64 = Buffer.from(
      Object.values(auth.credentialID)
    ).toString('base64url');
    return storedCredIDBase64 === bodyCredID;
  });

  if (!authenticator) {
    return {verified: false, error: 'Authenticator not found'};
  }

  let verification: VerifiedAuthenticationResponse;
  try {
    verification = await verifyAuthenticationResponse({
      response: authenticationResponse,
      expectedChallenge: challenge,
      expectedOrigin: rpOrigin,
      expectedRPID: rpID,
      authenticator,
      requireUserVerification: true,
    });
  } catch (error) {
    console.error('Authentication verification failed:', error);
    return {verified: false, error: (error as Error).message};
  }

  return {verified: verification.verified};
}


type NotificationStatus = {
  success: boolean;
  message?: string;
};

export type ActionResponse = {
  diagnosis: DiagnoseReceiptOutput;
  notificationStatus: NotificationStatus;
};

// --- Wallet Status Check ---
async function checkIfDayIsClosed(
  dateToCheck: Date = new Date()
): Promise<boolean> {
  const dateString = format(dateToCheck, 'yyyy-MM-dd');
  const walletQuery = query(
    collection(db, 'walletHistory'),
    where('date', '==', dateString),
    where('status', '==', 'closed')
  );
  const walletSnapshot = await getDocs(walletQuery);
  return !walletSnapshot.empty;
}

function escapeMarkdownV2(text: string): string {
  const charsToEscape = /[_*[\]()~`>#+\-=|{}.!]/g;
  return text.replace(charsToEscape, '\\$&');
}

function dataURItoBlob(dataURI: string): Blob {
  const [header, base64Data] = dataURI.split(',');
  if (!header || !base64Data) {
    throw new Error('Invalid Data URI');
  }
  const mimeString = header.split(':')[1].split(';')[0];
  const buffer = Buffer.from(base64Data, 'base64');
  return new Blob([buffer], {type: mimeString});
}

async function notifyOnTelegram(
  diagnosis: DiagnoseReceiptOutput,
  photoDataUri?: string
): Promise<NotificationStatus> {
  if (!BOT_TOKEN || !CHANNEL_ID) {
    console.warn(
      'Telegram environment variables not set. Skipping channel notifications.'
    );
    return {success: false, message: 'Telegram not configured.'};
  }

  const formatToPHP = (value: number) => {
    return (
      '₱' +
      value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  try {
    const caption = [
      `🧾 *Receipt Scanned* 🧾`,
      ``,
      `*Merchant:* ${escapeMarkdownV2(diagnosis.merchantName)}`,
      `*Date:* ${escapeMarkdownV2(
        new Date(diagnosis.transactionDate + 'T00:00:00').toLocaleDateString(
          undefined,
          {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }
        )
      )}`,
      `*Category:* ${escapeMarkdownV2(diagnosis.category)}`,
      `*Total:* ${escapeMarkdownV2(formatToPHP(diagnosis.total))}`,
      ``,
      `*Items:*`,
      ...diagnosis.items.map(
        (item) =>
          `\\- ${escapeMarkdownV2(item.name)}: ${escapeMarkdownV2(
            formatToPHP(item.price)
          )}`
      ),
    ].join('\n');

    const parseMode = 'MarkdownV2';

    let response: Response;
    if (photoDataUri) {
      const blob = dataURItoBlob(photoDataUri);
      const formData = new FormData();
      formData.append('chat_id', CHANNEL_ID);
      formData.append('photo', blob, 'receipt.jpg');
      formData.append('caption', caption);
      formData.append('parse_mode', parseMode);

      const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
      response = await fetch(url, {method: 'POST', body: formData});
    } else {
      const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
      const body = {
        chat_id: CHANNEL_ID,
        text: caption,
        parse_mode: parseMode,
      };

      response = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
      });
    }

    if (!response.ok) {
      const errorData = await response.json();
      console.error(
        'Telegram API Error:',
        JSON.stringify(errorData, null, 2)
      );
      const description =
        errorData.description || 'Telegram API returned an error.';
      return {success: false, message: `Telegram Error: ${description}`};
    }

    return {success: true};
  } catch (error) {
    console.error('Error sending notification to Telegram:', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {
      success: false,
      message: `A network error occurred while sending to Telegram: ${message}`,
    };
  }
}

async function saveReceiptToFirestore(
  receiptData: DiagnoseReceiptInputWithSource,
  imagePreview?: string
) {
  try {
    // Save to the receipts collection first
    const newReceiptId = `${format(
      new Date(),
      'yyyyMMdd_HHmmss'
    )}-E-${uuidv4().substring(0, 6)}`;
    const receiptDocRef = doc(db, 'receipts', newReceiptId);
    await setDoc(receiptDocRef, {
      ...receiptData,
      imagePreview: imagePreview || null,
      createdAt: serverTimestamp(),
    });

    // If paid by G-Cash, create a corresponding transaction
    if (receiptData.paymentSource === 'G-Cash') {
      const counterRef = doc(db, 'counters', 'saleReceipt');

      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let newReceiptNumber = 1;
        if (counterDoc.exists()) {
          newReceiptNumber = (counterDoc.data().currentNumber || 0) + 1;
        }
        const formattedReceiptNumber = String(newReceiptNumber).padStart(6, '0');
        const transactionId = `${format(
          new Date(),
          'yyyyMMdd_HHmmss'
        )}-S-${formattedReceiptNumber}`;
        const transactionRef = doc(db, 'saleTransactions', transactionId);
        
        const saleItems: SaleItem[] = receiptData.items.map(item => ({
          itemName: item.name,
          quantity: 1,
          unitPrice: item.price,
          total: item.price,
        }));
        
        // This is a negative transaction, so the total should be negative
        const gcashTransactionPayload: SaleTransactionInput = {
          customerName: `Expense: ${receiptData.merchantName}`,
          items: saleItems,
          total: -receiptData.total, // Negative total to signify an expense
          status: 'active',
          serviceType: 'gcash-expense', // A new type to identify G-Cash expenses
        };

        transaction.set(transactionRef, {
          ...gcashTransactionPayload,
          receiptNumber: formattedReceiptNumber,
          createdAt: serverTimestamp(),
        });
        transaction.set(counterRef, { currentNumber: newReceiptNumber });
      });
    }
  } catch (error) {
    console.error('Error writing document to Firestore: ', error);
    throw new Error('Could not save receipt to database.');
  }
}

export async function submitManualReceipt(
  data: DiagnoseReceiptInputWithSource,
  imagePreview?: string
): Promise<ActionResponse> {
  const dayIsClosed = await checkIfDayIsClosed(
    new Date(data.transactionDate)
  );
  if (dayIsClosed) {
    throw new Error('Cannot record an expense for a closed day.');
  }

  await saveReceiptToFirestore(data, imagePreview);
  const notificationStatus = await notifyOnTelegram(data, imagePreview);
  return {diagnosis: data, notificationStatus};
}

// Action to submit a sales transaction
export async function submitSaleTransaction(
  saleData: SaleTransactionInput
): Promise<{success: boolean; message?: string; transactionId?: string}> {
  const dayIsClosed = await checkIfDayIsClosed();
  if (dayIsClosed) {
    return {
      success: false,
      message: 'Cannot record a sale. The daily session is already closed.',
    };
  }

  if (!saleData.items || saleData.items.length === 0) {
    return {success: false, message: 'No items in the report.'};
  }
  let transactionId: string | null = null;
  try {
    const counterRef = doc(db, 'counters', 'saleReceipt');

    await runTransaction(db, async (transaction) => {
      // Get the current counter value
      const counterDoc = await transaction.get(counterRef);
      let newReceiptNumber = 1;
      if (counterDoc.exists()) {
        newReceiptNumber = (counterDoc.data().currentNumber || 0) + 1;
      }

      // Format the receipt number with leading zeros
      const formattedReceiptNumber = String(newReceiptNumber).padStart(6, '0');

      const newId = `${format(
        new Date(),
        'yyyyMMdd_HHmmss'
      )}-S-${formattedReceiptNumber}`;
      transactionId = newId;
      const transactionRef = doc(db, 'saleTransactions', newId);

      const updatedSaleItems: SaleItem[] = [];
      const newInventoryItems: {ref: DocumentReference, data: InventoryItemInput}[] = [];
      const inventoryToUpdate = new Map<string, {ref: DocumentReference, quantity: number}>();
      
      // Step 1: Prepare all data. Separate new items from existing ones.
      for (const item of saleData.items) {
        if (!item.itemId) {
          // This is a new item to be created.
          const newItemId = `${format(new Date(), 'yyyyMMdd_HHmmss')}-I-${uuidv4().substring(0, 6)}`;
          const newItemRef = doc(db, 'inventory', newItemId);
          newInventoryItems.push({
            ref: newItemRef,
            data: {
              name: item.itemName,
              price: item.unitPrice,
              cost: 0,
              stock: 100,
            }
          });
          updatedSaleItems.push({ ...item, itemId: newItemId });
        } else {
          // This is an existing item to be updated.
          const existing = inventoryToUpdate.get(item.itemId);
          inventoryToUpdate.set(item.itemId, {
            ref: doc(db, 'inventory', item.itemId),
            quantity: (existing?.quantity || 0) + item.quantity
          });
          updatedSaleItems.push(item);
        }
      }

      // Step 2: Read Phase. Read all required inventory documents.
      const inventoryRefs = Array.from(inventoryToUpdate.values()).map(i => i.ref);
      const inventoryDocs = inventoryRefs.length > 0
        ? await Promise.all(inventoryRefs.map(ref => transaction.get(ref)))
        : [];

      const inventoryUpdates: {ref: DocumentReference, newStock: number}[] = [];

      // Step 3: Validate stock levels from the read data.
      for (const inventoryDoc of inventoryDocs) {
        if (!inventoryDoc.exists()) {
          throw new Error(`Inventory item with ID ${inventoryDoc.id} not found.`);
        }
        const required = inventoryToUpdate.get(inventoryDoc.id)!;
        const currentStock = inventoryDoc.data().stock as number;
        if (currentStock < required.quantity) {
          throw new Error(`Insufficient stock for "${inventoryDoc.data().name}". Available: ${currentStock}, Requested: ${required.quantity}.`);
        }
        inventoryUpdates.push({
          ref: inventoryDoc.ref,
          newStock: currentStock - required.quantity
        });
      }

      // Step 4: Write Phase. Perform all write operations now.
      // Write 1: Create the main sale transaction document with updated items.
      transaction.set(transactionRef, {
        ...saleData,
        items: updatedSaleItems,
        receiptNumber: formattedReceiptNumber,
        createdAt: serverTimestamp(),
        status: 'active',
      });
      
      // Write 2: Create all new inventory items.
      for (const { ref, data } of newInventoryItems) {
        transaction.set(ref, {
          ...data,
          createdAt: serverTimestamp(),
        });
      }

      // Write 3: Update all existing inventory items' stock.
      for (const update of inventoryUpdates) {
        transaction.update(update.ref, { stock: update.newStock });
      }

      // Write 4: Update the receipt counter.
      transaction.set(counterRef, { currentNumber: newReceiptNumber });
    });

    return {success: true, transactionId: transactionId};
  } catch (error) {
    console.error('Error in sales transaction: ', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {
      success: false,
      message: `Transaction failed: ${message}`,
    };
  }
}

export async function submitGcashTransaction(
  type: 'cash-in' | 'cash-out' | 'e-load',
  amount: number
): Promise<{success: boolean; message?: string}> {
  try {
    let items: SaleItem[] = [];
    let customerName = '';
    let total = 0;

    if (type === 'cash-in') {
      const serviceFee = Math.max(10, amount * 0.01);
      items = [
        {
          itemName: 'Gcash Cash-In',
          quantity: 1,
          unitPrice: amount,
          total: amount,
        },
        {
          itemName: 'Gcash Cash-In Fee',
          quantity: 1,
          unitPrice: serviceFee,
          total: serviceFee,
        },
      ];
      customerName = `G-Cash In (${formatCurrency(amount)})`;
      total = amount + serviceFee;
    } else if (type === 'cash-out') {
      const serviceFee = Math.max(10, amount * 0.01);
      items = [
        {
          itemName: 'Gcash Cash-Out',
          quantity: 1,
          unitPrice: -amount,
          total: -amount,
        },
        {
          itemName: 'Gcash Cash-Out Fee',
          quantity: 1,
          unitPrice: serviceFee,
          total: serviceFee,
        },
      ];
      customerName = `G-Cash Out (${formatCurrency(amount)})`;
      total = serviceFee;
    } else if (type === 'e-load') {
      const serviceFee = 3;
      items = [
        {
          itemName: `E-Load (${formatCurrency(amount)})`,
          quantity: 1,
          unitPrice: amount,
          total: amount,
        },
        {
          itemName: `E-Load Fee`,
          quantity: 1,
          unitPrice: serviceFee,
          total: serviceFee,
        },
      ];
      customerName = 'E-Load';
      total = serviceFee;
    }

    await submitSaleTransaction({
      items,
      customerName,
      total,
      status: 'active',
      serviceType: 'gcash',
    });

    return {success: true};
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {success: false, message};
  }
}

const formatCurrency = (value: number) =>
  `₱${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export async function voidSaleTransaction(
  transactionId: string
): Promise<{success: boolean; message?: string}> {
  if (!transactionId) {
    return {success: false, message: 'Transaction ID is missing.'};
  }

  const transactionRef = doc(db, 'saleTransactions', transactionId);

  try {
    await runTransaction(db, async (transaction) => {
      const transactionDoc = await transaction.get(transactionRef);
      if (!transactionDoc.exists()) {
        throw new Error('Transaction not found.');
      }
      if (transactionDoc.data().status === 'voided') {
        throw new Error('This transaction has already been voided.');
      }

      const items = transactionDoc.data().items as SaleItem[];

      // Restore inventory stock
      for (const item of items) {
        if (item.itemId) {
          const inventoryRef = doc(db, 'inventory', item.itemId);
          const inventoryDoc = await transaction.get(inventoryRef);
          if (inventoryDoc.exists()) {
            const currentStock = inventoryDoc.data().stock as number;
            transaction.update(inventoryRef, {
              stock: currentStock + item.quantity,
            });
          }
        }
      }

      // Mark transaction as voided
      transaction.update(transactionRef, {
        status: 'voided',
        voidedAt: serverTimestamp(),
      });
    });

    return {success: true};
  } catch (error) {
    console.error('Error voiding transaction:', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {success: false, message: `Transaction failed: ${message}`};
  }
}

// Actions for Inventory
export async function addInventoryItem(
  item: InventoryItemInput
): Promise<{success: boolean; message?: string}> {
  try {
    const newId = `${format(
      new Date(),
      'yyyyMMdd_HHmmss'
    )}-I-${uuidv4().substring(0, 6)}`;
    const docRef = doc(db, 'inventory', newId);
    await setDoc(docRef, {
      ...item,
      createdAt: serverTimestamp(),
    });
    return {success: true};
  } catch (error) {
    console.error('Error adding inventory item to Firestore: ', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {success: false, message: `Could not add item: ${message}`};
  }
}

export async function updateInventoryItem(
  id: string,
  item: Partial<InventoryItemInput>
): Promise<{success: boolean; message?: string}> {
  try {
    const itemRef = doc(db, 'inventory', id);
    await updateDoc(itemRef, item);
    return {success: true};
  } catch (error) {
    console.error('Error updating inventory item in Firestore: ', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {success: false, message: `Could not update item: ${message}`};
  }
}

export async function deleteInventoryItem(
  id: string
): Promise<{success: boolean; message?: string}> {
  try {
    await deleteDoc(doc(db, 'inventory', id));
    return {success: true};
  } catch (error) {
    console.error('Error deleting inventory item from Firestore: ', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {success: false, message: `Could not delete item: ${message}`};
  }
}

export async function verifyPassword(
  password: string
): Promise<{success: boolean}> {
  if (!process.env.SITE_PASSWORD) {
    console.error('SITE_PASSWORD environment variable is not set.');
    // In a real app, you might want to disable password check if it's not set.
    // For this app, we'll assume if it's not set, it's always incorrect.
    return {success: false};
  }
  const isCorrect = password === process.env.SITE_PASSWORD;
  return {success: isCorrect};
}

// Actions for Credit Ledger
export async function addCustomer(data: {
  name: string;
  amount: number;
  description?: string;
}): Promise<{success: boolean; message?: string}> {
  try {
    await runTransaction(db, async (transaction) => {
      const timestamp = new Date();
      
      // Sanitize the first name and create the custom ID
      const firstName = data.name.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '');
      const formattedTimestamp = format(timestamp, 'ddMMyy_HHmmss');
      const shortUuid = uuidv4().substring(0, 6);
      const customerId = `${firstName}-${formattedTimestamp}-${shortUuid}`;

      const customerRef = doc(db, 'customers', customerId);
      transaction.set(customerRef, {
        name: data.name,
        status: 'active',
        createdAt: serverTimestamp(),
      });

      if (data.amount > 0) {
        const ledgerId = `${format(
          timestamp,
          'yyyyMMdd_HHmmss'
        )}-L-${shortUuid}`;
        const ledgerRef = doc(db, 'ledger', ledgerId);
        transaction.set(ledgerRef, {
          customerId: customerRef.id,
          type: 'credit',
          amount: data.amount,
          description: data.description || 'Initial balance',
          status: 'active',
          paidAmount: 0,
          createdAt: serverTimestamp(),
        });
      }
    });
    return {success: true};
  } catch (error) {
    console.error('Error adding customer with transaction: ', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {success: false, message: `Could not add customer: ${message}`};
  }
}

export async function updateCustomerName(
  id: string,
  name: string
): Promise<{success: boolean; message?: string}> {
  try {
    if (!name.trim()) {
      return {success: false, message: 'Customer name cannot be empty.'};
    }
    const customerRef = doc(db, 'customers', id);
    await updateDoc(customerRef, {name});
    return {success: true};
  } catch (error) {
    console.error('Error updating customer name: ', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {success: false, message: `Could not update name: ${message}`};
  }
}

export async function addLedgerTransaction(
  transactionData: LedgerTransactionInput
): Promise<{success: boolean; message?: string}> {
  const dayIsClosed = await checkIfDayIsClosed();
  if (dayIsClosed) {
    return {
      success: false,
      message: 'Cannot record a transaction. The daily session is already closed.',
    };
  }
  try {
    await runTransaction(db, async (transaction) => {
      const newId = `${format(
        new Date(),
        'yyyyMMdd_HHmmss'
      )}-L-${uuidv4().substring(0, 6)}`;
      const docRef = doc(db, 'ledger', newId);

      // Handle credit transaction
      if (transactionData.type === 'credit') {
        const updatedSaleItems: SaleItem[] = [];
        const newInventoryItems: {ref: DocumentReference, data: InventoryItemInput}[] = [];
        const inventoryToUpdate = new Map<string, {ref: DocumentReference, quantity: number}>();
        
        for (const item of transactionData.items || []) {
          if (!item.itemId) {
            const newItemId = `${format(new Date(), 'yyyyMMdd_HHmmss')}-I-${uuidv4().substring(0, 6)}`;
            const newItemRef = doc(db, 'inventory', newItemId);
            newInventoryItems.push({
              ref: newItemRef,
              data: { name: item.itemName, price: item.unitPrice, cost: 0, stock: 100 }
            });
            updatedSaleItems.push({ ...item, itemId: newItemId });
          } else {
            const existing = inventoryToUpdate.get(item.itemId);
            inventoryToUpdate.set(item.itemId, {
              ref: doc(db, 'inventory', item.itemId),
              quantity: (existing?.quantity || 0) + item.quantity
            });
            updatedSaleItems.push(item);
          }
        }
        
        const inventoryRefs = Array.from(inventoryToUpdate.values()).map(i => i.ref);
        const inventoryDocs = inventoryRefs.length > 0 ? await Promise.all(inventoryRefs.map(ref => transaction.get(ref))) : [];
        const inventoryUpdates: {ref: DocumentReference, newStock: number}[] = [];

        for (const inventoryDoc of inventoryDocs) {
          if (!inventoryDoc.exists()) throw new Error(`Inventory item with ID ${inventoryDoc.id} not found.`);
          const required = inventoryToUpdate.get(inventoryDoc.id)!;
          const currentStock = inventoryDoc.data().stock as number;
          if (currentStock < required.quantity) throw new Error(`Insufficient stock for "${inventoryDoc.data().name}". Available: ${currentStock}, Requested: ${required.quantity}.`);
          inventoryUpdates.push({ ref: inventoryDoc.ref, newStock: currentStock - required.quantity });
        }
        
        for (const { ref, data } of newInventoryItems) {
          transaction.set(ref, { ...data, createdAt: serverTimestamp() });
        }
        for (const update of inventoryUpdates) {
          transaction.update(update.ref, { stock: update.newStock });
        }

        transaction.set(docRef, { 
          ...transactionData, 
          items: updatedSaleItems, 
          status: 'active', 
          paidAmount: 0,
          createdAt: serverTimestamp() 
        });

      } else { // Handle payment transaction
        
        // If specific credits are paid off, update their `paidAmount`
        if (transactionData.paidCreditIds && transactionData.paidCreditIds.length > 0) {
            // READ PHASE: Get all credit documents first.
            const creditRefs = transactionData.paidCreditIds.map(id => doc(db, 'ledger', id));
            const creditDocs = await Promise.all(creditRefs.map(ref => transaction.get(ref)));
            
            // WRITE PHASE: Now, perform all the updates.
            for (const creditDoc of creditDocs) {
                if (creditDoc.exists()) {
                    const creditData = creditDoc.data() as LedgerTransaction;
                    transaction.update(creditDoc.ref, { paidAmount: creditData.amount }); // Mark as fully paid
                }
            }
        } else {
            // This is a general payment, apply it to the oldest outstanding credits (FIFO)
            let paymentRemaining = transactionData.amount;
            const outstandingCreditsQuery = query(
              collection(db, 'ledger'),
              where('customerId', '==', transactionData.customerId),
              where('type', '==', 'credit'),
              where('status', '==', 'active'),
              orderBy('createdAt', 'asc')
            );
            
            const outstandingCreditsSnap = await getDocs(outstandingCreditsQuery);

            for (const creditDoc of outstandingCreditsSnap.docs) {
                if (paymentRemaining <= 0) break;

                const creditData = creditDoc.data() as LedgerTransaction;
                const creditRef = creditDoc.ref;
                const paidAmount = creditData.paidAmount || 0;
                const remainingOnCredit = creditData.amount - paidAmount;

                if (remainingOnCredit > 0) {
                    const amountToPay = Math.min(paymentRemaining, remainingOnCredit);
                    transaction.update(creditRef, { paidAmount: paidAmount + amountToPay });
                    paymentRemaining -= amountToPay;
                }
            }
        }

        transaction.set(docRef, {
          ...transactionData,
          status: 'active',
          createdAt: serverTimestamp(),
        });
      }
    });
    return {success: true};
  } catch (error) {
    console.error('Error adding ledger transaction to Firestore: ', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {
      success: false,
      message: `Could not add transaction: ${message}`,
    };
  }
}

export async function deleteLedgerTransaction(
  id: string
): Promise<{success: boolean; message?: string}> {
  try {
    const transactionRef = doc(db, 'ledger', id);
    
    await runTransaction(db, async (transaction) => {
        const transactionSnap = await transaction.get(transactionRef);
        if (!transactionSnap.exists() || transactionSnap.data().status === 'deleted') {
            throw new Error('Transaction already deleted or does not exist.');
        }

        const txData = transactionSnap.data() as LedgerTransaction;

        // If it was a credit transaction, restore inventory
        if (txData.type === 'credit' && txData.items) {
            for (const item of txData.items) {
                if(item.itemId) {
                    const inventoryRef = doc(db, 'inventory', item.itemId);
                    const inventoryDoc = await transaction.get(inventoryRef);
                    if (inventoryDoc.exists()) {
                        const currentStock = inventoryDoc.data().stock as number;
                        transaction.update(inventoryRef, { stock: currentStock + item.quantity });
                    }
                }
            }
        }
        
        // This is a simplified deletion. A more robust system would also handle
        // rolling back payments if a credit is deleted, but that adds significant complexity.
        // For now, we accept that deleting credits/payments can lead to accounting discrepancies
        // if not done carefully by the user.
        
        transaction.update(transactionRef, {
            status: 'deleted',
            deletedAt: serverTimestamp(),
        });
    });

    return {success: true};
  } catch (error) {
    console.error('Error deleting ledger transaction: ', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {
      success: false,
      message: `Could not delete transaction: ${message}`,
    };
  }
}

export async function deleteCustomer(
  id: string
): Promise<{success: boolean; message?: string}> {
  try {
    const customerRef = doc(db, 'customers', id);
    const customerSnap = await getDoc(customerRef);
    if (customerSnap.exists() && customerSnap.data().status === 'deleted') {
      return {success: false, message: 'Customer already deleted.'};
    }

    const ledgerQuery = query(
      collection(db, 'ledger'),
      where('customerId', '==', id)
    );
    const ledgerSnapshot = await getDocs(ledgerQuery);

    const balance = ledgerSnapshot.docs.reduce((acc, doc) => {
      const data = doc.data() as LedgerTransaction;
      if (data.status === 'deleted') return acc;
      if (data.type === 'credit') {
          return acc + (data.amount - (data.paidAmount || 0));
      }
      // Note: This balance calculation assumes payments are general and not double-counted.
      // A more robust calculation might be needed if payments can be linked. For deletion check, this is okay.
      return acc - data.amount;
    }, 0);

    const totalCredit = ledgerSnapshot.docs.filter(d => d.data().type === 'credit' && d.data().status !== 'deleted').reduce((acc, doc) => acc + doc.data().amount, 0);
    const totalPaid = ledgerSnapshot.docs.filter(d => d.data().type === 'payment' && d.data().status !== 'deleted').reduce((acc, doc) => acc + doc.data().amount, 0);
    const finalBalance = totalCredit - totalPaid;

    if (finalBalance > 0) {
      return {
        success: false,
        message: `Cannot delete customer with an outstanding balance of ₱${finalBalance.toFixed(2)}.`,
      };
    }

    await runTransaction(db, async (transaction) => {
      ledgerSnapshot.forEach((doc) => {
        transaction.update(doc.ref, {
          status: 'deleted',
          deletedAt: serverTimestamp(),
        });
      });

      transaction.update(customerRef, {
        status: 'deleted',
        deletedAt: serverTimestamp(),
      });
    });

    return {success: true};
  } catch (error) {
    console.error('Error deleting customer and their transactions: ', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {
      success: false,
      message: `Could not delete customer: ${message}`,
    };
  }
}

// Actions for Wallet
export async function startDay(
  data: { startingCash: number; date?: string }
): Promise<{success: boolean; message?: string}> {
  try {
    const dateString = data.date ? format(new Date(data.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    const docRef = doc(db, 'walletHistory', dateString);
    
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        success: false,
        message: 'A session for this date has already been recorded.',
      };
    }

    await setDoc(docRef, {
      date: dateString,
      startingCash: data.startingCash,
      endingCash: null,
      status: 'open',
      createdAt: serverTimestamp(),
      closedAt: null,
    });

    return {success: true};
  } catch (error) {
    console.error('Error starting day:', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {success: false, message: `Could not start day: ${message}`};
  }
}

export async function closeDay(
  docId: string,
  endingCash: number
): Promise<{success: boolean; message?: string}> {
  try {
    const docRef = doc(db, 'walletHistory', docId);
    await updateDoc(docRef, {
      endingCash,
      status: 'closed',
      closedAt: serverTimestamp(),
    });
    return {success: true};
  } catch (error) {
    console.error('Error closing day:', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {success: false, message: `Could not close day: ${message}`};
  }
}
