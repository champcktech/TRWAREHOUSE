import React, { useState } from 'react';
import {
  WarehouseConfig,
  Transformer,
  WarehouseZoneId,
  TransformerLocationType
} from '../types';
import { TransformerTriangle } from './TransformerTriangle';
import {
  ZoomIn,
  ZoomOut,
  Sliders,
  Plus,
  Minus,
  Columns3,
  Rows3,
  ArrowDownUp
} from 'lucide-react';

interface WarehouseGridProps {
  config: WarehouseConfig;
  transformers: Transformer[];
  highlightedId?: string | null;
  onSelectTransformer: (transformer: Transformer) => void;
  onMoveTransformer: (
    transformerId: string,
    targetSlot: number | null,
    targetZone?: WarehouseZoneId,
    targetLocationType?: TransformerLocationType
  ) => void;
  onUpdateConfig?: (newConfig: WarehouseConfig) => void;
  onOpenConfigModal?: () => void;
}

type GridScale = 'compact' | 'normal' | 'large';

const SCALE_CONFIGS = {
  compact: {
    cellMinHeight: 'min-h-[92px]',
    cellPadding: 'p-1',
    gap: 'gap-1.5',
    bgNumSize: 'text-2xl',
    headerBadge: 'text-[9px] px-1 py-0.2',
    iconSize: 'compact' as const,
    minColWidth: 'min-w-[62px]'
  },
  normal: {
    cellMinHeight: 'min-h-[114px]',
    cellPadding: 'p-1.5',
    gap: 'gap-2',
    bgNumSize: 'text-3xl',
    headerBadge: 'text-[10px] px-1.5 py-0.5',
    iconSize: 'normal' as const,
    minColWidth: 'min-w-[74px]'
  },
  large: {
    cellMinHeight: 'min-h-[138px]',
    cellPadding: 'p-2',
    gap: 'gap-2.5',
    bgNumSize: 'text-4xl',
    headerBadge: 'text-xs px-2 py-0.5',
    iconSize: 'large' as const,
    minColWidth: 'min-w-[90px]'
  },
};

export const WarehouseGrid: React.FC<WarehouseGridProps> = ({
  config,
  transformers,
  highlightedId,
  onSelectTransformer,
  onMoveTransformer,
  onUpdateConfig,
  onOpenConfigModal
}) => {
  const [gridScale, setGridScale] = useState<GridScale>('normal');
  const [draggedTransformerId, setDraggedTransformerId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const scaleConfig = SCALE_CONFIGS[gridScale];

  // Grid specifications
  const gridName = config.name || config.leftGrid?.name || 'จุดวางหม้อแปลง';
  const gridCols = config.columns || config.leftGrid?.columns || 4;
  const gridRows = config.rows || config.leftGrid?.rows || 14;
  const gridTotal = gridCols * gridRows;
  const gridPrefix = config.zonePrefix || config.leftGrid?.zonePrefix || 'A';

  // Map for fast lookup
  const slotMap = new Map<number, Transformer>();

  transformers.forEach((t) => {
    if (t.slotNumber !== null && t.slotNumber !== undefined) {
      if (t.locationType === 'grid' || (!t.locationType && t.slotNumber !== null)) {
        slotMap.set(t.slotNumber, t);
      }
    }
  });

  // Drag & drop handlers
  const handleDragStart = (e: React.DragEvent, transformerId: string) => {
    e.dataTransfer.setData('text/plain', transformerId);
    setDraggedTransformerId(transformerId);
  };

  const handleDragOver = (e: React.DragEvent, slotNumber: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const key = `slot-${slotNumber}`;
    if (dragOverKey !== key) {
      setDragOverKey(key);
    }
  };

  const handleDragLeave = (slotNumber: number) => {
    const key = `slot-${slotNumber}`;
    if (dragOverKey === key) {
      setDragOverKey(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetSlot: number) => {
    e.preventDefault();
    const transformerId = e.dataTransfer.getData('text/plain') || draggedTransformerId;
    if (transformerId) {
      onMoveTransformer(transformerId, targetSlot, 'left', 'grid');
    }
    setDraggedTransformerId(null);
    setDragOverKey(null);
  };

  // Adjust Columns handler (min 1, max 15)
  const handleAdjustColumns = (delta: number) => {
    if (!onUpdateConfig) return;
    const newCols = Math.max(1, Math.min(15, gridCols + delta));
    if (newCols === gridCols) return;

    onUpdateConfig({
      ...config,
      columns: newCols,
      leftGrid: {
        ...(config.leftGrid || { name: gridName, rows: gridRows, zonePrefix: gridPrefix, columns: gridCols }),
        columns: newCols
      }
    });
  };

  // Adjust Rows handler (min 1, max 50)
  const handleAdjustRows = (delta: number) => {
    if (!onUpdateConfig) return;
    const newRows = Math.max(1, Math.min(50, gridRows + delta));
    if (newRows === gridRows) return;

    onUpdateConfig({
      ...config,
      rows: newRows,
      leftGrid: {
        ...(config.leftGrid || { name: gridName, columns: gridCols, zonePrefix: gridPrefix, rows: gridRows }),
        rows: newRows
      }
    });
  };

  const occupiedCount = slotMap.size;
  const vacantCount = gridTotal - occupiedCount;
  const slots = Array.from({ length: gridTotal }, (_, i) => i + 1);

  return (
    <div className="bg-[#eff2ee] rounded-2xl shadow-2xs border border-[#cad4ce] p-3 sm:p-5 overflow-hidden flex flex-col">
      {/* Top Global Control Bar */}
      <div className="w-full flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 mb-4 border-b border-[#ced8d2] text-sm">
        {/* Left: Warehouse Name & Summary */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#6850a1] animate-pulse shrink-0" />
          <span className="font-bold text-[#222e2a] tracking-tight text-base">
            {config.warehouseName}
          </span>
          <span className="text-xs bg-[#e1e7e3] text-[#45544d] border border-[#c4d0c9] px-2.5 py-0.5 rounded-lg font-mono">
            ผังคลัง (โซน {gridPrefix} : {gridTotal} ช่อง | {gridCols} คอลัมน์ × {gridRows} แถว)
          </span>
        </div>

        {/* Right: Scale Switcher & Actions */}
        <div className="flex flex-wrap items-center gap-2 self-end lg:self-auto">
          {/* Zoom / Scale selector */}
          <div className="flex items-center gap-1 bg-[#e1e7e3] border border-[#c4d0c9] rounded-xl p-0.5">
            <button
              type="button"
              onClick={() => {
                if (gridScale === 'large') setGridScale('normal');
                else if (gridScale === 'normal') setGridScale('compact');
              }}
              disabled={gridScale === 'compact'}
              title="ย่อสเกลผัง"
              className="p-1 rounded-lg text-[#4d5c55] hover:text-[#1f2b27] disabled:opacity-30 transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-0.5 px-0.5">
              {(['compact', 'normal', 'large'] as const).map((scale) => (
                <button
                  key={scale}
                  type="button"
                  onClick={() => setGridScale(scale)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all ${
                    gridScale === scale
                      ? 'bg-[#6850a1] text-[#f5f4ef] shadow-2xs'
                      : 'text-[#45544d] hover:text-[#1f2b27] hover:bg-[#d5ded9]'
                  }`}
                >
                  {scale === 'compact' ? 'ย่อเล็ก' : scale === 'normal' ? 'ปกติ' : 'ขยาย'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                if (gridScale === 'compact') setGridScale('normal');
                else if (gridScale === 'normal') setGridScale('large');
              }}
              disabled={gridScale === 'large'}
              title="ขยายสเกลผัง"
              className="p-1 rounded-lg text-[#4d5c55] hover:text-[#1f2b27] disabled:opacity-30 transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {onOpenConfigModal && (
            <button
              type="button"
              onClick={onOpenConfigModal}
              title="ตั้งค่าผังคลังเพิ่มเติม"
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-[#e6ebe8] border border-[#c2cdc7] hover:border-[#9e8cc9] hover:text-[#4c377a] text-[#3a4742] rounded-xl transition-colors shadow-2xs"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>ตั้งค่าผัง</span>
            </button>
          )}

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#54635c] ml-1">
            <ArrowDownUp className="w-3 h-3 text-[#6850a1]" />
            <span className="text-[11px]">ลากสลับช่องได้อิสระ</span>
          </div>
        </div>
      </div>

      {/* Main Single Grid Layout */}
      <div className="flex-1 bg-[#e7ece9] rounded-xl border border-[#cbd5cf] p-3 sm:p-4 flex flex-col shadow-2xs">
        {/* Header and Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[#d0dad4]">
          {/* Grid Title & Badge */}
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#4994b8] animate-pulse" />
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-sm font-bold text-[#222e2a] tracking-tight">
                  {gridName}
                </h4>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md font-bold bg-[#dbeaf0] text-[#22556e] border border-[#b4d2e0]">
                  โซน {gridPrefix}
                </span>
              </div>
              <div className="text-[11px] text-[#4e5d56] flex flex-wrap items-center gap-2 mt-0.5">
                <span>{gridCols} คอลัมน์ × {gridRows} แถว ({gridTotal} ช่อง)</span>
                <span>•</span>
                <span className="text-[#235c43] font-semibold">มีหม้อแปลง {occupiedCount}</span>
                <span>•</span>
                <span className="text-[#5d6e66]">ว่าง {vacantCount}</span>
              </div>
            </div>
          </div>

          {/* Quick Increment/Decrement */}
          {onUpdateConfig && (
            <div className="flex flex-wrap items-center gap-2 bg-[#dce3df] border border-[#c3cfc8] rounded-xl px-2.5 py-1">
              {/* Columns Adjuster */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-[#45544d] font-medium flex items-center gap-0.5">
                  <Columns3 className="w-3 h-3 text-[#6850a1]" />
                  <span className="hidden sm:inline">คอลัมน์:</span>
                </span>
                <div className="flex items-center border border-[#c2cdc7] rounded-lg bg-[#f3f2ec] overflow-hidden shadow-2xs">
                  <button
                    type="button"
                    onClick={() => handleAdjustColumns(-1)}
                    disabled={gridCols <= 1}
                    title={gridCols <= 1 ? 'คอลัมน์ต่ำสุดแล้ว (1 คอลัมน์)' : 'ลด 1 คอลัมน์ (ต่ำสุด 1)'}
                    className="w-5 h-5 flex items-center justify-center text-[#45544d] hover:text-[#1f2b27] hover:bg-[#e1e7e3] disabled:opacity-25 transition-colors"
                  >
                    <Minus className="w-2.5 h-2.5" />
                  </button>
                  <span
                    className="px-1.5 text-xs font-bold text-[#523b85] font-mono min-w-[18px] text-center select-none"
                    title={`จำนวนคอลัมน์ปัจจุบัน: ${gridCols} (ต่ำสุด 1, สูงสุด 15)`}
                  >
                    {gridCols}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAdjustColumns(1)}
                    disabled={gridCols >= 15}
                    title="เพิ่ม 1 คอลัมน์"
                    className="w-5 h-5 flex items-center justify-center text-[#45544d] hover:text-[#1f2b27] hover:bg-[#e1e7e3] disabled:opacity-25 transition-colors"
                  >
                    <Plus className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>

              <div className="w-[1px] h-3.5 bg-[#bdcac2]" />

              {/* Rows Adjuster */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-[#45544d] font-medium flex items-center gap-0.5">
                  <Rows3 className="w-3 h-3 text-[#6850a1]" />
                  <span className="hidden sm:inline">แถว:</span>
                </span>
                <div className="flex items-center border border-[#c2cdc7] rounded-lg bg-[#f3f2ec] overflow-hidden shadow-2xs">
                  <button
                    type="button"
                    onClick={() => handleAdjustRows(-1)}
                    disabled={gridRows <= 1}
                    title={gridRows <= 1 ? 'แถวต่ำสุดแล้ว (1 แถว)' : 'ลด 1 แถว (ต่ำสุด 1)'}
                    className="w-5 h-5 flex items-center justify-center text-[#45544d] hover:text-[#1f2b27] hover:bg-[#e1e7e3] disabled:opacity-25 transition-colors"
                  >
                    <Minus className="w-2.5 h-2.5" />
                  </button>
                  <span
                    className="px-1.5 text-xs font-bold text-[#523b85] font-mono min-w-[18px] text-center select-none"
                    title={`จำนวนแถวปัจจุบัน: ${gridRows} (ต่ำสุด 1, สูงสุด 50)`}
                  >
                    {gridRows}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAdjustRows(1)}
                    disabled={gridRows >= 50}
                    title="เพิ่ม 1 แถว"
                    className="w-5 h-5 flex items-center justify-center text-[#45544d] hover:text-[#1f2b27] hover:bg-[#e1e7e3] disabled:opacity-25 transition-colors"
                  >
                    <Plus className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Matrix Grid of Slots */}
        <div className="overflow-x-auto pb-2 flex justify-start sm:justify-center">
          <div
            className={`grid ${scaleConfig.gap} p-2.5 bg-[#dce3df] rounded-xl border border-[#c3cfc8] shadow-inner min-w-max`}
            style={{
              gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`
            }}
          >
            {slots.map((slotNum) => {
              const transformer = slotMap.get(slotNum);
              const key = `slot-${slotNum}`;
              const isDragTarget = dragOverKey === key;
              const isHighlighted = transformer && transformer.id === highlightedId;

              return (
                <div
                  key={key}
                  id={`slot-cell-left-${slotNum}`}
                  data-slot={slotNum}
                  onDragOver={(e) => handleDragOver(e, slotNum)}
                  onDragLeave={() => handleDragLeave(slotNum)}
                  onDrop={(e) => handleDrop(e, slotNum)}
                  onClick={() => {
                    if (transformer) {
                      onSelectTransformer(transformer);
                    }
                  }}
                  className={`relative ${scaleConfig.cellMinHeight} ${scaleConfig.minColWidth} ${scaleConfig.cellPadding} rounded-xl border transition-all duration-150 flex flex-col items-center justify-between select-none ${
                    isDragTarget
                      ? 'border-2 border-[#6850a1] bg-[#e5ddf5] shadow-md ring-2 ring-[#cbbce8]'
                      : transformer
                      ? 'bg-[#f4f3ee] border-[#c8d2cc] shadow-2xs hover:border-[#9e8cc9] hover:shadow-xs cursor-pointer'
                      : 'bg-[#e7ece9]/80 border-dashed border-[#bdcac2] hover:border-[#a3b3aa]'
                  } ${isHighlighted ? 'ring-2 ring-[#6850a1] ring-offset-2 ring-offset-[#dce3df]' : ''}`}
                >
                  {/* Background Slot Number */}
                  <div
                    className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity ${
                      transformer ? 'opacity-10' : 'opacity-20'
                    }`}
                  >
                    <span className={`${scaleConfig.bgNumSize} font-mono font-black tracking-tight text-[#5a6b63] select-none`}>
                      {String(slotNum).padStart(2, '0')}
                    </span>
                  </div>

                  {/* Top Slot Header Badge */}
                  <div className="w-full flex items-center justify-between z-10">
                    <span className={`font-mono font-bold text-[#495851] uppercase tracking-wider bg-[#dde4e0] border border-[#c3cfc8] rounded-md ${scaleConfig.headerBadge}`}>
                      {gridPrefix} {slotNum}
                    </span>
                  </div>

                  {/* Cell Center: Transformer Icon or Empty Slot Hint */}
                  <div className="my-auto z-10 flex flex-col items-center justify-center w-full py-0.5">
                    {transformer ? (
                      <TransformerTriangle
                        transformer={transformer}
                        size={scaleConfig.iconSize}
                        onDragStart={(e) => handleDragStart(e, transformer.id)}
                        onClick={() => onSelectTransformer(transformer)}
                        isHighlighted={isHighlighted}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-2 opacity-55 pointer-events-none">
                        <span className="text-[10px] text-[#5e6e67] font-medium">
                          ว่าง
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
