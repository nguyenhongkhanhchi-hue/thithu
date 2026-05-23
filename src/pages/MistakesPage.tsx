/**
 * MistakesPage.tsx — Sổ Tay Sửa Sai của Mỹ Linh
 *
 * Tính năng:
 * - Hiển thị đáp án bé đã chọn vs đáp án đúng
 * - Giải thích vì sao sai
 * - Lời giải AI chi tiết step-by-step + mẹo ĐỈNH — luôn hiện sẵn, tạo 1 lần + lưu vĩnh viễn
 * - Nút "ĐỀ ÔN DẠNG NÀY 20 CÂU" → AI tạo → lưu local + cloud → chuyển vào thi
 * - Thống kê & chúc mừng khi bé thành thạo từng dạng bài
 * - Đồng bộ cloud qua Supabase
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, BookOpen, Sparkles, Star, Trophy,
  AlertTriangle, Loader2, CheckCircle2, TrendingUp, Award,
  X, Pencil, ChevronLeft, ChevronRight
} from "lucide-react";
import { WrongQuestion, Exam, PenSettings } from "@/types/exam";
import {
  getWrongQuestions,
  saveExam,
  generateId,
  getMasteredCategories,
  getCategoryPracticeStats,
  updateWrongQuestionSolution,
  type MasteredCategory,
} from "@/lib/storage";
import { generateExam, generateSolutionExplanation } from "@/lib/gemini";
import TextWithFractions from "@/components/features/FractionDisplay";
import { celebrate as triggerCelebrate } from "@/components/features/CelebrationEffect";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { uploadExamToCloud } from "@/lib/sync";
import { useLayout } from "@/contexts/LayoutContext";
import { motion, AnimatePresence } from "framer-motion";
import DrawingCanvas from "@/components/features/DrawingCanvas";



// ── AI lời giải chi tiết ────────────────────────────────────────────────
/**
 * Wrapper gọi generateSolutionExplanation từ gemini.ts (có rotation + fallback)
 */
async function generateDetailedSolution(wq: WrongQuestion): Promise<string> {
  const q = wq.question;
  const studentAnswerText = (() => {
    if (!wq.studentAnswer) return "Bỏ qua";
    if (q.type === "multiple_choice" && q.choices) {
      const c = q.choices.find(c => c.id === wq.studentAnswer);
      return c ? `${c.id}. ${c.text}` : wq.studentAnswer;
    }
    return wq.studentAnswer;
  })();

  const correctAnswerText = (() => {
    const ca = q.correctAnswer || wq.correctAnswer;
    if (!ca) return "";
    if (q.type === "multiple_choice" && q.choices) {
      const c = q.choices.find(c => c.id === ca);
      return c ? `${c.id}. ${c.text}` : ca;
    }
    return ca;
  })();

  const choicesText = q.choices
    ? q.choices.map(c => `  ${c.id}. ${c.text}`).join("\n")
    : "";

  return generateSolutionExplanation({
    questionText: q.text,
    choicesText,
    studentAnswer: studentAnswerText,
    correctAnswer: correctAnswerText,
    existingSolution: q.solution,
    subject: wq.subject,
    grade: wq.grade,
  });
}


// ── SolutionDisplay component ──────────────────────────────────────────────────
const SolutionDisplay: React.FC<{ text: string }> = ({ text }) => {
  // Parse 3 sections
  const phan1Match = text.match(/PHẦN\s*1[^—]*—?\s*🔍[^\n]*\n([\s\S]*?)(?=PHẦN\s*2|$)/i);
  const phan2Match = text.match(/PHẦN\s*2[^—]*—?\s*📖[^\n]*\n([\s\S]*?)(?=PHẦN\s*3|$)/i);
  const phan3Match = text.match(/PHẦN\s*3[^—]*—?\s*💡[^\n]*\n([\s\S]*?)$/i);

  const phan1 = phan1Match?.[1]?.trim() || "";
  const phan2 = phan2Match?.[1]?.trim() || "";
  const phan3 = phan3Match?.[1]?.trim() || "";

  // If no structured sections, just display raw
  if (!phan1 && !phan2 && !phan3) {
    return (
      <div className="text-sm text-slate-800 leading-relaxed font-serif whitespace-pre-line">
        <TextWithFractions text={text} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {phan1 && (
        <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4">
          <p className="text-[11px] font-black text-orange-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            🔍 VÌ SAO BÉ CHỌN SAI?
          </p>
          <div className="text-sm text-orange-900 leading-relaxed font-serif whitespace-pre-line">
            <TextWithFractions text={phan1} />
          </div>
        </div>
      )}

      {phan2 && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
          <p className="text-[11px] font-black text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            📖 HƯỚNG DẪN LÀM ĐÚNG TỪNG BƯỚC:
          </p>
          <div className="text-sm text-blue-900 leading-relaxed font-serif whitespace-pre-line">
            <TextWithFractions text={phan2} />
          </div>
        </div>
      )}

      {phan3 && (
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-400 rounded-2xl p-4 relative overflow-hidden">
          <div className="absolute right-2 bottom-1 text-7xl opacity-10 select-none pointer-events-none">💡</div>
          <p className="text-[11px] font-black text-amber-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span className="text-xl animate-bounce inline-block">💡</span>
            MẸO SIÊU ĐỈNH — KHÔNG BAO GIỜ SAI NỮA:
          </p>
          <div className="text-sm text-amber-900 font-semibold leading-relaxed whitespace-pre-line z-10 relative">
            <TextWithFractions text={phan3} />
          </div>
        </div>
      )}
    </div>
  );
};

// ── WrongQuestionCard ─────────────────────────────────────────────────────────
interface WrongQuestionCardProps {
  wq: WrongQuestion & { aiSolution?: string };
  onClick: () => void;
  practiceStats: { attempts: number; avgScore: number };
}

const WrongQuestionCard: React.FC<WrongQuestionCardProps> = ({
  wq,
  onClick,
  practiceStats,
}) => {
  const q = wq.question;
  const stars = Array.from({ length: 2 }).map((_, i) => (
    <span key={i} className="text-xs">
      {i < wq.correctCount ? "⭐" : "☆"}
    </span>
  ));

  return (
    <div 
      onClick={onClick}
      className="break-inside-avoid w-full bg-[#faf6eb] border-2 border-[#d8d2c4] rounded-3xl p-5 shadow-[3px_3px_10px_rgba(58,38,24,0.03)] hover:shadow-[6px_6px_18px_rgba(58,38,24,0.08)] hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between cursor-pointer relative overflow-hidden group mb-6"
    >
      <div className="space-y-4">
        {/* Header category details */}
        <div className="flex items-center justify-between gap-2 border-b border-dashed border-[#e6dec9] pb-3 mb-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="bg-white border border-[#d8d2c4] text-slate-700 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
              {wq.subject} · {wq.grade}
            </span>
            {q.category && (
              <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest">
                🎯 {q.category}
              </span>
            )}
            {practiceStats.attempts > 0 && (
              <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                📊 Đã ôn {practiceStats.attempts} lần
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 text-amber-500 bg-amber-50/50 border border-amber-200/50 px-2 py-0.5 rounded-full">
            {stars}
          </div>
        </div>

        <p className="text-[10px] text-slate-400 font-serif italic">
          Đề gốc: <span className="text-slate-500 font-black">{wq.examTitle}</span>
        </p>
        
        {/* Question TEXT ONLY - fully shown, no line-clamp! */}
        <div className="text-[15px] text-[#362f28] font-serif leading-relaxed pl-3 border-l-2 border-red-200/50 whitespace-pre-line">
          <span className="text-blue-600 font-black mr-1">Câu {q.number}:</span>
          <TextWithFractions text={q.text} />
        </div>
      </div>

      {/* Card Footer badges */}
      <div className="pt-4 mt-4 border-t border-dashed border-[#e6dec9] flex items-center justify-between">
        <span className="text-[9px] text-[#8c7c6a] font-serif italic uppercase">Nhấp xem chi tiết &amp; vẽ nháp</span>
        <div>
          {wq.correctCount === 0 ? (
            <span className="bg-orange-100 text-orange-800 border border-orange-200 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full">
              🔴 Cần ôn
            </span>
          ) : (
            <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full">
              🟡 Tiến bộ
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Mastered Banner ───────────────────────────────────────────────────────────
const MasteredBanner: React.FC<{ mastered: MasteredCategory[] }> = ({ mastered }) => {
  if (mastered.length === 0) return null;
  return (
    <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-3xl p-5 text-white shadow-lg shadow-emerald-200">
      <div className="flex items-center gap-3 mb-3">
        <Award className="w-8 h-8 text-yellow-200" />
        <div>
          <h3 className="font-black text-base uppercase tracking-wide" style={{ fontFamily: "'Baloo 2', cursive" }}>
            🎉 Bé Mỹ Linh đã nắm vững {mastered.length} dạng bài!
          </h3>
          <p className="text-emerald-100 text-[11px]">Những dạng bài bé đã làm đúng 2 lần liên tiếp</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {mastered.map((m, i) => (
          <div key={i} className="bg-white/20 backdrop-blur rounded-xl px-3 py-1.5 text-xs font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-yellow-200" />
            {m.category}
            {m.practiceCount > 1 && <span className="bg-white/20 rounded-full px-1 text-[9px]">×{m.practiceCount}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const MistakesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { containerClass, gridClass } = useLayout();

  // State
  const [wrongQuestions, setWrongQuestions] = useState<(WrongQuestion & { aiSolution?: string })[]>([]);
  const [masteredCategories, setMasteredCategories] = useState<MasteredCategory[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("Tất cả");
  const [selectedCategory, setSelectedCategory] = useState("Tất cả");
  const [isGeneratingTopicExam, setIsGeneratingTopicExam] = useState(false);
  const [generatingCategoryName, setGeneratingCategoryName] = useState("");
  const [hasApiKey, setHasApiKey] = useState(true); // assume true, check async

  // Detailed Modal/Folio focus view state
  const [activeWq, setActiveWq] = useState<(WrongQuestion & { aiSolution?: string }) | null>(null);
  const [wqTab, setWqTab] = useState<"details" | "scratchpad">("details");
  
  // Scratchpad drawing controls inside details folio
  const [penSettings, setPenSettings] = useState<PenSettings>({
    color: "#dc2626",
    size: 5,
    opacity: 1,
    style: "pen"
  });
  const [eraserMode, setEraserMode] = useState(false);
  const canvasRef = useRef<{ clearAll: () => void; undoLast: () => void; getData: () => string; setData: (data: string) => void } | null>(null);

  // States for AI solution generation inside details folio
  const [isLoadingSolution, setIsLoadingSolution] = useState(false);
  const [solutionError, setSolutionError] = useState(false);

  const loadData = useCallback(() => {
    const list = getWrongQuestions() as (WrongQuestion & { aiSolution?: string })[];
    setWrongQuestions(list.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()));
    setMasteredCategories(getMasteredCategories());
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Check API keys availability
  useEffect(() => {
    import("@/lib/gemini").then(({ hasAnyProvider }) => {
      setHasApiKey(hasAnyProvider());
    });
  }, []);

  // Handle AI solution generated for a card — save to storage
  const handleSolutionGenerated = useCallback((id: string, solution: string) => {
    updateWrongQuestionSolution(id, solution);
    setWrongQuestions(prev => prev.map(wq =>
      wq.id === id ? { ...wq, aiSolution: solution } : wq
    ));
  }, []);

  const handleGenerateSolution = async (wq: WrongQuestion & { aiSolution?: string }) => {
    if (isLoadingSolution) return;
    setIsLoadingSolution(true);
    setSolutionError(false);
    try {
      const solution = await generateDetailedSolution(wq);
      if (solution && solution.length > 50) {
        handleSolutionGenerated(wq.id, solution);
        setActiveWq(prev => prev && prev.id === wq.id ? { ...prev, aiSolution: solution } : prev);
      } else {
        setSolutionError(true);
      }
    } catch (err) {
      console.error('[MistakesPage] Solution generation failed:', err);
      setSolutionError(true);
    } finally {
      setIsLoadingSolution(false);
    }
  };

  // Auto-generate AI solution inside details modal if not yet cached
  useEffect(() => {
    if (activeWq && !activeWq.aiSolution && !isLoadingSolution) {
      handleGenerateSolution(activeWq);
    }
  }, [activeWq?.id]);

  // Load and save drawings in wrong questions scratchpad
  useEffect(() => {
    if (activeWq && wqTab === "scratchpad" && canvasRef.current) {
      const saved = localStorage.getItem(`examtouch_mistakes_canvas_${activeWq.id}`);
      if (saved) {
        setTimeout(() => {
          canvasRef.current?.setData(saved);
        }, 100);
      }
    }
  }, [activeWq?.id, wqTab]);

  const saveWrongScratch = () => {
    if (activeWq && canvasRef.current) {
      const data = canvasRef.current.getData();
      if (data) {
        localStorage.setItem(`examtouch_mistakes_canvas_${activeWq.id}`, data);
      }
    }
  };

  const handleCloseWqDetails = () => {
    saveWrongScratch();
    setActiveWq(null);
  };

  const effectivePen: PenSettings = eraserMode
    ? { ...penSettings, color: "#fbf9f4", size: 28, style: "pen", opacity: 1 }
    : penSettings;

  // ── Filters ────────────────────────────────────────────────────────────────
  const subjects = ["Tất cả", ...Array.from(new Set(wrongQuestions.map(q => q.subject)))];
  const categories = ["Tất cả", ...Array.from(new Set(wrongQuestions.map(q => q.question.category).filter(Boolean) as string[]))];

  const filteredQuestions = wrongQuestions.filter(q => {
    const matchSub = selectedSubject === "Tất cả" || q.subject === selectedSubject;
    const matchCat = selectedCategory === "Tất cả" || q.question.category === selectedCategory;
    return matchSub && matchCat;
  });

  // ── Stats ──────────────────────────────────────────────────────────────────
  const categoryCounts: Record<string, number> = {};
  wrongQuestions.forEach(q => {
    const cat = q.question.category || "Chưa phân loại";
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });
  const sortedCats = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  const toughestCategory = sortedCats[0]?.[0] || "Không có";
  const toughestCount = sortedCats[0]?.[1] || 0;

  // ── Generate topic exam 20 questions ──────────────────────────────────────
  const handleCreateTopicExam = async (categoryName: string, subject: string, grade: string) => {
    if (isGeneratingTopicExam) return;

    setIsGeneratingTopicExam(true);
    setGeneratingCategoryName(categoryName);
    const toastId = "gen-topic-exam";
    toast.loading(`AI đang soạn 20 câu ôn tập chuyên sâu dạng "${categoryName}"...`, { duration: 120000, id: toastId });

    try {
      // Lấy câu sai cùng category (nếu không có thì dùng tất cả câu sai để AI tham chiếu)
      const categoryQuestions = wrongQuestions.filter(q => q.question.category === categoryName);
      const sourceQuestions = categoryQuestions.length > 0
        ? categoryQuestions.map(q => q.question)
        : wrongQuestions.slice(0, 3).map(q => q.question);

      console.log('[MistakesPage] Creating topic exam:', {
        categoryName, subject, grade,
        categoryQCount: categoryQuestions.length,
        sourceQCount: sourceQuestions.length,
      });

      const sourceExamObj = {
        title: `Đề Ôn: ${categoryName}`,
        subject: subject || "Toán",
        grade: grade || "Lớp 4",
        sections: [{
          id: "s1",
          title: `Luyện chuyên sâu: ${categoryName}`,
          questions: sourceQuestions,
        }],
      };

      // AI tạo 20 câu, mỗi câu có đáp án + lời giải đầy đủ
      console.log('[MistakesPage] Calling generateExam...');
      const sections = await generateExam(
        sourceExamObj as any,
        "normal",
        20,
        categoryName,
      );
      console.log('[MistakesPage] generateExam OK, sections:', sections?.length);

      if (!sections || sections.length === 0) {
        throw new Error('AI trả về kết quả rỗng. Vui lòng thử lại.');
      }

      const newExamId = generateId();
      const newExam: Exam = {
        id: newExamId,
        title: `🎯 ĐỀ ÔN DẠNG BÀI: ${categoryName}`,
        subject: subject || "Toán",
        grade: grade || "Lớp 4",
        duration: 45,
        totalPoints: 10,
        isAIGenerated: true,
        createdAt: new Date().toISOString().split("T")[0],
        sections,
        difficulty: "normal",
        description: `Đề ôn luyện 20 câu chuyên sâu được AI biên soạn riêng để giúp bé Mỹ Linh chinh phục hoàn toàn dạng bài: "${categoryName}". Mỗi câu đều có đáp án và lời giải chi tiết.`,
      };

      // Lưu local
      saveExam(newExam);

      // Đồng bộ cloud nếu đang login
      if (user) {
        uploadExamToCloud(user, newExam).catch((err) => {
          console.warn('[MistakesPage] Cloud upload failed:', err);
        });
      }

      toast.dismiss(toastId);
      toast.success(`🚀 Đã soạn xong 20 câu ôn "${categoryName}"! Bắt đầu luyện tập thôi!`);

      // Chúc mừng nếu đây là lần ôn nhiều
      const stats = getCategoryPracticeStats(categoryName, subject);
      if (stats.attempts >= 2) {
        triggerCelebrate(`Mỹ Linh thật kiên trì! Đây là lần ${stats.attempts + 1} luyện dạng "${categoryName}"! 🏆`);
      }

      navigate(`/exam/${newExamId}`);
    } catch (error: any) {
      console.error('[MistakesPage] handleCreateTopicExam error:', error);
      toast.dismiss(toastId);
      toast.error(`Không thể tạo đề ôn: ${error?.message || 'Lỗi không xác định. Kiểm tra API Key trong Cài Đặt.'}`);
    } finally {
      setIsGeneratingTopicExam(false);
      setGeneratingCategoryName("");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#faf8f5] pb-16">
      {/* Gamified Magical Child-Friendly Header */}
      <div className="bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 text-white py-5 sticky top-0 z-50 shadow-xl border-b-4 border-yellow-300/40">
        <div className={`${containerClass} flex items-center justify-between gap-4`}>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/")}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all active:scale-90 border border-white/20 shadow-md"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-wider uppercase flex items-center gap-2" style={{ fontFamily: "'Baloo 2', cursive" }}>
                🏰 SỔ TAY HIỆP SĨ MỸ LINH
              </h1>
              <p className="text-pink-100 text-xs font-serif italic tracking-wide mt-0.5">
                Thu phục quái vật lỗi sai &bull; Luyện thành công tuyệt chiêu bảng vàng!
              </p>
            </div>
          </div>
          <div className="bg-amber-400 text-amber-950 px-4 py-2.5 rounded-2xl text-xs font-black shadow-lg flex items-center gap-1.5 shrink-0 border border-white animate-pulse">
            <Trophy className="w-4 h-4 text-amber-950" /> BẢNG VÀNG CHIẾN THẮNG
          </div>
        </div>
      </div>

      <div className={`${containerClass} mt-6 space-y-6`}>

        {/* Child-Friendly RPG Knight dialogue bubble */}
        <div className="bg-gradient-to-r from-amber-100 via-orange-50 to-pink-100 border-2 border-amber-300 rounded-[32px] p-6 shadow-md flex items-center gap-4 relative overflow-hidden animate-in fade-in duration-300">
          <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 text-amber-500/10 text-9xl font-black select-none pointer-events-none">⚔️</div>
          <div className="text-4xl select-none animate-bounce shrink-0">⚔️🛡️</div>
          <div className="space-y-1">
            <h4 className="font-black text-amber-900 text-xs uppercase tracking-wider">NHIỆM VỤ HIỆP SĨ HÔM NAY!</h4>
            <p className="text-xs text-amber-800 font-medium leading-relaxed font-serif italic">
              "Chào Hiệp sĩ Mỹ Linh dũng cảm! Vương quốc tri thức đang có các quái vật lỗi sai quai chiêu cần được thu phục. Hãy click vào từng thẻ quái vật bên dưới, dùng nét bút nháp phép thuật và cẩm nang AI để chiến thắng chúng nhé!"
            </p>
          </div>
        </div>

        {/* AI Server / Client status - Cute Banner */}
        {!hasApiKey && (
          <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border-2 border-purple-200 rounded-[32px] p-6 text-purple-950 shadow-sm relative overflow-hidden flex flex-col md:flex-row items-center gap-4 transition-all hover:shadow-md">
            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 text-indigo-500/10 text-9xl font-black select-none pointer-events-none">
              AI
            </div>
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0 border border-indigo-200 shadow-sm">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h4 className="font-black text-xs uppercase tracking-wider mb-1 text-indigo-800">
                ✨ ĐANG DÙNG SIÊU PHÉP THUẬT AI CHUNG
              </h4>
              <p className="text-[11px] text-indigo-700 font-bold leading-relaxed max-w-xl">
                Hệ thống đang chạy AI bằng cấu hình máy chủ. Bố Tommy có thể cài mã API Key cá nhân miễn phí trong Bàn Học để tăng tốc độ và có giới hạn sử dụng siêu mạnh riêng cho bé nhé!
              </p>
            </div>
            <button
              onClick={() => navigate("/settings")}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-black text-xs px-5 py-3.5 rounded-2xl shadow-md hover:scale-105 active:scale-95 transition-all shrink-0 uppercase tracking-wide border border-white"
            >
              Cài Đặt Siêu Key
            </button>
          </div>
        )}

        {/* Mastered banner */}
        <MasteredBanner mastered={masteredCategories} />

        {/* Stats Styled as RPG Magical Artifacts for Kids */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          
          {/* Card 1: Emojis and candy styled for children */}
          <div className="bg-gradient-to-br from-rose-50 to-pink-100 border-2 border-rose-200 rounded-[32px] p-5 shadow-md flex items-center gap-4 hover:scale-103 transition-transform duration-200">
            <div className="w-14 h-14 bg-rose-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/10 border-2 border-white text-3xl select-none">
              👾
            </div>
            <div>
              <p className="text-rose-600 text-[10px] font-black uppercase tracking-wider">Quái Vật Lỗi Sai</p>
              <h3 className="text-xl font-black text-rose-800 uppercase tracking-tight flex items-baseline gap-1" style={{ fontFamily: "'Baloo 2', cursive" }}>
                <span className="text-3xl text-rose-600 animate-pulse">{wrongQuestions.length}</span> quái vật
              </h3>
            </div>
          </div>

          {/* Card 2: Hardest category dragon boss */}
          <div className="bg-gradient-to-br from-violet-50 to-purple-100 border-2 border-purple-200 rounded-[32px] p-5 shadow-md flex items-center gap-4 hover:scale-103 transition-transform duration-200">
            <div className="w-14 h-14 bg-purple-600 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-purple-600/10 border-2 border-white text-3xl select-none">
              🐉
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-purple-600 text-[10px] font-black uppercase tracking-wider">Ải Khó Khăn Nhất</p>
              <h3 className="text-sm font-black text-purple-900 truncate uppercase tracking-tight" style={{ fontFamily: "'Baloo 2', cursive" }}>
                {toughestCount > 0 ? toughestCategory : "Không có"}
              </h3>
              {toughestCount > 0 && (
                <span className="inline-block text-[9px] bg-red-500 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-wider mt-1 border border-white">
                  🔥 Đang chắn đường ({toughestCount} câu)
                </span>
              )}
            </div>
          </div>

          {/* Card 3: Unlocked moves trophy card */}
          <div className="bg-gradient-to-br from-amber-50 to-yellow-100 border-2 border-yellow-200 rounded-[32px] p-5 shadow-md flex items-center gap-4 hover:scale-103 transition-transform duration-200">
            <div className="w-14 h-14 bg-amber-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/10 border-2 border-white text-3xl select-none">
              🏆
            </div>
            <div>
              <p className="text-amber-700 text-[10px] font-black uppercase tracking-wider">Tuyệt Chiêu Đã Luyện</p>
              <h3 className="text-xl font-black text-amber-900 uppercase tracking-tight flex items-baseline gap-1" style={{ fontFamily: "'Baloo 2', cursive" }}>
                <span className="text-3xl text-amber-600">{masteredCategories.length}</span> tuyệt chiêu
              </h3>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Môn:</span>
            {subjects.map(sub => (
              <button
                key={sub}
                onClick={() => setSelectedSubject(sub)}
                className={cn(
                  "px-3 py-1 rounded-xl text-xs font-bold transition-all border-2",
                  selectedSubject === sub
                    ? "bg-purple-600 text-white border-purple-600 shadow-md"
                    : "bg-white text-gray-600 border-gray-200 hover:border-purple-300"
                )}
              >
                {sub}
              </button>
            ))}
          </div>
          <div className="sm:ml-auto">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="bg-slate-50 border-2 border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-purple-500 min-w-[200px]"
            >
              <option value="Tất cả">🎯 Tất cả dạng bài ({categories.length - 1})</option>
              {categories.filter(c => c !== "Tất cả").map(cat => (
                <option key={cat} value={cat}>🎯 {cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Question list */}
        {filteredQuestions.length === 0 ? (
          <div className="bg-white rounded-3xl border-2 border-emerald-200 p-16 text-center shadow-sm">
            <span className="text-6xl block mb-4">🎉</span>
            <h3 className="text-xl font-black text-emerald-600 mb-2 uppercase" style={{ fontFamily: "'Baloo 2', cursive" }}>
              Cuốn sổ sạch bóng lỗi sai!
            </h3>
            <p className="text-gray-400 text-sm max-w-sm mx-auto">
              Bé Mỹ Linh thật tuyệt vời! Không còn lỗi nào cần sửa. Hãy tiếp tục làm nhiều đề để giữ phong độ nhé!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              {filteredQuestions.length} câu cần ôn luyện
            </p>
            <div className={`${gridClass} animate-in fade-in duration-300`}>

              {filteredQuestions.map(wq => (
                <WrongQuestionCard
                  key={wq.id}
                  wq={wq}
                  onClick={() => {
                    setActiveWq(wq);
                    setWqTab("details");
                    setEraserMode(false);
                  }}
                  practiceStats={getCategoryPracticeStats(wq.question.category || "", wq.subject)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FULL-SCREEN VINTAGE ARCHIVAL FOLIO DETAIL OVERLAY (Trang hồ sơ chi tiết sổ sửa sai) */}
      <AnimatePresence>
        {activeWq && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#150d09]/90 backdrop-blur-md flex items-center justify-center p-4 md:p-6"
          >
            {/* Leather Binder Outer Folder */}
            <motion.div 
              initial={{ scale: 0.9, y: 30, rotateX: -10 }}
              animate={{ scale: 1, y: 0, rotateX: 0 }}
              exit={{ scale: 0.95, y: 20, rotateX: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 120 }}
              className="w-full max-w-6xl h-[90vh] md:h-[85vh] bg-[#f5efe4] rounded-[28px] border-[10px] md:border-[16px] border-[#362215] shadow-2xl flex flex-col md:flex-row overflow-hidden relative"
              style={{
                boxShadow: "inset 0 0 20px rgba(0,0,0,0.8), 0 20px 50px rgba(0,0,0,0.9)",
                transformStyle: "preserve-3d"
              }}
            >
              {/* Binder Gold Stitching Trim */}
              <div className="absolute inset-2 border-2 border-dashed border-[#d4af37]/20 rounded-2xl pointer-events-none z-0" />
              
              {/* Central Binder Ring Spine (Desktop visual separator) */}
              <div className="hidden md:block absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-8 bg-gradient-to-r from-[#20140c] via-[#483325] to-[#20140c] border-x border-[#130b06] z-20 shadow-2xl">
                {/* Visual binder rings */}
                <div className="absolute inset-y-0 left-0 right-0 flex flex-col justify-around py-8 pointer-events-none">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-6 w-10 -ml-1 bg-gradient-to-r from-[#9e9e9e] via-[#d6d6d6] to-[#595959] rounded-full border border-black/40 shadow-md self-center" 
                         style={{ backgroundImage: "linear-gradient(to right, #9e9e9e, #d6d6d6, #595959)" }}/>
                  ))}
                </div>
              </div>

              {/* Close Button - Styled as a vintage Wax Seal */}
              <button 
                onClick={handleCloseWqDetails}
                className="absolute top-4 right-4 md:top-6 md:right-6 w-12 h-12 rounded-full bg-[#800020] hover:bg-[#9c1836] border-2 border-[#d4af37] shadow-lg flex items-center justify-center text-white active:scale-95 transition-all cursor-pointer z-50 hover:rotate-12 duration-200"
                style={{ boxShadow: "0 4px 10px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.2)" }}
                title="Đóng hồ sơ"
              >
                <X className="w-5 h-5 text-amber-100" />
              </button>

              {/* LEFT SIDE: Question Folio (50% on desktop, scrollable, cream paper) */}
              <div className="w-full md:w-1/2 h-1/2 md:h-full overflow-y-auto p-6 md:p-8 bg-[#faf7f0] border-r border-[#e3dac9] relative z-10"
                   style={{
                     backgroundImage: "radial-gradient(#e5d9bf 1px, transparent 1px)",
                     backgroundSize: "24px 24px"
                   }}>
                <div className="max-w-xl mx-auto space-y-6">
                  
                  {/* Folio Registry Header Tag */}
                  <div className="border-b-2 border-double border-[#54361e]/20 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-amber-800 uppercase tracking-widest font-mono">
                        CHI TIẾT LỖI SAI #{activeWq.id.slice(0, 6).toUpperCase()}
                      </span>
                      <span className="bg-rose-50 text-red-800 border border-red-200 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                        Sổ tay lỗi
                      </span>
                    </div>
                    <h2 className="text-xl font-bold font-serif text-[#3e291b] mt-1">
                      📖 Đề gốc: {activeWq.examTitle}
                    </h2>
                  </div>

                  {/* Question Content */}
                  <div className="space-y-4">
                    <span className="bg-red-700 text-white text-[10px] font-black px-3 py-1 rounded-md uppercase tracking-wider border border-red-600">
                      NỘI DUNG CÂU HỎI
                    </span>
                    <div className="text-[#2c221a] font-serif text-[17px] leading-relaxed whitespace-pre-line pl-3 border-l-4 border-red-500/40 py-1">
                      <span className="text-blue-600 font-black mr-1">Câu {activeWq.question.number}:</span>
                      <TextWithFractions text={activeWq.question.text} />
                    </div>
                  </div>

                  {/* Illustration SVG */}
                  {activeWq.question.illustrationSvg && (
                    <div className="bg-white border-2 border-[#e6dec9] rounded-2xl p-4 flex justify-center shadow-md">
                      <div dangerouslySetInnerHTML={{ __html: activeWq.question.illustrationSvg }} className="max-w-full" />
                    </div>
                  )}

                  {/* Wrong vs Correct Answer Comparison */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 shadow-sm">
                      <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">✗ Con đã chọn sai:</p>
                      <p className="text-sm font-bold text-red-950 font-serif whitespace-pre-line leading-relaxed">
                        {activeWq.studentAnswer ? <TextWithFractions text={activeWq.studentAnswer} /> : <span className="italic text-red-400">Bỏ trống</span>}
                      </p>
                    </div>
                    <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 shadow-sm">
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">✓ Lẽ ra phải chọn:</p>
                      <p className="text-sm font-bold text-emerald-950 font-serif whitespace-pre-line leading-relaxed">
                        <TextWithFractions text={activeWq.correctAnswer || activeWq.question.correctAnswer || "Chưa có"} />
                      </p>
                    </div>
                  </div>

                  {/* All Choices */}
                  {activeWq.question.choices && activeWq.question.choices.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TẤT CẢ PHƯƠNG ÁN ĐỀ BÀI:</p>
                      <div className="grid grid-cols-1 gap-2.5">
                        {activeWq.question.choices.map(c => {
                          const isCorrect = c.id === (activeWq.question.correctAnswer || activeWq.correctAnswer);
                          const isWrong = c.id === activeWq.studentAnswer && !isCorrect;
                          
                          return (
                            <div 
                              key={c.id} 
                              className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-bold transition-all shadow-sm",
                                isCorrect ? "bg-[#edfbf1] border-emerald-400 text-emerald-800" :
                                isWrong ? "bg-red-50 border-red-300 text-red-850 animate-pulse" :
                                "bg-white border-[#e3dac9] text-slate-650"
                              )}
                            >
                              <span className={cn(
                                "w-6.5 h-6.5 rounded-full flex items-center justify-center font-black text-[11px] shrink-0 border-2 shadow-sm",
                                isCorrect ? "bg-emerald-600 text-white border-emerald-500" :
                                isWrong ? "bg-red-500 text-white border-red-400" :
                                "bg-slate-100 text-slate-600 border-slate-200"
                              )}>
                                {c.id}
                              </span>
                              <span className="font-serif text-[14px]"><TextWithFractions text={c.text} /></span>
                              {isCorrect && <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-800 font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest">Đáp án đúng</span>}
                              {isWrong && <span className="ml-auto text-[10px] bg-red-100 text-red-800 font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest">Đã chọn</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Stamp */}
                  <div className="flex justify-end pt-6 opacity-30 select-none">
                    <div className="border-4 border-dashed border-[#800020] text-[#800020] font-black text-sm tracking-widest px-4 py-2 rounded-xl uppercase rotate-12">
                      📓 SỔ TAY SỬA SAI
                    </div>
                  </div>

                </div>
              </div>

              {/* RIGHT SIDE: Interactive Knowledge Folio & Canvas Drawing (50% on desktop) */}
              <div className="w-full md:w-1/2 h-1/2 md:h-full flex flex-col bg-[#fbf9f4] relative z-10">
                
                {/* Tabs Bar */}
                <div className="flex bg-[#ebdcb9]/40 border-b border-[#e3dac9] shrink-0">
                  <button
                    onClick={() => {
                      saveWrongScratch();
                      setWqTab("details");
                    }}
                    className={cn(
                      "flex-1 py-4 font-black text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 border-b-4",
                      wqTab === "details" 
                        ? "border-[#54361e] text-[#54361e] bg-[#fbf9f4]" 
                        : "border-transparent text-slate-400 hover:text-slate-700 hover:bg-[#ebdcb9]/20"
                    )}
                  >
                    <BookOpen className="w-4 h-4" /> 📖 LỜI GIẢI CHI TIẾT
                  </button>
                  <button
                    onClick={() => setWqTab("scratchpad")}
                    className={cn(
                      "flex-1 py-4 font-black text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 border-b-4",
                      wqTab === "scratchpad" 
                        ? "border-[#54361e] text-[#54361e] bg-[#fbf9f4]" 
                        : "border-transparent text-slate-400 hover:text-slate-700 hover:bg-[#ebdcb9]/20"
                    )}
                  >
                    <Pencil className="w-4 h-4" /> ✏️ BẢNG VẼ TỰ ÔN
                  </button>
                </div>

                {/* Tab Content Panel */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col justify-between">
                  {wqTab === "details" ? (
                    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-300 w-full">
                      
                      {/* Detailed Solution Explanation displaying Structured Solution */}
                      <div className="border-t-2 border-dashed border-slate-200 pt-1">
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center">
                            <BookOpen className="w-3.5 h-3.5 text-white" />
                          </div>
                          <p className="text-[11px] font-black text-blue-700 uppercase tracking-wider flex-1">
                            HƯỚNG DẪN LÀM ĐÚNG &amp; MẸO GHI NHỚ
                          </p>
                          {isLoadingSolution ? (
                            <span className="flex items-center gap-1 text-[10px] text-blue-500 font-semibold">
                              <Loader2 className="w-3 h-3 animate-spin" /> AI đang phân tích...
                            </span>
                          ) : (
                            <button
                              onClick={() => handleGenerateSolution(activeWq)}
                              title="Tạo lời giải AI chi tiết"
                              className="flex items-center gap-1 text-[10px] text-purple-600 font-black uppercase tracking-wide bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg hover:bg-purple-100 active:scale-95 transition-all"
                            >
                              <Sparkles className="w-3 h-3" />
                              {activeWq.aiSolution ? 'Tạo lại' : 'Tạo AI'}
                            </button>
                          )}
                        </div>

                        {isLoadingSolution && !activeWq.aiSolution ? (
                          <div className="flex flex-col items-center justify-center py-8 gap-3 bg-blue-50 rounded-2xl border border-blue-100">
                            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                            <p className="text-xs text-blue-500 font-semibold">AI đang soạn lời giải siêu chi tiết cho bé...</p>
                            <p className="text-[10px] text-blue-400">Có thể mất 10-20 giây...</p>
                          </div>
                        ) : activeWq.aiSolution ? (
                          <SolutionDisplay text={activeWq.aiSolution} />
                        ) : solutionError ? (
                          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
                            <p className="text-xs text-orange-700 font-semibold mb-3 text-center">
                              ⚠️ Chưa tạo được lời giải AI. Kiểm tra kết nối mạng và API Key, rồi bấm &quot;Tạo AI&quot;.
                            </p>
                            {activeWq.question.solution && <SolutionDisplay text={activeWq.question.solution} />}
                          </div>
                        ) : activeWq.question.solution ? (
                          <SolutionDisplay text={activeWq.question.solution} />
                        ) : (
                          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
                            <p className="text-xs text-gray-500 font-semibold mb-2">Bấm &quot;Tạo AI&quot; để AI soạn lời giải chi tiết và mẹo siêu đỉnh!</p>
                            <button
                              onClick={() => handleGenerateSolution(activeWq)}
                              className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-black px-4 py-2 rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all"
                            >
                              <Sparkles className="w-3.5 h-3.5" /> Tạo lời giải AI ngay!
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Section 2: Why it is wrong / Hint */}
                      <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-5 shadow-sm space-y-3">
                        <h4 className="text-xs font-black text-rose-800 uppercase tracking-widest">BẪY TOÁN HỌC: BÉ CẦN TRÁNH GÌ?</h4>
                        <p className="text-xs text-rose-950/70 leading-relaxed pl-3 border-l-2 border-rose-300/60 font-medium font-sans">
                          {activeWq.question.hint || "Lưu ý bẫy đề thi: Chú ý thật cẩn thận với giả thiết toán học, không vội vàng phỏng đoán phép tính."}
                        </p>
                      </div>

                      {/* AI Topic Exam 20 Question Button (Action Button) */}
                      <div className="pt-4">
                        <button
                          onClick={() => handleCreateTopicExam(activeWq.question.category || "Chưa phân loại", activeWq.subject, activeWq.grade)}
                          disabled={isGeneratingTopicExam}
                          className={cn(
                            "w-full py-4 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg",
                            isGeneratingTopicExam
                              ? "bg-indigo-450 cursor-not-allowed"
                              : "bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 hover:brightness-110 shadow-indigo-200"
                          )}
                        >
                          {isGeneratingTopicExam && generatingCategoryName === (activeWq.question.category || "")
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> AI đang soạn 20 câu ôn tập...</>
                            : <><Sparkles className="w-4 h-4" /> ĐỀ ÔN DẠNG NÀY — 20 CÂU TƯƠNG TỰ TẠO BẰNG AI</>
                          }
                        </button>
                      </div>

                    </div>
                  ) : (
                    /* Tab 2: Scratchpad */
                    <div className="h-full flex flex-col bg-[#faf7f0] rounded-2xl border-2 border-[#e3dac9] overflow-hidden shadow-inner relative animate-in fade-in duration-300 min-h-[350px] w-full">
                      
                      {/* Control Bar */}
                      <div className="bg-white border-b border-[#e3dac9] px-3.5 py-2.5 flex items-center justify-between flex-wrap gap-2 shrink-0 z-10 shadow-sm">
                        <div className="flex items-center gap-1">
                          {["#dc2626", "#2563eb", "#16a34a", "#1e293b", "#d97706"].map(c => (
                            <button
                              key={c}
                              onClick={() => {
                                setPenSettings(p => ({ ...p, color: c }));
                                setEraserMode(false);
                              }}
                              className={cn(
                                "w-6 h-6 rounded-full border shadow-sm transition-transform active:scale-90",
                                penSettings.color === c && !eraserMode ? "scale-115 ring-2 ring-[#54361e] border-white" : "border-slate-300 hover:scale-105"
                              )}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setEraserMode(false);
                              setPenSettings(p => ({ ...p, style: p.style === "pen" ? "pencil" : "pen" }));
                            }}
                            className={cn(
                              "p-1.5 rounded-lg border text-xs font-black uppercase transition-all duration-150",
                              penSettings.style === "pencil" && !eraserMode 
                                ? "bg-amber-100 text-amber-900 border-[#d4af37]/50" 
                                : "bg-slate-50 text-slate-600 border-slate-200"
                            )}
                          >
                            ✏️ Bút chì
                          </button>
                          <button
                            onClick={() => setEraserMode(!eraserMode)}
                            className={cn(
                              "p-1.5 rounded-lg border text-xs font-black uppercase transition-all duration-150",
                              eraserMode 
                                ? "bg-rose-600 text-white border-rose-500 shadow-sm" 
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            )}
                          >
                            🧹 Tẩy
                          </button>
                          <button onClick={() => canvasRef.current?.undoLast()} className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-650 text-xs font-black active:scale-95 transition-all">
                            ↩ Hoàn tác
                          </button>
                          <button onClick={() => canvasRef.current?.clearAll()} className="p-1.5 rounded-lg border border-red-200 bg-red-50 text-red-650 text-xs font-black active:scale-95 transition-all">
                            🗑 Xóa
                          </button>
                        </div>
                      </div>

                      {/* Lined Canvas Workspace */}
                      <div className="flex-1 relative" style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, #e8dfcc 31px, #e8dfcc 32px)' }}>
                        <DrawingCanvas
                          penSettings={effectivePen}
                          isActive={true}
                          isScratchMode={true}
                          ref={canvasRef}
                          onDataChange={() => {
                            setTimeout(() => saveWrongScratch(), 500);
                          }}
                        />
                      </div>

                      {/* Hint Bar */}
                      <div className="bg-white border-t border-[#e3dac9] px-4 py-2 shrink-0 text-center">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          {eraserMode ? "🧹 Đang bật chế độ tẩy nét vẽ nháp" : "✏️ Dùng chuột / bút cảm ứng để vẽ hoặc nháp tự do lời giải"}
                        </p>
                      </div>

                    </div>
                  )}
                </div>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default MistakesPage;

