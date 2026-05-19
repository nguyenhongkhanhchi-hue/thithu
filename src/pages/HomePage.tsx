import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Exam } from "@/types/exam";
import { getExams } from "@/lib/storage";
import { getCreditsRemaining } from "@/lib/gemini";
import { toast } from "sonner";
import heroImg from "@/assets/hero-exam.jpg";
import { ReviewGame } from "@/components/features/ReviewGame";
import { sounds } from "@/lib/sounds";
import { 
  Brain, 
  Settings, 
  History, 
  Library, 
  Gamepad2, 
  LayoutGrid, 
  Maximize, 
  Minimize,
  LogOut
} from 'lucide-react';
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const credits = getCreditsRemaining();

  // Fullscreen management
  useEffect(() => {
    // Attempt auto-fullscreen on first user interaction if not already
    const handleFirstClick = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      document.removeEventListener('click', handleFirstClick);
    };
    document.addEventListener('click', handleFirstClick);

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('click', handleFirstClick);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        toast.error(`Không thể bật toàn màn hình: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const menuItems = [
    { 
      id: 'exams', label: 'THI', sub: 'Danh sách đề thi', 
      icon: <LayoutGrid className="w-10 h-10" />, color: 'bg-blue-600',
      action: () => navigate("/exams") 
    },
    { 
      id: 'game', label: 'GAME ÔN TẬP', sub: 'Luyện tập vui vẻ', 
      icon: <Gamepad2 className="w-10 h-10" />, color: 'bg-pink-500',
      action: () => navigate("/game")
    },
    { 
      id: 'library', label: 'THƯ VIỆN', sub: 'Câu hỏi đã lưu', 
      icon: <Library className="w-10 h-10" />, color: 'bg-amber-500',
      action: () => navigate("/library") 
    },
    { 
      id: 'settings', label: 'CÀI ĐẶT', sub: 'Dữ liệu & Hệ thống', 
      icon: <Settings className="w-10 h-10" />, color: 'bg-slate-600',
      action: () => navigate("/settings") 
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ── Header ── */}
      <div className="bg-blue-700 text-white relative overflow-hidden shrink-0">
        <img src={heroImg} className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-overlay" alt="" />
        <div className="relative max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase">
              <span>✏️</span> ExamTouch
            </div>
            <h1 className="text-4xl font-black font-heading tracking-tighter uppercase">XIN CHÀO BÉ YÊU! 👋</h1>
            <p className="text-blue-100 font-medium">Hôm nay bé muốn chinh phục môn học nào nhỉ?</p>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={toggleFullscreen}
              className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-all active:scale-90"
              title="Toàn màn hình"
            >
              {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
            </button>
            {user && (
              <button 
                onClick={() => { logout(); navigate("/login"); }}
                className="w-12 h-12 rounded-2xl bg-red-500/20 backdrop-blur-md flex items-center justify-center hover:bg-red-500/40 transition-all active:scale-90 text-red-200"
                title="Đăng xuất"
              >
                <LogOut className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Menu Grid ── */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-10 flex items-center justify-center">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full max-w-4xl">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { sounds.click(); item.action(); }}
              className="group relative flex flex-col items-center justify-center p-8 rounded-[40px] bg-white border-2 border-gray-100 shadow-xl shadow-gray-200/50 hover:shadow-2xl hover:shadow-blue-200/50 hover:border-blue-200 transition-all duration-300 active:scale-95 overflow-hidden"
            >
              {/* Background Accent */}
              <div className={cn("absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full opacity-10 group-hover:scale-150 transition-transform duration-500", item.color)} />
              
              <div className={cn("w-24 h-24 rounded-[32px] flex items-center justify-center text-white mb-6 shadow-lg transform group-hover:rotate-6 transition-transform", item.color)}>
                {item.icon}
              </div>
              
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-black text-gray-800 font-heading tracking-tight uppercase">{item.label}</h2>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{item.sub}</p>
              </div>

              {/* Decorative Arrow */}
              <div className="mt-6 w-12 h-1.5 rounded-full bg-gray-100 group-hover:bg-blue-500 transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {/* Footer Info */}
      <div className="py-6 text-center text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">
        © 2024 ExamTouch • Học Tập Thông Minh Cùng AI
      </div>
    </div>
  );
};

export default HomePage;
