import type { Metadata } from 'next';
import { ServiceTopicPage } from '@/components/services/service-topic-page';

export const metadata: Metadata = {
  title: 'IMMO, DPF, AdBlue and EGR Services | Cloning, Delete Solutions and Fault Logic',
  description:
    'Educational guide for IMMO off, ECU cloning, DPF off, AdBlue off, EGR delete, DTC off, hot start, swirl flap, MAF removal, and diesel solutions.',
  alternates: {
    canonical: '/immo-dpf-adblue-services',
  },
};

export default function ImmoDpfAdblueServicesPage() {
  return (
    <ServiceTopicPage
      eyebrow="Diagnostics and Delete Workflows"
      title="IMMO, DPF and AdBlue Services"
      description="A technical support destination for immobilizer requests, ECU cloning, DPF, AdBlue, EGR, DTC, hot-start, swirl-flap, and diesel aftertreatment questions."
      tags={['IMMO off', 'ECU cloning', 'DPF off', 'AdBlue off', 'EGR delete', 'DTC off']}
      points={[
        'IMMO and cloning work must separate flash, EEPROM, key, cluster, and donor ECU context before any file is accepted.',
        'DPF requests require regeneration logic, pressure sensor, temperature sensor, soot model, and diagnostic-code review.',
        'AdBlue and SCR issues require NOx, level, urea-quality, inducement, and countdown strategy checks.',
        'EGR, MAF, swirl-flap, hot-start, and DTC work should be reviewed as specific fault-logic jobs, not generic deletes.',
      ]}
      cards={[
        {
          label: 'Immobilizer Work',
          title: 'IMMO Off and ECU Cloning',
          text: 'Supports workshops handling ECU replacement, start-authorisation faults, and donor module transfer workflows.',
        },
        {
          label: 'Diesel Systems',
          title: 'DPF, AdBlue and EGR Topics',
          text: 'Explains aftertreatment and air-path workflows before a technical request enters the file process.',
        },
        {
          label: 'Problem Solving',
          title: 'DTC and Hot Start Review',
          text: 'Keeps fault-code masking, hot-start correction, and related service requests inside a reviewed support path.',
        },
      ]}
    />
  );
}
