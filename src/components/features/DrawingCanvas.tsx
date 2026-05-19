import React, { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import { PenSettings } from '@/types/exam';

interface DrawingCanvasProps {
  penSettings: PenSettings;
  isActive: boolean;
  isScratchMode?: boolean;
  onDataChange?: (data: string) => void;
}

export interface DrawingCanvasHandle {
  clearAll: () => void;
  undoLast: () => void;
  getData: () => string;
  setData: (data: string) => void;
}

const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(({
  penSettings,
  isActive,
  isScratchMode = false,
  onDataChange,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [hasDrawing, setHasDrawing] = useState(false);
  // Store snapshots for undo
  const historyRef = useRef<string[]>([]);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const { width, height } = parent.getBoundingClientRect();
    const imageData = canvas.toDataURL();
    canvas.width = Math.floor(width);
    canvas.height = Math.floor(height);
    if (hasDrawing) {
      const img = new Image();
      img.onload = () => {
        const ctx = getCtx();
        if (ctx) ctx.drawImage(img, 0, 0);
      };
      img.src = imageData;
    }
  }, [hasDrawing, getCtx]);

  useEffect(() => {
    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    const parent = canvasRef.current?.parentElement;
    if (parent) ro.observe(parent);
    return () => ro.disconnect();
  }, [resizeCanvas]);

// Expose clearAll and undoLast via ref
   useImperativeHandle(ref, () => ({
     clearAll: () => {
       const canvas = canvasRef.current;
       const ctx = getCtx();
       if (!canvas || !ctx) return;
       historyRef.current = [];
       ctx.clearRect(0, 0, canvas.width, canvas.height);
       setHasDrawing(false);
     },
     undoLast: () => {
       const canvas = canvasRef.current;
       const ctx = getCtx();
       if (!canvas || !ctx) return;
       historyRef.current.pop(); // remove current state
       const prev = historyRef.current[historyRef.current.length - 1];
       ctx.clearRect(0, 0, canvas.width, canvas.height);
       if (prev) {
         const img = new Image();
         img.onload = () => ctx.drawImage(img, 0, 0);
         img.src = prev;
         setHasDrawing(true);
       } else {
         setHasDrawing(false);
       }
     },
     getData: () => {
       const canvas = canvasRef.current;
       if (!canvas) return '';
       return canvas.toDataURL();
     },
     setData: (data: string) => {
       const canvas = canvasRef.current;
       const ctx = getCtx();
       if (!canvas || !ctx) return;
       const img = new Image();
       img.onload = () => {
         ctx.clearRect(0, 0, canvas.width, canvas.height);
         ctx.drawImage(img, 0, 0);
         setHasDrawing(true);
       };
       img.src = data;
     },
   }), [getCtx]);

  const getPos = (e: React.TouchEvent | React.MouseEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      if (!touch) return null;
      return {
        x: (touch.clientX - rect.left) * (canvas.width / rect.width),
        y: (touch.clientY - rect.top) * (canvas.height / rect.height),
      };
    }
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const applyPenStyle = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      ctx.strokeStyle = penSettings.color;
      ctx.lineWidth =
        penSettings.style === 'highlighter'
          ? penSettings.size * 4
          : penSettings.style === 'pencil'
          ? penSettings.size * 0.8
          : penSettings.size;
      ctx.globalAlpha =
        penSettings.style === 'highlighter' ? 0.35 : penSettings.style === 'pencil' ? 0.65 : 1.0;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    },
    [penSettings]
  );

  const startDraw = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!isActive) return;
      e.preventDefault();
      isDrawing.current = true;
      const pos = getPos(e);
      if (!pos) return;
      lastPoint.current = pos;
      const ctx = getCtx();
      if (!ctx) return;
      // Save snapshot before stroke
      const canvas = canvasRef.current;
      if (canvas) historyRef.current.push(canvas.toDataURL());
      applyPenStyle(ctx);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = penSettings.color;
      ctx.globalAlpha =
        penSettings.style === 'highlighter' ? 0.35 : penSettings.style === 'pencil' ? 0.65 : 1.0;
      ctx.fill();
      ctx.globalAlpha = 1.0;
    },
    [isActive, getCtx, applyPenStyle, penSettings.color, penSettings.style]
  );

  const draw = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!isActive || !isDrawing.current) return;
      e.preventDefault();
      const pos = getPos(e);
      if (!pos || !lastPoint.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      applyPenStyle(ctx);
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastPoint.current = pos;
      setHasDrawing(true);
    },
    [isActive, getCtx, applyPenStyle]
  );

  const endDraw = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!isDrawing.current) return;
      e.preventDefault();
      isDrawing.current = false;
      lastPoint.current = null;
      const canvas = canvasRef.current;
      if (canvas && onDataChange) {
        onDataChange(canvas.toDataURL());
      }
    },
    [onDataChange]
  );

  return (
    <div className={`relative w-full h-full ${isScratchMode ? '' : 'pointer-events-none'} ${isActive ? 'pointer-events-auto' : ''}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: 'none', cursor: isActive ? 'crosshair' : 'default' }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
    </div>
  );
});

DrawingCanvas.displayName = 'DrawingCanvas';

export default DrawingCanvas;
