import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Search, Filter, Trash2, X, Brain, Library, LayoutGrid, List, Clock, BookOpen, Play, Sparkles, Map, MapPin, Trophy, Shield, Star, Castle, Medal, Wand2
} from "lucide-react";
import { Exam, DIFFICULTY_INFO, ExamStats, ExamSession } from "@/types/exam";
import { getExams, deleteExam, setSourceExam, getExamStatsFixed, updateExamTitle, saveExam, getSessions } from "@/lib/storage";
import { getCreditsRemaining } from "@/lib/gemini";
import { SAMPLE_EXAMS, SUBJECTS, ALL_GRADES } from "@/constants/exams";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLayout } from "@/contexts/LayoutContext";
import { motion, AnimatePresence } from "framer-motion";

const ExamsPage: React.FC = () => {
  const navigate = useNavigate();
  const { containerClass, gridClass } = useLayout();
  const [exams, setExams] = useState<Exam[]>([]);
  const [aiCredits, setAiCredits] = useState<number>(0);

  const [layoutMode, setLayoutMode] = useState<"grid" | "list">(() => {
    return (localStorage.getItem("methi_exams_layout") as "grid" | "list") || "grid";
  });

  const [subjectFilter, setSubjectFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExamHistory, setSelectedExamHistory] = useState<string | null>(null);
  const [activeExam, setActiveExam] = useState<Exam | null>(null);

  useEffect(() => {
    setExams(getExams());
    setAiCredits(getCreditsRemaining());
  }, []);

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (SAMPLE_EXAMS.find((e) => e.id === id)) return;
    if (!window.confirm("Bé có chắc chắn muốn xóa cuộn giấy phép thuật này?")) return;
    deleteExam(id);
    if (activeExam?.id === id) setActiveExam(null);
    setExams(getExams());
    toast.success("❌ Đã xóa cuộn giấy phép thuật!");
  };

  const handleUpdateTitle = (id: string, newTitle: string) => {
    if (SAMPLE_EXAMS.find((e) => e.id === id)) return;
    updateExamTitle(id, newTitle);
    setExams(getExams());
    toast.success("✏️ Đã cập nhật tên phép thuật mới!");
  };

  const handleToggleSource = (id: string, current: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    setSourceExam(id, !current);
    setExams(getExams());
    toast.success(!current ? "📌 Đã đánh dấu cuộn bí kíp làm nguồn tạo AI!" : "🔓 Đã bỏ đánh dấu cuộn bí kíp!");
  };

  const handleSaveToLibrary = (exam: Exam, e: React.MouseEvent) => {
    e.stopPropagation();
    saveExam(exam);
    toast.success("✅ Đã cất toàn bộ vào rương Thư Viện!");
  };

  const handleLayoutChange = (mode: "grid" | "list") => {
    setLayoutMode(mode);
    localStorage.setItem("methi_exams_layout", mode);
  };

  const getFacetedCount = (type: "subject" | "grade" | "difficulty", value: string) => {
    return exams.filter((e) => {
      const matchSearch = searchQuery.trim() === "" || e.title.toLowerCase().includes(searchQuery.toLowerCase()) || e.subject.toLowerCase().includes(searchQuery.toLowerCase());
      const matchSubject = type === "subject" ? (value === "all" || e.subject === value) : (subjectFilter === "all" || e.subject === subjectFilter);
      const matchGrade = type === "grade" ? (value === "all" || e.grade === value) : (gradeFilter === "all" || e.grade === gradeFilter);
      const matchDifficulty = type === "difficulty" ? (value === "all" || e.difficulty === value) : (difficultyFilter === "all" || e.difficulty === difficultyFilter);
      return matchSubject && matchGrade && matchDifficulty && matchSearch;
    }).length;
  };

  const filteredExams = exams.filter(e => {
    const matchSubject = subjectFilter === "all" || e.subject === subjectFilter;
    const matchGrade = gradeFilter === "all" || e.grade === gradeFilter;
    const matchDifficulty = difficultyFilter === "all" || e.difficulty === difficultyFilter;
    const matchSearch = searchQuery.trim() === "" || e.title.toLowerCase().includes(searchQuery.toLowerCase()) || e.subject.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSubject && matchGrade && matchDifficulty && matchSearch;
  }).sort((a, b) => {
    const la = a.difficulty ? DIFFICULTY_INFO[a.difficulty].level : 99;
    const lb = b.difficulty ? DIFFICULTY_INFO[b.difficulty].level : 99;
    if (la !== lb) return la - lb;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="min-h-screen bg-[#faf8f5] text-slate-800 pb-16 font-sans">
      
      {/* Gamified Magical Child-Friendly Header */}
      <div className="bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600 text-white py-5 sticky top-0 z-40 shadow-xl border-b-4 border-yellow-300/40">
        <div className={`${containerClass} flex items-center justify-between gap-4`}>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/")} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all active:scale-90 border border-white/20 shadow-md">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-wider uppercase flex items-center gap-2" style={{ fontFamily: "'Baloo 2', cursive" }}>
                🏰 THƯ VIỆN ĐỀ THI PHÉP THUẬT
              </h1>
              <p className="text-blue-100 text-xs font-serif italic tracking-wide mt-0.5">
                Nơi lưu trữ bí kíp võ công &bull; Sẵn sàng cho mọi thử thách!
              </p>
            </div>
          </div>
          <button 
            onClick={() => navigate("/ai-create")}
            className="bg-amber-400 hover:bg-amber-500 text-amber-950 px-4 py-2.5 rounded-2xl font-black text-xs shadow-lg flex items-center gap-1.5 shrink-0 border border-white animate-pulse transition-all active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-amber-950" />
            <span className="hidden sm:inline">TẠO ĐỀ BẰNG PHÉP THUẬT</span>
            <span className="sm:hidden">TẠO ĐỀ AI</span>
            ({aiCredits} ⚡)
          </button>
        </div>
      </div>

      <div className={`${containerClass} py-8 space-y-8`}>
        
        {/* Child-Friendly RPG dialogue bubble */}
        <div className="bg-gradient-to-r from-blue-100 via-indigo-50 to-purple-100 border-2 border-blue-300 rounded-[32px] p-6 shadow-md flex items-center gap-4 relative overflow-hidden animate-in fade-in duration-300">
          <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 text-blue-500/10 text-9xl font-black select-none pointer-events-none">✨</div>
          <div className="text-4xl select-none animate-bounce shrink-0">🧙‍♂️📚</div>
          <div className="space-y-1 z-10">
            <h4 className="font-black text-blue-900 text-xs uppercase tracking-wider">CHÀO MỪNG ĐẾN THƯ VIỆN PHÉP THUẬT!</h4>
            <p className="text-xs text-blue-800 font-medium leading-relaxed font-serif italic">
              "Chào mừng Hiệp sĩ Mỹ Linh! Nơi đây chứa đựng hàng trăm cuộn giấy bí kíp giúp con rèn luyện trí tuệ. Hãy chọn một cuộn giấy, thi triển phép thuật giải toán và giành thật nhiều cúp vàng nhé!"
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* LEFT COLUMN: Sticky Filter Sidebar (Magical Scroll Map) */}
          <div className="w-full lg:w-80 shrink-0 space-y-6 lg:sticky lg:top-32 lg:self-start lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto pr-1 custom-scrollbar">
            
            {/* Header & Reset */}
            <div className="bg-[#faf6eb] rounded-3xl p-5 border-2 border-[#d8d2c4] shadow-sm space-y-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 text-5xl opacity-[0.05] pointer-events-none">🗺️</div>
              <div className="flex items-center justify-between relative z-10">
                <h3 className="font-black text-xs text-amber-900 uppercase tracking-widest flex items-center gap-2" style={{ fontFamily: "'Baloo 2', cursive" }}>
                  <Map className="w-4 h-4 text-amber-600" /> BẢN ĐỒ TÌM KIẾM
                </h3>
                {(subjectFilter !== "all" || gradeFilter !== "all" || difficultyFilter !== "all" || searchQuery !== "") && (
                  <button
                    onClick={() => {
                      setSubjectFilter("all");
                      setGradeFilter("all");
                      setDifficultyFilter("all");
                      setSearchQuery("");
                    }}
                    className="text-[10px] text-red-500 hover:text-red-600 font-extrabold flex items-center gap-1 uppercase tracking-wider active:scale-95 transition-all bg-red-50 px-2 py-1 rounded-lg border border-red-200"
                  >
                    <X className="w-3 h-3" /> Xóa tìm kiếm
                  </button>
                )}
              </div>

              {/* Text Search */}
              <div className="relative z-10">
                <input
                  type="text"
                  placeholder="Tìm thần chú, tên bí kíp..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border-2 border-[#e6dec9] focus:border-amber-400 focus:bg-amber-50 rounded-2xl pl-10 pr-8 py-3.5 text-xs font-bold text-slate-700 outline-none transition-all placeholder:text-slate-400 shadow-inner"
                />
                <Search className="w-4 h-4 text-amber-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:bg-slate-200 rounded-full transition-all">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Stats overview */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between shadow-inner relative z-10">
                <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" /> Số bí kíp
                </span>
                <span className="text-xs font-black text-amber-900 bg-amber-200 px-3 py-1 rounded-xl shadow-sm border border-amber-300">
                  {filteredExams.length} / {exams.length}
                </span>
              </div>
            </div>

            {/* SUBJECT FILTER */}
            <div className="bg-white rounded-3xl p-5 border-2 border-purple-100 shadow-sm space-y-3 relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 text-6xl opacity-[0.03] pointer-events-none">📚</div>
              <h4 className="text-[11px] font-black text-purple-400 uppercase tracking-widest relative z-10">📚 Kệ Sách Phép Thuật</h4>
              <div className="flex flex-col gap-1.5 relative z-10">
                <button
                  onClick={() => setSubjectFilter("all")}
                  className={cn(
                    "flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-black transition-all border-2 text-left active:scale-[0.98]",
                    subjectFilter === "all"
                      ? "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20"
                      : "bg-purple-50/50 text-slate-600 border-transparent hover:border-purple-200 hover:bg-purple-50"
                  )}
                >
                  <span>📚 Tất cả bí kíp</span>
                  <span className={cn("text-[9px] px-2 py-0.5 rounded-md font-bold shadow-inner", subjectFilter === "all" ? "bg-white/20 text-white" : "bg-purple-100 text-purple-700")}>
                    {getFacetedCount("subject", "all")}
                  </span>
                </button>
                {SUBJECTS.map(s => {
                  const active = subjectFilter === s.label;
                  const count = getFacetedCount("subject", s.label);
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSubjectFilter(s.label)}
                      className={cn(
                        "flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-black transition-all border-2 text-left active:scale-[0.98]",
                        active
                          ? "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20"
                          : "bg-purple-50/50 text-slate-600 border-transparent hover:border-purple-200 hover:bg-purple-50"
                      )}
                    >
                      <span className="flex items-center gap-2"><span className="text-sm">{s.icon}</span> {s.label}</span>
                      <span className={cn("text-[9px] px-2 py-0.5 rounded-md font-bold shadow-inner", active ? "bg-white/20 text-white" : "bg-purple-100 text-purple-700")}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* GRADE FILTER */}
            <div className="bg-white rounded-3xl p-5 border-2 border-emerald-100 shadow-sm space-y-3 relative overflow-hidden">
               <div className="absolute -right-4 -bottom-4 text-6xl opacity-[0.03] pointer-events-none">🎓</div>
              <h4 className="text-[11px] font-black text-emerald-500/70 uppercase tracking-widest relative z-10">🎓 Trại Huấn Luyện</h4>
              <div className="flex flex-wrap gap-2 relative z-10">
                <button
                  onClick={() => setGradeFilter("all")}
                  className={cn(
                    "px-3.5 py-2.5 rounded-xl text-xs font-black transition-all border-2 flex items-center gap-1.5 active:scale-[0.96]",
                    gradeFilter === "all"
                      ? "bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20"
                      : "bg-emerald-50/50 text-slate-600 border-transparent hover:border-emerald-200 hover:bg-emerald-50"
                  )}
                >
                  🎓 Tất cả
                  <span className={cn("text-[9px] px-1.5 py-0.5 rounded-md font-bold shadow-inner", gradeFilter === "all" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700")}>
                    {getFacetedCount("grade", "all")}
                  </span>
                </button>
                {ALL_GRADES.map(g => {
                  const active = gradeFilter === g;
                  const count = getFacetedCount("grade", g);
                  return (
                    <button
                      key={g}
                      onClick={() => setGradeFilter(g)}
                      className={cn(
                        "px-3.5 py-2.5 rounded-xl text-xs font-black transition-all border-2 flex items-center gap-1.5 active:scale-[0.96]",
                        active
                          ? "bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20"
                          : "bg-emerald-50/50 text-slate-600 border-transparent hover:border-emerald-200 hover:bg-emerald-50"
                      )}
                    >
                      {g}
                      <span className={cn("text-[9px] px-1.5 py-0.5 rounded-md font-bold shadow-inner", active ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700")}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* DIFFICULTY FILTER */}
            <div className="bg-white rounded-3xl p-5 border-2 border-orange-100 shadow-sm space-y-3 relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 text-6xl opacity-[0.03] pointer-events-none">🔥</div>
              <h4 className="text-[11px] font-black text-orange-400 uppercase tracking-widest relative z-10">⚔️ Mức Độ Thử Thách</h4>
              <div className="flex flex-col gap-1.5 relative z-10">
                <button
                  onClick={() => setDifficultyFilter("all")}
                  className={cn(
                    "flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-black transition-all border-2 text-left active:scale-[0.98]",
                    difficultyFilter === "all"
                      ? "bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20"
                      : "bg-orange-50/50 text-slate-600 border-transparent hover:border-orange-200 hover:bg-orange-50"
                  )}
                >
                  <span>⚔️ Mọi cấp độ</span>
                  <span className={cn("text-[9px] px-2 py-0.5 rounded-md font-bold shadow-inner", difficultyFilter === "all" ? "bg-white/20 text-white" : "bg-orange-100 text-orange-700")}>
                    {getFacetedCount("difficulty", "all")}
                  </span>
                </button>
                {Object.entries(DIFFICULTY_INFO).map(([k, v]) => {
                  const active = difficultyFilter === k;
                  const count = getFacetedCount("difficulty", k);
                  return (
                    <button
                      key={k}
                      onClick={() => setDifficultyFilter(k)}
                      className={cn(
                        "flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-black transition-all border-2 text-left active:scale-[0.98]",
                        active
                          ? "bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20"
                          : "bg-orange-50/50 text-slate-600 border-transparent hover:border-orange-200 hover:bg-orange-50"
                      )}
                    >
                      <span className="flex items-center gap-2"><span className="text-sm">{v.icon}</span> {v.label}</span>
                      <span className={cn("text-[9px] px-2 py-0.5 rounded-md font-bold shadow-inner", active ? "bg-white/20 text-white" : "bg-orange-100 text-orange-700")}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Exam list rendered with dynamically co-gian layouts */}
          <div className="flex-1 space-y-6">
            
            {/* Display Switcher Toolbar */}
            <div className="bg-white border-2 border-[#e6dec9] rounded-[24px] p-4 shadow-sm flex items-center justify-between flex-wrap gap-4">
              <span className="text-[10px] font-black text-amber-700/60 uppercase tracking-widest">TRÌNH BÀY BÍ KÍP</span>
              
              <div className="flex gap-2 bg-[#faf6eb] p-1.5 rounded-2xl border border-[#e6dec9] shadow-inner">
                <button
                  onClick={() => handleLayoutChange("grid")}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all",
                    layoutMode === "grid" 
                      ? "bg-white text-purple-700 shadow-sm border border-[#e6dec9]" 
                      : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  <LayoutGrid className="w-4 h-4" /> Dạng Thẻ
                </button>
                <button
                  onClick={() => handleLayoutChange("list")}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all",
                    layoutMode === "list" 
                      ? "bg-white text-purple-700 shadow-sm border border-[#e6dec9]" 
                      : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  <List className="w-4 h-4" /> Dạng Cuộn
                </button>
              </div>
            </div>

            {filteredExams.length === 0 ? (
              <div className="text-center py-24 bg-white rounded-[32px] border-2 border-dashed border-amber-200 shadow-sm">
                <span className="text-6xl block mb-4 select-none animate-pulse">🧳</span>
                <p className="text-amber-800 font-black text-sm uppercase">Rương bí kíp đang trống!</p>
                <p className="text-xs text-amber-700/80 mt-1.5 max-w-sm mx-auto font-medium font-serif italic">Bé Mỹ Linh thử đổi thần chú tìm kiếm hoặc chọn kệ sách khác xem sao nhé!</p>
              </div>
            ) : (
              <div className="animate-in fade-in duration-300">
                
                {layoutMode === "grid" ? (
                  /* GIAO DIỆN LƯỚI THẺ: Thẻ phép thuật */
                  <div className="columns-1 md:columns-2 gap-6 space-y-6 [column-fill:balance]">
                    {filteredExams.map(exam => (
                      <div 
                        key={exam.id}
                        onClick={() => setActiveExam(exam)}
                        className="break-inside-avoid w-full bg-[#faf7f0] rounded-[32px] border-[3px] border-[#e6dec9] p-6 shadow-[4px_4px_12px_rgba(58,38,24,0.04)] hover:shadow-[8px_8px_20px_rgba(147,51,234,0.12)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between cursor-pointer hover:border-purple-300 relative group mb-6 overflow-hidden"
                      >
                        <div className="absolute -right-6 -bottom-6 text-8xl opacity-[0.03] pointer-events-none text-purple-900 rotate-12 transition-transform group-hover:rotate-45 duration-700">✨</div>
                        
                        <div className="space-y-4 relative z-10">
                          {/* Top Badges details */}
                          <div className="flex flex-wrap gap-2 border-b border-dashed border-[#d8d2c4] pb-3">
                            {(() => {
                              const diffInfo = exam.difficulty ? DIFFICULTY_INFO[exam.difficulty] : DIFFICULTY_INFO['normal'];
                              return (
                                <span className={cn("text-[9px] font-black px-2.5 py-0.5 rounded-full border shadow-sm flex items-center gap-1", diffInfo.color)}>
                                  {diffInfo.icon} {diffInfo.label}
                                </span>
                              );
                            })()}
                            <span className="bg-white border border-[#d8d2c4] text-slate-700 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
                              📚 {exam.subject}
                            </span>
                            <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[9px] font-black px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                              🎓 {exam.grade}
                            </span>
                          </div>

                          {/* Full Title without truncation */}
                          <h3 className="font-black text-[#3e291b] text-[17px] leading-snug font-serif group-hover:text-purple-700 transition-colors">
                            {exam.title}
                          </h3>

                          {/* Timing and Questions count details fully presented */}
                          <div className="flex items-center gap-4 text-[10px] font-black text-amber-700/70 uppercase tracking-wider bg-amber-50/50 p-2 rounded-xl border border-amber-100">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-600" /> {exam.duration} phút
                            </span>
                            <span className="text-amber-300">&bull;</span>
                            <span className="flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-amber-600" /> {exam.sections.reduce((a, s) => a + s.questions.length, 0)} câu hỏi
                            </span>
                          </div>

                          {/* Score analytics overview */}
                          {(() => {
                            const stats = getExamStatsFixed(exam.id);
                            if (stats.attemptCount === 0) return null;
                            return (
                              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-3 shadow-inner flex items-center justify-between">
                                <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1">
                                  <Trophy className="w-3 h-3" /> Đã chinh phục
                                </span>
                                <span className="text-[10px] font-black text-emerald-900 bg-white border border-emerald-100 px-3 py-1 rounded-xl shadow-sm">
                                  {stats.attemptCount} lần &bull; Đỉnh {stats.bestScore}%
                                </span>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Stitched Card Footer Operations */}
                        <div className="pt-4 mt-4 border-t border-dashed border-[#d8d2c4] flex items-center justify-between relative z-10" onClick={e => e.stopPropagation()}>
                          <span className="text-[9px] text-[#8c7c6a] font-serif italic uppercase flex items-center gap-1">
                            <Wand2 className="w-3 h-3" /> Mở cuộn bí kíp
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => handleSaveToLibrary(exam, e)}
                              className="p-2 bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-xl transition-all shadow-sm active:scale-90"
                              title="Cất vào Thư Viện chính"
                            >
                              <Library className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => handleToggleSource(exam, !!exam.isSourceExam, e)}
                              className={cn(
                                "p-2 rounded-xl transition-all shadow-sm active:scale-90 border",
                                exam.isSourceExam 
                                  ? "bg-orange-100 text-orange-700 border-orange-300" 
                                  : "bg-white text-slate-400 border-[#e6dec9] hover:bg-slate-50"
                              )}
                              title="Dùng làm thần chú AI"
                            >
                              📌
                            </button>
                            {exam.id && !SAMPLE_EXAMS.find(ex => ex.id === exam.id) && (
                              <button
                                onClick={(e) => handleDelete(exam.id, e)}
                                className="p-2 bg-white text-red-500 border border-red-200 hover:bg-red-50 rounded-xl transition-all shadow-sm active:scale-90"
                                title="Xóa bí kíp"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                ) : (
                  /* GIAO DIỆN HÀNG DÒNG: Dòng ngang sang trọng */
                  <div className="space-y-4">
                    {filteredExams.map(exam => (
                      <div
                        key={exam.id}
                        onClick={() => setActiveExam(exam)}
                        className="bg-[#faf7f0] border-2 border-[#e6dec9] hover:border-purple-300 hover:shadow-[0_8px_20px_rgba(147,51,234,0.1)] rounded-[24px] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4.5 cursor-pointer transition-all duration-300 group relative overflow-hidden"
                      >
                         <div className="absolute right-0 top-0 text-6xl opacity-[0.02] pointer-events-none text-purple-900 rotate-12 transition-transform group-hover:rotate-45 duration-700">✨</div>
                        
                        {/* Title & Subjects */}
                        <div className="flex-1 space-y-2 min-w-0 relative z-10">
                          <div className="flex flex-wrap gap-2 items-center">
                            <span className="bg-white border border-[#d8d2c4] text-slate-700 text-[9px] font-black px-2.5 py-0.5 rounded shadow-sm">
                              📚 {exam.subject}
                            </span>
                            <span className="bg-purple-50 border border-purple-200 text-purple-700 text-[9px] font-black px-2.5 py-0.5 rounded shadow-sm">
                              🎓 {exam.grade}
                            </span>
                            {(() => {
                              const diffInfo = exam.difficulty ? DIFFICULTY_INFO[exam.difficulty] : DIFFICULTY_INFO['normal'];
                              return (
                                <span className={cn("text-[9px] font-black px-2.5 py-0.5 rounded border shadow-sm", diffInfo.color)}>
                                  {diffInfo.icon} {diffInfo.label}
                                </span>
                              );
                            })()}
                          </div>
                          <h4 className="font-black text-[#3e291b] text-[15px] font-serif group-hover:text-purple-700 leading-tight transition-colors">
                            {exam.title}
                          </h4>
                        </div>

                        {/* Timing and Questions stats */}
                        <div className="flex items-center gap-4 text-[10px] font-black text-amber-700/70 uppercase tracking-widest shrink-0 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100 relative z-10">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {exam.duration}p</span>
                          <span className="text-amber-300">&bull;</span>
                          <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {exam.sections.reduce((a, s) => a + s.questions.length, 0)} câu</span>
                        </div>

                        {/* Score stats row */}
                        {(() => {
                          const stats = getExamStatsFixed(exam.id);
                          if (stats.attemptCount === 0) return <div className="w-28 shrink-0 relative z-10" />;
                          return (
                            <div className="shrink-0 text-right bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 relative z-10">
                              <span className="text-[8px] font-black text-emerald-700 uppercase block tracking-wider mb-0.5">Kỷ lục</span>
                              <span className="text-xs font-black text-emerald-900 flex items-center gap-1 justify-end">
                                <Trophy className="w-3 h-3 text-yellow-500" /> {stats.bestScore}%
                              </span>
                            </div>
                          );
                        })()}

                        {/* Row controllers */}
                        <div className="flex items-center gap-2 shrink-0 justify-end relative z-10" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleSaveToLibrary(exam, e)}
                            className="p-2 bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-xl transition-all shadow-sm"
                            title="Cất vào Thư Viện chính"
                          >
                            <Library className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleToggleSource(exam, !!exam.isSourceExam, e)}
                            className={cn(
                              "p-2 rounded-xl transition-all shadow-sm border",
                              exam.isSourceExam 
                                ? "bg-orange-100 text-orange-700 border-orange-300" 
                                : "bg-white border-[#e6dec9] text-slate-400 hover:bg-slate-50"
                            )}
                            title="Dùng làm thần chú AI"
                          >
                            📌
                          </button>
                          {exam.id && !SAMPLE_EXAMS.find(ex => ex.id === exam.id) && (
                            <button
                              onClick={(e) => handleDelete(exam.id, e)}
                              className="p-2 bg-white text-red-500 border border-red-200 hover:bg-red-50 rounded-xl transition-all shadow-sm"
                              title="Xóa bí kíp"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            )}

          </div>

        </div>
      </div>

      {/* FULL-SCREEN VINTAGE MAGICAL SCROLL DETAIL OVERLAY */}
      <AnimatePresence>
        {activeExam && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#150d09]/90 backdrop-blur-md flex items-center justify-center p-4 md:p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 30, rotateX: -5 }}
              animate={{ scale: 1, y: 0, rotateX: 0 }}
              exit={{ scale: 0.95, y: 20, rotateX: 5 }}
              transition={{ type: "spring", damping: 25, stiffness: 120 }}
              className="w-full max-w-4xl h-[85vh] bg-[#f5efe4] rounded-[32px] border-[12px] border-[#4a3219] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col relative overflow-hidden"
              style={{
                boxShadow: "inset 0 0 20px rgba(0,0,0,0.8), 0 20px 50px rgba(0,0,0,0.9)",
              }}
            >
              {/* Binder Gold Stitching Trim */}
              <div className="absolute inset-1.5 border-2 border-dashed border-[#8c6b3e] rounded-2xl pointer-events-none z-0 opacity-40" />

              {/* Close Button - Styled as a vintage Wax Seal */}
              <button 
                onClick={() => setActiveExam(null)}
                className="absolute top-4 right-4 md:top-6 md:right-6 w-12 h-12 rounded-full bg-[#800020] hover:bg-[#9c1836] border-2 border-[#d4af37] shadow-lg flex items-center justify-center text-white active:scale-95 transition-all cursor-pointer z-50 hover:rotate-12 duration-200"
                style={{ boxShadow: "0 4px 10px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.2)" }}
              >
                <X className="w-5 h-5 text-amber-100" />
              </button>

              {/* Header tags overlay */}
              <div className="p-6 md:p-8 border-b-2 border-double border-[#54361e]/20 relative z-10 bg-[#faf7f0]"
                   style={{
                     backgroundImage: "radial-gradient(#e5d9bf 1px, transparent 1px)",
                     backgroundSize: "24px 24px"
                   }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-black text-amber-800 uppercase tracking-widest font-mono">
                    📜 CUỘN BÍ KÍP #{activeExam.id.slice(0, 6).toUpperCase()}
                  </span>
                  <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider shadow-sm flex items-center gap-1">
                    <Star className="w-3 h-3" /> Phép thuật
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black font-serif text-[#3e291b] mt-1 leading-snug">
                  {activeExam.title}
                </h2>
                <div className="flex flex-wrap gap-2 mt-4">
                  <span className="bg-white border border-[#d8d2c4] text-slate-700 text-[10px] font-black px-3 py-1 rounded shadow-sm flex items-center gap-1.5">
                    📚 Môn: {activeExam.subject}
                  </span>
                  <span className="bg-white border border-[#d8d2c4] text-slate-700 text-[10px] font-black px-3 py-1 rounded shadow-sm flex items-center gap-1.5">
                    🎓 {activeExam.grade}
                  </span>
                  <span className="bg-white border border-[#d8d2c4] text-slate-700 text-[10px] font-black px-3 py-1 rounded shadow-sm flex items-center gap-1.5">
                    ⏱ {activeExam.duration} phút
                  </span>
                </div>
              </div>

              {/* Scrollable details portfolio */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#faf7f0] space-y-8 relative z-10 custom-scrollbar"
                   style={{
                     backgroundImage: "radial-gradient(#e5d9bf 1px, transparent 1px)",
                     backgroundSize: "24px 24px"
                   }}>
                
                {/* Score analytics overview */}
                {(() => {
                  const stats = getExamStatsFixed(activeExam.id);
                  return (
                    <div className="bg-white border-[3px] border-[#e6dec9] rounded-[24px] p-6 shadow-[4px_4px_12px_rgba(58,38,24,0.04)] grid grid-cols-2 md:grid-cols-4 gap-6 text-center relative overflow-hidden">
                      <div className="absolute right-0 bottom-0 text-7xl opacity-[0.03] pointer-events-none text-amber-900 rotate-12">📊</div>
                      <div className="border-r-2 border-dashed border-[#e6dec9]">
                         <div className="text-2xl mb-1">⚔️</div>
                        <span className="text-[9px] font-black text-amber-700/60 uppercase tracking-widest block mb-1">Số lần xuất trận</span>
                        <span className="text-xl font-black text-amber-900 font-serif">{stats.attemptCount} lần</span>
                      </div>
                      <div className="border-r-2 border-dashed border-[#e6dec9] md:border-none lg:border-r-2">
                         <div className="text-2xl mb-1">🏆</div>
                        <span className="text-[9px] font-black text-amber-700/60 uppercase tracking-widest block mb-1">Thành tích cao nhất</span>
                        <span className="text-xl font-black text-emerald-600 font-serif">{stats.attemptCount > 0 ? `${stats.bestScore}%` : "—"}</span>
                      </div>
                      <div className="border-r-2 border-dashed border-[#e6dec9] hidden md:block">
                         <div className="text-2xl mb-1">📜</div>
                        <span className="text-[9px] font-black text-amber-700/60 uppercase tracking-widest block mb-1">Tổng số câu thần chú</span>
                        <span className="text-xl font-black text-[#3e291b] font-serif">{activeExam.sections.reduce((a, s) => a + s.questions.length, 0)} câu</span>
                      </div>
                      <div className="hidden md:block">
                         <div className="text-2xl mb-1">🔥</div>
                        <span className="text-[9px] font-black text-amber-700/60 uppercase tracking-widest block mb-1.5">Độ khó thử thách</span>
                        <span className="text-[10px] font-black text-orange-800 bg-orange-100 border border-orange-200 px-3 py-1 rounded-full uppercase tracking-wider inline-block shadow-sm">
                          {activeExam.difficulty ? DIFFICULTY_INFO[activeExam.difficulty].label : "Bình thường"}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Exam description */}
                {activeExam.description && (
                  <div className="bg-amber-50/80 border-2 border-amber-200/60 rounded-[24px] p-6 shadow-sm space-y-3 relative">
                    <h4 className="text-[11px] font-black text-amber-800 uppercase tracking-widest flex items-center gap-1.5">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> Lời tiên tri
                    </h4>
                    <p className="text-sm text-amber-900/80 leading-relaxed font-semibold font-serif italic border-l-4 border-amber-300 pl-4">
                      "{activeExam.description}"
                    </p>
                  </div>
                )}

                {/* Sections and Questions preview checklist */}
                <div className="space-y-5">
                  <h4 className="text-[11px] font-black text-amber-700/60 uppercase tracking-widest flex items-center gap-1.5">
                    <Map className="w-4 h-4 text-amber-600" /> BẢN ĐỒ THỬ THÁCH BÊN TRONG:
                  </h4>
                  {activeExam.sections.map((section, sIdx) => (
                    <div key={section.id} className="bg-white border-[3px] border-[#e6dec9] rounded-[24px] p-6 shadow-sm space-y-5 relative overflow-hidden">
                       <div className="absolute -right-4 -top-4 text-6xl opacity-[0.02] pointer-events-none text-[#3e291b]">⚔️</div>
                      <div className="border-b-2 border-dashed border-[#e6dec9] pb-3 flex justify-between items-center flex-wrap gap-2 relative z-10">
                        <h5 className="text-[15px] font-black text-[#3e291b] uppercase font-serif">
                          Cửa ải {sIdx + 1}: {section.title || "Trắc nghiệm phép thuật"}
                        </h5>
                        <span className="text-[10px] text-purple-800 bg-purple-100 border border-purple-200 font-black px-3 py-1 rounded-lg shadow-sm">
                          {section.questions.length} câu hỏi
                        </span>
                      </div>

                      {/* Question texts preview */}
                      <div className="space-y-3.5 relative z-10">
                        {section.questions.map((question) => (
                          <div key={question.id} className="text-[13px] text-[#5c4a3d] flex gap-3 items-start">
                            <div className="mt-1 shrink-0 text-amber-500">✧</div>
                            <p className="font-serif leading-relaxed">
                              <span className="font-bold text-[#3e291b] mr-1.5">Câu {question.number}:</span>
                              {question.text.length > 150 ? `${question.text.slice(0, 150)}...` : question.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom spacing for scroll */}
                <div className="h-8"></div>
              </div>

              {/* Start exam action footer */}
              <div className="p-6 border-t-2 border-dashed border-[#8c6b3e]/30 bg-[#f5efe4] flex flex-col md:flex-row justify-between items-center shrink-0 gap-4 relative z-10">
                <span className="text-[11px] text-amber-800/70 font-black uppercase tracking-widest text-center md:text-left">
                  ✨ Chúc Hiệp sĩ Mỹ Linh xuất trận thành công! ✨
                </span>
                <button
                  onClick={() => navigate(`/exam/${activeExam.id}`)}
                  className="w-full md:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black py-4 px-10 rounded-[20px] text-sm uppercase tracking-widest active:scale-95 transition-all shadow-[0_8px_20px_rgba(147,51,234,0.3)] hover:shadow-[0_12px_25px_rgba(147,51,234,0.4)] flex items-center justify-center gap-2 border-2 border-purple-400"
                >
                  <Wand2 className="w-5 h-5" /> Bắt đầu xuất trận ngay
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(230, 222, 201, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(140, 107, 62, 0.4);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(140, 107, 62, 0.6);
        }
      `}} />
    </div>
  );
};

export default ExamsPage;
