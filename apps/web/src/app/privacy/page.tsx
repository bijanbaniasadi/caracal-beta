import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Caracal Tech Motors collects, uses, protects, and retains customer, order, vehicle, ECU, and website data.',
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      description="How Caracal Tech Motors handles customer, workshop, order, payment, vehicle, ECU, and website data."
      sections={[
        {
          title: '1. Who We Are',
          body: (
            <p>
              Caracaltech Motors LLC operates caracaltechmotors.com and provides ECU tuning,
              diagnostics, tuning tools, and technical workshop support from Dubai, UAE.
            </p>
          ),
        },
        {
          title: '2. What We Collect',
          body: (
            <ul className="list-disc space-y-2 pl-5">
              <li>Contact and account details such as name, email, phone, and company name.</li>
              <li>
                Order and inquiry details, including requested products and vehicle information.
              </li>
              <li>Uploaded ECU, BIN, diagnostic, image, or support files submitted for service.</li>
              <li>
                Payment references from licensed processors. We do not store full card numbers.
              </li>
              <li>
                Site usage data such as pages visited, browser type, approximate location, and
                referrer.
              </li>
            </ul>
          ),
        },
        {
          title: '3. Why We Use It',
          body: (
            <ul className="list-disc space-y-2 pl-5">
              <li>To respond to quote requests, product inquiries, and workshop support cases.</li>
              <li>To fulfil product orders, digital services, and technical file workflows.</li>
              <li>To improve service quality, catalog accuracy, and website performance.</li>
              <li>To meet UAE legal, tax, audit, fraud-prevention, and security obligations.</li>
            </ul>
          ),
        },
        {
          title: '4. Who We Share It With',
          body: (
            <>
              <p>We share only the information needed to provide the service.</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Payment processors for transactions and refunds.</li>
                <li>Courier and logistics partners for physical deliveries.</li>
                <li>Hosting, analytics, and operational providers under appropriate safeguards.</li>
                <li>Authorities where disclosure is legally required.</li>
              </ul>
              <p>We do not sell personal data or share it for third-party marketing.</p>
            </>
          ),
        },
        {
          title: '5. Retention And Security',
          body: (
            <p>
              Account and order records may be retained for up to 7 years for tax and audit reasons.
              Uploaded ECU or vehicle files are retained for the support engagement and operational
              reference period unless a longer retention period is agreed. We protect data with TLS,
              access controls, and least-privilege administrative access.
            </p>
          ),
        },
        {
          title: '6. Your Rights',
          body: (
            <p>
              You can request access, correction, deletion, or restriction of your personal data,
              subject to legal retention requirements. Email privacy requests to
              info@caracaltechmotors.com and we will respond within 30 days.
            </p>
          ),
        },
      ]}
    />
  );
}
