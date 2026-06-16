import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

interface Props {
  content: string;
}

export default function MarkdownContent({ content }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          const code = String(children).replace(/\n$/, "");

          if (match) {
            return (
              <SyntaxHighlighter
                style={oneLight}
                language={match[1]}
                PreTag="div"
                customStyle={{
                  fontSize: "var(--font-size)",
                  borderRadius: "6px",
                  margin: "8px 0",
                }}
              >
                {code}
              </SyntaxHighlighter>
            );
          }

          // Block code without language specifier (multiline content)
          if (code.includes("\n")) {
            return (
              <div className="bg-gray-100 rounded-md p-4 my-2 overflow-x-auto">
                <code
                  className="text-sm"
                  style={{
                    whiteSpace: "pre",
                    display: "block",
                    fontFamily: "inherit",
                  }}
                >
                  {code}
                </code>
              </div>
            );
          }

          return (
            <code
              className="bg-gray-200 px-1.5 py-0.5 rounded text-sm"
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
              <table className="border-collapse border border-gray-300 w-full">
                {children}
              </table>
            </div>
          );
        },
        th({ children }) {
          return (
            <th className="border border-gray-300 px-3 py-1.5 bg-gray-100 text-left">
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td className="border border-gray-300 px-3 py-1.5">{children}</td>
          );
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {children}
            </a>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
