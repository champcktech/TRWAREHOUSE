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
