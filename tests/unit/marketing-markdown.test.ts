import { describe, it, expect } from 'vitest';
import { renderMarkdownToHtml, estimateReadingMinutes } from '@/lib/marketing/blog/markdown';

describe('Markdown renderer', () => {
  it('renders headings', () => {
    expect(renderMarkdownToHtml('# Title')).toContain('<h1>Title</h1>');
    expect(renderMarkdownToHtml('### Sub')).toContain('<h3>Sub</h3>');
  });

  it('renders paragraphs', () => {
    expect(renderMarkdownToHtml('hello world')).toContain('<p>hello world</p>');
  });

  it('renders bold / italic / inline code', () => {
    expect(renderMarkdownToHtml('**bold**')).toContain('<strong>bold</strong>');
    expect(renderMarkdownToHtml('*it*')).toContain('<em>it</em>');
    expect(renderMarkdownToHtml('`x`')).toContain('<code>x</code>');
  });

  it('renders ordered + unordered lists', () => {
    const ul = renderMarkdownToHtml('- a\n- b');
    expect(ul).toContain('<ul>');
    expect(ul).toContain('<li>a</li>');
    expect(ul).toContain('<li>b</li>');

    const ol = renderMarkdownToHtml('1. a\n2. b');
    expect(ol).toContain('<ol>');
  });

  it('renders code blocks with language', () => {
    const out = renderMarkdownToHtml('```ts\nconst x = 1;\n```');
    expect(out).toContain('<pre><code class="language-ts">');
    expect(out).toContain('const x = 1;');
  });

  it('renders blockquote / hr', () => {
    expect(renderMarkdownToHtml('> hi')).toContain('<blockquote><p>hi</p></blockquote>');
    expect(renderMarkdownToHtml('---')).toContain('<hr />');
  });

  it('renders safe links + rejects javascript: URLs', () => {
    expect(renderMarkdownToHtml('[ok](https://x.test)')).toContain(
      '<a href="https://x.test"',
    );
    expect(renderMarkdownToHtml('[bad](javascript:alert(1))')).toContain('href="#"');
  });

  it('escapes raw HTML in source', () => {
    const out = renderMarkdownToHtml('<script>alert(1)</script>');
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
  });

  it('estimates reading minutes by character length', () => {
    expect(estimateReadingMinutes('a')).toBeGreaterThanOrEqual(1);
    const long = 'あ'.repeat(1200);
    expect(estimateReadingMinutes(long)).toBe(2);
  });
});
