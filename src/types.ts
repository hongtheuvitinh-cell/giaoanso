export interface MatrixRow {
  id: string;
  chapter: string;
  content: string;
  requirements: string;
  mc: { know: number; understand: number; apply: number; highApply: number };
  tf: { know: number; understand: number; apply: number; highApply: number };
  sa: { know: number; understand: number; apply: number; highApply: number };
  essay: { know: number; understand: number; apply: number; highApply: number };
  physicsCompetency?: string;
}

export type QuestionType = "MC" | "TF" | "SA" | "ESSAY";
export type QuestionLevel = "know" | "understand" | "apply" | "highApply";

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  type: QuestionType;
  level: QuestionLevel;
  content: string;
  imageUrl?: string;
  options?: QuestionOption[]; // For MC and TF
  correctAnswer?: string; // For SA
  explanation?: string;
  points?: number;
}

export interface Exam {
  id: string;
  title: string;
  subject: string;
  grade: string;
  timeLimit: number; // in minutes
  questions: Question[];
  createdAt: string;
  teacherId: string;
  status?: 'draft' | 'published';
}

export const PHYSICS_COMPETENCIES = [
  "Nhận thức vật lý",
  "Tìm hiểu thế giới tự nhiên dưới góc độ vật lý",
  "Vận dụng kiến thức kỹ năng đã học"
];

export const EMPTY_LEVELS = { know: 0, understand: 0, apply: 0, highApply: 0 };
