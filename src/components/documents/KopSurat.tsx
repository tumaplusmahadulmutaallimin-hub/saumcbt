import React from 'react';
import { MadrasahProfile } from '../../types';

interface KopSuratProps {
  profile: MadrasahProfile;
  isCompact?: boolean;
}

export const KopSurat: React.FC<KopSuratProps> = ({ profile, isCompact = false }) => {
  // Original Uploaded KOP Image Mode (untouched, uncropped, adjustable width & margin)
  if (profile.useOriginalKopImage && profile.kopImageUrl) {
    const justifyClass =
      profile.kopPosition === 'left'
        ? 'justify-start'
        : profile.kopPosition === 'right'
        ? 'justify-end'
        : 'justify-center';

    return (
      <div
        className={`w-full flex ${justifyClass} select-none`}
        style={{
          marginTop: `${profile.kopMarginTopMm ?? 0}mm`,
          marginBottom: `${profile.kopMarginBottomMm ?? (isCompact ? 2 : 4)}mm`,
        }}
      >
        <img
          src={profile.kopImageUrl}
          alt={`Kop Surat ${profile.namaMadrasah}`}
          style={{
            width: `${Math.min(100, Math.max(40, profile.kopWidthPercent ?? 100))}%`,
            height: 'auto',
            objectFit: 'contain',
          }}
        />
      </div>
    );
  }

  return (
    <div className={`w-full text-black select-none ${isCompact ? 'mb-2' : 'mb-4'}`}>
      <div className="flex items-center justify-between gap-4">
        {/* Kemenag Logo (Left) */}
        <div className="flex-shrink-0 flex items-center justify-center">
          {profile.logoKemenagUrl ? (
            <img
              src={profile.logoKemenagUrl}
              alt="Logo Kemenag"
              className={isCompact ? 'w-10 h-10 object-contain' : 'w-16 h-16 object-contain'}
            />
          ) : (
            <svg
              className={isCompact ? 'w-10 h-10' : 'w-16 h-16'}
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="50" cy="50" r="46" fill="#047857" stroke="#F59E0B" strokeWidth="3" />
              <path d="M50 14L59 36H41L50 14Z" fill="#F59E0B" />
              <circle cx="50" cy="50" r="22" fill="#065F46" stroke="#FEF3C7" strokeWidth="2" />
              <path
                d="M32 68C32 68 40 60 50 60C60 60 68 68 68 68C68 68 60 74 50 74C40 74 32 68 32 68Z"
                fill="#F59E0B"
              />
              <text x="50" y="54" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#FEF3C7" fontFamily="serif">
                IKHLAS
              </text>
              <text x="50" y="63" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#FEF3C7" fontFamily="serif">
                BERAMAL
              </text>
            </svg>
          )}
        </div>

        {/* Kop Text */}
        <div className="flex-1 text-center font-serif leading-tight">
          <p className={`${isCompact ? 'text-[9px]' : 'text-xs'} font-semibold tracking-wider uppercase`}>
            KEMENTERIAN AGAMA REPUBLIK INDONESIA
          </p>
          <p className={`${isCompact ? 'text-[9px]' : 'text-xs'} font-semibold tracking-wider uppercase`}>
            KANTOR KEMENTERIAN AGAMA {profile.kabupatenKota.toUpperCase()}
          </p>
          <h1
            className={`${
              isCompact ? 'text-xs font-bold' : 'text-base font-extrabold'
            } uppercase tracking-wide text-slate-900 mt-0.5`}
          >
            {profile.namaMadrasah}
          </h1>
          <p className={`${isCompact ? 'text-[8px]' : 'text-[10.5px]'} text-slate-700 mt-0.5 font-sans`}>
            NSM: <span className="font-semibold">{profile.nsm}</span> | NPSN:{' '}
            <span className="font-semibold">{profile.npsn}</span>
          </p>
          <p className={`${isCompact ? 'text-[7.5px]' : 'text-[9.5px]'} text-slate-600 font-sans italic`}>
            {profile.alamat}, {profile.desaKelurahan}, Kec. {profile.kecamatan}, {profile.kabupatenKota},{' '}
            {profile.provinsi} {profile.kodePos}
          </p>
          <p className={`${isCompact ? 'text-[7px]' : 'text-[9px]'} text-slate-500 font-sans`}>
            {profile.telepon && `Telp: ${profile.telepon}`} {profile.email && `| Email: ${profile.email}`}{' '}
            {profile.website && `| Website: ${profile.website}`}
          </p>
        </div>

        {/* Madrasah Logo (Right) */}
        <div className="flex-shrink-0 flex items-center justify-center">
          {profile.logoMadrasahUrl ? (
            <img
              src={profile.logoMadrasahUrl}
              alt="Logo Madrasah"
              className={isCompact ? 'w-10 h-10 object-contain' : 'w-16 h-16 object-contain'}
            />
          ) : (
            <div
              className={`${
                isCompact ? 'w-10 h-10' : 'w-16 h-16'
              } rounded-full border-2 border-emerald-700 bg-emerald-50 flex flex-col items-center justify-center p-1 text-center`}
            >
              <span className={`${isCompact ? 'text-[7px]' : 'text-[10px]'} font-bold text-emerald-800`}>
                {profile.jenjang}
              </span>
              <span className={`${isCompact ? 'text-[5px]' : 'text-[7px]'} font-semibold text-emerald-600 uppercase`}>
                Madrasah
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Official Kop Double Line */}
      <div className={`w-full ${isCompact ? 'mt-1 mb-1.5' : 'mt-2 mb-2.5'}`}>
        <div className={`w-full bg-black ${isCompact ? 'h-[1.5px]' : 'h-[2px]'}`} />
        <div className={`w-full bg-black ${isCompact ? 'h-[0.5px] mt-[1px]' : 'h-[0.8px] mt-[1.5px]'}`} />
      </div>
    </div>
  );
};
