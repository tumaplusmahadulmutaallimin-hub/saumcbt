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

/**
 * Compute balanced room occupant counts respecting room capacities,
 * minimizing the number of odd-sized rooms where capacity allows.
 */
function computeBalancedTargetSizes(totalStudents: number, roomCapacities: number[]): number[] {
  const numRooms = roomCapacities.length;
  if (numRooms === 0) return [];
  if (totalStudents === 0) return roomCapacities.map(() => 0);

  const totalCap = roomCapacities.reduce((sum, c) => sum + c, 0);
  const base = Math.floor(totalStudents / numRooms);
  const rem = totalStudents % numRooms;

  // Start with balanced split (or proportional overflow if totalStudents > totalCap)
  const sizes = roomCapacities.map((cap, idx) => {
    const raw = base + (idx < rem ? 1 : 0);
    return totalStudents <= totalCap ? Math.min(cap, raw) : raw;
  });

  // If totalStudents <= totalCap, distribute any leftover students from capped rooms
  let assigned = sizes.reduce((sum, v) => sum + v, 0);
  while (assigned < totalStudents && totalStudents <= totalCap) {
    let progressed = false;
    for (let i = 0; i < numRooms && assigned < totalStudents; i++) {
      if (sizes[i] < roomCapacities[i]) {
        sizes[i]++;
        assigned++;
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  // Smooth pairs of odd-sized rooms into even-sized rooms (1 meja = 2 kursi)
  // when capacity allows, keeping any unavoidable single odd room at the end.
  for (let i = 0; i < numRooms; i++) {
    if (sizes[i] % 2 === 1 && sizes[i] < roomCapacities[i]) {
      for (let j = numRooms - 1; j > i; j--) {
        if (sizes[j] % 2 === 1 && sizes[j] > 1) {
          sizes[i]++;
          sizes[j]--;
          break;
        }
      }
    }
  }

  return sizes;
}

/**
 * Allocate room buckets prioritizing 2-jenjang-only composition for lower rooms,
 * placing 3-jenjang mixed rooms only when needed and sorting them to the end.
 */
function allocateCrossJenjangBuckets(
  pool: Student[],
  targetSizes: number[],
  rng: () => number = Math.random
): Student[][] {
  const byJenjang = new Map<string, Student[]>();
  for (const s of pool) {
    const jen = s.jenjang || extractJenjang(s.kelas);
    if (!byJenjang.has(jen)) byJenjang.set(jen, []);
    byJenjang.get(jen)!.push(s);
  }

  const jenjangKeys = Array.from(byJenjang.keys()).sort((a, b) => compareClasses(a, b));
  for (const k of jenjangKeys) {
    byJenjang.set(k, shuffleArray(byJenjang.get(k)!, rng));
  }

  // Sort larger target slots first during packing so big 2-jenjang rooms form cleanly
  const slotOrder = targetSizes
    .map((size, idx) => ({ size, idx }))
    .sort((a, b) => b.size - a.size || a.idx - b.idx);

  const buckets: Student[][] = targetSizes.map(() => []);

  const getAvailMap = () => {
    const m = new Map<string, number>();
    jenjangKeys.forEach((k) => m.set(k, byJenjang.get(k)?.length || 0));
    return m;
  };

  for (const { size } of slotOrder) {
    if (size <= 0) continue;
    const avail = getAvailMap();
    const remTotal = Array.from(avail.values()).reduce((sum, v) => sum + v, 0);
    const nextTotal = Math.max(0, remTotal - size);
    const maxSafeAfter = Math.ceil(nextTotal / 2);

    const activeKeys = jenjangKeys.filter((k) => (avail.get(k) || 0) > 0);
    if (activeKeys.length === 0) break;

    let chosenTake: Map<string, number> | null = null;

    // 1. Try pure 2-jenjang split (preferred for lower rooms)
    if (activeKeys.length >= 2) {
      const halfFloor = Math.floor(size / 2);
      const halfCeil = Math.ceil(size / 2);
      let bestScore = Number.POSITIVE_INFINITY;

      for (let i = 0; i < activeKeys.length; i++) {
        for (let j = i + 1; j < activeKeys.length; j++) {
          const kA = activeKeys[i];
          const kB = activeKeys[j];
          const cA = avail.get(kA) || 0;
          const cB = avail.get(kB) || 0;
          if (cA + cB < size) continue;

          // Zero same-jenjang desk conflict inside a 2-jenjang room requires both >= floor(size/2)
          const minA = Math.max(halfFloor, size - cB);
          const maxA = Math.min(halfCeil, cA);
          if (minA > maxA) continue;

          for (let takeA = minA; takeA <= maxA; takeA++) {
            const takeB = size - takeA;
            if (takeB > halfCeil || takeB > cB) continue;

            let maxRemAfter = 0;
            for (const k of jenjangKeys) {
              const left = (avail.get(k) || 0) - (k === kA ? takeA : k === kB ? takeB : 0);
              if (left > maxRemAfter) maxRemAfter = left;
            }
            const invariantExcess = Math.max(0, maxRemAfter - maxSafeAfter);
            const activeAfterCount = jenjangKeys.filter((k) => {
              const left = (avail.get(k) || 0) - (k === kA ? takeA : k === kB ? takeB : 0);
              return left > 0;
            }).length;

            // Lower score is better: satisfy invariant, keep >=2 jenjangs alive if nextTotal>0, use abundant grades
            const score =
              invariantExcess * 10000 +
              (nextTotal > 0 && activeAfterCount < 2 ? 5000 : 0) +
              maxRemAfter * 10 -
              (cA + cB);

            if (score < bestScore) {
              bestScore = score;
              chosenTake = new Map([
                [kA, takeA],
                [kB, takeB],
              ]);
            }
          }
        }
      }
    }

    // 2. Fallback: Mix >= 3 jenjangs (or 1 jenjang if only 1 left) while capping each <= ceil(size/2) where possible
    if (!chosenTake) {
      const take = new Map<string, number>();
      let remainingNeed = size;
      const capPerGrade = Math.ceil(size / 2);

      // Fill while strictly respecting capPerGrade to guarantee cross-jenjang desks
      while (remainingNeed > 0) {
        const candidates = jenjangKeys
          .filter((k) => {
            const left = (avail.get(k) || 0) - (take.get(k) || 0);
            const taken = take.get(k) || 0;
            return left > 0 && taken < capPerGrade;
          })
          .sort((a, b) => {
            const leftA = (avail.get(a) || 0) - (take.get(a) || 0);
            const leftB = (avail.get(b) || 0) - (take.get(b) || 0);
            return leftB - leftA;
          });

        if (candidates.length === 0) break;
        const pick = candidates[0];
        take.set(pick, (take.get(pick) || 0) + 1);
        remainingNeed--;
      }

      // If still short (e.g., 1 dominant grade remains), take remaining from available
      while (remainingNeed > 0) {
        const candidates = jenjangKeys
          .filter((k) => (avail.get(k) || 0) - (take.get(k) || 0) > 0)
          .sort(
            (a, b) =>
              ((avail.get(b) || 0) - (take.get(b) || 0)) -
              ((avail.get(a) || 0) - (take.get(a) || 0))
          );
        if (candidates.length === 0) break;
        const pick = candidates[0];
        take.set(pick, (take.get(pick) || 0) + 1);
        remainingNeed--;
      }

      chosenTake = take;
    }

    // Pop assigned students from byJenjang pools
    const roomStudents: Student[] = [];
    chosenTake.forEach((count, key) => {
      const list = byJenjang.get(key) || [];
      for (let i = 0; i < count; i++) {
        const st = list.shift();
        if (st) roomStudents.push(st);
      }
    });
    // Place temporarily into slotOrder bucket
    buckets[slotOrder.find((s) => buckets[s.idx].length === 0 && s.size === size)?.idx ?? 0] =
      roomStudents;
  }

  // Collect formed non-empty buckets and sort:
  // 1) Pure 2-jenjang rooms first (lowest room numbers 01, 02...)
  // 2) Single-jenjang (if small/odd unavoidable)
  // 3) 3+ jenjang mixed rooms strictly AT THE END (highest room numbers)
  const nonEmptyBuckets = buckets.filter((b) => b.length > 0);
  const emptyCount = buckets.length - nonEmptyBuckets.length;

  nonEmptyBuckets.sort((a, b) => {
    const distinctA = new Set(a.map((s) => s.jenjang || extractJenjang(s.kelas))).size;
    const distinctB = new Set(b.map((s) => s.jenjang || extractJenjang(s.kelas))).size;
    const rank = (d: number) => (d === 2 ? 0 : d === 1 ? 1 : 2);
    const rDiff = rank(distinctA) - rank(distinctB);
    if (rDiff !== 0) return rDiff;
    // Keep odd-count room toward the end within same rank
    const oddDiff = (a.length % 2) - (b.length % 2);
    if (oddDiff !== 0) return oddDiff;
    return b.length - a.length;
  });

  for (let i = 0; i < emptyCount; i++) {
    nonEmptyBuckets.push([]);
  }
  return nonEmptyBuckets;
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
 * - Honors explicit room count (config.jumlahRuangManual or examJumlahRuang) strictly
 * - 2-jenjang cross composition prioritized in lower rooms, 3-jenjang placed at the END
 * - Zero same-jenjang desk mate collisions wherever mathematically possible
 * - Session-aware allocation when moda === 'online'
 */
export function distributeRoomsCrossJenjang(
  students: Student[],
  existingRooms: ExamRoom[],
  config: RoomDistributionConfig,
  moda: ModaUjian = 'kertas',
  rng: () => number = Math.random,
  options?: { examJumlahRuang?: number }
): RoomDistributionResult {
  const maxCap = Math.min(22, Math.max(1, config.kapasitasPerRuang || 22));
  const activeStudents = students.filter((s) => s.status === 'Aktif');
  const warnings: string[] = [];

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
  const explicitManual =
    config.jumlahRuangManual && config.jumlahRuangManual > 0 ? config.jumlahRuangManual : 0;
  const fallbackExamRooms =
    options?.examJumlahRuang && options.examJumlahRuang > 0 ? options.examJumlahRuang : 0;
  const neededRooms = Math.max(
    1,
    explicitManual || fallbackExamRooms || calculateRequiredRooms(maxBucketSize, maxCap)
  );

  // Exclude reserve rooms when regenerating standard numbered rooms 01..N
  const normalExisting = existingRooms.filter((r) => !r.id.startsWith('room-cadangan'));
  const rooms: ExamRoom[] = [];
  for (let i = 0; i < neededRooms; i++) {
    const existing = normalExisting[i];
    const roomNumStr = String(i + 1).padStart(2, '0');
    if (existing) {
      rooms.push({
        ...existing,
        nomorRuang: roomNumStr,
        namaRuang:
          existing.namaRuang && !/^Ruang\s+\d+$/i.test(existing.namaRuang)
            ? existing.namaRuang
            : `Ruang ${roomNumStr}`,
        kapasitas: maxCap,
        jumlahKolom: 6,
        jumlahBaris: Math.ceil(maxCap / 6),
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

    const totalRoomCapacity = rooms.reduce((acc, r) => acc + r.kapasitas, 0);
    if (pool.length > totalRoomCapacity) {
      warnings.push(
        `${sesiKey > 0 ? `Sesi ${sesiKey}: ` : ''}Jumlah peserta (${pool.length}) melebihi total kapasitas ${rooms.length} ruang (${totalRoomCapacity} kursi). Pertimbangkan menambah ruang atau memindahkan ke Ruang Cadangan.`
      );
    }

    const targetSizes = computeBalancedTargetSizes(
      pool.length,
      rooms.map((r) => r.kapasitas)
    );

    let roomAllocations: Student[][];
    if (config.metode === 'silang_jenjang_11_11' || !config.metode) {
      roomAllocations = allocateCrossJenjangBuckets(pool, targetSizes, rng);
    } else {
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
      } else {
        // silang_kelas
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
      }

      roomAllocations = rooms.map(() => []);
      let cursor = 0;
      for (let rIdx = 0; rIdx < rooms.length; rIdx++) {
        const count = targetSizes[rIdx] || 0;
        for (let k = 0; k < count && cursor < arranged.length; k++) {
          roomAllocations[rIdx].push(arranged[cursor++]);
        }
      }
      while (cursor < arranged.length) {
        roomAllocations[rooms.length - 1].push(arranged[cursor++]);
      }
    }

    // Re-interleave inside each room by jenjang so adjacent seats (1&2, 3&4, 5&6) differ in jenjang
    rooms.forEach((room, rIdx) => {
      const occupants = buildCrossJenjangQueue(roomAllocations[rIdx] || [], rng);
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
      if (occupants.length > 1 && distinctJenjang === 1 && pool.length > occupants.length) {
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

export interface OddRoomEntry {
  roomId: string;
  roomName: string;
  nomorRuang: string;
  sesi?: number;
  count: number;
  kapasitas: number;
  isReserveRoom: boolean;
  lastOddStudent?: Student;
}

export interface RoomParityAnalysis {
  oddEntries: OddRoomEntry[];
  nonReserveOddEntries: OddRoomEntry[];
  canAutoBalancePairs: Array<{ from: OddRoomEntry; to: OddRoomEntry }>;
  sameJenjangDeskConflicts: Array<{
    roomName: string;
    sesi?: number;
    mejaFisik: number;
    left: Student;
    right: Student;
    jenjang: string;
  }>;
  recommendReserveRoom: boolean;
  headline: string;
  suggestionText: string;
}

/**
 * Analyzes room seat parity under 1-Meja-2-Kursi rule and detects same-jenjang desk conflicts.
 */
export function analyzeRoomParity(
  students: Student[],
  rooms: ExamRoom[],
  moda: ModaUjian = 'kertas',
  jumlahSesi: number = 1
): RoomParityAnalysis {
  const activeStudents = students.filter((s) => s.status === 'Aktif' && Boolean(s.ruangId));
  const isOnline = moda === 'online';
  const sessionList = isOnline ? Array.from({ length: Math.max(1, jumlahSesi) }, (_, i) => i + 1) : [undefined];

  const oddEntries: OddRoomEntry[] = [];
  const sameJenjangDeskConflicts: RoomParityAnalysis['sameJenjangDeskConflicts'] = [];

  for (const room of rooms) {
    const isReserveRoom =
      room.id.startsWith('room-cadangan') || /cadangan/i.test(room.namaRuang);

    for (const sesiVal of sessionList) {
      const occupants = activeStudents
        .filter((s) => s.ruangId === room.id && (!isOnline || (s.sesi || 1) === sesiVal))
        .sort((a, b) => (a.nomorMeja || 999) - (b.nomorMeja || 999));

      if (occupants.length === 0) continue;

      if (occupants.length % 2 === 1) {
        oddEntries.push({
          roomId: room.id,
          roomName: room.namaRuang,
          nomorRuang: room.nomorRuang,
          sesi: sesiVal,
          count: occupants.length,
          kapasitas: room.kapasitas,
          isReserveRoom,
          lastOddStudent: occupants[occupants.length - 1],
        });
      }

      for (let i = 0; i + 1 < occupants.length; i += 2) {
        const left = occupants[i];
        const right = occupants[i + 1];
        const jLeft = left.jenjang || extractJenjang(left.kelas);
        const jRight = right.jenjang || extractJenjang(right.kelas);
        if (jLeft === jRight) {
          sameJenjangDeskConflicts.push({
            roomName: room.namaRuang,
            sesi: sesiVal,
            mejaFisik: Math.floor(i / 2) + 1,
            left,
            right,
            jenjang: jLeft,
          });
        }
      }
    }
  }

  const nonReserveOddEntries = oddEntries.filter((e) => !e.isReserveRoom);
  const canAutoBalancePairs: Array<{ from: OddRoomEntry; to: OddRoomEntry }> = [];

  for (const sesiVal of sessionList) {
    const pool = nonReserveOddEntries
      .filter((e) => e.sesi === sesiVal)
      .sort((a, b) => b.count - a.count);
    let leftIdx = 0;
    let rightIdx = pool.length - 1;
    while (leftIdx < rightIdx) {
      const receiver = pool[rightIdx];
      const donor = pool[leftIdx];
      if (receiver.count + 1 <= receiver.kapasitas && donor.count > 1) {
        canAutoBalancePairs.push({ from: donor, to: receiver });
        leftIdx++;
        rightIdx--;
      } else {
        rightIdx--;
      }
    }
  }

  const recommendReserveRoom = nonReserveOddEntries.length > 0;
  let headline = '';
  let suggestionText = '';

  if (nonReserveOddEntries.length > 0) {
    const roomLabels = nonReserveOddEntries
      .map((e) => `${e.roomName}${e.sesi ? ` Sesi ${e.sesi}` : ''} (${e.count} siswa)`)
      .join(', ');
    headline = `Terdeteksi ${nonReserveOddEntries.length} ruang berjumlah ganjil (1 meja tersisa 1 kursi kosong): ${roomLabels}.`;
    if (canAutoBalancePairs.length > 0) {
      const pair = canAutoBalancePairs[0];
      suggestionText = `Saran: Seimbangkan antar-ruang ganjil (${pair.from.roomName} → ${pair.to.roomName}) agar genap berpasangan 2 kursi/meja, ATAU pindahkan siswa kursi ganjil ke Ruang Cadangan.`;
    } else {
      suggestionText = `Saran: Tempatkan ${nonReserveOddEntries.length} siswa kursi ganjil tersebut ke Ruang Cadangan agar ruang reguler memiliki pasangan penuh (1 meja = 2 kursi berbeda jenjang) tanpa kursi kosong terpisah.`;
    }
  }

  return {
    oddEntries,
    nonReserveOddEntries,
    canAutoBalancePairs,
    sameJenjangDeskConflicts,
    recommendReserveRoom,
    headline,
    suggestionText,
  };
}

/**
 * Balances odd-count rooms pairwise by shifting 1 compatible student so adjacent desks stay cross-jenjang.
 */
export function balanceOddRooms(
  students: Student[],
  rooms: ExamRoom[],
  moda: ModaUjian = 'kertas',
  jumlahSesi: number = 1
): { updatedStudents: Student[]; movedCount: number } {
  const analysis = analyzeRoomParity(students, rooms, moda, jumlahSesi);
  if (analysis.canAutoBalancePairs.length === 0) {
    return { updatedStudents: students, movedCount: 0 };
  }

  const isOnline = moda === 'online';
  let working = [...students];
  let movedCount = 0;

  for (const { from, to } of analysis.canAutoBalancePairs) {
    const donorList = working.filter(
      (s) => s.status === 'Aktif' && s.ruangId === from.roomId && (!isOnline || (s.sesi || 1) === from.sesi)
    );
    const receiverList = working.filter(
      (s) => s.status === 'Aktif' && s.ruangId === to.roomId && (!isOnline || (s.sesi || 1) === to.sesi)
    );
    if (donorList.length === 0 || receiverList.length >= to.kapasitas) continue;

    // Pick a donor student whose jenjang differs from the receiver room's trailing odd student!
    const lastReceiverJen =
      receiverList[receiverList.length - 1]?.jenjang ||
      extractJenjang(receiverList[receiverList.length - 1]?.kelas || '');
    const candidate =
      donorList.find((s) => (s.jenjang || extractJenjang(s.kelas)) !== lastReceiverJen) ||
      donorList[donorList.length - 1];

    working = working.map((s) =>
      s.id === candidate.id ? { ...s, ruangId: to.roomId } : s
    );
    movedCount++;

    // Re-order cross-jenjang & renumber seats cleanly for both rooms
    [from.roomId, to.roomId].forEach((rId) => {
      const occ = buildCrossJenjangQueue(
        working.filter((s) => s.status === 'Aktif' && s.ruangId === rId && (!isOnline || (s.sesi || 1) === from.sesi))
      );
      const seatMap = new Map(occ.map((st, idx) => [st.id, idx + 1]));
      working = working.map((s) =>
        seatMap.has(s.id) ? { ...s, nomorMeja: seatMap.get(s.id) } : s
      );
    });
  }

  return { updatedStudents: working, movedCount };
}

/**
 * Moves the last odd-seat student from each non-reserve odd room into a dedicated "Ruang Cadangan",
 * ensuring regular exam rooms remain strictly even-numbered (full 2-seat desks).
 */
export function moveOddStudentsToReserveRoom(
  students: Student[],
  rooms: ExamRoom[],
  moda: ModaUjian = 'kertas',
  jumlahSesi: number = 1
): { updatedStudents: Student[]; updatedRooms: ExamRoom[]; movedCount: number } {
  const analysis = analyzeRoomParity(students, rooms, moda, jumlahSesi);
  const targets = analysis.nonReserveOddEntries;
  if (targets.length === 0) {
    return { updatedStudents: students, updatedRooms: rooms, movedCount: 0 };
  }

  const isOnline = moda === 'online';
  let reserveRoom = rooms.find(
    (r) => r.id.startsWith('room-cadangan') || /cadangan/i.test(r.namaRuang)
  );
  const nextRooms = [...rooms];
  if (!reserveRoom) {
    const nextNum = String(rooms.length + 1).padStart(2, '0');
    reserveRoom = {
      id: 'room-cadangan',
      nomorRuang: nextNum,
      namaRuang: 'Ruang Cadangan',
      kapasitas: Math.max(10, Math.min(22, targets.length + 4)),
      jumlahBaris: 4,
      jumlahKolom: 6,
      polaTempatDuduk: 'straight',
      posisiPintu: 'kiri_depan',
      posisiPengawas: 'depan_tengah',
      isLocked: false,
    };
    nextRooms.push(reserveRoom);
  }

  const moveIds = new Set<string>();
  targets.forEach((t) => {
    if (t.lastOddStudent) moveIds.add(t.lastOddStudent.id);
  });

  let working = students.map((s) =>
    moveIds.has(s.id) ? { ...s, ruangId: reserveRoom!.id } : s
  );

  // Renumber seats cleanly across all touched rooms + reserve room
  const touchedIds = new Set([...targets.map((t) => t.roomId), reserveRoom.id]);
  const sessionList = isOnline ? Array.from({ length: Math.max(1, jumlahSesi) }, (_, i) => i + 1) : [undefined];
  for (const rId of touchedIds) {
    for (const sVal of sessionList) {
      const occ = buildCrossJenjangQueue(
        working.filter((s) => s.status === 'Aktif' && s.ruangId === rId && (!isOnline || (s.sesi || 1) === sVal))
      );
      const seatMap = new Map(occ.map((st, idx) => [st.id, idx + 1]));
      working = working.map((s) =>
        seatMap.has(s.id) ? { ...s, nomorMeja: seatMap.get(s.id) } : s
      );
    }
  }

  return {
    updatedStudents: working,
    updatedRooms: nextRooms,
    movedCount: moveIds.size,
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
