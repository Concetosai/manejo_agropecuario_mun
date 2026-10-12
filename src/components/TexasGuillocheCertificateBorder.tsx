import React from 'react';

/**
 * Texas / Mexican Birth Certificate Banknote Guilloché Border
 * Inspired by official banknote security papers, Texas Livestock Brand Certificates,
 * and Mexican Civil Registry Birth Certificates.
 *
 * Features:
 * - 4 Ornate 3-layer corner medallions in deep wine/burgundy and imperial banknote green.
 * - Sinusoidal interlocking guilloché ribbons along all 4 edges.
 * - Inner gold framing rules and dentil accents.
 * - Paper background with subtle guilloché watermark waves.
 */
export const TexasGuillocheCertificateBorder: React.FC<{
  className?: string;
  children: React.ReactNode;
}> = ({ className = '', children }) => {
  return (
    <div className={`relative bg-[#faf7ef] overflow-hidden ${className}`}>
      {/* SVG Vector Guilloché Security Frame */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        viewBox="0 0 800 1040"
      >
        <defs>
          {/* Subtle paper guilloché watermark pattern */}
          <pattern id="certWatermark" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 0 20 Q 10 5, 20 20 T 40 20 M 0 40 Q 10 25, 20 40 T 40 40"
              fill="none"
              stroke="#831843"
              strokeWidth="0.35"
              strokeOpacity="0.04"
            />
          </pattern>

          {/* Guilloché Top/Bottom Horizontal Ribbon Pattern */}
          <pattern id="guillocheRibbonH" width="24" height="28" patternUnits="userSpaceOnUse">
            {/* Emerald ribbons */}
            <path
              d="M 0 14 Q 6 2, 12 14 T 24 14"
              fill="none"
              stroke="#15803d"
              strokeWidth="1.2"
              strokeOpacity="0.85"
            />
            <path
              d="M 0 14 Q 6 26, 12 14 T 24 14"
              fill="none"
              stroke="#166534"
              strokeWidth="1.1"
              strokeOpacity="0.75"
            />
            {/* Burgundy ribbons interlacing */}
            <path
              d="M 0 8 Q 6 22, 12 8 T 24 8"
              fill="none"
              stroke="#7c1a29"
              strokeWidth="1.2"
              strokeOpacity="0.85"
            />
            <path
              d="M 0 20 Q 6 6, 12 20 T 24 20"
              fill="none"
              stroke="#881337"
              strokeWidth="1.1"
              strokeOpacity="0.75"
            />
            {/* Gold center hairline */}
            <line x1="0" y1="14" x2="24" y2="14" stroke="#d97706" strokeWidth="0.6" strokeOpacity="0.6" />
          </pattern>

          {/* Guilloché Left/Right Vertical Ribbon Pattern */}
          <pattern id="guillocheRibbonV" width="28" height="24" patternUnits="userSpaceOnUse">
            {/* Emerald ribbons */}
            <path
              d="M 14 0 Q 2 6, 14 12 T 14 24"
              fill="none"
              stroke="#15803d"
              strokeWidth="1.2"
              strokeOpacity="0.85"
            />
            <path
              d="M 14 0 Q 26 6, 14 12 T 14 24"
              fill="none"
              stroke="#166534"
              strokeWidth="1.1"
              strokeOpacity="0.75"
            />
            {/* Burgundy ribbons interlacing */}
            <path
              d="M 8 0 Q 22 6, 8 12 T 8 24"
              fill="none"
              stroke="#7c1a29"
              strokeWidth="1.2"
              strokeOpacity="0.85"
            />
            <path
              d="M 20 0 Q 6 6, 20 12 T 20 24"
              fill="none"
              stroke="#881337"
              strokeWidth="1.1"
              strokeOpacity="0.75"
            />
            {/* Gold center hairline */}
            <line x1="14" y1="0" x2="14" y2="24" stroke="#d97706" strokeWidth="0.6" strokeOpacity="0.6" />
          </pattern>

          {/* 4 Corner Medallion Symbol */}
          <g id="cornerMedallion">
            {/* Outer wine filigree starburst */}
            <circle cx="40" cy="40" r="32" fill="#faf7ef" stroke="#6d1624" strokeWidth="2.5" />
            <circle cx="40" cy="40" r="29" fill="none" stroke="#d97706" strokeWidth="1" />
            <circle cx="40" cy="40" r="26" fill="#fdfbf7" stroke="#7c1a29" strokeWidth="1" />
            
            {/* 16 Radial Rosette Petals */}
            {[0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5].map((angle, i) => (
              <path
                key={i}
                d="M 40 40 L 40 16 Q 43 14, 46 16 Z"
                fill="#7c1a29"
                transform={`rotate(${angle} 40 40)`}
                opacity="0.85"
              />
            ))}

            {/* Inner Emerald Rosette */}
            <circle cx="40" cy="40" r="17" fill="#14532d" stroke="#d97706" strokeWidth="1.2" />
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => (
              <line
                key={i}
                x1="40"
                y1="25"
                x2="40"
                y2="55"
                stroke="#4ade80"
                strokeWidth="0.7"
                strokeOpacity="0.6"
                transform={`rotate(${angle} 40 40)`}
              />
            ))}
            <circle cx="40" cy="40" r="8" fill="#faf7ef" stroke="#d97706" strokeWidth="1" />
            <circle cx="40" cy="40" r="4" fill="#6d1624" />
          </g>
        </defs>

        {/* Paper Background Watermark */}
        <rect x="0" y="0" width="800" height="1040" fill="url(#certWatermark)" />

        {/* Outer Bleed Margin Hairline */}
        <rect x="10" y="10" width="780" height="1020" fill="none" stroke="#d97706" strokeWidth="0.75" />

        {/* Primary Guilloché Outer Wine Border Line */}
        <rect x="14" y="14" width="772" height="1012" fill="none" stroke="#6d1624" strokeWidth="2.5" />

        {/* Horizontal Top Ribbon Band */}
        <rect x="70" y="16" width="660" height="28" fill="url(#guillocheRibbonH)" />

        {/* Horizontal Bottom Ribbon Band */}
        <rect x="70" y="996" width="660" height="28" fill="url(#guillocheRibbonH)" />

        {/* Vertical Left Ribbon Band */}
        <rect x="16" y="70" width="28" height="900" fill="url(#guillocheRibbonV)" />

        {/* Vertical Right Ribbon Band */}
        <rect x="756" y="70" width="28" height="900" fill="url(#guillocheRibbonV)" />

        {/* Inner Gold Pinstripe */}
        <rect x="44" y="44" width="712" height="952" fill="none" stroke="#d97706" strokeWidth="1.2" />

        {/* Inner Secondary Wine Hairline */}
        <rect x="47" y="47" width="706" height="946" fill="none" stroke="#6d1624" strokeWidth="0.8" />

        {/* Fine Inner Green Hairline */}
        <rect x="50" y="50" width="700" height="940" fill="none" stroke="#15803d" strokeWidth="0.5" />

        {/* 4 Corner Medallions */}
        {/* Top-Left */}
        <use href="#cornerMedallion" x="0" y="0" />
        {/* Top-Right */}
        <use href="#cornerMedallion" x="720" y="0" />
        {/* Bottom-Left */}
        <use href="#cornerMedallion" x="0" y="960" />
        {/* Bottom-Right */}
        <use href="#cornerMedallion" x="720" y="960" />
      </svg>

      {/* Actual Certificate Document Content wrapped within safe margins */}
      <div className="relative z-10 p-7 sm:p-10 md:p-12 print:p-7">
        {children}
      </div>
    </div>
  );
};
