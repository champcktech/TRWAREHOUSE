import React from 'react';
import { Transformer, WarehouseConfig, getStatusConfig, WarehouseZoneId } from '../types';
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
    <div className="bg-[#eff2ee] rounded-2xl shadow-2xs border border-[#cad4ce] overflow-hidden">
      <div className="p-4 border-b border-[#ced8d2] bg-[#e5eae7] flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[#222e2a] tracking-tight">
          รายการหม้อแปลงทั้งหมด ({transformers.length} เครื่อง)
        </h3>
        {onClearAll && transformers.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs px-2.5 py-1 text-[#75232c] hover:text-[#591820] bg-[#f4dfe2] hover:bg-[#ebd0d4] border border-[#dfaab1] rounded-xl transition-colors font-semibold shadow-2xs"
          >
            ลบหม้อแปลงทั้งหมด ({transformers.length})
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-[#e1e7e3] text-[#45544d] font-semibold border-b border-[#c8d2cc]">
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
          <tbody className="divide-y divide-[#d8e0dc]">
            {transformers.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-[#5c6b64]">
                  ไม่พบข้อมูลหม้อแปลงที่ตรงกับเงื่อนไขค้นหา
                </td>
              </tr>
            ) : (
              transformers.map((t) => {
                const st = getStatusConfig(t?.status);

                return (
                  <tr
                    key={t.id}
                    onClick={() => onSelect(t)}
                    className="hover:bg-[#e5ebe7] cursor-pointer transition-colors"
                  >
                    <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="w-8 h-7 mx-auto flex items-center justify-center">
                        <svg viewBox="0 0 100 86" className="w-6 h-5">
                          <polygon
                            points="50,4 96,82 4,82"
                            fill={st.hexColor}
                            stroke="#f5f4ef"
                            strokeWidth="4"
                          />
                        </svg>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      {t.locationType === 'triage' ? (
                        <span className="inline-flex items-center gap-1 font-bold font-mono text-[#3d407d] bg-[#dcdef0] border border-[#c0c3e2] px-2 py-0.5 rounded-md text-[11px]">
                          รอคัดแยก
                        </span>
                      ) : t.locationType === 'repair' ? (
                        <span
                          className="inline-flex items-center gap-1 font-bold font-mono text-[#215166] bg-[#d5e5eb] border border-[#b6cfd9] px-2 py-0.5 rounded-md text-[11px]"
                          title={t.repairVendor ? `ส่งซ่อม: ${t.repairVendor}` : 'ส่งซ่อมภายนอก'}
                        >
                          <Truck className="w-3 h-3 shrink-0" />
                          ส่งซ่อม {t.repairVendor ? `(${t.repairVendor})` : ''}
                        </span>
                      ) : t.locationType === 'sale' ? (
                        <span
                          className="inline-flex items-center gap-1 font-bold font-mono text-[#552e69] bg-[#e3d6eb] border border-[#cbb8d6] px-2 py-0.5 rounded-md text-[11px]"
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
                          className="inline-flex items-center gap-1 font-bold font-mono px-2 py-0.5 rounded-md transition-colors text-[#4c377a] bg-[#e4ddf2] hover:bg-[#d8cef0] border border-[#c6bae0] shadow-2xs"
                        >
                          <MapPin className="w-3 h-3" />
                          {gridPrefix} {String(t.slotNumber).padStart(2, '0')}
                        </button>
                      ) : (
                        <span className="text-[#694910] bg-[#e8decb] border border-[#d4c4a7] px-2 py-0.5 rounded-md font-mono text-[11px] font-medium">
                          จุดพักรอจัดเก็บ
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-bold font-mono text-[#222e2a]">
                      {normalizePeaNo(t.peaNo)}
                    </td>
                    <td className="py-2.5 px-3 text-[#4d5c55] font-mono">
                      {t.serialNo}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#2d3b36]">
                      {t.capacityKva} kVA ({t.phase === '3-Phase' ? '3P' : '1P'})
                    </td>
                    <td className="py-2.5 px-3 text-[#3d4b45]">
                      {cleanBrandToEnglish(t.brand)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold inline-block ${st.badgeBg} ${st.badgeText}`}
                      >
                        {st.label} (สี{st.colorName})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#4d5c55] font-mono">
                      {t.receivedDate}
                    </td>
                    <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEdit(t)}
                          title="แก้ไข"
                          className="p-1.5 text-[#54635c] hover:text-[#4c377a] hover:bg-[#e4ddf2] rounded-lg transition-colors"
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
                          className="p-1.5 text-[#54635c] hover:text-[#75232c] hover:bg-[#f4dfe2] rounded-lg transition-colors"
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
