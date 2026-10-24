import { memo, useState, type ReactNode } from "react";
import { Icon } from "./Icon.js";

/**
 * Minimal, dependency-free markdown renderer for agent output.
 * Everything is rendered as React nodes (no dangerouslySetInnerHTML),
 * so user/model content can never inject markup. Supports the subset
 * models actually emit: paragraphs, headings, lists, blockquotes, hr,
 * inline code, fenced code blocks, bold/italic and links.
 */

/* ---------- inline ---------- */

const INLINE_RE =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(\[[^\]\n]+\]\([^)\s]+\))|(https?:\/\/[^\s<>()]+)/g;

function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url, "http://invalid.local");
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const token = m[0];
    const key = `${keyPrefix}-${k++}`;
    if (token.startsWith("`")) {
      out.push(
        <code className="inline" key={key}>
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**")) {
      out.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      out.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("[")) {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      const href = link?.[2] ?? "";
      if (link && isSafeUrl(href)) {
        out.push(
          <a key={key} href={href} target="_blank" rel="noreferrer noopener">
            {link[1]}
          </a>
        );
      } else out.push(token);
    } else if (isSafeUrl(token)) {
      out.push(
        <a key={key} href={token} target="_blank" rel="noreferrer noopener">
          {token}
        </a>
      );
    } else {
      out.push(token);
    }
    last = m.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/* ---------- code block ---------- */

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <figure className="codeblock" style={{ margin: "0.6em 0" }}>
      <div className="codeblock-head">
        <span className="codeblock-lang">{lang || "text"}</span>
        <button
          type="button"
          className="icon-btn"
          title={copied ? "Copied" : "Copy code"}
          aria-label="Copy code"
          onClick={() => {
            void navigator.clipboard?.writeText(code).then(
              () => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1400);
              },
              () => undefined
            );
          }}
        >
          <Icon name={copied ? "check" : "copy"} />
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </figure>
  );
}

/* ---------- block parser ---------- */

function isBlank(line: string): boolean {
  return line.trim().length === 0;
}

function renderBlocks(src: string, ctxKey: string): ReactNode[] {
  const out: ReactNode[] = [];
  // split into fenced code and regular chunks
  const fence = /```(\w*)[ \t]*\n([\s\S]*?)(?:```|$)/g;
  let cursor = 0;
  let m: RegExpExecArray | null;
  let fk = 0;
  while ((m = fence.exec(src)) !== null) {
    if (m.index > cursor) out.push(...renderPlain(src.slice(cursor, m.index), `${ctxKey}t${fk}`));
    out.push(<CodeBlock key={`${ctxKey}c${fk}`} lang={m[1] || undefined} code={m[2] ?? ""} />);
    cursor = m.index + m[0].length;
    fk++;
  }
  if (cursor < src.length) out.push(...renderPlain(src.slice(cursor), `${ctxKey}t${fk}`));
  return out;
}

/** Parse non-code prose into block elements. */
function renderPlain(src: string, ctxKey: string): ReactNode[] {
  const out: ReactNode[] = [];
  const lines = src.split("\n");
  let i = 0;
  let bk = 0;
  const key = (s: string) => `${ctxKey}b${bk++}-${s}`;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (isBlank(line)) {
      i++;
      continue;
    }

    // heading
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1]?.length ?? 1;
      const content = renderInline(h[2] ?? "", key("h"));
      const k = key("hd");
      out.push(
        level === 1 ? <h1 key={k}>{content}</h1>
          : level === 2 ? <h2 key={k}>{content}</h2>
          : level === 3 ? <h3 key={k}>{content}</h3>
          : <h4 key={k}>{content}</h4>
      );
      i++;
      continue;
    }

    // horizontal rule
    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      out.push(<hr key={key("hr")} />);
      i++;
      continue;
    }

    // blockquote (gather consecutive > lines)
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i] ?? "")) {
        buf.push((lines[i] ?? "").replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push(
        <blockquote key={key("bq")}>{renderPlain(buf.join("\n"), key("bqc"))}</blockquote>
      );
      continue;
    }

    // lists (gather consecutive items of the same marker type)
    const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
    const ol = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      const ordered = !ul;
      const items: string[] = [];
      while (i < lines.length) {
        const cur = lines[i] ?? "";
        const mU = /^\s*[-*+]\s+(.*)$/.exec(cur);
        const mO = /^\s*(\d+)[.)]\s+(.*)$/.exec(cur);
        const match = ordered ? mO : mU;
        if (!match) {
          // allow wrapped continuation lines inside a list item
          if (!isBlank(cur) && /^\s+\S/.test(cur) && items.length > 0) {
            items[items.length - 1] = `${items[items.length - 1] ?? ""} ${cur.trim()}`;
            i++;
            continue;
          }
          break;
        }
        items.push((ordered ? mO?.[2] : mU?.[1]) ?? "");
        i++;
      }
      const content = items.map((item, idx) => <li key={idx}>{renderInline(item, key(`li${idx}`))}</li>);
      out.push(ordered ? <ol key={key("ol")}>{content}</ol> : <ul key={key("ul")}>{content}</ul>);
      continue;
    }

    // paragraph (until blank line / fence / heading / list marker)
    const buf: string[] = [];
    while (i < lines.length) {
      const cur = lines[i] ?? "";
      if (isBlank(cur) || /^(#{1,4}\s|\s*>|```)/.test(cur)) break;
      // list markers always start a new block
      if (/^\s*([-*+]\s|\d+[.)]\s)/.test(cur)) break;
      buf.push(cur.replace(/\s{2,}$/, ""));
      i++;
    }
    if (buf.length > 0) {
      out.push(<p key={key("p")}>{renderInline(buf.join("\n"), key("pc"))}</p>);
    } else {
      i++;
    }
  }
  return out;
}

export const Markdown = memo(function Markdown({ content }: { content: string }) {
  return <div className="md">{renderBlocks(content, "md")}</div>;
});
