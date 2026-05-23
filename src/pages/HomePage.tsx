import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Exam } from "@/types/exam";
import { getExams, getGamificationData, type GamificationData, getWrongQuestions } from "@/lib/storage";
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
  LogOut,
  Users,
  BookOpen
} from 'lucide-react';
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { speakAppGreeting } from "@/lib/tts";
import { syncAllData } from "@/lib/sync";
import { useLayout } from "@/contexts/LayoutContext";


const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { containerClass } = useLayout();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [credits, setCredits] = useState<number | null>(null);
  const [gameData, setGameData] = useState<GamificationData>({ level: 1, xp: 0, stars: 0, streak: 1 });
  const [wrongCount, setWrongCount] = useState(0);

  // Fullscreen, Voice Greeting & Cloud Sync management
  useEffect(() => {
    setCredits(getCreditsRemaining());
    setGameData(getGamificationData());
    setWrongCount(getWrongQuestions().length);

    // Đồng bộ đám mây hai chiều khi khởi động
    if (user) {
      syncAllData(user).then((res) => {
        if (res.success) {
          // Làm tươi điểm số và các đề thi sau khi sync thành công
          setGameData(getGamificationData());
          setWrongCount(getWrongQuestions().length);
          
          // Nếu có tin nhắn mới tinh từ bố vừa cập nhật qua đám mây, tự động reo chuông và đọc lên luôn!
          // (Luôn đọc lời nhắn mới bất kể đã chào chưa)
          if (res.hasNewMessage) {
            sounds.click(); // Reo chuông nhẹ báo hiệu
            speakAppGreeting();
          }
        }
      });
    }

    // Attempt auto-fullscreen on first user interaction (browser bypass autoplay lock)
    // Chỉ đọc lời chào MỘT LẦN trong mỗi phiên dùng (sessionStorage flag)
    const alreadyGreeted = sessionStorage.getItem('methi_greeted');
    const handleFirstClick = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      // Chỉ đọc lời chào nếu chưa chào trong session này
      if (!sessionStorage.getItem('methi_greeted')) {
        sessionStorage.setItem('methi_greeted', '1');
        speakAppGreeting();
      }
      document.removeEventListener('click', handleFirstClick);
    };

    if (!alreadyGreeted) {
      // Lần đầu: thử đọc ngay (sẽ bị block bởi trình duyệt nếu chưa có user gesture)
      // Nhưng cũng lắng nghe click đầu tiên để đọc sau đó
      document.addEventListener('click', handleFirstClick);
      try {
        speakAppGreeting();
        sessionStorage.setItem('methi_greeted', '1');
      } catch {
        // Sẽ đọc khi click đầu tiên
      }
    }
    // Nếu đã chào rồi thì KHÔNG đọc lại

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('click', handleFirstClick);
    };
  }, [user]);

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
      id: 'mistakes', label: 'SỔ SỬA SAI', 
      sub: wrongCount > 0 ? `CÓ ${wrongCount} LỖI CẦN SỬA!` : 'Sạch bóng lỗi sai', 
      icon: <BookOpen className="w-10 h-10" />, color: 'bg-purple-600',
      badge: wrongCount > 0 ? `${wrongCount}` : undefined,
      action: () => navigate("/mistakes")
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
      <div className="bg-blue-700 text-white relative overflow-hidden shrink-0 pb-6">
        <img src={heroImg} className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-overlay" alt="" />
        <div className={`relative ${containerClass} pt-8 pb-4 flex flex-col gap-6`}>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase">
                <span>👑</span> MÊ THI - Thi Nhiều Là Giỏi
              </div>
              <h1 className="text-4xl font-black font-heading tracking-tighter uppercase">XIN CHÀO BÉ YÊU! 👋</h1>
              <p className="text-blue-100 font-medium">Hôm nay bé muốn chinh phục môn học nào nhỉ?</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => { sounds.click(); navigate("/parents"); }}
                className="h-12 px-4 rounded-2xl bg-white/10 backdrop-blur-md flex items-center gap-2 hover:bg-white/20 transition-all active:scale-90 shadow-lg border border-white/10 text-xs font-black tracking-wider uppercase"
                title="Cổng Phụ Huynh"
              >
                <Users className="w-5 h-5 text-indigo-200" />
                <span className="hidden sm:inline text-white">👨‍👩‍👧 CỔNG PHỤ HUYNH</span>
              </button>

              <button 
                onClick={toggleFullscreen}
                className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-all active:scale-90 shadow-lg border border-white/10"
                title="Toàn màn hình"
              >
                {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
              </button>
              {user && (
                <button 
                  onClick={() => { logout(); navigate("/login"); }}
                  className="w-12 h-12 rounded-2xl bg-red-500/20 backdrop-blur-md flex items-center justify-center hover:bg-red-500/40 transition-all active:scale-90 text-red-200 shadow-lg border border-red-500/10"
                  title="Đăng xuất"
                >
                  <LogOut className="w-6 h-6" />
                </button>
              )}
            </div>
          </div>

          {/* RPG Dashboard */}
          <div className="flex flex-wrap items-center gap-6 bg-white/10 backdrop-blur-lg px-6 py-4 rounded-[32px] border border-white/20 shadow-2xl w-full max-w-4xl">
            {/* Level Badge */}
            <div className="flex items-center gap-2 bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500 px-5 py-2.5 rounded-2xl text-white font-black text-sm shadow-lg shadow-orange-500/20 animate-bounce">
              <span>👑</span>
              <span>CẤP {gameData.level}</span>
            </div>
            
            {/* XP Progress Bar */}
            <div className="flex-1 min-w-[200px] space-y-1.5">
              <div className="flex justify-between text-xs font-black text-amber-300 tracking-wider">
                <span>TIẾN TRÌNH XP CỦA BÉ</span>
                <span>{gameData.xp} / {gameData.level * 100} XP</span>
              </div>
              <div className="h-4 bg-blue-950/40 rounded-full overflow-hidden border border-white/10 p-0.5 shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-amber-400 via-yellow-400 to-yellow-300 rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(251,191,36,0.6)]" 
                  style={{ width: `${(gameData.xp / (gameData.level * 100)) * 100}%` }}
                />
              </div>
            </div>

            {/* Stars & Streak */}
            <div className="flex items-center gap-4 shrink-0 font-black text-sm">
              <div className="flex items-center gap-1.5 bg-yellow-400/20 text-yellow-300 px-4 py-2.5 rounded-2xl border border-yellow-400/30 shadow-md">
                <span>⭐</span>
                <span>{gameData.stars} SAO</span>
              </div>
              <div className="flex items-center gap-1.5 bg-orange-500/20 text-orange-400 px-4 py-2.5 rounded-2xl border border-orange-500/30 animate-pulse shadow-md">
                <span>🔥</span>
                <span>{gameData.streak} NGÀY</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Menu Grid ── */}
      <div className={`flex-1 ${containerClass} py-8 flex items-center justify-center`}>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 w-full">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { sounds.click(); item.action(); }}
              className="group relative flex flex-col items-center justify-center p-8 rounded-[40px] bg-white border-2 border-gray-100 shadow-xl shadow-gray-200/50 hover:shadow-2xl hover:shadow-blue-200/50 hover:border-blue-200 transition-all duration-300 active:scale-95 overflow-hidden"
            >
              {/* Background Accent */}
              <div className={cn("absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full opacity-10 group-hover:scale-150 transition-transform duration-500", item.color)} />
              
              <div className={cn("w-24 h-24 rounded-[32px] flex items-center justify-center text-white mb-6 shadow-lg transform group-hover:rotate-6 transition-transform relative", item.color)}>
                {item.icon}
                {item.badge && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-black w-7 h-7 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                    {item.badge}
                  </span>
                )}
              </div>
              
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-black text-gray-800 font-heading tracking-tight uppercase">{item.label}</h2>
                <p className={cn("text-xs font-bold uppercase tracking-widest", item.badge ? "text-red-500 font-black" : "text-gray-400")}>{item.sub}</p>
              </div>

              {/* Decorative Arrow */}
              <div className="mt-6 w-12 h-1.5 rounded-full bg-gray-100 group-hover:bg-blue-500 transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {/* Footer Info */}
      <div className="py-6 text-center text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">
        © 2026 MÊ THI • THI NHIỀU LÀ GIỎI • PHỤNG SỰ BÉ YÊU 💖
      </div>
    </div>
  );
};

export default HomePage;
