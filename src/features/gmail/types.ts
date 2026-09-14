export type GmailTab = "inbox" | "unread" | "starred" | "sent";

export type GmailLabel = {
  id: string;
  name: string;
  type: "system" | "user";
};

export type GmailMessageSummary = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
  dateMs: number;
  labelIds: string[];
  unread: boolean;
  starred: boolean;
};

export type GmailMessage = GmailMessageSummary & {
  to: string;
  cc: string;
  bodyText: string | null;
  bodyHtml: string | null;
  permalink: string;
};

export type GmailListPage = {
  messages: GmailMessageSummary[];
  nextPageToken: string | null;
};
