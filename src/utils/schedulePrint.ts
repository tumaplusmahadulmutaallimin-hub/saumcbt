import {
  ExamConfig,
  ExamRoom,
  ExamSchedule,
  ExamSubject,
  Supervisor,
  SupervisorAssignment,
} from '../types';
import { extractJenjang } from './dnpu';
import { formatPersonNameAndTitle } from './formatName';
import { formatDayAndDate } from './qrBarcode';

export type SchedulePrintVersion = 'lengkap' | 'siswa';

export interface SupervisorDirectoryEntry {
  supervisor: Supervisor;
  kode: string;
  formattedName: string;
}

export interface RoomSupervisorDisplay {
  roomLabel: string;
  codes: string[];
  names: string[];
}

export interface SchedulePrintRow {
  no: number;
  schedule: ExamSchedule;
  dayDisplay: string;
  timeDisplay: string;
  sesiDisplay: string;
  uniformEntries: Array<{ jenjang: string; seragam: string }>;
  classSubjects: Array<{ kelas: string; subject?: ExamSubject }>;
  singleSubject?: ExamSubject;
  roomSupervisors: RoomSupervisorDisplay[];
  kodePengawasSummary: string;
  daftarPengawasSummary: string[];
  // Row-span metadata: >0 renders the <td> with that rowSpan, 0 skips the cell (merged into above row)
  dayRowSpan: number;
  timeRowSpan: number;
  sesiRowSpan: number;
  seragamRowSpan: number;
}

export function buildSupervisorDirectory(supervisors: Supervisor[]): {
  entries: SupervisorDirectoryEntry[];
  byId: Map<string, SupervisorDirectoryEntry>;
} {
  const entries: SupervisorDirectoryEntry[] = supervisors.map((sup, idx) => ({
    supervisor: sup,
    kode: String(idx + 1).padStart(2, '0'),
    formattedName: formatPersonNameAndTitle(sup.nama) || sup.nama,
  }));
  const byId = new Map(entries.map((entry) => [entry.supervisor.id, entry]));
  return { entries, byId };
}

function computeContiguousRowSpans<T>(items: T[], getKey: (item: T) => string): number[] {
  const spans = new Array<number>(items.length).fill(0);
  let start = 0;
  while (start < items.length) {
    const startKey = getKey(items[start]);
    let end = start + 1;
    while (end < items.length && getKey(items[end]) === startKey) {
      end++;
    }
    spans[start] = end - start;
    start = end;
  }
  return spans;
}

export function buildSchedulePrintModel(params: {
  schedules: ExamSchedule[];
  subjects: ExamSubject[];
  rooms: ExamRoom[];
  supervisors?: Supervisor[];
  supervisorAssignments?: SupervisorAssignment[];
  examConfig?: ExamConfig;
}): {
  classes: string[];
  jenjangList: string[];
  rows: SchedulePrintRow[];
  supervisorDirectory: SupervisorDirectoryEntry[];
} {
  const {
    schedules,
    subjects,
    rooms,
    supervisors = [],
    supervisorAssignments = [],
    examConfig,
  } = params;

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const roomMap = new Map(rooms.map((r) => [r.id, r]));
  const { entries: supervisorDirectory, byId: supervisorDirMap } =
    buildSupervisorDirectory(supervisors);

  const sortedSchedules = [...schedules].sort((a, b) => {
    const d = a.tanggal.localeCompare(b.tanggal);
    if (d !== 0) return d;
    const t = a.waktuMulai.localeCompare(b.waktuMulai);
    if (t !== 0) return t;
    if ((a.sesi || 1) !== (b.sesi || 1)) return (a.sesi || 1) - (b.sesi || 1);
    return (a.jamKe || 1) - (b.jamKe || 1);
  });

  const derivedClassesFromSchedules = Array.from(
    new Set(schedules.flatMap((s) => Object.keys(s.mapelPerKelas || {})))
  );
  const classes =
    examConfig?.registeredClasses && examConfig.registeredClasses.length > 0
      ? examConfig.registeredClasses
      : derivedClassesFromSchedules;

  const jenjangList = Array.from(new Set(classes.map((c) => extractJenjang(c))));

  const preliminary = sortedSchedules.map((sc, idx) => {
    const fromDay = examConfig?.seragamPerHariJenjang?.[sc.hari] || {};
    const uniformMap = { ...fromDay, ...(sc.seragamPerJenjang || {}) };
    const uniformEntries =
      jenjangList.length > 0
        ? jenjangList.map((jen) => ({ jenjang: jen, seragam: (uniformMap[jen] || '-').trim() || '-' }))
        : Object.entries(uniformMap).map(([jen, val]) => ({
            jenjang: jen,
            seragam: (val || '-').trim() || '-',
          }));

    const dayDisplay = sc.tanggal ? formatDayAndDate(sc.tanggal) : sc.hari || '-';
    const timeDisplay = `${sc.waktuMulai || '--:--'}–${sc.waktuSelesai || '--:--'}`;
    const sesiDisplay = `Sesi ${sc.sesi || 1}`;

    const classSubjects = classes.map((cls) => {
      const mappedId = sc.mapelPerKelas ? sc.mapelPerKelas[cls] : sc.mapelId;
      return {
        kelas: cls,
        subject: mappedId ? subjectMap.get(mappedId) : undefined,
      };
    });
    const singleSubject = sc.mapelId ? subjectMap.get(sc.mapelId) : undefined;

    // Resolve supervisors mapped cleanly per schedule + room
    const matchedAssignments = supervisorAssignments
      .filter((a) => a.scheduleId === sc.id)
      .sort((a, b) => {
        const ra = roomMap.get(a.roomId)?.nomorRuang || a.roomId;
        const rb = roomMap.get(b.roomId)?.nomorRuang || b.roomId;
        return ra.localeCompare(rb, 'id');
      });

    const roomSupervisors: RoomSupervisorDisplay[] = [];
    if (matchedAssignments.length > 0) {
      for (const asg of matchedAssignments) {
        const room = roomMap.get(asg.roomId);
        const roomLabel = room ? `R.${room.nomorRuang || room.namaRuang}` : asg.roomId;
        const supIds = [asg.pengawas1Id, asg.pengawas2Id].filter((id): id is string => Boolean(id));
        if (supIds.length === 0) continue;
        const codes: string[] = [];
        const names: string[] = [];
        for (const sid of supIds) {
          const dir = supervisorDirMap.get(sid);
          if (dir) {
            codes.push(dir.kode);
            names.push(`${dir.kode}. ${dir.formattedName}`);
          }
        }
        if (codes.length > 0) {
          roomSupervisors.push({ roomLabel, codes, names });
        }
      }
    } else {
      // Fallback to default room supervisors when matrix overrides aren't set yet
      const candidateRooms =
        sc.ruangIds && sc.ruangIds.length > 0
          ? rooms.filter((r) => sc.ruangIds.includes(r.id))
          : rooms;
      for (const room of candidateRooms) {
        const supIds = [room.pengawas1Id, room.pengawas2Id].filter((id): id is string => Boolean(id));
        if (supIds.length === 0) continue;
        const codes: string[] = [];
        const names: string[] = [];
        for (const sid of supIds) {
          const dir = supervisorDirMap.get(sid);
          if (dir) {
            codes.push(dir.kode);
            names.push(`${dir.kode}. ${dir.formattedName}`);
          }
        }
        if (codes.length > 0) {
          roomSupervisors.push({
            roomLabel: `R.${room.nomorRuang || room.namaRuang}`,
            codes,
            names,
          });
        }
      }
    }

    const kodePengawasSummary =
      roomSupervisors.length > 0
        ? roomSupervisors.map((rs) => `${rs.roomLabel}: ${rs.codes.join('/')}`).join(' • ')
        : '-';

    const daftarPengawasSummary =
      roomSupervisors.length > 0
        ? roomSupervisors.map((rs) => `${rs.roomLabel}: ${rs.names.join(' / ')}`)
        : [];

    const dayKey = `${sc.tanggal || ''}|${(sc.hari || '').trim().toLowerCase()}`;
    const timeKey = `${dayKey}|${timeDisplay}`;
    const sesiKey = `${dayKey}|${sc.sesi || 1}`;
    const seragamKey = `${dayKey}|${uniformEntries
      .map((u) => `${u.jenjang}:${u.seragam.toLowerCase()}`)
      .join('|')}`;

    return {
      no: idx + 1,
      schedule: sc,
      dayDisplay,
      timeDisplay,
      sesiDisplay,
      uniformEntries,
      classSubjects,
      singleSubject,
      roomSupervisors,
      kodePengawasSummary,
      daftarPengawasSummary,
      dayKey,
      timeKey,
      sesiKey,
      seragamKey,
    };
  });

  const daySpans = computeContiguousRowSpans(preliminary, (r) => r.dayKey);
  const timeSpans = computeContiguousRowSpans(preliminary, (r) => r.timeKey);
  const sesiSpans = computeContiguousRowSpans(preliminary, (r) => r.sesiKey);
  const seragamSpans = computeContiguousRowSpans(preliminary, (r) => r.seragamKey);

  const rows: SchedulePrintRow[] = preliminary.map((item, idx) => ({
    no: item.no,
    schedule: item.schedule,
    dayDisplay: item.dayDisplay,
    timeDisplay: item.timeDisplay,
    sesiDisplay: item.sesiDisplay,
    uniformEntries: item.uniformEntries,
    classSubjects: item.classSubjects,
    singleSubject: item.singleSubject,
    roomSupervisors: item.roomSupervisors,
    kodePengawasSummary: item.kodePengawasSummary,
    daftarPengawasSummary: item.daftarPengawasSummary,
    dayRowSpan: daySpans[idx],
    timeRowSpan: timeSpans[idx],
    sesiRowSpan: sesiSpans[idx],
    seragamRowSpan: seragamSpans[idx],
  }));

  return {
    classes,
    jenjangList,
    rows,
    supervisorDirectory,
  };
}
