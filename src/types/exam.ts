export type QuestionType =
  | "multiple_choice"
  | "essay"
  | "fill_blank"
  | "calculation";
export type Difficulty = "easy" | "normal" | "hard" | "very_hard";

export interface Choice {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  number: number;
  subNumber?: string;
  type: QuestionType;
  text: string;
  choices?: Choice[];
  correctAnswer?: string;
  points: number;
  hint?: string;
  solution?: string;
  category?: string;
  illustrationSvg?: string;
}

export interface ExamSection {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
}

export interface Exam {
  id: string;
  title: string;
  subject: string;
  grade: string;
  totalPoints: number;
  duration: number;
  sections: ExamSection[];
  createdAt: string;
  isAIGenerated: boolean;
  sourceExamId?: string;
  // NEW FIELDS:
  difficulty?: Difficulty;
  isSourceExam?: boolean; // Đánh dấu là đề gốc để AI tạo dựa vào
  questionCount?: number; // Tùy chọn số câu khi thi ôn luyện
  description?: string; // Mô tả chi tiết đề thi
}

export interface Answer {
  questionId: string;
  value: string;
  drawnData?: string;
}

export interface ExamSession {
  id: string;
  examId: string;
  startedAt: string;
  submittedAt?: string;
  answers: Answer[];
  score?: number;
  totalPoints?: number;
  timeUsed?: number;
}

export interface PenSettings {
  color: string;
  size: number;
  opacity: number;
  style: "pen" | "highlighter" | "pencil";
}

export interface LibraryQuestion {
  id: string;
  examId: string;
  examTitle: string;
  subject: string;
  question: Question;
  studentAnswer?: string;
  savedAt: string;
}

export interface WrongQuestion {
  id: string;
  originalQuestionId: string;
  examId: string;
  examTitle: string;
  subject: string;
  grade: string;
  question: Question;
  studentAnswer?: string;
  correctAnswer?: string;
  correctCount: number;
  savedAt: string;
}

export interface AICredits {
  used: number;
  date: string; // YYYY-MM-DD
  dailyLimit: number;
}

export interface ExamStats {
  examId: string;
  attemptCount: number;
  bestScore: number;
  lastScore: number;
  lastAttemptDate?: string;
}

export const DIFFICULTY_INFO: Record<
  Difficulty,
  { label: string; desc: string; color: string; icon: string; level: number }
> = {
  easy: {
    label: "Dễ",
    desc: "Phù hợp học sinh yếu/mới bắt đầu",
    color: "bg-emerald-100 text-emerald-700 border-emerald-300",
    icon: "🟢",
    level: 1,
  },
  normal: {
    label: "Bình thường",
    desc: "Tương đương đề gốc, câu bẫy vừa",
    color: "bg-blue-100 text-blue-700 border-blue-300",
    icon: "🔵",
    level: 2,
  },
  hard: {
    label: "Khó",
    desc: "Dành cho học sinh khá/giỏi",
    color: "bg-amber-100 text-amber-700 border-amber-300",
    icon: "🟠",
    level: 3,
  },
  very_hard: {
    label: "Rất khó",
    desc: "Chỉ ~20-30% học sinh giỏi làm được",
    color: "bg-red-100 text-red-700 border-red-300",
    icon: "🔴",
    level: 4,
  },
};
