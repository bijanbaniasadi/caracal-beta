import type { MetadataRoute } from 'next';

const baseUrl = 'https://caracaltechmotors.com';
const lastModified = new Date('2026-05-24');

const coreRoutes = [
  '/',
  '/shop',
  '/articles',
  '/ecu-tools',
  '/contact',
  '/privacy',
  '/terms',
  '/shipping',
  '/refund',
] as const;

const productSlugs = [
  'kess3-master',
  'autotuner-tool',
  'bflash-master',
  'winols-license',
  'bench-power-supply-120a',
  'ecu-adapter-kit',
  'alientech-kessv3-ecu-and-tcu-programmer-obd-bench-boot',
  'alientech-kess3-slave-cars-agriculture-truck-bikes-marine-ob',
  'alientech-kess3-master-cars-agriculture-truck-bikes-marine-o',
  'autotuner-tool-device-master-version',
  'autotuner-tool-device-slave-version',
  'autotuner-one-multi-brand-obd-ii-personal-flasher',
  'xhorse-xdmpg0gl-multi-prog-ecu-programmer-free-mqb48-akl-lic',
  'cgdi-cg-fc200-ecu-programmer-full-version',
  'microtronik-hexprog-ii-lite-chip-tuning-tool',
  'ecu-soft-powerbox-for-pcmflash',
  'xhorse-key-tool-midi-advanced-version-xdkmd0en',
  'avdi-abrites-vehicle-diagnostics-interface',
  'genuine-scanmatik-3-tool-with-tunerwire-boot-bench-cable',
  'autel-maxiflash-elite-j2534-ecu-programming-device',
  'io-terminal-obd-cable-and-godiag-obd2-jumper-adapter',
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = coreRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified,
    changeFrequency: route === '/' ? ('daily' as const) : ('weekly' as const),
    priority: route === '/' ? 1 : 0.8,
  }));

  const products = productSlugs.map((slug) => ({
    url: `${baseUrl}/shop/${slug}`,
    lastModified,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...products];
}
