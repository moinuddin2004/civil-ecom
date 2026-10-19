import type { AdminCategoryDTO } from '@aricon/shared';
import type { SelectOption } from '@/components/ui/select';

function byDisplayOrder(a: AdminCategoryDTO, b: AdminCategoryDTO): number {
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
}

/**
 * Category picker options in tree order: each top-level category (by display order) followed by
 * its subcategories, labelled "Parent › Child". `value` picks the field the option stands for —
 * the id for forms, the slug for URL filters.
 */
export function categoryOptions(categories: readonly AdminCategoryDTO[], value: 'id' | 'slug'): SelectOption[] {
  const parents = categories.filter((category) => !category.parentId).sort(byDisplayOrder);
  const known = new Set(parents.map((parent) => parent.id));
  const options: SelectOption[] = [];
  for (const parent of parents) {
    options.push({ value: parent[value], label: parent.name });
    for (const child of categories.filter((category) => category.parentId === parent.id).sort(byDisplayOrder)) {
      options.push({ value: child[value], label: `${parent.name} › ${child.name}` });
    }
  }
  // A subcategory whose parent isn't in the list still has to be choosable.
  for (const orphan of categories.filter((category) => category.parentId && !known.has(category.parentId)).sort(byDisplayOrder)) {
    options.push({ value: orphan[value], label: orphan.name });
  }
  return options;
}
