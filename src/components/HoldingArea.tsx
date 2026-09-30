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
  onAddNew?: () => void;
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
      {/* 1. จุดรอคัดแยก (Triage Area) - Soft Lavender Pastel */}
      <div
        id="triage-area-zone"
        onDragOver={(e) => handleDragOver(e, 'triage')}
        onDragLeave={() => handleDragLeave('triage')}
        onDrop={(e) => handleDrop(e, 'triage')}
        className={`bg-[#eaeaf4] rounded-2xl shadow-2xs border p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 ${
          dragOverZone === 'triage'
            ? 'border-2 border-[#6a6ec2] bg-[#dfe0f2] shadow-md ring-2 ring-[#c5c7e8]'
            : 'border-[#cbcde3] hover:border-[#b5b8d9]'
        }`}
      >
        <div>
          {/* Header */}
          <div className="pb-3 mb-3 border-b border-[#d5d7eb] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-[#dcdef0] border border-[#c0c3e2] text-[#45488c] shrink-0">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#252845] tracking-tight truncate">
                    จุดรอคัดแยก
                  </h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-[#dcdef0] border border-[#c0c3e2] text-[#3d407d] inline-block mt-0.5">
                    รอตรวจสอบสภาพ
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs font-mono font-semibold px-2 py-1 rounded-lg bg-[#dcdef0] border border-[#c0c3e2] text-[#32356b]">
                  {triageTransformers.length} เครื่อง
                </span>
              </div>
            </div>

            <p className="text-[11px] text-[#4e5173] line-clamp-1 pt-0.5">
              หม้อแปลงถอดรื้อ/รับเข้า รอตรวจสอบก่อนจัดเก็บ
            </p>
          </div>

          {/* List Area */}
          {triageTransformers.length === 0 ? (
            <div className="min-h-[140px] flex flex-col items-center justify-center text-center border border-dashed border-[#bfc2de] rounded-xl bg-[#e1e2f0]/70 p-4">
              <Sparkles className="w-6 h-6 text-[#6e72ab] mb-1.5" />
              <p className="text-xs text-[#3b3e63] font-medium">
                ไม่มีหม้อแปลงในจุดรอคัดแยก
              </p>
              <p className="text-[11px] text-[#5e6187] mt-0.5 max-w-[280px]">
                ลากหม้อแปลงจากผังคลังมาวางที่นี่ หรือกดเลือกจุดรอคัดแยก
              </p>
            </div>
          ) : (
            <div className="min-h-[140px] p-2.5 rounded-xl border border-[#c8cae3] bg-[#e0e1f0]/70 flex flex-wrap gap-3 items-center content-start">
              {triageTransformers.map((t) => (
                <div
                  key={t.id}
                  className="p-1.5 rounded-xl border border-[#c8cbd9] bg-[#f4f3ee] hover:border-[#8e92c9] hover:shadow-xs transition-all shadow-2xs"
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

      {/* 2. จุดพักรอจัดเก็บ (Holding Area) - Soft Warm Sand Pastel */}
      <div
        id="holding-area-zone"
        onDragOver={(e) => handleDragOver(e, 'holding')}
        onDragLeave={() => handleDragLeave('holding')}
        onDrop={(e) => handleDrop(e, 'holding')}
        className={`bg-[#f2ece1] rounded-2xl shadow-2xs border p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 ${
          dragOverZone === 'holding'
            ? 'border-2 border-[#c99738] bg-[#ebe1cf] shadow-md ring-2 ring-[#e3cca1]'
            : 'border-[#ddd1bc] hover:border-[#cfc0a5]'
        }`}
      >
        <div>
          {/* Header */}
          <div className="pb-3 mb-3 border-b border-[#e3d9c6] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-[#e8decb] border border-[#d4c4a7] text-[#755314] shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#3b2e16] tracking-tight truncate">
                    จุดพักรอจัดเก็บ
                  </h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-[#e8decb] border border-[#d4c4a7] text-[#694910] inline-block mt-0.5">
                    พร้อมจัดเก็บเข้าช่อง
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs font-mono font-semibold px-2 py-1 rounded-lg bg-[#e8decb] border border-[#d4c4a7] text-[#5c3f0c]">
                  {unassignedTransformers.length} เครื่อง
                </span>
              </div>
            </div>

            <p className="text-[11px] text-[#66563a] line-clamp-1 pt-0.5">
              พักรอจัดวาง สามารถลากลงผังคลังได้ทันที
            </p>
          </div>

          {/* List Area */}
          {unassignedTransformers.length === 0 ? (
            <div className="min-h-[140px] flex flex-col items-center justify-center text-center border border-dashed border-[#d4c5aa] rounded-xl bg-[#eae2d3]/70 p-4">
              <p className="text-xs text-[#4f4024] font-medium">
                ไม่มีหม้อแปลงรอจัดเก็บ
              </p>
              <p className="text-[11px] text-[#705f42] mt-0.5 max-w-[280px]">
                หม้อแปลงทั้งหมดถูกจัดวางลงในช่องผังคลังเรียบร้อยแล้ว หรือลากมาพักที่นี่
              </p>
            </div>
          ) : (
            <div className="min-h-[140px] p-2.5 rounded-xl border border-[#d9cbb2] bg-[#eae1d1]/70 flex flex-wrap gap-3 items-center content-start">
              {unassignedTransformers.map((t) => (
                <div
                  key={t.id}
                  className="p-1.5 rounded-xl border border-[#d4cab8] bg-[#f4f3ee] hover:border-[#c99738] hover:shadow-xs transition-all shadow-2xs"
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

      {/* 3. ส่งซ่อมภายนอก (Out for Repair) - Soft Sky-Mint Pastel */}
      <div
        id="repair-area-zone"
        onDragOver={(e) => handleDragOver(e, 'repair')}
        onDragLeave={() => handleDragLeave('repair')}
        onDrop={(e) => handleDrop(e, 'repair')}
        className={`bg-[#e6eff2] rounded-2xl shadow-2xs border p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 ${
          dragOverZone === 'repair'
            ? 'border-2 border-[#458eb0] bg-[#d8e7ed] shadow-md ring-2 ring-[#b5d4e3]'
            : 'border-[#c4d8e0] hover:border-[#adc7d1]'
        }`}
      >
        <div>
          {/* Header */}
          <div className="pb-3 mb-3 border-b border-[#cfe0e6] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-[#d5e5eb] border border-[#b6cfd9] text-[#225870] shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#1b3642] tracking-tight truncate">
                    ส่งซ่อมภายนอก
                  </h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-[#d5e5eb] border border-[#b6cfd9] text-[#215166] inline-block mt-0.5">
                    โรงงาน / ซ่อมใหญ่
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs font-mono font-semibold px-2 py-1 rounded-lg bg-[#d5e5eb] border border-[#b6cfd9] text-[#1c485c]">
                  {repairTransformers.length} เครื่อง
                </span>
              </div>
            </div>

            <p className="text-[11px] text-[#46616e] line-clamp-1 pt-0.5">
              อยู่นอกคลัง คืนช่องว่างในผังอัตโนมัติ
            </p>
          </div>

          {/* List Area */}
          {repairTransformers.length === 0 ? (
            <div className="min-h-[140px] flex flex-col items-center justify-center text-center border border-dashed border-[#b6cfd9] rounded-xl bg-[#dce8ec]/70 p-4">
              <Truck className="w-6 h-6 text-[#58889e] mb-1.5" />
              <p className="text-xs text-[#2a4957] font-medium">
                ไม่มีหม้อแปลงที่ส่งซ่อมภายนอก
              </p>
              <p className="text-[11px] text-[#4e6b78] mt-0.5 max-w-[280px]">
                ลากหม้อแปลงที่ส่งซ่อมมาวางที่นี่เพื่อคืนช่องในผัง หรือกดเลือก &quot;ส่งซ่อม&quot; ในหน้ารายละเอียด
              </p>
            </div>
          ) : (
            <div className="min-h-[140px] p-2.5 rounded-xl border border-[#bed5de] bg-[#dbe7eb]/70 flex flex-wrap gap-3 items-center content-start">
              {repairTransformers.map((t) => (
                <div
                  key={t.id}
                  className="p-1.5 rounded-xl border border-[#c2d3d9] bg-[#f4f3ee] hover:border-[#5899b8] hover:shadow-xs transition-all shadow-2xs flex flex-col items-center"
                >
                  <TransformerTriangle
                    transformer={t}
                    size="compact"
                    onDragStart={(e) => handleDragStart(e, t.id)}
                    onClick={() => onSelectTransformer(t)}
                    isHighlighted={t.id === highlightedId}
                  />
                  {t.repairVendor && (
                    <span className="text-[9px] text-[#1f5066] font-medium truncate max-w-[80px] mt-1 px-1.5 py-0.5 bg-[#d9ebf2] border border-[#b4d3e0] rounded" title={t.repairVendor}>
                      {t.repairVendor}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. จุดวางรอขาย (Waiting for Sale / Auction Area) - Soft Mauve-Plum Pastel */}
      <div
        id="sale-area-zone"
        onDragOver={(e) => handleDragOver(e, 'sale')}
        onDragLeave={() => handleDragLeave('sale')}
        onDrop={(e) => handleDrop(e, 'sale')}
        className={`bg-[#efe8f2] rounded-2xl shadow-2xs border p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 ${
          dragOverZone === 'sale'
            ? 'border-2 border-[#8e5ca6] bg-[#e5d9eb] shadow-md ring-2 ring-[#d4bee0]'
            : 'border-[#d6c7de] hover:border-[#c3b0cc]'
        }`}
      >
        <div>
          {/* Header */}
          <div className="pb-3 mb-3 border-b border-[#dfd2e6] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-[#e3d6eb] border border-[#cbb8d6] text-[#5e3473] shrink-0">
                  <Tag className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#341f40] tracking-tight truncate">
                    จุดวางรอขาย
                  </h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-[#e3d6eb] border border-[#cbb8d6] text-[#552e69] inline-block mt-0.5">
                    รอจำหน่าย / ขายทอดตลาด
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs font-mono font-semibold px-2 py-1 rounded-lg bg-[#e3d6eb] border border-[#cbb8d6] text-[#4b275e]">
                  {saleTransformers.length} เครื่อง
                </span>
              </div>
            </div>

            <p className="text-[11px] text-[#5d4969] line-clamp-1 pt-0.5">
              หม้อแปลงชำรุด/ปลดรื้อ รออนุมัติจำหน่ายหรือประมูลขาย
            </p>
          </div>

          {/* List Area */}
          {saleTransformers.length === 0 ? (
            <div className="min-h-[140px] flex flex-col items-center justify-center text-center border border-dashed border-[#cbb8d6] rounded-xl bg-[#e6dceb]/70 p-4">
              <Tag className="w-6 h-6 text-[#856296] mb-1.5" />
              <p className="text-xs text-[#452b52] font-medium">
                ไม่มีหม้อแปลงในจุดวางรอขาย
              </p>
              <p className="text-[11px] text-[#665073] mt-0.5 max-w-[280px]">
                ลากหม้อแปลงที่ตัดจำหน่าย/รอขายมาวางที่นี่ หรือกดเลือกจุดวางรอขายในหน้ารายละเอียด
              </p>
            </div>
          ) : (
            <div className="min-h-[140px] p-2.5 rounded-xl border border-[#d1bfd9] bg-[#e5dbea]/70 flex flex-wrap gap-3 items-center content-start">
              {saleTransformers.map((t) => (
                <div
                  key={t.id}
                  className="p-1.5 rounded-xl border border-[#d2c5d9] bg-[#f4f3ee] hover:border-[#9c73b0] hover:shadow-xs transition-all shadow-2xs flex flex-col items-center"
                >
                  <TransformerTriangle
                    transformer={t}
                    size="compact"
                    onDragStart={(e) => handleDragStart(e, t.id)}
                    onClick={() => onSelectTransformer(t)}
                    isHighlighted={t.id === highlightedId}
                  />
                  <span className="text-[9px] text-[#522b66] font-medium truncate max-w-[80px] mt-1 px-1.5 py-0.5 bg-[#e6d8ed] border border-[#cbb6d6] rounded" title="รอขาย">
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
