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
      eyebrow="Workshop Service"
      title="ECU Remapping Dubai"
      description="Professional ECU remapping for Dubai workshops — Stage 1 &amp; Stage 2 tunes, diesel and petrol calibration, torque model correction, and boost optimisation. Compatibility verified before any work is accepted."
      waContext="Hi, I need an ECU remapping quote for my workshop"
      relatedArticles={[
        {
          slug: 'what-is-ecu-remapping',
          title: 'What is ECU Remapping?',
          category: 'Petrol ECU Remapping',
          summary: 'The difference between remapping and chip tuning, how modern flash-based ECUs work, and the correct process for a safe remap.',
        },
        {
          slug: 'diesel-tuning-fundamental',
          title: 'Diesel Tuning Fundamentals',
          category: 'Petrol ECU Remapping',
          summary: 'Core diesel ECU concepts — injection quantity, boost, rail pressure, and the maps that control them.',
        },
        {
          slug: 'edc-15-16-17-tuning-guide',
          title: 'EDC15 / EDC16 / EDC17 Tuning Guide',
          category: 'Petrol ECU Remapping',
          summary: 'Deep dive into the Bosch EDC family — injection and boost maps, torque limiters, and stage tuning parameter sets.',
        },
      ]}
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
