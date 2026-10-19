import { formatDateTime, formatFileSize, type ReceiptDTO } from '@aricon/shared';
import { ReceiptUpload } from '@/components/shop/receipt-upload';
import { ReceiptStatusBadge } from '@/components/shop/status-badges';

export interface ReceiptPanelProps {
  orderNumber: string;
  receipts: ReceiptDTO[];
  canUploadReceipt: boolean;
}

/**
 * Bank-transfer receipts on the order page (DESIGN.md §6 "Receipt uploader", SPEC §6.8): what was
 * uploaded and its review status, plus the uploader while another receipt is still allowed.
 */
export function ReceiptPanel({ orderNumber, receipts, canUploadReceipt }: ReceiptPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      {receipts.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {receipts.map((receipt) => (
            <li
              key={receipt.id}
              className="flex flex-col gap-1 rounded-md border border-concrete-200 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-ink">Receipt · {formatFileSize(receipt.sizeBytes)}</span>
                <span className="text-xs text-cement">Uploaded {formatDateTime(receipt.uploadedAt)}</span>
                {receipt.status === 'rejected' && receipt.rejectReason ? (
                  <span className="text-xs text-danger">{receipt.rejectReason}</span>
                ) : null}
              </div>
              <ReceiptStatusBadge status={receipt.status} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-cement">No receipt uploaded yet.</p>
      )}

      {canUploadReceipt ? <ReceiptUpload orderNumber={orderNumber} /> : null}
    </div>
  );
}
