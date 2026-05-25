import type { Metadata } from 'next';

import { EcuPatcherPage } from '@/components/ecu-patcher/ecu-patcher-page';

export const metadata: Metadata = {
  title: 'ECU Patcher 2.0 | Caracal Tech Motors',
  description:
    'Production ECU patcher workflow with customer access, upload tracking, job status, and result downloads.',
  alternates: {
    canonical: '/ecu-patcher',
  },
  robots: 'noindex, nofollow',
};

export default function Page() {
  return <EcuPatcherPage />;
}
