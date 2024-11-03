import {
  keepPreviousData,
  MutationOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Chat, Message, Option, Report } from "./types";
import { Chats } from "./types";
import { queryKeyFactory } from "./lib/query-key-factory";
import { useRef, useState } from "react";
import { readJsonStream } from "./lib/utils";
import { translations } from "./constants/languages";

const t = translations;

const getChatsFromStorage = (): Chats => {
  const chatsFromStorage = localStorage.getItem("chats");
  if (!chatsFromStorage) return [];

  try {
    return JSON.parse(chatsFromStorage) as Chats;
  } catch (error) {
    console.error("Failed to parse chats from storage:", error);
    return [];
  }
};

const updateChatById = (chats: Chats, id: string, data: Omit<Partial<Chat>, "id">) => {
  const updatedChats = chats.map((chat) => (chat.id === id ? { ...chat, ...data } : chat));
  return updatedChats;
};

const updateChatMessageById = (
  chats: Chats,
  chatId: string,
  messageId: string,
  data: Omit<Partial<Message>, "id">
) => {
  const updatedChats = chats.map((chat) =>
    chat.id === chatId
      ? {
          ...chat,
          messages: chat.messages.map((msg) => (msg.id === messageId ? { ...msg, ...data } : msg)),
        }
      : chat
  );
  return updatedChats;
};

export const useCreateChat = (options: MutationOptions<Chat, void>) => {
  const mutation = useMutation({
    mutationFn: async () => {
      const id = crypto.randomUUID();
      const newChat: Chat = {
        id,
        messages: [
          {
            id: crypto.randomUUID(),
            sender: "bot",
            content: "שלום וברכה, איך אוכל לעזור לך היום?",
            date: new Date(),
            filters: {
              conversations: [],
              date_range: new Date().toISOString(),
              keywords: [],
            },
            query: "",
            queryId: "",
          },
        ],
      };
      const updatedChats = [...getChatsFromStorage(), newChat];
      localStorage.setItem("chats", JSON.stringify(updatedChats));

      return newChat;
    },
    ...options,
  });

  return { createChat: mutation.mutate, ...mutation };
};

export const useHapaks = () => {
  const query = useQuery({
    queryKey: queryKeyFactory.getHapaks(),
    queryFn: async () => {
      const res = await fetch("https://dummpy-api.onrender.com/get_hapaks");
      return (await res.json()) as Option[];
    },
    staleTime: Infinity,
  });

  return { hapaks: query.data || [], ...query };
};

export const useChatsHistory = () => {
  const query = useQuery({
    queryKey: queryKeyFactory.getChatsHistory(),
    queryFn: getChatsFromStorage,
    staleTime: Infinity,
  });

  return { chatsHistory: query.data || [], ...query };
};

export const useChat = (chatId: string) => {
  const { chatsHistory } = useChatsHistory();

  const chat = chatsHistory.find((chat) => chat.id === chatId);

  return { chat };
};

export const useUpdateChat = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    onMutate: ({ id, data }) => {
      queryClient.setQueryData(queryKeyFactory.getChatsHistory(), (old: Chats) => {
        return updateChatById(old, id, data);
      });
    },

    mutationFn: async ({ id, data }: { id: string; data: Omit<Partial<Chat>, "id"> }) => {
      const updatedChats = updateChatById(getChatsFromStorage(), id, data);
      localStorage.setItem("chats", JSON.stringify(updatedChats));
      return updatedChats;
    },
  });

  return { updateChat: mutation.mutate, ...mutation };
};

export const useGetMessageStream = () => {
  const mutation = useMutation({
    mutationFn: async (payload: {
      query: string;
      keywords: string[];
      date_range: string;
      session_id: string;
      conversations: string[];
    }) => {
      const res = await fetch("https://dummpy-api.onrender.com/run_chat_stream", {
        method: "POST",
        body: JSON.stringify({ ...payload, auth_token: "123456789" }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      const reader = res.body?.getReader();

      const headers = res.headers;

      const queryId = headers.get("query-id");

      const messageReports = JSON.parse(headers.get("request-ids") || "[]");

      return { reader, queryId, messageReports };
    },
  });

  return {
    getChatStream: mutation.mutate,
    asyncGetChatStream: mutation.mutateAsync,
    messageStream: mutation.data?.reader,
    messageQueryId: mutation.data?.queryId,
    messageReports: mutation.data?.messageReports,
    ...mutation,
  };
};

export const useReadMessageStream = (
  options: MutationOptions<
    { generatedMessage: string; generationDuration: number; generationStartedAt: Date },
    void,
    {
      reader: ReadableStreamDefaultReader | undefined;
      chatId: string;
      query: string;
      queryId: string;
      messageReports: string[];
    }
  >
) => {
  const abortControllerRef = useRef(new AbortController());
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [generationStartedAt, setGenerationStartedAt] = useState<Date>(new Date());

  const mutation = useMutation({
    mutationFn: async ({
      reader,
      messageReports,
    }: {
      chatId: string;
      query: string;
      reader: ReadableStreamDefaultReader | undefined;
      queryId: string;
      messageReports: string[];
    }) => {
      // Abort any previous stream
      abortControllerRef.current.abort();

      // Create a new abort controller for the new stream
      abortControllerRef.current = new AbortController();
      let _generatedMessage = "";
      let _generatedMessageWithoutReports = "";
      const _messageReports: string[] = [];
      const _generationStartedAt = new Date();

      // Reset the generated message and generation started at
      setGeneratedMessage(_generatedMessage);
      setGenerationStartedAt(_generationStartedAt);

      if (!reader)
        return {
          generationDuration: 0,
          generatedMessage: _generatedMessage,
          generatedMessageWithoutReports: _generatedMessageWithoutReports,
          generationStartedAt: _generationStartedAt,
          messageMoreReports: [],
        };

      await readJsonStream<{
        generated_response?: string;
        generated_link?: string;
        section_name: "summary" | "conclusion";
      }>(reader, abortControllerRef.current, (chunk) => {
        if ("generated_response" in chunk) {
          _generatedMessage += chunk.generated_response;
          _generatedMessageWithoutReports += chunk.generated_response;
          setGeneratedMessage((prev) => prev + chunk.generated_response);
        } else if ("generated_link" in chunk) {
          const reportLink = `<a href=${chunk.generated_link}>${t.SHOW_REPORT}</a>`;
          _generatedMessage += reportLink;
          _messageReports.push(chunk.generated_link || "");

          setGeneratedMessage((prev) => prev + reportLink);
        }
      });

      const messageMoreReports = messageReports.filter((r) => !_messageReports.includes(r));
      _generatedMessage += `<more-messages ids=${messageMoreReports.join(",")}><more-messages>`;

      return {
        generatedMessage: _generatedMessage,
        generatedMessageWithoutReports: _generatedMessageWithoutReports,
        generationDuration: new Date().getTime() - _generationStartedAt.getTime(),
        generationStartedAt: _generationStartedAt,
        messageMoreReports: messageReports.filter((r) => !_messageReports.includes(r)),
      };
    },
    ...options,
  });

  return {
    readMessageStream: mutation.mutate,
    generatedMessage,
    generationStartedAt,
    ...mutation,
  };
};

export const useUpdateChatMessageFeedback = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    onMutate: ({ chatId, messageId, data }) => {
      queryClient.setQueryData(queryKeyFactory.getChatsHistory(), (old: Chats) => {
        return updateChatMessageById(old, chatId, messageId, { feedback: data.feedback });
      });
    },
    mutationFn: async ({
      chatId,
      messageId,
      data: { feedback, ...data },
    }: {
      chatId: string;
      messageId: string;
      data: {
        query: string;
        keywords: string[];
        date_range: string;
        session_id: string;
        query_id: string;
        conversations: string[];
        llm_answer: string;
        feedback: "good" | "bad";
      };
    }) => {
      const payload = {
        ...data,
        is_relevant: feedback === "good",
        auth_token: "123456789",
      };

      await fetch("https://dummpy-api.onrender.com/submit_feedback", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const updatedChats = updateChatMessageById(getChatsFromStorage(), chatId, messageId, {
        feedback,
      });
      localStorage.setItem("chats", JSON.stringify(updatedChats));
      return updatedChats;
    },
  });

  return { updateChatMessageFeedback: mutation.mutate, ...mutation };
};

export const useReport = (chatId: string, reportId: string, queryId: string) => {
  const query = useQuery({
    queryKey: queryKeyFactory.getReport(chatId, reportId, queryId),
    queryFn: async () => {
      if (!chatId || !reportId || !queryId) return null;

      const res = await fetch("https://dummpy-api.onrender.com/get_report", {
        method: "POST",
        body: JSON.stringify({
          auth_token: "123456789",
          session_id: chatId,
          query_id: queryId,
          report_id: reportId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      return (await res.json()) as Report;
    },
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });

  return { report: query.data, ...query };
};

export const useSubmitReportFeedback = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    onMutate: ({ chatId, reportId, queryId, feedback }) => {
      queryClient.setQueryData(
        queryKeyFactory.getReport(chatId, reportId, queryId),
        (old: Report) => {
          return { ...old, feedback };
        }
      );
    },
    mutationFn: async (payload: {
      reportId: string;
      reportTitle: string;
      queryId: string;
      feedback: "good" | "bad";
      chatId: string;
    }) => {
      await fetch("https://dummpy-api.onrender.com/submit_feedback", {
        method: "POST",
        body: JSON.stringify({
          report_id: payload.reportId,
          report_title: payload.reportTitle,
          query_id: payload.queryId,
          is_relevant: payload.feedback === "good",
          session_id: payload.chatId,
          auth_token: "123456789",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
    },
  });

  return { submitReportFeedback: mutation.mutate, ...mutation };
};
