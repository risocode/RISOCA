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
import {db} from '@/lib/firebase';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  runTransaction,
} from 'firebase/firestore';

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

  // Find the authenticator from the database that matches the one presented by the browser
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
      authenticator: authenticator, // Pass the original authenticator object from the DB
      requireUserVerification: true,
    });
  } catch (error) {
    console.error('Authentication verification failed:', error);
    return {verified: false, error: (error as Error).message};
  }

  return {verified: verification.verified};
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
