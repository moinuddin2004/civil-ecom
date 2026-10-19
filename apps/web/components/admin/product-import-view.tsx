'use client';

import { formatNumber, IMPORT_UPLOAD_MAX_BYTES, formatFileSize, type ApiResponse, type ImportJobDTO } from '@aricon/shared';
import { CheckCircle2, Upload, XCircle } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DownloadButton } from '@/components/ui/download-button';
import { apiClient, upload } from '@/lib/api-client';
import { errorMessage } from '@/lib/api-errors';
import { cn } from '@/lib/utils';

const POLL_MS = 1_500;
const XLSX = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <li className="rounded-xl border border-concrete-150 bg-surface p-5 shadow-card">
      <p className="mb-1 flex items-center gap-2 font-semibold text-ink">
        <span className="flex size-6 items-center justify-center rounded-full bg-ink text-xs text-white">{number}</span>
        {title}
      </p>
      {children}
    </li>
  );
}

/**
 * Product import (SPEC §10.5, §12.3, DESIGN.md §9.4): "Download template → Upload file → Review
 * results". The upload starts a background job (`POST /api/admin/products/import`); this page
 * polls `GET /api/admin/import-jobs/:id` until it is done and then lists every row that failed.
 */
export function ProductImportView() {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [job, setJob] = useState<ImportJobDTO | null>(null);
  const pollTimer = useRef<number | null>(null);

  const running = job !== null && (job.status === 'QUEUED' || job.status === 'RUNNING');

  // Follow the job until it finishes; stop when the page goes away.
  useEffect(() => {
    if (!job || !running) return;
    pollTimer.current = window.setTimeout(() => {
      apiClient<ApiResponse<ImportJobDTO>>(`/admin/import-jobs/${job.id}`)
        .then(({ data }) => setJob(data))
        .catch((error: unknown) => toast.error(errorMessage(error, "We couldn't check the import. Refresh the page to try again.")));
    }, POLL_MS);
    return () => {
      if (pollTimer.current !== null) window.clearTimeout(pollTimer.current);
    };
  }, [job, running]);

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (chosen && chosen.size > IMPORT_UPLOAD_MAX_BYTES) {
      toast.error(`The file is too large. Choose one under ${formatFileSize(IMPORT_UPLOAD_MAX_BYTES)}.`);
      return;
    }
    setFile(chosen);
  }

  async function start() {
    if (!file) return;
    setProgress(0);
    try {
      const { data } = await upload<ApiResponse<{ jobId: string }>>('/admin/products/import', file, 'file', setProgress);
      setJob({
        id: data.jobId,
        status: 'QUEUED',
        totalRows: 0,
        processedRows: 0,
        summary: { created: 0, updated: 0, failed: 0 },
        errors: [],
        createdAt: new Date().toISOString(),
        startedAt: null,
        finishedAt: null,
      });
      setFile(null);
    } catch (error) {
      toast.error(errorMessage(error, "We couldn't upload the file. Please try again."));
    } finally {
      setProgress(null);
    }
  }

  const uploading = progress !== null;
  const percent = job && job.totalRows > 0 ? Math.round((job.processedRows / job.totalRows) * 100) : 0;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="type-h1">Import products</h1>

      <ol className="flex flex-col gap-4">
        <Step number={1} title="Download template">
          <p className="mb-3 text-sm text-ink-700">
            One row per variant. The second sheet explains every column. An Excel export from the products list works as a
            template too.
          </p>
          <DownloadButton path="/admin/products/import-template" fileName="product-import-template.xlsx" variant="secondary" size="sm">
            Download template
          </DownloadButton>
        </Step>

        <Step number={2} title="Upload file">
          <p className="mb-3 text-sm text-ink-700">.xlsx file, up to {formatFileSize(IMPORT_UPLOAD_MAX_BYTES)}.</p>
          <div className="flex flex-wrap items-center gap-3">
            <label
              className={cn(
                'flex h-10 items-center gap-2 rounded-md border border-ink px-4 text-sm font-semibold text-ink',
                uploading || running ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-concrete-50',
              )}
            >
              <Upload aria-hidden strokeWidth={1.75} className="size-4" />
              Choose file
              <input type="file" accept={XLSX} className="sr-only" disabled={uploading || running} onChange={choose} />
            </label>
            {file ? <span className="text-sm text-ink-700">{file.name}</span> : null}
            <Button type="button" size="sm" disabled={!file || running} loading={uploading} onClick={() => void start()}>
              Start import
            </Button>
          </div>
          {uploading ? <p className="mt-2 text-sm text-cement tabular-nums">Uploading… {Math.round((progress ?? 0) * 100)}%</p> : null}
        </Step>

        <Step number={3} title="Review results">
          {!job ? (
            <p className="text-sm text-cement">Results appear here once the import has run.</p>
          ) : running ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-ink-700">
                {job.status === 'QUEUED' ? 'Waiting to start…' : `Importing… ${formatNumber(job.processedRows)} of ${formatNumber(job.totalRows)} rows`}
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-concrete-150" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-amber transition-all duration-300" style={{ width: `${percent}%` }} />
              </div>
              <p className="text-xs text-cement">You can leave this page; the import keeps running.</p>
            </div>
          ) : job.status === 'FAILED' ? (
            <p className="flex items-start gap-2 text-sm text-danger">
              <XCircle aria-hidden strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" />
              {job.errors[0]?.message ?? 'The import failed.'}
            </p>
          ) : (
            <ImportResults job={job} />
          )}
        </Step>
      </ol>
    </div>
  );
}

function ImportResults({ job }: { job: ImportJobDTO }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          ['Added', job.summary.created, 'text-ink'],
          ['Updated', job.summary.updated, 'text-ink'],
          ['Failed', job.summary.failed, job.summary.failed > 0 ? 'text-danger' : 'text-ink'],
        ].map(([label, value, tone]) => (
          <div key={label} className="rounded-md border border-concrete-150 p-3 text-center">
            <p className={cn('font-display text-2xl font-bold tabular-nums', tone)}>{formatNumber(Number(value))}</p>
            <p className="text-xs text-cement">{label}</p>
          </div>
        ))}
      </div>
      {job.summary.failed === 0 ? (
        <p className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 aria-hidden strokeWidth={1.75} className="size-4" />
          Every row was saved.
        </p>
      ) : null}
      {job.errors.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">Rows to check</p>
          <div className="overflow-x-auto rounded-md border border-concrete-150">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-concrete-150 bg-concrete-50 text-left text-xs text-cement">
                  <th className="px-3 py-2 font-medium">Row</th>
                  <th className="px-3 py-2 font-medium">SKU</th>
                  <th className="px-3 py-2 font-medium">What to fix</th>
                </tr>
              </thead>
              <tbody>
                {job.errors.map((error, index) => (
                  <tr key={`${error.row}-${index}`} className="border-b border-concrete-150 last:border-b-0">
                    <td className="px-3 py-2 tabular-nums">{error.row}</td>
                    <td className="px-3 py-2 font-mono text-xs">{error.sku ?? '—'}</td>
                    <td className="px-3 py-2 text-ink-700">{error.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
