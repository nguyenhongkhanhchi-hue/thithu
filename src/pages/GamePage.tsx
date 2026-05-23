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
    <div className="min-h-screen bg-gradient-to-br from-pink-50/50 via-purple-50/30 to-indigo-50/40 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-600 text-white px-5 py-4 flex items-center justify-between sticky top-0 z-50 rounded-b-[32px] shadow-lg shadow-purple-100/60 border-b border-white/10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate("/")} 
            className="w-10 h-10 bg-white/10 hover:bg-white/20 active:scale-90 rounded-2xl flex items-center justify-center transition-all border border-white/10 shadow-inner"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-xl font-black font-heading tracking-tight uppercase drop-shadow-sm flex items-center gap-2">
              Lâu Đài Ôn Tập 🏰
            </h1>
            <span className="text-[10px] font-black text-white/75 uppercase tracking-[0.15em] -mt-1 font-heading">Học mà chơi, chơi mà học!</span>
          </div>
        </div>
        <div className="bg-white/20 p-2.5 rounded-2xl border border-white/10 shadow-inner animate-pulse">
          <Gamepad2 className="w-5 h-5 text-yellow-300" />
        </div>
      </div>

      <div className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-6 game-outer-wrapper">
        {loading ? (
          <div className="flex justify-center py-32">
            <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin shadow-md" />
          </div>
        ) : gameQuestions.length === 0 ? (
          <div className="text-center py-20 bg-white/80 backdrop-blur-md rounded-[48px] border-4 border-dashed border-pink-100/60 space-y-6 shadow-2xl p-8 max-w-lg mx-auto mt-12 relative overflow-hidden">
            {/* Decorative background lights */}
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-pink-300/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-purple-300/20 rounded-full blur-3xl pointer-events-none" />
            
            <div className="text-7xl animate-bounce">🏰</div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-gray-800 font-heading">Chưa có Thử Thách nào!</h3>
              <p className="text-gray-400 font-medium max-w-xs mx-auto">Bé yêu cần tạo hoặc tải đề thi lên trước thì mới có câu hỏi để chơi game nhé! 💕</p>
            </div>
            <button 
              onClick={() => navigate("/exams")}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-black font-heading px-8 py-5 rounded-[24px] shadow-lg shadow-purple-200 active:scale-95 transition-all text-lg uppercase tracking-wide"
            >
              🚀 ĐI TẠO ĐỀ NGAY THÔI
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
