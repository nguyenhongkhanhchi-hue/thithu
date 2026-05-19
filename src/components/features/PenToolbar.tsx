import React from 'react';
import { PenSettings } from '@/types/exam';
import { PEN_COLORS, PEN_STYLES } from '@/constants/exams';

interface PenToolbarProps {
  penSettings: PenSettings;
  onChange: (settings: Partial<PenSettings>) => void;
  drawMode: boolean;
  onToggleDrawMode: () => void;
}

const PenToolbar: React.FC<PenToolbarProps> = ({
  penSettings,
  onChange,
  drawMode,
  onToggleDrawMode,
}) => {
  return (
    <div className="flex flex-col gap-3 p-3 bg-white rounded-2xl shadow-xl border border-gray-100">
      {/* Draw toggle */}
      <button
        onClick={onToggleDrawMode}
        className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 font-semibold text-sm transition-all active:scale-95 ${
          drawMode
            ? 'bg-blue-600 text-white shadow-blue-200 shadow-md'
            : 'bg-gray-100 text-gray-600'
        }`}
      >
        <span className="text-base">✏️</span>
        <span>{drawMode ? 'Tắt bút' : 'Bật bút'}</span>
      </button>

      {/* Pen style */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-1">Kiểu bút</p>
        <div className="flex gap-1.5">
          {PEN_STYLES.map((ps) => (
            <button
              key={ps.id}
              onClick={() => onChange({ style: ps.id as PenSettings['style'] })}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all active:scale-95 ${
                penSettings.style === ps.id
                  ? 'bg-blue-100 text-blue-700 border-2 border-blue-400'
                  : 'bg-gray-50 text-gray-600 border border-gray-200'
              }`}
            >
              {ps.label}
            </button>
          ))}
        </div>
      </div>

      {/* Colors */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-1">Màu bút</p>
        <div className="grid grid-cols-6 gap-1.5">
          {PEN_COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => onChange({ color: c.hex })}
              title={c.label}
              className={`w-8 h-8 rounded-full transition-all active:scale-90 ${
                penSettings.color === c.hex ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
              }`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      </div>

      {/* Size */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-1">
          Kích thước: {penSettings.size}px
        </p>
        <input
          type="range"
          min={1}
          max={16}
          value={penSettings.size}
          onChange={(e) => onChange({ size: Number(e.target.value) })}
          className="w-full accent-blue-600 h-1.5"
        />
        <div className="flex justify-between text-[10px] text-gray-400 px-1">
          <span>Nhỏ</span>
          <span>To</span>
        </div>
      </div>

      {/* Preview dot */}
      <div className="flex items-center justify-center h-8">
        <div
          className="rounded-full transition-all"
          style={{
            width: penSettings.size * 2,
            height: penSettings.size * 2,
            backgroundColor: penSettings.color,
            opacity: penSettings.style === 'highlighter' ? 0.4 : penSettings.style === 'pencil' ? 0.7 : 1,
            minWidth: 4,
            minHeight: 4,
          }}
        />
      </div>
    </div>
  );
};

export default PenToolbar;
