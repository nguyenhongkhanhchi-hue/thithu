import { Exam, Answer } from '@/types/exam';

export interface ScoreResult {
  score: number;
  totalPoints: number;
  percentage: number;
  correctCount: number;
  totalMC: number;
  mcPoints: number;
  essayPoints: number; // max points for essay questions
  perQuestion: Record<string, { correct: boolean | null; points: number; earned: number; isEssay: boolean }>;
}

export function calculateScore(exam: Exam, answers: Answer[], essayScores?: Record<string, number>): ScoreResult {
  const answerMap: Record<string, string> = {};
  answers.forEach((a) => {
    answerMap[a.questionId] = a.value;
  });

  let score = 0;
  let totalPoints = 0;
  let correctCount = 0;
  let totalMC = 0;
  let mcPoints = 0;
  let essayPoints = 0;
  const perQuestion: Record<string, { correct: boolean | null; points: number; earned: number; isEssay: boolean }> = {};

  exam.sections.forEach((section) => {
    section.questions.forEach((q) => {
      totalPoints += q.points;
      if (q.type === 'multiple_choice') {
        totalMC++;
        mcPoints += q.points;
        const userAns = answerMap[q.id] || '';
        const isCorrect = q.correctAnswer ? userAns === q.correctAnswer : false;
        const earned = isCorrect ? q.points : 0;
        score += earned;
        if (isCorrect) correctCount++;
        perQuestion[q.id] = { correct: isCorrect, points: q.points, earned, isEssay: false };
      } else {
        // Essay/calculation: scored separately by parent
        essayPoints += q.points;
        const parentScore = essayScores?.[q.id];
        const earned = parentScore !== undefined ? Math.min(parentScore, q.points) : 0;
        score += earned;
        perQuestion[q.id] = { correct: null, points: q.points, earned, isEssay: true };
      }
    });
  });

  return {
    score: Math.round(score * 10) / 10,
    totalPoints,
    percentage: Math.round((score / totalPoints) * 100),
    correctCount,
    totalMC,
    mcPoints,
    essayPoints,
    perQuestion,
  };
}

export function calculateMCOnlyScore(exam: Exam, answers: Answer[]): ScoreResult {
  return calculateScore(exam, answers, {});
}

export async function gradeEssayWithAI(
  questionText: string,
  solution: string,
  studentAnswer: string,
  maxPoints: number
) {
  try {
    const analysisPrompt = `Bạn là cô giáo chấm bài tự luận toán/tiếng việt tiểu học.
Hãy chấm điểm dựa trên:
1. ĐÚNG KẾT QUẢ (50% số điểm)
2. ĐÚNG CÁC BƯỚC GIẢI THÍCH (50% số điểm) - Nếu chỉ có kết quả mà không có lời giải/phép tính trung gian, hãy trừ 50% điểm để chống sao chép.
3. Trình bày rõ ràng, mạch lạc.

Câu hỏi: ${questionText}
Đáp án mẫu: ${solution}
Bài làm của học sinh: ${studentAnswer}
Thang điểm tối đa: ${maxPoints}

Trả về JSON (không markdown):
{
  "score": (số điểm từ 0 đến ${maxPoints}),
  "feedback": "Lời nhận xét ngắn gọn, khích lệ bé (2-3 câu). Nếu bé thiếu bước giải, hãy nhắc bé."
}`;

    const { callInternalAI } = await import('./gemini');
    const data = await callInternalAI('ocr-extract', {
      textContent: `CHẤM ĐIỂM TỰ LUẬN:\n${analysisPrompt}`,
      prompt: analysisPrompt
    });

    return {
      score: Number(data.score || data.exam?.score || 0),
      feedback: data.feedback || data.exam?.feedback || "Cô đã xem bài làm của con."
    };
  } catch (error) {
    console.error("AI Grading Error:", error);
    return { score: 0, feedback: "Cô gặp chút lỗi khi chấm bài, con đợi tí nhé." };
  }
}
