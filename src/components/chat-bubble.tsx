import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Feedback as IFeedback, Message } from "@/types";
import Markdown from "react-markdown";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import { Link } from "react-router-dom";
import { translations } from "@/constants/languages";
import { CopyIcon } from "lucide-react";
import { Feedback } from "./ui/feedback";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { useReport } from "@/api";
import { useLocalStorage } from "@/hooks/use-local-storage";

interface ChatBubbleProps {
  chatId: string;
  message: Message;
  onFeedback: (type: IFeedback) => void;
  showFeedback?: boolean;
  showCopy?: boolean;
}

export function ChatBubble({
  chatId,
  message,
  onFeedback,
  showFeedback = true,
  showCopy = true,
}: ChatBubbleProps) {
  const handleCopy = () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(message.content, "text/html");
    const cleanedContent = doc.body.textContent || "";
    navigator.clipboard.writeText(cleanedContent.replace(/הצג דיווח/g, " "));
  };

  return (
    <div className={cn(`${message.sender === "bot" ? "justify-end" : "justify-start"}`, "flex")}>
      <span
        className={`inline-block p-4 rounded-xl shadow-md rtl ${
          message.sender === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground"
        }`}
      >
        <div className="mb-1 text-xs opacity-70">
          {new Date(message.date).toLocaleString("he-IL")}
        </div>
        <Markdown
          rehypePlugins={[remarkRehype, rehypeRaw]}
          components={{
            a: ({ href, children }) => {
              const reportId = href;
              const url = `/chat/${chatId}?reportId=${reportId}&queryId=${message.queryId}`;

              return (
                <Link to={url}>
                  <Button variant="outline" size="lg">
                    {children}
                  </Button>
                </Link>
              );
            },
            "more-messages": ({ ids }: { ids: string }) => {
              return <MoreMessages ids={ids} chatId={chatId} queryId={message.queryId} />;
            },
          }}
        >
          {message.content}
        </Markdown>
        {message.sender === "bot" && (
          <div className="mt-2 flex gap-2 justify-between">
            {showFeedback && <Feedback feedback={message.feedback} onFeedback={onFeedback} />}

            {showCopy && (
              <Button
                variant="outline"
                size="sm"
                className="p-1 h-8 w-8 hover:bg-blue-50"
                onClick={handleCopy}
                title={translations.COPY_TEXT}
              >
                <CopyIcon className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </span>
    </div>
  );
}

const MoreMessages = ({
  ids,
  chatId,
  queryId,
}: {
  ids: string;
  chatId: string;
  queryId: string;
}) => {
  const reportIds = ids.split(",");

  const [value, setValue] = useLocalStorage(`more-messages-${queryId}`, "");

  if (reportIds.length === 0) return null;

  return (
    <Accordion
      defaultValue={value}
      onValueChange={setValue}
      type="single"
      collapsible
      value={value}
    >
      <AccordionItem value="item-1">
        <AccordionTrigger>{translations.SHOW_MORE_REPORTS}</AccordionTrigger>
        <AccordionContent className="space-y-2">
          {reportIds.map((reportId) => {
            return <Report key={reportId} chatId={chatId} reportId={reportId} queryId={queryId} />;
          })}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

const Report = ({
  chatId,
  reportId,
  queryId,
}: {
  chatId: string;
  reportId: string;
  queryId: string;
}) => {
  const { report } = useReport(chatId, reportId, queryId);

  const url = `/chat/${chatId}?reportId=${reportId}&queryId=${queryId}`;

  return (
    <div className="flex items-center gap-2">
      {report?.report_title}
      <Link replace to={url} key={reportId}>
        <Button variant="outline" size="lg">
          {translations.SHOW_REPORT}
        </Button>
      </Link>
    </div>
  );
};
