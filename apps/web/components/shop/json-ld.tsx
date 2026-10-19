/**
 * Structured data for search engines (SPEC §14): one `<script type="application/ld+json">`.
 * Built from our own data; `<` is escaped so a value can never close the script tag early.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify({ '@context': 'https://schema.org', ...data }).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

/** `BreadcrumbList` from Home → … → the current page (absolute URLs). */
export function breadcrumbList(items: readonly { name: string; url: string }[]): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: item.url })),
  };
}
