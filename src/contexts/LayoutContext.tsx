import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type LayoutMode = 'auto' | 'mobile' | 'tablet' | 'desktop' | 'full';
export type GridSpacing = 'compact' | 'normal' | 'loose';
export type TextScale = 'small' | 'normal' | 'large' | 'xlarge';

export interface ScreenMetrics {
  width: number;
  height: number;
  breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  deviceType: 'Điện thoại' | 'M.Tính Bảng Đứng' | 'M.Tính Bảng Ngang' | 'Laptop / Desktop' | 'Màn Hình Rộng';
  aspectRatio: string;
  pixelRatio: number;
  orientation: 'portrait' | 'landscape';
}

interface LayoutContextType {
  metrics: ScreenMetrics;
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
  gridSpacing: GridSpacing;
  setGridSpacing: (spacing: GridSpacing) => void;
  textScale: TextScale;
  setTextScale: (scale: TextScale) => void;
  containerClass: string;
  gridClass: string;
  textScaleClass: string;
  spacingClass: string;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

const getBreakpoint = (width: number): 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' => {
  if (width < 640) return 'xs';
  if (width < 768) return 'sm';
  if (width < 1024) return 'md';
  if (width < 1280) return 'lg';
  if (width < 1536) return 'xl';
  return '2xl';
};

const getDeviceType = (width: number, height: number): ScreenMetrics['deviceType'] => {
  const isLandscape = width > height;
  if (width < 768) return 'Điện thoại';
  if (width < 1024) return isLandscape ? 'M.Tính Bảng Ngang' : 'M.Tính Bảng Đứng';
  if (width < 1920) return 'Laptop / Desktop';
  return 'Màn Hình Rộng';
};

const getAspectRatioString = (width: number, height: number): string => {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const r = gcd(width, height);
  const wRatio = Math.round((width / r) * 10) / 10;
  const hRatio = Math.round((height / r) * 10) / 10;
  
  // Return readable approximations for standard screens
  const dec = width / height;
  if (Math.abs(dec - 1.777) < 0.05) return '16:9';
  if (Math.abs(dec - 1.6) < 0.05) return '16:10';
  if (Math.abs(dec - 1.333) < 0.05) return '4:3';
  if (Math.abs(dec - 2.333) < 0.05) return '21:9';
  if (Math.abs(dec - 0.562) < 0.05) return '9:16';
  
  return `${wRatio}:${hRatio} (${dec.toFixed(2)})`;
};

export const LayoutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Load preferences from localStorage
  const [layoutMode, setLayoutModeState] = useState<LayoutMode>(() => {
    return (localStorage.getItem('methi_layout_mode') as LayoutMode) || 'auto';
  });
  
  const [gridSpacing, setGridSpacingState] = useState<GridSpacing>(() => {
    return (localStorage.getItem('methi_grid_spacing') as GridSpacing) || 'normal';
  });

  const [textScale, setTextScaleState] = useState<TextScale>(() => {
    return (localStorage.getItem('methi_text_scale') as TextScale) || 'normal';
  });

  const [metrics, setMetrics] = useState<ScreenMetrics>({
    width: window.innerWidth,
    height: window.innerHeight,
    breakpoint: getBreakpoint(window.innerWidth),
    deviceType: getDeviceType(window.innerWidth, window.innerHeight),
    aspectRatio: getAspectRatioString(window.innerWidth, window.innerHeight),
    pixelRatio: window.devicePixelRatio || 1,
    orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
  });

  // Handle window resizing
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setMetrics({
        width: w,
        height: h,
        breakpoint: getBreakpoint(w),
        deviceType: getDeviceType(w, h),
        aspectRatio: getAspectRatioString(w, h),
        pixelRatio: window.devicePixelRatio || 1,
        orientation: w > h ? 'landscape' : 'portrait',
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const setLayoutMode = (mode: LayoutMode) => {
    setLayoutModeState(mode);
    localStorage.setItem('methi_layout_mode', mode);
  };

  const setGridSpacing = (spacing: GridSpacing) => {
    setGridSpacingState(spacing);
    localStorage.setItem('methi_grid_spacing', spacing);
  };

  const setTextScale = (scale: TextScale) => {
    setTextScaleState(scale);
    localStorage.setItem('methi_text_scale', scale);
  };

  // 1. Calculate dynamic Container Classes
  let containerClass = 'w-full mx-auto px-4 ';
  
  if (layoutMode === 'mobile') {
    containerClass += 'max-w-2xl';
  } else if (layoutMode === 'tablet') {
    containerClass += 'max-w-4xl sm:px-6';
  } else if (layoutMode === 'desktop') {
    containerClass += 'max-w-7xl sm:px-6 lg:px-8';
  } else if (layoutMode === 'full') {
    containerClass += 'max-w-[96%] sm:px-6 lg:px-10';
  } else {
    // 'auto' - Adaptive container
    if (metrics.width < 768) {
      containerClass += 'max-w-2xl';
    } else if (metrics.width < 1280) {
      containerClass += 'max-w-5xl sm:px-6';
    } else if (metrics.width < 1600) {
      containerClass += 'max-w-7xl sm:px-6 lg:px-8';
    } else {
      containerClass += 'max-w-[94%] sm:px-6 lg:px-12';
    }
  }

  // 2. Calculate dynamic Grid classes (gap & column counts)
  let gapClass = 'gap-4';
  if (gridSpacing === 'compact') gapClass = 'gap-2';
  if (gridSpacing === 'loose') gapClass = 'gap-6';

  let gridClass = `grid grid-cols-1 ${gapClass} `;
  
  if (layoutMode === 'mobile') {
    gridClass += 'grid-cols-1';
  } else if (layoutMode === 'tablet') {
    gridClass += 'sm:grid-cols-2';
  } else if (layoutMode === 'desktop') {
    gridClass += 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
  } else if (layoutMode === 'full') {
    gridClass += 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5';
  } else {
    // 'auto' adaptive grid cols
    if (metrics.width >= 1920) {
      gridClass += 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
    } else if (metrics.width >= 1280) {
      gridClass += 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
    } else if (metrics.width >= 640) {
      gridClass += 'sm:grid-cols-2';
    } else {
      gridClass += 'grid-cols-1';
    }
  }

  // 3. Text scaling class
  let textScaleClass = 'text-normal';
  if (textScale === 'small') textScaleClass = 'scale-90 origin-top';
  if (textScale === 'large') textScaleClass = 'scale-105 origin-top';
  if (textScale === 'xlarge') textScaleClass = 'scale-110 origin-top';

  // 4. Spacing padding classes
  let spacingClass = 'p-4';
  if (gridSpacing === 'compact') spacingClass = 'p-2';
  if (gridSpacing === 'loose') spacingClass = 'p-6';

  return (
    <LayoutContext.Provider
      value={{
        metrics,
        layoutMode,
        setLayoutMode,
        gridSpacing,
        setGridSpacing,
        textScale,
        setTextScale,
        containerClass,
        gridClass,
        textScaleClass,
        spacingClass,
      }}
    >
      <div className={`transition-all duration-300 ${textScale === 'small' ? 'text-sm' : textScale === 'large' ? 'text-base' : textScale === 'xlarge' ? 'text-lg' : ''}`}>
        {children}
      </div>
    </LayoutContext.Provider>
  );
};

export const useLayout = (): LayoutContextType => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
};
