import React from 'react';
import { ShieldCheck, ShieldAlert, FileBadge, MapPin, User, Calendar, Hash, Building2 } from 'lucide-react';
import {
  decodeVerificationToken,
  isVerificationValid,
  maskCurp,
  type VerificationData,
} from '../utils/qrVerification';

interface VerificacionPublicaProps {
  token: string;
}

/**
 * P4-QR · Vista pública de verificación (sin sesión / sin login).
 * Se activa cuando la URL contiene ?verificar=<token>, normalmente al escanear
 * el código QR del certificado con la cámara de un celular o PC.
 */
export const VerificacionPublica: React.FC<VerificacionPublicaProps> = ({ token }) => {
  const data: VerificationData | null = decodeVerificationToken(token);
  const valid = isVerificationValid(data);
  const hasFolio = Boolean(data?.f);

  const goToSystem = () => {
    window.location.href = window.location.origin + window.location.pathname;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-100 via-stone-50 to-stone-200 text-stone-900 flex flex-col">
      {/* Encabezado institucional */}
      <header className="bg-gradient-to-r from-[#6d1624] to-[#8a2233] text-white shadow-lg">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="leading-tight">
            <p className="font-cinzel font-bold text-sm sm:text-base">
              H. Ayuntamiento Constitucional de Pánuco, Ver.
            </p>
            <p className="text-[11px] sm:text-xs text-rose-100">
              Dirección de Fomento Agropecuario · Verificación de Fierro Quemador
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-8">
        {/* Sello de estado */}
        <div
          className={`rounded-2xl border-2 shadow-lg overflow-hidden ${
            valid && hasFolio ? 'border-emerald-500 bg-white' : 'border-rose-500 bg-white'
          }`}
        >
          <div
            className={`px-5 py-4 flex items-center gap-3 text-white ${
              valid && hasFolio ? 'bg-emerald-600' : 'bg-rose-600'
            }`}
          >
            {valid && hasFolio ? (
              <ShieldCheck className="w-9 h-9 shrink-0" />
            ) : (
              <ShieldAlert className="w-9 h-9 shrink-0" />
            )}
            <div>
              <h1 className="text-lg font-bold leading-tight">
                {valid && hasFolio ? 'CERTIFICADO VÁLIDO' : 'CÓDIGO NO VÁLIDO'}
              </h1>
              <p className="text-[12px] opacity-90">
                {valid && hasFolio
                  ? 'Documento verificado correctamente contra su código QR oficial.'
                  : 'No fue posible validar la integridad de este código.'}
              </p>
            </div>
          </div>

          {valid && hasFolio && data ? (
            <div className="p-5 space-y-5">
              {/* Fierro + datos principales */}
              <div className="flex flex-col sm:flex-row gap-5">
                {data.i ? (
                  <div className="shrink-0 mx-auto sm:mx-0">
                    <div className="w-40 h-40 bg-white border-2 border-stone-300 rounded-xl p-1 shadow-sm flex items-center justify-center">
                      <img
                        src={data.i}
                        alt="Diseño del fierro quemador"
                        crossOrigin="anonymous"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <p className="text-center text-[10px] text-stone-500 mt-1 font-semibold">
                      Fierro digitalizado
                    </p>
                  </div>
                ) : (
                  <div className="shrink-0 mx-auto sm:mx-0">
                    <div className="w-40 h-40 bg-stone-50 border-2 border-dashed border-stone-300 rounded-xl flex flex-col items-center justify-center text-stone-400">
                      <FileBadge className="w-10 h-10 mb-1" />
                      <span className="text-[10px] font-semibold">Sin imagen</span>
                    </div>
                  </div>
                )}

                <div className="flex-1 space-y-3">
                  <Field icon={<Hash className="w-4 h-4" />} label="Folio Oficial" value={data.f} strong />
                  {data.r ? (
                    <Field icon={<FileBadge className="w-4 h-4" />} label="Registro" value={data.r} />
                  ) : null}
                  <Field icon={<User className="w-4 h-4" />} label="Titular" value={data.t} strong />
                  {data.c ? (
                    <Field label="CURP" value={maskCurp(data.c)} mono />
                  ) : null}
                </div>
              </div>

              <div className="h-px bg-stone-200" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field icon={<MapPin className="w-4 h-4" />} label="Predio" value={data.p || '—'} />
                <Field label="Clave UPP" value={data.u || '—'} mono />
                <Field icon={<Calendar className="w-4 h-4" />} label="Fecha de expedición" value={data.e || '—'} />
                <Field icon={<Calendar className="w-4 h-4" />} label="Vigencia" value={data.g || '—'} />
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 leading-relaxed">
                <strong>✓ Integridad confirmada.</strong> Los datos mostrados provienen del código QR
                imprimido en el certificado y su firma de control coincide con el contenido.
                Para consultar el estatus más reciente en el padrón municipal, acuda a la Dirección
                de Fomento Agropecuario.
              </div>
            </div>
          ) : (
            <div className="p-6 text-sm text-stone-700 space-y-2">
              <p>
                El código QR escaneado no corresponde a un certificado oficial vigente, o fue
                alterado. Verifique que el documento sea original y vuelva a escanear el código.
              </p>
              <p className="text-xs text-stone-500">
                Si el problema persiste, acuda a la Dirección de Fomento Agropecuario del
                H. Ayuntamiento de Pánuco, Ver.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={goToSystem}
            className="px-5 py-2.5 bg-[#6d1624] hover:bg-[#8a2233] text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer shadow"
          >
            Ir al Sistema Municipal
          </button>
        </div>
      </main>

      <footer className="bg-stone-900 text-stone-400 py-5 text-center text-[11px]">
        <p className="text-stone-300 font-cinzel font-semibold">
          H. Ayuntamiento Constitucional de Pánuco, Veracruz
        </p>
        <p>Sistema Oficial de Registro de Fierro Quemador y Señal de Sangre</p>
      </footer>
    </div>
  );
};

const Field: React.FC<{
  icon?: React.ReactNode;
  label: string;
  value: string;
  strong?: boolean;
  mono?: boolean;
}> = ({ icon, label, value, strong, mono }) => (
  <div>
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">
      {icon}
      <span>{label}</span>
    </div>
    <p
      className={`${strong ? 'font-bold text-stone-900' : 'text-stone-800'} ${
        mono ? 'font-mono-data' : ''
      } text-sm break-words`}
    >
      {value}
    </p>
  </div>
);
