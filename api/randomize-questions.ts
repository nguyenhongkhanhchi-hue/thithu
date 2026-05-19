import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
    return res.status(200).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY chưa được cấu hình",
    });
  }

  try {
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: "Thiếu danh sách câu hỏi" });
    }

    const questionsList = questions.map((q: any, i: number) => {
      let qText = `[ID:${q.id}] ${q.text}`;
      if (q.choices) {
        qText += "\nLựa chọn: " + q.choices.map((c: any) => `${c.id}. ${c.text}`).join(" | ");
        qText += `\nĐáp án đúng: ${q.correctAnswer}`;
      }
      if (q.solution) qText += `\nLời giải: ${q.solution}`;
      return qText;
    }).join("\n\n---\n\n");

    const prompt = `Bạn là một chuyên gia giáo dục. Tôi có một danh sách câu hỏi ôn tập. 
Nhiệm vụ của bạn là XÁO TRỘN DỮ LIỆU (số liệu, tên nhân vật, bối cảnh) của từng câu hỏi để học sinh không thể gian lận bằng cách nhớ đáp án cũ, nhưng phải GIỮ NGUYÊN logic, dạng bài và độ khó.

DANH SÁCH CÂU HỎI GỐC:
${questionsList}

YÊU CẦU:
1. Thay đổi số liệu (ví dụ: 15 thành 24, 1/2 thành 3/4) một cách hợp lý để kết quả vẫn là số đẹp hoặc phù hợp với chương trình học.
2. Cập nhật lại các lựa chọn A/B/C/D và đáp án đúng tương ứng với số liệu mới.
3. Cập nhật lại Lời giải (solution) chi tiết từng bước cho số liệu mới.
4. Giữ nguyên ID của từng câu hỏi để tôi có thể map lại.
5. Phân số viết dạng "a/b".

QUY TẮC JSON:
- Trả về JSON thuần túy: {"questions": [{"id": "...", "text": "...", "choices": [...], "correctAnswer": "...", "solution": "..."}]}
- Không dùng markdown.
- Không dùng newline trong chuỗi, dùng \\n.

TRẢ VỀ JSON:`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.8,
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent(prompt);
    const rawText = result.response.text();

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("AI response is not valid JSON");
      data = JSON.parse(jsonMatch[0]);
    }

    return res.status(200).json(data);
  } catch (err: any) {
    console.error("randomize-questions error:", err);
    return res.status(500).json({ error: err.message });
  }
}
