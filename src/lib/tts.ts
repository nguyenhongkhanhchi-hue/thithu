/**
 * tts.ts — Text-to-Speech với hỗ trợ song ngữ Việt-Anh
 * Dùng Web Speech API của browser (miễn phí, không cần API key)
 * Tính năng đặc biệt: tự động nhận diện đoạn tiếng Việt vs tiếng Anh
 * và dùng 2 giọng đọc khác nhau
 */

export interface VoiceSettings {
  viVoiceName: string;   // tên giọng tiếng Việt
  enVoiceName: string;   // tên giọng tiếng Anh
  rate: number;          // 0.5 - 2.0, default 0.9
  pitch: number;         // 0.5 - 2.0, default 1.0
  volume: number;        // 0 - 1, default 1.0
  bilingual: boolean;    // true = dùng 2 giọng, false = chỉ dùng tiếng Việt
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  viVoiceName: '',
  enVoiceName: '',
  rate: 0.9,
  pitch: 1.0,
  volume: 1.0,
  bilingual: false,
};

const VOICE_SETTINGS_KEY = 'examtouch_voice_settings';

export function loadVoiceSettings(): VoiceSettings {
  try {
    const stored = localStorage.getItem(VOICE_SETTINGS_KEY);
    if (stored) return { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(stored) };
  } catch {}
  return { ...DEFAULT_VOICE_SETTINGS };
}

export function saveVoiceSettings(s: VoiceSettings): void {
  localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(s));
}

/** Lấy danh sách voices có sẵn trong browser */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}

export function getVietnameseVoices(): SpeechSynthesisVoice[] {
  return getAvailableVoices().filter(
    (v) =>
      v.lang.startsWith('vi') ||
      v.name.toLowerCase().includes('viet') ||
      v.name.toLowerCase().includes('vi-')
  );
}

export function getEnglishVoices(): SpeechSynthesisVoice[] {
  return getAvailableVoices().filter((v) => v.lang.startsWith('en'));
}

// ── Bilingual text splitting ──────────────────────────────────────────────────

/** Các từ tiếng Anh phổ biến trong giáo dục Việt Nam */
const ENGLISH_EDUCATION_TERMS = new Set([
  // Math / Science
  'fraction', 'equation', 'formula', 'method', 'step', 'solution', 'answer',
  'triangle', 'circle', 'square', 'rectangle', 'angle', 'area', 'volume',
  'perimeter', 'radius', 'diameter', 'parallel', 'perpendicular', 'hypotenuse',
  'theorem', 'proof', 'function', 'variable', 'constant', 'coefficient',
  'numerator', 'denominator', 'integer', 'decimal', 'percentage',
  'addition', 'subtraction', 'multiplication', 'division',
  'atom', 'molecule', 'cell', 'gene', 'protein', 'chromosome',
  'element', 'compound', 'reaction', 'catalyst', 'acid', 'base',
  'force', 'velocity', 'acceleration', 'gravity', 'mass', 'energy',
  'voltage', 'current', 'resistance', 'circuit', 'frequency', 'wave',
  // English words commonly used in Vietnamese teaching
  'okay', 'ok', 'yes', 'no', 'note', 'example', 'practice', 'homework',
  'vocabulary', 'grammar', 'pronunciation', 'spelling',
  'map', 'chart', 'graph', 'table', 'diagram',
  'input', 'output', 'data', 'code', 'program', 'algorithm',
  'score', 'point', 'level', 'rank', 'test', 'quiz',
  // Common English adjectives/adverbs
  'important', 'special', 'basic', 'advanced', 'simple', 'complex',
  'first', 'second', 'third', 'final', 'total', 'sum',
]);

/** Các ký tự đặc trưng tiếng Việt có dấu */
const VI_DIACRITICS =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỗƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/;

/** Nhận diện ngôn ngữ một từ */
function detectWordLang(word: string): 'vi' | 'en' {
  // Chắc chắn là tiếng Việt nếu có ký tự dấu
  if (VI_DIACRITICS.test(word)) return 'vi';
  // Số, ký tự toán học → đọc theo ngữ cảnh tiếng Việt
  if (/^[\d\+\-\×÷\*\/\=\.\,\%\(\)\[\]\{\}]+$/.test(word)) return 'vi';
  // Chỉ lấy phần chữ cái
  const letters = word.toLowerCase().replace(/[^a-z]/g, '');
  if (letters.length === 0) return 'vi';
  // Từ quá ngắn (1-2 ký tự) → mặc định tiếng Việt
  if (letters.length <= 2) return 'vi';
  // Kiểm tra từ điển tiếng Anh
  if (ENGLISH_EDUCATION_TERMS.has(letters)) return 'en';
  // Mặc định tiếng Việt
  return 'vi';
}

export interface TextSegment {
  lang: 'vi' | 'en';
  text: string;
}

/** Chia text thành các đoạn vi/en xen kẽ */
export function splitBilingualText(text: string): TextSegment[] {
  if (!text.trim()) return [];

  const segments: TextSegment[] = [];
  const tokens = text.split(/(\s+)/);

  let currentLang: 'vi' | 'en' | null = null;
  let currentText = '';

  for (const token of tokens) {
    // Khoảng trắng
    if (/^\s+$/.test(token)) {
      currentText += token;
      continue;
    }

    const lang = detectWordLang(token);

    if (lang === currentLang) {
      currentText += token;
    } else {
      if (currentText.trim() && currentLang) {
        segments.push({ lang: currentLang, text: currentText });
      } else if (currentText && !currentText.trim()) {
        if (segments.length > 0) segments[segments.length - 1].text += currentText;
      }
      currentLang = lang;
      currentText = token;
    }
  }

  if (currentText.trim() && currentLang) {
    segments.push({ lang: currentLang, text: currentText });
  }

  return segments.filter((s) => s.text.trim() !== '');
}

// ── TTS Engine ────────────────────────────────────────────────────────────────

let currentUtterances: SpeechSynthesisUtterance[] = [];

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  currentUtterances = [];
}

export function isSpeaking(): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  return !!window.speechSynthesis.speaking;
}

function findVoice(name: string, lang: string): SpeechSynthesisVoice | null {
  const voices = getAvailableVoices();
  if (name) {
    const byName = voices.find((v) => v.name === name);
    if (byName) return byName;
  }
  return voices.find((v) => v.lang.startsWith(lang)) || null;
}

export function speakText(
  text: string,
  settings: VoiceSettings,
  onEnd?: () => void
): void {
  stopSpeaking();
  if (!text.trim()) {
    onEnd?.();
    return;
  }

  if (typeof window === 'undefined') {
    onEnd?.();
    return;
  }

  const synth = window.speechSynthesis;
  if (!synth) {
    onEnd?.();
    return;
  }

  const segments = settings.bilingual
    ? splitBilingualText(text)
    : [{ lang: 'vi' as const, text }];

  const filteredSegments = segments.filter((s) => s.text.trim() !== '');
  if (filteredSegments.length === 0) {
    onEnd?.();
    return;
  }

  let idx = 0;

  const speakNext = () => {
    if (idx >= filteredSegments.length) {
      onEnd?.();
      return;
    }
    const seg = filteredSegments[idx++];
    const utterance = new SpeechSynthesisUtterance(seg.text);

    const voice =
      seg.lang === 'en'
        ? findVoice(settings.enVoiceName, 'en')
        : findVoice(settings.viVoiceName, 'vi');

    if (voice) utterance.voice = voice;
    utterance.lang = seg.lang === 'en' ? 'en-US' : 'vi-VN';
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.volume = settings.volume;
    utterance.onend = speakNext;
    utterance.onerror = speakNext;

    currentUtterances.push(utterance);
    synth.speak(utterance);
  };

  speakNext();
}
