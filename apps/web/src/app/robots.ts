import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://caracaltechmotors.com';
  const allowCatalogRobots =
    (process.env.NEXT_PUBLIC_NEW_CATALOG_FRONTEND === 'true' ||
      process.env.NEW_CATALOG_FRONTEND === 'true') &&
    process.env.CATALOG_ROBOTS_ALLOW === 'true';
  const disallow = [
    '/admin',
    '/admin/',
    '/api/',
    '/uploads/',
    '/data/',
    '/checkout.php',
    '/create-payment.php',
    '/shop-webhook-stripe.php',
  ];

  if (!allowCatalogRobots) {
    disallow.push('/catalog', '/catalog/');
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
