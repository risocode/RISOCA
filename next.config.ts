
import type {NextConfig} from 'next';
import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  extendDefaultRuntimeCaching: true, // Important: extends the default caching rules
  runtimeCaching: [
    // This rule forces the PWA to check the network first for icons and the manifest
    // to ensure the latest versions are always displayed.
    {
      urlPattern: /\.(?:ico|png|webmanifest)$/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'icons-and-manifest-cache',
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        },
      },
    },
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
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value:
              'publickey-credentials-get=*, publickey-credentials-create=*',
          },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
