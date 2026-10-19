import { cn } from '@/lib/utils';
import { ProductGrid } from './product-grid';
import { LoadingRegion, Skeleton } from './skeleton';
import { CARD_CLASS } from './styles';

/** Product card placeholder (v2 §1.12 "Skeleton card"). */
export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(CARD_CLASS, 'flex h-full w-full flex-col gap-2.5 p-3', className)}
    >
      <Skeleton className="aspect-square w-full rounded-md" />
      <Skeleton className="h-3.5 w-[45%]" />
      <Skeleton className="h-4 w-[90%]" />
      <Skeleton className="h-4 w-[70%]" />
      <Skeleton className="mt-1 h-[22px] w-1/2" />
      <div className="min-h-2 flex-1" />
      <Skeleton className="h-11 w-full rounded-md" />
    </div>
  );
}

/** A grid of card placeholders, announced once as "Loading products…". */
export function ProductGridSkeleton({
  count = 8,
  columns = 4,
  className,
}: {
  count?: number;
  columns?: 4 | 5;
  className?: string;
}) {
  return (
    <LoadingRegion label="Loading products…" className={className}>
      <ProductGrid columns={columns}>
        {Array.from({ length: count }, (_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </ProductGrid>
    </LoadingRegion>
  );
}
