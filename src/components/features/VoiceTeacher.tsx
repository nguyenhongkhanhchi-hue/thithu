/**
 * VoiceTeacher.tsx
 * Component giáo viên giọng nói thông minh:
 * - Trình bày lời giải đẹp theo từng bước có animation
 * - Đọc lời giải bằng giọng nói tiếng Việt (Web Speech API)
 * - Hỗ trợ song ngữ Việt-Anh (2 giọng đọc khác nhau)
 * - Chat với học sinh theo tên (AI-powered)
 * - Cài đặt giọng đọc đầy đủ
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Question } from '@/types/exam';
import { useStudent } from '@/contexts/StudentContext';
import {
  speakText,
  stopSpeaking,
  isSpeaking,
  loadVoiceSettings,
  saveVoiceSettings,
  getVietnameseVoices,
  getEnglishVoices,
  type VoiceSettings,
} from '@/lib/tts';
import { gradeEssay, type EssayGradeResult } from '@/lib/gemini';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────────────────────────────────────

interface VoiceTeacherProps {
  question: Question;
  studentAnswer?: string;
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedStep {
  stepNumber: number;
  content: string;
  type: 'step' | 'note' | 'tip' | 'answer' | 'warning';
}

interface ChatMessage {
  role: 'user' | 'teacher';
  text: string;
  timestamp: Date;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AVATAR_OPTIONS = [
  '🧒', '👦', '👧', '🧑', '👩', '🧒‍♂️', '🧒‍♀️',
  '🐱', '🐶', '🦊', '🐼', '🌟', '🦁', '🐨',
];

const GRADE_OPTIONS = [
  'Lớp 1', 'Lớp 2', 'Lớp 3', 'Lớp 4', 'Lớp 5',
  'Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9',
  'Lớp 10', 'Lớp 11', 'Lớp 12',
];

const NICKNAME_OPTIONS = ['con', 'em', 'bạn', 'mình'];

const STEP_STYLES: Record<
  ParsedStep['type'],
  { bg: string; border: string; icon: string; label: string; textColor: string; badgeBg: string }
> = {
  step:    { bg: 'bg-white',       border: 'border-blue-200',    icon: '📝', label: 'Bước',      textColor: 'text-blue-900',   badgeBg: 'bg-blue-50' },
  note:    { bg: 'bg-amber-50',    border: 'border-amber-300',   icon: '💡', label: 'Lưu ý',     textColor: 'text-amber-900',  badgeBg: 'bg-amber-100' },
  tip:     { bg: 'bg-emerald-50',  border: 'border-emerald-300', icon: '💎', label: 'Mẹo hay',   textColor: 'text-emerald-900',badgeBg: 'bg-emerald-100' },
  warning: { bg: 'bg-red-50',      border: 'border-red-300',     icon: '⚠️', label: 'Cẩn thận',  textColor: 'text-red-900',    badgeBg: 'bg-red-100' },
  answer:  { bg: 'bg-purple-50',   border: 'border-purple-400',  icon: '🎯', label: 'Đáp án',    textColor: 'text-purple-900', badgeBg: 'bg-purple-100' },
};

// ── Helper: Parse solution into steps ─────────────────────────────────────────

function parseSteps(solution: string): ParsedStep[] {
  if (!solution || !solution.trim()) return [];

  const lines = solution.split('\n');
  const steps: ParsedStep[] = [];
  let stepCounter = 0;
  let current: ParsedStep | null = null;

  const flush = () => {
    if (current && current.content.trim()) {
      steps.push({ ...current, content: current.content.trim() });
      current = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      if (current) current.content += '\n';
      continue;
    }

    // Lưu ý / Note
    if (/^(lưu ý|ghi chú|chú ý|note|nhớ rằng)[:：\s]/i.test(line)) {
      flush();
      current = {
        stepNumber: ++stepCounter,
        content: line.replace(/^[^:：]+[:：]\s*/i, '').trim() || line,
        type: 'note',
      };
      continue;
    }

    // Mẹo / Tip
    if (/^(mẹo|tip|bí quyết|gợi ý|trick)[:：\s]/i.test(line)) {
      flush();
      current = {
        stepNumber: ++stepCounter,
        content: line.replace(/^[^:：]+[:：]\s*/i, '').trim() || line,
        type: 'tip',
      };
      continue;
    }

    // Cảnh báo / Warning
    if (/^(cảnh báo|sai lầm thường gặp|đừng nhầm|chú ý)[:：\s]/i.test(line)) {
      flush();
      current = {
        stepNumber: ++stepCounter,
        content: line.replace(/^[^:：]+[:：]\s*/i, '').trim() || line,
        type: 'warning',
      };
      continue;
    }

    // Đáp án cuối
    if (
      /^(đáp án|kết quả|kết luận|đáp số|vậy suy ra|suy ra|vậy)[:：\s]/i.test(line) ||
      (/=/.test(line) && /\d/.test(line) && line.length < 60 && /^(vậy|suy ra|=>|→|do đó)/i.test(line))
    ) {
      flush();
      current = {
        stepNumber: ++stepCounter,
        content: line,
        type: 'answer',
      };
      continue;
    }

    // Bước X: / X. / X) (numbered step)
    const bStep = line.match(/^bước\s*(\d+)\s*[:：.]/i);
    if (bStep) {
      flush();
      current = {
        stepNumber: parseInt(bStep[1]),
        content: line.replace(/^bước\s*\d+\s*[:：.]\s*/i, '').trim(),
        type: 'step',
      };
      continue;
    }

    const numStep = line.match(/^(\d+)\s*[.):\]]\s+(.+)/);
    if (numStep) {
      flush();
      current = {
        stepNumber: parseInt(numStep[1]),
        content: numStep[2].trim(),
        type: 'step',
      };
      continue;
    }

    // Bullet point
    if (/^[-•●◆★▸→]\s+/.test(line)) {
      flush();
      current = {
        stepNumber: ++stepCounter,
        content: line.replace(/^[-•●◆★▸→]\s+/, ''),
        type: 'step',
      };
      continue;
    }

    // Continuation hoặc standalone
    if (current) {
      current.content += '\n' + line;
    } else {
      current = { stepNumber: ++stepCounter, content: line, type: 'step' };
    }
  }

  flush();

  if (steps.length === 0 && solution.trim()) {
    return [{ stepNumber: 1, content: solution.trim(), type: 'step' }];
  }

  // Mark last step as 'answer' if it looks like a result
  if (steps.length > 1 && steps[steps.length - 1].type === 'step') {
    const last = steps[steps.length - 1];
    if (/=\s*[\d,.]+|đáp án|kết quả|vậy|suy ra/i.test(last.content)) {
      last.type = 'answer';
    }
  }

  return steps;
}

// ── Helper: Format solution text with bold numbers ─────────────────────────────

function FormatText({ text }: { text: string }) {
  // Bold numbers, fractions, and key math symbols
  const parts = text.split(/((?:\d+\.?\d*(?:\/\d+)?)|(?:[A-Z]{2,4}\b))/g);
  return (
    <>
      {parts.map((part, i) => {
        if (/^\d/.test(part) || /\/\d/.test(part)) {
          return (
            <strong key={i} className="font-bold text-blue-700">
              {part}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ── Helper: Teacher AI chat ────────────────────────────────────────────────────

async function askTeacherAI(
  userQuestion: string,
  context: {
    questionText: string;
    solution?: string;
    studentName: string;
    nickname: string;
  }
): Promise<string> {
  const onspaceKey = (import.meta as any).env?.VITE_ONSPACE_AI_API_KEY || localStorage.getItem("VITE_ONSPACE_AI_API_KEY");
  const onspaceBase = (import.meta as any).env?.VITE_ONSPACE_AI_BASE_URL || "https://api.onspace.ai/v1";
  const groqKey = (import.meta as any).env?.VITE_GROQ_API_KEY || localStorage.getItem("VITE_GROQ_API_KEY");
  const geminiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || localStorage.getItem("VITE_GEMINI_API_KEY");

  const nick = context.nickname || 'con';
  const nameStr = context.studentName ? ` ${context.studentName}` : '';

  const systemPrompt = `Bạn là cô giáo Việt Nam thân thiện, dịu dàng và yêu thương học sinh tiểu học.
Học sinh tên${nameStr || ' con'}, cách xưng hô: cô và ${nick}.
Trả lời bằng tiếng Việt, ngôn ngữ trong sáng, dễ hiểu, giàu hình ảnh.

NHIỆM VỤ QUAN TRỌNG:
1. KHÔNG được chỉ đưa ra đáp án cuối cùng ngay lập tức.
2. Hãy đóng vai người hướng dẫn: gợi ý cách tư duy, giải thích từng bước một cách tỉ mỉ như đang giảng bài trên lớp.
3. Nếu bài toán có nhiều bước, hãy hỏi xem ${nick} đã hiểu bước trước chưa hoặc gợi ý ${nick} thử làm bước tiếp theo.
4. Luôn khích lệ, khen ngợi sự nỗ lực của ${nick} ("Cô khen ${nick} nhé", "Con giỏi lắm", "Đừng lo, cô sẽ giúp con").
5. Giải thích các khái niệm toán học một cách trực quan (ví dụ dùng hình ảnh quả táo, cái kẹo nếu là toán tiểu học).

Ngữ cảnh bài học:
Câu hỏi: ${context.questionText}
${context.solution ? `Lời giải chi tiết để cô tham khảo (đừng chép nguyên văn): ${context.solution}` : ''}`;

  try {
    // 1. Ưu tiên OnSpace (Gemini 3 Flash Preview)
    if (onspaceKey) {
      const res = await fetch(`${onspaceBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${onspaceKey}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userQuestion },
          ],
          temperature: 0.75,
          max_tokens: 512,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data?.choices?.[0]?.message?.content || 'Cô chưa hiểu câu hỏi. Con thử hỏi lại nhé!';
      }
    }

    // 2. Groq
    if (groqKey) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userQuestion },
          ],
          temperature: 0.75,
          max_tokens: 512,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data?.choices?.[0]?.message?.content || 'Cô chưa hiểu câu hỏi. Con thử hỏi lại nhé!';
      }
    }

    // 3. Gemini SDK
    if (geminiKey) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
      const result = await model.generateContent(
        systemPrompt + '\n\nHọc sinh hỏi: ' + userQuestion
      );
      return result.response.text();
    }

    return 'Cần cấu hình API Key (OnSpace, Groq hoặc Gemini) để dùng tính năng chat với cô giáo AI.';
  } catch (err: any) {
    console.error('[VoiceTeacher] Teacher AI error:', err);
    throw new Error(err?.message || 'Không thể kết nối cô giáo AI. Vui lòng thử lại!');
  }
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────

const VoiceTeacher: React.FC<VoiceTeacherProps> = ({
  question,
  studentAnswer,
  isOpen,
  onClose,
}) => {
  const { profile, setProfile, hasProfile, teacherGreet } = useStudent();

  // ── Profile setup state ──
  const [draftProfile, setDraftProfile] = useState({ ...profile });
  const [showProfileForm, setShowProfileForm] = useState(false);

  // ── Solution state ──
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showAllSteps, setShowAllSteps] = useState(false);
  const [activeTab, setActiveTab] = useState<'solution' | 'chat'>('solution');

  // ── Essay AI grading state ──
  const [essayGrade, setEssayGrade] = useState<EssayGradeResult | null>(null);
  const [gradingLoading, setGradingLoading] = useState(false);

  // ── Voice state ──
  const [speaking, setSpeaking] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(loadVoiceSettings);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [viVoices, setViVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [enVoices, setEnVoices] = useState<SpeechSynthesisVoice[]>([]);

  // ── Chat state ──
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Derived
  const steps = parseSteps(question.solution || '');
  const isEssay = question.type !== 'multiple_choice';
  const isCorrectAnswer =
    studentAnswer && question.correctAnswer
      ? studentAnswer === question.correctAnswer
      : null;

  // ── Effects ──────────────────────────────────────────────────────────────────

  // Load available voices
  useEffect(() => {
    if (!isOpen) return;
    const loadVoices = () => {
      setViVoices(getVietnameseVoices());
      setEnVoices(getEnglishVoices());
    };
    loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [isOpen]);

  // Reset when opening/closing
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0);
      setShowAllSteps(false);
      setActiveTab('solution');
      setChatMessages([]);
      setEssayGrade(null);
      setShowProfileForm(!hasProfile);
      setSpeaking(false);
    } else {
      stopSpeaking();
      setSpeaking(false);
      recognitionRef.current?.stop();
    }
  }, [isOpen, hasProfile]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  // ── Voice handlers ────────────────────────────────────────────────────────────

  const handleUpdateVoiceSettings = useCallback((newSettings: VoiceSettings) => {
    setVoiceSettings(newSettings);
    saveVoiceSettings(newSettings);
  }, []);

  const buildSpeakText = useCallback((): string => {
    if (steps.length === 0) {
      return `Câu hỏi: ${question.text}. ${question.solution ? 'Lời giải: ' + question.solution : ''}`;
    }
    if (showAllSteps) {
      return steps
        .map((s) => {
          const prefix =
            s.type === 'answer'  ? 'Đáp án: ' :
            s.type === 'note'    ? 'Lưu ý: '  :
            s.type === 'tip'     ? 'Mẹo: '    :
            s.type === 'warning' ? 'Cẩn thận: ' :
            `Bước ${s.stepNumber}: `;
          return prefix + s.content;
        })
        .join('. ');
    }
    const visible = steps.slice(0, currentStepIndex + 1);
    return visible
      .map((s) => {
        const prefix =
          s.type === 'answer'  ? 'Đáp án: ' :
          s.type === 'note'    ? 'Lưu ý: '  :
          s.type === 'tip'     ? 'Mẹo: '    :
          s.type === 'warning' ? 'Cẩn thận: ' :
          `Bước ${s.stepNumber}: `;
        return prefix + s.content;
      })
      .join('. ');
  }, [question, steps, currentStepIndex, showAllSteps]);

  const handleToggleSpeak = useCallback(() => {
    if (isSpeaking()) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const text = buildSpeakText();
    setSpeaking(true);
    speakText(text, voiceSettings, () => setSpeaking(false));
  }, [buildSpeakText, voiceSettings]);

  const handleTestVoice = () => {
    const name = profile.name || '';
    const nick = profile.nickname || 'con';
    const text = `Xin chào${name ? ' ' + name : ''}! Đây là giọng đọc thử nghiệm của cô. Cô hy vọng ${nick} nghe rõ và học thật tốt nhé!`;
    stopSpeaking();
    setSpeaking(true);
    speakText(text, voiceSettings, () => setSpeaking(false));
  };

  // ── Profile handlers ─────────────────────────────────────────────────────────

  const handleSaveProfile = () => {
    if (!draftProfile.name.trim()) {
      toast.error('Vui lòng nhập tên của bạn!');
      return;
    }
    setProfile(draftProfile);
    setShowProfileForm(false);
    toast.success(`Chào mừng ${draftProfile.name}! 🎉 Cùng học nào!`);
  };

  // ── Essay grading ─────────────────────────────────────────────────────────────

  const handleGradeEssay = async () => {
    if (!studentAnswer || !question.solution) return;
    setGradingLoading(true);
    try {
      const result = await gradeEssay(
        question.text,
        studentAnswer,
        question.solution,
        question.points
      );
      setEssayGrade(result);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể nhờ AI chấm bài lúc này.');
    } finally {
      setGradingLoading(false);
    }
  };

  // ── Chat handlers ─────────────────────────────────────────────────────────────

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    const userMsg: ChatMessage = { role: 'user', text, timestamp: new Date() };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);
    try {
      const reply = await askTeacherAI(text, {
        questionText: question.text,
        solution: question.solution,
        studentName: profile.name,
        nickname: profile.nickname || 'con',
      });
      const teacherMsg: ChatMessage = { role: 'teacher', text: reply, timestamp: new Date() };
      setChatMessages((prev) => [...prev, teacherMsg]);
      // Auto-read teacher reply
      stopSpeaking();
      setSpeaking(true);
      speakText(reply, voiceSettings, () => setSpeaking(false));
    } catch (err: any) {
      toast.error(err?.message || 'Không thể kết nối cô giáo AI. Thử lại sau nhé!');
    } finally {
      setChatLoading(false);
    }
  };

  const startListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error('Trình duyệt chưa hỗ trợ nhận diện giọng nói');
      return;
    }
    try {
      const recognition = new SR();
      recognition.lang = 'vi-VN';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setChatInput(transcript);
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      toast.error('Không thể bắt đầu nhận giọng nói');
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  // ── Early return: modal closed ────────────────────────────────────────────────

  if (!isOpen) return null;

  // ── PROFILE SETUP SCREEN ──────────────────────────────────────────────────────

  if (showProfileForm) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-y-auto max-h-[90vh]">
          <div className="p-6 space-y-5">
            {/* Title */}
            <div className="text-center">
              <div className="text-5xl mb-2 animate-bounce">👩‍🏫</div>
              <h2 className="text-xl font-bold text-gray-800">Chào mừng bạn!</h2>
              <p className="text-sm text-gray-500 mt-1">
                Hãy để cô biết tên bạn để học tốt hơn nhé 😊
              </p>
            </div>

            {/* Avatar picker */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Chọn avatar:
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {AVATAR_OPTIONS.map((av) => (
                  <button
                    key={av}
                    onClick={() => setDraftProfile((p) => ({ ...p, avatar: av }))}
                    className={`text-2xl w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all active:scale-90 ${
                      draftProfile.avatar === av
                        ? 'border-purple-500 bg-purple-50 scale-110 shadow-md'
                        : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            {/* Name input */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                Tên của bạn:
              </label>
              <input
                type="text"
                value={draftProfile.name}
                onChange={(e) => setDraftProfile((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ví dụ: Nam, Lan, Bé An..."
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-purple-400 focus:outline-none transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveProfile()}
                autoFocus
              />
            </div>

            {/* Nickname */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Cách xưng hô với cô:
              </p>
              <div className="grid grid-cols-4 gap-2">
                {NICKNAME_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setDraftProfile((p) => ({ ...p, nickname: n }))}
                    className={`py-2 rounded-xl text-sm font-semibold border-2 transition-all active:scale-95 ${
                      draftProfile.nickname === n
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 text-gray-600 hover:border-purple-300'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Grade */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                Lớp (không bắt buộc):
              </label>
              <select
                value={draftProfile.grade}
                onChange={(e) => setDraftProfile((p) => ({ ...p, grade: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-purple-400 focus:outline-none"
              >
                <option value="">-- Chọn lớp --</option>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border-2 border-gray-200 text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
              >
                Để sau
              </button>
              <button
                onClick={handleSaveProfile}
                className="flex-[2] py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md hover:shadow-lg active:scale-95 transition-all"
              >
                Bắt đầu học với cô! 🎉
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN TEACHER SCREEN ────────────────────────────────────────────────────────

  const visibleSteps = showAllSteps ? steps : steps.slice(0, currentStepIndex + 1);
  const greeting = teacherGreet('cô sẽ giải thích');

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-purple-50 via-white to-pink-50 overflow-hidden">

      {/* ── HEADER ─────────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-purple-600 via-violet-600 to-pink-600 px-4 py-3 flex items-center gap-3 shrink-0 shadow-lg">
        {/* Teacher avatar */}
        <div className="relative shrink-0">
          <div className="w-11 h-11 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-2xl">
            👩‍🏫
          </div>
          {speaking && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white animate-pulse" />
          )}
        </div>

        {/* Greeting */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-tight">Cô giáo</p>
          <p className="text-purple-200 text-[11px] truncate">{greeting}</p>
        </div>

        {/* Student badge */}
        <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5 shrink-0">
          <span className="text-base leading-none">{profile.avatar}</span>
          <span className="text-white text-xs font-semibold max-w-[80px] truncate">
            {profile.name || 'Học sinh'}
          </span>
          {profile.grade && (
            <span className="text-purple-200 text-[10px]">· {profile.grade}</span>
          )}
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-sm hover:bg-white/30 active:scale-90 transition-all shrink-0"
        >
          ✕
        </button>
      </div>

      {/* ── TABS ───────────────────────────────────────────────────────────────── */}
      <div className="flex bg-white border-b border-gray-100 shrink-0">
        <button
          onClick={() => setActiveTab('solution')}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'solution'
              ? 'text-purple-600 border-b-2 border-purple-500 bg-purple-50/50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          📖 Lời giải
          {steps.length > 0 && (
            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
              {steps.length} bước
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'chat'
              ? 'text-purple-600 border-b-2 border-purple-500 bg-purple-50/50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          💬 Hỏi cô
          {chatMessages.filter((m) => m.role === 'teacher').length > 0 && (
            <span className="text-[10px] bg-purple-500 text-white px-1.5 py-0.5 rounded-full leading-none">
              {chatMessages.filter((m) => m.role === 'teacher').length}
            </span>
          )}
        </button>
      </div>

      {/* ── MAIN CONTENT ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden relative">

        {/* ═══ TAB: SOLUTION ════════════════════════════════════════════════════ */}
        {activeTab === 'solution' && (
          <div className="h-full overflow-y-auto">
            <div className="p-4 space-y-4 pb-28">

              {/* Question display */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-start gap-2 mb-3">
                  <span className="shrink-0 font-bold text-blue-500 text-sm">
                    Câu {question.number}{question.subNumber || ''}:
                  </span>
                  <p className="text-gray-800 text-[14px] leading-relaxed font-medium flex-1">
                    {question.text}
                  </p>
                </div>

                {/* Student's answer display */}
                {studentAnswer && (
                  <div
                    className={`rounded-xl px-3 py-2.5 border-2 ${
                      isCorrectAnswer === true
                        ? 'bg-emerald-50 border-emerald-300'
                        : isCorrectAnswer === false
                        ? 'bg-red-50 border-red-300'
                        : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <p className="text-[10px] font-bold uppercase text-gray-400 mb-1">
                      Câu trả lời của {profile.nickname || 'con'}:
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 flex-1 whitespace-pre-line leading-relaxed">
                        {studentAnswer}
                      </span>
                      {isCorrectAnswer === true && (
                        <span className="text-emerald-600 font-bold text-base shrink-0">✓ Đúng!</span>
                      )}
                      {isCorrectAnswer === false && (
                        <span className="text-red-500 font-bold text-base shrink-0">✗ Sai</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Correct answer highlight (if wrong MC) */}
                {question.correctAnswer && isCorrectAnswer === false && (
                  <div className="mt-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                    <p className="text-xs text-blue-700 font-semibold">
                      ✓ Đáp án đúng:{' '}
                      <span className="font-bold text-blue-900">{question.correctAnswer}</span>
                    </p>
                  </div>
                )}

                {/* AI Essay Grading */}
                {isEssay && studentAnswer && question.solution && (
                  <div className="mt-3 space-y-2">
                    <button
                      onClick={handleGradeEssay}
                      disabled={gradingLoading}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-all shadow-md"
                    >
                      {gradingLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Đang chấm bài...
                        </>
                      ) : (
                        <>🤖 Nhờ AI chấm bài tự luận</>
                      )}
                    </button>
                    {essayGrade && (
                      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white bg-indigo-500 px-2 py-0.5 rounded-full">
                            AI: {essayGrade.score}/{question.points} điểm
                          </span>
                          <span className="text-[11px] text-indigo-600">Nhận xét của AI</span>
                        </div>
                        <p className="text-sm text-indigo-900 leading-relaxed">{essayGrade.feedback}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Steps section */}
              {steps.length > 0 ? (
                <div className="space-y-3">
                  {/* Steps header */}
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Lời giải từng bước
                    </p>
                    <button
                      onClick={() => setShowAllSteps((v) => !v)}
                      className="text-xs font-semibold text-purple-500 hover:text-purple-700 transition-colors"
                    >
                      {showAllSteps ? '📦 Thu gọn' : `👁️ Xem tất cả ${steps.length} bước`}
                    </button>
                  </div>

                  {/* Step progress bar */}
                  {!showAllSteps && steps.length > 1 && (
                    <div className="flex gap-1 px-1">
                      {steps.map((_, i) => (
                        <div
                          key={i}
                          className={`h-1.5 rounded-full flex-1 transition-all duration-300 ${
                            i <= currentStepIndex ? 'bg-purple-500' : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Rendered steps */}
                  {visibleSteps.map((step, idx) => {
                    const style = STEP_STYLES[step.type];
                    const isNewest = !showAllSteps && idx === visibleSteps.length - 1;
                    return (
                      <div
                        key={`step-${step.stepNumber}-${idx}`}
                        className={`rounded-2xl border-2 p-4 transition-all duration-300 ${style.bg} ${style.border} ${
                          isNewest ? 'shadow-md' : 'shadow-sm opacity-90'
                        }`}
                      >
                        {/* Step header */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl leading-none">{style.icon}</span>
                          <span
                            className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${style.badgeBg} ${style.textColor}`}
                          >
                            {style.label}
                            {step.type === 'step' ? ` ${step.stepNumber}` : ''}
                          </span>
                          {isNewest && !showAllSteps && (
                            <span className="ml-auto text-[10px] text-purple-400 font-medium animate-pulse">
                              ← mới nhất
                            </span>
                          )}
                        </div>

                        {/* Step content */}
                        <div className={`text-[13px] leading-relaxed whitespace-pre-line ${style.textColor}`}>
                          <FormatText text={step.content} />
                        </div>
                      </div>
                    );
                  })}

                  {/* Navigation buttons */}
                  {!showAllSteps && (
                    <div className="flex gap-2 pt-1">
                      {currentStepIndex > 0 && (
                        <button
                          onClick={() => setCurrentStepIndex((i) => Math.max(0, i - 1))}
                          className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-50 active:scale-95 transition-all"
                        >
                          ← Bước trước
                        </button>
                      )}
                      {currentStepIndex < steps.length - 1 ? (
                        <button
                          onClick={() => setCurrentStepIndex((i) => Math.min(steps.length - 1, i + 1))}
                          className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-bold shadow-md hover:shadow-lg active:scale-95 transition-all"
                        >
                          Bước tiếp theo →
                        </button>
                      ) : (
                        <div className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-white text-sm font-bold text-center shadow-md">
                          🎉 Đã xong tất cả các bước!
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : question.solution ? (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
                  <p className="text-xs font-bold text-blue-500 uppercase mb-2">📖 Lời giải</p>
                  <p className="text-sm text-blue-900 leading-relaxed whitespace-pre-line">
                    {question.solution}
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center shadow-sm">
                  <div className="text-3xl mb-2">🤔</div>
                  <p className="text-gray-500 text-sm">Câu này chưa có lời giải mẫu.</p>
                  <p className="text-gray-400 text-xs mt-1">
                    Hỏi cô ở tab Chat để được giải thích nhé! 💬
                  </p>
                  <button
                    onClick={() => setActiveTab('chat')}
                    className="mt-3 px-4 py-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-600 text-xs font-semibold hover:bg-purple-100 active:scale-95 transition-all"
                  >
                    💬 Hỏi cô giáo ngay
                  </button>
                </div>
              )}

              {/* Chat prompt */}
              {steps.length > 0 && (
                <button
                  onClick={() => setActiveTab('chat')}
                  className="w-full py-3 rounded-xl bg-white border-2 border-dashed border-purple-300 text-purple-600 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-purple-50 active:scale-95 transition-all"
                >
                  💬 Còn thắc mắc? Hỏi cô giáo trực tiếp!
                </button>
              )}
            </div>
          </div>
        )}

        {/* ═══ TAB: CHAT ════════════════════════════════════════════════════════ */}
        {activeTab === 'chat' && (
          <div className="h-full flex flex-col">
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Welcome bubble */}
              <div className="flex items-end gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm shrink-0">
                  👩‍🏫
                </div>
                <div className="bg-white rounded-2xl rounded-bl-sm border border-gray-200 p-3 max-w-[80%] shadow-sm">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {profile.name ? `Chào ${profile.name}! ` : 'Chào bạn! '}
                    Cô ở đây để giúp {profile.nickname || 'con'} học nha. 🌟
                    <br />
                    <span className="text-gray-400 text-xs">
                      {profile.nickname || 'Con'} có thắc mắc gì không?
                    </span>
                  </p>
                </div>
              </div>

              {/* Chat messages */}
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 ${
                      msg.role === 'user'
                        ? 'bg-blue-100 text-base leading-none'
                        : 'bg-gradient-to-br from-purple-500 to-pink-500'
                    }`}
                  >
                    {msg.role === 'user' ? profile.avatar : '👩‍🏫'}
                  </div>
                  <div
                    className={`max-w-[80%] rounded-2xl p-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-blue-500 text-white rounded-br-sm shadow-md'
                        : 'bg-white border border-gray-200 text-gray-700 rounded-bl-sm shadow-sm'
                    }`}
                  >
                    {msg.text}
                    <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                      {msg.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {chatLoading && (
                <div className="flex items-end gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm shrink-0">
                    👩‍🏫
                  </div>
                  <div className="bg-white rounded-2xl rounded-bl-sm border border-gray-200 p-3 shadow-sm">
                    <div className="flex gap-1 items-center">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                      <span className="text-[11px] text-gray-400 ml-1">Cô đang trả lời...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Chat input bar */}
            <div className="shrink-0 bg-white border-t border-gray-100 px-3 py-3">
              <div className="flex items-end gap-2">
                {/* Mic button */}
                <button
                  onPointerDown={startListening}
                  onPointerUp={stopListening}
                  onPointerLeave={stopListening}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all border-2 ${
                    isListening
                      ? 'bg-red-100 border-red-400 scale-110 shadow-md'
                      : 'bg-gray-100 border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                  }`}
                  title="Giữ để nói"
                >
                  {isListening ? '🔴' : '🎤'}
                </button>

                {/* Text input */}
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={`${profile.nickname || 'Con'} hỏi gì cô nào...`}
                  className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-purple-400 focus:outline-none resize-none leading-relaxed transition-colors"
                  rows={1}
                  style={{ maxHeight: '80px' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendChatMessage();
                    }
                  }}
                />

                {/* Send button */}
                <button
                  onClick={sendChatMessage}
                  disabled={!chatInput.trim() || chatLoading}
                  className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shrink-0 disabled:opacity-40 hover:shadow-md active:scale-90 transition-all"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>
              {isListening && (
                <p className="text-[11px] text-red-500 text-center mt-1 animate-pulse font-medium">
                  🎤 Đang nghe... thả tay để dừng
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── FLOATING VOICE CONTROLS ─────────────────────────────────────────────── */}
      <div
        className={`absolute right-4 z-10 flex flex-col items-end gap-2 transition-all duration-200 ${
          activeTab === 'chat' ? 'bottom-[80px]' : 'bottom-6'
        }`}
      >
        {/* Voice settings panel */}
        {showVoicePanel && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl p-4 w-72 space-y-4 mb-1">
            {/* Panel header */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-800">⚙️ Cài đặt giọng đọc</p>
              <button
                onClick={() => setShowVoicePanel(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Bilingual toggle */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-700">Song ngữ Việt-Anh</p>
                <p className="text-[10px] text-gray-400 truncate">Dùng 2 giọng khác nhau</p>
              </div>
              <button
                onClick={() =>
                  handleUpdateVoiceSettings({ ...voiceSettings, bilingual: !voiceSettings.bilingual })
                }
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                  voiceSettings.bilingual ? 'bg-purple-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    voiceSettings.bilingual ? 'translate-x-[22px]' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Vietnamese voice selector */}
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">
                🇻🇳 Giọng tiếng Việt:
              </label>
              <select
                value={voiceSettings.viVoiceName}
                onChange={(e) =>
                  handleUpdateVoiceSettings({ ...voiceSettings, viVoiceName: e.target.value })
                }
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-purple-400 bg-white"
              >
                <option value="">-- Mặc định --</option>
                {viVoices.map((v) => (
                  <option key={v.name} value={v.name}>{v.name}</option>
                ))}
                {viVoices.length === 0 && (
                  <option disabled>Không tìm thấy giọng tiếng Việt</option>
                )}
              </select>
            </div>

            {/* English voice (shown only when bilingual) */}
            {voiceSettings.bilingual && (
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">
                  🇺🇸 Giọng tiếng Anh:
                </label>
                <select
                  value={voiceSettings.enVoiceName}
                  onChange={(e) =>
                    handleUpdateVoiceSettings({ ...voiceSettings, enVoiceName: e.target.value })
                  }
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-purple-400 bg-white"
                >
                  <option value="">-- Mặc định --</option>
                  {enVoices.map((v) => (
                    <option key={v.name} value={v.name}>{v.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Rate slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-gray-500 uppercase">
                  🐢 Tốc độ
                </label>
                <span className="text-xs font-bold text-purple-600">{voiceSettings.rate.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.1}
                value={voiceSettings.rate}
                onChange={(e) =>
                  handleUpdateVoiceSettings({ ...voiceSettings, rate: parseFloat(e.target.value) })
                }
                className="w-full accent-purple-500"
              />
              <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                <span>0.5x chậm</span>
                <span>2.0x nhanh</span>
              </div>
            </div>

            {/* Pitch slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-gray-500 uppercase">
                  🎵 Cao độ
                </label>
                <span className="text-xs font-bold text-purple-600">{voiceSettings.pitch.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2.0}
                step={0.1}
                value={voiceSettings.pitch}
                onChange={(e) =>
                  handleUpdateVoiceSettings({ ...voiceSettings, pitch: parseFloat(e.target.value) })
                }
                className="w-full accent-purple-500"
              />
            </div>

            {/* Volume slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-gray-500 uppercase">
                  🔊 Âm lượng
                </label>
                <span className="text-xs font-bold text-purple-600">
                  {Math.round(voiceSettings.volume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={voiceSettings.volume}
                onChange={(e) =>
                  handleUpdateVoiceSettings({ ...voiceSettings, volume: parseFloat(e.target.value) })
                }
                className="w-full accent-purple-500"
              />
            </div>

            {/* Test voice button */}
            <button
              onClick={handleTestVoice}
              className="w-full py-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-600 text-xs font-semibold hover:bg-purple-100 active:scale-95 transition-all"
            >
              🎤 Thử giọng đọc
            </button>

            {/* Edit profile button */}
            <button
              onClick={() => {
                setDraftProfile({ ...profile });
                setShowVoicePanel(false);
                setShowProfileForm(true);
              }}
              className="w-full py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-100 active:scale-95 transition-all"
            >
              ✏️ Sửa thông tin học sinh
            </button>
          </div>
        )}

        {/* Control buttons row */}
        <div className="flex items-center gap-2">
          {/* Settings toggle */}
          <button
            onClick={() => setShowVoicePanel((v) => !v)}
            className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-base transition-all active:scale-90 border-2 ${
              showVoicePanel
                ? 'bg-purple-100 border-purple-400 text-purple-600'
                : 'bg-white border-gray-200 text-gray-500 hover:border-purple-300 hover:bg-purple-50'
            }`}
            title="Cài đặt giọng đọc"
          >
            ⚙️
          </button>

          {/* Play / Stop */}
          <button
            onClick={handleToggleSpeak}
            className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-2xl transition-all active:scale-90 border-[3px] ${
              speaking
                ? 'bg-red-500 border-red-300 text-white animate-pulse shadow-red-200'
                : 'bg-gradient-to-br from-purple-500 to-pink-500 border-purple-300 text-white hover:shadow-2xl hover:scale-105'
            }`}
            title={speaking ? 'Dừng đọc' : 'Đọc lời giải'}
          >
            {speaking ? '⏹' : '▶'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceTeacher;
