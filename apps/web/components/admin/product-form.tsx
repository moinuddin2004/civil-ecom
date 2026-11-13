'use client';

import {
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUSES,
  slugify,
  UNIT_LABELS,
  UNITS,
  type AdminBrandDTO,
  type AdminCategoryDTO,
  type AdminProductDTO,
  type ApiResponse,
  type Permission,
  type ProductStatus,
} from '@aricon/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { AccessDenied } from '@/components/admin/access-denied';
import { ProductImagesEditor } from '@/components/admin/product-images-editor';
import { ProductVariantsEditor } from '@/components/admin/product-variants-editor';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api-client';
import { applyFieldErrors, errorMessage, fieldErrors } from '@/lib/api-errors';
import { categoryOptions } from '@/lib/admin/category-options';
import { useAdminSession } from '@/lib/admin/session';
import {
  createProductBody,
  newVariantBody,
  productFormSchema,
  productFormValues,
  updateProductBody,
  type ProductFormData,
  type ProductFormInput,
} from '@/lib/admin/product-form-schema';

const SECTIONS = [
  { id: 'basics', label: 'Basics' },
  { id: 'images', label: 'Images' },
  { id: 'variants', label: 'Variants' },
  { id: 'specifications', label: 'Specifications' },
  { id: 'description', label: 'Description' },
  { id: 'seo', label: 'SEO' },
] as const;

export interface ProductFormProps {
  mode: 'create' | 'edit';
  product?: AdminProductDTO;
  categories: AdminCategoryDTO[];
  brands: AdminBrandDTO[];
}

type ProductResponse = ApiResponse<AdminProductDTO>;

const FIELDSET_CLASS = 'm-0 flex min-w-0 flex-col gap-6 border-0 p-0';

/** Variant fields the API can report an error on when a new row is added (`POST …/variants`). */
const VARIANT_FIELDS = ['sku', 'label', 'mrp', 'price', 'bulkTiers', 'stock', 'lowStockThreshold', 'isActive'] as const;
type VariantField = (typeof VARIANT_FIELDS)[number];

function isVariantField(path: string): path is VariantField {
  return (VARIANT_FIELDS as readonly string[]).includes(path);
}

/**
 * Product create/edit form (SPEC §10.5, DESIGN.md §9.4): a long page with a sticky section nav and
 * a sticky "Save changes" bar.
 *
 * Saving an existing product is up to three API calls, in this order: `PATCH` (details and saved
 * variants), `POST …/variants` for each new row (each new row gets its id as soon as it is saved, so
 * a retry after a failure never adds it twice), then `POST …/status` if the status changed.
 * Fields follow the viewer's permissions (price, stock, status, adding variants); the API checks
 * every one of them again.
 */
export function ProductForm({ mode, product, categories, brands }: ProductFormProps) {
  const router = useRouter();
  const { me } = useAdminSession();
  const [showPreview, setShowPreview] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  /** A new product: the id its first photo was uploaded under (sent as `id` on create). */
  const [uploadId, setUploadId] = useState<string | undefined>(undefined);

  const form = useForm<ProductFormInput, unknown, ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: productFormValues(product),
  });
  const { register, control, handleSubmit, formState, setError } = form;
  const specifications = useFieldArray({ control, name: 'specifications' });
  const description = useWatch({ control, name: 'description' }) ?? '';
  const nameValue = useWatch({ control, name: 'name' });
  const imagesValue = useWatch({ control, name: 'images' }) ?? [];

  const categoryChoices = useMemo(() => categoryOptions(categories, 'id'), [categories]);

  if (!me) return null;
  const can = (perm: Permission) => me.permissions.includes(perm);
  if (!can('products.view')) return <AccessDenied />;
  const canSave = mode === 'create' ? can('products.create') : can('products.edit');
  const canEditPrice = can('products.edit_price');
  const canEditStock = can('products.edit_stock');
  const canChangeStatus = mode === 'create' || can('products.archive');
  const canAddVariant = mode === 'create' || canEditPrice;
  const statusOptions = Object.entries(PRODUCT_STATUS_LABELS)
    .filter(([value]) => mode === 'edit' || value !== 'archived')
    .map(([value, label]) => ({ value, label }));

  async function createProduct(values: ProductFormData) {
    const { data } = await apiClient<ProductResponse>('/admin/products', {
      method: 'POST',
      body: createProductBody(values, canEditStock, uploadId),
    });
    toast.success('Product created');
    router.replace(`/admin/products/${data.id}`);
  }

  async function updateProduct(saved: AdminProductDTO, values: ProductFormData) {
    const path = `/admin/products/${saved.id}`;
    let latest = (await apiClient<ProductResponse>(path, { method: 'PATCH', body: updateProductBody(values) })).data;

    for (const [index, variant] of values.variants.entries()) {
      if (variant.id) continue;
      try {
        latest = (
          await apiClient<ProductResponse>(`${path}/variants`, { method: 'POST', body: newVariantBody(variant, canEditStock) })
        ).data;
      } catch (error) {
        for (const field of fieldErrors(error)) {
          if (isVariantField(field.path)) setError(`variants.${index}.${field.path}`, { type: 'server', message: field.message });
        }
        setFormError(`Details saved, but the variant "${variant.label}" wasn't added: ${errorMessage(error)}`);
        router.refresh();
        return;
      }
      const added = latest.variants.find((item) => item.sku === variant.sku);
      if (added) form.setValue(`variants.${index}.id`, added.id);
    }

    if (values.status !== latest.status) {
      try {
        latest = (await apiClient<ProductResponse>(`${path}/status`, { method: 'POST', body: { status: values.status } })).data;
      } catch (error) {
        setError('status', { type: 'server', message: errorMessage(error) });
        setFormError('Changes saved, but the status was not changed.');
        router.refresh();
        return;
      }
    }

    form.reset(productFormValues(latest));
    toast.success('Product saved');
    router.refresh();
  }

  async function onSubmit(values: ProductFormData) {
    setFormError(null);
    try {
      if (mode === 'create' || !product) await createProduct(values);
      else await updateProduct(product, values);
    } catch (error) {
      if (!applyFieldErrors(error, setError)) setFormError(errorMessage(error));
    }
  }

  const title = mode === 'create' ? 'Add product' : product?.name;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="type-h1">{title}</h1>
          {!canSave ? <p className="text-sm text-cement">View only — you don&apos;t have permission to edit product details.</p> : null}
        </div>
        {!canSave && mode === 'edit' && product && can('products.archive') ? <ProductStatusControl product={product} /> : null}
      </div>

      <nav aria-label="Form sections" className="sticky top-[57px] z-10 -mx-4 flex gap-1 overflow-x-auto border-b border-concrete-150 bg-concrete px-4 py-2 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-surface hover:text-ink"
          >
            {section.label}
          </a>
        ))}
      </nav>

      <fieldset disabled={!canSave || formState.isSubmitting} className={FIELDSET_CLASS}>
        <section id="basics" className="scroll-mt-16 rounded-xl border border-concrete-150 bg-surface p-5 shadow-card">
          <h2 className="type-h3 mb-4">Basics</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Name" htmlFor="product-name" error={formState.errors.name?.message} required className="md:col-span-2">
              <Input id="product-name" size="sm" {...register('name')} />
            </FormField>
            <FormField label="Slug" htmlFor="product-slug" error={formState.errors.slug?.message} hint={`Auto-generated: ${slugify(nameValue || '')}`}>
              <Input id="product-slug" size="sm" placeholder={slugify(nameValue || '') || 'auto-generated'} {...register('slug')} />
            </FormField>
            <FormField label="Type" htmlFor="product-type" error={formState.errors.type?.message} hint="e.g. OPC, Emulsion — used as a filter">
              <Input id="product-type" size="sm" {...register('type')} />
            </FormField>
            <FormField label="Brand" htmlFor="product-brand" error={formState.errors.brandId?.message} required>
              <Controller
                control={control}
                name="brandId"
                render={({ field }) => (
                  <Select
                    id="product-brand"
                    size="sm"
                    placeholder="Choose a brand"
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                    options={brands.map((b) => ({ value: b.id, label: b.name }))}
                  />
                )}
              />
            </FormField>
            <FormField label="Category" htmlFor="product-category" error={formState.errors.categoryId?.message} required>
              <Controller
                control={control}
                name="categoryId"
                render={({ field }) => (
                  <Select
                    id="product-category"
                    size="sm"
                    placeholder="Choose a category"
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                    options={categoryChoices}
                  />
                )}
              />
            </FormField>
            <FormField label="Unit" htmlFor="product-unit" error={formState.errors.unit?.message} required>
              <Controller
                control={control}
                name="unit"
                render={({ field }) => (
                  <Select
                    id="product-unit"
                    size="sm"
                    value={field.value}
                    onValueChange={field.onChange}
                    options={UNITS.map((u) => ({ value: u, label: UNIT_LABELS[u].one }))}
                  />
                )}
              />
            </FormField>
            <FormField
              label="Status"
              htmlFor="product-status"
              error={formState.errors.status?.message}
              hint={canChangeStatus ? 'Active products need an active brand and category.' : "You don't have permission to change the status."}
              required
            >
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select id="product-status" size="sm" disabled={!canChangeStatus} value={field.value} onValueChange={field.onChange} options={statusOptions} />
                )}
              />
            </FormField>
          </div>
        </section>

        <section id="images" className="scroll-mt-16 rounded-xl border border-concrete-150 bg-surface p-5 shadow-card">
          <h2 className="type-h3 mb-4">Images</h2>
          <ProductImagesEditor
            images={imagesValue}
            onChange={(images) => form.setValue('images', images, { shouldDirty: true, shouldValidate: true })}
            productId={product?.id ?? uploadId}
            onProductId={setUploadId}
            productName={nameValue || product?.name || ''}
            disabled={!canSave || formState.isSubmitting}
          />
          {formState.errors.images?.message ? <p className="mt-2 text-sm text-danger">{formState.errors.images.message}</p> : null}
        </section>
      </fieldset>

      {/* Outside the read-only fieldset: "Adjust stock" needs only products.edit_stock. */}
      <section id="variants" className="scroll-mt-16 rounded-xl border border-concrete-150 bg-surface p-5 shadow-card">
        <h2 className="type-h3 mb-4">Variants</h2>
        <ProductVariantsEditor
          form={form}
          productId={mode === 'edit' ? product?.id : undefined}
          readOnly={!canSave || formState.isSubmitting}
          canEditPrice={canEditPrice}
          canEditStock={canEditStock}
          canAddVariant={canSave && canAddVariant}
        />
        {formState.errors.variants?.message ? <p className="mt-2 text-sm text-danger">{formState.errors.variants.message}</p> : null}
      </section>

      <fieldset disabled={!canSave || formState.isSubmitting} className={FIELDSET_CLASS}>
        <section id="specifications" className="scroll-mt-16 rounded-xl border border-concrete-150 bg-surface p-5 shadow-card">
          <h2 className="type-h3 mb-4">Specifications</h2>
          <div className="flex flex-col gap-2">
            {specifications.fields.map((field, index) => (
              <div key={field.id} className="flex flex-wrap items-start gap-2">
                <Input size="sm" className="flex-1" placeholder="Label, e.g. Type" aria-label="Specification label" {...register(`specifications.${index}.label`)} />
                <Input size="sm" className="flex-1" placeholder="Value, e.g. OPC (Ordinary Portland Cement)" aria-label="Specification value" {...register(`specifications.${index}.value`)} />
                <Button type="button" variant="destructive-ghost" size="icon-sm" onClick={() => specifications.remove(index)} aria-label="Remove specification">
                  <Trash2 aria-hidden strokeWidth={1.75} className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => specifications.append({ label: '', value: '' })}>
            <Plus aria-hidden strokeWidth={1.75} className="size-4" />
            Add specification
          </Button>
        </section>

        <section id="description" className="scroll-mt-16 rounded-xl border border-concrete-150 bg-surface p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="type-h3">Description</h2>
            <Button type="button" variant="tertiary" size="sm" onClick={() => setShowPreview((v) => !v)}>
              {showPreview ? 'Edit' : 'Preview'}
            </Button>
          </div>
          {showPreview ? (
            <div className="min-h-30 rounded-md border border-concrete-150 bg-concrete-50 p-4 text-sm text-ink [&_h1]:type-h3 [&_h2]:type-h3 [&_h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:my-2 [&_ul]:list-disc">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{description || '*Nothing to preview yet.*'}</ReactMarkdown>
            </div>
          ) : (
            <FormField label="Description" htmlFor="product-description" hint="Markdown supported (SPEC §5.6, max 20,000 characters)." error={formState.errors.description?.message}>
              <Textarea id="product-description" size="sm" className="min-h-40" {...register('description')} />
            </FormField>
          )}
        </section>

        <section id="seo" className="scroll-mt-16 rounded-xl border border-concrete-150 bg-surface p-5 shadow-card">
          <h2 className="type-h3 mb-4">SEO</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="SEO title" htmlFor="product-seo-title" hint="Optional override, up to 70 characters." error={formState.errors.seo?.title?.message}>
              <Input id="product-seo-title" size="sm" {...register('seo.title')} />
            </FormField>
            <FormField label="SEO description" htmlFor="product-seo-description" hint="Optional override, up to 160 characters." error={formState.errors.seo?.description?.message}>
              <Input id="product-seo-description" size="sm" {...register('seo.description')} />
            </FormField>
          </div>
        </section>
      </fieldset>

      <div className="sticky bottom-0 z-10 -mx-4 -mb-6 flex flex-wrap items-center justify-end gap-3 border-t border-concrete-150 bg-surface px-4 py-3 shadow-lifted md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <FormError message={formError} className="mr-auto" />
        <Button type="button" variant="secondary" onClick={() => router.push('/admin/products')}>
          {canSave ? 'Cancel' : 'Back to products'}
        </Button>
        {canSave ? (
          <Button type="submit" loading={formState.isSubmitting}>
            {mode === 'create' ? 'Create product' : 'Save changes'}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/**
 * Status on its own (`POST …/status`, `products.archive`) for staff who may archive or hide a
 * product but not edit its details.
 */
function ProductStatusControl({ product }: { product: AdminProductDTO }) {
  const router = useRouter();
  const [status, setStatus] = useState<ProductStatus>(product.status);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await apiClient<ProductResponse>(`/admin/products/${product.id}/status`, { method: 'POST', body: { status } });
      toast.success('Status updated');
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-end gap-2">
      <FormField label="Status" htmlFor="product-status-only">
        <Select
          id="product-status-only"
          size="sm"
          value={status}
          onChange={(event) => setStatus(PRODUCT_STATUSES.find((value) => value === event.target.value) ?? product.status)}
          options={PRODUCT_STATUSES.map((value) => ({ value, label: PRODUCT_STATUS_LABELS[value] }))}
        />
      </FormField>
      <Button type="button" variant="secondary" size="sm" loading={saving} disabled={status === product.status} onClick={() => void save()}>
        Update status
      </Button>
    </div>
  );
}
