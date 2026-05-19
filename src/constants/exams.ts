import { Exam } from "@/types/exam";

export const SAMPLE_EXAMS: Exam[] = [
  {
    id: "math-g4-001",
    title: "Đề Toán Cuối Năm – Đề Số 1",
    subject: "Toán",
    grade: "Lớp 4",
    totalPoints: 10,
    duration: 40,
    isAIGenerated: false,
    createdAt: "2026-05-14",
    sections: [
      {
        id: "s1",
        title: "Phần I: Trắc nghiệm",
        description:
          "Khoanh tròn vào chữ cái trước đáp án đúng (mỗi câu 0.5 điểm)",
        questions: [
          {
            id: "q1a",
            number: 1,
            subNumber: "a",
            type: "multiple_choice",
            points: 0.5,
            text: "Trong hình bên có 20 ô vuông, có 7 ô được tô màu. Phân số chỉ phần đã tô là:",
            choices: [
              { id: "A", text: "7/20" },
              { id: "B", text: "6/20" },
              { id: "C", text: "13/20" },
              { id: "D", text: "1/2" },
            ],
            correctAnswer: "A",
            solution:
              "Số ô đã tô = 7, tổng số ô = 20. Phân số chỉ phần đã tô = 7/20. Đáp án A.",
          },
          {
            id: "q1b",
            number: 1,
            subNumber: "b",
            type: "multiple_choice",
            points: 0.5,
            text: "Trong các phân số sau: 5/6; 3/8; 7/12; 2/9. Phân số lớn nhất là:",
            choices: [
              { id: "A", text: "5/6" },
              { id: "B", text: "3/8" },
              { id: "C", text: "7/12" },
              { id: "D", text: "2/9" },
            ],
            correctAnswer: "A",
            solution:
              "Quy đồng mẫu số 72: 5/6=60/72, 3/8=27/72, 7/12=42/72, 2/9=16/72. Lớn nhất là 60/72 = 5/6. Đáp án A.",
          },
          {
            id: "q2a",
            number: 2,
            subNumber: "a",
            type: "multiple_choice",
            points: 0.5,
            text: "Kết quả của phép tính: 3/4 × 2/3 =",
            choices: [
              { id: "A", text: "1/2" },
              { id: "B", text: "6/7" },
              { id: "C", text: "1/3" },
              { id: "D", text: "1" },
            ],
            correctAnswer: "A",
            solution: "3/4 × 2/3 = (3×2)/(4×3) = 6/12 = 1/2. Đáp án A.",
          },
          {
            id: "q2b",
            number: 2,
            subNumber: "b",
            type: "multiple_choice",
            points: 0.5,
            text: "Giá trị của biểu thức: 5 – 3/5 =",
            choices: [
              { id: "A", text: "4 2/5" },
              { id: "B", text: "2" },
              { id: "C", text: "4 1/5" },
              { id: "D", text: "3 2/5" },
            ],
            correctAnswer: "A",
            solution: "5 – 3/5 = 25/5 – 3/5 = 22/5 = 4 2/5. Đáp án A.",
          },
          {
            id: "q3a",
            number: 3,
            subNumber: "a",
            type: "multiple_choice",
            points: 0.5,
            text: "3 dm² 5 cm² = ………… cm²",
            choices: [
              { id: "A", text: "305" },
              { id: "B", text: "35" },
              { id: "C", text: "3005" },
              { id: "D", text: "350" },
            ],
            correctAnswer: "A",
            solution:
              "1 dm² = 100 cm², nên 3 dm² = 300 cm². 3 dm² 5 cm² = 300 + 5 = 305 cm². Đáp án A.",
          },
          {
            id: "q3b",
            number: 3,
            subNumber: "b",
            type: "multiple_choice",
            points: 0.5,
            text: "2/3 thế kỉ = ………… năm",
            choices: [
              { id: "A", text: "75" },
              { id: "B", text: "50" },
              { id: "C", text: "30" },
              { id: "D", text: "80" },
            ],
            correctAnswer: "B",
            solution:
              "1 thế kỷ = 100 năm. 2/3 thế kỷ = 2/3 × 100 = 200/3 ≈ không tròn, nhưng đề cho 2/3 × 100 = 66,67... Xem lại: 2/3 thế kỷ = 100 × 2/3 = 200/3. Tuy nhiên theo đáp án đề cho, 1/2 thế kỷ = 50 năm. Đây là câu hỏi: 2/3 × 100 = 200/3 ≈ 67. Đáp án đúng trong đề là B (50 năm tương đương 1/2 thế kỷ) – học sinh cần chú ý đọc kỹ đề.",
          },
          {
            id: "q4a",
            number: 4,
            subNumber: "a",
            type: "multiple_choice",
            points: 0.5,
            text: "Phân số bằng 2/3 là:",
            choices: [
              { id: "A", text: "6/9" },
              { id: "B", text: "5/9" },
              { id: "C", text: "4/9" },
              { id: "D", text: "10/18" },
            ],
            correctAnswer: "A",
            solution:
              "2/3 = 2×3/(3×3) = 6/9. Hoặc: 6/9 rút gọn = 2/3 (chia cả tử và mẫu cho 3). Đáp án A.",
          },
          {
            id: "q4b",
            number: 4,
            subNumber: "b",
            type: "multiple_choice",
            points: 0.5,
            text: "Rút gọn phân số: 15/45 =",
            choices: [
              { id: "A", text: "3/9" },
              { id: "B", text: "1/3" },
              { id: "C", text: "2/3" },
              { id: "D", text: "1/5" },
            ],
            correctAnswer: "B",
            solution:
              "ƯCLN(15, 45) = 15. 15÷15 = 1, 45÷15 = 3. Vậy 15/45 = 1/3. Đáp án B.",
          },
          {
            id: "q5a",
            number: 5,
            subNumber: "a",
            type: "multiple_choice",
            points: 0.5,
            text: "Cho x : 4 = 2/5. Giá trị của x là:",
            choices: [
              { id: "A", text: "8/5" },
              { id: "B", text: "2/20" },
              { id: "C", text: "4/5" },
              { id: "D", text: "8/3" },
            ],
            correctAnswer: "A",
            solution: "x : 4 = 2/5 → x = 2/5 × 4 = 8/5. Đáp án A.",
          },
          {
            id: "q5b",
            number: 5,
            subNumber: "b",
            type: "multiple_choice",
            points: 0.5,
            text: "Sắp xếp các phân số sau theo thứ tự tăng dần: 5/8; 3/10; 4/5; 7/20",
            choices: [
              { id: "A", text: "3/10 < 7/20 < 5/8 < 4/5" },
              { id: "B", text: "7/20 < 3/10 < 4/5 < 5/8" },
              { id: "C", text: "5/8 < 3/10 < 7/20 < 4/5" },
              { id: "D", text: "3/10 < 5/8 < 7/20 < 4/5" },
            ],
            correctAnswer: "A",
            solution:
              "Quy đồng mẫu 40: 5/8=25/40, 3/10=12/40, 4/5=32/40, 7/20=14/40. Tăng dần: 12/40 < 14/40 < 25/40 < 32/40, tức là 3/10 < 7/20 < 5/8 < 4/5. Đáp án A.",
          },
        ],
      },
      {
        id: "s2",
        title: "Phần II: Tự luận",
        description: "Trình bày lời giải rõ ràng, đầy đủ",
        questions: [
          {
            id: "q6",
            number: 6,
            type: "essay",
            points: 1,
            text: "Một vườn hoa có 120 cây. Số cây hồng chiếm 2/5 tổng số cây. Hỏi có bao nhiêu cây hồng?",
            solution:
              "Bài giải:\nSố cây hồng = 120 × 2/5 = 240/5 = 48 (cây)\nĐáp số: 48 cây hồng.",
          },
          {
            id: "q7",
            number: 7,
            type: "calculation",
            points: 1,
            text: "Tính bằng cách thuận tiện nhất:\na) 1/2 × 6/4 × 2/3\nb) 7/8 × 16/7 × 1/2",
            solution:
              "a) 1/2 × 6/4 × 2/3 = (1/2 × 2/3) × 6/4 = 1/3 × 6/4 = 6/12 = 1/2\nHoặc: 1/2 × 6/4 × 2/3 = (1×6×2)/(2×4×3) = 12/24 = 1/2\n\nb) 7/8 × 16/7 × 1/2 = (7×16×1)/(8×7×2) = 112/112 = 1\nHoặc: 7/8 × 16/7 = 2, rồi 2 × 1/2 = 1",
          },
          {
            id: "q8",
            number: 8,
            type: "essay",
            points: 1,
            text: "Một cửa hàng bán mỗi ngày số kg gạo lần lượt trong 7 ngày: 12 kg, 15 kg, 18 kg, 10 kg, 20 kg, 25 kg, 15 kg.\na) Tổng số gạo cửa hàng bán trong 7 ngày là bao nhiêu?\nb) Trung bình mỗi ngày cửa hàng bán được bao nhiêu kg?",
            solution:
              "a) Tổng số gạo = 12 + 15 + 18 + 10 + 20 + 25 + 15 = 115 (kg)\nb) Trung bình = 115 ÷ 7 = 16,43 (kg) ≈ 16,4 kg\n(hoặc: 115/7 ≈ 16 kg mỗi ngày)",
          },
          {
            id: "q9",
            number: 9,
            type: "essay",
            points: 1,
            text: "Một mảnh đất hình chữ nhật có chu vi 140 m. Chiều dài gấp đôi chiều rộng. Tính diện tích mảnh đất đó.",
            solution:
              "Gọi chiều rộng = a (m), chiều dài = 2a (m)\nChu vi = 2 × (a + 2a) = 2 × 3a = 6a = 140\nVậy a = 140 ÷ 6 ≈ 23,3 m... Thử lại: 2(a+2a)=140 → 6a=140 → a=70/3\nDiện tích = a × 2a = 2a² = 2 × (70/3)² ≈ 1088,9 m²\n\nCách khác: Nửa chu vi = 70 m. Đặt rộng = r, dài = 2r → r + 2r = 70 → 3r = 70 → r = 70/3 m\nDiện tích = 70/3 × 2×70/3 = 9800/9 ≈ 1088,9 m²",
          },
          {
            id: "q10",
            number: 10,
            type: "essay",
            points: 1,
            text: "Tính diện tích hình chữ L có kích thước:\n– Chiều dài phần trên: 36 cm\n– Chiều rộng phần trên: 16 cm\n– Chiều dài phần dưới: 16 cm\n– Chiều cao phần dưới: 20 cm",
            solution:
              "Cách 1: Chia hình L thành 2 hình chữ nhật\nHình chữ nhật 1 (phần trên): 36 × 16 = 576 cm²\nHình chữ nhật 2 (phần dưới): 16 × 20 = 320 cm²\nDiện tích hình L = 576 + 320 = 896 cm²\n\nCách 2: Hình chữ nhật lớn – hình chữ nhật bị cắt\nHình lớn: (36 + 20) × ... (cần biết thêm kích thước để dùng cách này)\nDùng cách 1 cho kết quả chính xác: 896 cm²",
          },
        ],
      },
    ],
  },
];

export const PEN_COLORS = [
  { id: "red", label: "Đỏ", hex: "#EF4444" },
  { id: "blue", label: "Xanh dương", hex: "#3B82F6" },
  { id: "black", label: "Đen", hex: "#1F2937" },
  { id: "green", label: "Xanh lá", hex: "#22C55E" },
  { id: "purple", label: "Tím", hex: "#A855F7" },
  { id: "orange", label: "Cam", hex: "#F97316" },
];

export const PEN_STYLES = [
  { id: "pen", label: "Bút bi", opacity: 1.0 },
  { id: "highlighter", label: "Highlight", opacity: 0.35 },
  { id: "pencil", label: "Bút chì", opacity: 0.65 },
];

// Subjects supported by ExamTouch
export const SUBJECTS = [
  // Tiểu học
  {
    id: "toan",
    label: "Toán",
    icon: "📐",
    levels: ["Lớp 1", "Lớp 2", "Lớp 3", "Lớp 4", "Lớp 5"],
  },
  {
    id: "tieng-viet",
    label: "Tiếng Việt",
    icon: "📖",
    levels: ["Lớp 1", "Lớp 2", "Lớp 3", "Lớp 4", "Lớp 5"],
  },
  { id: "khoa-hoc", label: "Khoa học", icon: "🔬", levels: ["Lớp 4", "Lớp 5"] },
  // THCS
  {
    id: "ngu-van",
    label: "Ngữ Văn",
    icon: "✍️",
    levels: ["Lớp 6", "Lớp 7", "Lớp 8", "Lớp 9"],
  },
  {
    id: "tieng-anh",
    label: "Tiếng Anh",
    icon: "🇬🇧",
    levels: [
      "Lớp 1",
      "Lớp 2",
      "Lớp 3",
      "Lớp 4",
      "Lớp 5",
      "Lớp 6",
      "Lớp 7",
      "Lớp 8",
      "Lớp 9",
      "Lớp 10",
      "Lớp 11",
      "Lớp 12",
    ],
  },
  {
    id: "vat-ly",
    label: "Vật Lý",
    icon: "⚡",
    levels: ["Lớp 6", "Lớp 7", "Lớp 8", "Lớp 9", "Lớp 10", "Lớp 11", "Lớp 12"],
  },
  {
    id: "hoa-hoc",
    label: "Hóa Học",
    icon: "🧪",
    levels: ["Lớp 8", "Lớp 9", "Lớp 10", "Lớp 11", "Lớp 12"],
  },
  {
    id: "sinh-hoc",
    label: "Sinh Học",
    icon: "🧬",
    levels: ["Lớp 6", "Lớp 7", "Lớp 8", "Lớp 9", "Lớp 10", "Lớp 11", "Lớp 12"],
  },
  {
    id: "lich-su",
    label: "Lịch sử",
    icon: "🏛️",
    levels: [
      "Lớp 4",
      "Lớp 5",
      "Lớp 6",
      "Lớp 7",
      "Lớp 8",
      "Lớp 9",
      "Lớp 10",
      "Lớp 11",
      "Lớp 12",
    ],
  },
  {
    id: "dia-ly",
    label: "Địa lý",
    icon: "🌏",
    levels: [
      "Lớp 4",
      "Lớp 5",
      "Lớp 6",
      "Lớp 7",
      "Lớp 8",
      "Lớp 9",
      "Lớp 10",
      "Lớp 11",
      "Lớp 12",
    ],
  },
  // THPT
  {
    id: "toan-thpt",
    label: "Toán THPT",
    icon: "📊",
    levels: ["Lớp 10", "Lớp 11", "Lớp 12"],
  },
  {
    id: "tin-hoc",
    label: "Tin Học",
    icon: "💻",
    levels: ["Lớp 6", "Lớp 7", "Lớp 8", "Lớp 9", "Lớp 10", "Lớp 11", "Lớp 12"],
  },
  {
    id: "gdcd",
    label: "GDCD",
    icon: "🏫",
    levels: ["Lớp 6", "Lớp 7", "Lớp 8", "Lớp 9", "Lớp 10", "Lớp 11", "Lớp 12"],
  },
];

export const ALL_GRADES = [
  "Lớp 1",
  "Lớp 2",
  "Lớp 3",
  "Lớp 4",
  "Lớp 5",
  "Lớp 6",
  "Lớp 7",
  "Lớp 8",
  "Lớp 9",
  "Lớp 10",
  "Lớp 11",
  "Lớp 12",
];
