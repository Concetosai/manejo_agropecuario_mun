import React from 'react';
import { PasePreCertificado as PaseType } from '../types';
import { TexasGuillocheCertificateBorder } from './TexasGuillocheCertificateBorder';

interface PasePreCertificadoDocumentoProps {
  pase: PaseType;
  fierroImageUrl: string;
}

const formatFecha = (iso: string): string => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
    return d.getDate() + ' DE ' + meses[d.getMonth()] + ' DE ' + d.getFullYear();
  } catch {
    return iso;
  }
};

const formatFechaCorta = (iso: string): string => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  } catch {
    return iso;
  }
};

export const PasePreCertificadoDocumento: React.FC<PasePreCertificadoDocumentoProps> = ({ pase, fierroImageUrl }) => {
  return (
    <div className="print-page-letter bg-[#faf7ef] shadow-2xl border border-stone-300 rounded-lg overflow-hidden w-full max-w-[840px] mx-auto text-stone-900 relative">
      <TexasGuillocheCertificateBorder className="w-full">
        {/* Banda diagonal TEMPORAL */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -rotate-45 pointer-events-none z-20 opacity-15">
          <span className="font-cinzel text-6xl font-black text-rose-800 whitespace-nowrap tracking-widest">
            TEMPORAL
          </span>
        </div>

        {/* Header */}
        <div className="text-center relative z-10 mb-4 print:mb-3">
          <div className="inline-block border-[1.5px] border-stone-900 rounded-full px-7 py-0.5 bg-white/90 shadow-2xs mb-1.5">
            <span className="font-cinzel font-black tracking-[0.25em] text-xs sm:text-sm text-stone-950 uppercase">
              REPÚBLICA MEXICANA
            </span>
          </div>

          <div className="relative max-w-md sm:max-w-lg mx-auto my-1">
            <div className="bg-gradient-to-r from-[#14532d] via-[#15803d] to-[#14532d] text-amber-100 py-1 px-8 rounded shadow-xs border-y-[1.5px] border-[#d97706] text-center flex items-center justify-center">
              <span className="font-cinzel font-black tracking-[0.18em] text-[10px] sm:text-xs text-amber-100 uppercase">
                ESTADO DE VERACRUZ DE IGNACIO DE LA LLAVE
              </span>
            </div>
          </div>

          <h1 className="font-cinzel font-black text-stone-950 text-base sm:text-xl tracking-wide uppercase mt-1 leading-tight">
            PASE PRE-CERTIFICADO
          </h1>
          <h2 className="font-cinzel font-black text-stone-950 text-lg sm:text-2xl tracking-wide uppercase leading-tight mt-0.5">
            DE FIERRO QUEMADOR
          </h2>
          <h3 className="font-cinzel font-bold text-stone-900 text-xs sm:text-sm tracking-widest uppercase mt-0.5">
            MUNICIPIO DE PÁNUCO, VER.
          </h3>

          <div className="flex items-center justify-center gap-3 sm:gap-6 mt-2">
            <div className="border border-stone-800 bg-white/95 px-3 py-0.5 text-[11px] sm:text-xs font-mono-data font-bold text-stone-900">
              FOLIO: <span className="text-[#831843] font-black">[{pase.folio_pase}]</span>
            </div>
            <div className="border border-stone-800 bg-white/95 px-3 py-0.5 text-[11px] sm:text-xs font-mono-data font-bold text-stone-900">
              EMISIÓN: <span>[{formatFechaCorta(pase.fecha_emision)}]</span>
            </div>
          </div>
        </div>

        {/* Alerta temporal */}
        <div className="relative z-10 mx-4 sm:mx-6 mb-4 p-3 border-2 border-rose-700 bg-rose-50/90 rounded-lg">
          <div className="flex items-center gap-2 justify-center">
            <span className="text-rose-800 font-cinzel font-black text-sm sm:text-base tracking-wider uppercase">
              ⚠ DOCUMENTO TEMPORAL · NO VÁLIDO COMO CERTIFICADO
            </span>
          </div>
          <p className="text-center text-[10px] sm:text-xs text-rose-900 mt-1 font-sans">
            Este pase autoriza únicamente la <strong>hechura del fierro quemador</strong> descrito. No constituye certificado definitivo ni acredita propiedad.
          </p>
        </div>

        {/* Cuerpo: dos columnas */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-start mb-3 px-4 sm:px-6">
          {/* Izquierda: datos del solicitante */}
          <div className="md:col-span-7 space-y-1.5 text-[10px] sm:text-[11.5px] font-sans text-stone-900">
            <div className="flex items-center gap-1.5 mb-2 pb-0.5 border-b border-stone-400">
              <h3 className="font-cinzel font-bold text-xs sm:text-sm uppercase tracking-wider text-stone-950">
                DATOS DEL SOLICITANTE
              </h3>
              <span className="text-[10px] text-amber-700">◆</span>
            </div>

            <div className="flex items-baseline">
              <span className="font-bold shrink-0 uppercase">NOMBRE:</span>
              <span className="ml-1.5 flex-1 border-b border-stone-800 font-cinzel font-bold text-stone-950 uppercase px-1">
                {pase.solicitante_nombre || '—'}
              </span>
            </div>

            <div className="flex items-baseline">
              <span className="font-bold shrink-0 uppercase">TELÉFONO:</span>
              <span className="ml-1.5 flex-1 border-b border-stone-800 font-mono-data px-1">
                {pase.solicitante_telefono || '—'}
              </span>
            </div>

            <div className="flex items-baseline">
              <span className="font-bold shrink-0 uppercase">CURP:</span>
              <span className="ml-1.5 flex-1 border-b border-stone-800 font-mono-data px-1">
                {pase.solicitante_curp || '—'}
              </span>
            </div>

            <div className="flex items-baseline">
              <span className="font-bold shrink-0 uppercase">R.F.C.:</span>
              <span className="ml-1.5 flex-1 border-b border-stone-800 font-mono-data px-1">
                {pase.solicitante_rfc || '—'}
              </span>
            </div>

            <div className="flex items-baseline">
              <span className="font-bold shrink-0 uppercase">EJIDO / CONGREGACIÓN:</span>
              <span className="ml-1.5 flex-1 border-b border-stone-800 px-1">
                {pase.solicitante_ejido || '—'}
              </span>
            </div>

            <div className="flex items-baseline">
              <span className="font-bold shrink-0 uppercase">MUNICIPIO:</span>
              <span className="ml-1.5 flex-1 border-b border-stone-800 px-1">
                {pase.solicitante_municipio || 'PÁNUCO'}
              </span>
            </div>

            {pase.solicitante_notas && (
              <div className="pt-2">
                <span className="font-bold uppercase block mb-1">NOTAS:</span>
                <p className="text-[10px] border border-stone-400 p-2 rounded bg-white/60">
                  {pase.solicitante_notas}
                </p>
              </div>
            )}
          </div>

          {/* Derecha: fierro aprobado + fechas */}
          <div className="md:col-span-5 flex flex-col items-center gap-3">
            <div className="p-2 bg-gradient-to-b from-[#fdfcf9] to-[#f4eee1] border-2 border-[#6d1624] rounded-lg shadow-sm w-full max-w-[220px]">
              <div className="border border-[#d97706] p-1 rounded-xs bg-[#faf7ee]">
                <div className="border border-[#7c1a29]/60 p-1 rounded-xs flex items-center justify-center bg-white">
                  {fierroImageUrl ? (
                    <img
                      src={fierroImageUrl}
                      alt="Fierro aprobado"
                      crossOrigin="anonymous"
                      className="w-[180px] h-[180px] object-contain"
                    />
                  ) : (
                    <div className="w-[180px] h-[180px] flex items-center justify-center text-stone-400 text-xs text-center p-2">
                      Sin imagen del fierro
                    </div>
                  )}
                </div>
              </div>
            </div>
            <span className="text-[9px] font-cinzel font-bold uppercase text-stone-700 tracking-wider">
              FIERRO AUTORIZADO
            </span>

            <div className="w-full max-w-[220px] text-[10px] font-mono-data text-stone-700 text-center">
              <span className="block">Checksum:</span>
              <strong className="block text-stone-900 break-all">{pase.checksum_vector}</strong>
            </div>

            <div className="w-full max-w-[220px] p-3 bg-amber-50 border-2 border-amber-600 rounded-lg text-center">
              <span className="text-[9px] uppercase font-bold text-amber-900 block">Vigencia del pase</span>
              <span className="text-lg font-black text-amber-950 font-mono block mt-1">
                {pase.dias_vigencia} DÍAS HÁBILES
              </span>
              <span className="text-[10px] text-amber-800 block mt-1">
                Vence el <strong>{formatFecha(pase.fecha_vencimiento)}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Texto legal */}
        <div className="relative z-10 text-[9px] sm:text-[10px] leading-tight text-stone-900 text-justify border-t border-stone-400 pt-2 mb-3 mx-4 sm:mx-6 font-sans">
          <p>
            EL H. AYUNTAMIENTO CONSTITUCIONAL DE PÁNUCO, VER., A TRAVÉS DE LA DIRECCIÓN DE FOMENTO AGROPECUARIO, HACE CONSTAR QUE EL PRESENTE <strong>PASE PRE-CERTIFICADO</strong> RESERVA EL DISEÑO DE FIERRO QUEMADOR DESCRITO, SIENDO ÚNICO Y LIBRE DE DUPLICIDAD EN EL PADRÓN MUNICIPAL A LA FECHA DE EMISIÓN. ESTE PASE TIENE VIGENCIA DE <strong>{pase.dias_vigencia} DÍAS HÁBILES</strong> A PARTIR DE SU EMISIÓN, DENTRO DE LOS CUALES EL PRODUCTOR DEBERÁ PRESENTAR EL FIERRO FÍSICO PARA FORMALIZAR EL CERTIFICADO DEFINITIVO. TRANSCURRIDO DICHO PLAZO SIN FORMALIZAR, EL PRESENTE PASE QUEDARÁ SIN EFECTOS Y EL DISEÑO SERÁ LIBERADO DEL PADRÓN DE RESERVAS.
          </p>
        </div>

        {/* Firmas */}
        <div className="relative z-10 grid grid-cols-2 gap-6 mx-4 sm:mx-6 mb-4 pt-6">
          <div className="text-center">
            <div className="border-t border-stone-800 pt-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-stone-900 block font-cinzel">
                FIRMA DEL SOLICITANTE
              </span>
              <span className="text-[8px] text-stone-600 block truncate">
                {pase.solicitante_nombre}
              </span>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-stone-800 pt-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-stone-900 block font-cinzel">
                DIRECTOR DE FOMENTO AGROPECUARIO
              </span>
              <span className="text-[8px] text-stone-600 block">
                H. AYUNTAMIENTO DE PÁNUCO
              </span>
            </div>
          </div>
        </div>
      </TexasGuillocheCertificateBorder>
    </div>
  );
};