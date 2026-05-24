import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@caracal/auth', '@caracal/config', '@caracal/types', '@caracal/utils'],
  async redirects() {
    return [
      { source: '/shop.php', destination: '/shop', permanent: true },
      { source: '/product.php', destination: '/shop', permanent: true },
      { source: '/cart.php', destination: '/shop', permanent: true },
      { source: '/checkout.php', destination: '/contact', permanent: true },
      { source: '/success.php', destination: '/contact', permanent: true },
      { source: '/cancel.php', destination: '/shop', permanent: true },
      { source: '/shop-return.php', destination: '/contact', permanent: true },
      { source: '/articles.php', destination: '/articles', permanent: true },
      { source: '/knowledge-article.php', destination: '/articles', permanent: true },
      { source: '/academy.php', destination: '/articles', permanent: true },
      { source: '/course.php', destination: '/articles', permanent: true },
      { source: '/knowledge/:slug*', destination: '/articles', permanent: true },
      { source: '/courses/:slug*', destination: '/articles', permanent: true },
      { source: '/ecu-tuning.php', destination: '/ecu-tools', permanent: true },
      { source: '/ecu-remapping-dubai.php', destination: '/ecu-tools', permanent: true },
      { source: '/ecu-tuning-tools.php', destination: '/shop', permanent: true },
      {
        source: '/ecu-tuning-software.php',
        destination: '/shop?category=calibration-software',
        permanent: true,
      },
      { source: '/immo-dpf-adblue-services.php', destination: '/contact', permanent: true },
      { source: '/ecu-tuning-dealers.php', destination: '/contact', permanent: true },
      { source: '/ecu-lookup.php', destination: '/ecu-tools', permanent: true },
      { source: '/ecu-calculator.php', destination: '/ecu-tools', permanent: true },
      { source: '/ecu-patcher.php', destination: '/ecu-tools', permanent: true },
      { source: '/immo-data.php', destination: '/contact', permanent: true },
      { source: '/projects.php', destination: '/articles', permanent: true },
      { source: '/privacy.php', destination: '/privacy', permanent: true },
      { source: '/terms.php', destination: '/terms', permanent: true },
      { source: '/shipping.php', destination: '/shipping', permanent: true },
      { source: '/refund.php', destination: '/refund', permanent: true },
      { source: '/login.php', destination: '/contact', permanent: true },
      { source: '/register.php', destination: '/contact', permanent: true },
      { source: '/client_panel.php', destination: '/contact', permanent: true },
      { source: '/admin.php', destination: '/admin', permanent: true },
      { source: '/admin_panel.php', destination: '/admin', permanent: true },
      { source: '/admin_shop.php', destination: '/admin', permanent: true },
    ];
  },
};

export default nextConfig;
