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

export const PHYSICS_COMPETENCIES = [
  "Nhận thức vật lý",
  "Tìm hiểu thế giới tự nhiên dưới góc độ vật lý",
  "Vận dụng kiến thức kỹ năng đã học"
];

export const EMPTY_LEVELS = { know: 0, understand: 0, apply: 0, highApply: 0 };
