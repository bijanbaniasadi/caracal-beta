import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Terms governing Caracal Tech Motors website use, ECU tuning services, product purchases, and workshop support.',
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      description="The terms that apply when you use the website, request services, buy products, or submit files to Caracal Tech Motors."
      sections={[
        {
          title: '1. Acceptance',
          body: (
            <p>
              By accessing this website, submitting a request, uploading a file, or placing an
              order, you agree to these terms. If you do not agree, please do not use the site.
            </p>
          ),
        },
        {
          title: '2. Services',
          body: (
            <ul className="list-disc space-y-2 pl-5">
              <li>ECU remapping, diagnostics, and technical workshop support.</li>
              <li>Sale of tuning tools, hardware, software licences, and accessories.</li>
              <li>Technical file services, BIN analysis, and workshop consultation workflows.</li>
              <li>Educational content for professional tuners and workshop technicians.</li>
            </ul>
          ),
        },
        {
          title: '3. Intended Use',
          body: (
            <p>
              Many products and services require professional automotive knowledge and suitable
              workshop equipment. You are responsible for using tools, files, and advice safely and
              in compliance with all laws and vehicle regulations in your jurisdiction.
            </p>
          ),
        },
        {
          title: '4. Pricing And Payment',
          body: (
            <ul className="list-disc space-y-2 pl-5">
              <li>Prices are listed in AED unless stated otherwise.</li>
              <li>
                Orders and quotes are subject to stock, supplier availability, and final
                confirmation.
              </li>
              <li>
                Payment may be handled by approved payment processors or manual bank transfer.
              </li>
              <li>
                We may cancel and refund an order if a pricing, stock, or compatibility error is
                found.
              </li>
            </ul>
          ),
        },
        {
          title: '5. Workshop Responsibility',
          body: (
            <p>
              ECU tuning and module programming carry mechanical and operational risk. The customer
              or workshop is responsible for confirming vehicle condition, maintaining backups, and
              validating changes. Our liability is limited to the value of the specific product or
              service purchased, except where law requires otherwise.
            </p>
          ),
        },
        {
          title: '6. Intellectual Property',
          body: (
            <p>
              Website content, articles, training material, original files, and service deliverables
              belong to Caracaltech Motors LLC or its licensors. They may not be resold,
              redistributed, or published without written permission.
            </p>
          ),
        },
        {
          title: '7. Governing Law',
          body: (
            <p>
              These terms are governed by the laws of the United Arab Emirates. Disputes are handled
              by the competent courts of Dubai unless mandatory law requires another venue.
            </p>
          ),
        },
      ]}
    />
  );
}
