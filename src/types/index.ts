/**
 * Core Types Definition for SAUM (Sistem Administrasi Ujian Madrasah) - Upgraded Edition
 */

export type JenjangMadrasah = 'MI' | 'MTs' | 'MA' | 'MAK';
export type SemesterType = 'Ganjil' | 'Genap';
export type JenisKelamin = 'L' | 'P';
export type StatusPeserta = 'Aktif' | 'Cadangan' | 'Nonaktif';
export type ModaUjian = 'online' | 'kertas';
export type UserRole = 'Super Admin' | 'Admin Ujian' | 'Panitia' | 'Petugas HP' | 'Pengawas';
export type PaperSize = 'A4' | 'F4';
export type PaperOrientation = 'portrait' | 'landscape';

export interface UserAccount {
  id: string;
  username: string;
  nama: string;
  role: UserRole;
  jabatan: string;
  aktif: boolean;
}

export interface MadrasahProfile {
  namaMadrasah: string;
  jenjang: JenjangMadrasah;
  nsm: string;
  npsn: string;
  alamat: string;
  desaKelurahan: string;
  kecamatan: string;
  kabupatenKota: string;
  provinsi: string;
  kodePos: string;
  telepon: string;
  email: string;
  website: string;
  namaKepala: string;
  nipKepala: string;
  namaKetuaPanitia?: string;
  nipKetuaPanitia?: string;
  tahunPelajaran: string;
  semester: SemesterType;
  jenisUjian: string;
  tempatTandaTangan: string;
  tanggalSurat: string;
  logoMadrasahUrl?: string;
  logoKemenagUrl?: string;
  ttdKepalaUrl?: string; // Uploaded Kepala Madrasah signature image (JPG/PNG)
  kopImageUrl?: string; // Uploaded original KOP image (JPG/PNG)
  kopWidthPercent?: number; // e.g., 100
  kopPosition?: 'left' | 'center' | 'right';
  kopMarginTopMm?: number;
  kopMarginBottomMm?: number;
  useOriginalKopImage?: boolean;
  kopBaris1?: string; // Baris 1 KOP, mis. KEMENTERIAN AGAMA REPUBLIK INDONESIA
  kopBaris2?: string; // Baris 2 KOP, mis. KANTOR KEMENTERIAN AGAMA KAB. ...
  kopBaris3?: string; // Baris 3 KOP opsional (Yayasan / Unit)
  showLogoKemenag?: boolean;
  showLogoMadrasah?: boolean;
  kopLogoSizePx?: number;
}

export interface ExamConfig {
  id: string;
  namaUjian: string;
  tahunPelajaran: string;
  jenjangLabel: string; // e.g. "X, XI, XII" or "VII, VIII, IX"
  registeredClasses: string[]; // e.g. ["X-A", "X-B", "XI-A", "XII-A", "XII-B", "XII-C"]
  tanggalMulai: string;
  tanggalSelesai: string;
  jumlahHari: number;
  jumlahMapel: number;
  moda: ModaUjian;
  jumlahRuang: number;
  jumlahSesi: number; // Used when moda === 'online'
  jamPelaksanaan: string; // e.g. "07:30 - 12:00 WIB"
  seragamPerHariJenjang?: Record<string, Record<string, string>>; // e.g. { Senin: { X: 'Putih Abu', XI: 'Pramuka', XII: 'Batik' } }
  isDnpuFinalized: boolean;
  isNomorFinalized: boolean;
  isDenahLokasiFinalized: boolean;
}

export interface PaperPreset {
  id:
    | 'denah_lokasi'
    | 'denah_duduk'
    | 'daftar_hadir'
    | 'label_ruang'
    | 'berita_acara'
    | 'segel'
    | 'dokumen_hp'
    | 'kartu_peserta'
    | 'nomor_meja'
    | 'default';
  label: string;
  size: PaperSize;
  orientation: PaperOrientation;
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  scalePercent?: number;
  cardsPerPage?: 4 | 6;
  fontSizePt: number;
  lineHeight: number;
  showKop: boolean;
  headerText: string;
  footerText: string;
}

export interface Student {
  id: string;
  nis: string;
  nisn: string;
  nama: string;
  tempatLahir: string;
  tanggalLahir: string;
  jenisKelamin: JenisKelamin;
  kelas: string;
  jenjang?: string; // Derived or explicit e.g. "X", "XI", "XII"
  nomorPeserta: string;
  sesi?: number; // 1, 2, ... (for online mode)
  ruangId?: string;
  nomorMeja?: number;
  usernameUjian?: string; // Username login ruang ujian (CBT/Online)
  passwordUjian?: string; // Password login ruang ujian (CBT/Online)
  fotoUrl?: string;
  barcodeUrl?: string; // Uploaded barcode/QR image specifically for this student
  customLink?: string; // Optional manual URL link for this student
  status: StatusPeserta;
}

export interface CommitteeMember {
  id: string;
  nama: string;
  nip: string;
  jabatan: string;
  tugas: string;
  noHp: string;
  status: 'Aktif' | 'Nonaktif';
}

export interface Supervisor {
  id: string;
  nama: string;
  nip: string;
  asalMadrasah: string;
  noHp: string;
  status: 'Aktif' | 'Nonaktif';
}

export interface ExamSubject {
  id: string;
  kode: string;
  nama: string;
  kategori: 'Agama' | 'Umum' | 'Muatan Lokal';
  durasiMenit: number;
  jenjang?: string;
}

export interface ExamSchedule {
  id: string;
  mapelId: string;
  mapelPerKelas?: Record<string, string>; // Optional className -> mapelId mapping for per-class matrix
  tanggal: string; // YYYY-MM-DD
  hari: string;
  jamKe?: number;
  sesi: number;
  waktuMulai: string;
  waktuSelesai: string;
  jenjang?: string;
  seragamPerJenjang?: Record<string, string>; // e.g. { X: 'Putih Abu', XI: 'Pramuka', XII: 'Batik' }
  ruangIds: string[];
}

export interface SupervisorAssignment {
  id: string;
  scheduleId: string;
  roomId: string;
  sesi: number;
  pengawas1Id?: string;
  pengawas2Id?: string;
}

export type SeatingPattern = 'snake' | 'zigzag' | 'straight';

export interface ExamRoom {
  id: string;
  nomorRuang: string; // "01", "02", etc.
  namaRuang: string; // "Ruang 01"
  kapasitas: number; // ideal 22, incidental max 23 (+ kursi tambahan)
  jumlahBaris: number;
  jumlahKolom: number;
  polaTempatDuduk: SeatingPattern;
  posisiPintu: 'kiri_depan' | 'kanan_depan' | 'kiri_belakang' | 'kanan_belakang';
  posisiPengawas: 'depan_tengah' | 'depan_kiri' | 'depan_kanan';
  pengawas1Id?: string;
  pengawas2Id?: string;
  isLocked?: boolean;
  // Manajemen Meja & Kursi dan Edit Denah
  mejaAwal?: number;
  kursiAwal?: number;
  mejaTambahan?: number;
  kursiTambahan?: number;
  statusFasilitas?: 'NORMAL' | 'INSIDENTAL';
  keteranganFasilitas?: string;
  jarakAntarMeja?: 'rapat' | 'standar' | 'renggang';
  incidentalSeatNo?: number;
}

// Physical Classroom Location Mapping (Denah Lokasi)
export interface PhysicalClassroom {
  id: string;
  namaKelas: string; // e.g., "KELAS X-B", "KELAS X-A", "KELAS XII-A", "KELAS XI-A", "KELAS XII-C", "KELAS XII-B"
  row: 0 | 1; // 0 = Atas, 1 = Bawah
  col: 0 | 1 | 2; // 0 = Kolom 1 (Barat/Kiri), 1 = Kolom 2, 2 = Kolom 3
  assignedRoomIds: string[]; // Supports mapping to 1 or multiple exam rooms (or per session)
  sessionRoomMap?: Record<number, string>; // Optional sesi -> roomId mapping
}

export interface NumberingConfig {
  kodeTahun: string;
  kodeMadrasah: string;
  digitUrut: number;
  nomorAwal?: number;
  pemisah: string;
  prefixTambahan?: string;
  polaFormat?: string; // e.g., "{tahun}{sep}{madrasah}{sep}{kodeKelas}{sep}{urut}"
  kodeKelasMap?: Record<string, string>; // e.g. { "X": "10", "XI": "11", "XII": "12" }
  urutanKelas?: string[]; // Order of classes/jenjang
  urutBerdasarkan: 'kelas_lalu_nama' | 'nama_alfabetis' | 'nisn' | 'nis';
  barcodeMode?: 'auto' | 'uploaded' | 'link_qr';
  uploadedBarcodeUrl?: string; // Global uploaded barcode image
  manualLinkUrl?: string; // Manual link URL written by operator
  showDeskNumber?: boolean;
  userBasis?: 'nomor_peserta' | 'nisn' | 'nis' | 'kode_urut';
  userPrefix?: string;
  passwordLength?: number;
}

export interface NumberingHistoryEntry {
  id: string;
  timestamp: string;
  actor: string;
  totalGenerated: number;
  formatPreview: string;
  note: string;
}

export interface RoomDistributionConfig {
  kapasitasPerRuang: number;
  metode: 'nomor_peserta' | 'seimbang_gender' | 'silang_kelas' | 'silang_jenjang_11_11';
  jumlahRuangManual?: number;
  allowIncidental23?: boolean;
}

export interface SealDocConfig {
  id: string; // `${scheduleId}_${roomId}`
  scheduleId: string;
  roomId: string;
  jumlahSoal: number;
  jumlahLjk: number;
  jumlahBeritaAcara: number;
  jumlahDaftarHadir: number;
  catatan?: string;
}

export interface TataTertibDoc {
  id: string;
  target: 'peserta' | 'pengawas';
  title: string;
  sourceFileName?: string;
  contentLines: string[];
  paperSize: PaperSize;
  marginMm: number;
  isFinalized: boolean;
  updatedAt: string;
}

// Administrasi HP Santri (Khusus Moda Online)
export type HpCategory = 'Titipan' | 'Pinjaman' | 'Inventaris';
export type HpChargingStatus =
  | 'Belum dicas'
  | 'Sedang dicas'
  | 'Baterai penuh'
  | 'Baterai lemah'
  | 'Selesai dicas'
  | 'Perlu pemeriksaan';

export type HpReturnStatus = 'Belum dikembalikan' | 'Sudah dikembalikan' | 'Perlu pemeriksaan';

export interface SantriPhoneRecord {
  id: string;
  kodeHp: string; // Unik e.g. "HP-001" or "PINJ-001"
  studentId?: string;
  namaSantri: string;
  kelas: string;
  jenisHp?: string; // Optional manual field
  merekModel?: string; // Optional manual field
  warna?: string; // Optional manual field
  imei?: string;
  kategori: HpCategory;
  // Pinjaman fields
  namaPemberiPinjaman?: string;
  tanggalPinjam?: string;
  rencanaKembali?: string;
  kondisiAwal?: string;
  kondisiAkhir?: string;
  // Penerimaan
  tanggalDiterima?: string;
  namaPenyetor?: string;
  namaPenerima?: string;
  // Pengambilan / Pembagian selama ujian
  isSedangDiambil: boolean;
  terakhirDiambilTanggal?: string;
  terakhirDiambilJam?: string;
  terakhirDiambilPetugas?: string;
  terakhirDiambilRuang?: string;
  jumlahFisikCocok?: boolean;
  // Pengecasan
  nomorBox?: string;
  nomorSlot?: string;
  statusCas: HpChargingStatus;
  persentaseBaterai?: number; // Manual input
  casJamMulai?: string;
  casJamSelesai?: string;
  casPetugas?: string;
  // Pengembalian akhir
  statusPengembalian: HpReturnStatus;
  tanggalKembali?: string;
  jamKembali?: string;
  kondisiKembali?: string;
  penerimaKembali?: string;
  petugasKembali?: string;
  catatan?: string;
}

export interface HpHandoverLog {
  id: string;
  hpId: string;
  kodeHp: string;
  namaSantri: string;
  kelas: string;
  kategori: HpCategory;
  jenisTransaksi: 'Penerimaan' | 'Pengambilan' | 'Pengembalian';
  tanggal: string;
  jam: string;
  ruang?: string;
  petugas: string;
  penerimaAtauPenyetor: string;
  jumlahFisik: number;
  kondisi?: string;
}

export type UploadedDocCategory =
  | 'admin_hp'
  | 'daftar_hadir'
  | 'berita_acara'
  | 'jadwal'
  | 'dokumen_lain';

export interface UploadedExamDocument {
  id: string;
  title: string;
  category: UploadedDocCategory;
  subType?: string;
  fileName: string;
  mimeType: string;
  fileDataUrl: string;
  uploadedAt: string;
  uploadedBy: string;
  notes?: string;
  extractedRowCount?: number;
  extractedSummary?: string;
}

export interface CustomSupplyItem {
  id: string;
  namaBarang: string;
  kategori: 'Meja & Kursi' | 'ATK & Ruang' | 'Perangkat Online / HP' | 'Lainnya';
  kebutuhan: number;
  tersedia: number;
  satuan: string;
  keterangan?: string;
}

export interface DuplicationStatusEntry {
  id: string;
  statusGanda: 'Belum Digandakan' | 'Proses' | 'Selesai';
  petugas?: string;
  catatan?: string;
}

export interface RekapConfig {
  cadanganPerRuang: number;
  kursiPerMeja?: number; // Default 2 ("1 Meja = 2 Kursi", sehingga kursi > meja)
  basisHitungKursi?: 'peserta_aktif' | 'kapasitas_ruang';
  customSupplies: CustomSupplyItem[];
  duplicationStatuses: Record<string, DuplicationStatusEntry>;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: UserRole;
  module: string;
  action: string;
  detail: string;
}

export interface ExamArchiveRecord {
  id: string;
  namaUjian: string;
  tahunPelajaran: string;
  jenjang: string;
  tanggal: string;
  moda: ModaUjian;
  archivedAt: string;
  archivedBy: string;
  isLocked: boolean;
  unlockReason?: string;
  snapshot: {
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
    uploadedDocuments?: UploadedExamDocument[];
    rekapConfig?: RekapConfig;
  };
}

export type DocumentType =
  | 'dnpu'
  | 'nomor_peserta'
  | 'pembagian_ruang'
  | 'denah_lokasi'
  | 'denah_ruang'
  | 'daftar_hadir'
  | 'label_ruang'
  | 'jadwal_ujian'
  | 'daftar_pengawas'
  | 'surat_tugas'
  | 'segel_soal'
  | 'berita_acara'
  | 'tata_tertib'
  | 'hp_penerimaan'
  | 'hp_pengambilan'
  | 'hp_pengembalian'
  | 'hp_pengecasan'
  | 'hp_rekap'
  | 'kartu_peserta'
  | 'label_meja'
  | 'label_pintu'
  | 'label_amplop'
  | 'sk_panitia'
  | 'rekap_laporan'
  | 'rekap_perlengkapan'
  | 'bundle_semua';
