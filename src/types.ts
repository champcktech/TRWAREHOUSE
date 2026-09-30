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
  brand: string;        // ยี่ห้อ (ภาษาอังกฤษ เช่น Ekarat, Tirathai, Charoenchai, Precise, QTC, Schneider, ABB)
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

export interface StatusConfigItem {
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
}

const RAW_STATUS_CONFIG: Record<TransformerStatus, StatusConfigItem> = {
  good: {
    label: 'ดี',
    colorName: 'เขียว',
    bgClass: 'bg-[#68b996]',
    borderClass: 'border-[#99d1b8]',
    textClass: 'text-[#245942]',
    badgeBg: 'bg-[#e1f0e9] border border-[#b8dccb]',
    badgeText: 'text-[#21523c]',
    hexColor: '#68b996',
    darkHex: '#4b9977',
    description: 'สภาพพร้อมใช้งาน ตรวจสอบผ่านเกณฑ์'
  },
  minor_repair: {
    label: 'รอซ่อมเล็กน้อย',
    colorName: 'เหลือง',
    bgClass: 'bg-[#e6b85c]',
    borderClass: 'border-[#ebd096]',
    textClass: 'text-[#6e4f12]',
    badgeBg: 'bg-[#f6ebd5] border border-[#e3cca1]',
    badgeText: 'text-[#66480f]',
    hexColor: '#e6b85c',
    darkHex: '#c99738',
    description: 'มีอาการเล็กน้อย เช่น ปะเก็นซึม ลูกถ้วยร้าว รออะไหล่'
  },
  major_repair: {
    label: 'รอซ่อมหนัก',
    colorName: 'ส้ม',
    bgClass: 'bg-[#eb966a]',
    borderClass: 'border-[#f0bba0]',
    textClass: 'text-[#753516]',
    badgeBg: 'bg-[#f8e4d9] border border-[#e8bfa8]',
    badgeText: 'text-[#6e3012]',
    hexColor: '#eb966a',
    darkHex: '#cc7245',
    description: 'ขดลวดชำรุด แกนเหล็กมีปัญหา ต้องส่งโรงงานซ่อมใหญ่'
  },
  damaged: {
    label: 'ชำรุด',
    colorName: 'แดง',
    bgClass: 'bg-[#e38690]',
    borderClass: 'border-[#ebb3b9]',
    textClass: 'text-[#70242d]',
    badgeBg: 'bg-[#f6dfe2] border border-[#e3b6bc]',
    badgeText: 'text-[#692028]',
    hexColor: '#e38690',
    darkHex: '#c25d68',
    description: 'ชำรุดหนัก ไม่คุ้มค่าซ่อม หรือรอตัดจำหน่าย'
  }
};

/**
 * Normalizes any status input (including Thai strings, legacy values, or undefined)
 * to a valid TransformerStatus key.
 */
export function normalizeTransformerStatus(status?: any): TransformerStatus {
  if (!status) return 'good';
  const s = String(status).trim().toLowerCase();
  if (
    s.includes('ซาก') ||
    s.includes('จำหน่าย') ||
    s.includes('damaged') ||
    s.includes('แดง') ||
    s.includes('red') ||
    s.includes('ชำรุด') ||
    s.includes('เสียหาย') ||
    s.includes('scrap')
  ) {
    return 'damaged';
  }
  if (
    s.includes('หนัก') ||
    s.includes('major') ||
    s.includes('ส้ม') ||
    s.includes('orange')
  ) {
    return 'major_repair';
  }
  if (
    s.includes('เล็กน้อย') ||
    s.includes('minor') ||
    s.includes('เหลือง') ||
    s.includes('yellow') ||
    s.includes('ซ่อม') ||
    s.includes('repair')
  ) {
    return 'minor_repair';
  }
  return 'good';
}

/**
 * Safely returns the StatusConfigItem for any status input.
 * Guarantees that .label, .colorName, etc. are never undefined!
 */
export function getStatusConfig(status?: any): StatusConfigItem {
  const norm = normalizeTransformerStatus(status);
  return RAW_STATUS_CONFIG[norm] || RAW_STATUS_CONFIG.good;
}

/**
 * Robust STATUS_CONFIG object with Proxy fallback so that any property lookup
 * (e.g. STATUS_CONFIG[t.status], STATUS_CONFIG['available'], STATUS_CONFIG[undefined])
 * will always return a valid StatusConfigItem with `.label` defined.
 */
export const STATUS_CONFIG: Record<TransformerStatus, StatusConfigItem> & Record<string, StatusConfigItem> = new Proxy(
  RAW_STATUS_CONFIG as any,
  {
    get(target, prop) {
      if (typeof prop === 'string') {
        if (prop in target) {
          return target[prop];
        }
        return getStatusConfig(prop);
      }
      return target.good;
    }
  }
);
