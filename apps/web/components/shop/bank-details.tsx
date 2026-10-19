'use client';

import type { BankAccountDTO } from '@aricon/shared';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CARD_CLASS, iconProps } from './styles';

export interface BankDetailsProps {
  accounts: BankAccountDTO[];
  /** Markdown from settings; rendered as plain wrapped text (no rich formatting needed here). */
  instructions?: string;
  className?: string;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (older browsers, insecure context); the value is still
      // visible on screen to copy by hand.
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-concrete-150 py-2.5 last:border-b-0">
      <div className="flex min-w-0 flex-col">
        <span className="text-xs text-cement">{label}</span>
        <span className="truncate font-medium text-ink">{value}</span>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy ${label}`}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-blueprint hover:bg-blueprint-50"
      >
        {copied ? <Check {...iconProps} className="size-4" /> : <Copy {...iconProps} className="size-4" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

/** Bank details block (DESIGN.md §6): bank name, account title, account number and IBAN, each with
 *  a copy button, plus the store's own bank-transfer instructions. */
export function BankDetails({ accounts, instructions, className }: BankDetailsProps) {
  if (accounts.length === 0) return null;

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {accounts.map((account) => (
        <div key={account.id} className={cn(CARD_CLASS, 'p-4')}>
          <CopyField label="Bank" value={account.bankName} />
          <CopyField label="Account title" value={account.accountTitle} />
          <CopyField label="Account number" value={account.accountNumber} />
          {account.iban ? <CopyField label="IBAN" value={account.iban} /> : null}
        </div>
      ))}
      {instructions ? <p className="text-sm whitespace-pre-line text-ink-700">{instructions}</p> : null}
    </div>
  );
}
