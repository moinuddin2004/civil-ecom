import { CategoryIcon, categoryIconFor } from '@/components/icons/category-icons';

/**
 * The only place the shop components touch the custom category icon set (v2 §1.26), so an API change
 * there is one edit here. `hint` is a category slug or name (or a product name when the category is
 * unknown); `categoryIconFor` falls back to the cement bag.
 */
export function CategoryGlyph({
  hint,
  size,
  className,
}: {
  hint: string;
  size: number;
  className?: string;
}) {
  return <CategoryIcon name={categoryIconFor(hint)} size={size} className={className} />;
}
