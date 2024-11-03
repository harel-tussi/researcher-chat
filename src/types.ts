export type Feedback = "good" | "bad";

export type Message = {
  id: string;
  sender: "bot" | "user";
  content: string;
  date: Date;
  feedback?: Feedback;
  filters: Filters;
  query: string;
  queryId: string;
};

export type Option = {
  value: string;
  label: string;
};

export type Filters = {
  conversations: string[];
  date_range: string;
  keywords: string[];
};

export type Chat = {
  id: string;
  messages: Message[];
};

export type Chats = Chat[];

export type Report = {
  report_id: string;
  report_title: string;
  speaker_a: string;
  speaker_b: string;
  report_tazak: string;
  report_updated_date: string;
  report_raw_text: string;
  feedback?: Feedback;
};
