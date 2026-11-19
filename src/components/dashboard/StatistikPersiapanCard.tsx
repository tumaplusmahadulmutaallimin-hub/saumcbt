import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  DoorClosed,
  KeyRound,
  Users,
} from 'lucide-react';
import { ExamConfig, ExamRoom, Student } from '../../types';

export interface PreparationCheckItem {
  id: string;
  title: string;
  detail: string;
  isReady: boolean;
  targetTab: string;
}

interface StatistikPersiapanCardProps {
  students: Student[];
  rooms: ExamRoom[];
  examConfig: ExamConfig;
  checks: PreparationCheckItem[];
  onNavigate: (tab: string) => void;
}

export const StatistikPersiapanCard: React.FC<StatistikPersiapanCardProps> = ({
  students,
  rooms,
  examConfig,
  checks,
  onNavigate,
}) => {
  const activeStudents = students.filter((s) => s.status === 'Aktif');
  const maleCount = activeStudents.filter((s) => s.jenisKelamin === 'L').length;
  const femaleCount = activeStudents.filter((s) => s.jenisKelamin === 'P').length;
  const numberedCount = activeStudents.filter((s) => Boolean(s.nomorPeserta?.trim())).length;
  const credentialedCount = activeStudents.filter(
    (s) => Boolean(s.usernameUjian?.trim()) && Boolean(s.passwordUjian?.trim())
  ).length;
  const seatedCount = activeStudents.filter((s) => Boolean(s.ruangId) && Boolean(s.nomorMeja)).length;
  const totalRoomCapacity = rooms.reduce((sum, r) => sum + (r.kapasitas || 0), 0);

  const readyCount = checks.filter((c) => c.isReady).length;
  const readinessPercent = checks.length > 0 ? Math.round((readyCount / checks.length) * 100) : 0;

  return (
    <section
      aria-label="Ringkasan Statistik & Kelengkapan Data Persiapan Ujian"
      className="bg-white rounded-xl border border-slate-200 p-5 space-y-5"
    >
      {/* Header + Progress Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Ringkasan Statistik &amp; Status Kelengkapan Persiapan Ujian
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pantau keterisian DNPU, ruang ujian, penomoran, serta akun login peserta sebelum pelaksanaan.
          </p>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="w-40 sm:w-48">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-600">Kelengkapan Data</span>
              <span
                data-testid="stat-kelengkapan-percent"
                className={`font-mono font-bold tabular-nums ${
                  readinessPercent === 100 ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {readinessPercent}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className={`h-full transition-all duration-300 ${
                  readinessPercent === 100 ? 'bg-emerald-700' : 'bg-amber-500'
                }`}
                style={{ width: `${readinessPercent}%` }}
              />
            </div>
          </div>
          <div className="text-right">
            <span className="block text-[11px] text-slate-500 font-semibold">Tahap Siap</span>
            <span className="text-sm font-bold font-mono tabular-nums text-slate-900">
              {readyCount} / {checks.length}
            </span>
          </div>
        </div>
      </div>

      {/* 3 Compact Flat Metric Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-500">Total Peserta Aktif</p>
            <p
              data-testid="stat-total-peserta"
              className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1"
            >
              {activeStudents.length}
            </p>
            <p className="text-[11px] text-slate-600 mt-1 tabular-nums">
              {maleCount} L &middot; {femaleCount} P &middot; {students.length} total baris
            </p>
          </div>
          <Users className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
        </div>

        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-500">Ruang &amp; Tempat Duduk</p>
            <p
              data-testid="stat-jumlah-ruang"
              className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1"
            >
              {rooms.length} Ruang
            </p>
            <p className="text-[11px] text-slate-600 mt-1 tabular-nums">
              {seatedCount}/{activeStudents.length} tertata &middot; Kapasitas {totalRoomCapacity} kursi
              {examConfig.moda === 'online' ? ` \u00B7 ${examConfig.jumlahSesi} Sesi` : ''}
            </p>
          </div>
          <DoorClosed className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
        </div>

        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-500">Nomor &amp; Akun Login Ujian</p>
            <p
              data-testid="stat-akun-ujian"
              className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1"
            >
              {credentialedCount}/{activeStudents.length}
            </p>
            <p className="text-[11px] text-slate-600 mt-1 tabular-nums">
              {numberedCount} bernomor peserta &middot; {credentialedCount} ber-User &amp; Pass
            </p>
          </div>
          <KeyRound className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
        </div>
      </div>

      {/* Checklist Kelengkapan Data Table-like Rows */}
      <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
        {checks.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 px-3.5 py-2.5 bg-white hover:bg-slate-50/70 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {item.isReady ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <div className="min-w-0">
                <p className={`text-xs font-semibold truncate ${item.isReady ? 'text-slate-900' : 'text-slate-700'}`}>
                  {item.title}
                </p>
                <p className="text-[11px] text-slate-500 truncate">{item.detail}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 ml-auto">
              <span
                className={`text-xs font-semibold ${
                  item.isReady ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {item.isReady ? 'Siap' : 'Perlu Dilengkapi'}
              </span>
              <button
                type="button"
                onClick={() => onNavigate(item.targetTab)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950 cursor-pointer"
              >
                {item.isReady ? 'Lihat' : 'Lengkapi'}
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
