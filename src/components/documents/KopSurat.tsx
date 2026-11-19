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
          alt={`Kop Surat ${profile.namaMadrasah || 'Madrasah'}`}
          style={{
            width: `${Math.min(100, Math.max(40, profile.kopWidthPercent ?? 100))}%`,
            height: 'auto',
            objectFit: 'contain',
          }}
        />
      </div>
    );
  }

  const addressParts = [
    profile.alamat,
    profile.desaKelurahan,
    profile.kecamatan ? `Kec. ${profile.kecamatan}` : '',
    profile.kabupatenKota,
    [profile.provinsi, profile.kodePos].filter(Boolean).join(' '),
  ].filter(Boolean);

  const contactParts = [
    profile.telepon ? `Telp: ${profile.telepon}` : '',
    profile.email ? `Email: ${profile.email}` : '',
    profile.website ? `Website: ${profile.website}` : '',
  ].filter(Boolean);

  const idParts = [
    profile.nsm ? `NSM: ${profile.nsm}` : '',
    profile.npsn ? `NPSN: ${profile.npsn}` : '',
  ].filter(Boolean);

  const showKemenag = profile.showLogoKemenag ?? true;
  const showMadrasah = profile.showLogoMadrasah ?? true;
  const basePx = Math.min(96, Math.max(36, profile.kopLogoSizePx ?? 64));
  const logoPx = isCompact ? Math.max(28, Math.round(basePx * 0.56)) : basePx;

  const baris1 =
    profile.kopBaris1 !== undefined
      ? profile.kopBaris1.trim()
      : 'KEMENTERIAN AGAMA REPUBLIK INDONESIA';
  const baris2 =
    profile.kopBaris2 !== undefined && profile.kopBaris2.trim() !== ''
      ? profile.kopBaris2.trim()
      : profile.kabupatenKota
      ? `KANTOR KEMENTERIAN AGAMA ${profile.kabupatenKota.toUpperCase()}`
      : '';
  const baris3 = (profile.kopBaris3 || '').trim();

  return (
    <div className={`w-full text-black select-none ${isCompact ? 'mb-1.5' : 'mb-4'}`}>
      <div className={`flex items-center justify-between ${isCompact ? 'gap-2' : 'gap-4'}`}>
        {/* Kemenag Logo (Left) */}
        {(showKemenag || showMadrasah) && (
          <div
            className="flex-shrink-0 flex items-center justify-center"
            style={{ width: `${logoPx}px`, height: `${logoPx}px` }}
          >
            {showKemenag ? (
              profile.logoKemenagUrl ? (
                <img
                  src={profile.logoKemenagUrl}
                  alt="Logo Kemenag"
                  referrerPolicy="no-referrer"
                  style={{ width: `${logoPx}px`, height: `${logoPx}px` }}
                  className="object-contain"
                />
              ) : (
                <svg
                  style={{ width: `${logoPx}px`, height: `${logoPx}px` }}
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
              )
            ) : null}
          </div>
        )}

        {/* Kop Text */}
        <div className="flex-1 text-center font-serif leading-tight min-w-0">
          {baris1 && (
            <p className={`${isCompact ? 'text-[8.5px]' : 'text-xs'} font-semibold tracking-wider uppercase`}>
              {baris1}
            </p>
          )}
          {baris2 && (
            <p className={`${isCompact ? 'text-[8.5px]' : 'text-xs'} font-semibold tracking-wider uppercase`}>
              {baris2}
            </p>
          )}
          {baris3 && (
            <p className={`${isCompact ? 'text-[8px]' : 'text-[11px]'} font-semibold tracking-wide uppercase`}>
              {baris3}
            </p>
          )}
          <h1
            className={`${
              isCompact ? 'text-[11px] font-bold' : 'text-base font-extrabold'
            } uppercase tracking-wide text-slate-900 mt-0.5 truncate`}
          >
            {profile.namaMadrasah || 'NAMA MADRASAH BELUM DIISI'}
          </h1>
          {idParts.length > 0 && (
            <p className={`${isCompact ? 'text-[7.5px]' : 'text-[10.5px]'} text-slate-700 mt-0.5 font-sans font-semibold`}>
              {idParts.join(' | ')}
            </p>
          )}
          {addressParts.length > 0 && (
            <p className={`${isCompact ? 'text-[7px]' : 'text-[9.5px]'} text-slate-600 font-sans italic truncate`}>
              {addressParts.join(', ')}
            </p>
          )}
          {contactParts.length > 0 && (
            <p className={`${isCompact ? 'text-[6.5px]' : 'text-[9px]'} text-slate-500 font-sans truncate`}>
              {contactParts.join(' | ')}
            </p>
          )}
        </div>

        {/* Madrasah Logo (Right) */}
        {(showKemenag || showMadrasah) && (
          <div
            className="flex-shrink-0 flex items-center justify-center"
            style={{ width: `${logoPx}px`, height: `${logoPx}px` }}
          >
            {showMadrasah ? (
              profile.logoMadrasahUrl ? (
                <img
                  src={profile.logoMadrasahUrl}
                  alt="Logo Madrasah"
                  referrerPolicy="no-referrer"
                  style={{ width: `${logoPx}px`, height: `${logoPx}px` }}
                  className="object-contain"
                />
              ) : (
                <div
                  style={{ width: `${logoPx}px`, height: `${logoPx}px` }}
                  className="rounded-full border-2 border-emerald-700 bg-emerald-50 flex flex-col items-center justify-center p-1 text-center"
                >
                  <span className={`${isCompact ? 'text-[7px]' : 'text-[10px]'} font-bold text-emerald-800`}>
                    {profile.jenjang || 'MA'}
                  </span>
                  <span className={`${isCompact ? 'text-[5px]' : 'text-[7px]'} font-semibold text-emerald-600 uppercase`}>
                    Madrasah
                  </span>
                </div>
              )
            ) : null}
          </div>
        )}
      </div>

      {/* Official Kop Double Line */}
      <div className={`w-full ${isCompact ? 'mt-1 mb-1' : 'mt-2 mb-2.5'}`}>
        <div className={`w-full bg-black ${isCompact ? 'h-[1.5px]' : 'h-[2px]'}`} />
        <div className={`w-full bg-black ${isCompact ? 'h-[0.5px] mt-[1px]' : 'h-[0.8px] mt-[1.5px]'}`} />
      </div>
    </div>
  );
};
