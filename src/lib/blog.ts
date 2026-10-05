import { getCollection, type CollectionEntry } from 'astro:content';
import { languages, postPath, talkPath, type Alternate, type Locale } from '../i18n';

type IdentifiedEntry = {
  id: string;
  data: { language: Locale; slug: string; translationKey: string };
};

function validateIdentities(posts: IdentifiedEntry[], collection: 'blog' | 'talks'): void {
  const slugs = new Map<string, string>();
  const translations = new Map<string, string>();

  for (const post of posts) {
    const slugKey = `${post.data.language}:${post.data.slug}`;
    const previousId = slugs.get(slugKey);
    if (previousId !== undefined) {
      throw new Error(
        `Duplicate ${collection} slug "${post.data.slug}" for "${post.data.language}" in "${previousId}" and "${post.id}". Slugs must be unique per language, including drafts.`,
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
}

export async function getPublishedPosts(locale?: Locale): Promise<CollectionEntry<'blog'>[]> {
  const posts = await getCollection('blog');
  validateIdentities(posts, 'blog');
  return posts
    .filter((post) => post.data.draft !== true && (locale === undefined || post.data.language === locale))
    .sort(
      (a, b) =>
        b.data.publishedDate.getTime() - a.data.publishedDate.getTime() ||
        a.data.slug.localeCompare(b.data.slug, 'en'),
    );
}

export async function getPublishedTalks(): Promise<CollectionEntry<'talks'>[]> {
  const talks = await getCollection('talks');
  validateIdentities(talks, 'talks');
  const posts = await getCollection('blog');
  const keys = new Set(posts.map((post) => post.data.translationKey));
  for (const talk of talks) {
    for (const key of talk.data.relatedPosts) {
      if (!keys.has(key)) {
        throw new Error(`Unknown relatedPosts translationKey "${key}" in talk "${talk.id}".`);
      }
    }
  }
  return talks.filter((talk) => talk.data.draft !== true)
    .sort((a, b) => b.data.publishedDate.getTime() - a.data.publishedDate.getTime()
      || a.data.slug.localeCompare(b.data.slug, 'en'));
}

export function getTalkAlternates(
  talk: CollectionEntry<'talks'>,
  talks: CollectionEntry<'talks'>[],
): Alternate[] {
  return talks.filter((candidate) => candidate.data.translationKey === talk.data.translationKey)
    .map((candidate) => ({
      locale: candidate.data.language,
      href: talkPath(candidate.data.language, candidate.data.slug),
    }));
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
