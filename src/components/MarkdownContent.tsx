import { useMemo } from "react";
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
            );
          }
          if (code.includes("\n")) {
            return (
              <div className="bg-[var(--c-code-bg)] border border-edge rounded-lg p-4 my-2 overflow-x-auto">
                <code className="text-sm" style={{ whiteSpace: "pre", display: "block", fontFamily: "inherit" }}>
                  {code}
                </code>
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
