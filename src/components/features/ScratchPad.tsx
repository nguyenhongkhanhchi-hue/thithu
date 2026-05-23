import React, { useState, useRef, useEffect } from 'react';
import PenToolbar from '@/components/features/PenToolbar';
import DrawingCanvas from '@/components/features/DrawingCanvas';
import { PenSettings } from '@/types/exam';

const SCRATCHPAD_KEY = 'examtouch_scratchpad';

interface ScratchPadProps {
  isOpen: boolean;
  onClose: () => void;
  penSettings: PenSettings;
  onPenChange: (s: Partial<PenSettings>) => void;
  isInline?: boolean;
}

const ScratchPad: React.FC<ScratchPadProps> = ({ isOpen, onClose, penSettings, onPenChange, isInline = false }) => {
  const [showPenBar, setShowPenBar] = useState(false);
  const [eraserMode, setEraserMode] = useState(false);
  const canvasRef = useRef<{ clearAll: () => void; undoLast: () => void; getData: () => string; setData: (data: string) => void } | null>(null);

  // Load saved scratchpad data on mount
  useEffect(() => {
    if ((isOpen || isInline) && canvasRef.current) {
      const saved = localStorage.getItem(SCRATCHPAD_KEY);
      if (saved) {
        canvasRef.current.setData(saved);
      }
    }
    return () => {
      if (isInline && canvasRef.current) {
        const data = canvasRef.current.getData();
        localStorage.setItem(SCRATCHPAD_KEY, data);
      }
    };
  }, [isOpen, isInline]);

  // Save scratchpad data on unmount/close
  const handleClose = () => {
    if (canvasRef.current) {
      const data = canvasRef.current.getData();
      localStorage.setItem(SCRATCHPAD_KEY, data);
    }
    onClose();
  };

  if (!isOpen && !isInline) return null;

  const effectivePen: PenSettings = eraserMode
    ? { ...penSettings, color: '#FEF3C7', size: 24, style: 'pen', opacity: 1 }
    : penSettings;

  return (
    <div
      className={isInline
        ? "w-full h-[calc(100vh-140px)] flex flex-col bg-amber-50 rounded-2xl border-2 border-amber-200 shadow-md relative overflow-hidden"
        : "fixed inset-0 z-50 flex flex-col bg-amber-50"
      }
      style={{ touchAction: 'none' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-amber-200 shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">📝</span>
          <div>
            <p className="font-bold text-gray-800 text-sm leading-none">Bảng viết nháp</p>
            <p className="text-[10px] text-gray-400">Vẽ nháp tự do</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Undo last stroke */}
          <button
            onClick={() => canvasRef.current?.undoLast()}
            className="px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold active:scale-95 transition-all"
            title="Xóa nét vừa vẽ"
          >
            ↩ Hoàn tác
          </button>

          {/* Eraser */}
          <button
            onClick={() => setEraserMode((v) => !v)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
              eraserMode ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
            }`}
            title="Tẩy cục bộ"
          >
            🧹 Tẩy
          </button>

          {/* Clear all */}
          <button
            onClick={() => canvasRef.current?.clearAll()}
            className="px-2.5 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 text-xs font-semibold active:scale-95 transition-all"
            title="Xóa toàn bộ"
          >
            🗑 Xóa hết
          </button>

          {/* Pen settings */}
          <button
            onClick={() => setShowPenBar(!showPenBar)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
              showPenBar ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            🖊 Bút
          </button>

          {/* Close */}
          {!isInline && (
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 text-white text-xs font-bold active:scale-95 transition-all shadow-md"
              title="Đóng nháp"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Pen toolbar */}
        {showPenBar && (
          <div className="w-52 shrink-0 p-3 border-r border-amber-200 bg-white overflow-y-auto z-10 shadow-lg">
            <PenToolbar
              penSettings={penSettings}
              onChange={onPenChange}
              drawMode={true}
              onToggleDrawMode={() => setShowPenBar(false)}
            />
          </div>
        )}

        {/* Canvas area */}
        <div
          className="flex-1 relative"
          style={{
            backgroundImage:
              'repeating-linear-gradient(transparent, transparent 39px, #d4a017 39px, #d4a017 40px)',
          }}
        >
          <DrawingCanvas
            penSettings={effectivePen}
            isActive={true}
            isScratchMode={true}
            ref={canvasRef}
          />
        </div>
      </div>

      {/* Bottom hint */}
      <div className="bg-white border-t border-amber-200 px-4 py-2 flex items-center justify-between shrink-0">
        <p className="text-[10px] text-gray-400">
          {eraserMode ? '🧹 Chế độ tẩy: kéo để xóa nét vẽ' : '✏️ Viết nháp tự do bên cạnh đề thi'}
        </p>
        {!isInline && (
          <button
            onClick={handleClose}
            className="text-[10px] font-bold text-blue-600 active:scale-95 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200"
          >
            ✕ Đóng nháp
          </button>
        )}
      </div>
    </div>
  );
};

export default ScratchPad;
