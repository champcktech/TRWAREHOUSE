import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Transformer, STATUS_CONFIG, getStatusConfig, WarehouseConfig } from '../types';
import { cleanBrandToEnglish } from './customOptions';

export function exportToExcel(
  transformers: Transformer[],
  config: WarehouseConfig
) {
  // 1. Prepare Summary Data
  const totalCount = transformers.length;
  const goodCount = transformers.filter(t => t.status === 'good').length;
  const minorCount = transformers.filter(t => t.status === 'minor_repair').length;
  const majorCount = transformers.filter(t => t.status === 'major_repair').length;
  const damagedCount = transformers.filter(t => t.status === 'damaged').length;

  const gridCols = config.columns || config.leftGrid?.columns || 4;
  const gridRows = config.rows || config.leftGrid?.rows || 14;
  const totalSlots = gridCols * gridRows;
  const occupiedSlots = transformers.filter(t => (t.locationType === 'grid' || (!t.locationType && t.slotNumber !== null)) && t.slotNumber !== null).length;
  const emptySlots = totalSlots - occupiedSlots;
  const unassignedCount = transformers.filter(t => t.slotNumber === null).length;

  const repairCount = transformers.filter(t => t.locationType === 'repair').length;
  const triageCount = transformers.filter(t => t.locationType === 'triage').length;
  const saleCount = transformers.filter(t => t.locationType === 'sale').length;
  const holdingCount = transformers.filter(t => t.slotNumber === null && t.locationType !== 'triage' && t.locationType !== 'repair' && t.locationType !== 'sale').length;

  const summaryRows = [
    { 'หัวข้อสรุป': 'ชื่อคลัง', 'ข้อมูล': config.warehouseName },
    { 'หัวข้อสรุป': 'วันที่ออกรายงาน', 'ข้อมูล': new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) },
    { 'หัวข้อสรุป': 'จำนวนช่องวางทั้งหมดในผัง', 'ข้อมูล': `${totalSlots} ช่อง` },
    { 'หัวข้อสรุป': 'ช่องที่มีหม้อแปลงวางอยู่', 'ข้อมูล': `${occupiedSlots} ช่อง` },
    { 'หัวข้อสรุป': 'ช่องว่างพร้อมใช้งาน', 'ข้อมูล': `${emptySlots} ช่อง` },
    { 'หัวข้อสรุป': 'หม้อแปลงในจุดพักรอจัดเก็บ', 'ข้อมูล': `${holdingCount} เครื่อง` },
    { 'หัวข้อสรุป': 'หม้อแปลงในจุดรอคัดแยก', 'ข้อมูล': `${triageCount} เครื่อง` },
    { 'หัวข้อสรุป': 'หม้อแปลงในจุดวางรอขาย', 'ข้อมูล': `${saleCount} เครื่อง` },
    { 'หัวข้อสรุป': 'หม้อแปลงส่งซ่อมภายนอก (โรงงาน)', 'ข้อมูล': `${repairCount} เครื่อง` },
    { 'หัวข้อสรุป': 'จำนวนหม้อแปลงทั้งหมดในระบบ', 'ข้อมูล': `${totalCount} เครื่อง` },
    { 'หัวข้อสรุป': '', 'ข้อมูล': '' },
    { 'หัวข้อสรุป': '--- สรุปตามสถานะ ---', 'ข้อมูล': '--- จำนวน (เครื่อง) ---' },
    { 'หัวข้อสรุป': `สถานะ ดี (สี${STATUS_CONFIG.good.colorName})`, 'ข้อมูล': `${goodCount} เครื่อง (${totalCount ? Math.round((goodCount/totalCount)*100) : 0}%)` },
    { 'หัวข้อสรุป': `สถานะ รอซ่อมเล็กน้อย (สี${STATUS_CONFIG.minor_repair.colorName})`, 'ข้อมูล': `${minorCount} เครื่อง (${totalCount ? Math.round((minorCount/totalCount)*100) : 0}%)` },
    { 'หัวข้อสรุป': `สถานะ รอซ่อมหนัก (สี${STATUS_CONFIG.major_repair.colorName})`, 'ข้อมูล': `${majorCount} เครื่อง (${totalCount ? Math.round((majorCount/totalCount)*100) : 0}%)` },
    { 'หัวข้อสรุป': `สถานะ ชำรุด (สี${STATUS_CONFIG.damaged.colorName})`, 'ข้อมูล': `${damagedCount} เครื่อง (${totalCount ? Math.round((damagedCount/totalCount)*100) : 0}%)` },
  ];

  // 2. Prepare Detailed Transformers Data (sorted by slot number)
  const sortedTransformers = [...transformers].sort((a, b) => {
    if (a.slotNumber === null && b.slotNumber === null) return 0;
    if (a.slotNumber === null) return 1;
    if (b.slotNumber === null) return -1;
    return a.slotNumber - b.slotNumber;
  });

  const detailRows = sortedTransformers.map((t, idx) => {
    let locLabel = 'จุดพักรอจัดเก็บ';
    if (t.locationType === 'repair') {
      locLabel = `ส่งซ่อม (${t.repairVendor || 'ภายนอก'})`;
    } else if (t.locationType === 'triage') {
      locLabel = 'จุดรอคัดแยก';
    } else if (t.locationType === 'sale') {
      locLabel = 'จุดวางรอขาย';
    } else if (t.slotNumber !== null) {
      const prefix = config.zonePrefix || config.leftGrid?.zonePrefix || 'A';
      locLabel = `${prefix} ${String(t.slotNumber).padStart(2, '0')}`;
    }

    return {
      'ลำดับ': idx + 1,
      'ตำแหน่ง': locLabel,
      'รหัส PEA': t.peaNo,
      'Serial Number (S/N)': t.serialNo,
      'ขนาด (kVA)': t.capacityKva,
      'ระบบเฟส': t.phase,
      'พิกัดแรงดัน': t.voltage || '22 kV / 400-230 V',
      'ยี่ห้อ': cleanBrandToEnglish(t.brand),
      'สถานะ': getStatusConfig(t?.status).label,
      'สีสถานะ': getStatusConfig(t?.status).colorName,
      'โรงงานส่งซ่อม': t.repairVendor || '-',
      'วันที่ส่งซ่อม': t.repairSentDate || '-',
      'เลขที่ใบส่งซ่อม': t.repairDocNo || '-',
      'กำหนดส่งคืน': t.repairExpectedReturn || '-',
      'วันที่รับเข้า': t.receivedDate,
      'หมายเหตุ/อาการ': t.notes || '-',
      'อัปเดตล่าสุด': t.updatedAt
    };
  });

  // 3. Create Workbook
  const wb = XLSX.utils.book_new();

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  const wsDetails = XLSX.utils.json_to_sheet(detailRows);

  // Set column widths
  wsSummary['!cols'] = [{ wch: 35 }, { wch: 35 }];
  wsDetails['!cols'] = [
    { wch: 8 },  // ลำดับ
    { wch: 18 }, // ช่อง
    { wch: 18 }, // รหัส PEA
    { wch: 20 }, // S/N
    { wch: 12 }, // ขนาด
    { wch: 12 }, // เฟส
    { wch: 22 }, // แรงดัน
    { wch: 22 }, // ยี่ห้อ
    { wch: 16 }, // สถานะ
    { wch: 10 }, // สี
    { wch: 14 }, // วันที่รับเข้า
    { wch: 35 }, // หมายเหตุ
    { wch: 14 }, // อัปเดตล่าสุด
  ];

  XLSX.utils.book_append_sheet(wb, wsSummary, 'สรุปสถานะหม้อแปลง');
  XLSX.utils.book_append_sheet(wb, wsDetails, 'รายการหม้อแปลงทั้งหมด');

  const today = new Date().toISOString().slice(0, 10);
  const fileName = `รายงานสถานะหม้อแปลง_${today}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

export async function exportReportToPDF(elementId: string, filename = 'รายงานผังคลังและสถานะหม้อแปลง.pdf') {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Report element not found');
  }

  // Use html2canvas to render full high-DPI document
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff'
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pdfWidth;
  const imgHeight = (canvas.height * pdfWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  // First page
  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pdfHeight;

  // Multi-page support if report is longer than 1 page
  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;
  }

  pdf.save(filename);
}
