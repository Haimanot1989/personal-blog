import { getCollection, type CollectionEntry } from 'astro:content';

export async function getPublishedPosts(): Promise<CollectionEntry<'blog'>[]> {
  const posts = await getCollection('blog');
  const slugs = new Map<string, string>();

  for (const post of posts) {
    const previousId = slugs.get(post.data.slug);
    if (previousId !== undefined) {
      throw new Error(
        `Duplicate blog slug "${post.data.slug}" in "${previousId}" and "${post.id}". Slugs must be unique, including drafts.`,
      );
    }
    slugs.set(post.data.slug, post.id);
  }

  return posts
    .filter((post) => post.data.draft !== true)
    .sort(
      (a, b) =>
        b.data.publishedDate.getTime() - a.data.publishedDate.getTime() ||
        a.data.slug.localeCompare(b.data.slug, 'en'),
    );
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('nb-NO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
