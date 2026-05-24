import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Shipping Policy',
  description:
    'Delivery options, processing timelines, UAE delivery, international shipping, tracking, and digital delivery for Caracal Tech Motors.',
};

export default function ShippingPage() {
  return (
    <LegalPage
      eyebrow="Delivery"
      title="Shipping Policy"
      description="Delivery timelines and shipping rules for hardware, software licences, tuning files, and workshop support orders."
      sections={[
        {
          title: '1. Where We Ship',
          body: (
            <p>
              We ship physical products across the UAE and internationally to most countries by
              tracked courier. Digital products, tuning files, software licences, and support
              deliverables are sent electronically.
            </p>
          ),
        },
        {
          title: '2. Processing Time',
          body: (
            <ul className="list-disc space-y-2 pl-5">
              <li>In-stock hardware normally dispatches within 1 business day.</li>
              <li>Pre-order or supplier-order items normally dispatch within 3-7 business days.</li>
              <li>Custom tuning file turnaround is usually 12-48 hours after a clean file read.</li>
            </ul>
          ),
        },
        {
          title: '3. UAE Delivery',
          body: (
            <ul className="list-disc space-y-2 pl-5">
              <li>Dubai and Sharjah: usually 1 business day after dispatch.</li>
              <li>
                Abu Dhabi, Ajman, Ras Al Khaimah, Fujairah, and Umm Al Quwain: usually 1-2 business
                days.
              </li>
              <li>
                Flat UAE shipping reference: AED 25, with free shipping eligibility on qualifying
                orders.
              </li>
            </ul>
          ),
        },
        {
          title: '4. International Delivery',
          body: (
            <ul className="list-disc space-y-2 pl-5">
              <li>GCC: usually 3-5 business days from dispatch.</li>
              <li>Europe, Asia, and Africa: usually 5-10 business days.</li>
              <li>Americas and Oceania: usually 7-14 business days.</li>
              <li>
                Import duties, VAT, customs fees, and clearance charges are paid by the recipient.
              </li>
            </ul>
          ),
        },
        {
          title: '5. Tracking And Damaged Shipments',
          body: (
            <p>
              Tracking details are sent once the order is dispatched. If a tracked shipment stops
              moving for more than 5 business days, or if an item arrives damaged, contact us within
              48 hours with photos so we can open a courier claim.
            </p>
          ),
        },
        {
          title: '6. Digital Delivery',
          body: (
            <p>
              Tuning files, licence keys, and digital deliverables are sent to the contact email
              provided in the request or order. Please keep your email address accurate and monitor
              spam or junk folders.
            </p>
          ),
        },
      ]}
    />
  );
}
