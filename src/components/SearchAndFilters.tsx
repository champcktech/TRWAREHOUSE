import React from 'react';
import { TransformerStatus, STATUS_CONFIG } from '../types';
import { Search, X, Filter, Navigation } from 'lucide-react';

interface SearchAndFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: TransformerStatus | 'all';
  onStatusFilterChange: (status: TransformerStatus | 'all') => void;
  capacityFilter: number | 'all';
  onCapacityFilterChange: (capacity: number | 'all') => void;
  targetSlotInput: string;
  onTargetSlotInputChange: (val: string) => void;
  onJumpToSlot: (slotNum: number) => void;
  totalFound: number;
}

export const SearchAndFilters: React.FC<SearchAndFiltersProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  capacityFilter,
  onCapacityFilterChange,
  targetSlotInput,
  onTargetSlotInputChange,
  onJumpToSlot,
  totalFound
}) => {
  const capacities = [30, 50, 100, 160, 250, 315, 400, 500];

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(targetSlotInput, 10);
    if (!isNaN(num)) {
      onJumpToSlot(num);
    }
  };

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all' || capacityFilter !== 'all';

  const clearAllFilters = () => {
    onSearchChange('');
    onStatusFilterChange('all');
    onCapacityFilterChange('all');
  };

  return (
    <div className="bg-[#0c0c0c] rounded-lg border border-[#222] px-3.5 py-2.5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Left group: Compact Search Input + Capacity Filter */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          {/* Compact Search Input */}
          <div className="relative w-full sm:w-64 md:w-80 max-w-sm">
            <Search className="w-3.5 h-3.5 text-[#666] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="ค้นหา: รหัส PEA, S/N, ยี่ห้อ..."
              className="w-full pl-8 pr-7 py-1.5 bg-[#141414] border border-[#2a2a2a] rounded-md text-xs text-[#e5e5e5] placeholder-[#555] focus:outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#666] hover:text-[#bbb] p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Capacity Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#666]" />
            <select
              value={capacityFilter}
              onChange={(e) => {
                const val = e.target.value;
                onCapacityFilterChange(val === 'all' ? 'all' : parseInt(val, 10));
              }}
              aria-label="กรองตามขนาด kVA"
              className="px-2.5 py-1.5 bg-[#141414] border border-[#2a2a2a] rounded-md text-xs text-[#ccc] focus:outline-hidden focus:border-orange-500"
            >
              <option value="all">ทุกขนาด kVA</option>
              {capacities.map((k) => (
                <option key={k} value={k}>
                  {k} kVA
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs text-orange-400 hover:text-orange-300 font-medium px-2 py-1 rounded bg-orange-950/30 border border-orange-800/50 transition-colors"
            >
              ล้างตัวกรอง
            </button>
          )}

          {hasActiveFilters && (
            <span className="text-xs text-[#888]">
              พบ <strong className="text-orange-400 font-mono">{totalFound}</strong> เครื่อง
            </span>
          )}
        </div>

        {/* Right group: Quick Jump to Slot */}
        <form onSubmit={handleJumpSubmit} className="flex items-center gap-1.5 shrink-0">
          <input
            type="number"
            min="1"
            value={targetSlotInput}
            onChange={(e) => onTargetSlotInputChange(e.target.value)}
            placeholder="เลขช่อง เช่น 12"
            className="w-24 px-2.5 py-1.5 bg-[#141414] border border-[#2a2a2a] rounded-md text-xs text-[#e5e5e5] placeholder-[#555] focus:outline-hidden focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
          />
          <button
            type="submit"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] text-[#ccc] rounded-md text-xs font-semibold transition-colors"
            title="ค้นหาและเลื่อนไปยังตำแหน่งช่องทันที"
          >
            <Navigation className="w-3 h-3 text-orange-400" />
            <span>ไปยังช่อง</span>
          </button>
        </form>
      </div>
    </div>
  );
};
