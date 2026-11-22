import { Exam, ExamResult, Folder, StudentAccount } from "@/types";

export type ResultsWindow = "7d" | "30d" | "all";
export type ManagementResource =
  | "exams"
  | "folders"
  | "studentAccounts"
  | "results"
  | "users";

export interface ManagementCacheEntry {
  key: string;
  resultsWindow: ResultsWindow;
  fetchedAtByResource: Partial<Record<ManagementResource, number>>;
  exams: Exam[];
  folders: Folder[];
  studentAccounts: StudentAccount[];
  results: ExamResult[];
  users: any[];
}

let currentCache: ManagementCacheEntry | null = null;

export function getManagementCache(key: string): ManagementCacheEntry | null {
  if (!currentCache || currentCache.key !== key) return null;
  return currentCache;
}

export function setManagementCache(entry: ManagementCacheEntry): void {
  currentCache = entry;
}

export function invalidateManagementCache(): void {
  currentCache = null;
}
