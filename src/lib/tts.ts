/**
 * Trợ Lý Giọng Nói Bố Tommy (Daddy's Speech Synthesis Engine)
 * Sử dụng Web Speech API (SpeechSynthesis) có sẵn trên iOS/Android/Windows 
 * để phát giọng đọc tiếng Việt động viên bé yêu học tập.
 */

export interface TTSSettings {
  enabled: boolean;
  rate: number;      // Tốc độ nói: 0.8 - 1.2
  pitch: number;     // Độ cao giọng: 0.9 - 1.1
  childName: string; // Tên của bé ví dụ: "Vy", "Na"
  daddyName: string; // Tên bố: "bố Tommy" hoặc "bố"
  remoteMessage: string; // Lời nhắn từ xa của bố gửi lên Supabase
  remoteMessageRead: boolean; // Trạng thái đã đọc lời nhắn
}

const SETTINGS_KEY = "methi_tts_settings";

const DEFAULT_SETTINGS: TTSSettings = {
  enabled: true,
  rate: 0.95, // Nói chậm rãi, dễ nghe cho trẻ em
  pitch: 1.0,
  childName: "",
  daddyName: "bố Tommy",
  remoteMessage: "",
  remoteMessageRead: false,
};

export function getTTSSettings(): TTSSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveTTSSettings(settings: Partial<TTSSettings>): void {
  try {
    const current = getTTSSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  } catch {}
}

/**
 * Tìm giọng đọc Tiếng Việt tốt nhất có sẵn trên thiết bị
 */
function getVietnameseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  
  // Ưu tiên tìm giọng đọc vi-VN tiếng Việt
  const viVoice = voices.find(v => v.lang.toLowerCase().includes("vi"));
  if (viVoice) return viVoice;
  
  // Fallback sang các giọng đọc Google Việt Nam hoặc mặc định nếu có
  const googleVi = voices.find(v => v.name.includes("Google") && v.lang.includes("vi"));
  return googleVi || voices[0] || null;
}

/**
 * Phát âm đoạn văn bản tiếng Việt
 */
export function speak(text: string): void {
  const settings = getTTSSettings();
  if (!settings.enabled || typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }

  try {
    // Dừng tất cả các giọng đọc đang phát dở để phát câu mới lập tức
    window.speechSynthesis.cancel();

    // Tạo đối tượng đọc
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Cấu hình giọng đọc tiếng Việt
    const voice = getVietnameseVoice();
    if (voice) utterance.voice = voice;
    utterance.lang = "vi-VN";
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error("Speech Synthesis failed:", err);
  }
}

// Gọi giọng đọc load trước danh sách giọng (đặc biệt cần trên Chrome/Safari)
if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      getVietnameseVoice();
    };
  }
}

// ── Các kịch bản giọng nói cụ thể dành cho bé ──

/**
 * 1. Chào hỏi khi vào app và phát lời nhắn từ xa của Bố nếu có
 */
export function speakAppGreeting(): void {
  const settings = getTTSSettings();
  const nameSuffix = settings.childName ? ` ${settings.childName}` : " con";
  const daddy = settings.daddyName || "bố";
  
  let greetingText = `Chào ${settings.childName ? settings.childName : "con gái yêu"} của ${daddy}! Hôm nay con muốn cùng ${daddy} chinh phục đề thi nào nào? Thi nhiều là giỏi con nhé!`;
  
  // Nếu có tin nhắn mới từ xa của bố Tommy
  if (settings.remoteMessage && !settings.remoteMessageRead) {
    greetingText = `Ting ting! ${settings.childName ? settings.childName : "Bé yêu"} ơi, có một lời nhắn yêu thương từ ${daddy} gửi từ xa cho con nè: "${settings.remoteMessage}"! Hãy học tập thật chăm chỉ con nhé!`;
    
    // Đánh dấu là đã đọc lời nhắn
    saveTTSSettings({ remoteMessageRead: true });
  }
  
  speak(greetingText);
}

/**
 * 2. Động viên khi con bắt đầu bước vào phòng thi
 */
export function speakExamStart(examTitle: string): void {
  const settings = getTTSSettings();
  const nameSuffix = settings.childName ? ` ${settings.childName}` : " con";
  const daddy = settings.daddyName || "bố";

  const prompts = [
    `Đề thi ${examTitle} bắt đầu rồi! ${settings.childName ? settings.childName : "Con gái yêu"} đọc kỹ từng câu, dùng nháp tính toán thật cẩn thận bên cạnh rồi hãy chọn đáp án nhé! Cố lên con!`,
    `Học nhiều là giỏi! Đề thi này sẽ giúp${nameSuffix} thông minh hơn nữa. Hãy làm bài thật tập trung và không vội vàng nha! ${daddy} luôn tin tưởng con.`,
    `Bắt đầu làm bài nào ${settings.childName ? settings.childName : "bé yêu"}! Nhớ xem kỹ các bẫy đổi đơn vị toán học trên giấy nháp rồi mới chọn nha!`
  ];

  const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
  speak(randomPrompt);
}

/**
 * 3. Khen ngợi hoặc động viên dựa trên kết quả bài thi sau khi nộp
 */
export function speakExamScore(score: number, totalPoints: number): void {
  const settings = getTTSSettings();
  const nameSuffix = settings.childName ? ` ${settings.childName}` : " con";
  const daddy = settings.daddyName || "bố";
  const percentage = Math.round((score / totalPoints) * 100);

  let speechText = "";

  if (percentage >= 90) {
    speechText = `Trời ơi! ${settings.childName ? settings.childName : "Con gái yêu của bố"} quá xuất sắc! Đạt được tận ${score} trên ${totalPoints} điểm! Kết quả tuyệt vời thế này làm ${daddy} hạnh phúc vô cùng! Quá tự hào về con!`;
  } else if (percentage >= 80) {
    speechText = `Quá tuyệt vời! ${score} điểm là một điểm số rất cao đó${nameSuffix}! Con làm bài rất tiến bộ, ${daddy} khen ngợi sự tập trung của con gái yêu nha!`;
  } else if (percentage >= 50) {
    speechText = `Con đã hoàn thành bài thi rồi đó${nameSuffix}! Được ${score} điểm. Con làm tốt lắm, nhưng lần sau nhớ tính nháp cẩn thận hơn một chút nữa để đạt điểm mười tuyệt đối nha! Cố lên con yêu!`;
  } else {
    speechText = `Không sao đâu ${settings.childName ? settings.childName : "con yêu"}! ${daddy} luôn ở bên cạnh động viên con. Con hãy bấm nút xem lời giải mẫu chi tiết của AI và các mẹo hay, sau đó làm lại nhé! Thi nhiều chắc chắn sẽ giỏi mà!`;
  }

  speak(speechText);
}

/**
 * 4. Khen ngợi khi hoàn thành game ôn tập
 */
export function speakGameVictory(gameMode: string): void {
  const settings = getTTSSettings();
  const nameSuffix = settings.childName ? ` ${settings.childName}` : " con";
  const daddy = settings.daddyName || "bố";

  const prompts = [
    `Quá xuất sắc! Trò chơi ôn tập ${gameMode} không thể làm khó được ${settings.childName ? settings.childName : "bé yêu"} của ${daddy} rồi! Con được cộng năm mươi điểm XP và một sao vàng lấp lánh nha!`,
    `Tuyệt vời ông mặt trời! ${settings.childName ? settings.childName : "Con gái yêu"} của ${daddy} vừa thắng trò chơi ôn tập rồi! Chơi vui mà lại học giỏi nữa, bố yêu con nhiều!`,
  ];

  const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
  speak(randomPrompt);
}
