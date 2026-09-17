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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222] bg-[#141414]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-950/80 border border-orange-700/60 flex items-center justify-center text-orange-400">
              <Webhook className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                ส่งข้อมูลเข้า Google Sheets ผ่าน Webhook
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 font-mono">
                  Google Apps Script
                </span>
              </h3>
              <p className="text-xs text-[#888]">
                ส่งข้อมูลหม้อแปลงและสถานะผังคลังเข้า Google Sheets ได้อัตโนมัติ สะดวก ไม่ต้องล็อกอิน Google
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#777] hover:text-white p-1 rounded hover:bg-[#222] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#222] px-6 bg-[#131313] text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-1.5 py-2.5 px-4 font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'config'
                ? 'border-orange-500 text-orange-400 bg-orange-950/20'
                : 'border-transparent text-[#888] hover:text-[#e5e5e5]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>ตั้งค่าและส่งข้อมูล (Webhook Config)</span>
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-1.5 py-2.5 px-4 font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'guide'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
                : 'border-transparent text-[#888] hover:text-[#e5e5e5]'
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
                ? 'border-blue-500 text-blue-400 bg-blue-950/20'
                : 'border-transparent text-[#888] hover:text-[#e5e5e5]'
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
              <div className="p-3.5 bg-blue-950/30 border border-blue-800/60 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-900/60 flex items-center justify-center text-blue-300 shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Google Sheets ปลายทาง: คลังหม้อแปลง</span>
                      <span className="px-1.5 py-0.5 bg-blue-900/80 text-blue-200 text-[10px] rounded font-medium">ฝังระบบเรียบร้อย</span>
                    </div>
                    <p className="text-[11px] text-[#aaa]">
                      ข้อมูลหม้อแปลงและผังคลังจะถูกส่งไปบันทึกลง Google Sheet นี้อัตโนมัติ
                    </p>
                  </div>
                </div>
                <a
                  href="https://docs.google.com/spreadsheets/d/1VJ9T6ZGGeE7wMZQoloseELmepX5qJWC5QUMRNRgXfco/edit"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-xs"
                >
                  <span>เปิด Google Sheets</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Webhook URL Input Group */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Webhook URL (ปลายทางรับข้อมูล)</span>
                    <span className="text-rose-400">*</span>
                    {localUrl === DEFAULT_WEBHOOK_URL && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-400" />
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
                        className="text-[11px] text-orange-400 hover:text-orange-300 flex items-center gap-1 transition-colors"
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
                        className="text-[11px] text-[#888] hover:text-rose-400 flex items-center gap-1 transition-colors"
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
                    className={`flex-1 px-3.5 py-2.5 bg-[#171717] border rounded-lg text-xs text-white placeholder-[#666] font-mono focus:outline-hidden ${
                      localUrl && !urlValidation.isValid
                        ? 'border-amber-600 focus:border-amber-500'
                        : localUrl && urlValidation.isValid
                        ? 'border-emerald-600 focus:border-emerald-500'
                        : 'border-[#333] focus:border-orange-500'
                    }`}
                  />
                  <button
                    onClick={handleSaveUrl}
                    className="px-4 py-2 bg-[#222] hover:bg-[#2c2c2c] border border-[#383838] text-xs font-semibold text-white rounded-lg transition-colors shrink-0"
                  >
                    บันทึก
                  </button>
                </div>

                {/* Real-time URL Warning / Guidance */}
                {localUrl.trim() && (
                  <div
                    className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                      urlValidation.isValid
                        ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                        : 'bg-amber-950/50 border-amber-800/70 text-amber-200'
                    }`}
                  >
                    {urlValidation.isValid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 space-y-0.5">
                      <div className="font-medium">{urlValidation.message}</div>
                      {urlValidation.advice && (
                        <div className="text-[11px] opacity-90 leading-relaxed">
                          {urlValidation.advice}{' '}
                          <button
                            onClick={() => setActiveTab('guide')}
                            className="text-white underline font-semibold ml-1 hover:text-emerald-300"
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
              <div className="p-4 bg-[#161616] border border-[#262626] rounded-xl flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>ส่งข้อมูลอัตโนมัติเมื่อมีการเปลี่ยนแปลง (Auto-Sync on Change)</span>
                  </div>
                  <p className="text-[11px] text-[#888]">
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
                  <div className="w-11 h-6 bg-[#333] peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Sync Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <button
                  onClick={handleSendSync}
                  disabled={isSending || isDiagnosing || !localUrl.trim()}
                  className="flex items-center justify-center gap-2 py-3 px-3.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50 col-span-1 sm:col-span-1"
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
                  className="flex items-center justify-center gap-2 py-3 px-3 bg-[#1e1e1e] hover:bg-[#282828] border border-[#333] text-[#ddd] hover:text-white font-semibold text-xs rounded-xl transition-all disabled:opacity-50"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Activity className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>ทดสอบยิง (Test Ping)</span>
                </button>

                <button
                  onClick={handleDiagnose}
                  disabled={isSending || isDiagnosing || !localUrl.trim()}
                  className="flex items-center justify-center gap-2 py-3 px-3 bg-[#181818] hover:bg-[#222] border border-[#383838] text-amber-300 hover:text-amber-200 font-semibold text-xs rounded-xl transition-all disabled:opacity-50"
                  title="ตรวจสอบสถานะการเชื่อมต่อ และการตั้งค่าสิทธิ์ Anyone ของ Apps Script"
                >
                  {isDiagnosing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                  )}
                  <span>วินิจฉัย URL (Diagnose)</span>
                </button>
              </div>

              {/* Test / Sync Result Banner */}
              {testResult && (
                <div
                  className={`p-4 rounded-xl border text-xs flex items-start gap-3 animate-in fade-in duration-150 ${
                    testResult.success
                      ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200'
                      : 'bg-rose-950/60 border-rose-700 text-rose-200'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 space-y-1">
                    <div className="font-bold text-sm">{testResult.message}</div>
                    {testResult.advice && (
                      <div className="p-2 bg-black/40 rounded-lg text-xs leading-relaxed text-[#eee] border border-white/10">
                        <strong className="text-amber-300">วิธีแก้ไข: </strong>
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
              <div className="p-4 bg-emerald-950/30 border border-emerald-800/60 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <span>ทางเลือกสำรอง: คัดลอกตารางไปวางในชีตทันที (ไม่ต้องตั้ง Webhook)</span>
                  </div>
                </div>
                <p className="text-[11px] text-[#aaa] leading-relaxed">
                  หาก Webhook ติดสิทธิ์ขององค์กรหรือยังตั้งค่าไม่เสร็จ คุณสามารถกดปุ่มนี้เพื่อคัดลอกข้อมูลทั้งหมด {transformers.length} รายการ แล้วเปิด Google Sheet กด <kbd className="px-1.5 py-0.5 bg-[#222] rounded border border-[#444] text-white font-mono text-[10px]">Ctrl+V</kbd> เพื่อวางได้ทันที
                </p>
                <button
                  onClick={handleCopyTable}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-all shadow-xs"
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
              <div className="p-3.5 bg-[#151515] rounded-lg border border-[#222] text-xs text-[#888] space-y-1.5">
                <div className="font-medium text-white flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-orange-400" />
                    ทำไมถึงส่งข้อมูลผ่าน Webhook ไม่เข้า Google Sheets?
                  </span>
                  <button
                    onClick={() => setActiveTab('guide')}
                    className="text-[11px] text-emerald-400 hover:underline font-semibold"
                  >
                    ดูคู่มือฉบับเต็ม &gt;
                  </button>
                </div>
                <p className="text-[11px] leading-relaxed text-[#aaa]">
                  สาเหตุที่พบบ่อยที่สุดคือการตั้งค่า <strong>"ผู้มีสิทธิ์เข้าถึง (Who has access)"</strong> ใน Apps Script เป็น "เฉพาะฉัน" แทนที่จะเป็น <strong>"ทุกคน (Anyone)"</strong> ทำให้ Google บล็อกคำขอจากภายนอก
                </p>
              </div>
            </>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <History className="w-4 h-4 text-blue-400" />
                    ประวัติการส่งข้อมูลและสถานะการตอบกลับจาก Google
                  </h4>
                  <p className="text-[11px] text-[#888]">
                    แสดงผลตอบกลับจริงจาก Google Apps Script แบบเรียลไทม์เพื่อวินิจฉัยปัญหา
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchLogs}
                    disabled={isLoadingLogs}
                    className="px-2.5 py-1 text-[11px] bg-[#222] hover:bg-[#2c2c2c] border border-[#333] text-[#ccc] hover:text-white rounded flex items-center gap-1"
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
                      className="px-2.5 py-1 text-[11px] bg-[#222] hover:bg-rose-950/50 border border-[#333] hover:border-rose-800 text-[#888] hover:text-rose-300 rounded flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      ล้างประวัติ
                    </button>
                  )}
                </div>
              </div>

              {logs.length === 0 ? (
                <div className="p-8 text-center bg-[#141414] border border-[#222] rounded-xl text-xs text-[#777] space-y-2">
                  <History className="w-8 h-8 mx-auto text-[#444]" />
                  <p>ยังไม่มีประวัติการส่งข้อมูล</p>
                  <p className="text-[11px] text-[#555]">
                    เมื่อกด "ส่งข้อมูลทันที" หรือ "ทดสอบยิง" ประวัติและผลลัพธ์จาก Google จะปรากฏที่นี่
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                        log.success
                          ? 'bg-emerald-950/30 border-emerald-800/60 text-[#ddd]'
                          : 'bg-rose-950/30 border-rose-800/60 text-[#ddd]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                              log.success
                                ? 'bg-emerald-900 text-emerald-200'
                                : 'bg-rose-900 text-rose-200'
                            }`}
                          >
                            {log.status ? `HTTP ${log.status}` : log.success ? 'SUCCESS' : 'ERROR'}
                          </span>
                          <span className="font-semibold text-white">{log.message}</span>
                        </div>
                        <span className="text-[10px] text-[#888] font-mono shrink-0">{log.timestamp}</span>
                      </div>

                      {log.advice && (
                        <div className="p-2 bg-black/40 rounded-lg text-[11px] text-amber-200 border border-amber-900/40">
                          <strong>คำแนะนำ: </strong>
                          {log.advice}
                        </div>
                      )}

                      {log.responsePreview && (
                        <div className="p-2 bg-black/60 rounded-lg text-[10px] font-mono text-[#aaa] border border-white/5 break-all max-h-24 overflow-y-auto">
                          <div className="text-[#666] mb-0.5">Google Response:</div>
                          {log.responsePreview}
                        </div>
                      )}

                      <div className="text-[10px] text-[#777] font-mono truncate">
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
              <div className="p-4 bg-amber-950/30 border border-amber-800/60 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-amber-300 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  3 จุดสำคัญที่ทำให้ส่ง Webhook ไม่ได้ (ตรวจสอบด่วน!)
                </h4>
                <div className="space-y-1.5 text-xs text-[#ddd]">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-amber-400">1.</span>
                    <span>
                      <strong>ผู้มีสิทธิ์เข้าถึง (Who has access):</strong> ต้องเลือกเป็น{' '}
                      <span className="text-emerald-300 font-bold underline">"ทุกคน (Anyone)"</span>{' '}
                      เท่านั้น! (ห้ามเลือก "เฉพาะฉัน (Only myself)" มิฉะนั้น Google จะบล็อก)
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-amber-400">2.</span>
                    <span>
                      <strong>URL ต้องลงท้ายด้วย <code className="text-orange-300 font-mono">/exec</code>:</strong>{' '}
                      ห้ามนำลิงก์ Google Sheets (<code className="text-rose-300 font-mono">docs.google.com</code>) หรือหน้าแก้ไข (<code className="text-rose-300 font-mono">/edit</code>) มาใส่
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-amber-400">3.</span>
                    <span>
                      <strong>หากแก้ไขสคริปต์ในภายหลัง:</strong> ต้องกด{' '}
                      <strong>Deploy &gt; Manage deployments &gt; แก้ไข (ไอคอนดินสอ) &gt; เลือก Version: "New version"</strong>{' '}
                      จึงจะอัปเดตโค้ดล่าสุด
                    </span>
                  </div>
                </div>
              </div>

              {/* Step-by-Step Instructions */}
              <div className="p-4 bg-[#161616] rounded-xl border border-[#262626] space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                    1
                  </span>
                  วิธีติดตั้งสคริปต์ลงใน Google Sheets (ทำครั้งเดียว ใช้งานได้ตลอดไป)
                </h4>

                <ol className="space-y-2 text-xs text-[#aaa] pl-2 border-l-2 border-[#2b2b2b] ml-2.5">
                  <li className="pl-3">
                    <strong className="text-white">1. เปิด Google Sheet ของคุณ:</strong> สร้างชีตว่าง หรือเปิดชีตที่ต้องการเก็บข้อมูล
                  </li>
                  <li className="pl-3">
                    <strong className="text-white">2. ไปที่ Apps Script:</strong> เมนูด้านบนเลือก{' '}
                    <span className="text-emerald-400 font-semibold">ส่วนขยาย (Extensions) &gt; Apps Script</span>
                  </li>
                  <li className="pl-3">
                    <strong className="text-white">3. วางโค้ดสำเร็จรูป:</strong> ลบโค้ดเดิมในหน้าต่างออกทั้งหมด แล้วกดปุ่ม{' '}
                    <span className="text-emerald-400 font-semibold">"คัดลอกโค้ดทั้งหมด"</span> ด้านล่างนี้ไปวางแทน แล้วกดปุ่ม{' '}
                    <span className="text-emerald-400 font-semibold">บันทึก (Save ไอคอนแผ่นดิสก์)</span>
                  </li>
                  <li className="pl-3">
                    <strong className="text-white">4. นำไปใช้งาน (Deploy):</strong>
                    <div className="mt-1 pl-1 text-[11px] text-[#ccc] space-y-1 bg-[#111] p-2.5 rounded-lg border border-[#222]">
                      <div>• กดปุ่มสีน้ำเงิน <span className="text-white font-semibold">การทำให้ใช้งานได้ (Deploy)</span> &gt; <span className="text-white font-semibold">การทำให้ใช้งานได้ใหม่ (New deployment)</span></div>
                      <div>• คลิกฟันเฟืองด้านซ้าย เลือกประเภท: <span className="text-orange-400 font-semibold">เว็บแอป (Web app)</span></div>
                      <div>• เรียกใช้งานในฐานะ: <span className="text-white font-semibold">ฉัน (Me)</span></div>
                      <div>• ผู้มีสิทธิ์เข้าถึง (Who has access): เลือก <span className="text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">ทุกคน (Anyone)</span> <span className="text-rose-400 font-bold">***ห้ามพลาด***</span></div>
                      <div>• กด <span className="text-white font-semibold">Deploy</span> (หากขึ้นขอสิทธิ์ ให้กด Advanced / ขั้นสูง &gt; Go to ... (unsafe) &gt; Allow)</div>
                      <div>• คัดลอก <span className="text-orange-400 font-semibold font-mono">URL ของเว็บแอป (ลงท้ายด้วย /exec)</span> มาวางในแท็บตั้งค่าของแอปนี้ได้เลย!</div>
                    </div>
                  </li>
                </ol>
              </div>

              {/* Code Snippet Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-emerald-400" />
                    <span>โค้ด Google Apps Script (GAS) เวอร์ชันสมบูรณ์</span>
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
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
                  <pre className="p-4 bg-[#0a0a0a] border border-[#262626] rounded-xl text-[11px] font-mono text-[#bbb] overflow-x-auto max-h-64 leading-relaxed select-all">
                    {GOOGLE_APPS_SCRIPT_TEMPLATE}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#222] bg-[#141414] flex items-center justify-between">
          <div className="text-xs text-[#777] flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                webhookUrl.trim() && urlValidation.isValid ? 'bg-emerald-400 animate-pulse' : 'bg-[#444]'
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
            className="px-4 py-1.5 text-xs font-semibold text-[#888] hover:text-white rounded hover:bg-[#222] transition-colors"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};

