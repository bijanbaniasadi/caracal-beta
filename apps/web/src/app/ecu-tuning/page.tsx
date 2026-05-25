import type { Metadata } from 'next';
import { ServiceTopicPage } from '@/components/services/service-topic-page';

export const metadata: Metadata = {
  title: 'ECU Tuning Dubai | Tools, Software, File Service and Workshop Support',
  description:
    'Professional ECU tuning support in Dubai for tuning tools, calibration software, ECU and TCU files, diagnostics, workshop setup, and technical review.',
  alternates: {
    canonical: '/ecu-tuning',
  },
};

export default function EcuTuningPage() {
  return (
    <ServiceTopicPage
      eyebrow="Workshop Support"
      title="ECU Tuning Dubai"
      description="Commercial and technical support for workshops working with ECU tuning tools, tuning files, software licences, bench workflows, and calibration planning."
      tags={['KESS3', 'AutoTuner', 'WinOLS', 'ECU programmers', 'TCU remap tools', 'File service']}
      points={[
        'Tool choice depends on the target ECU or TCU family, security access, read path, and checksum workflow.',
        'OBD is quick when supported, while bench and boot paths are used when security, recovery, or full read requirements demand it.',
        'Software support covers WinOLS, ECM Titanium, DAMOS, A2L, map packs, checksum modules, and safe file-handling workflow.',
        'Trade and B2B customers can request compatibility checks before buying hardware or submitting paid file work.',
      ]}
      cards={[
        {
          label: 'Hardware',
          title: 'Tuning Tools and Programmers',
          text: 'KESS3, AutoTuner, BFlash, J2534, bench accessories, and diagnostic interfaces are handled through the catalog and inquiry flow.',
        },
        {
          label: 'Software',
          title: 'Calibration Workflow',
          text: 'Support for map discovery, damos or A2L context, checksum planning, and workshop file hygiene.',
        },
        {
          label: 'Trade Support',
          title: 'Workshop Review First',
          text: 'Vehicle, ECU, tool, read method, and intended result are checked before committing to a technical path.',
        },
      ]}
    />
  );
}
