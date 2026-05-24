import type { Metadata } from 'next';
import { Hero } from '@/components/home/hero';
import { ServicesSection } from '@/components/home/services';
import { DevicesSection } from '@/components/home/devices-section';
import { ArticlesTeaser } from '@/components/home/articles-teaser';
import { CtaStrip } from '@/components/home/cta-strip';

export const metadata: Metadata = {
  title: 'Caracal Tech Motors — ECU Tuning Tools & Workshop Support Dubai',
  description:
    'Professional ECU tuning tools, file services, and workshop support in Dubai. KESS3, AutoTuner, BFlash, DPF off, EGR delete, IMMO off and more.',
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <ServicesSection />
      <DevicesSection />
      <ArticlesTeaser />
      <CtaStrip />
    </>
  );
}
