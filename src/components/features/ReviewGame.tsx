import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Exam, Question, Choice } from '@/types/exam';
import { sounds } from '@/lib/sounds';
import { celebrate } from '@/components/features/CelebrationEffect';
import { TextWithFractions } from './FractionDisplay';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Zap, Link as LinkIcon, Brain, X, RotateCcw, Home, Star, Sparkles, AlertCircle } from 'lucide-react';
import { addXP } from '@/lib/storage';
import { toast } from 'sonner';
import { speakGameVictory } from '@/lib/tts';

// Utility to shuffle array
import { randomizeQuestions } from '@/lib/gemini';

const shuffle = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

interface ReviewGameProps {
  questions?: Question[];
  onExit: () => void;
}

type GameMode = 'quiz' | 'matching' | 'memory';

export const ReviewGame: React.FC<ReviewGameProps> = ({ questions: providedQuestions, onExit }) => {
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [gameState, setGameState] = useState<'intro' | 'playing' | 'result'>('intro');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [isAnswering, setIsAnswering] = useState(false);
  const [combo, setCombo] = useState(0);
  const [feedback, setFeedback] = useState<{ type: 'correct' | 'wrong'; msg: string; solution?: string } | null>(null);
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [gameQuestions, setGameQuestions] = useState<Question[]>([]);
  const [enableAIMagic, setEnableAIMagic] = useState(false);

  // Matching Game State
  const [matchingLeft, setMatchingLeft] = useState<any[]>([]);
  const [matchingRight, setMatchingRight] = useState<any[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [wrongMatch, setWrongMatch] = useState<{ leftId: string; rightId: string } | null>(null);
  const [isCheckingMatch, setIsCheckingMatch] = useState(false);

  // Memory Game State
  const [memoryCards, setMemoryCards] = useState<any[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [solvedPairs, setSolvedPairs] = useState<Set<string>>(new Set());
  const [isCheckingMemory, setIsCheckingMemory] = useState(false);

  const allQuestions = providedQuestions || [];

  // Helper to generate dynamic distractors for Quiz mode when a question doesn't have choices
  const getQuestionChoices = useCallback((q: Question): Choice[] => {
    if (q.choices && q.choices.length >= 2) return q.choices;

    const correctText = q.correctAnswer || '';
    if (!correctText) return [];

    // Parse numeric answers to generate distractors
    const num = parseFloat(correctText.replace(/[^0-9.-]/g, ''));
    if (!isNaN(num) && correctText.length < 8) {
      const generated = new Set<string>();
      generated.add(correctText);

      // Distractor offsets
      const offsets = [-2, -1, 1, 2, 5, 10];
      while (generated.size < 4 && offsets.length > 0) {
        const idx = Math.floor(Math.random() * offsets.length);
        const offset = offsets.splice(idx, 1)[0];
        const val = (num + offset).toString();
        if (val !== correctText) generated.add(val);
      }

      while (generated.size < 4) {
        const randomOffset = Math.floor(Math.random() * 20) - 10;
        if (randomOffset !== 0) {
          generated.add((num + randomOffset).toString());
        }
      }

      const arr = Array.from(generated);
      const shuffledArr = shuffle(arr);
      return shuffledArr.map((text, i) => ({
        id: String.fromCharCode(65 + i), // A, B, C, D
        text: text
      }));
    }

    return [];
  }, []);

  // Filter questions compatible with Quiz mode (has choices or numeric answer)
  const quizQuestions = gameQuestions.filter(q =>
    (q.choices && q.choices.length >= 2) ||
    (q.correctAnswer && !isNaN(parseFloat(q.correctAnswer.replace(/[^0-9.-]/g, ''))))
  );

  const timerRef = useRef<any>();

  // Prepare initial questions instantly on mount (0ms)
  const prepareQuestions = useCallback(async (shouldRandomizeData = false) => {
    setIsRandomizing(true);
    let baseQuestions = [...allQuestions];

    // Shuffle questions and their choices
    baseQuestions = shuffle(baseQuestions);
    baseQuestions = baseQuestions.map(q => ({
      ...q,
      choices: q.choices ? shuffle(q.choices) : q.choices
    }));

    if (shouldRandomizeData && baseQuestions.length > 0) {
      try {
        // Limit to 6 questions to fit Groq limits and run fast
        const randomized = await randomizeQuestions(baseQuestions.slice(0, 6));
        if (randomized && randomized.length > 0) {
          baseQuestions = randomized;
        }
      } catch (error) {
        console.error("Failed to randomize data with AI:", error);
      }
    }

    setGameQuestions(baseQuestions);
    setIsRandomizing(false);
  }, [allQuestions]);

  useEffect(() => {
    prepareQuestions(false); // Prepare initial questions instantly (no AI call on mount)
  }, [providedQuestions]);

  // Initializing Matching Mode
  const initMatching = (questionsList: Question[]) => {
    // Select 5 playable questions (exclude pure long essay questions if they lack a clean short answer)
    const playable = questionsList.filter(q => q.correctAnswer || (q.choices && q.choices.length > 0));
    const subset = shuffle(playable).slice(0, 5);

    if (subset.length === 0) return;

    // Left cards: Question text
    const left = subset.map(q => ({
      id: q.id,
      text: q.text,
      color: 'bg-blue-500'
    }));

    // Right cards: Short correct answer (NO detailed solutions to prevent layout break)
    const right = subset.map(q => {
      let content = '';
      if (q.type === 'multiple_choice' && q.choices) {
        const correctChoice = q.choices.find(c => c.id === q.correctAnswer);
        content = correctChoice ? correctChoice.text : (q.correctAnswer || 'Đáp án đúng');
      } else {
        content = q.correctAnswer || 'Đáp án';
      }

      // Truncate text if it's somehow too long
      if (content.length > 80) {
        content = content.slice(0, 77) + '...';
      }

      return {
        id: q.id,
        text: content,
        color: 'bg-orange-500'
      };
    });

    setMatchingLeft(shuffle(left));
    setMatchingRight(shuffle(right));
    setMatchedIds(new Set());
    setSelectedLeft(null);
    setSelectedRight(null);
    setWrongMatch(null);
    setIsCheckingMatch(false);
  };

  // Initializing Memory Mode
  const initMemory = (questionsList: Question[]) => {
    // Select 6 questions (12 cards total)
    const playable = questionsList.filter(q => q.correctAnswer || (q.choices && q.choices.length > 0));
    const subset = shuffle(playable).slice(0, 6);

    const cards = subset.flatMap(q => {
      const pairId = q.id;

      // Question card
      const qCard = {
        id: `${pairId}_q`,
        text: q.text,
        type: 'question',
        pairId,
        color: 'from-blue-400 to-indigo-500'
      };

      // Answer card (Short and clean)
      let content = '';
      if (q.type === 'multiple_choice' && q.choices) {
        const correctChoice = q.choices.find(c => c.id === q.correctAnswer);
        content = correctChoice ? correctChoice.text : (q.correctAnswer || 'Đáp án đúng');
      } else {
        content = q.correctAnswer || 'Đáp án';
      }

      // Truncate answers if they are extremely wordy
      if (content.length > 60) {
        content = content.slice(0, 57) + '...';
      }

      const aCard = {
        id: `${pairId}_a`,
        text: content,
        type: 'answer',
        pairId,
        color: 'from-purple-400 to-pink-500'
      };

      return [qCard, aCard];
    });

    setMemoryCards(shuffle(cards));
    setFlippedIndices([]);
    setSolvedPairs(new Set());
    setIsCheckingMemory(false);
  };

  const handleGameComplete = useCallback(() => {
    setGameState('result');
    sounds.celebrate();

    let modeText = "ôn tập";
    if (gameMode === "quiz") modeText = "trắc nghiệm nhanh";
    else if (gameMode === "matching") modeText = "nối thẻ thông minh";
    else if (gameMode === "memory") modeText = "lật thẻ ghi nhớ";
    speakGameVictory(modeText);

    try {
      const xpResult = addXP(50, 1);
      toast.success(`🎉 Bé nhận được +50 XP và +1 ⭐ từ trò chơi ôn tập!`);
      if (xpResult.leveledUp) {
        setTimeout(() => {
          sounds.celebrate();
          celebrate(`🎉 LÊN CẤP ${xpResult.newLevel}! QUÁ GIỎI! 🥳`);
        }, 1800);
      }
    } catch (e) {
      console.error(e);
    }
  }, [gameMode]);

  // Quiz Timer Setup
  useEffect(() => {
    if (gameMode === 'quiz' && gameState === 'playing' && !isAnswering) {
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            handleQuizAnswer(null);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [gameState, isAnswering, gameMode, currentIdx]);

  // Dynamic Correct/Incorrect verification helper
  const checkIfAnswerIsCorrect = (q: Question, choiceId: string | null): boolean => {
    if (!choiceId) return false;
    if (choiceId === q.correctAnswer) return true;

    // Resolve choices list (either pre-existing or auto-generated distractors)
    const choices = q.choices && q.choices.length >= 2 ? q.choices : getQuestionChoices(q);
    const selectedChoice = choices.find(c => c.id === choiceId);
    if (!selectedChoice) return false;

    return selectedChoice.text.trim() === q.correctAnswer?.trim();
  };

  // Quiz Answer Handlers
  const handleQuizAnswer = (choiceId: string | null) => {
    if (isAnswering) return;
    setIsAnswering(true);
    clearInterval(timerRef.current);

    const question = quizQuestions[currentIdx];
    if (!question) return;

    const isCorrect = checkIfAnswerIsCorrect(question, choiceId);

    if (isCorrect) {
      const timeBonus = Math.floor(timeLeft * 2);
      const comboBonus = combo * 10;
      const points = 100 + timeBonus + comboBonus;

      setScore(s => s + points);
      setCombo(c => c + 1);
      setFeedback({
        type: 'correct',
        msg: `+${points} điểm! ✨`,
        solution: question.solution
      });
      sounds.correct();
      if (combo > 1) celebrate(`${combo} COMBO! 🔥`);
    } else {
      setCombo(0);
      setFeedback({
        type: 'wrong',
        msg: choiceId === null ? 'Hết giờ rồi! ⏰' : 'Tiếc quá! 😢',
        solution: question.solution
      });
      sounds.wrong();
    }

    const delay = question.solution ? 4500 : 1800;
    const nextIdx = currentIdx + 1;

    // Bulletproof next-question trigger (Resolves the React Hook closure blank screen bug)
    setTimeout(() => {
      if (nextIdx >= quizQuestions.length) {
        handleGameComplete();
      } else {
        setCurrentIdx(nextIdx);
        setTimeLeft(15);
        setIsAnswering(false);
        setFeedback(null);
      }
    }, delay);
  };

  // Matching Selection Logic
  const handleMatchingSelect = (id: string, side: 'left' | 'right') => {
    if (isCheckingMatch || matchedIds.has(id)) return;
    sounds.click();

    if (side === 'left') {
      if (selectedLeft === id) setSelectedLeft(null);
      else {
        setSelectedLeft(id);
        if (selectedRight) checkMatch(id, selectedRight);
      }
    } else {
      if (selectedRight === id) setSelectedRight(null);
      else {
        setSelectedRight(id);
        if (selectedLeft) checkMatch(selectedLeft, id);
      }
    }
  };

  // Checking Matching Item Pair
  const checkMatch = (leftId: string, rightId: string) => {
    setIsCheckingMatch(true);
    if (leftId === rightId) {
      sounds.correct();
      setMatchedIds(prev => new Set([...prev, leftId]));
      setScore(s => s + 200);
      celebrate('Tuyệt vời! 🌟');
      setSelectedLeft(null);
      setSelectedRight(null);
      setIsCheckingMatch(false);

      if (matchedIds.size + 1 === matchingLeft.length) {
        setTimeout(() => { handleGameComplete(); }, 1200);
      }
    } else {
      sounds.wrong();
      // Setup wrong match IDs for shaking visual feedback
      setWrongMatch({ leftId, rightId });
      setTimeout(() => {
        setWrongMatch(null);
        setSelectedLeft(null);
        setSelectedRight(null);
        setIsCheckingMatch(false);
      }, 800);
    }
  };

  // Memory Selection Logic
  const handleMemoryFlip = (idx: number) => {
    if (isCheckingMemory || flippedIndices.length === 2 || flippedIndices.includes(idx) || solvedPairs.has(memoryCards[idx].pairId)) return;

    sounds.flip();
    const newFlipped = [...flippedIndices, idx];
    setFlippedIndices(newFlipped);

    if (newFlipped.length === 2) {
      setIsCheckingMemory(true);
      const card1 = memoryCards[newFlipped[0]];
      const card2 = memoryCards[newFlipped[1]];

      if (card1.pairId === card2.pairId) {
        sounds.correct();
        const matchedPairId = card1.pairId;
        
        // Highlight in green for 600ms before solving
        setTimeout(() => {
          setSolvedPairs(prev => new Set([...prev, matchedPairId]));
          setScore(s => s + 300);
          celebrate('Giỏi lắm! 💎');
          setFlippedIndices([]);
          setIsCheckingMemory(false);

          // Complete game check
          if (solvedPairs.size + 1 === memoryCards.length / 2) {
            setTimeout(() => { handleGameComplete(); }, 1000);
          }
        }, 600);
      } else {
        // Red delay showing error for 1200ms
        setTimeout(() => {
          sounds.wrong();
          setFlippedIndices([]);
          setIsCheckingMemory(false);
        }, 1200);
      }
    }
  };

  // Launch Game Mode Handlers (Prepares AI or launches instantly in 0ms)
  const launchGameMode = async (mode: GameMode) => {
    sounds.click();
    setGameMode(mode);

    let activeQuestions = [...gameQuestions];

    if (enableAIMagic) {
      setIsRandomizing(true);
      try {
        let baseQuestions = [...allQuestions];
        baseQuestions = shuffle(baseQuestions);
        baseQuestions = baseQuestions.map(q => ({
          ...q,
          choices: q.choices ? shuffle(q.choices) : q.choices
        }));
        
        const randomized = await randomizeQuestions(baseQuestions.slice(0, 6));
        if (randomized && randomized.length > 0) {
          activeQuestions = randomized;
          setGameQuestions(randomized);
        }
      } catch (e) {
        console.error("AI Magic failed, playing with fallback questions", e);
        toast.error("Phép thuật AI gặp gián đoạn nhẹ. Bé chơi câu hỏi chuẩn nhé! ✨");
      }
      setIsRandomizing(false);
    }

    setGameState('playing');

    if (mode === 'quiz') {
      setCurrentIdx(0);
      setScore(0);
      setCombo(0);
      setTimeLeft(15);
      setIsAnswering(false);
      setFeedback(null);
    } else if (mode === 'matching') {
      initMatching(activeQuestions);
    } else if (mode === 'memory') {
      initMemory(activeQuestions);
    }
  };

  // --- RENDERING AI LOADING SCREEN ---
  if (isRandomizing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] p-6 text-center space-y-8 animate-fade-in bg-gradient-to-b from-white/90 to-pink-50/50 rounded-[48px] shadow-2xl max-w-4xl mx-auto border border-pink-100">
        <motion.div
          animate={{
            rotate: 360,
            scale: [1, 1.15, 1]
          }}
          transition={{
            rotate: { duration: 3, repeat: Infinity, ease: "linear" },
            scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
          }}
          className="w-28 h-28 rounded-[40px] bg-gradient-to-br from-pink-400 via-purple-500 to-indigo-500 flex items-center justify-center text-6xl shadow-xl border-4 border-white"
        >
          🔮
        </motion.div>
        <div className="space-y-3">
          <h2 className="text-3xl font-black text-gray-800 font-heading">Đang truyền Phép thuật AI...</h2>
          <p className="text-purple-600 font-bold text-lg max-w-md mx-auto leading-relaxed">
            Hệ thống đang xáo trộn số liệu và đổi tên nhân vật để tạo ra thử thách hoàn toàn mới cho bé Mỹ Linh nhé! 🍀
          </p>
        </div>
        <div className="flex gap-2.5 justify-center">
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              animate={{ y: [0, -14, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
              className="w-4 h-4 rounded-full bg-gradient-to-r from-pink-400 to-purple-500 shadow-md"
            />
          ))}
        </div>
      </div>
    );
  }

  // --- RENDERING INTRO SELECTION SCREEN ---
  if (gameState === 'intro') {
    // Mode compatibility counts
    const playableQuizQs = allQuestions.filter(q =>
      (q.choices && q.choices.length >= 2) ||
      (q.correctAnswer && !isNaN(parseFloat(q.correctAnswer.replace(/[^0-9.-]/g, ''))))
    );
    const playableMatchingQs = allQuestions.filter(q => q.correctAnswer || (q.choices && q.choices.length > 0));

    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] p-6 text-center space-y-8 animate-fade-in bg-white/70 backdrop-blur-md rounded-[56px] shadow-2xl max-w-5xl mx-auto border-4 border-white relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-pink-300/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-indigo-300/10 rounded-full blur-3xl pointer-events-none" />

        <motion.div
          initial={{ scale: 0, rotate: -25 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 10 }}
          className="w-28 h-28 rounded-[36px] bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center text-6xl shadow-2xl relative border-4 border-white"
        >
          <div className="absolute -top-4 -right-4 bg-yellow-400 p-2.5 rounded-full shadow-lg border-2 border-white">
            <Star className="w-5 h-5 text-white fill-white animate-pulse" />
          </div>
          🎮
        </motion.div>

        <div className="space-y-3">
          <h2 className="text-4xl md:text-5xl font-black text-gray-800 font-heading tracking-tight drop-shadow-sm">Thử Thách Bé Yêu!</h2>
          <p className="text-purple-600 font-bold text-lg md:text-xl font-heading">Bé Mỹ Linh muốn khám phá trò chơi ma thuật nào hôm nay?</p>
        </div>

        {/* --- PREMIUM AI MAGIC TOGGLE --- */}
        <div className="bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-50 px-6 py-4 rounded-3xl border-2 border-purple-100 flex items-center justify-between gap-8 max-w-md w-full shadow-inner">
          <div className="text-left">
            <div className="font-black text-gray-700 font-heading flex items-center gap-1.5">
              <span>🔮 Phép thuật AI (Magic)</span>
            </div>
            <span className="text-[10px] font-black text-purple-400 uppercase tracking-wider block">Biến đổi số liệu đề gốc</span>
          </div>
          <button
            onClick={() => {
              sounds.click();
              setEnableAIMagic(!enableAIMagic);
              if (!enableAIMagic) celebrate('🔮 Kích hoạt Phép thuật AI!');
            }}
            className={cn(
              "w-14 h-8 rounded-full p-1 transition-all duration-300 shadow-inner flex items-center",
              enableAIMagic ? "bg-gradient-to-r from-pink-500 to-purple-600 justify-end" : "bg-gray-200 justify-start"
            )}
          >
            <motion.div 
              layout 
              className="w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center text-xs"
            >
              {enableAIMagic ? '✨' : '✖'}
            </motion.div>
          </button>
        </div>

        {/* --- GAME MODES GRID --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl px-4 pt-2">
          {/* Mode 1: Quiz (Siêu tốc) */}
          <motion.button
            whileHover={playableQuizQs.length > 0 ? { scale: 1.05, y: -6 } : {}}
            whileTap={playableQuizQs.length > 0 ? { scale: 0.95 } : {}}
            disabled={playableQuizQs.length === 0}
            onClick={() => launchGameMode('quiz')}
            className={cn(
              "p-8 rounded-[40px] bg-white border-b-[10px] shadow-xl transition-all flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[260px] group",
              playableQuizQs.length > 0 
                ? "border-orange-200 hover:border-orange-400 cursor-pointer" 
                : "opacity-60 border-gray-100 cursor-not-allowed"
            )}
          >
            <div className={cn(
              "w-20 h-20 rounded-[28px] flex items-center justify-center mb-5 transition-transform shadow-md",
              playableQuizQs.length > 0 
                ? "bg-orange-100 text-orange-600 group-hover:scale-110 group-hover:rotate-6" 
                : "bg-gray-100 text-gray-400"
            )}>
              <Zap className="w-9 h-9" />
            </div>
            <div className="space-y-1 z-10">
              <div className="font-black text-2xl text-gray-800 font-heading uppercase tracking-tight">Siêu Tốc</div>
              <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest opacity-80">Giải nhanh như chớp</div>
            </div>
            {playableQuizQs.length === 0 && (
              <div className="absolute top-3 right-3 bg-red-100 text-red-600 p-1.5 rounded-xl flex items-center gap-1 text-[9px] font-black font-heading shadow-sm">
                <AlertCircle className="w-3.5 h-3.5" /> CẦN TRẮC NGHIỆM
              </div>
            )}
          </motion.button>

          {/* Mode 2: Matching (Ghép đôi) */}
          <motion.button
            whileHover={playableMatchingQs.length > 0 ? { scale: 1.05, y: -6 } : {}}
            whileTap={playableMatchingQs.length > 0 ? { scale: 0.95 } : {}}
            disabled={playableMatchingQs.length === 0}
            onClick={() => launchGameMode('matching')}
            className={cn(
              "p-8 rounded-[40px] bg-white border-b-[10px] shadow-xl transition-all flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[260px] group",
              playableMatchingQs.length > 0 
                ? "border-emerald-200 hover:border-emerald-400 cursor-pointer" 
                : "opacity-60 border-gray-100 cursor-not-allowed"
            )}
          >
            <div className={cn(
              "w-20 h-20 rounded-[28px] flex items-center justify-center mb-5 transition-transform shadow-md",
              playableMatchingQs.length > 0 
                ? "bg-emerald-100 text-emerald-600 group-hover:scale-110 group-hover:rotate-6" 
                : "bg-gray-100 text-gray-400"
            )}>
              <LinkIcon className="w-9 h-9" />
            </div>
            <div className="space-y-1 z-10">
              <div className="font-black text-2xl text-gray-800 font-heading uppercase tracking-tight">Ghép Đôi</div>
              <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest opacity-80">Nối cặp bài trùng</div>
            </div>
            {playableMatchingQs.length === 0 && (
              <div className="absolute top-3 right-3 bg-red-100 text-red-600 p-1.5 rounded-xl flex items-center gap-1 text-[9px] font-black font-heading shadow-sm">
                <AlertCircle className="w-3.5 h-3.5" /> KHÔNG ĐỦ CÂU HỎI
              </div>
            )}
          </motion.button>

          {/* Mode 3: Memory (Lật bài) */}
          <motion.button
            whileHover={playableMatchingQs.length > 0 ? { scale: 1.05, y: -6 } : {}}
            whileTap={playableMatchingQs.length > 0 ? { scale: 0.95 } : {}}
            disabled={playableMatchingQs.length === 0}
            onClick={() => launchGameMode('memory')}
            className={cn(
              "p-8 rounded-[40px] bg-white border-b-[10px] shadow-xl transition-all flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[260px] group",
              playableMatchingQs.length > 0 
                ? "border-purple-200 hover:border-purple-400 cursor-pointer" 
                : "opacity-60 border-gray-100 cursor-not-allowed"
            )}
          >
            <div className={cn(
              "w-20 h-20 rounded-[28px] flex items-center justify-center mb-5 transition-transform shadow-md",
              playableMatchingQs.length > 0 
                ? "bg-purple-100 text-purple-600 group-hover:scale-110 group-hover:rotate-6" 
                : "bg-gray-100 text-gray-400"
            )}>
              <Brain className="w-9 h-9" />
            </div>
            <div className="space-y-1 z-10">
              <div className="font-black text-2xl text-gray-800 font-heading uppercase tracking-tight">Lật Bài</div>
              <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest opacity-80">Siêu trí nhớ của bé</div>
            </div>
            {playableMatchingQs.length === 0 && (
              <div className="absolute top-3 right-3 bg-red-100 text-red-600 p-1.5 rounded-xl flex items-center gap-1 text-[9px] font-black font-heading shadow-sm">
                <AlertCircle className="w-3.5 h-3.5" /> KHÔNG ĐỦ CÂU HỎI
              </div>
            )}
          </motion.button>
        </div>

        {/* Back navigation */}
        <button 
          onClick={onExit} 
          className="text-gray-400 hover:text-gray-600 font-black font-heading text-sm uppercase tracking-wider hover:underline"
        >
          Quay lại Lâu đài Đề thi 🏰
        </button>
      </div>
    );
  }

  // --- RENDERING RESULT SCREEN ---
  if (gameState === 'result') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] p-6 text-center space-y-8 animate-fade-in bg-white/70 backdrop-blur-md rounded-[56px] shadow-2xl max-w-lg mx-auto border-4 border-white">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: [0, 12, -12, 0] }}
          transition={{ duration: 0.6 }}
          className="relative"
        >
          <Trophy className="w-36 h-36 text-yellow-400 drop-shadow-2xl filter" />
          <Sparkles className="absolute -top-6 -right-6 w-14 h-14 text-yellow-500 animate-bounce" />
        </motion.div>

        <div className="space-y-2">
          <h2 className="text-4xl font-black text-gray-800 font-heading">Tuyệt Vời Quá Bé Ơi!</h2>
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600 font-heading tabular-nums drop-shadow-sm"
          >
            {score.toLocaleString()}
          </motion.div>
          <p className="text-purple-400 font-black uppercase tracking-[0.2em] text-xs">Tổng điểm ma thuật</p>
        </div>

        <div className="flex flex-col gap-3.5 w-full max-w-xs pt-4 z-10">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              sounds.click();
              setGameState('intro');
              setScore(0);
              setCombo(0);
              setGameMode(null);
              prepareQuestions(false); // Quick reset questions instantly
            }}
            className="flex items-center justify-center gap-2 py-4.5 rounded-[24px] bg-white border-2 border-purple-100 text-purple-600 font-black font-heading shadow-md hover:bg-purple-50 hover:border-purple-300 active:scale-95 transition-all text-base"
          >
            <RotateCcw className="w-5 h-5 stroke-[2.5]" /> Chơi lại vòng nữa
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onExit}
            className="flex items-center justify-center gap-2 py-4.5 rounded-[24px] bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-600 text-white font-black font-heading shadow-xl shadow-purple-200/50 hover:opacity-95 active:scale-95 transition-all text-base"
          >
            <Home className="w-5 h-5 stroke-[2.5]" /> Quay về Lâu đài 🏰
          </motion.button>
        </div>
      </div>
    );
  }

  // --- RENDERING MODES ---

  // --- GAME MODE 1: QUIZ (SIÊU TỐC) ---
  if (gameMode === 'quiz') {
    const q = quizQuestions[currentIdx];
    if (!q) return null;

    // Use either pre-existing choices or dynamic math distractor choices
    const currentChoices = getQuestionChoices(q);

    return (
      <div className="flex flex-col h-full min-h-[550px] p-4 space-y-6 animate-fade-in relative max-w-5xl mx-auto w-full game-container">
        {/* Header */}
        <div className="flex items-center justify-between bg-white/90 backdrop-blur-sm p-4.5 rounded-[32px] shadow-xl border border-pink-100/50 game-header">
          <button
            onClick={() => { sounds.click(); setGameState('intro'); setGameMode(null); }}
            className="w-11 h-11 rounded-2xl bg-white shadow-md flex items-center justify-center text-gray-400 hover:text-red-500 active:scale-90 border border-gray-100 transition-all"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Time Dial */}
          <div className="relative">
            <svg className="w-18 h-18 -rotate-90">
              <circle cx="36" cy="36" r="30" className="stroke-gray-100 fill-none stroke-[6px]" />
              <circle
                cx="36"
                cy="36"
                r="30"
                className={cn(
                  "fill-none stroke-[6px] transition-all duration-1000",
                  timeLeft <= 5 ? "stroke-red-500" : "stroke-purple-500"
                )}
                strokeDasharray={2 * Math.PI * 30}
                strokeDashoffset={2 * Math.PI * 30 * (1 - timeLeft / 15)}
                strokeLinecap="round"
              />
            </svg>
            <div className={cn(
              "absolute inset-0 flex items-center justify-center text-xl font-black font-heading time-text",
              timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-purple-600'
            )}>
              {timeLeft}
            </div>
          </div>

          <div className="bg-white px-4 py-2.5 rounded-2xl shadow-inner border border-purple-50 text-right flex flex-col justify-center">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider leading-none">Điểm số</span>
            <div className="text-lg font-black text-orange-500 font-heading">{score.toLocaleString()}</div>
          </div>
        </div>

        {/* Question Area */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white rounded-[48px] shadow-2xl border-4 border-white text-center relative overflow-hidden min-h-[220px] question-box">
          <div className="absolute top-3 left-4 bg-purple-100 text-purple-600 px-3.5 py-1 rounded-full text-[10px] font-black font-heading uppercase tracking-wider">
            Câu {currentIdx + 1}/{quizQuestions.length}
          </div>

          <AnimatePresence mode="wait">
            {feedback ? (
              <motion.div
                key="feedback"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.2 }}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm p-6 overflow-y-auto"
              >
                <div className={cn(
                  "text-4xl md:text-5xl font-black font-heading mb-3 shrink-0 drop-shadow-sm animate-bounce",
                  feedback.type === 'correct' ? 'text-emerald-500' : 'text-red-500'
                )}>
                  {feedback.msg}
                </div>
                {feedback.solution && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 bg-gradient-to-br from-purple-50/50 to-pink-50/30 rounded-[28px] border-2 border-purple-100/50 max-w-lg text-left shadow-inner max-h-[180px] overflow-y-auto"
                  >
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-purple-400 mb-1.5 border-b border-purple-100/80 pb-1 flex items-center gap-1">
                      <span>💡 LỜI GIẢI PHÉP THUẬT CHO BÉ</span>
                    </div>
                    <div className="text-sm text-gray-700 font-medium leading-relaxed">
                      <TextWithFractions text={feedback.solution} />
                    </div>
                  </motion.div>
                )}
                {!feedback.solution && feedback.type === 'wrong' && (
                  <div className="text-purple-400 font-black font-heading text-lg mt-3">Đừng nản nhé! Phép thuật đang bảo vệ bé! 💪</div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="question"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xl md:text-2xl font-bold text-gray-800 leading-relaxed font-serif max-w-2xl px-4"
              >
                <TextWithFractions text={q.text} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Decorative stars */}
          <div className="absolute top-4 left-4 opacity-[0.06] text-purple-500"><Star className="w-14 h-14" /></div>
          <div className="absolute bottom-4 right-4 opacity-[0.06] text-pink-500"><Sparkles className="w-14 h-14" /></div>
        </div>

        {/* Choices Option Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full pt-2 choice-grid">
          {currentChoices.map((choice) => {
            const isCorrectAnswer = checkIfAnswerIsCorrect(q, choice.id);
            return (
              <motion.button
                key={choice.id}
                whileHover={!isAnswering ? { scale: 1.03, y: -3 } : {}}
                whileTap={!isAnswering ? { scale: 0.97 } : {}}
                disabled={isAnswering}
                onClick={() => { sounds.click(); handleQuizAnswer(choice.id); }}
                className={cn(
                  "p-5 md:p-6 rounded-[28px] border-b-[8px] text-lg font-black font-heading transition-all relative overflow-hidden group min-h-[96px] flex items-center justify-center text-center choice-btn",
                  isAnswering && isCorrectAnswer
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-700 text-white translate-y-1.5 border-b-0 shadow-inner'
                    : isAnswering && !isCorrectAnswer
                      ? 'bg-gray-100 border-gray-300 text-gray-400 grayscale scale-95 opacity-55'
                      : 'bg-white border-purple-100 hover:border-pink-300 hover:shadow-lg text-gray-700 shadow-md'
                )}
              >
                <div className="absolute top-2.5 left-4 text-[9px] opacity-40 font-black uppercase tracking-wider">Đáp án {choice.id}</div>
                <div className="mt-2.5">
                  <TextWithFractions text={choice.text} />
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Combo notifications */}
        {combo > 1 && (
          <motion.div
            initial={{ scale: 0, x: '-50%' }}
            animate={{ scale: [1, 1.25, 1], x: '-50%' }}
            className="fixed top-28 left-1/2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-6 py-2.5 rounded-full font-black text-xl shadow-2xl z-50 border-4 border-white flex items-center gap-1.5 font-heading"
          >
            <span>🔥</span> {combo} COMBO!
          </motion.div>
        )}
      </div>
    );
  }

  // --- GAME MODE 2: MATCHING (GHÉP ĐÔI) ---
  if (gameMode === 'matching') {
    return (
      <div className="flex flex-col h-full min-h-[550px] p-4 space-y-6 animate-fade-in bg-gradient-to-b from-blue-50/20 to-purple-50/10 rounded-[48px] relative max-w-5xl mx-auto w-full game-container">
        {/* Header */}
        <div className="flex justify-between items-center bg-white shadow-xl p-4.5 rounded-[28px] border border-blue-50 game-header">
          <div className="flex items-center gap-4">
            <button
              onClick={() => { sounds.click(); setGameState('intro'); setGameMode(null); }}
              className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-red-500 active:scale-90 transition-all border border-gray-100"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                <LinkIcon className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Tiến độ ghép</span>
                <div className="font-heading font-black text-gray-700 text-lg leading-none mt-1">{matchedIds.size}/{matchingLeft.length}</div>
              </div>
            </div>
          </div>
          <div className="text-right flex flex-col justify-center">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Điểm số</span>
            <div className="font-heading font-black text-orange-500 text-2xl leading-none mt-1">{score.toLocaleString()}</div>
          </div>
        </div>

        {/* Matching Game Board */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 w-full pt-2 matching-board">
          {/* Left Column (Questions) */}
          <div className="space-y-3.5 matching-col">
            <div className="flex items-center gap-2.5 px-1">
              <div className="w-2.5 h-6 bg-blue-500 rounded-full shadow-md shadow-blue-200" />
              <p className="text-base font-black text-blue-600 uppercase tracking-wider font-heading">Câu hỏi phép thuật 📚</p>
            </div>
            <AnimatePresence>
              {matchingLeft.map(item => {
                const isMatched = matchedIds.has(item.id);
                const isSelected = selectedLeft === item.id;
                const isWrong = wrongMatch?.leftId === item.id;
                
                return (
                  <motion.button
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: -15 }}
                    animate={
                      isWrong
                        ? { x: [-8, 8, -8, 8, 0], borderColor: '#EF4444', backgroundColor: '#FEE2E2', color: '#B91C1C' }
                        : isMatched 
                          ? { opacity: 0.15, scale: 0.95, pointerEvents: 'none' }
                          : { opacity: 1, x: 0 }
                    }
                    transition={{ duration: isWrong ? 0.6 : 0.3 }}
                    whileHover={!isMatched && !isCheckingMatch ? { scale: 1.02, x: 6 } : {}}
                    whileTap={!isMatched && !isCheckingMatch ? { scale: 0.98 } : {}}
                    onClick={() => handleMatchingSelect(item.id, 'left')}
                    className={cn(
                      "w-full p-5 rounded-[28px] border-b-[8px] text-left transition-all font-serif text-base min-h-[90px] flex items-center shadow-lg relative group overflow-hidden border-2 matching-btn",
                      isSelected
                        ? "bg-gradient-to-r from-blue-500 to-indigo-600 border-blue-800 text-white translate-y-1.5 border-b-0 shadow-inner"
                        : isWrong
                          ? ""
                          : "bg-white border-blue-100/50 hover:border-blue-400 text-gray-700"
                    )}
                  >
                    <TextWithFractions text={item.text} />
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Right Column (Short Answers) */}
          <div className="space-y-3.5 matching-col">
            <div className="flex items-center gap-2.5 px-1 md:justify-end">
              <p className="text-base font-black text-orange-600 uppercase tracking-wider font-heading">Bảo bối Đáp án 🌟</p>
              <div className="w-2.5 h-6 bg-orange-500 rounded-full shadow-md shadow-orange-200" />
            </div>
            <AnimatePresence>
              {matchingRight.map(item => {
                const isMatched = matchedIds.has(item.id);
                const isSelected = selectedRight === item.id;
                const isWrong = wrongMatch?.rightId === item.id;
                
                return (
                  <motion.button
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: 15 }}
                    animate={
                      isWrong
                        ? { x: [-8, 8, -8, 8, 0], borderColor: '#EF4444', backgroundColor: '#FEE2E2', color: '#B91C1C' }
                        : isMatched 
                          ? { opacity: 0.15, scale: 0.95, pointerEvents: 'none' }
                          : { opacity: 1, x: 0 }
                    }
                    transition={{ duration: isWrong ? 0.6 : 0.3 }}
                    whileHover={!isMatched && !isCheckingMatch ? { scale: 1.02, x: -6 } : {}}
                    whileTap={!isMatched && !isCheckingMatch ? { scale: 0.98 } : {}}
                    onClick={() => handleMatchingSelect(item.id, 'right')}
                    className={cn(
                      "w-full p-5 rounded-[28px] border-b-[8px] text-left transition-all font-serif text-base min-h-[90px] flex items-center shadow-lg relative overflow-hidden border-2 matching-btn",
                      isSelected
                        ? "bg-gradient-to-r from-orange-500 to-amber-600 border-orange-800 text-white translate-y-1.5 border-b-0 shadow-inner"
                        : isWrong
                          ? ""
                          : "bg-white border-orange-100/50 hover:border-orange-400 text-gray-700"
                    )}
                  >
                    <TextWithFractions text={item.text} />
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Smooth win celebration overlay */}
        {matchedIds.size === matchingLeft.length && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-xs z-20 rounded-[48px]">
            <motion.div
              initial={{ scale: 0, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              className="bg-white p-8 rounded-[40px] shadow-2xl text-center space-y-4 border-8 border-emerald-100 max-w-sm"
            >
              <div className="text-6xl animate-bounce">🎉</div>
              <h3 className="text-2xl font-black text-emerald-600 font-heading leading-tight">Hoàn Thành Xuất Sắc!</h3>
              <p className="text-gray-400 font-bold text-sm">Bé giỏi quá! Hãy chuẩn bị nhận điểm nhé!</p>
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  // --- GAME MODE 3: MEMORY (LẬT BÀI) ---
  if (gameMode === 'memory') {
    return (
      <div className="flex flex-col h-full min-h-[550px] p-4 space-y-6 animate-fade-in bg-gradient-to-b from-purple-50/20 to-pink-50/10 rounded-[48px] relative max-w-6xl mx-auto w-full game-container">
        {/* Header */}
        <div className="flex justify-between items-center bg-white shadow-xl p-4.5 rounded-[28px] border border-purple-50 game-header">
          <div className="flex items-center gap-4">
            <button
              onClick={() => { sounds.click(); setGameState('intro'); setGameMode(null); }}
              className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-red-500 active:scale-90 transition-all border border-gray-100"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                <Brain className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Cặp trùng khớp</span>
                <div className="font-heading font-black text-gray-700 text-lg leading-none mt-1">{solvedPairs.size}/{memoryCards.length / 2}</div>
              </div>
            </div>
          </div>
          <div className="text-right flex flex-col justify-center">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Điểm số</span>
            <div className="font-heading font-black text-orange-500 text-2xl leading-none mt-1">{score.toLocaleString()}</div>
          </div>
        </div>

        {/* Card Memory Grid Layout */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 p-2 w-full pt-2 memory-grid">
          {memoryCards.map((card, idx) => {
            const isFlipped = flippedIndices.includes(idx) || solvedPairs.has(card.pairId);
            const isSolved = solvedPairs.has(card.pairId);
            
            return (
              <motion.button
                key={card.id}
                layout
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={!isFlipped && !isCheckingMemory ? { scale: 1.05, rotate: 2 } : {}}
                whileTap={!isFlipped && !isCheckingMemory ? { scale: 0.95 } : {}}
                onClick={() => handleMemoryFlip(idx)}
                className="perspective-1000 relative aspect-[4/5] rounded-[24px] cursor-pointer memory-card"
              >
                {/* 3D INNER CONTAINER (Custom CSS 3D Transformation) */}
                <div 
                  className={cn(
                    "preserve-3d absolute inset-0 w-full h-full transition-all duration-700 rounded-[24px] shadow-lg border-4 border-white/95",
                    isSolved
                      ? "bg-yellow-50/50 border-yellow-400/80 shadow-md opacity-60 pointer-events-none scale-[0.97]"
                      : isFlipped
                        ? "bg-white border-white rotate-y-180"
                        : "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 border-white/30"
                  )}
                  style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
                >
                  
                  {/* --- CARD BACK (Visible when not flipped) --- */}
                  <div className="backface-hidden absolute inset-0 w-full h-full flex flex-col items-center justify-center">
                    <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center mb-1.5 shadow-inner">
                      <Star className="w-5 h-5 text-white fill-white animate-pulse" />
                    </div>
                    <div className="text-[10px] font-black text-white/70 uppercase tracking-widest font-heading">Memory</div>
                  </div>

                  {/* --- CARD FRONT (Visible when flipped / solved) --- */}
                  <div className="backface-hidden rotate-y-180 absolute inset-0 w-full h-full p-3.5 flex flex-col items-center justify-center text-center bg-white rounded-[20px] overflow-hidden memory-card-front">
                    {isSolved ? (
                      /* Gold solved seal overlay keeping cards stable */
                      <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 w-5 h-5 rounded-full flex items-center justify-center text-[10px] shadow-md border-2 border-white animate-pulse">
                        ⭐
                      </div>
                    ) : (
                      <div className={cn(
                        "text-[8px] font-black uppercase mb-2 px-2.5 py-0.5 rounded-full shrink-0 border",
                        card.type === 'question' 
                          ? 'bg-blue-50 border-blue-100 text-blue-600' 
                          : 'bg-pink-50 border-pink-100 text-pink-600'
                      )}>
                        {card.type === 'question' ? 'Câu hỏi' : 'Đáp án'}
                      </div>
                    )}
                    
                    <div className="text-[11px] font-serif leading-relaxed text-gray-800 overflow-y-auto no-scrollbar w-full flex-1 flex items-center justify-center memory-card-text">
                      <TextWithFractions text={card.text} />
                    </div>
                  </div>

                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
};
