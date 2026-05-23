import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Lock, 
  Unlock, 
  Settings, 
  History, 
  User, 
  Sparkles, 
  CheckCircle, 
  MessageSquare, 
  Calendar, 
  Send, 
  Volume2, 
  RefreshCw, 
  Sliders, 
  Star, 
  Award, 
  TrendingUp, 
  Clock, 
  ArrowLeft,
  Smartphone,
  ShieldCheck,
  PlusCircle,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  BookOpen,
  AwardIcon,
  BookOpenCheck,
  CheckCircle2,
  Trash2,
  ChevronUp,
  ChevronDown,
  Pencil,
  RotateCcw,
  BookMarked,
  LayoutGrid,
  List
} from 'lucide-react';
import { useAuth } from "@/contexts/AuthContext";
import { useStudent } from "@/contexts/StudentContext";
import { getExams, saveExam, getSessions, type GamificationData, getGamificationData, getWrongQuestions } from "@/lib/storage";
import { getTTSSettings, saveTTSSettings, type TTSSettings } from "@/lib/tts";
import { syncAllData, saveRemoteConfig, sendRemoteMessage, uploadExamToCloud } from "@/lib/sync";
import { generateExam, getCreditsRemaining } from "@/lib/gemini";
import { generateId } from "@/lib/storage";
import { DIFFICULTY_INFO, Exam, ExamSession, Difficulty, WrongQuestion, PenSettings } from "@/types/exam";
import { SUBJECTS, ALL_GRADES } from "@/constants/exams";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLayout } from "@/contexts/LayoutContext";
import { motion, AnimatePresence } from "framer-motion";
import DrawingCanvas from "@/components/features/DrawingCanvas";
import TextWithFractions from "@/components/features/FractionDisplay";

const ParentsPortal: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLocalMode } = useAuth();
  const { profile, setProfile } = useStudent();
  const { gridClass, containerClass } = useLayout();
  
  // Security Gate state
  const [pin, setPin] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [targetPin, setTargetPin] = useState(() => {
    return localStorage.getItem("methi_parent_pin") || "2026";
  });
  const [isSettingNewPin, setIsSettingNewPin] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  // Syncing states
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>("");

  // App States
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [gamification, setGamification] = useState<GamificationData>({ level: 1, xp: 0, stars: 0, streak: 1 });
  const [ttsSettings, setTtsSettings] = useState<TTSSettings>(getTTSSettings());

  // Edit forms
  const [childName, setChildName] = useState("");
  const [daddyName, setDaddyName] = useState("");
  const [ttsRate, setTtsRate] = useState(0.95);
  const [ttsPitch, setTtsPitch] = useState(1.0);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [remoteMsgInput, setRemoteMsgInput] = useState("");

  // Remote AI Exam Builder state
  const [aiSubject, setAiSubject] = useState("Toán");
  const [aiGrade, setAiGrade] = useState("Lớp 4");
  const [aiDifficulty, setAiDifficulty] = useState<Difficulty>("normal");
  const [aiQCount, setAiQCount] = useState(10);
  const [isGeneratingExam, setIsGeneratingExam] = useState(false);
  const [aiCredits, setAiCredits] = useState(0);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'settings' | 'exam-builder'>('dashboard');
  const [wrongQuestions, setWrongQuestions] = useState<WrongQuestion[]>([]);

  // Wrong Questions and Attempts Pagination
  const [wrongPage, setWrongPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  // History layout switcher (Grid vs List) matching ExamsPage.tsx!
  const [historyLayoutMode, setHistoryLayoutMode] = useState<"grid" | "list">(() => {
    return (localStorage.getItem("methi_parent_history_layout") as "grid" | "list") || "grid";
  });

  // Question detail focus modal state
  const [activeWq, setActiveWq] = useState<WrongQuestion | null>(null);
  const [wqTab, setWqTab] = useState<"details" | "scratchpad">("details");
  const [penSettings, setPenSettings] = useState<PenSettings>({
    color: "#dc2626",
    size: 5,
    opacity: 1,
    style: "pen"
  });
  const [eraserMode, setEraserMode] = useState(false);
  const canvasRef = useRef<{ clearAll: () => void; undoLast: () => void; getData: () => string; setData: (data: string) => void } | null>(null);

  // History session detail modal state
  const [activeSession, setActiveSession] = useState<ExamSession | null>(null);

  // Load Initial Data
  useEffect(() => {
    setSessions(getSessions().sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()));
    setExams(getExams());
    setGamification(getGamificationData());
    setWrongQuestions(getWrongQuestions());
    
    const settings = getTTSSettings();
    setTtsSettings(settings);
    setChildName(settings.childName || profile.name || "");
    setDaddyName(settings.daddyName || "bố Tommy");
    setTtsRate(settings.rate);
    setTtsPitch(settings.pitch);
    setTtsEnabled(settings.enabled);
    setRemoteMsgInput(settings.remoteMessage || "");
    setAiCredits(getCreditsRemaining());

    // Auto check if unlocked in session storage
    const unlocked = sessionStorage.getItem("methi_parents_unlocked");
    if (unlocked === "true") {
      setIsUnlocked(true);
    }
  }, [profile]);

  // Sync with Cloud
  const handleCloudSync = useCallback(async (showToast = true) => {
    if (!user || isLocalMode) return;
    setIsSyncing(true);
    if (showToast) toast.loading("Đang kết nối đám mây...");
    
    const result = await syncAllData(user);
    
    setIsSyncing(false);
    toast.dismiss();
    
    if (result.success) {
      if (showToast) toast.success("Đồng bộ thành công! Đã cập nhật tiến trình của bé.");
      setLastSyncTime(new Date().toLocaleTimeString());
      
      // Reload states
      setSessions(getSessions().sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()));
      setExams(getExams());
      setGamification(getGamificationData());
      setWrongQuestions(getWrongQuestions());
      
      const settings = getTTSSettings();
      setTtsSettings(settings);
      setRemoteMsgInput(settings.remoteMessage || "");
    } else {
      if (showToast) toast.error("Đồng bộ chưa thành công. Vui lòng kiểm tra mạng!");
    }
  }, [user, isLocalMode]);

  // Trigger sync on unlock
  useEffect(() => {
    if (isUnlocked && user && !isLocalMode) {
      handleCloudSync(false);
    }
  }, [isUnlocked, user, isLocalMode, handleCloudSync]);

  // PIN check handler
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === targetPin) {
      setIsUnlocked(true);
      sessionStorage.setItem("methi_parents_unlocked", "true");
      setPin("");
      toast.success("Chào mừng Bố Tommy đến với bảng quản trị!");
    } else {
      toast.error("Mã PIN không chính xác! Vui lòng thử lại.");
      setPin("");
    }
  };

  const handleKeypadPress = (val: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + val);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  // Change PIN handler
  const handleSavePin = () => {
    if (newPin.length !== 4) {
      toast.error("Mã PIN phải gồm đúng 4 chữ số!");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("Mã xác nhận PIN chưa trùng khớp!");
      return;
    }
    localStorage.setItem("methi_parent_pin", newPin);
    setTargetPin(newPin);
    setIsSettingNewPin(false);
    setNewPin("");
    setConfirmPin("");
    toast.success("Đã thay đổi mã PIN bảo mật thành công!");
  };

  // Save Settings & Profile Cloud
  const handleSaveSettings = async () => {
    const trimmedChildName = childName.trim();
    const trimmedDaddyName = daddyName.trim();

    if (!trimmedChildName) {
      toast.error("Vui lòng nhập tên bé yêu!");
      return;
    }

    const newTts = {
      childName: trimmedChildName,
      daddyName: trimmedDaddyName,
      rate: ttsRate,
      pitch: ttsPitch,
      enabled: ttsEnabled,
      remoteMessage: remoteMsgInput.trim()
    };

    saveTTSSettings(newTts);
    setTtsSettings(newTts);

    if (profile.id) {
      const updatedProfile = { ...profile, name: trimmedChildName };
      setProfile(updatedProfile);
      localStorage.setItem("examtouch_student_profile", JSON.stringify(updatedProfile));
    }

    if (user && !isLocalMode) {
      await saveRemoteConfig(user, {
        childName: trimmedChildName,
        daddyName: trimmedDaddyName,
        remoteMessage: remoteMsgInput.trim(),
        ttsEnabled,
        ttsPitch,
        ttsRate
      });
    }

    toast.success("💾 Đã lưu cấu hình trợ lý giọng nói thành công!");
  };

  // Send Remote Message
  const handleSendRemoteMessage = async () => {
    if (!remoteMsgInput.trim()) {
      toast.error("Vui lòng nhập lời nhắn thoại cho con!");
      return;
    }
    
    const updated = { ...ttsSettings, remoteMessage: remoteMsgInput.trim() };
    saveTTSSettings(updated);
    setTtsSettings(updated);

    if (user && !isLocalMode) {
      toast.loading("Đang gửi tin nhắn qua đám mây...");
      const ok = await sendRemoteMessage(user, remoteMsgInput.trim());
      toast.dismiss();
      if (ok) {
        toast.success("🚀 Đã gửi lời nhắn! Trợ lý sẽ đọc khi bé mở máy.");
      } else {
        toast.error("Gửi tin nhắn thất bại. Vui lòng thử lại!");
      }
    } else {
      toast.success("🔊 Đã cập nhật tin nhắn thoại nội bộ!");
    }
  };

  // Remote AI Exam Builder
  const handleGenerateExamRemote = async () => {
    if (isGeneratingExam) return;
    
    setIsGeneratingExam(true);
    toast.loading(`AI đang biên soạn ${aiQCount} câu đề thi "${aiSubject}" (${aiDifficulty})...`, { duration: 180000 });
    
    try {
      const dummySource = {
        title: `Đề thi ${aiSubject} ${aiGrade}`,
        subject: aiSubject,
        grade: aiGrade,
        sections: [{ id: "sec1", title: "Phần chính", questions: [] }]
      };
      
      const sections = await generateExam(dummySource as any, aiDifficulty, aiQCount);
      if (!sections || sections.length === 0) {
        throw new Error("Không nhận được câu hỏi từ AI. Vui lòng thử lại!");
      }

      const newExam: Exam = {
        id: generateId(),
        title: `🎯 ĐỀ BỐ TẠO: ${aiSubject} - ${aiGrade} (${aiQCount} câu)`,
        subject: aiSubject,
        grade: aiGrade,
        duration: aiQCount * 3,
        totalPoints: 10,
        isAIGenerated: true,
        createdAt: new Date().toISOString().split("T")[0],
        sections,
        difficulty: aiDifficulty,
        description: `Đề thi tạo bởi bố Tommy hỗ trợ chuyên đề ôn tập cho Mỹ Linh.`
      };

      saveExam(newExam);
      
      if (user && !isLocalMode) {
        await uploadExamToCloud(user, newExam);
      }

      toast.dismiss();
      toast.success(`🎉 Đã tạo đề thi thành công! Đề thi đã xuất hiện tại Phòng Luyện Thi của bé.`);
      setExams(getExams());
      setAiCredits(getCreditsRemaining());
    } catch (err: any) {
      console.error(err);
      toast.dismiss();
      toast.error(`Lỗi tạo đề AI: ${err?.message || "Kiểm tra kết nối mạng!"}`);
    } finally {
      setIsGeneratingExam(false);
    }
  };

  // Load and save drawings in wrong questions scratchpad
  useEffect(() => {
    if (activeWq && wqTab === "scratchpad" && canvasRef.current) {
      const saved = localStorage.getItem(`examtouch_parent_wrong_canvas_${activeWq.id}`);
      if (saved) {
        setTimeout(() => {
          canvasRef.current?.setData(saved);
        }, 100);
      }
    }
  }, [activeWq, wqTab]);

  const saveWrongScratch = () => {
    if (activeWq && canvasRef.current) {
      const data = canvasRef.current.getData();
      if (data) {
        localStorage.setItem(`examtouch_parent_wrong_canvas_${activeWq.id}`, data);
      }
    }
  };

  const handleCloseWqDetails = () => {
    saveWrongScratch();
    setActiveWq(null);
  };

  const handleHistoryLayoutChange = (mode: "grid" | "list") => {
    setHistoryLayoutMode(mode);
    localStorage.setItem("methi_parent_history_layout", mode);
  };

  const effectivePen: PenSettings = eraserMode
    ? { ...penSettings, color: "#fbf9f4", size: 28, style: "pen", opacity: 1 }
    : penSettings;

  // Heat map helper
  const get7DayActivity = () => {
    const list = [];
    const daysName = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const count = sessions.filter(s => s.submittedAt && s.submittedAt.startsWith(dateStr)).length;
      
      list.push({
        dateStr,
        dayName: daysName[d.getDay()],
        dateLabel: `${d.getDate()}/${d.getMonth() + 1}`,
        count
      });
    }
    return list;
  };

  const completedSessions = sessions.filter(s => !!s.submittedAt);
  const avgScore = completedSessions.length > 0
    ? Math.round(completedSessions.reduce((sum, s) => sum + (s.score || 0), 0) / completedSessions.reduce((sum, s) => sum + (s.totalPoints || 10), 0) * 10) * 10
    : 0;

  // Pagination filters
  const totalWrongPages = Math.ceil(wrongQuestions.length / ITEMS_PER_PAGE) || 1;
  const paginatedWrong = wrongQuestions.slice((wrongPage - 1) * ITEMS_PER_PAGE, wrongPage * ITEMS_PER_PAGE);

  const totalHistoryPages = Math.ceil(sessions.length / ITEMS_PER_PAGE) || 1;
  const paginatedHistory = sessions.slice((historyPage - 1) * ITEMS_PER_PAGE, historyPage * ITEMS_PER_PAGE);

  if (!isUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#121824] via-[#1a2333] to-[#0f1520] p-4">
        <div className="w-full max-w-md bg-[#1e293b]/90 border border-slate-700/50 backdrop-blur-xl rounded-[40px] p-8 shadow-2xl space-y-8 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />

          <div className="text-center space-y-3 relative z-10">
            <div className="w-16 h-16 mx-auto bg-gradient-to-tr from-indigo-500 to-indigo-600 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-indigo-400/30">
              <Lock className="w-8 h-8 text-amber-200 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-black text-white uppercase tracking-wider" style={{ fontFamily: "'Baloo 2', cursive" }}>
                CỔNG PHỤ HUYNH BẢO MẬT
              </h2>
              <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest leading-relaxed">
                Nhập mã PIN 4 chữ số để truy cập bảng giám sát học tập
              </p>
            </div>
          </div>

          <div className="flex justify-center gap-6 pt-2">
            {[...Array(4)].map((_, i) => (
              <div 
                key={i} 
                className={cn(
                  "w-5 h-5 rounded-full border-2 transition-all duration-150",
                  i < pin.length 
                    ? "bg-gradient-to-tr from-amber-400 to-amber-500 border-amber-400 shadow-md shadow-amber-400/20 scale-110" 
                    : "border-slate-600 bg-slate-800/40"
                )}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4 max-w-[280px] mx-auto pt-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <button
                key={num}
                onClick={() => handleKeypadPress(num)}
                className="w-16 h-16 rounded-2xl bg-slate-800/40 border border-slate-700/30 text-white font-black text-xl hover:bg-slate-700/60 active:scale-95 transition-all shadow-sm"
              >
                {num}
              </button>
            ))}
            <button
              onClick={() => setPin("")}
              className="w-16 h-16 rounded-2xl bg-slate-800/20 border border-slate-800/10 text-red-400/80 font-bold text-xs hover:bg-red-500/10 hover:text-red-300 active:scale-95 transition-all flex items-center justify-center uppercase tracking-wider"
            >
              Xóa
            </button>
            <button
              onClick={() => handleKeypadPress("0")}
              className="w-16 h-16 rounded-2xl bg-slate-800/40 border border-slate-700/30 text-white font-black text-xl hover:bg-slate-700/60 active:scale-95 transition-all"
            >
              0
            </button>
            <button
              onClick={handleBackspace}
              className="w-16 h-16 rounded-2xl bg-slate-800/20 border border-slate-800/10 text-amber-200/80 hover:bg-amber-500/10 active:scale-95 transition-all flex items-center justify-center font-black text-lg"
            >
              ⌫
            </button>
          </div>

          <form onSubmit={handlePinSubmit} className="pt-2 text-center">
            <button 
              type="submit"
              className="px-8 py-3.5 bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-indigo-600/15 hover:brightness-110 active:scale-95 transition-all"
            >
              🔑 Mở Khóa Cổng
            </button>
          </form>

          <div className="text-center pt-2">
            <button 
              onClick={() => navigate("/")} 
              className="text-xs font-black text-slate-500 hover:text-slate-400 flex items-center gap-1.5 justify-center uppercase tracking-wider transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Quay Về Bàn Học
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      
      {/* Top Gold Leaf Header */}
      <header className="bg-gradient-to-r from-[#20140c] via-[#3a2618] to-[#1e130a] border-b-4 border-[#d4af37]/40 py-5 text-amber-100 sticky top-0 z-40 shadow-xl shrink-0">
        <div className={`${containerClass} flex items-center justify-between gap-4`}>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate("/")}
              className="p-3 bg-[#3e291b] hover:bg-[#d4af37]/20 border border-[#d4af37]/30 text-amber-100 rounded-2xl transition-all duration-200 active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-black font-heading tracking-wider uppercase text-transparent bg-clip-text bg-gradient-to-r from-[#f7e0a3] to-[#e4bc75] flex items-center gap-2" style={{ fontFamily: "'Baloo 2', cursive" }}>
                👨‍👦 BẢNG PHỤ HUYNH
              </h1>
              <p className="text-xs text-amber-200/50 font-serif italic">
                Bố: {daddyName} &bull; Con gái yêu: {childName || "Mỹ Linh"} &bull; Đồng bộ thời gian thực
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleCloudSync()}
              disabled={isSyncing}
              className="bg-[#2a1a10] hover:bg-[#d4af37]/20 border border-[#d4af37]/30 p-3 rounded-2xl transition-all active:scale-95"
            >
              <RefreshCw className={cn("w-5 h-5 text-amber-200", isSyncing && "animate-spin")} />
            </button>
            <button
              onClick={() => {
                sessionStorage.removeItem("methi_parents_unlocked");
                setIsUnlocked(false);
                toast.success("🔐 Đã khóa cổng an toàn!");
              }}
              className="bg-red-950/40 hover:bg-red-900/60 border border-red-500/20 text-red-200 px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all"
            >
              Khóa Cổng
            </button>
          </div>
        </div>
      </header>

      {/* Tabs navigation */}
      <nav className="bg-white border-b border-gray-200 py-3 shadow-sm shrink-0">
        <div className={`${containerClass} flex flex-wrap gap-2`}>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              "px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
              activeTab === 'dashboard' 
                ? "bg-[#54361e] text-white shadow-md" 
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            )}
          >
            <TrendingUp className="w-4 h-4" /> Tổng quan & Lỗi sai
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
              activeTab === 'history' 
                ? "bg-[#54361e] text-white shadow-md" 
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            )}
          >
            <History className="w-4 h-4" /> Nhật ký thi cử
          </button>
          <button
            onClick={() => setActiveTab('exam-builder')}
            className={cn(
              "px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
              activeTab === 'exam-builder' 
                ? "bg-[#54361e] text-white shadow-md" 
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            )}
          >
            <Sparkles className="w-4 h-4" /> Soạn đề AI từ xa
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={cn(
              "px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
              activeTab === 'settings' 
                ? "bg-[#54361e] text-white shadow-md" 
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            )}
          >
            <Settings className="w-4 h-4" /> Cấu hình trợ lý
          </button>
        </div>
      </nav>

      {/* Main Viewport */}
      <main className="flex-1 overflow-y-auto pb-12">
        <div className="p-6 md:p-8 max-w-6xl w-full mx-auto space-y-8">
          
          {/* TAB 1: DASHBOARD (Overview & Wrong Questions Cards) */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              
              {/* Stats Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-gray-200/50 border border-slate-100 hover:border-indigo-200 transition-all flex items-center gap-4">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0 border border-indigo-100">
                    <CheckCircle className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Đã làm bài</span>
                    <span className="text-2xl font-black text-slate-800">{completedSessions.length} đề thi</span>
                  </div>
                </div>

                <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-gray-200/50 border border-slate-100 hover:border-emerald-200 transition-all flex items-center gap-4">
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0 border border-emerald-100">
                    <TrendingUp className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Trung bình điểm</span>
                    <span className="text-2xl font-black text-[#16a34a]">{avgScore}%</span>
                  </div>
                </div>

                <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-gray-200/50 border border-slate-100 hover:border-orange-200 transition-all flex items-center gap-4">
                  <div className="w-14 h-14 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center shrink-0 border border-orange-100">
                    <Award className="w-7 h-7 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Streak ngày học</span>
                    <span className="text-2xl font-black text-orange-500">{gamification.streak} ngày</span>
                  </div>
                </div>

                <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-gray-200/50 border border-slate-100 hover:border-pink-200 transition-all flex items-center gap-4">
                  <div className="w-14 h-14 bg-pink-50 text-pink-500 rounded-2xl flex items-center justify-center shrink-0 border border-pink-100">
                    <Star className="w-7 h-7 text-pink-500" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Sao tích lũy</span>
                    <span className="text-2xl font-black text-pink-500">{gamification.stars} ⭐</span>
                  </div>
                </div>
              </div>

              {/* 7-Day Activity Calendar */}
              <div className="bg-white rounded-[40px] p-8 shadow-xl shadow-gray-200/40 border border-gray-100 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-black text-slate-800 font-heading uppercase tracking-tight flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-indigo-500" /> Nhật Ký Chăm Chỉ 7 Ngày Gần Nhất
                    </h3>
                    <p className="text-xs font-semibold text-slate-400 uppercase">Mỗi ngày con làm bài đều lấp lánh sao xanh!</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                    <span>Ít làm</span>
                    <div className="w-4 h-4 bg-slate-50 rounded border border-slate-200" />
                    <div className="w-4 h-4 bg-emerald-100 rounded border border-emerald-200" />
                    <div className="w-4 h-4 bg-emerald-300 rounded border border-emerald-400 animate-pulse" />
                    <div className="w-4 h-4 bg-emerald-600 rounded shadow-md border border-emerald-500" />
                    <span>Luyện nhiều</span>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-4 pt-2">
                  {get7DayActivity().map((day) => (
                    <div 
                      key={day.dateStr}
                      className={cn(
                        "rounded-3xl p-4 border-2 flex flex-col items-center justify-center gap-2 transition-all duration-300 hover:scale-105",
                        day.count === 0 && "bg-slate-50 border-gray-100 text-gray-400",
                        day.count === 1 && "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm",
                        day.count === 2 && "bg-emerald-100 border-emerald-400 text-emerald-800 shadow-md",
                        day.count >= 3 && "bg-emerald-600 border-emerald-500 text-white shadow-lg relative overflow-hidden"
                      )}
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-80">{day.dayName}</span>
                      <span className="text-xs font-black">{day.dateLabel}</span>
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border-2",
                        day.count === 0 && "bg-gray-100 border-gray-200 text-gray-400",
                        day.count === 1 && "bg-emerald-200 border-emerald-300 text-emerald-800",
                        day.count === 2 && "bg-emerald-400 border-emerald-500 text-emerald-950",
                        day.count >= 3 && "bg-yellow-400 border-yellow-300 text-yellow-950 animate-bounce"
                      )}>
                        {day.count > 0 ? `+${day.count}` : "0"}
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-wider opacity-90 text-center">
                        {day.count === 0 && "Nghỉ ngơi 💤"}
                        {day.count === 1 && "Khởi động 🌱"}
                        {day.count === 2 && "Chăm học 🔥"}
                        {day.count >= 3 && "QUÁ SIÊU 🚀"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lời nhắn từ xa */}
              <div className="bg-white rounded-[40px] p-8 shadow-xl shadow-gray-200/40 border border-gray-100 grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-black text-slate-800 font-heading uppercase tracking-tight flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-indigo-500" />Lời nhắn từ xa của bố Tommy 👨‍👦
                    </h3>
                    <p className="text-xs font-semibold text-slate-400 uppercase leading-relaxed">
                      Gửi tin nhắn thoại cho con để reo chuông ting ting động viên con học tập hiệu quả!
                    </p>
                  </div>
                  
                  <div className="relative">
                    <textarea
                      value={remoteMsgInput}
                      onChange={(e) => setRemoteMsgInput(e.target.value)}
                      placeholder="Nhập lời nhắn của bố gửi cho Mỹ Linh..."
                      className="w-full border-2 border-gray-100 rounded-3xl p-5 pr-12 text-sm focus:outline-none focus:border-indigo-500 transition-colors bg-slate-50 placeholder:text-gray-400 font-medium"
                      rows={4}
                    />
                    <div className="absolute bottom-4 right-4 text-xs font-black text-indigo-300 uppercase tracking-widest">
                      Tiếng Việt 🇻🇳
                    </div>
                  </div>

                  <button
                    onClick={handleSendRemoteMessage}
                    className="w-full bg-[#54361e] hover:bg-[#3d2715] text-white font-black py-4 px-6 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg text-sm uppercase tracking-wider"
                  >
                    <Send className="w-4 h-4" /> GỬI TIN NHẮN TỪ XA CHO CON GÁI
                  </button>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-[32px] p-6 border border-indigo-100/50 flex flex-col justify-between">
                  <div className="space-y-4">
                    <h4 className="font-black text-indigo-950 flex items-center gap-2 text-sm uppercase tracking-wide">
                      💡 Hướng dẫn Bố gửi tin nhắn từ xa
                    </h4>
                    <ul className="space-y-3 text-xs text-indigo-900/80 font-medium leading-relaxed">
                      <li className="flex gap-2">
                        <span className="text-emerald-500 font-black">✓</span>
                        <span>Đăng nhập cùng tài khoản trên cả 2 thiết bị.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-emerald-500 font-black">✓</span>
                        <span>Dữ liệu nhắn thoại đồng bộ qua máy chủ đám mây Supabase tức thì.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="border-t border-indigo-200/50 pt-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-200/40 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                      <Volume2 className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-semibold text-indigo-950">
                      <span>Người nhận: </span>
                      <span className="text-pink-600 font-black">{childName || "Mỹ Linh"}</span>
                      <span> • Giọng nói trợ lý: </span>
                      <span className="text-emerald-600 font-black">{ttsEnabled ? "Bật 🔊" : "Tắt 🔇"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* UNIFIED MISTAKES CARDS (Only show the Question text on the card!) */}
              <div className="bg-[#fcfaf2] rounded-[40px] p-8 shadow-xl border-2 border-[#d4af37]/20 space-y-8 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-dashed border-[#e6dec9] pb-4">
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-[#54361e] font-heading uppercase tracking-tight flex items-center gap-2"
                        style={{ fontFamily: "'Baloo 2', cursive" }}>
                      <AlertCircle className="w-5.5 h-5.5 text-red-600 animate-pulse" /> SỔ TAY BÀI SAI HOÀN TOÀN TỰ ĐỘNG
                    </h3>
                    <p className="text-xs font-semibold text-amber-800/60 uppercase">
                      Chỉ hiển thị đề bài để giữ giao diện thẻ cực kỳ sạch sẽ &bull; Nhấp vào thẻ để mở hồ sơ lời giải &amp; nháp chi tiết
                    </p>
                  </div>
                  <div>
                    <span className="bg-red-50 text-red-700 border border-red-200 text-xs px-3.5 py-1.5 rounded-full font-black uppercase tracking-wider">
                      🔴 {wrongQuestions.length} câu cần ôn tập
                    </span>
                  </div>
                </div>

                {wrongQuestions.length === 0 ? (
                  <div className="bg-emerald-50/50 rounded-3xl p-10 text-center border-2 border-dashed border-emerald-100">
                    <span className="text-5xl block mb-3">🎉</span>
                    <p className="text-emerald-800 font-black text-sm uppercase">Mỹ Linh không có lỗi sai nào chưa khắc phục!</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Masonry question cards showing ONLY the question text! */}
                    <div className="columns-1 md:columns-2 gap-6 space-y-6 [column-fill:balance]">
                      {paginatedWrong.map((q) => {
                        const stars = Array.from({ length: 2 }).map((_, i) => (
                          <span key={i} className="text-xs">
                            {i < q.correctCount ? "⭐" : "☆"}
                          </span>
                        ));
                        
                        return (
                          <div 
                            key={q.id} 
                            onClick={() => setActiveWq(q)}
                            className="break-inside-avoid w-full bg-[#faf6eb] border-2 border-[#d8d2c4] rounded-3xl p-5 shadow-[3px_3px_10px_rgba(58,38,24,0.03)] hover:shadow-[6px_6px_18px_rgba(58,38,24,0.08)] hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between cursor-pointer relative overflow-hidden group mb-6"
                          >
                            <div className="space-y-4">
                              {/* Header category details */}
                              <div className="flex items-center justify-between gap-2 border-b border-dashed border-[#e6dec9] pb-3 mb-2 flex-wrap">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="bg-white border border-[#d8d2c4] text-slate-700 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                                    {q.subject}
                                  </span>
                                  {q.question.category && (
                                    <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest">
                                      🎯 {q.question.category}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0 text-amber-500 bg-amber-50/50 border border-amber-200/50 px-2 py-0.5 rounded-full">
                                  {stars}
                                </div>
                              </div>

                              <p className="text-[10px] text-slate-400 font-serif italic">
                                Đề gốc: <span className="text-slate-500 font-black">{q.examTitle}</span>
                              </p>
                              
                              {/* Question TEXT ONLY - fully shown, no line-clamp! */}
                              <div className="text-[15px] text-[#362f28] font-serif leading-relaxed pl-3 border-l-2 border-red-200/50 whitespace-pre-line">
                                <span className="text-blue-600 font-black mr-1">Câu {q.question.number}:</span>
                                <TextWithFractions text={q.question.text} />
                              </div>
                            </div>

                            {/* Card Footer badges */}
                            <div className="pt-4 mt-4 border-t border-dashed border-[#e6dec9] flex items-center justify-between">
                              <span className="text-[9px] text-[#8c7c6a] font-serif italic uppercase">Nhấp xem chi tiết &amp; vẽ nháp</span>
                              <div>
                                {q.correctCount === 0 ? (
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
                      })}
                    </div>

                    {/* Pagination controllers */}
                    {totalWrongPages > 1 && (
                      <div className="flex items-center justify-center gap-4 border-t border-[#e6dec9] pt-6 select-none">
                        <button
                          disabled={wrongPage === 1}
                          onClick={() => setWrongPage(p => Math.max(1, p - 1))}
                          className="px-3.5 py-2 bg-white hover:bg-[#f4ecd8] border-2 border-[#d8d2c4] rounded-xl text-xs font-black text-slate-700 disabled:opacity-40 transition-all active:scale-95 flex items-center gap-1"
                        >
                          <ChevronLeft className="w-4 h-4" /> TRANG TRƯỚC
                        </button>
                        <span className="text-xs font-black text-[#54361e] font-serif bg-[#f4ecd8] border border-[#d8d2c4] px-4 py-1.5 rounded-full">
                          Trang {wrongPage} / {totalWrongPages}
                        </span>
                        <button
                          disabled={wrongPage >= totalWrongPages}
                          onClick={() => setWrongPage(p => Math.min(totalWrongPages, p + 1))}
                          className="px-3.5 py-2 bg-white hover:bg-[#f4ecd8] border-2 border-[#d8d2c4] rounded-xl text-xs font-black text-slate-700 disabled:opacity-40 transition-all active:scale-95 flex items-center gap-1"
                        >
                          TRANG SAU <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: DETAILED EXAM HISTORY (Fully unified styling layout switcher & details overlay modal!) */}
          {activeTab === 'history' && (
            <div className="bg-white rounded-[40px] p-8 shadow-xl shadow-gray-200/40 border border-gray-100 space-y-6 animate-in fade-in duration-300">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-800 font-heading uppercase tracking-tight flex items-center gap-2">
                    <History className="w-5.5 h-5.5 text-indigo-500" /> Nhật Ký Lịch Sử Làm Bài Của Bé
                  </h3>
                  <p className="text-xs font-semibold text-slate-400 uppercase mt-0.5">
                    Hỗ trợ chuyển đổi hiển thị Lưới hoặc Dòng co giãn động &bull; Nhấp để xem báo cáo bài làm chi tiết
                  </p>
                </div>
                
                {/* Switcher matching ExamsPage.tsx */}
                <div className="flex gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-150 shadow-inner shrink-0">
                  <button
                    onClick={() => handleHistoryLayoutChange("grid")}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all",
                      historyLayoutMode === "grid" 
                        ? "bg-white text-indigo-700 shadow-md" 
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    <LayoutGrid className="w-4 h-4" /> Dạng Lưới
                  </button>
                  <button
                    onClick={() => handleHistoryLayoutChange("list")}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all",
                      historyLayoutMode === "list" 
                        ? "bg-white text-indigo-700 shadow-md" 
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    <List className="w-4 h-4" /> Dạng Dòng
                  </button>
                </div>
              </div>

              {sessions.length === 0 ? (
                <div className="py-16 text-center space-y-4">
                  <div className="text-5xl select-none">💤</div>
                  <p className="text-gray-400 font-serif italic text-sm">Con yêu chưa làm bài thi nào.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {historyLayoutMode === "grid" ? (
                    /* DẠNG LƯỚI THẺ: Tự động co giãn theo chiều dọc so le */
                    <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6 [column-fill:balance]">
                      {paginatedHistory.map((session) => {
                        const examDetails = exams.find(e => e.id === session.examId);
                        const isSubmitted = !!session.submittedAt;
                        const scorePct = session.score !== undefined && session.totalPoints
                          ? Math.round((session.score / session.totalPoints) * 100)
                          : 0;

                        return (
                          <div
                            key={session.id}
                            onClick={() => isSubmitted && setActiveSession(session)}
                            className="break-inside-avoid w-full bg-white border-2 border-slate-100 rounded-[28px] p-5 shadow-[4px_4px_12px_rgba(0,0,0,0.02)] hover:shadow-[8px_8px_20px_rgba(99,102,241,0.08)] hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between border-slate-100 hover:border-indigo-300 relative group mb-6"
                          >
                            <div className="space-y-4">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className={cn(
                                  "text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider text-white border shadow-sm",
                                  examDetails?.subject === "Toán" ? "bg-blue-600 border-blue-500" : "bg-emerald-600 border-emerald-500"
                                )}>
                                  {examDetails?.subject || "Tự luyện"}
                                </span>
                                <span className="text-[9px] text-slate-400 font-extrabold uppercase flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {session.submittedAt 
                                    ? new Date(session.submittedAt).toLocaleDateString('vi-VN')
                                    : "Đang làm"
                                  }
                                </span>
                              </div>

                              <h4 className="font-black text-slate-800 text-[15px] leading-snug font-serif">
                                {examDetails?.title || `Đề thi: ${session.examId.slice(0, 8)}...`}
                              </h4>

                              {isSubmitted ? (
                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between shadow-inner">
                                  <div className="space-y-0.5">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Điểm số</span>
                                    <span className="text-xl font-serif text-slate-800">
                                      <span className="font-black text-indigo-600 text-2xl">{session.score}</span> / {session.totalPoints}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className={cn(
                                      "font-black text-xs px-2.5 py-1 rounded-full uppercase tracking-wider text-[10px] block shadow-sm border",
                                      scorePct >= 80 ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                                      scorePct >= 50 ? "bg-blue-50 text-blue-800 border-blue-200" :
                                      "bg-red-50 text-red-800 border-red-200"
                                    )}>
                                      {scorePct}% ĐÚNG
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center">
                                  <span className="text-xs font-black text-amber-700 uppercase tracking-widest block">Đang làm dở dang...</span>
                                </div>
                              )}

                              {isSubmitted && (
                                <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-slate-300" />
                                    {session.timeUsed 
                                      ? `${Math.floor(session.timeUsed / 60)}p ${session.timeUsed % 60}s`
                                      : "—"
                                    }
                                  </span>
                                  <span>&bull;</span>
                                  <span>{examDetails?.grade || "Lớp 4"}</span>
                                </div>
                              )}
                            </div>

                            <div className="pt-4 mt-4 border-t border-dashed border-slate-100 flex items-center justify-between">
                              <span className="text-[9px] text-slate-400 font-serif italic group-hover:text-indigo-600 transition-colors">Nhấp xem chi tiết bài làm</span>
                              <span className={cn(
                                "inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-sm",
                                isSubmitted ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                              )}>
                                {isSubmitted ? "Đã nộp bài" : "Đang làm"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* DẠNG DÒNG DANH SÁCH: Đồng bộ hàng ngang sang trọng */
                    <div className="space-y-3.5">
                      {paginatedHistory.map((session) => {
                        const examDetails = exams.find(e => e.id === session.examId);
                        const isSubmitted = !!session.submittedAt;
                        const scorePct = session.score !== undefined && session.totalPoints
                          ? Math.round((session.score / session.totalPoints) * 100)
                          : 0;

                        return (
                          <div
                            key={session.id}
                            onClick={() => isSubmitted && setActiveSession(session)}
                            className="bg-white border-2 border-slate-100 hover:border-indigo-200 hover:shadow-md rounded-[20px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition-all duration-150"
                          >
                            <div className="flex-1 space-y-2 min-w-0">
                              <div className="flex flex-wrap gap-2 items-center">
                                <span className={cn(
                                  "text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider text-white",
                                  examDetails?.subject === "Toán" ? "bg-blue-600" : "bg-emerald-600"
                                )}>
                                  {examDetails?.subject || "Tự luyện"}
                                </span>
                                <span className="text-slate-400 text-[9px] font-bold">
                                  {session.submittedAt ? new Date(session.submittedAt).toLocaleDateString('vi-VN') : "Đang làm"}
                                </span>
                              </div>
                              <h4 className="font-black text-slate-800 text-[14px] font-serif leading-tight">
                                {examDetails?.title || `Đề thi: ${session.examId.slice(0, 8)}...`}
                              </h4>
                            </div>

                            {/* stats score */}
                            {isSubmitted ? (
                              <div className="flex items-center gap-4 text-right shrink-0">
                                <div>
                                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Điểm số</span>
                                  <span className="text-sm font-black text-indigo-700">{session.score} / {session.totalPoints}</span>
                                </div>
                                <span className={cn(
                                  "text-[9px] font-black px-2.5 py-0.5 rounded-full border shadow-sm",
                                  scorePct >= 80 ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-800 border-red-200"
                                )}>
                                  {scorePct}% đúng
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-amber-600 font-bold shrink-0">Đang làm dở dang</span>
                            )}

                            {/* duration timing */}
                            <div className="text-[10px] font-extrabold text-slate-400 uppercase flex items-center gap-1 shrink-0 pt-2 sm:pt-0">
                              <Clock className="w-3.5 h-3.5" />
                              {session.timeUsed ? `${Math.floor(session.timeUsed / 60)} phút` : "—"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Pagination controller */}
                  {totalHistoryPages > 1 && (
                    <div className="flex items-center justify-center gap-4 pt-6 select-none border-t border-slate-100">
                      <button
                        disabled={historyPage === 1}
                        onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                        className="px-3.5 py-2 bg-white hover:bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-black text-slate-600 disabled:opacity-40 transition-all active:scale-95 flex items-center gap-1"
                      >
                        <ChevronLeft className="w-4 h-4" /> TRANG TRƯỚC
                      </button>
                      <span className="text-xs font-black text-slate-700 bg-slate-100 border border-slate-200 px-4 py-1.5 rounded-full font-serif">
                        Trang {historyPage} / {totalHistoryPages}
                      </span>
                      <button
                        disabled={historyPage >= totalHistoryPages}
                        onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                        className="px-3.5 py-2 bg-white hover:bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-black text-slate-600 disabled:opacity-40 transition-all active:scale-95 flex items-center gap-1"
                      >
                        TRANG SAU <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: REMOTE AI EXAM BUILDER */}
          {activeTab === 'exam-builder' && (
            <div className="bg-white rounded-[40px] p-8 shadow-xl shadow-gray-200/40 border border-gray-100 space-y-8 animate-in fade-in duration-300">
              <div className="space-y-1">
                <h3 className="text-xl font-black text-gray-800 font-heading uppercase tracking-tight flex items-center gap-2">
                  <Sparkles className="w-5.5 h-5.5 text-indigo-500" /> Trợ Lý Soạn Đề AI Thông Minh Từ Xa
                </h3>
                <p className="text-xs font-semibold text-gray-400 uppercase">Soạn đề từ xa cực kỳ tiện lợi cho con gái yêu ôn luyện học tập</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-50 p-6 rounded-[32px] border border-gray-150">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase block tracking-wider">📚 Chọn Môn Học</label>
                    <div className="grid grid-cols-3 gap-2">
                      {["Toán", "Tiếng Việt", "Tiếng Anh"].map(sub => (
                        <button
                          key={sub}
                          onClick={() => setAiSubject(sub)}
                          className={cn(
                            "py-3 rounded-xl text-xs font-black border-2 transition-all duration-200 active:scale-95 shadow-sm",
                            aiSubject === sub
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                          )}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase block tracking-wider">🎓 Chọn Khối Lớp</label>
                    <div className="flex flex-wrap gap-2">
                      {["Lớp 3", "Lớp 4", "Lớp 5"].map(g => (
                        <button
                          key={g}
                          onClick={() => setAiGrade(g)}
                          className={cn(
                            "px-4 py-2.5 rounded-xl text-xs font-black border-2 transition-all duration-200 active:scale-95 shadow-sm",
                            aiGrade === g
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                          )}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase block tracking-wider">🎯 Chọn Độ Khó AI</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {Object.entries(DIFFICULTY_INFO).map(([k, v]) => (
                        <button
                          key={k}
                          onClick={() => setAiDifficulty(k as Difficulty)}
                          className={cn(
                            "py-2.5 rounded-xl text-[10px] font-black border-2 uppercase tracking-wide transition-all active:scale-95 shadow-sm",
                            aiDifficulty === k
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-gray-600 border-gray-200 hover:border-indigo-200"
                          )}
                        >
                          <span>{v.icon}</span> <span className="block mt-0.5">{v.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6 flex flex-col justify-between">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase block tracking-wider">📋 Số lượng câu hỏi</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[5, 10, 15, 20].map(cnt => (
                        <button
                          key={cnt}
                          onClick={() => setAiQCount(cnt)}
                          className={cn(
                            "py-3 rounded-xl text-xs font-black border-2 transition-all active:scale-95 shadow-sm",
                            aiQCount === cnt
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-gray-600 border-gray-200 hover:border-indigo-200"
                          )}
                        >
                          {cnt} câu
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-xs space-y-1 font-semibold text-indigo-950/80">
                    <p className="font-bold text-indigo-900 uppercase text-[10px] tracking-wider mb-1">💡 Bố hãy yên tâm</p>
                    <p>&bull; Mỗi câu hỏi AI tạo ra đều được thiết kế dựa trên tiêu chuẩn giáo khoa.</p>
                    <p>&bull; Có sẵn lời giải cực kỳ chi tiết, sinh động để bé học tập.</p>
                  </div>

                  <button
                    onClick={handleGenerateExamRemote}
                    disabled={isGeneratingExam}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black py-4 px-6 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 text-sm uppercase tracking-widest border border-white"
                  >
                    <Sparkles className="w-5 h-5 text-slate-950" />
                    {isGeneratingExam ? "AI ĐANG SOẠN ĐỀ KIÊN TRÌ..." : "SOẠN ĐỀ BẰNG AI CỰC NHANH"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="bg-white rounded-[40px] p-8 shadow-xl shadow-gray-200/40 border border-gray-100 space-y-8">
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-gray-800 font-heading uppercase tracking-tight flex items-center gap-2">
                    <Volume2 className="w-5.5 h-5.5 text-indigo-500" /> Cài Đặt Trợ Lý Giọng Nói Bố Tommy (TTS Settings)
                  </h3>
                  <p className="text-xs font-semibold text-gray-400 uppercase">Tùy biến cách Trợ lý xưng hô và phát âm động viên bé yêu</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest block">Tên Của Bé Yêu (Mặc định)</label>
                      <input
                        type="text"
                        value={childName}
                        onChange={(e) => setChildName(e.target.value)}
                        placeholder="Mỹ Linh..."
                        className="w-full border-2 border-gray-100 bg-slate-50 font-bold text-gray-800 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest block">Cách Xưng Hô Của Bố</label>
                      <input
                        type="text"
                        value={daddyName}
                        onChange={(e) => setDaddyName(e.target.value)}
                        placeholder="bố Tommy..."
                        className="w-full border-2 border-gray-100 bg-slate-50 font-bold text-gray-800 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50 border border-gray-100 rounded-2xl">
                      <div>
                        <span className="text-sm font-bold text-gray-700 block">Kích hoạt giọng nói trợ lý</span>
                      </div>
                      <button
                        onClick={() => setTtsEnabled(!ttsEnabled)}
                        className={cn(
                          "w-14 h-8 rounded-full p-1 transition-colors duration-300 focus:outline-none",
                          ttsEnabled ? "bg-emerald-500" : "bg-slate-300"
                        )}
                      >
                        <div className={cn("bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300", ttsEnabled ? "translate-x-6" : "translate-x-0")} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-6 bg-slate-50 border border-gray-100 rounded-[32px] p-6">
                    <h4 className="font-black text-gray-800 text-xs uppercase tracking-widest flex items-center gap-1.5"><Sliders className="w-4 h-4 text-indigo-500" /> Tinh Chỉnh Giọng Đọc Trực Quan</h4>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-gray-600">
                        <span>Tốc Độ Nói: {ttsRate}</span>
                      </div>
                      <input
                        type="range"
                        min="0.8"
                        max="1.2"
                        step="0.05"
                        value={ttsRate}
                        onChange={(e) => setTtsRate(Number(e.target.value))}
                        className="w-full accent-indigo-600"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-gray-600">
                        <span>Tông Cao Giọng: {ttsPitch}</span>
                      </div>
                      <input
                        type="range"
                        min="0.9"
                        max="1.1"
                        step="0.05"
                        value={ttsPitch}
                        onChange={(e) => setTtsPitch(Number(e.target.value))}
                        className="w-full accent-indigo-600"
                      />
                    </div>

                    <div className="pt-4 border-t border-gray-200/60">
                      <button
                        onClick={() => {
                          const originalSettings = getTTSSettings();
                          saveTTSSettings({
                            childName: childName || "Mỹ Linh",
                            daddyName: daddyName || "bố Tommy",
                            rate: ttsRate,
                            pitch: ttsPitch,
                            enabled: true
                          });
                          
                          const speakTest = `Chào ${childName || "con gái yêu"} của ${daddyName || "bố"}! Hôm nay con gái đã sẵn sàng thi giỏi cùng bố chưa nào?`;
                          
                          if (typeof window !== "undefined" && window.speechSynthesis) {
                            window.speechSynthesis.cancel();
                            const utterance = new SpeechSynthesisUtterance(speakTest);
                            utterance.lang = "vi-VN";
                            utterance.rate = ttsRate;
                            utterance.pitch = ttsPitch;
                            window.speechSynthesis.speak(utterance);
                            toast.success("🔊 Đang đọc thử giọng nói ấm áp của bố!");
                          }
                          saveTTSSettings(originalSettings);
                        }}
                        className="w-full bg-[#f4ecd8] border border-[#d4af37]/45 text-amber-900 font-bold py-3.5 rounded-2xl active:scale-95 transition-all text-xs flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        🔊 NGHE THỬ GIỌNG ĐỌC TRỢ LÝ
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-end">
                  <button
                    onClick={handleSaveSettings}
                    className="bg-[#54361e] text-white font-black py-4 px-8 rounded-2xl active:scale-[0.98] transition-all shadow-lg text-sm uppercase tracking-wider"
                  >
                    💾 LƯU CẤU HÌNH &amp; ĐỒNG BỘ ĐÁM MÂY
                  </button>
                </div>
              </div>

              {/* PIN Code settings */}
              <div className="bg-white rounded-[40px] p-8 shadow-xl shadow-gray-200/40 border border-gray-100 space-y-6">
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-gray-800 font-heading uppercase tracking-tight flex items-center gap-2">
                    🔒 Cài Đặt Mã PIN Bảo Mật Cổng Phụ Huynh
                  </h3>
                </div>

                {isSettingNewPin ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-lg">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest block">Nhập mã PIN mới (4 chữ số)</label>
                      <input
                        type="password"
                        maxLength={4}
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="• • • •"
                        className="w-full border-2 border-gray-100 bg-slate-50 font-bold text-center tracking-[0.5em] text-gray-800 rounded-2xl px-4 py-3.5 text-xl focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest block">Xác nhận mã PIN mới</label>
                      <input
                        type="password"
                        maxLength={4}
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="• • • •"
                        className="w-full border-2 border-gray-100 bg-slate-50 font-bold text-center tracking-[0.5em] text-gray-800 rounded-2xl px-4 py-3.5 text-xl focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>

                    <div className="md:col-span-2 flex gap-4 pt-2">
                      <button
                        onClick={handleSavePin}
                        className="bg-[#54361e] text-white font-bold px-6 py-3.5 rounded-xl text-xs uppercase tracking-wider"
                      >
                        Xác nhận lưu PIN
                      </button>
                      <button
                        onClick={() => {
                          setIsSettingNewPin(false);
                          setNewPin("");
                          setConfirmPin("");
                        }}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold px-6 py-3.5 rounded-xl text-xs uppercase tracking-wider"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-5 bg-slate-50 border border-gray-100 rounded-2xl max-w-lg">
                    <div>
                      <span className="text-sm font-bold text-gray-700 block">Mã PIN bảo mật hiện tại: <span className="font-black text-indigo-600">••••</span></span>
                    </div>
                    <button
                      onClick={() => setIsSettingNewPin(true)}
                      className="bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-black px-4 py-2.5 rounded-xl text-xs uppercase tracking-wide transition-colors"
                    >
                      Thay đổi mã PIN
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        <div className="py-6 border-t border-gray-100 text-center text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] shrink-0 mt-auto bg-white">
          © 2026 MÊ THI • CỔNG PHỤ HUYNH BẢO MẬT &amp; ĐỒNG BỘ 💖
        </div>
      </main>

      {/* FULL-SCREEN WAX SEAL FOLIO DETAILED OVERLAY FOR WRONG QUESTION CARD */}
      <AnimatePresence>
        {activeWq && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#150d09]/90 backdrop-blur-md flex items-center justify-center p-4 md:p-6"
          >
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
              <div className="absolute inset-2 border-2 border-dashed border-[#d4af37]/20 rounded-2xl pointer-events-none z-0" />
              
              <div className="hidden md:block absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-8 bg-gradient-to-r from-[#20140c] via-[#483325] to-[#20140c] border-x border-[#130b06] z-20 shadow-2xl">
                <div className="absolute inset-y-0 left-0 right-0 flex flex-col justify-around py-8 pointer-events-none">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-6 w-10 -ml-1 bg-gradient-to-r from-[#9e9e9e] via-[#d6d6d6] to-[#595959] rounded-full border border-black/40 shadow-md self-center" />
                  ))}
                </div>
              </div>

              <button 
                onClick={handleCloseWqDetails}
                className="absolute top-4 right-4 md:top-6 md:right-6 w-12 h-12 rounded-full bg-[#800020] hover:bg-[#9c1836] border-2 border-[#d4af37] shadow-lg flex items-center justify-center text-white active:scale-95 transition-all cursor-pointer z-50 hover:rotate-12 duration-200"
                style={{ boxShadow: "0 4px 10px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.2)" }}
              >
                <X className="w-5 h-5 text-amber-100" />
              </button>

              <div className="w-full md:w-1/2 h-1/2 md:h-full overflow-y-auto p-6 md:p-8 bg-[#faf7f0] border-r border-[#e3dac9] relative z-10"
                   style={{
                     backgroundImage: "radial-gradient(#e5d9bf 1px, transparent 1px)",
                     backgroundSize: "24px 24px"
                   }}>
                <div className="max-w-xl mx-auto space-y-6">
                  <div className="border-b-2 border-double border-[#54361e]/20 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-amber-800 uppercase tracking-widest font-mono">
                        CHI TIẾT LỖI SAI SỐ #{activeWq.id.slice(0, 6).toUpperCase()}
                      </span>
                      <span className="bg-rose-50 text-red-800 border border-red-200 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                        Sổ tay lỗi
                      </span>
                    </div>
                    <h2 className="text-xl font-bold font-serif text-[#3e291b] mt-1">
                      📖 Đề gốc: {activeWq.examTitle}
                    </h2>
                  </div>

                  <div className="space-y-4">
                    <span className="bg-red-700 text-white text-[10px] font-black px-3 py-1 rounded-md uppercase tracking-wider border border-red-600">
                      NỘI DUNG CÂU HỎI
                    </span>
                    <div className="text-[#2c221a] font-serif text-[17px] leading-relaxed whitespace-pre-line pl-3 border-l-4 border-red-500/40 py-1">
                      <span className="text-blue-600 font-black mr-1">Câu {activeWq.question.number}:</span>
                      <TextWithFractions text={activeWq.question.text} />
                    </div>
                  </div>

                  {activeWq.question.illustrationSvg && (
                    <div className="bg-white border-2 border-[#e6dec9] rounded-2xl p-4 flex justify-center shadow-md">
                      <div dangerouslySetInnerHTML={{ __html: activeWq.question.illustrationSvg }} className="max-w-full" />
                    </div>
                  )}

                  {/* Comparisons choices inside details folio modal */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 shadow-sm">
                      <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">✗ Bé đã chọn sai:</p>
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
                                isWrong ? "bg-red-50 border-red-300 text-red-850" :
                                "bg-white border-[#e3dac9] text-slate-650"
                              )}
                            >
                              <span className={cn(
                                "w-6.5 h-6.5 rounded-full flex items-center justify-center font-black text-[11px] shrink-0 border-2",
                                isCorrect ? "bg-emerald-600 text-white border-emerald-500" :
                                isWrong ? "bg-red-500 text-white border-red-400" :
                                "bg-slate-100 text-slate-600 border-slate-200"
                              )}>
                                {c.id}
                              </span>
                              <span className="font-serif text-[14px]"><TextWithFractions text={c.text} /></span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full md:w-1/2 h-1/2 md:h-full flex flex-col bg-[#fbf9f4] relative z-10">
                <div className="flex bg-[#ebdcb9]/40 border-b border-[#e3dac9] shrink-0">
                  <button
                    onClick={() => {
                      saveWrongScratch();
                      setWqTab("details");
                    }}
                    className={cn(
                      "flex-1 py-4 font-black text-xs uppercase tracking-widest transition-all duration-350 border-b-4",
                      wqTab === "details" ? "border-[#54361e] text-[#54361e] bg-[#fbf9f4]" : "border-transparent text-slate-450 hover:bg-[#ebdcb9]/20"
                    )}
                  >
                    <BookOpen className="w-4 h-4" /> 📖 CẨM NANG KHẮC PHỤC
                  </button>
                  <button
                    onClick={() => setWqTab("scratchpad")}
                    className={cn(
                      "flex-1 py-4 font-black text-xs uppercase tracking-widest transition-all duration-350 border-b-4",
                      wqTab === "scratchpad" ? "border-[#54361e] text-[#54361e] bg-[#fbf9f4]" : "border-transparent text-slate-455 hover:bg-[#ebdcb9]/20"
                    )}
                  >
                    <Pencil className="w-4 h-4" /> ✏️ BẢNG VẼ TỰ ÔN
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                  {wqTab === "details" ? (
                    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-300">
                      <div className="bg-[#faf6eb] border-2 border-[#e3dac9] rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
                        <div className="absolute right-0 top-0 w-2 h-full bg-[#d4af37]" />
                        <h4 className="text-xs font-black text-amber-800 uppercase tracking-widest flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-600" /> PHƯƠNG PHÁP &amp; HƯỚNG DẪN TỪNG BƯỚC
                        </h4>
                        <div className="text-sm text-slate-750 leading-relaxed font-serif whitespace-pre-line border-l-2 border-amber-300/30 pl-4">
                          <TextWithFractions text={activeWq.aiSolution || activeWq.question.solution || "Chưa có giải nghĩa chi tiết cho câu hỏi này."} />
                        </div>
                      </div>

                      <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-5 shadow-sm space-y-3">
                        <h4 className="text-xs font-black text-rose-800 uppercase tracking-widest">BẪY TOÁN HỌC: BÉ CẦN TRÁNH GÌ?</h4>
                        <p className="text-xs text-rose-950/70 leading-relaxed pl-3 border-l-2 border-rose-300/60 font-medium">
                          {activeWq.question.hint || "Lưu ý bẫy đề thi: Chú ý thật cẩn thận với giả thiết toán học, không vội vàng phỏng đoán phép tính."}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col bg-[#faf7f0] rounded-2xl border-2 border-[#e3dac9] overflow-hidden shadow-inner relative animate-in fade-in duration-300">
                      <div className="bg-white border-b border-[#e3dac9] px-3.5 py-2.5 flex items-center justify-between flex-wrap gap-2 shrink-0 z-10">
                        <div className="flex items-center gap-1">
                          {["#dc2626", "#2563eb", "#16a34a", "#1e293b", "#d97706"].map(c => (
                            <button
                              key={c}
                              onClick={() => {
                                setPenSettings(p => ({ ...p, color: c }));
                                setEraserMode(false);
                              }}
                              className={cn(
                                "w-6 h-6 rounded-full border shadow-sm transition-transform",
                                penSettings.color === c && !eraserMode ? "scale-115 ring-2 ring-[#54361e] border-white" : "border-slate-300"
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
                            className={cn("p-1.5 rounded-lg border text-xs font-black uppercase transition-all", penSettings.style === "pencil" && !eraserMode ? "bg-amber-100 text-amber-900 border-[#d4af37]/50" : "bg-slate-50 text-slate-650")}
                          >
                            ✏️ Chì mềm
                          </button>
                          <button
                            onClick={() => setEraserMode(!eraserMode)}
                            className={cn("p-1.5 rounded-lg border text-xs font-black uppercase", eraserMode ? "bg-rose-600 text-white border-rose-500 shadow-sm" : "bg-slate-50 text-slate-650")}
                          >
                            🧹 Tẩy nét
                          </button>
                          <button onClick={() => canvasRef.current?.undoLast()} className="p-1.5 rounded-lg border bg-slate-50 text-slate-650 text-xs font-black">
                            ↩ Lùi
                          </button>
                          <button onClick={() => canvasRef.current?.clearAll()} className="p-1.5 rounded-lg border bg-red-50 text-red-650 text-xs font-black">
                            🗑 Xóa
                          </button>
                        </div>
                      </div>

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
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FULL DETAILED ATTEMPT HISTORY BREAKDOWN OVERLAY */}
      <AnimatePresence>
        {activeSession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#121620]/85 backdrop-blur-md flex items-center justify-center p-4 md:p-6"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white w-full max-w-4xl h-[85vh] rounded-[40px] shadow-2xl border-2 border-indigo-100 overflow-hidden flex flex-col"
            >
              <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between shrink-0 relative overflow-hidden">
                <div className="space-y-1">
                  <span className="text-[10px] bg-white/20 border border-white/20 text-[#ffe29a] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    📜 BÁO CÁO KẾT QUẢ BÀI LÀM CHI TIẾT
                  </span>
                  <h2 className="text-lg md:text-xl font-black font-serif text-white mt-1">
                    {exams.find(e => e.id === activeSession.examId)?.title || "Lịch sử đề luyện thi"}
                  </h2>
                </div>
                <button onClick={() => setActiveSession(null)} className="p-2.5 hover:bg-white/10 text-white rounded-2xl border border-white/20 transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50 space-y-6">
                <div className="bg-white border border-indigo-100 rounded-3xl p-5 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="border-r border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Tỉ lệ đúng</span>
                    <span className="text-2xl font-black text-indigo-600">
                      {activeSession.score !== undefined && activeSession.totalPoints 
                        ? Math.round((activeSession.score / activeSession.totalPoints) * 100) 
                        : 0}%
                    </span>
                  </div>
                  <div className="border-r border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Tổng điểm</span>
                    <span className="text-2xl font-black text-slate-800">{activeSession.score} / {activeSession.totalPoints}</span>
                  </div>
                  <div className="border-r border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Thời gian thi</span>
                    <span className="text-lg font-black text-slate-700 flex items-center justify-center gap-1 mt-0.5">
                      <Clock className="w-4 h-4 text-slate-350" />
                      {activeSession.timeUsed ? `${Math.floor(activeSession.timeUsed / 60)}p ${activeSession.timeUsed % 60}s` : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Trạng thái</span>
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full inline-block mt-0.5">
                      ĐÃ NỘP
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  {(() => {
                    const exam = exams.find(e => e.id === activeSession.examId);
                    const allQs = exam?.sections.flatMap(s => s.questions) || [];
                    return allQs.map((question) => {
                      const stAns = activeSession.answers.find(a => a.questionId === question.id);
                      const isCorrect = stAns?.value === question.correctAnswer;
                      
                      return (
                        <div key={question.id} className={cn("bg-white border-2 rounded-3xl p-5 shadow-sm space-y-3 relative overflow-hidden", isCorrect ? "border-emerald-100" : "border-red-100")}>
                          <div className={cn("absolute right-0 top-0 w-2.5 h-full", isCorrect ? "bg-emerald-500" : "bg-red-500")} />
                          <div className="flex items-center justify-between gap-3 border-b border-dashed border-slate-100 pb-2.5 flex-wrap">
                            <span className="text-[10px] font-black text-slate-400 uppercase">Câu số {question.number}</span>
                            <span className={cn("text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-sm", isCorrect ? "bg-emerald-50 text-emerald-850" : "bg-red-50 text-red-850")}>
                              {isCorrect ? "✓ Đúng" : "✗ Sai"}
                            </span>
                          </div>
                          <p className="text-sm font-serif text-slate-800 leading-relaxed font-bold">
                            <TextWithFractions text={question.text} />
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div className="bg-slate-50/50 rounded-xl p-3 border">
                              <span className="text-[9px] font-black text-slate-400 block mb-0.5">Bé chọn:</span>
                              <span className={cn("text-xs font-black font-serif", isCorrect ? "text-emerald-850" : "text-red-850")}>
                                {stAns?.value ? <TextWithFractions text={stAns.value} /> : <span className="italic text-slate-400">Bỏ trống</span>}
                              </span>
                            </div>
                            <div className="bg-slate-50/50 rounded-xl p-3 border">
                              <span className="text-[9px] font-black text-slate-400 block mb-0.5">Đáp án đúng:</span>
                              <span className="text-xs font-black text-slate-800 font-serif">
                                <TextWithFractions text={question.correctAnswer || "Chưa có"} />
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-white flex justify-end shrink-0">
                <button onClick={() => setActiveSession(null)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3.5 px-10 rounded-2xl text-xs uppercase tracking-widest shadow-md">
                  Đóng báo cáo
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default ParentsPortal;
