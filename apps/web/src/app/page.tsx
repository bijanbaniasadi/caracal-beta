import type { Metadata } from 'next';
import { Hero } from '@/components/home/hero';
import { ServicesSection } from '@/components/home/services';
import { DevicesSection } from '@/components/home/devices-section';
import { GoogleReviewsSection } from '@/components/home/google-reviews';
import { ArticlesTeaser } from '@/components/home/articles-teaser';
import { CtaStrip } from '@/components/home/cta-strip';

export const metadata: Metadata = {
  title: 'ECU Tuning Dubai | Workshop Technical Support | Caracal Tech Motors',
  description:
    'Professional ECU tuning, diagnostics, IMMO, DPF, EGR, AdBlue support, ECU lookup, and technical workshop assistance for Dubai and UAE trade customers.',
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <ServicesSection />
      <DevicesSection />
      <GoogleReviewsSection />
      <ArticlesTeaser />
      <CtaStrip />
    </>
  );
}
