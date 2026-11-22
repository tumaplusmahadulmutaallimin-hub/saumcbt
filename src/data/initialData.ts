import {
  CommitteeMember,
  ExamArchiveRecord,
  ExamConfig,
  ExamRoom,
  ExamSchedule,
  ExamSubject,
  MadrasahProfile,
  NumberingConfig,
  PaperPreset,
  PhysicalClassroom,
  RekapConfig,
  RoomDistributionConfig,
  SantriPhoneRecord,
  SealDocConfig,
  Student,
  Supervisor,
  SupervisorAssignment,
  TataTertibDoc,
  UploadedExamDocument,
  UserAccount,
} from '../types';

export const INITIAL_MADRASAH_PROFILE: MadrasahProfile = {
  namaMadrasah: '',
  jenjang: 'MA',
  nsm: '',
  npsn: '',
  alamat: '',
  desaKelurahan: '',
  kecamatan: '',
  kabupatenKota: '',
  provinsi: '',
  kodePos: '',
  telepon: '',
  email: '',
  website: '',
  namaKepala: '',
  nipKepala: '',
  namaKetuaPanitia: '',
  nipKetuaPanitia: '',
  tahunPelajaran: '2025/2026',
  semester: 'Genap',
  jenisUjian: 'Asesmen Madrasah',
  tempatTandaTangan: '',
  tanggalSurat: '',
  kopWidthPercent: 100,
  kopPosition: 'center',
  kopMarginTopMm: 0,
  kopMarginBottomMm: 4,
  useOriginalKopImage: false,
  kopBaris1: 'KEMENTERIAN AGAMA REPUBLIK INDONESIA',
  kopBaris2: '',
  kopBaris3: '',
  showLogoKemenag: true,
  showLogoMadrasah: true,
  kopLogoSizePx: 64,
};

export const INITIAL_EXAM_CONFIG: ExamConfig = {
  id: 'exam-aktif',
  namaUjian: '',
  tahunPelajaran: '2025/2026',
  jenjangLabel: '',
  registeredClasses: [],
  tanggalMulai: '',
  tanggalSelesai: '',
  jumlahHari: 0,
  jumlahMapel: 0,
  moda: 'online',
  jumlahRuang: 0,
  jumlahSesi: 1,
  jamPelaksanaan: '07:30 - 12:00 WIB',
  seragamPerHariJenjang: {},
  isDnpuFinalized: false,
  isNomorFinalized: false,
  isDenahLokasiFinalized: false,
};

export const INITIAL_NUMBERING_CONFIG: NumberingConfig = {
  kodeTahun: '26',
  kodeMadrasah: '01',
  digitUrut: 3,
  nomorAwal: 1,
  pemisah: '-',
  polaFormat: '{tahun}{sep}{madrasah}{sep}{kodeKelas}{sep}{urut}',
  kodeKelasMap: {},
  urutanKelas: [],
  urutBerdasarkan: 'kelas_lalu_nama',
  barcodeMode: 'auto',
  manualLinkUrl: '',
  showDeskNumber: true,
};

export const INITIAL_ROOM_CONFIG: RoomDistributionConfig = {
  kapasitasPerRuang: 20,
  metode: 'silang_jenjang_11_11',
  jumlahRuangManual: 0,
};

export const INITIAL_ROOMS: ExamRoom[] = [];

export const INITIAL_PHYSICAL_CLASSROOMS: PhysicalClassroom[] = [];

export const INITIAL_PAPER_PRESETS: PaperPreset[] = [
  { id: 'kartu_peserta', label: 'Kartu Peserta (6/F4)', size: 'F4', orientation: 'portrait', marginTopMm: 15, marginBottomMm: 15, marginLeftMm: 15, marginRightMm: 15, scalePercent: 100, cardsPerPage: 6, fontSizePt: 9.5, lineHeight: 1.25, showKop: false, headerText: '', footerText: '' },
  { id: 'nomor_meja', label: 'Nomor Meja (6/F4)', size: 'F4', orientation: 'portrait', marginTopMm: 15, marginBottomMm: 15, marginLeftMm: 15, marginRightMm: 15, scalePercent: 100, cardsPerPage: 6, fontSizePt: 10, lineHeight: 1.25, showKop: false, headerText: '', footerText: '' },
  { id: 'denah_lokasi', label: 'Denah Lokasi', size: 'A4', orientation: 'landscape', marginTopMm: 8, marginBottomMm: 8, marginLeftMm: 10, marginRightMm: 10, scalePercent: 100, fontSizePt: 10, lineHeight: 1.35, showKop: true, headerText: '', footerText: 'Dokumen Resmi Panitia Ujian Madrasah' },
  { id: 'denah_duduk', label: 'Denah Tempat Duduk', size: 'A4', orientation: 'portrait', marginTopMm: 8, marginBottomMm: 8, marginLeftMm: 10, marginRightMm: 10, scalePercent: 100, fontSizePt: 10, lineHeight: 1.3, showKop: true, headerText: '', footerText: '' },
  { id: 'daftar_hadir', label: 'Daftar Hadir', size: 'A4', orientation: 'portrait', marginTopMm: 8, marginBottomMm: 8, marginLeftMm: 10, marginRightMm: 10, scalePercent: 100, fontSizePt: 10, lineHeight: 1.35, showKop: true, headerText: '', footerText: '' },
  { id: 'label_ruang', label: 'Label Ruang', size: 'A4', orientation: 'portrait', marginTopMm: 10, marginBottomMm: 10, marginLeftMm: 12, marginRightMm: 12, scalePercent: 100, fontSizePt: 12, lineHeight: 1.4, showKop: true, headerText: '', footerText: '' },
  { id: 'berita_acara', label: 'Berita Acara', size: 'A4', orientation: 'portrait', marginTopMm: 10, marginBottomMm: 10, marginLeftMm: 12, marginRightMm: 12, scalePercent: 100, fontSizePt: 11, lineHeight: 1.45, showKop: true, headerText: '', footerText: '' },
  { id: 'segel', label: 'Segel Soal & LJK', size: 'A4', orientation: 'portrait', marginTopMm: 10, marginBottomMm: 10, marginLeftMm: 12, marginRightMm: 12, scalePercent: 100, fontSizePt: 11, lineHeight: 1.4, showKop: true, headerText: '', footerText: '' },
  { id: 'dokumen_hp', label: 'Dokumen HP Santri', size: 'A4', orientation: 'portrait', marginTopMm: 8, marginBottomMm: 8, marginLeftMm: 10, marginRightMm: 10, scalePercent: 100, fontSizePt: 10, lineHeight: 1.35, showKop: true, headerText: '', footerText: '' },
  { id: 'default', label: 'Umum / Lainnya', size: 'A4', orientation: 'portrait', marginTopMm: 8, marginBottomMm: 8, marginLeftMm: 10, marginRightMm: 10, scalePercent: 100, fontSizePt: 10.5, lineHeight: 1.4, showKop: true, headerText: '', footerText: '' },
];

export const INITIAL_COMMITTEE: CommitteeMember[] = [];

export const INITIAL_SUPERVISORS: Supervisor[] = [];

export const INITIAL_SUBJECTS: ExamSubject[] = [];

export const INITIAL_SCHEDULES: ExamSchedule[] = [];

export const INITIAL_SUPERVISOR_ASSIGNMENTS: SupervisorAssignment[] = [];

export const INITIAL_SEAL_CONFIGS: SealDocConfig[] = [];

export const INITIAL_TATA_TERTIB: TataTertibDoc[] = [
  {
    id: 'tatib-peserta',
    target: 'peserta',
    title: 'TATA TERTIB PESERTA UJIAN MADRASAH',
    contentLines: [
      '1. Peserta ujian memasuki ruangan setelah tanda masuk dibunyikan, yakni 15 (lima belas) menit sebelum ujian dimulai.',
      '2. Peserta yang terlambat hadir hanya diperkenankan mengikuti ujian setelah mendapat izin dari Ketua Panitia/Kepala Madrasah tanpa perpanjangan waktu.',
      '3. Peserta ujian dilarang membawa catatan, buku, alat komunikasi elektronik (HP/Gadget) pribadi tanpa izin, kalkulator, dan tas ke dalam ruang ujian.',
      '4. Peserta wajib membawa Kartu Peserta Ujian dan meletakkannya di atas meja sebelah kanan depan sesuai nomor meja.',
      '5. Peserta mengisi daftar hadir dengan menggunakan pulpen hitam/biru yang disediakan.',
      '6. Selama ujian berlangsung, peserta dilarang bekerja sama, saling mencontek, atau meninggalkan ruang ujian tanpa izin pengawas.',
      '7. Peserta yang melanggar tata tertib ujian akan diberi peringatan/teguran oleh pengawas ruang dan dicatat dalam Berita Acara Pelaksanaan Ujian.',
    ],
    paperSize: 'A4',
    marginMm: 10,
    isFinalized: false,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tatib-pengawas',
    target: 'pengawas',
    title: 'TATA TERTIB PENGAWAS RUANG UJIAN',
    contentLines: [
      '1. Pengawas ruang hadir di madrasah penyelenggara 30 (tiga puluh) menit sebelum ujian dimulai untuk menerima pengarahan dan berkas ruang dari panitia.',
      '2. Pengawas memeriksa kesiapan ruang, denah tempat duduk, serta mencocokkan identitas kartu peserta dengan daftar hadir.',
      '3. Untuk moda online, pengawas memastikan perangkat HP/CBT santri dalam pengawasan dan hanya digunakan untuk akses portal ujian resmi.',
      '4. Selama ujian berlangsung, pengawas wajib menjaga ketertiban, tidak merokok, dan tidak memberi petunjuk jawaban soal kepada peserta.',
      '5. Setelah waktu ujian selesai, pengawas mengisi dan menandatangani Berita Acara Pelaksanaan Ujian serta menyerahkan berkas ke Panitia.',
    ],
    paperSize: 'A4',
    marginMm: 10,
    isFinalized: false,
    updatedAt: new Date().toISOString(),
  },
];

export const INITIAL_STUDENTS: Student[] = [];

export const INITIAL_PHONE_RECORDS: SantriPhoneRecord[] = [];

export const INITIAL_USERS: UserAccount[] = [
  { id: 'u-1', username: 'superadmin', nama: 'Arif Syaifudin, S.H', role: 'Super Admin', jabatan: 'Super Admin / Operator Utama', aktif: true },
  { id: 'u-2', username: 'adminujian', nama: 'Admin Ujian', role: 'Admin Ujian', jabatan: 'Ketua Panitia Ujian', aktif: true },
  { id: 'u-3', username: 'panitia', nama: 'Panitia Ujian', role: 'Panitia', jabatan: 'Sekretaris Panitia', aktif: true },
  { id: 'u-4', username: 'petugashp', nama: 'Petugas HP', role: 'Petugas HP', jabatan: 'Koordinator Penitipan HP', aktif: true },
  { id: 'u-5', username: 'pengawas', nama: 'Pengawas Ruang', role: 'Pengawas', jabatan: 'Pengawas Ruang Ujian', aktif: true },
];

export const INITIAL_ARCHIVES: ExamArchiveRecord[] = [];

export const INITIAL_REKAP_CONFIG: RekapConfig = {
  cadanganPerRuang: 2,
  kursiPerMeja: 2,
  basisHitungKursi: 'peserta_aktif',
  customSupplies: [],
  duplicationStatuses: {},
};

export const INITIAL_UPLOADED_DOCUMENTS: UploadedExamDocument[] = [];
