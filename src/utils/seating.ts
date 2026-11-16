import {
  ExamRoom,
  ExamSchedule,
  ModaUjian,
  PhysicalClassroom,
  RoomDistributionConfig,
  SeatingPattern,
  Student,
  SupervisorAssignment,
} from '../types';
import { extractJenjang } from './dnpu';
import { compareClasses } from './numbering';

/**
 * Calculates number of rooms required given active students count and capacity
 */
export function calculateRequiredRooms(studentCount: number, capacityPerRoom: number): number {
  if (capacityPerRoom <= 0) return 1;
  return Math.max(1, Math.ceil(studentCount / capacityPerRoom));
}

/**
 * Fisher-Yates shuffle helper (deterministic if custom rng provided for testing)
 */
function shuffleArray<T>(arr: T[], rng: () => number = Math.random): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Distribute active students randomly and evenly across sessions (for Moda Online).
 * Stratified by jenjang/kelas so each session has balanced jenjang mix.
 */
export function distributeSessions(
  students: Student[],
  jumlahSesi: number,
  rng: () => number = Math.random
): Student[] {
  const totalSesi = Math.max(1, Math.floor(jumlahSesi));
  const active = students.filter((s) => s.status === 'Aktif');

  // Group by jenjang then shuffle each group so sessions are balanced across grades
  const byJenjang = new Map<string, Student[]>();
  for (const s of active) {
    const jen = s.jenjang || extractJenjang(s.kelas);
    if (!byJenjang.has(jen)) byJenjang.set(jen, []);
    byJenjang.get(jen)!.push(s);
  }

  const orderedPool: Student[] = [];
  const jenjangKeys = Array.from(byJenjang.keys()).sort((a, b) => compareClasses(a, b));
  for (const k of jenjangKeys) {
    orderedPool.push(...shuffleArray(byJenjang.get(k)!, rng));
  }

  const assignedMap = new Map<string, number>();
  orderedPool.forEach((st, idx) => {
    assignedMap.set(st.id, (idx % totalSesi) + 1);
  });

  return students.map((st) => {
    if (st.status !== 'Aktif') {
      return { ...st, sesi: undefined };
    }
    return {
      ...st,
      sesi: assignedMap.get(st.id) || 1,
    };
  });
}

/**
 * Interleave students from different jenjangs in 11:11 cross-jenjang pairs for a pool
 * so adjacent desks come from different grades wherever possible.
 */
function buildCrossJenjangQueue(pool: Student[], rng: () => number = Math.random): Student[] {
  const byJenjang = new Map<string, Student[]>();
  for (const s of pool) {
    const jen = s.jenjang || extractJenjang(s.kelas);
    if (!byJenjang.has(jen)) byJenjang.set(jen, []);
    byJenjang.get(jen)!.push(s);
  }

  // Shuffle within each jenjang
  const keys = Array.from(byJenjang.keys()).sort((a, b) => compareClasses(a, b));
  for (const k of keys) {
    byJenjang.set(k, shuffleArray(byJenjang.get(k)!, rng));
  }

  // Pair largest jenjang groups 1:1 round-robin so every pair of seats mixes grades
  const result: Student[] = [];
  while (true) {
    const nonEmptyKeys = keys
      .filter((k) => (byJenjang.get(k)?.length || 0) > 0)
      .sort((a, b) => (byJenjang.get(b)?.length || 0) - (byJenjang.get(a)?.length || 0));

    if (nonEmptyKeys.length === 0) break;

    if (nonEmptyKeys.length === 1) {
      result.push(...(byJenjang.get(nonEmptyKeys[0]) || []));
      byJenjang.set(nonEmptyKeys[0], []);
      break;
    }

    // Take 1 from top two distinct jenjangs
    const k1 = nonEmptyKeys[0];
    const k2 = nonEmptyKeys[1];
    const s1 = byJenjang.get(k1)!.shift();
    const s2 = byJenjang.get(k2)!.shift();
    if (s1) result.push(s1);
    if (s2) result.push(s2);
  }

  return result;
}

export interface RoomDistributionResult {
  updatedStudents: Student[];
  updatedRooms: ExamRoom[];
  warnings: string[];
  summary: Array<{
    roomId: string;
    nomorRuang: string;
    sesi?: number;
    total: number;
    kapasitas: number;
    jenjangCounts: Record<string, number>;
  }>;
}

/**
 * Upgraded Room Distribution supporting:
 * - Max 22 capacity per room (or configured capacityPerRuang <= 22)
 * - 11:11 cross-jenjang ideal composition (gracefully adapting to 21, 20, or available counts)
 * - Session-aware allocation when moda === 'online'
 * - Guarantees zero lost or duplicate students
 */
export function distributeRoomsCrossJenjang(
  students: Student[],
  existingRooms: ExamRoom[],
  config: RoomDistributionConfig,
  moda: ModaUjian = 'kertas',
  rng: () => number = Math.random
): RoomDistributionResult {
  const maxCap = Math.min(22, Math.max(1, config.kapasitasPerRuang || 22));
  const activeStudents = students.filter((s) => s.status === 'Aktif');
  const warnings: string[] = [];

  // Partition by session if online mode, otherwise single bucket
  const sessionBuckets = new Map<number, Student[]>();
  if (moda === 'online') {
    for (const s of activeStudents) {
      const sesi = s.sesi || 1;
      if (!sessionBuckets.has(sesi)) sessionBuckets.set(sesi, []);
      sessionBuckets.get(sesi)!.push(s);
    }
  } else {
    sessionBuckets.set(0, activeStudents);
  }

  const maxBucketSize = Math.max(
    1,
    ...Array.from(sessionBuckets.values()).map((b) => b.length)
  );
  const neededRooms = config.jumlahRuangManual && config.jumlahRuangManual > 0
    ? config.jumlahRuangManual
    : calculateRequiredRooms(maxBucketSize, maxCap);

  const rooms: ExamRoom[] = [];
  for (let i = 0; i < neededRooms; i++) {
    const existing = existingRooms[i];
    const roomNumStr = String(i + 1).padStart(2, '0');
    if (existing) {
      rooms.push({
        ...existing,
        nomorRuang: existing.nomorRuang || roomNumStr,
        namaRuang: existing.namaRuang || `Ruang ${roomNumStr}`,
        kapasitas: Math.min(22, existing.kapasitas || maxCap),
        jumlahKolom: 6,
        jumlahBaris: Math.ceil(Math.min(22, existing.kapasitas || maxCap) / 6),
      });
    } else {
      rooms.push({
        id: `room-${i + 1}`,
        nomorRuang: roomNumStr,
        namaRuang: `Ruang ${roomNumStr}`,
        kapasitas: maxCap,
        jumlahBaris: Math.ceil(maxCap / 6),
        jumlahKolom: 6,
        polaTempatDuduk: 'straight',
        posisiPintu: 'kiri_depan',
        posisiPengawas: 'depan_tengah',
        isLocked: false,
      });
    }
  }

  const assignedRoomMap = new Map<string, { ruangId: string; nomorMeja: number }>();
  const summary: RoomDistributionResult['summary'] = [];

  const sortedSessions = Array.from(sessionBuckets.keys()).sort((a, b) => a - b);

  for (const sesiKey of sortedSessions) {
    const pool = sessionBuckets.get(sesiKey) || [];
    if (pool.length === 0) continue;

    // Check total capacity across rooms for this session
    const totalRoomCapacity = rooms.reduce((acc, r) => acc + r.kapasitas, 0);
    if (pool.length > totalRoomCapacity) {
      warnings.push(
        `${sesiKey > 0 ? `Sesi ${sesiKey}: ` : ''}Jumlah peserta (${pool.length}) melebihi total kapasitas ruang (${totalRoomCapacity}). Tambahkan ruang ujian.`
      );
    }

    // Order pool according to method
    let arranged: Student[];
    if (config.metode === 'nomor_peserta') {
      arranged = [...pool].sort((a, b) =>
        (a.nomorPeserta || '').localeCompare(b.nomorPeserta || '', undefined, { numeric: true })
      );
    } else if (config.metode === 'seimbang_gender') {
      const males = shuffleArray(pool.filter((s) => s.jenisKelamin === 'L'), rng);
      const females = shuffleArray(pool.filter((s) => s.jenisKelamin === 'P'), rng);
      arranged = [];
      const maxLen = Math.max(males.length, females.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < males.length) arranged.push(males[i]);
        if (i < females.length) arranged.push(females[i]);
      }
    } else if (config.metode === 'silang_kelas') {
      const byClass = new Map<string, Student[]>();
      for (const s of pool) {
        if (!byClass.has(s.kelas)) byClass.set(s.kelas, []);
        byClass.get(s.kelas)!.push(s);
      }
      const keys = Array.from(byClass.keys()).sort((a, b) => compareClasses(a, b));
      keys.forEach((k) => byClass.set(k, shuffleArray(byClass.get(k)!, rng)));
      arranged = [];
      let more = true;
      let idx = 0;
      while (more) {
        more = false;
        for (const k of keys) {
          const list = byClass.get(k)!;
          if (idx < list.length) {
            arranged.push(list[idx]);
            more = true;
          }
        }
        idx++;
      }
    } else {
      // Default / 'silang_jenjang_11_11'
      arranged = buildCrossJenjangQueue(pool, rng);
    }

    // Balance participants evenly across available rooms up to room capacity
    const roomAllocations: Student[][] = rooms.map(() => []);
    let roomCursor = 0;

    // Distribute round-robin or chunked evenly so rooms have balanced sizes (e.g., 21/21 instead of 22/20 if needed)
    // Wait: chunking up to ideal balanced per-room target while never exceeding room.kapasitas:
    const idealPerRoom = Math.ceil(arranged.length / rooms.length);
    const targetCapPerRoom = rooms.map((r) => Math.min(r.kapasitas, Math.max(1, idealPerRoom)));

    for (const st of arranged) {
      // Find next room that has space under targetCapPerRoom, else under r.kapasitas
      let placed = false;
      for (let tries = 0; tries < rooms.length; tries++) {
        const idx = (roomCursor + tries) % rooms.length;
        if (roomAllocations[idx].length < targetCapPerRoom[idx]) {
          roomAllocations[idx].push(st);
          roomCursor = idx;
          if (roomAllocations[idx].length >= targetCapPerRoom[idx]) {
            roomCursor = (idx + 1) % rooms.length;
          }
          placed = true;
          break;
        }
      }
      if (!placed) {
        // Fallback to any room with capacity < r.kapasitas
        const fallbackIdx = rooms.findIndex((r, i) => roomAllocations[i].length < r.kapasitas);
        if (fallbackIdx !== -1) {
          roomAllocations[fallbackIdx].push(st);
        } else {
          // Absolute overflow: place in last room and emit warning
          roomAllocations[rooms.length - 1].push(st);
        }
      }
    }

    // Re-interleave inside each room by jenjang so adjacent seats (1&2, 3&4, 5&6) differ in jenjang
    rooms.forEach((room, rIdx) => {
      const occupants = buildCrossJenjangQueue(roomAllocations[rIdx], rng);
      const jenjangCounts: Record<string, number> = {};

      occupants.forEach((st, seatIdx) => {
        const seatNo = seatIdx + 1;
        assignedRoomMap.set(st.id, { ruangId: room.id, nomorMeja: seatNo });
        const jen = st.jenjang || extractJenjang(st.kelas);
        jenjangCounts[jen] = (jenjangCounts[jen] || 0) + 1;
      });

      if (occupants.length > room.kapasitas) {
        warnings.push(
          `${room.namaRuang}${sesiKey > 0 ? ` (Sesi ${sesiKey})` : ''}: Jumlah peserta (${occupants.length}) melebihi kapasitas maksimal (${room.kapasitas}).`
        );
      }
      const distinctJenjang = Object.keys(jenjangCounts).length;
      if (occupants.length > 1 && distinctJenjang === 1 && sessionBuckets.get(sesiKey)!.length > occupants.length) {
        warnings.push(
          `${room.namaRuang}${sesiKey > 0 ? ` (Sesi ${sesiKey})` : ''}: Seluruh peserta berasal dari 1 jenjang (${Object.keys(jenjangCounts)[0]}).`
        );
      }

      summary.push({
        roomId: room.id,
        nomorRuang: room.nomorRuang,
        sesi: sesiKey > 0 ? sesiKey : undefined,
        total: occupants.length,
        kapasitas: room.kapasitas,
        jenjangCounts,
      });
    });
  }

  const updatedStudents = students.map((st) => {
    if (st.status !== 'Aktif') {
      return { ...st, ruangId: undefined, nomorMeja: undefined };
    }
    const assign = assignedRoomMap.get(st.id);
    return {
      ...st,
      ruangId: assign?.ruangId,
      nomorMeja: assign?.nomorMeja,
    };
  });

  return {
    updatedStudents,
    updatedRooms: rooms,
    warnings,
    summary,
  };
}

/**
 * Legacy-compatible wrapper for existing callers & unit tests
 */
export function distributeStudents(
  students: Student[],
  existingRooms: ExamRoom[],
  config: RoomDistributionConfig
): {
  updatedStudents: Student[];
  updatedRooms: ExamRoom[];
} {
  const activeStudents = students.filter((s) => s.status === 'Aktif');
  const inactiveStudents = students.filter((s) => s.status !== 'Aktif');

  const targetRoomCount =
    config.jumlahRuangManual && config.jumlahRuangManual > 0
      ? config.jumlahRuangManual
      : calculateRequiredRooms(activeStudents.length, config.kapasitasPerRuang);

  const rooms: ExamRoom[] = [];
  for (let i = 0; i < targetRoomCount; i++) {
    const existing = existingRooms[i];
    const roomNumStr = String(i + 1).padStart(2, '0');
    if (existing) {
      rooms.push({
        ...existing,
        nomorRuang: existing.nomorRuang || roomNumStr,
        kapasitas: existing.kapasitas || config.kapasitasPerRuang,
      });
    } else {
      rooms.push({
        id: `room-${i + 1}`,
        nomorRuang: roomNumStr,
        namaRuang: `Ruang ${roomNumStr}`,
        kapasitas: config.kapasitasPerRuang,
        jumlahBaris: 4,
        jumlahKolom: 6,
        polaTempatDuduk: 'straight',
        posisiPintu: 'kiri_depan',
        posisiPengawas: 'depan_tengah',
      });
    }
  }

  let arrangedStudents: Student[] = [];
  if (config.metode === 'nomor_peserta') {
    arrangedStudents = [...activeStudents].sort((a, b) =>
      (a.nomorPeserta || '').localeCompare(b.nomorPeserta || '', undefined, { numeric: true })
    );
  } else if (config.metode === 'seimbang_gender') {
    const males = activeStudents.filter((s) => s.jenisKelamin === 'L');
    const females = activeStudents.filter((s) => s.jenisKelamin === 'P');
    const maxLen = Math.max(males.length, females.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < males.length) arrangedStudents.push(males[i]);
      if (i < females.length) arrangedStudents.push(females[i]);
    }
  } else if (config.metode === 'silang_kelas' || config.metode === 'silang_jenjang_11_11') {
    arrangedStudents = buildCrossJenjangQueue(activeStudents);
  } else {
    arrangedStudents = [...activeStudents];
  }

  let currentRoomIdx = 0;
  let currentSeatInRoom = 1;
  const updatedActive: Student[] = [];

  for (const st of arrangedStudents) {
    const currentRoom = rooms[currentRoomIdx];
    if (currentSeatInRoom > currentRoom.kapasitas && currentRoomIdx < rooms.length - 1) {
      currentRoomIdx++;
      currentSeatInRoom = 1;
    }
    const assignedRoom = rooms[currentRoomIdx];
    updatedActive.push({
      ...st,
      ruangId: assignedRoom.id,
      nomorMeja: currentSeatInRoom,
    });
    currentSeatInRoom++;
  }

  const updatedInactive = inactiveStudents.map((st) => ({
    ...st,
    ruangId: undefined,
    nomorMeja: undefined,
  }));

  const idMap = new Map(updatedActive.map((s) => [s.id, s]));
  const finalStudents = students.map(
    (s) => idMap.get(s.id) || updatedInactive.find((inact) => inact.id === s.id) || s
  );

  return {
    updatedStudents: finalStudents,
    updatedRooms: rooms,
  };
}

/**
 * Compute actual participant number ranges grouped by Class (or Jenjang) in a room.
 * Splits non-contiguous sequences cleanly so ranges never fabricate missing numbers!
 */
export function computeClassRangesInRoom(
  roomStudents: Student[],
  allStudentsOrdered?: Student[]
): Array<{
  kelas: string;
  count: number;
  ranges: string[];
}> {
  const byClass = new Map<string, Student[]>();
  for (const s of roomStudents) {
    if (!byClass.has(s.kelas)) byClass.set(s.kelas, []);
    byClass.get(s.kelas)!.push(s);
  }

  // Build global rank map if provided to detect exact contiguity across same class
  const sortedClasses = Array.from(byClass.keys()).sort((a, b) => compareClasses(a, b));

  return sortedClasses.map((kelas) => {
    const list = [...byClass.get(kelas)!].sort((a, b) =>
      (a.nomorPeserta || '').localeCompare(b.nomorPeserta || '', undefined, { numeric: true })
    );

    if (list.length === 0) {
      return { kelas, count: 0, ranges: [] };
    }

    // Detect contiguous blocks using trailing numeric sequence
    const getTrailingNum = (numStr: string): number | null => {
      const m = (numStr || '').match(/(\d+)$/);
      return m ? parseInt(m[1], 10) : null;
    };

    // If global students of same class exist, check whether another student sits numerically between two
    const globalClassNums = allStudentsOrdered
      ? allStudentsOrdered
          .filter((s) => s.kelas === kelas && s.status === 'Aktif' && s.nomorPeserta)
          .map((s) => s.nomorPeserta)
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      : null;

    const ranges: string[] = [];
    let start = list[0].nomorPeserta || '-';
    let prev = list[0].nomorPeserta || '-';

    for (let i = 1; i < list.length; i++) {
      const curr = list[i].nomorPeserta || '-';
      let isContiguous = false;

      if (globalClassNums) {
        const prevIdx = globalClassNums.indexOf(prev);
        const currIdx = globalClassNums.indexOf(curr);
        isContiguous = prevIdx !== -1 && currIdx === prevIdx + 1;
      } else {
        const prevN = getTrailingNum(prev);
        const currN = getTrailingNum(curr);
        isContiguous = prevN !== null && currN !== null && currN === prevN + 1;
      }

      if (!isContiguous) {
        ranges.push(start === prev ? start : `${start}–${prev}`);
        start = curr;
      }
      prev = curr;
    }
    ranges.push(start === prev ? start : `${start}–${prev}`);

    return {
      kelas,
      count: list.length,
      ranges,
    };
  });
}

/**
 * Validate exam schedules for room overlaps, session overlaps, and physical classroom conflicts.
 */
export function validateScheduleConflicts(
  schedules: ExamSchedule[],
  physicalClassrooms: PhysicalClassroom[] = []
): string[] {
  const conflicts: string[] = [];
  const toMinutes = (hhmm: string) => {
    const [h, m] = (hhmm || '00:00').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  for (let i = 0; i < schedules.length; i++) {
    for (let j = i + 1; j < schedules.length; j++) {
      const a = schedules[i];
      const b = schedules[j];
      if (a.tanggal !== b.tanggal) continue;
      if (a.sesi !== b.sesi) continue;

      const aStart = toMinutes(a.waktuMulai);
      const aEnd = toMinutes(a.waktuSelesai);
      const bStart = toMinutes(b.waktuMulai);
      const bEnd = toMinutes(b.waktuSelesai);

      const timeOverlaps = aStart < bEnd && bStart < aEnd;
      if (!timeOverlaps) continue;

      // Room conflict
      const sharedRooms = a.ruangIds.filter((rId) => b.ruangIds.includes(rId));
      if (sharedRooms.length > 0 && (a.jenjang === b.jenjang || !a.jenjang || !b.jenjang)) {
        conflicts.push(
          `Benturan jadwal pada ${a.tanggal} (${a.waktuMulai}-${a.waktuSelesai}, Sesi ${a.sesi}) untuk ${sharedRooms.length} ruang yang sama.`
        );
      }

      // Physical classroom conflict
      for (const pc of physicalClassrooms) {
        const usesA = a.ruangIds.some((rId) => pc.assignedRoomIds.includes(rId));
        const usesB = b.ruangIds.some((rId) => pc.assignedRoomIds.includes(rId));
        if (usesA && usesB && a.mapelId !== b.mapelId) {
          conflicts.push(
            `Benturan kelas fisik ${pc.namaKelas} pada ${a.tanggal} pukul ${a.waktuMulai}-${a.waktuSelesai} (Sesi ${a.sesi}).`
          );
        }
      }
    }
  }

  return Array.from(new Set(conflicts));
}

/**
 * Validate supervisor assignments for double-booking across rooms at the same date + overlapping time + session.
 */
export function validateSupervisorConflicts(
  assignments: SupervisorAssignment[],
  schedules: ExamSchedule[]
): string[] {
  const conflicts: string[] = [];
  const schedMap = new Map(schedules.map((s) => [s.id, s]));
  const toMinutes = (hhmm: string) => {
    const [h, m] = (hhmm || '00:00').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  for (let i = 0; i < assignments.length; i++) {
    const a1 = assignments[i];
    const s1 = schedMap.get(a1.scheduleId);
    if (!s1) continue;

    // Same supervisor assigned as both pengawas 1 & 2 in same room
    if (a1.pengawas1Id && a1.pengawas2Id && a1.pengawas1Id === a1.pengawas2Id) {
      conflicts.push(`Pengawas 1 dan Pengawas 2 tidak boleh orang yang sama pada ruang ${a1.roomId} (${s1.tanggal}).`);
    }

    for (let j = i + 1; j < assignments.length; j++) {
      const a2 = assignments[j];
      const s2 = schedMap.get(a2.scheduleId);
      if (!s2) continue;

      if (s1.tanggal !== s2.tanggal || a1.sesi !== a2.sesi) continue;
      const overlap =
        toMinutes(s1.waktuMulai) < toMinutes(s2.waktuSelesai) &&
        toMinutes(s2.waktuMulai) < toMinutes(s1.waktuSelesai);
      if (!overlap) continue;

      const teachers1 = [a1.pengawas1Id, a1.pengawas2Id].filter(Boolean) as string[];
      const teachers2 = [a2.pengawas1Id, a2.pengawas2Id].filter(Boolean) as string[];

      for (const t of teachers1) {
        if (teachers2.includes(t)) {
          conflicts.push(
            `Benturan jadwal pengawas (${t}) pada ${s1.tanggal} (${s1.waktuMulai}-${s1.waktuSelesai}, Sesi ${a1.sesi}) di lebih dari 1 ruang.`
          );
        }
      }
    }
  }

  return Array.from(new Set(conflicts));
}

/**
 * Returns list of coordinates and sequential seat numbers (1..capacity)
 * based on rows, cols, and pattern (snake, zigzag, straight).
 */
export function getOrderedSeats(
  rows: number,
  cols: number,
  pattern: SeatingPattern
): Array<{ row: number; col: number; seatNumber: number }> {
  const result: Array<{ row: number; col: number; seatNumber: number }> = [];
  let seat = 1;

  if (pattern === 'straight') {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        result.push({ row: r, col: c, seatNumber: seat++ });
      }
    }
  } else if (pattern === 'snake') {
    for (let r = 0; r < rows; r++) {
      if (r % 2 === 0) {
        for (let c = 0; c < cols; c++) {
          result.push({ row: r, col: c, seatNumber: seat++ });
        }
      } else {
        for (let c = cols - 1; c >= 0; c--) {
          result.push({ row: r, col: c, seatNumber: seat++ });
        }
      }
    }
  } else {
    for (let c = 0; c < cols; c++) {
      if (c % 2 === 0) {
        for (let r = 0; r < rows; r++) {
          result.push({ row: r, col: c, seatNumber: seat++ });
        }
      } else {
        for (let r = rows - 1; r >= 0; r--) {
          result.push({ row: r, col: c, seatNumber: seat++ });
        }
      }
    }
  }

  return result;
}

/**
 * Build grid matrix for room display
 */
export function buildRoomSeatGrid(
  room: ExamRoom,
  studentsInRoom: Student[]
): Array<{
  seatNumber: number;
  row: number;
  col: number;
  student?: Student;
}> {
  const ordered = getOrderedSeats(room.jumlahBaris, room.jumlahKolom, room.polaTempatDuduk);
  const studentBySeat = new Map<number, Student>();

  for (const s of studentsInRoom) {
    if (s.nomorMeja && s.nomorMeja <= room.kapasitas) {
      studentBySeat.set(s.nomorMeja, s);
    }
  }

  return ordered.map((item) => ({
    seatNumber: item.seatNumber,
    row: item.row,
    col: item.col,
    student: studentBySeat.get(item.seatNumber),
  }));
}
