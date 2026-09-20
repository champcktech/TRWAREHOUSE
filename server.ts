import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory debug log for tracking webhook traffic & responses
interface WebhookLog {
  id: string;
  timestamp: string;
  url: string;
  method: string;
  status?: number;
  statusText?: string;
  success: boolean;
  message: string;
  advice?: string;
  responsePreview?: string;
  payloadSummary?: string;
  error?: string;
}

const webhookLogs: WebhookLog[] = [];

function addWebhookLog(log: Omit<WebhookLog, 'id' | 'timestamp'>) {
  const entry: WebhookLog = {
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toLocaleTimeString('th-TH'),
    ...log,
  };
  webhookLogs.unshift(entry);
  if (webhookLogs.length > 30) {
    webhookLogs.pop();
  }
  return entry;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Sheets Pull Endpoint:
  // Pulls transformers directly from Google Sheets or Google Apps Script Webhook
  app.all('/api/sheets-pull', async (req, res) => {
    const webhookUrl = (req.body?.webhookUrl || req.query?.webhookUrl || '') as string;
    let spreadsheetId = (req.body?.spreadsheetId || req.query?.spreadsheetId || '') as string;

    // Helper to normalize PEA number so that TR is always in front of the number
    function normalizePeaNo(pea: string): string {
      if (!pea) return '';
      const trimmed = pea.trim();
      if (!trimmed) return '';
      if (/^PEA[\s-_]*TR[\s-_]*/i.test(trimmed)) {
        const numPart = trimmed.replace(/^PEA[\s-_]*TR[\s-_]*/i, '').trim();
        return `TR ${numPart}`;
      }
      if (/^TR[\s-_]*/i.test(trimmed)) {
        const numPart = trimmed.replace(/^TR[\s-_]*/i, '').trim();
        return `TR ${numPart}`;
      }
      if (/^PEA[\s-_]*/i.test(trimmed)) {
        const numPart = trimmed.replace(/^PEA[\s-_]*/i, '').trim();
        return `TR ${numPart}`;
      }
      return `TR ${trimmed}`;
    }

    // Helper to clean brand name into English
    function cleanBrandToEnglish(brandName: string): string {
      if (!brandName) return 'Other';
      const match = brandName.match(/\(([^)]+)\)/);
      if (match && match[1]) return match[1].trim();
      const mapping: Record<string, string> = {
        'เอกรัฐ': 'Ekarat',
        'ถิรไทย': 'Tirathai',
        'เจริญชัย': 'Charoenchai',
        'พรีไซซ': 'Precise',
        'คิวทีซี': 'QTC',
        'เอเชีย แทรฟโฟ': 'Asia Trafo',
        'หม้อแปลงไทย': 'Thai Trafo',
        'บางกอกเทรโฟ': 'Bangkok Trafo',
        'เอบีบี': 'ABB',
        'ชไนเดอร์': 'Schneider',
        'ซีเมนส์': 'Siemens',
        'อื่นๆ': 'Other',
      };
      for (const [thai, eng] of Object.entries(mapping)) {
        if (brandName.includes(thai)) return eng;
      }
      const stripped = brandName.replace(/[\u0E00-\u0E7F]+/g, '').trim();
      return stripped || brandName;
    }

    function parseCsvLine(line: string): string[] {
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
    }

    try {
      // 1. If spreadsheetId is directly a Google Sheets URL or ID, extract it
      if (spreadsheetId) {
        const match = spreadsheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
          spreadsheetId = match[1];
        }
      }

      // 1b. If webhookUrl is actually a Google Sheets URL, extract spreadsheetId directly
      if (!spreadsheetId && webhookUrl && webhookUrl.includes('docs.google.com/spreadsheets')) {
        const match = webhookUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
          spreadsheetId = match[1];
        }
      }

      // 2. If no spreadsheetId yet, check webhookUrl or default webhook
      const targetWebhookUrl =
        (webhookUrl && !webhookUrl.includes('docs.google.com/spreadsheets') && webhookUrl.trim()) ||
        'https://script.google.com/macros/s/AKfycbytQFoURJi_gnFC8-c_1gzdBJ1aUJ2aqrzqeRDX1I_dXrYd_pxMv2um0yCgxic5CF6Y/exec';

      // If we don't have a spreadsheetId, ping Webhook with GET (with 4-second timeout to avoid hanging)
      if (!spreadsheetId && targetWebhookUrl) {
        try {
          const webhookResp = await fetch(targetWebhookUrl, {
            method: 'GET',
            redirect: 'follow',
            signal: AbortSignal.timeout(4000),
          });
          if (webhookResp.ok) {
            const webhookText = await webhookResp.text();
            try {
              const webhookData = JSON.parse(webhookText);
              // If webhook directly returned transformers array
              if (
                webhookData.transformers &&
                Array.isArray(webhookData.transformers) &&
                webhookData.transformers.length > 0
              ) {
                const mapped = webhookData.transformers.map((t: any, idx: number) => ({
                  id: `sheet-${Date.now()}-${idx}`,
                  peaNo: normalizePeaNo(t.peaNo),
                  serialNo: t.serialNo || `SN-${idx + 1}`,
                  brand: cleanBrandToEnglish(t.brand || 'Other'),
                  capacityKva: Number(t.capacityKva) || 50,
                  phase: t.phase && String(t.phase).includes('1') ? '1-Phase' : '3-Phase',
                  voltage: t.voltage || '22 kV / 400-230 V',
                  status:
                    t.status === 'minor_repair' || (t.status && (t.status.includes('เล็กน้อย') || t.status.includes('minor')))
                      ? 'minor_repair'
                      : t.status === 'major_repair' || (t.status && (t.status.includes('หนัก') || t.status.includes('major')))
                      ? 'major_repair'
                      : t.status === 'damaged' || (t.status && (t.status.includes('ชำรุด') || t.status.includes('ซาก') || t.status.includes('จำหน่าย')))
                      ? 'damaged'
                      : 'good',
                  slotNumber:
                    typeof t.slotNumber === 'number'
                      ? t.slotNumber
                      : typeof t.slot === 'number'
                      ? t.slot
                      : null,
                  locationType: t.locationType || (t.slotNumber ? 'grid' : 'holding'),
                  notes: t.notes || '',
                  receivedDate: t.receivedDate || new Date().toISOString().split('T')[0],
                  updatedAt: t.updatedAt || new Date().toISOString().split('T')[0],
                }));

                addWebhookLog({
                  url: targetWebhookUrl,
                  method: 'GET (Sheets Pull)',
                  status: 200,
                  statusText: 'OK',
                  success: true,
                  message: `ดึงข้อมูลจาก Apps Script สำเร็จ (${mapped.length} เครื่อง)`,
                  payloadSummary: `ดึงข้อมูลหม้อแปลง ${mapped.length} เครื่อง`,
                });

                return res.json({
                  success: true,
                  count: mapped.length,
                  transformers: mapped,
                  source: 'webhook_json',
                  timestamp: new Date().toLocaleTimeString('th-TH'),
                });
              }

              if (webhookData.spreadsheetUrl) {
                const match = webhookData.spreadsheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
                if (match && match[1]) {
                  spreadsheetId = match[1];
                }
              }
            } catch {
              // Ignore json parse error and continue
            }
          }
        } catch (webhookErr) {
          console.warn('[Sheets-Pull] Webhook GET ping warning:', webhookErr);
        }
      }

      // Default fallback spreadsheet ID
      if (!spreadsheetId) {
        spreadsheetId = '1VJ9T6ZGGeE7wMZQoloseELmepX5qJWC5QUMRNRgXfco';
      }

      // 3. Fetch CSV from Google Sheets via Google Visualization API (GViz)
      // Try sheet tabs: Thai & English common names
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
      let usedSheetName = '';

      for (const sName of candidateSheets) {
        try {
          // Add cachebuster to prevent Google from returning stale cached data
          const cacheBuster = Date.now();
          const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv;reqId:${cacheBuster}&sheet=${encodeURIComponent(
            sName
          )}&_=${cacheBuster}`;
          const gvizResp = await fetch(gvizUrl, {
            redirect: 'follow',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              Pragma: 'no-cache',
            },
            signal: AbortSignal.timeout(5000),
          });
          if (gvizResp.ok) {
            const txt = await gvizResp.text();
            if (txt && txt.length > 50 && !txt.includes('<!DOCTYPE html>')) {
              csvText = txt;
              usedSheetName = sName;
              break;
            }
          }
        } catch (sheetErr) {
          console.warn(`[Sheets-Pull] Failed tab ${sName}:`, sheetErr);
        }
      }

      // If specific tab names failed, try querying default sheet without &sheet= param
      if (!csvText) {
        try {
          const cacheBuster = Date.now();
          const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv;reqId:${cacheBuster}&_=${cacheBuster}`;
          const gvizResp = await fetch(gvizUrl, {
            redirect: 'follow',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              Pragma: 'no-cache',
            },
            signal: AbortSignal.timeout(5000),
          });
          if (gvizResp.ok) {
            const txt = await gvizResp.text();
            if (txt && txt.length > 50 && !txt.includes('<!DOCTYPE html>')) {
              csvText = txt;
              usedSheetName = 'DefaultSheet';
            }
          }
        } catch (sheetErr) {
          console.warn('[Sheets-Pull] Failed default tab fetch:', sheetErr);
        }
      }

      if (!csvText) {
        return res.status(404).json({
          success: false,
          message: 'ไม่สามารถดึงข้อมูล CSV จาก Google Sheets ได้ (กรุณาตรวจสอบว่าแชร์ชีต หรือเปิดการเข้าถึง "ทุกคนที่มีลิงก์มีสิทธิ์อ่าน")',
        });
      }

      const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        return res.json({
          success: true,
          count: 0,
          transformers: [],
          spreadsheetId,
          sheetName: usedSheetName,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
          timestamp: new Date().toLocaleTimeString('th-TH'),
          message: 'แผ่นงานใน Google Sheets ยังไม่มีข้อมูลหม้อแปลง (พร้อมรับข้อมูลใหม่)',
        });
      }

      // Dynamic header mapping from Row 0 to support any column ordering or missing "ลำดับ" column
      const headerRow = parseCsvLine(lines[0]).map((h) => (h || '').trim().toLowerCase());
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

      // Fallback indices if header names didn't match
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
      const parsedTransformers: any[] = [];

      dataRows.forEach((line, idx) => {
        const row = parseCsvLine(line);
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

        // Parse status with proper precedence (minor & major BEFORE damaged!)
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
        } else {
          status = 'good';
        }

        // Parse location & slot
        const locationStr = (row[locationCol] || '').trim();
        let slotNumber: number | null = null;
        let locationType: 'grid' | 'holding' | 'triage' | 'repair' | 'sale' = 'grid';

        if (locationStr.includes('คัดแยก') || locationStr.includes('triage')) {
          locationType = 'triage';
          slotNumber = null;
        } else if (
          locationStr.includes('ส่งซ่อม') ||
          locationStr.includes('repair') ||
          locationStr.includes('โรงงาน')
        ) {
          locationType = 'repair';
          slotNumber = null;
        } else if (
          locationStr.includes('รอขาย') ||
          locationStr.includes('sale') ||
          locationStr.includes('ประมูล')
        ) {
          locationType = 'sale';
          slotNumber = null;
        } else if (locationStr.includes('พักรอ') || locationStr.includes('holding')) {
          locationType = 'holding';
          slotNumber = null;
        } else {
          const match = locationStr.match(/\b([0-9]{1,3})\b/);
          if (match && match[1]) {
            slotNumber = parseInt(match[1], 10);
            locationType = 'grid';
          } else {
            slotNumber = null;
            locationType = 'holding';
          }
        }

        const receivedDate = (row[dateCol] || new Date().toISOString().split('T')[0]).trim();
        const updatedAt = (row[updateCol] || new Date().toISOString().split('T')[0]).trim();
        const notes = (row[notesCol] || '').trim();

        parsedTransformers.push({
          id: `tr-sheet-${idx + 1}`,
          peaNo,
          serialNo,
          brand,
          capacityKva,
          phase,
          voltage,
          status,
          slotNumber,
          locationType,
          receivedDate,
          updatedAt,
          notes,
        });
      });

      addWebhookLog({
        url: `Google Sheet (${spreadsheetId}) [${usedSheetName}]`,
        method: 'GET (Sheets Pull)',
        status: 200,
        statusText: 'OK',
        success: true,
        message: `ดึงข้อมูลจาก Google Sheets สำเร็จ (${parsedTransformers.length} เครื่อง)`,
        payloadSummary: `ดึงข้อมูล ${parsedTransformers.length} เครื่อง จากแผ่นงาน ${usedSheetName}`,
      });

      return res.json({
        success: true,
        count: parsedTransformers.length,
        transformers: parsedTransformers,
        spreadsheetId,
        sheetName: usedSheetName,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
        timestamp: new Date().toLocaleTimeString('th-TH'),
        message: `ดึงข้อมูลจาก Google Sheets สำเร็จ (${parsedTransformers.length} เครื่อง)`,
      });
    } catch (err: any) {
      console.error('[Sheets-Pull Error]:', err);
      return res.status(500).json({
        success: false,
        message: `เกิดข้อผิดพลาดในการดึงข้อมูล: ${err.message}`,
      });
    }
  });

  // API Health Check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Get Webhook Traffic Logs for debugging
  app.get('/api/webhook-logs', (_req, res) => {
    res.json({ logs: webhookLogs });
  });

  // Clear Webhook Traffic Logs
  app.delete('/api/webhook-logs', (_req, res) => {
    webhookLogs.length = 0;
    res.json({ success: true });
  });

  // Webhook Diagnostic & Test endpoint
  app.post('/api/webhook-test', async (req, res) => {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ Webhook URL',
      });
    }

    const cleanUrl = url.trim();

    // 1. Check for common URL pattern mistakes
    if (cleanUrl.includes('docs.google.com/spreadsheets')) {
      return res.status(400).json({
        success: false,
        errorType: 'GOOGLE_SHEET_URL',
        message: 'URL ที่คุณระบุเป็นลิงก์ Google Sheets ไม่ใช่ Webhook URL',
        advice: 'กรุณาเปิดเมนู ส่วนขยาย (Extensions) > Apps Script ใน Google Sheet นั้น วางโค้ด แล้วกด Deploy > New deployment เพื่อรับ Web app URL',
      });
    }

    if (cleanUrl.includes('script.google.com') && cleanUrl.includes('/edit')) {
      return res.status(400).json({
        success: false,
        errorType: 'EDIT_URL',
        message: 'URL ที่คุณระบุเป็นหน้าแก้ไขสคริปต์ (/edit) ไม่ใช่ Webhook URL',
        advice: 'กรุณากดปุ่ม Deploy (การทำให้ใช้งานได้) > New deployment (การทำให้ใช้งานได้ใหม่) แล้วคัดลอก URL ของ Web app ที่ลงท้ายด้วย /exec',
      });
    }

    if (cleanUrl.includes('script.google.com') && cleanUrl.includes('/dev')) {
      return res.status(400).json({
        success: false,
        errorType: 'DEV_URL',
        message: 'URL ที่คุณระบุลงท้ายด้วย /dev (โหมดทดสอบนักพัฒนา)',
        advice: 'โหมด /dev ปฏิเสธการเรียกจากภายนอก กรุณาสร้าง New deployment แล้วใช้ URL ที่ลงท้ายด้วย /exec',
      });
    }

    // 2. Perform diagnostic ping
    try {
      console.log(`[Webhook Diagnostic] Pinging: ${cleanUrl}`);
      const pingResponse = await fetch(cleanUrl, {
        method: 'GET',
        redirect: 'follow',
      });

      const pingStatus = pingResponse.status;
      const pingText = await pingResponse.text();

      // Check if redirected to Google Account login
      if (
        pingText.includes('accounts.google.com') ||
        pingText.includes('Sign in - Google Accounts') ||
        pingText.includes('ServiceLogin')
      ) {
        addWebhookLog({
          url: cleanUrl,
          method: 'GET (Diagnostic)',
          status: 403,
          statusText: 'Auth Required',
          success: false,
          message: 'ติดหน้าล็อกอิน Google (Who has access ไม่ใช่ Anyone)',
          advice: 'ใน Google Apps Script ต้องเลือก Who has access เป็น Anyone (ทุกคน)',
          responsePreview: pingText.slice(0, 150),
        });

        return res.status(403).json({
          success: false,
          errorType: 'AUTH_REQUIRED',
          message: 'Google Apps Script ปฏิเสธการเข้าถึง (ติดหน้าล็อกอิน Google)',
          advice: 'กรุณาเข้าไปที่ Apps Script > Deploy > Manage deployments > Edit > ในส่วน "ผู้มีสิทธิ์เข้าถึง (Who has access)" ต้องเลือกเป็น "ทุกคน (Anyone)" เท่านั้น',
        });
      }

      let parsed = null;
      try {
        parsed = JSON.parse(pingText);
      } catch {
        parsed = null;
      }

      addWebhookLog({
        url: cleanUrl,
        method: 'GET (Diagnostic)',
        status: pingStatus,
        statusText: pingResponse.statusText,
        success: true,
        message: 'ปลายทาง Webhook ตอบสนองปกติ',
        responsePreview: pingText.slice(0, 200),
      });

      return res.json({
        success: true,
        status: pingStatus,
        message: 'เชื่อมต่อไปยัง Webhook URL สำเร็จ ปลายทางตอบสนองเรียบร้อย',
        details: parsed || { preview: pingText.slice(0, 150) },
      });
    } catch (err: any) {
      console.error('[Webhook Diagnostic Error]:', err);
      addWebhookLog({
        url: cleanUrl,
        method: 'GET (Diagnostic)',
        success: false,
        message: `การเชื่อมต่อล้มเหลว: ${err.message}`,
        advice: 'ตรวจสอบว่า URL ถูกต้อง และสามารถเข้าถึงได้จากอินเทอร์เน็ต',
        error: err.message,
      });

      return res.status(500).json({
        success: false,
        message: `ไม่สามารถเชื่อมต่อไปยัง Webhook ได้: ${err.message}`,
        advice: 'กรุณาตรวจสอบว่า URL ถูกต้อง และสามารถเข้าถึงได้จากอินเทอร์เน็ต',
      });
    }
  });

  // Webhook Proxy Endpoint:
  // Relays data to Google Apps Script / external Webhooks securely without browser CORS limitations.
  app.post('/api/webhook-proxy', async (req, res) => {
    const { url, payload } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ Webhook URL',
      });
    }

    const cleanUrl = url.trim();
    const count = payload?.transformers?.length ?? 0;
    const summaryStr = `หม้อแปลง ${count} เครื่อง, คลัง ${payload?.warehouse?.columns ?? 0}x${payload?.warehouse?.rows ?? 0}`;

    // Pattern checks
    if (cleanUrl.includes('docs.google.com/spreadsheets')) {
      return res.status(400).json({
        success: false,
        errorType: 'GOOGLE_SHEET_URL',
        message: 'URL ที่คุณระบุเป็นลิงก์ Google Sheets ไม่ใช่ Webhook URL',
        advice: 'กรุณานำโค้ด Apps Script ไปวางใน Google Sheet > Extensions > Apps Script แล้วกด Deploy เป็น Web app',
      });
    }

    if (cleanUrl.includes('/edit')) {
      return res.status(400).json({
        success: false,
        errorType: 'EDIT_URL',
        message: 'URL ที่ระบุเป็นหน้าแก้ไขสคริปต์ (/edit)',
        advice: 'กรุณากด Deploy > New deployment แล้วใช้ URL ของ Web app ที่ลงท้ายด้วย /exec',
      });
    }

    try {
      console.log(`[Webhook Proxy] Forwarding ${count} transformers to: ${cleanUrl}`);
      const response = await fetch(cleanUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
        redirect: 'follow',
      });

      const status = response.status;
      const responseText = await response.text();
      console.log(`[Webhook Proxy Response] Status: ${status}, Body length: ${responseText.length}`);

      // Check if redirected to Google Account login
      if (
        responseText.includes('accounts.google.com') ||
        responseText.includes('Sign in - Google Accounts') ||
        responseText.includes('ServiceLogin')
      ) {
        addWebhookLog({
          url: cleanUrl,
          method: 'POST',
          status: 403,
          statusText: 'Auth Required',
          success: false,
          message: 'Google Apps Script ติดหน้า Login (ไม่ได้เลือก Anyone)',
          advice: 'กรุณาเข้าไปที่ Deploy > Manage deployments > Edit > เลือก Who has access: Anyone',
          responsePreview: responseText.slice(0, 150),
          payloadSummary: summaryStr,
        });

        return res.status(403).json({
          success: false,
          errorType: 'AUTH_REQUIRED',
          message: 'Google Apps Script ปฏิเสธการเข้าถึง (ติดหน้าล็อกอิน Google)',
          advice: 'กรุณาตั้งค่า "ผู้มีสิทธิ์เข้าถึง (Who has access)" ในการ Deploy เป็น "ทุกคน (Anyone)" เพื่อให้แอปสามารถส่งข้อมูลเข้าชีตได้',
        });
      }

      // Parse JSON from Google Apps Script
      let jsonResult: any = null;
      try {
        jsonResult = JSON.parse(responseText);
      } catch {
        jsonResult = null;
      }

      if (response.ok) {
        if (jsonResult && jsonResult.status === 'error') {
          addWebhookLog({
            url: cleanUrl,
            method: 'POST',
            status,
            statusText: response.statusText,
            success: false,
            message: `GAS รายงานข้อผิดพลาด: ${jsonResult.message}`,
            advice: 'เปิด Apps Script กด View > Executions เพื่อดูรายละเอียดข้อผิดพลาด',
            responsePreview: responseText.slice(0, 200),
            payloadSummary: summaryStr,
          });

          return res.status(400).json({
            success: false,
            message: `Google Apps Script ทำงานไม่สำเร็จ: ${jsonResult.message || 'เกิดข้อผิดพลาดในสคริปต์'}`,
            details: jsonResult,
            advice: 'กรุณาตรวจสอบว่าได้ให้สิทธิ์ (Authorize) สคริปต์ใน Google Sheets เรียบร้อยแล้ว',
          });
        }

        addWebhookLog({
          url: cleanUrl,
          method: 'POST',
          status,
          statusText: response.statusText,
          success: true,
          message: `ส่งข้อมูลสำเร็จ (${count} เครื่อง)`,
          responsePreview: responseText.slice(0, 200),
          payloadSummary: summaryStr,
        });

        return res.json({
          success: true,
          message: 'ส่งข้อมูลไปยัง Google Sheets ผ่าน Webhook สำเร็จเรียบร้อย!',
          receivedCount: jsonResult?.transformersCount ?? jsonResult?.receivedTransformers ?? count,
          timestamp: new Date().toLocaleTimeString('th-TH'),
          responseData: jsonResult || { preview: responseText.slice(0, 150) },
        });
      } else {
        addWebhookLog({
          url: cleanUrl,
          method: 'POST',
          status,
          statusText: response.statusText,
          success: false,
          message: `Webhook ตอบกลับ HTTP ${status}`,
          responsePreview: responseText.slice(0, 200),
          payloadSummary: summaryStr,
        });

        return res.status(status).json({
          success: false,
          message: `Webhook ปลายทางตอบกลับสถานะ HTTP ${status}`,
          details: responseText.slice(0, 200),
        });
      }
    } catch (err: any) {
      console.error('Webhook proxy fetch error:', err);
      addWebhookLog({
        url: cleanUrl,
        method: 'POST',
        success: false,
        message: `ส่งข้อมูลล้มเหลว: ${err.message}`,
        error: err.message,
        payloadSummary: summaryStr,
      });

      return res.status(500).json({
        success: false,
        message: `การส่งข้อมูลไปยัง Webhook ล้มเหลว: ${err.message}`,
        advice: 'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต และตรวจสอบว่า URL ของ Webhook ใช้งานได้',
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
