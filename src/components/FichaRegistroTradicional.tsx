import React, { useEffect, useRef } from 'react';
import { ProducerData, BrandConfig, MunicipalConfig } from '../types';
import { PanucoMunicipalLogo } from './PanucoMunicipalLogo';
import { renderBrandToCanvas } from '../utils/canvasRenderer';

interface FichaRegistroTradicionalProps {
  producerData: ProducerData;
  brandConfig: BrandConfig;
  municipalConfig: MunicipalConfig;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export const FichaRegistroTradicional: React.FC<FichaRegistroTradicionalProps> = ({
  producerData,
  brandConfig,
  municipalConfig,
  containerRef,
}) => {
  const brandCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render the brand onto the traditional canvas
  useEffect(() => {
    const canvas = brandCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        renderBrandToCanvas(ctx, 180, 180, brandConfig, {
          background: 'white',
          resolutionScale: 2,
        });
      }
    }
  }, [brandConfig]);

  // Format surface area (e.g. 25-00-00 HAS)
  const formattedSurface = (() => {
    if (producerData.surfaceHectares) {
      const whole = Math.floor(producerData.surfaceHectares);
      const dec = Math.round((producerData.surfaceHectares - whole) * 100);
      return `${whole.toString().padStart(2, '0')}-${dec.toString().padStart(2, '0')}-00 HAS`;
    }
    return '25-00-00 HAS';
  })();

  // Format species
  const formattedSpecies = (() => {
    if (producerData.species === 'MIXTOS') return 'MIXTOS (Bovinos y Equinos)';
    if (producerData.species) return `${producerData.species} (${producerData.cattleCount || 0} CABEZAS)`;
    return 'BOVINO';
  })();

  // Format date helper
  const formatDateSpanish = (dateStr?: string) => {
    if (!dateStr) return '23 DE SEPTIEMBRE DE 2026';
    try {
      const [y, m, d] = dateStr.split('-');
      if (!y || !m || !d) return dateStr.toUpperCase();
      const months = [
        'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
      ];
      const monthIndex = parseInt(m, 10) - 1;
      const monthName = months[monthIndex] || m;
      return `${parseInt(d, 10)} DE ${monthName} DE ${y}`;
    } catch {
      return dateStr.toUpperCase();
    }
  };

  const currentDateText = formatDateSpanish(producerData.issueDate || new Date().toISOString().split('T')[0]);
  const vigenciaText = producerData.validityRange || '2026 - 2028';
  const directorName = municipalConfig.directorName || 'MVZ. JOSÉ LUIS ROBLES GARCÍA';

  return (
    <div
      ref={containerRef}
      className="ficha-tradicional-root w-full max-w-[800px] mx-auto bg-white text-stone-900 border-2 border-stone-800 p-8 sm:p-10 shadow-lg font-serif print:shadow-none print:border-stone-900 print:m-0 print:p-6 print:max-w-none"
      style={{ boxSizing: 'border-box' }}
    >
      {/* 1. ENCABEZADO OFICIAL */}
      <header className="border-b-2 border-stone-900 pb-4 mb-6">
        <div className="flex items-center justify-between gap-4">
          <PanucoMunicipalLogo
            customLogoUrl={municipalConfig.customLogoUrl || municipalConfig.coatOfArmsUrl}
            size="md"
            className="w-16 h-16 shrink-0 print:w-14 print:h-14"
          />
          <div className="flex-1 text-center">
            <h2 className="text-xs sm:text-sm font-bold tracking-widest text-stone-900 uppercase">
              SECRETARÍA DE DESARROLLO AGROPECUARIO Y PESQUERO
            </h2>
            <h3 className="text-xs sm:text-sm font-semibold tracking-wider text-stone-800 uppercase mt-0.5">
              DIRECCIÓN GENERAL DE GANADERÍA
            </h3>
            <h1 className="text-sm sm:text-base font-extrabold tracking-widest text-stone-900 uppercase mt-1">
              MUNICIPIO DE PÁNUCO, VERACRUZ
            </h1>
            <div className="inline-block bg-stone-900 text-white font-bold text-xs sm:text-sm tracking-wider uppercase px-4 py-1 mt-2">
              FICHA DE REGISTRO DE FIERRO QUEMADOR PARA GANADO
            </div>
          </div>
          {/* FIX_TRAD_FOTO: Cuadro de foto del titular en esquina superior derecha */}
          <div className="w-16 h-16 shrink-0 flex items-center justify-center border-2 border-stone-800 bg-white overflow-hidden print:w-14 print:h-14">
            {producerData.producerPhoto ? (
              <img
                src={producerData.producerPhoto}
                alt="Foto del titular"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-[7px] font-sans font-bold leading-tight text-stone-400 text-center">
                FOTO<br />TITULAR
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. CONTENIDO PRINCIPAL: DATOS DEL PRODUCTOR & FIERRO */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6">
        {/* Columna Izquierda / Central: 15 Datos obligatorios en estricto orden */}
        <div className="md:col-span-8 space-y-1.5 text-xs sm:text-[13px] leading-relaxed">
          <div className="border border-stone-800 divide-y divide-stone-300">
            {/* 1. NOMBRE DEL PRODUCTOR */}
            <div className="grid grid-cols-12 px-3 py-1.5 bg-stone-50/50">
              <span className="col-span-5 font-bold uppercase tracking-tight text-stone-800">
                1. NOMBRE DEL PRODUCTOR:
              </span>
              <span className="col-span-7 font-bold text-stone-950 uppercase">
                {producerData.fullName || 'NO ESPECIFICADO'}
              </span>
            </div>

            {/* 2. DOMICILIO */}
            <div className="grid grid-cols-12 px-3 py-1.5">
              <span className="col-span-5 font-bold uppercase tracking-tight text-stone-800">
                2. DOMICILIO:
              </span>
              <span className="col-span-7 uppercase text-stone-900">
                {producerData.address || `${producerData.propertyName || 'CONOCIDO'}, ${producerData.ejido || 'PÁNUCO, VER.'}`}
              </span>
            </div>

            {/* 3. TELÉFONO */}
            <div className="grid grid-cols-12 px-3 py-1.5 bg-stone-50/50">
              <span className="col-span-5 font-bold uppercase tracking-tight text-stone-800">
                3. TELÉFONO:
              </span>
              <span className="col-span-7 font-mono font-semibold text-stone-900">
                {producerData.phone || '(846) 266-0145'}
              </span>
            </div>

            {/* 4. EJIDO CONGREGACIÓN O RANCHERIA */}
            <div className="grid grid-cols-12 px-3 py-1.5">
              <span className="col-span-5 font-bold uppercase tracking-tight text-stone-800">
                4. EJIDO CONGREGACIÓN O RANCHERIA:
              </span>
              <span className="col-span-7 font-semibold uppercase text-stone-900">
                {producerData.ejido || 'REVENTADERO'}
              </span>
            </div>

            {/* 5. NOMBRE DEL PREDIO */}
            <div className="grid grid-cols-12 px-3 py-1.5 bg-stone-50/50">
              <span className="col-span-5 font-bold uppercase tracking-tight text-stone-800">
                5. NOMBRE DEL PREDIO:
              </span>
              <span className="col-span-7 font-bold uppercase text-stone-950">
                {producerData.propertyName || 'RANCHO EL CHINTÓN'}
              </span>
            </div>

            {/* 6. SUPERFICIE */}
            <div className="grid grid-cols-12 px-3 py-1.5">
              <span className="col-span-5 font-bold uppercase tracking-tight text-stone-800">
                6. SUPERFICIE:
              </span>
              <span className="col-span-7 font-mono font-semibold uppercase text-stone-900">
                {formattedSurface}
              </span>
            </div>

            {/* 7. TIPO DE TENENCIA */}
            <div className="grid grid-cols-12 px-3 py-1.5 bg-stone-50/50">
              <span className="col-span-5 font-bold uppercase tracking-tight text-stone-800">
                7. TIPO DE TENENCIA:
              </span>
              <span className="col-span-7 font-semibold uppercase text-stone-900">
                {producerData.tenureType ? producerData.tenureType.toUpperCase() : 'PROPIEDAD'}
              </span>
            </div>

            {/* 8. GANADERO ASOCIADO */}
            <div className="grid grid-cols-12 px-3 py-1.5">
              <span className="col-span-5 font-bold uppercase tracking-tight text-stone-800">
                8. GANADERO ASOCIADO:
              </span>
              <span className="col-span-7 font-bold uppercase text-stone-900">
                {producerData.associatedRancher || 'NO'}
              </span>
            </div>

            {/* 9. CANTIDAD DE GANADO QUE POSEE */}
            <div className="grid grid-cols-12 px-3 py-1.5 bg-stone-50/50">
              <span className="col-span-5 font-bold uppercase tracking-tight text-stone-800">
                9. CANTIDAD DE GANADO QUE POSEE:
              </span>
              <span className="col-span-7 font-bold text-stone-950 font-mono">
                {producerData.cattleCount || 45} CABEZAS
              </span>
            </div>

            {/* 10. ESPECIE */}
            <div className="grid grid-cols-12 px-3 py-1.5">
              <span className="col-span-5 font-bold uppercase tracking-tight text-stone-800">
                10. ESPECIE:
              </span>
              <span className="col-span-7 uppercase text-stone-900">
                {formattedSpecies}
              </span>
            </div>

            {/* 11. FIN ZOOTECNICO */}
            <div className="grid grid-cols-12 px-3 py-1.5 bg-stone-50/50">
              <span className="col-span-5 font-bold uppercase tracking-tight text-stone-800">
                11. FIN ZOOTECNICO:
              </span>
              <span className="col-span-7 font-semibold uppercase text-stone-900">
                {producerData.zootechnicalPurpose ? producerData.zootechnicalPurpose.toUpperCase() : 'BOVINO Y DOBLE PROPÓSITO'}
              </span>
            </div>

            {/* 12. CREDENCIAL DE ELECTOR */}
            <div className="grid grid-cols-12 px-3 py-1.5">
              <span className="col-span-5 font-bold uppercase tracking-tight text-stone-800">
                12. CREDENCIAL DE ELECTOR:
              </span>
              <span className="col-span-7 font-mono font-semibold text-stone-900">
                {producerData.ine || '0983049281726'}
              </span>
            </div>

            {/* 13. R.F.C. */}
            <div className="grid grid-cols-12 px-3 py-1.5 bg-stone-50/50">
              <span className="col-span-5 font-bold uppercase tracking-tight text-stone-800">
                13. R.F.C.:
              </span>
              <span className="col-span-7 font-mono font-bold text-stone-950">
                {producerData.rfc || 'GAPJ780512HN8'}
              </span>
            </div>

            {/* 14. CURP */}
            <div className="grid grid-cols-12 px-3 py-1.5">
              <span className="col-span-5 font-bold uppercase tracking-tight text-stone-800">
                14. CURP:
              </span>
              <span className="col-span-7 font-mono font-bold text-stone-950">
                {producerData.curp || 'GAPJ780512HVRNRR03'}
              </span>
            </div>

            {/* 15. CLAVE UPP */}
            <div className="grid grid-cols-12 px-3 py-1.5 bg-stone-50/50">
              <span className="col-span-5 font-bold uppercase tracking-tight text-stone-800">
                15. CLAVE UPP:
              </span>
              <span className="col-span-7 font-mono font-extrabold text-stone-950">
                {producerData.uppKey || '30-123-0492-001'}
              </span>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Recuadro del Fierro Marcador */}
        <div className="md:col-span-4 flex flex-col">
          <div className="border-2 border-stone-900 bg-stone-50 flex-1 flex flex-col items-center justify-between p-3 text-center">
            <div className="w-full border-b border-stone-800 pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-900 block">
                DISEÑO AUTORIZADO DEL FIERRO QUEMADOR
              </span>
              <span className="text-[9px] font-sans text-stone-600 block mt-0.5">
                MARCA DE FUEGO Y HERRAR REGISTRADA
              </span>
            </div>

            <div className="my-auto py-3">
              <div className="w-56 h-56 sm:w-72 sm:h-72 border-2 border-stone-800 bg-white p-3 flex items-center justify-center shadow-md mx-auto">
                <canvas
                  ref={brandCanvasRef}
                  width={300}
                  height={300}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="mt-2 text-[10px] font-mono font-bold text-stone-800">
                INICIALES: {brandConfig.initials || 'S/I'}
              </div>
            </div>

            <div className="w-full border-t border-stone-300 pt-2 text-[9px] text-stone-600 font-sans leading-tight">
              MEDIDAS REGLAMENTARIAS: 10 A 14 CM DE ALTO. PROHIBIDO SU USO EN OTRA JURISDICCIÓN SIN REFRENDO.
            </div>
          </div>
        </div>
      </div>

      {/* 3. CIERRE Y VALIDACIÓN TRADICIONAL */}
      <div className="border-t-2 border-stone-900 pt-4 space-y-4">
        {/* Párrafo Legal Obligatorio */}
        <p className="text-[11px] sm:text-xs text-justify font-serif leading-relaxed text-stone-900 uppercase">
          EL H. AYUNTAMIENTO CONSTITUCIONAL DE PANUCO, VER., HACE CONSTAR QUE LO DISPUESTO POR LOS ARTICULOS 30, 31, 32 Y 33 Y DEMAS RELATIVOS DE LA LEY GANADERA DEL ESTADO: EL FIERRO MARCADOR DE EL(LA) C.{' '}
          <strong className="underline underline-offset-2">
            {producerData.fullName || 'PRODUCTOR GANADERO'}
          </strong>{' '}
          QUEDO REGISTRADO BAJO EL NUMERO{' '}
          <strong className="underline underline-offset-2">
            {producerData.registrationNumber || '4290'}
          </strong>{' '}
          A FOJAS{' '}
          <strong className="underline underline-offset-2">
            {producerData.folioPage || '042'}
          </strong>{' '}
          DEL LIBRO{' '}
          <strong className="underline underline-offset-2">
            {producerData.bookNumber || 'XIII'}
          </strong>{' '}
          QUE LLEVA ESTE H. AYUNTAMIENTO CON FECHA:{' '}
          <strong className="underline underline-offset-2">{currentDateText}</strong>.
        </p>

        {/* Movimientos y Vigencia */}
        <div className="grid grid-cols-2 gap-4 border border-stone-800 p-2.5 bg-stone-50 text-xs sm:text-[13px] font-sans">
          <div>
            <span className="font-bold text-stone-800 block text-[10px] uppercase tracking-wider">
              TIPO DE MOVIMIENTO:
            </span>
            <span className="font-bold text-stone-950 font-serif uppercase">
              MOVIMIENTOS: ALTA DE FIERRO QUEMADOR
            </span>
          </div>
          <div>
            <span className="font-bold text-stone-800 block text-[10px] uppercase tracking-wider">
              PERIODO DE VIGENCIA OFICIAL:
            </span>
            <span className="font-bold text-stone-950 font-mono">
              VIGENCIA: {vigenciaText}
            </span>
          </div>
        </div>

        {/* Sección de Firmas: Productor y Director */}
        <div className="grid grid-cols-2 gap-8 pt-6 mt-4">
          {/* Firma del Productor */}
          <div className="text-center flex flex-col items-center justify-end">
            <div className="h-16 w-44 flex items-center justify-center border-b border-stone-800 mb-1">
              {producerData.producerSignature ? (
                <img
                  src={producerData.producerSignature}
                  alt="Firma del Productor"
                  className="max-h-14 max-w-full object-contain"
                />
              ) : (
                <span className="text-[10px] text-stone-400 italic font-sans">
                  (FIRMA AUTÓGRAFA DEL PRODUCTOR)
                </span>
              )}
            </div>
            <span className="text-xs font-bold text-stone-900 uppercase block">
              {producerData.fullName || 'NOMBRE Y FIRMA DEL PRODUCTOR'}
            </span>
            <span className="text-[10px] text-stone-600 uppercase font-sans">
              PROPIETARIO / TITULAR REGISTRADO
            </span>
          </div>

          {/* Firma de la Autoridad Municipal */}
          <div className="text-center flex flex-col items-center justify-end">
            <div className="h-16 w-44 flex flex-col items-center justify-end border-b border-stone-800 mb-1">
              <div className="text-[10px] font-bold text-stone-800 uppercase font-serif tracking-tight">
                H. AYUNTAMIENTO DE PÁNUCO
              </div>
            </div>
            <span className="text-xs font-bold text-stone-900 uppercase block">
              {directorName}
            </span>
            <span className="text-[10px] text-stone-600 uppercase font-sans">
              DIRECTOR DE DESARROLLO AGROPECUARIO Y PESQUERO
            </span>
          </div>
        </div>

        {/* Lugar y Fecha */}
        <div className="text-center pt-3 text-xs font-serif text-stone-700">
          Pánuco, Ver. a {currentDateText}
        </div>
      </div>
    </div>
  );
};
