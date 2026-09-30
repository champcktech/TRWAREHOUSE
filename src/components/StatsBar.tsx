import React from 'react';
import { Transformer, TransformerStatus, STATUS_CONFIG, WarehouseConfig, normalizeTransformerStatus } from '../types';
import { Box, Layers, Truck, Tag } from 'lucide-react';

interface StatsBarProps {
  transformers: Transformer[];
  config: WarehouseConfig;
  selectedStatusFilter: TransformerStatus | 'all';
  onSelectStatusFilter: (status: TransformerStatus | 'all') => void;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  transformers,
  config,
  selectedStatusFilter,
  onSelectStatusFilter
}) => {
  const gridCols = config.columns || config.leftGrid?.columns || 4;
  const gridRows = config.rows || config.leftGrid?.rows || 14;
  const singleTotal = gridCols * gridRows;
  const rightTotal = config.rightGrid ? (config.rightGrid.columns * config.rightGrid.rows) : 0;
  const totalSlots = rightTotal > 0 ? (singleTotal + rightTotal) : singleTotal;
  const occupiedSlots = transformers.filter((t) => (t.locationType === 'grid' || (!t.locationType && t.slotNumber !== null)) && t.slotNumber !== null).length;
  const emptySlots = Math.max(0, totalSlots - occupiedSlots);
  const occupancyPercent = totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0;

  const goodCount = transformers.filter((t) => normalizeTransformerStatus(t.status) === 'good').length;
  const minorCount = transformers.filter((t) => normalizeTransformerStatus(t.status) === 'minor_repair').length;
  const majorCount = transformers.filter((t) => normalizeTransformerStatus(t.status) === 'major_repair').length;
  const damagedCount = transformers.filter((t) => normalizeTransformerStatus(t.status) === 'damaged').length;
  const repairCount = transformers.filter((t) => t.locationType === 'repair').length;
  const saleCount = transformers.filter((t) => t.locationType === 'sale').length;

  const tabs: Array<{
    id: TransformerStatus | 'all';
    label: string;
    subLabel?: string;
    count: number;
    color: string;
    activeClasses: string;
    inactiveClasses: string;
  }> = [
    {
      id: 'all',
      label: 'ทั้งหมดในระบบ',
      count: transformers.length,
      color: '#6d53a6',
      activeClasses: 'bg-[#5c478a] border-[#4c3878] text-[#f5f4ef] shadow-2xs',
      inactiveClasses: 'bg-[#e3e8e5] text-[#3d4b45] hover:bg-[#d8e0dc] hover:text-[#1f2b27] border-[#c4d0c9]'
    },
    {
      id: 'good',
      label: 'ดี',
      subLabel: 'สีเขียว',
      count: goodCount,
      color: STATUS_CONFIG.good.hexColor,
      activeClasses: 'bg-[#cde6dc] border-[#78bfa0] text-[#1d4d38] ring-1 ring-[#8ecab0] shadow-2xs',
      inactiveClasses: 'bg-[#e1efe9] text-[#285c45] hover:bg-[#d5e9e0] border-[#bddbcf]'
    },
    {
      id: 'minor_repair',
      label: 'รอซ่อมเล็กน้อย',
      subLabel: 'สีเหลือง',
      count: minorCount,
      color: STATUS_CONFIG.minor_repair.hexColor,
      activeClasses: 'bg-[#f2e2be] border-[#d9b262] text-[#5c400d] ring-1 ring-[#e0be75] shadow-2xs',
      inactiveClasses: 'bg-[#f4ead5] text-[#694a12] hover:bg-[#efe1c3] border-[#e0cca4]'
    },
    {
      id: 'major_repair',
      label: 'รอซ่อมหนัก',
      subLabel: 'สีส้ม',
      count: majorCount,
      color: STATUS_CONFIG.major_repair.hexColor,
      activeClasses: 'bg-[#f4d7c6] border-[#de966f] text-[#632a0f] ring-1 ring-[#e6a683] shadow-2xs',
      inactiveClasses: 'bg-[#f5e3d8] text-[#6e3114] hover:bg-[#f0d8c9] border-[#e6c3af]'
    },
    {
      id: 'damaged',
      label: 'ชำรุด',
      subLabel: 'สีแดง',
      count: damagedCount,
      color: STATUS_CONFIG.damaged.hexColor,
      activeClasses: 'bg-[#f2cfd4] border-[#d98993] text-[#611c24] ring-1 ring-[#e099a2] shadow-2xs',
      inactiveClasses: 'bg-[#f4dfe2] text-[#6b212a] hover:bg-[#efd2d6] border-[#e3bbc0]'
    }
  ];

  return (
    <div className="bg-[#eff2ee] rounded-2xl border border-[#cad4ce] p-2.5 sm:p-3 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
      {/* Responsive Status Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 py-0.5">
        <div className="text-[11px] font-semibold text-[#54635c] uppercase tracking-wider pl-1 pr-1.5 hidden xl:block">
          แท็บเลือกสถานะ:
        </div>
        {tabs.map((tab) => {
          const isActive = selectedStatusFilter === tab.id;
          const percentage =
            transformers.length > 0 && tab.id !== 'all'
              ? Math.round((tab.count / transformers.length) * 100)
              : null;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectStatusFilter(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap cursor-pointer ${
                isActive ? tab.activeClasses : tab.inactiveClasses
              }`}
            >
              {tab.id === 'all' ? (
                <Box className={`w-3.5 h-3.5 ${isActive ? 'text-[#dfd6f5]' : 'text-[#5c6b64]'}`} />
              ) : (
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 border border-[#f5f4ef]/80 shadow-2xs"
                  style={{ backgroundColor: tab.color }}
                />
              )}

              <span className="tracking-tight">{tab.label}</span>
              {tab.subLabel && (
                <span className={`text-[10px] font-normal hidden sm:inline ${isActive ? 'opacity-85' : 'text-[#5e6e67]'}`}>
                  {tab.subLabel}
                </span>
              )}

              {/* Count badge */}
              <span
                className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                  isActive
                    ? 'bg-black/15 text-current'
                    : 'bg-[#f5f4ef]/90 text-[#2d3b36] border border-[#c8d2cc]'
                }`}
              >
                {tab.count}
                {percentage !== null && (
                  <span className="font-normal text-[9px] opacity-80 ml-1">
                    {percentage}%
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Warehouse Capacity info pill on the right */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 py-1.5 bg-[#e4e9e5] border border-[#c6d1cb] rounded-xl text-xs shrink-0 self-stretch lg:self-center justify-between lg:justify-end">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-[#6850a1] shrink-0" />
          <span className="text-[#4a5953] text-[11px]">ความจุผังคลัง:</span>
          <span className="font-mono font-bold text-[#222e2a]">
            {occupiedSlots} <span className="text-[#5a6962] font-normal">/ {totalSlots} ช่อง</span>
          </span>
          <span className="text-[10px] text-[#5a6962] font-mono">({occupancyPercent}%)</span>
        </div>

        <div className="h-3 w-[1px] bg-[#c2cdc7] hidden sm:block" />

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[#21523c] font-semibold font-mono text-[11px] bg-[#dceee5] border border-[#b4d9c7] px-2 py-0.5 rounded-lg whitespace-nowrap">
            ว่าง {emptySlots} ช่อง
          </span>

          {repairCount > 0 && (
            <span className="text-[#1f4e63] font-semibold font-mono text-[11px] bg-[#dcecf2] border border-[#b4d3e0] px-2 py-0.5 rounded-lg whitespace-nowrap flex items-center gap-1">
              <Truck className="w-3 h-3" />
              ส่งซ่อม {repairCount}
            </span>
          )}

          {saleCount > 0 && (
            <span className="text-[#542c66] font-semibold font-mono text-[11px] bg-[#eadff0] border border-[#d1bce0] px-2 py-0.5 rounded-lg whitespace-nowrap flex items-center gap-1">
              <Tag className="w-3 h-3" />
              รอขาย {saleCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

