import { corsHeaders } from '../_shared/cors.ts';

const apiKey = Deno.env.get('ONSPACE_AI_API_KEY');
const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { imageBase64, imageUrl, textContent, fileType, mimeType = 'image/jpeg' } = body;

    const prompt = `Bạn là giáo viên Việt Nam. Hãy phân tích nội dung này và trích xuất tất cả câu hỏi.

Yêu cầu:
1. Trích xuất đầy đủ tất cả câu hỏi, bao gồm số câu, nội dung
2. Với câu trắc nghiệm: trích xuất đủ 4 lựa chọn A/B/C/D và đáp án đúng (nếu có đánh dấu)
3. Với câu tự luận/điền khuyết: trích xuất đầy đủ đề bài
4. Phân số viết dạng a/b
5. Xác định môn học, lớp, tiêu đề đề thi nếu có
6. Viết lời giải chi tiết cho từng câu vào trường "solution" (nếu có thể suy luận được)
7. Hỗ trợ mọi môn học: Toán, Tiếng Việt, Khoa học, Lịch sử, Địa lý, Tiếng Anh, v.v.

QUY TẮC JSON:
- Trả về JSON thuần túy, không có markdown.
- Không sử dụng ký tự xuống dòng (newline) bên trong giá trị chuỗi, hãy sử dụng \\n nếu cần.
- Đảm bảo tất cả dấu ngoặc kép bên trong chuỗi được thoát (escaped) bằng \\".

Trả lời CHÍNH XÁC theo định dạng JSON:
{
  "title": "Tên đề thi",
  "subject": "Môn học (Toán/Tiếng Việt/Khoa học/...)",
  "grade": "Lớp X",
  "duration": 40,
  "totalPoints": 10,
  "sections": [
    {
      "id": "s1",
      "title": "Phần I: Trắc nghiệm",
      "description": "Mô tả phần thi",
      "questions": [
        {
          "id": "q1a",
          "number": 1,
          "subNumber": "a",
          "type": "multiple_choice",
          "text": "Nội dung câu hỏi",
          "choices": [
            {"id": "A", "text": "..."},
            {"id": "B", "text": "..."},
            {"id": "C", "text": "..."},
            {"id": "D", "text": "..."}
          ],
          "correctAnswer": "A",
          "points": 0.5,
          "solution": "Giải thích tại sao đáp án A đúng..."
        }
      ]
    }
  ]
}`;

    let userContent: any[] = [{ type: 'text', text: '' }];

    if (textContent) {
      // Xử lý OCR từ văn bản thuần (DOCX)
      userContent = [
        { 
          type: 'text', 
          text: `Bạn là giáo viên Việt Nam. Hãy phân tích nội dung văn bản sau và trích xuất thành đề thi.\n\nNỘI DUNG VĂN BẢN:\n${textContent}\n\n${prompt}` 
        }
      ];
    } else if (imageBase64 || imageUrl) {
      // Xử lý OCR từ hình ảnh
      const imageContent = imageBase64
        ? { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
        : { type: 'image_url', image_url: { url: imageUrl } };
      
      userContent = [
        { type: 'text', text: prompt },
        imageContent
      ];
    } else {
      throw new Error('Cần truyền imageBase64, imageUrl hoặc textContent');
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'user',
            content: userContent,
          },
        ],
      }),
    });

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content ?? '';

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('OCR AI không trả về JSON hợp lệ');
    }

    const examData = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({ exam: examData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('ocr-extract error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
