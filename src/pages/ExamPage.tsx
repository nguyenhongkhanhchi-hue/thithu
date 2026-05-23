import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Exam, Answer, PenSettings, ExamSession } from "@/types/exam";
import {
  getExams,
  saveSession,
  generateId,
  saveLibraryQuestion,
  getGamificationData,
  addXP,
  saveWrongQuestion,
  trackPracticeExamForCategory,
} from "@/lib/storage";
import { calculateScore, calculateMCOnlyScore } from "@/lib/scoring";
import { supabase } from "@/lib/supabase";
import { gradeEssay } from "@/lib/gemini";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import Timer from "@/components/features/Timer";
import QuestionCard from "@/components/features/QuestionCard";
import PenToolbar from "@/components/features/PenToolbar";
import ScratchPad from "@/components/features/ScratchPad";
import PrintExam from "@/components/features/PrintExam";
import DrawingCanvas from "@/components/features/DrawingCanvas";
import TextWithFractions from "@/components/features/FractionDisplay";
import { sounds } from "@/lib/sounds";
import { celebrate as triggerCelebrate } from "@/components/features/CelebrationEffect";
import { speakExamStart, speakExamScore } from "@/lib/tts";
import { syncAllData } from "@/lib/sync";
import { useLayout } from "@/contexts/LayoutContext";


// Utility to shuffle array
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

interface ScratchPage {
  id: string;
  background: 'grid' | 'dot' | 'blank' | 'lined';
  dataUrl: string;
}

const getScratchpadStyle = (background: 'grid' | 'dot' | 'blank' | 'lined') => {
  switch (background) {
    case 'grid':
      return {
        backgroundColor: '#f7fafc',
        backgroundImage: `
          linear-gradient(90deg, transparent 40px, rgba(239, 68, 68, 0.4) 40px, rgba(239, 68, 68, 0.4) 42px, transparent 42px),
          linear-gradient(rgba(59, 130, 246, 0.15) 1px, transparent 1px),
          linear-gradient(90deg, rgba(59, 130, 246, 0.15) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 24px 24px, 24px 24px',
        backgroundPosition: '0 0, 8px 8px, 8px 8px'
      };
    case 'dot':
      return {
        backgroundColor: '#ffffff',
        backgroundImage: 'radial-gradient(rgba(100, 116, 139, 0.35) 1.5px, transparent 1.5px)',
        backgroundSize: '24px 24px',
        backgroundPosition: '12px 12px'
      };
    case 'lined':
      return {
        backgroundColor: '#fffdf4',
        backgroundImage: `
          linear-gradient(90deg, transparent 44px, rgba(239, 68, 68, 0.4) 44px, rgba(239, 68, 68, 0.4) 46px, transparent 46px),
          repeating-linear-gradient(transparent, transparent 27px, rgba(148, 163, 184, 0.25) 27px, rgba(148, 163, 184, 0.25) 28px)
        `,
        backgroundSize: '100% 100%, 100% 28px'
      };
    case 'blank':
    default:
      return {
        backgroundColor: '#ffffff'
      };
  }
};

const ExamPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { containerClass } = useLayout();


  const [exam, setExam] = useState<Exam | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [showAntiCheatWarning, setShowAntiCheatWarning] = useState(false);
  const [antiCheatViolations, setAntiCheatViolations] = useState(0);

  // Embedded Scratchpad states
  const scratchCanvasRef = useRef<{ clearAll: () => void; undoLast: () => void; getData: () => string; setData: (data: string) => void } | null>(null);
  const [scratchEraserMode, setScratchEraserMode] = useState(false);
  const [scratchPenColor, setScratchPenColor] = useState("#2563eb");
  const [scratchPenSize, setScratchPenSize] = useState(4);
  const [scratchPenStyle, setScratchPenStyle] = useState<"pen" | "highlighter">("pen");

  // Multi-page scratchpad booklet states
  const [scratchPages, setScratchPages] = useState<ScratchPage[]>([]);
  const [currentScratchPageIdx, setCurrentScratchPageIdx] = useState<number>(0);

  // Central Virtual Math Keyboard states
  const [activeMathInput, setActiveMathInput] = useState<{
    questionId: string;
    value: string;
    onChange: (val: string) => void;
  } | null>(null);

  // States for virtual keyboard fraction helper
  const [centralNumerator, setCentralNumerator] = useState("");
  const [centralDenominator, setCentralDenominator] = useState("");

  // Essay parent-scoring state
  const [essayScores, setEssayScores] = useState<Record<string, number>>({});
  const [essaySaved, setEssaySaved] = useState(false);
  const [savingEssay, setSavingEssay] = useState(false);

  const [drawMode, setDrawMode] = useState(false);
  const [showPenBar, setShowPenBar] = useState(false);
 const [showScratch, setShowScratch] = useState(false);
  const [showPrint, setShowPrint] = useState(false);

  // Stats state
  const [penSettings, setPenSettings] = useState<PenSettings>({
    color: "#EF4444",
    size: 4,
    opacity: 1,
    style: "pen",
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!examId) return;
    const exams = getExams();
    const found = exams.find((e) => e.id === examId);
    if (found) {
      setExam(found);
      setTimeLeft(found.duration * 60);
      startTimeRef.current = Date.now();
      // Bố dặn dắt động viên bé tính nháp cẩn thận khi bắt đầu thi
      speakExamStart(found.title);
    }
  }, [examId]);

  // Load saved paginated scratchpad for the specific exam
  useEffect(() => {
    if (!examId) return;
    const key = `methi_scratchpad_pages_${examId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setScratchPages(parsed);
          setCurrentScratchPageIdx(0);
          
          // Load the first page into canvas
          setTimeout(() => {
            if (scratchCanvasRef.current && parsed[0]?.dataUrl) {
              scratchCanvasRef.current.setData(parsed[0].dataUrl);
            } else if (scratchCanvasRef.current) {
              scratchCanvasRef.current.clearAll();
            }
          }, 200);
          return;
        }
      } catch (e) {
        console.error("Lỗi parse scratch pages:", e);
      }
    }
    
    // Fallback: 1 default grid page (Giấy Ô Ly Toán Học)
    const defaultPages: ScratchPage[] = [
      { id: '1', background: 'grid', dataUrl: '' }
    ];
    setScratchPages(defaultPages);
    setCurrentScratchPageIdx(0);
    setTimeout(() => {
      scratchCanvasRef.current?.clearAll();
    }, 200);
  }, [examId]);

  const handleScratchChange = useCallback(() => {
    if (!examId || !scratchCanvasRef.current || scratchPages.length === 0) return;
    const currentData = scratchCanvasRef.current.getData();
    
    setScratchPages(prev => {
      const updated = [...prev];
      if (updated[currentScratchPageIdx]) {
        updated[currentScratchPageIdx] = {
          ...updated[currentScratchPageIdx],
          dataUrl: currentData
        };
      }
      localStorage.setItem(`methi_scratchpad_pages_${examId}`, JSON.stringify(updated));
      return updated;
    });
  }, [examId, currentScratchPageIdx, scratchPages.length]);

  const handleSwitchScratchPage = useCallback((newIdx: number) => {
    if (!examId || !scratchCanvasRef.current || newIdx < 0 || newIdx >= scratchPages.length) return;
    
    // 1. Capture current page canvas data
    const currentData = scratchCanvasRef.current.getData();
    const updatedPages = [...scratchPages];
    if (updatedPages[currentScratchPageIdx]) {
      updatedPages[currentScratchPageIdx] = {
        ...updatedPages[currentScratchPageIdx],
        dataUrl: currentData
      };
    }
    
    // Save to local storage
    localStorage.setItem(`methi_scratchpad_pages_${examId}`, JSON.stringify(updatedPages));
    setScratchPages(updatedPages);
    
    // 2. Set new index
    setCurrentScratchPageIdx(newIdx);
    
    // 3. Set canvas with new page data with a short timeout to let canvas render state settle
    const targetPage = updatedPages[newIdx];
    setTimeout(() => {
      if (scratchCanvasRef.current) {
        if (targetPage.dataUrl) {
          scratchCanvasRef.current.setData(targetPage.dataUrl);
        } else {
          scratchCanvasRef.current.clearAll();
        }
      }
    }, 50);
  }, [examId, scratchPages, currentScratchPageIdx]);

  const handleAddScratchPage = useCallback(() => {
    if (!examId || !scratchCanvasRef.current) return;
    
    // 1. Capture current page first
    const currentData = scratchCanvasRef.current.getData();
    const updatedPages = [...scratchPages];
    if (updatedPages[currentScratchPageIdx]) {
      updatedPages[currentScratchPageIdx] = {
        ...updatedPages[currentScratchPageIdx],
        dataUrl: currentData
      };
    }
    
    // 2. Add a new page
    const newPageId = (Math.max(...scratchPages.map(p => parseInt(p.id) || 1)) + 1).toString();
    const currentBg = scratchPages[currentScratchPageIdx]?.background || 'grid';
    const newPage: ScratchPage = {
      id: newPageId,
      background: currentBg,
      dataUrl: ''
    };
    updatedPages.push(newPage);
    
    const newIdx = updatedPages.length - 1;
    
    localStorage.setItem(`methi_scratchpad_pages_${examId}`, JSON.stringify(updatedPages));
    setScratchPages(updatedPages);
    setCurrentScratchPageIdx(newIdx);
    
    // 3. Clear canvas for the new page
    setTimeout(() => {
      scratchCanvasRef.current?.clearAll();
    }, 50);
    
    toast.success(`Đã thêm Trang ${newIdx + 1}! 🎉`);
  }, [examId, scratchPages, currentScratchPageIdx]);

  const handleDeleteScratchPage = useCallback((idxToDelete: number) => {
    if (!examId || scratchPages.length <= 1) {
      toast.warning("Không thể xóa trang duy nhất còn lại!");
      return;
    }
    
    if (!confirm(`Con có chắc muốn xóa Trang ${idxToDelete + 1} này không?`)) return;
    
    const updatedPages = scratchPages.filter((_, idx) => idx !== idxToDelete);
    
    // Determine new index
    let newIdx = currentScratchPageIdx;
    if (idxToDelete === currentScratchPageIdx) {
      newIdx = Math.max(0, idxToDelete - 1);
    } else if (idxToDelete < currentScratchPageIdx) {
      newIdx = currentScratchPageIdx - 1;
    }
    
    localStorage.setItem(`methi_scratchpad_pages_${examId}`, JSON.stringify(updatedPages));
    setScratchPages(updatedPages);
    setCurrentScratchPageIdx(newIdx);
    
    // Render the new active page
    const targetPage = updatedPages[newIdx];
    setTimeout(() => {
      if (scratchCanvasRef.current) {
        if (targetPage.dataUrl) {
          scratchCanvasRef.current.setData(targetPage.dataUrl);
        } else {
          scratchCanvasRef.current.clearAll();
        }
      }
    }, 50);
    
    toast.success(`Đã xóa Trang ${idxToDelete + 1}!`);
  }, [examId, scratchPages, currentScratchPageIdx]);

  const handleChangeScratchBackground = useCallback((bg: 'grid' | 'dot' | 'blank' | 'lined') => {
    if (!examId) return;
    
    setScratchPages(prev => {
      const updated = [...prev];
      if (updated[currentScratchPageIdx]) {
        updated[currentScratchPageIdx] = {
          ...updated[currentScratchPageIdx],
          background: bg
        };
      }
      localStorage.setItem(`methi_scratchpad_pages_${examId}`, JSON.stringify(updated));
      return updated;
    });
  }, [examId, currentScratchPageIdx]);

  // Dispatch virtual keyboard actions to active MathInput
  const dispatchKeyboardAction = useCallback((action: string, detail: any = {}) => {
    if (!activeMathInput) return;
    const event = new CustomEvent(`methi-keyboard-input-${activeMathInput.questionId}`, {
      detail: { action, ...detail }
    });
    window.dispatchEvent(event);
  }, [activeMathInput]);

  useEffect(() => {
    if (!exam || submitted) return;
    timerRef.current = setInterval(() => {
      if (!isPaused) {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            setIsLocked(true);
            return 0;
          }
          return t - 1;
        });
      }
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [exam, submitted, isPaused]);

  // Anti-cheat: prevent exit
  useEffect(() => {
    if (!exam || submitted) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    const handleVisibilityChange = () => {
      if (document.hidden && !isPaused) {
        setAntiCheatViolations((v) => v + 1);
        setShowAntiCheatWarning(true);
        if (antiCheatViolations >= 2) {
          // Auto-submit after 3 violations
          handleSubmit();
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [exam, submitted, isPaused, antiCheatViolations]);

  const handleAnswer = useCallback((answer: Answer) => {
    setAnswers((prev) => {
      const idx = prev.findIndex((a) => a.questionId === answer.questionId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = answer;
        return updated;
      }
      return [...prev, answer];
    });
  }, []);

  // AI Auto-grading for essay questions
  const handleAIGrading = useCallback(
    async (sessionOverride?: ExamSession) => {
      if (!exam) return;
      setSavingEssay(true);

      const essayQuestions = exam.sections
        .flatMap((s) => s.questions)
        .filter((q) => q.type !== "multiple_choice");

      const newEssayScores: Record<string, number> = {};

      for (const question of essayQuestions) {
        const answer = answers.find((a) => a.questionId === question.id);
        if (!answer || !answer.value) continue;

        try {
          // Gọi AI chấm bài trực tiếp (không cần Supabase functions)
          const result = await gradeEssay(
            question.text,
            answer.value,
            question.solution || "",
            question.points,
          );
          newEssayScores[question.id] = result.score;
          
          // Ghi nhận lỗi tự luận sai vào Sổ Tay Sửa Sai
          if (result.score < question.points) {
            saveWrongQuestion({
              id: `${exam.id}_${question.id}`,
              originalQuestionId: question.id,
              examId: exam.id,
              examTitle: exam.title,
              subject: exam.subject,
              grade: exam.grade,
              question,
              studentAnswer: answer.value,
              correctAnswer: question.solution,
              correctCount: 0,
              savedAt: new Date().toISOString(),
            });
          }

          // Lưu feedback vào toast nếu muốn hiển thị
          if (result.feedback) {
            // Silent grading
          }
        } catch (err) {
          console.error("AI grading failed for question:", question.id, err);
        }
      }

      setEssayScores(newEssayScores);
      setSavingEssay(false);

      if (Object.keys(newEssayScores).length > 0) {
        toast.success(
          `AI đã chấm ${Object.keys(newEssayScores).length} câu tự luận`,
        );

        // Tự động lưu điểm sau khi AI chấm xong
        const finalScore = calculateScore(exam, answers, newEssayScores);
        const activeSession = sessionOverride || session;
        if (activeSession) {
          const updatedSession: ExamSession = {
            ...activeSession,
            score: finalScore.score,
            totalPoints: finalScore.totalPoints,
          };
          saveSession(updatedSession);
          setSession(updatedSession);
          setEssaySaved(true);

          // Cập nhật cả lên Supabase nếu có user
          if (user) {
            supabase
              .from("exam_sessions")
              .update({
                score: finalScore.score,
                per_question: finalScore.perQuestion,
              })
              .eq("id", activeSession.id)
              .then(() => {});
          }
        }
      }
    },
    [exam, answers, session, user],
  );

  const handleSubmit = useCallback(async () => {
    if (!exam) return;
    clearInterval(timerRef.current!);
    const timeUsed = Math.round((Date.now() - startTimeRef.current) / 1000);
    // Score only MC at submission — essay will be scored by parent
    const mcScore = calculateMCOnlyScore(exam, answers);

    const newSession: ExamSession = {
      id: generateId(),
      examId: exam.id,
      startedAt: new Date(startTimeRef.current).toISOString(),
      submittedAt: new Date().toISOString(),
      answers,
      score: mcScore.score,
      totalPoints: mcScore.totalPoints,
      timeUsed,
    };
    saveSession(newSession);

    // Save questions to library and check for MC errors
    const allQuestions = exam.sections.flatMap((s) => s.questions);
    for (const question of allQuestions) {
      const studentAnswer = answers.find((a) => a.questionId === question.id);
      saveLibraryQuestion({
        id: question.id,
        examId: exam.id,
        examTitle: exam.title,
        subject: exam.subject,
        question,
        studentAnswer: studentAnswer?.value,
        savedAt: new Date().toISOString(),
      });

      // Ghi nhận lỗi trắc nghiệm sai vào Sổ Tay Sửa Sai
      if (question.type === "multiple_choice") {
        const isCorrect = question.correctAnswer ? studentAnswer?.value === question.correctAnswer : false;
        if (!isCorrect) {
          saveWrongQuestion({
            id: `${exam.id}_${question.id}`,
            originalQuestionId: question.id,
            examId: exam.id,
            examTitle: exam.title,
            subject: exam.subject,
            grade: exam.grade,
            question,
            studentAnswer: studentAnswer?.value,
            correctAnswer: question.correctAnswer,
            correctCount: 0,
            savedAt: new Date().toISOString(),
          });
        }
      }
    }

    setSession(newSession);
    setSubmitted(true);

    // Giọng trợ lý của bố Tommy cất lên động viên, biểu dương theo điểm số của con!
    speakExamScore(mcScore.score, mcScore.totalPoints);

    // Ghi nhận thống kê nếu là đề ôn dạng bài (để chúc mừng thành thạo)
    if (exam.title?.startsWith("🎯 ĐỀ ÔN DẠNG BÀI:")) {
      const categoryName = exam.title.replace("🎯 ĐỀ ÔN DẠNG BÀI:", "").trim();
      trackPracticeExamForCategory(categoryName, exam.subject, mcScore.score, mcScore.totalPoints);
    }

    // Đồng bộ tức thì lên đám mây để bố Tommy ở cơ quan nhận được kết quả ngay lập tức!
    if (user) {
      syncAllData(user).catch(err => console.error("Lỗi đồng bộ khi nộp bài:", err));
    }

    // RPG Gamification Rewards
    const pct = mcScore.percentage;
    let xpReward = 20; // base reward
    let starsReward = 1;
    if (pct >= 90) {
      xpReward = 150;
      starsReward = 5;
    } else if (pct >= 80) {
      xpReward = 100;
      starsReward = 3;
    } else if (pct >= 50) {
      xpReward = 50;
      starsReward = 2;
    }

    const xpResult = addXP(xpReward, starsReward);

    if (pct >= 50) {
      sounds.celebrate();
      triggerCelebrate("HOÀN THÀNH XUẤT SẮC! 🎉");
    } else {
      sounds.correct();
      triggerCelebrate("CỐ GẮNG LÊN CON NHÉ! 💖");
    }

    if (xpResult.leveledUp) {
      setTimeout(() => {
        sounds.celebrate();
        triggerCelebrate(`🎉 LÊN CẤP ${xpResult.newLevel}! QUÁ GIỎI! 🥳`);
      }, 1800);
    } else {
      toast.success(`🎉 Bé nhận được +${xpReward} XP và +${starsReward} ⭐!`);
    }

    // Tự động chấm điểm AI cho phần tự luận ngay sau khi nộp
    if (allQuestions.some((q) => q.type !== "multiple_choice")) {
      handleAIGrading(newSession);
    }
  }, [exam, answers, handleAIGrading]);

  const handleSaveEssayScores = useCallback(async () => {
    if (!exam || !session) return;
    setSavingEssay(true);

    const finalScore = calculateScore(exam, answers, essayScores);

    // Ghi nhận lỗi tự luận sai vào Sổ Tay Sửa Sai khi phụ huynh chấm điểm thủ công
    const allQuestions = exam.sections.flatMap((s) => s.questions);
    allQuestions.forEach((q) => {
      if (q.type !== "multiple_choice") {
        const score = essayScores[q.id];
        const studentAnswer = answers.find((a) => a.questionId === q.id);
        const earned = score !== undefined ? score : 0;
        if (earned < q.points) {
          saveWrongQuestion({
            id: `${exam.id}_${q.id}`,
            originalQuestionId: q.id,
            examId: exam.id,
            examTitle: exam.title,
            subject: exam.subject,
            grade: exam.grade,
            question: q,
            studentAnswer: studentAnswer?.value,
            correctAnswer: q.solution,
            correctCount: 0,
            savedAt: new Date().toISOString(),
          });
        }
      }
    });

    // Update local session
    const updatedSession: ExamSession = {
      ...session,
      score: finalScore.score,
    };
    saveSession(updatedSession);
    setSession(updatedSession);

    // Save to Supabase if logged in
    /* 
    if (user) {
      await supabase.from("exam_sessions").insert({
        id: session.id,
        exam_id: exam.id,
        user_id: user.id,
        started_at: session.startedAt,
        submitted_at: session.submittedAt,
        answers: answers,
        score: finalScore.score,
        total_points: finalScore.totalPoints,
        time_used: session.timeUsed,
        per_question: finalScore.perQuestion,
      });
    }
    */

    setSavingEssay(false);
    setEssaySaved(true);
  }, [exam, answers, essayScores, session, user]);

  const handlePenChange = useCallback((s: Partial<PenSettings>) => {
    setPenSettings((prev) => ({ ...prev, ...s }));
  }, []);

  const handleEssayScoreChange = useCallback(
    (questionId: string, score: number) => {
      setEssayScores((prev) => ({ ...prev, [questionId]: score }));
    },
    [],
  );

  const answeredCount = answers.filter((a) => a.value.trim()).length;
  const totalQuestions =
    exam?.sections.reduce((acc, s) => acc + s.questions.length, 0) ?? 0;

  const handleRetry = useCallback(() => {
    setExam((currentExam) => {
      if (!currentExam) return currentExam;
      
      const shuffledSections = currentExam.sections.map(section => ({
        ...section,
        questions: shuffleArray(section.questions.map(q => ({
          ...q,
          choices: q.choices ? shuffleArray(q.choices) : q.choices
        })))
      }));

      return { ...currentExam, sections: shuffledSections };
    });
    setSubmitted(false);
    setAnswers([]);
    setSession(null);
    setEssayScores({});
    setEssaySaved(false);
    setTimeLeft(exam ? exam.duration * 60 : 40);
    startTimeRef.current = Date.now();
    
    const currentExamForReload = getExams().find(e => e.id === examId);
    if (currentExamForReload?.isAIGenerated) {
      window.location.reload();
    }
  }, [examId]);

  if (!exam) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-5xl mb-4">📄</div>
          <p className="text-gray-500">Không tìm thấy đề thi</p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 text-blue-600 underline"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  // Locked view
  if (isLocked && !submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-6">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-red-700 mb-2">Hết giờ!</h2>
          <p className="text-red-600 mb-6">
            Bài thi đã bị khóa. Hãy nộp bài để xem kết quả.
          </p>
          <button
            onClick={handleSubmit}
            className="w-full bg-red-600 text-white font-bold py-4 rounded-2xl text-lg active:scale-95 transition-transform"
          >
            Nộp bài & Xem kết quả
          </button>
        </div>
      </div>
    );
  }

  // Result view
  if (submitted && session && exam) {

    const mcScore = calculateMCOnlyScore(exam, answers);
    const finalScore = essaySaved
      ? calculateScore(exam, answers, essayScores)
      : mcScore;

    // Gather essay questions
    const essayQuestions = exam.sections
      .flatMap((s) => s.questions)
      .filter((q) => q.type !== "multiple_choice");
    const hasEssay = essayQuestions.length > 0;
    const essayTotalPoints = essayQuestions.reduce(
      (acc, q) => acc + q.points,
      0,
    );

    // Check all essays scored
    const allEssayScored = essayQuestions.every(
      (q) => essayScores[q.id] !== undefined,
    );

    const pct = finalScore.percentage;
    const grade =
      pct >= 90
        ? "🌟 Xuất sắc"
        : pct >= 80
          ? "🥇 Giỏi"
          : pct >= 65
            ? "🥈 Khá"
            : pct >= 50
              ? "🥉 Trung bình"
              : "📚 Cần cố gắng";
    const headerColor =
      pct >= 80 ? "bg-emerald-600" : pct >= 50 ? "bg-blue-600" : "bg-red-600";

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Score header */}
        <div className={`${headerColor} text-white px-4 pt-10 pb-8`}>
          <div className={`${containerClass} text-center`}>

            <p className="text-5xl mb-2">
              {pct >= 80 ? "🎉" : pct >= 50 ? "👍" : "📖"}
            </p>
            <h1 className="text-3xl font-bold mb-1">
              {finalScore.score}/{finalScore.totalPoints}
            </h1>
            {essaySaved ? (
              <p className="text-lg opacity-90">
                {pct}% · {grade}
              </p>
            ) : (
              <p className="text-base opacity-90">
                Trắc nghiệm: {mcScore.score}/{mcScore.totalPoints} điểm
                {hasEssay && (
                  <span className="ml-2 opacity-75">+ Tự luận: chờ chấm</span>
                )}
              </p>
            )}
            <p className="text-sm opacity-75 mt-1">
              Trắc nghiệm: {mcScore.correctCount}/{mcScore.totalMC} câu đúng
            </p>
            {session.timeUsed && (
              <p className="text-sm opacity-75">
                Thời gian: {Math.floor(session.timeUsed / 60)}p{" "}
                {session.timeUsed % 60}s
              </p>
            )}
          </div>
        </div>

        <div className={`${containerClass} py-6 space-y-6`}>

          {/* Parent essay scoring panel */}
          {hasEssay && !essaySaved && (
            <div className="bg-purple-50 border-2 border-purple-300 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">👨‍👩‍👧</span>
                <div>
                  <h3 className="font-bold text-purple-800">
                    Chấm điểm tự luận
                  </h3>
                  <p className="text-xs text-purple-500">
                    Chọn AI tự chấm hoặc phụ huynh chấm thủ công
                  </p>
                </div>
              </div>
              <div className="bg-purple-100 rounded-xl px-3 py-2 text-sm text-purple-700">
                <strong>Phần tự luận:</strong> {essayTotalPoints} điểm ·{" "}
                <span className="text-purple-500">
                  {allEssayScored
                    ? `Đã chấm: ${essayQuestions.reduce((a, q) => a + (essayScores[q.id] ?? 0), 0)} điểm`
                    : "Chưa chấm hết"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleAIGrading()}
                  disabled={savingEssay}
                  className="bg-blue-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl text-sm active:scale-[0.98] transition-all"
                >
                  {savingEssay ? "⏳ Đang chấm..." : "🤖 AI chấm tự động"}
                </button>
                <button
                  onClick={handleSaveEssayScores}
                  disabled={savingEssay || !allEssayScored}
                  className="bg-purple-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl text-sm active:scale-[0.98] transition-all"
                >
                  {savingEssay
                    ? "⏳ Đang lưu..."
                    : allEssayScored
                      ? "✅ Lưu điểm"
                      : `📝 Chấm thủ công`}
                </button>
              </div>
            </div>
          )}

          {essaySaved && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex items-center gap-3">
              <span className="text-3xl">🏅</span>
              <div>
                <p className="font-bold text-emerald-800">Điểm đã được lưu!</p>
                <p className="text-sm text-emerald-600">
                  Tổng: {finalScore.score}/{finalScore.totalPoints} điểm · MC:{" "}
                  {mcScore.score}đ · TL:{" "}
                  {essayQuestions.reduce(
                    (a, q) => a + (essayScores[q.id] ?? 0),
                    0,
                  )}
                  đ
                </p>
              </div>
            </div>
          )}

          {/* Detail per section */}
          <h2 className="font-bold text-gray-800 text-lg">Chi tiết từng câu</h2>
          {exam.sections.map((section) => (
            <div key={section.id} className="space-y-3">
              <h3 className="font-semibold text-gray-600 text-sm bg-gray-200 px-3 py-1.5 rounded-lg">
                {section.title}
              </h3>
              {section.questions.map((q) => {
                const qScore = finalScore.perQuestion[q.id];
                return (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    answer={answers.find((a) => a.questionId === q.id)}
                    onAnswer={() => {}}
                    penSettings={penSettings}
                    drawMode={false}
                    showResult={true}
                    scoreInfo={qScore}
                    essayScore={essayScores[q.id]}
                    onEssayScoreChange={handleEssayScoreChange}
                    parentScoreMode={
                      !essaySaved && q.type !== "multiple_choice"
                    }
                  />
                );
              })}
            </div>
          ))}

          <div className="pt-2 pb-8 flex gap-3">
            <button
              onClick={() => navigate("/")}
              className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-2xl text-base active:scale-95 transition-transform"
            >
              🏠 Trang chủ
            </button>
            <button
              onClick={handleRetry}
              className="flex-1 bg-gray-200 text-gray-700 font-bold py-4 rounded-2xl text-base active:scale-95 transition-transform"
            >
              🔁 Thi lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Scratchpad Pen Settings
  const activeScratchPage = scratchPages[currentScratchPageIdx];
  const activeBg = activeScratchPage?.background || 'grid';
  const currentBgColor = activeBg === 'lined' ? '#fffdf4' : (activeBg === 'grid' ? '#f7fafc' : '#ffffff');

  const scratchPenSettings = {
    color: scratchEraserMode ? currentBgColor : scratchPenColor,
    size: scratchEraserMode ? 28 : scratchPenSize,
    opacity: scratchPenStyle === "highlighter" ? 0.35 : 1,
    style: scratchPenStyle,
  };

  // Exam view
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col overflow-hidden h-screen">
      {/* Anti-cheat warning */}
      {showAntiCheatWarning && (
        <div className="fixed inset-0 z-50 bg-red-900/90 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-red-700 mb-2">
              Cảnh báo gian lận!
            </h2>
            <p className="text-gray-600 mb-4">
              Bạn đã rời khỏi trang thi {antiCheatViolations} lần. Sau 3 lần,
              bài thi sẽ tự động nộp.
            </p>
            <button
              onClick={() => setShowAntiCheatWarning(false)}
              className="w-full bg-red-600 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform"
            >
              Tôi hiểu, sẽ không lặp lại
            </button>
          </div>
        </div>
      )}

      {/* Pause overlay */}
      {isPaused && (
        <div className="fixed inset-0 z-50 bg-blue-900/90 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md text-center">
            <div className="text-6xl mb-4">⏸️</div>
            <h2 className="text-2xl font-bold text-blue-700 mb-2">
              Bài thi đã tạm dừng
            </h2>
            <p className="text-gray-600 mb-4">
              Thời gian thi đang tạm dừng. Bạn có thể đi vệ sinh hoặc nghỉ ngơi.
            </p>
            <button
              onClick={() => setIsPaused(false)}
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform"
            >
              ▶ Tiếp tục thi
            </button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate("/")}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 active:scale-95 transition-all text-lg"
          >
            ←
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800 text-[14px] truncate">
              {exam.title}
            </p>
            <p className="text-xs text-gray-400 font-semibold">
              Đã trả lời: {answeredCount}/{totalQuestions} câu
            </p>
          </div>
          <button
            onClick={() => setIsPaused(true)}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 active:scale-95 transition-all"
            title="Tạm dừng"
          >
            ⏸
          </button>
          <button
            onClick={() => setShowPrint(true)}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 active:scale-95 transition-all"
            title="In đề thi"
          >
            🖨
          </button>
          <button
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
              } else {
                document.exitFullscreen();
              }
            }}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 active:scale-95 transition-all"
            title="Toàn màn hình"
          >
            ⛶
          </button>
          <Timer
            timeLeft={timeLeft}
            totalTime={exam.duration * 60}
            isLocked={isLocked}
          />
        </div>
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all"
            style={{
              width: `${(answeredCount / Math.max(totalQuestions, 1)) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Main splitscreen content */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden h-[calc(100vh-56px)] bg-slate-50">
        
        {/* Left Column: Scrollable Questions Sheet (2/3 width) */}
        <div className="w-full md:w-2/3 h-[55%] md:h-full border-r border-slate-200 flex flex-col relative overflow-hidden">
          <div className={`flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6 ${activeMathInput ? 'pb-[320px]' : 'pb-6'}`}>
            {/* Exam header info */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm text-center">
              <div className="inline-block bg-blue-100 text-blue-700 text-xs font-extrabold px-3 py-1 rounded-full mb-3 uppercase tracking-wider">
                {exam.grade} · {exam.subject}
              </div>
              <h1 className="text-xl md:text-2xl font-black text-slate-800" style={{ fontFamily: "'Baloo 2', cursive" }}>
                {exam.title}
              </h1>
              <p className="text-sm text-slate-500 mt-2 font-medium">
                Thời gian làm bài: {exam.duration} phút · Tổng số điểm: {exam.totalPoints} điểm
              </p>
              <div className="h-px bg-slate-100 my-3"></div>
              <p className="text-xs text-slate-400 font-medium">
                Họ và tên học sinh: ………………………………………… Lớp: ……………
              </p>
            </div>

            {/* Sections list */}
            {exam.sections.map((section) => (
              <div key={section.id} className="space-y-4">
                <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-5 py-3.5 rounded-2xl shadow-sm">
                  <h2 className="font-bold text-base" style={{ fontFamily: "'Baloo 2', cursive" }}>
                    {section.title}
                  </h2>
                  {section.description && (
                    <p className="text-xs text-blue-100 mt-1 opacity-90 font-medium">
                      {section.description}
                    </p>
                  )}
                </div>
                
                <div className="space-y-4">
                  {section.questions.map((q) => (
                    <QuestionCard
                      key={q.id}
                      question={q}
                      answer={answers.find((a) => a.questionId === q.id)}
                      onAnswer={handleAnswer}
                      penSettings={penSettings}
                      drawMode={drawMode}
                      activeInputQuestionId={activeMathInput?.questionId}
                      onFocusMathInput={(qId, val, onChangeCb) => {
                        setActiveMathInput({ questionId: qId, value: val, onChange: onChangeCb });
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Central Math Keyboard docked at bottom of left pane */}
          {activeMathInput && (
            <div 
              className="absolute bottom-0 left-0 w-full bg-white border-t-4 border-blue-400 shadow-2xl z-30 select-none animate-in slide-in-from-bottom duration-300"
              onMouseDown={(e) => {
                // Prevent loss of focus on the textarea (except for input fields)
                if ((e.target as HTMLElement).tagName !== 'INPUT') {
                  e.preventDefault();
                }
              }}
            >
              {/* Live Fraction Preview Bar */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 border-b border-blue-100 px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                    ✨ Xem trước lời giải của bé:
                  </p>
                  <div className="text-lg text-slate-800 font-serif min-h-[32px] flex items-center">
                    {activeMathInput.value ? (
                      <TextWithFractions text={activeMathInput.value} />
                    ) : (
                      <span className="text-slate-400 italic">Viết lời giải của con vào đây...</span>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setActiveMathInput(null);
                    sounds.correct();
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-black uppercase tracking-wider active:scale-95 transition-all shadow-md shadow-emerald-200 shrink-0"
                >
                  XONG RỒI 💾
                </button>
              </div>

              {/* Main Keyboard Keys */}
              <div className="p-4 bg-slate-50 grid grid-cols-12 gap-3">
                {/* Left Area: Fraction Builder and Numbers */}
                <div className="col-span-8 space-y-3">
                  {/* Fraction Input Row */}
                  <div className="bg-orange-50 rounded-2xl p-2.5 border border-orange-100 flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-orange-200 shrink-0">
                      <input
                        type="text"
                        value={centralNumerator}
                        onChange={(e) => setCentralNumerator(e.target.value)}
                        placeholder="Tử"
                        className="w-10 h-8 text-center border-2 border-orange-100 focus:border-orange-500 focus:outline-none rounded-lg font-bold text-base bg-orange-50/20"
                      />
                      <div className="w-4 h-0.5 bg-orange-300 rounded-full" />
                      <input
                        type="text"
                        value={centralDenominator}
                        onChange={(e) => setCentralDenominator(e.target.value)}
                        placeholder="Mẫu"
                        className="w-10 h-8 text-center border-2 border-orange-100 focus:border-orange-500 focus:outline-none rounded-lg font-bold text-base bg-orange-50/20"
                      />
                    </div>
                    <button
                      onClick={() => {
                        if (centralNumerator && centralDenominator) {
                          dispatchKeyboardAction('insertFraction', { num: centralNumerator, den: centralDenominator });
                          setCentralNumerator('');
                          setCentralDenominator('');
                        }
                      }}
                      disabled={!centralNumerator || !centralDenominator}
                      className="flex-1 h-11 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:hover:bg-orange-500 text-white font-extrabold text-sm rounded-xl active:scale-95 transition-all shadow-md shadow-orange-200 flex items-center justify-center gap-1.5"
                    >
                      <span>➗</span> Chèn Phân Số
                    </button>
                  </div>

                  {/* Numbers Grid */}
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        onClick={() => dispatchKeyboardAction('insert', { text: num.toString() })}
                        className="h-12 rounded-xl bg-white hover:bg-gray-50 text-gray-800 text-lg font-black border-b-4 border-gray-200 active:border-b-0 active:translate-y-1 transition-all"
                      >
                        {num}
                      </button>
                    ))}
                    {[6, 7, 8, 9, 0].map((num) => (
                      <button
                        key={num}
                        onClick={() => dispatchKeyboardAction('insert', { text: num.toString() })}
                        className="h-12 rounded-xl bg-white hover:bg-gray-50 text-gray-800 text-lg font-black border-b-4 border-gray-200 active:border-b-0 active:translate-y-1 transition-all"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      onClick={() => dispatchKeyboardAction('insert', { text: ',' })}
                      className="h-12 rounded-xl bg-white hover:bg-gray-50 text-gray-800 text-lg font-black border-b-4 border-gray-200 active:border-b-0 active:translate-y-1 transition-all"
                    >
                      ,
                    </button>
                    <button
                      onClick={() => dispatchKeyboardAction('insert', { text: '.' })}
                      className="h-12 rounded-xl bg-white hover:bg-gray-50 text-gray-800 text-lg font-black border-b-4 border-gray-200 active:border-b-0 active:translate-y-1 transition-all"
                    >
                      .
                    </button>
                    <button
                      onClick={() => dispatchKeyboardAction('insert', { text: ' ' })}
                      className="col-span-2 h-12 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-black border-b-4 border-blue-200 active:border-b-0 active:translate-y-1 transition-all"
                    >
                      KHOẢNG CÁCH ⌴
                    </button>
                    <button
                      onClick={() => dispatchKeyboardAction('backspace')}
                      className="h-12 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xl font-black border-b-4 border-red-200 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center"
                    >
                      ⌫
                    </button>
                  </div>

                  {/* Math Symbols Horizontal Scroll */}
                  <div className="flex gap-1.5 mt-2 overflow-x-auto no-scrollbar">
                    {['cm', 'm', 'kg', 'g', 'l', '°C', '?', '>', '<', '...'].map((sym) => (
                      <button
                        key={sym}
                        onClick={() => dispatchKeyboardAction('insert', { text: sym })}
                        className="min-w-[44px] h-8 rounded-lg bg-white border border-gray-200 text-gray-600 text-xs font-bold active:scale-95 transition-all flex items-center justify-center px-2 shadow-sm"
                      >
                        {sym}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right Area: Operators & Special */}
                <div className="col-span-4 flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2 flex-1">
                    {['+', '-', '×', ':'].map((op) => (
                      <button
                        key={op}
                        onClick={() => dispatchKeyboardAction('insert', { text: ` ${op} ` })}
                        className="h-12 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-xl font-black border-b-4 border-sky-200 active:border-b-0 active:translate-y-1 transition-all"
                      >
                        {op}
                      </button>
                    ))}
                    <button
                      onClick={() => dispatchKeyboardAction('insert', { text: '(' })}
                      className="h-12 rounded-xl bg-white hover:bg-gray-50 text-gray-700 text-base font-black border-b-4 border-gray-200 active:border-b-0 active:translate-y-1 transition-all"
                    >
                      (
                    </button>
                    <button
                      onClick={() => dispatchKeyboardAction('insert', { text: ')' })}
                      className="h-12 rounded-xl bg-white hover:bg-gray-50 text-gray-700 text-base font-black border-b-4 border-gray-200 active:border-b-0 active:translate-y-1 transition-all"
                    >
                      )
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => dispatchKeyboardAction('insert', { text: ' = ' })}
                      className="h-11 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 text-lg font-black border-b-4 border-teal-200 active:border-b-0 active:translate-y-1 transition-all"
                    >
                      =
                    </button>
                    <button
                      onClick={() => dispatchKeyboardAction('insert', { text: '\n' })}
                      className="h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1 transition-all flex flex-col items-center justify-center leading-none"
                    >
                      <span>XUỐNG DÒNG</span>
                      <span className="text-xs mt-0.5">↵</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Submission sticky bar inside the questions pane */}
          <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex gap-4 shrink-0 shadow-lg z-20">
            <button
              onClick={() => {
                setDrawMode((v) => !v);
                if (!drawMode) setShowPenBar(true);
              }}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all active:scale-95 min-w-[64px] border ${
                drawMode
                  ? "bg-blue-100 border-blue-300 text-blue-700"
                  : "bg-slate-100 border-transparent text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span className="text-lg">✏️</span>
              <span>{drawMode ? "Tắt vẽ đề" : "Bút vẽ đề"}</span>
            </button>

            <button
              onClick={() => setShowPenBar((v) => !v)}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all active:scale-95 min-w-[64px] border ${
                showPenBar
                  ? "bg-purple-100 border-purple-300 text-purple-700"
                  : "bg-slate-100 border-transparent text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span className="text-lg">🎨</span>
              <span>Cài vẽ đề</span>
            </button>

            <button
              onClick={handleSubmit}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-extrabold py-3.5 rounded-2xl text-base active:scale-[0.98] transition-all shadow-md shadow-blue-200 hover:shadow-lg"
              style={{ fontFamily: "'Baloo 2', cursive" }}
            >
              ✓ NỘP BÀI THI ({answeredCount}/{totalQuestions})
            </button>
          </div>
        </div>

        {/* Right Column: Lined School Notepad Scratchpad (1/3 width) */}
        <div className="w-full md:w-1/3 h-[45%] md:h-full flex flex-col border-t-2 md:border-t-0 border-slate-300 relative shadow-2xl overflow-hidden z-10">
          
          {/* Booklet ribbon navigation & custom paper template selection */}
          <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200 shadow-sm z-10 shrink-0 select-none">
            {/* Page turn and CRUD rows */}
            <div className="flex items-center justify-between gap-2">
              {/* Turn pages */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleSwitchScratchPage(currentScratchPageIdx - 1)}
                  disabled={currentScratchPageIdx === 0}
                  className="w-8 h-8 rounded-full bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white active:scale-95 transition-all text-xs font-black shadow-sm flex items-center justify-center text-slate-700"
                  title="Trang trước"
                >
                  ◀
                </button>
                <span 
                  className="text-xs font-extrabold text-indigo-900 bg-white/90 border border-indigo-100 px-3 py-1 rounded-full shadow-inner tracking-wide min-w-[85px] text-center" 
                  style={{ fontFamily: "'Baloo 2', cursive" }}
                >
                  📖 Trang {currentScratchPageIdx + 1} / {scratchPages.length}
                </span>
                <button
                  onClick={() => handleSwitchScratchPage(currentScratchPageIdx + 1)}
                  disabled={currentScratchPageIdx === scratchPages.length - 1}
                  className="w-8 h-8 rounded-full bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white active:scale-95 transition-all text-xs font-black shadow-sm flex items-center justify-center text-slate-700"
                  title="Trang sau"
                >
                  ▶
                </button>
              </div>

              {/* Page Actions */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleAddScratchPage}
                  className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-95 text-white text-[11px] font-extrabold shadow-sm flex items-center gap-1 transition-all"
                  title="Thêm một trang nháp mới"
                >
                  ➕ Thêm
                </button>
                <button
                  onClick={() => handleDeleteScratchPage(currentScratchPageIdx)}
                  disabled={scratchPages.length <= 1}
                  className="px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 disabled:opacity-40 active:scale-95 text-red-600 border border-red-200/50 text-[11px] font-bold transition-all flex items-center justify-center"
                  title="Xóa trang nháp hiện tại"
                >
                  🗑️ Xóa
                </button>
              </div>
            </div>

            {/* Paper selector row */}
            <div className="flex flex-wrap items-center gap-1 mt-2.5">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1">NỀN GIẤY:</span>
              {[
                { id: 'grid', label: '📐 Ô Ly Toán', bg: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                { id: 'dot', label: '🔵 Giấy Chấm', bg: 'bg-blue-50 border-blue-200 text-blue-700' },
                { id: 'lined', label: '📝 Kẻ Dòng', bg: 'bg-amber-50 border-amber-200 text-amber-800' },
                { id: 'blank', label: '🎨 Giấy Trơn', bg: 'bg-slate-50 border-slate-200 text-slate-700' }
              ].map((paper) => {
                const isActive = (scratchPages[currentScratchPageIdx]?.background || 'grid') === paper.id;
                return (
                  <button
                    key={paper.id}
                    onClick={() => handleChangeScratchBackground(paper.id as any)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all border active:scale-95 shadow-sm ${
                      isActive
                        ? `${paper.bg} ring-2 ring-indigo-400 ring-offset-1 font-extrabold scale-105`
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                  >
                    {paper.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Realistic school notebook drawing toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-50 border-b border-slate-200 select-none shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => scratchCanvasRef.current?.undoLast()}
                className="px-2 py-1 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all text-[11px] font-extrabold text-slate-600 flex items-center gap-1 shadow-sm"
                title="Hoàn tác nét vẽ vừa vẽ"
              >
                ↩️ Hoàn tác
              </button>
              <button
                onClick={() => {
                  if (confirm("Mỹ Linh có chắc chắn muốn xóa sạch nét vẽ trên trang này không? Nét vẽ sẽ biến mất đó!")) {
                    scratchCanvasRef.current?.clearAll();
                  }
                }}
                className="px-2 py-1 rounded-xl bg-red-50 hover:bg-red-100 active:scale-95 transition-all text-[11px] font-extrabold text-red-600 flex items-center gap-1 border border-red-200/50 shadow-sm"
                title="Xóa toàn bộ nét vẽ trên trang nháp này"
              >
                🗑️ Xóa sạch nét
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Eraser */}
              <button
                onClick={() => setScratchEraserMode(!scratchEraserMode)}
                className={`px-2 py-1 rounded-xl active:scale-95 transition-all text-[11px] font-extrabold flex items-center gap-1 border shadow-sm ${
                  scratchEraserMode
                    ? "bg-purple-600 border-purple-600 text-white shadow-md"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
                title="Sử dụng cục tẩy để xóa nét nháp"
              >
                🧹 Tẩy nét {scratchEraserMode && "⭐"}
              </button>

              <div className="h-5 w-px bg-slate-200"></div>

              {/* Colors */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-full border border-slate-200 shadow-sm">
                {[
                  { color: "#1e293b", name: "Đen" },
                  { color: "#2563eb", name: "Xanh" },
                  { color: "#ef4444", name: "Đỏ" },
                  { color: "#16a34a", name: "Lá" }
                ].map((c) => (
                  <button
                    key={c.color}
                    onClick={() => {
                      setScratchPenColor(c.color);
                      setScratchPenStyle("pen");
                      setScratchEraserMode(false);
                    }}
                    className={`w-5 h-5 rounded-full border border-slate-300/60 transition-all active:scale-90 ${
                      !scratchEraserMode && scratchPenColor === c.color && scratchPenStyle === "pen"
                        ? "scale-120 ring-2 ring-indigo-400 ring-offset-1 border-transparent shadow-md"
                        : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: c.color }}
                    title={`Bút ${c.name}`}
                  />
                ))}
                {/* Highlighter */}
                <button
                  onClick={() => {
                    setScratchPenColor("#eab308");
                    setScratchPenStyle("highlighter");
                    setScratchEraserMode(false);
                  }}
                  className={`w-5 h-5 rounded-full border border-yellow-400 transition-all active:scale-90 bg-yellow-300 flex items-center justify-center text-[8px] ${
                    !scratchEraserMode && scratchPenColor === "#eab308" && scratchPenStyle === "highlighter"
                      ? "scale-120 ring-2 ring-yellow-400 ring-offset-1 border-transparent shadow-md font-black text-yellow-800"
                      : "hover:scale-105"
                  }`}
                  title="Bút dạ quang đánh dấu"
                >
                  ✨
                </button>
              </div>

              <div className="h-5 w-px bg-slate-200"></div>

              {/* Sizes */}
              <div className="flex bg-white border border-slate-200 rounded-xl p-0.5 gap-0.5 shadow-sm">
                {[
                  { size: 2, label: "Thanh" },
                  { size: 4, label: "Vừa" },
                  { size: 8, label: "Đậm" }
                ].map((s) => (
                  <button
                    key={s.size}
                    onClick={() => {
                      setScratchPenSize(s.size);
                      setScratchEraserMode(false);
                    }}
                    className={`px-1.5 py-0.5 rounded-lg text-[9px] font-extrabold transition-all active:scale-95 ${
                      !scratchEraserMode && scratchPenSize === s.size
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Paginated notepad drawing sheet background display */}
          <div 
            className="flex-1 relative w-full overflow-hidden shadow-inner cursor-crosshair transition-all duration-300 select-none"
            style={getScratchpadStyle(scratchPages[currentScratchPageIdx]?.background || 'grid')}
          >
            {/* Header watermarks */}
            <div className="absolute top-2 left-16 flex items-center justify-between right-4 text-[9px] font-black text-indigo-400/40 pointer-events-none select-none tracking-wide">
              <span>🎒 MÊ THI - SỔ NHÁP TOÁN HỌC 🌟</span>
              <span className="bg-indigo-50/50 border border-indigo-100/50 rounded-full px-2 py-0.5">Trang: {currentScratchPageIdx + 1}</span>
            </div>

            {/* School Booklet Red Margin Line */}
            {((scratchPages[currentScratchPageIdx]?.background || 'grid') === 'grid' || 
              (scratchPages[currentScratchPageIdx]?.background || 'grid') === 'lined') && (
              <div className="absolute top-0 bottom-0 left-[44px] w-px bg-red-400 opacity-60 pointer-events-none select-none"></div>
            )}

            {/* Drawing Canvas */}
            <DrawingCanvas
              ref={scratchCanvasRef}
              penSettings={scratchPenSettings}
              isActive={true}
              isScratchMode={true}
              onDataChange={handleScratchChange}
            />
          </div>
        </div>
      </div>

      {/* Floating Draw Mode sidebar for Left pane if active */}
      {showPenBar && (
        <div className="fixed right-4 bottom-24 z-40 w-56 p-3 border border-gray-200 rounded-2xl bg-white shadow-xl overflow-y-auto max-h-[70vh]">
          <div className="flex items-center justify-between border-b pb-2 mb-2">
            <span className="font-bold text-slate-700 text-sm">Cài đặt bút vẽ đề</span>
            <button 
              onClick={() => setShowPenBar(false)} 
              className="text-xs font-bold text-red-500 hover:underline"
            >
              Đóng
            </button>
          </div>
          <PenToolbar
            penSettings={penSettings}
            onChange={handlePenChange}
            drawMode={drawMode}
            onToggleDrawMode={() => setDrawMode((v) => !v)}
          />
        </div>
      )}

      {/* Print preview overlay */}
      {showPrint && (
        <PrintExam exam={exam} onClose={() => setShowPrint(false)} />
      )}
    </div>
  );
};

export default ExamPage;
