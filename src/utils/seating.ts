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

export interface DeskPairSlot {
  left: Student;
  right?: Student;
}

/**
 * Builds physical desks (1 meja = 2 kursi) for a room's student pool.
 * Strictly pairs students from DIFFERENT jenjangs on every 2-seat desk.
 * If one jenjang outnumbers the others inside the room, each leftover student
 * is placed ALONE on a separate desk (right chair empty) rather than pairing
 * two students of the same jenjang on one desk.
 */
export function buildCrossJenjangDeskLayout(
  pool: Student[],
  rng: () => number = Math.random
): {
  desks: DeskPairSlot[];
  seatAssignments: Array<{ student: Student; nomorMeja: number }>;
  orderedStudents: Student[];
} {
  const byJenjang = new Map<string, Student[]>();
  for (const s of pool) {
    const jen = s.jenjang || extractJenjang(s.kelas);
    if (!byJenjang.has(jen)) byJenjang.set(jen, []);
    byJenjang.get(jen)!.push(s);
  }

  const keys = Array.from(byJenjang.keys()).sort((a, b) => compareClasses(a, b));
  for (const k of keys) {
    byJenjang.set(k, shuffleArray(byJenjang.get(k)!, rng));
  }

  const desks: DeskPairSlot[] = [];

  // 1. Pair 1:1 from the two largest remaining distinct jenjangs
  while (true) {
    const nonEmptyKeys = keys
      .filter((k) => (byJenjang.get(k)?.length || 0) > 0)
      .sort((a, b) => (byJenjang.get(b)?.length || 0) - (byJenjang.get(a)?.length || 0));

    if (nonEmptyKeys.length === 0) break;

    if (nonEmptyKeys.length === 1) {
      // Only 1 jenjang remains in this room -> give each leftover student a solo desk
      const leftovers = byJenjang.get(nonEmptyKeys[0]) || [];
      for (const st of leftovers) {
        desks.push({ left: st });
      }
      byJenjang.set(nonEmptyKeys[0], []);
      break;
    }

    const k1 = nonEmptyKeys[0];
    const k2 = nonEmptyKeys[1];
    const s1 = byJenjang.get(k1)!.shift()!;
    const s2 = byJenjang.get(k2)!.shift()!;
    desks.push({ left: s1, right: s2 });
  }

  const seatAssignments: Array<{ student: Student; nomorMeja: number }> = [];
  const orderedStudents: Student[] = [];
  desks.forEach((desk, deskIdx) => {
    const leftSeat = deskIdx * 2 + 1;
    seatAssignments.push({ student: desk.left, nomorMeja: leftSeat });
    orderedStudents.push(desk.left);
    if (desk.right) {
      seatAssignments.push({ student: desk.right, nomorMeja: leftSeat + 1 });
      orderedStudents.push(desk.right);
    }
  });

  return { desks, seatAssignments, orderedStudents };
}

/**
 * Legacy helper kept for linear queues
 */
function buildCrossJenjangQueue(pool: Student[], rng: () => number = Math.random): Student[] {
  return buildCrossJenjangDeskLayout(pool, rng).orderedStudents;
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
 * Also balances minority jenjang counts across rooms when needed so every room
 * contains 2 distinct jenjangs and minimizes extra solo desks (allowing up to 12 desks cleanly).
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

  const slotOrder = targetSizes
    .map((size, idx) => ({ size, idx }))
    .sort((a, b) => b.size - a.size || a.idx - b.idx);

  const buckets: Student[][] = targetSizes.map(() => []);

  const getAvailMap = () => {
    const m = new Map<string, number>();
    jenjangKeys.forEach((k) => m.set(k, byJenjang.get(k)?.length || 0));
    return m;
  };

  for (let slotPos = 0; slotPos < slotOrder.length; slotPos++) {
    const { size, idx: targetIdx } = slotOrder[slotPos];
    if (size <= 0) continue;

    const remainingRoomsAfter = slotOrder
      .slice(slotPos + 1)
      .filter((s) => s.size > 0).length;

    const avail = getAvailMap();
    const remTotal = Array.from(avail.values()).reduce((sum, v) => sum + v, 0);
    const nextTotal = Math.max(0, remTotal - size);
    const maxSafeAfter = Math.ceil(nextTotal / 2);

    const activeKeys = jenjangKeys.filter((k) => (avail.get(k) || 0) > 0);
    if (activeKeys.length === 0) break;

    let chosenTake: Map<string, number> | null = null;

    // 1. Try 2-jenjang split (preferred for lower rooms)
    // First prefer zero-solo-desk balanced split (<= ceil(size/2)), then allow slight solo imbalance
    // (e.g. 12:10 -> 12 desks) if that avoids leaving another room with single jenjang or >12 desks.
    if (activeKeys.length >= 2) {
      const halfCeil = Math.ceil(size / 2);
      let bestScore = Number.POSITIVE_INFINITY;

      for (let i = 0; i < activeKeys.length; i++) {
        for (let j = i + 1; j < activeKeys.length; j++) {
          const kA = activeKeys[i];
          const kB = activeKeys[j];
          const cA = avail.get(kA) || 0;
          const cB = avail.get(kB) || 0;
          if (cA + cB < size) continue;

          // If size >= 2, require at least 1 from both jenjangs in this 2-jenjang room
          const minA = Math.max(size >= 2 ? 1 : 0, size - cB);
          const maxA = Math.min(size >= 2 ? size - 1 : size, cA);
          if (minA > maxA) continue;

          for (let takeA = minA; takeA <= maxA; takeA++) {
            const takeB = size - takeA;
            if (takeB > cB) continue;

            // Count remaining students after taking (kA: takeA, kB: takeB)
            let maxRemAfter = 0;
            let activeAfterCount = 0;
            let nonMaxRemTotal = 0;
            for (const k of jenjangKeys) {
              const left = (avail.get(k) || 0) - (k === kA ? takeA : k === kB ? takeB : 0);
              if (left > 0) activeAfterCount++;
              if (left > maxRemAfter) maxRemAfter = left;
              nonMaxRemTotal += left;
            }
            nonMaxRemTotal -= maxRemAfter;

            // How many desks does this room need, and minimum possible in remaining rooms?
            const desksThisRoom = Math.max(takeA, takeB);
            const soloExcessThisRoom = Math.max(0, desksThisRoom - halfCeil);
            const invariantExcess = Math.max(0, maxRemAfter - maxSafeAfter);

            // Check whether remaining non-majority students are enough to give every future room at least 1 partner
            const starvedFutureRooms =
              remainingRoomsAfter > 0
                ? Math.max(0, remainingRoomsAfter - nonMaxRemTotal)
                : 0;

            // If a 3rd jenjang exists and using only 2 here forces single-jenjang or excessive desks later,
            // heavily penalize ONLY when other jenjangs can still balance cleanly.
            const needsMultiJenjangInstead =
              activeKeys.length >= 3 && invariantExcess > 0 ? 1 : 0;

            // Balanced split within <=12 desks preferred over greedy 11:11 that starves remaining rooms to 13+ desks
            const estMaxDesksAfter =
              remainingRoomsAfter > 0
                ? Math.ceil(maxRemAfter / remainingRoomsAfter)
                : 0;
            const peakDesks = Math.max(desksThisRoom, estMaxDesksAfter);

            const score =
              starvedFutureRooms * 100000 +
              (nextTotal > 1 && activeAfterCount < 2 ? 80000 : 0) +
              needsMultiJenjangInstead * 20000 +
              peakDesks * 5000 +
              invariantExcess * 500 +
              soloExcessThisRoom * 80 +
              Math.abs(takeA - takeB) * 5 -
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

      // If chosen 2-jenjang option STILL has invariantExcess > 0 AND >= 3 jenjangs exist,
      // let step 2 build a balanced 3-jenjang room instead (so 3-jenjang room handles surplus cleanly).
      if (chosenTake && activeKeys.length >= 3) {
        let maxRem = 0;
        let maxTaken = 0;
        for (const k of jenjangKeys) {
          const t = chosenTake.get(k) || 0;
          if (t > maxTaken) maxTaken = t;
          const left = (avail.get(k) || 0) - t;
          if (left > maxRem) maxRem = left;
        }
        if (maxRem > maxSafeAfter || maxTaken > halfCeil) {
          chosenTake = null;
        }
      }
    }

    // 2. Fallback: Mix >= 3 jenjangs (or proportional 2-jenjang) while keeping every room multi-jenjang
    if (!chosenTake) {
      const take = new Map<string, number>();
      let remainingNeed = size;
      const capPerGrade = Math.ceil(size / 2);

      // Helper to check if picking 1 from `k` would starve another future room from having >=2 jenjangs
      const wouldStarveOtherJenjang = (k: string): boolean => {
        if (remainingRoomsAfter === 0) return false;
        let otherLeftTotal = 0;
        for (const other of jenjangKeys) {
          if (other !== k) {
            otherLeftTotal += (avail.get(other) || 0) - (take.get(other) || 0);
          }
        }
        // Only forbid exhausting `k` completely if doing so leaves < remainingRoomsAfter across non-dominant grades
        const leftKAfter = (avail.get(k) || 0) - (take.get(k) || 0) - 1;
        return leftKAfter === 0 && otherLeftTotal < remainingRoomsAfter;
      };

      // Phase 2A: Try to give this room at least 2 distinct jenjangs first (1 each from top 2 abundant)
      const initialSorted = jenjangKeys
        .filter((k) => (avail.get(k) || 0) > 0)
        .sort((a, b) => (avail.get(b) || 0) - (avail.get(a) || 0));
      for (const k of initialSorted) {
        if (remainingNeed <= 0) break;
        if ((take.size < 2) && (avail.get(k) || 0) > (take.get(k) || 0)) {
          take.set(k, (take.get(k) || 0) + 1);
          remainingNeed--;
        }
      }

      // Phase 2B: Fill remaining seats up to capPerGrade, balancing remaining ratios
      while (remainingNeed > 0) {
        const candidates = jenjangKeys
          .filter((k) => {
            const left = (avail.get(k) || 0) - (take.get(k) || 0);
            const taken = take.get(k) || 0;
            return left > 0 && taken < capPerGrade;
          })
          .sort((a, b) => {
            const starveA = wouldStarveOtherJenjang(a) ? 1 : 0;
            const starveB = wouldStarveOtherJenjang(b) ? 1 : 0;
            if (starveA !== starveB) return starveA - starveB;
            const leftA = (avail.get(a) || 0) - (take.get(a) || 0);
            const leftB = (avail.get(b) || 0) - (take.get(b) || 0);
            return leftB - leftA;
          });

        if (candidates.length === 0) break;
        const pick = candidates[0];
        take.set(pick, (take.get(pick) || 0) + 1);
        remainingNeed--;
      }

      // Phase 2C: If still short (one dominant jenjang globally), pull from most abundant without starving minority
      while (remainingNeed > 0) {
        const candidates = jenjangKeys
          .filter((k) => (avail.get(k) || 0) - (take.get(k) || 0) > 0)
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

      chosenTake = take;
    }

    const roomStudents: Student[] = [];
    chosenTake.forEach((count, key) => {
      const list = byJenjang.get(key) || [];
      for (let i = 0; i < count; i++) {
        const st = list.shift();
        if (st) roomStudents.push(st);
      }
    });
    buckets[targetIdx] = roomStudents;
  }

  // Sort formed buckets:
  // 1) Pure 2-jenjang rooms first (Ruang 01, 02...)
  // 2) 3+ jenjang mixed rooms AT THE END of multi-jenjang rooms
  // 3) Unavoidable single-jenjang rooms (only if globally unavoidable)
  const nonEmptyBuckets = buckets.filter((b) => b.length > 0);
  const emptyCount = buckets.length - nonEmptyBuckets.length;

  nonEmptyBuckets.sort((a, b) => {
    const distinctA = new Set(a.map((s) => s.jenjang || extractJenjang(s.kelas))).size;
    const distinctB = new Set(b.map((s) => s.jenjang || extractJenjang(s.kelas))).size;
    const rank = (d: number) => (d === 2 ? 0 : d >= 3 ? 1 : 2);
    const rDiff = rank(distinctA) - rank(distinctB);
    if (rDiff !== 0) return rDiff;
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
  // Support up to 24 seats (12 meja × 2 kursi) cleanly
  const maxCap = Math.min(24, Math.max(1, config.kapasitasPerRuang || 22));
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
      const mejaAwal = existing.mejaAwal ?? Math.ceil(Math.min(22, maxCap) / 2);
      const kursiAwal = existing.kursiAwal ?? Math.min(22, maxCap);
      const mejaTambahan = existing.mejaTambahan ?? 0;
      const kursiTambahan = existing.kursiTambahan ?? 0;
      const totalKursi = kursiTambahan > 0 ? kursiAwal + kursiTambahan : maxCap;
      rooms.push({
        ...existing,
        nomorRuang: roomNumStr,
        namaRuang:
          existing.namaRuang && !/^Ruang\s+\d+$/i.test(existing.namaRuang)
            ? existing.namaRuang
            : `Ruang ${roomNumStr}`,
        kapasitas: totalKursi,
        mejaAwal,
        kursiAwal,
        mejaTambahan,
        kursiTambahan,
        statusFasilitas: mejaTambahan > 0 || kursiTambahan > 0 ? 'INSIDENTAL' : (existing.statusFasilitas || 'NORMAL'),
        jarakAntarMeja: existing.jarakAntarMeja || 'standar',
        jumlahKolom: 6,
        jumlahBaris: Math.ceil(totalKursi / 6),
        incidentalSeatNo: undefined,
      });
    } else {
      const mejaAwal = Math.ceil(Math.min(22, maxCap) / 2);
      const kursiAwal = maxCap;
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
        mejaAwal,
        kursiAwal,
        mejaTambahan: 0,
        kursiTambahan: 0,
        statusFasilitas: 'NORMAL',
        keteranganFasilitas: '',
        jarakAntarMeja: 'standar',
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
        `${sesiKey > 0 ? `Sesi ${sesiKey}: ` : ''}Jumlah peserta (${pool.length}) melebihi total kapasitas fasilitas ${rooms.length} ruang (${totalRoomCapacity} kursi). Tambahkan meja/kursi pada menu Manajemen Meja dan Kursi atau sesuaikan jumlah ruang.`
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

    // Arrange physical desks per room: every 2-seat desk holds 2 DIFFERENT jenjangs;
    // any unpaired surplus student sits ALONE on a dedicated desk (e.g. #23 Tempat Duduk Tambahan).
    rooms.forEach((room, rIdx) => {
      const roomPool = roomAllocations[rIdx] || [];
      const { desks, seatAssignments } = buildCrossJenjangDeskLayout(roomPool, rng);
      const jenjangCounts: Record<string, number> = {};

      seatAssignments.forEach(({ student: st, nomorMeja }) => {
        assignedRoomMap.set(st.id, { ruangId: room.id, nomorMeja });
        const jen = st.jenjang || extractJenjang(st.kelas);
        jenjangCounts[jen] = (jenjangCounts[jen] || 0) + 1;
      });

      if (roomPool.length === 23) {
        const lastSolo = seatAssignments.find((a) => a.nomorMeja >= 23) || seatAssignments[seatAssignments.length - 1];
        if (lastSolo) {
          room.incidentalSeatNo = lastSolo.nomorMeja;
        }
      }

      const physicalSeatSpan = desks.length * 2;
      if (physicalSeatSpan > room.kapasitas && roomPool.length <= 24 && desks.length <= 12) {
        room.jumlahBaris = Math.max(room.jumlahBaris, Math.ceil(physicalSeatSpan / 6));
      }
      if (roomPool.length > room.kapasitas) {
        warnings.push(
          `${room.namaRuang}${sesiKey > 0 ? ` (Sesi ${sesiKey})` : ''}: Terisi ${roomPool.length} peserta sedangkan kursi tersedia ${room.kapasitas}. Tambahkan meja & kursi di Manajemen Meja dan Kursi.`
        );
      }
      const distinctJenjang = Object.keys(jenjangCounts).length;
      const globalDistinctJenjang = new Set(
        pool.map((s) => s.jenjang || extractJenjang(s.kelas))
      ).size;
      if (roomPool.length > 1 && distinctJenjang === 1 && globalDistinctJenjang >= 2) {
        warnings.push(
          `${room.namaRuang}${sesiKey > 0 ? ` (Sesi ${sesiKey})` : ''}: Seluruh peserta berasal dari 1 jenjang (${Object.keys(jenjangCounts)[0]}).`
        );
      }

      summary.push({
        roomId: room.id,
        nomorRuang: room.nomorRuang,
        sesi: sesiKey > 0 ? sesiKey : undefined,
        total: roomPool.length,
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

export interface RoomFacilityTotals {
  mejaAwal: number;
  kursiAwal: number;
  mejaTambahan: number;
  kursiTambahan: number;
  totalMeja: number;
  totalKursi: number;
  statusFasilitas: 'NORMAL' | 'INSIDENTAL';
}

export function getRoomFacilityTotals(room: ExamRoom): RoomFacilityTotals {
  const kursiAwal = room.kursiAwal ?? Math.min(22, Math.max(1, room.kapasitas || 22));
  const mejaAwal = room.mejaAwal ?? Math.ceil(kursiAwal / 2);
  const mejaTambahan = Math.max(0, room.mejaTambahan ?? Math.max(0, Math.ceil((room.kapasitas || 22) / 2) - mejaAwal));
  const kursiTambahan = Math.max(0, room.kursiTambahan ?? Math.max(0, (room.kapasitas || 22) - kursiAwal));
  const statusFasilitas: 'NORMAL' | 'INSIDENTAL' =
    mejaTambahan > 0 || kursiTambahan > 0 ? 'INSIDENTAL' : (room.statusFasilitas || 'NORMAL');
  return {
    mejaAwal,
    kursiAwal,
    mejaTambahan,
    kursiTambahan,
    totalMeja: mejaAwal + mejaTambahan,
    totalKursi: kursiAwal + kursiTambahan,
    statusFasilitas,
  };
}

export function normalizeRoomFacilities(
  room: ExamRoom,
  overrides: Partial<Pick<ExamRoom, 'mejaAwal' | 'kursiAwal' | 'mejaTambahan' | 'kursiTambahan' | 'keteranganFasilitas' | 'statusFasilitas' | 'jarakAntarMeja'>>
): ExamRoom {
  const base = getRoomFacilityTotals(room);
  const mejaAwal = Math.max(1, overrides.mejaAwal ?? base.mejaAwal);
  const kursiAwal = Math.max(1, overrides.kursiAwal ?? base.kursiAwal);
  const mejaTambahan = Math.max(0, overrides.mejaTambahan ?? base.mejaTambahan);
  const kursiTambahan = Math.max(0, overrides.kursiTambahan ?? base.kursiTambahan);
  const totalKursi = kursiAwal + kursiTambahan;
  const totalMeja = mejaAwal + mejaTambahan;
  const computedStatus: 'NORMAL' | 'INSIDENTAL' =
    overrides.statusFasilitas || (mejaTambahan > 0 || kursiTambahan > 0 ? 'INSIDENTAL' : 'NORMAL');

  return {
    ...room,
    mejaAwal,
    kursiAwal,
    mejaTambahan,
    kursiTambahan,
    statusFasilitas: computedStatus,
    keteranganFasilitas:
      overrides.keteranganFasilitas !== undefined
        ? overrides.keteranganFasilitas
        : room.keteranganFasilitas || '',
    jarakAntarMeja: overrides.jarakAntarMeja ?? room.jarakAntarMeja ?? 'standar',
    kapasitas: totalKursi,
    jumlahKolom: 6,
    jumlahBaris: Math.max(room.jumlahBaris || 4, Math.ceil((totalMeja * 2) / 6)),
  };
}

export interface ValidationCheckItem {
  code:
    | 'no_reserve_room'
    | 'no_missing_students'
    | 'no_duplicate_students'
    | 'cross_jenjang_desks'
    | 'incidental_capacity'
    | 'incidental_23_solo_seat'
    | 'facility_sufficiency'
    | 'no_seat_collision'
    | 'multi_jenjang_rooms';
  label: string;
  passed: boolean;
  severity: 'error' | 'warning';
  detail: string;
  affectedRoomIds?: string[];
}

export interface RoomValidationMetric {
  roomId: string;
  roomName: string;
  sesi?: number;
  studentCount: number;
  desksUsed: number;
  pairedDesks: number;
  soloDesks: number;
  sameJenjangConflicts: number;
  seatCollisions: number;
  facilities: RoomFacilityTotals;
  jenjangCounts: Record<string, number>;
  incidentalSeatNo?: number;
}

export interface RoomDistributionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  checks: ValidationCheckItem[];
  roomMetrics: RoomValidationMetric[];
}

/**
 * Full 9-point Automatic Validation before saving generated/edited room allocations.
 */
export function validateRoomDistribution(
  students: Student[],
  rooms: ExamRoom[],
  moda: ModaUjian = 'kertas',
  jumlahSesi: number = 1
): RoomDistributionValidationResult {
  const activeStudents = students.filter((s) => s.status === 'Aktif');
  const isOnline = moda === 'online';
  const sessionList = isOnline
    ? Array.from({ length: Math.max(1, jumlahSesi) }, (_, i) => i + 1)
    : [undefined];

  const roomIdsSet = new Set(rooms.map((r) => r.id));
  const reserveRooms = rooms.filter(
    (r) => r.id.startsWith('room-cadangan') || /cadangan/i.test(r.namaRuang)
  );

  // Missing & duplicate checks
  const unassigned = activeStudents.filter((s) => !s.ruangId || !roomIdsSet.has(s.ruangId) || !s.nomorMeja);
  const seenIds = new Set<string>();
  const duplicateIds: string[] = [];
  for (const s of activeStudents) {
    if (seenIds.has(s.id)) duplicateIds.push(s.nama);
    seenIds.add(s.id);
  }

  const roomMetrics: RoomValidationMetric[] = [];
  const sameJenjangMsgs: string[] = [];
  const over23Msgs: string[] = [];
  const facilityShortageMsgs: string[] = [];
  const facilityShortageRoomIds = new Set<string>();
  const incidental23ViolationMsgs: string[] = [];
  const collisionMsgs: string[] = [];
  const singleJenjangMsgs: string[] = [];

  const globalJenjangSet = new Set(
    activeStudents.map((s) => s.jenjang || extractJenjang(s.kelas))
  );

  for (const room of rooms) {
    const facilities = getRoomFacilityTotals(room);
    for (const sesiVal of sessionList) {
      const occupants = activeStudents.filter(
        (s) => s.ruangId === room.id && (!isOnline || (s.sesi || 1) === sesiVal)
      );
      if (occupants.length === 0) continue;

      const sesiTag = sesiVal ? ` Sesi ${sesiVal}` : '';
      const seatCounts = new Map<number, Student[]>();
      const byDesk = new Map<number, Student[]>();
      const jenjangCounts: Record<string, number> = {};

      occupants.forEach((st) => {
        const j = st.jenjang || extractJenjang(st.kelas);
        jenjangCounts[j] = (jenjangCounts[j] || 0) + 1;
        const seatNo = st.nomorMeja || 0;
        if (seatNo > 0) {
          if (!seatCounts.has(seatNo)) seatCounts.set(seatNo, []);
          seatCounts.get(seatNo)!.push(st);
          const deskNo = Math.ceil(seatNo / 2);
          if (!byDesk.has(deskNo)) byDesk.set(deskNo, []);
          byDesk.get(deskNo)!.push(st);
        }
      });

      let seatCollisions = 0;
      seatCounts.forEach((arr, seatNo) => {
        if (arr.length > 1) {
          seatCollisions++;
          collisionMsgs.push(`${room.namaRuang}${sesiTag}: Kursi #${seatNo} ditempati ganda oleh ${arr.map((a) => a.nama).join(' & ')}.`);
        }
      });

      let sameJenjangConflicts = 0;
      let pairedDesks = 0;
      let soloDesks = 0;
      let incidentalSeatNo: number | undefined = room.incidentalSeatNo;

      byDesk.forEach((deskStudents, deskNo) => {
        if (deskStudents.length === 1) {
          soloDesks++;
          if (occupants.length === 23 && !incidentalSeatNo) {
            incidentalSeatNo = deskStudents[0].nomorMeja;
          }
        } else if (deskStudents.length === 2) {
          pairedDesks++;
          const j1 = deskStudents[0].jenjang || extractJenjang(deskStudents[0].kelas);
          const j2 = deskStudents[1].jenjang || extractJenjang(deskStudents[1].kelas);
          if (j1 === j2) {
            sameJenjangConflicts++;
            sameJenjangMsgs.push(
              `${room.namaRuang}${sesiTag} Meja ${deskNo}: Pasangan ${deskStudents[0].nama} (${j1}) & ${deskStudents[1].nama} (${j2}) berasal dari jenjang yang sama.`
            );
          }
        } else if (deskStudents.length > 2) {
          seatCollisions++;
          collisionMsgs.push(`${room.namaRuang}${sesiTag} Meja ${deskNo}: Meja ditempati lebih dari 2 siswa.`);
        }
      });

      const maxDeskUsed = Math.max(byDesk.size, ...Array.from(byDesk.keys()), 0);
      const desksUsed = Math.max(byDesk.size, maxDeskUsed);

      if (occupants.length > 23) {
        over23Msgs.push(
          `${room.namaRuang}${sesiTag}: Terisi ${occupants.length} siswa, melebihi batas insidental maksimal 23 siswa per ruang.`
        );
      }

      if (occupants.length === 23) {
        if (soloDesks < 1 || sameJenjangConflicts > 0 || pairedDesks < 11) {
          incidental23ViolationMsgs.push(
            `${room.namaRuang}${sesiTag}: Kondisi 23 siswa harus terdiri dari 11 meja berpasangan lintas jenjang + 1 siswa duduk sendiri di meja tambahan.`
          );
        }
      }

      if (occupants.length > facilities.totalKursi || desksUsed > facilities.totalMeja) {
        facilityShortageRoomIds.add(room.id);
        facilityShortageMsgs.push(
          `${room.namaRuang}${sesiTag}: Membutuhkan ${desksUsed} meja & ${occupants.length} kursi, namun fasilitas saat ini ${facilities.totalMeja} meja & ${facilities.totalKursi} kursi. Tambahkan melalui Manajemen Meja dan Kursi.`
        );
      }

      if (occupants.length >= 2 && Object.keys(jenjangCounts).length < 2 && globalJenjangSet.size >= 2) {
        singleJenjangMsgs.push(
          `${room.namaRuang}${sesiTag}: Hanya berisi 1 jenjang (${Object.keys(jenjangCounts)[0]}).`
        );
      }

      roomMetrics.push({
        roomId: room.id,
        roomName: room.namaRuang,
        sesi: sesiVal,
        studentCount: occupants.length,
        desksUsed,
        pairedDesks,
        soloDesks,
        sameJenjangConflicts,
        seatCollisions,
        facilities,
        jenjangCounts,
        incidentalSeatNo,
      });
    }
  }

  const checks: ValidationCheckItem[] = [
    {
      code: 'no_reserve_room',
      label: 'Tidak ada ruang cadangan',
      passed: reserveRooms.length === 0,
      severity: 'error',
      detail:
        reserveRooms.length === 0
          ? 'Seluruh alokasi menggunakan ruang ujian reguler yang tersedia.'
          : `Ditemukan ruang cadangan (${reserveRooms.map((r) => r.namaRuang).join(', ')}). Hapus ruang cadangan sesuai ketentuan.`,
    },
    {
      code: 'no_missing_students',
      label: 'Seluruh siswa aktif mendapatkan tempat duduk',
      passed: unassigned.length === 0,
      severity: 'error',
      detail:
        unassigned.length === 0
          ? `${activeStudents.length} dari ${activeStudents.length} siswa aktif teralokasi lengkap.`
          : `${unassigned.length} siswa aktif belum memiliki ruang/nomor kursi (${unassigned.slice(0, 3).map((s) => s.nama).join(', ')}).`,
    },
    {
      code: 'no_duplicate_students',
      label: 'Tidak ada siswa terduplikasi',
      passed: duplicateIds.length === 0,
      severity: 'error',
      detail:
        duplicateIds.length === 0
          ? 'Setiap siswa hanya menempati tepat 1 kursi.'
          : `Ditemukan duplikasi data siswa: ${duplicateIds.join(', ')}.`,
    },
    {
      code: 'cross_jenjang_desks',
      label: 'Setiap meja berpasangan berisi 2 jenjang berbeda',
      passed: sameJenjangMsgs.length === 0,
      severity: 'error',
      detail:
        sameJenjangMsgs.length === 0
          ? '0 pasangan meja dari jenjang yang sama (aturan wajib terpenuhi).'
          : sameJenjangMsgs.join(' | '),
    },
    {
      code: 'incidental_capacity',
      label: 'Kapasitas ideal ≤ 22 siswa / insidental maks 23 siswa',
      passed: over23Msgs.length === 0,
      severity: 'error',
      detail:
        over23Msgs.length === 0
          ? 'Semua ruang berada dalam batas kapasitas ideal (22) atau insidental (23).'
          : over23Msgs.join(' | '),
    },
    {
      code: 'incidental_23_solo_seat',
      label: 'Siswa ke-23 duduk sendiri di tempat duduk tambahan',
      passed: incidental23ViolationMsgs.length === 0,
      severity: 'error',
      detail:
        incidental23ViolationMsgs.length === 0
          ? roomMetrics.some((m) => m.studentCount === 23)
            ? 'Ruang berkapasitas insidental 23 telah menempatkan siswa ke-23 di meja tambahan secara mandiri.'
            : 'Tidak ada ruang insidental 23 atau seluruh meja tambahan valid.'
          : incidental23ViolationMsgs.join(' | '),
    },
    {
      code: 'facility_sufficiency',
      label: 'Meja & kursi mencukupi kebutuhan ruang',
      passed: facilityShortageMsgs.length === 0,
      severity: 'error',
      detail:
        facilityShortageMsgs.length === 0
          ? 'Jumlah meja dan kursi awal/tambahan pada seluruh ruang mencukupi.'
          : facilityShortageMsgs.join(' | '),
      affectedRoomIds: Array.from(facilityShortageRoomIds),
    },
    {
      code: 'no_seat_collision',
      label: 'Tidak ada bentrok posisi meja dan kursi',
      passed: collisionMsgs.length === 0,
      severity: 'error',
      detail:
        collisionMsgs.length === 0
          ? 'Semua nomor kursi dan pasangan meja unik tanpa bentrok.'
          : collisionMsgs.join(' | '),
    },
    {
      code: 'multi_jenjang_rooms',
      label: 'Komposisi dua jenjang berbeda tiap ruang',
      passed: singleJenjangMsgs.length === 0,
      severity: 'warning',
      detail:
        singleJenjangMsgs.length === 0
          ? 'Setiap ruang berisi minimal 2 jenjang berbeda.'
          : `${singleJenjangMsgs.join(' | ')} (Periksa keseimbangan jumlah siswa per jenjang di DNPU).`,
    },
  ];

  const errors = checks.filter((c) => !c.passed && c.severity === 'error').map((c) => c.detail);
  const warnings = checks.filter((c) => !c.passed && c.severity === 'warning').map((c) => c.detail);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    checks,
    roomMetrics,
  };
}

/**
 * Generates a non-destructive preview of Room Distribution & validates all rules BEFORE saving.
 */
export function previewRoomDistribution(
  students: Student[],
  existingRooms: ExamRoom[],
  config: RoomDistributionConfig,
  moda: ModaUjian = 'kertas',
  jumlahSesi: number = 1,
  rng: () => number = Math.random,
  options?: { examJumlahRuang?: number }
): {
  distribution: RoomDistributionResult;
  validation: RoomDistributionValidationResult;
} {
  const clonedRooms = existingRooms.map((r) => ({ ...r }));
  const clonedStudents = students.map((s) => ({ ...s }));
  const distribution = distributeRoomsCrossJenjang(
    clonedStudents,
    clonedRooms,
    config,
    moda,
    rng,
    options
  );
  const validation = validateRoomDistribution(
    distribution.updatedStudents,
    distribution.updatedRooms,
    moda,
    jumlahSesi
  );
  return { distribution, validation };
}

/**
 * Validates moving or swapping a student in Edit Denah without ever allowing same-jenjang desk mates.
 */
export function validateManualSeatMove(
  roomStudents: Student[],
  movingStudent: Student,
  targetSeatNo: number,
  targetRoom: ExamRoom,
  swappedWithStudent?: Student
): { ok: boolean; error?: string } {
  const facilities = getRoomFacilityTotals(targetRoom);
  const targetDeskNo = Math.ceil(targetSeatNo / 2);

  if (targetSeatNo < 1 || targetSeatNo > Math.max(24, facilities.totalMeja * 2)) {
    return {
      ok: false,
      error: `Nomor kursi #${targetSeatNo} di luar rentang fasilitas ${targetRoom.namaRuang}.`,
    };
  }
  if (!swappedWithStudent) {
    if (roomStudents.length + 1 > 23) {
      return {
        ok: false,
        error: `${targetRoom.namaRuang} sudah mencapai kapasitas insidental maksimal 23 siswa.`,
      };
    }
    if (roomStudents.length + 1 > facilities.totalKursi || targetDeskNo > facilities.totalMeja) {
      return {
        ok: false,
        error: `Kursi/Meja tambahan belum tersedia di ${targetRoom.namaRuang} (${facilities.totalMeja} meja, ${facilities.totalKursi} kursi). Tambahkan terlebih dahulu di Manajemen Meja dan Kursi.`,
      };
    }
  } else if (targetDeskNo > facilities.totalMeja) {
    return {
      ok: false,
      error: `Meja ${targetDeskNo} melebihi jumlah meja tersedia (${facilities.totalMeja}) di ${targetRoom.namaRuang}.`,
    };
  }

  // Enforce absolute rule: two students of the same jenjang CANNOT sit on the same physical desk
  const partnerSeatNo = targetSeatNo % 2 === 1 ? targetSeatNo + 1 : targetSeatNo - 1;
  const partner = roomStudents.find(
    (s) =>
      s.nomorMeja === partnerSeatNo &&
      s.id !== movingStudent.id &&
      s.id !== swappedWithStudent?.id
  );
  if (partner) {
    const movingJen = movingStudent.jenjang || extractJenjang(movingStudent.kelas);
    const partnerJen = partner.jenjang || extractJenjang(partner.kelas);
    if (movingJen === partnerJen) {
      return {
        ok: false,
        error: `Pelanggaran Aturan Meja: ${movingStudent.nama} (${movingStudent.kelas}) tidak boleh dipasangkan di Meja ${String(targetDeskNo).padStart(2, '0')} bersama ${partner.nama} (${partner.kelas}) karena berasal dari jenjang yang sama (${movingJen}).`,
      };
    }
  }

  // If swapping two students inside the same room, also validate the partner at movingStudent's old desk
  if (swappedWithStudent && movingStudent.ruangId === swappedWithStudent.ruangId && movingStudent.nomorMeja) {
    const oldSeatNo = movingStudent.nomorMeja;
    const oldDeskNo = Math.ceil(oldSeatNo / 2);
    // If both swapped students aren't already partners at the same desk:
    if (oldDeskNo !== targetDeskNo) {
      const oldPartnerSeat = oldSeatNo % 2 === 1 ? oldSeatNo + 1 : oldSeatNo - 1;
      const oldPartner = roomStudents.find(
        (s) =>
          s.nomorMeja === oldPartnerSeat &&
          s.id !== movingStudent.id &&
          s.id !== swappedWithStudent.id
      );
      if (oldPartner) {
        const swapJen = swappedWithStudent.jenjang || extractJenjang(swappedWithStudent.kelas);
        const oldPartnerJen = oldPartner.jenjang || extractJenjang(oldPartner.kelas);
        if (swapJen === oldPartnerJen) {
          return {
            ok: false,
            error: `Pelanggaran Aturan Meja: Pertukaran akan menempatkan ${swappedWithStudent.nama} (${swappedWithStudent.kelas}) bersama ${oldPartner.nama} (${oldPartner.kelas}) pada jenjang yang sama (${swapJen}) di Meja ${String(oldDeskNo).padStart(2, '0')}.`,
          };
        }
      }
    }
  }

  return { ok: true };
}

/**
 * Moves or swaps a student onto targetSeatNo in targetRoomId while strictly enforcing cross-jenjang desk pairing.
 */
export function moveOrSwapStudentSeat(
  students: Student[],
  rooms: ExamRoom[],
  studentId: string,
  targetRoomId: string,
  targetSeatNo: number,
  isOnline: boolean,
  targetSesi?: number
): { ok: boolean; error?: string; updatedStudents: Student[] } {
  const moving = students.find((s) => s.id === studentId);
  const targetRoom = rooms.find((r) => r.id === targetRoomId);
  if (!moving || !targetRoom) {
    return { ok: false, error: 'Peserta atau ruang tujuan tidak ditemukan.', updatedStudents: students };
  }

  const effectiveSesi = isOnline ? (targetSesi || moving.sesi || 1) : undefined;
  const targetRoomOccupants = students.filter(
    (s) =>
      s.status === 'Aktif' &&
      s.ruangId === targetRoomId &&
      (!isOnline || (s.sesi || 1) === effectiveSesi)
  );
  const occupantAtTarget = targetRoomOccupants.find(
    (s) => s.nomorMeja === targetSeatNo && s.id !== moving.id
  );

  const check = validateManualSeatMove(
    targetRoomOccupants,
    moving,
    targetSeatNo,
    targetRoom,
    occupantAtTarget
  );
  if (!check.ok) {
    return { ok: false, error: check.error, updatedStudents: students };
  }

  const oldRoomId = moving.ruangId;
  const oldSeatNo = moving.nomorMeja;
  const oldSesi = moving.sesi;

  const updatedStudents = students.map((s) => {
    if (s.id === moving.id) {
      return {
        ...s,
        ruangId: targetRoomId,
        nomorMeja: targetSeatNo,
        sesi: isOnline ? effectiveSesi : s.sesi,
      };
    }
    if (occupantAtTarget && s.id === occupantAtTarget.id) {
      return {
        ...s,
        ruangId: oldRoomId,
        nomorMeja: oldSeatNo,
        sesi: isOnline ? oldSesi : s.sesi,
      };
    }
    return s;
  });

  return { ok: true, updatedStudents };
}

/**
 * Swaps two physical desks (both left and right seats together) inside a room.
 */
export function swapPhysicalDesksInRoom(
  students: Student[],
  roomId: string,
  deskA: number,
  deskB: number,
  isOnline: boolean,
  sesi?: number
): Student[] {
  if (deskA === deskB || deskA < 1 || deskB < 1) return students;
  const aLeft = deskA * 2 - 1;
  const aRight = deskA * 2;
  const bLeft = deskB * 2 - 1;
  const bRight = deskB * 2;

  return students.map((s) => {
    if (s.status !== 'Aktif' || s.ruangId !== roomId) return s;
    if (isOnline && sesi && (s.sesi || 1) !== sesi) return s;
    if (s.nomorMeja === aLeft) return { ...s, nomorMeja: bLeft };
    if (s.nomorMeja === aRight) return { ...s, nomorMeja: bRight };
    if (s.nomorMeja === bLeft) return { ...s, nomorMeja: aLeft };
    if (s.nomorMeja === bRight) return { ...s, nomorMeja: aRight };
    return s;
  });
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
  soloDeskEntries: Array<{
    roomName: string;
    sesi?: number;
    mejaFisik: number;
    student: Student;
  }>;
  recommendReserveRoom: boolean;
  headline: string;
  suggestionText: string;
}

/**
 * Analyzes room seat parity under 1-Meja-2-Kursi rule and detects actual physical desk sharing
 * (grouping strictly by physical desk Math.ceil(nomorMeja / 2) so solo desks are never flagged as conflicts).
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
  const soloDeskEntries: RoomParityAnalysis['soloDeskEntries'] = [];

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

      // Group occupants by physical desk (1 meja = 2 kursi: 1&2 -> meja 1, 3&4 -> meja 2, etc.)
      const byDesk = new Map<number, Student[]>();
      occupants.forEach((st, idx) => {
        const seatNo = st.nomorMeja || idx + 1;
        const mejaNo = Math.ceil(seatNo / 2);
        if (!byDesk.has(mejaNo)) byDesk.set(mejaNo, []);
        byDesk.get(mejaNo)!.push(st);
      });

      const sortedDesks = Array.from(byDesk.keys()).sort((a, b) => a - b);
      for (const mejaFisik of sortedDesks) {
        const deskStudents = byDesk.get(mejaFisik)!;
        if (deskStudents.length === 1) {
          soloDeskEntries.push({
            roomName: room.namaRuang,
            sesi: sesiVal,
            mejaFisik,
            student: deskStudents[0],
          });
        } else if (deskStudents.length >= 2) {
          const left = deskStudents[0];
          const right = deskStudents[1];
          const jLeft = left.jenjang || extractJenjang(left.kelas);
          const jRight = right.jenjang || extractJenjang(right.kelas);
          if (jLeft === jRight) {
            sameJenjangDeskConflicts.push({
              roomName: room.namaRuang,
              sesi: sesiVal,
              mejaFisik,
              left,
              right,
              jenjang: jLeft,
            });
          }
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
    soloDeskEntries,
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

    // Re-order cross-jenjang desks & renumber seats cleanly for both rooms (never pairing same jenjang)
    [from.roomId, to.roomId].forEach((rId) => {
      const { seatAssignments } = buildCrossJenjangDeskLayout(
        working.filter((s) => s.status === 'Aktif' && s.ruangId === rId && (!isOnline || (s.sesi || 1) === from.sesi))
      );
      const seatMap = new Map(seatAssignments.map((a) => [a.student.id, a.nomorMeja]));
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
      kapasitas: Math.max(10, Math.min(24, targets.length + 4)),
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

  // Renumber desks cleanly across all touched rooms + reserve room
  const touchedIds = new Set([...targets.map((t) => t.roomId), reserveRoom.id]);
  const sessionList = isOnline ? Array.from({ length: Math.max(1, jumlahSesi) }, (_, i) => i + 1) : [undefined];
  for (const rId of touchedIds) {
    for (const sVal of sessionList) {
      const { seatAssignments } = buildCrossJenjangDeskLayout(
        working.filter((s) => s.status === 'Aktif' && s.ruangId === rId && (!isOnline || (s.sesi || 1) === sVal))
      );
      const seatMap = new Map(seatAssignments.map((a) => [a.student.id, a.nomorMeja]));
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
