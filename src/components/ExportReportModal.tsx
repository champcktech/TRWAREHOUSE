import React, { useState } from 'react';
import { Transformer, WarehouseConfig, STATUS_CONFIG } from '../types';
import { exportToExcel, exportReportToPDF } from '../utils/exportUtils';
import { cleanBrandToEnglish } from '../utils/customOptions';
import { X, FileSpreadsheet, FileText, Printer, CheckCircle, Loader2, Webhook } from 'lucide-react';

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  transformers: Transformer[];
  config: WarehouseConfig;
  onOpenGoogleSheets?: () => void;
  onOpenWebhook?: () => void;
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  isOpen,
  onClose,
  transformers,
  config,
  onOpenGoogleSheets,
  onOpenWebhook
}) => {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const gridCols = config.columns || config.leftGrid?.columns || 4;
  const gridRows = config.rows || config.leftGrid?.rows || 14;
  const totalSlots = gridCols * gridRows;
  const occupiedSlots = transformers.filter(t => (t.locationType === 'grid' || (!t.locationType && t.slotNumber !== null)) && t.slotNumber !== null).length;
  const emptySlots = totalSlots - occupiedSlots;
  const unassignedCount = transformers.filter(t => t.slotNumber === null).length;

  const goodCount = transformers.filter(t => t.status === 'good').length;
  const minorCount = transformers.filter(t => t.status === 'minor_repair').length;
  const majorCount = transformers.filter(t => t.status === 'major_repair').length;
  const damagedCount = transformers.filter(t => t.status === 'damaged').length;

  const handleExportExcel = () => {
    try {
      exportToExcel(transformers, config);
      setExportSuccess('ส่งออกไฟล์ Excel (.xlsx) สำเร็จแล้ว!');
      setTimeout(() => setExportSuccess(null), 4000);
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการส่งออก Excel');
    }
  };

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      await exportReportToPDF('printable-report-content', `รายงานสรุปสถานะหม้อแปลง_${new Date().toISOString().slice(0, 10)}.pdf`);
      setExportSuccess('ส่งออกไฟล์ PDF สำเร็จแล้ว!');
      setTimeout(() => setExportSuccess(null), 4000);
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการส่งออก PDF กำลังเปิดหน้าต่างพิมพ์ให้แทน');
      window.print();
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const sortedTransformers = [...transformers].sort((a, b) => {
    if (a.slotNumber === null && b.slotNumber === null) return 0;
    if (a.slotNumber === null) return 1;
    if (b.slotNumber === null) return -1;
    return a.slotNumber - b.slotNumber;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#0c0c0c] rounded-lg shadow-2xl border border-[#2a2a2a] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222] bg-[#121212] shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-400" />
              รายงานสรุปสถานะหม้อแปลงไฟฟ้าและผังคลัง
            </h3>
            <p className="text-xs text-[#777] mt-0.5">
              พรีวิวรายงานและส่งออกในรูปแบบไฟล์ Excel (.xlsx) และ PDF
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded text-[#666] hover:text-white hover:bg-[#202020] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="px-6 py-3 bg-[#141414] border-b border-[#222] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {/* Excel Export */}
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded shadow-sm transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              ส่งออก Excel (.xlsx)
            </button>

            {/* Webhook Sync */}
            {onOpenWebhook && (
              <button
                onClick={() => {
                  onClose();
                  onOpenWebhook();
                }}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-[#26160b] hover:bg-[#382010] text-orange-300 hover:text-orange-100 border border-orange-700/70 text-xs font-bold rounded shadow-sm transition-colors"
              >
                <Webhook className="w-4 h-4 text-orange-400" />
                <span>ส่งผ่าน Webhook</span>
              </button>
            )}

            {/* Google Sheets */}
            {onOpenGoogleSheets && (
              <button
                onClick={() => {
                  onClose();
                  onOpenGoogleSheets();
                }}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-[#173322] hover:bg-[#1f452e] text-emerald-300 hover:text-emerald-100 border border-emerald-700/60 text-xs font-bold rounded shadow-sm transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Google Sheets (OAuth)</span>
              </button>
            )}

            {/* Direct PDF Export */}
            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded shadow-sm transition-colors disabled:opacity-50"
            >
              {isExportingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              {isExportingPdf ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลด PDF'}
            </button>

            {/* Print/Save as PDF browser dialog */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-[#202020] hover:bg-[#2a2a2a] text-[#ddd] hover:text-white border border-[#333] text-xs font-bold rounded shadow-sm transition-colors"
            >
              <Printer className="w-4 h-4" />
              พิมพ์ / พรีวิว (Print)
            </button>
          </div>

          {exportSuccess && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-3 py-1 rounded animate-in fade-in">
              <CheckCircle className="w-4 h-4" />
              <span>{exportSuccess}</span>
            </div>
          )}
        </div>

        {/* Printable & Scrollable Report Container */}
        <div className="p-6 overflow-y-auto flex-1 bg-[#050505]">
          <div
            id="printable-report-content"
            className="bg-[#111111] text-[#e5e5e5] p-8 rounded-lg shadow-md border border-[#262626] space-y-6 max-w-3xl mx-auto"
          >
            {/* Official Report Header */}
            <div className="text-center border-b-2 border-orange-500/80 pb-4">
              <span className="text-xs font-mono font-semibold text-orange-400 uppercase tracking-widest">
                การไฟฟ้าส่วนภูมิภาค (PEA)
              </span>
              <h1 className="text-xl font-bold text-white mt-1">
                รายงานสรุปสถานะหม้อแปลงไฟฟ้าและผังคลังประจำวัน
              </h1>
              <p className="text-sm text-[#ccc] font-medium mt-1">
                {config.warehouseName}
              </p>
              <p className="text-xs text-[#777] font-mono mt-1">
                วันที่พิมพ์รายงาน: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            {/* Summary Statistics Section */}
            <div>
              <h2 className="text-sm font-bold text-white mb-2 border-l-2 border-orange-500 pl-2">
                1. สรุปภาพรวมสถานะและพื้นที่จัดเก็บ
              </h2>

              {/* Status Breakdown 4-Color Grid */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="p-2.5 rounded border border-emerald-800/60 bg-emerald-950/30 text-center">
                  <span className="text-xs font-semibold text-emerald-400 block">ดี (เขียว)</span>
                  <span className="text-lg font-bold font-mono text-emerald-200">{goodCount} เครื่อง</span>
                  <span className="text-[10px] text-emerald-500 block">พร้อมจ่ายใช้งาน</span>
                </div>

                <div className="p-2.5 rounded border border-amber-800/60 bg-amber-950/30 text-center">
                  <span className="text-xs font-semibold text-amber-400 block">รอซ่อมเล็กน้อย</span>
                  <span className="text-lg font-bold font-mono text-amber-200">{minorCount} เครื่อง</span>
                  <span className="text-[10px] text-amber-500 block">รอเปลี่ยนอะไหล่</span>
                </div>

                <div className="p-2.5 rounded border border-orange-800/60 bg-orange-950/30 text-center">
                  <span className="text-xs font-semibold text-orange-400 block">รอซ่อมหนัก</span>
                  <span className="text-lg font-bold font-mono text-orange-200">{majorCount} เครื่อง</span>
                  <span className="text-[10px] text-orange-500 block">รอส่งโรงงาน</span>
                </div>

                <div className="p-2.5 rounded border border-rose-800/60 bg-rose-950/30 text-center">
                  <span className="text-xs font-semibold text-rose-400 block">ชำรุด (แดง)</span>
                  <span className="text-lg font-bold font-mono text-rose-200">{damagedCount} เครื่อง</span>
                  <span className="text-[10px] text-rose-500 block">รอจำหน่าย</span>
                </div>
              </div>

              {/* Capacity & Slot Metrics */}
              <div className="grid grid-cols-3 gap-2 text-xs bg-[#161616] p-3 rounded border border-[#262626] text-[#aaa]">
                <div>
                  <strong className="text-white">จำนวนช่องทั้งหมด:</strong> {totalSlots} ช่อง ({gridCols}x{gridRows})
                </div>
                <div>
                  <strong className="text-white">ใช้งานแล้ว:</strong> {occupiedSlots} ช่อง (ว่าง {emptySlots} ช่อง)
                </div>
                <div>
                  <strong className="text-white">หม้อแปลงทั้งหมด:</strong> {transformers.length} เครื่อง (จุดพัก {unassignedCount})
                </div>
              </div>
            </div>

            {/* Detailed Table Section */}
            <div>
              <h2 className="text-sm font-bold text-white mb-2 border-l-2 border-orange-500 pl-2">
                2. รายการหม้อแปลงไฟฟ้าทุกเครื่องในคลัง
              </h2>

              <div className="overflow-x-auto border border-[#262626] rounded">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#181818] text-[#888] font-semibold border-b border-[#262626]">
                      <th className="py-2 px-2.5 w-10 text-center">ลำดับ</th>
                      <th className="py-2 px-2.5">ช่องวาง</th>
                      <th className="py-2 px-2.5">รหัส PEA</th>
                      <th className="py-2 px-2.5">S/N</th>
                      <th className="py-2 px-2.5">ขนาด</th>
                      <th className="py-2 px-2.5">ยี่ห้อ</th>
                      <th className="py-2 px-2.5 text-center">สถานะ</th>
                      <th className="py-2 px-2.5">วันที่รับเข้า</th>
                      <th className="py-2 px-2.5">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#202020]">
                    {sortedTransformers.map((t, idx) => {
                      const st = STATUS_CONFIG[t.status];
                      return (
                        <tr key={t.id} className="hover:bg-[#161616]">
                          <td className="py-2 px-2.5 text-center text-[#666] font-mono">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-2.5 font-bold font-mono text-orange-400">
                            {t.locationType === 'repair'
                              ? `🚚 ส่งซ่อม ${t.repairVendor ? `(${t.repairVendor})` : ''}`
                              : t.locationType === 'triage'
                              ? '🔍 รอคัดแยก'
                              : t.slotNumber
                              ? `${config.zonePrefix || config.leftGrid?.zonePrefix || 'A'} ${String(t.slotNumber).padStart(2, '0')}`
                              : 'จุดพักรอ'}
                          </td>
                          <td className="py-2 px-2.5 font-semibold font-mono text-white">
                            {t.peaNo}
                          </td>
                          <td className="py-2 px-2.5 text-[#888] font-mono">
                            {t.serialNo}
                          </td>
                          <td className="py-2 px-2.5 font-mono text-[#ccc]">
                            {t.capacityKva} kVA ({t.phase === '3-Phase' ? '3P' : '1P'})
                          </td>
                          <td className="py-2 px-2.5 text-[#aaa]">
                            {cleanBrandToEnglish(t.brand)}
                          </td>
                          <td className="py-2 px-2.5 text-center">
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-bold inline-block"
                              style={{
                                backgroundColor: `${st.hexColor}25`,
                                color: st.hexColor,
                                border: `1px solid ${st.hexColor}40`
                              }}
                            >
                              {st.label}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-[#777] font-mono">
                            {t.receivedDate}
                          </td>
                          <td className="py-2 px-2.5 text-[#777] truncate max-w-[140px]" title={t.notes}>
                            {t.notes || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Official Signature Section */}
            <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs text-[#888]">
              <div>
                <p className="border-b border-[#333] pb-1 mb-2 w-48 mx-auto"></p>
                <p className="text-[#aaa]">ผู้รายงาน / หัวหน้างานคลังหม้อแปลง</p>
                <p className="text-[#555] text-[11px] mt-0.5">วันที่ ......./......./.......</p>
              </div>
              <div>
                <p className="border-b border-[#333] pb-1 mb-2 w-48 mx-auto"></p>
                <p className="text-[#aaa]">ผู้ตรวจสอบ / ผู้จัดการแผนกหม้อแปลง</p>
                <p className="text-[#555] text-[11px] mt-0.5">วันที่ ......./......./.......</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
