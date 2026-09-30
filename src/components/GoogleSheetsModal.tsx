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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#eff2ee] border border-[#c6d1cb] rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ced8d2] bg-[#e5eae7]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#ccebd9] border border-[#a5d9bd] flex items-center justify-center text-[#1f5239]">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#2b3833] tracking-tight flex items-center gap-2">
                เชื่อมต่อ Google Sheets
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#ccebd9] text-[#1f5239] border border-[#a5d9bd] font-mono">
                  Sheets API v4
                </span>
              </h3>
              <p className="text-xs text-[#5a6b65]">
                ซิงค์ ส่งออก และนำเข้าข้อมูลสต็อกหม้อแปลงและผังคลัง PEA
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#5a6b65] hover:text-[#2b3833] p-1.5 rounded-lg hover:bg-[#dce3de] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* Auth Section */}
          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {currentUser ? (
              <div className="flex items-center gap-3">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'Google User'}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full border border-emerald-300"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center font-bold text-emerald-800 text-sm">
                    {(currentUser.displayName || currentUser.email || 'G')[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    {currentUser.displayName || 'ผู้ใช้ Google'}
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                  <div className="text-[11px] text-slate-500">{currentUser.email}</div>
                  <div className="text-[10px] text-emerald-600 font-mono mt-0.5">
                    ✓ เชื่อมต่อสิทธิ์ Google Sheets สำเร็จ
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-800">ยังไม่ได้เข้าสู่ระบบ Google</div>
                <div className="text-[11px] text-slate-500">
                  เข้าสู่ระบบเพื่ออนุญาตให้แอปอ่านและบันทึกข้อมูลลงในบัญชี Google Sheets ของคุณ
                </div>
              </div>
            )}

            <div>
              {currentUser ? (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 hover:text-slate-900 rounded-lg transition-colors shadow-2xs"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>ออกจากระบบ</span>
                </button>
              ) : (
                <button
                  onClick={handleSignIn}
                  disabled={isLoggingIn}
                  className="flex items-center gap-2.5 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-semibold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {isLoggingIn ? (
                    <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
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
          <div className="flex border-b border-slate-200 text-xs">
            <button
              onClick={() => setActiveTab('export')}
              className={`flex items-center gap-1.5 px-4 py-2 font-semibold border-b-2 transition-colors ${
                activeTab === 'export'
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>สร้าง Google Sheets ใหม่</span>
            </button>
            <button
              onClick={() => setActiveTab('sync')}
              className={`flex items-center gap-1.5 px-4 py-2 font-semibold border-b-2 transition-colors ${
                activeTab === 'sync'
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>อัปเดตชีตเดิม</span>
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`flex items-center gap-1.5 px-4 py-2 font-semibold border-b-2 transition-colors ${
                activeTab === 'import'
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
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
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  ชื่อไฟล์ Google Sheets
                </label>
                <input
                  type="text"
                  value={sheetTitle}
                  onChange={(e) => setSheetTitle(e.target.value)}
                  placeholder="ระบุชื่อเอกสาร..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5 text-slate-600">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-emerald-600" />
                  สเปรดชีตที่สร้างจะประกอบด้วย 3 แผ่นงาน (Tabs):
                </div>
                <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-slate-500">
                  <li>
                    <strong className="text-slate-700">ข้อมูลหม้อแปลงทั้งหมด</strong>: รายการหม้อแปลง {transformers.length} เครื่อง (PEA No., Serial, ยี่ห้อ, kVA, สถานะ, ช่อง)
                  </li>
                  <li>
                    <strong className="text-slate-700">ผังคลังและสถานะช่อง</strong>: แสดงสถานะช่องจัดเก็บทั้ง {config.columns * config.rows} ช่อง
                  </li>
                  <li>
                    <strong className="text-slate-700">สรุปสถิติคลัง</strong>: จำนวนเครื่องตามสถานะสี และอัตราการใช้งานคลัง
                  </li>
                </ul>
              </div>

              <button
                onClick={handleExportNewSheet}
                disabled={isLoading || !accessToken}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs disabled:opacity-50"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  URL หรือ Spreadsheet ID ของ Google Sheets ที่มีอยู่
                </label>
                <input
                  type="text"
                  value={existingSheetInput}
                  onChange={(e) => setExistingSheetInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1abc.../edit หรือ Spreadsheet ID"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>คำเตือนการแก้ไขข้อมูล:</strong> ระบบจะอัปเดตและเขียนทับข้อมูลในชีตตามข้อมูลปัจจุบันของคลังหม้อแปลง ({transformers.length} เครื่อง) จะมีหน้าต่างยืนยันก่อนบันทึกเสมอ
                </div>
              </div>

              <button
                onClick={handleRequestSync}
                disabled={isLoading || !accessToken || !existingSheetInput.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs disabled:opacity-50"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  URL หรือ Spreadsheet ID ของ Google Sheets
                </label>
                <input
                  type="text"
                  value={existingSheetInput}
                  onChange={(e) => setExistingSheetInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1abc.../edit"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 space-y-1">
                <div className="text-slate-800 font-medium">รูปแบบหัวคอลัมน์ที่รองรับ:</div>
                <div className="font-mono text-[10px] text-slate-600">
                  ลำดับ | PEA No. | Serial Number | ยี่ห้อ | ขนาด (kVA) | เฟส | แรงดัน | สถานะ | ตำแหน่งจัดเก็บ
                </div>
              </div>

              <button
                onClick={handleRequestImport}
                disabled={isLoading || !accessToken || !existingSheetInput.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs disabled:opacity-50"
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
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2 text-xs text-emerald-800 truncate">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">
                  พร้อมใช้งาน: <strong>{lastExportResult.title}</strong>
                </span>
              </div>
              <a
                href={lastExportResult.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors shadow-2xs"
              >
                <span>เปิดใน Google Sheets</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
          >
            ปิด
          </button>
        </div>
      </div>

      {/* Mandatory User Confirmation Dialog */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 tracking-tight">
                  {confirmModal.title}
                </h4>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {confirmModal.description}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`px-4 py-1.5 text-xs font-bold text-white rounded-xl shadow-xs transition-colors ${
                  confirmModal.actionType === 'sync'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-blue-600 hover:bg-blue-700'
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
