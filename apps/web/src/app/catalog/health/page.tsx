import type { Metadata } from 'next';
import { ProjectionRuntimePanel } from '@/components/catalog-projection/projection-runtime-panel';

export const metadata: Metadata = {
  title: 'Catalog Projection Health | Caracal Tech',
};

export const dynamic = 'force-dynamic';

export default function CatalogHealthPage() {
  return <ProjectionRuntimePanel />;
}
