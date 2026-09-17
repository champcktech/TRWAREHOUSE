import React, { useState, useEffect, useRef } from 'react';
import { Transformer, WarehouseConfig, STATUS_CONFIG } from '../types';
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

  const statusConfig = STATUS_CONFIG[transformer.status];
  const cleanPeaNo = transformer.peaNo.replace(/^PEA\s*[-_]?\s*/i, '').trim();

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
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-[#111111] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#222] bg-[#161616]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">
                ยืนยันการย้ายตำแหน่งหม้อแปลง
              </h3>
              <p className="text-[11px] text-[#888]">
                ต้องระบุรหัสยืนยันเพื่อความปลอดภัยในการจัดการผังคลัง
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#666] hover:text-[#bbb] p-1 rounded-md hover:bg-[#222] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Transformer Info Banner */}
          <div className="bg-[#181818] border border-[#262626] rounded-xl p-3.5 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  PEA
                </span>
                <span className="font-mono font-bold text-base text-white">
                  {cleanPeaNo}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#aaa]">
                <span className="font-semibold text-white">{transformer.capacityKva} kVA</span>
                <span>•</span>
                <span className={transformer.phase === '3-Phase' ? 'text-blue-300' : 'text-purple-300'}>
                  {transformer.phase}
                </span>
                <span>•</span>
                <span className="truncate max-w-[120px]">{transformer.brand}</span>
              </div>
            </div>

            <span
              className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${statusConfig.badgeBg} ${statusConfig.badgeText}`}
            >
              {statusConfig.label}
            </span>
          </div>

          {/* Relocation Route Details */}
          <div className="bg-[#141414] border border-[#242424] rounded-xl p-3.5">
            <div className="text-[11px] text-[#777] font-medium mb-2">เส้นทางการย้ายจุดวาง:</div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-2 text-center">
                <span className="text-[10px] text-[#777] block uppercase font-medium">ตำแหน่งเดิม</span>
                <span className="text-xs font-bold text-[#ddd] mt-0.5 block truncate">
                  {fromDescription}
                </span>
              </div>

              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-600/20 border border-orange-500/30 text-orange-400 shrink-0">
                <ArrowRight className="w-4 h-4" />
              </div>

              <div className="flex-1 bg-[#1f1a14] border border-orange-500/40 rounded-lg p-2 text-center">
                <span className="text-[10px] text-orange-400 block uppercase font-bold">ตำแหน่งใหม่</span>
                <span className="text-xs font-bold text-orange-200 mt-0.5 block truncate">
                  {toDescription}
                </span>
              </div>
            </div>
          </div>

          {/* PIN Input or Change PIN Form */}
          {!isChangingPin ? (
            <form onSubmit={handleVerifyAndConfirm} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#bbb] mb-1.5">
                  ระบุรหัสผ่านยืนยัน (PIN) <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#666]">
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
                    className="w-full pl-9 pr-3 py-2.5 bg-[#161616] border border-[#2e2e2e] focus:border-orange-500 rounded-xl text-sm font-mono tracking-widest text-white placeholder:text-[#555] placeholder:tracking-normal focus:outline-hidden focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                {errorMessage && (
                  <div className="flex items-center gap-1.5 text-xs text-rose-400 mt-1.5 animate-in fade-in">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-[#777]">
                  รหัสเริ่มต้น: <span className="font-mono text-[#aaa] font-bold">1234</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsChangingPin(true)}
                  className="text-[11px] text-orange-400 hover:text-orange-300 underline underline-offset-2 transition-colors"
                >
                  ตั้งค่ารหัสผ่านใหม่
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-[#888] hover:text-white bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] rounded-xl transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={!pinInput.trim()}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:pointer-events-none rounded-xl transition-colors shadow-md shadow-orange-950"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>ยืนยันการย้าย</span>
                </button>
              </div>
            </form>
          ) : (
            /* Change PIN Mode */
            <form onSubmit={handleChangePinSubmit} className="space-y-3 bg-[#161616] border border-[#2a2a2a] p-3.5 rounded-xl">
              <div className="flex items-center justify-between border-b border-[#242424] pb-2">
                <span className="text-xs font-bold text-orange-400">เปลี่ยนรหัสผ่านยืนยัน (PIN)</span>
                <button
                  type="button"
                  onClick={() => setIsChangingPin(false)}
                  className="text-xs text-[#888] hover:text-white"
                >
                  กลับ
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#aaa] mb-1">
                  รหัสผ่านปัจจุบัน
                </label>
                <input
                  type="password"
                  value={currentPinInput}
                  onChange={(e) => setCurrentPinInput(e.target.value)}
                  placeholder="รหัสปัจจุบัน (เริ่มต้น: 1234)"
                  className="w-full px-3 py-1.5 bg-[#121212] border border-[#2e2e2e] focus:border-orange-500 rounded-lg text-xs font-mono text-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#aaa] mb-1">
                  รหัสผ่านใหม่ (อย่างน้อย 4 หลัก)
                </label>
                <input
                  type="password"
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  placeholder="รหัสผ่านใหม่"
                  className="w-full px-3 py-1.5 bg-[#121212] border border-[#2e2e2e] focus:border-orange-500 rounded-lg text-xs font-mono text-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#aaa] mb-1">
                  ยืนยันรหัสผ่านใหม่อีกครั้ง
                </label>
                <input
                  type="password"
                  value={confirmNewPinInput}
                  onChange={(e) => setConfirmNewPinInput(e.target.value)}
                  placeholder="พิมพ์รหัสใหม่อีกครั้ง"
                  className="w-full px-3 py-1.5 bg-[#121212] border border-[#2e2e2e] focus:border-orange-500 rounded-lg text-xs font-mono text-white focus:outline-hidden"
                />
              </div>

              {changePinError && (
                <div className="text-[11px] text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{changePinError}</span>
                </div>
              )}

              {changePinSuccess && (
                <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <Check className="w-3 h-3 shrink-0" />
                  <span>{changePinSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsChangingPin(false)}
                  className="px-3 py-1.5 text-xs text-[#888] hover:text-white bg-[#1f1f1f] rounded-lg"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors"
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
