import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  p: (props) => <p className="mb-3 last:mb-0" {...props} />,
  ul: (props) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0" {...props} />,
  ol: (props) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0" {...props} />,
  h1: (props) => <p className="mb-2 font-semibold" {...props} />,
  h2: (props) => <p className="mb-2 font-semibold" {...props} />,
  h3: (props) => <p className="mb-2 font-semibold" {...props} />,
  a: (props) => (
    <a
      className="text-violet-700 underline underline-offset-2 dark:text-violet-300"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  code: (props) => (
    <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.9em] dark:bg-zinc-800" {...props} />
  ),
};

/** Renders Nova's replies. Raw HTML in the text is ignored. */
export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}
