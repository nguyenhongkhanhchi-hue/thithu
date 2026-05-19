import React from 'react';

interface EssayLinesProps {
  questionText: string;
  lineCount?: number; // override auto-calculation
}

/**
 * Calculate optimal line count for essay answers based on question complexity.
 * Returns number of writing lines to display.
 */
function calcLineCount(questionText: string): number {
  const text = questionText.toLowerCase();
  
  // Long multi-part problems
  if (text.includes('\n') && text.split('\n').length >= 3) return 12;
  
  // Geometry / area problems
  if (text.includes('diện tích') || text.includes('chu vi') || text.includes('hình chữ l') || text.includes('hình chữ nhật')) {
    return 10;
  }
  
  // Multi-step word problems
  if (text.includes('trung bình') || text.includes('bao nhiêu') && text.length > 100) return 9;
  
  // Calculation problems
  if (text.includes('tính bằng') || text.includes('tính:') || text.includes('thuận tiện')) return 8;
  
  // Simple one-step problems
  if (text.length < 80) return 6;
  
  return 8;
}

const EssayLines: React.FC<EssayLinesProps> = ({ questionText, lineCount }) => {
  const lines = lineCount ?? calcLineCount(questionText);
  
  return (
    <div className="mt-3 space-y-0">
      <p className="text-[10px] text-gray-400 mb-1.5 font-medium">
        BÀI GIẢI ({lines} dòng)
      </p>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="relative border-b border-gray-300 h-8 w-full"
          style={{
            backgroundImage: 'none',
          }}
        >
          {/* Subtle left margin line */}
          <div className="absolute left-6 top-0 bottom-0 border-l border-red-200" />
        </div>
      ))}
    </div>
  );
};

export default EssayLines;
