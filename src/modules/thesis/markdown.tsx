import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Renders a protocol's Markdown (with GitHub extensions: tables, task lists,
// strikethrough). Raw HTML in the text is not rendered.
export function ProtocolMarkdown({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed break-words [&_a]:text-brand [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-[13px] [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_hr]:my-4 [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:w-full [&_table]:text-left [&_td]:border-t [&_td]:py-1 [&_td]:pr-3 [&_th]:py-1 [&_th]:pr-3 [&_th]:font-medium [&_ul]:list-disc [&_ul]:pl-5 [&_ul:has(input)]:list-none [&_ul:has(input)]:pl-1 [&_input]:mr-1.5">
      <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
    </div>
  );
}
