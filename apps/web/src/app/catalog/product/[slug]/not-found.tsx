import Link from 'next/link';

export default function CatalogProductNotFound() {
  return (
    <div className="mx-auto max-w-2xl py-20 text-center">
      <p className="text-sm font-semibold text-brand-text">Projected product not found</p>
      <p className="mt-2 text-sm text-brand-muted">
        The product may be unpublished, archived, or not projected yet.
      </p>
      <Link
        href="/catalog"
        className="mt-5 inline-flex rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-brand-text hover:border-brand-orange"
      >
        Back to catalog preview
      </Link>
    </div>
  );
}
