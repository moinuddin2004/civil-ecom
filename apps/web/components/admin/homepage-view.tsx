'use client';

import {
  MAX_BANNERS,
  MAX_HOMEPAGE_PRODUCTS,
  PRODUCT_STATUS_LABELS,
  type AdminHomepageDTO,
  type AdminProductListItemDTO,
  type ApiListResponse,
  type ApiResponse,
  type HomepageInput,
  type ProductStatus,
} from '@aricon/shared';
import { AlertCircle, ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AccessDenied } from '@/components/admin/access-denied';
import { SingleImageUpload } from '@/components/admin/single-image-upload';
import { Pill } from '@/components/shop/status-badges';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useAdminSession } from '@/lib/admin/session';
import { apiClient } from '@/lib/api-client';
import { errorMessage, fieldErrors, type FieldError } from '@/lib/api-errors';

export interface HomepageViewProps {
  homepage: AdminHomepageDTO;
}

interface BannerDraft {
  /** The banner's id; for a new banner, a local placeholder until its desktop image is uploaded. */
  id: string;
  /** False until a new banner's first upload gave it a real id. */
  saved: boolean;
  desktopKey: string;
  mobileKey: string | null;
  alt: string;
  link: string;
  isActive: boolean;
}

/** What a picked product's row shows. Picks loaded with the homepage carry no brand; search results do. */
interface PickedProduct {
  name: string;
  brandName: string | null;
  status: ProductStatus;
}

type PickList = 'featuredProductIds' | 'dealProductIds';

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_PAGE_SIZE = 10;

function moveItem<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item as T);
  return next;
}

function bannerDrafts(homepage: AdminHomepageDTO): BannerDraft[] {
  return homepage.banners.map((b) => ({
    id: b.id,
    saved: true,
    desktopKey: b.desktopKey,
    mobileKey: b.mobileKey,
    alt: b.alt,
    link: b.link ?? '',
    isActive: b.isActive,
  }));
}

/** id → row details for every pick on `homepage`, keeping brands already learned from search results. */
function pickedProducts(homepage: AdminHomepageDTO, known?: ReadonlyMap<string, PickedProduct>): Map<string, PickedProduct> {
  const map = new Map(known);
  for (const product of [...homepage.featuredProducts, ...homepage.dealProducts]) {
    map.set(product.id, { name: product.name, brandName: known?.get(product.id)?.brandName ?? null, status: product.status });
  }
  return map;
}

function InlineError({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <p className="flex items-start gap-1 text-sm text-danger">
      <AlertCircle aria-hidden strokeWidth={1.75} className="mt-0.5 size-3.5 shrink-0" />
      {message}
    </p>
  );
}

/**
 * Homepage manager (SPEC §10.10, DESIGN.md §9.6): banners, featured products and deal products,
 * each reorderable with up/down controls (an accepted, simpler alternative to drag-and-drop).
 * "Save homepage" replaces all three with `PUT /api/admin/homepage`, which also refreshes the
 * storefront home page. Products are picked by searching active products as you type.
 */
export function HomepageView({ homepage }: HomepageViewProps) {
  const { me } = useAdminSession();
  const router = useRouter();
  const [banners, setBanners] = useState<BannerDraft[]>(() => bannerDrafts(homepage));
  const [featuredIds, setFeaturedIds] = useState<string[]>(() => homepage.featuredProducts.map((p) => p.id));
  const [dealIds, setDealIds] = useState<string[]>(() => homepage.dealProducts.map((p) => p.id));
  const [products, setProducts] = useState<Map<string, PickedProduct>>(() => pickedProducts(homepage));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);

  if (!me) return null;
  if (!me.permissions.includes('homepage.manage')) return <AccessDenied />;

  function errorAt(path: string): string | undefined {
    return errors.find((error) => error.path === path)?.message;
  }

  /** Reordering or removing shifts the indexes the API's errors refer to, so those errors are cleared. */
  function clearErrors(prefix: 'banners' | PickList) {
    setErrors((prev) => prev.filter((error) => !error.path.startsWith(prefix)));
  }

  function updateBanner(id: string, change: Partial<BannerDraft>) {
    setBanners((prev) => prev.map((b) => (b.id === id ? { ...b, ...change } : b)));
  }

  function changeBanners(next: (prev: BannerDraft[]) => BannerDraft[]) {
    setBanners(next);
    clearErrors('banners');
  }

  function changePicks(list: PickList, ids: string[]) {
    if (list === 'featuredProductIds') setFeaturedIds(ids);
    else setDealIds(ids);
    clearErrors(list);
  }

  function addPick(list: PickList, product: AdminProductListItemDTO) {
    setProducts((prev) => new Map(prev).set(product.id, { name: product.name, brandName: product.brandName, status: product.status }));
    changePicks(list, [...(list === 'featuredProductIds' ? featuredIds : dealIds), product.id]);
  }

  // Errors with a place on this page are shown there; anything else is listed under the save button.
  const inlinePaths = new Set<string>([
    'banners',
    'featuredProductIds',
    'dealProductIds',
    ...banners.flatMap((_, index) => ['alt', 'link', 'desktopKey', 'mobileKey'].map((field) => `banners.${index}.${field}`)),
    ...featuredIds.map((_, index) => `featuredProductIds.${index}`),
    ...dealIds.map((_, index) => `dealProductIds.${index}`),
  ]);
  const otherErrors = errors.filter((error) => !inlinePaths.has(error.path));
  const pointToFields = errors.some((error) => inlinePaths.has(error.path) && error.message !== formError);

  async function saveHomepage() {
    if (banners.some((banner) => !banner.desktopKey)) {
      setFormError('Upload a desktop image for every banner, or remove the empty ones.');
      return;
    }
    setSaving(true);
    setFormError(null);
    setErrors([]);
    const body: HomepageInput = {
      banners: banners.map((banner, index) => ({
        id: banner.id,
        desktopKey: banner.desktopKey,
        mobileKey: banner.mobileKey,
        alt: banner.alt,
        link: banner.link.trim() || null,
        isActive: banner.isActive,
        sortOrder: index,
      })),
      featuredProductIds: featuredIds,
      dealProductIds: dealIds,
    };
    try {
      const { data } = await apiClient<ApiResponse<AdminHomepageDTO>>('/admin/homepage', { method: 'PUT', body });
      setBanners(bannerDrafts(data));
      setFeaturedIds(data.featuredProducts.map((p) => p.id));
      setDealIds(data.dealProducts.map((p) => p.id));
      setProducts((prev) => pickedProducts(data, prev));
      toast.success('Homepage saved');
      router.refresh();
    } catch (error) {
      setErrors(fieldErrors(error));
      setFormError(errorMessage(error, "We couldn't save the homepage. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="type-h1">Homepage</h1>
          <Button size="sm" loading={saving} onClick={() => void saveHomepage()}>
            Save homepage
          </Button>
        </div>
        <FormError message={formError && pointToFields ? `${formError} Check the fields marked in red.` : formError} />
        {otherErrors.length > 0 ? (
          <ul className="list-disc pl-5 text-sm text-danger">
            {otherErrors.map((error) => (
              <li key={`${error.path}:${error.message}`}>{error.message}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <section className="rounded-xl border border-concrete-150 bg-surface p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="type-h3">Banners</h2>
            <p className="mt-1 text-sm text-cement">Desktop images are shown 1600 px wide, mobile ones 800 px. Without a mobile image the desktop one is used.</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={banners.length >= MAX_BANNERS}
            title={banners.length >= MAX_BANNERS ? `At most ${MAX_BANNERS} banners.` : undefined}
            onClick={() =>
              changeBanners((prev) => [...prev, { id: `new-${Date.now()}`, saved: false, desktopKey: '', mobileKey: null, alt: '', link: '', isActive: true }])
            }
          >
            <Plus aria-hidden strokeWidth={1.75} className="size-4" />
            Add banner
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {banners.map((banner, index) => (
            <div key={banner.id} className="flex flex-col gap-2 rounded-md border border-concrete-150 p-3">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex flex-col gap-3">
                  {(['desktop', 'mobile'] as const).map((variant) => (
                    <SingleImageUpload
                      key={variant}
                      label={variant === 'desktop' ? 'Desktop image' : 'Mobile image (optional)'}
                      endpoint="/admin/uploads/banner"
                      ownerField="bannerId"
                      ownerId={banner.saved ? banner.id : undefined}
                      fields={{ variant }}
                      aspect="wide"
                      required={variant === 'desktop'}
                      value={variant === 'desktop' ? banner.desktopKey || null : banner.mobileKey}
                      onChange={(key, ownerId) => {
                        const change = variant === 'desktop' ? { desktopKey: key ?? '' } : { mobileKey: key };
                        // A new banner takes the id its first image was uploaded under.
                        if (!banner.saved && ownerId) changeBanners((prev) => prev.map((b) => (b.id === banner.id ? { ...b, ...change, id: ownerId, saved: true } : b)));
                        else updateBanner(banner.id, change);
                      }}
                    />
                  ))}
                </div>
                <div className="flex min-w-56 flex-1 flex-col gap-2">
                  <FormField label="Alt text" htmlFor={`banner-${banner.id}-alt`} error={errorAt(`banners.${index}.alt`)}>
                    <Input
                      id={`banner-${banner.id}-alt`}
                      size="sm"
                      aria-invalid={errorAt(`banners.${index}.alt`) ? true : undefined}
                      value={banner.alt}
                      onChange={(e) => updateBanner(banner.id, { alt: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Link" htmlFor={`banner-${banner.id}-link`} error={errorAt(`banners.${index}.link`)}>
                    <Input
                      id={`banner-${banner.id}-link`}
                      size="sm"
                      placeholder="/category/cement-plaster"
                      aria-invalid={errorAt(`banners.${index}.link`) ? true : undefined}
                      value={banner.link}
                      onChange={(e) => updateBanner(banner.id, { link: e.target.value })}
                    />
                  </FormField>
                </div>
                <div className="flex items-center gap-2 self-center">
                  <Switch checked={banner.isActive} onCheckedChange={(checked) => updateBanner(banner.id, { isActive: checked })} aria-label="Banner active" />
                  <span className="text-xs text-ink-700">{banner.isActive ? 'Active' : 'Inactive'}</span>
                </div>
                <div className="flex items-center gap-1 self-center">
                  <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => changeBanners((prev) => moveItem(prev, index, -1))} aria-label="Move up">
                    <ArrowUp aria-hidden strokeWidth={1.75} className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" disabled={index === banners.length - 1} onClick={() => changeBanners((prev) => moveItem(prev, index, 1))} aria-label="Move down">
                    <ArrowDown aria-hidden strokeWidth={1.75} className="size-4" />
                  </Button>
                  <Button type="button" variant="destructive-ghost" size="icon-sm" onClick={() => changeBanners((prev) => prev.filter((b) => b.id !== banner.id))} aria-label="Remove banner">
                    <Trash2 aria-hidden strokeWidth={1.75} className="size-4" />
                  </Button>
                </div>
              </div>
              <InlineError message={errorAt(`banners.${index}.desktopKey`)} />
              <InlineError message={errorAt(`banners.${index}.mobileKey`)} />
            </div>
          ))}
          {banners.length === 0 ? <p className="text-sm text-cement">No banners yet.</p> : null}
          <InlineError message={errorAt('banners')} />
        </div>
      </section>

      <ProductPicker
        title="Featured products"
        list="featuredProductIds"
        selectedIds={featuredIds}
        products={products}
        errorAt={errorAt}
        onAdd={(product) => addPick('featuredProductIds', product)}
        onChange={(ids) => changePicks('featuredProductIds', ids)}
      />
      <ProductPicker
        title="Deal products"
        list="dealProductIds"
        selectedIds={dealIds}
        products={products}
        errorAt={errorAt}
        onAdd={(product) => addPick('dealProductIds', product)}
        onChange={(ids) => changePicks('dealProductIds', ids)}
      />
    </div>
  );
}

interface SearchResult {
  query: string;
  items: AdminProductListItemDTO[];
  error: string | null;
}

function ProductPicker({
  title,
  list,
  selectedIds,
  products,
  errorAt,
  onAdd,
  onChange,
}: {
  title: string;
  list: PickList;
  selectedIds: string[];
  products: ReadonlyMap<string, PickedProduct>;
  errorAt: (path: string) => string | undefined;
  onAdd: (product: AdminProductListItemDTO) => void;
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult>({ query: '', items: [], error: null });
  const q = query.trim();
  const atLimit = selectedIds.length >= MAX_HOMEPAGE_PRODUCTS;
  const inputId = `${list}-search`;

  // Debounced search of active products; a newer query (or unmount) cancels the one in flight.
  useEffect(() => {
    if (!q) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q, status: 'active', pageSize: String(SEARCH_PAGE_SIZE) });
      apiClient<ApiListResponse<AdminProductListItemDTO>>(`/admin/products?${params.toString()}`, { signal: controller.signal })
        .then(({ data }) => setResult({ query: q, items: data, error: null }))
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setResult({ query: q, items: [], error: errorMessage(error, "We couldn't search products. Please try again.") });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const settled = q !== '' && result.query === q;

  return (
    <section className="rounded-xl border border-concrete-150 bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="type-h3">{title}</h2>
        <span className="text-sm text-cement">
          {selectedIds.length} / {MAX_HOMEPAGE_PRODUCTS}
        </span>
      </div>

      <div className="relative mb-3">
        <FormField label="Add a product" htmlFor={inputId}>
          <Input
            id={inputId}
            size="sm"
            type="search"
            autoComplete="off"
            maxLength={100}
            placeholder="Search active products by name, brand or SKU"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQuery('');
            }}
            disabled={atLimit}
          />
        </FormField>
        {q ? (
          <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-concrete-150 bg-surface shadow-float">
            {!settled ? (
              <p className="px-3 py-2 text-sm text-cement">Searching…</p>
            ) : result.error ? (
              <p className="px-3 py-2 text-sm text-danger">{result.error}</p>
            ) : result.items.length === 0 ? (
              <p className="px-3 py-2 text-sm text-cement">No active products match “{q}”.</p>
            ) : (
              <ul>
                {result.items.map((product) => {
                  const added = selectedIds.includes(product.id);
                  return (
                    <li key={product.id}>
                      <button
                        type="button"
                        disabled={added}
                        className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-concrete-50 disabled:cursor-default disabled:text-cement disabled:hover:bg-transparent"
                        onClick={() => {
                          onAdd(product);
                          setQuery('');
                        }}
                      >
                        <span className="truncate">{product.name}</span>
                        <span className="shrink-0 text-xs text-cement">{added ? 'Added' : product.brandName}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </div>
      {atLimit ? <p className="mb-3 text-xs text-cement">Remove a product to add another — {MAX_HOMEPAGE_PRODUCTS} maximum.</p> : null}

      <ul className="flex flex-col gap-2">
        {selectedIds.map((id, index) => {
          const product = products.get(id);
          return (
            <li key={id} className="flex flex-col gap-1 rounded-md border border-concrete-150 px-3 py-2">
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{product?.name ?? 'Unknown product'}</span>
                {product?.brandName ? <span className="shrink-0 text-xs text-cement">{product.brandName}</span> : null}
                {product && product.status !== 'active' ? (
                  <Pill tone="neutral" size="sm" className="shrink-0">
                    {PRODUCT_STATUS_LABELS[product.status]} · not shown
                  </Pill>
                ) : null}
                <div className="flex shrink-0 items-center gap-1">
                  <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => onChange(moveItem(selectedIds, index, -1))} aria-label="Move up">
                    <ArrowUp aria-hidden strokeWidth={1.75} className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" disabled={index === selectedIds.length - 1} onClick={() => onChange(moveItem(selectedIds, index, 1))} aria-label="Move down">
                    <ArrowDown aria-hidden strokeWidth={1.75} className="size-4" />
                  </Button>
                  <Button type="button" variant="destructive-ghost" size="icon-sm" onClick={() => onChange(selectedIds.filter((i) => i !== id))} aria-label="Remove">
                    <X aria-hidden strokeWidth={1.75} className="size-4" />
                  </Button>
                </div>
              </div>
              <InlineError message={errorAt(`${list}.${index}`)} />
            </li>
          );
        })}
        {selectedIds.length === 0 ? <li className="text-sm text-cement">No products picked yet.</li> : null}
      </ul>
      <InlineError message={errorAt(list)} />
    </section>
  );
}
