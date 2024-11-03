import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { translations } from "@/constants/languages";
import {
  useChat,
  useChatsHistory,
  useGetMessageStream,
  useHapaks,
  useReadMessageStream,
  useReport,
  useSubmitReportFeedback,
  useUpdateChat,
  useUpdateChatMessageFeedback,
} from "@/api";
import { Message, Option } from "@/types";
import { MultiSelect } from "./ui/multi-select";
import { ChatBubble } from "@/components/chat-bubble";
import { useLocalStorage } from "../hooks/use-local-storage";
import Markdown from "react-markdown";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import { Feedback } from "./ui/feedback";

const t = translations;

export function ChatAppComponent() {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const { chatId } = useParams() as { chatId: string };
  const [selectedHapaks, setSelectedHapaks] = useLocalStorage<Option[]>("selectedHapaks", []);
  const [days, setDays] = useLocalStorage<number>("days", 0);
  const [hours, setHours] = useLocalStorage<number>("hours", 0);
  const [positiveKeywords, setPositiveKeywords] = useLocalStorage<Option[]>("positiveKeywords", []);

  // Fetching all hapaks for user to choose from
  const { hapaks, isLoading: isLoadingHapaks } = useHapaks();

  // Fetching all chats history for user to choose from
  const { chatsHistory, isLoading: isLoadingChatsHistory } = useChatsHistory();

  // Fetching the current chat
  const { chat } = useChat(chatId || "");

  const { updateChat } = useUpdateChat();

  const {
    asyncGetChatStream,
    messageQueryId,
    isPending: messageStreamIsPending,
  } = useGetMessageStream();

  const {
    readMessageStream,
    isPending: isReadingMessage,
    generatedMessage,
    generationStartedAt,
  } = useReadMessageStream({
    onSuccess: ({ generatedMessage, generationStartedAt }, { query, queryId }) => {
      updateChat({
        id: chatId,
        data: {
          messages: [
            ...(chat?.messages || []),
            {
              content: generatedMessage,
              date: generationStartedAt,
              filters: getFilters(),
              id: crypto.randomUUID(),
              query,
              queryId,
              sender: "bot",
            },
          ],
        },
      });
    },
  });

  const { updateChatMessageFeedback } = useUpdateChatMessageFeedback();

  const { submitReportFeedback } = useSubmitReportFeedback();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [generatedMessage, chat?.messages]);

  const getFilters = () =>
    ({
      conversations: selectedHapaks.map((hapak) => hapak.value),
      date_range: new Date(
        Date.now() - days * 24 * 60 * 60 * 1000 - hours * 60 * 60 * 1000
      ).toISOString(),
      keywords: positiveKeywords.map((keyword) => keyword.value),
    } as const);

  const handleSend = async () => {
    setQuery("");

    const message: Message = {
      content: query,
      id: crypto.randomUUID(),
      sender: "user",
      date: new Date(),
      filters: getFilters(),
      query,
      // User message doesn't have queryId
      queryId: "",
    };
    updateChat({ id: chatId, data: { messages: [...(chat?.messages || []), message] } });

    const { reader, queryId, messageReports } = await asyncGetChatStream({
      query,
      ...getFilters(),
      session_id: chatId,
    });

    if (!reader) {
      // TODO: Handle error
      return;
    }

    readMessageStream({ reader, chatId, query, queryId: queryId || "", messageReports });
  };

  const [searchParams] = useSearchParams();

  const reportId = searchParams.get("reportId") || "";
  const queryId = searchParams.get("queryId") || "";

  const { report } = useReport(chatId, reportId, queryId);

  if (isLoadingHapaks || isLoadingChatsHistory || !chat) return null;

  return (
    <div className="flex h-screen bg-background text-foreground p-4 gap-4" dir="rtl">
      {/* Sidebar */}
      <div className="w-72 bg-card text-card-foreground p-6 border border-border rounded-xl shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">{t.TAB_CHAT_HISTORY}</h2>
        </div>
        <ScrollArea className="h-[calc(100vh-250px)]">
          <div className="space-y-2">
            {chatsHistory.map((item, index) => (
              <Link to={`/chat/${item.id}`} key={item.id}>
                <Button
                  key={index}
                  variant="ghost"
                  className="w-full justify-start hover:shadow-md transition-shadow rtl text-right border-b border-border/30"
                >
                  <span className="truncate block w-full">
                    {item.messages.length <= 1
                      ? item.messages.at(0)?.content
                      : item.messages.findLast((m) => m.sender === "user")?.content}
                  </span>
                </Button>
              </Link>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-card rounded-xl shadow-lg border border-border">
        <ScrollArea className="flex-1 p-6">
          <div className="space-y-6">
            {chat?.messages.map((message) => (
              <ChatBubble
                chatId={chatId}
                key={message.id}
                message={message}
                onFeedback={(feedback) => {
                  updateChatMessageFeedback({
                    chatId,
                    messageId: message.id,
                    data: {
                      ...message.filters,
                      feedback,
                      llm_answer: message.content,
                      query: message.query,
                      query_id: message.id,
                      session_id: chatId,
                    },
                  });
                }}
              />
            ))}
            {((isReadingMessage && generatedMessage) || messageStreamIsPending) && (
              <ChatBubble
                chatId={chatId}
                message={{
                  content: messageStreamIsPending ? t.THINKING_OF_ANSWER : generatedMessage,
                  sender: "bot",
                  id: crypto.randomUUID(),
                  date: generationStartedAt,

                  // Dummy filters and query while waiting for the response
                  filters: getFilters(),
                  query: "",
                  queryId: messageQueryId || "",
                }}
                onFeedback={() => {}}
                showFeedback={false}
              />
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        <div className="p-6 bg-card border-t border-border rounded-b-xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-4"
          >
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.CHAT_INPUT_PLACEHOLDER}
              className="flex-1 shadow-sm"
            />
            <Button type="submit" className="shadow-sm">
              {t.SEND_BUTTON}
            </Button>
          </form>
        </div>
      </div>

      {/* Report Panel */}
      {report !== null ? (
        <div className="w-96 overflow-y-auto">
          {/* Header Section */}
          <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-background z-10">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold">{report?.report_title}</h2>
              <Feedback
                feedback={report?.feedback}
                onFeedback={(feedback) => {
                  submitReportFeedback({
                    reportId: reportId || "",
                    reportTitle: report?.report_title || "",
                    queryId: queryId || "",
                    feedback,
                    chatId,
                  });
                }}
              />
            </div>
            <Link to={`/chat/${chatId}`}>
              <Button variant="ghost" size="icon">
                <X className="h-[1.2rem] w-[1.2rem]" />
              </Button>
            </Link>
          </div>

          {/* Metadata Section */}
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold mb-4">{t.REPORT_METADATA}</h2>
            <div className="space-y-4">
              <div className="flex gap-2 items-center shadow-sm p-2 hover:bg-muted/50 transition-colors">
                <span className="font-medium min-w-[120px]">{t.TAZAK}:</span>
                <span>{report?.report_tazak}</span>
              </div>
              <div className="flex gap-2 items-center shadow-sm p-2 hover:bg-muted/50 transition-colors">
                <span className="font-medium min-w-[120px]">{t.REPORT_UPDATE_DATE}:</span>
                <span>{report?.report_updated_date}</span>
              </div>
              <div className="flex gap-2 items-center shadow-sm p-2 hover:bg-muted/50 transition-colors">
                <span className="font-medium min-w-[120px]">{t.SPEAKER_A}:</span>
                <span>{report?.speaker_a}</span>
              </div>
              <div className="flex gap-2 items-center shadow-sm p-2 hover:bg-muted/50 transition-colors">
                <span className="font-medium min-w-[120px]">{t.SPEAKER_B}:</span>
                <span>{report?.speaker_b}</span>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4">{t.REPORT_RAW_TEXT}</h2>
            <div className="prose prose-sm max-w-none p-4 shadow-sm rounded-lg bg-muted/30">
              <Markdown rehypePlugins={[remarkRehype, rehypeRaw]} components={{}}>
                {report?.report_raw_text}
              </Markdown>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-96 bg-card text-card-foreground p-6 border border-border rounded-xl shadow-lg overflow-y-auto">
          <h2 className="text-xl font-bold mb-6">{t.SETTINGS_TITLE}</h2>
          <div className="space-y-6 divide-y divide-border">
            <div className="pt-6">
              <h3 className="font-medium mb-3">{t.SELECT_PROJECTS_LABEL}</h3>
              <MultiSelect
                options={hapaks}
                onChange={(values) => {
                  setSelectedHapaks(values);
                }}
                value={selectedHapaks}
                placeholder={t.SELECT_PROJECT_PLACEHOLDER}
                className="shadow-sm"
                creatable
              />
            </div>
            <div className="pt-6">
              <h3 className="font-medium mb-3">{t.TIME_RANGE_LABEL}</h3>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm mb-1">{t.DAYS}</label>
                  <Input
                    type="number"
                    min="0"
                    value={days}
                    onChange={(e) => setDays(Math.max(0, parseInt(e.target.value)))}
                    placeholder={t.DAYS}
                    className="shadow-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm mb-1">{t.HOURS}</label>
                  <Input
                    type="number"
                    min="0"
                    value={hours}
                    onChange={(e) => setHours(Math.max(0, parseInt(e.target.value)))}
                    placeholder={t.HOURS}
                    className="shadow-sm"
                  />
                </div>
              </div>
            </div>
            <div className="pt-6">
              <h3 className="font-medium mb-3">{t.MANDATORY_WORDS_LABEL}</h3>
              <MultiSelect
                options={[]}
                onChange={(values) => {
                  setPositiveKeywords(values);
                }}
                value={positiveKeywords}
                placeholder={t.MANDATORY_WORDS_PLACEHOLDER}
                creatable
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
