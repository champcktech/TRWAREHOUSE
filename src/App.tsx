import React, { useState, useEffect, useMemo } from 'react';
import { Transformer, TransformerStatus, WarehouseConfig, WarehouseZoneId, TransformerLocationType } from './types';
import { INITIAL_TRANSFORMERS, DEFAULT_WAREHOUSE_CONFIG } from './data/mockTransformers';
import { WarehouseGrid } from './components/WarehouseGrid';
import { HoldingArea } from './components/HoldingArea';
import { StatsBar } from './components/StatsBar';
import { SearchAndFilters } from './components/SearchAndFilters';
import { TransformerFormModal } from './components/TransformerFormModal';
import { TransformerDetailModal } from './components/TransformerDetailModal';
import { ExportReportModal } from './components/ExportReportModal';
import { GridConfigModal } from './components/GridConfigModal';
import { TransformerTableView } from './components/TransformerTableView';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { WebhookModal } from './components/WebhookModal';
import { MoveConfirmationModal } from './components/MoveConfirmationModal';
import { GoogleScriptEmbedView } from './components/GoogleScriptEmbedView';
import { buildWebhookPayload, sendWebhook, DEFAULT_WEBHOOK_URL } from './services/webhookService';
import { initAuth, User } from './lib/googleAuth';
import {
  Plus,
  FileSpreadsheet,
  Webhook,
  Sliders,
  RotateCcw,
  LayoutGrid,
  List,
  Zap,
  Info,
  ExternalLink
} from 'lucide-react';

const STORAGE_KEY_TRANSFORMERS = 'pea_warehouse_transformers_v1';
const STORAGE_KEY_CONFIG = 'pea_warehouse_config_v1';
const STORAGE_KEY_WEBHOOK_URL = 'pea_warehouse_webhook_url_v1';
const STORAGE_KEY_WEBHOOK_AUTOSYNC = 'pea_warehouse_webhook_autosync_v1';

export default function App() {
  // 1. State: Transformers list with localStorage persistence
  const [transformers, setTransformers] = useState<Transformer[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TRANSFORMERS);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load from localStorage', e);
    }
    return INITIAL_TRANSFORMERS;
  });

  // 2. State: Warehouse Grid Config (columns x rows)
  const [config, setConfig] = useState<WarehouseConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load config from localStorage', e);
    }
    return DEFAULT_WAREHOUSE_CONFIG;
  });

  // Save to localStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TRANSFORMERS, JSON.stringify(transformers));
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
  }, [transformers]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
    } catch (e) {
      console.warn('Failed to save config to localStorage', e);
    }
  }, [config]);

  // 3. Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TransformerStatus | 'all'>('all');
  const [capacityFilter, setCapacityFilter] = useState<number | 'all'>('all');
  const [targetSlotInput, setTargetSlotInput] = useState('');
  const [highlightedTransformerId, setHighlightedTransformerId] = useState<string | null>(null);

  // 4. View Mode: Grid Layout vs Table View vs Google Script Embed
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'script'>('grid');

  // 5. Modals State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingTransformer, setEditingTransformer] = useState<Transformer | null>(null);
  const [addAtSlotNumber, setAddAtSlotNumber] = useState<number | null>(null);
  const [addAtZone, setAddAtZone] = useState<WarehouseZoneId>('left');
  const [addAtLocationType, setAddAtLocationType] = useState<TransformerLocationType>('grid');

  const [selectedTransformer, setSelectedTransformer] = useState<Transformer | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isGoogleSheetsModalOpen, setIsGoogleSheetsModalOpen] = useState(false);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);

  // Move Authorization PIN Modal State
  const [pendingMove, setPendingMove] = useState<{
    transformerId: string;
    targetSlot: number | null;
    targetZone?: WarehouseZoneId;
    targetLocationType: TransformerLocationType;
  } | null>(null);
  const [isMovePinModalOpen, setIsMovePinModalOpen] = useState(false);

  // Webhook Configuration State with localStorage persistence (defaults to embedded GAS Webhook)
  const [webhookUrl, setWebhookUrl] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_WEBHOOK_URL);
      if (saved && saved.trim()) {
        return saved.trim();
      }
    } catch {
      // ignore
    }
    return DEFAULT_WEBHOOK_URL;
  });
  const [autoSyncWebhook, setAutoSyncWebhook] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_WEBHOOK_AUTOSYNC);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  const handleSaveWebhookUrl = (url: string) => {
    setWebhookUrl(url);
    try {
      localStorage.setItem(STORAGE_KEY_WEBHOOK_URL, url);
    } catch (e) {
      console.warn('Failed to save webhook URL to localStorage', e);
    }
  };

  const handleToggleAutoSync = (enabled: boolean) => {
    setAutoSyncWebhook(enabled);
    try {
      localStorage.setItem(STORAGE_KEY_WEBHOOK_AUTOSYNC, enabled ? 'true' : 'false');
    } catch (e) {
      console.warn('Failed to save webhook autosync to localStorage', e);
    }
    showNotification(enabled ? 'เปิดการส่งข้อมูล Webhook อัตโนมัติแล้ว' : 'ปิดการส่งข้อมูล Webhook อัตโนมัติ');
  };

  // Debounced auto-sync webhook on changes
  const isInitialMount = React.useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (autoSyncWebhook && webhookUrl.trim()) {
      const timer = setTimeout(async () => {
        try {
          const payload = buildWebhookPayload(transformers, config, 'sync_all');
          await sendWebhook(webhookUrl.trim(), payload);
          console.log('Webhook auto-synced successfully');
        } catch (err) {
          console.warn('Auto-sync webhook failed:', err);
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [transformers, config, autoSyncWebhook, webhookUrl]);

  // Google OAuth Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Toast / notification feedback
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 3500);
  };

  // Filtered Transformers
  const filteredTransformers = useMemo(() => {
    return transformers.filter((t) => {
      // Query search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesPea = t.peaNo.toLowerCase().includes(q);
        const matchesSn = t.serialNo.toLowerCase().includes(q);
        const matchesBrand = t.brand.toLowerCase().includes(q);
        const matchesKva = String(t.capacityKva).includes(q);
        const matchesNotes = t.notes?.toLowerCase().includes(q) || false;
        const matchesSlot = t.slotNumber ? String(t.slotNumber) === q : false;

        if (!matchesPea && !matchesSn && !matchesBrand && !matchesKva && !matchesNotes && !matchesSlot) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all' && t.status !== statusFilter) {
        return false;
      }

      // Capacity filter
      if (capacityFilter !== 'all' && t.capacityKva !== capacityFilter) {
        return false;
      }

      return true;
    });
  }, [transformers, searchQuery, statusFilter, capacityFilter]);

  // Triage Area Transformers (จุดรอคัดแยก)
  const triageTransformers = useMemo(() => {
    return filteredTransformers.filter((t) => t.slotNumber === null && t.locationType === 'triage');
  }, [filteredTransformers]);

  // Holding Area Transformers (unassigned / จุดพักรอจัดเก็บ)
  const unassignedTransformers = useMemo(() => {
    return filteredTransformers.filter(
      (t) => t.slotNumber === null && t.locationType !== 'triage' && t.locationType !== 'repair' && t.locationType !== 'sale'
    );
  }, [filteredTransformers]);

  // Out for Repair Transformers (ส่งซ่อมภายนอก / โรงงาน)
  const repairTransformers = useMemo(() => {
    return filteredTransformers.filter((t) => t.slotNumber === null && t.locationType === 'repair');
  }, [filteredTransformers]);

  // Sale Area Transformers (จุดวางรอขาย / รอจำหน่าย / รอประมูล)
  const saleTransformers = useMemo(() => {
    return filteredTransformers.filter((t) => t.slotNumber === null && t.locationType === 'sale');
  }, [filteredTransformers]);

  // Handlers for CRUD & Move operations
  const handleSaveTransformer = (transformer: Transformer) => {
    setTransformers((prev) => {
      // If the slot is taken by another transformer in the grid, move that one to holding area
      const targetSlot = transformer.slotNumber;
      const updated = prev.map((item) => {
        if (item.id === transformer.id) {
          return transformer;
        }
        if (
          targetSlot !== null &&
          item.slotNumber === targetSlot &&
          (item.locationType === 'grid' || !item.locationType) &&
          item.id !== transformer.id
        ) {
          // Relocate previous occupant to holding
          return { ...item, slotNumber: null, zone: undefined, locationType: 'holding' as TransformerLocationType };
        }
        return item;
      });

      // If it's a new transformer not yet in the array:
      const exists = prev.some((item) => item.id === transformer.id);
      if (!exists) {
        return [transformer, ...updated];
      }
      return updated;
    });

    showNotification(`บันทึกหม้อแปลง ${transformer.peaNo} เรียบร้อยแล้ว`);
  };

  const handleDeleteTransformer = (id: string) => {
    const target = transformers.find((t) => t.id === id);
    setTransformers((prev) => prev.filter((t) => t.id !== id));
    if (selectedTransformer?.id === id) {
      setIsDetailModalOpen(false);
      setSelectedTransformer(null);
    }
    showNotification(`ลบหม้อแปลง ${target ? target.peaNo : ''} ออกจากผังคลังแล้ว`);
  };

  const handleMoveTransformer = (
    transformerId: string,
    targetSlot: number | null,
    targetZone: WarehouseZoneId = 'left',
    targetLocationType: TransformerLocationType = 'grid'
  ) => {
    const moving = transformers.find((t) => t.id === transformerId);
    if (!moving) return;

    // Check if moving to the identical location (no-op)
    const isSameLocation =
      targetSlot === null
        ? moving.slotNumber === null &&
          (targetLocationType || 'holding') === (moving.locationType || 'holding')
        : moving.slotNumber === targetSlot &&
          moving.locationType === 'grid';

    if (isSameLocation) {
      return;
    }

    // Require PIN code verification to move
    setPendingMove({
      transformerId,
      targetSlot,
      targetZone: 'left',
      targetLocationType
    });
    setIsMovePinModalOpen(true);
  };

  const executePendingMove = () => {
    if (!pendingMove) return;
    const { transformerId, targetSlot, targetLocationType } = pendingMove;

    setTransformers((prev) => {
      const moving = prev.find((t) => t.id === transformerId);
      if (!moving) return prev;

      if (targetSlot === null) {
        return prev.map((item) => {
          if (item.id === transformerId) {
            return {
              ...item,
              slotNumber: null,
              zone: undefined,
              locationType: targetLocationType
            };
          }
          return item;
        });
      }

      // If target is occupied, swap!
      const otherOccupant = prev.find(
        (t) =>
          t.slotNumber === targetSlot &&
          (t.locationType === 'grid' || !t.locationType) &&
          t.id !== transformerId
      );

      return prev.map((item) => {
        if (item.id === transformerId) {
          return {
            ...item,
            slotNumber: targetSlot,
            zone: 'left',
            locationType: 'grid'
          };
        }
        if (otherOccupant && item.id === otherOccupant.id) {
          return {
            ...item,
            slotNumber: moving.slotNumber,
            zone: moving.zone,
            locationType: moving.locationType
          };
        }
        return item;
      });
    });

    // Update selectedTransformer if it is currently displayed in the detail modal
    setSelectedTransformer((curr) => {
      if (curr && curr.id === transformerId) {
        return {
          ...curr,
          slotNumber: targetSlot,
          zone: targetSlot !== null ? 'left' : undefined,
          locationType: targetSlot !== null ? 'grid' : targetLocationType
        };
      }
      return curr;
    });

    const zonePrefix = config.zonePrefix || config.leftGrid?.zonePrefix || 'A';
    const targetLabel =
      targetSlot !== null
        ? `${zonePrefix} ${targetSlot}`
        : targetLocationType === 'triage'
        ? 'จุดรอคัดแยก'
        : targetLocationType === 'repair'
        ? '🚚 ส่งซ่อมภายนอก'
        : targetLocationType === 'sale'
        ? '🏷️ จุดวางรอขาย'
        : 'จุดพักรอจัดเก็บ';
    showNotification(`ย้ายตำแหน่งหม้อแปลงไปยัง ${targetLabel} สำเร็จ`);
    setIsMovePinModalOpen(false);
    setPendingMove(null);
  };

  const getMoveFromDescription = (): string => {
    if (!pendingMove) return '';
    const moving = transformers.find((t) => t.id === pendingMove.transformerId);
    if (!moving) return '';
    if (moving.locationType === 'triage') return 'จุดรอคัดแยก';
    if (moving.locationType === 'repair') return '🚚 ส่งซ่อมภายนอก';
    if (moving.locationType === 'sale') return '🏷️ จุดวางรอขาย';
    if (moving.locationType === 'holding' || moving.slotNumber === null) return 'จุดพักรอจัดเก็บ';
    const prefix = config.zonePrefix || config.leftGrid?.zonePrefix || 'A';
    return `ช่อง ${prefix} ${String(moving.slotNumber).padStart(2, '0')}`;
  };

  const getMoveToDescription = (): string => {
    if (!pendingMove) return '';
    if (pendingMove.targetSlot === null) {
      if (pendingMove.targetLocationType === 'triage') return 'จุดรอคัดแยก';
      if (pendingMove.targetLocationType === 'repair') return '🚚 ส่งซ่อมภายนอก';
      if (pendingMove.targetLocationType === 'sale') return '🏷️ จุดวางรอขาย';
      return 'จุดพักรอจัดเก็บ';
    }
    const prefix = config.zonePrefix || config.leftGrid?.zonePrefix || 'A';
    return `ช่อง ${prefix} ${String(pendingMove.targetSlot).padStart(2, '0')}`;
  };

  const handleOpenAddModal = (
    slotNumber: number | null = null,
    zone: WarehouseZoneId = 'left',
    locationType: TransformerLocationType = 'holding'
  ) => {
    setEditingTransformer(null);
    setAddAtSlotNumber(slotNumber);
    setAddAtZone(zone);
    setAddAtLocationType(locationType);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (transformer: Transformer) => {
    setEditingTransformer(transformer);
    setAddAtSlotNumber(transformer.slotNumber);
    setAddAtZone(transformer.zone || 'left');
    setAddAtLocationType(transformer.locationType || (transformer.slotNumber ? 'grid' : 'holding'));
    setIsFormModalOpen(true);
  };

  const handleSelectTransformer = (transformer: Transformer) => {
    setSelectedTransformer(transformer);
    setIsDetailModalOpen(true);
  };

  const handleJumpToSlot = (slotNum: number, zone: WarehouseZoneId = 'left') => {
    const gridCols = config.columns || config.leftGrid?.columns || 4;
    const gridRows = config.rows || config.leftGrid?.rows || 14;
    const maxSlots = gridCols * gridRows;

    if (slotNum < 1 || slotNum > maxSlots) {
      alert(`เลขช่องต้องอยู่ระหว่าง 1 ถึง ${maxSlots}`);
      return;
    }

    // Switch to grid view if on table
    if (viewMode !== 'grid') {
      setViewMode('grid');
    }

    setTimeout(() => {
      const el = document.getElementById(`slot-cell-left-${slotNum}`) || document.getElementById(`slot-cell-${slotNum}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-orange-500', 'bg-orange-950/40');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-orange-500', 'bg-orange-950/40');
        }, 2000);
      }

      const found = transformers.find(
        (t) =>
          t.slotNumber === slotNum &&
          (t.locationType === 'grid' || !t.locationType)
      );
      if (found) {
        setHighlightedTransformerId(found.id);
        setTimeout(() => setHighlightedTransformerId(null), 3000);
      }
    }, 100);
  };

  const handleResetData = () => {
    if (confirm('คุณต้องการรีเซ็ตข้อมูลทั้งหมดกลับเป็นค่าเริ่มต้นตัวอย่างใช่หรือไม่?')) {
      setTransformers(INITIAL_TRANSFORMERS);
      setConfig(DEFAULT_WAREHOUSE_CONFIG);
      localStorage.removeItem(STORAGE_KEY_TRANSFORMERS);
      localStorage.removeItem(STORAGE_KEY_CONFIG);
      showNotification('รีเซ็ตข้อมูลตัวอย่างเรียบร้อยแล้ว');
    }
  };

  const handleSaveConfig = (newConfig: WarehouseConfig) => {
    const gridCols = newConfig.columns || newConfig.leftGrid?.columns || 4;
    const gridRows = newConfig.rows || newConfig.leftGrid?.rows || 14;
    const limit = gridCols * gridRows;
    let movedCount = 0;

    // Safely relocate any transformers located in slots that exceed the new boundary
    setTransformers((prev) => {
      let changed = false;
      const updated = prev.map((t) => {
        if (t.slotNumber === null || t.locationType === 'triage' || t.locationType === 'holding' || t.locationType === 'repair' || t.locationType === 'sale') {
          return t;
        }

        if (t.slotNumber > limit) {
          movedCount++;
          changed = true;
          return {
            ...t,
            slotNumber: null,
            zone: undefined,
            locationType: 'holding' as TransformerLocationType,
            updatedAt: new Date().toISOString().split('T')[0],
            notes: t.notes
              ? `${t.notes} (ย้ายจากช่องเดิม #${t.slotNumber} เนื่องจากปรับขนาดผัง)`
              : `ย้ายจากช่องเดิม #${t.slotNumber} เนื่องจากปรับขนาดผัง`,
          };
        }
        return t;
      });
      return changed ? updated : prev;
    });

    setConfig(newConfig);

    if (movedCount > 0) {
      showNotification(
        `ปรับขนาดผังเรียบร้อย (${gridCols} คอลัมน์ × ${gridRows} แถว = ${limit} ช่อง, ย้าย ${movedCount} เครื่องที่เกินขนาดไปจุดพัก)`
      );
    } else {
      showNotification(
        `ปรับขนาดผังเรียบร้อย (${gridCols} คอลัมน์ × ${gridRows} แถว = ${limit} ช่อง)`
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#e5e5e5] flex flex-col font-sans selection:bg-orange-600 selection:text-white">
      {/* Top Application Navbar */}
      <header className="bg-[#0a0a0a] border-b border-[#222] sticky top-0 z-30 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Brand & Warehouse Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-orange-500 flex items-center justify-center text-black font-black shadow-md shrink-0">
              <Zap className="w-5 h-5 fill-black text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded bg-orange-950/60 text-orange-400 border border-orange-800/80">
                  TRANSFORMER LOGISTICS
                </span>
                <span className="text-xs text-[#777] hidden sm:inline">
                  ระบบบริหารจัดการผังคลังและจุดวาง
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {config.warehouseName}
              </h1>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex items-center p-0.5 bg-[#121212] rounded border border-[#262626]">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-[#222] text-orange-400 border border-[#333] shadow-xs'
                    : 'text-[#888] hover:text-[#e5e5e5]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>ผังคลัง 2 ชุด</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                  viewMode === 'table'
                    ? 'bg-[#222] text-orange-400 border border-[#333] shadow-xs'
                    : 'text-[#888] hover:text-[#e5e5e5]'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>ตารางรายการ</span>
              </button>
            </div>

            {/* Export Report Button (Excel & PDF) */}
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#1a1a1a] border border-[#333] rounded hover:bg-[#252525] text-[#e5e5e5] transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>EXPORT รายงาน (EXCEL / PDF)</span>
            </button>

            {/* Grid Layout Settings */}
            <button
              onClick={() => setIsConfigModalOpen(true)}
              title="ตั้งค่าขนาดผังคลัง"
              className="p-1.5 text-[#888] hover:text-white bg-[#1a1a1a] border border-[#333] hover:bg-[#252525] rounded transition-colors"
            >
              <Sliders className="w-4 h-4" />
            </button>

            {/* Reset Data */}
            <button
              onClick={handleResetData}
              title="รีเซ็ตข้อมูลตัวอย่าง"
              className="p-1.5 text-[#888] hover:text-white bg-[#1a1a1a] border border-[#333] hover:bg-[#252525] rounded transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Floating Notification Toast */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#111] text-[#e5e5e5] text-xs px-4 py-2.5 rounded-lg shadow-2xl border border-[#333] flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Info className="w-4 h-4 text-orange-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5 flex-1 w-full">
        {/* 1. Status Statistics Bar */}
        <StatsBar
          transformers={transformers}
          config={config}
          selectedStatusFilter={statusFilter}
          onSelectStatusFilter={setStatusFilter}
        />

        {/* 2. Quick Search, Filter & Jump to Slot */}
        <SearchAndFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          capacityFilter={capacityFilter}
          onCapacityFilterChange={setCapacityFilter}
          targetSlotInput={targetSlotInput}
          onTargetSlotInputChange={setTargetSlotInput}
          onJumpToSlot={handleJumpToSlot}
          totalFound={filteredTransformers.length}
          onAddNew={() => handleOpenAddModal(null, 'left', 'holding')}
        />

        {/* 3. Main Display View: Floor Plan OR Table OR Embedded Google Script */}
        {viewMode === 'grid' ? (
          <div className="space-y-5">
            {/* Dual Rectangular Warehouse Grid Layout (Left + Right Zones) */}
            <WarehouseGrid
              config={config}
              transformers={filteredTransformers}
              highlightedId={highlightedTransformerId}
              onSelectTransformer={handleSelectTransformer}
              onMoveTransformer={handleMoveTransformer}
              onUpdateConfig={handleSaveConfig}
              onOpenConfigModal={() => setIsConfigModalOpen(true)}
            />

            {/* Holding, Triage, Out-for-Repair, and Sale Areas */}
            <HoldingArea
              triageTransformers={triageTransformers}
              unassignedTransformers={unassignedTransformers}
              repairTransformers={repairTransformers}
              saleTransformers={saleTransformers}
              highlightedId={highlightedTransformerId}
              onSelectTransformer={handleSelectTransformer}
              onMoveTransformer={handleMoveTransformer}
            />
          </div>
        ) : viewMode === 'table' ? (
          <TransformerTableView
            transformers={filteredTransformers}
            config={config}
            onSelect={handleSelectTransformer}
            onEdit={handleOpenEditModal}
            onDelete={handleDeleteTransformer}
            onJumpToSlot={handleJumpToSlot}
          />
        ) : (
          <GoogleScriptEmbedView
            scriptUrl={webhookUrl}
            onUpdateScriptUrl={handleSaveWebhookUrl}
            transformers={transformers}
            config={config}
            onNotify={showNotification}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#0a0a0a] border-t border-[#222] py-4 text-center text-xs text-[#666] no-print">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>ผังคลังและจุดวางหม้อแปลงไฟฟ้า แผนกหม้อแปลง กฟภ. (PEA Transformer Warehouse Manager)</span>
          <div className="flex items-center gap-4 text-[#888]">
            <span>แยกสีสถานะ: เขียว (ดี) | เหลือง (รอซ่อมเล็กน้อย) | ส้ม (รอซ่อมหนัก) | แดง (ชำรุด)</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <TransformerFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleSaveTransformer}
        initialData={editingTransformer}
        defaultSlot={addAtSlotNumber}
        defaultZone={addAtZone}
        defaultLocationType={addAtLocationType}
        config={config}
        existingTransformers={transformers}
      />

      <TransformerDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        transformer={selectedTransformer}
        onEdit={handleOpenEditModal}
        onDelete={handleDeleteTransformer}
        onMove={handleMoveTransformer}
        config={config}
        allTransformers={transformers}
      />

      <MoveConfirmationModal
        isOpen={isMovePinModalOpen}
        onClose={() => {
          setIsMovePinModalOpen(false);
          setPendingMove(null);
        }}
        onConfirm={executePendingMove}
        transformer={
          pendingMove ? transformers.find((t) => t.id === pendingMove.transformerId) || null : null
        }
        fromDescription={getMoveFromDescription()}
        toDescription={getMoveToDescription()}
        config={config}
      />

      <ExportReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        transformers={transformers}
        config={config}
        onOpenGoogleSheets={() => setIsGoogleSheetsModalOpen(true)}
        onOpenWebhook={() => setIsWebhookModalOpen(true)}
      />

      <GridConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
        transformers={transformers}
      />

      <WebhookModal
        isOpen={isWebhookModalOpen}
        onClose={() => setIsWebhookModalOpen(false)}
        transformers={transformers}
        config={config}
        webhookUrl={webhookUrl}
        onSaveWebhookUrl={handleSaveWebhookUrl}
        autoSync={autoSyncWebhook}
        onToggleAutoSync={handleToggleAutoSync}
        onNotify={showNotification}
      />

      <GoogleSheetsModal
        isOpen={isGoogleSheetsModalOpen}
        onClose={() => setIsGoogleSheetsModalOpen(false)}
        currentUser={currentUser}
        accessToken={accessToken}
        onAuthSuccess={(user, token) => {
          setCurrentUser(user);
          setAccessToken(token);
        }}
        onAuthLogout={() => {
          setCurrentUser(null);
          setAccessToken(null);
        }}
        transformers={transformers}
        config={config}
        onImportTransformers={(imported) => {
          setTransformers(imported);
          showNotification(`นำเข้าข้อมูลสำเร็จ ${imported.length} เครื่อง`);
        }}
        onNotify={showNotification}
      />
    </div>
  );
}
