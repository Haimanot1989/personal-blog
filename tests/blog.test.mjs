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
    topic: 'software-design',
    format: 'learning-note',
    ...overrides,
  };
  return { translationKey: metadata.slug, ...metadata };
}

async function withBuild(entries, inspect, talkEntries = []) {
  const directory = await mkdtemp(join(tmpdir(), 'personal-blog-test-'));
  try {
    for (const path of ['src', 'public', 'astro.config.mjs', 'tsconfig.json', 'package.json']) {
      await cp(join(root, path), join(directory, path), {
        recursive: true,
        filter: (source) => !['src/content/blog', 'src/content/talks']
          .some((path) => resolve(source) === resolve(root, path)),
      });
    }
    await symlink(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir');
    for (const [collection, fixtures] of [['blog', entries], ['talks', talkEntries]]) {
      const contentDirectory = join(directory, 'src/content', collection);
      await mkdir(contentDirectory, { recursive: true });
      for (const [filename, metadata] of fixtures) {
        const frontmatter = Object.entries(metadata)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
          .join('\n');
        await writeFile(
          join(contentDirectory, filename),
          `---\n${frontmatter}\n---\n\n## Fixture content\n\nMarkdown renders here.\n`,
        );
      }
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
  ['missing topic', { topic: undefined }, /topic/],
  ['unknown topic', { topic: 'books' }, /topic/],
  ['missing format', { format: undefined }, /format/],
  ['unknown format', { format: 'podcast' }, /format/],
  ['unsafe tag', { tags: ['../unsafe'] }, /tags/],
  ['duplicate tags', { tags: ['ddd', 'ddd'] }, /tags/],
  ['too many tags', { tags: ['a', 'b', 'c', 'd', 'e', 'f'] }, /tags/],
  ['unknown source type', { sources: [{ title: 'Source', type: 'unknown' }] }, /sources/],
  ['unsafe source URL', { sources: [{ title: 'Source', type: 'book', url: 'javascript:alert(1)' }] }, /HTTP or HTTPS/],
  ['malformed source URL', { sources: [{ title: 'Source', type: 'video', url: 'not-a-url' }] }, /sources/],
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
          assert.match(english, /href="\/writing\/"[^>]*>All writing/);
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

    test('journal pages browse localized topics, show labels and sources, and keep all writing available', async () => {
      await withBuild(
        [
          ...Array.from({ length: 6 }, (_, index) => [`note-${index}.md`, post({
            language: 'en', slug: `note-${index}`, title: `Note ${index}`,
            publishedDate: `2026-01-0${index + 1}`,
          })]),
          ['architecture.md', post({
            language: 'en', slug: 'architecture', title: 'Architecture example',
            topic: 'software-architecture', format: 'practice-report',
            tags: ['trade-offs', 'modularity'],
            sources: [
              { title: 'Architecture book', type: 'book', author: 'An author', locator: 'Chapter 3' },
              { title: 'Course example', type: 'course', url: 'https://example.com/course' },
              { title: 'Podcast example', type: 'podcast', url: 'https://example.com/podcast' },
            ],
          })],
          ['norwegian.md', post({ slug: 'norsk', title: 'Norsk notat' })],
          ['draft.md', post({ language: 'en', slug: 'hidden', title: 'Hidden note', draft: true })],
        ],
        async ({ status, output, dist }) => {
          assert.equal(status, 0, output);
          const home = await readFile(join(dist, 'index.html'), 'utf8');
          const writing = await readFile(join(dist, 'writing/index.html'), 'utf8');
          const topics = await readFile(join(dist, 'topics/index.html'), 'utf8');
          const design = await readFile(join(dist, 'topics/software-design/index.html'), 'utf8');
          const architecture = await readFile(join(dist, 'topics/software-architecture/index.html'), 'utf8');
          const norwegian = await readFile(join(dist, 'no/topics/software-design/index.html'), 'utf8');
          const emptyTopic = await readFile(join(dist, 'topics/computer-science/index.html'), 'utf8');
          const article = await readFile(join(dist, 'blog/architecture/index.html'), 'utf8');
          const about = await readFile(join(dist, 'about/index.html'), 'utf8');
          const talks = await readFile(join(dist, 'talks/index.html'), 'utf8');
          assert.equal((home.match(/<article>/g) ?? []).length, 5);
          assert.equal((writing.match(/<article>/g) ?? []).length, 7);
          assert.ok(writing.indexOf('/blog/note-5/') < writing.indexOf('/blog/note-0/'));
          assert.match(topics, /Writing: 6/);
          assert.match(design, /Note 0/);
          assert.doesNotMatch(design, /Architecture example|Norsk notat|Hidden note/);
          assert.match(architecture, /Architecture example/);
          assert.doesNotMatch(architecture, /Note 0/);
          assert.match(norwegian, /Norsk notat/);
          assert.match(norwegian, /Programvaredesign/);
          assert.doesNotMatch(norwegian, /Note 0/);
          assert.match(design, /href="\/no\/topics\/software-design\/" hreflang="nb"/);
          assert.match(design, /rel="canonical" href="https:\/\/haimanot\.dev\/topics\/software-design\/"/);
          assert.match(norwegian, /rel="alternate" hreflang="en" href="https:\/\/haimanot\.dev\/topics\/software-design\/"/);
          assert.match(emptyTopic, /There are no published posts yet/);
          assert.match(article, /Practice report/);
          assert.match(article, /class="tag-bubble" href="\/tags\/trade-offs\/">trade-offs/);
          assert.match(article, /class="tag-bubble" href="\/tags\/modularity\/">modularity/);
          assert.match(article, /<cite>Architecture book<\/cite>/);
          assert.match(article, /An author/);
          assert.match(article, /Chapter 3/);
          assert.match(article, /href="https:\/\/example\.com\/course"/);
          assert.match(article, /Podcast example/);
          assert.match(about, /understand and remember/);
          assert.match(about, /href="\/no\/about\/" hreflang="nb"/);
          assert.match(talks, /No talks published yet/);
          for (const html of [home, writing, topics, design, architecture, norwegian, about, talks]) {
            assert.doesNotMatch(html, /<script\b|Hidden note|\/blog\/hidden\//);
            assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
          }
          for (const section of ['writing', 'topics', 'talks', 'about']) {
            assert.match(writing, new RegExp(`href="/${section}/"`));
            const localized = await readFile(join(dist, 'no', section, 'index.html'), 'utf8');
            assert.match(localized, /<html lang="nb">/);
            assert.match(localized, new RegExp(`href="/no/${section}/"`));
          }
        },
      );
    });

    test('talks render materials and localized published related writing without exposing drafts', async () => {
      await withBuild(
        [
          ['english.md', post({ language: 'en', slug: 'learning', translationKey: 'shared-note' })],
          ['norwegian.md', post({ slug: 'laering', translationKey: 'shared-note' })],
          ['draft.md', post({ language: 'en', slug: 'secret-note', draft: true })],
        ],
        async ({ status, output, dist }) => {
          assert.equal(status, 0, output);
          const english = await readFile(join(dist, 'talks/design-talk/index.html'), 'utf8');
          const norwegian = await readFile(join(dist, 'no/talks/designforedrag/index.html'), 'utf8');
          const untranslated = await readFile(join(dist, 'talks/english-only/index.html'), 'utf8');
          const index = await readFile(join(dist, 'talks/index.html'), 'utf8');
          const topic = await readFile(join(dist, 'topics/software-design/index.html'), 'utf8');
          assert.match(english, /Fixture content/);
          assert.match(english, /href="https:\/\/example\.com\/slides">Slides/);
          assert.match(english, /href="https:\/\/example\.com\/recording">Recording/);
          assert.match(english, /Example meetup/);
          assert.match(english, /href="\/blog\/learning\/"/);
          assert.doesNotMatch(english, /secret-note|\/no\/blog\/laering\//);
          assert.match(norwegian, /href="\/no\/blog\/laering\/"/);
          assert.match(norwegian, /Relaterte innlegg/);
          for (const html of [english, norwegian]) {
            assert.match(html, /rel="alternate" hreflang="en" href="https:\/\/haimanot\.dev\/talks\/design-talk\/"/);
            assert.match(html, /rel="alternate" hreflang="nb" href="https:\/\/haimanot\.dev\/no\/talks\/designforedrag\/"/);
            assert.doesNotMatch(html, /<script\b/);
            assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
          }
          assert.match(untranslated, /Translation unavailable; go to homepage/);
          assert.doesNotMatch(untranslated, /secret-translation|rel="alternate" hreflang="nb"/);
          assert.doesNotMatch(index, /secret-translation/);
          assert.match(topic, /href="\/talks\/design-talk\/"/);
          assert.doesNotMatch(topic, /secret-translation|\/no\/talks\/designforedrag\//);
          await assert.rejects(readFile(join(dist, 'no/talks/secret-translation/index.html')), { code: 'ENOENT' });
        },
        [
          ['english.md', post({
            language: 'en', slug: 'design-talk', translationKey: 'shared-talk', event: 'Example meetup',
            slides: 'https://example.com/slides', recording: 'https://example.com/recording',
            relatedPosts: ['shared-note', 'secret-note'],
          })],
          ['norwegian.md', post({
            slug: 'designforedrag', translationKey: 'shared-talk', relatedPosts: ['shared-note'],
          })],
          ['untranslated.md', post({ language: 'en', slug: 'english-only', translationKey: 'unfinished-talk' })],
          ['draft.md', post({ slug: 'secret-translation', translationKey: 'unfinished-talk', draft: true })],
        ],
      );
    });

    test('tag bubbles and clouds link to sorted localized posts and never expose draft-only tags', async () => {
      await withBuild(
        [
          ['older.md', post({ language: 'en', slug: 'older-note', tags: ['ddd', 'modularity'] })],
          ['newer.md', post({
            language: 'en', slug: 'newer-note', tags: ['ddd'], publishedDate: '2026-02-01',
          })],
          ['unrelated.md', post({ language: 'en', slug: 'unrelated', tags: [] })],
          ['norwegian.md', post({ slug: 'norsk-notat', tags: ['ddd'] })],
          ['draft.md', post({ language: 'en', slug: 'secret', tags: ['ddd', 'draft-only'], draft: true })],
        ],
        async ({ status, output, dist }) => {
          assert.equal(status, 0, output);
          const writing = await readFile(join(dist, 'writing/index.html'), 'utf8');
          const cloud = writing.match(/<section class="browse-tags"[\s\S]*?<\/section>/)?.[0];
          assert.ok(cloud);
          assert.match(cloud, /Browse by tag/);
          assert.equal((cloud.match(/href="\/tags\/ddd\/"/g) ?? []).length, 1);
          assert.ok(cloud.indexOf('/tags/ddd/') < cloud.indexOf('/tags/modularity/'));
          const tagged = await readFile(join(dist, 'tags/ddd/index.html'), 'utf8');
          const norwegian = await readFile(join(dist, 'no/tags/ddd/index.html'), 'utf8');
          const empty = await readFile(join(dist, 'no/tags/modularity/index.html'), 'utf8');
          const article = await readFile(join(dist, 'blog/older-note/index.html'), 'utf8');
          assert.match(article, /class="tag-bubble" href="\/tags\/ddd\/">ddd<\/a>/);
          assert.match(tagged, /<h1[^>]*>Tags: ddd<\/h1>/);
          assert.match(tagged, /rel="canonical" href="https:\/\/haimanot\.dev\/tags\/ddd\/"/);
          assert.match(tagged, /href="\/no\/tags\/ddd\/" hreflang="nb"/);
          assert.ok(tagged.indexOf('/blog/newer-note/') < tagged.indexOf('/blog/older-note/'));
          assert.doesNotMatch(tagged, /\/blog\/unrelated\/|\/no\/blog\/norsk-notat\/|\/blog\/secret\//);
          assert.match(norwegian, /Stikkord: ddd/);
          assert.match(norwegian, /class="tag-bubble" href="\/no\/tags\/ddd\/"/);
          assert.match(norwegian, /href="\/no\/blog\/norsk-notat\/"/);
          assert.doesNotMatch(norwegian, /\/blog\/older-note\/|\/blog\/newer-note\//);
          assert.match(empty, /Det er ingen publiserte innlegg ennå/);
          assert.match(empty, /href="\/tags\/modularity\/" hreflang="en"/);
          for (const html of [writing, tagged, norwegian, empty, article]) {
            assert.doesNotMatch(html, /draft-only|<script\b/);
          }
          await assert.rejects(readFile(join(dist, 'tags/draft-only/index.html')), { code: 'ENOENT' });
          await assert.rejects(readFile(join(dist, 'no/tags/draft-only/index.html')), { code: 'ENOENT' });
        },
      );
    });

    for (const [label, entries, error] of [
      ['duplicate slug including drafts', [
        ['first.md', post()], ['second.md', post({ draft: true })],
      ], /Duplicate talks slug/],
      ['duplicate translation key', [
        ['first.md', post()], ['second.md', post({ slug: 'second', translationKey: 'fixture-post' })],
      ], /Duplicate translationKey/],
      ['missing related post', [
        ['invalid.md', post({ relatedPosts: ['missing-post'] })],
      ], /Unknown relatedPosts translationKey/],
      ['unsafe slides URL', [
        ['invalid.md', post({ slides: 'javascript:alert(1)' })],
      ], /HTTP or HTTPS/],
      ['unsafe recording URL', [
        ['invalid.md', post({ recording: 'data:text/html,unsafe' })],
      ], /HTTP or HTTPS/],
    ]) {
      test(`invalid talk fails the build: ${label}`, async () => {
        await withBuild([], ({ status, output }) => {
          assert.notEqual(status, 0, output);
          assert.match(output, error);
        }, entries);
      });
    }

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
