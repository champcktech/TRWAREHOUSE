import React, { useState } from 'react';
import { ExternalLink, RefreshCw, Send, ShieldCheck, Settings, Check, AlertCircle } from 'lucide-react';
import { Transformer, WarehouseConfig } from '../types';
import { sendWebhook, buildWebhookPayload } from '../services/webhookService';

interface GoogleScriptEmbedViewProps {
  scriptUrl: string;
  onUpdateScriptUrl?: (newUrl: string) => void;
  transformers: Transformer[];
  config: WarehouseConfig;
  onNotify: (msg: string) => void;
}

export const GoogleScriptEmbedView: React.FC<GoogleScriptEmbedViewProps> = ({
  scriptUrl,
  onUpdateScriptUrl,
  transformers,
  config,
  onNotify
}) => {
  const [iframeKey, setIframeKey] = useState(1);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [tempUrl, setTempUrl] = useState(scriptUrl);
  const [isSyncing, setIsSyncing] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);

  const handleRefresh = () => {
    setIframeLoading(true);
    setIframeKey((prev) => prev + 1);
  };

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempUrl.trim() && onUpdateScriptUrl) {
      onUpdateScriptUrl(tempUrl.trim());
      setIsEditingUrl(false);
      handleRefresh();
      onNotify('อัปเดต URL Google Apps Script เรียบร้อยแล้ว');
    }
  };

  const handleQuickSync = async () => {
    setIsSyncing(true);
    try {
      const payload = buildWebhookPayload(transformers, config, 'sync_all');
      const res = await sendWebhook(scriptUrl, payload);
      if (res.success) {
        onNotify(`ส่งข้อมูลหม้อแปลง ${transformers.length} เครื่องเข้า Google Apps Script สำเร็จ`);
        handleRefresh();
      } else {
        onNotify(`แจ้งเตือน: ${res.message || 'ส่งข้อมูลไม่สำเร็จ'}`);
      }
    } catch {
      onNotify('เกิดข้อผิดพลาดในการเชื่อมต่อ Google Apps Script');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="bg-[#eff2ee] rounded-2xl shadow-2xs border border-[#cad4ce] overflow-hidden flex flex-col h-[calc(100vh-210px)] min-h-[640px]">
      {/* Top Toolbar */}
      <div className="p-3 sm:p-4 border-b border-[#ced8d2] bg-[#e3e8e5] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#dceee5] border border-[#b0d8c5] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-[#2e7858]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#1f2b27] tracking-tight truncate">
                Google Apps Script Web App (ระบบฝังในโปรแกรม)
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#dceee5] text-[#21523c] border border-[#b0d8c5] shrink-0">
                ฝังสด (Live Embed)
              </span>
            </div>
            <p className="text-[11px] text-[#54635c] font-mono truncate max-w-md sm:max-w-xl">
              {scriptUrl}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleQuickSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#f5f4ef] bg-[#6850a1] hover:bg-[#58428c] disabled:opacity-50 transition-colors shadow-2xs"
            title="ส่งข้อมูลหม้อแปลงทั้งหมดในคลังเข้าสู่ Google Apps Script ปลายทาง"
          >
            <Send className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'กำลังส่งข้อมูล...' : 'ซิงค์ข้อมูลเข้า Script'}</span>
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#3a4742] hover:text-[#1f2b27] bg-[#f4f3ee] hover:bg-[#ebeae2] border border-[#c2cdc7] transition-colors"
            title="โหลดหน้าเว็บใหม่"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${iframeLoading ? 'animate-spin text-[#6850a1]' : ''}`} />
            <span className="hidden sm:inline">รีเฟรช</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEditingUrl((prev) => !prev)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#4e5d56] hover:text-[#1f2b27] bg-[#f4f3ee] border border-[#c2cdc7] transition-colors"
            title="แก้ไข URL"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          <a
            href={scriptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#215166] hover:text-[#173d4d] bg-[#dcecf2] hover:bg-[#cde3eb] border border-[#b4d3e0] transition-colors"
            title="เปิด Google Script ในหน้าต่างแท็บใหม่"
          >
            <span>เปิดแท็บใหม่</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* URL Editor Drawer (if opened) */}
      {isEditingUrl && (
        <form onSubmit={handleSaveUrl} className="p-3 bg-[#e7ece9] border-b border-[#ced8d2] flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#45544d] shrink-0">URL Google Apps Script:</span>
          <input
            type="url"
            value={tempUrl}
            onChange={(e) => setTempUrl(e.target.value)}
            required
            className="flex-1 min-w-[200px] px-2.5 py-1.5 bg-[#f4f3ee] border border-[#c2cdc7] rounded-xl text-xs text-[#1f2b27] font-mono focus:outline-hidden focus:border-[#8e78c4]"
            placeholder="https://script.google.com/macros/s/.../exec"
          />
          <button
            type="submit"
            className="flex items-center gap-1 px-3 py-1.5 bg-[#4b9977] hover:bg-[#3f8566] text-[#f5f4ef] rounded-xl text-xs font-bold"
          >
            <Check className="w-3.5 h-3.5" />
            บันทึก
          </button>
          <button
            type="button"
            onClick={() => {
              setTempUrl(scriptUrl);
              setIsEditingUrl(false);
            }}
            className="px-2.5 py-1.5 text-xs text-[#4e5d56] hover:text-[#1f2b27]"
          >
            ยกเลิก
          </button>
        </form>
      )}

      {/* Iframe Viewport */}
      <div className="relative flex-1 w-full h-full bg-[#e8edea] overflow-hidden">
        {iframeLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#e8edea]/90 gap-3">
            <RefreshCw className="w-8 h-8 text-[#6850a1] animate-spin" />
            <div className="text-xs text-[#45544d]">กำลังโหลด Google Apps Script...</div>
          </div>
        )}

        <iframe
          key={iframeKey}
          src={scriptUrl}
          title="Google Apps Script Application"
          className="w-full h-full border-0 bg-[#f5f4ef]"
          onLoad={() => setIframeLoading(false)}
          allow="geolocation; microphone; camera"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
        />

        {/* Helpful Fallback banner at bottom in case Google prevents iframing in certain browsers */}
        <div className="p-2 px-4 bg-[#e3e8e5] border-t border-[#ced8d2] text-[11px] text-[#4e5d56] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-[#5a6962]" />
            <span>หากหน้าต่างแสดงผลเป็นสีขาวหรือมีข้อความปฏิเสธการเชื่อมต่อจาก Google สามารถคลิก &quot;เปิดแท็บใหม่&quot; ด้านบนเพื่อเข้าใช้งานโดยตรงได้ตลอดเวลา</span>
          </div>
          <a
            href={scriptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#215166] hover:underline font-mono shrink-0 ml-2 font-semibold"
          >
            เปิดลิงก์ Google Script
          </a>
        </div>
      </div>
    </div>
  );
};
