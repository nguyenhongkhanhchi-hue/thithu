import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Gamepad2, 
  Search, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Filter, 
  BookOpen, 
  Library, 
  Layers, 
  GraduationCap, 
  Calendar,
  X,
  Sparkles,
  Edit3,
  Bookmark,
  RotateCcw,
  Pencil,
  Eraser,
  Trash,
  Plus,
  Award,
  AlertCircle,
  HelpCircle,
  Check,
  Info,
  Maximize2,
  Minimize2,
  Sparkle,
  BookOpenCheck
} from "lucide-react";
import { getLibraryQuestions, deleteLibraryQuestion, updateExamTitle, getExams } from "@/lib/storage";
import { LibraryQuestion, Exam, PenSettings } from "@/types/exam";
import { toast } from "sonner";
import { SAMPLE_EXAMS } from "@/constants/exams";
import { TextWithFractions } from "@/components/features/FractionDisplay";
import { cn } from "@/lib/utils";
import { useLayout } from "@/contexts/LayoutContext";
import { motion, AnimatePresence } from "framer-motion";
import DrawingCanvas from "@/components/features/DrawingCanvas";

const LibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const { containerClass, gridClass } = useLayout();
  const [questions, setQuestions] = useState<LibraryQuestion[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");

  // Detailed Modal/Folio focus view state
  const [activeQuestion, setActiveQuestion] = useState<LibraryQuestion | null>(null);
  const [activeTab, setActiveTab] = useState<"solution" | "scratchpad">("solution");
  
  // Scratchpad drawing controls inside details folio
  const [penSettings, setPenSettings] = useState<PenSettings>({
    color: "#2563eb",
    size: 5,
    opacity: 1,
    style: "pen"
  });
  const [eraserMode, setEraserMode] = useState(false);
  const canvasRef = useRef<{ clearAll: () => void; undoLast: () => void; getData: () => string; setData: (data: string) => void } | null>(null);

  // Library Shelf Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");

  useEffect(() => {
    loadData();
    setExams(getExams());
  }, []);

  const loadData = () => setQuestions(getLibraryQuestions());

  const handleDelete = (id: string, examId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Bạn có chắc muốn xóa câu hỏi này khỏi Thư Viện?"))
      return;
    deleteLibraryQuestion(id, examId);
    if (activeQuestion?.id === id) {
      setActiveQuestion(null);
    }
    loadData();
    toast.success("✅ Đã gỡ tài liệu khỏi Thư Viện!");
  };

  const handleUpdateExamTitle = (examId: string) => {
    if (SAMPLE_EXAMS.find(e => e.id === examId)) {
      toast.error("Không thể sửa đề mẫu");
      return;
    }
    if (editTitleValue.trim()) {
      updateExamTitle(examId, editTitleValue.trim());
      loadData();
      toast.success("Đã cập nhật tên đề gốc thành công!");
    }
    setEditingExamId(null);
  };

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  // Helper to resolve grade dynamically
  const getQuestionGrade = (q: LibraryQuestion) => {
    const exam = exams.find(e => e.id === q.examId);
    if (exam?.grade) return exam.grade;
    const match = q.examTitle.match(/Lớp \d+/i);
    return match ? match[0] : "Lớp 4";
  };

  const getQuestionTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      multiple_choice: "Trắc nghiệm",
      essay: "Tự luận",
      fill_blank: "Điền khuyết",
      calculation: "Tính toán",
    };
    return map[type] || "Khác";
  };

  const getQuestionTypeIcon = (type: string) => {
    const map: Record<string, string> = {
      multiple_choice: "☑️",
      essay: "✍️",
      fill_blank: "📝",
      calculation: "🧮",
    };
    return map[type] || "❓";
  };

  // Faceted counters
  const getFacetedCount = (type: "subject" | "grade" | "type", value: string) => {
    return questions.filter(q => {
      const grade = getQuestionGrade(q);
      const matchSearch = searchQuery.trim() === "" || 
        q.question.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
        q.examTitle.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchSubject = type === "subject" ? (value === "all" || q.subject === value) : (selectedSubject === "all" || q.subject === selectedSubject);
      const matchGrade = type === "grade" ? (value === "all" || grade === value) : (selectedGrade === "all" || grade === selectedGrade);
      const matchType = type === "type" ? (value === "all" || q.question.type === value) : (selectedType === "all" || q.question.type === selectedType);
      
      return matchSubject && matchGrade && matchType && matchSearch;
    }).length;
  };

  // Get matching shelf color for subject book spines
  const getSubjectShelfColor = (subject: string) => {
    const norm = subject.toLowerCase();
    if (norm.includes("toán")) return {
      bg: "bg-gradient-to-r from-blue-800 via-indigo-900 to-slate-900",
      accent: "border-indigo-400 text-indigo-200",
      ribbon: "bg-indigo-700",
      badge: "bg-indigo-50 border-indigo-200 text-indigo-700"
    };
    if (norm.includes("tiếng việt") || norm.includes("văn")) return {
      bg: "bg-gradient-to-r from-rose-900 via-red-950 to-stone-900",
      accent: "border-rose-400 text-rose-200",
      ribbon: "bg-rose-700",
      badge: "bg-rose-50 border-rose-200 text-rose-700"
    };
    if (norm.includes("tiếng anh") || norm.includes("english")) return {
      bg: "bg-gradient-to-r from-emerald-800 via-teal-950 to-slate-900",
      accent: "border-emerald-400 text-emerald-200",
      ribbon: "bg-emerald-700",
      badge: "bg-emerald-50 border-emerald-200 text-emerald-700"
    };
    return {
      bg: "bg-gradient-to-r from-amber-800 via-amber-950 to-stone-900",
      accent: "border-amber-400 text-amber-200",
      ribbon: "bg-amber-700",
      badge: "bg-amber-50 border-amber-200 text-amber-700"
    };
  };

  // Extract unique categories in database
  const subjects = Array.from(new Set(questions.map(q => q.subject)));
  const grades = Array.from(new Set(questions.map(q => getQuestionGrade(q)))).sort();
  const questionTypes = Array.from(new Set(questions.map(q => q.question.type)));

  // Filtered lists
  const filteredQuestions = questions.filter(q => {
    const grade = getQuestionGrade(q);
    const matchSubject = selectedSubject === "all" || q.subject === selectedSubject;
    const matchGrade = selectedGrade === "all" || grade === selectedGrade;
    const matchType = selectedType === "all" || q.question.type === selectedType;
    const matchSearch = searchQuery.trim() === "" || 
      q.question.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
      q.examTitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSubject && matchGrade && matchType && matchSearch;
  }).sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());

  // Handle opening question details overlay
  const handleOpenDetails = (q: LibraryQuestion) => {
    setActiveQuestion(q);
    setActiveTab("solution");
    setEraserMode(false);
  };

  // Load and save drawings in quick scratchpad
  useEffect(() => {
    if (activeQuestion && activeTab === "scratchpad" && canvasRef.current) {
      const saved = localStorage.getItem(`examtouch_lib_canvas_${activeQuestion.id}`);
      if (saved) {
        // Delay slightly to ensure canvas has resized and is fully initialized
        setTimeout(() => {
          canvasRef.current?.setData(saved);
        }, 100);
      }
    }
  }, [activeQuestion, activeTab]);

  const saveDetailsScratch = () => {
    if (activeQuestion && canvasRef.current) {
      const data = canvasRef.current.getData();
      if (data) {
        localStorage.setItem(`examtouch_lib_canvas_${activeQuestion.id}`, data);
      }
    }
  };

  const handleCloseDetails = () => {
    saveDetailsScratch();
    setActiveQuestion(null);
  };

  const effectivePen: PenSettings = eraserMode
    ? { ...penSettings, color: "#fbf9f4", size: 28, style: "pen", opacity: 1 }
    : penSettings;

  return (
    <div className="min-h-screen bg-[#f3f0e8] text-slate-800 pb-16 relative overflow-hidden" 
         style={{ backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.015) 1px, transparent 1px)", backgroundSize: "20px 20px" }}>
      
      {/* Dynamic Gold Leaf Luxury Border Top */}
      <div className="h-2 bg-gradient-to-r from-amber-800 via-[#d4af37] to-amber-950 shadow-md w-full" />

      {/* Header Banner - Vintage Mahogany Wood Library Style */}
      <div className="bg-gradient-to-b from-[#2e1d11] to-[#1d120a] text-amber-100 py-6 sticky top-0 z-40 shadow-xl border-b-4 border-[#d4af37]/40">
        <div className={`${containerClass} flex items-center justify-between gap-4`}>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate("/")} 
              className="p-3 bg-[#3e291b] hover:bg-[#d4af37]/20 border border-[#d4af37]/30 text-amber-100 hover:text-white rounded-2xl transition-all duration-200 active:scale-95 shadow-[0_2px_10px_rgba(0,0,0,0.2)]"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-black font-heading tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#f7e0a3] via-[#ffebd2] to-[#e4bc75] uppercase flex items-center gap-2" 
                    style={{ fontFamily: "'Baloo 2', cursive" }}>
                  🏛️ THƯ VIỆN CỔ ĐIỂN
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#d4af37]/20 border border-[#d4af37]/40 text-[#f3d997] animate-pulse">
                  <Sparkle className="w-3 h-3 text-[#d4af37]" /> PREMIUM ARCHIVES
                </span>
              </div>
              <p className="text-xs text-amber-200/60 font-serif italic tracking-wide mt-0.5">
                Kho lưu trữ câu hỏi tinh tuyển của Mỹ Linh &bull; Đọc sách khai trí, ôn tập bảng vàng
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate("/game")}
              className="bg-gradient-to-b from-[#d4af37] to-[#b39029] hover:from-[#e7c756] hover:to-[#c6a237] text-amber-950 px-5 py-3 rounded-2xl transition-all duration-300 flex items-center gap-2 font-black text-xs uppercase tracking-widest shadow-lg shadow-amber-500/10 active:scale-95 border border-[#fff2cc]"
            >
              <Gamepad2 className="w-4 h-4 text-amber-950" />
              Chơi ôn luyện
            </button>
          </div>
        </div>
      </div>

      {/* Main Spacious Layout */}
      <div className={`${containerClass} py-8`}>
        {questions.length === 0 ? (
          /* Real Library Empty State */
          <div className="text-center py-24 bg-[#faf6eb] rounded-[36px] border-4 border-double border-[#d4af37]/30 shadow-2xl max-w-3xl mx-auto space-y-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#d4af37]/5 rounded-bl-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#d4af37]/5 rounded-tr-full pointer-events-none" />
            
            <div className="text-8xl animate-bounce duration-1000 select-none">🏛️</div>
            <div className="space-y-3">
              <h3 className="text-3xl font-black text-[#54361e] font-heading uppercase tracking-wide" style={{ fontFamily: "'Baloo 2', cursive" }}>
                Thư viện học liệu trống
              </h3>
              <p className="text-slate-500 text-sm max-w-md mx-auto font-serif italic leading-relaxed px-6">
                "Học vấn như đi thuyền ngược nước, không tiến ắt phải lùi."
                <span className="block mt-2 not-italic text-slate-400 font-medium font-sans">
                  Bé Mỹ Linh hãy làm các đề kiểm tra hữu ích và nhấn nút **"Lưu vào thư viện"** để lưu giữ tư liệu ôn luyện nhé!
                </span>
              </p>
            </div>
            
            <button 
              onClick={() => navigate("/")}
              className="bg-gradient-to-b from-[#5c3e21] to-[#3a220e] hover:from-[#734e2c] hover:to-[#4e3119] text-amber-100 border border-[#d4af37]/40 font-black px-10 py-4 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 uppercase text-xs tracking-widest"
            >
              Chinh phục đề thi ngay
            </button>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            
            {/* LEFT COLUMN: Library Index Directory Bookshelf Sidebar */}
            <div className="w-full lg:w-80 shrink-0 space-y-6 lg:sticky lg:top-28 lg:self-start lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto pr-1">
              
              {/* Wooden Cabinet Header & Search */}
              <div className="bg-gradient-to-b from-[#3a2618] to-[#25170d] rounded-3xl p-6 border-2 border-[#d4af37]/30 shadow-2xl space-y-5 text-amber-100 relative">
                {/* Brass Plate Emblem */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#d4af37] to-[#b39029] text-amber-950 font-black text-[10px] px-4 py-0.5 rounded-full shadow border border-[#ffeed1] uppercase tracking-widest whitespace-nowrap">
                  MỤC LỤC TỦ SÁCH
                </div>

                <div className="flex items-center justify-between pt-2">
                  <h3 className="font-black text-xs text-amber-200 uppercase tracking-widest flex items-center gap-2" style={{ fontFamily: "'Baloo 2', cursive" }}>
                    <Library className="w-4 h-4 text-[#d4af37]" /> PHÂN KHU HỌC LIỆU
                  </h3>
                  {(selectedSubject !== "all" || selectedGrade !== "all" || selectedType !== "all" || searchQuery !== "") && (
                    <button
                      onClick={() => {
                        setSelectedSubject("all");
                        setSelectedGrade("all");
                        setSelectedType("all");
                        setSearchQuery("");
                      }}
                      className="text-[10px] text-red-400 hover:text-red-300 font-extrabold flex items-center gap-1 uppercase tracking-wider active:scale-95 transition-all"
                    >
                      <X className="w-3.5 h-3.5" /> GỠ LỌC
                    </button>
                  )}
                </div>

                {/* Cabinet Drawer Search */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Tìm câu hỏi, đề gốc..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#1b1008] border-2 border-[#d4af37]/20 focus:border-[#d4af37] rounded-2xl pl-10 pr-8 py-3.5 text-xs font-bold text-amber-100 placeholder-amber-200/30 outline-none transition-all"
                  />
                  <Search className="w-4 h-4 text-amber-200/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 text-amber-200/30 hover:text-amber-100 hover:bg-[#321e10] rounded-full transition-all">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Library Ledger Counters */}
                <div className="bg-[#1b1008]/80 border border-[#d4af37]/20 rounded-2xl p-4 space-y-2.5 text-xs relative overflow-hidden">
                  <div className="absolute right-0 bottom-0 text-amber-200/5 font-black text-4xl select-none uppercase tracking-widest pointer-events-none">
                    STATS
                  </div>
                  <p className="text-[10px] font-black text-[#e8c87d] uppercase tracking-wider mb-1 flex items-center gap-1">
                    <BookOpenCheck className="w-3.5 h-3.5 text-[#d4af37]" /> SỔ ĐĂNG KÝ HỌC LIỆU
                  </p>
                  <div className="flex justify-between border-b border-[#d4af37]/10 pb-1.5">
                    <span className="text-amber-200/60 font-serif italic">Đang lọc được:</span>
                    <span className="font-black text-amber-300">{filteredQuestions.length} thẻ</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-200/60 font-serif italic">Tổng kho sách:</span>
                    <span className="font-black text-amber-200">{questions.length} tài liệu</span>
                  </div>
                </div>
              </div>

              {/* SUBJECT SHELVES: Gorgeous Leather-Bound Book Spines */}
              {subjects.length > 0 && (
                <div className="bg-gradient-to-b from-[#3a2618] to-[#2b1c11] rounded-3xl p-5 border-2 border-[#d4af37]/20 shadow-xl space-y-4">
                  <h4 className="text-[11px] font-black text-amber-200/50 uppercase tracking-widest border-b border-amber-200/10 pb-1.5 flex items-center gap-1.5">
                    📚 NGĂN SÁCH MÔN HỌC
                  </h4>
                  <div className="flex flex-col gap-3">
                    {/* All Subjects Book */}
                    <button
                      onClick={() => setSelectedSubject("all")}
                      className={cn(
                        "group relative w-full h-12 flex items-center justify-between px-4 rounded-xl font-black text-xs transition-all duration-300 text-left border-l-[12px] active:scale-[0.98] shadow-md",
                        selectedSubject === "all"
                          ? "bg-gradient-to-r from-amber-700 via-amber-800 to-stone-900 text-amber-100 border-[#d4af37] translate-x-2"
                          : "bg-gradient-to-r from-stone-800 to-stone-900 text-stone-400 border-stone-600 hover:text-amber-200 hover:translate-x-1.5"
                      )}
                    >
                      {/* Book spine horizontal ribs */}
                      <div className="absolute inset-y-0 left-0 w-[2px] bg-black/30" />
                      <span className="font-serif italic tracking-wide flex items-center gap-2">
                        📖 Tất Cả Môn
                      </span>
                      <span className={cn(
                        "text-[9px] px-2 py-0.5 rounded-md font-black shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] border border-black/20",
                        selectedSubject === "all" ? "bg-amber-600/30 text-amber-200" : "bg-stone-700 text-stone-400"
                      )}>
                        {getFacetedCount("subject", "all")}
                      </span>
                    </button>

                    {/* Dynamic Subjects Book Spines */}
                    {subjects.map(s => {
                      const active = selectedSubject === s;
                      const count = getFacetedCount("subject", s);
                      const colors = getSubjectShelfColor(s);
                      
                      return (
                        <button
                          key={s}
                          onClick={() => setSelectedSubject(s)}
                          className={cn(
                            "group relative w-full h-12 flex items-center justify-between px-4 rounded-xl font-black text-xs transition-all duration-300 text-left border-l-[12px] active:scale-[0.98] shadow-md",
                            active
                              ? `${colors.bg} text-amber-100 border-[#d4af37] translate-x-2 ring-1 ring-amber-500/30`
                              : "bg-gradient-to-r from-stone-800 to-stone-900 text-stone-400 border-stone-600 hover:text-amber-200 hover:translate-x-1.5"
                          )}
                        >
                          <div className="absolute inset-y-0 left-0 w-[2px] bg-black/30" />
                          <span className="font-serif italic tracking-wide truncate pr-2">
                            🔖 {s}
                          </span>
                          <span className={cn(
                            "text-[9px] px-2 py-0.5 rounded-md font-black shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] border border-black/20 shrink-0",
                            active ? "bg-amber-600/30 text-amber-200" : "bg-stone-700 text-stone-400"
                          )}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* GRADE SHELVES: Classic Catalog Drawer Pull-out Plates */}
              {grades.length > 0 && (
                <div className="bg-gradient-to-b from-[#3a2618] to-[#2b1c11] rounded-3xl p-5 border-2 border-[#d4af37]/20 shadow-xl space-y-4">
                  <h4 className="text-[11px] font-black text-amber-200/50 uppercase tracking-widest border-b border-amber-200/10 pb-1.5 flex items-center gap-1.5">
                    🎓 HỘC TỦ LỚP HỌC
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedGrade("all")}
                      className={cn(
                        "px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all duration-300 border-2 flex items-center gap-1.5 active:scale-[0.96] shadow-sm",
                        selectedGrade === "all"
                          ? "bg-gradient-to-b from-amber-600 to-amber-700 text-amber-950 border-[#d4af37]"
                          : "bg-[#1b1008] text-amber-200/60 border-[#d4af37]/20 hover:border-[#d4af37]/50"
                      )}
                    >
                      Tất cả lớp
                      <span className={cn("text-[9px] px-1.5 py-0.5 rounded-md font-bold shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]", selectedGrade === "all" ? "bg-amber-950/20 text-amber-950" : "bg-stone-800 text-amber-300/60")}>
                        {getFacetedCount("grade", "all")}
                      </span>
                    </button>
                    {grades.map(g => {
                      const active = selectedGrade === g;
                      const count = getFacetedCount("grade", g);
                      return (
                        <button
                          key={g}
                          onClick={() => setSelectedGrade(g)}
                          className={cn(
                            "px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all duration-300 border-2 flex items-center gap-1.5 active:scale-[0.96] shadow-sm",
                            active
                              ? "bg-gradient-to-b from-amber-600 to-amber-700 text-amber-950 border-[#d4af37]"
                              : "bg-[#1b1008] text-amber-200/60 border-[#d4af37]/20 hover:border-[#d4af37]/50"
                          )}
                        >
                          {g}
                          <span className={cn("text-[9px] px-1.5 py-0.5 rounded-md font-bold shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]", active ? "bg-amber-950/20 text-amber-950" : "bg-stone-800 text-amber-300/60")}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TYPE SHELVES */}
              {questionTypes.length > 0 && (
                <div className="bg-gradient-to-b from-[#3a2618] to-[#2b1c11] rounded-3xl p-5 border-2 border-[#d4af37]/20 shadow-xl space-y-4">
                  <h4 className="text-[11px] font-black text-amber-200/50 uppercase tracking-widest border-b border-amber-200/10 pb-1.5 flex items-center gap-1.5">
                    📋 THỂ LOẠI TÀI LIỆU
                  </h4>
                  <div className="flex flex-col gap-2.5">
                    <button
                      onClick={() => setSelectedType("all")}
                      className={cn(
                        "flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-black transition-all duration-300 border-2 text-left active:scale-[0.98] shadow-sm",
                        selectedType === "all"
                          ? "bg-gradient-to-b from-amber-600 to-amber-700 text-amber-950 border-[#d4af37]"
                          : "bg-[#1b1008] text-amber-200/60 border-[#d4af37]/20 hover:border-[#d4af37]/50 hover:text-amber-100"
                      )}
                    >
                      <span>📋 Tất cả loại</span>
                      <span className={cn("text-[9px] px-2 py-0.5 rounded-md font-bold shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]", selectedType === "all" ? "bg-amber-950/20 text-amber-950" : "bg-stone-800 text-amber-300/60")}>
                        {getFacetedCount("type", "all")}
                      </span>
                    </button>
                    {questionTypes.map(t => {
                      const active = selectedType === t;
                      const count = getFacetedCount("type", t);
                      return (
                        <button
                          key={t}
                          onClick={() => setSelectedType(t)}
                          className={cn(
                            "flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-black transition-all duration-300 border-2 text-left active:scale-[0.98] shadow-sm",
                            active
                              ? "bg-gradient-to-b from-amber-600 to-amber-700 text-amber-950 border-[#d4af37]"
                              : "bg-[#1b1008] text-amber-200/60 border-[#d4af37]/20 hover:border-[#d4af37]/50 hover:text-amber-100"
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <span>{getQuestionTypeIcon(t)}</span>
                            <span>{getQuestionTypeLabel(t)}</span>
                          </span>
                          <span className={cn("text-[9px] px-2 py-0.5 rounded-md font-bold shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]", active ? "bg-amber-950/20 text-amber-950" : "bg-stone-800 text-amber-300/60")}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            
            {/* RIGHT COLUMN: Question Library Catalog Index Cards Grid */}
            <div className="flex-1">
              {filteredQuestions.length === 0 ? (
                <div className="text-center py-24 bg-[#faf6eb] rounded-[36px] border-4 border-double border-[#d4af37]/20 shadow-xl">
                  <span className="text-7xl block mb-6 select-none animate-pulse">📚</span>
                  <p className="text-[#54361e] font-black text-lg font-serif italic">Không tìm thấy tài liệu phù hợp</p>
                  <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto font-sans font-medium px-4">
                    Anh hãy đổi ngăn kéo phân khu học liệu hoặc xóa bớt từ khóa tìm kiếm để thủ thư tìm lại giúp nhé!
                  </p>
                </div>
              ) : (
                <div className={`${gridClass} animate-in fade-in duration-300`}>
                  {filteredQuestions.map((q) => {
                    const grade = getQuestionGrade(q);
                    const typeLabel = getQuestionTypeLabel(q.question.type);
                    const typeIcon = getQuestionTypeIcon(q.question.type);
                    const isExpanded = expandedIds.has(q.id);
                    const shelfColor = getSubjectShelfColor(q.subject);

                    return (
                      <div 
                        key={`${q.examId}-${q.id}`} 
                        onClick={() => handleOpenDetails(q)}
                        className="bg-[#faf6eb] rounded-[24px] border-2 border-[#d8d2c4] overflow-hidden shadow-[3px_3px_10px_rgba(58,38,24,0.06)] hover:shadow-[8px_8px_20px_rgba(58,38,24,0.12)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between cursor-pointer relative group"
                      >
                        {/* Spindle hole punch at the bottom simulating real library drawer catalog card */}
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#f3f0e8] border-2 border-[#d8d2c4] shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] z-10 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        </div>

                        <div>
                          {/* Library Stitched Strip Header */}
                          <div className="bg-gradient-to-r from-[#fbf9f4] to-[#f4ecd8] border-b-2 border-dashed border-[#e6dec9] px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn("text-[9px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-widest shadow-sm border", shelfColor.badge)}>
                                {q.subject}
                              </span>
                              <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[9px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                                {grade}
                              </span>
                              <span className="bg-purple-50 border border-purple-200 text-purple-800 text-[9px] font-black px-2.5 py-0.5 rounded-md flex items-center gap-1 uppercase tracking-wider">
                                <span>{typeIcon}</span> {typeLabel}
                              </span>
                            </div>
                            
                            <button 
                              onClick={(e) => handleDelete(q.id, q.examId, e)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 active:scale-90"
                              title="Gỡ khỏi thư viện"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Index Card Body */}
                          <div className="p-5 space-y-4 pb-8">
                            {/* Source and Saved date indicators */}
                            <div className="flex items-center justify-between gap-4 flex-wrap border-b border-dashed border-[#e6dec9] pb-3">
                              
                              {/* Source */}
                              <div className="flex items-center gap-1.5 min-w-0" onClick={(e) => e.stopPropagation()}>
                                <span className="text-[10px] font-bold text-slate-400 shrink-0 font-serif italic">Đề nguồn:</span>
                                {editingExamId === q.examId ? (
                                  <input
                                    autoFocus
                                    value={editTitleValue}
                                    onChange={(e) => setEditTitleValue(e.target.value)}
                                    onBlur={() => handleUpdateExamTitle(q.examId)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleUpdateExamTitle(q.examId)}
                                    className="text-[10px] font-black text-slate-700 border-b-2 border-amber-600 outline-none bg-amber-100/50 px-2 py-0.5 rounded"
                                  />
                                ) : (
                                  <span 
                                    onClick={() => {
                                      if (!SAMPLE_EXAMS.find(ex => ex.id === q.examId)) {
                                        setEditingExamId(q.examId);
                                        setEditTitleValue(q.examTitle);
                                      }
                                    }}
                                    className="text-[10px] font-black text-amber-800 truncate hover:text-[#b39029] cursor-pointer flex items-center gap-1 hover:underline"
                                    title="Nhấp vào để đổi tên đề thi"
                                  >
                                    📖 {q.examTitle} ✏️
                                  </span>
                                )}
                              </div>

                              {/* Date Saved */}
                              <div className="text-[9px] text-slate-400 font-extrabold flex items-center gap-1 uppercase tracking-wider shrink-0">
                                <Calendar className="w-3.5 h-3.5 text-slate-300" />
                                Lưu: {new Date(q.savedAt).toLocaleDateString('vi-VN')}
                              </div>
                            </div>

                            {/* Question content - shown in full with TextWithFractions */}
                            <div className="text-[#362f28] font-serif text-[15px] leading-relaxed whitespace-pre-line border-l-2 border-red-200/50 pl-3">
                              <span className="text-blue-600 font-black mr-1">Câu hỏi:</span>
                              <TextWithFractions text={q.question.text} />
                            </div>

                            {/* Card Footer badges */}
                            <div className="pt-4 mt-4 border-t border-dashed border-[#e6dec9] flex items-center justify-between">
                              <span className="text-[9px] text-[#8c7c6a] font-serif italic uppercase">Nhấp xem chi tiết &amp; vẽ nháp</span>
                              <span className="bg-amber-100 text-amber-850 border border-amber-250 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full">
                                🏛️ Xem hồ sơ
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Gold Bookmark Ribbon Overlay at Corner */}
                        <div className={cn("absolute top-0 right-8 w-6 h-8 shadow-sm flex items-end justify-center rounded-b-md text-[10px] font-bold text-white", shelfColor.ribbon)}>
                          <Bookmark className="w-3 h-3 text-white/50 mb-1" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* FULL-SCREEN VINTAGE ARCHIVAL FOLIO DETAIL OVERLAY (Trang hồ sơ chi tiết tiêu điểm) */}
      <AnimatePresence>
        {activeQuestion && (
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
                    <div key={i} className="h-6 w-10 -ml-1 bg-gradient-to-r from-silver via-[#b0b0b0] to-[#505050] rounded-full border border-black/40 shadow-md self-center" 
                         style={{ backgroundImage: "linear-gradient(to right, #9e9e9e, #d6d6d6, #595959)" }}/>
                  ))}
                </div>
              </div>

              {/* Close Button - Styled as a vintage Wax Seal */}
              <button 
                onClick={handleCloseDetails}
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
                        HỒ SƠ HỌC LIỆU #{activeQuestion.id.slice(0, 6).toUpperCase()}
                      </span>
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                        Lưu trữ tiêu điểm
                      </span>
                    </div>
                    <h2 className="text-xl font-bold font-serif text-[#3e291b] mt-1">
                      📖 Đề gốc: {activeQuestion.examTitle}
                    </h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1.5 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Ngày lưu hồ sơ: {new Date(activeQuestion.savedAt).toLocaleString('vi-VN')}
                    </p>
                  </div>

                  {/* Question Content (Lined paper spacing look) */}
                  <div className="space-y-4">
                    <span className="bg-[#b39029] text-amber-950 text-[10px] font-black px-3 py-1 rounded-md uppercase tracking-wider">
                      CÂU HỎI &bull; {getQuestionTypeLabel(activeQuestion.question.type)}
                    </span>
                    <div className="text-[#2c221a] font-serif text-[17px] leading-relaxed whitespace-pre-line pl-3 border-l-4 border-[#d4af37]/40 py-1">
                      <TextWithFractions text={activeQuestion.question.text} />
                    </div>
                  </div>

                  {/* Illustration SVG */}
                  {activeQuestion.question.illustrationSvg && (
                    <div className="bg-white border-2 border-[#e6dec9] rounded-2xl p-4 flex justify-center shadow-md">
                      <div dangerouslySetInnerHTML={{ __html: activeQuestion.question.illustrationSvg }} className="max-w-full" />
                    </div>
                  )}

                  {/* Choices for Multiple Choice */}
                  {activeQuestion.question.choices && activeQuestion.question.choices.length > 0 && (
                    <div className="space-y-2.5 pt-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CÁC PHƯƠNG ÁN ĐỒNG THỜI:</p>
                      <div className="grid grid-cols-1 gap-2.5">
                        {activeQuestion.question.choices.map(c => {
                          const isCorrect = c.id === activeQuestion.question.correctAnswer;
                          return (
                            <div 
                              key={c.id} 
                              className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-bold transition-all shadow-sm",
                                isCorrect 
                                  ? "bg-[#edfbf1] border-emerald-400 text-emerald-800" 
                                  : "bg-white border-[#e3dac9] text-slate-600"
                              )}
                            >
                              <span className={cn(
                                "w-6.5 h-6.5 rounded-full flex items-center justify-center font-black text-[11px] shrink-0 border-2 shadow-sm",
                                isCorrect ? "bg-emerald-600 text-white border-emerald-500" : "bg-slate-100 text-slate-600 border-slate-200"
                              )}>
                                {c.id}
                              </span>
                              <span className="font-serif text-[14px]"><TextWithFractions text={c.text} /></span>
                              {isCorrect && <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-800 font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest">Đáp án đúng</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Stamp of Certification */}
                  <div className="flex justify-end pt-6 opacity-30 select-none">
                    <div className="border-4 border-dashed border-[#800020] text-[#800020] font-black text-sm tracking-widest px-4 py-2 rounded-xl uppercase rotate-12">
                      🏛️ ĐÃ LƯU KHO
                    </div>
                  </div>

                </div>
              </div>

              {/* RIGHT SIDE: Interactive Knowledge Folio & Canvas Drawing (50% on desktop) */}
              <div className="w-full md:w-1/2 h-1/2 md:h-full flex flex-col bg-[#fbf9f4] relative z-10">
                
                {/* Tabs Bar - Premium Bookmark Ribbons */}
                <div className="flex bg-[#ebdcb9]/40 border-b border-[#e3dac9] shrink-0">
                  <button
                    onClick={() => {
                      saveDetailsScratch();
                      setActiveTab("solution");
                    }}
                    className={cn(
                      "flex-1 py-4 font-black text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 border-b-4",
                      activeTab === "solution" 
                        ? "border-[#54361e] text-[#54361e] bg-[#fbf9f4]" 
                        : "border-transparent text-slate-400 hover:text-slate-700 hover:bg-[#ebdcb9]/20"
                    )}
                  >
                    <BookOpen className="w-4 h-4" /> 📖 CẨM NANG LỜI GIẢI
                  </button>
                  <button
                    onClick={() => setActiveTab("scratchpad")}
                    className={cn(
                      "flex-1 py-4 font-black text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 border-b-4",
                      activeTab === "scratchpad" 
                        ? "border-[#54361e] text-[#54361e] bg-[#fbf9f4]" 
                        : "border-transparent text-slate-400 hover:text-slate-700 hover:bg-[#ebdcb9]/20"
                    )}
                  >
                    <Pencil className="w-4 h-4" /> ✏️ BẢNG VẼ NHÁP
                  </button>
                </div>

                {/* Tab Content Panel */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                  {activeTab === "solution" ? (
                    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-300">
                      
                      {/* Section 1: Detailed Solution */}
                      <div className="bg-[#faf6eb] border-2 border-[#e3dac9] rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
                        <div className="absolute right-0 top-0 w-2 h-full bg-[#d4af37]" />
                        <h4 className="text-xs font-black text-amber-800 uppercase tracking-widest flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-600" /> PHƯƠNG PHÁP TƯ DUY & LỜI GIẢI CHI TIẾT
                        </h4>
                        <div className="text-sm text-slate-700 leading-relaxed font-serif whitespace-pre-line border-l-2 border-amber-300/30 pl-4 py-0.5">
                          <TextWithFractions text={activeQuestion.question.solution || "Chưa có lời giải chi tiết cho câu hỏi này."} />
                        </div>
                      </div>

                      {/* Section 2: Why it is wrong (Common Pitfalls) */}
                      <div className="bg-rose-50/50 border-2 border-rose-200/60 rounded-2xl p-5 shadow-sm space-y-3">
                        <h4 className="text-xs font-black text-rose-800 uppercase tracking-widest flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-rose-600" /> PHÂN TÍCH CẠN KẼ: VÌ SAO BÉ DỄ SAI?
                        </h4>
                        <div className="text-xs text-rose-950/70 font-sans leading-relaxed pl-3 border-l-2 border-rose-300/60 py-0.5">
                          {activeQuestion.question.hint ? (
                            <p>{activeQuestion.question.hint}</p>
                          ) : (
                            <p className="italic">Ghi chú bẫy: Cần quan sát thật kỹ đề bài, tính toán cẩn thận từng bước, tránh nhầm lẫn các đơn vị hoặc lật ngược đáp án.</p>
                          )}
                        </div>
                      </div>

                      {/* Section 3: Gold Crest Memory Tip Badge */}
                      <div className="bg-amber-50 border border-amber-300/50 rounded-2xl p-4 flex gap-3.5 items-start">
                        <div className="p-2.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-800 shrink-0">
                          <Award className="w-5 h-5" />
                        </div>
                        <div>
                          <h5 className="text-xs font-black text-[#54361e] uppercase tracking-wider">MẸO GHI NHỚ VÀNG</h5>
                          <p className="text-xs text-[#6e5845] font-serif italic leading-relaxed mt-1">
                            "Muốn làm nhanh và đúng, bé hãy phác thảo sơ đồ ra giấy nháp trước, sau đó đối chiếu các đáp án kỹ lưỡng để loại trừ nhanh!"
                          </p>
                        </div>
                      </div>

                    </div>
                  ) : (
                    /* Tab 2: Canvas Scratchpad Workspace */
                    <div className="h-full flex flex-col bg-[#faf7f0] rounded-2xl border-2 border-[#e3dac9] overflow-hidden shadow-inner relative animate-in fade-in duration-300">
                      
                      {/* Top Drawing Control Bar */}
                      <div className="bg-white border-b border-[#e3dac9] px-3.5 py-2.5 flex items-center justify-between flex-wrap gap-2 shrink-0 z-10 shadow-sm">
                        <div className="flex items-center gap-1">
                          {/* Color Selectors */}
                          {["#2563eb", "#dc2626", "#16a34a", "#1e293b", "#d97706"].map(c => (
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
                          {/* Brush Style Selector */}
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
                            title="Nét bút chì mềm"
                          >
                            ✏️ Bút chì
                          </button>

                          {/* Eraser Button */}
                          <button
                            onClick={() => setEraserMode(!eraserMode)}
                            className={cn(
                              "p-1.5 rounded-lg border text-xs font-black uppercase transition-all duration-150",
                              eraserMode 
                                ? "bg-rose-600 text-white border-rose-500 shadow-sm" 
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            )}
                            title="Tẩy nét vẽ"
                          >
                            🧹 Tẩy
                          </button>

                          {/* Undo last stroke */}
                          <button
                            onClick={() => canvasRef.current?.undoLast()}
                            className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 text-xs font-black active:scale-95 transition-all"
                            title="Lùi nét vừa vẽ"
                          >
                            ↩ Hoàn tác
                          </button>

                          {/* Clear all */}
                          <button
                            onClick={() => canvasRef.current?.clearAll()}
                            className="p-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-black active:scale-95 transition-all"
                            title="Xóa hết bản nháp"
                          >
                            🗑 Xóa
                          </button>
                        </div>
                      </div>

                      {/* Canvas Area with school notebook row grids */}
                      <div className="flex-1 relative"
                           style={{
                             backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, #e8dfcc 31px, #e8dfcc 32px)',
                           }}>
                        <DrawingCanvas
                          penSettings={effectivePen}
                          isActive={true}
                          isScratchMode={true}
                          ref={canvasRef}
                          onDataChange={() => {
                            // Automatically save layout canvas to cache
                            setTimeout(() => saveDetailsScratch(), 500);
                          }}
                        />
                      </div>

                      {/* Canvas Hint */}
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

export default LibraryPage;
