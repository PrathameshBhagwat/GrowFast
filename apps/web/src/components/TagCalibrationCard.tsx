import React from 'react';

export interface TagCalibrationCardProps {
  className?: string;
  style?: React.CSSProperties;
  isPrintMode?: boolean;
}

/**
 * 40mm × 40mm Physical Tag Calibration Card.
 * Used by operators to test and physically verify:
 * - 40×40 mm physical dimensions (with standard ruler)
 * - Horizontal and vertical feed alignment (center crosshair at 20mm, 20mm)
 * - Safe printable area (35mm × 35mm box with 2.5mm margins)
 * - 100% unscaled printer output (no "Fit to page" or driver distortion)
 * Does NOT modify any Order, Garment, Payment, or Photo state.
 */
export const TagCalibrationCard: React.FC<TagCalibrationCardProps> = ({
  className = '',
  style = {},
  isPrintMode = false,
}) => {
  return (
    <div
      className={`physical-tag-40mm tag-calibration-card relative select-none ${className}`}
      style={{
        width: '40mm',
        height: '40mm',
        minWidth: '40mm',
        minHeight: '40mm',
        maxWidth: '40mm',
        maxHeight: '40mm',
        boxSizing: 'border-box',
        padding: '2mm',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
        color: '#000000',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        lineHeight: 1.1,
        overflow: 'hidden',
        border: '1px solid #000000',
        position: 'relative',
        boxShadow: isPrintMode ? 'none' : '0 1px 3px rgba(0,0,0,0.1)',
        ...style,
      }}
      data-testid="tag-calibration-card"
    >
      {/* ─── Corner Alignment Marks (0mm, 40mm) ─────────────────────── */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-black pointer-events-none" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-black pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-black pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-black pointer-events-none" />

      {/* ─── Center Crosshair (20mm, 20mm center point) ─────────────── */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ zIndex: 0 }}
      >
        <div className="relative w-4 h-4 flex items-center justify-center">
          <div className="absolute w-full h-[0.5px] bg-gray-400" />
          <div className="absolute h-full w-[0.5px] bg-gray-400" />
          <div className="w-1.5 h-1.5 rounded-full border border-gray-500" />
        </div>
      </div>

      {/* ─── Header: Store & Calibration Notice ─────────────────────── */}
      <div className="relative z-10 flex items-center justify-between border-b border-gray-300 pb-0.5">
        <span className="text-[7px] font-black uppercase tracking-tight text-black">
          GROWFAST TEST
        </span>
        <span className="text-[6.5px] font-bold text-gray-700 bg-gray-100 px-1 rounded">
          40×40mm CALIB
        </span>
      </div>

      {/* ─── Middle Section: Target & Measurement Prompt ───────────── */}
      <div className="relative z-10 text-center my-0.5">
        <div className="text-[9px] font-black tracking-wide text-black leading-tight">
          TARGET: 40 × 40 mm
        </div>
        <div className="text-[6.5px] font-semibold text-gray-800 mt-0.5">
          SCALE 100% • NO MARGIN
        </div>
        <div className="text-[7.5px] font-bold font-mono text-blue-900 mt-0.5 border border-dashed border-gray-400 py-0.5 px-1 bg-gray-50 rounded">
          GF-CALIB-001 (1/1)
        </div>
      </div>

      {/* ─── Safe Area Guideline Notice ─────────────────────────────── */}
      <div className="relative z-10 text-center">
        <span className="text-[6px] text-gray-600 block uppercase">
          MEASURE WITH RULER (40.0mm)
        </span>
      </div>

      {/* ─── Footer: Rulers Reference ──────────────────────────────── */}
      <div className="relative z-10 flex items-center justify-between border-t border-gray-300 pt-0.5 text-[6px] font-mono text-gray-700">
        <span>| 0mm</span>
        <span>20mm (CTR)</span>
        <span>40mm |</span>
      </div>
    </div>
  );
};
