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
      error: "GEMINI_API_KEY chưa được cấu hình trong Environment Variables",
    });
  }

  try {
    const { questionText, studentAnswer, solution, maxPoints = 1 } = req.body;

    if (!questionText || studentAnswer === undefined) {
      return res.status(400).json({ error: "Thiếu dữ liệu questionText hoặc studentAnswer" });
    }

    const prompt = `Bạn là cô giáo chấm bài tự luận toán/tiếng việt tiểu học Việt Nam.
Hãy chấm điểm dựa trên 3 tiêu chí:
1. ĐÚNG KẾT QUẢ (50% số điểm)
2. ĐÚNG CÁC BƯỚC GIẢI THÍCH (50% số điểm) - Nếu chỉ có kết quả mà không có lời giải/phép tính trung gian, hãy trừ 50% điểm để chống sao chép.
3. Trình bày rõ ràng, mạch lạc, dùng ngôn ngữ trẻ em.

LƯU Ý VỀ ĐỊNH DẠNG:
- Học sinh viết phân số theo dạng a/b (ví dụ: 1/2, 3/4). Hãy hiểu đây là phân số chuẩn.
- Các ký hiệu toán học như ×, :, +, - đều được sử dụng.

Câu hỏi (${maxPoints} điểm):
${questionText}

Đáp án mẫu:
${solution || "(Hãy tự suy luận đáp án đúng)"}

Bài làm của học sinh:
${studentAnswer}

Yêu cầu:
- Chấm điểm từ 0 đến ${maxPoints} (được dùng số thập phân)
- Nhận xét ngắn gọn, khích lệ bé (2-3 câu). Nếu thiếu bước giải hãy nhắc nhở.
- Nếu bé chép y nguyên đáp án mẫu mà không có sự thay đổi ngôn ngữ, hãy trừ điểm sáng tạo.

QUY TẮC JSON:
- Trả về JSON thuần túy, không có markdown.
- Không sử dụng ký tự xuống dòng (newline) bên trong giá trị chuỗi, hãy sử dụng \\n nếu cần.
- Đảm bảo tất cả dấu ngoặc kép bên trong chuỗi được thoát (escaped) bằng \\".

TRẢ VỀ JSON CHÍNH XÁC THEO ĐỊNH DẠNG SAU:
{"score": 0.5, "feedback": "Nhận xét của cô..."}`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.5,
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent(prompt);
    const rawText = result.response.text();

    // Parse JSON
    let parsedData: any;
    try {
      parsedData = JSON.parse(rawText);
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("AI không trả về JSON hợp lệ: " + rawText.slice(0, 300));
      }
      parsedData = JSON.parse(jsonMatch[0]);
    }

    return res.status(200).json(parsedData);
  } catch (err: any) {
    console.error("grade-essay error:", err);
    return res
      .status(500)
      .json({ error: err.message || "Internal server error" });
  }
}
