
import type {NextConfig} from 'next';
import withPWAInit from '@ducanh2912/next-pwa';

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
            value: 'publickey-credentials-get=(self), publickey-credentials-create=(self)',
          },
        ],
      },
    ];
  },
};

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  extendDefaultRuntimeCaching: true,
  runtimeCaching: [
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

export default withPWA(nextConfig);
