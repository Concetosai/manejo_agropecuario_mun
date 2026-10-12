import React from 'react';
import { Award, ShieldCheck } from 'lucide-react';

interface PanucoMunicipalLogoProps {
  customLogoUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'print';
  className?: string;
}

export const PanucoMunicipalLogo: React.FC<PanucoMunicipalLogoProps> = ({
  customLogoUrl,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14 sm:w-16 sm:h-16',
    lg: 'w-20 h-20 sm:w-24 sm:h-24',
    print: 'w-12 h-12 print:w-12 print:h-12',
  }[size];

  if (customLogoUrl && customLogoUrl.trim().length > 5) {
    return (
      <div className={`relative shrink-0 rounded-lg overflow-hidden border border-amber-800/30 bg-white p-0.5 shadow-xs ${sizeClasses} ${className}`}>
        <img
          src={customLogoUrl}
          alt="Escudo Oficial del Municipio de Pánuco, Veracruz"
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  // Official Heraldic Emblem of the Municipality of Pánuco, Veracruz
  return (
    <div
      className={`relative shrink-0 rounded-full border-2 border-amber-800/50 bg-gradient-to-b from-amber-50 via-white to-amber-100/60 p-1 flex items-center justify-center shadow-xs select-none ${sizeClasses} ${className}`}
      title="Escudo Oficial del H. Ayuntamiento Constitucional de Pánuco, Veracruz"
    >
      <svg
        viewBox="0 0 120 120"
        className="w-full h-full drop-shadow-2xs"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer Circular Border with Decorative Beaded Rim */}
        <circle cx="60" cy="60" r="56" stroke="#831843" strokeWidth="2.5" fill="none" />
        <circle cx="60" cy="60" r="52" stroke="#d97706" strokeWidth="1.2" strokeDasharray="2 2" fill="none" />
        <circle cx="60" cy="60" r="48" stroke="#15803d" strokeWidth="1" fill="#fdfbf7" />

        {/* Heraldic Shield Shape */}
        <path
          d="M36 28 H84 V62 C84 78 60 92 60 92 C60 92 36 78 36 62 Z"
          fill="#faf5ee"
          stroke="#78350f"
          strokeWidth="1.5"
        />

        {/* River Pánuco Waves in Shield Base */}
        <path
          d="M38 65 Q48 60 60 65 T82 65 V67 C78 76 60 88 60 88 C60 88 42 76 38 67 Z"
          fill="#0284c7"
          opacity="0.25"
        />
        <path
          d="M40 68 C46 66 52 70 60 68 C68 66 74 70 80 68"
          stroke="#0369a1"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M44 73 C49 71 54 74 60 72 C66 70 71 74 76 72"
          stroke="#0369a1"
          strokeWidth="1.2"
          strokeLinecap="round"
        />

        {/* Cattle Head / Ganadería de la Huasteca (Bull silhouette) */}
        <path
          d="M52 46 C52 43 45 37 41 39 C44 42 48 45 50 49 C48 53 50 59 60 59 C70 59 72 53 70 49 C72 45 76 42 79 39 C75 37 68 43 68 46 C66 45 63 44 60 44 C57 44 54 45 52 46 Z"
          fill="#831843"
        />
        {/* Crown of Villa de Santiesteban de Panzacola */}
        <path
          d="M48 33 L52 38 L60 31 L68 38 L72 33 L71 40 H49 Z"
          fill="#d97706"
          stroke="#78350f"
          strokeWidth="0.8"
        />

        {/* Circular Legend around rim */}
        <text
          x="60"
          y="18"
          textAnchor="middle"
          fill="#831843"
          fontSize="6.2"
          fontWeight="900"
          fontFamily="Cinzel, serif"
          letterSpacing="1.2"
        >
          PÁNUCO · VERACRUZ
        </text>
        <text
          x="60"
          y="110"
          textAnchor="middle"
          fill="#15803d"
          fontSize="5.5"
          fontWeight="800"
          fontFamily="sans-serif"
          letterSpacing="0.8"
        >
          AYUNTAMIENTO
        </text>

        {/* Golden Sun Radiance in upper shield */}
        <circle cx="60" cy="38" r="2.5" fill="#f59e0b" />
      </svg>
    </div>
  );
};
