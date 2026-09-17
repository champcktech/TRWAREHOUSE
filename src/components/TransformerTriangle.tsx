import React from 'react';
import { Transformer, STATUS_CONFIG } from '../types';

interface TransformerTriangleProps {
  transformer: Transformer;
  onClick?: () => void;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  isHighlighted?: boolean;
  compact?: boolean;
  size?: 'compact' | 'normal' | 'large';
}

export const TransformerTriangle: React.FC<TransformerTriangleProps> = ({
  transformer,
  onClick,
  isDragging,
  onDragStart,
  isHighlighted,
  compact,
  size
}) => {
  const statusConfig = STATUS_CONFIG[transformer.status];
  const effectiveSize: 'compact' | 'normal' | 'large' = size || (compact ? 'compact' : 'normal');

  // Strip 'PEA' prefix if already present in string so we show only the code/number
  const cleanPeaNo = transformer.peaNo ? transformer.peaNo.replace(/^PEA\s*[-_]?\s*/i, '').trim() : '';
  const is3Phase = transformer.phase === '3-Phase';

  // Dimension helpers based on scale
  const svgDimensions =
    effectiveSize === 'compact'
      ? 'w-12 h-10 sm:w-14 sm:h-12'
      : effectiveSize === 'normal'
      ? 'w-16 h-14 sm:w-18 sm:h-15'
      : 'w-22 h-18 sm:w-24 sm:h-20';

  const kvaNumSize =
    effectiveSize === 'compact'
      ? 'text-[11px] sm:text-xs'
      : effectiveSize === 'normal'
      ? 'text-xs sm:text-sm'
      : 'text-sm sm:text-base';

  const kvaUnitSize =
    effectiveSize === 'compact'
      ? 'text-[7.5px] sm:text-[8px]'
      : effectiveSize === 'normal'
      ? 'text-[8.5px] sm:text-[9px]'
      : 'text-[10px] sm:text-[11px]';

  const phaseBadgeStyle =
    effectiveSize === 'compact'
      ? 'text-[7px] sm:text-[7.5px] px-1 py-0.2 rounded'
      : effectiveSize === 'normal'
      ? 'text-[8px] sm:text-[8.5px] px-1.5 py-0.5 rounded'
      : 'text-[9.5px] sm:text-[10px] px-2 py-0.5 rounded';

  const peaBadgeStyle =
    effectiveSize === 'compact'
      ? 'px-1.5 py-0.5 text-[9px] sm:text-[9.5px] max-w-[68px] sm:max-w-[76px]'
      : effectiveSize === 'normal'
      ? 'px-2 py-0.5 text-[10px] sm:text-[11px] max-w-[82px] sm:max-w-[94px]'
      : 'px-2.5 py-1 text-xs max-w-[100px] sm:max-w-[115px]';

  const phaseLabel =
    effectiveSize === 'compact'
      ? (is3Phase ? '3P' : '1P')
      : (is3Phase ? '3-Phase' : '1-Phase');

  return (
    <div
      id={`transformer-${transformer.id}`}
      draggable
      onDragStart={onDragStart}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`relative group cursor-grab active:cursor-grabbing select-none transition-all duration-200 transform flex flex-col items-center ${
        isDragging ? 'opacity-40 scale-95' : 'hover:scale-105'
      } ${
        isHighlighted
          ? 'ring-2 ring-orange-400 ring-offset-2 ring-offset-[#0a0a0a] animate-pulse scale-105 z-20'
          : ''
      }`}
      title={`${transformer.peaNo} | ขนาด ${transformer.capacityKva} kVA | ระบบ ${transformer.phase} (${statusConfig.label})`}
    >
      {/* Visual Triangle Shape Container */}
      <div className="relative flex flex-col items-center justify-center">
        {/* SVG Triangle with high-contrast electrical style & drop shadow */}
        <svg
          viewBox="-4 -4 108 96"
          className={`${svgDimensions} drop-shadow-md transition-transform`}
        >
          <defs>
            <linearGradient id={`grad-${transformer.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={statusConfig.hexColor} />
              <stop offset="100%" stopColor={statusConfig.darkHex} />
            </linearGradient>
            <filter id={`shadow-${transformer.id}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.6" />
            </filter>
          </defs>

          {/* Equilateral Triangle with thick crisp white border */}
          <polygon
            points="50,4 96,82 4,82"
            fill={`url(#grad-${transformer.id})`}
            stroke="#ffffff"
            strokeWidth="3.5"
            strokeLinejoin="round"
            filter={`url(#shadow-${transformer.id})`}
          />

          {/* Inner contrast plate to ensure text legibility */}
          <polygon
            points="50,16 88,78 12,78"
            fill="rgba(0, 0, 0, 0.28)"
            stroke="rgba(255, 255, 255, 0.25)"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>

        {/* Overlay: ขนาดหม้อแปลง (Capacity kVA) + ระบบเฟส (Phase) inside Triangle */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-[20%] pointer-events-none">
          {/* 1. ขนาดหม้อแปลง (kVA) */}
          <div className="flex items-baseline justify-center leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            <span className={`${kvaNumSize} font-black text-white tracking-tight`}>
              {transformer.capacityKva}
            </span>
            <span className={`${kvaUnitSize} font-bold text-amber-300 ml-0.5 tracking-tight`}>
              kVA
            </span>
          </div>

          {/* 2. ระบบเฟส (Phase: 3-Phase หรือ 1-Phase) */}
          <div className="mt-0.5 leading-none">
            <span
              className={`font-mono font-extrabold leading-none tracking-tight shadow-xs ${phaseBadgeStyle} ${
                is3Phase
                  ? 'bg-blue-950/90 text-blue-200 border border-blue-400/60'
                  : 'bg-purple-950/90 text-purple-200 border border-purple-400/60'
              }`}
            >
              {phaseLabel}
            </span>
          </div>
        </div>
      </div>

      {/* 3. PEA Code Badge directly below Triangle (without 'PEA' prefix) */}
      <div className="mt-1 flex items-center justify-center w-full">
        <div
          className={`flex items-center justify-center rounded font-mono font-bold shadow-xs border text-center truncate ${peaBadgeStyle} ${
            transformer.status === 'good'
              ? 'bg-[#0e1711] border-emerald-600/70 text-emerald-200'
              : transformer.status === 'minor_repair'
              ? 'bg-[#181508] border-yellow-600/70 text-yellow-200'
              : transformer.status === 'major_repair'
              ? 'bg-[#180f08] border-orange-600/70 text-orange-200'
              : 'bg-[#180b0b] border-rose-600/70 text-rose-200'
          }`}
        >
          <span className="text-white font-mono tracking-tight truncate">
            {cleanPeaNo}
          </span>
        </div>
      </div>

      {/* Floating Status Indicator Pin */}
      <div
        className={`absolute -top-1 -right-1 rounded-full border-2 border-[#0a0a0a] shadow-sm flex items-center justify-center text-[7px] font-bold text-white ${
          effectiveSize === 'compact' ? 'w-2.5 h-2.5' : 'w-3 h-3'
        }`}
        style={{ backgroundColor: statusConfig.hexColor }}
        title={`สถานะ: ${statusConfig.label}`}
      />
    </div>
  );
};
