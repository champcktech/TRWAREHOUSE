import React, { useState } from 'react';
import { Transformer, TransformerLocationType, WarehouseZoneId } from '../types';
import { TransformerTriangle } from './TransformerTriangle';
import { Package, Plus, Sparkles, ClipboardCheck, Truck, Tag } from 'lucide-react';

interface HoldingAreaProps {
  triageTransformers?: Transformer[];
  unassignedTransformers: Transformer[];
  repairTransformers?: Transformer[];
  saleTransformers?: Transformer[];
  highlightedId?: string | null;
  onSelectTransformer: (transformer: Transformer) => void;
  onMoveTransformer: (
    transformerId: string,
    targetSlot: number | null,
    targetZone?: WarehouseZoneId,
    targetLocationType?: TransformerLocationType
  ) => void;
  onAddNew: () => void;
}

export const HoldingArea: React.FC<HoldingAreaProps> = ({
  triageTransformers = [],
  unassignedTransformers = [],
  repairTransformers = [],
  saleTransformers = [],
  highlightedId,
  onSelectTransformer,
  onMoveTransformer,
  onAddNew
}) => {
  const [dragOverZone, setDragOverZone] = useState<'holding' | 'triage' | 'repair' | 'sale' | null>(null);

  const handleDragStart = (e: React.DragEvent, transformerId: string) => {
    e.dataTransfer.setData('text/plain', transformerId);
  };

  const handleDragOver = (e: React.DragEvent, zone: 'holding' | 'triage' | 'repair' | 'sale') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverZone !== zone) {
      setDragOverZone(zone);
    }
  };

  const handleDragLeave = (zone: 'holding' | 'triage' | 'repair' | 'sale') => {
    if (dragOverZone === zone) {
      setDragOverZone(null);
    }
  };

  const handleDrop = (e: React.DragEvent, zone: 'holding' | 'triage' | 'repair' | 'sale') => {
    e.preventDefault();
    const transformerId = e.dataTransfer.getData('text/plain');
    if (transformerId) {
      onMoveTransformer(transformerId, null, undefined, zone);
    }
    setDragOverZone(null);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
      {/* 1. จุดรอคัดแยก (Triage Area) */}
      <div
        id="triage-area-zone"
        onDragOver={(e) => handleDragOver(e, 'triage')}
        onDragLeave={() => handleDragLeave('triage')}
        onDrop={(e) => handleDrop(e, 'triage')}
        className={`bg-[#0a0a0a] rounded-xl shadow-md border p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 ${
          dragOverZone === 'triage'
            ? 'border-2 border-indigo-500 bg-indigo-950/20 shadow-lg ring-1 ring-indigo-500'
            : 'border-[#262626]'
        }`}
      >
        <div>
          {/* Header */}
          <div className="flex items-start justify-between gap-2 pb-3 mb-3 border-b border-[#1c1c1c]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-lg bg-indigo-950/60 border border-indigo-700/50 text-indigo-400 shrink-0">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-sm font-bold text-white tracking-tight truncate">
                    จุดรอคัดแยก
                  </h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-indigo-950/60 border border-indigo-800/60 text-indigo-300 shrink-0">
                    รอตรวจสอบสภาพ
                  </span>
                </div>
                <p className="text-[11px] text-[#777] mt-0.5 line-clamp-1">
                  หม้อแปลงถอดรื้อ/รับเข้า รอตรวจสอบก่อนจัดเก็บ
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-mono font-semibold px-2 py-1 rounded bg-[#161616] border border-[#2a2a2a] text-[#aaa]">
                {triageTransformers.length} เครื่อง
              </span>
            </div>
          </div>

          {/* List Area */}
          {triageTransformers.length === 0 ? (
            <div className="min-h-[140px] flex flex-col items-center justify-center text-center border border-dashed border-[#222] rounded-lg bg-[#070707] p-4">
              <Sparkles className="w-6 h-6 text-indigo-500/50 mb-1.5" />
              <p className="text-xs text-[#777] font-medium">
                ไม่มีหม้อแปลงในจุดรอคัดแยก
              </p>
              <p className="text-[11px] text-[#555] mt-0.5 max-w-[280px]">
                ลากหม้อแปลงจากผังคลังมาวางที่นี่ หรือกดเลือกจุดรอคัดแยก
              </p>
            </div>
          ) : (
            <div className="min-h-[140px] p-2.5 rounded-lg border border-[#1e1e1e] bg-[#070707] flex flex-wrap gap-3 items-center content-start">
              {triageTransformers.map((t) => (
                <div
                  key={t.id}
                  className="p-1.5 rounded-lg border border-[#262626] bg-[#0d0d0d] hover:bg-[#141414] hover:border-indigo-500/50 transition-all shadow-xs"
                >
                  <TransformerTriangle
                    transformer={t}
                    size="compact"
                    onDragStart={(e) => handleDragStart(e, t.id)}
                    onClick={() => onSelectTransformer(t)}
                    isHighlighted={t.id === highlightedId}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. จุดพักรอจัดเก็บ (Holding Area) */}
      <div
        id="holding-area-zone"
        onDragOver={(e) => handleDragOver(e, 'holding')}
        onDragLeave={() => handleDragLeave('holding')}
        onDrop={(e) => handleDrop(e, 'holding')}
        className={`bg-[#0a0a0a] rounded-xl shadow-md border p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 ${
          dragOverZone === 'holding'
            ? 'border-2 border-orange-500 bg-orange-950/20 shadow-lg ring-1 ring-orange-500'
            : 'border-[#262626]'
        }`}
      >
        <div>
          {/* Header */}
          <div className="flex items-start justify-between gap-2 pb-3 mb-3 border-b border-[#1c1c1c]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-lg bg-orange-950/60 border border-orange-700/50 text-orange-400 shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-sm font-bold text-white tracking-tight truncate">
                    จุดพักรอจัดเก็บ
                  </h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-[#1a1a1a] border border-[#333] text-[#aaa] shrink-0">
                    พร้อมจัดเก็บเข้าช่อง
                  </span>
                </div>
                <p className="text-[11px] text-[#777] mt-0.5 line-clamp-1">
                  พักรอจัดวาง สามารถลากลงผังคลังซ้าย/ขวาได้ทันที
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-mono font-semibold px-2 py-1 rounded bg-[#161616] border border-[#2a2a2a] text-[#aaa]">
                {unassignedTransformers.length} เครื่อง
              </span>
              <button
                type="button"
                onClick={onAddNew}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors shadow-xs whitespace-nowrap"
                title="เพิ่มหม้อแปลงใหม่ลงในจุดพักรอจัดเก็บ"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ เพิ่มหม้อแปลงใหม่</span>
              </button>
            </div>
          </div>

          {/* List Area */}
          {unassignedTransformers.length === 0 ? (
            <div className="min-h-[140px] flex flex-col items-center justify-center text-center border border-dashed border-[#222] rounded-lg bg-[#070707] p-4">
              <p className="text-xs text-[#777] font-medium">
                ไม่มีหม้อแปลงรอจัดเก็บ
              </p>
              <p className="text-[11px] text-[#555] mt-0.5 max-w-[280px]">
                หม้อแปลงทั้งหมดถูกจัดวางลงในช่องผังคลังเรียบร้อยแล้ว หรือลากมาพักที่นี่
              </p>
            </div>
          ) : (
            <div className="min-h-[140px] p-2.5 rounded-lg border border-[#1e1e1e] bg-[#070707] flex flex-wrap gap-3 items-center content-start">
              {unassignedTransformers.map((t) => (
                <div
                  key={t.id}
                  className="p-1.5 rounded-lg border border-[#262626] bg-[#0d0d0d] hover:bg-[#141414] hover:border-orange-500/50 transition-all shadow-xs"
                >
                  <TransformerTriangle
                    transformer={t}
                    size="compact"
                    onDragStart={(e) => handleDragStart(e, t.id)}
                    onClick={() => onSelectTransformer(t)}
                    isHighlighted={t.id === highlightedId}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. ส่งซ่อมภายนอก (Out for Repair) */}
      <div
        id="repair-area-zone"
        onDragOver={(e) => handleDragOver(e, 'repair')}
        onDragLeave={() => handleDragLeave('repair')}
        onDrop={(e) => handleDrop(e, 'repair')}
        className={`bg-[#0a0a0a] rounded-xl shadow-md border p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 ${
          dragOverZone === 'repair'
            ? 'border-2 border-sky-500 bg-sky-950/20 shadow-lg ring-1 ring-sky-500'
            : 'border-[#262626]'
        }`}
      >
        <div>
          {/* Header */}
          <div className="flex items-start justify-between gap-2 pb-3 mb-3 border-b border-[#1c1c1c]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-lg bg-sky-950/60 border border-sky-700/50 text-sky-400 shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-sm font-bold text-white tracking-tight truncate">
                    ส่งซ่อมภายนอก
                  </h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-sky-950/60 border border-sky-800/60 text-sky-300 shrink-0">
                    โรงงาน / ซ่อมใหญ่
                  </span>
                </div>
                <p className="text-[11px] text-[#777] mt-0.5 line-clamp-1">
                  อยู่นอกคลัง คืนช่องว่างในผังอัตโนมัติ
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-mono font-semibold px-2 py-1 rounded bg-sky-950/30 border border-sky-800/40 text-sky-300">
                {repairTransformers.length} เครื่อง
              </span>
            </div>
          </div>

          {/* List Area */}
          {repairTransformers.length === 0 ? (
            <div className="min-h-[140px] flex flex-col items-center justify-center text-center border border-dashed border-[#222] rounded-lg bg-[#070707] p-4">
              <Truck className="w-6 h-6 text-sky-500/50 mb-1.5" />
              <p className="text-xs text-[#777] font-medium">
                ไม่มีหม้อแปลงที่ส่งซ่อมภายนอก
              </p>
              <p className="text-[11px] text-[#555] mt-0.5 max-w-[280px]">
                ลากหม้อแปลงที่ส่งซ่อมมาวางที่นี่เพื่อคืนช่องในผัง หรือกดเลือก &quot;ส่งซ่อม&quot; ในหน้ารายละเอียด
              </p>
            </div>
          ) : (
            <div className="min-h-[140px] p-2.5 rounded-lg border border-[#1e1e1e] bg-[#070707] flex flex-wrap gap-3 items-center content-start">
              {repairTransformers.map((t) => (
                <div
                  key={t.id}
                  className="p-1.5 rounded-lg border border-[#262626] bg-[#0d0d0d] hover:bg-[#141414] hover:border-sky-500/50 transition-all shadow-xs flex flex-col items-center"
                >
                  <TransformerTriangle
                    transformer={t}
                    size="compact"
                    onDragStart={(e) => handleDragStart(e, t.id)}
                    onClick={() => onSelectTransformer(t)}
                    isHighlighted={t.id === highlightedId}
                  />
                  {t.repairVendor && (
                    <span className="text-[9px] text-sky-300 font-medium truncate max-w-[80px] mt-1 px-1 bg-sky-950/50 border border-sky-900/50 rounded" title={t.repairVendor}>
                      {t.repairVendor}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. จุดวางรอขาย (Waiting for Sale / Auction Area) */}
      <div
        id="sale-area-zone"
        onDragOver={(e) => handleDragOver(e, 'sale')}
        onDragLeave={() => handleDragLeave('sale')}
        onDrop={(e) => handleDrop(e, 'sale')}
        className={`bg-[#0a0a0a] rounded-xl shadow-md border p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 ${
          dragOverZone === 'sale'
            ? 'border-2 border-purple-500 bg-purple-950/20 shadow-lg ring-1 ring-purple-500'
            : 'border-[#262626]'
        }`}
      >
        <div>
          {/* Header */}
          <div className="flex items-start justify-between gap-2 pb-3 mb-3 border-b border-[#1c1c1c]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-lg bg-purple-950/60 border border-purple-700/50 text-purple-400 shrink-0">
                <Tag className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-sm font-bold text-white tracking-tight truncate">
                    จุดวางรอขาย
                  </h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-purple-950/60 border border-purple-800/60 text-purple-300 shrink-0">
                    รอจำหน่าย / ขายทอดตลาด
                  </span>
                </div>
                <p className="text-[11px] text-[#777] mt-0.5 line-clamp-1">
                  หม้อแปลงชำรุด/ปลดรื้อ รออนุมัติจำหน่ายหรือประมูลขาย
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-mono font-semibold px-2 py-1 rounded bg-purple-950/30 border border-purple-800/40 text-purple-300">
                {saleTransformers.length} เครื่อง
              </span>
            </div>
          </div>

          {/* List Area */}
          {saleTransformers.length === 0 ? (
            <div className="min-h-[140px] flex flex-col items-center justify-center text-center border border-dashed border-[#222] rounded-lg bg-[#070707] p-4">
              <Tag className="w-6 h-6 text-purple-500/50 mb-1.5" />
              <p className="text-xs text-[#777] font-medium">
                ไม่มีหม้อแปลงในจุดวางรอขาย
              </p>
              <p className="text-[11px] text-[#555] mt-0.5 max-w-[280px]">
                ลากหม้อแปลงที่ตัดจำหน่าย/รอขายมาวางที่นี่ หรือกดเลือกจุดวางรอขายในหน้ารายละเอียด
              </p>
            </div>
          ) : (
            <div className="min-h-[140px] p-2.5 rounded-lg border border-[#1e1e1e] bg-[#070707] flex flex-wrap gap-3 items-center content-start">
              {saleTransformers.map((t) => (
                <div
                  key={t.id}
                  className="p-1.5 rounded-lg border border-[#262626] bg-[#0d0d0d] hover:bg-[#141414] hover:border-purple-500/50 transition-all shadow-xs flex flex-col items-center"
                >
                  <TransformerTriangle
                    transformer={t}
                    size="compact"
                    onDragStart={(e) => handleDragStart(e, t.id)}
                    onClick={() => onSelectTransformer(t)}
                    isHighlighted={t.id === highlightedId}
                  />
                  <span className="text-[9px] text-purple-300 font-medium truncate max-w-[80px] mt-1 px-1 bg-purple-950/50 border border-purple-900/50 rounded" title="รอขาย">
                    รอขาย
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
