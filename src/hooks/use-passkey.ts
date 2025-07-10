
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
} from '@/app/actions';

const USER = {
  id: 'risoca-user-id',
  name: 'risoca-user',
};

export function usePasskey() {
  const [authenticators, setAuthenticators] = useState<Authenticator[]>([]);
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const isMobile = /Mobi/i.test(window.navigator.userAgent);

    // Check for WebAuthn support on component mount and if it's a mobile device
    setIsSupported(
      isMobile &&
        typeof window !== 'undefined' &&
        window.PublicKeyCredential &&
        window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
    );
    // Load authenticators from localStorage
    const savedAuthenticators = localStorage.getItem('risoca-authenticators');
    if (savedAuthenticators) {
      setAuthenticators(JSON.parse(savedAuthenticators));
    }
  }, []);

  const saveAuthenticators = (newAuthenticators: Authenticator[]) => {
    setAuthenticators(newAuthenticators);
    localStorage.setItem(
      'risoca-authenticators',
      JSON.stringify(newAuthenticators)
    );
  };

  const registerNewPasskey = async () => {
    setIsLoading(true);
    try {
      // 1. Get registration options from the server
      const options = await getRegistrationOptions(USER.id, USER.name);

      // 2. Start the registration process on the client
      const registrationResponse = await startRegistration(options);

      // 3. Verify the registration response with the server
      const {verified, newAuthenticator} = await verifyNewRegistration(
        registrationResponse
      );

      if (verified && newAuthenticator) {
        // 4. Save the new authenticator to localStorage
        const newAuthWithDate = {
          ...newAuthenticator,
          createdAt: new Date().toISOString(),
        };
        saveAuthenticators([...authenticators, newAuthWithDate]);
        setIsLoading(false);
        return {success: true};
      }
      setIsLoading(false);
      return {success: false, error: 'Verification failed.'};
    } catch (error: any) {
      setIsLoading(false);
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
      // 1. Get authentication options from server, passing the stored authenticators
      const options = await getAuthenticationOptions(authenticators);

      // 2. Start the authentication process on the client
      const authResponse = await startAuthentication(options);

      // 3. Find the authenticator that was used
      const authenticator = authenticators.find(
        (auth) => auth.credentialID === authResponse.id
      );

      if (!authenticator) {
        setIsLoading(false);
        return {success: false, error: 'Unknown authenticator.'};
      }

      // 4. Verify the authentication response with the server
      const {verified, newCounter} = await verifyAuthentication(
        authResponse,
        authenticator
      );

      if (verified && newCounter !== undefined) {
        // 5. Update the counter for the authenticator in localStorage
        const updatedAuthenticators = authenticators.map((auth) =>
          auth.credentialID === authResponse.id
            ? {...auth, counter: newCounter}
            : auth
        );
        saveAuthenticators(updatedAuthenticators);
        setIsLoading(false);
        return {success: true};
      }
      setIsLoading(false);
      return {success: false, error: 'Authentication failed.'};
    } catch (error: any) {
      setIsLoading(false);
      console.error(error);
      return {
        success: false,
        error: error.message || 'An unknown error occurred.',
      };
    }
  };

  const removePasskey = (credentialID: string) => {
    const newAuthenticators = authenticators.filter(
      (auth) => auth.credentialID !== credentialID
    );
    saveAuthenticators(newAuthenticators);
  };

  return {
    authenticators,
    hasPasskeys: authenticators.length > 0,
    isSupported,
    isLoading,
    registerNewPasskey,
    loginWithPasskey,
    removePasskey,
  };
}
