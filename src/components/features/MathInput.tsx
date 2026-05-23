/**
 * MathInput.tsx — Smart Math + Text Input for Mê Thi
 * Fixed: Moved portal JSX inline (no nested component) to prevent re-mount flicker.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { TextWithFractions } from './FractionDisplay';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────
interface MathInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  questionId?: string;
  subject?: string;
}

// ── Layout constants ───────────────────────────────────────────────────────────
const MATH_ROWS = [
  ['7', '8', '9', '+'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '×'],
  ['0', ',', '.', ':'],
];

const SYMBOLS = ['=', '(', ')', '<', '>', '≤', '≥', '≠', '%', 'm', 'cm', 'km', 'kg', 'g', 'm²', 'dm²'];

const QWERTY_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

const VI_EXTRAS = ['ă', 'â', 'ê', 'ô', 'ơ', 'ư', 'đ'];

// ── Helper ─────────────────────────────────────────────────────────────────────
function insertAt(s: string, ins: string, start: number, end: number) {
  return s.substring(0, start) + ins + s.substring(end);
}

// ── Component ──────────────────────────────────────────────────────────────────
const MathInput: React.FC<MathInputProps> = ({
  value,
  onChange,
  placeholder = 'Nhấn vào đây để trả lời...',
  questionId = '',
  subject = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'math' | 'text'>('math');
  const [capsLock, setCapsLock] = useState(false);
  const [cursorPos, setCursorPos] = useState(value.length);
  const [numerator, setNumerator] = useState('');
  const [denominator, setDenominator] = useState('');
  const [showFracBuilder, setShowFracBuilder] = useState(false);

  const hiddenRef = useRef<HTMLTextAreaElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);

  // Create a stable portal container once on mount, remove on unmount
  useEffect(() => {
    const div = document.createElement('div');
    div.setAttribute('data-math-keyboard', '');
    document.body.appendChild(div);
    portalRef.current = div;
    return () => {
      document.body.removeChild(div);
    };
  }, []);

  // ── cursor helpers ─────────────────────────────────────────────────────────
  const getSelectionStart = () => hiddenRef.current?.selectionStart ?? cursorPos;
  const getSelectionEnd   = () => hiddenRef.current?.selectionEnd   ?? cursorPos;

  const refocus = (pos: number) => {
    setCursorPos(pos);
    requestAnimationFrame(() => {
      if (hiddenRef.current) {
        hiddenRef.current.setSelectionRange(pos, pos);
      }
    });
  };

  const insert = useCallback((text: string) => {
    const start = getSelectionStart();
    const end   = getSelectionEnd();
    const newVal = insertAt(value, text, start, end);
    onChange(newVal);
    refocus(start + text.length);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, onChange, cursorPos]);

  const doBackspace = useCallback(() => {
    const start = getSelectionStart();
    const end   = getSelectionEnd();
    if (start !== end) {
      const newVal = value.substring(0, start) + value.substring(end);
      onChange(newVal);
      refocus(start);
    } else if (start > 0) {
      const newVal = value.substring(0, start - 1) + value.substring(start);
      onChange(newVal);
      refocus(start - 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, onChange, cursorPos]);

  const moveCursor = useCallback((dir: -1 | 1) => {
    const pos = Math.max(0, Math.min(value.length, getSelectionStart() + dir));
    refocus(pos);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, cursorPos]);

  const insertFraction = useCallback(() => {
    if (!numerator || !denominator) return;
    insert(`${numerator}/${denominator} `);
    setNumerator('');
    setDenominator('');
    setShowFracBuilder(false);
  }, [numerator, denominator, insert]);

  // ── open / close ───────────────────────────────────────────────────────────
  const handleOpen = () => {
    setIsOpen(true);
    setTimeout(() => {
      displayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  };

  // Click-outside to close (touches outside both display AND keyboard)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-math-keyboard]') || t.closest('[data-math-display]')) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [isOpen]);

  // ── keyboard button helpers (prevent losing focus on mousedown) ────────────
  const kb = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    fn();
  };

  // ── portal content (rendered into stable div, NO nested component) ─────────
  const keyboardContent = (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[9999] transition-transform duration-300 ease-out will-change-transform',
        isOpen ? 'translate-y-0' : 'translate-y-full'
      )}
    >
      <div className="bg-white/97 backdrop-blur-xl border-t-2 border-blue-100 shadow-[0_-8px_40px_rgba(59,130,246,0.18)]">

        {/* ── Top toolbar ── */}
        <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-2 border-b border-gray-100">
          {/* Mode switcher */}
          <div className="flex bg-gray-100 rounded-xl p-0.5 gap-0.5 shrink-0">
            <button
              onMouseDown={kb(() => setMode('math'))}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[11px] font-black tracking-wider transition-colors',
                mode === 'math' ? 'bg-blue-600 text-white shadow' : 'text-gray-500'
              )}
            >🔢 TOÁN</button>
            <button
              onMouseDown={kb(() => setMode('text'))}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[11px] font-black tracking-wider transition-colors',
                mode === 'text' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500'
              )}
            >🔤 CHỮ</button>
          </div>

          {/* Live preview strip */}
          <div className="flex-1 mx-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-1 min-h-[32px] max-h-[48px] overflow-hidden">
            <div className="text-[11px] text-blue-800 font-serif leading-tight line-clamp-2">
              {value
                ? <TextWithFractions text={value} />
                : <span className="text-gray-300 italic">Chưa có gì...</span>
              }
            </div>
          </div>

          {/* Done */}
          <button
            onMouseDown={kb(() => setIsOpen(false))}
            className="px-4 py-2 bg-emerald-500 text-white text-[12px] font-black rounded-xl shadow-md shadow-emerald-200 active:scale-95 transition-all shrink-0"
          >XONG ✓</button>
        </div>

        {/* ── Keyboard body ── */}
        <div className="px-2 pt-2 pb-3">

          {/* ══════ MATH MODE ══════ */}
          {mode === 'math' && (
            <div className="space-y-2">
              {/* Row: fraction toggle + nav */}
              <div className="flex items-center gap-2">
                <button
                  onMouseDown={kb(() => setShowFracBuilder(v => !v))}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black border-2 transition-colors active:scale-95',
                    showFracBuilder
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-orange-50 text-orange-600 border-orange-200'
                  )}
                >⁴⁄₅ PHÂN SỐ</button>

                <div className="flex gap-1 ml-auto">
                  {([['◀', () => moveCursor(-1)], ['▶', () => moveCursor(1)]] as [string, ()=>void][]).map(([lbl, fn]) => (
                    <button key={lbl} onMouseDown={kb(fn)}
                      className="w-10 h-9 rounded-xl bg-gray-100 text-gray-700 font-bold text-base border-b-4 border-gray-200 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center">
                      {lbl}
                    </button>
                  ))}
                  <button onMouseDown={kb(() => insert('\n'))}
                    className="w-14 h-9 rounded-xl bg-emerald-100 text-emerald-700 text-[10px] font-black border-b-4 border-emerald-200 active:border-b-0 active:translate-y-1 transition-all">
                    ↵ DÒNG
                  </button>
                  <button onMouseDown={kb(doBackspace)}
                    className="w-12 h-9 rounded-xl bg-red-50 text-red-500 text-xl border-b-4 border-red-100 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center">
                    ⌫
                  </button>
                </div>
              </div>

              {/* Fraction builder */}
              {showFracBuilder && (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-3 flex items-center gap-3">
                  <span className="text-[10px] font-black text-orange-700 uppercase tracking-widest shrink-0">Phân số:</span>
                  <div className="flex flex-col items-center gap-1">
                    <input type="text" inputMode="decimal" value={numerator}
                      onChange={e => setNumerator(e.target.value)} placeholder="Tử"
                      className="w-14 h-9 text-center border-2 border-orange-300 rounded-xl font-bold text-base focus:outline-none focus:border-orange-500 bg-white" />
                    <div className="w-16 h-0.5 bg-orange-400 rounded-full" />
                    <input type="text" inputMode="decimal" value={denominator}
                      onChange={e => setDenominator(e.target.value)} placeholder="Mẫu"
                      className="w-14 h-9 text-center border-2 border-orange-300 rounded-xl font-bold text-base focus:outline-none focus:border-orange-500 bg-white" />
                  </div>
                  {(numerator || denominator) && (
                    <div className="flex flex-col items-center font-serif text-gray-800 min-w-[40px]">
                      <span className="text-base border-b-2 border-gray-600 px-2">{numerator || '?'}</span>
                      <span className="text-base px-2">{denominator || '?'}</span>
                    </div>
                  )}
                  <button onMouseDown={kb(insertFraction)}
                    disabled={!numerator || !denominator}
                    className="ml-auto px-4 py-2 bg-orange-500 text-white font-black text-xs rounded-xl active:scale-95 transition-all shadow-md shadow-orange-200 disabled:opacity-40">
                    CHÈN ↗
                  </button>
                </div>
              )}

              {/* Number + operator grid */}
              <div className="grid grid-cols-8 gap-1.5">
                {MATH_ROWS.map((row, ri) =>
                  row.map((key, ki) => {
                    const isOp = ki === 3;
                    const val = isOp ? ` ${key} ` : key;
                    return (
                      <button key={`${ri}-${ki}`} onMouseDown={kb(() => insert(val))}
                        className={cn(
                          'h-11 rounded-xl font-bold text-base border-b-4 active:border-b-0 active:translate-y-1 transition-all',
                          isOp
                            ? 'bg-blue-50 text-blue-700 border-blue-100 text-xl'
                            : 'bg-gray-50 text-gray-800 border-gray-200'
                        )}>
                        {key}
                      </button>
                    );
                  })
                )}
                <button onMouseDown={kb(() => insert(' '))}
                  className="col-span-4 h-11 rounded-xl bg-gray-100 text-gray-500 text-[11px] font-black border-b-4 border-gray-200 active:border-b-0 active:translate-y-1 transition-all">
                  KHOẢNG TRẮNG
                </button>
              </div>

              {/* Symbols row */}
              <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                {SYMBOLS.map(sym => (
                  <button key={sym} onMouseDown={kb(() => insert(sym))}
                    className="shrink-0 px-3 h-8 rounded-xl bg-white text-gray-600 text-xs font-bold border-2 border-gray-200 active:scale-95 transition-all whitespace-nowrap">
                    {sym}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ══════ TEXT MODE ══════ */}
          {mode === 'text' && (
            <div className="space-y-1.5">
              {QWERTY_ROWS.map((row, ri) => (
                <div key={ri} className="flex justify-center gap-1">
                  {ri === 2 && (
                    <button onMouseDown={kb(() => setCapsLock(v => !v))}
                      className={cn(
                        'w-10 h-10 rounded-xl text-xs font-black border-b-4 active:border-b-0 active:translate-y-1 transition-all',
                        capsLock ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-gray-200 text-gray-600 border-gray-300'
                      )}>⇧</button>
                  )}
                  {row.map(key => (
                    <button key={key} onMouseDown={kb(() => insert(capsLock ? key.toUpperCase() : key))}
                      className="w-9 h-10 rounded-xl bg-white text-gray-800 text-sm font-bold border-2 border-gray-200 border-b-4 border-b-gray-300 active:border-b-2 active:translate-y-0.5 transition-all shadow-sm">
                      {capsLock ? key.toUpperCase() : key}
                    </button>
                  ))}
                  {ri === 2 && (
                    <button onMouseDown={kb(doBackspace)}
                      className="w-10 h-10 rounded-xl bg-red-50 text-red-500 text-lg font-bold border-b-4 border-red-100 active:border-b-0 active:translate-y-1 transition-all">
                      ⌫
                    </button>
                  )}
                </div>
              ))}

              {/* Vietnamese extras + newline */}
              <div className="flex gap-1 justify-center flex-wrap">
                <button onMouseDown={kb(() => setMode('math'))}
                  className="px-3 h-10 rounded-xl bg-blue-100 text-blue-700 text-[11px] font-black border-b-4 border-blue-200 active:border-b-0 active:translate-y-1 transition-all">
                  🔢 TOÁN
                </button>
                {VI_EXTRAS.map(c => (
                  <button key={c} onMouseDown={kb(() => insert(capsLock ? c.toUpperCase() : c))}
                    className="w-9 h-10 rounded-xl bg-indigo-50 text-indigo-700 text-sm font-bold border-b-4 border-indigo-100 active:border-b-0 active:translate-y-1 transition-all">
                    {capsLock ? c.toUpperCase() : c}
                  </button>
                ))}
                <button onMouseDown={kb(() => insert('\n'))}
                  className="px-3 h-10 rounded-xl bg-emerald-100 text-emerald-700 text-[11px] font-black border-b-4 border-emerald-200 active:border-b-0 active:translate-y-1 transition-all">
                  ↵
                </button>
              </div>

              {/* Space bar + cursor nav */}
              <div className="flex gap-1 justify-center">
                <button onMouseDown={kb(() => moveCursor(-1))}
                  className="w-10 h-9 rounded-xl bg-gray-100 text-gray-700 font-bold text-base border-b-4 border-gray-200 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center">◀</button>
                <button onMouseDown={kb(() => insert(' '))}
                  className="flex-1 max-w-[200px] h-9 rounded-xl bg-gray-100 text-gray-400 text-[11px] font-black border-b-4 border-gray-200 active:border-b-0 active:translate-y-1 transition-all">
                  KHOẢNG TRẮNG
                </button>
                <button onMouseDown={kb(() => moveCursor(1))}
                  className="w-10 h-9 rounded-xl bg-gray-100 text-gray-700 font-bold text-base border-b-4 border-gray-200 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center">▶</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Spacer so content isn't hidden behind open keyboard */}
      {isOpen && <div aria-hidden style={{ height: mode === 'math' ? 272 : 308 }} />}

      {/* Answer display area */}
      <div
        data-math-display=""
        ref={displayRef}
        onClick={handleOpen}
        className={cn(
          'relative bg-white rounded-2xl border-4 transition-colors cursor-text overflow-hidden min-h-[120px]',
          isOpen
            ? 'border-blue-500 shadow-xl shadow-blue-100/60'
            : 'border-gray-100 shadow-sm hover:border-blue-200'
        )}
      >
        {/* Hidden textarea to hold cursor/selection state */}
        <textarea
          ref={hiddenRef}
          value={value}
          onChange={e => {
            onChange(e.target.value);
            setCursorPos(e.target.selectionStart ?? value.length);
          }}
          onSelect={() => setCursorPos(hiddenRef.current?.selectionStart ?? cursorPos)}
          readOnly={isOpen}
          className="absolute inset-0 opacity-0 w-full h-full resize-none cursor-text"
          style={{ caretColor: 'transparent' }}
          aria-label="Ô nhập bài làm"
          tabIndex={-1}
        />

        {/* Visual content */}
        <div className="p-4 pointer-events-none select-none">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
            <div className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors',
              isOpen ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'
            )}>✏️</div>
            <p className={cn('text-[10px] font-black uppercase tracking-[0.2em] transition-colors', isOpen ? 'text-blue-600' : 'text-gray-400')}>
              TRẢ LỜI
            </p>
            {isOpen && (
              <span className="ml-auto text-[10px] text-blue-400 font-semibold">● Đang nhập</span>
            )}
          </div>

          <div className="text-[17px] text-gray-800 font-serif leading-relaxed min-h-[60px]">
            {value
              ? <TextWithFractions text={value} />
              : <span className="text-gray-300 italic text-base">{placeholder}</span>
            }
          </div>
        </div>

        {!isOpen && (
          <div className="absolute bottom-2 right-3 text-[10px] text-gray-300 font-semibold select-none pointer-events-none">
            Nhấn để mở bàn phím ↑
          </div>
        )}
      </div>

      {/* Portal: render into stable div (no re-mount = no flicker) */}
      {portalRef.current && ReactDOM.createPortal(keyboardContent, portalRef.current)}
    </>
  );
};

export default MathInput;
