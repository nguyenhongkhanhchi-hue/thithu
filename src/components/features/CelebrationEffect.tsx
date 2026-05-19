import { useEffect, useState, useRef, useCallback } from 'react';

const COLORS = ['#FF6B9D', '#A855F7', '#FDE047', '#34D399', '#60A5FA', '#FB923C', '#F87171', '#FBBF24'];

interface Particle {
  id: number;
  x: number; color: string; size: number; delay: number; duration: number; shape: string;
}

let pid = 0;

export const celebrate = (message: string) => {
  window.dispatchEvent(new CustomEvent('app:celebrate', { detail: { message } }));
};

export function CelebrationEffect() {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const timerRef = useRef<any>();

  const triggerCelebration = useCallback((msg: string) => {
    clearTimeout(timerRef.current);
    setMessage(msg);
    setVisible(true);
    const newParticles: Particle[] = Array.from({ length: 60 }, () => ({
      id: pid++,
      x: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: Math.random() * 10 + 6,
      delay: Math.random() * 0.8,
      duration: Math.random() * 1.5 + 1.5,
      shape: Math.random() > 0.5 ? 'circle' : 'rect',
    }));
    setParticles(newParticles);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setParticles([]);
    }, 3200);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const { message: msg } = (e as CustomEvent).detail;
      triggerCelebration(msg);
    };
    window.addEventListener('app:celebrate', handler);
    return () => window.removeEventListener('app:celebrate', handler);
  }, [triggerCelebration]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9998] pointer-events-none">
      {/* Confetti */}
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute top-0 confetti-piece"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.shape === 'rect' ? p.size * 0.4 : p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : '3px',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
      {/* Message */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
        <div
          className="text-white text-3xl font-extrabold px-8 py-5 rounded-3xl shadow-2xl animate-bounce text-center"
          style={{
            fontFamily: "'Baloo 2', cursive",
            background: 'linear-gradient(135deg, #FF6B9D, #A855F7)',
            textShadow: '2px 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          {message}
        </div>
      </div>
    </div>
  );
}
