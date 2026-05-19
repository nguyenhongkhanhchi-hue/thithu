/**
 * ai.ts (gemini.ts) — Multi-provider AI client cho ExamTouch
 *
 * Chiến lược provider:
 *  - Ảnh / PDF OCR   → Gemini 1.5 Flash (1,000 req/ngày FREE, hỗ trợ vision)
 *  - DOCX text OCR   → Groq llama-3.3-70b (1,000 req/ngày FREE, text only)
 *  - Tạo đề thi AI   → Groq llama-3.1-8b-instant (14,400 req/ngày FREE) hoặc Gemini
 *
 * Env vars cần set trong .env.local:
 *   VITE_GEMINI_API_KEY   → lấy FREE tại: https://aistudio.google.com/apikey
 *   VITE_GROQ_API_KEY     → lấy FREE tại: https://console.groq.com/keys
 *   VITE_ONSPACE_AI_API_KEY → (Tùy chọn) key từ OnSpace.ai để dùng Gemini 3 Flash Preview
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { AICredits, Difficulty, Exam, ExamSection } from "@/types/exam";
import { generateId } from "@/lib/storage";

// ── API Keys ──────────────────────────────────────────────────────────────────
const GEMINI_KEYS = (): string[] => {
  try {
    const stored = localStorage.getItem("VITE_GEMINI_API_KEYS");
    if (stored) return JSON.parse(stored);
    const single = (localStorage.getItem("VITE_GEMINI_API_KEY") || (import.meta as any).env?.VITE_GEMINI_API_KEY) as string;
    return single ? [single] : [];
  } catch { return []; }
};

const GROQ_KEYS = (): string[] => {
  try {
    const stored = localStorage.getItem("VITE_GROQ_API_KEYS");
    if (stored) return JSON.parse(stored);
    const single = (localStorage.getItem("VITE_GROQ_API_KEY") || (import.meta as any).env?.VITE_GROQ_API_KEY) as string;
    return single ? [single] : [];
  } catch { return []; }
};

const ONSPACE_KEYS = (): string[] => {
  try {
    const stored = localStorage.getItem("VITE_ONSPACE_AI_API_KEYS");
    if (stored) return JSON.parse(stored);
    const single = (localStorage.getItem("VITE_ONSPACE_AI_API_KEY") || (import.meta as any).env?.VITE_ONSPACE_AI_API_KEY) as string;
    return single ? [single] : [];
  } catch { return []; }
};

const ONSPACE_BASE_URL = (import.meta as any).env?.VITE_ONSPACE_AI_BASE_URL || "https://api.onspace.ai/v1";

/** Kiểm tra có provider nào không */
export function hasAnyProvider(): boolean {
  return GEMINI_KEYS().length > 0 || GROQ_KEYS().length > 0 || ONSPACE_KEYS().length > 0;
}

/** Thông tin thiếu key để hiển thị hướng dẫn */
export function getMissingProviders(): string[] {
  const missing: string[] = [];
  if (GEMINI_KEYS().length === 0)
    missing.push("VITE_GEMINI_API_KEY (https://aistudio.google.com/apikey)");
  if (GROQ_KEYS().length === 0)
    missing.push("VITE_GROQ_API_KEY (https://console.groq.com/keys)");
  if (ONSPACE_KEYS().length === 0)
    missing.push("VITE_ONSPACE_AI_API_KEY (OnSpace.ai / Bolt.new)");
  return missing;
}

// ── Credits tracking ──────────────────────────────────────────────────────────
const CREDITS_KEY = "examtouch_ai_credits";

/** Giới hạn hiển thị trong app (thực tế provider có limit riêng) */
const APP_LIMITS = {
  gemini: 1000, // Gemini 1.5 Flash: 1,000 RPD
  groq: 14400, // Groq llama-3.1-8b-instant: 14,400 RPD
  onspace: 1000, // OnSpace AI: 1,000 RPD (giả định)
};

export interface ProviderCredits {
  gemini: { used: number; limit: number; remaining: number };
  groq: { used: number; limit: number; remaining: number };
  onspace: { used: number; limit: number; remaining: number };
  date: string;
}

export function getAICredits(): AICredits {
  const raw = getRawCredits();
  const total = raw.gemini.used + raw.groq.used + raw.onspace.used;
  const limit = APP_LIMITS.gemini + APP_LIMITS.groq + APP_LIMITS.onspace;
  return {
    used: total,
    date: raw.date,
    dailyLimit: limit,
  };
}

export function getProviderCredits(): ProviderCredits {
  return getRawCredits();
}

function getRawCredits(): ProviderCredits {
  const fresh = freshCredits();
  try {
    const today = new Date().toISOString().split("T")[0];
    const stored = localStorage.getItem(CREDITS_KEY);
    if (stored) {
      const d = JSON.parse(stored) as any;
      if (d.date === today) {
        return {
          date: today,
          gemini: d.gemini || fresh.gemini,
          groq: d.groq || fresh.groq,
          onspace: d.onspace || fresh.onspace,
        };
      }
    }
  } catch {
    /* ignore */
  }
  return fresh;
}

function freshCredits(): ProviderCredits {
  const today = new Date().toISOString().split("T")[0];
  return {
    date: today,
    gemini: { used: 0, limit: APP_LIMITS.gemini, remaining: APP_LIMITS.gemini },
    groq: { used: 0, limit: APP_LIMITS.groq, remaining: APP_LIMITS.groq },
    onspace: { used: 0, limit: APP_LIMITS.onspace, remaining: APP_LIMITS.onspace },
  };
}

function saveCredits(c: ProviderCredits): void {
  try {
    localStorage.setItem(CREDITS_KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}

function useCredit(provider: "gemini" | "groq" | "onspace"): void {
  const c = getRawCredits();
  c[provider].used = Math.min(c[provider].used + 1, c[provider].limit);
  c[provider].remaining = Math.max(0, c[provider].limit - c[provider].used);
  saveCredits(c);
}

export function getCreditsRemaining(): number {
  const c = getRawCredits();
  return c.gemini.remaining + c.groq.remaining + c.onspace.remaining;
}

function assertCredits(provider: "gemini" | "groq" | "onspace"): void {
  const c = getRawCredits();
  if (c[provider].remaining <= 0) {
    const name =
      provider === "gemini" ? "Gemini (OCR ảnh)" : 
      provider === "groq" ? "Groq (tạo đề/OCR text)" : "OnSpace AI";
    throw new Error(
      `Hết lượt ${name} hôm nay (${c[provider].limit}/ngày). Reset lúc 00:00!`,
    );
  }
}

// ── JSON parsing helper ───────────────────────────────────────────────────────
function parseJSON(raw: string): any {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```\s*$/im, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("AI không trả về JSON hợp lệ. Vui lòng thử lại.");
    return JSON.parse(m[0]);
  }
}

function buildExam(data: any, fallbackTitle: string): Exam {
  return {
    id: generateId(),
    title: String(data?.title || fallbackTitle).trim(),
    subject: data?.subject || "Toán",
    grade: data?.grade || "Lớp 4",
    totalPoints: Number(data?.totalPoints) || 10,
    duration: Number(data?.duration) || 40,
    isAIGenerated: false,
    createdAt: new Date().toISOString().split("T")[0],
    sections: Array.isArray(data?.sections) ? data.sections : [],
  };
}

// ── Prompt builders ───────────────────────────────────────────────────────────
function ocrPrompt(context?: string): string {
  return `Bạn là giáo viên Việt Nam chuyên phân tích đề thi. Trích xuất tất cả câu hỏi.

Yêu cầu:
1. Trích xuất ĐẦY ĐỦ mọi câu hỏi (số câu, nội dung đầy đủ)
2. Trắc nghiệm: 4 lựa chọn A/B/C/D, ghi đáp án đúng nếu có
3. Tự luận/tính toán: trích xuất toàn bộ đề bài
4. Phân số viết dạng a/b (vd: 3/4)
5. Xác định môn học, lớp, tiêu đề đề thi
6. Viết lời giải chi tiết từng bước vào trường "solution"
7. Hỗ trợ: Toán, Văn, Anh, Lý, Hóa, Sinh, Sử, Địa, Tin học...
${context ? "\n" + context : ""}
Trả lời CHÍNH XÁC theo JSON sau (TUYỆT ĐỐI không có markdown, không có backtick):
{"title":"Tên đề thi","subject":"Môn học","grade":"Lớp X","duration":40,"totalPoints":10,"sections":[{"id":"s1","title":"Phần I: Trắc nghiệm","description":"Khoanh tròn đáp án đúng","questions":[{"id":"q1","number":1,"type":"multiple_choice","text":"Câu hỏi","choices":[{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}],"correctAnswer":"A","points":0.5,"solution":"Giải: ..."}]}]}`;
}

// ── GROQ API helper (OpenAI-compatible) ───────────────────────────────────────
async function callGroq(
  model: string,
  messages: any[],
  responseFormat?: "json",
  keyOverride?: string,
): Promise<string> {
  const key = keyOverride || GROQ_KEYS()[0];
  if (!key) throw new Error("Chưa cấu hình Groq API Key.");

  const body: any = {
    model,
    messages,
    temperature: 0.7,
    max_tokens: 4096,
  };
  if (responseFormat === "json") {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as any)?.error?.message || `Groq error ${res.status}`;
    const error: any = new Error(res.status === 429 ? "Groq rate limit: " + msg : "Groq: " + msg);
    error.status = res.status;
    throw error;
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

// ── Rotation Wrapper ──────────────────────────────────────────────────────────
async function withGroqRotation(
  fn: (key: string) => Promise<string>,
): Promise<string> {
  const keys = GROQ_KEYS();
  let lastError: any = null;

  for (const key of keys) {
    try {
      assertCredits("groq");
      const result = await fn(key);
      useCredit("groq");
      return result;
    } catch (err: any) {
      lastError = err;
      if (err.status === 429) {
        console.warn(`Groq Key rate limited, trying next key...`);
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error("Tất cả Groq Keys đều thất bại.");
}

async function withGeminiRotation<T>(
  fn: (key: string) => Promise<T>,
): Promise<T> {
  const keys = GEMINI_KEYS();
  let lastError: any = null;

  for (const key of keys) {
    try {
      assertCredits("gemini");
      const result = await fn(key);
      useCredit("gemini");
      return result;
    } catch (err: any) {
      lastError = err;
      // Gemini error handling is different, often includes "429" in message
      if (err.message?.includes("429") || err.status === 429) {
        console.warn(`Gemini Key rate limited, trying next key...`);
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error("Tất cả Gemini Keys đều thất bại.");
}

// ── ONSPACE API helper ────────────────────────────────────────────────────────
async function callOnSpace(
  prompt: string,
  responseFormat?: "json",
  keyOverride?: string,
): Promise<string> {
  const key = keyOverride || ONSPACE_KEYS()[0];
  if (!key) throw new Error("Chưa cấu hình OnSpace AI API Key.");

  const body: any = {
    model: "google/gemini-3-flash-preview",
    messages: [
      { role: "system", content: "Bạn là giáo viên Việt Nam chuyên nghiệp. Trả lời chính xác, ngắn gọn." },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
  };
  if (responseFormat === "json") {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${ONSPACE_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as any)?.error?.message || `OnSpace error ${res.status}`;
    const error: any = new Error(res.status === 429 ? "OnSpace rate limit: " + msg : "OnSpace: " + msg);
    error.status = res.status;
    throw error;
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

async function withOnSpaceRotation(
  fn: (key: string) => Promise<string>,
): Promise<string> {
  const keys = ONSPACE_KEYS();
  let lastError: any = null;

  for (const key of keys) {
    try {
      assertCredits("onspace");
      const result = await fn(key);
      useCredit("onspace");
      return result;
    } catch (err: any) {
      lastError = err;
      if (err.status === 429) {
        console.warn(`OnSpace Key rate limited, trying next key...`);
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error("Tất cả OnSpace Keys đều thất bại.");
}

// ── OnSpace fallback (dùng API nội bộ khi không có key riêng) ─────────────
async function callInternalAI(fnName: string, body: any): Promise<any> {
  try {
    // Thử gọi Vercel API trước (để không phụ thuộc OnSpace)
    const res = await fetch(`/api/${fnName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (e) {
    /* fallback to supabase if vercel fails or not available */
  }

  // Fallback dùng Supabase Edge Functions (OnSpace)
  const { supabase } = await import("@/lib/supabase");
  const { data, error } = await supabase.functions.invoke(fnName, { body });

  if (error) {
    let errorMsg = error.message || JSON.stringify(error);
    if (
      (error as any).context &&
      typeof (error as any).context.text === "function"
    ) {
      try {
        const details = await (error as any).context.text();
        if (details) errorMsg = details;
      } catch {}
    }
    throw new Error(`AI Service (${fnName}): ${errorMsg}`);
  }

  if (data?.error) {
    throw new Error(`AI Service (${fnName}): ${data.error}`);
  }

  if (!data) throw new Error(`AI Service (${fnName}): Không có dữ liệu trả về`);
  return data;
}

// ── OCR từ ẢNH / PDF (base64) — Gemini ưu tiên ─────────────
export async function ocrFromImage(
  base64: string,
  mimeType: string,
): Promise<Exam> {
  const geminiKeys = GEMINI_KEYS();
  const onspaceKeys = ONSPACE_KEYS();

  if (geminiKeys.length === 0 && onspaceKeys.length === 0) {
    throw new Error("Chưa cấu hình API Key (Gemini hoặc OnSpace) để sử dụng tính năng OCR ảnh.");
  }

  let raw: string = "";
  let success = false;

  // 1. Ưu tiên OnSpace nếu có key (dùng Gemini 3 Flash Preview)
  if (onspaceKeys.length > 0) {
    try {
      raw = await withOnSpaceRotation(async (key) => {
        return await callOnSpace(ocrPrompt(), "json", key);
      });
      success = true;
    } catch (err) {
      console.warn("OnSpace OCR failed, trying Gemini...");
    }
  }

  // 2. Thử dùng Gemini rotation
  if (!success && geminiKeys.length > 0) {
    try {
      raw = await withGeminiRotation(async (key) => {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({
          model: "gemini-1.5-flash-latest",
          generationConfig: { responseMimeType: "application/json" },
        });

        const result = await model.generateContent([
          ocrPrompt(),
          { inlineData: { mimeType: mimeType as any, data: base64 } },
        ]);
        return result.response.text();
      });
      success = true;
    } catch (err) {
      console.error("Gemini rotation failed too.");
    }
  }

  if (!success) throw new Error("Tất cả dịch vụ AI đều không khả dụng. Vui lòng kiểm tra lại API Keys.");

  return buildExam(parseJSON(raw), "Đề thi từ ảnh");
}

// ── OCR từ TEXT thuần (DOCX) — Groq ưu tiên ──────────────
export async function ocrFromText(text: string): Promise<Exam> {
  const groqKeys = GROQ_KEYS();
  const onspaceKeys = ONSPACE_KEYS();

  if (groqKeys.length === 0 && onspaceKeys.length === 0) {
    throw new Error("Chưa cấu hình API Key (Groq hoặc OnSpace) để sử dụng tính năng OCR văn bản.");
  }

  const prompt = ocrPrompt(
    `\nNỘI DUNG ĐỀ THI (từ file Word):\n---\n${text.slice(0, 8000)}\n---`,
  );
  
  let raw: string = "";
  let success = false;

  // 1. Ưu tiên OnSpace nếu có key
  if (onspaceKeys.length > 0) {
    try {
      raw = await withOnSpaceRotation(async (key) => {
        return await callOnSpace(prompt, "json", key);
      });
      success = true;
    } catch (err) {
      console.warn("OnSpace OCR text failed, trying Groq...");
    }
  }

  // 2. Thử dùng Groq rotation
  if (!success && groqKeys.length > 0) {
    try {
      raw = await withGroqRotation(async (key) => {
        return await callGroq(
          "llama-3.3-70b-versatile",
          [{ role: "user", content: prompt }],
          "json",
          key
        );
      });
      success = true;
    } catch (err) {
      console.error("Groq rotation failed.");
    }
  }

  if (!success) throw new Error("Tất cả dịch vụ AI đều không khả dụng. Vui lòng kiểm tra lại API Keys.");

  return buildExam(parseJSON(raw), "Đề thi từ tài liệu");
}

// ── Tạo đề thi AI — dùng Groq (14,400 RPD) ───────────────────────────────────
export async function generateExam(
  sourceExam: Partial<Exam> & { subject: string; grade: string },
  difficulty: Difficulty,
  questionCount?: number,
): Promise<ExamSection[]> {
  const groqKeys = GROQ_KEYS();
  const geminiKeys = GEMINI_KEYS();
  const onspaceKeys = ONSPACE_KEYS();

  if (groqKeys.length === 0 && geminiKeys.length === 0 && onspaceKeys.length === 0) {
    throw new Error("Vui lòng cấu hình ít nhất một API Key (Gemini, Groq hoặc OnSpace) trong Cài đặt.");
  }

  const diffDesc: Record<Difficulty, string> = {
    easy: "ĐỘ KHÓ DỄ: số nhỏ 1-20, phép tính 1 bước, >80% học sinh làm được",
    normal: "ĐỘ KHÓ BÌNH THƯỜNG: tương đương đề gốc, câu bẫy vừa phải",
    hard: "ĐỘ KHÓ KHÓ: số 3-4 chữ số, nhiều bước, học sinh khá mới làm >70%",
    very_hard:
      "ĐỘ KHÓ RẤT KHÓ: tổng hợp nhiều kiến thức, chỉ 20-30% học sinh xuất sắc",
  };

  const sourceQs: string[] = [];
  sourceExam.sections?.forEach((s) => {
    s.questions?.forEach((q) => {
      let line = `[${q.type}] Câu ${q.number}: ${q.text}`;
      if (q.choices)
        line += " | " + q.choices.map((c) => `${c.id}.${c.text}`).join(" ");
      sourceQs.push(line);
    });
  });

  const countNote = questionCount
    ? `Tạo ĐÚNG ${questionCount} câu (không hơn không kém).`
    : "Giữ nguyên số câu như đề gốc.";

  const prompt = `Bạn là giáo viên ${sourceExam.subject} ${sourceExam.grade} Việt Nam chuyên nghiệp.
Tạo một đề thi mới dựa theo cấu trúc đề gốc.

${diffDesc[difficulty]}

ĐỀ GỐC: ${sourceExam.title || `${sourceExam.subject} ${sourceExam.grade}`}
Môn: ${sourceExam.subject} | Lớp: ${sourceExam.grade}
${sourceQs.length > 0 ? "Câu hỏi gốc tham chiếu:\n" + sourceQs.join("\n") : ""}

YÊU CẦU BẮT BUỘC:
- ${countNote}
- Thay đổi HOÀN TOÀN số liệu, tên nhân vật, bối cảnh
- Trắc nghiệm: đúng 4 lựa chọn A/B/C/D + correctAnswer
- Mỗi câu phải có "solution" lời giải chi tiết từng bước
- Đúng chương trình Việt Nam

Trả lời CHÍNH XÁC theo JSON (TUYỆT ĐỐI không markdown):
{"sections":[{"id":"s1","title":"Phần I: Trắc nghiệm","description":"...","questions":[{"id":"q1","number":1,"type":"multiple_choice","text":"...","choices":[{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}],"correctAnswer":"A","points":0.5,"solution":"Giải: ..."}]}]}`;

  let raw: string = "";
  let success = false;

  // 1. Thử dùng OnSpace rotation (Gemini 3 Flash Preview)
  if (onspaceKeys.length > 0) {
    try {
      raw = await withOnSpaceRotation(async (key) => {
        return await callOnSpace(prompt, "json", key);
      });
      success = true;
    } catch (err) {
      console.warn("OnSpace generate rotation failed, trying others...");
    }
  }

  // 2. Thử dùng Groq rotation
  if (!success && groqKeys.length > 0) {
    try {
      raw = await withGroqRotation(async (key) => {
        const groqModel =
          difficulty === "hard" || difficulty === "very_hard"
            ? "llama-3.3-70b-versatile"
            : "llama-3.1-8b-instant";
        return await callGroq(groqModel, [{ role: "user", content: prompt }], "json", key);
      });
      success = true;
    } catch (err) {
      console.warn("Groq rotation failed, trying Gemini...");
    }
  }

  // 3. Thử dùng Gemini rotation
  if (!success && geminiKeys.length > 0) {
    try {
      raw = await withGeminiRotation(async (key) => {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({
          model: "gemini-1.5-flash-latest",
          generationConfig: { temperature: 0.8, responseMimeType: "application/json" },
        });
        const result = await model.generateContent(prompt);
        return result.response.text();
      });
      success = true;
    } catch (err) {
      console.error("Gemini rotation failed too.");
    }
  }

  if (!success) throw new Error("Tất cả dịch vụ AI đều không khả dụng. Vui lòng kiểm tra lại API Keys.");

  const data = parseJSON(raw);
  if (!Array.isArray(data?.sections)) {
    throw new Error("AI không trả về sections hợp lệ. Vui lòng thử lại.");
  }
  return data.sections as ExamSection[];
}

// ── Xáo trộn đề bài (Randomize Data) ──────────────────────────────────────────
export async function randomizeQuestions(questions: any[]): Promise<any[]> {
  const groqKeys = GROQ_KEYS();
  const geminiKeys = GEMINI_KEYS();
  const onspaceKeys = ONSPACE_KEYS();

  if (groqKeys.length === 0 && geminiKeys.length === 0 && onspaceKeys.length === 0) {
    throw new Error("Vui lòng cấu hình API Key để sử dụng tính năng xáo trộn dữ liệu.");
  }

  // Tối ưu hóa dữ liệu gửi đi để tiết kiệm token
  const essentialData = questions.map(q => ({
    type: q.type,
    text: q.text,
    choices: q.choices,
    correctAnswer: q.correctAnswer,
    solution: q.solution
  }));

  const prompt = `Bạn là giáo viên Việt Nam. Hãy thay đổi số liệu, tên nhân vật, bối cảnh của các câu hỏi sau để tạo ra biến thể mới nhưng vẫn giữ nguyên dạng bài và độ khó.
GIỮ NGUYÊN cấu trúc JSON của từng câu hỏi.

DANH SÁCH CÂU HỎI:
${JSON.stringify(essentialData)}

YÊU CẦU:
1. Thay đổi số liệu (ví dụ: 15 thành 24, Lan thành Huệ, cam thành quýt...)
2. Cập nhật lại đáp án đúng (correctAnswer) tương ứng với số liệu mới
3. Viết lại lời giải (solution) chi tiết theo số liệu mới
4. Trả về đúng định dạng JSON là một mảng các câu hỏi.

Trả lời CHÍNH XÁC theo JSON (TUYỆT ĐỐI không markdown):
{"questions": [...]}`;

  let raw: string = "";
  let success = false;

  // 1. Thử dùng OnSpace rotation
  if (onspaceKeys.length > 0) {
    try {
      raw = await withOnSpaceRotation(async (key) => {
        return await callOnSpace(prompt, "json", key);
      });
      success = true;
    } catch (err) {
      console.warn("OnSpace randomize rotation failed...");
    }
  }

  // 2. Thử dùng Groq rotation
  if (!success && groqKeys.length > 0) {
    try {
      raw = await withGroqRotation(async (key) => {
        return await callGroq("llama-3.1-8b-instant", [{ role: "user", content: prompt }], "json", key);
      });
      success = true;
    } catch (err) {
      console.warn("Groq randomize rotation failed...");
    }
  }

  // 3. Thử dùng Gemini rotation
  if (!success && geminiKeys.length > 0) {
    try {
      raw = await withGeminiRotation(async (key) => {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({
          model: "gemini-1.5-flash-latest",
          generationConfig: { responseMimeType: "application/json" },
        });
        const result = await model.generateContent(prompt);
        return result.response.text();
      });
      success = true;
    } catch (err) {
      console.error("Gemini randomize rotation failed too.");
    }
  }

  if (!success) return questions;

  try {
    const data = parseJSON(raw);
    
    // Trộn lại các ID gốc để không làm hỏng logic ứng dụng
    if (Array.isArray(data?.questions)) {
      return data.questions.map((q: any, i: number) => ({
        ...questions[i],
        ...q
      }));
    }
  } catch (e) {
    console.error("Failed to parse AI response:", e);
  }
  
  return questions;
}

// ── Chấm bài tự luận ─────────────────────────────────────────────────────────
export interface EssayGradeResult {
  score: number; // điểm chấm (0 ↔ maxPoints)
  feedback: string; // nhận xét + hướng dẫn
}

export async function gradeEssay(
  questionText: string,
  studentAnswer: string,
  solution: string,
  maxPoints: number,
): Promise<EssayGradeResult> {
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

Trả lời THEO JSON (TUYỆT ĐỐI không markdown):
{"score": 0.5, "feedback": "Nhận xét..."}`;

  let raw: string = "";
  let success = false;
  const groqKeys = GROQ_KEYS();
  const geminiKeys = GEMINI_KEYS();
  const onspaceKeys = ONSPACE_KEYS();

  // 1. Thử dùng OnSpace rotation
  if (onspaceKeys.length > 0) {
    try {
      raw = await withOnSpaceRotation(async (key) => {
        return await callOnSpace(prompt, "json", key);
      });
      success = true;
    } catch (err) {
      console.warn("OnSpace grading rotation failed...");
    }
  }

  // 2. Thử dùng Groq rotation
  if (!success && groqKeys.length > 0) {
    try {
      raw = await withGroqRotation(async (key) => {
        return await callGroq("llama-3.3-70b-versatile", [{ role: "user", content: prompt }], "json", key);
      });
      success = true;
    } catch (err) {
      console.warn("Groq grading rotation failed...");
    }
  }

  // 3. Thử dùng Gemini rotation
  if (!success && geminiKeys.length > 0) {
    try {
      raw = await withGeminiRotation(async (key) => {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({
          model: "gemini-1.5-flash-latest",
          generationConfig: { responseMimeType: "application/json" },
        });
        const result = await model.generateContent(prompt);
        return result.response.text();
      });
      success = true;
    } catch (err) {
      console.error("Gemini grading rotation failed too.");
    }
  }

  if (!success) {
    throw new Error(
      "Không thể kết nối với dịch vụ AI để chấm bài. Vui lòng kiểm tra API Key hoặc thử lại sau.",
    );
  }

  const parsed = parseJSON(raw);
  const score = Math.min(maxPoints, Math.max(0, Number(parsed?.score) || 0));
  return { score, feedback: String(parsed?.feedback || "Không có nhận xét") };
}
