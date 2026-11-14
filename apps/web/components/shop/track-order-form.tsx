"use client";

import {
  formatDateTime,
  ORDER_STATUS_LABELS,
  trackOrderSchema,
  type ApiResponse,
  type OrderStatus,
  type OrderTrackingDTO,
  type TrackOrderInput,
} from "@aricon/shared";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  REGEXP_ONLY_DIGITS,
} from "@/components/ui/input-otp";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { FormField } from "@/components/ui/form-field";
import { apiClient } from "@/lib/api-client";
import { applyFieldErrors, errorMessage } from "@/lib/api-errors";
import { cn } from "@/lib/utils";
import { OrderStatusBadge } from "./status-badges";

type TrackOrderValues = z.output<typeof trackOrderSchema>;

/** The happy path, in order; cancelled/returned orders show their own last step instead. */
const PROGRESS: OrderStatus[] = ["NEW", "CONFIRMED", "DISPATCHED", "DELIVERED"];

/**
 * "Track your order" (SPEC §6.6b): the order's 6-digit tracking code, no sign-in.
 * Posts to `/api/public/track-order`, which answers with the status trail only.
 */
export function TrackOrderForm() {
  const [result, setResult] = useState<OrderTrackingDTO | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TrackOrderInput, unknown, TrackOrderValues>({
    resolver: zodResolver(trackOrderSchema),
    defaultValues: { code: "" },
  });

  async function submit(values: TrackOrderValues) {
    setFormError(null);
    setResult(null);
    try {
      const { data } = await apiClient<ApiResponse<OrderTrackingDTO>>(
        "/public/track-order",
        { method: "POST", body: values },
      );
      setResult(data);
    } catch (error) {
      if (!applyFieldErrors(error, setError, { fields: ["code"] })) {
        setFormError(
          errorMessage(
            error,
            "We couldn't check this order. Please try again.",
          ),
        );
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleSubmit(submit)}
        className="flex flex-col gap-4"
        noValidate
      >
        <FormField
          label="Tracking code"
          htmlFor="track-order-code"
          error={errors.code?.message}
          hint="The 6 digits shown when you placed your order, and in your confirmation email and account."
          required
        >
          <Controller
            name="code"
            control={control}
            render={({ field }) => (
              <InputOTP
                id="track-order-code"
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern={REGEXP_ONLY_DIGITS}
                aria-invalid={Boolean(errors.code)}
                className={cn(errors.code && 'border-danger')}
                containerClassName="justify-center"
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            )}
          />
        </FormField>
        <FormError message={formError} />
        <Button type="submit" size="lg" loading={isSubmitting}>
          Track order
        </Button>
      </form>

      {result ? <TrackingResult result={result} /> : null}
    </div>
  );
}

function TrackingResult({ result }: { result: OrderTrackingDTO }) {
  const reached = new Map(
    result.history.map((entry) => [entry.status, entry.at]),
  );
  const offPath = result.status === "CANCELLED" || result.status === "RETURNED";
  const steps = offPath
    ? [...PROGRESS.filter((status) => reached.has(status)), result.status]
    : PROGRESS;

  return (
    <section
      aria-live="polite"
      className="flex flex-col gap-4 rounded-xl bg-concrete-50 p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-cement">Order</p>
          <p className="font-display text-xl font-semibold text-ink">
            {result.orderNumber}
          </p>
        </div>
        <OrderStatusBadge status={result.status} />
      </div>
      <p className="text-sm text-ink-700">
        Placed on {formatDateTime(result.createdAt)}
      </p>

      <ol className="flex flex-col gap-3">
        {steps.map((status) => {
          const at = reached.get(status);
          const done = at !== undefined;
          return (
            <li key={status} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-[1.5px]",
                  done
                    ? "border-success bg-success text-white"
                    : "border-concrete-400 bg-surface",
                )}
              >
                {done ? <Check strokeWidth={3} className="size-3" /> : null}
              </span>
              <div className="flex flex-col">
                <span
                  className={cn(
                    "text-sm font-medium",
                    done ? "text-ink" : "text-cement",
                  )}
                >
                  {ORDER_STATUS_LABELS[status]}
                </span>
                {at ? (
                  <span className="text-xs text-cement">
                    {formatDateTime(at)}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {result.riderName ? (
        <p className="text-sm text-ink-700">Your rider: {result.riderName}</p>
      ) : null}
    </section>
  );
}
