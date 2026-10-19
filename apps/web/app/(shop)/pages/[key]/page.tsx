import { pageKeyFromSlug } from '@aricon/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getPage } from '@/lib/api-server';

// About, FAQ, contact and the policy pages (SPEC §8.1, §8.11): server-rendered Markdown from
// settings, cached for an hour and refreshed when settings change. Indexable — unlike the rest of
// this file's siblings (auth, cart, checkout), these are real public content pages.

interface PageProps {
  params: Promise<{ key: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { key } = await params;
  const pageKey = pageKeyFromSlug(key);
  if (!pageKey) return {};
  const page = await getPage(pageKey);
  return { title: page.title };
}

export default async function ContentPage({ params }: PageProps) {
  const { key } = await params;
  const pageKey = pageKeyFromSlug(key);
  if (!pageKey) notFound();
  const page = await getPage(pageKey);

  return (
    <div className="mx-auto max-w-content px-4 py-8 md:px-8 md:py-12">
      <article className="mx-auto flex max-w-[72ch] flex-col">
        <h1 className="type-h1">{page.title}</h1>
        <div
          className={[
            'mt-6 flex flex-col gap-4 text-base text-ink-700',
            '[&_a]:link',
            '[&_h2]:type-h2 [&_h2]:mt-4 [&_h2]:text-ink',
            '[&_h3]:type-h3 [&_h3]:mt-2 [&_h3]:text-ink',
            '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1',
            '[&_strong]:font-semibold [&_strong]:text-ink',
            '[&_hr]:border-concrete-200',
            '[&_blockquote]:border-l-2 [&_blockquote]:border-concrete-200 [&_blockquote]:pl-4 [&_blockquote]:text-cement',
            '[&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-concrete-200 [&_th]:p-2 [&_th]:text-left [&_td]:border [&_td]:border-concrete-200 [&_td]:p-2',
          ].join(' ')}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{page.body}</ReactMarkdown>
        </div>
      </article>
    </div>
  );
}
