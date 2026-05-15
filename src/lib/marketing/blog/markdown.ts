/**
 * 最小依存の Markdown -> HTML レンダラ
 *
 * 外部パッケージを増やしたくないため、本 MVP では以下のみサポート:
 *  - # / ## / ### / #### / ##### 見出し
 *  - **bold** / *italic* / `code`
 *  - ``` コードブロック ```
 *  - [text](url) リンク (xss 対策: javascript: スキーム拒否)
 *  - ![alt](url) 画像
 *  - リスト (- / * / 数字.)
 *  - > 引用
 *  - 水平線 ---
 *  - 段落 (空行区切り)
 *
 * 出力 HTML は本文表示用。SEO の構造化データは別途。
 */

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(url: string): string {
  const trimmed = url.trim();
  if (/^javascript:/i.test(trimmed)) return '#';
  if (/^data:/i.test(trimmed) && !/^data:image\//i.test(trimmed)) return '#';
  return trimmed;
}

function inline(text: string): string {
  let s = escapeHtml(text);
  // image first (so it doesn't get matched as link)
  s = s.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_, alt: string, url: string, title?: string) => {
      const t = title ? ` title="${escapeHtml(title)}"` : '';
      return `<img src="${safeUrl(url)}" alt="${alt}" loading="lazy"${t} />`;
    },
  );
  // link
  s = s.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_, label: string, url: string, title?: string) => {
      const t = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${safeUrl(url)}" rel="noopener noreferrer"${t}>${label}</a>`;
    },
  );
  // bold / italic / code
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s;
}

export function renderMarkdownToHtml(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inCode = false;
  let codeBuf: string[] = [];
  let codeLang = '';
  let listType: 'ul' | 'ol' | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length === 0) return;
    out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (!listType) return;
    out.push(`</${listType}>`);
    listType = null;
  };

  for (const rawLine of lines) {
    const line = rawLine;

    // code block
    if (/^```/.test(line)) {
      if (inCode) {
        out.push(
          `<pre><code${codeLang ? ` class="language-${escapeHtml(codeLang)}"` : ''}>${escapeHtml(codeBuf.join('\n'))}</code></pre>`,
        );
        inCode = false;
        codeBuf = [];
        codeLang = '';
      } else {
        flushPara();
        flushList();
        inCode = true;
        codeLang = line.replace(/^```/, '').trim();
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    // 空行
    if (line.trim() === '') {
      flushPara();
      flushList();
      continue;
    }

    // hr
    if (/^---+\s*$/.test(line)) {
      flushPara();
      flushList();
      out.push('<hr />');
      continue;
    }

    // heading
    const heading = /^(#{1,5})\s+(.*)$/.exec(line);
    if (heading) {
      flushPara();
      flushList();
      const level = heading[1]!.length;
      out.push(`<h${level}>${inline(heading[2]!)}</h${level}>`);
      continue;
    }

    // blockquote
    const quote = /^>\s+(.*)$/.exec(line);
    if (quote) {
      flushPara();
      flushList();
      out.push(`<blockquote><p>${inline(quote[1]!)}</p></blockquote>`);
      continue;
    }

    // list
    const ul = /^[-*]\s+(.*)$/.exec(line);
    const ol = /^\d+\.\s+(.*)$/.exec(line);
    if (ul || ol) {
      flushPara();
      const expected = ul ? 'ul' : 'ol';
      if (listType !== expected) {
        flushList();
        out.push(`<${expected}>`);
        listType = expected;
      }
      out.push(`<li>${inline((ul ?? ol)![1]!)}</li>`);
      continue;
    } else {
      flushList();
    }

    // paragraph
    para.push(line);
  }

  flushPara();
  flushList();
  if (inCode) {
    out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
  }
  return out.join('\n');
}

/**
 * Markdown 本文から読了分数を概算 (日本語 600 文字/分、英語 200 wpm)
 */
export function estimateReadingMinutes(md: string): number {
  const text = md.replace(/[#>*`\-_>!\[\]()]/g, ' ').trim();
  if (text.length === 0) return 1;
  // 日本語前提: 600 字 / 分
  return Math.max(1, Math.ceil(text.length / 600));
}
