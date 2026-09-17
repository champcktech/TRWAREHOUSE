import React from 'react';
import { Transformer, TransformerStatus, STATUS_CONFIG, WarehouseConfig } from '../types';
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

  const goodCount = transformers.filter((t) => t.status === 'good').length;
  const minorCount = transformers.filter((t) => t.status === 'minor_repair').length;
  const majorCount = transformers.filter((t) => t.status === 'major_repair').length;
  const damagedCount = transformers.filter((t) => t.status === 'damaged').length;
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
      color: '#f97316',
      activeClasses: 'bg-[#181818] border-orange-500 text-orange-400 ring-1 ring-orange-500/40 shadow-sm',
      inactiveClasses: 'text-[#888] hover:text-[#ddd] hover:bg-[#141414] border-[#222]'
    },
    {
      id: 'good',
      label: 'ดี',
      subLabel: 'สีเขียว',
      count: goodCount,
      color: STATUS_CONFIG.good.hexColor,
      activeClasses: 'bg-emerald-950/40 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/40 shadow-sm',
      inactiveClasses: 'text-[#888] hover:text-emerald-300 hover:bg-[#141414] border-[#222]'
    },
    {
      id: 'minor_repair',
      label: 'รอซ่อมเล็กน้อย',
      subLabel: 'สีเหลือง',
      count: minorCount,
      color: STATUS_CONFIG.minor_repair.hexColor,
      activeClasses: 'bg-yellow-950/40 border-yellow-500 text-yellow-300 ring-1 ring-yellow-500/40 shadow-sm',
      inactiveClasses: 'text-[#888] hover:text-yellow-300 hover:bg-[#141414] border-[#222]'
    },
    {
      id: 'major_repair',
      label: 'รอซ่อมหนัก',
      subLabel: 'สีส้ม',
      count: majorCount,
      color: STATUS_CONFIG.major_repair.hexColor,
      activeClasses: 'bg-orange-950/40 border-orange-500 text-orange-300 ring-1 ring-orange-500/40 shadow-sm',
      inactiveClasses: 'text-[#888] hover:text-orange-300 hover:bg-[#141414] border-[#222]'
    },
    {
      id: 'damaged',
      label: 'ชำรุด',
      subLabel: 'สีแดง',
      count: damagedCount,
      color: STATUS_CONFIG.damaged.hexColor,
      activeClasses: 'bg-rose-950/40 border-rose-500 text-rose-300 ring-1 ring-rose-500/40 shadow-sm',
      inactiveClasses: 'text-[#888] hover:text-rose-300 hover:bg-[#141414] border-[#222]'
    }
  ];

  return (
    <div className="bg-[#0a0a0a] rounded-lg border border-[#222] p-2 sm:p-2.5 shadow-md flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
      {/* Scrollable / Responsive Status Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        <div className="text-[11px] font-semibold text-[#666] uppercase tracking-wider pl-1 pr-2 hidden xl:block">
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
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all whitespace-nowrap cursor-pointer ${
                isActive ? tab.activeClasses : tab.inactiveClasses
              }`}
            >
              {tab.id === 'all' ? (
                <Box className={`w-3.5 h-3.5 ${isActive ? 'text-orange-400' : 'text-[#666]'}`} />
              ) : (
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                  style={{ backgroundColor: tab.color }}
                />
              )}

              <span className="tracking-tight">{tab.label}</span>
              {tab.subLabel && (
                <span className="text-[10px] text-[#666] font-normal hidden sm:inline">
                  {tab.subLabel}
                </span>
              )}

              {/* Count badge */}
              <span
                className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${
                  isActive
                    ? 'bg-black/40 border border-white/10'
                    : 'bg-[#141414] text-[#888] border border-[#222]'
                }`}
              >
                {tab.count}
                {percentage !== null && (
                  <span className="font-normal text-[9px] opacity-70 ml-1">
                    {percentage}%
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Warehouse Capacity info pill on the right */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-[#121212] border border-[#222] rounded-md text-xs shrink-0 self-end lg:self-center w-full lg:w-auto justify-between lg:justify-end">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <span className="text-[#888] text-[11px]">ความจุผังคลัง:</span>
          <span className="font-mono font-bold text-white">
            {occupiedSlots} <span className="text-[#666] font-normal">/ {totalSlots} ช่อง</span>
          </span>
          <span className="text-[10px] text-[#666] font-mono">({occupancyPercent}%)</span>
        </div>

        <div className="h-3 w-[1px] bg-[#2a2a2a] hidden sm:block" />

        <span className="text-emerald-400 font-medium font-mono text-[11px] bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded whitespace-nowrap">
          ว่าง {emptySlots} ช่อง
        </span>

        {repairCount > 0 && (
          <>
            <div className="h-3 w-[1px] bg-[#2a2a2a] hidden sm:block" />
            <span className="text-sky-300 font-medium font-mono text-[11px] bg-sky-950/40 border border-sky-800/50 px-2 py-0.5 rounded whitespace-nowrap flex items-center gap-1">
              <Truck className="w-3 h-3" />
              ส่งซ่อม {repairCount}
            </span>
          </>
        )}

        {saleCount > 0 && (
          <>
            <div className="h-3 w-[1px] bg-[#2a2a2a] hidden sm:block" />
            <span className="text-purple-300 font-medium font-mono text-[11px] bg-purple-950/40 border border-purple-800/50 px-2 py-0.5 rounded whitespace-nowrap flex items-center gap-1">
              <Tag className="w-3 h-3" />
              รอขาย {saleCount}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

