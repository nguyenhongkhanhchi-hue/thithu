import React from 'react';

interface PrintExamProps {
  exam: {
    title: string;
    subject: string;
    grade: string;
    duration: number;
    totalPoints: number;
    sections: Array<{
      id: string;
      title: string;
      description?: string;
      questions: Array<{
        id: string;
        number: number;
        subNumber?: string;
        type: string;
        text: string;
        choices?: Array<{ id: string; text: string }>;
        points: number;
      }>;
    }>;
  };
  onClose: () => void;
}

function calcLineCount(questionText: string): number {
  const text = questionText.toLowerCase();
  if (text.includes('\n') && text.split('\n').length >= 3) return 12;
  if (text.includes('diện tích') || text.includes('chu vi') || text.includes('hình chữ')) return 10;
  if (text.includes('trung bình')) return 9;
  if (text.includes('tính bằng') || text.includes('thuận tiện')) return 8;
  if (text.length < 80) return 6;
  return 8;
}

// Render fraction as stacked (Unicode/CSS based for print)
function renderFractionsText(text: string): string {
  return text; // kept as-is; print version uses plain text
}

const PrintExam: React.FC<PrintExamProps> = ({ exam, onClose }) => {
  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      {/* Print-only stylesheet injected via style tag */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { position: fixed !important; inset: 0 !important; background: white !important; z-index: 9999 !important; overflow: visible !important; }
          body { margin: 0; }
          @page { size: A4; margin: 18mm 15mm; }
        }
      `}</style>

      {/* Print area */}
      <div className="print-area bg-white w-full max-w-[210mm] max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
        {/* Controls (hidden on print) */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-gray-800">🖨 Xem trước in – A4</h2>
          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm active:scale-95 transition-all"
            >
              🖨 In đề thi
            </button>
            <button
              onClick={onClose}
              className="bg-gray-100 text-gray-600 px-4 py-2.5 rounded-xl font-medium text-sm active:scale-95"
            >
              ✕ Đóng
            </button>
          </div>
        </div>

        {/* A4 content */}
        <div className="px-8 py-6 font-serif text-sm leading-relaxed text-gray-900" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
          {/* Exam header */}
          <div className="text-center mb-6 border-b-2 border-gray-800 pb-4">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">PHÒNG GIÁO DỤC VÀ ĐÀO TẠO</p>
            <h1 className="text-xl font-bold uppercase mb-1">{exam.title}</h1>
            <p className="text-sm">Môn: {exam.subject} – {exam.grade}</p>
            <p className="text-sm">Thời gian: {exam.duration} phút · Tổng điểm: {exam.totalPoints} điểm</p>
          </div>

          {/* Student info */}
          <div className="flex gap-8 mb-6 text-sm">
            <p>Họ và tên: <span className="inline-block border-b border-gray-400 w-48">&nbsp;</span></p>
            <p>Lớp: <span className="inline-block border-b border-gray-400 w-16">&nbsp;</span></p>
            <p>Điểm: <span className="inline-block border-b border-gray-400 w-12">&nbsp;</span></p>
          </div>

          {/* Sections */}
          {exam.sections.map((section) => (
            <div key={section.id} className="mb-6">
              <h2 className="font-bold text-base mb-1 border-b border-gray-400 pb-1">{section.title}</h2>
              {section.description && (
                <p className="text-xs italic text-gray-600 mb-3">{section.description}</p>
              )}

              {section.questions.map((q) => {
                const label = q.subNumber ? `Câu ${q.number}${q.subNumber})` : `Câu ${q.number}:`;
                const lines = q.text.split('\n');
                return (
                  <div key={q.id} className="mb-5">
                    <p className="font-medium mb-1">
                      <span className="font-bold">{label}</span>{' '}
                      {lines.map((line, i) => (
                        <span key={i}>
                          {line}{i < lines.length - 1 && <br />}
                        </span>
                      ))}
                      <span className="text-xs text-gray-400 ml-2">({q.points}đ)</span>
                    </p>

                    {/* MC choices in 2-column grid */}
                    {q.type === 'multiple_choice' && q.choices && (
                      <div className="grid grid-cols-2 gap-x-8 gap-y-1 ml-4 text-sm">
                        {q.choices.map((c) => (
                          <p key={c.id}>
                            <span className="font-bold">{c.id}.</span> {c.text}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Essay lines */}
                    {(q.type === 'essay' || q.type === 'calculation') && (
                      <div className="ml-4 mt-2">
                        <p className="text-[10px] text-gray-400 mb-1">Bài giải:</p>
                        {Array.from({ length: calcLineCount(q.text) }).map((_, i) => (
                          <div key={i} className="border-b border-gray-300 h-7 relative">
                            <div className="absolute left-6 top-0 bottom-0 border-l border-red-200" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          <div className="text-center text-xs text-gray-400 mt-8 border-t border-gray-200 pt-3">
            — Hết — · Tạo bởi ExamTouch
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintExam;
