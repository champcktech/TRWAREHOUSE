import React, { useState } from 'react';
import { WarehouseConfig, Transformer } from '../types';
import { X, Check, Sliders, AlertTriangle, Plus, Minus } from 'lucide-react';

interface GridConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: WarehouseConfig;
  onSaveConfig: (newConfig: WarehouseConfig) => void;
  transformers: Transformer[];
}

const SINGLE_PRESET_CONFIGS = [
  {
    label: '4 × 14',
    cols: 4,
    rows: 14,
    total: 56,
    desc: 'มาตรฐาน กฟภ. (4 คอลัมน์ × 14 แถว = 56 ช่อง)'
  },
  {
    label: '5 × 12',
    cols: 5,
    rows: 12,
    total: 60,
    desc: 'คลังมาตรฐานขนาดกลาง (60 ช่อง)'
  },
  {
    label: '4 × 10',
    cols: 4,
    rows: 10,
    total: 40,
    desc: 'คลังขนาด 40 ช่อง'
  },
  {
    label: '3 × 8',
    cols: 3,
    rows: 8,
    total: 24,
    desc: 'คลังกะทัดรัด (24 ช่อง)'
  },
  {
    label: '6 × 14',
    cols: 6,
    rows: 14,
    total: 84,
    desc: 'คลังขนาดใหญ่ (84 ช่อง)'
  },
  {
    label: '1 × 1',
    cols: 1,
    rows: 1,
    total: 1,
    desc: 'ขนาดต่ำสุด (1 ช่อง)'
  },
];

export const GridConfigModal: React.FC<GridConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  transformers
}) => {
  const [warehouseName, setWarehouseName] = useState(config.warehouseName);

  // Single zone configuration state
  const initialCols = config.columns || config.leftGrid?.columns || 4;
  const initialRows = config.rows || config.leftGrid?.rows || 14;
  const initialPrefix = config.zonePrefix || config.leftGrid?.zonePrefix || 'A';
  const initialName = config.name || config.leftGrid?.name || 'จุดวางหม้อแปลง';

  const [cols, setCols] = useState(initialCols);
  const [rows, setRows] = useState(initialRows);
  const [prefix, setPrefix] = useState(initialPrefix);
  const [name, setName] = useState(initialName);

  if (!isOpen) return null;

  const total = cols * rows;

  // Check cut-off transformers
  const cutoffTransformers = transformers.filter(
    (t) => (t.locationType === 'grid' || !t.locationType) && t.slotNumber !== null && t.slotNumber > total
  );
  const totalCutoff = cutoffTransformers.length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const safeCols = Math.max(1, Math.min(15, cols));
    const safeRows = Math.max(1, Math.min(50, rows));

    onSaveConfig({
      warehouseName: warehouseName.trim() || 'คลังหม้อแปลงไฟฟ้า',
      columns: safeCols,
      rows: safeRows,
      zonePrefix: prefix.trim() || 'A',
      name: name.trim() || 'จุดวางหม้อแปลง',
      leftGrid: {
        columns: safeCols,
        rows: safeRows,
        zonePrefix: prefix.trim() || 'A',
        name: name.trim() || 'จุดวางหม้อแปลง'
      }
    });

    onClose();
  };

  const handleApplyPreset = (p: typeof SINGLE_PRESET_CONFIGS[0]) => {
    setCols(p.cols);
    setRows(p.rows);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-[#eff2ee] rounded-2xl shadow-xl border border-[#c6d1cb] w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ced8d2] bg-[#e5eae7] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#e3daf3] border border-violet-300/80 flex items-center justify-center text-violet-900">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#2b3833] tracking-tight">
                ตั้งค่าและปรับขนาดผังคลัง
              </h3>
              <p className="text-[11px] text-[#5a6b65]">
                กำหนดจำนวนคอลัมน์ แถว และชื่อจุดวางหม้อแปลง
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#5a6b65] hover:text-[#2b3833] hover:bg-[#dce3de] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {/* Warehouse Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ชื่อคลังหลัก / สังกัด กฟภ.
            </label>
            <input
              type="text"
              value={warehouseName}
              onChange={(e) => setWarehouseName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </div>

          {/* Quick Preset Layouts */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              รูปแบบผังแนะนำ (Presets)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SINGLE_PRESET_CONFIGS.map((preset) => {
                const isActive = cols === preset.cols && rows === preset.rows;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className={`px-3 py-2 rounded-xl border text-left transition-all ${
                      isActive
                        ? 'border-violet-300 bg-violet-50 text-violet-900 shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-bold font-mono text-xs ${isActive ? 'text-violet-700' : 'text-slate-800'}`}>
                        {preset.label}
                      </span>
                      <span className="text-[10px] text-violet-600 font-mono font-bold">
                        {preset.total} ช่อง
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                      {preset.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid Parameters Card */}
          <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                <span className="text-xs font-bold text-slate-800">รายละเอียดจุดวางหม้อแปลง</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-md border border-violet-200">
                {total} ช่อง ({cols} × {rows})
              </span>
            </div>

            {/* Name & Prefix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-600 mb-1 font-medium">ชื่อจุดวางหม้อแปลง</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1 font-medium">คำนำหน้ารหัสช่อง (Prefix)</label>
                <input
                  type="text"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </div>
            </div>

            {/* Columns Stepper */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px] text-slate-600">
                <span>จำนวนคอลัมน์ (แนวนอน):</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCols(1)}
                    className="text-[10px] text-violet-600 hover:text-violet-800 hover:underline"
                  >
                    ต่ำสุด (1)
                  </button>
                  <span className="font-bold text-violet-700 font-mono">{cols} คอลัมน์</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCols((p) => Math.max(1, p - 1))}
                  disabled={cols <= 1}
                  className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 rounded-lg text-slate-700 font-bold transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={cols}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setCols(isNaN(val) ? 1 : Math.max(1, Math.min(15, val)));
                  }}
                  className="flex-1 text-center py-1 bg-white border border-slate-200 rounded-lg font-mono font-bold text-violet-700"
                />
                <button
                  type="button"
                  onClick={() => setCols((p) => Math.min(15, p + 1))}
                  disabled={cols >= 15}
                  className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 rounded-lg text-slate-700 font-bold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Rows Stepper */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[11px] text-slate-600">
                <span>จำนวนแถว (แนวตั้ง):</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRows(1)}
                    className="text-[10px] text-violet-600 hover:text-violet-800 hover:underline"
                  >
                    ต่ำสุด (1)
                  </button>
                  <span className="font-bold text-violet-700 font-mono">{rows} แถว</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRows((p) => Math.max(1, p - 1))}
                  disabled={rows <= 1}
                  className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 rounded-lg text-slate-700 font-bold transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={rows}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setRows(isNaN(val) ? 1 : Math.max(1, Math.min(50, val)));
                  }}
                  className="flex-1 text-center py-1 bg-white border border-slate-200 rounded-lg font-mono font-bold text-violet-700"
                />
                <button
                  type="button"
                  onClick={() => setRows((p) => Math.min(50, p + 1))}
                  disabled={rows >= 50}
                  className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 rounded-lg text-slate-700 font-bold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Combined Summary Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <span>ความจุรวมของผังคลัง:</span>
                <span className="text-violet-700 font-mono text-sm font-bold">
                  {total} ช่อง
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  ({cols} คอลัมน์ × {rows} แถว)
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                รองรับการลากวาง (Drag & Drop) เพื่อสลับช่องหรือจัดเก็บได้อย่างสะดวกรวดเร็ว
              </div>
            </div>
          </div>

          {totalCutoff > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-amber-800">
                  แจ้งเตือนการย้ายหม้อแปลงอัตโนมัติ:
                </div>
                <div className="text-[11px] leading-relaxed text-amber-700">
                  มีหม้อแปลง <strong>{totalCutoff} เครื่อง</strong> วางอยู่ในช่องที่เกินขนาดใหม่ หากบันทึก ระบบจะย้ายหม้อแปลงเหล่านี้ไปยัง <strong>&quot;จุดพักรอจัดเก็บ&quot;</strong> โดยอัตโนมัติอย่างปลอดภัย
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-xs transition-colors"
            >
              <Check className="w-4 h-4" />
              บันทึกการตั้งค่าผังคลัง
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
