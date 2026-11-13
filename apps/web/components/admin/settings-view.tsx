'use client';

import {
  objectIdSchema,
  PAGE_KEYS,
  PAGE_TITLES,
  type AdminSettingsDTO,
  type ApiResponse,
  type PageKey,
  type SettingsInput,
} from '@aricon/shared';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { AccessDenied } from '@/components/admin/access-denied';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAdminSession } from '@/lib/admin/session';
import { apiClient } from '@/lib/api-client';
import { errorMessage, fieldErrors, type FieldError } from '@/lib/api-errors';

export interface SettingsViewProps {
  settings: AdminSettingsDTO;
}

type BankAccount = AdminSettingsDTO['bankAccounts'][number];

const BANK_ACCOUNT_FIELDS = ['bankName', 'accountTitle', 'accountNumber', 'iban', 'raastId'] as const;

/** Labels for the API's field paths, used when an error has no field of its own on the page. */
const FIELD_LABELS: Record<string, string> = {
  storeName: 'Store name',
  phone: 'Phone',
  whatsapp: 'WhatsApp',
  email: 'Email',
  address: 'Address',
  orderNotificationEmails: 'Order notification emails',
  rfpEmail: 'Inquiries (RFP) email',
  paymentMethods: 'Payment methods',
  codMaxOrderAmount: 'COD maximum order amount',
  defaultDeliveryFee: 'Default delivery fee',
  bankAccounts: 'Bank accounts',
  bankTransferInstructions: 'Bank transfer instructions',
  lowStockDefault: 'Low stock default',
};

function fieldLabel(path: string): string {
  const [head = '', index] = path.split('.');
  if (head === 'bankAccounts' && index !== undefined && /^\d+$/.test(index)) return `Bank account ${Number(index) + 1}`;
  if (head === 'pages') return 'Pages';
  return FIELD_LABELS[head] ?? 'Settings';
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-concrete-150 bg-surface p-5 shadow-card">
      <h2 className="type-h3">{title}</h2>
      {description ? <p className="mt-1 text-sm text-cement">{description}</p> : null}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

/** A field error for controls that aren't wrapped in a `FormField` (lists, switches). */
function InlineError({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <p className="flex items-start gap-1 text-sm text-danger">
      <AlertCircle aria-hidden strokeWidth={1.75} className="mt-0.5 size-3.5 shrink-0" />
      {message}
    </p>
  );
}

/** New accounts get a temporary local id; only saved ones (ObjectIds) are sent back to keep their id. */
function emptyBankAccount(): BankAccount {
  return { id: `bank-new-${Date.now().toString(36)}`, bankName: '', accountTitle: '', accountNumber: '', iban: null, raastId: null };
}

function toSettingsInput(settings: AdminSettingsDTO): SettingsInput {
  return {
    storeName: settings.storeName,
    phone: settings.phone,
    whatsapp: settings.whatsapp,
    email: settings.email,
    address: settings.address,
    // Empty rows left over from "Add email" are dropped rather than rejected.
    orderNotificationEmails: settings.orderNotificationEmails.map((email) => email.trim()).filter(Boolean),
    rfpEmail: settings.rfpEmail,
    paymentMethods: { cod: settings.paymentMethods.cod, bankTransfer: settings.paymentMethods.bankTransfer },
    codMaxOrderAmount: settings.codMaxOrderAmount,
    defaultDeliveryFee: settings.defaultDeliveryFee,
    bankAccounts: settings.bankAccounts.map((account) => ({
      id: objectIdSchema.safeParse(account.id).success ? account.id : undefined,
      bankName: account.bankName,
      accountTitle: account.accountTitle,
      accountNumber: account.accountNumber,
      iban: account.iban ?? undefined,
      raastId: account.raastId ?? undefined,
    })),
    bankTransferInstructions: settings.bankTransferInstructions,
    lowStockDefault: settings.lowStockDefault,
    pages: { ...settings.pages },
  };
}

/**
 * `/admin/settings` (SPEC §10.12, ADMIN only, SPEC §4.3). "Save changes" replaces the whole
 * settings document with `PUT /api/admin/settings`; the API audits what changed and refreshes the
 * storefront pages that show these values.
 */
export function SettingsView({ settings: initialSettings }: SettingsViewProps) {
  const { me } = useAdminSession();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<AdminSettingsDTO>(initialSettings);
  /** The last saved values, what "Discard changes" goes back to. */
  const [saved, setSaved] = useState<AdminSettingsDTO>(initialSettings);
  const [previewing, setPreviewing] = useState<Set<PageKey>>(new Set());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const focusFirstError = useRef(false);

  // After a rejected save, bring the first marked field into view; the page is long.
  useEffect(() => {
    if (!focusFirstError.current) return;
    focusFirstError.current = false;
    containerRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);

  if (!me || me.user.role !== 'ADMIN') return <AccessDenied />;

  function togglePreview(key: PageKey) {
    setPreviewing((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function errorAt(path: string): string | undefined {
    return errors.find((error) => error.path === path)?.message;
  }

  function invalid(path: string): true | undefined {
    return errorAt(path) ? true : undefined;
  }

  // Errors with a field on this page are shown next to it; anything else is listed by the save button.
  const inlinePaths = new Set<string>([
    ...Object.keys(FIELD_LABELS),
    ...settings.bankAccounts.flatMap((_, index) => BANK_ACCOUNT_FIELDS.map((field) => `bankAccounts.${index}.${field}`)),
    ...PAGE_KEYS.map((key) => `pages.${key}`),
  ]);
  const otherErrors = errors.filter((error) => !inlinePaths.has(error.path));
  const pointToFields = errors.some((error) => inlinePaths.has(error.path) && error.message !== formError);

  /** Adding or removing an account shifts the indexes the API's errors refer to, so they're cleared. */
  function setBankAccounts(update: (accounts: BankAccount[]) => BankAccount[]) {
    setSettings((p) => ({ ...p, bankAccounts: update(p.bankAccounts) }));
    setErrors((prev) => prev.filter((error) => !error.path.startsWith('bankAccounts')));
  }

  async function handleSave() {
    setSaving(true);
    setFormError(null);
    setErrors([]);
    try {
      const { data } = await apiClient<ApiResponse<AdminSettingsDTO>>('/admin/settings', {
        method: 'PUT',
        body: toSettingsInput(settings),
      });
      setSettings(data);
      setSaved(data);
      toast.success('Settings saved');
      router.refresh();
    } catch (error) {
      const list = fieldErrors(error);
      focusFirstError.current = list.length > 0;
      setErrors(list);
      setFormError(errorMessage(error, "We couldn't save the settings. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setSettings(saved);
    setErrors([]);
    setFormError(null);
  }

  const notificationEmails = settings.orderNotificationEmails;

  return (
    <div ref={containerRef} className="flex flex-col gap-6">
      <h1 className="type-h1">Settings</h1>

      <Section title="Store info">
        <FormField label="Store name" htmlFor="s-store-name" error={errorAt('storeName')}>
          <Input
            id="s-store-name"
            size="sm"
            aria-invalid={invalid('storeName')}
            value={settings.storeName}
            onChange={(e) => setSettings((p) => ({ ...p, storeName: e.target.value }))}
          />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Phone" htmlFor="s-phone" error={errorAt('phone')}>
            <Input
              id="s-phone"
              size="sm"
              aria-invalid={invalid('phone')}
              value={settings.phone}
              onChange={(e) => setSettings((p) => ({ ...p, phone: e.target.value }))}
            />
          </FormField>
          <FormField label="WhatsApp" htmlFor="s-whatsapp" error={errorAt('whatsapp')}>
            <Input
              id="s-whatsapp"
              size="sm"
              aria-invalid={invalid('whatsapp')}
              value={settings.whatsapp}
              onChange={(e) => setSettings((p) => ({ ...p, whatsapp: e.target.value }))}
            />
          </FormField>
          <FormField label="Email" htmlFor="s-email" error={errorAt('email')}>
            <Input
              id="s-email"
              size="sm"
              type="email"
              aria-invalid={invalid('email')}
              value={settings.email}
              onChange={(e) => setSettings((p) => ({ ...p, email: e.target.value }))}
            />
          </FormField>
        </div>
        <FormField label="Address" htmlFor="s-address" error={errorAt('address')}>
          <Textarea
            id="s-address"
            size="sm"
            rows={2}
            aria-invalid={invalid('address')}
            value={settings.address}
            onChange={(e) => setSettings((p) => ({ ...p, address: e.target.value }))}
          />
        </FormField>
      </Section>

      <Section title="Notifications" description="Who gets emailed for new orders and receipt uploads.">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink">Order notification emails</span>
          {notificationEmails.map((email, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                size="sm"
                type="email"
                aria-label={`Order notification email ${index + 1}`}
                aria-invalid={invalid('orderNotificationEmails')}
                value={email}
                onChange={(e) =>
                  setSettings((p) => ({
                    ...p,
                    orderNotificationEmails: p.orderNotificationEmails.map((v, i) => (i === index ? e.target.value : v)),
                  }))
                }
              />
              <Button
                type="button"
                variant="destructive-ghost"
                size="icon-sm"
                aria-label="Remove email"
                onClick={() => setSettings((p) => ({ ...p, orderNotificationEmails: p.orderNotificationEmails.filter((_, i) => i !== index) }))}
              >
                <Trash2 aria-hidden strokeWidth={1.75} className="size-4" />
              </Button>
            </div>
          ))}
          <InlineError message={errorAt('orderNotificationEmails')} />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => setSettings((p) => ({ ...p, orderNotificationEmails: [...p.orderNotificationEmails, ''] }))}
          >
            <Plus aria-hidden strokeWidth={1.75} className="size-4" />
            Add email
          </Button>
        </div>
        <FormField label="Inquiries (RFP) email" htmlFor="s-rfp-email" error={errorAt('rfpEmail')}>
          <Input
            id="s-rfp-email"
            size="sm"
            type="email"
            aria-invalid={invalid('rfpEmail')}
            value={settings.rfpEmail}
            onChange={(e) => setSettings((p) => ({ ...p, rfpEmail: e.target.value }))}
          />
        </FormField>
      </Section>

      <Section title="Payments">
        <InlineError message={errorAt('paymentMethods')} />
        <div className="flex items-center justify-between gap-3 rounded-md border border-concrete-150 p-3">
          <div>
            <p className="text-sm font-medium text-ink">Cash on delivery</p>
            <p className="text-sm text-cement">Offer COD at checkout.</p>
          </div>
          <Switch
            checked={settings.paymentMethods.cod}
            onCheckedChange={(checked) => setSettings((p) => ({ ...p, paymentMethods: { ...p.paymentMethods, cod: checked } }))}
            aria-label="Cash on delivery"
          />
        </div>
        <FormField label="COD maximum order amount" htmlFor="s-cod-max" hint="Blank means no limit." error={errorAt('codMaxOrderAmount')}>
          <Input
            id="s-cod-max"
            size="sm"
            type="number"
            min={0}
            step={1}
            aria-invalid={invalid('codMaxOrderAmount')}
            value={settings.codMaxOrderAmount ?? ''}
            onChange={(e) => setSettings((p) => ({ ...p, codMaxOrderAmount: e.target.value === '' ? null : Number(e.target.value) }))}
          />
        </FormField>

        <div className="flex items-center justify-between gap-3 rounded-md border border-concrete-150 p-3">
          <div>
            <p className="text-sm font-medium text-ink">Bank transfer</p>
            <p className="text-sm text-cement">Offer bank transfer at checkout.</p>
          </div>
          <Switch
            checked={settings.paymentMethods.bankTransfer}
            onCheckedChange={(checked) => setSettings((p) => ({ ...p, paymentMethods: { ...p.paymentMethods, bankTransfer: checked } }))}
            aria-label="Bank transfer"
          />
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-ink">Bank accounts</span>
          {settings.bankAccounts.map((account, index) => (
            <div key={account.id} className="grid grid-cols-1 gap-3 rounded-md border border-concrete-150 p-3 sm:grid-cols-2">
              <FormField label="Bank name" htmlFor={`bank-${account.id}-name`} error={errorAt(`bankAccounts.${index}.bankName`)}>
                <Input
                  id={`bank-${account.id}-name`}
                  size="sm"
                  aria-invalid={invalid(`bankAccounts.${index}.bankName`)}
                  value={account.bankName}
                  onChange={(e) =>
                    setSettings((p) => ({ ...p, bankAccounts: p.bankAccounts.map((a, i) => (i === index ? { ...a, bankName: e.target.value } : a)) }))
                  }
                />
              </FormField>
              <FormField label="Account title" htmlFor={`bank-${account.id}-title`} error={errorAt(`bankAccounts.${index}.accountTitle`)}>
                <Input
                  id={`bank-${account.id}-title`}
                  size="sm"
                  aria-invalid={invalid(`bankAccounts.${index}.accountTitle`)}
                  value={account.accountTitle}
                  onChange={(e) =>
                    setSettings((p) => ({ ...p, bankAccounts: p.bankAccounts.map((a, i) => (i === index ? { ...a, accountTitle: e.target.value } : a)) }))
                  }
                />
              </FormField>
              <FormField label="Account number" htmlFor={`bank-${account.id}-number`} error={errorAt(`bankAccounts.${index}.accountNumber`)}>
                <Input
                  id={`bank-${account.id}-number`}
                  size="sm"
                  aria-invalid={invalid(`bankAccounts.${index}.accountNumber`)}
                  value={account.accountNumber}
                  onChange={(e) =>
                    setSettings((p) => ({ ...p, bankAccounts: p.bankAccounts.map((a, i) => (i === index ? { ...a, accountNumber: e.target.value } : a)) }))
                  }
                />
              </FormField>
              <FormField label="IBAN" htmlFor={`bank-${account.id}-iban`} error={errorAt(`bankAccounts.${index}.iban`)}>
                <Input
                  id={`bank-${account.id}-iban`}
                  size="sm"
                  aria-invalid={invalid(`bankAccounts.${index}.iban`)}
                  value={account.iban ?? ''}
                  onChange={(e) =>
                    setSettings((p) => ({ ...p, bankAccounts: p.bankAccounts.map((a, i) => (i === index ? { ...a, iban: e.target.value || null } : a)) }))
                  }
                />
              </FormField>
              <FormField label="Raast id" htmlFor={`bank-${account.id}-raast`} error={errorAt(`bankAccounts.${index}.raastId`)}>
                <Input
                  id={`bank-${account.id}-raast`}
                  size="sm"
                  aria-invalid={invalid(`bankAccounts.${index}.raastId`)}
                  value={account.raastId ?? ''}
                  onChange={(e) =>
                    setSettings((p) => ({ ...p, bankAccounts: p.bankAccounts.map((a, i) => (i === index ? { ...a, raastId: e.target.value || null } : a)) }))
                  }
                />
              </FormField>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="destructive-ghost"
                  size="sm"
                  onClick={() => setBankAccounts((accounts) => accounts.filter((_, i) => i !== index))}
                >
                  <Trash2 aria-hidden strokeWidth={1.75} className="size-4" />
                  Remove account
                </Button>
              </div>
            </div>
          ))}
          <InlineError message={errorAt('bankAccounts')} />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => setBankAccounts((accounts) => [...accounts, emptyBankAccount()])}
          >
            <Plus aria-hidden strokeWidth={1.75} className="size-4" />
            Add bank account
          </Button>
        </div>

        <FormField
          label="Bank transfer instructions"
          htmlFor="s-bank-instructions"
          hint="Markdown supported."
          error={errorAt('bankTransferInstructions')}
        >
          <Textarea
            id="s-bank-instructions"
            size="sm"
            rows={3}
            aria-invalid={invalid('bankTransferInstructions')}
            value={settings.bankTransferInstructions}
            onChange={(e) => setSettings((p) => ({ ...p, bankTransferInstructions: e.target.value }))}
          />
        </FormField>
      </Section>

      <Section title="Delivery">
        <FormField
          label="Default delivery fee (Rs)"
          htmlFor="s-default-fee"
          hint="Used when an area has no fee of its own."
          error={errorAt('defaultDeliveryFee')}
        >
          <Input
            id="s-default-fee"
            size="sm"
            type="number"
            min={0}
            step={1}
            aria-invalid={invalid('defaultDeliveryFee')}
            value={settings.defaultDeliveryFee}
            onChange={(e) => setSettings((p) => ({ ...p, defaultDeliveryFee: Number(e.target.value) }))}
          />
        </FormField>
      </Section>

      <Section title="Inventory">
        <FormField label="Low stock default" htmlFor="s-low-stock" hint="Default threshold for new variants." error={errorAt('lowStockDefault')}>
          <Input
            id="s-low-stock"
            size="sm"
            type="number"
            min={0}
            step={1}
            aria-invalid={invalid('lowStockDefault')}
            value={settings.lowStockDefault}
            onChange={(e) => setSettings((p) => ({ ...p, lowStockDefault: Number(e.target.value) }))}
          />
        </FormField>
      </Section>

      <Section title="Pages" description="Markdown content for the storefront's info pages.">
        <div className="flex flex-col gap-5">
          {PAGE_KEYS.map((key) => (
            <div key={key} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink">{PAGE_TITLES[key]}</span>
                <Button type="button" variant="tertiary" size="sm" onClick={() => togglePreview(key)}>
                  {previewing.has(key) ? 'Edit' : 'Preview'}
                </Button>
              </div>
              {previewing.has(key) ? (
                <div className="min-h-30 rounded-md border border-concrete-150 bg-concrete-50 p-4 text-sm text-ink [&_h1]:type-h3 [&_h2]:type-h3 [&_h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:my-2 [&_ul]:list-disc">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{settings.pages[key] || '*Nothing to preview yet.*'}</ReactMarkdown>
                </div>
              ) : (
                <Textarea
                  size="sm"
                  className="min-h-30"
                  aria-label={PAGE_TITLES[key]}
                  aria-invalid={invalid(`pages.${key}`)}
                  value={settings.pages[key]}
                  onChange={(e) => setSettings((p) => ({ ...p, pages: { ...p.pages, [key]: e.target.value } }))}
                />
              )}
              <InlineError message={errorAt(`pages.${key}`)} />
            </div>
          ))}
        </div>
      </Section>

      <div className="sticky bottom-0 z-10 -mx-4 -mb-6 border-t border-concrete-200 bg-surface px-4 py-3 shadow-float md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {formError ? (
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <FormError message={pointToFields ? `${formError} Check the fields marked in red.` : formError} />
              {otherErrors.length > 0 ? (
                <ul className="list-disc pl-5 text-sm text-danger">
                  {otherErrors.map((error) => (
                    <li key={`${error.path}:${error.message}`}>
                      {fieldLabel(error.path)}: {error.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" disabled={saving} onClick={handleDiscard}>
              Discard changes
            </Button>
            <Button type="button" loading={saving} onClick={() => void handleSave()}>
              Save changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
