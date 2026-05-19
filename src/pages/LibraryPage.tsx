import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Gamepad2, Search, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { getLibraryQuestions, deleteLibraryQuestion, updateExamTitle } from "@/lib/storage";
import { LibraryQuestion } from "@/types/exam";
import { toast } from "sonner";
import { SAMPLE_EXAMS } from "@/constants/exams";
import { TextWithFractions } from "@/components/features/FractionDisplay";
import { cn } from "@/lib/utils";

const LibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<LibraryQuestion[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => setQuestions(getLibraryQuestions());

  const handleDelete = (id: string, examId: string) => {
    if (!window.confirm("Bạn có chắc muốn xóa câu hỏi này khỏi Thư Viện?"))
      return;
    deleteLibraryQuestion(id, examId);
    loadData();
    toast.success("Đã xóa câu hỏi");
  };

  const handleUpdateExamTitle = (examId: string) => {
    if (SAMPLE_EXAMS.find(e => e.id === examId)) {
      toast.error("Không thể sửa đề mẫu");
      return;
    }
    if (editTitleValue.trim()) {
      updateExamTitle(examId, editTitleValue.trim());
      loadData();
      toast.success("Đã cập nhật tên đề thi!");
    }
    setEditingExamId(null);
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  const subjects = Array.from(new Set(questions.map(q => q.subject)));
  const filteredQuestions = selectedSubject === "all" 
    ? questions 
    : questions.filter(q => q.subject === selectedSubject);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-amber-500 text-white px-5 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/")} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-black font-heading tracking-tight uppercase">Thư Viện Câu Hỏi</h1>
        </div>
        <button 
          onClick={() => navigate("/game")}
          className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition-all flex items-center gap-2"
        >
          <Gamepad2 className="w-6 h-6" />
          <span className="text-xs font-black hidden md:inline uppercase">Chơi Game</span>
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Filter Bar */}
        {subjects.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-3 shadow-sm">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full bg-amber-50 border-2 border-amber-100 rounded-xl px-4 py-2 text-sm font-bold text-amber-700 outline-none appearance-none cursor-pointer"
            >
              <option value="all">📚 Tất cả môn học ({questions.length})</option>
              {subjects.map(s => (
                <option key={s} value={s}>{s} ({questions.filter(q => q.subject === s).length})</option>
              ))}
            </select>
          </div>
        )}

        {/* Empty State */}
        {questions.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100 space-y-4">
            <div className="text-5xl">📚</div>
            <div className="space-y-1">
              <p className="text-gray-400 font-black text-lg">Thư viện đang trống</p>
              <p className="text-gray-400 text-sm">Bé hãy làm bài thi và nhấn "Lưu vào thư viện" để ôn tập nhé!</p>
            </div>
            <button 
              onClick={() => navigate("/")}
              className="bg-blue-600 text-white font-black px-6 py-3 rounded-2xl shadow-lg shadow-blue-100 active:scale-95 transition-all"
            >
              QUAY VỀ TRANG CHỦ
            </button>
          </div>
        )}

        {/* Question List */}
        <div className="grid grid-cols-1 gap-4">
          {filteredQuestions.map((q) => (
            <div key={`${q.examId}-${q.id}`} className="bg-white rounded-[24px] border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all">
              <div className="p-5 space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">{q.subject}</span>
                      
                      {editingExamId === q.examId ? (
                        <input
                          autoFocus
                          value={editTitleValue}
                          onChange={(e) => setEditTitleValue(e.target.value)}
                          onBlur={() => handleUpdateExamTitle(q.examId)}
                          onKeyDown={(e) => e.key === 'Enter' && handleUpdateExamTitle(q.examId)}
                          className="text-[10px] font-black text-gray-500 border-b border-amber-500 outline-none bg-amber-50 px-1"
                        />
                      ) : (
                        <span 
                          onClick={() => {
                            if (!SAMPLE_EXAMS.find(ex => ex.id === q.examId)) {
                              setEditingExamId(q.examId);
                              setEditTitleValue(q.examTitle);
                            }
                          }}
                          className="bg-gray-100 text-gray-500 text-[10px] font-black px-2 py-0.5 rounded-full border border-gray-200 cursor-pointer hover:border-amber-300 transition-colors"
                        >
                          {q.examTitle} ✏️
                        </span>
                      )}
                    </div>
                    <div className="text-gray-800 font-bold leading-relaxed">
                      <TextWithFractions text={q.question.text} />
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDelete(q.id, q.examId)}
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shrink-0"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                {q.question.choices && q.question.choices.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-2 border-l-2 border-gray-100">
                    {q.question.choices.map(c => (
                      <div key={c.id} className={cn(
                        "text-sm p-2 rounded-lg flex gap-2",
                        c.id === q.question.correctAnswer ? "bg-emerald-50 text-emerald-700 font-bold" : "text-gray-500"
                      )}>
                        <span className="font-black">{c.id}.</span>
                        <span>{c.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button 
                  onClick={() => toggleExpand(q.id)}
                  className="w-full py-2 flex items-center justify-center gap-2 text-xs font-black text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-xl transition-all uppercase tracking-widest"
                >
                  {expandedIds.has(q.id) ? (
                    <><ChevronUp className="w-4 h-4" /> Ẩn lời giải</>
                  ) : (                    <><ChevronDown className="w-4 h-4" /> Xem lời giải chi tiết</>
                  )}
                </button>

                {expandedIds.has(q.id) && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Phương pháp giải</p>
                    <div className="text-sm text-slate-700 leading-relaxed font-medium">
                      <TextWithFractions text={q.question.solution || "Chưa có lời giải chi tiết cho câu hỏi này."} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LibraryPage;
