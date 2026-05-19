import React, { useState, useRef, useEffect } from 'react';
import 'katex/dist/katex.min.css';
import { TextWithFractions } from './FractionDisplay';
import { cn } from '@/lib/utils';

interface MathInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

const MathInput: React.FC<MathInputProps> = ({ 
  value, 
  onChange, 
  placeholder = 'Viết lời giải vào đây...',
  rows = 5
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [numerator, setNumerator] = useState('');
  const [denominator, setDenominator] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Xử lý click ra ngoài để đóng bàn phím
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsEditing(false);
      }
    };

    if (isEditing) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing]);

  const handleFocus = () => {
    setIsEditing(true);
    textareaRef.current?.focus();
  };

  const handleSave = () => {
    setIsEditing(false);
  };

  const insertAtCursor = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = value.substring(0, start) + text + value.substring(end);
    
    onChange(newValue);
    
    // Restore cursor position
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
    }, 0);
  };

  const handleBackspace = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    let newValue: string;
    let newCursorPos: number;

    if (start !== end) {
      newValue = value.substring(0, start) + value.substring(end);
      newCursorPos = start;
    } else if (start > 0) {
      newValue = value.substring(0, start - 1) + value.substring(start);
      newCursorPos = start - 1;
    } else {
      return;
    }
    
    onChange(newValue);
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = newCursorPos;
    }, 0);
  };

  const handleInsertFraction = () => {
    if (!numerator || !denominator) return;
    insertAtCursor(`${numerator}/${denominator}`);
    setNumerator('');
    setDenominator('');
  };

  return (
    <div className="space-y-3" ref={containerRef}>
      {/* Main Answer Area (Consolidated) */}
      <div 
        onClick={handleFocus}
        className={cn(
          "relative bg-white rounded-[32px] border-4 transition-all cursor-text overflow-hidden flex flex-col p-6",
          isEditing ? "border-blue-500 shadow-xl shadow-blue-100" : "border-gray-100 shadow-sm hover:border-blue-200"
        )}
        style={{ minHeight: `${Math.max(160, rows * 32)}px` }}
      >
        {/* Label */}
        <div className="flex items-center gap-2 mb-4 border-b border-gray-50 pb-2">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center text-sm",
            isEditing ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400"
          )}>
            ✏️
          </div>
          <p className={cn(
            "text-xs font-black uppercase tracking-[0.2em]",
            isEditing ? "text-blue-600" : "text-gray-400"
          )}>
            TRẢ LỜI
          </p>
        </div>

        {/* The Actual Display (Standard Fraction) */}
        <div className="flex-1 text-xl text-gray-800 font-serif leading-relaxed relative z-10 pointer-events-none">
          {value ? (
            <TextWithFractions text={value} />
          ) : (
            <span className="text-gray-300 italic">{placeholder}</span>
          )}
        </div>

        {/* Hidden but functional textarea for input */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsEditing(true)}
          className="absolute inset-0 w-full h-full bg-transparent text-transparent caret-blue-600 px-6 py-[4.5rem] cursor-text resize-none z-20 outline-none"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
        />
      </div>

      {/* Inline Keyboard (Only when editing) */}
      {isEditing && (
        <div 
          className="bg-white border-2 border-blue-100 rounded-3xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300"
          onMouseDown={(e) => {
            // Ngăn việc mất focus khỏi textarea khi nhấn vào bàn phím (trừ các ô input)
            if ((e.target as HTMLElement).tagName !== 'INPUT') {
              e.preventDefault();
            }
          }}
        >
          <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
            {/* Quick Preview Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">⌨️</span>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Bàn phím học tập</p>
              </div>
              <button 
                onClick={handleSave}
                className="px-4 py-1.5 rounded-full bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider active:scale-95 transition-all shadow-md shadow-blue-200"
              >
                XONG RỒI 💾
              </button>
            </div>

            {/* Responsive Grid for Landscape support */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4">
              {/* Left Side: Fraction & Numbers */}
              <div className="sm:col-span-8 space-y-3">
                {/* Fraction Builder - Compact */}
                <div className="bg-orange-50 rounded-2xl p-2.5 border border-orange-100 flex items-center gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <input
                      type="text"
                      value={numerator}
                      onChange={(e) => setNumerator(e.target.value)}
                      placeholder="Tử"
                      className="w-10 h-8 text-center border-2 border-orange-200 rounded-lg font-bold text-base focus:outline-none focus:border-orange-500 bg-white"
                    />
                    <div className="w-12 h-0.5 bg-orange-300 rounded-full" />
                    <input
                      type="text"
                      value={denominator}
                      onChange={(e) => setDenominator(e.target.value)}
                      placeholder="Mẫu"
                      className="w-10 h-8 text-center border-2 border-orange-200 rounded-lg font-bold text-base focus:outline-none focus:border-orange-500 bg-white"
                    />
                  </div>
                  <button
                    onClick={handleInsertFraction}
                    disabled={!numerator || !denominator}
                    className="flex-1 h-20 bg-orange-500 text-white font-black text-xs rounded-xl active:scale-95 transition-all shadow-md shadow-orange-200 disabled:opacity-40"
                  >
                    CHÈN<br/>PHÂN SỐ
                  </button>
                </div>

                {/* Number Pad - Grid based on screen orientation */}
                <div className="grid grid-cols-5 sm:grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
                    <button
                      key={num}
                      onClick={() => insertAtCursor(num.toString())}
                      className="h-10 sm:h-11 rounded-xl bg-gray-50 text-gray-800 text-lg font-bold border-b-4 border-gray-200 active:border-b-0 active:translate-y-1 transition-all"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    onClick={() => insertAtCursor(',')}
                    className="h-10 sm:h-11 rounded-xl bg-gray-50 text-gray-800 text-lg font-bold border-b-4 border-gray-200 active:border-b-0 active:translate-y-1 transition-all"
                  >
                    ,
                  </button>
                  <button
                    onClick={() => insertAtCursor(' ')}
                    className="h-10 sm:h-11 rounded-xl bg-gray-200 text-gray-600 text-[10px] font-black border-b-4 border-gray-300 active:border-b-0 active:translate-y-1 transition-all"
                  >
                    CÁCH
                  </button>
                </div>
              </div>

              {/* Right Side: Operators & Special */}
              <div className="sm:col-span-4 flex flex-col gap-2">
                <div className="grid grid-cols-4 sm:grid-cols-2 gap-2 flex-1">
                  <button
                    onClick={handleBackspace}
                    className="h-10 sm:h-11 rounded-xl bg-red-50 text-red-600 text-xl font-bold border-b-4 border-red-100 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center"
                  >
                    ⌫
                  </button>
                  {['+', '-', '×', ':'].map((op) => (
                    <button
                      key={op}
                      onClick={() => insertAtCursor(` ${op} `)}
                      className="h-10 sm:h-11 rounded-xl bg-blue-50 text-blue-700 text-xl font-bold border-b-4 border-blue-100 active:border-b-0 active:translate-y-1 transition-all"
                    >
                      {op}
                    </button>
                  ))}
                  <button
                    onClick={() => insertAtCursor('\n')}
                    className="h-10 sm:h-auto sm:flex-1 rounded-xl bg-emerald-500 text-white text-[10px] sm:text-xs font-black border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1 transition-all"
                  >
                    MỚI<br className="hidden sm:block"/> DÒNG
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Row: Symbols - Horizontal scrollable on mobile */}
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {['(', ')', '=', '?', '>', '<', '...', 'cm', 'm', 'kg'].map((sym) => (
                <button
                  key={sym}
                  onClick={() => insertAtCursor(sym)}
                  className="min-w-[40px] flex-1 h-8 rounded-xl bg-white text-gray-600 text-xs font-bold border border-gray-200 active:scale-95 transition-all whitespace-nowrap px-2"
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MathInput;
