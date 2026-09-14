import React from 'react';

interface SolariLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  variant?: 'gold' | 'monochrome' | 'white';
  className?: string;
}

export const SolariLogo: React.FC<SolariLogoProps> = ({
  size = 'md',
  showSubtitle = true,
  variant = 'gold',
  className = '',
}) => {
  const sizeMap = {
    sm: { icon: 32, title: 'text-sm', sub: 'text-[9px]' },
    md: { icon: 44, title: 'text-lg', sub: 'text-[10px]' },
    lg: { icon: 64, title: 'text-2xl', sub: 'text-xs' },
    xl: { icon: 96, title: 'text-3xl', sub: 'text-sm' },
  };

  const { icon, title, sub } = sizeMap[size];

  const isMono = variant === 'monochrome';
  const isWhite = variant === 'white';

  const goldGradientId = `solari-gold-${size}-${variant}`;
  const sunGradientId = `solari-sun-${size}-${variant}`;

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 160 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-300 hover:scale-105"
        aria-label="Solari Distribution Logo"
      >
        <defs>
          <linearGradient id={goldGradientId} x1="20" y1="20" x2="140" y2="140" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={isMono ? '#1f2937' : isWhite ? '#ffffff' : '#fef08a'} />
            <stop offset="30%" stopColor={isMono ? '#374151' : isWhite ? '#f8fafc' : '#eab308'} />
            <stop offset="70%" stopColor={isMono ? '#111827' : isWhite ? '#e2e8f0' : '#ca8a04'} />
            <stop offset="100%" stopColor={isMono ? '#030712' : isWhite ? '#cbd5e1' : '#854d0e'} />
          </linearGradient>

          <radialGradient id={sunGradientId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={isMono ? '#4b5563' : isWhite ? '#ffffff' : '#fef9c3'} />
            <stop offset="60%" stopColor={isMono ? '#374151' : isWhite ? '#f1f5f9' : '#eab308'} />
            <stop offset="100%" stopColor={isMono ? '#1f2937' : isWhite ? '#e2e8f0' : '#a16207'} />
          </radialGradient>
        </defs>

        {/* Outer Circular Boundary Ring */}
        <circle
          cx="80"
          cy="80"
          r="74"
          stroke={`url(#${goldGradientId})`}
          strokeWidth="3.5"
          opacity={isMono ? '0.9' : isWhite ? '0.8' : '0.85'}
        />

        {/* Sunburst Rays */}
        <g stroke={`url(#${goldGradientId})`} strokeWidth="3" strokeLinecap="round" opacity="0.9">
          <line x1="80" y1="18" x2="80" y2="34" />
          <line x1="61" y1="23" x2="66" y2="38" />
          <line x1="99" y1="23" x2="94" y2="38" />
          <line x1="44" y1="33" x2="52" y2="46" />
          <line x1="116" y1="33" x2="108" y2="46" />
          <line x1="30" y1="48" x2="42" y2="58" />
          <line x1="130" y1="48" x2="118" y2="58" />
          <line x1="22" y1="67" x2="36" y2="72" />
          <line x1="138" y1="67" x2="124" y2="72" />
        </g>

        {/* Central Glowing Sun Disc */}
        <circle
          cx="80"
          cy="70"
          r="26"
          fill={`url(#${sunGradientId})`}
          stroke={`url(#${goldGradientId})`}
          strokeWidth="2.5"
        />
        {/* Inner Sun Accent Notch */}
        <circle
          cx="80"
          cy="70"
          r="8"
          fill={isMono ? '#ffffff' : isWhite ? '#0f172a' : '#fef08a'}
          opacity="0.9"
        />

        {/* Elegant Botanical Flowing Leaves Hugging Base */}
        <path
          d="M 38 120 C 45 92, 75 80, 85 92 C 90 98, 92 110, 80 128 C 65 138, 48 135, 38 120 Z"
          fill={`url(#${goldGradientId})`}
          opacity="0.95"
        />
        <path
          d="M 85 92 C 105 78, 132 88, 128 116 C 124 134, 98 140, 80 128 C 76 118, 80 102, 85 92 Z"
          fill={`url(#${goldGradientId})`}
          opacity="0.88"
        />
        {/* Leaf Vein Accents */}
        <path
          d="M 46 122 C 58 108, 72 98, 82 95"
          stroke={isMono ? '#ffffff' : isWhite ? '#0f172a' : '#fffbeb'}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.75"
        />
        <path
          d="M 85 95 C 100 98, 114 108, 122 120"
          stroke={isMono ? '#ffffff' : isWhite ? '#0f172a' : '#fffbeb'}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.75"
        />

        {/* Small Upper Botanical Sprout */}
        <path
          d="M 124 64 C 130 52, 136 50, 138 56 C 140 62, 134 70, 126 72 Z"
          fill={`url(#${goldGradientId})`}
          opacity="0.9"
        />
        <path
          d="M 120 78 C 128 72, 134 72, 135 77 C 136 82, 130 87, 122 86 Z"
          fill={`url(#${goldGradientId})`}
          opacity="0.85"
        />
      </svg>

      <div className="flex flex-col justify-center">
        <div className="flex items-baseline gap-1.5 leading-none">
          <span
            className={`font-cinzel font-bold tracking-wider ${title} ${
              isWhite ? 'text-white' : isMono ? 'text-stone-900' : 'text-stone-900'
            }`}
          >
            SOLARI
          </span>
          <span
            className={`text-xs font-semibold tracking-widest uppercase ${
              isWhite ? 'text-amber-200' : isMono ? 'text-stone-700' : 'text-amber-700'
            }`}
          >
            DISTRIBUTION
          </span>
        </div>

        {showSubtitle && (
          <>
            <div
              className={`h-[1px] w-full my-1 ${
                isWhite ? 'bg-amber-300/40' : isMono ? 'bg-stone-300' : 'bg-gradient-to-r from-amber-600/40 via-amber-500/80 to-amber-600/40'
              }`}
            />
            <span
              className={`font-sans tracking-widest uppercase font-medium ${sub} ${
                isWhite ? 'text-stone-300' : isMono ? 'text-stone-500' : 'text-stone-600'
              }`}
            >
              Cosmetics &amp; Self-Care Products
            </span>
          </>
        )}
      </div>
    </div>
  );
};
