import type { Metadata } from 'next';
import { ServiceTopicPage } from '@/components/services/service-topic-page';

export const metadata: Metadata = {
  title: 'ECU Remapping Dubai | Stage Tuning, Dyno, Petrol and Diesel Basics',
  description:
    'Educational ECU remapping guide for Dubai workshops covering stage tuning, dyno interpretation, wideband, AFR, EDC families, petrol tuning, diesel tuning, and practical remap language.',
  alternates: {
    canonical: '/ecu-remapping-dubai',
  },
};

export default function EcuRemappingDubaiPage() {
  return (
    <ServiceTopicPage
      eyebrow="Technical Guide"
      title="ECU Remapping Dubai"
      description="A workshop-focused guide to stage tuning, dyno reading, petrol and diesel fundamentals, torque strategy, and realistic ECU remap planning in Dubai."
      tags={[
        'ECU remapping Dubai',
        'Stage tuning',
        'Dyno graph',
        'AFR vs lambda',
        'EDC15 / EDC16 / EDC17',
      ]}
      points={[
        'Professional remap planning starts with ECU family identification, read method, checksum strategy, map identification, and log-based validation.',
        'Petrol tuning is limited by knock, intake air temperature, lambda enrichment, MAF or MAP scaling, and ignition advance.',
        'Diesel tuning is limited by exhaust gas temperature, smoke, turbo speed, rail pressure, DPF soot generation, and torque-model consistency.',
        'A dyno result is only useful when runs are repeatable under the same gear, temperature, fuel, and cooling conditions.',
      ]}
      cards={[
        {
          label: 'Use Case',
          title: 'Stage, Dyno and Daily Use',
          text: 'Clarifies the difference between stage tuning language and practical drivability outcomes.',
        },
        {
          label: 'Calibration Logic',
          title: 'Torque, Fuel and Request Maps',
          text: 'Explains why ECU families and torque models decide what is realistic before any result is promised.',
        },
        {
          label: 'Workshop Flow',
          title: 'Compatibility Before Claims',
          text: 'Keeps the conversion path focused on ECU, file, tool, and vehicle-condition review.',
        },
      ]}
    />
  );
}
