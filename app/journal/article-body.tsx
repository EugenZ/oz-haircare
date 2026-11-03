import { Fragment } from "react";
import { parseArticleBlocks, parseInline } from "@/lib/article-format";

function Inline({ text }: { text: string }) {
  return parseInline(text).map((segment, index) =>
    segment.bold ? <strong key={index}>{segment.text}</strong> : <Fragment key={index}>{segment.text}</Fragment>,
  );
}

export function ArticleBody({ body }: { body: string[] }) {
  return (
    <div className="article-body">
      {parseArticleBlocks(body).map((block, index) => {
        if (block.type === "heading") {
          const Heading = block.level === 2 ? "h2" : "h3";
          return (
            <Heading key={index}>
              <Inline text={block.text} />
            </Heading>
          );
        }
        if (block.type === "list") {
          const items = block.items.map((item, itemIndex) => (
            <li key={itemIndex}>
              <Inline text={item} />
            </li>
          ));
          return block.ordered ? (
            <ol key={index} start={block.start === 1 ? undefined : block.start}>
              {items}
            </ol>
          ) : (
            <ul key={index}>{items}</ul>
          );
        }
        return (
          <p key={index}>
            {block.lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 ? <br /> : null}
                <Inline text={line} />
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
