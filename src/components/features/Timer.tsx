import React from 'react';

interface Props {
  timeLeft: number; // seconds
  totalTime: number; // seconds
  isLocked: boolean;
}

const Timer: React.FC<Props> = ({ timeLeft, totalTime, isLocked }) => {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const percent = (timeLeft / totalTime) * 100;

  const color =
    timeLeft < 120 ? 'text-red-600' : timeLeft < 300 ? 'text-amber-500' : 'text-emerald-600';
  const barColor =
    timeLeft < 120 ? 'bg-red-500' : timeLeft < 300 ? 'bg-amber-400' : 'bg-emerald-500';

  if (isLocked) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-red-100 rounded-xl border border-red-300">
        <span className="text-red-600 text-xl">🔒</span>
        <span className="text-red-600 font-bold text-sm">Hết giờ</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-w-[90px]">
      <div className={`text-2xl font-bold font-mono tabular-nums ${color}`}>
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </div>
      <div className="w-full h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

export default Timer;
