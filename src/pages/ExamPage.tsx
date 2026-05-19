import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Exam, Answer, PenSettings, ExamSession } from "@/types/exam";
import {
  getExams,
  saveSession,
  generateId,
  saveLibraryQuestion,
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

// Utility to shuffle array
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

const ExamPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [exam, setExam] = useState<Exam | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [showAntiCheatWarning, setShowAntiCheatWarning] = useState(false);
  const [antiCheatViolations, setAntiCheatViolations] = useState(0);

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
    }
  }, [examId]);

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

    // Save questions to library
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
    }

    setSession(newSession);
    setSubmitted(true);

    // Tự động chấm điểm AI cho phần tự luận ngay sau khi nộp
    if (allQuestions.some((q) => q.type !== "multiple_choice")) {
      handleAIGrading(newSession);
    }
  }, [exam, answers, handleAIGrading]);

  const handleSaveEssayScores = useCallback(async () => {
    if (!exam || !session) return;
    setSavingEssay(true);

    const finalScore = calculateScore(exam, answers, essayScores);

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
          <div className="max-w-2xl mx-auto text-center">
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

        <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
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

  // Exam view
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
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
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
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
            <p className="text-xs text-gray-400">
              {answeredCount}/{totalQuestions} câu đã trả lời
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
            className="h-full bg-blue-500 transition-all"
            style={{
              width: `${(answeredCount / Math.max(totalQuestions, 1)) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-36">
            {/* Exam header */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 text-center">
              <div className="inline-block bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full mb-2">
                {exam.grade} · {exam.subject}
              </div>
              <h1 className="text-lg font-bold text-gray-800">{exam.title}</h1>
              <p className="text-sm text-gray-400 mt-1">
                Thời gian: {exam.duration} phút · Tổng điểm: {exam.totalPoints}{" "}
                điểm
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Họ và tên: ………………………………………… Lớp: ……………
              </p>
            </div>

            {/* Sections */}
            {exam.sections.map((section) => (
              <div key={section.id} className="space-y-3">
                <div className="bg-blue-700 text-white px-4 py-3 rounded-xl">
                  <h2 className="font-bold text-[15px]">{section.title}</h2>
                  {section.description && (
                    <p className="text-xs text-blue-100 mt-0.5">
                      {section.description}
                    </p>
                  )}
                </div>
                {section.questions.map((q) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    answer={answers.find((a) => a.questionId === q.id)}
                    onAnswer={handleAnswer}
                    penSettings={penSettings}
                    drawMode={drawMode}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Pen sidebar on large screens */}
        {showPenBar && (
          <div className="hidden md:block w-56 shrink-0 p-3 border-l border-gray-200 bg-white overflow-y-auto">
            <PenToolbar
              penSettings={penSettings}
              onChange={handlePenChange}
              drawMode={drawMode}
              onToggleDrawMode={() => setDrawMode((v) => !v)}
            />
          </div>
        )}
      </div>

      {/* Bottom toolbar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-lg">
        <div className="flex items-center gap-2 px-3 py-3 max-w-2xl mx-auto">
          <button
            onClick={() => {
              setDrawMode((v) => !v);
              if (!drawMode) setShowPenBar(true);
            }}
            className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-95 min-w-[56px] ${
              drawMode
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            <span className="text-xl">✏️</span>
            <span>{drawMode ? "Tắt bút" : "Bút vẽ"}</span>
          </button>

          <button
            onClick={() => setShowPenBar((v) => !v)}
            className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-95 min-w-[56px] ${
              showPenBar
                ? "bg-purple-100 text-purple-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            <span className="text-xl">🎨</span>
            <span>Cài bút</span>
          </button>

          <button
            onClick={() => setShowScratch(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl bg-amber-100 text-amber-700 text-xs font-medium active:scale-95 min-w-[56px]"
          >
            <span className="text-xl">📝</span>
            <span>Nháp</span>
          </button>

          <button
            onClick={handleSubmit}
            className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-transform shadow-blue-200 shadow-md"
          >
            ✓ Nộp bài ({answeredCount}/{totalQuestions})
          </button>
        </div>

        {/* Mobile pen toolbar */}
        {showPenBar && (
          <div className="md:hidden border-t border-gray-100 bg-gray-50 px-3 py-3">
            <PenToolbar
              penSettings={penSettings}
              onChange={handlePenChange}
              drawMode={drawMode}
              onToggleDrawMode={() => setDrawMode((v) => !v)}
            />
          </div>
        )}
      </div>

      {/* Scratch pad */}
      <ScratchPad
        isOpen={showScratch}
        onClose={() => setShowScratch(false)}
        penSettings={penSettings}
        onPenChange={handlePenChange}
      />

      {/* Print preview */}
      {showPrint && (
        <PrintExam exam={exam} onClose={() => setShowPrint(false)} />
      )}
    </div>
  );
};

export default ExamPage;
