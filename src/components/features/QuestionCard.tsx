import React, { useState, useCallback } from "react";
import { Question, Answer, PenSettings } from "@/types/exam";
import DrawingCanvas from "@/components/features/DrawingCanvas";
import TextWithFractions from "@/components/features/FractionDisplay";
import EssayLines from "@/components/features/EssayLines";
import MathInput from "@/components/features/MathInput";

interface QuestionCardProps {
  question: Question;
  answer: Answer | undefined;
  onAnswer: (answer: Answer) => void;
  penSettings: PenSettings;
  drawMode: boolean;
  showResult?: boolean;
  scoreInfo?: {
    correct: boolean | null;
    earned: number;
    points: number;
    isEssay?: boolean;
  };
  printMode?: boolean;
  essayScore?: number;
  onEssayScoreChange?: (questionId: string, score: number) => void;
  parentScoreMode?: boolean;
}

// Smart solution parser for kid-friendly tips ("💡 Mẹo")
const renderSolution = (solutionText: string) => {
  const parts = solutionText.split(/💡\s*Mẹo/i);
  if (parts.length < 2) {
    return (
      <div className="font-serif text-slate-800 leading-relaxed">
        <TextWithFractions text={solutionText} />
      </div>
    );
  }

  const mainSolution = parts[0].trim();
  // Restore the "💡 Mẹo" prefix to whatever tip was split
  const tipText = "💡 Mẹo" + parts.slice(1).join("💡 Mẹo").trim();

  return (
    <div className="space-y-3.5">
      {mainSolution && (
        <div className="font-serif text-slate-800 bg-white/40 p-2 rounded-xl leading-relaxed">
          <TextWithFractions text={mainSolution} />
        </div>
      )}
      
      {/* Premium Glow Amber Tip Box Card */}
      <div className="bg-gradient-to-br from-amber-50 to-amber-100/60 border-2 border-amber-300 rounded-2xl p-4 shadow-md relative overflow-hidden flex gap-3 items-start animate-fade-in">
        {/* Decorative background icon */}
        <div className="absolute right-[-10px] bottom-[-10px] text-7xl opacity-10 select-none pointer-events-none transform rotate-12">
          💡
        </div>
        
        {/* Animated bulb emoji icon */}
        <div className="text-3xl shrink-0 filter drop-shadow select-none animate-bounce">
          💡
        </div>
        
        <div className="space-y-1 z-10 flex-1">
          <p className="font-extrabold text-amber-800 text-[14px]" style={{ fontFamily: "'Baloo 2', cursive" }}>
            HỘP QUÀ MẸO HAY CHO BÉ:
          </p>
          <div className="text-[13px] text-amber-900 font-semibold leading-relaxed">
            <TextWithFractions text={tipText} />
          </div>
        </div>
      </div>
    </div>
  );
};

const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  answer,
  onAnswer,
  penSettings,
  drawMode,
  showResult,
  scoreInfo,
  printMode = false,
  essayScore,
  onEssayScoreChange,
  parentScoreMode = false,
}) => {
  const [essayText, setEssayText] = useState(answer?.value || "");
  const [showSolution, setShowSolution] = useState(false);
  const [localEssayLines, setLocalEssayLines] = useState<number | undefined>(
    undefined,
  );

  const handleChoiceSelect = useCallback(
    (choiceId: string) => {
      if (drawMode) return;
      onAnswer({ questionId: question.id, value: choiceId });
    },
    [drawMode, onAnswer, question.id],
  );

  const handleEssayChange = useCallback(
    (text: string) => {
      setEssayText(text);
      onAnswer({ questionId: question.id, value: text });
    },
    [onAnswer, question.id],
  );

  const isCorrect = scoreInfo?.correct;
  const isEssay = question.type !== "multiple_choice";
  const labelPrefix = question.subNumber
    ? `Câu ${question.number}${question.subNumber})`
    : `Câu ${question.number}:`;

  const hasSolution = !!question.solution;
  const showWrong = showResult && scoreInfo && isCorrect === false && !isEssay;

  return (
    <div
      className={`relative bg-white rounded-2xl border transition-all ${
        showResult && scoreInfo
          ? isCorrect === true
            ? "border-emerald-300 bg-emerald-50/30"
            : isCorrect === false && !isEssay
              ? "border-red-300 bg-red-50/30"
              : isEssay
                ? "border-amber-200 bg-amber-50/20"
                : "border-gray-200"
          : "border-gray-200"
      } overflow-hidden`}
    >
      {/* Draw canvas overlay */}
      {drawMode && !printMode && (
        <div className="absolute inset-0 z-20">
          <DrawingCanvas
            penSettings={penSettings}
            isActive={drawMode}
            onDataChange={(data) =>
              onAnswer({
                questionId: question.id,
                value: answer?.value || "",
                drawnData: data,
              })
            }
          />
        </div>
      )}

      {/* Result solutions and score info */}
      <div className={`p-4 ${drawMode ? "select-none" : ""}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1">
            <p className="font-semibold text-gray-800 text-[15px] leading-snug">
              <span className="text-blue-600 mr-1.5 font-bold">
                {labelPrefix}
              </span>
              <TextWithFractions text={question.text} />
            </p>
            {question.category && (
              <div className="mt-2 inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider select-none">
                <span>🎯 Dạng bài:</span>
                <span>{question.category}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {showResult && scoreInfo && (
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  isCorrect === true
                    ? "bg-emerald-100 text-emerald-700"
                    : isCorrect === false && !isEssay
                      ? "bg-red-100 text-red-600"
                      : "bg-amber-100 text-amber-700"
                }`}
              >
                {scoreInfo.earned}/{scoreInfo.points}đ
              </span>
            )}
            <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {question.points}đ
            </span>
          </div>
        </div>

        {/* SVG Illustration if available */}
        {question.illustrationSvg && (
          <div className="my-4 bg-slate-50 border-2 border-slate-200/60 rounded-2xl p-4 flex items-center justify-center overflow-x-auto shadow-inner select-none relative group max-w-full">
            <div 
              className="w-full flex justify-center items-center [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:block [&_svg]:mx-auto"
              dangerouslySetInnerHTML={{ __html: question.illustrationSvg }}
            />
          </div>
        )}

        {/* Multiple choice */}
        {question.type === "multiple_choice" && question.choices && (
          <div className="grid gap-2">
            {question.choices.map((choice) => {
              const isSelected = answer?.value === choice.id;
              const isCorrectChoice =
                showResult && question.correctAnswer === choice.id;
              const isWrongSelected =
                showResult && isSelected && !isCorrectChoice;

              return (
                <button
                  key={choice.id}
                  onClick={() => handleChoiceSelect(choice.id)}
                  disabled={drawMode || printMode || !!showResult}
                  className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl border-2 font-medium text-[14px] transition-all active:scale-[0.98] min-h-[52px] ${
                    isCorrectChoice && showResult
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : isWrongSelected
                        ? "border-red-400 bg-red-50 text-red-800"
                        : isSelected
                          ? "border-blue-500 bg-blue-50 text-blue-800"
                          : "border-gray-200 bg-gray-50 text-gray-700 hover:border-blue-300 hover:bg-blue-50/50"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 font-bold text-sm ${
                      isCorrectChoice && showResult
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : isWrongSelected
                          ? "border-red-500 bg-red-500 text-white"
                          : isSelected
                            ? "border-blue-500 bg-blue-500 text-white"
                            : "border-gray-300 text-gray-500"
                    }`}
                  >
                    {isSelected && !showResult ? "●" : choice.id}
                  </div>
                  <span className="flex-1">
                    <TextWithFractions text={choice.text} />
                  </span>
                  {isCorrectChoice && showResult && (
                    <span className="text-emerald-600 font-bold text-lg">
                      ✓
                    </span>
                  )}
                  {isWrongSelected && (
                    <span className="text-red-500 font-bold text-lg">✗</span>
                  )}
                </button>
              );
            })}

            {/* Show solution for wrong MC answers */}
            {showWrong && hasSolution && (
              <div className="mt-2">
                <button
                  onClick={() => setShowSolution((v) => !v)}
                  className="flex items-center gap-2 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg w-full active:scale-[0.98]"
                >
                  <span>💡</span>
                  <span>
                    {showSolution
                      ? "Ẩn lời giải"
                      : "Xem đáp án & lời giải chi tiết"}
                  </span>
                </button>
                {showSolution && (
                  <div className="mt-2 bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-sm text-blue-900 leading-relaxed whitespace-pre-line">
                    <p className="font-extrabold text-blue-700 mb-1.5 flex items-center gap-1.5" style={{ fontFamily: "'Baloo 2', cursive" }}>
                      📖 LỜI GIẢI CHI TIẾT:
                    </p>
                    {renderSolution(question.solution || "")}
                  </div>
                )}
              </div>
            )}
            {/* Show solution for correct MC too (toggle) */}
            {showResult && isCorrect === true && hasSolution && (
              <button
                onClick={() => setShowSolution((v) => !v)}
                className="mt-1 flex items-center gap-2 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg active:scale-[0.98]"
              >
                💡 {showSolution ? "Ẩn giải thích" : "Xem giải thích"}
              </button>
            )}
            {showResult &&
              isCorrect === true &&
              hasSolution &&
              showSolution && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-sm text-emerald-900 leading-relaxed whitespace-pre-line">
                  <p className="font-extrabold text-emerald-700 mb-1.5 flex items-center gap-1.5" style={{ fontFamily: "'Baloo 2', cursive" }}>
                    🎉 GIẢI THÍCH CHI TIẾT:
                  </p>
                  {renderSolution(question.solution || "")}
                </div>
              )}
          </div>
        )}

        {/* Essay / calculation */}
        {isEssay && (
          <div className="mt-2 space-y-3">
            {printMode ? (
              <EssayLines
                questionText={question.text}
                lineCount={localEssayLines}
              />
            ) : !drawMode && !showResult ? (
              <div className="space-y-2">
                <MathInput
                  value={essayText}
                  onChange={handleEssayChange}
                  placeholder="Viết lời giải vào đây..."
                  questionId={question.id}
                  subject={question.category || ''}
                />
                <button
                  onClick={() => setLocalEssayLines((v) => (v ?? 5) + 3)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg px-3 py-1.5 active:scale-95 transition-all"
                >
                  <span className="text-base font-bold text-gray-600">＋</span>
                  <span>Thêm 3 dòng</span>
                </button>
              </div>
            ) : showResult ? (
              <div className="space-y-3">
                {/* Student's answer */}
                {essayText && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">
                      Bài làm của bé:
                    </p>
                    <div className="text-sm text-gray-800 whitespace-pre-line leading-relaxed font-serif">
                      <TextWithFractions text={essayText} />
                    </div>
                  </div>
                )}

                {/* Reference solution */}
                {hasSolution && (
                  <div>
                    <button
                      onClick={() => setShowSolution((v) => !v)}
                      className="flex items-center gap-2 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg w-full active:scale-[0.98]"
                    >
                      <span>📖</span>
                      <span>
                        {showSolution
                          ? "Ẩn đáp án"
                          : "Xem đáp án & lời giải mẫu"}
                      </span>
                    </button>
                    {showSolution && (
                      <div className="mt-2 bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-sm text-blue-900 leading-relaxed whitespace-pre-line">
                        <p className="font-extrabold text-blue-700 mb-1.5 flex items-center gap-1.5" style={{ fontFamily: "'Baloo 2', cursive" }}>
                          📝 LỜI GIẢI MẪU CHI TIẾT:
                        </p>
                        {renderSolution(question.solution || "")}
                      </div>
                    )}
                  </div>
                )}

                {/* Parent score input */}
                {parentScoreMode && onEssayScoreChange && (
                  <div className="bg-purple-50 border-purple-200 border-2 rounded-xl p-3">
                    <p className="text-xs font-bold text-purple-700 mb-2">
                      👨‍👩‍👧 Phụ huynh chấm điểm tự luận (tối đa {question.points}{" "}
                      điểm):
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {Array.from(
                        { length: Math.round(question.points / 0.25) + 1 },
                        (_, i) => i * 0.25,
                      )
                        .filter((v) => v <= question.points)
                        .map((v) => (
                          <button
                            key={v}
                            onClick={() => onEssayScoreChange(question.id, v)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-bold border-2 transition-all active:scale-95 ${
                              essayScore === v
                                ? "bg-purple-600 text-white border-purple-600"
                                : "bg-white text-gray-600 border-gray-300 hover:border-purple-400"
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Non-result, non-edit (fallback for drawing mode or other states)
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 min-h-[100px]">
                {essayText ? (
                  <div className="text-sm text-gray-800 whitespace-pre-line leading-relaxed font-serif">
                    <TextWithFractions text={essayText} />
                  </div>
                ) : (
                  <p className="text-gray-300 italic text-sm">Chưa có bài làm...</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>


    </div>
  );
};

export default QuestionCard;
