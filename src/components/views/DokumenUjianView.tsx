import React, { useEffect, useRef, useState } from 'react';
import {
  FileText,
  FileCheck2,
  BookOpen,
  Upload,
  Save,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import {
  ExamConfig,
  ExamRoom,
  ExamSchedule,
  ExamSubject,
  MadrasahProfile,
  PaperPreset,
  PaperSize,
  SealDocConfig,
  Student,
  Supervisor,
  SupervisorAssignment,
  TataTertibDoc,
} from '../../types';
import { extractTataTertibFromFile } from '../../utils/tatibParser';
import { SegelSoalCetak } from '../documents/SegelSoalCetak';
import { BeritaAcara } from '../documents/BeritaAcara';
import { TataTertib } from '../documents/TataTertib';
import { PrintToolbar } from '../documents/PrintToolbar';

interface DokumenUjianViewProps {
  profile: MadrasahProfile;
  examConfig: ExamConfig;
  rooms: ExamRoom[];
  schedules: ExamSchedule[];
  subjects: ExamSubject[];
  students: Student[];
  supervisors: Supervisor[];
  supervisorAssignments: SupervisorAssignment[];
  sealConfigs: SealDocConfig[];
  tataTertibDocs: TataTertibDoc[];
  paperPresets: PaperPreset[];
  canEdit: boolean;
  onSaveDokumenUjian: (payload: {
    sealConfigs?: SealDocConfig[];
    tataTertibDocs?: TataTertibDoc[];
  }) => Promise<void>;
}

export const DokumenUjianView: React.FC<DokumenUjianViewProps> = ({
  profile,
  examConfig,
  rooms,
  schedules,
  subjects,
  students,
  supervisors,
  supervisorAssignments,
  sealConfigs,
  tataTertibDocs,
  paperPresets,
  canEdit,
  onSaveDokumenUjian,
}) => {
  const [subTab, setSubTab] = useState<'segel' | 'berita_acara' | 'tata_tertib'>(
    examConfig.moda === 'kertas' ? 'segel' : 'berita_acara'
  );
  const [selectedRoomId, setSelectedRoomId] = useState<string>(rooms[0]?.id || 'all');
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>(schedules[0]?.id || 'all');

  // Seal Editor state
  const effectiveScheduleId = selectedScheduleId === 'all' ? schedules[0]?.id : selectedScheduleId;
  const effectiveRoomId = selectedRoomId === 'all' ? rooms[0]?.id : selectedRoomId;
  const sealKey = `${effectiveScheduleId}_${effectiveRoomId}`;
  const currentSeal = sealConfigs.find((s) => s.id === sealKey);
  const targetRoomCount = students.filter(
    (s) => s.status === 'Aktif' && s.ruangId === effectiveRoomId
  ).length;

  const [jumlahSoal, setJumlahSoal] = useState<number>(currentSeal?.jumlahSoal ?? targetRoomCount);
  const [jumlahLjk, setJumlahLjk] = useState<number>(currentSeal?.jumlahLjk ?? targetRoomCount);
  const [jumlahBA, setJumlahBA] = useState<number>(currentSeal?.jumlahBeritaAcara ?? 2);
  const [jumlahDH, setJumlahDH] = useState<number>(currentSeal?.jumlahDaftarHadir ?? 2);
  const [sealCatatan, setSealCatatan] = useState<string>(currentSeal?.catatan || '');

  useEffect(() => {
    setJumlahSoal(currentSeal?.jumlahSoal ?? targetRoomCount);
    setJumlahLjk(currentSeal?.jumlahLjk ?? targetRoomCount);
    setJumlahBA(currentSeal?.jumlahBeritaAcara ?? 2);
    setJumlahDH(currentSeal?.jumlahDaftarHadir ?? 2);
    setSealCatatan(currentSeal?.catatan || '');
  }, [sealKey, currentSeal, targetRoomCount]);

  // Tata Tertib Upload & Edit
  const [activeTatibId, setActiveTatibId] = useState<string>(tataTertibDocs[0]?.id || 'tatib-peserta');
  const currentTatib = tataTertibDocs.find((d) => d.id === activeTatibId) || tataTertibDocs[0];
  const [tatibDraftText, setTatibDraftText] = useState<string>(
    currentTatib ? currentTatib.contentLines.join('\n') : ''
  );
  const [tatibPaperSize, setTatibPaperSize] = useState<PaperSize>(currentTatib?.paperSize || 'A4');
  const [tatibMarginMm, setTatibMarginMm] = useState<number>(currentTatib?.marginMm || 12);
  const [parseWarning, setParseWarning] = useState<string>('');
  const [notice, setNotice] = useState<string>('');
  const tatibFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentTatib) {
      setTatibDraftText(currentTatib.contentLines.join('\n'));
      setTatibPaperSize(currentTatib.paperSize);
      setTatibMarginMm(currentTatib.marginMm);
    }
  }, [currentTatib]);

  const selectTatibDoc = (doc: TataTertibDoc) => {
    setActiveTatibId(doc.id);
    setTatibDraftText(doc.contentLines.join('\n'));
    setTatibPaperSize(doc.paperSize);
    setTatibMarginMm(doc.marginMm);
    setParseWarning('');
  };

  const handleSaveSeal = async (e: React.FormEvent) => {
    e.preventDefault();
    const schedId = selectedScheduleId === 'all' ? schedules[0]?.id : selectedScheduleId;
    const roomId = selectedRoomId === 'all' ? rooms[0]?.id : selectedRoomId;
    if (!schedId || !roomId) return;
    const id = `${schedId}_${roomId}`;
    const entry: SealDocConfig = {
      id,
      scheduleId: schedId,
      roomId,
      jumlahSoal,
      jumlahLjk,
      jumlahBeritaAcara: jumlahBA,
      jumlahDaftarHadir: jumlahDH,
      catatan: sealCatatan,
    };
    const exists = sealConfigs.some((s) => s.id === id);
    const nextSeals = exists ? sealConfigs.map((s) => (s.id === id ? entry : s)) : [...sealConfigs, entry];
    await onSaveDokumenUjian({ sealConfigs: nextSeals });
    setNotice('Jumlah soal, LJK, dan keterangan segel amplop berhasil disimpan.');
  };

  const handleUploadTatib = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentTatib) return;
    const parsed = await extractTataTertibFromFile(file);
    setTatibDraftText(parsed.lines.join('\n'));
    setParseWarning(parsed.notice || '');
    const updatedDocs = tataTertibDocs.map((d) =>
      d.id === currentTatib.id
        ? {
            ...d,
            sourceFileName: file.name,
            contentLines: parsed.lines,
            updatedAt: new Date().toISOString(),
          }
        : d
    );
    await onSaveDokumenUjian({ tataTertibDocs: updatedDocs });
    setNotice(`File "${file.name}" berhasil dibaca. Silakan periksa pratinjau teks di bawah.`);
    e.target.value = '';
  };

  const handleSaveTatib = async (toggleFinalize?: boolean) => {
    if (!currentTatib) return;
    const nextLines = tatibDraftText
      .split(/\r?\n/)
      .map((l) => l.trimEnd())
      .filter((l) => l.trim().length > 0);
    const nextDocs = tataTertibDocs.map((d) =>
      d.id === currentTatib.id
        ? {
            ...d,
            contentLines: nextLines,
            paperSize: tatibPaperSize,
            marginMm: tatibMarginMm,
            isFinalized: toggleFinalize !== undefined ? toggleFinalize : d.isFinalized,
            updatedAt: new Date().toISOString(),
          }
        : d
    );
    await onSaveDokumenUjian({ tataTertibDocs: nextDocs });
    setNotice('Teks Tata Tertib dan pengaturan kertas berhasil disimpan.');
  };

  const segelPreset = paperPresets.find((p) => p.id === 'segel');
  const baPreset = paperPresets.find((p) => p.id === 'berita_acara');

  return (
    <div className="space-y-6">
      <div className="no-print bg-white p-5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Dokumen Pelaksanaan Ujian</h2>
          <p className="text-xs text-slate-500">
            Segel Soal & LJK (input manual), Berita Acara Dinamis per ruang, dan Upload Tata Tertib Resmi.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <button
            onClick={() => setSubTab('segel')}
            className={`px-3.5 py-2 font-bold rounded-lg border cursor-pointer ${
              subTab === 'segel'
                ? 'bg-emerald-700 border-emerald-700 text-white'
                : 'bg-white border-slate-300 text-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5 inline mr-1.5" /> Segel Soal & LJK
          </button>
          <button
            onClick={() => setSubTab('berita_acara')}
            className={`px-3.5 py-2 font-bold rounded-lg border cursor-pointer ${
              subTab === 'berita_acara'
                ? 'bg-emerald-700 border-emerald-700 text-white'
                : 'bg-white border-slate-300 text-slate-700'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5 inline mr-1.5" /> Berita Acara Dinamis
          </button>
          <button
            onClick={() => setSubTab('tata_tertib')}
            className={`px-3.5 py-2 font-bold rounded-lg border cursor-pointer ${
              subTab === 'tata_tertib'
                ? 'bg-emerald-700 border-emerald-700 text-white'
                : 'bg-white border-slate-300 text-slate-700'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 inline mr-1.5" /> Tata Tertib Ujian
          </button>
        </div>
      </div>

      {notice && (
        <div className="no-print bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {notice}
        </div>
      )}

      {subTab === 'segel' && (
        <div className="space-y-5">
          {examConfig.moda === 'online' && (
            <div className="no-print bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-lg text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              Saat ini ujian menggunakan Moda Online. Dokumen Segel Soal & LJK umumnya dipakai pada Moda Kertas, namun tetap dapat dikonfigurasi dan dicetak di sini.
            </div>
          )}

          <div className="no-print bg-white p-5 rounded-xl border border-slate-200 space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pilih Ruang Ujian</label>
                <select
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
                >
                  <option value="all">Semua Ruang</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.namaRuang}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pilih Jadwal / Mapel</label>
                <select
                  value={selectedScheduleId}
                  onChange={(e) => setSelectedScheduleId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
                >
                  <option value="all">Semua Jadwal</option>
                  {schedules.map((sc) => {
                    const sub = subjects.find((s) => s.id === sc.mapelId);
                    return (
                      <option key={sc.id} value={sc.id}>
                        {sub?.nama || sc.mapelId} ({sc.hari}, {sc.tanggal})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {canEdit && (
              <form onSubmit={handleSaveSeal} className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-3 border-t border-slate-100 items-end">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jumlah Soal (Manual)</label>
                  <input
                    type="number"
                    min={0}
                    value={jumlahSoal}
                    onChange={(e) => setJumlahSoal(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jumlah LJK (Manual)</label>
                  <input
                    type="number"
                    min={0}
                    value={jumlahLjk}
                    onChange={(e) => setJumlahLjk(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Berita Acara</label>
                  <input
                    type="number"
                    min={0}
                    value={jumlahBA}
                    onChange={(e) => setJumlahBA(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Daftar Hadir</label>
                  <input
                    type="number"
                    min={0}
                    value={jumlahDH}
                    onChange={(e) => setJumlahDH(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Catatan</label>
                  <input
                    value={sealCatatan}
                    onChange={(e) => setSealCatatan(e.target.value)}
                    placeholder="Misal: +2 cadangan"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" /> Simpan Segel
                </button>
              </form>
            )}
          </div>

          <PrintToolbar
            title="Segel Naskah Soal & LJK"
            paperSize={segelPreset?.size || 'A4'}
            orientation="portrait"
          />

          <div className="overflow-x-auto pb-8">
            <SegelSoalCetak
              profile={profile}
              rooms={rooms}
              schedules={schedules}
              subjects={subjects}
              students={students}
              supervisors={supervisors}
              supervisorAssignments={supervisorAssignments}
              sealConfigs={sealConfigs}
              selectedRoomId={selectedRoomId}
              selectedScheduleId={selectedScheduleId}
              paperPreset={segelPreset}
            />
          </div>
        </div>
      )}

      {subTab === 'berita_acara' && (
        <div className="space-y-5">
          <div className="no-print bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap gap-3 text-xs">
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
            <select
              value={selectedScheduleId}
              onChange={(e) => setSelectedScheduleId(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
            >
              <option value="all">Semua Jadwal</option>
              {schedules.map((sc) => {
                const sub = subjects.find((s) => s.id === sc.mapelId);
                return (
                  <option key={sc.id} value={sc.id}>
                    {sub?.nama || sc.mapelId} ({sc.hari}, Sesi {sc.sesi})
                  </option>
                );
              })}
            </select>
          </div>

          <PrintToolbar
            title="Berita Acara Pelaksanaan Ujian (Dinamis Per Ruang)"
            paperSize={baPreset?.size || 'A4'}
            orientation="portrait"
          />

          <div className="overflow-x-auto pb-8">
            <BeritaAcara
              profile={profile}
              examConfig={examConfig}
              students={students}
              rooms={rooms}
              schedules={schedules}
              subjects={subjects}
              supervisors={supervisors}
              supervisorAssignments={supervisorAssignments}
              selectedRoomId={selectedRoomId}
              selectedScheduleId={selectedScheduleId}
              paperPreset={baPreset}
            />
          </div>
        </div>
      )}

      {subTab === 'tata_tertib' && currentTatib && (
        <div className="space-y-5">
          <div className="no-print bg-white p-5 rounded-xl border border-slate-200 space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                {tataTertibDocs.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => selectTatibDoc(doc)}
                    className={`px-3 py-1.5 font-bold rounded-lg border cursor-pointer ${
                      currentTatib.id === doc.id
                        ? 'bg-slate-800 border-slate-800 text-white'
                        : 'bg-white border-slate-300 text-slate-700'
                    }`}
                  >
                    {doc.target === 'peserta' ? 'Tata Tertib Peserta' : 'Tata Tertib Pengawas'}
                  </button>
                ))}
              </div>

              {canEdit && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={tatibFileRef}
                    type="file"
                    accept=".docx,.pdf,.txt"
                    onChange={handleUploadTatib}
                    className="hidden"
                  />
                  <button
                    onClick={() => tatibFileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload PDF / DOCX / TXT
                  </button>
                  <button
                    onClick={() => handleSaveTatib(!currentTatib.isFinalized)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 font-semibold bg-amber-50 border border-amber-300 text-amber-900 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    {currentTatib.isFinalized ? (
                      <>
                        <Unlock className="w-3.5 h-3.5" /> Buka Finalisasi
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" /> Finalisasi
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleSaveTatib()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    <Save className="w-3.5 h-3.5" /> Simpan Redaksi
                  </button>
                </div>
              )}
            </div>

            {parseWarning && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{parseWarning}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ukuran Kertas</label>
                <select
                  disabled={!canEdit}
                  value={tatibPaperSize}
                  onChange={(e) => setTatibPaperSize(e.target.value as PaperSize)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="A4">A4 (210 x 297 mm)</option>
                  <option value="F4">F4 / Folio (215 x 330 mm)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Margin Halaman (mm)</label>
                <input
                  type="number"
                  min={5}
                  max={25}
                  disabled={!canEdit}
                  value={tatibMarginMm}
                  onChange={(e) => setTatibMarginMm(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Redaksi Tata Tertib (Dipertahankan Sesuai Aslinya, 1 Poin per Baris)
              </label>
              <textarea
                rows={7}
                disabled={!canEdit}
                value={tatibDraftText}
                onChange={(e) => setTatibDraftText(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-serif text-xs leading-relaxed"
              />
            </div>
          </div>

          <PrintToolbar
            title={currentTatib.title}
            paperSize={tatibPaperSize}
            orientation="portrait"
          />

          <div className="overflow-x-auto pb-8">
            <TataTertib
              profile={profile}
              type={currentTatib.target}
              tataTertibDocs={tataTertibDocs}
            />
          </div>
        </div>
      )}
    </div>
  );
};
