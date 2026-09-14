export type JiraStatusCategory = "new" | "indeterminate" | "done" | "unknown";

export type JiraStatus = {
  id: string;
  name: string;
  category: JiraStatusCategory;
  colorName?: string;
};

export type JiraIssueType = {
  id: string;
  name: string;
  iconUrl: string;
  subtask: boolean;
};

export type JiraParent = {
  key: string;
  summary: string;
  typeName: string;
  typeSubtask: boolean;
} | null;

export type JiraIssue = {
  id: string;
  key: string;
  summary: string;
  status: JiraStatus;
  type: JiraIssueType;
  parent: JiraParent;
  labels: string[];
  assignee: { displayName: string; avatarUrl: string } | null;
  priority: string | null;
  updatedAt: string;
  browseUrl: string;
  devStart: string | null;
  devEnd: string | null;
  storyPoints: number | null;
};

export type JiraFieldProperty = {
  id: string;
  name: string;
  text: string;
};

export type JiraTransition = {
  id: string;
  name: string;
  toName: string;
};

export type JiraIssueDetail = JiraIssue & {
  descriptionText: string;
  projectKey: string;
  subtaskKeys: string[];
  properties: JiraFieldProperty[];
  devStartField: JiraFieldProperty | null;
  devEndField: JiraFieldProperty | null;
};

export type JiraSavedFilter = {
  id: string;
  name: string;
  jql: string;
  typeIds: string[];
  typeNames: string[];
  labels: string[];
  extraJql: string;
  includeDone: boolean;
  groupBy: "status" | "statusCategory";
  jiraFilterId?: string;
  createdAt: string;
  updatedAt: string;
};

export type JiraConnectionPublic = {
  host: string;
  email: string;
  displayName: string;
  accountId: string;
  avatarUrl: string;
};

export type JiraRemoteFilter = {
  id: string;
  name: string;
  jql: string;
  favourite: boolean;
};

export type JiraSearchPage = {
  issues: JiraIssue[];
  nextPageToken: string | null;
  isLast: boolean;
};
