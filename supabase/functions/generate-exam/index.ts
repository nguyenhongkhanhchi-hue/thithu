import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { sourceExam, difficulty = 'normal', questionCount, focusedCategory, prompt } = body;

    // Ưu tiên: Server secret → Client key truyền lên (fallback khi dev local)
    const serverApiKey = Deno.env.get('ONSPACE_AI_API_KEY') || Deno.env.get('GROQ_API_KEY') || Deno.env.get('GEMINI_API_KEY');
    const clientOnspaceKey = body.clientOnspaceKey || '';
    const clientGroqKey = body.clientGroqKey || '';
    const clientGeminiKey = body.clientGeminiKey || '';

    const onspaceKey = serverApiKey || clientOnspaceKey;
    const groqKey = clientGroqKey;
    const geminiKey = clientGeminiKey;
    const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL') || 'https://api.onspace.ai/v1';

    if (!onspaceKey && !groqKey && !geminiKey) {
      return new Response(JSON.stringify({ 
        error: 'Chưa cấu hình API Key. Vào Cài Đặt → nhập Groq hoặc Gemini API Key để dùng tính năng AI.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (prompt) {
      let rawText = '';
      let success = false;

      // 1. Thử OnSpace (Gemini 3 Flash Preview)
      if (!success && onspaceKey) {
        try {
          const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${onspaceKey}`,
            },
            body: JSON.stringify({
              model: 'google/gemini-3-flash-preview',
              messages: [
                { role: 'user', content: prompt }
              ],
              temperature: 0.7,
            }),
          });
          if (response.ok) {
            const data = await response.json();
            rawText = data.choices?.[0]?.message?.content ?? '';
            if (rawText.length > 50) success = true;
          }
        } catch (e) {
          console.warn('OnSpace prompt failed:', e);
        }
      }

      // 2. Thử Groq
      if (!success && groqKey) {
        try {
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${groqKey}`,
            },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.7,
              max_tokens: 4096,
            }),
          });
          if (response.ok) {
            const data = await response.json();
            rawText = data.choices?.[0]?.message?.content ?? '';
            if (rawText.length > 50) success = true;
          }
        } catch (e) {
          console.warn('Groq prompt failed:', e);
        }
      }

      // 3. Thử Gemini
      if (!success && geminiKey) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
              }),
            }
          );
          if (response.ok) {
            const data = await response.json();
            rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
            if (rawText.length > 50) success = true;
          }
        } catch (e) {
          console.warn('Gemini prompt failed:', e);
        }
      }

      if (!success || !rawText) {
        throw new Error('Tất cả AI providers đều thất bại. Kiểm tra API Key.');
      }

      return new Response(JSON.stringify({ text: rawText }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const difficultyMap: Record<string, string> = {
      easy: 'ĐỘ KHÓ: RẤT DỄ – số nhỏ 1-20, phép tính 1 bước, >80% học sinh làm được',
      normal: 'ĐỘ KHÓ: BÌNH THƯỜNG – tương đương đề gốc, câu bẫy vừa phải',
      hard: 'ĐỘ KHÓ: KHÓ – số 3-4 chữ số, nhiều bước, học sinh khá mới làm >70%',
      very_hard: 'ĐỘ KHÓ: RẤT KHÓ – tổng hợp nhiều kiến thức, chỉ 20-30% học sinh xuất sắc',
    };

    const diffLabel = difficultyMap[difficulty] || difficultyMap.normal;
    const subject = sourceExam?.subject || 'Toán';
    const grade = sourceExam?.grade || 'Lớp 4';

    const allQuestions: string[] = [];
    (sourceExam?.sections || []).forEach((section: any) => {
      (section.questions || []).forEach((q: any) => {
        let qText = `[${q.type}] Câu ${q.number}: ${q.text}`;
        if (q.choices) {
          qText += '\nLựa chọn: ' + q.choices.map((c: any) => `${c.id}. ${c.text}`).join(' | ');
          qText += `\nĐáp án đúng: ${q.correctAnswer}`;
        }
        if (q.solution) qText += `\nLời giải: ${q.solution}`;
        allQuestions.push(qText);
      });
    });

    const categoryInstruction = focusedCategory
      ? `BẮT BUỘC: Toàn bộ đề thi phải tập trung ôn luyện một dạng bài duy nhất là: "${focusedCategory}". Mọi câu hỏi được sinh ra phải cùng dạng bài này nhưng có độ khó tăng dần để bé Mỹ Linh luyện tập nhuần nhuyễn.`
      : 'Biên soạn các câu hỏi đa dạng dựa trên đề gốc hoặc kiến thức chuẩn.';

    const prompt = `Bạn là giáo viên ${subject} ${grade} Việt Nam chuyên nghiệp. Tạo đề thi mới dựa trên cấu trúc đề gốc.

${diffLabel}
${categoryInstruction}

ĐỀ GỐC:
Tiêu đề: ${sourceExam?.title || 'Đề ôn luyện'}
Môn: ${subject} | Lớp: ${grade}
${allQuestions.length > 0 ? 'Câu hỏi gốc:\n' + allQuestions.join('\n\n') : 'Không có câu hỏi mẫu — hãy tự sáng tác dựa trên chương trình ' + grade + ' Việt Nam.'}

YÊU CẦU BẮT BUỘC:
1. ${questionCount ? `Tạo ĐÚNG ${questionCount} câu hỏi (không thừa không thiếu).` : 'Giữ nguyên số lượng câu và cấu trúc phần.'}
2. Thay đổi HOÀN TOÀN số liệu, tên nhân vật, bối cảnh.
3. Trắc nghiệm: đúng 4 lựa chọn A/B/C/D, correctAnswer rõ ràng.
4. Mỗi câu: viết "solution" – lời giải chi tiết từng bước + mẹo nhớ.
5. Phân số viết dạng "a/b" trong text.
6. category mỗi câu = "${focusedCategory || 'Ôn tập tổng hợp'}".
7. Đề đúng chương trình ${grade} Việt Nam.

QUY TẮC JSON: Trả về JSON thuần túy, không markdown, không backtick. Không xuống dòng literal trong chuỗi JSON (dùng \\n).

Trả lời CHÍNH XÁC theo JSON:
{"sections":[{"id":"s1","title":"Phần I: Trắc nghiệm","description":"Khoanh tròn đáp án đúng","questions":[{"id":"q1","number":1,"type":"multiple_choice","text":"Nội dung câu hỏi","category":"${focusedCategory || 'Ôn tập'}","illustrationSvg":"","choices":[{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}],"correctAnswer":"A","points":0.5,"solution":"Giải: ...\\n💡 Mẹo: ..."}]}]}`;

    let rawText = '';
    let success = false;

    // 1. Thử OnSpace (Gemini 3 Flash Preview)
    if (!success && onspaceKey) {
      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${onspaceKey}`,
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              { role: 'system', content: `Bạn là giáo viên ${subject} ${grade} chuyên nghiệp. Chỉ trả lời bằng JSON hợp lệ.` },
              { role: 'user', content: prompt },
            ],
            temperature: 0.7,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          rawText = data.choices?.[0]?.message?.content ?? '';
          if (rawText.length > 50) success = true;
        }
      } catch (e) {
        console.warn('OnSpace failed:', e);
      }
    }

    // 2. Thử Groq
    if (!success && groqKey) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 8192,
            response_format: { type: 'json_object' },
          }),
        });
        if (response.ok) {
          const data = await response.json();
          rawText = data.choices?.[0]?.message?.content ?? '';
          if (rawText.length > 50) success = true;
        }
      } catch (e) {
        console.warn('Groq failed:', e);
      }
    }

    // 3. Thử Gemini
    if (!success && geminiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json' },
            }),
          }
        );
        if (response.ok) {
          const data = await response.json();
          rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          if (rawText.length > 50) success = true;
        }
      } catch (e) {
        console.warn('Gemini failed:', e);
      }
    }

    if (!success || !rawText) {
      throw new Error('Tất cả AI providers đều thất bại. Kiểm tra API Key.');
    }

    // Extract JSON
    const cleaned = rawText.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/im, '').trim();
    let examData: any;
    try {
      examData = JSON.parse(cleaned);
    } catch {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI không trả về JSON hợp lệ.');
      examData = JSON.parse(jsonMatch[0]);
    }

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
