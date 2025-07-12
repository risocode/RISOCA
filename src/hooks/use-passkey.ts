
'use client';

import {useState, useEffect, useCallback} from 'react';
import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser';
import {
  generateRegistrationOptions,
  verifyNewRegistration,
  generateAuthenticationOptions,
  verifyAuthentication,
  getAuthenticators,
} from '@/app/actions';

const CHALLENGE_KEY = 'risoca_passkey_challenge';

interface UsePasskeyOptions {
  onLoginSuccess?: () => void;
  onLoginError?: (error: string) => void;
  onRegisterSuccess?: () => void;
  onRegisterError?: (error: string) => void;
}

export function usePasskey({
  onLoginSuccess,
  onLoginError,
  onRegisterSuccess,
  onRegisterError,
}: UsePasskeyOptions = {}) {
  const [isPasskeyLoading, setIsLoading] = useState(true); // Start loading to check for passkeys
  const [isPasskeySupported, setIsPasskeySupported] = useState(false);
  const [hasRegisteredPasskey, setHasRegisteredPasskey] = useState(false);

  useEffect(() => {
    // Check for WebAuthn support
    if (
      window.PublicKeyCredential &&
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable &&
      PublicKeyCredential.isConditionalMediationAvailable
    ) {
      Promise.all([
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
        PublicKeyCredential.isConditionalMediationAvailable(),
      ]).then((results) => {
        // Check if platform authenticator is available and conditional UI is possible
        if (results.every((r) => r === true)) {
          setIsPasskeySupported(true);
        }
      });
    }
  }, []);
  
  const checkRegisteredPasskeys = useCallback(async () => {
    setIsLoading(true);
    try {
        const authenticators = await getAuthenticators();
        setHasRegisteredPasskey(authenticators.length > 0);
    } catch (error) {
        console.error("Could not check for passkeys", error);
        setHasRegisteredPasskey(false);
    } finally {
        setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    checkRegisteredPasskeys();
  }, [checkRegisteredPasskeys]);

  const registerNewPasskey = async () => {
    setIsLoading(true);
    try {
      // 1. Generate registration options on the server
      const options = await generateRegistrationOptions();
      localStorage.setItem(CHALLENGE_KEY, options.challenge);

      // 2. Start the registration process on the client
      const registrationResponse = await startRegistration(options);
      const challenge = localStorage.getItem(CHALLENGE_KEY);
      
      if (!challenge) {
        throw new Error("Challenge not found in storage.");
      }

      // 3. Verify the registration response on the server
      const {verified, error} = await verifyNewRegistration(
        registrationResponse,
        challenge
      );
      
      localStorage.removeItem(CHALLENGE_KEY);

      if (verified) {
        setHasRegisteredPasskey(true);
        onRegisterSuccess?.();
      } else {
        throw new Error(error || 'Verification failed.');
      }
    } catch (error) {
      const errorMessage = (error as Error).message || 'An unknown error occurred';
      console.error('Registration failed:', error);
      onRegisterError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithPasskey = async () => {
    setIsLoading(true);
    try {
      // 1. Generate authentication options on the server
      const options = await generateAuthenticationOptions();
      localStorage.setItem(CHALLENGE_KEY, options.challenge);

      // 2. Start the authentication process on the client
      const authenticationResponse = await startAuthentication(options);
      const challenge = localStorage.getItem(CHALLENGE_KEY);

      if (!challenge) {
        throw new Error("Challenge not found in storage.");
      }
      
      // 3. Verify the authentication response on the server
      const {verified, error} = await verifyAuthentication(
        authenticationResponse,
        challenge
      );
      
      localStorage.removeItem(CHALLENGE_KEY);

      if (verified) {
        onLoginSuccess?.();
      } else {
        throw new Error(error || 'Verification failed.');
      }
    } catch (error) {
      const errorMessage = (error as Error).message || 'An unknown error occurred';
       if(errorMessage.includes('No credentials were found')) {
         onLoginError?.('No passkey registered on this device.');
      } else {
        onLoginError?.(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isPasskeyLoading,
    isPasskeySupported,
    hasRegisteredPasskey,
    registerNewPasskey,
    loginWithPasskey,
  };
}
