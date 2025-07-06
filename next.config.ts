import type {NextConfig} from 'next';
import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  extendDefaultRuntimeCaching: true, // Important: extends the default caching rules
  runtimeCaching: [
    // This rule ensures that all POST requests, which are used by
    // Next.js Server Actions, are always fetched from the network and not cached.
    // This prevents stale data issues and errors when the PWA is offline.
    {
      urlPattern: ({url}) => url.origin === self.location.origin,
      method: 'POST',
      handler: 'NetworkOnly',
      options: {
        backgroundSync: {
          name: 'pwa-post-requests',
          options: {
            maxRetentionTime: 24 * 60, // 24 hours
          },
        },
      },
    },
  ],
});

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default withPWA(nextConfig);
