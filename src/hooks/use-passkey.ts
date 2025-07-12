
'use client';

import {useState, useEffect, useCallback} from 'react';
import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser';
import type {Authenticator} from '@/lib/schemas';
import {
  getRegistrationOptions,
  verifyNewRegistration,
  getAuthenticationOptions,
  verifyAuthentication,
  getAuthenticators,
  saveAuthenticator,
  removeAuthenticator,
} from '@/app/actions';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';

const USER = {
  id: 'risoca-user-id',
  name: 'risoca-user',
};

const CHALLENGE_KEY = 'risoca-current-challenge';

export function usePasskey() {
  const [authenticators, setAuthenticators] = useState<Authenticator[]>([]);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadAuthenticators = useCallback(async () => {
    setIsLoading(true);
    const fetchedAuthenticators = await getAuthenticators();
    setAuthenticators(fetchedAuthenticators);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    async function checkSupport() {
      if (
        window.PublicKeyCredential &&
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
      ) {
        try {
          const isAvailable =
            await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          setIsSupported(isAvailable);
        } catch (error) {
          console.error('Error checking Passkey support:', error);
          setIsSupported(false);
        }
      } else {
        setIsSupported(false);
      }
    }

    checkSupport();
    loadAuthenticators();
  }, [loadAuthenticators]);

  const registerNewPasskey = async () => {
    setIsLoading(true);
    try {
      const options = await getRegistrationOptions(USER.id, USER.name);
      localStorage.setItem(CHALLENGE_KEY, options.challenge);

      const registrationResponse = await startRegistration(options);
      const challenge = localStorage.getItem(CHALLENGE_KEY);
      
      if (!challenge) {
        throw new Error('Challenge not found');
      }

      const {verified, newAuthenticator} = await verifyNewRegistration(
        registrationResponse,
        challenge
      );

      localStorage.removeItem(CHALLENGE_KEY);

      if (verified && newAuthenticator) {
        const authToSave = {
            ...newAuthenticator,
            createdAt: new Date().toISOString(),
        };
        const saveResponse = await saveAuthenticator(newAuthenticator);
        if (saveResponse.success) {
            // After saving, reload the authenticators from DB to get the single one
            await loadAuthenticators();
        } else {
             throw new Error(saveResponse.message || 'Could not save authenticator to database.');
        }

        setIsLoading(false);
        return {success: true};
      }
      setIsLoading(false);
      return {success: false, error: 'Verification failed.'};
    } catch (error: any) {
      setIsLoading(false);
      localStorage.removeItem(CHALLENGE_KEY);
      console.error(error);
      return {
        success: false,
        error: error.message || 'An unknown error occurred.',
      };
    }
  };

  const loginWithPasskey = async () => {
    if (authenticators.length === 0) {
      return {success: false, error: 'No passkeys registered for this device.'};
    }
    setIsLoading(true);
    try {
      const options = await getAuthenticationOptions(authenticators);
      localStorage.setItem(CHALLENGE_KEY, options.challenge);

      const authResponse = await startAuthentication(options);
      const challenge = localStorage.getItem(CHALLENGE_KEY);
      
      if (!challenge) {
        throw new Error('Challenge not found');
      }

      const authenticator = authenticators.find(
        (auth) => auth.credentialID === authResponse.id
      );

      if (!authenticator) {
        setIsLoading(false);
        return {success: false, error: 'Unknown authenticator.'};
      }

      const {verified, newCounter} = await verifyAuthentication(
        authResponse,
        authenticator,
        challenge
      );
      
      localStorage.removeItem(CHALLENGE_KEY);

      if (verified && newCounter !== undefined) {
        // Since we only have one authenticator, we just update it.
        // A more robust implementation for multiple keys would update the specific one.
        const updatedAuthenticator = { ...authenticator, counter: newCounter };
        await saveAuthenticator(updatedAuthenticator);
        await loadAuthenticators(); // Reload to reflect the change.

        setIsLoading(false);
        return {success: true};
      }
      setIsLoading(false);
      return {success: false, error: 'Authentication failed.'};
    } catch (error: any) {
      setIsLoading(false);
      localStorage.removeItem(CHALLENGE_KEY);
      console.error(error);
      if (error.name === 'NotAllowedError') {
        return { success: false, error: 'Authentication was cancelled.' };
      }
      return {
        success: false,
        error: error.message || 'An unknown error occurred.',
      };
    }
  };

  const removePasskey = async (credentialID: string) => {
    const response = await removeAuthenticator(credentialID);
    if (response.success) {
      setAuthenticators((prev) =>
        prev.filter((auth) => auth.credentialID !== credentialID)
      );
    }
    return response;
  };

  return {
    authenticators,
    hasPasskeys: authenticators.length > 0,
    isSupported,
    isLoading,
    loadAuthenticators,
    registerNewPasskey,
    loginWithPasskey,
    removePasskey,
  };
}
