import React, { useMemo, useRef, useState } from 'react';
import {
  Archive,
  Download,
  Upload,
  Lock,
  Unlock,
  RotateCcw,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Eye,
  Trash2,
  X,
} from 'lucide-react';
import {
  ExamArchiveRecord,
  ExamConfig,
  ExamRoom,
  ExamSchedule,
  ExamSubject,
  CommitteeMember,
  MadrasahProfile,
  NumberingConfig,
  PhysicalClassroom,
  RekapConfig,
  RoomDistributionConfig,
  SantriPhoneRecord,
  SealDocConfig,
  Student,
  Supervisor,
  SupervisorAssignment,
  TataTertibDoc,
  UploadedDocCategory,
  UploadedExamDocument,
  UserAccount,
} from '../../types';
import { canRoleRestoreBackup, canRoleUnlockArchive } from '../../utils/rbac';

interface ArsipBackupViewProps {
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
  roomConfig: RoomDistributionConfig;
  sealConfigs: SealDocConfig[];
  tataTertibDocs: TataTertibDoc[];
  phoneRecords: SantriPhoneRecord[];
  uploadedDocuments: UploadedExamDocument[];
  rekapConfig: RekapConfig;
  archives: ExamArchiveRecord[];
  currentUser: UserAccount;
  canEdit: boolean;
  onCreateArchive: (record: ExamArchiveRecord) => Promise<void>;
  onUnlockArchive: (id: string, reason: string) => Promise<void>;
  onRestoreArchive: (id: string) => Promise<void>;
  onDownloadBackup: () => Promise<void>;
  onRestoreBackup: (payload: unknown) => Promise<void>;
  onUploadDocument: (doc: UploadedExamDocument) => Promise<void>;
  onDeleteUploadedDoc: (id: string) => Promise<void>;
}

const DOC_CATEGORY_LABELS: Record<UploadedDocCategory, string> = {
  admin_hp: 'Administrasi HP',
  daftar_hadir: 'Daftar Hadir',
  berita_acara: 'Berita Acara',
  jadwal: 'Jadwal & Surat',
  dokumen_lain: 'Dokumen Lain',
};

export const ArsipBackupView: React.FC<ArsipBackupViewProps> = ({
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
  roomConfig,
  sealConfigs,
  tataTertibDocs,
  phoneRecords,
  uploadedDocuments,
  rekapConfig,
  archives,
  currentUser,
  canEdit,
  onCreateArchive,
  onUnlockArchive,
  onRestoreArchive,
  onDownloadBackup,
  onRestoreBackup,
  onUploadDocument,
  onDeleteUploadedDoc,
}) => {
  const [search, setSearch] = useState('');
  const [filterTahun, setFilterTahun] = useState('all');
  const [docCategoryFilter, setDocCategoryFilter] = useState<'all' | UploadedDocCategory>('all');
  const [unlockModalId, setUnlockModalId] = useState<string | null>(null);
  const [unlockReason, setUnlockReason] = useState('');
  const [lockOnArchive, setLockOnArchive] = useState(true);
  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Upload extra exam document state
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocCategory, setNewDocCategory] = useState<UploadedDocCategory>('berita_acara');
  const [newDocNotes, setNewDocNotes] = useState('');
  const [newDocFile, setNewDocFile] = useState<{ fileName: string; mimeType: string; dataUrl: string } | null>(null);
  const [previewDoc, setPreviewDoc] = useState<UploadedExamDocument | null>(null);

  const canUnlock = canRoleUnlockArchive(currentUser.role);
  const canRestore = canRoleRestoreBackup(currentUser.role);

  const distinctTahun = useMemo(
    () => Array.from(new Set(archives.map((a) => a.tahunPelajaran))).sort(),
    [archives]
  );

  const filteredArchives = useMemo(() => {
    const q = search.trim().toLowerCase();
    return archives.filter((a) => {
      if (q && !a.namaUjian.toLowerCase().includes(q) && !a.jenjang.toLowerCase().includes(q)) {
        return false;
      }
      if (filterTahun !== 'all' && a.tahunPelajaran !== filterTahun) return false;
      return true;
    });
  }, [archives, search, filterTahun]);

  const filteredUploadedDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return uploadedDocuments.filter((d) => {
      if (docCategoryFilter !== 'all' && d.category !== docCategoryFilter) return false;
      if (
        q &&
        !d.title.toLowerCase().includes(q) &&
        !d.fileName.toLowerCase().includes(q) &&
        !(d.notes || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [uploadedDocuments, docCategoryFilter, search]);

  const handleSaveSnapshot = async () => {
    const record: ExamArchiveRecord = {
      id: `arch-${Date.now()}`,
      namaUjian: examConfig.namaUjian,
      tahunPelajaran: examConfig.tahunPelajaran,
      jenjang: examConfig.jenjangLabel,
      tanggal: examConfig.tanggalMulai,
      moda: examConfig.moda,
      archivedAt: new Date().toISOString(),
      archivedBy: currentUser.nama,
      isLocked: lockOnArchive,
      snapshot: {
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
        roomConfig,
        sealConfigs,
        tataTertibDocs,
        phoneRecords,
        uploadedDocuments,
        rekapConfig,
      },
    };
    await onCreateArchive(record);
    setNotice(`Arsip "${record.namaUjian}" berhasil disimpan (${lockOnArchive ? 'Terkunci' : 'Terbuka'}).`);
  };

  const handleSelectExtraDocFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      setNewDocFile({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        dataUrl,
      });
      if (!newDocTitle.trim()) {
        setNewDocTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUploadExtraDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocFile) {
      setErrorMsg('Pilih file dokumen atau scan yang akan diarsipkan.');
      return;
    }
    setErrorMsg('');
    const doc: UploadedExamDocument = {
      id: `doc-${Date.now()}`,
      title: newDocTitle.trim() || newDocFile.fileName,
      category: newDocCategory,
      fileName: newDocFile.fileName,
      mimeType: newDocFile.mimeType,
      fileDataUrl: newDocFile.dataUrl,
      uploadedAt: new Date().toISOString(),
      uploadedBy: currentUser.nama,
      notes: newDocNotes.trim() || undefined,
    };
    await onUploadDocument(doc);
    setNewDocTitle('');
    setNewDocNotes('');
    setNewDocFile(null);
    setNotice(`Dokumen "${doc.title}" berhasil diarsipkan bersama dokumen ujian lainnya.`);
  };

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockModalId) return;
    setErrorMsg('');
    try {
      await onUnlockArchive(unlockModalId, unlockReason);
      setUnlockModalId(null);
      setUnlockReason('');
      setNotice('Kunci arsip berhasil dibuka dan alasan dicatat ke Audit Log.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membuka kunci arsip');
    }
  };

  const handleJsonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await onRestoreBackup(parsed);
      setNotice('Backup JSON berhasil dipulihkan ke server.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'File backup JSON tidak valid');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Arsip Multi-Ujian & Cadangan Sistem</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Simpan snapshot riwayat ujian per tahun pelajaran, proteksi arsip terkunci, serta unduh/pulihkan backup JSON.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onDownloadBackup}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" /> Unduh Backup JSON
          </button>
          {canRestore && (
            <>
              <input ref={fileRef} type="file" accept=".json" onChange={handleJsonUpload} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5" /> Restore JSON
              </button>
            </>
          )}
          {canEdit && (
            <button
              onClick={handleSaveSnapshot}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" /> Arsipkan Ujian Saat Ini
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {notice}
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {errorMsg}
        </div>
      )}

      {/* Search & Archive Option */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama ujian atau jenjang..."
              className="pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg w-full"
            />
          </div>
          <select
            value={filterTahun}
            onChange={(e) => setFilterTahun(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
          >
            <option value="all">Semua Tahun Pelajaran</option>
            {distinctTahun.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {canEdit && (
          <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={lockOnArchive}
              onChange={(e) => setLockOnArchive(e.target.checked)}
            />
            Kunci otomatis arsip baru (lindungi dari ubah/hapus tidak sengaja)
          </label>
        )}
      </div>

      {/* Archives Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <th className="px-4 py-3">Kegiatan Ujian</th>
              <th className="px-3 py-3">TP / Tanggal</th>
              <th className="px-3 py-3">Moda</th>
              <th className="px-3 py-3 text-center">Isi Snapshot</th>
              <th className="px-3 py-3">Status Kunci</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredArchives.map((arch) => (
              <tr key={arch.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-3">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Archive className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    {arch.namaUjian}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Jenjang {arch.jenjang} • Diarsipkan oleh {arch.archivedBy}
                  </div>
                </td>
                <td className="px-3 py-3 font-mono text-slate-700">
                  <div>{arch.tahunPelajaran}</div>
                  <div className="text-[11px] text-slate-500">{arch.tanggal}</div>
                </td>
                <td className="px-3 py-3 uppercase font-semibold">{arch.moda}</td>
                <td className="px-3 py-3 text-center tabular-nums text-slate-700">
                  {arch.snapshot.students.length} Peserta • {arch.snapshot.rooms.length} Ruang
                </td>
                <td className="px-3 py-3">
                  {arch.isLocked ? (
                    <span className="inline-flex items-center gap-1 text-amber-800 font-semibold">
                      <Lock className="w-3.5 h-3.5" /> Terkunci
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                      <Unlock className="w-3.5 h-3.5" /> Terbuka
                    </span>
                  )}
                  {arch.unlockReason && (
                    <p className="text-[10.5px] text-slate-500 mt-0.5">Alasan: {arch.unlockReason}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                  {arch.isLocked && canUnlock && (
                    <button
                      onClick={() => setUnlockModalId(arch.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-300 rounded-lg cursor-pointer"
                    >
                      <Unlock className="w-3 h-3" /> Buka Kunci
                    </button>
                  )}
                  {!arch.isLocked && canRestore && (
                    <button
                      onClick={() => onRestoreArchive(arch.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" /> Muat Arsip
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Unified Uploaded Exam Documents Archive (Scan HP + Daftar Hadir + Berita Acara + Lainnya) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-700" /> Arsip Dokumen Scan & Dokumen Terunggah ({uploadedDocuments.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Seluruh hasil scan Administrasi HP yang telah dibaca sistem tersimpan bersama scan Berita Acara, Daftar Hadir, Jadwal, dan dokumen pendukung ujian lainnya.
            </p>
          </div>
          <select
            value={docCategoryFilter}
            onChange={(e) => setDocCategoryFilter(e.target.value as 'all' | UploadedDocCategory)}
            className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
          >
            <option value="all">Semua Kategori ({uploadedDocuments.length})</option>
            <option value="admin_hp">Administrasi HP</option>
            <option value="daftar_hadir">Daftar Hadir</option>
            <option value="berita_acara">Berita Acara</option>
            <option value="jadwal">Jadwal & Surat</option>
            <option value="dokumen_lain">Dokumen Lain</option>
          </select>
        </div>

        {canEdit && (
          <form onSubmit={handleUploadExtraDoc} className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-3 text-xs items-end">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kategori Dokumen</label>
              <select
                value={newDocCategory}
                onChange={(e) => setNewDocCategory(e.target.value as UploadedDocCategory)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
              >
                <option value="berita_acara">Berita Acara</option>
                <option value="daftar_hadir">Daftar Hadir</option>
                <option value="admin_hp">Administrasi HP</option>
                <option value="jadwal">Jadwal & Surat</option>
                <option value="dokumen_lain">Dokumen Lain</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Judul Dokumen</label>
              <input
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                placeholder="Misal: Scan Berita Acara Ruang 01"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Pilih File Scan / PDF / Gambar</label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf,.csv,.xlsx,.xls"
                onChange={handleSelectExtraDocFile}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" /> Tambah ke Arsip Dokumen
            </button>
            <div className="md:col-span-4">
              <input
                value={newDocNotes}
                onChange={(e) => setNewDocNotes(e.target.value)}
                placeholder="Catatan singkat dokumen (opsional)"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
              />
            </div>
          </form>
        )}

        {filteredUploadedDocs.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-slate-300 rounded-lg text-xs text-slate-500">
            Belum ada dokumen scan terunggah untuk kategori yang dipilih.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="px-3 py-2.5">Kategori</th>
                  <th className="px-3 py-2.5">Judul & File</th>
                  <th className="px-3 py-2.5">Ringkasan Sistem / Catatan</th>
                  <th className="px-3 py-2.5">Diunggah</th>
                  <th className="px-3 py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUploadedDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2.5">
                      <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 font-bold text-[11px]">
                        {DOC_CATEGORY_LABELS[doc.category] || doc.category}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-slate-900">{doc.title}</div>
                      <div className="text-[11px] font-mono text-slate-500">{doc.fileName}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {doc.extractedSummary && (
                        <div className="text-emerald-800 font-semibold">
                          {doc.extractedRowCount ? `${doc.extractedRowCount} baris data • ` : ''}
                          {doc.extractedSummary}
                        </div>
                      )}
                      {doc.notes && <div>{doc.notes}</div>}
                      {!doc.extractedSummary && !doc.notes && <span className="text-slate-400">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      <div>{doc.uploadedBy}</div>
                      <div className="text-[11px] font-mono">
                        {new Date(doc.uploadedAt).toLocaleString('id-ID')}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap space-x-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(doc)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded cursor-pointer"
                      >
                        <Eye className="w-3 h-3" /> Lihat
                      </button>
                      <a
                        href={doc.fileDataUrl}
                        download={doc.fileName}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded"
                      >
                        <Download className="w-3 h-3" /> Unduh
                      </a>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => onDeleteUploadedDoc(doc.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Preview Uploaded Doc Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-3xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">{previewDoc.title}</h4>
                <p className="text-xs text-slate-500">
                  {DOC_CATEGORY_LABELS[previewDoc.category]} • {previewDoc.fileName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[65vh] overflow-auto bg-slate-50 rounded-lg border border-slate-200 p-3 text-center">
              {previewDoc.mimeType.startsWith('image/') ? (
                <img src={previewDoc.fileDataUrl} alt={previewDoc.title} className="max-w-full mx-auto rounded" />
              ) : previewDoc.mimeType === 'application/pdf' ? (
                <iframe src={previewDoc.fileDataUrl} title={previewDoc.title} className="w-full h-[55vh] rounded" />
              ) : (
                <div className="p-6 text-xs text-slate-700 space-y-2">
                  <p className="font-semibold">File dokumen: {previewDoc.fileName}</p>
                  {previewDoc.extractedSummary && <p>{previewDoc.extractedSummary}</p>}
                  <a
                    href={previewDoc.fileDataUrl}
                    download={previewDoc.fileName}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 font-bold text-white bg-emerald-700 rounded-lg"
                  >
                    <Download className="w-3.5 h-3.5" /> Unduh File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Unlock Modal requiring official reason */}
      {unlockModalId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleUnlockSubmit}
            className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-5 space-y-4 text-xs"
          >
            <h3 className="text-sm font-bold text-slate-900">Buka Kunci Arsip Terproteksi</h3>
            <p className="text-slate-600">
              Pembukaan kunci arsip hanya diperbolehkan untuk Super Admin dan wajib mencatat alasan resmi ke Audit Log.
            </p>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Alasan Pembukaan Kunci *</label>
              <textarea
                required
                minLength={5}
                rows={3}
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                placeholder="Contoh: Koreksi cetak ulang kartu peserta susulan atas izin Kepala Madrasah"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUnlockModalId(null)}
                className="px-3 py-1.5 font-semibold bg-slate-100 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer"
              >
                Buka Kunci & Catat Log
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
