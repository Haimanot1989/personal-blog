import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = join(root, 'node_modules/astro/bin/astro.mjs');

function post(overrides = {}) {
  const metadata = {
    title: 'Fixture post',
    description: 'A fixture description.',
    publishedDate: '2026-01-01',
    slug: 'fixture-post',
    language: 'nb',
    ...overrides,
  };
  return { translationKey: metadata.slug, ...metadata };
}

async function withBuild(entries, inspect) {
  const directory = await mkdtemp(join(tmpdir(), 'personal-blog-test-'));
  try {
    for (const path of ['src', 'public', 'astro.config.mjs', 'tsconfig.json', 'package.json']) {
      await cp(join(root, path), join(directory, path), {
        recursive: true,
        filter: (source) => resolve(source) !== resolve(root, 'src/content/blog'),
      });
    }
    await symlink(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir');
    const contentDirectory = join(directory, 'src/content/blog');
    await mkdir(contentDirectory, { recursive: true });
    for (const [filename, metadata] of entries) {
      const frontmatter = Object.entries(metadata)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join('\n');
      await writeFile(
        join(contentDirectory, filename),
        `---\n${frontmatter}\n---\n\n## Fixture content\n\nMarkdown renders here.\n`,
      );
    }
    const result = spawnSync(process.execPath, [cli, 'build'], {
      cwd: directory,
      encoding: 'utf8',
      env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
      timeout: 60_000,
    });
    if (result.error) throw result.error;
    await inspect({
      status: result.status,
      output: `${result.stdout}\n${result.stderr}`,
      dist: join(directory, 'dist'),
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('build publishes sorted posts at explicit slugs, with SEO and no drafts or scripts', async () => {
  await withBuild(
    [
      ['filename-is-not-the-url.md', post({ slug: 'older', title: 'Older post' })],
      ['newest.md', post({ slug: 'newer', title: 'Newer post', publishedDate: '2026-02-01', draft: false })],
      ['tie.md', post({ slug: 'a-tie', publishedDate: '2026-02-01' })],
      ['draft.md', post({ slug: 'hidden-draft', title: 'Secret draft', publishedDate: '2026-03-01', draft: true })],
    ],
    async ({ status, output, dist }) => {
      assert.equal(status, 0, output);
      const index = await readFile(join(dist, 'no/index.html'), 'utf8');
      const older = await readFile(join(dist, 'no/blog/older/index.html'), 'utf8');
      const newer = await readFile(join(dist, 'no/blog/newer/index.html'), 'utf8');
      const notFound = await readFile(join(dist, '404.html'), 'utf8');
      assert.ok(index.indexOf('/no/blog/a-tie/') < index.indexOf('/no/blog/newer/'));
      assert.ok(index.indexOf('/no/blog/newer/') < index.indexOf('/no/blog/older/'));
      assert.doesNotMatch(index, /hidden-draft|Secret draft/);
      assert.deepEqual((await readdir(join(dist, 'no/blog'))).sort(), ['a-tie', 'newer', 'older']);
      assert.match(newer, /<title>Newer post \| Haimanot<\/title>/);
      assert.match(newer, /name="description" content="A fixture description\."/);
      assert.match(newer, /rel="canonical" href="https:\/\/haimanot\.dev\/no\/blog\/newer\/"/);
      assert.match(newer, /property="og:type" content="article"/);
      assert.match(newer, /property="article:published_time" content="2026-02-01T00:00:00.000Z"/);
      assert.match(newer, /<time datetime="2026-02-01">/);
      assert.match(newer, /<h2[^>]*>Fixture content<\/h2>/);
      assert.match(newer, /<html lang="nb">/);
      assert.match(newer, /href="#main">Hopp til innhold/);
      assert.match(notFound, /name="robots" content="noindex, follow"/);
      assert.match(notFound, /Siden finnes ikke/);
      assert.doesNotMatch(notFound, /rel="canonical"/);
      for (const html of [index, older, newer, notFound]) {
        assert.doesNotMatch(html, /<script\b/);
        assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
      }
      assert.equal((await readFile(join(dist, 'CNAME'), 'utf8')).trim(), 'haimanot.dev');
    },
  );
});

for (const [firstDraft, secondDraft] of [[false, false], [false, true], [true, true]]) {
  test(`duplicate slugs fail the build (draft: ${firstDraft}, ${secondDraft})`, async () => {
    await withBuild(
      [
        ['first.md', post({ draft: firstDraft })],
        ['second.md', post({ draft: secondDraft })],
      ],
      ({ status, output }) => {
        assert.notEqual(status, 0, output);
        assert.match(output, /Duplicate blog slug "fixture-post"/);
        assert.match(output, /first\.md/);
        assert.match(output, /second\.md/);
      },
    );
  });
}

const invalidMetadata = [
  ['missing slug', { slug: undefined }, /slug/],
  ['unsafe slug', { slug: '../unsafe' }, /slug/],
  ['blank title', { title: ' ' }, /title/],
  ['missing description', { description: undefined }, /description/],
  ['impossible date', { publishedDate: '2026-02-30' }, /publishedDate/],
  ['wrong draft type', { draft: 'true' }, /draft/],
  ['missing language', { language: undefined }, /language/],
  ['unsupported language', { language: 'fr' }, /language/],
  ['missing translation key', { translationKey: undefined }, /translationKey/],
];

for (const [label, overrides, expectedError] of invalidMetadata) {
  test(`invalid metadata fails the build: ${label}`, async () => {
    await withBuild([['invalid.md', post(overrides)]], ({ status, output }) => {
      assert.notEqual(status, 0, output);
      assert.match(output, expectedError);
    });
  });
}

test('translations have localized pages, reciprocal alternates and language-preserving navigation', async () => {
      await withBuild(
        [
          ['norsk.md', post({ slug: 'norsk-slug', title: 'Norsk innlegg', translationKey: 'shared' })],
          ['english.md', post({ language: 'en', slug: 'english-slug', title: 'English post', translationKey: 'shared' })],
          ['english-only.md', post({ language: 'en', slug: 'only-english', title: 'English only' })],
          ['untranslated.md', post({ slug: 'not-translated', translationKey: 'unfinished' })],
          ['untranslated-draft.md', post({ language: 'en', slug: 'secret-translation', translationKey: 'unfinished', draft: true })],
          ['same-slug-nb.md', post({ slug: 'same-slug' })],
          ['same-slug-en.md', post({ language: 'en', slug: 'same-slug' })],
        ],
        async ({ status, output, dist }) => {
          assert.equal(status, 0, output);
          const norwegianHome = await readFile(join(dist, 'no/index.html'), 'utf8');
          const englishHome = await readFile(join(dist, 'index.html'), 'utf8');
          const norwegian = await readFile(join(dist, 'no/blog/norsk-slug/index.html'), 'utf8');
          const english = await readFile(join(dist, 'blog/english-slug/index.html'), 'utf8');
          const untranslated = await readFile(join(dist, 'no/blog/not-translated/index.html'), 'utf8');
          const englishOnly = await readFile(join(dist, 'blog/only-english/index.html'), 'utf8');
          const notFound = await readFile(join(dist, '404.html'), 'utf8');
          assert.match(norwegianHome, /Norsk innlegg/);
          assert.doesNotMatch(norwegianHome, /English post|English only/);
          assert.match(englishHome, /English post/);
          assert.match(englishHome, /English only/);
          assert.doesNotMatch(englishHome, /Norsk innlegg|secret-translation/);
          assert.match(englishHome, /<title>Personal blog \| Haimanot<\/title>/);
          assert.match(englishHome, /Latest posts/);
          assert.match(englishHome, /Choose language/);
          assert.match(englishHome, /No tracking or cookies/);
          assert.match(englishHome, /<html lang="en">/);
          assert.match(englishHome, /rel="canonical" href="https:\/\/haimanot\.dev\/"/);
          assert.match(norwegianHome, /<html lang="nb">/);
          assert.match(norwegianHome, /rel="canonical" href="https:\/\/haimanot\.dev\/no\/"/);
          for (const html of [norwegian, english]) {
            assert.match(html, /rel="alternate" hreflang="nb" href="https:\/\/haimanot\.dev\/no\/blog\/norsk-slug\/"/);
            assert.match(html, /rel="alternate" hreflang="en" href="https:\/\/haimanot\.dev\/blog\/english-slug\/"/);
            assert.doesNotMatch(html, /Oversettelse mangler|Translation unavailable/);
          }
          assert.match(english, /<html lang="en">/);
          assert.match(english, /rel="canonical" href="https:\/\/haimanot\.dev\/blog\/english-slug\/"/);
          assert.match(english, /property="og:locale" content="en_GB"/);
          assert.match(english, /property="og:locale:alternate" content="nb_NO"/);
          assert.match(english, /1 January 2026/);
          assert.match(english, /href="\/"[^>]*>All posts/);
          assert.match(english, /href="\/no\/blog\/norsk-slug\/" hreflang="nb"/);
          assert.match(norwegian, /href="\/blog\/english-slug\/" hreflang="en"/);
          assert.match(untranslated, /href="\/" hreflang="en"/);
          assert.match(untranslated, /Oversettelse mangler; til forsiden/);
          assert.doesNotMatch(untranslated, /rel="alternate" hreflang="en"|secret-translation/);
          assert.match(englishOnly, /Translation unavailable; go to homepage/);
          assert.doesNotMatch(englishOnly, /rel="alternate" hreflang="nb"/);
          assert.match(englishOnly, /href="\/no\/" hreflang="nb"/);
          await assert.rejects(readFile(join(dist, 'blog/secret-translation/index.html')), { code: 'ENOENT' });
          await readFile(join(dist, 'no/blog/same-slug/index.html'));
          await readFile(join(dist, 'blog/same-slug/index.html'));
          assert.match(notFound, /<html lang="en">/);
          assert.match(notFound, /<section lang="nb"/);
          assert.match(notFound, /Page not found/);
          assert.match(notFound, /href="\/">Go to homepage/);
          assert.match(notFound, /href="\/no\/">Gå til forsiden/);
          await assert.rejects(readdir(join(dist, 'en')), { code: 'ENOENT' });
          for (const html of [englishHome, norwegian, english, untranslated, englishOnly, notFound]) {
            assert.doesNotMatch(html, /<script\b/);
          }
        },
      );
    });

test('two versions of a translation in the same language fail even when one is a draft', async () => {
      await withBuild(
        [
          ['first.md', post({ slug: 'first', translationKey: 'shared' })],
          ['second.md', post({ slug: 'second', translationKey: 'shared', draft: true })],
        ],
        ({ status, output }) => {
          assert.notEqual(status, 0, output);
          assert.match(output, /Duplicate translationKey "shared" for "nb"/);
        },
      );
    });

test('an empty collection generates both language homepages without post pages', async () => {
      await withBuild([], async ({ status, output, dist }) => {
        assert.equal(status, 0, output);
        assert.match(await readFile(join(dist, 'no/index.html'), 'utf8'), /Det er ingen publiserte innlegg ennå/);
        assert.match(await readFile(join(dist, 'index.html'), 'utf8'), /There are no published posts yet/);
        await assert.rejects(readdir(join(dist, 'blog')), { code: 'ENOENT' });
        await assert.rejects(readdir(join(dist, 'no/blog')), { code: 'ENOENT' });
      });
    });
test('a collection containing only drafts builds an empty homepage and no post pages', async () => {
  await withBuild([['draft.md', post({ draft: true })]], async ({ status, output, dist }) => {
    assert.equal(status, 0, output);
    const index = await readFile(join(dist, 'no/index.html'), 'utf8');
    assert.match(index, /Det er ingen publiserte innlegg ennå/);
    assert.doesNotMatch(index, /fixture-post/);
    await assert.rejects(readdir(join(dist, 'blog')), { code: 'ENOENT' });
    await assert.rejects(readdir(join(dist, 'no/blog')), { code: 'ENOENT' });
  });
});
