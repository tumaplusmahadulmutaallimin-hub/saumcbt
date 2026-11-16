import React, { useMemo, useState } from 'react';
import {
  FileText,
  FileCheck,
  Grid,
  Tag,
  BookOpen,
  Award,
  UserCheck,
  BarChart3,
  Layers,
  MapPin,
  Hash,
  DoorClosed,
  Calendar,
  Smartphone,
  Users,
  PackageCheck,
} from 'lucide-react';
import {
  CommitteeMember,
  DocumentType,
  ExamConfig,
  ExamRoom,
  ExamSchedule,
  ExamSubject,
  HpHandoverLog,
  MadrasahProfile,
  NumberingConfig,
  PaperOrientation,
  PaperPreset,
  PaperSize,
  PhysicalClassroom,
  RekapConfig,
  SantriPhoneRecord,
  SealDocConfig,
  Student,
  Supervisor,
  SupervisorAssignment,
  TataTertibDoc,
} from '../../types';
import { PrintToolbar } from '../documents/PrintToolbar';
import { KartuPeserta } from '../documents/KartuPeserta';
import { DaftarHadir } from '../documents/DaftarHadir';
import { BeritaAcara } from '../documents/BeritaAcara';
import { DenahRuangCetak } from '../documents/DenahRuangCetak';
import { DenahLokasiCetak } from '../documents/DenahLokasiCetak';
import { LabelRuangCetak } from '../documents/LabelRuangCetak';
import { LabelAdministrasi } from '../documents/LabelAdministrasi';
import { NomorMejaCetak, NomorMejaPrintStyle } from '../documents/NomorMejaCetak';
import { TataTertib } from '../documents/TataTertib';
import { SKPanitia } from '../documents/SKPanitia';
import { DaftarHadirPengawas } from '../documents/DaftarHadirPengawas';
import { RekapitulasiLaporan } from '../documents/RekapitulasiLaporan';
import { RekapKebutuhanCetak } from '../documents/RekapKebutuhanCetak';
import { SegelSoalCetak } from '../documents/SegelSoalCetak';
import { HpDocumentsCetak } from '../documents/HpDocumentsCetak';
import { JadwalUjianCetak } from '../documents/JadwalUjianCetak';
import { DnpuCetak } from '../documents/DnpuCetak';
import { exportStudentsToExcel, extractJenjang } from '../../utils/dnpu';

interface CetakDokumenViewProps {
  profile: MadrasahProfile;
  examConfig: ExamConfig;
  students: Student[];
  rooms: ExamRoom[];
  physicalClassrooms: PhysicalClassroom[];
  schedules: ExamSchedule[];
  subjects: ExamSubject[];
  committee: CommitteeMember[];
  supervisors: Supervisor[];
  supervisorAssignments: SupervisorAssignment[];
  numberingConfig: NumberingConfig;
  sealConfigs: SealDocConfig[];
  tataTertibDocs: TataTertibDoc[];
  phoneRecords: SantriPhoneRecord[];
  hpLogs: HpHandoverLog[];
  rekapConfig: RekapConfig;
  paperPresets: PaperPreset[];
  initialDocType?: DocumentType;
  initialRoomId?: string;
}

export const CetakDokumenView: React.FC<CetakDokumenViewProps> = ({
  profile,
  examConfig,
  students,
  rooms,
  physicalClassrooms,
  schedules,
  subjects,
  committee,
  supervisors,
  supervisorAssignments,
  numberingConfig,
  sealConfigs,
  tataTertibDocs,
  phoneRecords,
  hpLogs,
  rekapConfig,
  paperPresets,
  initialDocType,
  initialRoomId,
}) => {
  const [selectedDoc, setSelectedDoc] = useState<DocumentType>(initialDocType || 'denah_ruang');
  const [selectedRoomId, setSelectedRoomId] = useState<string>(initialRoomId || 'all');
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('all');
  const [selectedJenjang, setSelectedJenjang] = useState<string>('all');
  const [selectedSesi, setSelectedSesi] = useState<number>(0);
  const [hpManualBlank, setHpManualBlank] = useState<boolean>(true);
  const [nomorMejaStyle, setNomorMejaStyle] = useState<NomorMejaPrintStyle>('label_lengkap');

  const docCatalog: Array<{
    id: DocumentType;
    title: string;
    icon: typeof FileText;
    presetKey: PaperPreset['id'];
    defaultOrientation?: PaperOrientation;
  }> = [
    { id: 'dnpu', title: '1. Daftar DNPU', icon: Users, presetKey: 'default' },
    { id: 'nomor_peserta', title: '2. Cetak Nomor Peserta', icon: Hash, presetKey: 'default' },
    { id: 'pembagian_ruang', title: '3. Bagi Ruang & Sesi', icon: DoorClosed, presetKey: 'default' },
    { id: 'denah_lokasi', title: '4. Denah Lokasi', icon: MapPin, presetKey: 'denah_lokasi', defaultOrientation: 'landscape' },
    { id: 'denah_ruang', title: '5. Denah Tempat Duduk', icon: Grid, presetKey: 'denah_duduk', defaultOrientation: 'portrait' },
    { id: 'daftar_hadir', title: '6. Daftar Hadir Peserta', icon: FileCheck, presetKey: 'daftar_hadir' },
    { id: 'label_ruang', title: '7. Label Pintu Ruang', icon: Tag, presetKey: 'label_ruang' },
    { id: 'jadwal_ujian', title: '8. Jadwal Ujian', icon: Calendar, presetKey: 'default', defaultOrientation: 'landscape' },
    { id: 'daftar_pengawas', title: '9. Daftar Hadir Pengawas', icon: UserCheck, presetKey: 'default' },
    { id: 'surat_tugas', title: '10. Surat Tugas Pengawas', icon: Award, presetKey: 'default' },
    { id: 'segel_soal', title: '11. Segel Soal & LJK', icon: FileText, presetKey: 'segel' },
    { id: 'berita_acara', title: '12. Berita Acara Dinamis', icon: FileText, presetKey: 'berita_acara' },
    { id: 'tata_tertib', title: '13. Tata Tertib Ujian', icon: BookOpen, presetKey: 'default' },
    { id: 'kartu_peserta', title: '14. Kartu Peserta Ujian', icon: FileText, presetKey: 'default' },
    { id: 'label_meja', title: '15. Cetak Nomor Meja', icon: Tag, presetKey: 'default' },
    { id: 'sk_panitia', title: '16. SK Panitia Ujian', icon: Award, presetKey: 'default' },
    { id: 'hp_penerimaan', title: '17a. HP: Penerimaan', icon: Smartphone, presetKey: 'dokumen_hp' },
    { id: 'hp_pengambilan', title: '17b. HP: Pengambilan', icon: Smartphone, presetKey: 'dokumen_hp' },
    { id: 'hp_pengembalian', title: '17c. HP: Pengembalian', icon: Smartphone, presetKey: 'dokumen_hp' },
    { id: 'hp_pengecasan', title: '17d. HP: Pengecasan', icon: Smartphone, presetKey: 'dokumen_hp' },
    { id: 'hp_rekap', title: '17e. HP: Rekapitulasi', icon: Smartphone, presetKey: 'dokumen_hp' },
    { id: 'rekap_laporan', title: '18. Rekapitulasi & Bundle', icon: BarChart3, presetKey: 'default' },
    { id: 'rekap_perlengkapan', title: '19. Rekap Perlengkapan & Ganda', icon: PackageCheck, presetKey: 'default' },
  ];

  const currentDocMeta = docCatalog.find((d) => d.id === selectedDoc) || docCatalog[0];
  const basePreset = paperPresets.find((p) => p.id === currentDocMeta.presetKey) || paperPresets[0];

  const [overrideSize, setOverrideSize] = useState<PaperSize | 'preset'>('preset');
  const [overrideOrientation, setOverrideOrientation] = useState<PaperOrientation | 'preset'>('preset');

  const activePaperSize: PaperSize =
    overrideSize === 'preset' ? basePreset?.size || 'A4' : overrideSize;
  const activeOrientation: PaperOrientation =
    overrideOrientation === 'preset'
      ? currentDocMeta.defaultOrientation || basePreset?.orientation || 'portrait'
      : overrideOrientation;

  const effectivePreset: PaperPreset | undefined = basePreset
    ? { ...basePreset, size: activePaperSize, orientation: activeOrientation }
    : undefined;

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (selectedJenjang !== 'all' && (s.jenjang || extractJenjang(s.kelas)) !== selectedJenjang) {
        return false;
      }
      if (examConfig.moda === 'online' && selectedSesi > 0 && s.sesi !== selectedSesi) {
        return false;
      }
      return true;
    });
  }, [students, selectedJenjang, selectedSesi, examConfig.moda]);

  const distinctJenjang = useMemo(
    () => Array.from(new Set(students.map((s) => s.jenjang || extractJenjang(s.kelas)))).sort(),
    [students]
  );

  const canExportTableExcel = [
    'dnpu',
    'nomor_peserta',
    'pembagian_ruang',
    'daftar_hadir',
  ].includes(selectedDoc);

  return (
    <div className="space-y-5">
      {/* Document Selector Panel */}
      <div className="no-print bg-white p-5 rounded-xl border border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Pusat Cetak Terintegrasi (19 Jenis Dokumen)</h2>
            <p className="text-xs text-slate-500">
              Seluruh dokumen otomatis membaca KOP asli, data DNPU, ruang, jadwal, dan preset kertas A4 / F4 1:1 siap cetak.
            </p>
          </div>
          <button
            onClick={() => setSelectedDoc('bundle_semua')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Layers className="w-3.5 h-3.5" /> Cetak Semua Dokumen Sekaligus
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {docCatalog.map((doc) => {
            const Icon = doc.icon;
            const active = selectedDoc === doc.id;
            return (
              <button
                key={doc.id}
                onClick={() => {
                  setSelectedDoc(doc.id);
                  setOverrideOrientation('preset');
                }}
                className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-colors cursor-pointer ${
                  active
                    ? 'border-emerald-700 bg-emerald-50 text-emerald-950 font-bold'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-emerald-700' : 'text-slate-400'}`} />
                <span className="text-[11px] leading-tight truncate">{doc.title}</span>
              </button>
            );
          })}
        </div>

        {/* Unified Context & Paper Filters */}
        <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center gap-3 text-xs">
          <select
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
          >
            <option value="all">Semua Ruang ({rooms.length})</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>{r.namaRuang}</option>
            ))}
          </select>

          <select
            value={selectedScheduleId}
            onChange={(e) => setSelectedScheduleId(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold max-w-xs"
          >
            <option value="all">Semua Jadwal / Mapel</option>
            {schedules.map((sc) => {
              const sub = subjects.find((s) => s.id === sc.mapelId);
              return (
                <option key={sc.id} value={sc.id}>
                  {sub?.nama || sc.mapelId} ({sc.hari}, Sesi {sc.sesi})
                </option>
              );
            })}
          </select>

          <select
            value={selectedJenjang}
            onChange={(e) => setSelectedJenjang(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
          >
            <option value="all">Semua Jenjang</option>
            {distinctJenjang.map((j) => (
              <option key={j} value={j}>Jenjang {j}</option>
            ))}
          </select>

          {examConfig.moda === 'online' && (
            <select
              value={selectedSesi}
              onChange={(e) => setSelectedSesi(Number(e.target.value))}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
            >
              <option value={0}>Semua Sesi</option>
              {Array.from({ length: examConfig.jumlahSesi }, (_, i) => i + 1).map((s) => (
                <option key={s} value={s}>Sesi {s}</option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <select
              value={overrideSize}
              onChange={(e) => setOverrideSize(e.target.value as PaperSize | 'preset')}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
            >
              <option value="preset">Kertas Preset ({basePreset?.size || 'A4'})</option>
              <option value="A4">Kertas A4</option>
              <option value="F4">Kertas F4 (Folio)</option>
            </select>
            <select
              value={overrideOrientation}
              onChange={(e) => setOverrideOrientation(e.target.value as PaperOrientation | 'preset')}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
            >
              <option value="preset">Orientasi Bawaan</option>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>
        </div>

        {selectedDoc.startsWith('hp_') && selectedDoc !== 'hp_rekap' && (
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={hpManualBlank}
              onChange={(e) => setHpManualBlank(e.target.checked)}
              className="rounded border-slate-300 text-emerald-700"
            />
            Kosongkan kolom isian detail (Merek, Box, Baterai, Jam & Paraf) untuk diisi manual dengan pulpen saat cetak
          </label>
        )}

        {selectedDoc === 'label_meja' && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-700">Format Nomor Meja:</span>
            <select
              value={nomorMejaStyle}
              onChange={(e) => setNomorMejaStyle(e.target.value as NomorMejaPrintStyle)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
            >
              <option value="label_lengkap">Label Nomor Meja & Data Peserta Lengkap (8/hal)</option>
              <option value="berpasangan_2kursi">Label Meja Berpasangan (1 Meja = 2 Kursi)</option>
              <option value="kartu_angka_besar">Kartu Angka Nomor Meja Besar (6/hal)</option>
              <option value="daftar_meja">Daftar Rekap Nomor Meja Per Ruang</option>
            </select>
          </div>
        )}
      </div>

      <PrintToolbar
        title={selectedDoc === 'bundle_semua' ? 'Bundle Seluruh Dokumen Administrasi' : currentDocMeta.title}
        paperSize={activePaperSize}
        orientation={activeOrientation}
        onExportExcel={
          canExportTableExcel
            ? () => exportStudentsToExcel(filteredStudents, examConfig.moda === 'online', `${selectedDoc}_SAUM.xlsx`)
            : undefined
        }
      />

      <div className="w-full overflow-x-auto pb-12">
        {(selectedDoc === 'dnpu' || selectedDoc === 'nomor_peserta' || selectedDoc === 'pembagian_ruang') && (
          <DnpuCetak
            profile={profile}
            examConfig={examConfig}
            students={filteredStudents}
            rooms={rooms}
            numberingConfig={numberingConfig}
            mode={selectedDoc}
            selectedRoomId={selectedRoomId}
            paperPreset={effectivePreset}
          />
        )}

        {selectedDoc === 'denah_lokasi' && (
          <DenahLokasiCetak
            profile={profile}
            examConfig={examConfig}
            physicalClassrooms={physicalClassrooms}
            rooms={rooms}
            students={filteredStudents}
            supervisors={supervisors}
            paperPreset={effectivePreset}
          />
        )}

        {selectedDoc === 'denah_ruang' && (
          <DenahRuangCetak
            profile={profile}
            examConfig={examConfig}
            rooms={rooms}
            students={filteredStudents}
            supervisors={supervisors}
            selectedRoomId={selectedRoomId}
            selectedSesi={selectedSesi > 0 ? selectedSesi : undefined}
            paperPreset={effectivePreset}
          />
        )}

        {selectedDoc === 'daftar_hadir' && (
          <DaftarHadir
            profile={profile}
            examConfig={examConfig}
            students={filteredStudents}
            rooms={rooms}
            schedules={schedules}
            subjects={subjects}
            supervisors={supervisors}
            supervisorAssignments={supervisorAssignments}
            numberingConfig={numberingConfig}
            selectedRoomId={selectedRoomId}
            selectedScheduleId={selectedScheduleId}
            selectedSesi={selectedSesi > 0 ? selectedSesi : undefined}
            paperPreset={effectivePreset}
          />
        )}

        {selectedDoc === 'label_ruang' && (
          <LabelRuangCetak
            profile={profile}
            examConfig={examConfig}
            rooms={rooms}
            students={filteredStudents}
            physicalClassrooms={physicalClassrooms}
            selectedRoomId={selectedRoomId}
            paperPreset={effectivePreset}
          />
        )}

        {selectedDoc === 'jadwal_ujian' && (
          <JadwalUjianCetak
            profile={profile}
            examConfig={examConfig}
            schedules={schedules}
            subjects={subjects}
            rooms={rooms}
            supervisors={supervisors}
            supervisorAssignments={supervisorAssignments}
            paperPreset={effectivePreset}
          />
        )}

        {selectedDoc === 'daftar_pengawas' && (
          <DaftarHadirPengawas
            profile={profile}
            schedules={schedules}
            subjects={subjects}
            supervisors={supervisors}
            rooms={rooms}
            supervisorAssignments={supervisorAssignments}
            paperPreset={effectivePreset}
          />
        )}

        {selectedDoc === 'surat_tugas' && (
          <SKPanitia
            profile={profile}
            committee={committee}
            supervisors={supervisors}
            rooms={rooms}
            selectedType="surat_tugas"
          />
        )}

        {selectedDoc === 'sk_panitia' && (
          <SKPanitia
            profile={profile}
            committee={committee}
            supervisors={supervisors}
            rooms={rooms}
            selectedType="sk_panitia"
          />
        )}

        {selectedDoc === 'segel_soal' && (
          <SegelSoalCetak
            profile={profile}
            rooms={rooms}
            schedules={schedules}
            subjects={subjects}
            students={filteredStudents}
            supervisors={supervisors}
            supervisorAssignments={supervisorAssignments}
            sealConfigs={sealConfigs}
            selectedRoomId={selectedRoomId}
            selectedScheduleId={selectedScheduleId}
            paperPreset={effectivePreset}
          />
        )}

        {selectedDoc === 'berita_acara' && (
          <BeritaAcara
            profile={profile}
            examConfig={examConfig}
            students={filteredStudents}
            rooms={rooms}
            schedules={schedules}
            subjects={subjects}
            supervisors={supervisors}
            supervisorAssignments={supervisorAssignments}
            selectedRoomId={selectedRoomId}
            selectedScheduleId={selectedScheduleId}
            paperPreset={effectivePreset}
          />
        )}

        {selectedDoc === 'tata_tertib' && (
          <TataTertib
            profile={profile}
            type="semua"
            tataTertibDocs={tataTertibDocs}
            paperPreset={effectivePreset}
          />
        )}

        {selectedDoc === 'kartu_peserta' && (
          <KartuPeserta
            profile={profile}
            examConfig={examConfig}
            students={filteredStudents}
            rooms={rooms}
            numberingConfig={numberingConfig}
            selectedRoomId={selectedRoomId}
          />
        )}

        {selectedDoc === 'label_meja' && (
          <NomorMejaCetak
            profile={profile}
            examConfig={examConfig}
            students={filteredStudents}
            rooms={rooms}
            numberingConfig={numberingConfig}
            selectedRoomId={selectedRoomId}
            selectedSesi={selectedSesi > 0 ? selectedSesi : undefined}
            printStyle={nomorMejaStyle}
            kursiPerMeja={rekapConfig.kursiPerMeja}
            paperPreset={effectivePreset}
          />
        )}

        {(selectedDoc === 'label_pintu' || selectedDoc === 'label_amplop') && (
          <LabelAdministrasi
            profile={profile}
            examConfig={examConfig}
            students={filteredStudents}
            rooms={rooms}
            schedules={schedules}
            subjects={subjects}
            numberingConfig={numberingConfig}
            selectedSubtype={selectedDoc}
            selectedRoomId={selectedRoomId}
          />
        )}

        {(selectedDoc === 'hp_penerimaan' ||
          selectedDoc === 'hp_pengambilan' ||
          selectedDoc === 'hp_pengembalian' ||
          selectedDoc === 'hp_pengecasan' ||
          selectedDoc === 'hp_rekap') && (
          <HpDocumentsCetak
            profile={profile}
            examConfig={examConfig}
            phoneRecords={phoneRecords}
            hpLogs={hpLogs}
            docSubtype={selectedDoc}
            paperPreset={effectivePreset}
            manualBlankPrint={hpManualBlank}
          />
        )}

        {selectedDoc === 'rekap_laporan' && (
          <RekapitulasiLaporan
            profile={profile}
            students={filteredStudents}
            rooms={rooms}
            schedules={schedules}
            subjects={subjects}
            committee={committee}
            supervisors={supervisors}
          />
        )}

        {selectedDoc === 'rekap_perlengkapan' && (
          <RekapKebutuhanCetak
            profile={profile}
            examConfig={examConfig}
            students={filteredStudents}
            rooms={rooms}
            schedules={schedules}
            subjects={subjects}
            rekapConfig={rekapConfig}
            paperPreset={effectivePreset}
          />
        )}

        {selectedDoc === 'bundle_semua' && (
          <div className="space-y-8 flex flex-col items-center">
            <DnpuCetak profile={profile} examConfig={examConfig} students={filteredStudents} rooms={rooms} numberingConfig={numberingConfig} mode="dnpu" />
            <DenahLokasiCetak profile={profile} examConfig={examConfig} physicalClassrooms={physicalClassrooms} rooms={rooms} students={filteredStudents} supervisors={supervisors} />
            <DenahRuangCetak profile={profile} examConfig={examConfig} rooms={rooms} students={filteredStudents} supervisors={supervisors} />
            <LabelRuangCetak profile={profile} examConfig={examConfig} rooms={rooms} students={filteredStudents} physicalClassrooms={physicalClassrooms} />
            <JadwalUjianCetak profile={profile} examConfig={examConfig} schedules={schedules} subjects={subjects} rooms={rooms} supervisors={supervisors} supervisorAssignments={supervisorAssignments} />
            <DaftarHadir profile={profile} examConfig={examConfig} students={filteredStudents} rooms={rooms} schedules={schedules.slice(0, 1)} subjects={subjects} supervisors={supervisors} supervisorAssignments={supervisorAssignments} numberingConfig={numberingConfig} />
            <BeritaAcara profile={profile} examConfig={examConfig} students={filteredStudents} rooms={rooms} schedules={schedules.slice(0, 1)} subjects={subjects} supervisors={supervisors} supervisorAssignments={supervisorAssignments} />
            <RekapKebutuhanCetak profile={profile} examConfig={examConfig} students={filteredStudents} rooms={rooms} schedules={schedules} subjects={subjects} rekapConfig={rekapConfig} />
            <TataTertib profile={profile} type="semua" tataTertibDocs={tataTertibDocs} />
          </div>
        )}
      </div>
    </div>
  );
};
