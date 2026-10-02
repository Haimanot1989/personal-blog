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
  return {
    title: 'Fixture post',
    description: 'A fixture description.',
    publishedDate: '2026-01-01',
    slug: 'fixture-post',
    ...overrides,
  };
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
      const index = await readFile(join(dist, 'index.html'), 'utf8');
      const older = await readFile(join(dist, 'blog/older/index.html'), 'utf8');
      const newer = await readFile(join(dist, 'blog/newer/index.html'), 'utf8');
      const notFound = await readFile(join(dist, '404.html'), 'utf8');
      assert.ok(index.indexOf('/blog/a-tie/') < index.indexOf('/blog/newer/'));
      assert.ok(index.indexOf('/blog/newer/') < index.indexOf('/blog/older/'));
      assert.doesNotMatch(index, /hidden-draft|Secret draft/);
      assert.deepEqual((await readdir(join(dist, 'blog'))).sort(), ['a-tie', 'newer', 'older']);
      assert.match(newer, /<title>Newer post \| Haimanot<\/title>/);
      assert.match(newer, /name="description" content="A fixture description\."/);
      assert.match(newer, /rel="canonical" href="https:\/\/haimanot\.dev\/blog\/newer\/"/);
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
];

for (const [label, overrides, expectedError] of invalidMetadata) {
  test(`invalid metadata fails the build: ${label}`, async () => {
    await withBuild([['invalid.md', post(overrides)]], ({ status, output }) => {
      assert.notEqual(status, 0, output);
      assert.match(output, expectedError);
    });
  });
}

test('a collection containing only drafts builds an empty homepage and no post pages', async () => {
  await withBuild([['draft.md', post({ draft: true })]], async ({ status, output, dist }) => {
    assert.equal(status, 0, output);
    const index = await readFile(join(dist, 'index.html'), 'utf8');
    assert.match(index, /Det er ingen publiserte innlegg ennå/);
    assert.doesNotMatch(index, /fixture-post/);
    await assert.rejects(readdir(join(dist, 'blog')), { code: 'ENOENT' });
  });
});
