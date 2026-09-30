import React, { useState, useMemo, useEffect } from 'react';
import { Transformer, WarehouseConfig } from '../types';
import {
  buildWebhookPayload,
  sendWebhook,
  validateWebhookUrl,
  diagnoseWebhookUrl,
  copyTransformersToClipboard,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
  DEFAULT_WEBHOOK_URL,
} from '../services/webhookService';
import {
  X,
  Webhook,
  Send,
  Copy,
  Check,
  Code2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  HelpCircle,
  Activity,
  Trash2,
  Sparkles,
  AlertTriangle,
  Info,
  ShieldAlert,
  ClipboardCheck,
  FileSpreadsheet,
  History,
  RefreshCw,
} from 'lucide-react';

interface WebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  transformers: Transformer[];
  config: WarehouseConfig;
  webhookUrl: string;
  onSaveWebhookUrl: (url: string) => void;
  autoSync: boolean;
  onToggleAutoSync: (enabled: boolean) => void;
  onNotify: (message: string) => void;
  onPullFromSheets?: () => Promise<void>;
  isPullingSheets?: boolean;
}

interface ServerLog {
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
}

export const WebhookModal: React.FC<WebhookModalProps> = ({
  isOpen,
  onClose,
  transformers,
  config,
  webhookUrl,
  onSaveWebhookUrl,
  autoSync,
  onToggleAutoSync,
  onNotify,
  onPullFromSheets,
  isPullingSheets = false,
}) => {
  const [localUrl, setLocalUrl] = useState(webhookUrl);
  const [activeTab, setActiveTab] = useState<'config' | 'guide' | 'logs'>('config');
  const [isSending, setIsSending] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    advice?: string;
    timestamp: string;
  } | null>(null);
  const [hasCopiedCode, setHasCopiedCode] = useState(false);
  const [hasCopiedTable, setHasCopiedTable] = useState(false);
  const [logs, setLogs] = useState<ServerLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Sync localUrl when prop changes
  useEffect(() => {
    setLocalUrl(webhookUrl);
  }, [webhookUrl]);

  // Live validation feedback
  const urlValidation = useMemo(() => {
    return validateWebhookUrl(localUrl);
  }, [localUrl]);

  // Fetch server webhook logs
  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/webhook-logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'logs') {
      fetchLogs();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleSaveUrl = () => {
    onSaveWebhookUrl(localUrl.trim());
    onNotify('บันทึก Webhook URL เรียบร้อยแล้ว');
  };

  const handleCopyTable = async () => {
    const ok = await copyTransformersToClipboard(transformers, config);
    if (ok) {
      setHasCopiedTable(true);
      onNotify('คัดลอกตารางทั้งหมดแล้ว! เปิด Google Sheet แล้วกด Ctrl+V วางได้ทันที');
      setTimeout(() => setHasCopiedTable(false), 3500);
    } else {
      onNotify('ไม่สามารถคัดลอกลงคลิปบอร์ดได้');
    }
  };

  const handleDiagnose = async () => {
    const targetUrl = localUrl.trim();
    if (!targetUrl) {
      setTestResult({
        success: false,
        message: 'กรุณาระบุ Webhook URL ก่อนกดตรวจสอบ',
        timestamp: new Date().toLocaleTimeString('th-TH'),
      });
      return;
    }

    // Auto-save URL for user convenience
    onSaveWebhookUrl(targetUrl);

    setIsDiagnosing(true);
    setTestResult(null);
    try {
      const diag = await diagnoseWebhookUrl(targetUrl);
      setTestResult({
        success: diag.success,
        message: diag.message,
        advice: diag.advice,
        timestamp: new Date().toLocaleTimeString('th-TH'),
      });
      if (diag.success) {
        onNotify('ตรวจสอบการเชื่อมต่อ Webhook สำเร็จ');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'การตรวจสอบ Webhook ล้มเหลว',
        advice: 'ตรวจสอบว่า URL ถูกต้อง และเลือก Who has access: "Anyone (ทุกคน)"',
        timestamp: new Date().toLocaleTimeString('th-TH'),
      });
    } finally {
      setIsDiagnosing(false);
      fetchLogs();
    }
  };

  const handleSendSync = async () => {
    const targetUrl = localUrl.trim();
    if (!targetUrl) {
      setTestResult({
        success: false,
        message: 'กรุณาระบุ Webhook URL ก่อนกดส่ง',
        timestamp: new Date().toLocaleTimeString('th-TH'),
      });
      return;
    }

    if (urlValidation.type === 'google_sheet_link') {
      setTestResult({
        success: false,
        message: 'คุณระบุเป็นลิงก์ Google Sheets ไม่ใช่ Webhook URL',
        advice: urlValidation.advice,
        timestamp: new Date().toLocaleTimeString('th-TH'),
      });
      return;
    }

    // Auto-save URL for user convenience
    onSaveWebhookUrl(targetUrl);

    setIsSending(true);
    setTestResult(null);
    try {
      const payload = buildWebhookPayload(transformers, config, 'sync_all');
      const res = await sendWebhook(targetUrl, payload);
      setTestResult({
        success: res.success,
        message: res.message,
        advice: res.advice,
        timestamp: new Date().toLocaleTimeString('th-TH'),
      });
      if (res.success) {
        onNotify(`ส่งข้อมูลเข้า Google Sheets สำเร็จ! อัปเดต ${transformers.length} เครื่อง`);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'เกิดข้อผิดพลาดในการส่ง Webhook',
        advice: 'กรุณาตรวจสอบว่า URL ลงท้ายด้วย /exec และเลือก Who has access เป็น Anyone',
        timestamp: new Date().toLocaleTimeString('th-TH'),
      });
    } finally {
      setIsSending(false);
      fetchLogs();
    }
  };

  const handleTestPing = async () => {
    const targetUrl = localUrl.trim();
    if (!targetUrl) {
      setTestResult({
        success: false,
        message: 'กรุณาระบุ Webhook URL ก่อนกดทดสอบ',
        timestamp: new Date().toLocaleTimeString('th-TH'),
      });
      return;
    }

    if (urlValidation.type === 'google_sheet_link') {
      setTestResult({
        success: false,
        message: 'คุณระบุเป็นลิงก์ Google Sheets ไม่ใช่ Webhook URL',
        advice: urlValidation.advice,
        timestamp: new Date().toLocaleTimeString('th-TH'),
      });
      return;
    }

    // Auto-save URL for user convenience
    onSaveWebhookUrl(targetUrl);

    setIsSending(true);
    setTestResult(null);
    try {
      const payload = buildWebhookPayload(transformers.slice(0, 1), config, 'test');
      const res = await sendWebhook(targetUrl, payload);
      setTestResult({
        success: res.success,
        message: res.message,
        advice: res.advice,
        timestamp: new Date().toLocaleTimeString('th-TH'),
      });
      if (res.success) {
        onNotify('ทดสอบการเชื่อมต่อ Webhook สำเร็จ');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'การทดสอบ Webhook ล้มเหลว',
        advice: 'ตรวจสอบว่า Apps Script เปิดให้ Anyone เข้าถึงได้',
        timestamp: new Date().toLocaleTimeString('th-TH'),
      });
    } finally {
      setIsSending(false);
      fetchLogs();
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
    setHasCopiedCode(true);
    onNotify('คัดลอกโค้ด Google Apps Script สำเร็จ');
    setTimeout(() => setHasCopiedCode(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#eff2ee] border border-[#c6d1cb] rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ccd6d0] bg-[#e2e8e4]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#e4ddf2] border border-[#c6bae0] flex items-center justify-center text-[#523b85]">
              <Webhook className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1f2b27] tracking-tight flex flex-wrap items-center gap-2">
                ส่งข้อมูลเข้า Google Sheets ผ่าน Webhook
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#dceee5] text-[#21523c] border border-[#b0d8c5] font-mono">
                  Google Apps Script
                </span>
              </h3>
              <p className="text-xs text-[#4e5d56]">
                ส่งข้อมูลหม้อแปลงและสถานะผังคลังเข้า Google Sheets ได้อัตโนมัติ สะดวก ไม่ต้องล็อกอิน Google
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#4e5d56] hover:text-[#1f2b27] p-1.5 rounded-lg hover:bg-[#d5ded9] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#ccd6d0] px-6 bg-[#e7ece9] text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-1.5 py-2.5 px-4 font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'config'
                ? 'border-[#6850a1] text-[#4c377a] bg-[#e4ddf2]/60'
                : 'border-transparent text-[#4e5d56] hover:text-[#1f2b27]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>ตั้งค่าและส่งข้อมูล (Webhook Config)</span>
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-1.5 py-2.5 px-4 font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'guide'
                ? 'border-[#388262] text-[#21523c] bg-[#dceee5]/60'
                : 'border-transparent text-[#4e5d56] hover:text-[#1f2b27]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>โค้ดสำเร็จรูปและวิธีแก้ปัญหา (GAS Guide)</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('logs');
              fetchLogs();
            }}
            className={`flex items-center gap-1.5 py-2.5 px-4 font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'logs'
                ? 'border-[#3c7fa3] text-[#215166] bg-[#dcecf2]/60'
                : 'border-transparent text-[#4e5d56] hover:text-[#1f2b27]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>ประวัติและผลตอบกลับจาก Google ({logs.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {activeTab === 'config' && (
            <>
              {/* Connected Google Sheet Quick Card */}
              <div className="p-3.5 bg-[#dcecf2] border border-[#b4d3e0] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#cbe2eb] border border-[#abd0de] flex items-center justify-center text-[#215166] shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#1b3642] flex flex-wrap items-center gap-1.5">
                      <span>Google Sheets ปลายทาง: คลังหม้อแปลง</span>
                      <span className="px-1.5 py-0.5 bg-[#cbe2eb] text-[#1c485c] border border-[#abd0de] text-[10px] rounded-md font-medium">ฝังระบบเรียบร้อย</span>
                    </div>
                    <p className="text-[11px] text-[#3c5966]">
                      ข้อมูลหม้อแปลงและผังคลังจะถูกส่งไปบันทึกลง Google Sheet นี้อัตโนมัติ
                    </p>
                  </div>
                </div>
                <a
                  href="https://docs.google.com/spreadsheets/d/1VJ9T6ZGGeE7wMZQoloseELmepX5qJWC5QUMRNRgXfco/edit"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-[#3c7fa3] hover:bg-[#316b8a] text-[#f5f4ef] text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-2xs"
                >
                  <span>เปิด Google Sheets</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Webhook URL Input Group */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-[#1f2b27] flex flex-wrap items-center gap-1.5">
                    <span>Webhook URL (ปลายทางรับข้อมูล)</span>
                    <span className="text-[#b84b56]">*</span>
                    {localUrl === DEFAULT_WEBHOOK_URL && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#dceee5] text-[#21523c] border border-[#b0d8c5] rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3 text-[#2e7858]" />
                        <span>ฝังในระบบเรียบร้อย</span>
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-2">
                    {localUrl !== DEFAULT_WEBHOOK_URL && (
                      <button
                        onClick={() => {
                          setLocalUrl(DEFAULT_WEBHOOK_URL);
                          onSaveWebhookUrl(DEFAULT_WEBHOOK_URL);
                          onNotify('คืนค่าเป็น Webhook ประจำระบบเรียบร้อยแล้ว');
                        }}
                        className="text-[11px] text-[#523b85] hover:text-[#3d2b66] font-medium flex items-center gap-1 transition-colors"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>ใช้ Webhook ประจำระบบ</span>
                      </button>
                    )}
                    {localUrl && (
                      <button
                        onClick={() => {
                          setLocalUrl('');
                          onSaveWebhookUrl('');
                        }}
                        className="text-[11px] text-[#54635c] hover:text-[#75232c] flex items-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>ล้าง URL</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="url"
                    value={localUrl}
                    onChange={(e) => setLocalUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className={`flex-1 px-3.5 py-2.5 bg-[#f4f3ee] border rounded-xl text-xs text-[#1f2b27] placeholder-[#687870] font-mono focus:outline-hidden ${
                      localUrl && !urlValidation.isValid
                        ? 'border-[#d4a64a] focus:border-[#b8892e]'
                        : localUrl && urlValidation.isValid
                        ? 'border-[#68b996] focus:border-[#4b9977]'
                        : 'border-[#c2cdc7] focus:border-[#8e78c4]'
                    }`}
                  />
                  <button
                    onClick={handleSaveUrl}
                    className="px-4 py-2 bg-[#e1e7e3] hover:bg-[#d5ded9] border border-[#c2cdc7] text-xs font-semibold text-[#222e2a] rounded-xl transition-colors shrink-0"
                  >
                    บันทึก
                  </button>
                </div>

                {/* Real-time URL Warning / Guidance */}
                {localUrl.trim() && (
                  <div
                    className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                      urlValidation.isValid
                        ? 'bg-[#e1f0e9] border-[#b8dccb] text-[#21523c]'
                        : 'bg-[#f6ebd5] border-[#e3cca1] text-[#66480f]'
                    }`}
                  >
                    {urlValidation.isValid ? (
                      <CheckCircle2 className="w-4 h-4 text-[#2e7858] shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-[#b8892e] shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 space-y-0.5">
                      <div className="font-medium">{urlValidation.message}</div>
                      {urlValidation.advice && (
                        <div className="text-[11px] opacity-90 leading-relaxed">
                          {urlValidation.advice}{' '}
                          <button
                            onClick={() => setActiveTab('guide')}
                            className="text-[#1f2b27] underline font-semibold ml-1 hover:text-[#4c377a]"
                          >
                            ดูวิธีตั้งค่า &gt;
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Auto-Sync Toggle Option */}
              <div className="p-4 bg-[#e6ebe8] border border-[#c8d2cc] rounded-xl flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-[#1f2b27] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#b8892e]" />
                    <span>ส่งข้อมูลอัตโนมัติเมื่อมีการเปลี่ยนแปลง (Auto-Sync on Change)</span>
                  </div>
                  <p className="text-[11px] text-[#4e5d56]">
                    ระบบจะส่ง Webhook อัปเดตทันทีเมื่อมีการ ย้ายช่อง, เพิ่ม, แก้ไข หรือลบหม้อแปลง
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={autoSync}
                    onChange={(e) => onToggleAutoSync(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#bdcac2] peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[#f5f4ef] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#f5f4ef] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4b9977]"></div>
                </label>
              </div>

              {/* Google Sheets Pull Section */}
              <div className="p-3.5 bg-[#e6ebe8] border border-[#c8d2cc] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-[#21523c] flex flex-wrap items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-[#2e7858]" />
                    <span>ดึงข้อมูลจาก Google Sheets</span>
                    <span className="px-1.5 py-0.5 text-[10px] bg-[#dceee5] text-[#21523c] rounded-md border border-[#b0d8c5]">
                      อัตโนมัติทุกครั้งที่เปิดเวป
                    </span>
                  </div>
                  <p className="text-[11px] text-[#4e5d56]">
                    ระบบจะดึงข้อมูลหม้อแปลงล่าสุดและจุดจัดวางจาก Google Sheets ทุกครั้งที่เปิดหน้าเวป
                  </p>
                </div>
                {onPullFromSheets && (
                  <button
                    onClick={() => onPullFromSheets()}
                    disabled={isPullingSheets}
                    className="flex items-center justify-center gap-1.5 py-2 px-3.5 bg-[#4b9977] hover:bg-[#3f8566] text-[#f5f4ef] font-bold text-xs rounded-xl shadow-2xs transition-all disabled:opacity-50 shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isPullingSheets ? 'animate-spin' : ''}`} />
                    <span>{isPullingSheets ? 'กำลังดึงข้อมูล...' : 'ดึงข้อมูลล่าสุดเดี๋ยวนี้'}</span>
                  </button>
                )}
              </div>

              {/* Sync Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <button
                  onClick={handleSendSync}
                  disabled={isSending || isDiagnosing || !localUrl.trim()}
                  className="flex items-center justify-center gap-2 py-3 px-3.5 bg-[#6850a1] hover:bg-[#58428c] text-[#f5f4ef] font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 col-span-1"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>ส่งข้อมูลทันที ({transformers.length})</span>
                </button>

                <button
                  onClick={handleTestPing}
                  disabled={isSending || isDiagnosing || !localUrl.trim()}
                  className="flex items-center justify-center gap-2 py-3 px-3 bg-[#f4f3ee] hover:bg-[#e5ebe7] border border-[#c2cdc7] text-[#2b3b35] font-semibold text-xs rounded-xl transition-all disabled:opacity-50"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Activity className="w-4 h-4 text-[#2e7858]" />
                  )}
                  <span>ทดสอบยิง (Test Ping)</span>
                </button>

                <button
                  onClick={handleDiagnose}
                  disabled={isSending || isDiagnosing || !localUrl.trim()}
                  className="flex items-center justify-center gap-2 py-3 px-3 bg-[#f6ebd5] hover:bg-[#efe0c2] border border-[#e0c896] text-[#66480f] font-semibold text-xs rounded-xl transition-all disabled:opacity-50"
                  title="ตรวจสอบสถานะการเชื่อมต่อ และการตั้งค่าสิทธิ์ Anyone ของ Apps Script"
                >
                  {isDiagnosing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-[#9e6f14]" />
                  )}
                  <span>วินิจฉัย URL (Diagnose)</span>
                </button>
              </div>

              {/* Test / Sync Result Banner */}
              {testResult && (
                <div
                  className={`p-4 rounded-xl border text-xs flex items-start gap-3 animate-in fade-in duration-150 ${
                    testResult.success
                      ? 'bg-[#e1f0e9] border-[#b4d9c7] text-[#1f523b]'
                      : 'bg-[#f6dfe2] border-[#dfaab1] text-[#692028]'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-[#2e7858] shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-[#b84b56] shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 space-y-1">
                    <div className="font-bold text-sm">{testResult.message}</div>
                    {testResult.advice && (
                      <div className="p-2 bg-[#f4f3ee]/80 rounded-lg text-xs leading-relaxed text-[#283631] border border-[#c8d2cc]">
                        <strong className="text-[#6e3012]">วิธีแก้ไข: </strong>
                        {testResult.advice}
                      </div>
                    )}
                    <div className="text-[10px] opacity-75 font-mono pt-0.5">
                      เวลาทดสอบ: {testResult.timestamp}
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Copy Table Option (Direct Paste to Sheets) */}
              <div className="p-4 bg-[#e1f0e9] border border-[#b8dccb] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-[#1f523b] flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-[#2e7858]" />
                    <span>ทางเลือกสำรอง: คัดลอกตารางไปวางในชีตทันที (ไม่ต้องตั้ง Webhook)</span>
                  </div>
                </div>
                <p className="text-[11px] text-[#2e5946] leading-relaxed">
                  หาก Webhook ติดสิทธิ์ขององค์กรหรือยังตั้งค่าไม่เสร็จ คุณสามารถกดปุ่มนี้เพื่อคัดลอกข้อมูลทั้งหมด {transformers.length} รายการ แล้วเปิด Google Sheet กด <kbd className="px-1.5 py-0.5 bg-[#f4f3ee] rounded border border-[#b4d9c7] text-[#1f523b] font-mono text-[10px]">Ctrl+V</kbd> เพื่อวางได้ทันที
                </p>
                <button
                  onClick={handleCopyTable}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#4b9977] hover:bg-[#3f8566] text-[#f5f4ef] font-bold text-xs rounded-xl transition-all shadow-2xs"
                >
                  {hasCopiedTable ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>คัดลอกเรียบร้อย! เปิด Google Sheets แล้วกด Ctrl+V ได้เลย</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>คัดลอกตารางหม้อแปลงทั้งหมด ({transformers.length} เครื่อง)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Quick Info Box */}
              <div className="p-3.5 bg-[#e6ebe8] rounded-xl border border-[#c8d2cc] text-xs text-[#4e5d56] space-y-1.5">
                <div className="font-medium text-[#1f2b27] flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-[#6850a1]" />
                    ทำไมถึงส่งข้อมูลผ่าน Webhook ไม่เข้า Google Sheets?
                  </span>
                  <button
                    onClick={() => setActiveTab('guide')}
                    className="text-[11px] text-[#2e7858] hover:underline font-semibold"
                  >
                    ดูคู่มือฉบับเต็ม &gt;
                  </button>
                </div>
                <p className="text-[11px] leading-relaxed text-[#45544d]">
                  สาเหตุที่พบบ่อยที่สุดคือการตั้งค่า <strong>&quot;ผู้มีสิทธิ์เข้าถึง (Who has access)&quot;</strong> ใน Apps Script เป็น &quot;เฉพาะฉัน&quot; แทนที่จะเป็น <strong>&quot;ทุกคน (Anyone)&quot;</strong> ทำให้ Google บล็อกคำขอจากภายนอก
                </p>
              </div>
            </>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-[#1f2b27] flex items-center gap-2">
                    <History className="w-4 h-4 text-[#3c7fa3]" />
                    ประวัติการส่งข้อมูลและสถานะการตอบกลับจาก Google
                  </h4>
                  <p className="text-[11px] text-[#4e5d56]">
                    แสดงผลตอบกลับจริงจาก Google Apps Script แบบเรียลไทม์เพื่อวินิจฉัยปัญหา
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchLogs}
                    disabled={isLoadingLogs}
                    className="px-2.5 py-1 text-[11px] bg-[#f4f3ee] hover:bg-[#e5ebe7] border border-[#c2cdc7] text-[#2b3b35] rounded-lg flex items-center gap-1"
                  >
                    {isLoadingLogs ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                    รีเฟรช
                  </button>
                  {logs.length > 0 && (
                    <button
                      onClick={async () => {
                        await fetch('/api/webhook-logs', { method: 'DELETE' });
                        setLogs([]);
                      }}
                      className="px-2.5 py-1 text-[11px] bg-[#f4dfe2] hover:bg-[#ebd0d4] border border-[#dfaab1] text-[#692028] rounded-lg flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      ล้างประวัติ
                    </button>
                  )}
                </div>
              </div>

              {logs.length === 0 ? (
                <div className="p-8 text-center bg-[#e6ebe8] border border-[#c8d2cc] rounded-xl text-xs text-[#4e5d56] space-y-2">
                  <History className="w-8 h-8 mx-auto text-[#7b8c84]" />
                  <p className="font-medium text-[#2d3b36]">ยังไม่มีประวัติการส่งข้อมูล</p>
                  <p className="text-[11px] text-[#5a6962]">
                    เมื่อกด &quot;ส่งข้อมูลทันที&quot; หรือ &quot;ทดสอบยิง&quot; ประวัติและผลลัพธ์จาก Google จะปรากฏที่นี่
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                        log.success
                          ? 'bg-[#e1f0e9] border-[#b8dccb] text-[#1f523b]'
                          : 'bg-[#f6dfe2] border-[#e3b6bc] text-[#692028]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono ${
                              log.success
                                ? 'bg-[#cde6dc] text-[#18422f]'
                                : 'bg-[#f0cad0] text-[#52161d]'
                            }`}
                          >
                            {log.status ? `HTTP ${log.status}` : log.success ? 'SUCCESS' : 'ERROR'}
                          </span>
                          <span className="font-semibold text-[#1f2b27]">{log.message}</span>
                        </div>
                        <span className="text-[10px] text-[#54635c] font-mono shrink-0">{log.timestamp}</span>
                      </div>

                      {log.advice && (
                        <div className="p-2 bg-[#f4f3ee]/90 rounded-lg text-[11px] text-[#5c400d] border border-[#e3cca1]">
                          <strong>คำแนะนำ: </strong>
                          {log.advice}
                        </div>
                      )}

                      {log.responsePreview && (
                        <div className="p-2 bg-[#f4f3ee] rounded-lg text-[10px] font-mono text-[#3a4742] border border-[#c8d2cc] break-all max-h-24 overflow-y-auto">
                          <div className="text-[#5a6962] mb-0.5">Google Response:</div>
                          {log.responsePreview}
                        </div>
                      )}

                      <div className="text-[10px] text-[#54635c] font-mono truncate">
                        URL: {log.url}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-4">
              {/* 3 Golden Rules Box */}
              <div className="p-4 bg-[#f6ebd5] border border-[#e3cca1] rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-[#5c400d] flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#9e6f14]" />
                  3 จุดสำคัญที่ทำให้ส่ง Webhook ไม่ได้ (ตรวจสอบด่วน!)
                </h4>
                <div className="space-y-1.5 text-xs text-[#3b2e16]">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-[#8a5d0b]">1.</span>
                    <span>
                      <strong>ผู้มีสิทธิ์เข้าถึง (Who has access):</strong> ต้องเลือกเป็น{' '}
                      <span className="text-[#1f523b] font-bold underline">&quot;ทุกคน (Anyone)&quot;</span>{' '}
                      เท่านั้น! (ห้ามเลือก &quot;เฉพาะฉัน (Only myself)&quot; มิฉะนั้น Google จะบล็อก)
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-[#8a5d0b]">2.</span>
                    <span>
                      <strong>URL ต้องลงท้ายด้วย <code className="text-[#6e3012] font-mono">/exec</code>:</strong>{' '}
                      ห้ามนำลิงก์ Google Sheets (<code className="text-[#75232c] font-mono">docs.google.com</code>) หรือหน้าแก้ไข (<code className="text-[#75232c] font-mono">/edit</code>) มาใส่
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-[#8a5d0b]">3.</span>
                    <span>
                      <strong>หากแก้ไขสคริปต์ในภายหลัง:</strong> ต้องกด{' '}
                      <strong>Deploy &gt; Manage deployments &gt; แก้ไข (ไอคอนดินสอ) &gt; เลือก Version: &quot;New version&quot;</strong>{' '}
                      จึงจะอัปเดตโค้ดล่าสุด
                    </span>
                  </div>
                </div>
              </div>

              {/* Step-by-Step Instructions */}
              <div className="p-4 bg-[#e6ebe8] rounded-xl border border-[#c8d2cc] space-y-3">
                <h4 className="text-xs font-bold text-[#1f2b27] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#dceee5] border border-[#a8d4bf] text-[#21523c] flex items-center justify-center text-[10px] font-bold">
                    1
                  </span>
                  วิธีติดตั้งสคริปต์ลงใน Google Sheets (ทำครั้งเดียว ใช้งานได้ตลอดไป)
                </h4>

                <ol className="space-y-2 text-xs text-[#3a4742] pl-2 border-l-2 border-[#b8c4be] ml-2.5">
                  <li className="pl-3">
                    <strong className="text-[#1f2b27]">1. เปิด Google Sheet ของคุณ:</strong> สร้างชีตว่าง หรือเปิดชีตที่ต้องการเก็บข้อมูล
                  </li>
                  <li className="pl-3">
                    <strong className="text-[#1f2b27]">2. ไปที่ Apps Script:</strong> เมนูด้านบนเลือก{' '}
                    <span className="text-[#21523c] font-semibold">ส่วนขยาย (Extensions) &gt; Apps Script</span>
                  </li>
                  <li className="pl-3">
                    <strong className="text-[#1f2b27]">3. วางโค้ดสำเร็จรูป:</strong> ลบโค้ดเดิมในหน้าต่างออกทั้งหมด แล้วกดปุ่ม{' '}
                    <span className="text-[#21523c] font-semibold">&quot;คัดลอกโค้ดทั้งหมด&quot;</span> ด้านล่างนี้ไปวางแทน แล้วกดปุ่ม{' '}
                    <span className="text-[#21523c] font-semibold">บันทึก (Save ไอคอนแผ่นดิสก์)</span>
                  </li>
                  <li className="pl-3">
                    <strong className="text-[#1f2b27]">4. นำไปใช้งาน (Deploy):</strong>
                    <div className="mt-1 pl-1 text-[11px] text-[#2d3b36] space-y-1 bg-[#f4f3ee] p-2.5 rounded-xl border border-[#c8d2cc]">
                      <div>• กดปุ่มสีน้ำเงิน <span className="text-[#1f2b27] font-semibold">การทำให้ใช้งานได้ (Deploy)</span> &gt; <span className="text-[#1f2b27] font-semibold">การทำให้ใช้งานได้ใหม่ (New deployment)</span></div>
                      <div>• คลิกฟันเฟืองด้านซ้าย เลือกประเภท: <span className="text-[#523b85] font-semibold">เว็บแอป (Web app)</span></div>
                      <div>• เรียกใช้งานในฐานะ: <span className="text-[#1f2b27] font-semibold">ฉัน (Me)</span></div>
                      <div>• ผู้มีสิทธิ์เข้าถึง (Who has access): เลือก <span className="text-[#1f523b] font-bold bg-[#dceee5] px-1.5 py-0.5 rounded border border-[#b0d8c5]">ทุกคน (Anyone)</span> <span className="text-[#75232c] font-bold">***ห้ามพลาด***</span></div>
                      <div>• กด <span className="text-[#1f2b27] font-semibold">Deploy</span> (หากขึ้นขอสิทธิ์ ให้กด Advanced / ขั้นสูง &gt; Go to ... (unsafe) &gt; Allow)</div>
                      <div>• คัดลอก <span className="text-[#523b85] font-semibold font-mono">URL ของเว็บแอป (ลงท้ายด้วย /exec)</span> มาวางในแท็บตั้งค่าของแอปนี้ได้เลย!</div>
                    </div>
                  </li>
                </ol>
              </div>

              {/* Code Snippet Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-[#1f2b27] flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-[#2e7858]" />
                    <span>โค้ด Google Apps Script (GAS) เวอร์ชันสมบูรณ์</span>
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#4b9977] hover:bg-[#3f8566] text-[#f5f4ef] rounded-xl text-xs font-bold transition-colors shadow-2xs"
                  >
                    {hasCopiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>คัดลอกเรียบร้อย!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>คัดลอกโค้ดทั้งหมด</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="relative">
                  <pre className="p-4 bg-[#e1e7e3] border border-[#c2cdc7] rounded-xl text-[11px] font-mono text-[#222e2a] overflow-x-auto max-h-64 leading-relaxed select-all">
                    {GOOGLE_APPS_SCRIPT_TEMPLATE}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#ccd6d0] bg-[#e2e8e4] flex items-center justify-between">
          <div className="text-xs text-[#45544d] flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                webhookUrl.trim() && urlValidation.isValid ? 'bg-[#4b9977] animate-pulse' : 'bg-[#8fa198]'
              }`}
            />
            <span>
              {webhookUrl.trim()
                ? `ตั้งค่าแล้ว ${autoSync ? '(ซิงค์อัตโนมัติเปิดอยู่)' : ''}`
                : 'ยังไม่ได้ระบุ Webhook URL'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-[#3a4742] hover:text-[#1f2b27] rounded-xl hover:bg-[#d5ded9] transition-colors"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};

