import React, { useState } from 'react';
import {
  ExamConfig,
  ExamRoom,
  MadrasahProfile,
  PaperPreset,
  PhysicalClassroom,
  Student,
} from '../../types';
import { LabelRuangCetak } from '../documents/LabelRuangCetak';
import { PrintToolbar } from '../documents/PrintToolbar';

interface LabelRuangViewProps {
  profile: MadrasahProfile;
  examConfig: ExamConfig;
  rooms: ExamRoom[];
  students: Student[];
  physicalClassrooms: PhysicalClassroom[];
  paperPreset?: PaperPreset;
}

export const LabelRuangView: React.FC<LabelRuangViewProps> = ({
  profile,
  examConfig,
  rooms,
  students,
  physicalClassrooms,
  paperPreset,
}) => {
  const [selectedRoomId, setSelectedRoomId] = useState<string>('all');

  return (
    <div className="space-y-4">
      <div className="no-print bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Label Pintu & Identitas Ruang Ujian</h2>
          <p className="text-slate-500">
            Menampilkan nomor ruang serta rentang nomor peserta aktual per kelas secara akurat (rentang terputus dipisahkan).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">Filter Ruang:</span>
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
      </div>

      <PrintToolbar
        title="Label Pintu Ruang Ujian"
        paperSize={paperPreset?.size || 'A4'}
        orientation={paperPreset?.orientation || 'portrait'}
      />

      <div className="overflow-x-auto pb-8">
        <LabelRuangCetak
          profile={profile}
          examConfig={examConfig}
          rooms={rooms}
          students={students}
          physicalClassrooms={physicalClassrooms}
          selectedRoomId={selectedRoomId}
          paperPreset={paperPreset}
        />
      </div>
    </div>
  );
};
