import React from 'react';

/**
 * Renders fractions in 2-line stacked format.
 * Input: text containing patterns like "a/b" where a and b are numbers/expressions.
 * Output: JSX with proper stacked fraction formatting.
 */

interface FractionProps {
  numerator: string;
  denominator: string;
  className?: string;
}

export const Fraction: React.FC<FractionProps> = ({ numerator, denominator, className = '' }) => (
  <span
    className={`inline-flex flex-col items-center leading-none mx-0.5 align-middle ${className}`}
    style={{ 
      verticalAlign: 'middle',
      transform: 'translateY(-0.1em)' // Nâng nhẹ để căn giữa dòng tốt hơn
    }}
  >
    <span className="text-[0.9em] leading-tight border-b-2 border-current px-0.5 font-bold">
      {numerator}
    </span>
    <span className="text-[0.9em] leading-tight px-0.5 font-bold">{denominator}</span>
  </span>
);

/**
 * Parse text and replace fraction patterns with stacked Fraction components.
 * Handles: "3/4", "15/45", "2/3", mixed numbers like "4 2/5"
 */
export function renderWithFractions(text: string): React.ReactNode[] {
  // Pattern: optional integer part + fraction (digits/digits or simple expressions)
  // Matches: "3/4", "15/45", "4 2/5", "a/b", "x/2"
  const parts: React.ReactNode[] = [];
  
  // First handle mixed numbers like "4 2/5" => 4 + stacked fraction
  const mixedPattern = /(\d+)\s+([a-zA-Z0-9]+)\/([a-zA-Z0-9]+)/g;
  const fractionPattern = /([a-zA-Z0-9]+)\/([a-zA-Z0-9]+)/g;
  
  let lastIndex = 0;
  const combined = text;
  
  // Build a list of replacements
  interface Replacement {
    start: number;
    end: number;
    node: React.ReactNode;
  }
  const replacements: Replacement[] = [];
  
  // Find mixed numbers first
  let match: RegExpExecArray | null;
  mixedPattern.lastIndex = 0;
  while ((match = mixedPattern.exec(combined)) !== null) {
    replacements.push({
      start: match.index,
      end: match.index + match[0].length,
      node: (
        <span key={`mix-${match.index}`} className="inline-flex items-center gap-0.5">
          <span>{match[1]}</span>
          <Fraction numerator={match[2]} denominator={match[3]} />
        </span>
      ),
    });
  }
  
  // Find plain fractions, skip overlapping with mixed numbers
  fractionPattern.lastIndex = 0;
  while ((match = fractionPattern.exec(combined)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    const overlaps = replacements.some((r) => start < r.end && end > r.start);
    if (!overlaps) {
      replacements.push({
        start,
        end,
        node: <Fraction key={`frac-${start}`} numerator={match[1]} denominator={match[2]} />,
      });
    }
  }
  
  // Sort by position
  replacements.sort((a, b) => a.start - b.start);
  
  // Build result
  lastIndex = 0;
  for (const rep of replacements) {
    if (rep.start > lastIndex) {
      parts.push(combined.slice(lastIndex, rep.start));
    }
    parts.push(rep.node);
    lastIndex = rep.end;
  }
  if (lastIndex < combined.length) {
    parts.push(combined.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : [text];
}

interface TextWithFractionsProps {
  text: string;
  className?: string;
}

export const TextWithFractions: React.FC<TextWithFractionsProps> = ({ text, className }) => {
  const lines = text.split('\n');
  return (
    <span className={`block ${className || ''}`} style={{ lineHeight: '1.8' }}>
      {lines.map((line, i) => (
        <span key={i} className="block min-h-[1.2em] my-1 text-slate-800">
          {renderWithFractions(line)}
        </span>
      ))}
    </span>
  );
};

export default TextWithFractions;
