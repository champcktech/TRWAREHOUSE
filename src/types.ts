export type TransformerStatus = 'good' | 'minor_repair' | 'major_repair' | 'damaged';

export type WarehouseZoneId = 'left' | 'right';
export type TransformerLocationType = 'grid' | 'holding' | 'triage' | 'repair' | 'sale';

export interface GridZoneConfig {
  columns: number; // เช่น 4 หรือ 5 คอลัมน์
  rows: number;    // เช่น 12 หรือ 14 แถว
  name: string;    // เช่น จุดวางหม้อแปลง (ฝั่งซ้าย)
  zonePrefix: string; // เช่น 'A' หรือ 'B'
}

export interface WarehouseConfig {
  warehouseName: string;
  // Main grid config
  columns: number;
  rows: number;
  zonePrefix: string;
  name?: string;
  // Optional zone configs for backwards compatibility
  leftGrid?: GridZoneConfig;
  rightGrid?: GridZoneConfig;
}

export interface Transformer {
  id: string;
  peaNo: string;        // รหัส PEA เช่น PEA 01-1234
  serialNo: string;     // S/N
  capacityKva: number;  // ขนาด เช่น 50, 100, 160, 250, 500 kVA
  phase: '1-Phase' | '3-Phase';
  voltage?: string;     // เช่น 22 kV / 400-230 V
  brand: string;        // ยี่ห้อ เช่น เอกรัฐ (Ekarat), ถิรไทย (Tirathai), เจริญชัย (Charoenchai)
  status: TransformerStatus;
  slotNumber: number | null; // เลขช่องในผัง (null = อยู่ในจุดพักคลัง/ยังไม่ได้ลงช่อง)
  zone?: WarehouseZoneId;    // โซนซ้าย ('left') หรือ ขวา ('right')
  locationType?: TransformerLocationType; // 'grid' = ในช่องผัง, 'holding' = จุดพักรอจัดเก็บ, 'triage' = จุดรอคัดแยก, 'repair' = ส่งซ่อมภายนอก, 'sale' = จุดวางรอขาย
  receivedDate: string; // วันที่รับเข้า
  notes?: string;       // หมายเหตุ เช่น หม้อแปลงส่งคืนจากงานขยายเขต, น้ำมันรั่วซึม
  repairVendor?: string; // สถานที่/โรงงานที่ส่งซ่อม เช่น เอกรัฐ, ถิรไทย
  repairSentDate?: string; // วันที่ส่งซ่อม
  repairDocNo?: string; // เลขที่เอกสาร/ใบส่งซ่อม
  repairExpectedReturn?: string; // กำหนดส่งคืนโดยประมาณ
  updatedAt: string;
}

export const STATUS_CONFIG: Record<TransformerStatus, {
  label: string;
  colorName: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  badgeBg: string;
  badgeText: string;
  hexColor: string;
  darkHex: string;
  description: string;
}> = {
  good: {
    label: 'ดี',
    colorName: 'เขียว',
    bgClass: 'bg-emerald-500',
    borderClass: 'border-emerald-600',
    textClass: 'text-emerald-400',
    badgeBg: 'bg-emerald-950/70 border border-emerald-800/80',
    badgeText: 'text-emerald-300',
    hexColor: '#10b981',
    darkHex: '#065f46',
    description: 'สภาพพร้อมใช้งาน ตรวจสอบผ่านเกณฑ์'
  },
  minor_repair: {
    label: 'รอซ่อมเล็กน้อย',
    colorName: 'เหลือง',
    bgClass: 'bg-yellow-500',
    borderClass: 'border-yellow-600',
    textClass: 'text-yellow-400',
    badgeBg: 'bg-yellow-950/70 border border-yellow-800/80',
    badgeText: 'text-yellow-300',
    hexColor: '#eab308',
    darkHex: '#854d0e',
    description: 'มีอาการเล็กน้อย เช่น ปะเก็นซึม ลูกถ้วยร้าว รออะไหล่'
  },
  major_repair: {
    label: 'รอซ่อมหนัก',
    colorName: 'ส้ม',
    bgClass: 'bg-orange-500',
    borderClass: 'border-orange-600',
    textClass: 'text-orange-400',
    badgeBg: 'bg-orange-950/70 border border-orange-800/80',
    badgeText: 'text-orange-300',
    hexColor: '#f97316',
    darkHex: '#9a3412',
    description: 'ขดลวดชำรุด แกนเหล็กมีปัญหา ต้องส่งโรงงานซ่อมใหญ่'
  },
  damaged: {
    label: 'ชำรุด',
    colorName: 'แดง',
    bgClass: 'bg-rose-600',
    borderClass: 'border-rose-700',
    textClass: 'text-rose-400',
    badgeBg: 'bg-rose-950/70 border border-rose-800/80',
    badgeText: 'text-rose-300',
    hexColor: '#e11d48',
    darkHex: '#881337',
    description: 'ชำรุดหนัก ไม่คุ้มค่าซ่อม หรือรอตัดจำหน่าย'
  }
};
