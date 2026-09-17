import { Transformer, WarehouseConfig, STATUS_CONFIG } from '../types';

export interface ExportResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
}

export function extractSpreadsheetId(urlOrId: string): string {
  const clean = urlOrId.trim();
  // Match standard Google Sheets URL: https://docs.google.com/spreadsheets/d/{spreadsheetId}/edit...
  const match = clean.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return clean;
}

/**
 * Creates a brand new Google Spreadsheet with 2 sheets:
 * 1. "ข้อมูลหม้อแปลงทั้งหมด" (All Transformers)
 * 2. "ผังคลังและสถานะช่อง" (Warehouse Grid Layout)
 */
export async function createWarehouseSpreadsheet(
  accessToken: string,
  transformers: Transformer[],
  config: WarehouseConfig,
  customTitle?: string
): Promise<ExportResult> {
  const title = customTitle || `PEA ผังคลังหม้อแปลงไฟฟ้า - ${new Date().toLocaleDateString('th-TH')}`;

  // 1. Create the empty spreadsheet with sheet tabs
  const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
      },
      sheets: [
        {
          properties: {
            sheetId: 0,
            title: 'ข้อมูลหม้อแปลงทั้งหมด',
            gridProperties: { rowCount: Math.max(100, transformers.length + 10), columnCount: 12 },
          },
        },
        {
          properties: {
            sheetId: 1,
            title: 'ผังคลังและสถานะช่อง',
            gridProperties: { rowCount: config.rows * config.columns + 20, columnCount: 8 },
          },
        },
        {
          properties: {
            sheetId: 2,
            title: 'สรุปสถิติคลัง',
            gridProperties: { rowCount: 20, columnCount: 6 },
          },
        },
      ],
    }),
  });

  if (!createResponse.ok) {
    const errorData = await createResponse.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `เกิดข้อผิดพลาดในการสร้างสเปรดชีต (${createResponse.status})`);
  }

  const sheetData = await createResponse.json();
  const spreadsheetId = sheetData.spreadsheetId;
  const spreadsheetUrl = sheetData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // 2. Populate data into the newly created sheets
  await updateSpreadsheetData(accessToken, spreadsheetId, transformers, config);

  return {
    spreadsheetId,
    spreadsheetUrl,
    title,
  };
}

/**
 * Updates an existing Google Spreadsheet with transformers and warehouse layout data.
 */
export async function updateSpreadsheetData(
  accessToken: string,
  spreadsheetId: string,
  transformers: Transformer[],
  config: WarehouseConfig
): Promise<void> {
  // 1. Prepare Rows for "ข้อมูลหม้อแปลงทั้งหมด"
  const transformerHeaders = [
    'ลำดับ',
    'รหัส PEA No.',
    'Serial Number',
    'ยี่ห้อ (Brand)',
    'ขนาด (kVA)',
    'เฟส (Phase)',
    'แรงดัน (kV)',
    'สถานะหม้อแปลง',
    'ตำแหน่งจัดเก็บ',
    'หมายเหตุ',
    'วันที่บันทึก',
    'อัปเดตล่าสุด'
  ];

  const transformerRows = transformers.map((t, idx) => {
    const location = t.slotNumber !== null ? `${config.zonePrefix} ช่อง ${t.slotNumber}` : 'จุดพักรอจัดเก็บ';
    return [
      idx + 1,
      t.peaNo,
      t.serialNo,
      t.brand,
      t.capacityKva,
      t.phase === '3-Phase' ? '3 เฟส' : '1 เฟส',
      t.voltage || '22 kV / 400-230 V',
      STATUS_CONFIG[t.status]?.label || t.status,
      location,
      t.notes || '',
      t.receivedDate || '',
      t.updatedAt || ''
    ];
  });

  // 2. Prepare Rows for "ผังคลังและสถานะช่อง"
  const gridHeaders = [
    'ช่องที่ (Slot No.)',
    'โซน/พิกัด',
    'สถานะช่อง',
    'รหัส PEA No.',
    'Serial No.',
    'ขนาด (kVA)',
    'ยี่ห้อ',
    'สถานะหม้อแปลง'
  ];

  const totalSlots = config.columns * config.rows;
  const slotMap = new Map<number, Transformer>();
  transformers.forEach((t) => {
    if (t.slotNumber !== null) slotMap.set(t.slotNumber, t);
  });

  const gridRows: any[][] = [];
  for (let s = 1; s <= totalSlots; s++) {
    const t = slotMap.get(s);
    if (t) {
      gridRows.push([
        s,
        `${config.zonePrefix} ${s}`,
        'มีหม้อแปลง',
        t.peaNo,
        t.serialNo,
        t.capacityKva,
        t.brand,
        STATUS_CONFIG[t.status]?.label || t.status
      ]);
    } else {
      gridRows.push([
        s,
        `${config.zonePrefix} ${s}`,
        'ว่าง (Available)',
        '-',
        '-',
        '-',
        '-',
        '-'
      ]);
    }
  }

  // 3. Prepare Rows for "สรุปสถิติคลัง"
  const occupiedCount = transformers.filter((t) => t.slotNumber !== null).length;
  const holdingCount = transformers.filter((t) => t.slotNumber === null).length;
  const goodCount = transformers.filter((t) => t.status === 'good').length;
  const minorCount = transformers.filter((t) => t.status === 'minor_repair').length;
  const majorCount = transformers.filter((t) => t.status === 'major_repair').length;
  const damagedCount = transformers.filter((t) => t.status === 'damaged').length;

  const statsRows = [
    ['หัวข้อสถิติ', 'จำนวน (เครื่อง)', 'หมายเหตุ'],
    ['หม้อแปลงทั้งหมดในระบบ', transformers.length, 'เครื่องทั้งหมดที่ลงทะเบียน'],
    ['จัดเก็บในผังคลัง', occupiedCount, `จากความจุ ${totalSlots} ช่อง (${Math.round((occupiedCount / totalSlots) * 100)}%)`],
    ['ช่องว่างในคลัง', totalSlots - occupiedCount, 'ช่องที่พร้อมใช้งาน'],
    ['จุดพักรอจัดเก็บ (Holding Area)', holdingCount, 'หม้อแปลงที่ยังไม่ระบุช่อง'],
    ['สถานะ: ดี (สีเขียว)', goodCount, `${Math.round((goodCount / (transformers.length || 1)) * 100)}%`],
    ['สถานะ: รอซ่อมเล็กน้อย (สีเหลือง)', minorCount, ''],
    ['สถานะ: รอซ่อมหนัก (สีส้ม)', majorCount, ''],
    ['สถานะ: ชำรุด (สีแดง)', damagedCount, ''],
    ['ข้อมูลคลัง', `${config.warehouseName} (${config.columns} คอลัมน์ x ${config.rows} แถว)`, ''],
    ['วันที่ส่งออกข้อมูล', new Date().toLocaleString('th-TH'), '']
  ];

  // Batch update values
  const updateBody = {
    valueInputOption: 'USER_ENTERED',
    data: [
      {
        range: "'ข้อมูลหม้อแปลงทั้งหมด'!A1:L" + (transformerRows.length + 1),
        values: [transformerHeaders, ...transformerRows],
      },
      {
        range: "'ผังคลังและสถานะช่อง'!A1:H" + (gridRows.length + 1),
        values: [gridHeaders, ...gridRows],
      },
      {
        range: "'สรุปสถิติคลัง'!A1:C" + (statsRows.length + 1),
        values: statsRows,
      },
    ],
  };

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateBody),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `เกิดข้อผิดพลาดในการบันทึกข้อมูล (${response.status})`);
  }
}

/**
 * Reads transformers from a Google Spreadsheet sheet "ข้อมูลหม้อแปลงทั้งหมด".
 */
export async function importTransformersFromSheet(
  accessToken: string,
  spreadsheetId: string,
  config: WarehouseConfig
): Promise<Transformer[]> {
  // Read first sheet or "ข้อมูลหม้อแปลงทั้งหมด"
  let range = "'ข้อมูลหม้อแปลงทั้งหมด'!A1:L200";
  let response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    // Try Sheet1 as fallback
    range = "Sheet1!A1:L200";
    response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `ไม่สามารถดึงข้อมูลจาก Google Sheets ได้ (${response.status})`);
  }

  const data = await response.json();
  const rows: string[][] = data.values || [];

  if (rows.length <= 1) {
    throw new Error('ไม่พบแถวข้อมูลหม้อแปลงในแผ่นงานนี้');
  }

  // Header detection
  const header = rows[0].map((h) => (h || '').toString().toLowerCase());
  const dataRows = rows.slice(1);

  const importedTransformers: Transformer[] = [];

  dataRows.forEach((row, index) => {
    if (!row || row.length === 0 || !row[1]) return;

    // Expected format:
    // row[0]: ลำดับ
    // row[1]: peaNo (e.g. "PEA 04-58219" or "04-58219")
    // row[2]: serialNo
    // row[3]: brand
    // row[4]: capacityKva
    // row[5]: phase
    // row[6]: voltageKv
    // row[7]: status
    // row[8]: location / slot
    // row[9]: notes
    // row[10]: dateAdded
    // row[11]: lastUpdated

    const peaNo = String(row[1] || '').trim();
    if (!peaNo) return;

    const serialNo = String(row[2] || `SN-${index + 1}`).trim();
    const brand = String(row[3] || 'Tirathai').trim();
    const capacityKva = parseInt(String(row[4] || '50').replace(/[^0-9]/g, ''), 10) || 50;
    const phaseStr = String(row[5] || '').toLowerCase();
    const phase = phaseStr.includes('1') ? '1-phase' : '3-phase';
    const voltageKv = String(row[6] || '22/0.4 kV').trim();

    // Parse status
    const statusStr = String(row[7] || '').toLowerCase();
    let status: 'good' | 'minor_repair' | 'major_repair' | 'damaged' = 'good';
    if (statusStr.includes('ชำรุด') || statusStr.includes('damaged') || statusStr.includes('แดง')) {
      status = 'damaged';
    } else if (statusStr.includes('หนัก') || statusStr.includes('major') || statusStr.includes('ส้ม')) {
      status = 'major_repair';
    } else if (statusStr.includes('เล็กน้อย') || statusStr.includes('minor') || statusStr.includes('เหลือง')) {
      status = 'minor_repair';
    } else {
      status = 'good';
    }

    // Parse slot number from location
    const locationStr = String(row[8] || '');
    let slotNumber: number | null = null;
    const slotMatch = locationStr.match(/\b([0-9]{1,3})\b/);
    if (slotMatch && !locationStr.includes('พักรอ')) {
      const parsedSlot = parseInt(slotMatch[1], 10);
      if (parsedSlot >= 1 && parsedSlot <= config.columns * config.rows) {
        slotNumber = parsedSlot;
      }
    }

    const notes = String(row[9] || '');
    const receivedDate = String(row[10] || new Date().toISOString().split('T')[0]);
    const updatedAt = String(row[11] || new Date().toISOString().split('T')[0]);

    const parsedPhase: '1-Phase' | '3-Phase' = phaseStr.includes('1') ? '1-Phase' : '3-Phase';
    const voltage = String(row[6] || '22 kV / 400-230 V').trim();

    importedTransformers.push({
      id: `imported-${Date.now()}-${index}`,
      peaNo: peaNo.startsWith('PEA') ? peaNo : `PEA ${peaNo}`,
      serialNo,
      brand,
      capacityKva,
      phase: parsedPhase,
      voltage,
      status,
      slotNumber,
      notes,
      receivedDate,
      updatedAt,
    });
  });

  return importedTransformers;
}
