import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// 검색 노출용 정적 정보(index.html·public). 주소가 한 곳에서 바뀌면 나머지가 어긋나기 쉬워 서로 맞는지 확인한다.
const root = resolve(__dirname, '../..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const meta = (attr: 'name' | 'property', key: string) => html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))?.[1];
const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];

describe('search engine metadata', () => {
  it('uses one site URL for canonical, Open Graph, sitemap and the Pages base path', () => {
    expect(canonical).toBe('https://kigpand.github.io/trap-platformer/');
    expect(meta('property', 'og:url')).toBe(canonical);
    expect(readFileSync(resolve(root, 'public/sitemap.xml'), 'utf8')).toContain(`<loc>${canonical}</loc>`);
    expect(readFileSync(resolve(root, 'vite.config.ts'), 'utf8')).toContain(`'${new URL(canonical ?? '').pathname}'`);
  });

  it('describes the page and points the preview image at a file that is published', () => {
    expect(meta('name', 'description')?.length).toBeGreaterThan(50);
    const image = meta('property', 'og:image') ?? '';
    expect(image.startsWith(canonical ?? '-')).toBe(true);
    expect(existsSync(resolve(root, 'public', image.slice((canonical ?? '').length)))).toBe(true);
  });

  it('keeps readable text in the HTML for crawlers that do not run JavaScript', () => {
    const body = html.slice(html.indexOf('<div id="root">'));
    expect(body).toContain('<h1>TRAP RUNNER</h1>');
    expect(body).toContain('함정 플랫포머');
  });
});
