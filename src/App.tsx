import React, { useState, useEffect } from 'react';
import { ProducerData, BrandConfig, MunicipalConfig, HistoricalRecord, MunicipalUser, PreloadedOrderData } from './types';
import { generateUniqueProposals } from './utils/similarity';
import { getCurrentUser, recordAuditLog } from './utils/auditAuth';
import { validateFullProducerData, FullFormValidationError } from './utils/formValidation';
import { Navbar, AppTab } from './components/Navbar';
import { TabRegistro } from './components/TabRegistro';
import { TabCreador } from './components/TabCreador';
import { TabBuscador } from './components/TabBuscador';
import { TabAntiduplicidad } from './components/TabAntiduplicidad';
import { TabCertificado } from './components/TabCertificado';
import { TabReportes } from './components/TabReportes';
import { TabAuditoria } from './components/TabAuditoria';
import { TabConfiguracion } from './components/TabConfiguracion';
import { TabDigitalizacionHistorica } from './components/TabDigitalizacionHistorica';
import { FinanceManager } from './components/Finance/FinanceManager';
import { ProceduresHub, ProcedureCategoryId } from './components/Hub/ProceduresHub';
import { RevalidacionView } from './components/Views/RevalidacionView';
import { BajaFierroView } from './components/Views/BajaFierroView';
import { ConstanciaView } from './components/Views/ConstanciaView';
import { DeguelloView } from './components/Views/DeguelloView';
import { AuthModal } from './components/AuthModal';
import { ValidationErrorsModal } from './components/ValidationErrorsModal';
import { FloatingAIAssistant } from './components/FloatingAIAssistant';
import { inicializarSincronizacion } from './utils/googleSheetsIntegration';
// FASE_0_4: importar funciones de limpieza de borradores
import {
  clearCurrentSessionDraft,
  clearAllDraftVersions,
} from './utils/draftHistory';

// Clean Default: Formulario limpio por default conforme al requerimiento oficial
export const EMPTY_PRODUCER_DATA: ProducerData = {
  fullName: '',
  curp: '',
  rfc: '',
  ine: '',
  address: '',
  phone: '',
  municipio: 'Pánuco',
  ejido: '',
  email: '',
  propertyName: '',
  surfaceHectares: 0,
  tenureType: 'PROPIEDAD',
  cattleCount: 0,
  species: 'BOVINO',
  uppKey: '',
  folio: '',
  registrationNumber: '',
  bookNumber: 'Libro XII de Fierros de Herrar',
  folioPage: '',
  validityRange: '2026 - 2029',
  issueDate: new Date().toISOString().split('T')[0],
  status: 'Vigente',
  producerSignature: '',
  associatedRancher: 'NO',
  zootechnicalPurpose: 'BOVINO Y DOBLE PROPÓSITO',
};

export const INITIAL_BRAND_CONFIG: BrandConfig = {
  initials: '',
  topSymbol: 'none',
  bottomSymbol: 'none',
  centerSymbol: 'none',
  orientation: 'normal',
  strokeWidth: 14,
  slantAngle: 45,
  finish: 'forja_negra',
  hasOuterRing: false,
  hasSpurs: false,
  freehandPaths: [],
};

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('hub');

  // FIX_BOTON_VOLVER: recordar el tab desde donde se navego al certificado
  const lastTabBeforeCertificadoRef = React.useRef<AppTab>('hub');

  // =========================================================================
  // SYNC_INIT_HOOK: Sincronización automática con Google Sheets al iniciar
  // =========================================================================
  const [syncStatus, setSyncStatus] = useState<{
    online: boolean;
    registrosDescargados: number;
    encoladosPendientes: number;
    procesados: number;
    lastSync: string | null;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        console.log('%c🔄 Iniciando sincronización con Google Sheets...', 'color: #0ea5e9');
        const result = await inicializarSincronizacion();
        if (!mounted) return;
        setSyncStatus({
          online: result.online,
          registrosDescargados: result.registrosDescargados,
          encoladosPendientes: result.encoladosPendientes,
          procesados: result.procesados,
          lastSync: new Date().toISOString(),
        });
        if (result.online) {
          console.log('%c🟢 ONLINE · ' + result.registrosDescargados + ' registros sincronizados · ' + result.procesados + ' encolados procesados', 'color: #22c55e; font-weight: bold');
        } else {
          console.log('%c🔴 OFFLINE · Usando cache local · ' + result.encoladosPendientes + ' registros pendientes', 'color: #ef4444; font-weight: bold');
        }
      } catch (err) {
        console.warn('⚠️ Error en sincronización inicial:', err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const [financeInitialCategory, setFinanceInitialCategory] = useState<ProcedureCategoryId | null>(null);
  const [financePreloadedOrder, setFinancePreloadedOrder] = useState<PreloadedOrderData | null>(null);

  // Municipal Operator Session State
  const [currentUser, setCurrentUser] = useState<MunicipalUser>(() => getCurrentUser());
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Form is clean/empty by default
  const [producerData, setProducerData] = useState<ProducerData>(EMPTY_PRODUCER_DATA);

  // Brand Design Vector Configuration State
  const [brandConfig, setBrandConfig] = useState<BrandConfig>(INITIAL_BRAND_CONFIG);

  // Global validation modal state for print prevention
  const [isGlobalValidationOpen, setIsGlobalValidationOpen] = useState(false);
  const [globalValidationErrors, setGlobalValidationErrors] = useState<FullFormValidationError[]>([]);

  // Municipal Headers & Official Signatories State with Official Address, Motto, Phone and Email
  const [municipalConfig, setMunicipalConfig] = useState<MunicipalConfig>({
    municipalityName: 'H. Ayuntamiento Constitucional de Pánuco, Veracruz',
    stateName: 'Estado de Veracruz de Ignacio de la Llave',
    administrationPeriod: 'Administración Municipal 2025 - 2029 · Transformando el Campo',
    departmentName: 'Dirección de Fomento Agropecuario y Desarrollo Rural',
    mayorName: 'Mtro. Óscar Guzmán de Paz',
    mayorTitle: 'Presidente Municipal Constitucional',
    treasurerName: 'C.P. Fernando Aradillas Castillo',
    treasurerTitle: 'Tesorero Municipal',
    directorName: 'Ing. Faustino Meraz Sobrevilla',
    directorTitle: 'Director de Fomento Agropecuario',
    officialSealText: 'H. AYUNTAMIENTO DE PÁNUCO, VERACRUZ · REGISTRO GANADERO OFICIAL',
    legalBasisText:
      'Conforme a los Artículos 45, 48, 52, 60 y demás relativos de la Ley Ganadera del Estado de Veracruz de Ignacio de la Llave, se expide el presente Título y Registro de Fierro Marcador, Marca de Fuego y Señal de Sangre, habiéndose comprobado la legítima propiedad, tenencia legal del predio y el cumplimiento estricto del padrón pecuario municipal.',
    municipalityAddress: 'Palacio Municipal s/n, Zona Centro, C.P. 93990, Pánuco, Ver.',
    municipalityMotto: 'Transformando el Campo con Honestidad, Trabajo y Cercanía a la Gente',
    municipalityPhone: 'Tel. (846) 266-0011 / 266-0012',
    municipalityEmail: 'contacto@panuco.gob.mx · fomentoagropecuario@panuco.gob.mx',
  });

  // Handler to apply new initials from Tab 1 to Tab 2
  const handleApplyInitialsToBrand = (initials: string) => {
    setBrandConfig((prev) => ({
      ...prev,
      initials,
    }));
  };

  // Action from Tab 3 (Buscador): "Ver / Cargar en Certificado"
  const handleLoadRecordIntoCertificate = (record: HistoricalRecord) => {
    // FIX_CAMPOS_IMAGENES_CERTIFICADO: copiar TODOS los campos incluyendo imagenes, firma y vector
    setProducerData({
      // Datos del titular
      fullName: record.ownerName,
      curp: record.curp,
      rfc: record.rfc,
      ine: record.ine || (record.curp ? `${record.curp.slice(0, 10)}30H100` : 'GUAAAR62041530H100'),
      address: record.address,
      phone: record.phone,
      municipio: 'Pánuco',
      ejido: record.ejido,
      email: `${record.ownerName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '.')}@gmail.com`,
      propertyName: record.propertyName,
      surfaceHectares: record.surfaceHectares,
      tenureType: record.tenureType,
      cattleCount: record.cattleCount,
      species: record.species,
      uppKey: record.uppKey,
      associatedRancher: (record as any).associatedRancher || 'NO',
      zootechnicalPurpose: (record as any).zootechnicalPurpose || 'BOVINO Y DOBLE PROPÓSITO',

      // Asiento notarial
      folio: record.folio,
      registrationNumber: record.registrationNumber,
      bookNumber: record.bookNumber,
      folioPage: record.folioPage,
      validityRange: record.validityRange,
      issueDate: record.issueDate,
      status: record.status === 'Vigente' ? 'Vigente' : 'Renovación',

            // FASE_0_3: IMAGENES (foto titular, firma, INE) con fallbacks ampliados
      producerPhoto: (record as any).fotoTitularDriveUrl
        || (record as any).url_foto_titular
        || record.imagenes?.foto_titular
        || record.producerPhoto
        || '',

      producerSignature: (record as any).firmaDriveUrl
        || (record as any).url_firma
        || record.imagenes?.firma
        || record.producerSignature
        || '',

      inePhoto: (record as any).ineDriveUrl
        || (record as any).url_ine
        || record.imagenes?.credencial_ine
        || (record as any).inePhoto
        || '',

      // FASE_0_3: guardar URLs directas para FASE 0.3 (portafolio + certificado)
      ineDriveUrl: (record as any).url_ine || (record as any).ineDriveUrl,
      fotoTitularDriveUrl: (record as any).url_foto_titular || (record as any).fotoTitularDriveUrl,
      firmaDriveUrl: (record as any).url_firma || (record as any).firmaDriveUrl,
      certificadoDriveUrl: (record as any).url_certificado || (record as any).certificadoDriveUrl,

      // FASE_0_3: FIERRO (URL del fierro digitalizado) con fallbacks
      fierroImageUrl: (record as any).url_fierro
        || (record as any).fierroImageUrl
        || record.imagenes?.fierro_digitalizado
        || record.extractedBrandImage
        || record.imagen_base64
        || '',

      // FIX: VECTOR 64D
      vector_64d: record.vector_64d || record.brandVector,
      brandVector: record.brandVector || record.vector_64d,
      vector_checksum: record.vector_checksum,
      vector_density: record.vector_density,
      vector_symmetry_h: record.vector_symmetry_h,
      vector_symmetry_v: record.vector_symmetry_v,
      vector_proportions: record.vector_proportions,
      vector_varianza: record.vector_varianza,
    } as ProducerData);

    setBrandConfig({
      initials: record.initials,
      topSymbol: record.topSymbol,
      bottomSymbol: record.bottomSymbol,
      centerSymbol: 'none',
      orientation: record.orientation,
      strokeWidth: 14,
      slantAngle: 45,
      finish: 'forja_negra',
      hasOuterRing: false,
      hasSpurs: false,
      freehandPaths: [],
    });

    // FIX_NAVEGAR_A_CERTIFICADO: recordar el tab actual y navegar al certificado
    lastTabBeforeCertificadoRef.current = activeTab;
    setActiveTab('certificado');
  };

  // Quick Action: generate guaranteed unique brand
  const handleGenerateUnique = () => {
    const proposals = generateUniqueProposals(brandConfig);
    if (proposals.length > 0) {
      setBrandConfig(proposals[0]);
      recordAuditLog({
        actionType: 'FIERRO_GENERADO',
        details: `Generación de propuesta vectorial única garantizada con monograma "${proposals[0].initials}".`,
      });
      setActiveTab('creador');
    }
  };

  // Quick Action: print certificate STRICTLY GUARDED against incomplete/invalid forms
  const handleQuickPrint = () => {
    const validation = validateFullProducerData(producerData);
    if (!validation.isValid) {
      setGlobalValidationErrors(validation.errors);
      setIsGlobalValidationOpen(true);
      recordAuditLog({
        actionType: 'IMPRESION_DOCUMENTO',
        folioAffected: producerData.folio || 'SIN-FOLIO',
        producerAffected: producerData.fullName || 'SIN-TITULAR',
        details: `Intento de Impresión Rápida bloqueado por el sistema: Expediente pecuario incompleto (${validation.errors.length} campos faltantes o inválidos).`,
      });
      return;
    }

    setActiveTab('certificado');
    setTimeout(() => {
      window.print();
    }, 400);
  };

  // Navigation from Navbar: clear preloads when entering finance directly so the form is empty
  const handleSelectTab = (tab: AppTab) => {
    // FIX_BOTON_VOLVER: recordar el tab anterior cuando se navega al certificado
    if (tab === 'certificado' && activeTab !== 'certificado') {
      lastTabBeforeCertificadoRef.current = activeTab;
    }
    if (tab === 'finanzas' || (tab as string) === 'finance') {
      setFinanceInitialCategory(null);
      setFinancePreloadedOrder(null);
    }
    setActiveTab(tab);
  };

  // Handler when selecting a category or generating order from ProceduresHub
  const handleSelectProcedureCategory = (
    category: ProcedureCategoryId | string,
    preloaded?: PreloadedOrderData
  ) => {
    if (preloaded) {
      setFinanceInitialCategory(category as ProcedureCategoryId);
      setFinancePreloadedOrder(preloaded);
      setActiveTab('finanzas');
      return;
    }

    const cat = category.toUpperCase();
    if (cat === 'ALTA') {
      setActiveTab('alta');
    } else if (cat === 'REVALIDACION') {
      setActiveTab('revalidacion');
    } else if (cat === 'BAJA') {
      setActiveTab('baja');
    } else if (cat === 'CONSTANCIA') {
      setActiveTab('constancia');
    } else if (cat === 'DEGUELLO') {
      setActiveTab('deguello');
    } else {
      setFinanceInitialCategory(category as ProcedureCategoryId);
      setFinancePreloadedOrder(null);
      setActiveTab('finanzas');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-100 text-stone-900">
      {/* 3-Zone Strict Top Bar Navigation */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
        onQuickPrint={handleQuickPrint}
        onGenerateUnique={handleGenerateUnique}
      />

      {/* Main Tab Router View */}
      <main className="flex-1">
        {activeTab === 'hub' && (
          <ProceduresHub
            onSelectCategory={handleSelectProcedureCategory}
            onNavigateTo={(view) => setActiveTab(view as AppTab)}
            activeTab={activeTab}
            municipalConfig={municipalConfig}
            currentUser={currentUser}
            currentProducer={producerData}
          />
        )}

        {(activeTab === 'alta' || activeTab === 'registro') && (
          <TabRegistro
            producerData={producerData}
            onChangeProducerData={setProducerData}
            brandConfig={brandConfig}
            onChangeBrandConfig={setBrandConfig}
            onApplyInitialsToBrand={handleApplyInitialsToBrand}
            onGoToCreador={() => setActiveTab('creador')}
            onGoToCertificado={() => {
              // FASE_0_2: recordar que venimos del alta antes de ir al certificado
              lastTabBeforeCertificadoRef.current = 'alta';
              setActiveTab('certificado');
            }}
            onGoToDigitalizacion={() => setActiveTab('digitalizacion')}
            onGoToFinance={(cat, payload) => {
              setFinanceInitialCategory(cat || 'ALTA');
              setFinancePreloadedOrder(payload || null);
              setActiveTab('finanzas');
            }}
          />
        )}

        {activeTab === 'revalidacion' && (
          <RevalidacionView
            onBack={() => setActiveTab('hub')}
            onGoToFinance={(cat, payload) => {
              setFinanceInitialCategory(cat || 'REVALIDACION');
              setFinancePreloadedOrder(payload || null);
              setActiveTab('finanzas');
            }}
            municipalConfig={municipalConfig}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'baja' && (
          <BajaFierroView
            onBack={() => setActiveTab('hub')}
            onGoToFinance={(cat, payload) => {
              setFinanceInitialCategory(cat || 'BAJA');
              setFinancePreloadedOrder(payload || null);
              setActiveTab('finanzas');
            }}
            municipalConfig={municipalConfig}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'constancia' && (
          <ConstanciaView
            onBack={() => setActiveTab('hub')}
            onGoToFinance={(cat, payload) => {
              setFinanceInitialCategory(cat || 'CONSTANCIA');
              setFinancePreloadedOrder(payload || null);
              setActiveTab('finanzas');
            }}
            municipalConfig={municipalConfig}
            currentUser={currentUser}
            currentProducer={producerData}
          />
        )}

        {activeTab === 'deguello' && (
          <DeguelloView
            onBack={() => setActiveTab('hub')}
            onGoToFinance={(cat, payload) => {
              setFinanceInitialCategory(cat || 'DEGUELLO');
              setFinancePreloadedOrder(payload || null);
              setActiveTab('finanzas');
            }}
            municipalConfig={municipalConfig}
            currentUser={currentUser}
            currentProducer={producerData}
          />
        )}

        {activeTab === 'creador' && (
          <TabCreador
            brandConfig={brandConfig}
            onChangeBrandConfig={setBrandConfig}
            onGoToAntiduplicidad={() => setActiveTab('antiduplicidad')}
            onGoToCertificado={() => setActiveTab('certificado')}
          />
        )}

        {activeTab === 'buscador' && (
          <TabBuscador
            onLoadRecordIntoCertificate={handleLoadRecordIntoCertificate}
            onGoToCertificado={() => {
              // FASE_0_2: recordar que venimos del buscador antes de ir al certificado
              lastTabBeforeCertificadoRef.current = 'buscador';
              setActiveTab('certificado');
            }}
            onGoToRegistro={() => setActiveTab('alta')}
          />
        )}

        {activeTab === 'antiduplicidad' && (
          <TabAntiduplicidad
            brandConfig={brandConfig}
            onApplyBrandProposal={(newConfig) => {
              setBrandConfig(newConfig);
              setActiveTab('creador');
            }}
            onGoToCreador={() => setActiveTab('creador')}
          />
        )}

        {activeTab === 'certificado' && (
          <TabCertificado
            producerData={producerData}
            brandConfig={brandConfig}
            municipalConfig={municipalConfig}
            onGoToRegistro={() => setActiveTab('alta')}
            onChangeProducerData={setProducerData}
            onBack={() => setActiveTab(lastTabBeforeCertificadoRef.current)}
            onGoToFinance={(cat, payload) => {
              // FASE_0_2: desde el certificado, generar orden de pago en Finanzas
              setFinanceInitialCategory(cat || 'ALTA');
              setFinancePreloadedOrder(payload || null);
              lastTabBeforeCertificadoRef.current = 'certificado';
              setActiveTab('finanzas');
            }}
            onCerrarCiclo={() => {
              // FIX_FLUJO: cerrar el ciclo completo, limpiar todo y volver al hub
              recordAuditLog({
                actionType: 'REGISTRO_MODIFICADO',
                folioAffected: producerData.folio || 'SIN-FOLIO',
                producerAffected: producerData.fullName || 'SIN-TITULAR',
                details: 'Ciclo de registro completado: el operador cerro el flujo desde el certificado.',
              });

              // Limpiar formulario de productor y marca
              setProducerData(EMPTY_PRODUCER_DATA);
              setBrandConfig(INITIAL_BRAND_CONFIG);

              // FASE_0_4_FIX_LIMPIEZA_REAL: limpiar borradores locales
              try {
                clearCurrentSessionDraft();
                clearAllDraftVersions();
                try {
                  localStorage.removeItem('panuco_monogram_linked');
                } catch {}
                console.log('%c[Ciclo] Borradores locales limpiados correctamente', 'color: #22c55e; font-weight: bold');
              } catch (err) {
                console.warn('[Ciclo] Error limpiando borradores:', err);
              }

              // Limpiar preloads de finanzas
              setFinanceInitialCategory(null);
              setFinancePreloadedOrder(null);

              // Resetear el ref del tab anterior
              lastTabBeforeCertificadoRef.current = 'hub';

              // Navegar al hub principal
              setActiveTab('hub');

              console.log('%c[Ciclo] Registro cerrado y formulario limpiado. Volviendo al hub.', 'color: #22c55e; font-weight: bold');
            }}
          />
        )}

        {activeTab === 'reportes' && (
          <TabReportes
            municipalConfig={municipalConfig}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'auditoria' && <TabAuditoria currentUser={currentUser} />}

        {(activeTab === 'configuracion' || activeTab === 'settings') && (
          <TabConfiguracion
            municipalConfig={municipalConfig}
            onChangeMunicipalConfig={setMunicipalConfig}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'digitalizacion' && (
          <TabDigitalizacionHistorica
            onFillProducerForm={(filledData, initials) => {
              setProducerData((prev) => ({
                ...prev,
                ...filledData,
              }));
              if (initials && /^[A-Z]{1,3}$/.test(initials)) {
                setBrandConfig((prev) => ({
                  ...prev,
                  initials,
                }));
              }
            }}
            onGoToRegistro={() => setActiveTab('alta')}
            onGoToBuscador={() => setActiveTab('buscador')}
            onBack={() => setActiveTab('hub')}
          />
        )}

        {(activeTab === 'finanzas' || (activeTab as any) === 'finance') && (
          <FinanceManager
            currentProducer={producerData}
            currentUser={currentUser}
            municipalConfig={municipalConfig}
            initialCategory={financeInitialCategory}
            preloadedOrderData={financePreloadedOrder}
            onBackToHub={() => setActiveTab('hub')}
            onGoToCertificado={() => {
              // FIX_IR_CERTIFICADO: recordar que venimos de finanzas antes de ir al certificado
              lastTabBeforeCertificadoRef.current = 'finanzas';
              setActiveTab('certificado');
            }}
          />
        )}
      </main>

      {/* Global Validation Blocker Modal for Print Prevention */}
      <ValidationErrorsModal
        isOpen={isGlobalValidationOpen}
        onClose={() => setIsGlobalValidationOpen(false)}
        errors={globalValidationErrors}
        actionAttempted="print"
        onNavigateToStep={() => {
          setIsGlobalValidationOpen(false);
          setActiveTab('registro');
        }}
      />

      {/* Authentication and Operator Switch Modal */}
      <AuthModal
        currentUser={currentUser}
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onUserChanged={(user) => {
          setCurrentUser(user);
        }}
      />

      {/* Floating Relocatable AI Assistant Bubble */}
      <FloatingAIAssistant
        currentProducer={producerData}
        currentBrand={brandConfig}
        activeTab={activeTab}
        onNavigateTab={(tab) => setActiveTab(tab as AppTab)}
      />

      {/* Institutional Quiet Footer (hidden on print) */}
      <footer className="no-print bg-stone-900 border-t border-stone-800 text-stone-400 py-6 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <p className="text-stone-300 font-cinzel font-semibold">
              H. Ayuntamiento Constitucional de Pánuco, Veracruz
            </p>
            <p className="text-[11px] text-stone-500">
              Dirección de Fomento Agropecuario · Sistema Oficial de Registro de Fierro Quemador y Señal de Sangre
            </p>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span>Operador: {currentUser.fullName} ({currentUser.badgeNumber})</span>
            <span>·</span>
            <span>Ley Ganadera del Estado de Veracruz</span>
            <span>·</span>
            <span>Pánuco, Ver., México</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
