import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<'loading' | 'fading'>('loading');

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase('fading');
      setTimeout(onComplete, 500);
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        opacity: phase === 'fading' ? 0 : 1,
        transition: 'opacity 0.5s ease',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 72,
          height: 72,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'radial-gradient(circle, hsla(211,100%,60%,0.15) 0%, transparent 70%)',
            animation: 'splash-pulse 2s ease-in-out infinite',
          }}
        />
        <svg
          width="40"
          height="40"
          viewBox="0 0 16 16"
          fill="none"
          style={{ filter: 'drop-shadow(0 0 16px rgba(41,151,255,0.4))' }}
        >
          <path
            d="M 3.5 4.2 L 8 12 L 12.5 4.2"
            stroke="#2997FF"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div
        style={{
          color: '#FFFFFF',
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: '-.04em',
        }}
      >
        Vaelon
      </div>

      <div
        style={{
          color: '#86868B',
          fontSize: 13,
          letterSpacing: '.01em',
          marginTop: -8,
        }}
      >
        Developer Operating System
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          marginTop: 24,
        }}
      >
        <div
          style={{
            width: 160,
            height: 2,
            borderRadius: 1,
            background: 'hsla(0,0%,100%,0.06)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: '30%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, #2997FF, transparent)',
              borderRadius: 1,
              animation: 'splash-slide 1.8s ease-in-out infinite',
            }}
          />
        </div>

        <div
          style={{
            color: '#6E6E73',
            fontSize: 11,
            letterSpacing: '.02em',
          }}
        >
          Initializing...
        </div>
      </div>

      <style>{`
        @keyframes splash-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes splash-slide {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(200%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}