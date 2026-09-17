import React, { useState, useEffect } from 'react';
import {
  Transformer,
  TransformerStatus,
  WarehouseConfig,
  STATUS_CONFIG,
  WarehouseZoneId,
  TransformerLocationType
} from '../types';
import { X, Check, AlertCircle, Plus, Zap, Tag, Lock, Truck } from 'lucide-react';
import {
  getStoredCapacities,
  addCustomCapacity,
  getStoredBrands,
  addCustomBrand,
  cleanBrandToEnglish
} from '../utils/customOptions';

interface TransformerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transformer: Transformer) => void;
  initialData?: Transformer | null;
  defaultSlot?: number | null;
  defaultZone?: WarehouseZoneId;
  defaultLocationType?: TransformerLocationType;
  config: WarehouseConfig;
  existingTransformers: Transformer[];
}

export const TransformerFormModal: React.FC<TransformerFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  defaultSlot,
  defaultZone = 'right',
  defaultLocationType = 'grid',
  config,
  existingTransformers
}) => {
  const [peaNo, setPeaNo] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [capacityKva, setCapacityKva] = useState<number>(100);
  const [phase, setPhase] = useState<'1-Phase' | '3-Phase'>('3-Phase');
  const [voltage, setVoltage] = useState('22 kV / 400-230 V');
  const [brand, setBrand] = useState('Ekarat');
  const [status, setStatus] = useState<TransformerStatus>('good');

  // Location representation: 'triage' | 'holding' | 'repair' | `${zone}-${slotNumber}`
  const [locationSelection, setLocationSelection] = useState<string>('holding');
  const [movePinInput, setMovePinInput] = useState<string>('');

  // Repair tracking fields
  const [repairVendor, setRepairVendor] = useState('');
  const [repairSentDate, setRepairSentDate] = useState('');
  const [repairDocNo, setRepairDocNo] = useState('');
  const [repairExpectedReturn, setRepairExpectedReturn] = useState('');

  const [receivedDate, setReceivedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Custom capacity & brand state
  const [capacitiesList, setCapacitiesList] = useState<number[]>(getStoredCapacities);
  const [brandsList, setBrandsList] = useState<string[]>(getStoredBrands);

  const [showAddCapInput, setShowAddCapInput] = useState(false);
  const [customCapValue, setCustomCapValue] = useState('');

  const [showAddBrandInput, setShowAddBrandInput] = useState(false);
  const [customBrandValue, setCustomBrandValue] = useState('');

  const gridCols = config.columns || config.leftGrid?.columns || 4;
  const gridRows = config.rows || config.leftGrid?.rows || 14;
  const gridTotal = gridCols * gridRows;
  const gridPrefix = config.zonePrefix || config.leftGrid?.zonePrefix || 'A';
  const gridName = config.name || config.leftGrid?.name || 'จุดวางหม้อแปลง';

  useEffect(() => {
    // Refresh lists from storage
    setCapacitiesList(getStoredCapacities());
    setBrandsList(getStoredBrands());

    if (initialData) {
      setPeaNo(initialData.peaNo);
      setSerialNo(initialData.serialNo);
      setCapacityKva(initialData.capacityKva);
      setPhase(initialData.phase);
      setVoltage(initialData.voltage || '22 kV / 400-230 V');
      setBrand(cleanBrandToEnglish(initialData.brand));
      setStatus(initialData.status);

      if (initialData.locationType === 'triage') {
        setLocationSelection('triage');
      } else if (initialData.locationType === 'repair') {
        setLocationSelection('repair');
      } else if (initialData.locationType === 'sale') {
        setLocationSelection('sale');
      } else if (initialData.slotNumber !== null) {
        setLocationSelection(`${initialData.zone || 'right'}-${initialData.slotNumber}`);
      } else {
        setLocationSelection('holding');
      }

      setRepairVendor(initialData.repairVendor || '');
      setRepairSentDate(initialData.repairSentDate || '');
      setRepairDocNo(initialData.repairDocNo || '');
      setRepairExpectedReturn(initialData.repairExpectedReturn || '');

      setReceivedDate(initialData.receivedDate);
      setNotes(initialData.notes || '');
    } else {
      // New transformer: Added to holding area by default
      setPeaNo('');
      setSerialNo('');
      setCapacityKva(100);
      setPhase('3-Phase');
      setVoltage('22 kV / 400-230 V');
      setBrand('Ekarat');
      setStatus('good');
      setLocationSelection('holding');
      setRepairVendor('');
      setRepairSentDate('');
      setRepairDocNo('');
      setRepairExpectedReturn('');
      setReceivedDate(new Date().toISOString().slice(0, 10));
      setNotes('');
    }
    setErrorMsg('');
    setMovePinInput('');
    setShowAddCapInput(false);
    setShowAddBrandInput(false);
  }, [initialData, defaultSlot, defaultZone, defaultLocationType, isOpen]);

  if (!isOpen) return null;

  // Parse location selection
  const parseLocation = (locStr: string) => {
    if (locStr === 'triage') {
      return { slotNumber: null, zone: undefined, locationType: 'triage' as TransformerLocationType };
    }
    if (locStr === 'holding') {
      return { slotNumber: null, zone: undefined, locationType: 'holding' as TransformerLocationType };
    }
    if (locStr === 'repair') {
      return { slotNumber: null, zone: undefined, locationType: 'repair' as TransformerLocationType };
    }
    if (locStr === 'sale') {
      return { slotNumber: null, zone: undefined, locationType: 'sale' as TransformerLocationType };
    }
    if (locStr.startsWith('left-')) {
      const slotNum = Number(locStr.replace('left-', ''));
      return { slotNumber: slotNum, zone: 'left' as WarehouseZoneId, locationType: 'grid' as TransformerLocationType };
    }
    if (locStr.startsWith('right-')) {
      const slotNum = Number(locStr.replace('right-', ''));
      return { slotNumber: slotNum, zone: 'right' as WarehouseZoneId, locationType: 'grid' as TransformerLocationType };
    }
    return { slotNumber: null, zone: undefined, locationType: 'holding' as TransformerLocationType };
  };

  const parsedLoc = parseLocation(locationSelection);

  // Check if slot is occupied
  const occupiedBy = parsedLoc.slotNumber !== null
    ? existingTransformers.find(
        (t) =>
          t.slotNumber === parsedLoc.slotNumber &&
          (t.zone === parsedLoc.zone || (!t.zone && parsedLoc.zone === 'right')) &&
          t.id !== initialData?.id
      )
    : null;

  const handleAddNewCapacity = () => {
    const num = Number(customCapValue);
    if (!num || num <= 0 || isNaN(num)) {
      setErrorMsg('กรุณากรอกตัวเลขขนาด kVA ที่ถูกต้อง');
      return;
    }
    const updated = addCustomCapacity(num);
    setCapacitiesList(updated);
    setCapacityKva(num);
    setCustomCapValue('');
    setShowAddCapInput(false);
    setErrorMsg('');
  };

  const handleAddNewBrand = () => {
    const trimmed = customBrandValue.trim();
    if (!trimmed) {
      setErrorMsg('กรุณากรอกชื่อยี่ห้อหม้อแปลง');
      return;
    }
    const updated = addCustomBrand(trimmed);
    setBrandsList(updated);
    setBrand(trimmed);
    setCustomBrandValue('');
    setShowAddBrandInput(false);
    setErrorMsg('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!peaNo.trim()) {
      setErrorMsg('กรุณากรอกรหัส PEA');
      return;
    }
    if (!serialNo.trim()) {
      setErrorMsg('กรุณากรอก Serial Number (S/N)');
      return;
    }

    // Check duplicate PEA code
    const duplicatePea = existingTransformers.find(
      (t) => t.peaNo.trim().toLowerCase() === peaNo.trim().toLowerCase() && t.id !== initialData?.id
    );
    if (duplicatePea) {
      setErrorMsg(`รหัส PEA นี้มีอยู่แล้วในระบบ (${duplicatePea.peaNo})`);
      return;
    }

    // For new transformers: strictly only allowed to be added to holding area
    const { slotNumber: parsedSlot, zone: parsedZone, locationType: parsedLocationType } = parseLocation(locationSelection);
    const resolvedSlot = initialData ? parsedSlot : null;
    const resolvedZone = initialData ? parsedZone : undefined;
    const resolvedLocationType = initialData ? parsedLocationType : ('holding' as TransformerLocationType);

    // If editing existing transformer and location was changed, require move PIN!
    if (initialData) {
      const isLocationChanged =
        initialData.slotNumber !== resolvedSlot ||
        (initialData.zone || 'right') !== (resolvedZone || 'right') ||
        (initialData.locationType || 'grid') !== (resolvedLocationType || 'grid');

      if (isLocationChanged) {
        const correctPin = localStorage.getItem('warehouse_move_pin') || '1234';
        if (movePinInput.trim() !== correctPin) {
          setErrorMsg('รหัสผ่านยืนยันการย้ายจุดวางไม่ถูกต้อง (ค่าเริ่มต้น: 1234)');
          return;
        }
      }
    }

    const updated: Transformer = {
      id: initialData ? initialData.id : `tr-${Date.now()}`,
      peaNo: peaNo.trim().startsWith('PEA') ? peaNo.trim() : `PEA ${peaNo.trim()}`,
      serialNo: serialNo.trim(),
      capacityKva: Number(capacityKva),
      phase,
      voltage: voltage.trim(),
      brand,
      status,
      slotNumber: resolvedSlot,
      zone: resolvedZone,
      locationType: resolvedLocationType,
      receivedDate: receivedDate || new Date().toISOString().slice(0, 10),
      notes: notes.trim(),
      repairVendor: resolvedLocationType === 'repair' ? repairVendor.trim() : (initialData?.repairVendor || undefined),
      repairSentDate: resolvedLocationType === 'repair' ? (repairSentDate || new Date().toISOString().slice(0, 10)) : (initialData?.repairSentDate || undefined),
      repairDocNo: resolvedLocationType === 'repair' ? repairDocNo.trim() : (initialData?.repairDocNo || undefined),
      repairExpectedReturn: resolvedLocationType === 'repair' ? repairExpectedReturn.trim() : (initialData?.repairExpectedReturn || undefined),
      updatedAt: new Date().toISOString().slice(0, 10)
    };

    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#0c0c0c] rounded-xl shadow-2xl border border-[#2a2a2a] w-full max-w-xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222] bg-[#121212]">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              {initialData ? 'แก้ไขข้อมูลหม้อแปลงไฟฟ้า' : 'เพิ่มหม้อแปลงไฟฟ้าใหม่'}
            </h3>
            <p className="text-xs text-[#777] mt-0.5">
              กำหนดรายละเอียดทางเทคนิค ยี่ห้อ ขนาด kVA และจุดวางในคลัง
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-[#666] hover:text-white hover:bg-[#202020] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-semibold text-[#aaa] mb-2">
              สถานะหม้อแปลง (แยกตามสี) *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(STATUS_CONFIG) as TransformerStatus[]).map((st) => {
                const conf = STATUS_CONFIG[st];
                const isSelected = status === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatus(st)}
                    className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'ring-1 ring-orange-500 border-orange-500 bg-orange-950/30'
                        : 'border-[#262626] hover:border-[#383838] bg-[#141414]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: conf.hexColor }}
                      />
                      {isSelected && <Check className="w-3.5 h-3.5 text-orange-400" />}
                    </div>
                    <span className="text-xs font-bold text-white">{conf.label}</span>
                    <span className="text-[10px] text-[#777] mt-0.5">สี{conf.colorName}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* PEA Code */}
            <div>
              <label className="block text-xs font-semibold text-[#aaa] mb-1">
                รหัส PEA (ทรัพย์สิน กฟภ.) *
              </label>
              <input
                type="text"
                required
                value={peaNo}
                onChange={(e) => setPeaNo(e.target.value)}
                placeholder="เช่น 51-002341"
                className="w-full px-3 py-2 bg-[#141414] border border-[#2a2a2a] rounded-lg text-sm text-[#e5e5e5] placeholder-[#555] focus:outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
            </div>

            {/* Serial Number (Sn) */}
            <div>
              <label className="block text-xs font-semibold text-[#aaa] mb-1">
                Serial Number (S/N) *
              </label>
              <input
                type="text"
                required
                value={serialNo}
                onChange={(e) => setSerialNo(e.target.value)}
                placeholder="เช่น SN-EK-2023-8812"
                className="w-full px-3 py-2 bg-[#141414] border border-[#2a2a2a] rounded-lg text-sm text-[#e5e5e5] placeholder-[#555] focus:outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
            </div>

            {/* Capacity (ขนาด kVA) with Custom Add feature */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#aaa] flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>ขนาดพิกัด (kVA) *</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddCapInput(!showAddCapInput)}
                  className="text-[11px] text-orange-400 hover:text-orange-300 flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" />
                  <span>{showAddCapInput ? 'ปิด' : 'เพิ่มขนาดเอง'}</span>
                </button>
              </div>

              {showAddCapInput && (
                <div className="mb-2 p-2 rounded-lg bg-[#181818] border border-orange-500/40 space-y-2">
                  <p className="text-[10px] text-[#aaa]">พิมพ์ขนาด kVA ใหม่ เช่น 45, 125, 630, 1250:</p>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      min="1"
                      value={customCapValue}
                      onChange={(e) => setCustomCapValue(e.target.value)}
                      placeholder="เช่น 125"
                      className="w-full px-2 py-1 bg-[#101010] border border-[#333] rounded text-xs text-white"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddNewCapacity();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddNewCapacity}
                      className="px-2.5 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded text-xs font-bold shrink-0"
                    >
                      บันทึกขนาด
                    </button>
                  </div>
                </div>
              )}

              <select
                value={capacityKva}
                onChange={(e) => setCapacityKva(Number(e.target.value))}
                aria-label="ขนาดพิกัด kVA"
                className="w-full px-3 py-2 bg-[#141414] border border-[#2a2a2a] rounded-lg text-sm text-[#e5e5e5] focus:outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              >
                {capacitiesList.map((k) => (
                  <option key={k} value={k}>
                    {k} kVA
                  </option>
                ))}
              </select>
            </div>

            {/* Brand (ยี่ห้อ) with Custom Add feature */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#aaa] flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-blue-400" />
                  <span>ยี่ห้อ (Brand) *</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddBrandInput(!showAddBrandInput)}
                  className="text-[11px] text-orange-400 hover:text-orange-300 flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" />
                  <span>{showAddBrandInput ? 'ปิด' : 'เพิ่มยี่ห้อเอง'}</span>
                </button>
              </div>

              {showAddBrandInput && (
                <div className="mb-2 p-2 rounded-lg bg-[#181818] border border-orange-500/40 space-y-2">
                  <p className="text-[10px] text-[#aaa]">พิมพ์ชื่อยี่ห้อใหม่ (ภาษาอังกฤษ เช่น Siemens, Hitachi):</p>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={customBrandValue}
                      onChange={(e) => setCustomBrandValue(e.target.value)}
                      placeholder="เช่น Siemens, Hitachi"
                      className="w-full px-2 py-1 bg-[#101010] border border-[#333] rounded text-xs text-white"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddNewBrand();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddNewBrand}
                      className="px-2.5 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded text-xs font-bold shrink-0"
                    >
                      บันทึกยี่ห้อ
                    </button>
                  </div>
                </div>
              )}

              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                aria-label="ยี่ห้อหม้อแปลง"
                className="w-full px-3 py-2 bg-[#141414] border border-[#2a2a2a] rounded-lg text-sm text-[#e5e5e5] focus:outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              >
                {brandsList.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {/* Phase */}
            <div>
              <label className="block text-xs font-semibold text-[#aaa] mb-1">
                ระบบเฟส
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPhase('3-Phase');
                    setVoltage('22 kV / 400-230 V');
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
                    phase === '3-Phase'
                      ? 'border-orange-500 bg-orange-950/40 text-orange-400'
                      : 'border-[#2a2a2a] text-[#888] bg-[#141414] hover:bg-[#1a1a1a]'
                  }`}
                >
                  3 เฟส (3-Phase)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPhase('1-Phase');
                    setVoltage('22 kV / 460-230 V');
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
                    phase === '1-Phase'
                      ? 'border-orange-500 bg-orange-950/40 text-orange-400'
                      : 'border-[#2a2a2a] text-[#888] bg-[#141414] hover:bg-[#1a1a1a]'
                  }`}
                >
                  1 เฟส (1-Phase)
                </button>
              </div>
            </div>

            {/* Voltage */}
            <div>
              <label className="block text-xs font-semibold text-[#aaa] mb-1">
                พิกัดแรงดันไฟฟ้า
              </label>
              <input
                type="text"
                value={voltage}
                onChange={(e) => setVoltage(e.target.value)}
                placeholder="เช่น 22 kV / 400-230 V"
                className="w-full px-3 py-2 bg-[#141414] border border-[#2a2a2a] rounded-lg text-sm text-[#e5e5e5] placeholder-[#555] focus:outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Position / Location in warehouse (Holding, Triage, Left Grid, Right Grid) */}
            <div>
              {!initialData ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-[#aaa]">
                      ตำแหน่งจุดวาง / สถานที่จัดเก็บ *
                    </label>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-950/80 text-orange-400 border border-orange-700/60 flex items-center gap-1">
                      <span>🔒</span>
                      <span>จุดพักรอจัดเก็บเท่านั้น</span>
                    </span>
                  </div>
                  <div className="w-full px-3.5 py-2.5 bg-[#141414] border border-[#2a2a2a] rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-[#f5f5f5] font-semibold">
                      <span className="text-base">📦</span>
                      <span>จุดพักรอจัดเก็บ (Holding Area)</span>
                    </div>
                    <span className="text-[10px] font-medium text-[#aaa] bg-[#1c1c1c] px-2 py-0.5 rounded border border-[#333]">
                      พื้นที่เริ่มต้น
                    </span>
                  </div>
                  <p className="text-[11px] text-[#888] mt-1.5 flex items-center gap-1">
                    <span>•</span>
                    <span>หม้อแปลงเพิ่มใหม่จะเข้าสู่ <strong>จุดพักรอจัดเก็บ</strong> เท่านั้น จากนั้นสามารถลากจัดวางลงผังคลังได้</span>
                  </p>
                </div>
              ) : (
                <>
                  <label className="block text-xs font-semibold text-[#aaa] mb-1">
                    ตำแหน่งจุดวาง / สถานที่จัดเก็บ *
                  </label>
                  <select
                    value={locationSelection}
                    onChange={(e) => setLocationSelection(e.target.value)}
                    aria-label="เลือกตำแหน่งจุดวาง"
                    className="w-full px-3 py-2 bg-[#141414] border border-[#2a2a2a] rounded-lg text-sm text-[#e5e5e5] focus:outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  >
                    <optgroup label="📍 พื้นที่พักรอ / คัดแยก / ส่งซ่อม / รอขาย">
                      <option value="triage">🔍 จุดรอคัดแยก (Triage Area - รอตรวจสอบสภาพ)</option>
                      <option value="holding">📦 จุดพักรอจัดเก็บ (Holding Area - ยังไม่ลงช่อง)</option>
                      <option value="repair">🚚 ส่งซ่อมภายนอก (Out for Repair - โรงงาน/ศูนย์ซ่อม)</option>
                      <option value="sale">🏷️ จุดวางรอขาย (Waiting for Sale - รอจำหน่าย/ขายทอดตลาด)</option>
                    </optgroup>

                    <optgroup label={`📍 ${gridName} (โซน ${gridPrefix})`}>
                      {Array.from({ length: gridTotal }, (_, i) => i + 1).map((s) => {
                        const occ = existingTransformers.find(
                          (t) => (t.locationType === 'grid' || !t.locationType) && t.slotNumber === s && t.id !== initialData?.id
                        );
                        return (
                          <option key={`left-${s}`} value={`left-${s}`}>
                            {gridPrefix} {String(s).padStart(2, '0')} {occ ? `(มีหม้อแปลง ${occ.peaNo})` : '(ว่าง)'}
                          </option>
                        );
                      })}
                    </optgroup>
                  </select>
                  {occupiedBy && (
                    <p className="text-[11px] text-amber-400 mt-1">
                      * ช่องนี้มีหม้อแปลง {occupiedBy.peaNo} อยู่แล้ว หากบันทึกจะย้ายหม้อแปลงเดิมไปยังจุดพัก
                    </p>
                  )}

                  {initialData && (() => {
                    const { slotNumber: s, zone: z, locationType: l } = parseLocation(locationSelection);
                    const isChanged =
                      initialData.slotNumber !== s ||
                      (initialData.zone || 'right') !== (z || 'right') ||
                      (initialData.locationType || 'grid') !== (l || 'grid');
                    if (!isChanged) return null;

                    return (
                      <div className="mt-2.5 p-2.5 bg-orange-950/40 border border-orange-500/50 rounded-lg">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-300 mb-1">
                          <Lock className="w-3.5 h-3.5 text-orange-400" />
                          <span>มีการเปลี่ยนจุดวาง กรุณาระบุรหัสผ่านยืนยัน (PIN) *</span>
                        </div>
                        <input
                          type="password"
                          value={movePinInput}
                          onChange={(e) => setMovePinInput(e.target.value)}
                          placeholder="ใส่รหัสผ่าน 4 หลัก (ค่าเริ่มต้น: 1234)"
                          className="w-full px-3 py-1.5 bg-[#121212] border border-[#333] focus:border-orange-500 rounded text-xs font-mono text-white focus:outline-hidden"
                        />
                        <p className="text-[10px] text-[#888] mt-1">
                          * รหัสยืนยันการย้ายเริ่มต้นคือ 1234
                        </p>
                      </div>
                    );
                  })()}
                </>
              )}

              {/* Repair fields if repair is selected */}
              {locationSelection === 'repair' && (
                <div className="mt-3 p-3 bg-sky-950/20 border border-sky-800/60 rounded-lg space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400">
                    <Truck className="w-3.5 h-3.5" />
                    <span>ข้อมูลการส่งซ่อมภายนอก (Repair Details)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[11px] text-[#aaa] mb-1">
                        โรงงาน / ร้านซ่อมภายนอก
                      </label>
                      <input
                        type="text"
                        value={repairVendor}
                        onChange={(e) => setRepairVendor(e.target.value)}
                        placeholder="เช่น บ.ถิรไทย / โรงซ่อม PEA"
                        className="w-full px-2.5 py-1.5 bg-[#121212] border border-[#333] rounded text-xs text-white placeholder-[#555] focus:outline-hidden focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#aaa] mb-1">
                        วันที่ส่งซ่อม
                      </label>
                      <input
                        type="date"
                        value={repairSentDate}
                        onChange={(e) => setRepairSentDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#121212] border border-[#333] rounded text-xs text-white focus:outline-hidden focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#aaa] mb-1">
                        เลขที่เอกสาร / ใบส่งซ่อม
                      </label>
                      <input
                        type="text"
                        value={repairDocNo}
                        onChange={(e) => setRepairDocNo(e.target.value)}
                        placeholder="เช่น ใบส่งซ่อม 102/2569"
                        className="w-full px-2.5 py-1.5 bg-[#121212] border border-[#333] rounded text-xs text-white placeholder-[#555] focus:outline-hidden focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#aaa] mb-1">
                        กำหนดส่งคืนโดยประมาณ
                      </label>
                      <input
                        type="date"
                        value={repairExpectedReturn}
                        onChange={(e) => setRepairExpectedReturn(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#121212] border border-[#333] rounded text-xs text-white focus:outline-hidden focus:border-sky-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Received Date */}
            <div>
              <label className="block text-xs font-semibold text-[#aaa] mb-1">
                วันที่รับเข้าคลัง
              </label>
              <input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#141414] border border-[#2a2a2a] rounded-lg text-sm text-[#e5e5e5] focus:outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#aaa] mb-1">
              หมายเหตุ / รายละเอียดอาการซ่อม / แหล่งที่มา
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ระบุอาการชำรุด, ประวัติการทดสอบ หรือจุดติดตั้งเดิม..."
              className="w-full px-3 py-2 bg-[#141414] border border-[#2a2a2a] rounded-lg text-sm text-[#e5e5e5] placeholder-[#555] focus:outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#888] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{initialData ? 'บันทึกการแก้ไข' : 'เพิ่มหม้อแปลง'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
