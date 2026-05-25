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
      description="Professional IMMO off, DPF removal, AdBlue delete, EGR off, and ECU cloning services for UAE and GCC workshops. Compatibility reviewed before any file is accepted."
      waContext="Hi, I need a quote for IMMO/DPF/AdBlue/EGR service"
      relatedArticles={[
        {
          slug: 'dpf-off-service-dpf-off-solution',
          title: 'DPF Off Service — Complete Guide',
          category: 'Petrol ECU Remapping',
          summary: 'How DPF removal works at the software level, what ECU parameters are involved, pre-checks required, and the diagnostic process before applying a delete.',
        },
        {
          slug: 'egr-delete-egr-off-service',
          title: 'EGR Delete — EGR Off Service Guide',
          category: 'Petrol ECU Remapping',
          summary: 'The EGR system explained: why workshops delete it, how it is done in software, and the map sets that need correcting after an EGR off.',
        },
        {
          slug: 'immo-off-how-why',
          title: 'IMMO Off — How and Why',
          category: 'Petrol ECU Remapping',
          summary: 'How IMMO removal works, what ECU security layers are involved, and when IMMO off is the right solution versus key learning.',
        },
      ]}
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
