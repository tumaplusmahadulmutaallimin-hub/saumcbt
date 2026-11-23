import React, { useMemo, useState } from 'react';
import {
  Plus,
  BatteryCharging,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  Printer,
  CheckCircle2,
  ClipboardList,
  Users,
  Trash2,
  Upload,
  Sparkles,
  Archive,
  Eye,
  Download,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import {
  ExamConfig,
  ExamRoom,
  HpChargingStatus,
  HpHandoverLog,
  HpReturnStatus,
  MadrasahProfile,
  PaperPreset,
  SantriPhoneRecord,
  Student,
  UploadedExamDocument,
  UserAccount,
} from '../../types';
import { saumApi } from '../../utils/api';
import { HpDocumentsCetak } from '../documents/HpDocumentsCetak';
import { PrintToolbar } from '../documents/PrintToolbar';
import { usePrintLayout } from '../../utils/printLayout';

interface ParsedHpRowDraft {
  kodeHp?: string;
  namaSantri: string;
  kelas?: string;
  merekModel?: string;
  nomorBox?: string;
  nomorSlot?: string;
  persentaseBaterai?: number;
  kondisi?: string;
  jamTransaksi?: string;
  petugas?: string;
  isSedangDiambil?: boolean;
  statusPengembalian?: 'Belum dikembalikan' | 'Sudah dikembalikan' | 'Perlu pemeriksaan';
  catatan?: string;
}

interface AdminHpViewProps {
  profile: MadrasahProfile;
  examConfig: ExamConfig;
  students: Student[];
  rooms: ExamRoom[];
  phoneRecords: SantriPhoneRecord[];
  hpLogs: HpHandoverLog[];
  uploadedDocuments: UploadedExamDocument[];
  currentUser: UserAccount;
  paperPreset?: PaperPreset;
  canEdit: boolean;
  onSavePhones: (
    phoneRecords: SantriPhoneRecord[],
    hpLogs?: HpHandoverLog[],
    auditDetail?: string
  ) => Promise<void>;
  onUploadDocument: (doc: UploadedExamDocument) => Promise<void>;
  onDeleteUploadedDoc: (id: string) => Promise<void>;
  onSavePreset?: (preset: PaperPreset) => Promise<void>;
}

export const AdminHpView: React.FC<AdminHpViewProps> = ({
  profile,
  examConfig,
  students,
  rooms,
  phoneRecords,
  hpLogs,
  uploadedDocuments,
  currentUser,
  paperPreset,
  canEdit,
  onSavePhones,
  onUploadDocument,
  onDeleteUploadedDoc,
  onSavePreset,
}) => {
  const { layout, setLayout } = usePrintLayout(paperPreset, {
    size: 'A4',
    orientation: 'portrait',
    marginMm: 10,
  });
  const [activeTab, setActiveTab] = useState<
    'penerimaan' | 'pengambilan' | 'pengembalian' | 'pengecasan' | 'pinjaman' | 'rekap' | 'upload_arsip'
  >('penerimaan');
  const [printSubtype, setPrintSubtype] = useState<
    'hp_penerimaan' | 'hp_pengambilan' | 'hp_pengembalian' | 'hp_pengecasan' | 'hp_rekap'
  >('hp_penerimaan');
  const [showPrint, setShowPrint] = useState(false);
  const [manualBlankPrint, setManualBlankPrint] = useState(true);
  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Upload Scan & OCR/CSV Reader state
  const [scanDocSubtype, setScanDocSubtype] = useState<
    'hp_penerimaan' | 'hp_pengambilan' | 'hp_pengembalian' | 'hp_pengecasan'
  >('hp_penerimaan');
  const [scanTitle, setScanTitle] = useState('');
  const [scanNotes, setScanNotes] = useState('');
  const [selectedFileMeta, setSelectedFileMeta] = useState<{
    fileName: string;
    mimeType: string;
    base64Data: string;
    dataUrl: string;
  } | null>(null);
  const [isParsingScan, setIsParsingScan] = useState(false);
  const [isArchivingDoc, setIsArchivingDoc] = useState(false);
  const [parsedSummary, setParsedSummary] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedHpRowDraft[]>([]);
  const [previewDoc, setPreviewDoc] = useState<UploadedExamDocument | null>(null);

  // Form Penerimaan HP: Cukup Nama & Kelas (+ Kode HP), kolom lain opsional / kosong untuk isi manual
  const [newHp, setNewHp] = useState({
    kodeHp: `HP-${String(phoneRecords.length + 1).padStart(3, '0')}`,
    studentId: '',
    namaSantri: '',
    kelas: examConfig.registeredClasses[0] || '',
    merekModel: '',
    warna: '',
    namaPenyetor: '',
    nomorBox: '',
    nomorSlot: '',
  });

  // Form HP Pinjaman: Cukup Kode, Nama Peminjam, Kelas; sisanya opsional/manual
  const [newLoan, setNewLoan] = useState({
    kodeHp: `PINJ-${String(phoneRecords.filter((p) => p.kategori !== 'Titipan').length + 1).padStart(3, '0')}`,
    namaSantri: '',
    kelas: examConfig.registeredClasses[0] || '',
    merekModel: '',
    namaPemberiPinjaman: '',
    tanggalPinjam: '',
    rencanaKembali: '',
    kondisiAwal: '',
  });

  // Handover Form state
  const [handoverTargetId, setHandoverTargetId] = useState<string>(phoneRecords[0]?.id || '');
  const [handoverRuang, setHandoverRuang] = useState<string>(rooms[0]?.namaRuang || '');
  const [handoverPhysicalMatch, setHandoverPhysicalMatch] = useState<boolean>(true);
  const [handoverNote, setHandoverNote] = useState<string>('');

  const chargingAlerts = useMemo(() => {
    const alerts: string[] = [];
    phoneRecords.forEach((hp) => {
      if (hp.isSedangDiambil && hp.statusCas === 'Sedang dicas') {
        alerts.push(
          `${hp.kodeHp} (${hp.namaSantri}): Status tercatat sedang diambil ke ruang ujian tetapi status cas masih "Sedang dicas".`
        );
      }
      if (
        !hp.isSedangDiambil &&
        hp.statusPengembalian !== 'Sudah dikembalikan' &&
        hp.statusCas === 'Baterai lemah'
      ) {
        alerts.push(
          `${hp.kodeHp} (${hp.namaSantri}): Status "Baterai lemah" — perlu segera dicas.`
        );
      }
    });
    return alerts;
  }, [phoneRecords]);

  const stats = useMemo(() => {
    const titipan = phoneRecords.filter((p) => p.kategori === 'Titipan').length;
    const pinjaman = phoneRecords.filter((p) => p.kategori !== 'Titipan').length;
    const sedangDiambil = phoneRecords.filter((p) => p.isSedangDiambil).length;
    const belumDiambil = phoneRecords.length - sedangDiambil;
    const sudahKembali = phoneRecords.filter((p) => p.statusPengembalian === 'Sudah dikembalikan').length;
    const belumKembali = phoneRecords.length - sudahKembali;
    const siapCas = phoneRecords.filter((p) => p.statusCas === 'Baterai penuh' || p.statusCas === 'Selesai dicas').length;
    const perluCas = phoneRecords.filter((p) => p.statusCas === 'Belum dicas' || p.statusCas === 'Baterai lemah').length;
    return { titipan, pinjaman, sedangDiambil, belumDiambil, sudahKembali, belumKembali, siapCas, perluCas };
  }, [phoneRecords]);

  const handleSelectStudentForHp = (studentId: string) => {
    const st = students.find((s) => s.id === studentId);
    if (st) {
      setNewHp((prev) => ({
        ...prev,
        studentId: st.id,
        namaSantri: st.nama,
        kelas: st.kelas,
      }));
    } else {
      setNewHp((prev) => ({ ...prev, studentId: '' }));
    }
  };

  // Load all active DNPU students with ONLY Kode HP, Nama Santri, & Kelas — leaving all other columns blank for manual entry/handwriting
  const handlePopulateFromDnpu = async () => {
    const existingStudentIds = new Set(phoneRecords.map((p) => p.studentId).filter(Boolean));
    const existingNames = new Set(phoneRecords.map((p) => p.namaSantri.trim().toLowerCase()));
    const toAdd = students.filter(
      (s) =>
        s.status === 'Aktif' &&
        !existingStudentIds.has(s.id) &&
        !existingNames.has(s.nama.trim().toLowerCase())
    );
    if (toAdd.length === 0) {
      setNotice('Seluruh peserta aktif DNPU sudah ada dalam daftar HP.');
      return;
    }

    let nextIdx = phoneRecords.length + 1;
    const existingCodes = new Set(phoneRecords.map((p) => p.kodeHp.toUpperCase()));
    const created: SantriPhoneRecord[] = toAdd.map((st) => {
      let code = `HP-${String(nextIdx++).padStart(3, '0')}`;
      while (existingCodes.has(code)) {
        code = `HP-${String(nextIdx++).padStart(3, '0')}`;
      }
      existingCodes.add(code);
      return {
        id: `hp-${Date.now()}-${st.id}`,
        kodeHp: code,
        studentId: st.id,
        namaSantri: st.nama,
        kelas: st.kelas,
        kategori: 'Titipan',
        isSedangDiambil: false,
        statusCas: 'Belum dicas',
        statusPengembalian: 'Belum dikembalikan',
      };
    });

    await onSavePhones(
      [...phoneRecords, ...created],
      hpLogs,
      `Memuat ${created.length} nama santri dari DNPU (isian lain manual)`
    );
    setNotice(`${created.length} santri dari DNPU berhasil dimuat (hanya Nama & Kelas, kolom lain siap diisi manual).`);
  };

  const handleAddTitipan = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!newHp.namaSantri.trim()) {
      setErrorMsg('Nama santri wajib diisi.');
      return;
    }
    const record: SantriPhoneRecord = {
      id: `hp-${Date.now()}`,
      kodeHp: newHp.kodeHp.trim().toUpperCase(),
      studentId: newHp.studentId || undefined,
      namaSantri: newHp.namaSantri.trim(),
      kelas: newHp.kelas.trim() || '-',
      merekModel: newHp.merekModel.trim() || undefined,
      warna: newHp.warna.trim() || undefined,
      kategori: 'Titipan',
      tanggalDiterima: new Date().toISOString().slice(0, 10),
      namaPenyetor: newHp.namaPenyetor.trim() || undefined,
      namaPenerima: currentUser.nama,
      isSedangDiambil: false,
      jumlahFisikCocok: true,
      nomorBox: newHp.nomorBox.trim() || undefined,
      nomorSlot: newHp.nomorSlot.trim() || undefined,
      statusCas: 'Belum dicas',
      statusPengembalian: 'Belum dikembalikan',
    };

    try {
      await onSavePhones(
        [...phoneRecords, record],
        hpLogs,
        `Tambah daftar HP ${record.kodeHp} (${record.namaSantri})`
      );
      setNotice(`Data HP ${record.kodeHp} (${record.namaSantri}) berhasil ditambahkan. Isian detail lain dapat diisi manual.`);
      setNewHp((prev) => ({
        ...prev,
        kodeHp: `HP-${String(phoneRecords.length + 2).padStart(3, '0')}`,
        studentId: '',
        namaSantri: '',
        merekModel: '',
        warna: '',
        namaPenyetor: '',
        nomorBox: '',
        nomorSlot: '',
      }));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan HP');
    }
  };

  const handleAddPinjaman = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!newLoan.namaSantri.trim()) {
      setErrorMsg('Nama peminjam wajib diisi.');
      return;
    }
    const record: SantriPhoneRecord = {
      id: `hp-${Date.now()}`,
      kodeHp: newLoan.kodeHp.trim().toUpperCase(),
      namaSantri: newLoan.namaSantri.trim(),
      kelas: newLoan.kelas.trim() || '-',
      merekModel: newLoan.merekModel.trim() || undefined,
      kategori: 'Pinjaman',
      namaPemberiPinjaman: newLoan.namaPemberiPinjaman.trim() || undefined,
      tanggalPinjam: newLoan.tanggalPinjam || undefined,
      rencanaKembali: newLoan.rencanaKembali || undefined,
      kondisiAwal: newLoan.kondisiAwal.trim() || undefined,
      isSedangDiambil: false,
      statusCas: 'Belum dicas',
      statusPengembalian: 'Belum dikembalikan',
    };
    try {
      await onSavePhones([...phoneRecords, record], hpLogs, `Tambah HP PINJAMAN ${record.kodeHp}`);
      setNotice(`HP PINJAMAN ${record.kodeHp} (${record.namaSantri}) ditambahkan.`);
      setNewLoan((prev) => ({
        ...prev,
        kodeHp: `PINJ-${String(phoneRecords.length + 2).padStart(3, '0')}`,
        namaSantri: '',
        merekModel: '',
        namaPemberiPinjaman: '',
        kondisiAwal: '',
      }));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan HP Pinjaman');
    }
  };

  const handleDeletePhone = async (id: string) => {
    const updated = phoneRecords.filter((p) => p.id !== id);
    await onSavePhones(updated, hpLogs, `Menghapus entri HP ${id}`);
  };

  const handleToggleHandover = async (isOut: boolean) => {
    const target = phoneRecords.find((p) => p.id === handoverTargetId);
    if (!target) return;
    const nowTime = new Date().toTimeString().slice(0, 5);
    const today = new Date().toISOString().slice(0, 10);

    const updated = phoneRecords.map((p) =>
      p.id === target.id
        ? {
            ...p,
            isSedangDiambil: isOut,
            terakhirDiambilTanggal: today,
            terakhirDiambilJam: nowTime,
            terakhirDiambilPetugas: currentUser.nama,
            terakhirDiambilRuang: handoverRuang,
            jumlahFisikCocok: handoverPhysicalMatch,
            statusCas: isOut && p.statusCas === 'Sedang dicas' ? ('Selesai dicas' as HpChargingStatus) : p.statusCas,
            catatan: handoverNote || p.catatan,
          }
        : p
    );

    const log: HpHandoverLog = {
      id: `hpl-${Date.now()}`,
      hpId: target.id,
      kodeHp: target.kodeHp,
      namaSantri: target.namaSantri,
      kelas: target.kelas,
      kategori: target.kategori,
      jenisTransaksi: isOut ? 'Pengambilan' : 'Penerimaan',
      tanggal: today,
      jam: nowTime,
      ruang: handoverRuang,
      petugas: currentUser.nama,
      penerimaAtauPenyetor: target.namaSantri,
      jumlahFisik: 1,
      kondisi: handoverPhysicalMatch ? 'Fisik Cocok' : 'Perlu Cek Fisik',
    };

    await onSavePhones(updated, [log, ...hpLogs], `${isOut ? 'Pengambilan' : 'Penyetoran kembali'} ${target.kodeHp}`);
    setNotice(`${target.kodeHp} dicatat ${isOut ? 'DIAMBIL ke ' + handoverRuang : 'DISIMPAN kembali ke box'}.`);
  };

  const handleFinalReturn = async (id: string, status: HpReturnStatus, kondisiAkhir: string) => {
    const target = phoneRecords.find((p) => p.id === id);
    if (!target) return;
    const today = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toTimeString().slice(0, 5);

    const updated = phoneRecords.map((p) =>
      p.id === id
        ? {
            ...p,
            isSedangDiambil: false,
            statusPengembalian: status,
            tanggalKembali: today,
            jamKembali: nowTime,
            kondisiKembali: kondisiAkhir,
            kondisiAkhir,
            penerimaKembali: p.namaSantri,
            petugasKembali: currentUser.nama,
          }
        : p
    );

    const log: HpHandoverLog = {
      id: `hpl-${Date.now()}`,
      hpId: target.id,
      kodeHp: target.kodeHp,
      namaSantri: target.namaSantri,
      kelas: target.kelas,
      kategori: target.kategori,
      jenisTransaksi: 'Pengembalian',
      tanggal: today,
      jam: nowTime,
      petugas: currentUser.nama,
      penerimaAtauPenyetor: target.namaSantri,
      jumlahFisik: 1,
      kondisi: kondisiAkhir,
    };

    await onSavePhones(updated, [log, ...hpLogs], `Pengembalian akhir ${target.kodeHp} (${status})`);
    setNotice(`Pengembalian akhir ${target.kodeHp} tercatat.`);
  };

  const handleUpdateField = async (
    id: string,
    patch: Partial<SantriPhoneRecord>
  ) => {
    const updated = phoneRecords.map((p) => (p.id === id ? { ...p, ...patch } : p));
    await onSavePhones(updated, hpLogs, `Update manual data HP ${id}`);
  };

  const handleSelectScanFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');
    setNotice('');
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = dataUrl.indexOf(',');
      const base64Data = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : '';
      const inferredMime =
        file.type ||
        (file.name.toLowerCase().endsWith('.csv')
          ? 'text/csv'
          : file.name.toLowerCase().endsWith('.xlsx')
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : file.name.toLowerCase().endsWith('.xls')
          ? 'application/vnd.ms-excel'
          : file.name.toLowerCase().endsWith('.pdf')
          ? 'application/pdf'
          : 'application/octet-stream');
      setSelectedFileMeta({
        fileName: file.name,
        mimeType: inferredMime,
        base64Data,
        dataUrl,
      });
      if (!scanTitle.trim()) {
        setScanTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
      setParsedRows([]);
      setParsedSummary('');
    };
    reader.readAsDataURL(file);
  };

  const handleParseScan = async () => {
    if (!selectedFileMeta) {
      setErrorMsg('Pilih file hasil scan form manual (JPG/PNG/PDF) atau file Excel/CSV terlebih dahulu.');
      return;
    }
    setErrorMsg('');
    setNotice('');
    setIsParsingScan(true);
    try {
      const res = await saumApi.parseHpScan({
        fileName: selectedFileMeta.fileName,
        mimeType: selectedFileMeta.mimeType,
        base64Data: selectedFileMeta.base64Data,
        docSubtype: scanDocSubtype,
      });
      setParsedSummary(res.summary || 'Pembacaan sistem selesai.');
      setParsedRows(res.rows || []);
      setNotice(
        res.rows && res.rows.length > 0
          ? `Sistem berhasil membaca ${res.rows.length} baris data HP dari "${selectedFileMeta.fileName}". Silakan periksa sebelum menerapkan ke database.`
          : `Pembacaan selesai namun tidak ditemukan baris data tabel pada "${selectedFileMeta.fileName}".`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membaca dokumen scan.');
    } finally {
      setIsParsingScan(false);
    }
  };

  const handleArchiveUploadedScan = async () => {
    if (!selectedFileMeta) {
      setErrorMsg('Pilih file dokumen yang ingin diarsipkan terlebih dahulu.');
      return;
    }
    setErrorMsg('');
    setIsArchivingDoc(true);
    try {
      const doc: UploadedExamDocument = {
        id: `doc-hp-${Date.now()}`,
        title: scanTitle.trim() || selectedFileMeta.fileName,
        category: 'admin_hp',
        subType: scanDocSubtype,
        fileName: selectedFileMeta.fileName,
        mimeType: selectedFileMeta.mimeType,
        fileDataUrl: selectedFileMeta.dataUrl,
        uploadedAt: new Date().toISOString(),
        uploadedBy: currentUser.nama,
        notes: scanNotes.trim() || undefined,
        extractedRowCount: parsedRows.length > 0 ? parsedRows.length : undefined,
        extractedSummary: parsedSummary || undefined,
      };
      await onUploadDocument(doc);
      setNotice(`Dokumen "${doc.title}" berhasil diarsipkan bersama dokumen ujian lainnya (lihat juga di menu Arsip Ujian).`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengarsipkan dokumen.');
    } finally {
      setIsArchivingDoc(false);
    }
  };

  const handleApplyParsedRows = async (alsoArchive = false) => {
    if (parsedRows.length === 0) {
      setErrorMsg('Belum ada baris hasil pembacaan sistem untuk diterapkan.');
      return;
    }
    setErrorMsg('');
    const today = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toTimeString().slice(0, 5);
    let nextRecords = [...phoneRecords];
    const nextLogs = [...hpLogs];
    let updatedCount = 0;
    let insertedCount = 0;

    for (const row of parsedRows) {
      const namaClean = (row.namaSantri || '').trim();
      const kodeClean = (row.kodeHp || '').trim().toUpperCase();
      if (!namaClean && !kodeClean) continue;

      const idx = nextRecords.findIndex(
        (p) =>
          (kodeClean && p.kodeHp.toUpperCase() === kodeClean) ||
          (namaClean && p.namaSantri.trim().toLowerCase() === namaClean.toLowerCase())
      );

      if (idx >= 0) {
        const existing = nextRecords[idx];
        const nextReturnStatus =
          row.statusPengembalian ||
          (scanDocSubtype === 'hp_pengembalian' ? 'Sudah dikembalikan' : existing.statusPengembalian);
        const nextIsOut =
          typeof row.isSedangDiambil === 'boolean'
            ? row.isSedangDiambil
            : scanDocSubtype === 'hp_pengambilan'
            ? true
            : scanDocSubtype === 'hp_pengembalian'
            ? false
            : existing.isSedangDiambil;

        nextRecords[idx] = {
          ...existing,
          merekModel: row.merekModel?.trim() || existing.merekModel,
          nomorBox: row.nomorBox?.trim() || existing.nomorBox,
          nomorSlot: row.nomorSlot?.trim() || existing.nomorSlot,
          persentaseBaterai:
            typeof row.persentaseBaterai === 'number' && !Number.isNaN(row.persentaseBaterai)
              ? row.persentaseBaterai
              : existing.persentaseBaterai,
          statusCas:
            typeof row.persentaseBaterai === 'number'
              ? row.persentaseBaterai >= 90
                ? 'Baterai penuh'
                : row.persentaseBaterai <= 25
                ? 'Baterai lemah'
                : 'Sedang dicas'
              : existing.statusCas,
          isSedangDiambil: nextIsOut,
          statusPengembalian: nextReturnStatus,
          terakhirDiambilJam: row.jamTransaksi || existing.terakhirDiambilJam,
          terakhirDiambilPetugas: row.petugas || existing.terakhirDiambilPetugas,
          tanggalKembali: nextReturnStatus === 'Sudah dikembalikan' ? today : existing.tanggalKembali,
          kondisiKembali: row.kondisi || existing.kondisiKembali,
          catatan: row.catatan || existing.catatan,
        };
        updatedCount++;
      } else {
        const genCode = kodeClean || `HP-${String(nextRecords.length + 1).padStart(3, '0')}`;
        const newRec: SantriPhoneRecord = {
          id: `hp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          kodeHp: genCode,
          namaSantri: namaClean || genCode,
          kelas: row.kelas?.trim() || '-',
          merekModel: row.merekModel?.trim() || undefined,
          kategori: genCode.startsWith('PINJ') ? 'Pinjaman' : 'Titipan',
          tanggalDiterima: today,
          namaPenerima: row.petugas || currentUser.nama,
          isSedangDiambil:
            typeof row.isSedangDiambil === 'boolean'
              ? row.isSedangDiambil
              : scanDocSubtype === 'hp_pengambilan',
          nomorBox: row.nomorBox?.trim() || undefined,
          nomorSlot: row.nomorSlot?.trim() || undefined,
          persentaseBaterai: row.persentaseBaterai,
          statusCas:
            typeof row.persentaseBaterai === 'number' && row.persentaseBaterai >= 90
              ? 'Baterai penuh'
              : 'Belum dicas',
          statusPengembalian: row.statusPengembalian || 'Belum dikembalikan',
          terakhirDiambilJam: row.jamTransaksi || undefined,
          terakhirDiambilPetugas: row.petugas || undefined,
          catatan: row.catatan || undefined,
        };
        nextRecords.push(newRec);
        nextLogs.unshift({
          id: `hpl-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          hpId: newRec.id,
          kodeHp: newRec.kodeHp,
          namaSantri: newRec.namaSantri,
          kelas: newRec.kelas,
          kategori: newRec.kategori,
          jenisTransaksi: scanDocSubtype === 'hp_pengembalian' ? 'Pengembalian' : scanDocSubtype === 'hp_pengambilan' ? 'Pengambilan' : 'Penerimaan',
          tanggal: today,
          jam: row.jamTransaksi || nowTime,
          petugas: row.petugas || currentUser.nama,
          penerimaAtauPenyetor: newRec.namaSantri,
          jumlahFisik: 1,
          kondisi: row.kondisi || 'Hasil Scan Form Manual',
        });
        insertedCount++;
      }
    }

    await onSavePhones(
      nextRecords,
      nextLogs,
      `Terapkan hasil pembacaan scan form HP (${updatedCount} diperbarui, ${insertedCount} baru)`
    );

    if (alsoArchive && selectedFileMeta) {
      await handleArchiveUploadedScan();
    }

    setNotice(
      `Data HP berhasil diperbarui dari hasil baca sistem (${updatedCount} diperbarui, ${insertedCount} ditambahkan)${alsoArchive ? ' dan dokumen berhasil diarsipkan' : ''}.`
    );
  };

  const hpUploadedDocs = useMemo(
    () => uploadedDocuments.filter((d) => d.category === 'admin_hp'),
    [uploadedDocuments]
  );

  if (showPrint) {
    return (
      <div className="print:space-y-0">
        <PrintToolbar
          title="Cetak Administrasi HP Santri (Form Manual)"
          onBack={() => setShowPrint(false)}
          layout={layout}
          onLayoutChange={setLayout}
          onSaveLayout={onSavePreset}
        />
        <div className="no-print max-w-3xl mx-auto mb-4 bg-white border border-slate-200 rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <label className="inline-flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={manualBlankPrint}
              onChange={(e) => setManualBlankPrint(e.target.checked)}
            />
            Kosongkan kolom isian detail (hanya cetak Nama, Kelas, Kode HP, & tanda PINJAMAN untuk diisi pulpen manual)
          </label>
          <button
            onClick={() => {
              setShowPrint(false);
              setActiveTab('upload_arsip');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" /> Setelah Cetak: Upload & Baca Sistem
          </button>
        </div>
        <div className="overflow-x-auto pb-8 print:overflow-visible print:pb-0">
          <HpDocumentsCetak
            profile={profile}
            examConfig={examConfig}
            phoneRecords={phoneRecords}
            hpLogs={hpLogs}
            docSubtype={printSubtype}
            paperPreset={layout}
            manualBlankPrint={manualBlankPrint}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Administrasi HP Santri (Isian Manual, Scan Sistem & Arsip • Moda Online)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cukup isi Nama Santri & Kode HP, cetak lembar manual untuk diisi petugas, lalu upload hasil scan/CSV agar dibaca sistem dan diarsipkan bersama dokumen ujian lainnya.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <button
              onClick={handlePopulateFromDnpu}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Users className="w-3.5 h-3.5" /> Muat Nama dari DNPU
            </button>
          )}
          <button
            onClick={() => setActiveTab('upload_arsip')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" /> Upload Scan & Arsip ({hpUploadedDocs.length})
          </button>
          <button
            onClick={() => {
              setPrintSubtype(
                activeTab === 'penerimaan'
                  ? 'hp_penerimaan'
                  : activeTab === 'pengambilan'
                  ? 'hp_pengambilan'
                  : activeTab === 'pengembalian'
                  ? 'hp_pengembalian'
                  : activeTab === 'pengecasan'
                  ? 'hp_pengecasan'
                  : 'hp_rekap'
              );
              setShowPrint(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-4 h-4" /> Cetak Form Manual HP
          </button>
        </div>
      </div>

      {examConfig.moda !== 'online' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          Moda ujian saat ini diatur ke Moda Kertas. Menu Administrasi HP diprioritaskan untuk Moda Online, namun tetap dapat dipakai.
        </div>
      )}

      {/* Sub-navigation 7 tabs */}
      <div className="flex flex-wrap gap-2 text-xs">
        {[
          { id: 'penerimaan', label: '1. Daftar & Penerimaan HP' },
          { id: 'pengambilan', label: '2. Pengambilan Sesi Ujian' },
          { id: 'pengembalian', label: '3. Pengembalian Akhir' },
          { id: 'pengecasan', label: '4. Monitoring Pengecasan' },
          { id: 'pinjaman', label: '5. HP Pinjaman / Inventaris' },
          { id: 'rekap', label: '6. Rekap & Log' },
          { id: 'upload_arsip', label: `7. Upload Scan & Arsip (${hpUploadedDocs.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as typeof activeTab)}
            className={`px-3.5 py-2 font-bold rounded-lg border cursor-pointer whitespace-nowrap ${
              activeTab === t.id
                ? 'bg-emerald-700 border-emerald-700 text-white'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {notice}
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-2.5 rounded-lg text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {chargingAlerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl text-xs space-y-1">
          <p className="font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" /> Peringatan Pengecasan & Pengambilan:
          </p>
          {chargingAlerts.map((a, i) => (
            <p key={i} className="pl-5">• {a}</p>
          ))}
        </div>
      )}

      {/* Tab 1: Penerimaan HP (Minimal required: Nama & Kelas & Kode HP; sisanya opsional/manual) */}
      {activeTab === 'penerimaan' && (
        <div className="space-y-5">
          {canEdit && (
            <form onSubmit={handleAddTitipan} className="bg-white p-5 rounded-xl border border-slate-200 space-y-4 text-xs">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Tambah Data HP Santri (Cukup Nama & Kebutuhan Inti)</h3>
                <p className="text-[11px] text-slate-500">
                  Isian selain Nama, Kelas, dan Kode HP bersifat opsional dan dapat dikosongkan untuk diisi manual di lembar cetak.
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode HP *</label>
                  <input
                    required
                    value={newHp.kodeHp}
                    onChange={(e) => setNewHp({ ...newHp, kodeHp: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ambil Nama dari DNPU</label>
                  <select
                    value={newHp.studentId}
                    onChange={(e) => handleSelectStudentForHp(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">-- Ketik Manual / Pilih DNPU --</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nama} ({s.kelas})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Santri *</label>
                  <input
                    required
                    value={newHp.namaSantri}
                    onChange={(e) => setNewHp({ ...newHp, namaSantri: e.target.value })}
                    placeholder="Wajib diisi"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kelas *</label>
                  <input
                    required
                    value={newHp.kelas}
                    onChange={(e) => setNewHp({ ...newHp, kelas: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Merek / Tipe HP (Opsional)</label>
                  <input
                    value={newHp.merekModel}
                    onChange={(e) => setNewHp({ ...newHp, merekModel: e.target.value })}
                    placeholder="Kosongkan jika diisi manual"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Nama Penyetor (Opsional)</label>
                  <input
                    value={newHp.namaPenyetor}
                    onChange={(e) => setNewHp({ ...newHp, namaPenyetor: e.target.value })}
                    placeholder="Kosongkan jika diisi manual"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Box (Opsional)</label>
                  <input
                    value={newHp.nomorBox}
                    onChange={(e) => setNewHp({ ...newHp, nomorBox: e.target.value })}
                    placeholder="Isi manual"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Slot (Opsional)</label>
                  <input
                    value={newHp.nomorSlot}
                    onChange={(e) => setNewHp({ ...newHp, nomorSlot: e.target.value })}
                    placeholder="Isi manual"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah ke Daftar HP
                </button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="px-3 py-3">Kode HP</th>
                  <th className="px-3 py-3">Nama Santri & Kelas</th>
                  <th className="px-3 py-3">Merek / Tipe (Isian Manual)</th>
                  <th className="px-3 py-3">Box / Slot (Manual)</th>
                  <th className="px-3 py-3">Penyetor (Manual)</th>
                  <th className="px-3 py-3">Kategori</th>
                  {canEdit && <th className="px-3 py-3 text-right">Hapus</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {phoneRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      Belum ada data HP santri. Gunakan tombol "Muat Nama dari DNPU" atau tambahkan manual di atas.
                    </td>
                  </tr>
                ) : (
                  phoneRecords.map((hp) => (
                    <tr key={hp.id}>
                      <td className="px-3 py-2.5 font-mono font-bold text-emerald-800">{hp.kodeHp}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-slate-900">{hp.namaSantri}</div>
                        <div className="text-slate-500">Kelas {hp.kelas}</div>
                      </td>
                      <td className="px-3 py-2">
                        {canEdit ? (
                          <input
                            value={hp.merekModel || ''}
                            placeholder="Isi manual..."
                            onChange={(e) => handleUpdateField(hp.id, { merekModel: e.target.value })}
                            className="w-full px-2 py-1 border border-slate-200 rounded bg-white text-xs"
                          />
                        ) : (
                          hp.merekModel || <span className="text-slate-400 italic">Manual</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {canEdit ? (
                          <div className="flex gap-1">
                            <input
                              value={hp.nomorBox || ''}
                              placeholder="Box"
                              onChange={(e) => handleUpdateField(hp.id, { nomorBox: e.target.value })}
                              className="w-16 px-1.5 py-1 border border-slate-200 rounded font-mono"
                            />
                            <input
                              value={hp.nomorSlot || ''}
                              placeholder="Slot"
                              onChange={(e) => handleUpdateField(hp.id, { nomorSlot: e.target.value })}
                              className="w-12 px-1.5 py-1 border border-slate-200 rounded font-mono text-center"
                            />
                          </div>
                        ) : (
                          <span className="font-mono">{hp.nomorBox || '-'} / {hp.nomorSlot || '-'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {canEdit ? (
                          <input
                            value={hp.namaPenyetor || ''}
                            placeholder="Isi manual..."
                            onChange={(e) => handleUpdateField(hp.id, { namaPenyetor: e.target.value })}
                            className="w-full px-2 py-1 border border-slate-200 rounded bg-white text-xs"
                          />
                        ) : (
                          hp.namaPenyetor || '-'
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {hp.kategori !== 'Titipan' ? (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-950 font-extrabold uppercase text-[11px]">
                            PINJAMAN
                          </span>
                        ) : (
                          <span className="font-semibold text-slate-700">Titipan</span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="px-3 py-2.5 text-right">
                          <button
                            onClick={() => handleDeletePhone(hp.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Pengambilan HP saat ujian */}
      {activeTab === 'pengambilan' && (
        <div className="space-y-5">
          {canEdit && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4 text-xs">
              <h3 className="text-sm font-bold text-slate-900">Catat Pengambilan / Penyetoran Kembali HP Saat Ujian</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unit HP</label>
                  <select
                    value={handoverTargetId}
                    onChange={(e) => setHandoverTargetId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
                  >
                    {phoneRecords.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.kodeHp} — {p.namaSantri} ({p.isSedangDiambil ? 'Sedang Diambil' : 'Di Box'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ruang Ujian</label>
                  <select
                    value={handoverRuang}
                    onChange={(e) => setHandoverRuang(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {rooms.map((r) => (
                      <option key={r.id} value={r.namaRuang}>{r.namaRuang}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Catatan Fisik (Opsional)</label>
                  <input
                    value={handoverNote}
                    onChange={(e) => setHandoverNote(e.target.value)}
                    placeholder="Isi manual bila perlu"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <label className="inline-flex items-center gap-2 font-semibold text-slate-700 py-2">
                  <input
                    type="checkbox"
                    checked={handoverPhysicalMatch}
                    onChange={(e) => setHandoverPhysicalMatch(e.target.checked)}
                  />
                  Jumlah & Fisik Unit Cocok
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleToggleHandover(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
                >
                  <ArrowUpRight className="w-4 h-4" /> Catat Keluar / Diambil Santri
                </button>
                <button
                  onClick={() => handleToggleHandover(false)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  <ArrowDownLeft className="w-4 h-4" /> Catat Masuk Kembali ke Box
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="px-3 py-3">Kode HP</th>
                  <th className="px-3 py-3">Santri</th>
                  <th className="px-3 py-3">Posisi Saat Ini</th>
                  <th className="px-3 py-3">Ruang / Waktu Terakhir</th>
                  <th className="px-3 py-3">Kecocokan Fisik</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {phoneRecords.map((hp) => (
                  <tr key={hp.id}>
                    <td className="px-3 py-2.5 font-mono font-bold">
                      {hp.kodeHp}{' '}
                      {hp.kategori !== 'Titipan' && (
                        <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-950 font-extrabold text-[10px]">
                          PINJAMAN
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-semibold">{hp.namaSantri} ({hp.kelas})</td>
                    <td className="px-3 py-2.5 font-bold">
                      <span className={hp.isSedangDiambil ? 'text-amber-700' : 'text-emerald-700'}>
                        {hp.isSedangDiambil
                          ? 'Sedang Diambil di Ruang Ujian'
                          : hp.nomorBox
                          ? `Tersimpan di ${hp.nomorBox}/${hp.nomorSlot || '-'}`
                          : 'Tersimpan / Menunggu Input Box'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-600">
                      {hp.terakhirDiambilRuang ? `${hp.terakhirDiambilRuang} (${hp.terakhirDiambilJam})` : '-'}
                    </td>
                    <td className="px-3 py-2.5">
                      {hp.jumlahFisikCocok === undefined ? 'Manual' : hp.jumlahFisikCocok ? 'Cocok' : 'Perlu Pemeriksaan'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Pengembalian Akhir */}
      {activeTab === 'pengembalian' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <th className="px-3 py-3">Kode HP</th>
                <th className="px-3 py-3">Santri & Kategori</th>
                <th className="px-3 py-3">Status Pengembalian</th>
                <th className="px-3 py-3">Tanggal & Kondisi</th>
                {canEdit && <th className="px-3 py-3 text-right">Aksi Pengembalian</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {phoneRecords.map((hp) => (
                <tr key={hp.id}>
                  <td className="px-3 py-2.5 font-mono font-bold">{hp.kodeHp}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-bold text-slate-900">{hp.namaSantri}</span> ({hp.kelas}){' '}
                    {hp.kategori !== 'Titipan' && (
                      <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-950 font-extrabold text-[10px]">
                        PINJAMAN
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-semibold">
                    <span
                      className={
                        hp.statusPengembalian === 'Sudah dikembalikan'
                          ? 'text-emerald-700'
                          : hp.statusPengembalian === 'Perlu pemeriksaan'
                          ? 'text-red-700'
                          : 'text-amber-700'
                      }
                    >
                      {hp.statusPengembalian}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {hp.tanggalKembali ? `${hp.tanggalKembali} (${hp.kondisiKembali || 'Baik'})` : '-'}
                  </td>
                  {canEdit && (
                    <td className="px-3 py-2.5 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => handleFinalReturn(hp.id, 'Sudah dikembalikan', 'Baik & Lengkap')}
                        className="px-2.5 py-1 text-xs font-bold bg-emerald-700 text-white rounded cursor-pointer"
                      >
                        Serahkan Kembali
                      </button>
                      <button
                        onClick={() => handleFinalReturn(hp.id, 'Perlu pemeriksaan', 'Perlu pengecekan fisik')}
                        className="px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-900 rounded cursor-pointer"
                      >
                        Tandai Cek
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: Monitoring Pengecasan (input manual opsional) */}
      {activeTab === 'pengecasan' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <th className="px-3 py-3">Kode HP</th>
                <th className="px-3 py-3">Santri</th>
                <th className="px-3 py-3">Box / Slot (Manual)</th>
                <th className="px-3 py-3">Status Pengecasan</th>
                <th className="px-3 py-3 w-28">Baterai (%)</th>
                <th className="px-3 py-3">Jam Mulai / Selesai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {phoneRecords.map((hp) => (
                <tr key={hp.id}>
                  <td className="px-3 py-2.5 font-mono font-bold text-slate-900">
                    <BatteryCharging className="w-3.5 h-3.5 inline mr-1 text-emerald-700" />
                    {hp.kodeHp}
                  </td>
                  <td className="px-3 py-2.5 font-semibold">{hp.namaSantri} ({hp.kelas})</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <input
                        disabled={!canEdit}
                        value={hp.nomorBox || ''}
                        placeholder="Box"
                        onChange={(e) => handleUpdateField(hp.id, { nomorBox: e.target.value })}
                        className="w-20 px-2 py-1 border border-slate-300 rounded font-mono"
                      />
                      <input
                        disabled={!canEdit}
                        value={hp.nomorSlot || ''}
                        placeholder="Slot"
                        onChange={(e) => handleUpdateField(hp.id, { nomorSlot: e.target.value })}
                        className="w-12 px-2 py-1 border border-slate-300 rounded font-mono text-center"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      disabled={!canEdit}
                      value={hp.statusCas}
                      onChange={(e) =>
                        handleUpdateField(hp.id, { statusCas: e.target.value as HpChargingStatus, casPetugas: currentUser.nama })
                      }
                      className="px-2.5 py-1 border border-slate-300 rounded bg-white font-semibold"
                    >
                      <option value="Belum dicas">Belum dicas</option>
                      <option value="Sedang dicas">Sedang dicas</option>
                      <option value="Baterai lemah">Baterai lemah</option>
                      <option value="Baterai penuh">Baterai penuh</option>
                      <option value="Selesai dicas">Selesai dicas</option>
                      <option value="Perlu pemeriksaan">Perlu pemeriksaan</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      disabled={!canEdit}
                      placeholder="-"
                      value={hp.persentaseBaterai ?? ''}
                      onChange={(e) =>
                        handleUpdateField(hp.id, {
                          persentaseBaterai: e.target.value === '' ? undefined : Math.min(100, Math.max(0, Number(e.target.value))),
                          casPetugas: currentUser.nama,
                        })
                      }
                      className="w-20 px-2 py-1 border border-slate-300 rounded font-mono tabular-nums text-center font-bold"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <input
                        type="time"
                        disabled={!canEdit}
                        value={hp.casJamMulai || ''}
                        onChange={(e) => handleUpdateField(hp.id, { casJamMulai: e.target.value })}
                        className="px-1.5 py-1 border border-slate-300 rounded font-mono"
                      />
                      <span>–</span>
                      <input
                        type="time"
                        disabled={!canEdit}
                        value={hp.casJamSelesai || ''}
                        onChange={(e) => handleUpdateField(hp.id, { casJamSelesai: e.target.value })}
                        className="px-1.5 py-1 border border-slate-300 rounded font-mono"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 5: HP Pinjaman / Inventaris */}
      {activeTab === 'pinjaman' && (
        <div className="space-y-5">
          {canEdit && (
            <form onSubmit={handleAddPinjaman} className="bg-white p-5 rounded-xl border border-slate-200 space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Tambah HP Pinjaman (Cukup Nama & Kode)</h3>
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-950 font-extrabold">PINJAMAN</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode Unit *</label>
                  <input
                    required
                    value={newLoan.kodeHp}
                    onChange={(e) => setNewLoan({ ...newLoan, kodeHp: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Peminjam (Nama Santri) *</label>
                  <input
                    required
                    value={newLoan.namaSantri}
                    onChange={(e) => setNewLoan({ ...newLoan, namaSantri: e.target.value })}
                    placeholder="Wajib diisi"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kelas *</label>
                  <input
                    required
                    value={newLoan.kelas}
                    onChange={(e) => setNewLoan({ ...newLoan, kelas: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Pemberi Pinjaman (Opsional)</label>
                  <input
                    value={newLoan.namaPemberiPinjaman}
                    onChange={(e) => setNewLoan({ ...newLoan, namaPemberiPinjaman: e.target.value })}
                    placeholder="Isi manual"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Merek / Model (Opsional)</label>
                  <input
                    value={newLoan.merekModel}
                    onChange={(e) => setNewLoan({ ...newLoan, merekModel: e.target.value })}
                    placeholder="Isi manual"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Rencana Kembali (Opsional)</label>
                  <input
                    type="date"
                    value={newLoan.rencanaKembali}
                    onChange={(e) => setNewLoan({ ...newLoan, rencanaKembali: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-600 mb-1">Kondisi Awal (Opsional)</label>
                  <input
                    value={newLoan.kondisiAwal}
                    onChange={(e) => setNewLoan({ ...newLoan, kondisiAwal: e.target.value })}
                    placeholder="Isi manual"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Simpan HP Pinjaman
                </button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="px-3 py-3">Kode & Label</th>
                  <th className="px-3 py-3">Peminjam</th>
                  <th className="px-3 py-3">Perangkat</th>
                  <th className="px-3 py-3">Sumber Pinjaman</th>
                  <th className="px-3 py-3">Kondisi Awal / Kembali</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {phoneRecords
                  .filter((p) => p.kategori !== 'Titipan')
                  .map((hp) => (
                    <tr key={hp.id}>
                      <td className="px-3 py-2.5 font-mono font-bold">
                        {hp.kodeHp}{' '}
                        <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-950 font-extrabold text-[10px]">
                          PINJAMAN
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-semibold">{hp.namaSantri} ({hp.kelas})</td>
                      <td className="px-3 py-2.5">{hp.merekModel || '-'}</td>
                      <td className="px-3 py-2.5">{hp.namaPemberiPinjaman || '-'}</td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {hp.kondisiAwal || '-'} • {hp.statusPengembalian}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: Rekap DB-driven */}
      {activeTab === 'rekap' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'HP Titipan Santri', value: stats.titipan },
              { label: 'HP Pinjaman', value: stats.pinjaman },
              { label: 'Sedang Diambil / Di Box', value: `${stats.sedangDiambil} / ${stats.belumDiambil}` },
              { label: 'Siap Cas / Sudah Kembali', value: `${stats.siapCas} / ${stats.sudahKembali}` },
            ].map((card, i) => (
              <div key={i} className="bg-white p-4 rounded-xl border border-slate-200">
                <p className="text-xs font-semibold text-slate-500">{card.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-emerald-700" /> Log Riwayat Serah Terima & Pengambilan HP
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="px-3 py-2 text-left">Tanggal / Jam</th>
                    <th className="px-3 py-2 text-left">Kode HP</th>
                    <th className="px-3 py-2 text-left">Santri</th>
                    <th className="px-3 py-2 text-left">Transaksi</th>
                    <th className="px-3 py-2 text-left">Petugas & Ruang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hpLogs.map((lg) => (
                    <tr key={lg.id}>
                      <td className="px-3 py-2 font-mono text-slate-500">
                        {lg.tanggal} {lg.jam}
                      </td>
                      <td className="px-3 py-2 font-mono font-bold">
                        {lg.kodeHp} {lg.kategori !== 'Titipan' && '(PINJAMAN)'}
                      </td>
                      <td className="px-3 py-2 font-semibold">{lg.namaSantri}</td>
                      <td className="px-3 py-2">{lg.jenisTransaksi}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {lg.petugas} {lg.ruang ? `• ${lg.ruang}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* Tab 7: Upload Hasil Cetak/Scan untuk Dibaca Sistem & Arsip Dokumen */}
      {activeTab === 'upload_arsip' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4 text-xs">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-emerald-700" /> Upload Form Manual Administrasi HP (Baca Sistem & Arsipkan)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Unggah foto/scan lembar HP yang telah diisi petugas (JPG/PNG/PDF) atau file Excel/CSV agar sistem membaca otomatis datanya ke rekap HP dan mengarsipkannya bersama dokumen ujian lain.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jenis Form / Dokumen HP</label>
                <select
                  disabled={!canEdit}
                  value={scanDocSubtype}
                  onChange={(e) => setScanDocSubtype(e.target.value as typeof scanDocSubtype)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
                >
                  <option value="hp_penerimaan">Form Penerimaan & Penitipan HP</option>
                  <option value="hp_pengambilan">Form Pengambilan Sesi Ujian</option>
                  <option value="hp_pengembalian">Form Pengembalian Akhir HP</option>
                  <option value="hp_pengecasan">Form Monitoring Pengecasan & Baterai</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Judul Dokumen Arsip</label>
                <input
                  disabled={!canEdit}
                  value={scanTitle}
                  onChange={(e) => setScanTitle(e.target.value)}
                  placeholder="Misal: Scan Penerimaan HP Hari ke-1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pilih File Scan / CSV / Excel</label>
                <input
                  type="file"
                  disabled={!canEdit}
                  accept=".jpg,.jpeg,.png,.webp,.pdf,.csv,.xlsx,.xls"
                  onChange={handleSelectScanFile}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-slate-50 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Catatan Petugas (Opsional)</label>
              <input
                disabled={!canEdit}
                value={scanNotes}
                onChange={(e) => setScanNotes(e.target.value)}
                placeholder="Misal: Hasil pemeriksaan fisik oleh petugas piket pagi"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            {selectedFileMeta && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-900">{selectedFileMeta.fileName}</p>
                    <p className="text-[11px] text-slate-500">{selectedFileMeta.mimeType}</p>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isParsingScan}
                      onClick={handleParseScan}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {isParsingScan ? 'Sedang Membaca...' : 'Baca Sistem (Ekstrak Data)'}
                    </button>
                    <button
                      type="button"
                      disabled={isArchivingDoc}
                      onClick={handleArchiveUploadedScan}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 font-bold text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-60 rounded-lg cursor-pointer"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      {isArchivingDoc ? 'Mengarsipkan...' : 'Arsipkan Dokumen Scan'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Hasil Pembacaan Sistem (Editable Table) */}
          {parsedRows.length > 0 && (
            <div className="bg-white p-5 rounded-xl border border-emerald-200 space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-emerald-950">
                    Hasil Pembacaan Sistem ({parsedRows.length} Baris Terbaca)
                  </h4>
                  {parsedSummary && <p className="text-[11px] text-slate-600 mt-0.5">{parsedSummary}</p>}
                </div>
                {canEdit && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleApplyParsedRows(false)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 font-bold text-emerald-900 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-lg cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Terapkan ke Data HP
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyParsedRows(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
                    >
                      <Archive className="w-3.5 h-3.5" /> Terapkan & Arsipkan Sekaligus
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <th className="px-2.5 py-2">Kode HP</th>
                      <th className="px-2.5 py-2">Nama Santri</th>
                      <th className="px-2.5 py-2">Kelas</th>
                      <th className="px-2.5 py-2">Merek / Kondisi</th>
                      <th className="px-2.5 py-2">Box / Slot</th>
                      <th className="px-2.5 py-2 w-20">Baterai %</th>
                      <th className="px-2.5 py-2">Jam / Petugas</th>
                      <th className="px-2.5 py-2">Status Pengembalian</th>
                      <th className="px-2.5 py-2 text-right">Hapus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-2 py-1.5">
                          <input
                            value={row.kodeHp || ''}
                            onChange={(e) => {
                              const next = [...parsedRows];
                              next[idx] = { ...row, kodeHp: e.target.value.toUpperCase() };
                              setParsedRows(next);
                            }}
                            className="w-24 px-2 py-1 border border-slate-200 rounded font-mono font-bold"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            value={row.namaSantri}
                            onChange={(e) => {
                              const next = [...parsedRows];
                              next[idx] = { ...row, namaSantri: e.target.value };
                              setParsedRows(next);
                            }}
                            className="w-40 px-2 py-1 border border-slate-200 rounded font-semibold"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            value={row.kelas || ''}
                            onChange={(e) => {
                              const next = [...parsedRows];
                              next[idx] = { ...row, kelas: e.target.value };
                              setParsedRows(next);
                            }}
                            className="w-16 px-2 py-1 border border-slate-200 rounded"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            value={row.merekModel || row.kondisi || ''}
                            onChange={(e) => {
                              const next = [...parsedRows];
                              next[idx] = { ...row, merekModel: e.target.value, kondisi: e.target.value };
                              setParsedRows(next);
                            }}
                            className="w-32 px-2 py-1 border border-slate-200 rounded"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex gap-1">
                            <input
                              value={row.nomorBox || ''}
                              placeholder="Box"
                              onChange={(e) => {
                                const next = [...parsedRows];
                                next[idx] = { ...row, nomorBox: e.target.value };
                                setParsedRows(next);
                              }}
                              className="w-16 px-1.5 py-1 border border-slate-200 rounded font-mono"
                            />
                            <input
                              value={row.nomorSlot || ''}
                              placeholder="Slot"
                              onChange={(e) => {
                                const next = [...parsedRows];
                                next[idx] = { ...row, nomorSlot: e.target.value };
                                setParsedRows(next);
                              }}
                              className="w-12 px-1.5 py-1 border border-slate-200 rounded font-mono text-center"
                            />
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={row.persentaseBaterai ?? ''}
                            onChange={(e) => {
                              const next = [...parsedRows];
                              next[idx] = {
                                ...row,
                                persentaseBaterai: e.target.value === '' ? undefined : Number(e.target.value),
                              };
                              setParsedRows(next);
                            }}
                            className="w-16 px-1.5 py-1 border border-slate-200 rounded font-mono text-center"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex gap-1">
                            <input
                              value={row.jamTransaksi || ''}
                              placeholder="Jam"
                              onChange={(e) => {
                                const next = [...parsedRows];
                                next[idx] = { ...row, jamTransaksi: e.target.value };
                                setParsedRows(next);
                              }}
                              className="w-16 px-1.5 py-1 border border-slate-200 rounded font-mono"
                            />
                            <input
                              value={row.petugas || ''}
                              placeholder="Petugas"
                              onChange={(e) => {
                                const next = [...parsedRows];
                                next[idx] = { ...row, petugas: e.target.value };
                                setParsedRows(next);
                              }}
                              className="w-24 px-1.5 py-1 border border-slate-200 rounded"
                            />
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={row.statusPengembalian || 'Belum dikembalikan'}
                            onChange={(e) => {
                              const next = [...parsedRows];
                              next[idx] = {
                                ...row,
                                statusPengembalian: e.target.value as ParsedHpRowDraft['statusPengembalian'],
                              };
                              setParsedRows(next);
                            }}
                            className="px-2 py-1 border border-slate-200 rounded bg-white"
                          >
                            <option value="Belum dikembalikan">Belum dikembalikan</option>
                            <option value="Sudah dikembalikan">Sudah dikembalikan</option>
                            <option value="Perlu pemeriksaan">Perlu pemeriksaan</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => setParsedRows(parsedRows.filter((_, i) => i !== idx))}
                            className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Daftar Dokumen Administrasi HP yang Sudah Diarsipkan */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Arsip Dokumen Administrasi HP Terunggah ({hpUploadedDocs.length})
                </h4>
                <p className="text-[11px] text-slate-500">
                  Dokumen ini otomatis tersimpan dan dapat dibuka kembali di menu Arsip Ujian bersama dokumen ujian lainnya.
                </p>
              </div>
            </div>

            {hpUploadedDocs.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-300 rounded-lg text-xs text-slate-500">
                Belum ada dokumen scan Administrasi HP yang diarsipkan.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <th className="px-3 py-2.5">Judul Dokumen</th>
                      <th className="px-3 py-2.5">Jenis Form</th>
                      <th className="px-3 py-2.5">File & Hasil Baca</th>
                      <th className="px-3 py-2.5">Diunggah Oleh</th>
                      <th className="px-3 py-2.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {hpUploadedDocs.map((doc) => (
                      <tr key={doc.id}>
                        <td className="px-3 py-2.5 font-bold text-slate-900">{doc.title}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-700">{doc.subType || 'admin_hp'}</td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-slate-800">{doc.fileName}</div>
                          {doc.extractedSummary && (
                            <div className="text-[11px] text-emerald-700">
                              {doc.extractedRowCount ? `${doc.extractedRowCount} baris • ` : ''}
                              {doc.extractedSummary}
                            </div>
                          )}
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
        </div>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-3xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">{previewDoc.title}</h4>
                <p className="text-xs text-slate-500">{previewDoc.fileName} • {previewDoc.mimeType}</p>
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
                  <p className="font-semibold">File spreadsheet/teks: {previewDoc.fileName}</p>
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
    </div>
  );
};
