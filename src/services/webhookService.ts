import { Transformer, WarehouseConfig, STATUS_CONFIG } from '../types';
import { cleanBrandToEnglish, normalizePeaNo } from '../utils/customOptions';

/**
 * Default embedded Webhook URL for Google Sheets integration
 */
export const DEFAULT_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbytQFoURJi_gnFC8-c_1gzdBJ1aUJ2aqrzqeRDX1I_dXrYd_pxMv2um0yCgxic5CF6Y/exec';

export interface WebhookLogEntry {
  id: string;
  timestamp: string;
  url: string;
  event: string;
  status: 'success' | 'error' | 'pending';
  responseSummary?: string;
  recordCount: number;
}

export interface WebhookPayload {
  event: 'sync_all' | 'test' | 'transformer_created' | 'transformer_updated' | 'transformer_moved' | 'transformer_deleted';
  timestamp: string;
  source: string;
  warehouse: {
    name: string;
    columns: number;
    rows: number;
    totalSlots: number;
    zonePrefix: string;
  };
  summary: {
    totalTransformers: number;
    inWarehouseSlots: number;
    inHoldingArea: number;
    emptySlots: number;
    occupancyPercentage: number;
    byStatus: {
      good: number;
      minorRepair: number;
      majorRepair: number;
      damaged: number;
    };
  };
  transformers: Array<{
    peaNo: string;
    serialNo: string;
    brand: string;
    capacityKva: number;
    phase: string;
    voltage?: string;
    status: string;
    statusLabel: string;
    slotNumber: number | null;
    locationName: string;
    receivedDate: string;
    updatedAt: string;
    notes?: string;
  }>;
  gridSlots: Array<{
    slotNumber: number;
    zoneCoordinate: string;
    isOccupied: boolean;
    transformerPeaNo: string | null;
    transformerKva: number | null;
    transformerStatus: string | null;
  }>;
}

/**
 * Prepares the standardized JSON payload for Webhooks
 */
export function buildWebhookPayload(
  transformers: Transformer[],
  config: WarehouseConfig,
  event: WebhookPayload['event'] = 'sync_all'
): WebhookPayload {
  const totalSlots = config.columns * config.rows;
  const inWarehouse = transformers.filter((t) => t.slotNumber !== null);
  const inHolding = transformers.filter((t) => t.slotNumber === null);

  const slotMap = new Map<number, Transformer>();
  transformers.forEach((t) => {
    if (t.slotNumber !== null) slotMap.set(t.slotNumber, t);
  });

  const gridSlots: WebhookPayload['gridSlots'] = [];
  for (let s = 1; s <= totalSlots; s++) {
    const t = slotMap.get(s);
    gridSlots.push({
      slotNumber: s,
      zoneCoordinate: `${config.zonePrefix} ${s}`,
      isOccupied: !!t,
      transformerPeaNo: t ? t.peaNo : null,
      transformerKva: t ? t.capacityKva : null,
      transformerStatus: t ? STATUS_CONFIG[t.status]?.label || t.status : null,
    });
  }

  const good = transformers.filter((t) => t.status === 'good').length;
  const minorRepair = transformers.filter((t) => t.status === 'minor_repair').length;
  const majorRepair = transformers.filter((t) => t.status === 'major_repair').length;
  const damaged = transformers.filter((t) => t.status === 'damaged').length;

  return {
    event,
    timestamp: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
    source: 'PEA Transformer Warehouse App',
    warehouse: {
      name: config.warehouseName,
      columns: config.columns,
      rows: config.rows,
      totalSlots,
      zonePrefix: config.zonePrefix,
    },
    summary: {
      totalTransformers: transformers.length,
      inWarehouseSlots: inWarehouse.length,
      inHoldingArea: inHolding.length,
      emptySlots: totalSlots - inWarehouse.length,
      occupancyPercentage: totalSlots > 0 ? Math.round((inWarehouse.length / totalSlots) * 100) : 0,
      byStatus: {
        good,
        minorRepair,
        majorRepair,
        damaged,
      },
    },
    transformers: transformers.map((t) => ({
      peaNo: t.peaNo,
      serialNo: t.serialNo,
      brand: cleanBrandToEnglish(t.brand),
      capacityKva: t.capacityKva,
      phase: t.phase,
      voltage: t.voltage,
      status: t.status,
      statusLabel: STATUS_CONFIG[t.status]?.label || t.status,
      slotNumber: t.slotNumber,
      locationName: t.slotNumber !== null ? `${config.zonePrefix} ช่อง ${t.slotNumber}` : 'จุดพักรอจัดเก็บ',
      receivedDate: t.receivedDate,
      updatedAt: t.updatedAt,
      notes: t.notes || '',
    })),
    gridSlots,
  };
}

export interface WebhookValidationResult {
  isValid: boolean;
  type: 'valid_exec' | 'google_sheet_link' | 'edit_link' | 'dev_link' | 'generic_webhook' | 'invalid';
  message: string;
  advice?: string;
}

/**
 * Validates the Webhook URL format and detects common user configuration mistakes
 */
export function validateWebhookUrl(url: string): WebhookValidationResult {
  const clean = (url || '').trim();
  if (!clean) {
    return {
      isValid: false,
      type: 'invalid',
      message: 'ยังไม่ได้ระบุ Webhook URL',
      advice: 'กรุณาระบุ URL ของ Webhook ที่ต้องการส่งข้อมูล',
    };
  }

  // 1. User pasted Google Sheet URL directly instead of Webhook URL
  if (clean.includes('docs.google.com/spreadsheets')) {
    return {
      isValid: false,
      type: 'google_sheet_link',
      message: 'URL นี้เป็นลิงก์ Google Sheet ไม่ใช่ Webhook URL',
      advice: 'กรุณาเปิดเมนู "ส่วนขยาย (Extensions) > Apps Script" ใน Google Sheet ของคุณ วางโค้ด แล้วกด "Deploy" เพื่อรับ Web app URL',
    };
  }

  // 2. User pasted Script Editor URL (/edit)
  if (clean.includes('script.google.com') && clean.includes('/edit')) {
    return {
      isValid: false,
      type: 'edit_link',
      message: 'URL นี้เป็นหน้าแก้ไขสคริปต์ (/edit)',
      advice: 'กรุณากดปุ่ม "การทำให้ใช้งานได้ (Deploy)" > "การทำให้ใช้งานได้ใหม่ (New deployment)" แล้วคัดลอก URL ของเว็บแอปที่ลงท้ายด้วย /exec',
    };
  }

  // 3. User pasted developer test URL (/dev)
  if (clean.includes('script.google.com') && clean.includes('/dev')) {
    return {
      isValid: false,
      type: 'dev_link',
      message: 'URL นี้ลงท้ายด้วย /dev (โหมดทดสอบนักพัฒนา)',
      advice: 'โหมด /dev ปฏิเสธการเรียกจากภายนอก กรุณากด "Deploy" > "New deployment" แล้วใช้ URL ที่ลงท้ายด้วย /exec',
    };
  }

  // 4. Valid Google Apps Script Exec URL
  if (clean.includes('script.google.com') && clean.includes('/exec')) {
    return {
      isValid: true,
      type: 'valid_exec',
      message: 'URL ของ Google Apps Script Web App ถูกต้องสมบูรณ์ (/exec)',
    };
  }

  // 5. Other Webhook URLs (Make, Zapier, n8n, Custom API)
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return {
      isValid: true,
      type: 'generic_webhook',
      message: 'Webhook URL พร้อมใช้งาน (HTTP/HTTPS Endpoint)',
    };
  }

  return {
    isValid: false,
    type: 'invalid',
    message: 'รูปแบบ URL ไม่ถูกต้อง (ต้องขึ้นต้นด้วย https://)',
  };
}

/**
 * Diagnoses the Webhook URL by attempting a test ping via server proxy or client
 */
export async function diagnoseWebhookUrl(url: string): Promise<{
  success: boolean;
  message: string;
  advice?: string;
  status?: number;
}> {
  const validation = validateWebhookUrl(url);
  if (!validation.isValid) {
    return {
      success: false,
      message: validation.message,
      advice: validation.advice,
    };
  }

  try {
    // 1. Try server-side test endpoint first (bypasses browser CORS & detects Google login)
    const res = await fetch('/api/webhook-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim() }),
    });

    const data = await res.json();
    return {
      success: data.success,
      message: data.message || (data.success ? 'เชื่อมต่อ Webhook สำเร็จ' : 'เชื่อมต่อ Webhook ล้มเหลว'),
      advice: data.advice,
      status: data.status,
    };
  } catch {
    // If /api/webhook-test is unreachable, return client validation
    return {
      success: true,
      message: 'รูปแบบ Webhook URL ถูกต้อง (โหมดตรวจสอบในเบราว์เซอร์)',
    };
  }
}

/**
 * Sends webhook payload to the specified Webhook URL.
 * Automatically tries server-side relay proxy to eliminate CORS & 302 redirect issues,
 * with fallback to client-side dispatch.
 */
export async function sendWebhook(
  url: string,
  payload: WebhookPayload
): Promise<{ success: boolean; message: string; advice?: string; responseData?: any }> {
  const cleanUrl = url.trim();
  const validation = validateWebhookUrl(cleanUrl);
  if (!validation.isValid) {
    return {
      success: false,
      message: validation.message,
      advice: validation.advice,
    };
  }

  // 1. Try sending via Backend Server Proxy first (100% immune to browser CORS & Google 302 redirect issues)
  try {
    const proxyRes = await fetch('/api/webhook-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: cleanUrl,
        payload,
      }),
    });

    const proxyData = await proxyRes.json();
    if (proxyRes.ok && proxyData.success) {
      return {
        success: true,
        message: proxyData.message || 'ส่งข้อมูลไปยัง Google Sheets ผ่าน Webhook สำเร็จเรียบร้อย!',
        responseData: proxyData.responseData,
      };
    } else if (proxyData && proxyData.message) {
      return {
        success: false,
        message: proxyData.message,
        advice: proxyData.advice,
        responseData: proxyData.details,
      };
    }
  } catch (proxyError: any) {
    console.warn('Backend webhook proxy failed or unavailable, falling back to direct client fetch:', proxyError);
  }

  // 2. Fallback: Direct Client Fetch with text/plain (avoids CORS preflight OPTIONS check)
  try {
    const response = await fetch(cleanUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      let json = null;
      try {
        json = await response.json();
      } catch {
        json = null;
      }
      return {
        success: true,
        message: 'ส่งข้อมูลไปยัง Webhook สำเร็จ',
        responseData: json,
      };
    } else {
      return {
        success: false,
        message: `Webhook ตอบกลับด้วยสถานะ: HTTP ${response.status} ${response.statusText}`,
      };
    }
  } catch (error: any) {
    // Fallback for Google Apps Script 302 redirect with CORS restriction (no-cors mode):
    console.warn('Standard direct fetch failed, attempting no-cors fallback:', error);
    try {
      await fetch(cleanUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      return {
        success: true,
        message: 'ส่งข้อมูลไปยัง Webhook เรียบร้อย (โหมดส่งตรงเข้า Google Apps Script)',
      };
    } catch (fallbackError: any) {
      return {
        success: false,
        message: fallbackError.message || 'ไม่สามารถส่งข้อมูลไปยัง Webhook URL นี้ได้ กรุณาตรวจสอบ URL',
        advice: 'ตรวจสอบว่า Apps Script ตั้งค่า "ผู้มีสิทธิ์เข้าถึง (Who has access)" เป็น "ทุกคน (Anyone)" และคัดลอก URL ที่ลงท้ายด้วย /exec',
      };
    }
  }
}

/**
 * Fetches transformers directly from Google Sheets / Webhook via server-side proxy
 * Automatically normalizes PEA numbers to include "TR " prefix in front of transformer number.
 */
export async function fetchTransformersFromSheets(options?: {
  webhookUrl?: string;
  spreadsheetId?: string;
}): Promise<{
  success: boolean;
  transformers: Transformer[];
  message: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  timestamp?: string;
}> {
  let spreadsheetId = options?.spreadsheetId || '';
  const webhookUrl = options?.webhookUrl || DEFAULT_WEBHOOK_URL;

  // If webhookUrl is a Google Sheets link, extract spreadsheetId directly
  if (!spreadsheetId && webhookUrl && webhookUrl.includes('docs.google.com/spreadsheets')) {
    const match = webhookUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      spreadsheetId = match[1];
    }
  }

  // 1. Try backend proxy first
  try {
    const res = await fetch('/api/sheets-pull', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhookUrl,
        spreadsheetId,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.transformers)) {
        const mappedTransformers: Transformer[] = data.transformers.map((t: any) => ({
          ...t,
          peaNo: normalizePeaNo(t.peaNo),
          brand: cleanBrandToEnglish(t.brand || 'Other'),
        }));

        return {
          success: true,
          transformers: mappedTransformers,
          message: data.message || `ดึงข้อมูลสำเร็จ ${mappedTransformers.length} เครื่อง`,
          spreadsheetId: data.spreadsheetId,
          spreadsheetUrl: data.spreadsheetUrl,
          timestamp: data.timestamp,
        };
      }
    }
  } catch (backendError) {
    console.warn('Backend /api/sheets-pull error, trying direct client GViz fallback:', backendError);
  }

  // 2. Direct Client-Side Fallback via Google Visualization API (GViz)
  try {
    const targetSheetId = spreadsheetId || '1VJ9T6ZGGeE7wMZQoloseELmepX5qJWC5QUMRNRgXfco';
    const candidateSheets = [
      'ข้อมูลหม้อแปลง',
      'ข้อมูลหม้อแปลงทั้งหมด',
      'แผ่นงาน1',
      'แผ่นงาน 1',
      'Sheet1',
      'Sheet 1',
      'หม้อแปลง',
      'หม้อแปลงไฟฟ้า',
      'คลังหม้อแปลง',
      'Data',
    ];

    let csvText = '';
    const cacheBuster = Date.now();

    for (const sName of candidateSheets) {
      try {
        const gvizUrl = `https://docs.google.com/spreadsheets/d/${targetSheetId}/gviz/tq?tqx=out:csv;reqId:${cacheBuster}&sheet=${encodeURIComponent(
          sName
        )}&_=${cacheBuster}`;
        const gvizResp = await fetch(gvizUrl, {
          signal: AbortSignal.timeout(5000),
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
          },
        });
        if (gvizResp.ok) {
          const txt = await gvizResp.text();
          if (txt && txt.length > 50 && !txt.includes('<!DOCTYPE html>')) {
            csvText = txt;
            break;
          }
        }
      } catch {
        // try next tab
      }
    }

    if (!csvText) {
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${targetSheetId}/gviz/tq?tqx=out:csv;reqId:${cacheBuster}&_=${cacheBuster}`;
      const gvizResp = await fetch(gvizUrl, {
        signal: AbortSignal.timeout(5000),
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });
      if (gvizResp.ok) {
        const txt = await gvizResp.text();
        if (txt && !txt.includes('<!DOCTYPE html>')) {
          csvText = txt;
        }
      }
    }

    if (!csvText || csvText.includes('<!DOCTYPE html>')) {
      throw new Error('Google Sheets ไม่เปิดสาธารณะ หรือต้องให้สิทธิ์เข้าถึง "ทุกคนที่มีลิงก์มีสิทธิ์อ่าน"');
    }

    // Helper for parsing CSV row
    const parseCsvRow = (line: string): string[] => {
      const result: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (c === ',' && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      result.push(cur.trim());
      return result;
    };

    // Split rows safely
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length <= 1) {
      return {
        success: true,
        transformers: [],
        message: 'เชื่อมต่อ Google Sheets สำเร็จ (ยังไม่มีรายการหม้อแปลงในชีต)',
        spreadsheetId: targetSheetId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${targetSheetId}/edit`,
        timestamp: new Date().toLocaleTimeString('th-TH'),
      };
    }

    // Dynamic header indexing
    const headerRow = parseCsvRow(lines[0]).map((h) => (h || '').trim().toLowerCase());
    let peaCol = -1;
    let snCol = -1;
    let brandCol = -1;
    let kvaCol = -1;
    let phaseCol = -1;
    let voltCol = -1;
    let statusCol = -1;
    let locationCol = -1;
    let dateCol = -1;
    let updateCol = -1;
    let notesCol = -1;

    headerRow.forEach((h, idx) => {
      if (h.includes('pea') || h.includes('รหัส') || h.includes('หมายเลข')) {
        if (peaCol === -1) peaCol = idx;
      } else if (h.includes('serial') || h.includes('s/n') || h.includes('sn') || h.includes('ซีเรียล')) {
        if (snCol === -1) snCol = idx;
      } else if (h.includes('ยี่ห้อ') || h.includes('brand') || h.includes('ผู้ผลิต')) {
        if (brandCol === -1) brandCol = idx;
      } else if (h.includes('kva') || h.includes('ขนาด') || h.includes('กำลัง')) {
        if (kvaCol === -1) kvaCol = idx;
      } else if (h.includes('เฟส') || h.includes('phase')) {
        if (phaseCol === -1) phaseCol = idx;
      } else if (h.includes('แรงดัน') || h.includes('volt') || h.includes('kv')) {
        if (voltCol === -1) voltCol = idx;
      } else if (h.includes('สถานะ') || h.includes('status') || h.includes('สภาพ')) {
        if (statusCol === -1) statusCol = idx;
      } else if (h.includes('ตำแหน่ง') || h.includes('location') || h.includes('ช่อง') || h.includes('โซน')) {
        if (locationCol === -1) locationCol = idx;
      } else if (h.includes('รับเข้า') || h.includes('date') || h.includes('วันที่')) {
        if (dateCol === -1) dateCol = idx;
      } else if (h.includes('อัปเดต') || h.includes('แก้ไข') || h.includes('update')) {
        if (updateCol === -1) updateCol = idx;
      } else if (h.includes('หมายเหตุ') || h.includes('note') || h.includes('remark') || h.includes('รายละเอียด')) {
        if (notesCol === -1) notesCol = idx;
      }
    });

    const hasOrderCol = headerRow[0]?.includes('ลำดับ') || headerRow[0]?.includes('no') || headerRow[0] === '#';
    const offset = hasOrderCol ? 1 : 0;
    if (peaCol === -1) peaCol = offset;
    if (snCol === -1) snCol = offset + 1;
    if (brandCol === -1) brandCol = offset + 2;
    if (kvaCol === -1) kvaCol = offset + 3;
    if (phaseCol === -1) phaseCol = offset + 4;
    if (voltCol === -1) voltCol = offset + 5;
    if (statusCol === -1) statusCol = offset + 6;
    if (locationCol === -1) locationCol = offset + 7;
    if (dateCol === -1) dateCol = offset + 8;
    if (updateCol === -1) updateCol = offset + 9;
    if (notesCol === -1) notesCol = offset + 10;

    const dataRows = lines.slice(1);
    const parsedTransformers: Transformer[] = [];

    dataRows.forEach((line, idx) => {
      const row = parseCsvRow(line);
      if (!row || row.length < 2) return;
      const rawPeaNo = (row[peaCol] || '').trim();
      if (!rawPeaNo || rawPeaNo === 'รหัส PEA No.' || rawPeaNo.toLowerCase() === 'pea no.') return;

      const peaNo = normalizePeaNo(rawPeaNo);
      const serialNo = (row[snCol] || `SN-${idx + 1}`).trim();
      const brand = cleanBrandToEnglish(row[brandCol] || 'Other');
      const capacityKva = parseInt(((row[kvaCol] || '50').replace(/[^0-9]/g, '')), 10) || 50;
      const phaseStr = (row[phaseCol] || '').toLowerCase();
      const phase = phaseStr.includes('1') ? '1-Phase' : '3-Phase';
      const voltage = (row[voltCol] || '22 kV / 400-230 V').trim();

      const statusStr = (row[statusCol] || '').toLowerCase();
      let status: 'good' | 'minor_repair' | 'major_repair' | 'damaged' = 'good';
      if (
        statusStr.includes('เล็กน้อย') ||
        statusStr.includes('minor') ||
        statusStr.includes('เหลือง') ||
        statusStr.includes('yellow')
      ) {
        status = 'minor_repair';
      } else if (
        statusStr.includes('หนัก') ||
        statusStr.includes('major') ||
        statusStr.includes('ส้ม') ||
        statusStr.includes('orange')
      ) {
        status = 'major_repair';
      } else if (
        statusStr.includes('ซาก') ||
        statusStr.includes('จำหน่าย') ||
        statusStr.includes('damaged') ||
        statusStr.includes('แดง') ||
        statusStr.includes('red') ||
        statusStr.includes('ชำรุด') ||
        statusStr.includes('เสียหาย')
      ) {
        status = 'damaged';
      }

      const locStr = (row[locationCol] || '').trim();
      let slotNumber: number | null = null;
      let locationType: 'grid' | 'holding' | 'triage' | 'repair' | 'sale' = 'grid';
      const slotMatch = locStr.match(/(\d+)/);
      if (slotMatch) {
        slotNumber = parseInt(slotMatch[1], 10);
        locationType = 'grid';
      } else if (locStr.includes('พัก') || locStr.includes('holding')) {
        locationType = 'holding';
      } else if (locStr.includes('คัดแยก') || locStr.includes('triage')) {
        locationType = 'triage';
      } else if (locStr.includes('ซ่อม') || locStr.includes('repair')) {
        locationType = 'repair';
      } else if (locStr.includes('รอจำหน่าย') || locStr.includes('sale') || locStr.includes('ประมูล')) {
        locationType = 'sale';
      }

      parsedTransformers.push({
        id: `tr-direct-${idx + 1}`,
        peaNo,
        serialNo,
        brand,
        capacityKva,
        phase,
        voltage,
        status,
        slotNumber,
        locationType,
        receivedDate: (row[dateCol] || new Date().toISOString().split('T')[0]).trim(),
        updatedAt: (row[updateCol] || new Date().toISOString().split('T')[0]).trim(),
        notes: (row[notesCol] || '').trim(),
      });
    });

    return {
      success: true,
      transformers: parsedTransformers,
      message: `ดึงข้อมูลจาก Google Sheets สำเร็จ (${parsedTransformers.length} เครื่อง)`,
      spreadsheetId: targetSheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${targetSheetId}/edit`,
      timestamp: new Date().toLocaleTimeString('th-TH'),
    };
  } catch (error: any) {
    console.error('Error in direct GViz client fallback:', error);
    return {
      success: false,
      transformers: [],
      message: error.message || 'ไม่สามารถดึงข้อมูลจาก Google Sheets ได้',
    };
  }
}

/**
 * Copies transformers data to clipboard in Tab-Separated Values (TSV) format
 * Users can paste (Ctrl+V) directly into Google Sheets or Excel without any script or setup!
 */
export async function copyTransformersToClipboard(
  transformers: Transformer[],
  config: WarehouseConfig
): Promise<boolean> {
  const headers = [
    'ลำดับ',
    'รหัส PEA No.',
    'Serial No.',
    'ยี่ห้อ (Brand)',
    'ขนาด (kVA)',
    'เฟส (Phase)',
    'แรงดัน (Voltage)',
    'สถานะหม้อแปลง',
    'ตำแหน่งจัดเก็บ',
    'วันที่รับเข้า',
    'อัปเดตล่าสุด',
    'หมายเหตุ',
  ];

  const rows = transformers.map((t, idx) => {
    const loc = t.slotNumber !== null ? `${config.zonePrefix} ช่อง ${t.slotNumber}` : 'จุดพักรอจัดเก็บ';
    return [
      idx + 1,
      t.peaNo || '',
      t.serialNo || '',
      cleanBrandToEnglish(t.brand || ''),
      t.capacityKva || '',
      t.phase === '3-Phase' ? '3 เฟส' : '1 เฟส',
      t.voltage || '22 kV',
      STATUS_CONFIG[t.status]?.label || t.status,
      loc,
      t.receivedDate || '',
      t.updatedAt || '',
      (t.notes || '').replace(/[\r\n\t]+/g, ' '),
    ].join('\t');
  });

  const tsvText = [headers.join('\t'), ...rows].join('\n');
  try {
    await navigator.clipboard.writeText(tsvText);
    return true;
  } catch {
    // Fallback for iframe restrictions
    const textArea = document.createElement('textarea');
    textArea.value = tsvText;
    document.body.appendChild(textArea);
    textArea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    return success;
  }
}

/**
 * Bulletproof Google Apps Script (GAS) code template that users can paste into Google Sheets
 * - Supports both Container-bound scripts AND Standalone scripts (via SPREADSHEET_ID_OR_URL)
 * - Safe from undefined cell crash (Range.setValues exception)
 * - Correct column auto-resize (sheet.autoResizeColumn(c))
 * - doGet(e) for instant browser link verification
 * - Dynamic row/column capacity expansion
 */
export const GOOGLE_APPS_SCRIPT_TEMPLATE = `/**
 * =========================================================================
 * PEA Transformer Warehouse - Webhook Receiver for Google Sheets
 * ระบบรับข้อมูลหม้อแปลงไฟฟ้าและผังคลังเข้าสู่ Google Sheets อัตโนมัติ (เวอร์ชันเสถียรสูงสุด)
 * =========================================================================
 * 
 * วิธีติดตั้งใน 3 ขั้นตอน (ใช้เวลา 1 นาที):
 * 1. เปิด Google Sheet ที่ต้องการเก็บข้อมูล
 * 2. เมนูด้านบนเลือก: ส่วนขยาย (Extensions) > Apps Script
 * 3. ลบโค้ดเดิมทั้งหมด วางโค้ดชุดนี้ลงไป แล้วกด บันทึก (Save ไอคอนแผ่นดิสก์)
 * 4. กดปุ่มสีน้ำเงินมุมขวาบน "การทำให้ใช้งานได้ (Deploy)" > "การทำให้ใช้งานได้ใหม่ (New deployment)"
 *    - คลิกรูปฟันเฟือง เลือกประเภท: "เว็บแอป (Web app)"
 *    - คำอธิบาย: Webhook ระบบคลังหม้อแปลง PEA
 *    - เรียกใช้งานในฐานะ (Execute as): "ฉัน (Me)"
 *    - ผู้มีสิทธิ์เข้าถึง (Who has access): เลือก "ทุกคน (Anyone)" ***สำคัญที่สุด ต้องเลือก Anyone เท่านั้น***
 *    - กดปุ่ม "Deploy" (หากมีหน้าต่างสิทธิ์ ให้กด Advanced/ขั้นสูง > Go to ... (unsafe) > Allow/อนุญาต)
 *    - คัดลอก "URL ของเว็บแอป" ที่ลงท้ายด้วย /exec นำมาวางในโปรแกรม!
 * 
 * *** ข้อควรระวัง: หากมีการแก้ไขโค้ดในภายหลัง ต้องกด Deploy > Manage deployments > Edit > New version ทุกครั้ง ***
 */

// กรณีสร้าง Apps Script แยกต่างหาก (script.google.com) ให้นำ URL หรือ ID ของ Google Sheet มาใส่ที่นี่:
// (หากเปิดจากเมนู ส่วนขยาย > Apps Script จากใน Google Sheet อยู่แล้ว ให้ปล่อยว่างไว้)
var SPREADSHEET_ID_OR_URL = "";

/**
 * ฟังก์ชันค้นหาและเปิด Google Spreadsheet ปลายทาง
 */
function getSpreadsheet() {
  if (typeof SPREADSHEET_ID_OR_URL !== 'undefined' && SPREADSHEET_ID_OR_URL && SPREADSHEET_ID_OR_URL.trim() !== "") {
    var idOrUrl = SPREADSHEET_ID_OR_URL.trim();
    if (idOrUrl.indexOf("http") === 0) {
      return SpreadsheetApp.openByUrl(idOrUrl);
    } else {
      return SpreadsheetApp.openById(idOrUrl);
    }
  }
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error("ไม่พบ Google Sheet! หากสร้างสคริปต์แยก ให้ใส่ลิงก์ชีตในตัวแปร SPREADSHEET_ID_OR_URL หรือเปิดจากเมนู ส่วนขยาย > Apps Script ใน Google Sheet");
}

/**
 * ฟังก์ชันเขียนข้อมูลลง Sheet แบบปลอดภัย 100% (ป้องกัน Range.setValues ล้มเหลว)
 */
function writeRowsToSheet(sheet, rows, headerBgColor) {
  if (!rows || rows.length === 0) return;
  sheet.clear();
  var numRows = rows.length;
  var numCols = rows[0].length;

  // 1. ตรวจสอบและขยายจำนวนแถว/คอลัมน์ให้พอดี
  var curRows = sheet.getMaxRows();
  if (curRows < numRows) {
    sheet.insertRowsAfter(curRows, numRows - curRows);
  }
  var curCols = sheet.getMaxColumns();
  if (curCols < numCols) {
    sheet.insertColumnsAfter(curCols, numCols - curCols);
  }

  // 2. แปลงค่า undefined/null ให้เป็นค่าว่าง ป้องกัน GAS exception
  var cleanRows = [];
  for (var r = 0; r < numRows; r++) {
    var cleanRow = [];
    for (var c = 0; c < numCols; c++) {
      var val = rows[r][c];
      cleanRow.push((val === undefined || val === null) ? "" : val);
    }
    cleanRows.push(cleanRow);
  }

  // 3. บันทึกข้อมูล
  sheet.getRange(1, 1, numRows, numCols).setValues(cleanRows);

  // 4. จัดแต่งรูปแบบหัวตาราง (Header)
  var headerRange = sheet.getRange(1, 1, 1, numCols);
  headerRange.setBackground(headerBgColor);
  headerRange.setFontColor("#ffffff");
  headerRange.setFontWeight("bold");
  try { sheet.setFrozenRows(1); } catch (e) {}

  // 5. ปรับความกว้างคอลัมน์อัตโนมัติ
  for (var col = 1; col <= numCols; col++) {
    try { sheet.autoResizeColumn(col); } catch (e) {}
  }
}

/**
 * รองรับการทดสอบเปิด Webhook URL ผ่านเบราว์เซอร์ (GET Request)
 */
function doGet(e) {
  try {
    var ss = getSpreadsheet();
    return ContentService.createTextOutput(JSON.stringify({
      status: "ready",
      message: "Webhook ระบบคลังหม้อแปลง PEA พร้อมใช้งาน!",
      spreadsheetName: ss.getName(),
      spreadsheetUrl: ss.getUrl(),
      timestamp: new Date().toLocaleString("th-TH")
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * รับข้อมูล Webhook จากโปรแกรมคลังหม้อแปลง (POST Request)
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.tryLock(30000);
  } catch (lockErr) {}
  
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "ไม่พบข้อมูลที่ส่งมา (e.postData.contents ว่างเปล่า)"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var data = JSON.parse(e.postData.contents);
    var ss = getSpreadsheet();

    // =========================================================
    // 1. แผ่นงาน: ข้อมูลหม้อแปลง
    // =========================================================
    var sheetTransformers = ss.getSheetByName("ข้อมูลหม้อแปลง");
    if (!sheetTransformers) {
      sheetTransformers = ss.insertSheet("ข้อมูลหม้อแปลง");
    }

    var headers = [
      "ลำดับ", "รหัส PEA No.", "Serial No.", "ยี่ห้อ", "ขนาด (kVA)",
      "เฟส", "แรงดัน", "สถานะ", "ตำแหน่งจัดเก็บ", "วันที่รับเข้า", "อัปเดตล่าสุด", "หมายเหตุ"
    ];
    var rows = [headers];

    if (data.transformers && data.transformers.length > 0) {
      data.transformers.forEach(function(t, idx) {
        rows.push([
          idx + 1,
          t.peaNo || "",
          t.serialNo || "",
          t.brand || "",
          t.capacityKva || "",
          t.phase || "",
          t.voltage || "",
          t.statusLabel || t.status || "",
          t.locationName || "",
          t.receivedDate || "",
          t.updatedAt || "",
          t.notes || ""
        ]);
      });
    }
    writeRowsToSheet(sheetTransformers, rows, "#1b5e20");

    // =========================================================
    // 2. แผ่นงาน: ผังคลังและสถานะช่อง
    // =========================================================
    var sheetGrid = ss.getSheetByName("ผังคลังและสถานะช่อง");
    if (!sheetGrid) {
      sheetGrid = ss.insertSheet("ผังคลังและสถานะช่อง");
    }

    var gridHeaders = ["ช่องที่", "พิกัด/โซน", "สถานะช่อง", "รหัส PEA", "ขนาด (kVA)", "สถานะหม้อแปลง"];
    var gridRows = [gridHeaders];

    if (data.gridSlots && data.gridSlots.length > 0) {
      data.gridSlots.forEach(function(s) {
        gridRows.push([
          s.slotNumber,
          s.zoneCoordinate || "",
          s.isOccupied ? "มีหม้อแปลง" : "ว่าง",
          s.transformerPeaNo || "-",
          s.transformerKva || "-",
          s.transformerStatus || "-"
        ]);
      });
    }
    writeRowsToSheet(sheetGrid, gridRows, "#e65100");

    // =========================================================
    // 3. แผ่นงาน: สรุปสถิติคลัง
    // =========================================================
    var sheetSummary = ss.getSheetByName("สรุปสถิติคลัง");
    if (!sheetSummary) {
      sheetSummary = ss.insertSheet("สรุปสถิติคลัง");
    }

    var sumRows = [
      ["หัวข้อสถิติคลังสินค้า", "จำนวน", "หน่วย / รายละเอียด"],
      ["ชื่อคลัง", data.warehouse ? data.warehouse.name : "คลังหม้อแปลง", "ความจุ " + (data.warehouse ? data.warehouse.totalSlots : 0) + " ช่อง"],
      ["หม้อแปลงทั้งหมดในระบบ", data.summary ? data.summary.totalTransformers : 0, "เครื่อง"],
      ["อยู่ในผังคลัง (จัดเก็บแล้ว)", data.summary ? data.summary.inWarehouseSlots : 0, "เครื่อง (" + (data.summary ? data.summary.occupancyPercentage : 0) + "%)"],
      ["ช่องว่างในคลังคงเหลือ", data.summary ? data.summary.emptySlots : 0, "ช่อง"],
      ["จุดพักรอจัดเก็บ (Holding)", data.summary ? data.summary.inHoldingArea : 0, "เครื่อง"],
      ["สถานะ: ดี (สีเขียว)", data.summary && data.summary.byStatus ? data.summary.byStatus.good : 0, "เครื่อง"],
      ["สถานะ: รอซ่อมเล็กน้อย (สีเหลือง)", data.summary && data.summary.byStatus ? data.summary.byStatus.minorRepair : 0, "เครื่อง"],
      ["สถานะ: รอซ่อมหนัก (สีส้ม)", data.summary && data.summary.byStatus ? data.summary.byStatus.majorRepair : 0, "เครื่อง"],
      ["สถานะ: ชำรุด (สีแดง)", data.summary && data.summary.byStatus ? data.summary.byStatus.damaged : 0, "เครื่อง"],
      ["อัปเดตล่าสุดผ่าน Webhook", data.timestamp || new Date().toLocaleString("th-TH"), "บันทึกเรียบร้อย"]
    ];
    writeRowsToSheet(sheetSummary, sumRows, "#0d47a1");

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "บันทึกข้อมูลเข้า Google Sheets สำเร็จเรียบร้อย!",
      spreadsheetName: ss.getName(),
      transformersCount: data.transformers ? data.transformers.length : 0,
      timestamp: new Date().toLocaleString("th-TH")
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "เกิดข้อผิดพลาดในการประมวลผล: " + err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}
`;
