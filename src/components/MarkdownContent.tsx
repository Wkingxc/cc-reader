import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight, oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import "katex/dist/katex.min.css";
import { useIsDark } from "../hooks/useIsDark";
import { unwrapInlineMath } from "../utils/parseContent";

interface Props {
  content: string;
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard errors
    }
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="cc-code-copy"
      aria-label={copied ? "已复制" : "复制代码"}
      title={copied ? "已复制" : "复制"}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      )}
    </button>
  );
}

export default function MarkdownContent({ content }: Props) {
  const isDark = useIsDark();
  const processed = useMemo(() => unwrapInlineMath(content), [content]);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          const code = String(children).replace(/\n$/, "");

          if (match) {
            return (
              <div className="cc-code-block">
                <CopyButton code={code} />
                <SyntaxHighlighter
                  style={isDark ? oneDark : oneLight}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    fontSize: "var(--font-size)",
                    borderRadius: "10px",
                    margin: "8px 0",
                    background: "var(--c-code-bg)",
                    border: "1px solid var(--c-edge)",
                  }}
                >
                  {code}
                </SyntaxHighlighter>
              </div>
            );
          }
          if (code.includes("\n")) {
            return (
              <div className="cc-code-block">
                <CopyButton code={code} />
                <div className="bg-[var(--c-code-bg)] border border-edge rounded-lg p-4 my-2 overflow-x-auto">
                  <code className="text-sm" style={{ whiteSpace: "pre", display: "block", fontFamily: "inherit" }}>
                    {code}
                  </code>
                </div>
              </div>
            );
          }
          return (
            <code
              className="cc-inline-code bg-accent-soft text-ink px-1.5 rounded text-sm"
              {...props}
            >
              {children}
            </code>
          );
        },
        pre({ children }) {
          return <>{children}</>;
        },
        table({ children }) {
          return (
            <div className="overflow-x-auto my-2">
              <table className="border-collapse border border-edge w-full">{children}</table>
            </div>
          );
        },
        th({ children }) {
          return <th className="border border-edge px-3 py-1.5 bg-accent-soft text-left">{children}</th>;
        },
        td({ children }) {
          return <td className="border border-edge px-3 py-1.5">{children}</td>;
        },
        a({ href, children }) {
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              {children}
            </a>
          );
        },
      }}
    >
      {processed}
    </ReactMarkdown>
  );
}
