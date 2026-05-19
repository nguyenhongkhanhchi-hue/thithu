import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Exam, Question } from '@/types/exam';
import { sounds } from '@/lib/sounds';
import { celebrate } from '@/components/features/CelebrationEffect';
import { TextWithFractions } from './FractionDisplay';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Zap, Link as LinkIcon, Brain, X, RotateCcw, Home, Star, Sparkles, RefreshCw } from 'lucide-react';

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

  // Matching Game State
  const [matchingLeft, setMatchingLeft] = useState<any[]>([]);
  const [matchingRight, setMatchingRight] = useState<any[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());

  // Memory Game State
  const [memoryCards, setMemoryCards] = useState<any[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [solvedPairs, setSolvedPairs] = useState<Set<string>>(new Set());

  const allQuestions = providedQuestions || [];
  const quizQuestions = gameQuestions.filter(q => q.type === 'multiple_choice');

  const timerRef = useRef<any>();

  // Prepare questions (shuffle + randomize data)
  const prepareQuestions = async (shouldRandomizeData = false) => {
    setIsRandomizing(true);
    let baseQuestions = [...allQuestions];

    // 1. Shuffle question order
    baseQuestions = shuffle(baseQuestions);

    // 2. Shuffle choices for each question
    baseQuestions = baseQuestions.map(q => ({
      ...q,
      choices: q.choices ? shuffle(q.choices) : q.choices
    }));

    // 3. Randomize data with AI if requested
    if (shouldRandomizeData) {
      try {
        // Limit to 6 questions to stay within Groq TPM limits (6000 tokens)
        const randomized = await randomizeQuestions(baseQuestions.slice(0, 6));
        if (randomized && randomized.length > 0) {
          baseQuestions = randomized;
        }
      } catch (error) {
        console.error("Failed to randomize data:", error);
      }
    }

    setGameQuestions(baseQuestions);
    setIsRandomizing(false);
  };

  useEffect(() => {
    prepareQuestions(true); // Always randomize data with AI on mount
  }, [providedQuestions]);

  const initMatching = useCallback(() => {
    // Select 5 random questions from already shuffled/randomized list
    const subset = [...gameQuestions].slice(0, 5);
    
    // Left cards: Question text
    const left = subset.map(q => ({ 
      id: q.id, 
      text: q.text,
      color: 'bg-blue-500'
    }));
    
    // Right cards: Correct answer text OR solution (to prevent A/B/C/D memory)
    const right = subset.map(q => {
      let content = '';
      if (q.solution && q.solution.trim().length > 10) {
        content = q.solution; // Use detailed solution if available
      } else if (q.type === 'multiple_choice') {
        const correctChoice = q.choices?.find(c => c.id === q.correctAnswer);
        content = correctChoice ? correctChoice.text : 'Đáp án đúng';
      } else {
        content = q.correctAnswer || 'Đáp án';
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
  }, [gameQuestions]);

  const initMemory = useCallback(() => {
    // Select 6 random questions (12 cards)
    const subset = [...gameQuestions].slice(0, 6);
    
    const cards = subset.flatMap(q => {
      const pairId = q.id;
      
      // Question content
      const qCard = { 
        id: `${pairId}_q`, 
        text: q.text, 
        type: 'question', 
        pairId,
        color: 'from-blue-400 to-indigo-500'
      };
      
      // Answer/Solution content
      let content = '';
      if (q.solution && q.solution.trim().length > 5) {
        content = q.solution;
      } else if (q.type === 'multiple_choice') {
        const correctChoice = q.choices?.find(c => c.id === q.correctAnswer);
        content = correctChoice ? correctChoice.text : 'Đáp án đúng';
      } else {
        content = q.correctAnswer || 'Đáp án';
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
  }, [gameQuestions]);

  const startNextQuestion = useCallback(() => {
    if (currentIdx >= quizQuestions.length) {
      setGameState('result');
      sounds.celebrate();
      return;
    }
    setTimeLeft(15);
    setIsAnswering(false);
    setFeedback(null);
  }, [currentIdx, quizQuestions.length]);

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
  }, [gameState, isAnswering, gameMode]);

  const handleQuizAnswer = (choiceId: string | null) => {
    if (isAnswering) return;
    setIsAnswering(true);
    clearInterval(timerRef.current);

    const question = quizQuestions[currentIdx];
    const isCorrect = choiceId === question.correctAnswer;

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

    // Give more time to read solution (3 seconds if there is a solution, else 1.5s)
    const delay = question.solution ? 4000 : 1500;
    setTimeout(() => {
      setCurrentIdx(i => i + 1);
      startNextQuestion();
    }, delay);
  };

  // Matching Logic
  const handleMatchingSelect = (id: string, side: 'left' | 'right') => {
    if (matchedIds.has(id)) return;
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

  const checkMatch = (leftId: string, rightId: string) => {
    if (leftId === rightId) {
      sounds.correct();
      setMatchedIds(prev => new Set([...prev, leftId]));
      setScore(s => s + 200);
      celebrate('Tuyệt vời! 🌟');
      if (matchedIds.size + 1 === matchingLeft.length) {
        setTimeout(() => { setGameState('result'); sounds.celebrate(); }, 1000);
      }
    } else {
      sounds.wrong();
      // Visual shake effect would be nice here
    }
    setSelectedLeft(null);
    setSelectedRight(null);
  };

  // Memory Logic
  const handleMemoryFlip = (idx: number) => {
    if (flippedIndices.length === 2 || flippedIndices.includes(idx) || solvedPairs.has(memoryCards[idx].pairId)) return;
    
    sounds.flip();
    const newFlipped = [...flippedIndices, idx];
    setFlippedIndices(newFlipped);

    if (newFlipped.length === 2) {
      const card1 = memoryCards[newFlipped[0]];
      const card2 = memoryCards[newFlipped[1]];

      if (card1.pairId === card2.pairId) {
        sounds.correct();
        setSolvedPairs(prev => new Set([...prev, card1.pairId]));
        setScore(s => s + 300);
        celebrate('Giỏi lắm! 💎');
        setFlippedIndices([]);
        if (solvedPairs.size + 1 === memoryCards.length / 2) {
          setTimeout(() => { setGameState('result'); sounds.celebrate(); }, 1000);
        }
      } else {
        setTimeout(() => {
          sounds.wrong();
          setFlippedIndices([]);
        }, 1200);
      }
    }
  };

  if (isRandomizing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] p-6 text-center space-y-8 animate-fade-in bg-gradient-to-b from-white to-blue-50/30">
        <motion.div
          animate={{ 
            rotate: 360,
            scale: [1, 1.1, 1]
          }}
          transition={{ 
            rotate: { duration: 2, repeat: Infinity, ease: "linear" },
            scale: { duration: 1, repeat: Infinity }
          }}
          className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-5xl shadow-xl"
        >
          ✨
        </motion.div>
        <div className="space-y-3">
          <h2 className="text-2xl font-black text-gray-800 font-heading">Đang chuẩn bị thử thách...</h2>
          <p className="text-gray-500 font-medium">Hệ thống đang làm mới câu hỏi để bé không bị nhàm chán nhé! 🎈</p>
        </div>
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}
              className="w-3 h-3 rounded-full bg-blue-400"
            />
          ))}
        </div>
      </div>
    );
  }

  if (gameState === 'intro') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] p-6 text-center space-y-10 animate-fade-in bg-gradient-to-b from-white to-pink-50/30">
        <motion.div 
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          className="w-32 h-32 rounded-[40px] bg-gradient-to-br from-yellow-400 via-orange-500 to-pink-500 flex items-center justify-center text-6xl shadow-2xl relative"
        >
          <div className="absolute -top-4 -right-4 bg-white p-2 rounded-full shadow-lg">
            <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
          </div>
          🎮
        </motion.div>

        <div className="space-y-3">
          <h2 className="text-5xl font-black text-gray-800 font-heading tracking-tight">Thử Thách Bé Yêu!</h2>
          <p className="text-gray-500 font-medium text-xl">Bé hãy chọn trò chơi mình thích nhất nhé!</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-6xl px-4">
          {[
            { id: 'quiz', label: 'Siêu Tốc', sub: 'Giải nhanh như chớp', icon: <Zap className="w-10 h-10" />, color: 'orange', action: () => { setGameMode('quiz'); setGameState('playing'); setCurrentIdx(0); } },
            { id: 'matching', label: 'Ghép Đôi', sub: 'Tìm cặp bài trùng', icon: <LinkIcon className="w-10 h-10" />, color: 'emerald', action: () => { setGameMode('matching'); initMatching(); setGameState('playing'); } },
            { id: 'memory', label: 'Lật Bài', sub: 'Siêu trí nhớ của bé', icon: <Brain className="w-10 h-10" />, color: 'purple', action: () => { setGameMode('memory'); initMemory(); setGameState('playing'); } }
          ].map((mode) => (
            <motion.button
              key={mode.id}
              whileHover={{ scale: 1.05, translateY: -8 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { sounds.click(); mode.action(); }}
              className={cn(
                "p-10 rounded-[48px] bg-white border-b-[12px] shadow-2xl transition-all flex flex-col items-center justify-center text-center group min-h-[300px] relative overflow-hidden",
                mode.color === 'orange' ? "border-orange-200 hover:border-orange-400" :
                mode.color === 'emerald' ? "border-emerald-200 hover:border-emerald-400" :
                "border-purple-200 hover:border-purple-400"
              )}
            >
              <div className={cn(
                "w-24 h-24 rounded-[32px] flex items-center justify-center mb-6 transition-transform group-hover:scale-110 group-hover:rotate-6 shadow-lg",
                mode.color === 'orange' ? "bg-orange-100 text-orange-600" :
                mode.color === 'emerald' ? "bg-emerald-100 text-emerald-600" :
                "bg-purple-100 text-purple-600"
              )}>
                {mode.icon}
              </div>
              <div className="space-y-2">
                <div className="font-black text-3xl text-gray-800 font-heading uppercase tracking-tight">{mode.label}</div>
                <div className="text-xs text-gray-400 font-black uppercase tracking-widest opacity-60">{mode.sub}</div>
              </div>
              
              {/* Background Accent */}
              <div className={cn(
                "absolute -bottom-10 -right-10 w-32 h-32 rounded-full opacity-5 group-hover:scale-150 transition-transform duration-700",
                mode.color === 'orange' ? "bg-orange-500" :
                mode.color === 'emerald' ? "bg-emerald-500" :
                "bg-purple-500"
              )} />
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  if (gameState === 'result') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] p-6 text-center space-y-8 animate-fade-in bg-gradient-to-b from-white to-orange-50/30">
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
          className="relative"
        >
          <Trophy className="w-32 h-32 text-yellow-400 drop-shadow-2xl" />
          <Sparkles className="absolute -top-4 -right-4 w-12 h-12 text-yellow-500 animate-pulse" />
        </motion.div>

        <div className="space-y-2">
          <h2 className="text-5xl font-black text-gray-800 font-heading">Tuyệt Vời!</h2>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-7xl font-black text-orange-500 font-heading tabular-nums drop-shadow-sm"
          >
            {score.toLocaleString()}
          </motion.div>
          <p className="text-gray-400 font-bold uppercase tracking-[0.3em] text-sm">Điểm số của bé</p>
        </div>

        <div className="flex flex-col gap-4 w-full max-w-xs pt-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { 
              sounds.click(); 
              setGameState('intro'); 
              setScore(0); 
              setCombo(0); 
              setGameMode(null);
              prepareQuestions(true); // Re-randomize data for the next round
            }}
            className="flex items-center justify-center gap-2 py-5 rounded-[24px] bg-white border-2 border-gray-100 text-gray-600 font-black font-heading shadow-lg hover:bg-gray-50 transition-all"
          >
            <RotateCcw className="w-5 h-5" /> Chơi lại
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onExit} 
            className="flex items-center justify-center gap-2 py-5 rounded-[24px] bg-gradient-to-r from-orange-400 to-pink-500 text-white font-black font-heading shadow-xl shadow-orange-200 transition-all"
          >
            <Home className="w-5 h-5" /> Quay về đề thi
          </motion.button>
        </div>
      </div>
    );
  }

  // --- RENDERING MODES ---

  if (gameMode === 'quiz') {
    const q = quizQuestions[currentIdx];
    if (!q) return null;
    return (
      <div className="flex flex-col h-full min-h-[550px] p-4 space-y-8 animate-fade-in relative max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-4 rounded-[32px] shadow-lg border border-pink-50">
          <button 
            onClick={() => { sounds.click(); setGameState('intro'); setGameMode(null); }}
            className="w-12 h-12 rounded-2xl bg-white shadow-lg flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors border border-gray-100"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="relative">
            <svg className="w-20 h-20 -rotate-90">
              <circle cx="40" cy="40" r="34" className="stroke-gray-100 fill-none stroke-[8px]" />
              <circle 
                cx="40" cy="40" r="34" 
                className={cn(
                  "fill-none stroke-[8px] transition-all duration-1000",
                  timeLeft <= 5 ? "stroke-red-500" : "stroke-orange-500"
                )}
                strokeDasharray={2 * Math.PI * 34}
                strokeDashoffset={2 * Math.PI * 34 * (1 - timeLeft / 15)}
                strokeLinecap="round"
              />
            </svg>
            <div className={cn(
              "absolute inset-0 flex items-center justify-center text-2xl font-black font-heading",
              timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-orange-500'
            )}>
              {timeLeft}
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm px-5 py-3 rounded-2xl shadow-xl border border-pink-100 text-right flex flex-col">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Điểm số</span>
            <div className="text-xl font-black text-orange-500 font-heading">{score.toLocaleString()}</div>
          </div>
        </div>

        {/* Question Area */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white rounded-[56px] shadow-2xl border-b-8 border-pink-50 text-center relative overflow-hidden">
          <AnimatePresence mode="wait">
            {feedback ? (
              <motion.div 
                key="feedback"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.5 }}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/95 backdrop-blur-md p-6 overflow-y-auto no-scrollbar"
              >
                <div className={cn(
                  "text-5xl font-black font-heading mb-2 shrink-0",
                  feedback.type === 'correct' ? 'text-emerald-500' : 'text-red-500'
                )}>
                  {feedback.msg}
                </div>
                {feedback.solution && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-5 bg-gray-50 rounded-[32px] border-2 border-gray-100 max-w-lg text-left shadow-inner"
                  >
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 border-b border-gray-200 pb-1">Lời giải chi tiết cho bé</div>
                    <div className="text-base text-gray-700 font-medium leading-relaxed">
                      <TextWithFractions text={feedback.solution} />
                    </div>
                  </motion.div>
                )}
                {!feedback.solution && feedback.type === 'wrong' && (
                  <div className="text-gray-400 font-bold text-lg mt-4">Hãy cố gắng ở câu sau nhé! 💪</div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="question"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-bold text-gray-800 leading-relaxed font-serif max-w-lg"
              >
                <TextWithFractions text={q.text} />
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Decorative elements */}
          <div className="absolute top-4 left-4 opacity-10"><Star className="w-12 h-12" /></div>
          <div className="absolute bottom-4 right-4 opacity-10"><Sparkles className="w-12 h-12" /></div>
        </div>

        {/* Choices */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
          {q.choices?.map((choice) => (
            <motion.button
              key={choice.id}
              whileHover={!isAnswering ? { scale: 1.05, translateY: -4 } : {}}
              whileTap={!isAnswering ? { scale: 0.95 } : {}}
              disabled={isAnswering}
              onClick={() => { sounds.click(); handleQuizAnswer(choice.id); }}
              className={cn(
                "p-8 rounded-[40px] border-b-[10px] text-xl font-black font-heading transition-all relative overflow-hidden group min-h-[140px] flex items-center justify-center text-center",
                isAnswering && choice.id === q.correctAnswer
                  ? 'bg-emerald-500 border-emerald-700 text-white translate-y-2 border-b-0 shadow-inner'
                  : isAnswering && choice.id !== q.correctAnswer
                    ? 'bg-gray-100 border-gray-300 text-gray-400 grayscale scale-95 opacity-50'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-pink-300 shadow-xl'
              )}
            >
              <div className="absolute top-3 left-6 text-[10px] opacity-30 font-black uppercase tracking-widest">Đáp án {choice.id}</div>
              <div className="mt-2">
                <TextWithFractions text={choice.text} />
              </div>
            </motion.button>
          ))}
        </div>

        {combo > 1 && (
          <motion.div 
            initial={{ scale: 0, x: '-50%' }}
            animate={{ scale: [1, 1.2, 1], x: '-50%' }}
            className="fixed top-32 left-1/2 bg-yellow-400 text-yellow-900 px-8 py-3 rounded-full font-black text-2xl shadow-2xl z-50 border-4 border-white flex items-center gap-2"
          >
            <span>🔥</span> {combo} COMBO!
          </motion.div>
        )}
      </div>
    );
  }

  if (gameMode === 'matching') {
    return (
      <div className="flex flex-col h-full min-h-[550px] p-4 space-y-6 animate-fade-in bg-blue-50/20 relative">
        {/* Header */}
        <div className="flex justify-between items-center bg-white shadow-xl p-5 rounded-3xl border border-blue-50">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { sounds.click(); setGameState('intro'); setGameMode(null); }}
              className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors border border-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                <LinkIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tiến độ</div>
                <div className="font-heading font-black text-gray-700 text-lg">{matchedIds.size}/{matchingLeft.length}</div>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Điểm số</div>
            <div className="font-heading font-black text-orange-500 text-2xl">{score.toLocaleString()}</div>
          </div>
        </div>

        {/* Game Board */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 max-w-6xl mx-auto w-full">
          {/* Left Column - Questions */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-2">
              <div className="w-3 h-8 bg-blue-500 rounded-full shadow-lg shadow-blue-200" />
              <p className="text-lg font-black text-blue-600 uppercase tracking-widest font-heading">Câu hỏi của bé</p>
            </div>
            <AnimatePresence>
              {matchingLeft.map(item => (
                <motion.button
                  key={item.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={!matchedIds.has(item.id) ? { scale: 1.02, x: 10 } : {}}
                  whileTap={!matchedIds.has(item.id) ? { scale: 0.98 } : {}}
                  onClick={() => handleMatchingSelect(item.id, 'left')}
                  className={cn(
                    "w-full p-6 rounded-[32px] border-b-8 text-left transition-all font-serif text-lg min-h-[120px] flex items-center shadow-xl relative group",
                    matchedIds.has(item.id) 
                      ? "bg-gray-50 border-gray-200 opacity-0 scale-90 pointer-events-none" 
                      : selectedLeft === item.id 
                        ? "bg-blue-600 border-blue-800 text-white translate-y-2 border-b-0 shadow-inner" 
                        : "bg-white border-blue-100 hover:border-blue-400"
                  )}
                >
                  <TextWithFractions text={item.text} />
                  {selectedLeft === item.id && (
                    <motion.div 
                      layoutId="left-glow"
                      className="absolute inset-0 bg-blue-400/20 blur-2xl -z-10 rounded-full"
                    />
                  )}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>

          {/* Right Column - Answers */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-2 justify-end">
              <p className="text-lg font-black text-orange-600 uppercase tracking-widest font-heading">Lời giải đúng</p>
              <div className="w-3 h-8 bg-orange-500 rounded-full shadow-lg shadow-orange-200" />
            </div>
            <AnimatePresence>
              {matchingRight.map(item => (
                <motion.button
                  key={item.id}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={!matchedIds.has(item.id) ? { scale: 1.02, x: -10 } : {}}
                  whileTap={!matchedIds.has(item.id) ? { scale: 0.98 } : {}}
                  onClick={() => handleMatchingSelect(item.id, 'right')}
                  className={cn(
                    "w-full p-6 rounded-[32px] border-b-8 text-left transition-all font-serif text-lg min-h-[120px] flex items-center shadow-xl relative",
                    matchedIds.has(item.id) 
                      ? "bg-gray-50 border-gray-200 opacity-0 scale-90 pointer-events-none" 
                      : selectedRight === item.id 
                        ? "bg-orange-600 border-orange-800 text-white translate-y-2 border-b-0 shadow-inner" 
                        : "bg-white border-orange-100 hover:border-orange-400"
                  )}
                >
                  <TextWithFractions text={item.text} />
                  {selectedRight === item.id && (
                    <motion.div 
                      layoutId="right-glow"
                      className="absolute inset-0 bg-orange-400/20 blur-2xl -z-10 rounded-full"
                    />
                  )}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Empty state when cards are matching */}
        {matchedIds.size === matchingLeft.length && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-20">
            <motion.div 
              initial={{ scale: 0 }} 
              animate={{ scale: 1 }}
              className="bg-white p-10 rounded-[48px] shadow-2xl text-center space-y-4 border-8 border-emerald-100"
            >
              <div className="text-7xl">🎉</div>
              <h3 className="text-3xl font-black text-emerald-600 font-heading">Hoàn Thành Xuất Sắc!</h3>
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  if (gameMode === 'memory') {
    return (
      <div className="flex flex-col h-full min-h-[550px] p-4 space-y-6 animate-fade-in bg-purple-50/20 relative">
        {/* Header */}
        <div className="flex justify-between items-center bg-white shadow-xl p-5 rounded-3xl border border-purple-50">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { sounds.click(); setGameState('intro'); setGameMode(null); }}
              className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors border border-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Đã tìm thấy</div>
                <div className="font-heading font-black text-gray-700 text-lg">{solvedPairs.size}/{memoryCards.length / 2}</div>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Điểm số</div>
            <div className="font-heading font-black text-orange-500 text-2xl">{score.toLocaleString()}</div>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 p-2 max-w-6xl mx-auto w-full">
          {memoryCards.map((card, idx) => {
            const isFlipped = flippedIndices.includes(idx) || solvedPairs.has(card.pairId);
            return (
              <motion.button
                key={card.id}
                layout
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={!isFlipped ? { scale: 1.05, rotate: 2 } : {}}
                whileTap={!isFlipped ? { scale: 0.95 } : {}}
                onClick={() => handleMemoryFlip(idx)}
                className={cn(
                  "relative aspect-[4/5] rounded-[24px] transition-all duration-500",
                  solvedPairs.has(card.pairId) ? "opacity-0 pointer-events-none scale-90" : ""
                )}
                style={{ perspective: '1000px' }}
              >
                <div className={cn(
                  "absolute inset-0 w-full h-full transition-all duration-500 shadow-xl rounded-[24px] border-4",
                  isFlipped 
                    ? "bg-white border-white rotate-y-180" 
                    : "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 border-white/40"
                )} style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                  
                  {/* Card Back (Visible when not flipped) */}
                  <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center backface-hidden">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-2">
                      <Star className="w-6 h-6 text-white fill-white animate-pulse" />
                    </div>
                    <div className="text-[10px] font-black text-white/60 uppercase tracking-widest">Memory</div>
                  </div>

                  {/* Card Front (Visible when flipped) */}
                  <div className="absolute inset-0 w-full h-full p-4 flex flex-col items-center justify-center text-center rotate-y-180 backface-hidden bg-white rounded-[20px] overflow-hidden">
                    <div className={cn(
                      "text-[8px] font-black uppercase mb-2 px-2 py-0.5 rounded-full",
                      card.type === 'question' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                    )}>
                      {card.type === 'question' ? 'Câu hỏi' : 'Lời giải'}
                    </div>
                    <div className="text-[10px] font-serif leading-tight text-gray-800 line-clamp-6 overflow-y-auto w-full">
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
