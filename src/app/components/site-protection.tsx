
'use client';

import {useState, useEffect, type ReactNode} from 'react';
import {PasswordProtect} from './password-protect';

export function SiteProtection({children}: {children: ReactNode}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('site_authenticated') === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleSuccess = () => {
    sessionStorage.setItem('site_authenticated', 'true');
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <PasswordProtect onSuccess={handleSuccess} />;
  }

  return <>{children}</>;
}
