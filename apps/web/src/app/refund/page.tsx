import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Refund and Return Policy',
  description:
    'Refund, return, exchange, cancellation, faulty item, and tuning file revision rules for Caracal Tech Motors.',
};

export default function RefundPage() {
  return (
    <LegalPage
      eyebrow="Returns"
      title="Refund and Return Policy"
      description="How returns, refunds, cancellations, exchanges, faulty hardware, and tuning file revisions are handled."
      sections={[
        {
          title: '1. Summary',
          body: (
            <p>
              Hardware in original condition can usually be returned within 14 days. Custom tuning
              files and activated digital products are not refundable once delivered, but eligible
              files can be revised when the agreed service outcome has not been met.
            </p>
          ),
        },
        {
          title: '2. Eligible Returns',
          body: (
            <ul className="list-disc space-y-2 pl-5">
              <li>Unused hardware in original packaging within 14 days of delivery.</li>
              <li>Defective hardware reported within 30 days of delivery.</li>
              <li>Wrong items shipped or duplicate orders caused by processing error.</li>
            </ul>
          ),
        },
        {
          title: '3. Not Eligible For Return',
          body: (
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Custom tuning files already delivered for a specific ECU, vehicle, or project.
              </li>
              <li>
                Activated software licences, activation keys, subscriptions, or training access.
              </li>
              <li>
                Hardware with broken seals, missing components, installation marks, or misuse
                damage.
              </li>
              <li>Used consumables, cables, adapters, or workshop accessories.</li>
            </ul>
          ),
        },
        {
          title: '4. How To Start A Return',
          body: (
            <ol className="list-decimal space-y-2 pl-5">
              <li>Email info@caracaltechmotors.com with the order reference, item, and reason.</li>
              <li>Wait for return authorisation and the return address before shipping.</li>
              <li>
                Return the item tracked, in original packaging, with all supplied accessories.
              </li>
              <li>After inspection, approved refunds are issued within 5 business days.</li>
            </ol>
          ),
        },
        {
          title: '5. Refund Timing',
          body: (
            <p>
              Card refunds go back to the original card and may take 3-10 business days after we
              issue them. Bank transfer refunds are issued to the originating account when possible.
              If the original method is unavailable, store credit may be offered.
            </p>
          ),
        },
        {
          title: '6. Tuning File Revisions',
          body: (
            <p>
              If a tuning file does not behave as agreed, send clear logs and a description of the
              issue. We will review and, where appropriate, revise the file before a refund request
              is considered.
            </p>
          ),
        },
      ]}
    />
  );
}
