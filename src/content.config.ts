import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { supportedLocales } from './i18n';
import { formats, sourceTypes, topics } from './lib/taxonomy';

const webUrl = z.url().refine(
  (value) => URL.canParse(value) && ['https:', 'http:'].includes(new URL(value).protocol),
  'Use an HTTP or HTTPS URL.',
);

const metadata = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  language: z.enum(supportedLocales),
  translationKey: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a stable translationKey shared by translations.'),
  publishedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD for publishedDate.')
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }, 'publishedDate must be a valid calendar date.')
    .transform((value) => new Date(`${value}T00:00:00Z`)),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, digits and single hyphens for slug.'),
  draft: z.boolean().optional(),
});

const blog = defineCollection({
  loader: glob({
    base: './src/content/blog',
    pattern: '**/*.md',
    // Keep entries distinct until the shared slug validation has run.
    generateId: ({ entry }) => entry,
  }),
  schema: metadata.extend({
    topic: z.enum(topics),
    format: z.enum(formats),
    tags: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
      .max(5).refine((tags) => new Set(tags).size === tags.length, 'Tags must be unique.')
      .default([]),
    sources: z.array(z.object({
      title: z.string().trim().min(1),
      type: z.enum(sourceTypes),
      author: z.string().trim().min(1).optional(),
      locator: z.string().trim().min(1).optional(),
      url: webUrl.optional(),
    })).default([]),
  }),
});

const talks = defineCollection({
  loader: glob({
    base: './src/content/talks',
    pattern: '**/*.md',
    generateId: ({ entry }) => entry,
  }),
  schema: metadata.extend({
    topic: z.enum(topics),
    event: z.string().trim().min(1).optional(),
    slides: webUrl.optional(),
    recording: webUrl.optional(),
    relatedPosts: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).default([]),
  }),
});

export const collections = { blog, talks };
