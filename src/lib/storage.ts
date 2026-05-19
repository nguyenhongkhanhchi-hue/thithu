import { Exam, ExamSession, ExamStats, LibraryQuestion } from "@/types/exam";
import { SAMPLE_EXAMS } from "@/constants/exams";

const EXAMS_KEY = "examtouch_exams";
const SESSIONS_KEY = "examtouch_sessions";
const LIBRARY_KEY = "examtouch_library";
const BACKUP_KEY = "examtouch_backup";

// ── Backup ────────────────────────────────────────────────────────
export function backupToLocalStorage(): void {
  try {
    const backup = {
      exams: localStorage.getItem(EXAMS_KEY)
        ? JSON.parse(localStorage.getItem(EXAMS_KEY)!)
        : [],
      sessions: localStorage.getItem(SESSIONS_KEY)
        ? JSON.parse(localStorage.getItem(SESSIONS_KEY)!)
        : [],
      // Backup AI keys too (single and list)
      ai_keys: {
        gemini: localStorage.getItem("VITE_GEMINI_API_KEY"),
        groq: localStorage.getItem("VITE_GROQ_API_KEY"),
        gemini_list: localStorage.getItem("VITE_GEMINI_API_KEYS"),
        groq_list: localStorage.getItem("VITE_GROQ_API_KEYS")
      },
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
  } catch {}
}

// ── Exams ─────────────────────────────────────────────────────────
export function getExams(): Exam[] {
  try {
    const stored = localStorage.getItem(EXAMS_KEY);
    const userExams: Exam[] = stored ? JSON.parse(stored) : [];
    const storedIds = userExams.map((e) => e.id);
    return [
      ...SAMPLE_EXAMS.filter((e) => !storedIds.includes(e.id)),
      ...userExams,
    ];
  } catch {
    return SAMPLE_EXAMS;
  }
}

export function saveExam(exam: Exam): void {
  const stored = localStorage.getItem(EXAMS_KEY);
  const exams: Exam[] = stored ? JSON.parse(stored) : [];
  const idx = exams.findIndex((e) => e.id === exam.id);
  if (idx >= 0) exams[idx] = exam;
  else exams.push(exam);
  localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
  
  // Tự động lưu tất cả câu hỏi vào thư viện
  const library = getLibraryQuestions();
  let libraryChanged = false;

  exam.sections.forEach(section => {
    section.questions.forEach(q => {
      // Chỉ lưu nếu câu hỏi chưa có trong thư viện (theo examId và questionId)
      const exists = library.some(libQ => libQ.examId === exam.id && libQ.id === q.id);
      if (!exists) {
        const libQ: LibraryQuestion = {
          id: q.id,
          examId: exam.id,
          examTitle: exam.title,
          subject: exam.subject,
          question: q,
          savedAt: new Date().toISOString()
        };
        library.push(libQ);
        libraryChanged = true;
      }
    });
  });

  if (libraryChanged) {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  }

  backupToLocalStorage();
}

export function deleteExam(id: string): void {
  const stored = localStorage.getItem(EXAMS_KEY);
  const exams: Exam[] = stored ? JSON.parse(stored) : [];
  localStorage.setItem(
    EXAMS_KEY,
    JSON.stringify(exams.filter((e) => e.id !== id)),
  );
  backupToLocalStorage();
}

export function setSourceExam(id: string, isSource: boolean): void {
  const stored = localStorage.getItem(EXAMS_KEY);
  const exams: Exam[] = stored ? JSON.parse(stored) : [];
  const idx = exams.findIndex((e) => e.id === id);
  if (idx >= 0) {
    exams[idx] = { ...exams[idx], isSourceExam: isSource };
    localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
    backupToLocalStorage();
  }
}

export function updateExamTitle(id: string, newTitle: string): void {
  // 1. Update Exams
  const storedExams = localStorage.getItem(EXAMS_KEY);
  const exams: Exam[] = storedExams ? JSON.parse(storedExams) : [];
  const examIdx = exams.findIndex((e) => e.id === id);
  if (examIdx >= 0) {
    exams[examIdx] = { ...exams[examIdx], title: newTitle };
    localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
  }

  // 2. Update Library Questions (sync examTitle)
  const storedLib = localStorage.getItem(LIBRARY_KEY);
  if (storedLib) {
    const library: LibraryQuestion[] = JSON.parse(storedLib);
    const updatedLib = library.map(q => q.examId === id ? { ...q, examTitle: newTitle } : q);
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(updatedLib));
  }
  
  backupToLocalStorage();
}

export function getSourceExams(): Exam[] {
  return getExams().filter((e) => e.isSourceExam);
}

// ── Sessions ──────────────────────────────────────────────────────
export function getSessions(): ExamSession[] {
  try {
    const stored = localStorage.getItem(SESSIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// ── Export / Import ───────────────────────────────────────────────────────────

export function exportAllData(): void {
  const data = {
    exams: JSON.parse(localStorage.getItem(EXAMS_KEY) || '[]'),
    library: JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]'),
    sessions: JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]'),
    ai_keys: {
      gemini: localStorage.getItem("VITE_GEMINI_API_KEY"),
      groq: localStorage.getItem("VITE_GROQ_API_KEY"),
      gemini_list: localStorage.getItem("VITE_GEMINI_API_KEYS"),
      groq_list: localStorage.getItem("VITE_GROQ_API_KEYS")
    },
    timestamp: new Date().toISOString(),
    version: '1.1'
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ExamTouch_Backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function importAllData(jsonData: string): boolean {
  try {
    const data = JSON.parse(jsonData);
    if (!data.exams || !data.library || !data.sessions) {
      throw new Error('Định dạng file không hợp lệ');
    }

    localStorage.setItem(EXAMS_KEY, JSON.stringify(data.exams));
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(data.library));
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(data.sessions));
    
    // Restore AI keys if available in backup
    if (data.ai_keys) {
      if (data.ai_keys.gemini) localStorage.setItem("VITE_GEMINI_API_KEY", data.ai_keys.gemini);
      if (data.ai_keys.groq) localStorage.setItem("VITE_GROQ_API_KEY", data.ai_keys.groq);
      if (data.ai_keys.gemini_list) localStorage.setItem("VITE_GEMINI_API_KEYS", data.ai_keys.gemini_list);
      if (data.ai_keys.groq_list) localStorage.setItem("VITE_GROQ_API_KEYS", data.ai_keys.groq_list);
    }
    
    backupToLocalStorage();
    return true;
  } catch (error) {
    console.error('Import error:', error);
    return false;
  }
}

export function saveSession(session: ExamSession): void {
  const sessions = getSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) sessions[idx] = session;
  else sessions.push(session);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  backupToLocalStorage();
}

export function getSessionsForExam(examId: string): ExamSession[] {
  return getSessions().filter((s) => s.examId === examId);
}

// ── Exam Stats ────────────────────────────────────────────────────
export function getExamStats(examId: string): ExamStats {
  const sessions = getSessionsForExam(examId).filter((s) => s.submittedAt);
  if (sessions.length === 0) {
    return { examId, attemptCount: 0, bestScore: 0, lastScore: 0 };
  }
  const scores = sessions.map((s) => {
    const total = s.totalPoints || 10;
    return s.score !== undefined ? Math.round((s.score / total) * 100) : 0;
  });
  const sorted = [...sessions].sort(
    (a, b) =>
      new Date(b.submittedAt!).getTime() - new Date(a.submittedAt!).getTime(),
  );
  return {
    examId,
    attemptCount: sessions.length,
    bestScore: Math.max(...scores),
    lastScore:
      scores[
        scores.indexOf(Math.max(...sessions.map((_, i) => (i === 0 ? 999 : 0))))
      ],
    lastAttemptDate: sorted[0]?.submittedAt?.split("T")[0],
  };
}

// Tính lastScore đúng: lấy score của session gần nhất
export function getExamStatsFixed(examId: string): ExamStats {
  const sessions = getSessionsForExam(examId).filter((s) => s.submittedAt);
  if (sessions.length === 0) {
    return { examId, attemptCount: 0, bestScore: 0, lastScore: 0 };
  }
  const sorted = [...sessions].sort(
    (a, b) =>
      new Date(b.submittedAt!).getTime() - new Date(a.submittedAt!).getTime(),
  );
  const toPercent = (s: ExamSession) => {
    const total = s.totalPoints || 10;
    return s.score !== undefined ? Math.round((s.score / total) * 100) : 0;
  };
  const scores = sessions.map(toPercent);
  return {
    examId,
    attemptCount: sessions.length,
    bestScore: Math.max(...scores),
    lastScore: toPercent(sorted[0]),
    lastAttemptDate: sorted[0]?.submittedAt?.split("T")[0],
  };
}

// ── Library ───────────────────────────────────────────────────────
export function getLibraryQuestions(): LibraryQuestion[] {
  try {
    const stored = localStorage.getItem(LIBRARY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveLibraryQuestion(question: LibraryQuestion): void {
  const library = getLibraryQuestions();
  const existingIdx = library.findIndex(
    (q) => q.id === question.id && q.examId === question.examId,
  );
  if (existingIdx >= 0) library[existingIdx] = question;
  else library.push(question);
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
}

export function deleteLibraryQuestion(id: string, examId: string): void {
  const library = getLibraryQuestions();
  localStorage.setItem(
    LIBRARY_KEY,
    JSON.stringify(
      library.filter((q) => !(q.id === id && q.examId === examId)),
    ),
  );
}

// ── Utils ─────────────────────────────────────────────────────────
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function restoreFromBackup(): {
  exams: Exam[];
  sessions: ExamSession[];
} | null {
  try {
    const backup = localStorage.getItem(BACKUP_KEY);
    if (!backup) return null;
    const data = JSON.parse(backup);
    return { exams: data.exams || [], sessions: data.sessions || [] };
  } catch {
    return null;
  }
}
