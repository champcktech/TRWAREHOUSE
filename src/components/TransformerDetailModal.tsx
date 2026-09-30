import React, { useState } from 'react';
import { Transformer, WarehouseConfig, getStatusConfig, WarehouseZoneId, TransformerLocationType } from '../types';
import { cleanBrandToEnglish, normalizePeaNo } from '../utils/customOptions';
import { TransformerTriangle } from './TransformerTriangle';
import { X, Edit2, Trash2, ArrowRightLeft, Calendar, Tag, Zap, Cpu, AlertTriangle, Truck, Wrench, Check } from 'lucide-react';

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

  const statusConfig = getStatusConfig(transformer?.status);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#eff2ee] rounded-2xl shadow-xl border border-[#c6d1cb] w-full max-w-lg sm:max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ced8d2] bg-[#e5eae7]">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: statusConfig.hexColor }}
            />
            <h3 className="text-base font-bold text-[#2b3833] tracking-tight">
              รายละเอียดหม้อแปลงไฟฟ้า
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#5a6b65] hover:text-[#2b3833] hover:bg-[#dce3de] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5">
          {/* Top Hero Card: Triangle Representation & Main Status */}
          <div className="p-4 rounded-xl bg-[#e6ebe8] border border-[#ced8d2] flex items-center gap-5">
            <div className="shrink-0 p-2 bg-[#f5f4ef] rounded-xl border border-[#ced8d2] shadow-2xs">
              <TransformerTriangle transformer={transformer} size="normal" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span
                  className="px-2 py-0.5 rounded text-xs font-bold font-mono"
                  style={{
                    backgroundColor: `${statusConfig.hexColor}25`,
                    color: '#1e293b',
                    border: `1px solid ${statusConfig.hexColor}60`
                  }}
                >
                  สถานะ: {statusConfig.label} (สี{statusConfig.colorName})
                </span>
                <span className="text-xs bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded font-mono font-medium">
                  {transformer.phase}
                </span>
              </div>

              <h2 className="text-xl font-bold font-mono text-slate-800 truncate">
                {normalizePeaNo(transformer.peaNo)}
              </h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                S/N: {transformer.serialNo}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                {statusConfig.description}
              </p>
            </div>
          </div>

          {/* Current Bay Position & Quick Move */}
          <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs text-violet-700 font-medium block">
                  จุดจัดวางปัจจุบันในผัง
                </span>
                <span className="text-sm font-bold text-slate-800 block mt-0.5">
                  {renderCurrentLocationLabel()}
                </span>
              </div>

              {!isChangingSlot && (
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {transformer.locationType === 'repair' ? (
                    <button
                      onClick={() => onMove(transformer.id, null, undefined, 'holding')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors shadow-2xs"
                      title="รับหม้อแปลงกลับจากการส่งซ่อมเข้าสู่จุดพัก"
                    >
                      <span>📦 รับกลับเข้าคลัง</span>
                    </button>
                  ) : transformer.locationType === 'sale' ? (
                    <button
                      onClick={() => onMove(transformer.id, null, undefined, 'holding')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-800 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors shadow-2xs"
                      title="นำหม้อแปลงออกจากจุดวางรอขายกลับสู่จุดพัก"
                    >
                      <span>📦 กลับเข้าจุดพัก</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => onMove(transformer.id, null, undefined, 'repair')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-800 bg-sky-50 border border-sky-200 rounded-lg hover:bg-sky-100 transition-colors shadow-2xs"
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
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors shadow-2xs"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    ย้ายจุดวาง
                  </button>
                </div>
              )}
            </div>

            {isChangingSlot && (
              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                <label className="text-[11px] font-medium text-slate-600 block">
                  เลือกตำแหน่งปลายทางใหม่ที่ต้องการย้าย:
                </label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <select
                      value={newLocInput}
                      onChange={(e) => setNewLocInput(e.target.value)}
                      aria-label="เลือกตำแหน่งปลายทาง"
                      className="w-full px-3 py-2 bg-slate-50 border border-violet-300 focus:border-violet-500 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-violet-100"
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
                              {gridPrefix} {String(s).padStart(2, '0')} {occ ? `(มี ${normalizePeaNo(occ.peaNo)})` : '(ว่าง)'}
                            </option>
                          );
                        })}
                      </optgroup>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 justify-end shrink-0">
                    <button
                      onClick={handleApplyLocationChange}
                      disabled={!newLocInput}
                      className="flex-1 sm:flex-none px-4 py-2 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors shadow-xs disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>ยืนยันย้าย</span>
                    </button>
                    <button
                      onClick={() => setIsChangingSlot(false)}
                      className="px-3 py-2 text-xs text-slate-600 hover:text-slate-800 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Waiting for Sale Info Box */}
          {transformer.locationType === 'sale' && (
            <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/60 text-xs space-y-2">
              <div className="flex items-center gap-2 text-purple-700 font-bold text-xs">
                <Tag className="w-4 h-4" />
                <span>จุดวางรอขาย (Waiting for Sale / Auction Area)</span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                หม้อแปลงเครื่องนี้ตั้งอยู่ในพื้นที่ <strong>"จุดวางรอขาย"</strong> เพื่อรอการจำหน่าย หรือขายทอดตลาดตามระเบียบพัสดุ ช่องในผังคลังหลักจึงว่างและพร้อมรองรับหม้อแปลงอื่น
              </p>
            </div>
          )}

          {/* Out for Repair Info Box */}
          {transformer.locationType === 'repair' && (
            <div className="p-3.5 rounded-xl border border-sky-200 bg-sky-50/60 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sky-700 font-bold text-xs">
                  <Truck className="w-4 h-4" />
                  <span>ข้อมูลการส่งซ่อมภายนอก (Out for Repair)</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-slate-700">
                <div>
                  <span className="text-slate-500 block text-[11px]">โรงงาน/ศูนย์ส่งซ่อม:</span>
                  <span className="font-semibold text-slate-800">{transformer.repairVendor || 'ไม่ได้ระบุ'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">วันที่ส่งซ่อม:</span>
                  <span className="font-semibold text-slate-800 font-mono">{transformer.repairSentDate || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">เลขที่ใบส่งซ่อม/เอกสาร:</span>
                  <span className="font-semibold text-slate-800 font-mono">{transformer.repairDocNo || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">กำหนดส่งคืนโดยประมาณ:</span>
                  <span className="font-semibold text-slate-800 font-mono">{transformer.repairExpectedReturn || '-'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Detailed Specs Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80">
              <span className="text-slate-500 flex items-center gap-1 mb-1">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                ขนาดพิกัด (kVA)
              </span>
              <span className="text-sm font-bold font-mono text-slate-800">
                {transformer.capacityKva} kVA
              </span>
            </div>

            <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80">
              <span className="text-slate-500 flex items-center gap-1 mb-1">
                <Tag className="w-3.5 h-3.5 text-blue-500" />
                ยี่ห้อ (Brand)
              </span>
              <span className="text-sm font-bold text-slate-800">
                {cleanBrandToEnglish(transformer.brand)}
              </span>
            </div>

            <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80">
              <span className="text-slate-500 flex items-center gap-1 mb-1">
                <Cpu className="w-3.5 h-3.5 text-violet-500" />
                พิกัดแรงดัน
              </span>
              <span className="text-sm font-semibold font-mono text-slate-700">
                {transformer.voltage || '22 kV / 400-230 V'}
              </span>
            </div>

            <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80">
              <span className="text-slate-500 flex items-center gap-1 mb-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                วันที่รับเข้าคลัง
              </span>
              <span className="text-sm font-semibold font-mono text-slate-700">
                {transformer.receivedDate}
              </span>
            </div>
          </div>

          {/* Notes */}
          {transformer.notes && (
            <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200/80 text-xs">
              <span className="font-semibold text-amber-800 block mb-0.5">
                หมายเหตุ / ประวัติอาการ:
              </span>
              <p className="text-slate-700 leading-relaxed">
                {transformer.notes}
              </p>
            </div>
          )}

          {/* Delete Confirmation Warning */}
          {showDeleteConfirm && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 text-rose-800 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>ยืนยันการลบหม้อแปลง {transformer.peaNo}?</span>
              </div>
              <p className="text-rose-700">
                ข้อมูลหม้อแปลงจะถูกลบออกจากระบบและปลดออกจากผังคลังทันที
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => {
                    onDelete(transformer.id);
                    onClose();
                  }}
                  className="px-3 py-1.5 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs"
                >
                  ยืนยันลบ
                </button>
              </div>
            </div>
          )}

          {/* Action Footer Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              ลบหม้อแปลง
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                ปิด
              </button>
              <button
                onClick={() => {
                  onClose();
                  onEdit(transformer);
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors shadow-xs"
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
