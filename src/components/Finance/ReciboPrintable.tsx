import React from 'react';
import { PaymentOrder, MunicipalConfig } from '../../types';
import { OFFICIAL_PAYMENT_CONCEPTS } from '../../services/financeFirestore';

interface ReciboPrintableProps {
  order: PaymentOrder;
  municipalConfig: MunicipalConfig;
  formatDateSpanish: (dateStr?: string) => string;
  numberToSpanishCurrencyWords: (amount: number) => string;
  forPrint?: boolean;
  // P4: forzar sello PAGADO al generar PDF (aunque la orden aún no esté marcada PAID en memoria)
  forcePaid?: boolean;
  // P4: miniatura del recibo físico sellado (URL Cloudinary o base64) — solo se muestra si existe
  miniaturaReciboFisico?: string;
  // P4: datos para el caption de la miniatura
  folioFierro?: string;
  nombreProductor?: string;
}

export const ReciboPrintable: React.FC<ReciboPrintableProps> = ({
  order,
  municipalConfig,
  formatDateSpanish,
  numberToSpanishCurrencyWords,
  forPrint = false,
  forcePaid = false,
  miniaturaReciboFisico,
  folioFierro,
  nombreProductor,
}) => {
  // FASE_0_3 + P4: sello PAGADO condicional (forcePaid para PDF generado en ConfirmarPagoModal)
  const isPaid = forcePaid || order.status === 'PAID' || order.status === 'DELIVERED';

  return (
    <div
      id={`recibo-printable-${order.folio}`}
      className={
        forPrint
          ? 'bg-white text-stone-900 p-8 font-serif text-xs relative'
          : 'bg-white text-stone-900 p-8 shadow-lg border border-stone-300 w-full max-w-[760px] font-serif space-y-5 text-xs relative'
      }
    >
      {/* FASE_0_3 + P4: Sello PAGADO sobrepuesto */}
      {isPaid && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
          aria-hidden="true"
        >
          <div
            style={{
              transform: 'rotate(-25deg)',
              border: '8px solid #15803d',
              color: '#15803d',
              padding: '16px 48px',
              borderRadius: '12px',
              fontSize: '72px',
              fontWeight: 900,
              letterSpacing: '8px',
              fontFamily: 'serif',
              opacity: 0.35,
              textTransform: 'uppercase',
              textShadow: '2px 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            PAGADO
          </div>
        </div>
      )}

      {/* RECUADRO PRINCIPAL */}
      <div className="border-2 border-stone-800 p-6 rounded-lg space-y-4">

        {/* ENCABEZADO OFICIAL */}
        <div className="text-center border-b-2 border-stone-800 pb-3">
          <span className="text-[10px] font-bold tracking-widest text-stone-600 uppercase block font-sans">
            {municipalConfig.municipalityName.toUpperCase()}
          </span>
          <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-stone-950 font-sans mt-0.5">
            TESORERÍA MUNICIPAL · DIRECCIÓN DE INGRESOS
          </h2>
          <h1 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-amber-950 font-cinzel mt-0.5">
            ORDEN OFICIAL DE COBRO Y ENTERO DE DERECHOS PECUARIOS
          </h1>
        </div>

        {/* FOLIO / EJERCICIO / FECHA */}
        <div className="grid grid-cols-3 gap-2 border-b border-stone-300 pb-2 text-[11px] font-sans">
          <div>
            <span className="font-bold text-stone-600 uppercase block text-[9px]">FOLIO OFICIAL:</span>
            <span className="font-mono font-bold text-amber-900 text-sm">{order.folio}</span>
          </div>
          <div className="text-center">
            <span className="font-bold text-stone-600 uppercase block text-[9px]">EJERCICIO FISCAL:</span>
            <span className="font-bold text-stone-800">{order.exercise}</span>
          </div>
          <div className="text-right">
            <span className="font-bold text-stone-600 uppercase block text-[9px]">EXPEDICIÓN:</span>
            <span className="font-bold text-stone-800">{formatDateSpanish(order.date)}</span>
          </div>
        </div>

        {/* DATOS DEL CONTRIBUYENTE */}
        <div className="bg-stone-50 p-3 rounded border border-stone-300 space-y-1.5 font-sans">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-[10px] font-bold text-stone-600 uppercase">CONTRIBUYENTE:</span>
            <span className="font-bold text-stone-950 text-xs sm:text-sm">
              C. {order.taxpayerName}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-[10px] font-bold text-stone-600 uppercase">RFC DEL CONTRIBUYENTE:</span>
            <span className="font-mono font-bold text-stone-900 text-xs">
              {order.rfc || 'XAXX010101000'}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-[10px] font-bold text-stone-600 uppercase">DOMICILIO:</span>
            <span className="text-stone-800 text-[11px]">{order.address}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1 border-t border-stone-200">
            <span className="text-[10px] font-bold text-stone-600 uppercase">PERIODO APLICABLE:</span>
            <span className="font-bold font-mono text-stone-800">{order.period}</span>
          </div>
        </div>

        {/* DESGLOSE DE CONCEPTOS */}
        <div className="space-y-1.5">
          <span className="font-bold text-[10px] uppercase text-stone-700 tracking-wider font-sans block">
            DESGLOSE DE CONCEPTOS DE PAGO:
          </span>
          <div className="border border-stone-800 rounded overflow-hidden">
            <table className="w-full text-left text-[11px] font-sans">
              <thead className="bg-stone-800 text-white font-bold text-[10px]">
                <tr>
                  <th className="py-1 px-3">CONCEPTO REGLAMENTARIO</th>
                  <th className="py-1 px-3 text-center">APLICA</th>
                  <th className="py-1 px-3 text-right">IMPORTE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {OFFICIAL_PAYMENT_CONCEPTS.map((c) => {
                  const isIncluded = order.concepts.includes(c.label);
                  const amount = c.id === 'otros' ? order.amount : c.defaultAmount;
                  return (
                    <tr key={c.id} className={isIncluded ? 'bg-amber-50/70 font-semibold' : 'text-stone-400'}>
                      <td className="py-1 px-3">
                        {c.label}
                        {c.id === 'otros' && isIncluded && order.customConcept && (
                          <span className="block text-[9px] text-stone-600 italic">
                            ({order.customConcept})
                          </span>
                        )}
                      </td>
                      <td className="py-1 px-3 text-center font-bold font-mono">
                        {isIncluded ? '[ X ]' : '[   ]'}
                      </td>
                      <td className="py-1 px-3 text-right font-mono">
                        {isIncluded ? `$${amount.toFixed(2)}` : '-'}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-stone-100 font-bold border-t-2 border-stone-800 text-stone-950">
                  <td colSpan={2} className="py-2 px-3 text-right uppercase">
                    TOTAL A LIQUIDAR EN VENTANILLA:
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-sm text-amber-950">
                    ${(order.amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* IMPORTE CON LETRA */}
        <div className="bg-stone-50 p-2.5 rounded border border-stone-300 font-sans text-[11px]">
          <span className="font-bold text-stone-600 block text-[9px] uppercase">CANTIDAD EN LETRA:</span>
          <span className="font-bold font-mono text-stone-900 uppercase">
            {numberToSpanishCurrencyWords(order.amount || 0)}
          </span>
        </div>

        {/* RECUADRO PARA SELLO DE TESORERÍA Y DATOS DE PAGO */}
        <div className="border-2 border-dashed border-stone-600 rounded-lg p-3 space-y-3 bg-stone-50/50">
          <div className="text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 block">
              ESPACIO PARA SELLO DE TESORERÍA MUNICIPAL
            </span>
            <span className="text-[9px] text-stone-500 italic block">
              Este recibo debe ser sellado por la Caja de Tesorería al momento del pago
            </span>
          </div>

          {/* Recuadro grande para el sello */}
          <div className="border-2 border-stone-800 rounded-md h-24 bg-white flex items-center justify-center">
            <span className="text-[9px] text-stone-400 font-mono uppercase">
              [ ESPACIO RESERVADO PARA SELLO OFICIAL ]
            </span>
          </div>

          {/* Líneas para anotar datos de pago */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10px] font-sans pt-2">
            <div>
              <span className="font-bold text-stone-600 uppercase block text-[8.5px] mb-0.5">
                FECHA DE PAGO:
              </span>
              <div className="border-b border-stone-500 h-5"></div>
            </div>
            <div>
              <span className="font-bold text-stone-600 uppercase block text-[8.5px] mb-0.5">
                NO. DE RECIBO:
              </span>
              <div className="border-b border-stone-500 h-5"></div>
            </div>
            <div>
              <span className="font-bold text-stone-600 uppercase block text-[8.5px] mb-0.5">
                NOMBRE DEL CAJERO:
              </span>
              <div className="border-b border-stone-500 h-5"></div>
            </div>
          </div>
        </div>

        {/* P4: MINIATURA DEL RECIBO FÍSICO SELLADO (referencia) */}
        {miniaturaReciboFisico && (
          <div className="flex justify-center pt-2">
            <div className="flex flex-col items-center gap-1">
              <div className="border-2 border-stone-700 rounded-md p-1 bg-white shadow-sm">
                <img
                  src={miniaturaReciboFisico}
                  alt="Recibo físico sellado (referencia)"
                  crossOrigin="anonymous"
                  style={{
                    width: '90px',
                    height: '120px',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              </div>
              <span className="text-[8px] font-bold uppercase text-stone-600 tracking-wider text-center leading-tight">
                RECIBO FÍSICO SELLADO
                <br />
                (REFERENCIA)
              </span>
              {(folioFierro || nombreProductor) && (
                <span className="text-[7.5px] font-mono text-stone-500 text-center leading-tight max-w-[120px]">
                  {folioFierro && <>{folioFierro}<br /></>}
                  {nombreProductor && <>{nombreProductor}</>}
                </span>
              )}
            </div>
          </div>
        )}

        {/* FIRMA DEL CONTRIBUYENTE */}
        <div className="grid grid-cols-1 gap-8 pt-4 font-sans text-center text-[10px]">
          <div>
            <div className="h-12 border-b border-stone-800 flex items-end justify-center pb-1">
              <span className="font-mono text-[9px] text-stone-400 uppercase">
                FIRMA DEL CONTRIBUYENTE
              </span>
            </div>
            <span className="font-bold text-stone-900 block mt-1 uppercase">
              C. {order.taxpayerName}
            </span>
            <span className="text-stone-500 block text-[9px]">CONFORME CON EL ENTERO</span>
          </div>
        </div>

        {/* Pie de página */}
        <div className="text-[8.5px] text-stone-400 font-mono text-center pt-2 border-t border-stone-200">
          EJEMPLAR PARA EL CONTRIBUYENTE · CONSERVE ESTE COMPROBANTE PARA EL EXPEDIENTE DE FIERRO
        </div>
      </div>
    </div>
  );
};