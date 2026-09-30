import React, { useState, useEffect, useRef } from 'react';
import { Transformer, WarehouseConfig, getStatusConfig } from '../types';
import { normalizePeaNo, cleanBrandToEnglish } from '../utils/customOptions';
import { Lock, ArrowRight, ShieldCheck, KeyRound, AlertCircle, Check, X } from 'lucide-react';

interface MoveConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  transformer: Transformer | null;
  fromDescription: string;
  toDescription: string;
  config: WarehouseConfig;
}

const PIN_STORAGE_KEY = 'warehouse_move_pin';
const DEFAULT_PIN = '1234';

export const MoveConfirmationModal: React.FC<MoveConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  transformer,
  fromDescription,
  toDescription,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);
  
  // Change PIN states
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmNewPinInput, setConfirmNewPinInput] = useState('');
  const [changePinSuccess, setChangePinSuccess] = useState('');
  const [changePinError, setChangePinError] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  const getStoredPin = (): string => {
    return localStorage.getItem(PIN_STORAGE_KEY) || DEFAULT_PIN;
  };

  useEffect(() => {
    if (isOpen) {
      setPinInput('');
      setErrorMessage('');
      setIsChangingPin(false);
      setCurrentPinInput('');
      setNewPinInput('');
      setConfirmNewPinInput('');
      setChangePinSuccess('');
      setChangePinError('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen || !transformer) return null;

  const statusConfig = getStatusConfig(transformer?.status);
  const displayPeaNo = normalizePeaNo(transformer.peaNo);

  const handleVerifyAndConfirm = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const correctPin = getStoredPin();

    if (pinInput.trim() === correctPin) {
      setErrorMessage('');
      onConfirm();
    } else {
      setErrorMessage('รหัสผ่านไม่ถูกต้อง กรุณาระบุรหัสใหม่อีกครั้ง');
      setPinInput('');
      inputRef.current?.focus();
    }
  };

  const handleChangePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setChangePinError('');
    setChangePinSuccess('');

    const correctPin = getStoredPin();
    if (currentPinInput.trim() !== correctPin) {
      setChangePinError('รหัสผ่านปัจจุบันไม่ถูกต้อง');
      return;
    }

    if (newPinInput.length < 4) {
      setChangePinError('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 หลัก');
      return;
    }

    if (newPinInput !== confirmNewPinInput) {
      setChangePinError('รหัสผ่านใหม่ทั้ง 2 ช่องไม่ตรงกัน');
      return;
    }

    localStorage.setItem(PIN_STORAGE_KEY, newPinInput.trim());
    setChangePinSuccess('เปลี่ยนรหัสผ่านยืนยันสำเร็จ!');
    setTimeout(() => {
      setIsChangingPin(false);
      setChangePinSuccess('');
      setChangePinError('');
      setPinInput('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-[#eff2ee] border border-[#c6d1cb] rounded-2xl shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#ced8d2] bg-[#e5eae7]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#e3daf3] border border-violet-300/80 flex items-center justify-center text-violet-900">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#2b3833] leading-tight">
                ยืนยันการย้ายตำแหน่งหม้อแปลง
              </h3>
              <p className="text-[11px] text-[#5a6b65]">
                ต้องระบุรหัสยืนยันเพื่อความปลอดภัยในการจัดการผังคลัง
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#5a6b65] hover:text-[#2b3833] p-1.5 rounded-lg hover:bg-[#dce3de] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Transformer Info Banner */}
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-200">
                  PEA No.
                </span>
                <span className="font-mono font-bold text-base text-slate-800">
                  {displayPeaNo}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-800">{transformer.capacityKva} kVA</span>
                <span>•</span>
                <span className={transformer.phase === '3-Phase' ? 'text-blue-600 font-medium' : 'text-purple-600 font-medium'}>
                  {transformer.phase}
                </span>
                <span>•</span>
                <span className="truncate max-w-[120px]">{cleanBrandToEnglish(transformer.brand)}</span>
              </div>
            </div>

            <span
              className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${statusConfig.badgeBg} ${statusConfig.badgeText}`}
            >
              {statusConfig.label}
            </span>
          </div>

          {/* Relocation Route Details */}
          <div className="bg-slate-50/50 border border-slate-200/80 rounded-xl p-3.5">
            <div className="text-[11px] text-slate-500 font-medium mb-2">เส้นทางการย้ายจุดวาง:</div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-center shadow-2xs">
                <span className="text-[10px] text-slate-500 block uppercase font-medium">ตำแหน่งเดิม</span>
                <span className="text-xs font-bold text-slate-700 mt-0.5 block truncate">
                  {fromDescription}
                </span>
              </div>

              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-100 border border-violet-200 text-violet-700 shrink-0">
                <ArrowRight className="w-4 h-4" />
              </div>

              <div className="flex-1 bg-violet-50/80 border border-violet-200 rounded-lg p-2 text-center shadow-2xs">
                <span className="text-[10px] text-violet-700 block uppercase font-bold">ตำแหน่งใหม่</span>
                <span className="text-xs font-bold text-violet-900 mt-0.5 block truncate">
                  {toDescription}
                </span>
              </div>
            </div>
          </div>

          {/* PIN Input or Change PIN Form */}
          {!isChangingPin ? (
            <form onSubmit={handleVerifyAndConfirm} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  ระบุรหัสผ่านยืนยัน (PIN) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    ref={inputRef}
                    type="password"
                    maxLength={10}
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="ใส่รหัสผ่าน 4 หลัก (ค่าเริ่มต้น: 1234)"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-violet-400 rounded-xl text-sm font-mono tracking-widest text-slate-800 placeholder:text-slate-400 placeholder:tracking-normal focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-violet-100"
                  />
                </div>

                {errorMessage && (
                  <div className="flex items-center gap-1.5 text-xs text-rose-600 mt-1.5 animate-in fade-in">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500">
                  รหัสเริ่มต้น: <span className="font-mono text-slate-700 font-bold">1234</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsChangingPin(true)}
                  className="text-[11px] text-violet-600 hover:text-violet-700 font-semibold underline underline-offset-2 transition-colors"
                >
                  ตั้งค่ารหัสผ่านใหม่
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={!pinInput.trim()}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:pointer-events-none rounded-xl transition-colors shadow-xs"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>ยืนยันการย้าย</span>
                </button>
              </div>
            </form>
          ) : (
            /* Change PIN Mode */
            <form onSubmit={handleChangePinSubmit} className="space-y-3 bg-slate-50/70 border border-slate-200 p-3.5 rounded-xl">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <span className="text-xs font-bold text-violet-700">เปลี่ยนรหัสผ่านยืนยัน (PIN)</span>
                <button
                  type="button"
                  onClick={() => setIsChangingPin(false)}
                  className="text-xs text-slate-500 hover:text-slate-700 font-medium"
                >
                  กลับ
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  รหัสผ่านปัจจุบัน
                </label>
                <input
                  type="password"
                  value={currentPinInput}
                  onChange={(e) => setCurrentPinInput(e.target.value)}
                  placeholder="รหัสปัจจุบัน (เริ่มต้น: 1234)"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 focus:border-violet-400 rounded-lg text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-violet-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  รหัสผ่านใหม่ (อย่างน้อย 4 หลัก)
                </label>
                <input
                  type="password"
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  placeholder="รหัสผ่านใหม่"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 focus:border-violet-400 rounded-lg text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-violet-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  ยืนยันรหัสผ่านใหม่อีกครั้ง
                </label>
                <input
                  type="password"
                  value={confirmNewPinInput}
                  onChange={(e) => setConfirmNewPinInput(e.target.value)}
                  placeholder="พิมพ์รหัสใหม่อีกครั้ง"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 focus:border-violet-400 rounded-lg text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-violet-100"
                />
              </div>

              {changePinError && (
                <div className="text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{changePinError}</span>
                </div>
              )}

              {changePinSuccess && (
                <div className="text-[11px] text-emerald-600 flex items-center gap-1 font-medium">
                  <Check className="w-3 h-3 shrink-0" />
                  <span>{changePinSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsChangingPin(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors shadow-2xs"
                >
                  บันทึกรหัสใหม่
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
