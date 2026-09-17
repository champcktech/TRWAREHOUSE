import React, { useState } from 'react';
import { Transformer, WarehouseConfig, STATUS_CONFIG, WarehouseZoneId, TransformerLocationType } from '../types';
import { TransformerTriangle } from './TransformerTriangle';
import { X, Edit2, Trash2, ArrowRightLeft, Calendar, Tag, Zap, Cpu, AlertTriangle, Truck, Wrench } from 'lucide-react';

interface TransformerDetailModalProps {
  transformer: Transformer | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (transformer: Transformer) => void;
  onDelete: (id: string) => void;
  onMove: (
    id: string,
    targetSlot: number | null,
    targetZone?: WarehouseZoneId,
    targetLocationType?: TransformerLocationType
  ) => void;
  config: WarehouseConfig;
  allTransformers: Transformer[];
}

export const TransformerDetailModal: React.FC<TransformerDetailModalProps> = ({
  transformer,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onMove,
  config,
  allTransformers
}) => {
  const [isChangingSlot, setIsChangingSlot] = useState(false);
  const [newLocInput, setNewLocInput] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!isOpen || !transformer) return null;

  const statusConfig = STATUS_CONFIG[transformer.status];

  const gridCols = config.columns || config.leftGrid?.columns || 4;
  const gridRows = config.rows || config.leftGrid?.rows || 14;
  const gridTotal = gridCols * gridRows;
  const gridPrefix = config.zonePrefix || config.leftGrid?.zonePrefix || 'A';
  const gridName = config.name || config.leftGrid?.name || 'จุดวางหม้อแปลง';

  const handleApplyLocationChange = () => {
    if (!newLocInput) return;
    if (newLocInput === 'triage') {
      onMove(transformer.id, null, undefined, 'triage');
    } else if (newLocInput === 'holding') {
      onMove(transformer.id, null, undefined, 'holding');
    } else if (newLocInput === 'repair') {
      onMove(transformer.id, null, undefined, 'repair');
    } else if (newLocInput === 'sale') {
      onMove(transformer.id, null, undefined, 'sale');
    } else if (newLocInput.startsWith('left-') || newLocInput.startsWith('slot-') || newLocInput.startsWith('right-')) {
      const slot = Number(newLocInput.replace('left-', '').replace('slot-', '').replace('right-', ''));
      onMove(transformer.id, slot, 'left', 'grid');
    }
    setIsChangingSlot(false);
  };

  const renderCurrentLocationLabel = () => {
    if (transformer.locationType === 'triage') {
      return '🔍 จุดรอคัดแยก (Triage Area - รอตรวจสอบสภาพ)';
    }
    if (transformer.locationType === 'repair') {
      return `🚚 ส่งซ่อมภายนอก ${transformer.repairVendor ? `(${transformer.repairVendor})` : '(โรงซ่อม/โรงงาน)'}`;
    }
    if (transformer.locationType === 'sale') {
      return '🏷️ จุดวางรอขาย (Waiting for Sale - รอจำหน่าย/ประมูลขาย)';
    }
    if (transformer.slotNumber !== null) {
      return `${gridPrefix} ${String(transformer.slotNumber).padStart(2, '0')} (${gridName})`;
    }
    return '📦 จุดพักรอจัดเก็บ (Holding Area)';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#0c0c0c] rounded-xl shadow-2xl border border-[#2a2a2a] w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222] bg-[#121212]">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: statusConfig.hexColor }}
            />
            <h3 className="text-base font-bold text-white tracking-tight">
              รายละเอียดหม้อแปลงไฟฟ้า
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-[#666] hover:text-white hover:bg-[#202020] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5">
          {/* Top Hero Card: Triangle Representation & Main Status */}
          <div className="p-4 rounded-xl bg-[#141414] border border-[#262626] flex items-center gap-5">
            <div className="shrink-0 p-2 bg-[#0a0a0a] rounded-lg border border-[#222]">
              <TransformerTriangle transformer={transformer} size="normal" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span
                  className="px-2 py-0.5 rounded text-xs font-bold font-mono"
                  style={{
                    backgroundColor: `${statusConfig.hexColor}25`,
                    color: statusConfig.hexColor,
                    border: `1px solid ${statusConfig.hexColor}40`
                  }}
                >
                  สถานะ: {statusConfig.label} (สี{statusConfig.colorName})
                </span>
                <span className="text-xs bg-[#222] text-[#aaa] border border-[#333] px-2 py-0.5 rounded font-mono font-medium">
                  {transformer.phase}
                </span>
              </div>

              <h2 className="text-xl font-bold font-mono text-white truncate">
                {transformer.peaNo}
              </h2>
              <p className="text-xs text-[#888] font-mono mt-0.5">
                S/N: {transformer.serialNo}
              </p>
              <p className="text-xs text-[#777] mt-1">
                {statusConfig.description}
              </p>
            </div>
          </div>

          {/* Current Bay Position & Quick Move */}
          <div className="p-3.5 rounded-xl border border-[#2a2a2a] bg-[#121212] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs text-orange-400 font-medium block">
                จุดจัดวางปัจจุบันในผัง
              </span>
              <span className="text-sm font-bold text-white">
                {renderCurrentLocationLabel()}
              </span>
            </div>

            {isChangingSlot ? (
              <div className="flex items-center gap-2">
                <select
                  value={newLocInput}
                  onChange={(e) => setNewLocInput(e.target.value)}
                  aria-label="เลือกตำแหน่งปลายทาง"
                  className="px-2.5 py-1.5 bg-[#1a1a1a] border border-[#333] rounded text-xs text-[#e5e5e5]"
                >
                  <option value="">-- เลือกจุดวางปลายทาง --</option>
                  <optgroup label="📍 พื้นที่พักรอ / คัดแยก / ส่งซ่อม / รอขาย">
                    <option value="triage">🔍 จุดรอคัดแยก (Triage Area)</option>
                    <option value="holding">📦 จุดพักรอจัดเก็บ (Holding Area)</option>
                    <option value="repair">🚚 ส่งซ่อมภายนอก (Out for Repair - โรงงาน/ศูนย์ซ่อม)</option>
                    <option value="sale">🏷️ จุดวางรอขาย (Waiting for Sale - รอจำหน่าย/ขายทอดตลาด)</option>
                  </optgroup>
                  <optgroup label={`📍 ${gridName}`}>
                    {Array.from({ length: gridTotal }, (_, i) => i + 1).map((s) => {
                      const occ = allTransformers.find(
                        (t) => (t.locationType === 'grid' || !t.locationType) && t.slotNumber === s && t.id !== transformer.id
                      );
                      return (
                        <option key={`left-${s}`} value={`left-${s}`}>
                          {gridPrefix} {String(s).padStart(2, '0')} {occ ? `(มี ${occ.peaNo})` : '(ว่าง)'}
                        </option>
                      );
                    })}
                  </optgroup>
                </select>
                <button
                  onClick={handleApplyLocationChange}
                  disabled={!newLocInput}
                  className="px-3 py-1.5 text-xs font-semibold bg-orange-600 text-white rounded hover:bg-orange-500 disabled:opacity-50"
                >
                  ย้าย
                </button>
                <button
                  onClick={() => setIsChangingSlot(false)}
                  className="px-2 py-1.5 text-xs text-[#777] hover:text-white"
                >
                  ยกเลิก
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {transformer.locationType === 'repair' ? (
                  <button
                    onClick={() => onMove(transformer.id, null, undefined, 'holding')}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/40 border border-emerald-800/60 rounded-lg hover:bg-emerald-900/50 transition-colors"
                    title="รับหม้อแปลงกลับจากการส่งซ่อมเข้าสู่จุดพัก"
                  >
                    <span>📦 รับกลับเข้าคลัง</span>
                  </button>
                ) : transformer.locationType === 'sale' ? (
                  <button
                    onClick={() => onMove(transformer.id, null, undefined, 'holding')}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-purple-300 bg-purple-950/40 border border-purple-800/60 rounded-lg hover:bg-purple-900/50 transition-colors"
                    title="นำหม้อแปลงออกจากจุดวางรอขายกลับสู่จุดพัก"
                  >
                    <span>📦 กลับเข้าจุดพัก</span>
                  </button>
                ) : (
                  <button
                    onClick={() => onMove(transformer.id, null, undefined, 'repair')}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-sky-300 bg-sky-950/40 border border-sky-800/60 rounded-lg hover:bg-sky-900/50 transition-colors"
                    title="บันทึกย้ายหม้อแปลงไปส่งซ่อมภายนอก เพื่อคืนช่องว่างในผังคลัง"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>ส่งซ่อม</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setNewLocInput(
                      transformer.locationType === 'triage'
                        ? 'triage'
                        : transformer.locationType === 'repair'
                        ? 'repair'
                        : transformer.locationType === 'sale'
                        ? 'sale'
                        : transformer.slotNumber
                        ? `left-${transformer.slotNumber}`
                        : 'holding'
                    );
                    setIsChangingSlot(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-orange-400 bg-[#1a1a1a] border border-[#333] rounded-lg hover:bg-[#252525] transition-colors"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  ย้ายจุดวาง
                </button>
              </div>
            )}
          </div>

          {/* Waiting for Sale Info Box */}
          {transformer.locationType === 'sale' && (
            <div className="p-3.5 rounded-xl border border-purple-800/60 bg-purple-950/20 text-xs space-y-2">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
                <Tag className="w-4 h-4" />
                <span>จุดวางรอขาย (Waiting for Sale / Auction Area)</span>
              </div>
              <p className="text-[#ccc] text-[11px] leading-relaxed">
                หม้อแปลงเครื่องนี้ตั้งอยู่ในพื้นที่ <strong>"จุดวางรอขาย"</strong> เพื่อรอการจำหน่าย หรือขายทอดตลาดตามระเบียบพัสดุ ช่องในผังคลังหลักจึงว่างและพร้อมรองรับหม้อแปลงอื่น
              </p>
            </div>
          )}

          {/* Out for Repair Info Box */}
          {transformer.locationType === 'repair' && (
            <div className="p-3.5 rounded-xl border border-sky-800/60 bg-sky-950/20 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sky-400 font-bold text-xs">
                  <Truck className="w-4 h-4" />
                  <span>ข้อมูลการส่งซ่อมภายนอก (Out for Repair)</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-[#ccc]">
                <div>
                  <span className="text-[#777] block text-[11px]">โรงงาน/ศูนย์ส่งซ่อม:</span>
                  <span className="font-semibold text-white">{transformer.repairVendor || 'ไม่ได้ระบุ'}</span>
                </div>
                <div>
                  <span className="text-[#777] block text-[11px]">วันที่ส่งซ่อม:</span>
                  <span className="font-semibold text-white font-mono">{transformer.repairSentDate || '-'}</span>
                </div>
                <div>
                  <span className="text-[#777] block text-[11px]">เลขที่ใบส่งซ่อม/เอกสาร:</span>
                  <span className="font-semibold text-white font-mono">{transformer.repairDocNo || '-'}</span>
                </div>
                <div>
                  <span className="text-[#777] block text-[11px]">กำหนดส่งคืนโดยประมาณ:</span>
                  <span className="font-semibold text-white font-mono">{transformer.repairExpectedReturn || '-'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Detailed Specs Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-[#141414] rounded-lg border border-[#222]">
              <span className="text-[#666] flex items-center gap-1 mb-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                ขนาดพิกัด (kVA)
              </span>
              <span className="text-sm font-bold font-mono text-white">
                {transformer.capacityKva} kVA
              </span>
            </div>

            <div className="p-3 bg-[#141414] rounded-lg border border-[#222]">
              <span className="text-[#666] flex items-center gap-1 mb-1">
                <Tag className="w-3.5 h-3.5 text-blue-400" />
                ยี่ห้อ (Brand)
              </span>
              <span className="text-sm font-bold text-white">
                {transformer.brand}
              </span>
            </div>

            <div className="p-3 bg-[#141414] rounded-lg border border-[#222]">
              <span className="text-[#666] flex items-center gap-1 mb-1">
                <Cpu className="w-3.5 h-3.5 text-orange-400" />
                พิกัดแรงดัน
              </span>
              <span className="text-sm font-semibold font-mono text-[#ccc]">
                {transformer.voltage || '22 kV / 400-230 V'}
              </span>
            </div>

            <div className="p-3 bg-[#141414] rounded-lg border border-[#222]">
              <span className="text-[#666] flex items-center gap-1 mb-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                วันที่รับเข้าคลัง
              </span>
              <span className="text-sm font-semibold font-mono text-[#ccc]">
                {transformer.receivedDate}
              </span>
            </div>
          </div>

          {/* Notes */}
          {transformer.notes && (
            <div className="p-3 bg-[#161616] rounded-lg border border-[#262626] text-xs">
              <span className="font-semibold text-orange-400 block mb-0.5">
                หมายเหตุ / ประวัติอาการ:
              </span>
              <p className="text-[#bbb] leading-relaxed">
                {transformer.notes}
              </p>
            </div>
          )}

          {/* Delete Confirmation Warning */}
          {showDeleteConfirm && (
            <div className="p-4 bg-rose-950/40 border border-rose-800/80 rounded-lg space-y-2 text-xs">
              <div className="flex items-center gap-2 text-rose-300 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>ยืนยันการลบหม้อแปลง {transformer.peaNo}?</span>
              </div>
              <p className="text-rose-200/80">
                ข้อมูลหม้อแปลงจะถูกลบออกจากระบบและปลดออกจากผังคลังทันที
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 text-[#aaa] hover:text-white bg-[#1a1a1a] border border-[#333] rounded"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => {
                    onDelete(transformer.id);
                    onClose();
                  }}
                  className="px-3 py-1.5 font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded shadow-xs"
                >
                  ยืนยันลบ
                </button>
              </div>
            </div>
          )}

          {/* Action Footer Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-[#222]">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-950/40 rounded transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              ลบหม้อแปลง
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-[#888] hover:text-white hover:bg-[#1a1a1a] rounded transition-colors"
              >
                ปิด
              </button>
              <button
                onClick={() => {
                  onClose();
                  onEdit(transformer);
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors shadow-sm"
              >
                <Edit2 className="w-3.5 h-3.5" />
                แก้ไขข้อมูล
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
