// Article bodies are plain text: a blank line starts a new block, a single
// line break is kept, "## " / "### " start a heading, "* " / "- " / "• " start
// a bullet, "1. " / "1) " starts a numbered item and **text** is bold.
export type ArticleBlock =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; lines: string[] }
  | { type: "list"; ordered: boolean; start: number; items: string[] };

export type InlineSegment = { text: string; bold: boolean };

const headingPattern = /^(#{2,3})\s+(.+)$/;
const bulletPattern = /^[*\-•]\s+(.+)$/;
const numberedPattern = /^(\d{1,3})[.)]\s+(.+)$/;

export function parseArticleBlocks(body: string[]): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  const chunks = body.flatMap((chunk) => chunk.replace(/\r\n?/g, "\n").split(/\n\s*\n/));

  for (const chunk of chunks) {
    let paragraph: string[] | null = null;
    let list: Extract<ArticleBlock, { type: "list" }> | null = null;

    for (const raw of chunk.split("\n")) {
      const line = raw.trim();
      if (!line) continue;

      const heading = headingPattern.exec(line);
      if (heading) {
        paragraph = null;
        list = null;
        blocks.push({ type: "heading", level: heading[1].length === 2 ? 2 : 3, text: heading[2].trim() });
        continue;
      }

      const bullet = bulletPattern.exec(line);
      const numbered = bullet ? null : numberedPattern.exec(line);
      if (bullet || numbered) {
        const ordered = Boolean(numbered);
        if (!list || list.ordered !== ordered) {
          list = { type: "list", ordered, start: numbered ? Number(numbered[1]) : 1, items: [] };
          blocks.push(list);
        }
        list.items.push((bullet ? bullet[1] : numbered![2]).trim());
        paragraph = null;
        continue;
      }

      list = null;
      if (!paragraph) {
        paragraph = [];
        blocks.push({ type: "paragraph", lines: paragraph });
      }
      paragraph.push(line);
    }
  }

  return blocks;
}

export function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) segments.push({ text: text.slice(last, match.index), bold: false });
    segments.push({ text: match[1], bold: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), bold: false });
  return segments;
}
