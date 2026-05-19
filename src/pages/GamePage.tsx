import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Gamepad2 } from "lucide-react";
import { getExams } from "@/lib/storage";
import { Exam } from "@/types/exam";
import { ReviewGame } from "@/components/features/ReviewGame";
import { sounds } from "@/lib/sounds";

const GamePage: React.FC = () => {
  const navigate = useNavigate();
  const [gameQuestions, setGameQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const exams = getExams();
    const allQs = exams.flatMap(e => e.sections.flatMap(s => s.questions));
    setGameQuestions(allQs);
    setLoading(false);
    sounds.start();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-pink-500 text-white px-5 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/")} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-black font-heading tracking-tight uppercase">Game Ôn Tập</h1>
        </div>
        <div className="bg-white/20 p-2 rounded-xl">
          <Gamepad2 className="w-6 h-6" />
        </div>
      </div>

      <div className="flex-1 max-w-6xl mx-auto w-full p-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : gameQuestions.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-gray-100 space-y-4">
            <div className="text-5xl">🎮</div>
            <p className="text-gray-400 font-black">Bé cần có đề thi để chơi game nhé!</p>
            <button 
              onClick={() => navigate("/exams")}
              className="bg-blue-600 text-white font-black px-6 py-3 rounded-2xl active:scale-95 transition-all"
            >
              ĐI TẠO ĐỀ NGAY
            </button>
          </div>
        ) : (
          <ReviewGame 
            questions={gameQuestions} 
            onExit={() => navigate("/")} 
          />
        )}
      </div>
    </div>
  );
};

export default GamePage;
