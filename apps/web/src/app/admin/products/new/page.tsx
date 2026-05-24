import { ProductForm } from '@/components/admin/products/product-form';

export default function NewProductPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-6 font-display text-lg font-bold text-brand-text">
        New Product
      </h2>
      <ProductForm />
    </div>
  );
}
