import React, { useState, useRef } from "react";
import { Exam } from "@/types/exam";
import { ocrFromImage, ocrFromText, getCreditsRemaining } from "@/lib/gemini";
import { toast } from "sonner";
import { Upload, Plus, CheckCircle2, Loader2, FileText, ImageIcon } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UploadExamProps {
  isOpen: boolean;
  onClose: () => void;
  /** Gọi khi đề thi đã sẵn sàng; isSourceExam = true nếu user chọn đặt làm đề gốc */
  onExamReady: (exam: Exam, isSourceExam: boolean) => void;
  /** Tự động mở trình chọn file hoặc camera khi modal hiện lên */
  initialMode?: 'camera' | 'file' | null;
  /** File được truyền vào từ bên ngoài để xử lý ngay lập tức */
  initialFile?: File | null;
}

type Step = "choose" | "processing" | "preview" | "done";

// ── File helpers ──────────────────────────────────────────────────────────────

const getFileType = (file: File): "image" | "pdf" | "docx" | "doc_old" | "unsupported" => {
  const name = file.name.toLowerCase();
  const type = file.type;
  if (type.startsWith("image/")) return "image";
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  )
    return "docx";
  if (type === "application/msword" || name.endsWith(".doc"))
    return "doc_old";
  return "unsupported";
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(",")[1]);
    };
    reader.onerror = reject;
  });

/** Extract plain text from a DOCX file using mammoth (dynamic import) */
const doOCRDocx = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  // @ts-ignore
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value?.trim() || "";
};

/**
 * Smart PDF handler:
 *  1. Thử extract text bằng pdf.js (miễn phí, không tốn AI credit)
 *  2. Nếu có đủ text → đây là PDF văn bản → dùng Groq (14,400/ngày)
 *  3. Nếu ít/không có text → đây là PDF scan → dùng Gemini Vision (1,000/ngày)
 *
 * Trả về { mode, text?, base64? } để caller biết cách xử lý.
 */
export type PdfAnalysis =
  | { mode: "text"; text: string }
  | { mode: "image"; base64: string };

const MIN_TEXT_LENGTH = 150; // ký tự tối thiểu để coi là PDF văn bản

async function analyzePdf(file: File): Promise<PdfAnalysis> {
  try {
    // Dynamic import để tránh bloat bundle
    const pdfjsLib = await import("pdfjs-dist");
    // Worker từ CDN (không bundle vào app)
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = "";
    const maxPages = Math.min(pdf.numPages, 5); // Chỉ đọc 5 trang đầu để detect
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => ("str" in item ? item.str : ""))
        .join(" ");
      fullText += pageText + "\n";
    }

    const cleanText = fullText.replace(/\s+/g, " ").trim();

    if (cleanText.length >= MIN_TEXT_LENGTH) {
      // Có đủ text → PDF văn bản → Groq
      return { mode: "text", text: cleanText };
    }
  } catch {
    // pdf.js lỗi → fallback sang Gemini Vision
  }

  // Không extract được text → PDF scan → Gemini Vision
  const base64 = await fileToBase64(file);
  return { mode: "image", base64 };
}

// ── Subcomponent: Credits badge ───────────────────────────────────────────────

const CreditsBadge: React.FC<{ credits: number }> = ({ credits }) => (
  <div
    className={`rounded-xl px-3 py-2 flex items-center gap-2 text-sm ${
      credits > 10
        ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
        : credits > 0
          ? "bg-amber-50 border border-amber-200 text-amber-700"
          : "bg-red-50 border border-red-200 text-red-700"
    }`}
  >
    <span className="text-base">{credits > 0 ? "✨" : "⛔"}</span>
    <span className="font-semibold">
      {credits > 0 ? `Còn ${credits} lượt AI hôm nay` : "Hết lượt AI hôm nay"}
    </span>
  </div>
);

// ── Subcomponent: PDF Info tip ─────────────────────────────────────────────
const PdfTip: React.FC = () => (
  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 space-y-1">
    <p className="font-bold">💡 Mẹo với file PDF:</p>
    <p>
      📄 <strong>PDF văn bản</strong> (xuất từ Word) → AI đọc text trực tiếp,
      tiết kiệm gấp 14x
    </p>
    <p>
      🖼️ <strong>PDF scan</strong> (chụp ảnh giấy) → AI nhận dạng ảnh, dùng
      Gemini Vision
    </p>
    <p className="text-blue-500">
      App tự phát hiện loại PDF và chọn đúng AI phù hợp!
    </p>
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────

const UploadExam: React.FC<UploadExamProps> = ({
  isOpen,
  onClose,
  onExamReady,
  initialMode = null,
  initialFile = null
}) => {
  const [step, setStep] = useState<Step>("choose");
  const [progress, setProgress] = useState("");
  const [extractedExam, setExtractedExam] = useState<Exam | null>(null);
  const [isSourceExam, setIsSourceExam] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Xử lý initialFile hoặc initialMode
  React.useEffect(() => {
    if (!isOpen) return;

    if (initialFile) {
      processFile(initialFile);
    } else if (initialMode) {
      // Đợi một chút để modal render xong ref
      const timer = setTimeout(() => {
        openPicker(initialMode);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialFile, initialMode]);

  if (!isOpen) return null;

  const credits = getCreditsRemaining();

  // ── processFile ────────────────────────────────────────────────────────────

  const processFile = async (file: File) => {
    // Guard: file size
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File quá lớn. Vui lòng chọn file dưới 10MB");
      return;
    }

    const fileType = getFileType(file);
    if (fileType === "doc_old") {
      toast.error("⚠️ File .doc (Word cũ) không được hỗ trợ. Bé hãy 'Lưu dưới dạng' (Save As) .docx hoặc chụp ảnh màn hình đề thi nhé!");
      return;
    }
    if (fileType === "unsupported") {
      toast.error(
        "Định dạng không hỗ trợ. Dùng ảnh (JPG/PNG/WEBP), PDF hoặc DOCX",
      );
      return;
    }

    if (credits <= 0) {
      toast.error("Hết lượt OCR hôm nay. Thử lại vào ngày mai nhé!");
      return;
    }

    setStep("processing");

    try {
      let exam: Exam;

      if (fileType === "docx") {
        setProgress("Đang đọc file Word (.docx)…");
        const text = await doOCRDocx(file);
        if (!text || text.length < 20) {
          throw new Error("File Word không có nội dung văn bản hoặc bị rỗng");
        }
        setProgress("AI đang phân tích nội dung đề thi…");
        exam = await ocrFromText(text);
      } else if (fileType === "pdf") {
        setProgress("Đang kiểm tra nội dung PDF…");
        const analysis = await analyzePdf(file);

        if (analysis.mode === "text") {
          // PDF văn bản → Groq (14,400 lượt/ngày) 🟢
          setProgress(`📄 PDF văn bản — dùng Groq (tiết kiệm credit)…`);
          exam = await ocrFromText(analysis.text);
        } else {
          // PDF scan/ảnh → Gemini Vision (1,000 lượt/ngày) 🖼️
          setProgress("🖼️ PDF dạng ảnh scan — dùng Gemini Vision…");
          exam = await ocrFromImage(analysis.base64, "application/pdf");
        }
      } else {
        // image
        setProgress("AI đang phân tích hình ảnh…");
        const base64 = await fileToBase64(file);
        exam = await ocrFromImage(base64, file.type || "image/jpeg");
      }

      // Fallback title nếu AI không đặt tên
      if (!exam.title || exam.title === "Đề thi") {
        exam = { ...exam, title: `Đề thi từ ${file.name}` };
      }

      setExtractedExam(exam);
      setStep("preview");
    } catch (err: any) {
      const msg: string = err?.message ?? "Không thể xử lý file";

      if (msg.includes("Hết lượt")) {
        toast.error(msg);
      } else if (msg.includes("rỗng") || msg.includes("nội dung")) {
        toast.error("⚠️ " + msg);
      } else if (msg.includes("JSON") || msg.includes("AI")) {
        toast.error("AI gặp sự cố: " + msg);
      } else {
        toast.error("Lỗi OCR: " + msg);
      }

      if (initialFile) {
        // Nếu là file truyền từ ngoài vào mà lỗi, đóng modal luôn
        handleClose();
      } else {
        setStep("choose");
      }
    }
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset so same file can trigger change event again
    e.target.value = "";
  };

  const handleSave = () => {
    if (!extractedExam) return;
    onExamReady(extractedExam, isSourceExam);
    setStep("done");
  };

  const handleClose = () => {
    setStep("choose");
    setExtractedExam(null);
    setIsSourceExam(false);
    setProgress("");
    onClose();
  };

  const openPicker = (mode: "camera" | "file") => {
    if (!fileInputRef.current) return;
    if (mode === "camera") {
      fileInputRef.current.accept = "image/*";
      (fileInputRef.current as any).capture = "environment";
    } else {
      fileInputRef.current.accept =
        "image/*,application/pdf,.pdf," +
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx," +
        "application/msword,.doc";
      fileInputRef.current.removeAttribute("capture");
    }
    fileInputRef.current.click();
  };

  // ── Derived values ──────────────────────────────────────────────────────────

  const totalQuestions =
    extractedExam?.sections?.reduce((acc, s) => acc + s.questions.length, 0) ??
    0;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden border-4 border-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-slate-50/50">
          <h2 className="font-black text-gray-800 flex items-center gap-3 uppercase tracking-tight">
            <span className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
              <Upload className="w-6 h-6" />
            </span>
            <span>Số hóa đề thi</span>
          </h2>
          <button
            onClick={handleClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:scale-90 transition-all"
          >
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>

        <div className="p-6">
          {/* ══════════════════════════════════════════════════════════════════
              STEP: CHOOSE
          ══════════════════════════════════════════════════════════════════ */}
          {step === "choose" && !initialFile && (
            <div className="space-y-6">
              <CreditsBadge credits={credits} />

              <p className="text-sm font-bold text-gray-500 leading-relaxed">
                Bé hãy chụp ảnh hoặc chọn file đề thi có sẵn. AI sẽ tự động "đọc" và tạo đề thi tương tác cho bé ngay lập tức!
              </p>

              <div className="grid grid-cols-1 gap-4">
                {/* Camera button */}
                <button
                  disabled={credits <= 0}
                  onClick={() => openPicker("camera")}
                  className="group flex items-center gap-5 bg-blue-50 border-2 border-blue-100 rounded-[32px] px-6 py-6 active:scale-[0.98] transition-all hover:border-blue-400 hover:bg-blue-100/50 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center text-3xl group-hover:rotate-6 transition-transform">📷</div>
                  <div>
                    <p className="font-black text-blue-700 text-lg uppercase leading-none mb-1">Chụp ảnh đề</p>
                    <p className="text-xs text-blue-400 font-bold uppercase tracking-wider">Dùng camera bé nhé</p>
                  </div>
                </button>

                {/* File picker button */}
                <button
                  disabled={credits <= 0}
                  onClick={() => openPicker("file")}
                  className="group flex items-center gap-5 bg-emerald-50 border-2 border-emerald-100 rounded-[32px] px-6 py-6 active:scale-[0.98] transition-all hover:border-emerald-400 hover:bg-emerald-100/50 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center text-3xl group-hover:-rotate-6 transition-transform">📁</div>
                  <div>
                    <p className="font-black text-emerald-700 text-lg uppercase leading-none mb-1">Chọn từ máy</p>
                    <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Ảnh, PDF, Word</p>
                  </div>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleInputChange}
                onClick={(e) => (e.target as any).value = null}
              />

              {/* Format chips */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Định dạng hỗ trợ
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["📷 JPG/PNG", "📄 PDF", "📝 DOCX/DOC"].map((fmt) => (
                    <span
                      key={fmt}
                      className="text-[11px] bg-white border border-gray-200 rounded-full px-2.5 py-0.5 text-gray-600"
                    >
                      {fmt}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400">Tối đa 10MB</p>
              </div>

              {/* PDF Smart tip */}
              <PdfTip />
            </div>
          )}

          {/* Loading state when initialFile is being processed but step hasn't changed yet */}
          {step === "choose" && initialFile && (
            <div className="py-20 text-center space-y-4">
              <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto" />
              <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Đang chuẩn bị...</p>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              STEP: PROCESSING
          ══════════════════════════════════════════════════════════════════ */}
          {step === "processing" && (
            <div className="py-10 text-center space-y-6">
              {/* Animated robot spinner */}
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 border-4 border-blue-100 rounded-full" />
                <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <div
                  className="absolute inset-2 border-4 border-blue-300 border-b-transparent rounded-full animate-spin"
                  style={{
                    animationDirection: "reverse",
                    animationDuration: "0.8s",
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-2xl select-none">
                  🤖
                </div>
              </div>

              <div>
                <p className="font-bold text-gray-800 text-base">
                  AI đang xử lý…
                </p>
                <p className="text-sm text-gray-400 mt-1.5 min-h-[20px] transition-all">
                  {progress}
                </p>
              </div>

              <button
                onClick={() => setStep("choose")}
                className="text-sm text-red-400 hover:text-red-500 underline underline-offset-2 transition-colors"
              >
                Hủy bỏ
              </button>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              STEP: PREVIEW
          ══════════════════════════════════════════════════════════════════ */}
          {step === "preview" && extractedExam && (
            <div className="space-y-4">
              {/* Success banner */}
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                <span className="text-xl">✅</span>
                <p className="font-bold text-emerald-700 text-sm">
                  Trích xuất thành công!
                </p>
              </div>

              {/* Exam summary card */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 space-y-3">
                <h3 className="font-bold text-gray-800 leading-snug text-sm">
                  {extractedExam.title}
                </h3>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      label: "Môn học",
                      value: extractedExam.subject,
                      color: "text-blue-700",
                    },
                    {
                      label: "Lớp",
                      value: extractedExam.grade,
                      color: "text-blue-700",
                    },
                    {
                      label: "Số câu",
                      value: `${totalQuestions} câu`,
                      color: "text-emerald-600",
                    },
                    {
                      label: "Thời gian",
                      value: `${extractedExam.duration} phút`,
                      color: "text-purple-600",
                    },
                  ].map(({ label, value, color }) => (
                    <div
                      key={label}
                      className="bg-white rounded-xl p-2.5 text-center border border-blue-100"
                    >
                      <p className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">
                        {label}
                      </p>
                      <p className={`font-bold text-sm ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Section breakdown */}
                {extractedExam.sections.length > 0 && (
                  <div className="space-y-1">
                    {extractedExam.sections.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between text-xs text-gray-600 bg-white/70 rounded-lg px-3 py-1.5"
                      >
                        <span className="truncate">{s.title}</span>
                        <span className="font-semibold text-blue-600 ml-2 shrink-0">
                          {s.questions.length} câu
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Toggle: set as source exam */}
              <button
                onClick={() => setIsSourceExam((v) => !v)}
                className={`w-full flex items-center gap-3 rounded-2xl border-2 p-3.5 transition-all active:scale-[0.98] text-left ${
                  isSourceExam
                    ? "bg-amber-50 border-amber-400"
                    : "bg-gray-50 border-gray-200 hover:border-amber-300"
                }`}
              >
                {/* Custom checkbox */}
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    isSourceExam
                      ? "bg-amber-500 border-amber-500"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {isSourceExam && (
                    <span className="text-white text-[10px] font-bold">✓</span>
                  )}
                </div>
                <div>
                  <p
                    className={`text-sm font-bold ${
                      isSourceExam ? "text-amber-800" : "text-gray-700"
                    }`}
                  >
                    ⭐ Đặt làm đề gốc
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    AI sẽ dùng đề này để tạo đề luyện tập mới
                  </p>
                </div>
              </button>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => (initialFile ? handleClose() : setStep("choose"))}
                  className="px-4 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm active:scale-95 transition-all hover:border-gray-300 hover:bg-gray-50"
                >
                  ← {initialFile ? "Đóng" : "Chọn lại"}
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm active:scale-[0.98] transition-all shadow-blue-200 shadow-md"
                >
                  💾 Lưu vào danh sách
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              STEP: DONE
          ══════════════════════════════════════════════════════════════════ */}
          {step === "done" && (
            <div className="py-10 text-center space-y-4">
              <div className="text-6xl animate-bounce">🎉</div>
              <div>
                <p className="font-bold text-gray-800 text-base">
                  Đã lưu thành công!
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Đề thi đã được thêm vào danh sách.
                </p>
                {isSourceExam && (
                  <div className="mt-2 inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                    <span>⭐</span>
                    <span>Đã đặt làm đề gốc</span>
                  </div>
                )}
              </div>
              <button
                onClick={handleClose}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 rounded-xl active:scale-95 transition-all"
              >
                Đóng
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadExam;
