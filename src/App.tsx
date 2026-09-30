import React, { useState, useEffect, useMemo } from 'react';
import {
  Transformer,
  TransformerStatus,
  WarehouseConfig,
  WarehouseZoneId,
  TransformerLocationType,
  normalizeTransformerStatus,
  getStatusConfig
} from './types';
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
import { buildWebhookPayload, sendWebhook, DEFAULT_WEBHOOK_URL, fetchTransformersFromSheets } from './services/webhookService';
import { cleanBrandToEnglish, normalizePeaNo } from './utils/customOptions';
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
  ExternalLink,
  RefreshCw,
  CloudDownload
} from 'lucide-react';

const STORAGE_KEY_TRANSFORMERS = 'pea_warehouse_transformers_v1';
const STORAGE_KEY_CONFIG = 'pea_warehouse_config_v1';
const STORAGE_KEY_WEBHOOK_URL = 'pea_warehouse_webhook_url_v1';
const STORAGE_KEY_WEBHOOK_AUTOSYNC = 'pea_warehouse_webhook_autosync_v1';

export function sanitizeTransformer(t: any): Transformer {
  if (!t || typeof t !== 'object') {
    return {
      id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      peaNo: 'TR-UNKNOWN',
      serialNo: '',
      capacityKva: 50,
      phase: '3-Phase',
      voltage: '22 kV / 400-230 V',
      brand: 'Other',
      status: 'good',
      slotNumber: null,
      zone: 'left',
      locationType: 'holding',
      receivedDate: new Date().toISOString().slice(0, 10),
      notes: '',
      updatedAt: new Date().toISOString().slice(0, 10)
    };
  }

  const slotNum = t.slotNumber !== null && t.slotNumber !== undefined && !isNaN(Number(t.slotNumber))
    ? Number(t.slotNumber)
    : null;

  return {
    ...t,
    id: t.id ? String(t.id) : `tr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    peaNo: normalizePeaNo(t.peaNo || ''),
    serialNo: t.serialNo ? String(t.serialNo).trim() : '',
    capacityKva: Number(t.capacityKva) || 50,
    phase: t.phase === '1-Phase' ? '1-Phase' : '3-Phase',
    voltage: t.voltage ? String(t.voltage).trim() : '22 kV / 400-230 V',
    brand: cleanBrandToEnglish(t.brand || 'Other'),
    status: normalizeTransformerStatus(t.status),
    slotNumber: slotNum,
    zone: t.zone || 'left',
    locationType: (t.locationType as TransformerLocationType) || (slotNum !== null ? 'grid' : 'holding'),
    receivedDate: t.receivedDate || new Date().toISOString().slice(0, 10),
    notes: t.notes ? String(t.notes) : '',
    repairVendor: t.repairVendor || undefined,
    repairSentDate: t.repairSentDate || undefined,
    repairDocNo: t.repairDocNo || undefined,
    repairExpectedReturn: t.repairExpectedReturn || undefined,
    updatedAt: t.updatedAt || new Date().toISOString().slice(0, 10),
  };
}

export default function App() {
  // 1. State: Transformers list with localStorage persistence
  const [transformers, setTransformers] = useState<Transformer[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TRANSFORMERS);
      if (saved) {
        const parsed: any[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const isOldStaleMock = parsed.some(
            (t) => t.peaNo === 'TR 51-004512' || t.peaNo === 'TR 52-008921' || (t.id === 'tr-02' && t.peaNo !== 'TR 51-002342')
          );
          if (!isOldStaleMock) {
            return parsed.map(sanitizeTransformer);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load from localStorage', e);
    }
    return INITIAL_TRANSFORMERS.map(sanitizeTransformer);
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

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isPullingSheets, setIsPullingSheets] = useState<boolean>(false);
  const isSyncingFromRemoteRef = React.useRef(false);

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

  const lastPulledAtRef = React.useRef<number>(0);
  const isRemoteInitializedRef = React.useRef<boolean>(false);
  const lastServerVersionRef = React.useRef<number>(0);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);

  /**
   * Pulls transformers data directly from Google Sheets / Webhook.
   * Runs automatically every time the web page is opened.
   */
  const handlePullFromSheets = async (isAuto = false) => {
    setIsPullingSheets(true);
    setSyncStatus('syncing');
    try {
      const res = await fetchTransformersFromSheets({
        webhookUrl: webhookUrl || DEFAULT_WEBHOOK_URL,
      });

      lastPulledAtRef.current = Date.now();

      if (res.success && Array.isArray(res.transformers)) {
        const sanitizedRemote = res.transformers.map(sanitizeTransformer);

        // Safety guard: If sheet is empty (only headers) but user has data in app, DO NOT wipe!
        if (sanitizedRemote.length === 0 && transformers.length > 0) {
          setSyncStatus('synced');
          if (!isAuto) {
            showNotification('Google Sheet มีเฉพาะหัวตาราง (คงข้อมูลหม้อแปลงที่มีในระบบไว้)');
          }
          return;
        }

        let targetList = sanitizedRemote;
        // If current app has transformers that are not yet in the sheet, keep them!
        if (transformers.length > 0 && sanitizedRemote.length > 0) {
          const sheetPeaSet = new Set(sanitizedRemote.map((t) => (t.peaNo || '').trim().toLowerCase()));
          const localUnwritten = transformers.filter((t) => !sheetPeaSet.has((t.peaNo || '').trim().toLowerCase()));
          if (localUnwritten.length > 0) {
            targetList = [...sanitizedRemote, ...localUnwritten];
          }
        }

        isSyncingFromRemoteRef.current = true;
        setTransformers(targetList);
        isRemoteInitializedRef.current = true;
        try {
          localStorage.setItem(STORAGE_KEY_TRANSFORMERS, JSON.stringify(targetList));
        } catch (e) {
          console.warn('Failed to save pulled transformers to localStorage', e);
        }

        // Also update server master state so all other devices see this data immediately
        try {
          fetch('/api/transformers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transformers: targetList, config }),
          }).catch(() => {});
        } catch {}

        setSyncStatus('synced');
        const nowTime = new Date().toLocaleTimeString('th-TH');
        setLastSyncTime(nowTime);
        showNotification(
          isAuto
            ? `ดึงข้อมูลจาก Google Sheets สำเร็จ (${targetList.length} เครื่อง)`
            : `อัปเดตข้อมูลจาก Google Sheets เรียบร้อย (${targetList.length} เครื่อง)`
        );
      } else if (!isAuto) {
        setSyncStatus('error');
        showNotification(res.message || 'ไม่สามารถดึงข้อมูลจาก Google Sheets ได้');
      } else {
        setSyncStatus('idle');
      }
    } catch (err: any) {
      console.warn('Pull from sheets failed:', err);
      if (!isAuto) {
        setSyncStatus('error');
        showNotification('เกิดข้อผิดพลาดในการดึงข้อมูลจาก Google Sheets');
      } else {
        setSyncStatus('idle');
      }
    } finally {
      setIsPullingSheets(false);
      setIsInitialLoading(false);
    }
  };

  // Cross-device sync: Load shared master state immediately and listen to real-time SSE stream
  useEffect(() => {
    let isMounted = true;
    let eventSource: EventSource | null = null;

    const loadSharedMasterState = async () => {
      try {
        const res = await fetch('/api/transformers');
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data && data.success && Array.isArray(data.transformers)) {
            if (!isMounted) return;

            let targetList = data.transformers.map(sanitizeTransformer);
            // If remote has 0 transformers, check if local storage has existing saved transformers
            if (targetList.length === 0) {
              const localSaved = localStorage.getItem(STORAGE_KEY_TRANSFORMERS);
              if (localSaved) {
                try {
                  const parsed = JSON.parse(localSaved);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    targetList = parsed.map(sanitizeTransformer);
                    fetch('/api/transformers', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ transformers: targetList, config }),
                    }).catch(() => {});
                  }
                } catch {}
              }
            }

            isSyncingFromRemoteRef.current = true;
            setTransformers(targetList);
            if (data.config) {
              setConfig(data.config);
            }
            lastServerVersionRef.current = data.lastUpdated || Date.now();
            isRemoteInitializedRef.current = true;
            setIsInitialLoading(false);
            setSyncStatus('synced');
            setLastSyncTime(new Date().toLocaleTimeString('th-TH'));
            try {
              localStorage.setItem(STORAGE_KEY_TRANSFORMERS, JSON.stringify(targetList));
            } catch {}
            setTimeout(() => {
              isSyncingFromRemoteRef.current = false;
            }, 300);
            return;
          }
        }
      } catch (e) {
        console.warn('Failed to load shared state from /api/transformers, falling back to direct sheets pull:', e);
      }

      // Fallback: Pull directly from Google Sheets
      if (isMounted) {
        await handlePullFromSheets(true);
        isRemoteInitializedRef.current = true;
        setIsInitialLoading(false);
        setTimeout(() => {
          isSyncingFromRemoteRef.current = false;
        }, 300);
      }
    };

    loadSharedMasterState();

    // 1. Instant Real-Time Sync via Server-Sent Events (SSE)
    try {
      eventSource = new EventSource('/api/transformers/stream');
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (
            data &&
            Array.isArray(data.transformers) &&
            data.lastUpdated &&
            data.lastUpdated > lastServerVersionRef.current
          ) {
            // Safety guard: if remote sends 0 transformers, but we have local items and it wasn't an explicit clear, do not wipe!
            if (data.transformers.length === 0 && !data.allowClear) {
              return;
            }
            const cleanList = data.transformers.map(sanitizeTransformer);
            isSyncingFromRemoteRef.current = true;
            lastServerVersionRef.current = data.lastUpdated;
            setTransformers(cleanList);
            if (data.config) {
              setConfig(data.config);
            }
            setSyncStatus('synced');
            setLastSyncTime(new Date().toLocaleTimeString('th-TH'));
            try {
              localStorage.setItem(STORAGE_KEY_TRANSFORMERS, JSON.stringify(cleanList));
            } catch {}
            setTimeout(() => {
              isSyncingFromRemoteRef.current = false;
            }, 300);
          }
        } catch (err) {
          console.warn('SSE message parse warning:', err);
        }
      };
      eventSource.onerror = () => {
        // SSE will automatically attempt reconnection
      };
    } catch (sseErr) {
      console.warn('SSE setup warning, relying on polling:', sseErr);
    }

    // 2. High-Frequency Polling fallback (every 3 seconds)
    const handleCheckUpdate = async () => {
      try {
        const res = await fetch('/api/transformers');
        if (res.ok) {
          const data = (await res.json()) as any;
          if (
            data &&
            data.success &&
            Array.isArray(data.transformers) &&
            data.lastUpdated &&
            data.lastUpdated > lastServerVersionRef.current
          ) {
            // Safety guard: if remote sends 0 transformers, but we have local items and it wasn't an explicit clear, do not wipe!
            if (data.transformers.length === 0 && !data.allowClear) {
              return;
            }
            const cleanList = data.transformers.map(sanitizeTransformer);
            isSyncingFromRemoteRef.current = true;
            lastServerVersionRef.current = data.lastUpdated;
            setTransformers(cleanList);
            if (data.config) {
              setConfig(data.config);
            }
            setSyncStatus('synced');
            setLastSyncTime(new Date().toLocaleTimeString('th-TH'));
            try {
              localStorage.setItem(STORAGE_KEY_TRANSFORMERS, JSON.stringify(cleanList));
            } catch {}
            setTimeout(() => {
              isSyncingFromRemoteRef.current = false;
            }, 300);
          }
        }
      } catch {}
    };

    window.addEventListener('focus', handleCheckUpdate);
    const pollInterval = setInterval(handleCheckUpdate, 3000);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleCheckUpdate);
      clearInterval(pollInterval);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  // Sync to shared server master whenever a user modifies transformers locally
  useEffect(() => {
    if (!isRemoteInitializedRef.current || isSyncingFromRemoteRef.current) {
      isSyncingFromRemoteRef.current = false;
      return;
    }
    fetch('/api/transformers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transformers, config }),
    })
      .then((r) => r.json())
      .then((data: any) => {
        if (data && data.lastUpdated) {
          lastServerVersionRef.current = data.lastUpdated;
        }
      })
      .catch((e) => console.warn('Server master sync error:', e));
  }, [transformers, config]);

  // Debounced auto-sync webhook on changes (outbound push to Google Sheets)
  // Protected by safety gate: NEVER push before initial remote master state has loaded!
  const isInitialMount = React.useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    // SAFETY GATE 1: Must be initialized from remote before sending any push
    if (!isRemoteInitializedRef.current) {
      return;
    }
    // SAFETY GATE 2: Skip push if the state change came from a remote pull/sync
    if (isSyncingFromRemoteRef.current) {
      isSyncingFromRemoteRef.current = false;
      return;
    }
    // Only push if webhook URL is a valid Webhook endpoint (not a Google Sheet link)
    const isValidPushWebhook =
      webhookUrl &&
      webhookUrl.trim() &&
      !webhookUrl.includes('docs.google.com/spreadsheets') &&
      webhookUrl.includes('/exec');

    if (autoSyncWebhook && isValidPushWebhook) {
      setSyncStatus('syncing');
      const timer = setTimeout(async () => {
        try {
          const payload = buildWebhookPayload(transformers, config, 'sync_all');
          const res = await sendWebhook(webhookUrl.trim(), payload);
          if (res.success) {
            setSyncStatus('synced');
            setLastSyncTime(new Date().toLocaleTimeString('th-TH'));
          } else {
            setSyncStatus('error');
          }
        } catch (err) {
          setSyncStatus('error');
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
        const peaStr = (t.peaNo || '').toLowerCase();
        const matchesPea =
          peaStr.includes(q) ||
          peaStr.replace(/^TR[\s-_]*/i, '').includes(q);
        const matchesSn = (t.serialNo || '').toLowerCase().includes(q);
        const matchesBrand = (t.brand || '').toLowerCase().includes(q);
        const matchesKva = String(t.capacityKva || '').includes(q);
        const matchesNotes = (t.notes || '').toLowerCase().includes(q);
        const matchesSlot = t.slotNumber !== null && t.slotNumber !== undefined ? String(t.slotNumber) === q : false;

        if (!matchesPea && !matchesSn && !matchesBrand && !matchesKva && !matchesNotes && !matchesSlot) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all' && normalizeTransformerStatus(t.status) !== statusFilter) {
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
  const handleSaveTransformer = (rawTransformer: Transformer) => {
    const transformer = sanitizeTransformer(rawTransformer);
    isSyncingFromRemoteRef.current = false;
    let nextList: Transformer[] = [];
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
      nextList = !exists ? [transformer, ...updated] : updated;
      try {
        localStorage.setItem(STORAGE_KEY_TRANSFORMERS, JSON.stringify(nextList));
      } catch {}
      return nextList;
    });

    // Immediate direct sync to server master state to protect against background pull
    fetch('/api/transformers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transformers: nextList, config }),
    })
      .then((r) => r.json())
      .then((data: any) => {
        if (data && data.lastUpdated) {
          lastServerVersionRef.current = data.lastUpdated;
        }
      })
      .catch((e) => console.warn('Server master sync warning on save:', e));

    showNotification(`บันทึกหม้อแปลง ${transformer.peaNo} เรียบร้อยแล้ว`);

    // Immediate sync to Google Sheets if webhook connected
    if (
      autoSyncWebhook &&
      webhookUrl &&
      webhookUrl.trim() &&
      !webhookUrl.includes('docs.google.com/spreadsheets') &&
      webhookUrl.includes('/exec')
    ) {
      setSyncStatus('syncing');
      const payload = buildWebhookPayload(nextList, config, 'sync_all');
      sendWebhook(webhookUrl.trim(), payload)
        .then((res) => {
          if (res.success) {
            setSyncStatus('synced');
            setLastSyncTime(new Date().toLocaleTimeString('th-TH'));
          } else {
            setSyncStatus('error');
          }
        })
        .catch(() => setSyncStatus('error'));
    }
  };

  const handleDeleteTransformer = (id: string) => {
    const target = transformers.find((t) => t.id === id);
    const updated = transformers.filter((t) => t.id !== id);
    setTransformers(updated);
    if (selectedTransformer?.id === id) {
      setIsDetailModalOpen(false);
      setSelectedTransformer(null);
    }
    showNotification(`ลบหม้อแปลง ${target ? target.peaNo : ''} เรียบร้อยแล้ว`);

    // Broadcast immediately to server master state so all other open devices reflect this deletion right away
    fetch('/api/transformers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transformers: updated, config }),
    })
      .then((r) => r.json())
      .then((data: any) => {
        if (data && data.lastUpdated) {
          lastServerVersionRef.current = data.lastUpdated;
        }
      })
      .catch((e) => console.warn('Server master sync warning on delete:', e));

    // Instant sync to Google Sheets if connected
    if (
      autoSyncWebhook &&
      webhookUrl &&
      webhookUrl.trim() &&
      !webhookUrl.includes('docs.google.com/spreadsheets') &&
      webhookUrl.includes('/exec')
    ) {
      setSyncStatus('syncing');
      const payload = buildWebhookPayload(updated, config, 'sync_all');
      sendWebhook(webhookUrl.trim(), payload)
        .then((res) => {
          if (res.success) {
            setSyncStatus('synced');
            setLastSyncTime(new Date().toLocaleTimeString('th-TH'));
            showNotification(`ลบหม้อแปลง ${target ? target.peaNo : ''} และซิงค์ลบใน Google Sheet สำเร็จแล้ว`);
          } else {
            setSyncStatus('error');
          }
        })
        .catch(() => {
          setSyncStatus('error');
        });
    }
  };

  const handleClearAllTransformers = () => {
    if (!confirm(`คุณต้องการลบหม้อแปลงทั้งหมดในระบบ (${transformers.length} เครื่อง) ใช่หรือไม่?\nข้อมูลทั้งหมดจะถูกลบและล้างออกจาก Google Sheet ด้วย`)) {
      return;
    }
    setTransformers([]);
    localStorage.removeItem(STORAGE_KEY_TRANSFORMERS);
    showNotification('ลบหม้อแปลงทั้งหมดในระบบเรียบร้อยแล้ว');

    // Broadcast immediately to server master state with explicit allowClear flag
    fetch('/api/transformers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transformers: [], config, allowClear: true }),
    })
      .then((r) => r.json())
      .then((data: any) => {
        if (data && data.lastUpdated) {
          lastServerVersionRef.current = data.lastUpdated;
        }
      })
      .catch(() => {});

    if (
      webhookUrl &&
      webhookUrl.trim() &&
      !webhookUrl.includes('docs.google.com/spreadsheets') &&
      webhookUrl.includes('/exec')
    ) {
      setSyncStatus('syncing');
      const payload = buildWebhookPayload([], config, 'sync_all');
      sendWebhook(webhookUrl.trim(), payload)
        .then((res) => {
          if (res.success) {
            setSyncStatus('synced');
            setLastSyncTime(new Date().toLocaleTimeString('th-TH'));
            showNotification('ล้างข้อมูลหม้อแปลงทั้งหมดใน Google Sheet เรียบร้อยแล้ว');
          } else {
            setSyncStatus('error');
          }
        })
        .catch(() => {
          setSyncStatus('error');
        });
    }
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

  const handleOpenAddModal = () => {
    setEditingTransformer(null);
    setAddAtSlotNumber(null);
    setAddAtZone('left');
    setAddAtLocationType('holding');
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
        el.classList.add('ring-2', 'ring-violet-500', 'bg-violet-100/70');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-violet-500', 'bg-violet-100/70');
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
    <div className="min-h-screen bg-[#e3e8e5] text-[#26322e] flex flex-col font-sans selection:bg-violet-200 selection:text-violet-950">
      {/* Top Application Navbar */}
      <header className="bg-[#d8e1dc]/95 backdrop-blur-md border-b border-[#c2cdc7] sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Brand & Warehouse Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#d8cef0] border border-[#b9aad9] flex items-center justify-center text-[#4c377a] font-black shadow-2xs shrink-0">
              <Zap className="w-5 h-5 fill-[#6d53a6] text-[#4c377a]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-md bg-[#e5ddf5] text-[#523b85] border border-[#c8bce3]">
                  TRANSFORMER LOGISTICS
                </span>
                <span className="text-xs text-[#52615a] hidden sm:inline">
                  ระบบบริหารจัดการผังคลังและจุดวาง
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-[#1f2b27] tracking-tight truncate">
                {config.warehouseName}
              </h1>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* View Mode Switcher */}
            <div className="flex items-center p-0.5 bg-[#cad4cf] rounded-xl border border-[#b7c3bd]">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-[#f2f0e8] text-[#4c377a] border border-[#c8c0d8] shadow-2xs'
                    : 'text-[#495751] hover:text-[#1f2b27]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>ผังคลัง</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'table'
                    ? 'bg-[#f2f0e8] text-[#4c377a] border border-[#c8c0d8] shadow-2xs'
                    : 'text-[#495751] hover:text-[#1f2b27]'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>ตารางรายการ</span>
              </button>
            </div>

            {/* Pull from Google Sheets Button */}
            <button
              onClick={() => handlePullFromSheets(false)}
              disabled={isPullingSheets}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all border ${
                isPullingSheets
                  ? 'bg-[#f5ebd6] text-[#785314] border-[#dfc594] cursor-wait'
                  : 'bg-[#eff1ec] text-[#2b3b35] border-[#bdcac2] hover:bg-[#e1f0e9] hover:border-[#9ecab5] hover:text-[#1f523b]'
              }`}
              title="ดึงข้อมูลล่าสุดจาก Google Sheets (ระบบจะดึงให้อัตโนมัติทุกครั้งที่เปิดเวป หรือกดเพื่อดึงทันที)"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#388262] ${
                  isPullingSheets ? 'animate-spin text-[#b87d1e]' : ''
                }`}
              />
              <span>{isPullingSheets ? 'กำลังดึงข้อมูล...' : 'ดึงข้อมูลจาก Sheets'}</span>
            </button>

            {/* Google Sheets Integration & Live Status */}
            <button
              onClick={() => setIsWebhookModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all border ${
                syncStatus === 'syncing'
                  ? 'bg-[#f5ebd6] text-[#785314] border-[#dfc594] animate-pulse'
                  : syncStatus === 'synced'
                  ? 'bg-[#deefe7] text-[#1f543d] border-[#a8d4bf] hover:bg-[#d2e8de]'
                  : syncStatus === 'error'
                  ? 'bg-[#f5dfe2] text-[#75232c] border-[#dfaab1] hover:bg-[#eed2d6]'
                  : 'bg-[#eff1ec] text-[#2b3b35] border-[#bdcac2] hover:bg-[#e6ebe8]'
              }`}
              title={`Google Sheets: ${
                syncStatus === 'synced'
                  ? `ซิงค์เรียบร้อย (${lastSyncTime || ''})`
                  : syncStatus === 'syncing'
                  ? 'กำลังซิงค์ข้อมูล...'
                  : syncStatus === 'error'
                  ? 'ซิงค์ไม่สำเร็จ คลิกเพื่อตรวจสอบ'
                  : 'ตั้งค่าและซิงค์ข้อมูล Google Sheets'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-[#388262]" />
              <span>Google Sheets</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  syncStatus === 'syncing'
                    ? 'bg-amber-500 animate-ping'
                    : syncStatus === 'synced'
                    ? 'bg-emerald-500'
                    : syncStatus === 'error'
                    ? 'bg-rose-500'
                    : 'bg-emerald-500'
                }`}
              />
            </button>

            {/* Export Report Button (Excel & PDF) */}
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#e6e0f2] hover:bg-[#dcd3ed] border border-[#c5bae0] rounded-xl text-[#463370] transition-colors shadow-2xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#5e4591]" />
              <span>EXPORT รายงาน</span>
            </button>

            {/* Grid Layout Settings */}
            <button
              onClick={() => setIsConfigModalOpen(true)}
              title="ตั้งค่าขนาดผังคลัง"
              className="p-1.5 text-[#495751] hover:text-[#1f2b27] bg-[#eff1ec] border border-[#bdcac2] hover:bg-[#e4e9e5] rounded-xl transition-colors"
            >
              <Sliders className="w-4 h-4" />
            </button>

            {/* Reset Data */}
            <button
              onClick={handleResetData}
              title="รีเซ็ตข้อมูลตัวอย่าง"
              className="p-1.5 text-[#495751] hover:text-[#1f2b27] bg-[#eff1ec] border border-[#bdcac2] hover:bg-[#e4e9e5] rounded-xl transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Auto-pulling from Sheets status banner */}
      {isPullingSheets && (
        <div className="bg-[#dceee5] border-b border-[#b0d8c5] text-[#1f523b] text-xs py-2 px-4 shadow-2xs animate-in fade-in duration-200">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#2e7858] shrink-0" />
              <span className="font-semibold">
                กำลังดึงข้อมูลล่าสุดจาก Google Sheets (ทำงานอัตโนมัติทุกครั้งที่เปิดเวป)...
              </span>
            </div>
            <span className="text-[11px] text-[#386b54] font-mono hidden sm:inline">
              ซิงค์รหัส TR และตำแหน่งจุดวางหม้อแปลง
            </span>
          </div>
        </div>
      )}

      {/* Floating Notification Toast */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#f2f0e8] text-[#26322e] text-xs px-4 py-2.5 rounded-xl shadow-lg border border-[#b8c4be] flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Info className="w-4 h-4 text-[#654ea3]" />
          <span className="font-medium">{notification}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4 flex-1 w-full">
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
          onAddNew={handleOpenAddModal}
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
            onClearAll={handleClearAllTransformers}
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
      <footer className="bg-[#d8e1dc] border-t border-[#c2cdc7] py-4 text-center text-xs text-[#4a5852] no-print">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-medium">ผังคลังและจุดวางหม้อแปลงไฟฟ้า แผนกหม้อแปลง กฟภ. (PEA Transformer Warehouse Manager)</span>
          <div className="flex items-center gap-4 text-[#52615a]">
            <span>แยกสีสถานะพาสเทล: เขียว (ดี) | เหลือง (รอซ่อมเล็กน้อย) | ส้ม (รอซ่อมหนัก) | แดง (ชำรุด)</span>
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
        onPullFromSheets={() => handlePullFromSheets(false)}
        isPullingSheets={isPullingSheets}
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
