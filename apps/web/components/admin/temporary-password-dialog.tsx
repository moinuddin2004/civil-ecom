'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface TemporaryPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffName: string;
  password: string;
}

/**
 * One-time temporary password dialog (SPEC §7.3, DESIGN.md §9.5): shows the password the API
 * generated for "Add staff" or "Reset password", once. It is only ever held in memory for this
 * dialog — never logged, never sent anywhere else from here.
 */
export function TemporaryPasswordDialog({ open, onOpenChange, staffName, password }: TemporaryPasswordDialogProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      toast.success('Password copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the password and copy it manually.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent mobile="sheet" size="md" aria-describedby="temp-password-desc">
        <DialogHeader>
          <DialogTitle>Temporary password</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p id="temp-password-desc" className="text-sm text-ink-700">
            Share this with {staffName} securely. They must change it at first login.
          </p>
          <div className="flex items-center justify-between gap-3 rounded-md border border-concrete-200 bg-concrete-50 px-4 py-3">
            <span className="font-mono text-xl tracking-wider text-ink select-all">{password}</span>
            <Button type="button" variant="secondary" size="sm" onClick={handleCopy}>
              {copied ? <Check aria-hidden strokeWidth={1.75} className="size-4" /> : <Copy aria-hidden strokeWidth={1.75} className="size-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="text-sm text-danger">This password won&apos;t be shown again after you close this dialog.</p>
        </DialogBody>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
