export const queryKeyFactory = {
  getHapaks: () => ["hapaks"] as const,
  getChatsHistory: () => ["chats-history"] as const,
  getReport: (chatId: string, reportId: string, queryId: string) =>
    ["report", chatId, reportId, "queryId", queryId] as const,
};
