import React, { useState, useEffect, useRef } from 'react';
import { useLayout, LayoutMode, GridSpacing, TextScale } from '@/contexts/LayoutContext';
import { Ruler, Monitor, Settings, X, ChevronRight, Sliders, RotateCw, Trash2, Maximize, Move } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const ScreenInspector: React.FC = () => {
  const {
    metrics,
    layoutMode,
    setLayoutMode,
    gridSpacing,
    setGridSpacing,
    textScale,
    setTextScale,
  } = useLayout();

  const [isOpen, setIsOpen] = useState(false);
  const [showRuler, setShowRuler] = useState(false);
  
  // Ruler position & geometry
  const [rulerPos, setRulerPos] = useState({ x: 100, y: 300 });
  const [rulerWidth, setRulerWidth] = useState(400); // in pixels
  const [rulerRotation, setRulerRotation] = useState(0); // 0 or 90 or 180 or 270 degrees
  const [rulerUnit, setRulerUnit] = useState<'px' | 'cm'>('px');

  const rulerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragPosRef = useRef({ x: 100, y: 300 });

  // Handle dragging of the virtual ruler
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag from handle, not when resizing width
    if ((e.target as HTMLElement).closest('.resize-handle')) return;
    
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    dragPosRef.current = { ...rulerPos };
    
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      
      const newX = Math.max(0, Math.min(window.innerWidth - 100, dragPosRef.current.x + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - 80, dragPosRef.current.y + dy));
      
      setRulerPos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    if (showRuler) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [showRuler]);

  // Adjust ruler width via drag handles
  const handleWidthResize = (e: React.MouseEvent, direction: 'left' | 'right') => {
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = rulerWidth;
    const startXPos = rulerPos.x;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      if (direction === 'right') {
        setRulerWidth(Math.max(150, Math.min(800, startWidth + dx)));
      } else {
        const potentialWidth = startWidth - dx;
        if (potentialWidth >= 150 && potentialWidth <= 800) {
          setRulerWidth(potentialWidth);
          setRulerPos((prev) => ({ ...prev, x: startXPos + dx }));
        }
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const getDpi = () => {
    // Standard screen is around 96 dpi (pixels per inch)
    // 1 inch = 2.54 cm, so 1 cm = 96 / 2.54 = ~37.8 pixels
    return 37.795;
  };

  const pxToCm = (px: number) => {
    return (px / getDpi()).toFixed(1);
  };

  return (
    <>
      {/* Floating Button Ruler Indicator */}
      <div className="fixed bottom-24 right-5 z-40">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex items-center justify-center w-12 h-12 rounded-full shadow-lg border backdrop-blur-md transition-all duration-300 active:scale-90 ${
            isOpen
              ? 'bg-blue-600 border-blue-400 text-white border-solid'
              : 'bg-white/80 border-slate-200 text-slate-700 hover:border-blue-400 hover:text-blue-600'
          }`}
          title="Bảng đo màn hình & Căn chỉnh thước kẻ"
        >
          {isOpen ? <X size={20} /> : <Ruler size={20} className="animate-pulse" />}
        </button>
      </div>

      {/* Virtual Ruler Overlay */}
      <AnimatePresence>
        {showRuler && (
          <div
            ref={rulerRef}
            style={{
              position: 'fixed',
              left: `${rulerPos.x}px`,
              top: `${rulerPos.y}px`,
              width: `${rulerWidth}px`,
              transform: `rotate(${rulerRotation}deg)`,
              transformOrigin: 'center center',
              zIndex: 50,
            }}
            onMouseDown={handleMouseDown}
            className="bg-white/90 backdrop-blur-md border-2 border-blue-500 rounded-lg shadow-2xl p-4 cursor-move transition-shadow duration-300 hover:shadow-blue-200/50"
          >
            {/* Ruler Header Controls */}
            <div className="flex items-center justify-between mb-3 text-xs border-b border-blue-100 pb-2 cursor-default select-none">
              <span className="font-bold text-blue-800 flex items-center gap-1.5">
                <Move size={12} className="text-blue-500" /> THƯỚC ĐO HÌNH HỌC 
              </span>
              <div className="flex items-center gap-1">
                {/* Unit Switch */}
                <button
                  onClick={() => setRulerUnit(u => u === 'px' ? 'cm' : 'px')}
                  className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 font-semibold transition-colors"
                >
                  {rulerUnit === 'px' ? 'Centimet' : 'Pixels'}
                </button>
                {/* Rotate */}
                <button
                  onClick={() => setRulerRotation((r) => (r + 90) % 360)}
                  className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                  title="Xoay thước 90 độ"
                >
                  <RotateCw size={12} />
                </button>
                {/* Close */}
                <button
                  onClick={() => setShowRuler(false)}
                  className="p-1 rounded bg-red-100 hover:bg-red-200 text-red-600 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            {/* Ruler Scale Markings */}
            <div className="relative h-12 border-b border-slate-400 mt-2 select-none pointer-events-none">
              {/* Markings generation */}
              {Array.from({ length: Math.floor(rulerWidth / 10) + 1 }).map((_, i) => {
                const pxVal = i * 10;
                const dpi = getDpi();
                const cmVal = pxVal / dpi;
                const isCmInteger = rulerUnit === 'cm' && Math.round(cmVal * 10) % 10 === 0;
                
                let isMajor = false;
                let label = '';

                if (rulerUnit === 'px') {
                  isMajor = pxVal % 50 === 0;
                  if (pxVal % 100 === 0) label = `${pxVal}`;
                } else {
                  // Centimeter markings
                  isMajor = Math.round(cmVal * 2) % 2 === 0; // major every 1 cm
                  if (isCmInteger) {
                    label = `${Math.round(cmVal)}`;
                    isMajor = true;
                  }
                }

                return (
                  <div
                    key={i}
                    className={`absolute bottom-0 bg-slate-500 transition-all ${
                      isMajor ? 'h-5 w-[1.5px] bg-slate-800' : 'h-2.5 w-[1px]'
                    }`}
                    style={{ left: `${pxVal}px` }}
                  >
                    {label && (
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-slate-700">
                        {label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Width resize handles (extreme edges) */}
            <div
              onMouseDown={(e) => handleWidthResize(e, 'left')}
              className="resize-handle absolute left-0 top-1/2 -translate-y-1/2 w-3 h-8 bg-blue-500 rounded-r cursor-ew-resize flex items-center justify-center hover:bg-blue-600 active:scale-95 transition-all"
              title="Kéo giãn thước bên trái"
            >
              <div className="w-[1px] h-3 bg-white mx-[0.5px]" />
              <div className="w-[1px] h-3 bg-white mx-[0.5px]" />
            </div>
            <div
              onMouseDown={(e) => handleWidthResize(e, 'right')}
              className="resize-handle absolute right-0 top-1/2 -translate-y-1/2 w-3 h-8 bg-blue-500 rounded-l cursor-ew-resize flex items-center justify-center hover:bg-blue-600 active:scale-95 transition-all"
              title="Kéo giãn thước bên phải"
            >
              <div className="w-[1px] h-3 bg-white mx-[0.5px]" />
              <div className="w-[1px] h-3 bg-white mx-[0.5px]" />
            </div>

            {/* Dynamic details readout */}
            <div className="mt-3 flex justify-between text-[10px] font-bold text-slate-500 select-none cursor-default">
              <span>Độ dài: <strong className="text-blue-700">{rulerWidth}px</strong> (~{pxToCm(rulerWidth)} cm)</span>
              <span>Góc: <strong className="text-blue-700">{rulerRotation}°</strong></span>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Screen Inspector Panel Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 200 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 200 }}
            className="fixed top-24 right-5 w-80 max-h-[75vh] z-40 bg-white/90 backdrop-blur-lg border border-slate-200 rounded-2xl shadow-2xl overflow-y-auto p-4 font-sans select-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Monitor size={18} className="text-blue-600" />
                <h3 className="font-bold text-slate-800 text-sm">BẢNG HIỆU CHUẨN MÀN HÌNH</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Screen metrics specs */}
            <div className="space-y-3 bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Độ phân giải:</span>
                <span className="font-bold text-slate-800">
                  {metrics.width} x {metrics.height} px
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Tỷ lệ màn hình:</span>
                <span className="font-bold text-slate-800">{metrics.aspectRatio}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Breakpoint hiện tại:</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] uppercase">
                  {metrics.breakpoint}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Loại thiết bị đo:</span>
                <span className="font-semibold text-slate-800">{metrics.deviceType}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">DPI / Pixel Ratio:</span>
                <span className="font-semibold text-slate-800">{metrics.pixelRatio}x (Retina)</span>
              </div>
            </div>

            {/* Viewport Simulation Model */}
            <div className="my-4 border border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center bg-slate-50/50">
              <p className="text-[10px] text-slate-400 font-bold mb-2 uppercase">Mô phỏng co giãn thực tế</p>
              
              {/* Inner simulated screen container */}
              <div className="relative w-40 h-24 bg-slate-200 border-2 border-slate-700 rounded flex items-center justify-center shadow-inner">
                {/* Adaptive grid representation inside */}
                <div className="grid grid-cols-3 gap-1 w-[90%] h-[80%]">
                  {Array.from({ length: layoutMode === 'mobile' ? 1 : layoutMode === 'tablet' ? 2 : 3 }).map((_, i) => (
                    <div key={i} className="bg-blue-400/80 rounded border border-blue-500 animate-pulse" />
                  ))}
                </div>
                
                {/* Floating measurements inside simulator */}
                <span className="absolute bottom-1 right-1 text-[8px] bg-slate-800/80 text-white px-1 rounded font-mono">
                  {layoutMode.toUpperCase()}
                </span>
              </div>
              {/* Stand */}
              <div className="w-8 h-3 bg-slate-600" />
              <div className="w-16 h-1 bg-slate-700 rounded-full" />
            </div>

            {/* Layout options control */}
            <div className="space-y-4 mt-4">
              {/* Layout mode buttons */}
              <div>
                <p className="text-[10px] text-slate-400 font-bold mb-2 uppercase flex items-center gap-1">
                  <Settings size={10} /> Chiều rộng giao diện
                </p>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {[
                    { id: 'auto', label: 'Tự động đo 🌐' },
                    { id: 'full', label: 'Tràn viền ⚡' },
                    { id: 'desktop', label: 'Máy tính lớn 💻' },
                    { id: 'tablet', label: 'Laptops 📓' },
                    { id: 'mobile', label: 'Di động 📱' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setLayoutMode(mode.id as LayoutMode)}
                      className={`px-2.5 py-2 rounded-xl border font-bold text-left transition-all active:scale-[0.97] ${
                        layoutMode === mode.id
                          ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Spacing spacing */}
              <div>
                <p className="text-[10px] text-slate-400 font-bold mb-2 uppercase flex items-center gap-1">
                  <Sliders size={10} /> Mật độ khoảng cách
                </p>
                <div className="flex bg-slate-100 rounded-xl p-1 text-xs font-bold text-center">
                  {[
                    { id: 'compact', label: 'Khít khao' },
                    { id: 'normal', label: 'Tiêu chuẩn' },
                    { id: 'loose', label: 'Rộng rãi' },
                  ].map((spacing) => (
                    <button
                      key={spacing.id}
                      onClick={() => setGridSpacing(spacing.id as GridSpacing)}
                      className={`flex-1 py-1.5 rounded-lg transition-all ${
                        gridSpacing === spacing.id
                          ? 'bg-white text-blue-700 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {spacing.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font scaling */}
              <div>
                <p className="text-[10px] text-slate-400 font-bold mb-2 uppercase flex items-center gap-1">
                  <ChevronRight size={10} /> Phóng đại cỡ chữ
                </p>
                <div className="flex bg-slate-100 rounded-xl p-1 text-xs font-bold text-center">
                  {[
                    { id: 'small', label: '90%' },
                    { id: 'normal', label: '100%' },
                    { id: 'large', label: '105%' },
                    { id: 'xlarge', label: '110%' },
                  ].map((scale) => (
                    <button
                      key={scale.id}
                      onClick={() => setTextScale(scale.id as TextScale)}
                      className={`flex-1 py-1.5 rounded-lg transition-all ${
                        textScale === scale.id
                          ? 'bg-white text-blue-700 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {scale.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Virtual Ruler Toggle */}
              <div className="border-t border-slate-100 pt-3">
                <button
                  onClick={() => setShowRuler(!showRuler)}
                  className={`w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-xl text-xs active:scale-[0.98] transition-all border ${
                    showRuler
                      ? 'bg-red-50 text-red-600 border-red-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  <Ruler size={14} />
                  {showRuler ? '❌ Tắt thước đo hình học' : '📏 Kích hoạt thước đo hình học'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
