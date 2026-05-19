import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Filter, History, Trash2, ChevronRight, X, Brain, Library } from "lucide-react";
import { Exam, DIFFICULTY_INFO, ExamStats, ExamSession } from "@/types/exam";
import { getExams, deleteExam, setSourceExam, getExamStatsFixed, updateExamTitle, saveExam, getSessions } from "@/lib/storage";
import { getCreditsRemaining } from "@/lib/gemini";
import { SAMPLE_EXAMS, SUBJECTS, ALL_GRADES } from "@/constants/exams";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ExamsPage: React.FC = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [selectedExamHistory, setSelectedExamHistory] = useState<string | null>(null);

  useEffect(() => {
    setExams(getExams());
  }, []);

  const sessions = getSessions();

  const handleDelete = (id: string) => {
    if (SAMPLE_EXAMS.find((e) => e.id === id)) return;
    deleteExam(id);
    setExams(getExams());
  };

  const handleUpdateTitle = (id: string, newTitle: string) => {
    if (SAMPLE_EXAMS.find((e) => e.id === id)) return;
    updateExamTitle(id, newTitle);
    setExams(getExams());
  };

  const handleToggleSource = (id: string, current: boolean) => {
    setSourceExam(id, !current);
    setExams(getExams());
  };

  const handleSaveToLibrary = (exam: Exam) => {
    saveExam(exam); // Hàm saveExam đã được nâng cấp để tự động lưu câu hỏi vào thư viện
    toast.success("✅ Đã lưu tất cả câu hỏi vào Thư Viện!");
  };

  const filteredExams = exams.filter(e => {
    const matchSubject = subjectFilter === "all" || e.subject === subjectFilter;
    const matchGrade = gradeFilter === "all" || e.grade === gradeFilter;
    const matchDifficulty = difficultyFilter === "all" || e.difficulty === difficultyFilter;
    return matchSubject && matchGrade && matchDifficulty;
  }).sort((a, b) => {
    const la = a.difficulty ? DIFFICULTY_INFO[a.difficulty].level : 99;
    const lb = b.difficulty ? DIFFICULTY_INFO[b.difficulty].level : 99;
    if (la !== lb) return la - lb;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-blue-700 text-white px-5 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/")} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-black font-heading tracking-tight">THI</h1>
        </div>
        <button 
          onClick={() => navigate("/ai-create")}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-2xl font-black text-xs transition-all shadow-lg shadow-indigo-900/20 active:scale-95"
        >
          <Brain className="w-4 h-4" />
          TẠO ĐỀ AI ({getCreditsRemaining()})
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-200 p-3 shadow-sm flex flex-wrap gap-2">
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="flex-1 bg-blue-50/50 border-2 border-blue-100 rounded-xl px-3 py-2 text-sm font-bold text-blue-700 outline-none"
          >
            <option value="all">📚 Tất cả môn</option>
            {SUBJECTS.map(s => <option key={s.id} value={s.label}>{s.icon} {s.label}</option>)}
          </select>

          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="flex-1 bg-emerald-50/50 border-2 border-emerald-100 rounded-xl px-3 py-2 text-sm font-bold text-emerald-700 outline-none"
          >
            <option value="all">🎓 Tất cả lớp</option>
            {ALL_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="flex-1 bg-orange-50/50 border-2 border-orange-100 rounded-xl px-3 py-2 text-sm font-bold text-orange-700 outline-none"
          >
            <option value="all">🎯 Tất cả độ khó</option>
            {Object.entries(DIFFICULTY_INFO).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </div>

        {/* List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredExams.map(exam => (
            <ExamCard 
              key={exam.id} 
              exam={exam} 
              stats={getExamStatsFixed(exam.id)}
              onStart={() => navigate(`/exam/${exam.id}`)}
              onDelete={SAMPLE_EXAMS.find(e => e.id === exam.id) ? undefined : () => handleDelete(exam.id)}
              onUpdateTitle={SAMPLE_EXAMS.find(e => e.id === exam.id) ? undefined : (t) => handleUpdateTitle(exam.id, t)}
              onToggleSource={() => handleToggleSource(exam.id, !!exam.isSourceExam)}
              onShowHistory={() => setSelectedExamHistory(exam.id)}
              onSaveToLibrary={() => handleSaveToLibrary(exam)}
              historyCount={sessions.filter(s => s.examId === exam.id).length}
            />
          ))}
        </div>

        {filteredExams.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100">
            <p className="text-gray-400 font-bold">Không tìm thấy đề thi phù hợp</p>
          </div>
        )}
      </div>

      {/* History Modal */}
      {selectedExamHistory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-purple-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <History className="w-6 h-6" />
                <h2 className="text-xl font-black uppercase tracking-tight">Lịch sử làm bài</h2>
              </div>
              <button 
                onClick={() => setSelectedExamHistory(null)}
                className="p-2 hover:bg-white/20 rounded-full transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {sessions.filter(s => s.examId === selectedExamHistory).length > 0 ? (
                sessions
                  .filter(s => s.examId === selectedExamHistory)
                  .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime())
                  .map((session, idx) => (
                    <div 
                      key={session.id}
                      className="bg-slate-50 border-2 border-slate-100 rounded-3xl p-4 flex items-center justify-between hover:border-purple-200 transition-all cursor-pointer group"
                      onClick={() => navigate(`/result/${session.id}`)}
                    >
                      <div className="space-y-1">
                        <p className="text-xs font-black text-slate-400 uppercase">Lần {sessions.filter(s => s.examId === selectedExamHistory).length - idx}</p>
                        <p className="font-bold text-slate-700">{new Date(session.completedAt || "").toLocaleString('vi-VN')}</p>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <p className="text-2xl font-black text-purple-600">{session.score}%</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Kết quả</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-purple-400 transition-all" />
                      </div>
                    </div>
                  ))
              ) : (
                <div className="text-center py-10">
                  <p className="text-slate-400 font-bold">Chưa có lịch sử làm bài cho đề này</p>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-50">
              <button 
                onClick={() => setSelectedExamHistory(null)}
                className="w-full bg-slate-100 text-slate-600 font-black py-4 rounded-2xl active:scale-95 transition-all uppercase tracking-widest"
              >
                Đóng lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ExamCard: React.FC<{
  exam: Exam;
  stats: ExamStats;
  onStart: () => void;
  onUpdateTitle?: (title: string) => void;
  onDelete?: () => void;
  onToggleSource?: () => void;
  onShowHistory: () => void;
  onSaveToLibrary: () => void;
  historyCount: number;
}> = ({ exam, stats, onStart, onUpdateTitle, onDelete, onToggleSource, onShowHistory, onSaveToLibrary, historyCount }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(exam.title);
  const diffInfo = exam.difficulty ? DIFFICULTY_INFO[exam.difficulty] : DIFFICULTY_INFO['normal'];

  return (
    <div className="bg-white rounded-[24px] border border-gray-200 p-5 space-y-4 shadow-sm hover:shadow-md transition-all">
      <div className="flex justify-between items-start gap-3">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${diffInfo.color}`}>{diffInfo.icon} {diffInfo.label}</span>
            <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">{exam.subject}</span>
            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full">{exam.grade}</span>
          </div>
          
          {isEditing ? (
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => {
                onUpdateTitle?.(editValue);
                setIsEditing(false);
              }}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
              className="w-full font-black text-gray-800 text-lg border-b-2 border-blue-500 outline-none"
            />
          ) : (
            <h3 
              onClick={() => onUpdateTitle && setIsEditing(true)}
              className="font-black text-gray-800 text-lg leading-tight line-clamp-2 cursor-pointer hover:text-blue-600 transition-colors"
            >
              {exam.title}
            </h3>
          )}
        </div>
        
        <div className="flex gap-1 shrink-0">
          <button 
            onClick={onSaveToLibrary}
            className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-xl transition-all"
            title="Lưu tất cả câu hỏi vào Thư Viện"
          >
            <Library className="w-5 h-5" />
          </button>
          <button 
            onClick={onShowHistory}
            className={cn(
              "p-2 rounded-xl transition-all relative",
              historyCount > 0 ? "bg-purple-50 text-purple-600 hover:bg-purple-100" : "text-gray-300 hover:bg-gray-100"
            )}
            title="Xem lịch sử làm bài"
          >
            <History className="w-5 h-5" />
            {historyCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                {historyCount}
              </span>
            )}
          </button>
          <button onClick={onToggleSource} className={`p-2 rounded-xl transition-all ${exam.isSourceExam ? 'bg-orange-100 text-orange-600' : 'text-gray-300 hover:bg-gray-100'}`} title="Đánh dấu đề gốc">📌</button>
          {onDelete && <button onClick={onDelete} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Xóa đề thi">🗑</button>}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs font-bold text-gray-400">
        <span>⏱ {exam.duration} phút</span>
        <span>📋 {exam.sections.reduce((a, s) => a + s.questions.length, 0)} câu</span>
        {stats.attemptCount > 0 && <span className="text-emerald-500">🎯 Tốt nhất: {stats.bestScore}%</span>}
      </div>

      <button
        onClick={onStart}
        className="w-full bg-blue-600 text-white font-black py-3.5 rounded-2xl shadow-lg shadow-blue-100 active:scale-95 transition-all uppercase"
      >
        Vào Thi Ngay
      </button>
    </div>
  );
};

export default ExamsPage;
