import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Brain, Sparkles, Wand2, ChevronRight, Info, Upload, Image as ImageIcon, FileText } from "lucide-react";
import { Difficulty, Exam, DIFFICULTY_INFO } from "@/types/exam";
import { getExams, saveExam, setSourceExam, generateId } from "@/lib/storage";
import { SUBJECTS, ALL_GRADES } from "@/constants/exams";
import { generateExam, getCreditsRemaining } from "@/lib/gemini";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import UploadExam from "@/components/features/UploadExam";

const AICreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [activeMode, setActiveMode] = useState<'ai' | 'ocr'>('ai');
  const [isGenerating, setIsGenerating] = useState(false);
  const [credits, setCredits] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadInitialMode, setUploadInitialMode] = useState<'camera' | 'file' | null>(null);
  const [uploadInitialFile, setUploadInitialFile] = useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // AI Options
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>("normal");
  const [selectedSubject, setSelectedSubject] = useState("Toán");
  const [selectedGrade, setSelectedGrade] = useState("Lớp 4");
  const [selectedSourceExamId, setSelectedSourceExamId] = useState<string>("");
  const [selectedQuestionCount, setSelectedQuestionCount] = useState(10);

  const exams = getExams();
  const sourceExams = exams.filter((e) => e.isSourceExam);

  useEffect(() => {
    setCredits(getCreditsRemaining());
  }, []);

  const openFilePicker = (mode: 'camera' | 'file') => {
    if (!fileInputRef.current) return;
    if (mode === 'camera') {
      fileInputRef.current.accept = "image/*";
      (fileInputRef.current as any).capture = "environment";
    } else {
      fileInputRef.current.accept = "image/*,application/pdf,.pdf,.docx,.doc";
      fileInputRef.current.removeAttribute("capture");
    }
    fileInputRef.current.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadInitialFile(file);
      setShowUploadModal(true);
    }
    e.target.value = "";
  };

  const handleGenerate = async () => {
    if (isGenerating) return;
    
    // Validate source exam if any
    let sourceExamObj: Partial<Exam> | null = null;
    if (selectedSourceExamId) {
      sourceExamObj = exams.find((e) => e.id === selectedSourceExamId) || null;
    }

    // Default source if none selected (to provide context to AI)
    if (!sourceExamObj) {
      sourceExamObj = {
        title: `Đề ${selectedSubject} ${selectedGrade}`,
        subject: selectedSubject,
        grade: selectedGrade,
        sections: []
      };
    }

    try {
      setIsGenerating(true);
      toast.loading("AI đang miệt mài soạn đề cho bé...");

      const sections = await generateExam(
        sourceExamObj as any,
        selectedDifficulty,
        selectedQuestionCount
      );

      const newExamId = generateId();
      const newExam: Exam = {
        id: newExamId,
        title: `Đề ${selectedSubject} ${selectedGrade} - ${DIFFICULTY_INFO[selectedDifficulty].label} (AI)`,
        subject: selectedSubject,
        grade: selectedGrade,
        duration: 40,
        totalPoints: 10,
        isAIGenerated: true,
        createdAt: new Date().toISOString().split("T")[0],
        sections,
        difficulty: selectedDifficulty
      };

      saveExam(newExam);
      toast.dismiss();
      toast.success("🚀 Đã tạo đề thi thành công!");
      navigate(`/exam/${newExamId}`);
    } catch (error: any) {
      toast.dismiss();
      toast.error(`Lỗi tạo đề: ${error.message}`);
    } finally {
      setIsGenerating(false);
      setCredits(getCreditsRemaining());
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header - Dynamic Color */}
      <div className={cn(
        "text-white px-5 py-4 flex items-center justify-between sticky top-0 z-50 transition-colors duration-500",
        activeMode === 'ai' ? "bg-indigo-600 shadow-lg shadow-indigo-100" : "bg-emerald-600 shadow-lg shadow-emerald-100"
      )}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/")} className="p-2 hover:bg-white/10 rounded-xl transition-all active:scale-90">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-black font-heading tracking-tight uppercase">Tạo Đề Thi Mới</h1>
        </div>
        <div className="bg-white/20 px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest flex items-center gap-1.5 backdrop-blur-md">
          <Brain className="w-3.5 h-3.5" /> {credits} LƯỢT HÔM NAY
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-8 mt-2">
        {/* Mode Selection Landing - Bigger and Better */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => setActiveMode('ai')}
            className={cn(
              "group relative p-8 rounded-[40px] border-4 transition-all flex flex-col items-center text-center gap-4 shadow-xl overflow-hidden",
              activeMode === 'ai' 
                ? "bg-white border-indigo-600 scale-[1.02] ring-4 ring-indigo-50" 
                : "bg-white border-gray-100 text-gray-400 hover:border-indigo-200 hover:scale-[1.01]"
            )}
          >
            {activeMode === 'ai' && (
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Sparkles className="w-20 h-20 text-indigo-600" />
              </div>
            )}
            <div className={cn(
              "w-20 h-20 rounded-3xl flex items-center justify-center shrink-0 shadow-lg transition-transform group-hover:rotate-6",
              activeMode === 'ai' ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-400"
            )}>
              <Wand2 className="w-10 h-10" />
            </div>
            <div>
              <p className={cn("font-black text-2xl font-heading leading-tight uppercase mb-1", activeMode === 'ai' ? "text-indigo-600" : "text-gray-500")}>Soạn đề bằng AI</p>
              <p className="text-xs font-bold uppercase tracking-widest opacity-60">Tự động tạo từ yêu cầu</p>
            </div>
          </button>

          <button
            onClick={() => setActiveMode('ocr')}
            className={cn(
              "group relative p-8 rounded-[40px] border-4 transition-all flex flex-col items-center text-center gap-4 shadow-xl overflow-hidden",
              activeMode === 'ocr' 
                ? "bg-white border-emerald-600 scale-[1.02] ring-4 ring-emerald-50" 
                : "bg-white border-gray-100 text-gray-400 hover:border-emerald-200 hover:scale-[1.01]"
            )}
          >
            {activeMode === 'ocr' && (
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Upload className="w-20 h-20 text-emerald-600" />
              </div>
            )}
            <div className={cn(
              "w-20 h-20 rounded-3xl flex items-center justify-center shrink-0 shadow-lg transition-transform group-hover:-rotate-6",
              activeMode === 'ocr' ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-400"
            )}>
              <ImageIcon className="w-10 h-10" />
            </div>
            <div>
              <p className={cn("font-black text-2xl font-heading leading-tight uppercase mb-1", activeMode === 'ocr' ? "text-emerald-600" : "text-gray-500")}>Quét đề từ ảnh/file</p>
              <p className="text-xs font-bold uppercase tracking-widest opacity-60">Công nghệ OCR thông minh</p>
            </div>
          </button>
        </div>

        {activeMode === 'ai' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* AI Configuration Content */}
            <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700">
                <Sparkles className="w-32 h-32 text-indigo-600" />
              </div>
              <div className="relative z-10 space-y-2">
                <h2 className="text-3xl font-black text-gray-800 font-heading leading-none">Trợ lý giáo viên AI 🤖</h2>
                <p className="text-gray-500 font-medium leading-relaxed max-w-lg">
                  Chỉ cần chọn môn học và khối lớp, AI sẽ tự động biên soạn một đề thi chuẩn chương trình giáo dục Việt Nam.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Section 1: Cơ bản */}
              <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black">1</div>
                  <h3 className="font-black text-gray-800 uppercase tracking-widest text-sm">Thông tin cơ bản</h3>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Môn học</label>
                    <select 
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold text-gray-700 outline-none focus:border-indigo-400 transition-all appearance-none cursor-pointer"
                    >
                      {SUBJECTS.map(s => <option key={s.id} value={s.label}>{s.icon} {s.label}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Khối lớp</label>
                    <select 
                      value={selectedGrade}
                      onChange={(e) => setSelectedGrade(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold text-gray-700 outline-none focus:border-indigo-400 transition-all appearance-none cursor-pointer"
                    >
                      {ALL_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Độ khó & Số lượng */}
              <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-black">2</div>
                  <h3 className="font-black text-gray-800 uppercase tracking-widest text-sm">Cấu hình đề thi</h3>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Độ khó mong muốn</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.entries(DIFFICULTY_INFO) as [Difficulty, any][]).map(([key, info]) => (
                        <button
                          key={key}
                          onClick={() => setSelectedDifficulty(key)}
                          className={cn(
                            "px-3 py-2.5 rounded-xl text-[11px] font-black border-2 transition-all flex items-center justify-center gap-1.5",
                            selectedDifficulty === key 
                              ? "bg-orange-500 text-white border-orange-500 shadow-md scale-[1.02]" 
                              : "bg-white text-gray-400 border-gray-100 hover:border-orange-200"
                          )}
                        >
                          {info.icon} {info.label.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Số lượng câu hỏi: {selectedQuestionCount}</label>
                    <input 
                      type="range" min={5} max={20} step={1}
                      value={selectedQuestionCount}
                      onChange={(e) => setSelectedQuestionCount(Number(e.target.value))}
                      className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <div className="flex justify-between text-[10px] font-black text-gray-300">
                      <span>5 CÂU</span>
                      <span>20 CÂU</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Đề gốc (Tùy chọn) */}
              <div className="md:col-span-2 bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-black">3</div>
                  <h3 className="font-black text-gray-800 uppercase tracking-widest text-sm">Dựa trên đề có sẵn (Tùy chọn)</h3>
                </div>
                
                <div className="flex flex-col md:flex-row gap-4 items-center">
                  <div className="flex-1 w-full space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Chọn đề gốc để AI tham khảo cấu trúc</label>
                    <select 
                      value={selectedSourceExamId}
                      onChange={(e) => setSelectedSourceExamId(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold text-gray-700 outline-none focus:border-indigo-400 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">-- Không sử dụng đề gốc (Tự động soạn mới) --</option>
                      {sourceExams.map(e => (
                        <option key={e.id} value={e.id}>{e.subject} - {e.grade} - {e.title}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={handleGenerate}
                disabled={isGenerating || credits <= 0}
                className={cn(
                  "w-full py-6 rounded-[32px] font-black text-xl font-heading tracking-widest flex items-center justify-center gap-4 transition-all shadow-xl",
                  isGenerating || credits <= 0
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:scale-[1.02] active:scale-[0.98] shadow-indigo-200"
                )}
              >
                {isGenerating ? (
                  <>
                    <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
                    ĐANG SOẠN ĐỀ...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-7 h-7" />
                    BẮT ĐẦU TẠO ĐỀ NGAY ✨
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* OCR Content */}
            <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 space-y-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-24 h-24 rounded-[40px] bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-lg">
                  <Upload className="w-12 h-12" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-gray-800 font-heading leading-none uppercase">Số hóa đề thi thông minh 📸</h2>
                  <p className="text-gray-500 font-medium leading-relaxed max-w-md mx-auto">
                    Chụp ảnh đề thi giấy hoặc tải lên file tài liệu, AI sẽ tự động nhận diện câu hỏi và tạo đề thi tương tác cho bé.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                <button 
                  onClick={() => openFilePicker('file')}
                  className="bg-slate-50 p-6 rounded-[32px] border-2 border-dashed border-slate-200 space-y-4 flex flex-col items-center justify-center text-center hover:border-emerald-400 hover:bg-emerald-50 transition-all group"
                >
                  <ImageIcon className="w-10 h-10 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                  <div>
                    <p className="font-black text-slate-600 uppercase text-sm group-hover:text-emerald-700">Hình ảnh / PDF</p>
                    <p className="text-xs text-slate-400 font-medium">Hỗ trợ chụp ảnh trực tiếp</p>
                  </div>
                </button>
                <button 
                  onClick={() => openFilePicker('file')}
                  className="bg-slate-50 p-6 rounded-[32px] border-2 border-dashed border-slate-200 space-y-4 flex flex-col items-center justify-center text-center hover:border-emerald-400 hover:bg-emerald-50 transition-all group"
                >
                  <FileText className="w-10 h-10 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                  <div>
                    <p className="font-black text-slate-600 uppercase text-sm group-hover:text-emerald-700">File Word (DOCX)</p>
                    <p className="text-xs text-slate-400 font-medium">Nhận diện văn bản cực nhanh</p>
                  </div>
                </button>
              </div>

              <button
                onClick={() => openFilePicker('camera')}
                className="w-full py-6 rounded-[32px] bg-emerald-600 text-white font-black text-xl font-heading tracking-widest flex items-center justify-center gap-4 transition-all shadow-xl shadow-emerald-100 hover:scale-[1.02] active:scale-[0.98]"
              >
                <ImageIcon className="w-7 h-7" />
                BẮT ĐẦU QUÉT ĐỀ ✨
              </button>
            </div>
            
            {/* Tips Card */}
            <div className="bg-blue-50 rounded-[32px] p-6 border border-blue-100 flex gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Info className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="font-black text-blue-800 text-sm uppercase">Mẹo nhỏ cho bé</p>
                <p className="text-blue-600 text-xs font-medium leading-relaxed">
                  Bé hãy chụp ảnh thật rõ nét, đủ ánh sáng và không bị rung tay để AI có thể "đọc" đề thi chính xác nhất nhé!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* OCR Modal */}
      <UploadExam 
        isOpen={showUploadModal} 
        initialMode={uploadInitialMode}
        initialFile={uploadInitialFile}
        onClose={() => {
          setShowUploadModal(false);
          setUploadInitialMode(null);
          setUploadInitialFile(null);
        }} 
        onExamReady={(exam, isSource) => {
          saveExam(exam);
          if (isSource) setSourceExam(exam.id, true);
          toast.success("🚀 Đã số hóa đề thi thành công!");
          navigate(`/exam/${exam.id}`);
        }}
      />
    </div>
  );
};

export default AICreatePage;

