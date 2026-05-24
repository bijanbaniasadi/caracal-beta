'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminProduct, ProductCreateInput } from '@/lib/api/admin-types';
type AdminProductDetail = AdminProduct;
type AdminProductInput = ProductCreateInput;
import type { ProductStatus, InventoryStatus } from '@/lib/api/catalog-types';
import { useCreateProduct, useUpdateProduct } from '@/hooks/queries/use-admin-products';
import { useToastContext } from '@/lib/toast/context';

interface ProductFormProps {
  /** Pass existing product for edit mode; omit for create */
  product?: AdminProductDetail;
}

// ─── Field components ─────────────────────────────────────────────────────────

function Field({
  label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-brand-muted">
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-brand-text placeholder-brand-muted/50 outline-none transition-colors focus:border-brand-orange/50 focus:ring-1 focus:ring-brand-orange/30';

const selectCls =
  'w-full rounded-lg border border-white/10 bg-[#0f1923] px-3 py-2.5 text-sm text-brand-text outline-none transition-colors focus:border-brand-orange/50';

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductForm({ product }: ProductFormProps) {
  const router = useRouter();
  const { addToast } = useToastContext();
  const isEdit = !!product;

  const [name, setName]             = useState(product?.name ?? '');
  const [sku, setSku]               = useState(product?.sku ?? '');
  const [slug, setSlug]             = useState(product?.slug ?? '');
  const [shortDesc, setShortDesc]   = useState(product?.shortDescription ?? '');
  const [description, setDesc]      = useState(product?.description ?? '');
  const [status, setStatus]         = useState<ProductStatus>(product?.status ?? 'DRAFT');
  const [categoryId, setCategoryId] = useState(product?.category?.id ?? '');
  const [priceCents, setPriceCents] = useState(
    product?.priceCents ? String(product.priceCents / 100) : '',
  );
  const [tradePriceCents, setTradePriceCents] = useState(
    product?.tradePriceCents ? String(product.tradePriceCents / 100) : '',
  );
  const [tradeOnly, setTradeOnly]     = useState(product?.isTradeOnly ?? false);
  const [featured, setFeatured]       = useState(product?.isFeatured ?? false);
  const [b2bEligible, setB2bEligible] = useState(product?.isB2BEligible ?? false);
  const [invStatus, setInvStatus]     = useState<InventoryStatus>(
    product?.inventory.summary.status ?? 'OUT_OF_STOCK',
  );
  const [qty, setQty]             = useState(String(product?.inventory.summary.quantityOnHand ?? 0));
  const [reorderPt, setReorderPt] = useState(String(product?.inventory.summary.reorderPoint ?? ''));
  const [error, setError]         = useState('');

  const createMut = useCreateProduct();
  const updateMut = useUpdateProduct(product?.id ?? '');
  const isPending = createMut.isPending || updateMut.isPending;

  // Auto-slug from name
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEdit && !slug) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  };

  const buildInput = (): AdminProductInput => ({
    name,
    slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    sku: sku || name.toUpperCase().replace(/[^A-Z0-9]+/g, '-'),
    shortDescription: shortDesc || undefined,
    description: description || undefined,
    status,
    categoryId: categoryId || undefined,
    priceCents: priceCents ? Math.round(parseFloat(priceCents) * 100) : undefined,
    tradePriceCents: tradePriceCents ? Math.round(parseFloat(tradePriceCents) * 100) : undefined,
    isTradeOnly: tradeOnly,
    isFeatured: featured,
    isB2BEligible: b2bEligible,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const input = buildInput();

    try {
      if (isEdit) {
        await updateMut.mutateAsync(input);
        addToast({ variant: 'success', title: 'Product updated' });
      } else {
        await createMut.mutateAsync(input);
        addToast({ variant: 'success', title: 'Product created' });
        router.push('/admin/products');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setError(msg);
      addToast({ variant: 'error', title: 'Save failed', description: msg });
    }
  };

  return (
    <form
      onSubmit={(e) => { void handleSubmit(e); }}
      className="space-y-8"
    >
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── Core details ────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="mb-5 font-display text-sm font-bold uppercase tracking-wider text-brand-muted">
          Core Details
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Product Name" required>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. KESS3 Master"
              required
            />
          </Field>
          <Field label="SKU">
            <input
              className={inputCls}
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="e.g. kess3-master"
            />
          </Field>
          <Field label="URL Slug">
            <input
              className={`${inputCls} font-mono`}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="auto-generated from name"
            />
          </Field>
          <Field label="Status" required>
            <select
              className={selectCls}
              value={status}
              onChange={(e) => setStatus(e.target.value as ProductStatus)}
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Short Description">
              <input
                className={inputCls}
                value={shortDesc}
                onChange={(e) => setShortDesc(e.target.value)}
                placeholder="One-line summary (shown in cards)"
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Full Description">
              <textarea
                className={`${inputCls} min-h-[120px] resize-y`}
                value={description}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Detailed product description…"
              />
            </Field>
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="mb-5 font-display text-sm font-bold uppercase tracking-wider text-brand-muted">
          Pricing (AED)
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Retail Price (AED)">
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm text-brand-muted">AED</span>
              <input
                className={`${inputCls} pl-12`}
                type="number"
                min="0"
                step="0.01"
                value={priceCents}
                onChange={(e) => setPriceCents(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </Field>
          <Field label="Trade Price (AED)">
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm text-brand-muted">AED</span>
              <input
                className={`${inputCls} pl-12`}
                type="number"
                min="0"
                step="0.01"
                value={tradePriceCents}
                onChange={(e) => setTradePriceCents(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </Field>
          <Field label="Category ID">
            <input
              className={inputCls}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              placeholder="category-cuid"
            />
          </Field>
        </div>
      </section>

      {/* ── Inventory ────────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="mb-5 font-display text-sm font-bold uppercase tracking-wider text-brand-muted">
          Inventory
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Stock Status">
            <select
              className={selectCls}
              value={invStatus}
              onChange={(e) => setInvStatus(e.target.value as InventoryStatus)}
            >
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
              <option value="DISCONTINUED">Discontinued</option>
            </select>
          </Field>
          <Field label="Quantity on Hand">
            <input
              className={inputCls}
              type="number"
              min="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </Field>
          <Field label="Reorder Point">
            <input
              className={inputCls}
              type="number"
              min="0"
              value={reorderPt}
              onChange={(e) => setReorderPt(e.target.value)}
              placeholder="e.g. 2"
            />
          </Field>
        </div>
      </section>

      {/* ── Flags ────────────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="mb-5 font-display text-sm font-bold uppercase tracking-wider text-brand-muted">
          Flags
        </h2>
        <div className="flex flex-wrap gap-6">
          {(
            [
              { id: 'tradeOnly',   label: 'Trade Only',    state: tradeOnly,   set: setTradeOnly },
              { id: 'featured',    label: '★ Featured',    state: featured,    set: setFeatured },
              { id: 'b2bEligible', label: 'B2B Eligible',  state: b2bEligible, set: setB2bEligible },
            ] as const
          ).map(({ id, label, state, set }) => (
            <label key={id} className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                id={id}
                checked={state}
                onChange={(e) => (set as (v: boolean) => void)(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/10 accent-brand-orange"
              />
              <span className="text-sm font-medium text-brand-text">{label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* ── Actions ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-brand-muted transition-colors hover:bg-white/5 hover:text-brand-text"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-brand-orange px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : isEdit ? 'Update Product' : 'Create Product'}
        </button>
      </div>
    </form>
  );
}
