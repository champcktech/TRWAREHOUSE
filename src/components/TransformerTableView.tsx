import React from 'react';
import { Transformer, WarehouseConfig, STATUS_CONFIG, WarehouseZoneId } from '../types';
import { cleanBrandToEnglish, normalizePeaNo } from '../utils/customOptions';
import { Edit2, Trash2, MapPin, Truck, Tag } from 'lucide-react';

interface TransformerTableViewProps {
  transformers: Transformer[];
  config: WarehouseConfig;
  onSelect: (transformer: Transformer) => void;
  onEdit: (transformer: Transformer) => void;
  onDelete: (id: string) => void;
  onJumpToSlot: (slot: number, zone?: WarehouseZoneId) => void;
  onClearAll?: () => void;
}

export const TransformerTableView: React.FC<TransformerTableViewProps> = ({
  transformers,
  config,
  onSelect,
  onEdit,
  onDelete,
  onJumpToSlot,
  onClearAll,
}) => {
  const gridPrefix = config.zonePrefix || config.leftGrid?.zonePrefix || 'A';

  return (
    <div className="bg-[#0a0a0a] rounded-xl shadow-md border border-[#222] overflow-hidden">
      <div className="p-4 border-b border-[#1a1a1a] flex items-center justify-between">
        <h3 className="text-sm font-bold text-white tracking-tight">
          รายการหม้อแปลงทั้งหมด ({transformers.length} เครื่อง)
        </h3>
        {onClearAll && transformers.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs px-2.5 py-1 text-rose-400 hover:text-rose-300 bg-rose-950/30 hover:bg-rose-950/60 border border-rose-800/50 rounded transition-colors font-semibold"
          >
            ลบหม้อแปลงทั้งหมด ({transformers.length})
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-[#121212] text-[#888] font-semibold border-b border-[#222]">
              <th className="py-3 px-3 w-12 text-center">สัญลักษณ์</th>
              <th className="py-3 px-3">ตำแหน่ง / โซน</th>
              <th className="py-3 px-3">รหัส PEA</th>
              <th className="py-3 px-3">S/N</th>
              <th className="py-3 px-3">ขนาด (kVA)</th>
              <th className="py-3 px-3">ยี่ห้อ</th>
              <th className="py-3 px-3 text-center">สถานะ</th>
              <th className="py-3 px-3">วันที่รับเข้า</th>
              <th className="py-3 px-3 text-right">การกระทำ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#181818]">
            {transformers.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-[#666]">
                  ไม่พบข้อมูลหม้อแปลงที่ตรงกับเงื่อนไขค้นหา
                </td>
              </tr>
            ) : (
              transformers.map((t) => {
                const st = STATUS_CONFIG[t.status];

                return (
                  <tr
                    key={t.id}
                    onClick={() => onSelect(t)}
                    className="hover:bg-[#141414] cursor-pointer transition-colors"
                  >
                    <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="w-8 h-7 mx-auto flex items-center justify-center">
                        <svg viewBox="0 0 100 86" className="w-6 h-5">
                          <polygon
                            points="50,4 96,82 4,82"
                            fill={st.hexColor}
                            stroke="#ffffff"
                            strokeWidth="4"
                          />
                        </svg>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      {t.locationType === 'triage' ? (
                        <span className="inline-flex items-center gap-1 font-bold font-mono text-purple-400 bg-purple-950/40 border border-purple-800/60 px-2 py-0.5 rounded text-[11px]">
                          รอคัดแยก
                        </span>
                      ) : t.locationType === 'repair' ? (
                        <span
                          className="inline-flex items-center gap-1 font-bold font-mono text-sky-400 bg-sky-950/40 border border-sky-800/60 px-2 py-0.5 rounded text-[11px]"
                          title={t.repairVendor ? `ส่งซ่อม: ${t.repairVendor}` : 'ส่งซ่อมภายนอก'}
                        >
                          <Truck className="w-3 h-3 shrink-0" />
                          ส่งซ่อม {t.repairVendor ? `(${t.repairVendor})` : ''}
                        </span>
                      ) : t.locationType === 'sale' ? (
                        <span
                          className="inline-flex items-center gap-1 font-bold font-mono text-purple-300 bg-purple-950/50 border border-purple-800/60 px-2 py-0.5 rounded text-[11px]"
                          title="จุดวางรอขาย (จำหน่าย / ขายทอดตลาด)"
                        >
                          <Tag className="w-3 h-3 shrink-0" />
                          รอขาย
                        </span>
                      ) : t.slotNumber !== null ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (t.slotNumber) onJumpToSlot(t.slotNumber, 'left');
                          }}
                          className="inline-flex items-center gap-1 font-bold font-mono px-2 py-0.5 rounded transition-colors text-cyan-400 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800/60"
                        >
                          <MapPin className="w-3 h-3" />
                          {gridPrefix} {String(t.slotNumber).padStart(2, '0')}
                        </button>
                      ) : (
                        <span className="text-[#888] bg-[#1a1a1a] border border-[#2a2a2a] px-2 py-0.5 rounded font-mono text-[11px]">
                          จุดพักรอจัดเก็บ
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-bold font-mono text-white">
                      {normalizePeaNo(t.peaNo)}
                    </td>
                    <td className="py-2.5 px-3 text-[#888] font-mono">
                      {t.serialNo}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#ccc]">
                      {t.capacityKva} kVA ({t.phase === '3-Phase' ? '3P' : '1P'})
                    </td>
                    <td className="py-2.5 px-3 text-[#aaa]">
                      {cleanBrandToEnglish(t.brand)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold inline-block"
                        style={{
                          backgroundColor: `${st.hexColor}25`,
                          color: st.hexColor,
                          border: `1px solid ${st.hexColor}40`
                        }}
                      >
                        {st.label} (สี{st.colorName})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#666] font-mono">
                      {t.receivedDate}
                    </td>
                    <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEdit(t)}
                          title="แก้ไข"
                          className="p-1.5 text-[#666] hover:text-orange-400 hover:bg-[#202020] rounded transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`ยืนยันการลบหม้อแปลง ${t.peaNo}?`)) {
                              onDelete(t.id);
                            }
                          }}
                          title="ลบ"
                          className="p-1.5 text-[#666] hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
