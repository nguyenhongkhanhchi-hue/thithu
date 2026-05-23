import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
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
    return res.status(500).json({ error: "GEMINI_API_KEY chưa được cấu hình" });
  }

  const {
    imageBase64,
    imageUrl,
    mimeType = "image/jpeg",
    textContent,
    fileType,
  } = req.body;

  // Phải có ít nhất 1 trong 3: imageBase64, imageUrl, textContent
  if (!imageBase64 && !imageUrl && !textContent) {
    return res
      .status(400)
      .json({ error: "Cần truyền imageBase64, imageUrl, hoặc textContent" });
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // Prompt dùng chung cho mọi loại file
  const examPrompt = `Bạn là giáo viên Việt Nam. Hãy phân tích nội dung đề thi và trích xuất tất cả câu hỏi.

Yêu cầu:
1. Trích xuất đầy đủ tất cả câu hỏi, bao gồm số câu, nội dung.
2. Với câu trắc nghiệm: trích xuất đủ 4 lựa chọn A/B/C/D và đáp án đúng (nếu có).
3. Với câu tự luận/điền khuyết: trích xuất đầy đủ đề bài.
4. PHÂN SỐ VÀ TOÁN HỌC: Bắt buộc viết phân số dưới dạng a/b (ví dụ: 3/4, 1/2) trong mọi nội dung, các lựa chọn và phần solution. Không viết phân số dưới dạng LaTeX hay hiển thị cùng một dòng.
5. Xác định môn học, lớp, tiêu đề đề thi nếu có.
6. Viết lời giải chi tiết cho từng câu vào trường "solution". Ở cuối mỗi "solution", bạn phải bắt buộc thêm một dòng Mẹo học tập cho bé bằng tiếng Việt với định dạng sau tùy theo môn học:
   - Nếu là Toán hoặc có liên quan tính toán: "💡 Mẹo nhỏ cho bé tránh ẩu tả: [mẹo tính toán, kiểm tra kết quả hoặc cách nhớ công thức dễ thương]"
   - Nếu là Tiếng Anh hoặc Ngoại ngữ: "💡 Mẹo ghi nhớ siêu nhanh: [mẹo bằng thơ, vè, hoặc liên tưởng vui nhộn]"
   - Với các môn học khác: "💡 Mẹo nhớ nhanh: [tóm tắt bài học ngắn gọn, dễ thuộc]"
7. Hỗ trợ nhiều môn học: Toán, Tiếng Việt, Khoa học, Lịch sử, Địa lý, Tiếng Anh...

QUY TẮC JSON:
- Trả về JSON thuần túy, không có markdown.
- Không sử dụng ký tự xuống dòng (newline) bên trong giá trị chuỗi, hãy sử dụng \\n nếu cần.
- Đảm bảo tất cả dấu ngoặc kép bên trong chuỗi được thoát (escaped) bằng \\".

Trả lời CHÍNH XÁC theo JSON sau:
{"title":"Tên đề thi","subject":"Môn học","grade":"Lớp X","duration":40,"totalPoints":10,"sections":[{"id":"s1","title":"Phần I: Trắc nghiệm","description":"Mô tả","questions":[{"id":"q1","number":1,"type":"multiple_choice","text":"Nội dung câu hỏi","choices":[{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}],"correctAnswer":"A","points":0.5,"solution":"Giải chi tiết... \\n💡 Mẹo nhỏ cho bé tránh ẩu tả: Hãy kiểm tra kỹ xem tử số có nhỏ hơn mẫu số không nhé!"}]}]}`;

  try {
    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" },
    });

    let result;

    // ─── DOCX / TEXT: gửi text thuần cho Gemini ───────────────────────
    if (textContent) {
      const textPrompt = `${examPrompt}

NỘI DUNG ĐỀ THI (từ file ${fileType?.toUpperCase() || "DOCX"}):
---
${textContent}
---`;
      result = await model.generateContent(textPrompt);

      // ─── ẢNH hoặc PDF: gửi dạng inlineData ───────────────────────────
    } else {
      let base64Data: string;
      let detectedMime: string;

      if (imageBase64) {
        base64Data = imageBase64;
        detectedMime = mimeType;
      } else {
        // Fetch từ URL rồi convert sang base64
        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok)
          throw new Error(`Không tải được file từ URL: ${imageUrl}`);
        const buffer = await imgRes.arrayBuffer();
        base64Data = Buffer.from(buffer).toString("base64");
        detectedMime = imgRes.headers.get("content-type") || "image/jpeg";
      }

      result = await model.generateContent([
        examPrompt,
        {
          inlineData: {
            mimeType: detectedMime as any,
            data: base64Data,
          },
        },
      ]);
    }

    const rawText = result.response.text();

    // Parse JSON
    let examData: any;
    try {
      examData = JSON.parse(rawText);
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(
          "AI không trả về JSON hợp lệ. Raw: " + rawText.slice(0, 200),
        );
      }
      examData = JSON.parse(jsonMatch[0]);
    }

    return res.status(200).json({ exam: examData });
  } catch (err: any) {
    console.error("ocr-extract error:", err);
    return res
      .status(500)
      .json({ error: err.message || "Internal server error" });
  }
}
