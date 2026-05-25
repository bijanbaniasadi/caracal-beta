import type { Metadata } from 'next';

import { EcuPatcherPage } from '@/components/ecu-patcher/ecu-patcher-page';

export const metadata: Metadata = {
  title: 'ECU Patcher | Caracal Tech Motors',
  description:
    'Customer ECU patcher workflow restored from the legacy CaracalTech PHP website with upload tracking, job status, and result downloads.',
  alternates: {
    canonical: '/ecu-patcher',
  },
  robots: 'noindex, nofollow',
};

export default function Page() {
  return <EcuPatcherPage />;
}
