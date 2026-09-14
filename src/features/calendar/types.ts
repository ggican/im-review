export type GoogleConnectionPublic = {
  email: string;
  name: string;
};

export type CalendarTab = "today" | "upcoming" | "week" | "allday";

export type CalendarSource = {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor?: string;
};

export type CalendarAttendee = {
  email: string;
  displayName?: string;
  self?: boolean;
  responseStatus?: string;
};

export type CalendarEvent = {
  id: string;
  calendarId: string;
  title: string;
  htmlLink: string;
  location: string | null;
  description: string | null;
  hangoutLink: string | null;
  allDay: boolean;
  startMs: number;
  endMs: number;
  attendees: CalendarAttendee[];
};

export type CalendarDayGroup = {
  key: string;
  label: string;
  items: CalendarEvent[];
};

export type CalendarTimeWindow = {
  timeMin: string;
  timeMax: string;
  label: string;
};
