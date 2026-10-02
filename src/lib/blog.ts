import { getCollection, type CollectionEntry } from 'astro:content';
import { languages, postPath, type Alternate, type Locale } from '../i18n';

export async function getPublishedPosts(locale?: Locale): Promise<CollectionEntry<'blog'>[]> {
  const posts = await getCollection('blog');
  const slugs = new Map<string, string>();
  const translations = new Map<string, string>();

  for (const post of posts) {
    const slugKey = `${post.data.language}:${post.data.slug}`;
    const previousId = slugs.get(slugKey);
    if (previousId !== undefined) {
      throw new Error(
        `Duplicate blog slug "${post.data.slug}" for "${post.data.language}" in "${previousId}" and "${post.id}". Slugs must be unique per language, including drafts.`,
      );
    }
    slugs.set(slugKey, post.id);
    const translationKey = `${post.data.language}:${post.data.translationKey}`;
    const previousTranslation = translations.get(translationKey);
    if (previousTranslation !== undefined) {
      throw new Error(
        `Duplicate translationKey "${post.data.translationKey}" for "${post.data.language}" in "${previousTranslation}" and "${post.id}". Only one translation per language is allowed, including drafts.`,
      );
    }
    translations.set(translationKey, post.id);
  }

  return posts
    .filter((post) => post.data.draft !== true && (locale === undefined || post.data.language === locale))
    .sort(
      (a, b) =>
        b.data.publishedDate.getTime() - a.data.publishedDate.getTime() ||
        a.data.slug.localeCompare(b.data.slug, 'en'),
    );
}

export function getPostAlternates(
  post: CollectionEntry<'blog'>,
  publishedPosts: CollectionEntry<'blog'>[],
): Alternate[] {
  return publishedPosts
    .filter((candidate) => candidate.data.translationKey === post.data.translationKey)
    .map((candidate) => ({
      locale: candidate.data.language,
      href: postPath(candidate.data.language, candidate.data.slug),
    }));
}

export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(languages[locale].dateLocale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
