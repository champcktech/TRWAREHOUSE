import React, { useState } from 'react';
import { Transformer, WarehouseConfig } from '../types';
import {
  createWarehouseSpreadsheet,
  updateSpreadsheetData,
  importTransformersFromSheet,
  extractSpreadsheetId,
  ExportResult,
} from '../services/googleSheetsService';
import { googleSignIn, logout, User } from '../lib/googleAuth';
import {
  X,
  FileSpreadsheet,
  ExternalLink,
  Upload,
  Download,
  Check,
  AlertTriangle,
  Loader2,
  LogOut,
  RefreshCw,
  Info,
} from 'lucide-react';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  accessToken: string | null;
  onAuthSuccess: (user: User, token: string) => void;
  onAuthLogout: () => void;
  transformers: Transformer[];
  config: WarehouseConfig;
  onImportTransformers: (imported: Transformer[]) => void;
  onNotify: (message: string) => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  accessToken,
  onAuthSuccess,
  onAuthLogout,
  transformers,
  config,
  onImportTransformers,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'sync' | 'import'>('export');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [sheetTitle, setSheetTitle] = useState(
    `PEA ผังคลังหม้อแปลงไฟฟ้า - ${new Date().toLocaleDateString('th-TH')}`
  );
  const [existingSheetInput, setExistingSheetInput] = useState('');
  const [lastExportResult, setLastExportResult] = useState<ExportResult | null>(null);

  // Mandatory confirmation dialog state for destructive/modifying operations
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionType: 'sync' | 'import';
    onConfirm: () => void;
  } | null>(null);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setIsLoggingIn(true);
    setErrorMessage(null);
    try {
      const result = await googleSignIn();
      if (result) {
        onAuthSuccess(result.user, result.accessToken);
        onNotify(`เข้าสู่ระบบด้วย ${result.user.email || 'Google'} สำเร็จ`);
      }
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ Google');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      onAuthLogout();
      setLastExportResult(null);
      onNotify('ออกจากระบบ Google เรียบร้อยแล้ว');
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  // 1. Export to a NEW Google Sheet
  const handleExportNewSheet = async () => {
    if (!accessToken) {
      setErrorMessage('กรุณาเข้าสู่ระบบ Google ก่อนดำเนินการ');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await createWarehouseSpreadsheet(
        accessToken,
        transformers,
        config,
        sheetTitle
      );
      setLastExportResult(result);
      onNotify(`สร้างและส่งออกข้อมูลไปยัง Google Sheets สำเร็จ!`);
    } catch (err: any) {
      console.error('Export error:', err);
      setErrorMessage(err.message || 'ไม่สามารถสร้าง Google Sheets ได้');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Request Sync to EXISTING Sheet (Triggers mandatory user confirmation)
  const handleRequestSync = () => {
    if (!accessToken) {
      setErrorMessage('กรุณาเข้าสู่ระบบ Google ก่อนดำเนินการ');
      return;
    }
    const targetId = extractSpreadsheetId(existingSheetInput);
    if (!targetId) {
      setErrorMessage('กรุณากรอก URL หรือ Spreadsheet ID ของ Google Sheets');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'ยืนยันการเขียนทับข้อมูลใน Google Sheets',
      description: `คุณต้องการบันทึกข้อมูลหม้อแปลงไฟฟ้าจำนวน ${transformers.length} เครื่อง และผังคลัง (${config.columns}x${config.rows} ช่อง) ทับลงในชีต ID "${targetId}" ใช่หรือไม่? ข้อมูลเดิมในแท็บผังคลังจะถูกแทนที่ด้วยข้อมูลล่าสุด`,
      actionType: 'sync',
      onConfirm: async () => {
        setConfirmModal(null);
        setIsLoading(true);
        setErrorMessage(null);
        try {
          await updateSpreadsheetData(accessToken, targetId, transformers, config);
          const url = `https://docs.google.com/spreadsheets/d/${targetId}/edit`;
          setLastExportResult({
            spreadsheetId: targetId,
            spreadsheetUrl: url,
            title: 'Google Spreadsheet ที่ระบุ',
          });
          onNotify('อัปเดตข้อมูลไปยัง Google Sheets เรียบร้อยแล้ว');
        } catch (err: any) {
          console.error('Sync error:', err);
          setErrorMessage(err.message || 'ไม่สามารถอัปเดตข้อมูลลงใน Google Sheets ได้');
        } finally {
          setIsLoading(false);
        }
      },
    });
  };

  // 3. Request Import from Sheet (Triggers mandatory user confirmation)
  const handleRequestImport = () => {
    if (!accessToken) {
      setErrorMessage('กรุณาเข้าสู่ระบบ Google ก่อนดำเนินการ');
      return;
    }
    const targetId = extractSpreadsheetId(existingSheetInput);
    if (!targetId) {
      setErrorMessage('กรุณากรอก URL หรือ Spreadsheet ID ของ Google Sheets ที่ต้องการนำเข้า');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'ยืนยันการนำเข้าข้อมูลหม้อแปลงจาก Google Sheets',
      description: `การนำเข้าข้อมูลจะนำรายการหม้อแปลงจาก Google Sheets เข้ามาจัดวางในระบบ คุณต้องการดำเนินการต่อหรือไม่?`,
      actionType: 'import',
      onConfirm: async () => {
        setConfirmModal(null);
        setIsLoading(true);
        setErrorMessage(null);
        try {
          const imported = await importTransformersFromSheet(accessToken, targetId, config);
          onImportTransformers(imported);
          onNotify(`นำเข้าข้อมูลหม้อแปลง ${imported.length} เครื่องจาก Google Sheets สำเร็จ`);
          onClose();
        } catch (err: any) {
          console.error('Import error:', err);
          setErrorMessage(err.message || 'ไม่สามารถนำเข้าข้อมูลจาก Google Sheets ได้');
        } finally {
          setIsLoading(false);
        }
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#111] border border-[#2c2c2c] rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#222] bg-[#141414]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                เชื่อมต่อ Google Sheets
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 font-mono">
                  Sheets API v4
                </span>
              </h3>
              <p className="text-xs text-[#888]">
                ซิงค์ ส่งออก และนำเข้าข้อมูลสต็อกหม้อแปลงและผังคลัง PEA
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

        {/* Content Area */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-lg text-rose-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* Auth Section */}
          <div className="p-3.5 bg-[#171717] rounded-lg border border-[#2a2a2a] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {currentUser ? (
              <div className="flex items-center gap-3">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'Google User'}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full border border-emerald-500/50"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-emerald-900 border border-emerald-600 flex items-center justify-center font-bold text-emerald-200 text-sm">
                    {(currentUser.displayName || currentUser.email || 'G')[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    {currentUser.displayName || 'ผู้ใช้ Google'}
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  </div>
                  <div className="text-[11px] text-[#888]">{currentUser.email}</div>
                  <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                    ✓ เชื่อมต่อสิทธิ์ Google Sheets สำเร็จ
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-xs font-bold text-white">ยังไม่ได้เข้าสู่ระบบ Google</div>
                <div className="text-[11px] text-[#888]">
                  เข้าสู่ระบบเพื่ออนุญาตให้แอปอ่านและบันทึกข้อมูลลงในบัญชี Google Sheets ของคุณ
                </div>
              </div>
            )}

            <div>
              {currentUser ? (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#222] hover:bg-[#2c2c2c] border border-[#333] text-xs font-semibold text-[#bbb] hover:text-white rounded transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>ออกจากระบบ</span>
                </button>
              ) : (
                <button
                  onClick={handleSignIn}
                  disabled={isLoggingIn}
                  className="flex items-center gap-2.5 px-4 py-2 bg-white hover:bg-[#f1f1f1] text-[#222] font-semibold text-xs rounded-md shadow transition-colors disabled:opacity-50"
                >
                  {isLoggingIn ? (
                    <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 48 48">
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                    </svg>
                  )}
                  <span>Sign in with Google</span>
                </button>
              )}
            </div>
          </div>

          {/* Action Tabs */}
          <div className="flex border-b border-[#222] text-xs">
            <button
              onClick={() => setActiveTab('export')}
              className={`flex items-center gap-1.5 px-4 py-2 font-semibold border-b-2 transition-colors ${
                activeTab === 'export'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
                  : 'border-transparent text-[#888] hover:text-[#e5e5e5]'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>สร้าง Google Sheets ใหม่</span>
            </button>
            <button
              onClick={() => setActiveTab('sync')}
              className={`flex items-center gap-1.5 px-4 py-2 font-semibold border-b-2 transition-colors ${
                activeTab === 'sync'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
                  : 'border-transparent text-[#888] hover:text-[#e5e5e5]'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>อัปเดตชีตเดิม</span>
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`flex items-center gap-1.5 px-4 py-2 font-semibold border-b-2 transition-colors ${
                activeTab === 'import'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
                  : 'border-transparent text-[#888] hover:text-[#e5e5e5]'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>นำเข้าจากชีต</span>
            </button>
          </div>

          {/* Tab 1: Export New Sheet */}
          {activeTab === 'export' && (
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-[#ccc] mb-1.5">
                  ชื่อไฟล์ Google Sheets
                </label>
                <input
                  type="text"
                  value={sheetTitle}
                  onChange={(e) => setSheetTitle(e.target.value)}
                  placeholder="ระบุชื่อเอกสาร..."
                  className="w-full px-3 py-2 bg-[#171717] border border-[#333] rounded-lg text-xs text-white placeholder-[#666] focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="p-3 bg-[#171717] rounded-lg border border-[#2a2a2a] text-xs space-y-1.5 text-[#aaa]">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-emerald-400" />
                  สเปรดชีตที่สร้างจะประกอบด้วย 3 แผ่นงาน (Tabs):
                </div>
                <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-[#888]">
                  <li>
                    <strong className="text-[#ccc]">ข้อมูลหม้อแปลงทั้งหมด</strong>: รายการหม้อแปลง {transformers.length} เครื่อง (PEA No., Serial, ยี่ห้อ, kVA, สถานะ, ช่อง)
                  </li>
                  <li>
                    <strong className="text-[#ccc]">ผังคลังและสถานะช่อง</strong>: แสดงสถานะช่องจัดเก็บทั้ง {config.columns * config.rows} ช่อง
                  </li>
                  <li>
                    <strong className="text-[#ccc]">สรุปสถิติคลัง</strong>: จำนวนเครื่องตามสถานะสี และอัตราการใช้งานคลัง
                  </li>
                </ul>
              </div>

              <button
                onClick={handleExportNewSheet}
                disabled={isLoading || !accessToken}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors shadow-md disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังสร้างและส่งออกข้อมูล...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>สร้างและบันทึกลง Google Sheets ของฉัน</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Tab 2: Sync to Existing Sheet */}
          {activeTab === 'sync' && (
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-[#ccc] mb-1.5">
                  URL หรือ Spreadsheet ID ของ Google Sheets ที่มีอยู่
                </label>
                <input
                  type="text"
                  value={existingSheetInput}
                  onChange={(e) => setExistingSheetInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1abc.../edit หรือ Spreadsheet ID"
                  className="w-full px-3 py-2 bg-[#171717] border border-[#333] rounded-lg text-xs text-white placeholder-[#666] focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-lg text-[11px] text-amber-200/90 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong>คำเตือนการแก้ไขข้อมูล:</strong> ระบบจะอัปเดตและเขียนทับข้อมูลในชีตตามข้อมูลปัจจุบันของคลังหม้อแปลง ({transformers.length} เครื่อง) จะมีหน้าต่างยืนยันก่อนบันทึกเสมอ
                </div>
              </div>

              <button
                onClick={handleRequestSync}
                disabled={isLoading || !accessToken || !existingSheetInput.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-lg transition-colors shadow-md disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังบันทึกข้อมูล...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>อัปเดตข้อมูลลงในชีตนี้</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Tab 3: Import from Existing Sheet */}
          {activeTab === 'import' && (
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-[#ccc] mb-1.5">
                  URL หรือ Spreadsheet ID ของ Google Sheets
                </label>
                <input
                  type="text"
                  value={existingSheetInput}
                  onChange={(e) => setExistingSheetInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1abc.../edit"
                  className="w-full px-3 py-2 bg-[#171717] border border-[#333] rounded-lg text-xs text-white placeholder-[#666] focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="p-3 bg-[#171717] rounded-lg border border-[#2a2a2a] text-xs text-[#888] space-y-1">
                <div className="text-white font-medium">รูปแบบหัวคอลัมน์ที่รองรับ:</div>
                <div className="font-mono text-[10px] text-[#aaa]">
                  ลำดับ | PEA No. | Serial Number | ยี่ห้อ | ขนาด (kVA) | เฟส | แรงดัน | สถานะ | ตำแหน่งจัดเก็บ
                </div>
              </div>

              <button
                onClick={handleRequestImport}
                disabled={isLoading || !accessToken || !existingSheetInput.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition-colors shadow-md disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังดึงข้อมูล...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>นำเข้าข้อมูลเข้าสู่ระบบ</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Export Success Result Card */}
          {lastExportResult && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/80 rounded-lg flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2 text-xs text-emerald-300 truncate">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate">
                  พร้อมใช้งาน: <strong>{lastExportResult.title}</strong>
                </span>
              </div>
              <a
                href={lastExportResult.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shrink-0 transition-colors shadow-xs"
              >
                <span>เปิดใน Google Sheets</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#222] bg-[#141414] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-[#888] hover:text-white rounded hover:bg-[#222] transition-colors"
          >
            ปิด
          </button>
        </div>
      </div>

      {/* Mandatory User Confirmation Dialog */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#161616] border border-amber-600/70 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-950/80 border border-amber-600/60 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight">
                  {confirmModal.title}
                </h4>
                <p className="text-xs text-[#bbb] mt-1.5 leading-relaxed">
                  {confirmModal.description}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#262626]">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-[#888] hover:text-white rounded hover:bg-[#262626] transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`px-4 py-1.5 text-xs font-bold text-white rounded shadow-sm transition-colors ${
                  confirmModal.actionType === 'sync'
                    ? 'bg-amber-600 hover:bg-amber-500'
                    : 'bg-blue-600 hover:bg-blue-500'
                }`}
              >
                ยืนยันดำเนินการ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
