import React, { useState } from 'react';
import {
  ExamConfig,
  ExamRoom,
  ExamSchedule,
  ExamSubject,
  MadrasahProfile,
  NumberingConfig,
  PaperPreset,
  Student,
  Supervisor,
  SupervisorAssignment,
} from '../../types';
import { DaftarHadir } from '../documents/DaftarHadir';
import { PrintToolbar } from '../documents/PrintToolbar';
import { exportStudentsToExcel } from '../../utils/dnpu';
import { usePrintLayout } from '../../utils/printLayout';

interface DaftarHadirViewProps {
  profile: MadrasahProfile;
  examConfig: ExamConfig;
  students: Student[];
  rooms: ExamRoom[];
  schedules: ExamSchedule[];
  subjects: ExamSubject[];
  supervisors: Supervisor[];
  supervisorAssignments: SupervisorAssignment[];
  numberingConfig: NumberingConfig;
  paperPreset?: PaperPreset;
  onSavePreset?: (next: PaperPreset) => Promise<void>;
}

export const DaftarHadirView: React.FC<DaftarHadirViewProps> = ({
  profile,
  examConfig,
  students,
  rooms,
  schedules,
  subjects,
  supervisors,
  supervisorAssignments,
  numberingConfig,
  paperPreset,
  onSavePreset,
}) => {
  const [selectedRoomId, setSelectedRoomId] = useState<string>(rooms[0]?.id || 'all');
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>(schedules[0]?.id || 'all');
  const { layout, setLayout } = usePrintLayout(paperPreset, {
    size: 'A4',
    orientation: 'portrait',
    marginMm: 10,
  });

  const handleExport = () => {
    const filtered = students.filter(
      (s) => s.status === 'Aktif' && (selectedRoomId === 'all' || s.ruangId === selectedRoomId)
    );
    exportStudentsToExcel(filtered, examConfig.moda === 'online', 'Daftar_Hadir_Peserta_SAUM.xlsx');
  };

  return (
    <div className="space-y-4">
      <div className="no-print bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-700">Ruang Ujian:</span>
          <select
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
          >
            <option value="all">Semua Ruang ({rooms.length})</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>{r.namaRuang}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-700">Jadwal / Mapel:</span>
          <select
            value={selectedScheduleId}
            onChange={(e) => setSelectedScheduleId(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
          >
            <option value="all">Semua Jadwal ({schedules.length})</option>
            {schedules.map((sc) => {
              const sub = subjects.find((s) => s.id === sc.mapelId);
              return (
                <option key={sc.id} value={sc.id}>
                  {sub?.nama || sc.mapelId} ({sc.hari}, {sc.tanggal} • Sesi {sc.sesi})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      <PrintToolbar
        title="Daftar Hadir Peserta Ujian (Urut Kelas Terendah → A-Z)"
        onExportExcel={handleExport}
        layout={layout}
        onLayoutChange={setLayout}
        onSaveLayout={onSavePreset}
      />

      <div className="overflow-x-auto pb-8 print:overflow-visible print:pb-0">
        <DaftarHadir
          profile={profile}
          examConfig={examConfig}
          students={students}
          rooms={rooms}
          schedules={schedules}
          subjects={subjects}
          supervisors={supervisors}
          supervisorAssignments={supervisorAssignments}
          numberingConfig={numberingConfig}
          selectedRoomId={selectedRoomId}
          selectedScheduleId={selectedScheduleId}
          paperPreset={layout}
        />
      </div>
    </div>
  );
};
