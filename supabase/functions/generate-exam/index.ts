import { corsHeaders } from '../_shared/cors.ts';

const apiKey = Deno.env.get('ONSPACE_AI_API_KEY');
const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sourceExam, difficulty = 'normal', questionCount } = await req.json();

    const difficultyMap: Record<string, string> = {
      easy: `ĐỘ KHÓ: RẤT DỄ – dành cho học sinh yếu/mới bắt đầu:
- Trắc nghiệm: số nguyên nhỏ (1-20), phép tính đơn giản 1 bước, sai lầm phổ biến dễ thấy
- Tự luận: bài 1-2 bước đơn giản, số nhỏ, không cần nhiều suy luận
- Tổng thể: học sinh trung bình làm được >80%`,
      normal: `ĐỘ KHÓ: BÌNH THƯỜNG – tương đương đề gốc:
- Thay đổi số liệu và bối cảnh, giữ nguyên cấu trúc và độ khó
- Câu bẫy vừa phải, cần đọc kỹ đề`,
      hard: `ĐỘ KHÓ: KHÓ – dành cho học sinh khá/giỏi:
- Trắc nghiệm: số lớn (3-4 chữ số), phép tính nhiều bước, đáp án gây nhầm lẫn cao
- Tự luận: bài 3-4 bước, kết hợp nhiều kiến thức, cần trình bày đầy đủ
- Sử dụng tính chất nâng cao, bài toán có điều kiện phức tạp
- Tổng thể: học sinh giỏi mới làm được >70%`,
      very_hard: `ĐỘ KHÓ: RẤT KHÓ – dành cho học sinh giỏi xuất sắc:
- Trắc nghiệm: số rất lớn, cần tư duy logic, câu hỏi đảo ngược, đáp án nhiễu rất tinh vi
- Tự luận: bài toán tổng hợp 4-5 bước, kết hợp nhiều dạng bài, cần phân tích sâu
- Bài toán có ẩn dụ, yêu cầu chứng minh, tính ngược
- Tổng thể: chỉ ~20-30% học sinh giỏi làm được đúng toàn bộ`,
    };

    const diffLabel = difficultyMap[difficulty] || difficultyMap.normal;
    const subject = sourceExam.subject || 'Toán';
    const grade = sourceExam.grade || 'Lớp 4';

    // Collect all questions from source exam
    const allQuestions: string[] = [];
    sourceExam.sections.forEach((section: any) => {
      section.questions.forEach((q: any) => {
        let qText = `[${q.type}] Câu ${q.number}${q.subNumber ? q.subNumber + ')' : ':'} ${q.text}`;
        if (q.choices) {
          qText += '\nLựa chọn: ' + q.choices.map((c: any) => `${c.id}. ${c.text}`).join(' | ');
          qText += `\nĐáp án đúng: ${q.correctAnswer}`;
        }
        if (q.solution) qText += `\nLời giải: ${q.solution}`;
        allQuestions.push(qText);
      });
    });

    const prompt = `Bạn là giáo viên ${subject} ${grade} Việt Nam chuyên nghiệp. Tạo đề thi mới dựa trên cấu trúc đề gốc.

${diffLabel}

ĐỀ GỐC:
Tiêu đề: ${sourceExam.title}
Môn: ${subject} | Lớp: ${grade}
Câu hỏi gốc:
${allQuestions.join('\n\n')}

YÊU CẦU BẮT BUỘC:
1. ${questionCount ? `Tạo ĐÚNG ${questionCount} câu hỏi (không thừa không thiếu), phân bố hợp lý giữa các phần.` : 'Giữ nguyên số lượng câu và cấu trúc phần (trắc nghiệm/tự luận)'}
2. Thay đổi HOÀN TOÀN số liệu, tên nhân vật, bối cảnh
3. Với trắc nghiệm: tạo đúng 4 lựa chọn A/B/C/D, đáp án đúng và 3 đáp án nhiễu hợp lý
4. Với mỗi câu: viết "solution" – lời giải chi tiết từng bước (QUAN TRỌNG)
5. Phân số viết dạng "a/b" trong text
6. Đề phải đúng kiến thức chương trình ${grade} Việt Nam
7. Áp dụng đúng độ khó đã yêu cầu (phải thực sự khác biệt)
8. "solution" phải đầy đủ: công thức, tính toán từng bước, kết quả

QUY TẮC JSON:
- Trả về JSON thuần túy, không có markdown.
- Không sử dụng ký tự xuống dòng (newline) bên trong giá trị chuỗi, hãy sử dụng \\n nếu cần.
- Đảm bảo tất cả dấu ngoặc kép bên trong chuỗi được thoát (escaped) bằng \\".

Trả lời CHÍNH XÁC theo JSON:
{
  "title": "Tên đề thi mới",
  "sections": [
    {
      "id": "s1",
      "title": "Tên phần",
      "description": "Mô tả",
      "questions": [
        {
          "id": "q1a",
          "number": 1,
          "subNumber": "a",
          "type": "multiple_choice",
          "text": "Nội dung câu hỏi",
          "choices": [
            {"id": "A", "text": "Lựa chọn A"},
            {"id": "B", "text": "Lựa chọn B"},
            {"id": "C", "text": "Lựa chọn C"},
            {"id": "D", "text": "Lựa chọn D"}
          ],
          "correctAnswer": "A",
          "points": 0.5,
          "solution": "Giải: ... Vậy đáp án đúng là A."
        }
      ]
    }
  ]
}`;

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
            role: 'system',
            content: `Bạn là giáo viên ${subject} ${grade} chuyên nghiệp tạo đề thi chuẩn Việt Nam. Chỉ trả lời bằng JSON hợp lệ, không markdown, không giải thích ngoài JSON.`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content ?? '';

    // Extract JSON from response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI không trả về JSON hợp lệ: ' + rawText.slice(0, 300));
    }

    const examData = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({ exam: examData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('generate-exam error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
