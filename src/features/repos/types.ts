export type Repo = {
  id: number;
  fullName: string;
  description: string | null;
  private: boolean;
  htmlUrl: string;
  updatedAt: string;
  language: string | null;
};
