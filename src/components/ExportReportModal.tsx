import React, { useState } from 'react';
import { Transformer, WarehouseConfig, getStatusConfig } from '../types';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#eff2ee] rounded-2xl shadow-xl border border-[#c6d1cb] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ccd6d0] bg-[#e2e8e4] shrink-0">
          <div>
            <h3 className="text-lg font-bold text-[#1f2b27] tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#6850a1]" />
              รายงานสรุปสถานะหม้อแปลงไฟฟ้าและผังคลัง
            </h3>
            <p className="text-xs text-[#4e5d56] mt-0.5">
              พรีวิวรายงานและส่งออกในรูปแบบไฟล์ Excel (.xlsx) และ PDF
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#4e5d56] hover:text-[#1f2b27] hover:bg-[#d5ded9] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="px-6 py-3 bg-[#e7ece9] border-b border-[#ccd6d0] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* Excel Export */}
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-[#4b9977] hover:bg-[#3f8566] text-[#f5f4ef] text-xs font-bold rounded-xl shadow-2xs transition-colors"
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
                className="flex items-center gap-2 px-3.5 py-1.5 bg-[#f5e4d8] hover:bg-[#edd6c7] text-[#6e3012] border border-[#e3bba3] text-xs font-bold rounded-xl shadow-2xs transition-colors"
              >
                <Webhook className="w-4 h-4 text-[#b85a2b]" />
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
                className="flex items-center gap-2 px-3.5 py-1.5 bg-[#deefe7] hover:bg-[#d0e6dc] text-[#21523c] border border-[#b4d9c7] text-xs font-bold rounded-xl shadow-2xs transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#388262]" />
                <span>Google Sheets (OAuth)</span>
              </button>
            )}

            {/* Direct PDF Export */}
            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-[#6850a1] hover:bg-[#58428c] text-[#f5f4ef] text-xs font-bold rounded-xl shadow-2xs transition-colors disabled:opacity-50"
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
              className="flex items-center gap-2 px-3.5 py-1.5 bg-[#f4f3ee] hover:bg-[#e5ebe7] text-[#2b3b35] border border-[#c2cdc7] text-xs font-bold rounded-xl shadow-2xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              พิมพ์ / พรีวิว (Print)
            </button>
          </div>

          {exportSuccess && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#21523c] bg-[#dceee5] border border-[#b0d8c5] px-3 py-1 rounded-xl animate-in fade-in">
              <CheckCircle className="w-4 h-4" />
              <span>{exportSuccess}</span>
            </div>
          )}
        </div>

        {/* Printable & Scrollable Report Container */}
        <div className="p-6 overflow-y-auto flex-1 bg-[#dce3df]">
          <div
            id="printable-report-content"
            className="bg-[#f4f3ee] text-[#222e2a] p-8 rounded-2xl shadow-sm border border-[#c6d1cb] space-y-6 max-w-3xl mx-auto"
          >
            {/* Official Report Header */}
            <div className="text-center border-b-2 border-[#8e78c4] pb-4">
              <span className="text-xs font-mono font-semibold text-[#5e4591] uppercase tracking-widest">
                การไฟฟ้าส่วนภูมิภาค (PEA)
              </span>
              <h1 className="text-xl font-bold text-[#1f2b27] mt-1">
                รายงานสรุปสถานะหม้อแปลงไฟฟ้าและผังคลังประจำวัน
              </h1>
              <p className="text-sm text-[#3d4b45] font-medium mt-1">
                {config.warehouseName}
              </p>
              <p className="text-xs text-[#5a6962] font-mono mt-1">
                วันที่พิมพ์รายงาน: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            {/* Summary Statistics Section */}
            <div>
              <h2 className="text-sm font-bold text-[#1f2b27] mb-2 border-l-3 border-[#6850a1] pl-2">
                1. สรุปภาพรวมสถานะและพื้นที่จัดเก็บ
              </h2>

              {/* Status Breakdown 4-Color Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                <div className="p-2.5 rounded-xl border border-[#b8dccb] bg-[#e1f0e9] text-center">
                  <span className="text-xs font-semibold text-[#21523c] block">ดี (เขียว)</span>
                  <span className="text-lg font-bold font-mono text-[#18422f]">{goodCount} เครื่อง</span>
                  <span className="text-[10px] text-[#356b52] block">พร้อมจ่ายใช้งาน</span>
                </div>

                <div className="p-2.5 rounded-xl border border-[#e3cca1] bg-[#f6ebd5] text-center">
                  <span className="text-xs font-semibold text-[#66480f] block">รอซ่อมเล็กน้อย</span>
                  <span className="text-lg font-bold font-mono text-[#52390a]">{minorCount} เครื่อง</span>
                  <span className="text-[10px] text-[#785716] block">รอเปลี่ยนอะไหล่</span>
                </div>

                <div className="p-2.5 rounded-xl border border-[#e8bfa8] bg-[#f8e4d9] text-center">
                  <span className="text-xs font-semibold text-[#6e3012] block">รอซ่อมหนัก</span>
                  <span className="text-lg font-bold font-mono text-[#57240b]">{majorCount} เครื่อง</span>
                  <span className="text-[10px] text-[#803b19] block">รอส่งโรงงาน</span>
                </div>

                <div className="p-2.5 rounded-xl border border-[#e3b6bc] bg-[#f6dfe2] text-center">
                  <span className="text-xs font-semibold text-[#692028] block">ชำรุด (แดง)</span>
                  <span className="text-lg font-bold font-mono text-[#52161d]">{damagedCount} เครื่อง</span>
                  <span className="text-[10px] text-[#7d2a33] block">รอจำหน่าย</span>
                </div>
              </div>

              {/* Capacity & Slot Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-[#e8edea] p-3 rounded-xl border border-[#cbd5cf] text-[#45544d]">
                <div>
                  <strong className="text-[#1f2b27]">จำนวนช่องทั้งหมด:</strong> {totalSlots} ช่อง ({gridCols}x{gridRows})
                </div>
                <div>
                  <strong className="text-[#1f2b27]">ใช้งานแล้ว:</strong> {occupiedSlots} ช่อง (ว่าง {emptySlots} ช่อง)
                </div>
                <div>
                  <strong className="text-[#1f2b27]">หม้อแปลงทั้งหมด:</strong> {transformers.length} เครื่อง (จุดพัก {unassignedCount})
                </div>
              </div>
            </div>

            {/* Detailed Table Section */}
            <div>
              <h2 className="text-sm font-bold text-[#1f2b27] mb-2 border-l-3 border-[#6850a1] pl-2">
                2. รายการหม้อแปลงไฟฟ้าทุกเครื่องในคลัง
              </h2>

              <div className="overflow-x-auto border border-[#cbd5cf] rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#e3e8e5] text-[#45544d] font-semibold border-b border-[#cbd5cf]">
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
                  <tbody className="divide-y divide-[#dce3df]">
                    {sortedTransformers.map((t, idx) => {
                      const st = getStatusConfig(t?.status);
                      return (
                        <tr key={t.id} className="hover:bg-[#ebeae2]">
                          <td className="py-2 px-2.5 text-center text-[#5c6b64] font-mono">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-2.5 font-bold font-mono text-[#523b85]">
                            {t.locationType === 'repair'
                              ? `🚚 ส่งซ่อม ${t.repairVendor ? `(${t.repairVendor})` : ''}`
                              : t.locationType === 'triage'
                              ? '🔍 รอคัดแยก'
                              : t.locationType === 'sale'
                              ? '🏷️ รอขาย'
                              : t.slotNumber
                              ? `${config.zonePrefix || config.leftGrid?.zonePrefix || 'A'} ${String(t.slotNumber).padStart(2, '0')}`
                              : 'จุดพักรอ'}
                          </td>
                          <td className="py-2 px-2.5 font-semibold font-mono text-[#1f2b27]">
                            {t.peaNo}
                          </td>
                          <td className="py-2 px-2.5 text-[#4e5d56] font-mono">
                            {t.serialNo}
                          </td>
                          <td className="py-2 px-2.5 font-mono text-[#2d3b36]">
                            {t.capacityKva} kVA ({t.phase === '3-Phase' ? '3P' : '1P'})
                          </td>
                          <td className="py-2 px-2.5 text-[#3d4b45]">
                            {cleanBrandToEnglish(t.brand)}
                          </td>
                          <td className="py-2 px-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold inline-block ${st.badgeBg} ${st.badgeText}`}
                            >
                              {st.label}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-[#4e5d56] font-mono">
                            {t.receivedDate}
                          </td>
                          <td className="py-2 px-2.5 text-[#4e5d56] truncate max-w-[140px]" title={t.notes}>
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
            <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs text-[#4e5d56]">
              <div>
                <p className="border-b border-[#aebcb5] pb-1 mb-2 w-48 mx-auto"></p>
                <p className="text-[#2d3b36] font-medium">ผู้รายงาน / หัวหน้างานคลังหม้อแปลง</p>
                <p className="text-[#5e6e67] text-[11px] mt-0.5">วันที่ ......./......./.......</p>
              </div>
              <div>
                <p className="border-b border-[#aebcb5] pb-1 mb-2 w-48 mx-auto"></p>
                <p className="text-[#2d3b36] font-medium">ผู้ตรวจสอบ / ผู้จัดการแผนกหม้อแปลง</p>
                <p className="text-[#5e6e67] text-[11px] mt-0.5">วันที่ ......./......./.......</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
