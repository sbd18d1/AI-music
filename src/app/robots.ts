import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // The internal monitoring dashboard must never be indexed.
      disallow: ['/admin', '/admin/'],
    },
  };
}
