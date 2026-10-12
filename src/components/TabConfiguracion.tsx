import React, { useState } from 'react';
import { MunicipalConfig } from '../types';
import { getMunicipalDatabase } from '../utils/database';
import {
  getStoredEjidos,
  addCustomEjido,
  getStoredMunicipios,
  addCustomMunicipio,
} from '../utils/catalogs';
import {
  getStoredSeriesConfig,
  saveStoredSeriesConfig,
  formatFolioString,
  formatRegistrationString,
  SeriesNumberingConfig,
} from '../utils/numberingConfig';
import {
  Settings,
  Building,
  UserCheck,
  FileText,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  Award,
  Shield,
  MapPin,
  Plus,
  Building2,
  Image,
  Sparkles,
  Sliders,
  Hash,
  Fingerprint,
  Lock,
  KeyRound,
  ShieldAlert,
  Trash2,
  DollarSign,
} from 'lucide-react';
import { PanucoMunicipalLogo } from './PanucoMunicipalLogo';
import { MunicipalUser, BiometricCredential } from '../types';
import { getCurrentUser } from '../utils/auditAuth';
import {
  getStoredBiometricCredentials,
  revokeBiometricCredential,
  isBiometricsSupported,
} from '../services/biometricsService';
import { BiometricEnrollmentModal } from './Biometrics/BiometricEnrollmentModal';
import { BiometricVerificationModal } from './Biometrics/BiometricVerificationModal';
import { SettingsFinanzasCatalogo } from './Finance/SettingsFinanzasCatalogo';
import { getReciboFotoEnabled, setReciboFotoEnabled } from '../utils/preferences';

interface TabConfiguracionProps {
  municipalConfig: MunicipalConfig;
  onChangeMunicipalConfig: (config: MunicipalConfig) => void;
  currentUser?: MunicipalUser;
  initialSection?: 'general' | 'finanzas' | 'biometria' | 'respaldo' | 'operacion';
}

export const TabConfiguracion: React.FC<TabConfiguracionProps> = ({
  municipalConfig,
  onChangeMunicipalConfig,
  currentUser: propUser,
  initialSection = 'general',
}) => {
  const currentUser = propUser || getCurrentUser();
  const [activeSection, setActiveSection] = useState<'general' | 'finanzas' | 'biometria' | 'respaldo' | 'operacion'>(
    initialSection
  );
  const [notice, setNotice] = useState<string | null>(null);

  // Biometrics State
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [userBiometrics, setUserBiometrics] = useState<BiometricCredential[]>(() =>
    getStoredBiometricCredentials(currentUser.id)
  );
  const [biometricHardware, setBiometricHardware] = useState<any>(null);

  React.useEffect(() => {
    isBiometricsSupported().then(setBiometricHardware);
    setUserBiometrics(getStoredBiometricCredentials(currentUser.id));
  }, [currentUser.id]);

  // Catalogs State
  const [ejidosList, setEjidosList] = useState<string[]>(() => getStoredEjidos());
  const [municipiosList, setMunicipiosList] = useState<string[]>(() => getStoredMunicipios());
  const [newMunInput, setNewMunInput] = useState('');
  const [newEjidoInput, setNewEjidoInput] = useState('');

  // Series Numbering & Format Configuration State
  const [seriesConfig, setSeriesConfig] = useState<SeriesNumberingConfig>(() => getStoredSeriesConfig());
  // FIX_RECIBO_FOTO: Estado del toggle de foto del recibo sellado
  const [reciboFotoEnabled, setReciboFotoEnabledState] = useState<boolean>(() => getReciboFotoEnabled());

  const handleFieldChange = (field: keyof MunicipalConfig, value: string) => {
    let finalVal = value;
    if (typeof finalVal === 'string' && field !== 'municipalityEmail' && !field.toLowerCase().includes('logo') && !field.toLowerCase().includes('url')) {
      finalVal = finalVal.toUpperCase();
    }
    onChangeMunicipalConfig({
      ...municipalConfig,
      [field]: finalVal,
    });
  };

  const handleExportDatabase = () => {
    const db = getMunicipalDatabase();
    const backupData = {
      sistema: 'Sistema Oficial de Registro de Fierro Quemador',
      municipio: 'H. Ayuntamiento de Pánuco, Veracruz',
      fechaExportacion: new Date().toISOString(),
      totalRegistros: db.length,
      configuracionMunicipal: municipalConfig,
      registros: db,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Respaldo_Padron_Fierros_Panuco_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setNotice('Base de datos oficial y configuración exportadas exitosamente en JSON.');
    setTimeout(() => setNotice(null), 4000);
  };

  const handleImportDatabase = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && parsed.configuracionMunicipal) {
          onChangeMunicipalConfig(parsed.configuracionMunicipal);
        }
        setNotice(`Respaldo importado correctamente con ${parsed.totalRegistros || 'múltiples'} registros.`);
        setTimeout(() => setNotice(null), 4000);
      } catch (err) {
        alert('El archivo JSON de respaldo no cuenta con un formato válido.');
      }
    };
    reader.readAsText(file);
  };

  const handleResetDefaults = () => {
    onChangeMunicipalConfig({
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
      customLogoUrl: '',
      coatOfArmsUrl: '',
    });
    setNotice('Valores institucionales de Pánuco restablecidos con éxito.');
    setTimeout(() => setNotice(null), 3000);
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-8 w-full max-w-full overflow-x-hidden">
      {/* Title */}
      <div className="border-b border-stone-300 pb-4 sm:pb-6 mb-6 sm:mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
        <div>
          <span className="text-[10px] sm:text-xs uppercase tracking-widest font-semibold text-amber-800 block">
            Administración del Sistema · Pánuco, Ver.
          </span>
          <h1 className="text-xl sm:text-3xl font-cinzel font-bold text-stone-900 mt-1 break-words">
            Configuración e Inserción de Membretes Oficiales
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 mt-1">
            Personalice nombres de los funcionarios, periodos de gobierno, citas legales y respaldos del padrón.
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetDefaults}
          className="w-full sm:w-auto px-3.5 py-1.5 text-xs font-semibold text-stone-700 bg-stone-200 hover:bg-stone-300 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
        >
          <RotateCcw className="w-3.5 h-3.5 shrink-0" />
          <span>Restablecer Membretes</span>
        </button>
      </div>

      {notice && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg flex items-center justify-between text-sm shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Sub-navegación por Secciones de Administración */}
      <div className="flex items-center gap-2 mb-6 border-b border-stone-200 pb-3 overflow-x-auto no-scrollbar text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveSection('general')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeSection === 'general'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200'
          }`}
        >
          <Building size={14} />
          <span>1. Membretes y Catálogos</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('finanzas')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeSection === 'finanzas'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-amber-900 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30'
          }`}
        >
          <DollarSign size={14} className={activeSection === 'finanzas' ? 'text-white' : 'text-amber-700'} />
          <span>2. Finanzas: Catálogo de Servicios</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              activeSection === 'finanzas' ? 'bg-amber-800 text-amber-200' : 'bg-amber-200 text-amber-950'
            }`}
          >
            Tarifario
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('biometria')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeSection === 'biometria'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200'
          }`}
        >
          <Fingerprint size={14} />
          <span>3. Seguridad y Biometría</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('respaldo')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeSection === 'respaldo'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200'
          }`}
        >
          <Shield size={14} />
          <span>4. Respaldo de Base de Datos</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('operacion')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeSection === 'operacion'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-amber-900 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30'
          }`}
        >
          <Sliders size={14} className={activeSection === 'operacion' ? 'text-white' : 'text-amber-700'} />
          <span>5. Operación</span>
        </button>
      </div>

      {/* SECCIÓN 2: FINANZAS Y CATÁLOGO DE SERVICIOS */}
      {activeSection === 'finanzas' && (
        <SettingsFinanzasCatalogo
          currentUser={currentUser}
          onNotice={(msg) => {
            setNotice(msg);
            setTimeout(() => setNotice(null), 4000);
          }}
        />
      )}

      {/* SECCIONES RESTANTES */}
      {activeSection !== 'finanzas' && (
      <div className="space-y-8">
        {/* Group 1: Datos Institucionales de la Entidad */}
        {activeSection === 'general' && (
        <>
        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-stone-100 pb-3 mb-5">
            <div className="p-2 bg-amber-100 text-amber-900 rounded-lg">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-cinzel font-bold text-stone-900">
                1. Identidad Institucional y Municipio
              </h2>
              <p className="text-xs text-stone-500">
                Membretes oficiales de cabecera que figuran en el Certificado y Credencial Ganadera
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                Nombre Oficial del Ayuntamiento
              </label>
              <input
                type="text"
                value={municipalConfig.municipalityName}
                onChange={(e) => handleFieldChange('municipalityName', e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-stone-50/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                Entidad Federativa
              </label>
              <input
                type="text"
                value={municipalConfig.stateName}
                onChange={(e) => handleFieldChange('stateName', e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-stone-50/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                Dependencia Responsable del Padrón
              </label>
              <input
                type="text"
                value={municipalConfig.departmentName}
                onChange={(e) => handleFieldChange('departmentName', e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-stone-50/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                Periodo Constitucional de la Administración
              </label>
              <input
                type="text"
                value={municipalConfig.administrationPeriod}
                onChange={(e) => handleFieldChange('administrationPeriod', e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-stone-50/50"
              />
            </div>

            <div className="sm:col-span-2 border-t border-stone-200 pt-4 mt-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 mb-3 flex items-center gap-1.5">
                <Building className="w-4 h-4" />
                <span>Datos Oficiales del Palacio Municipal (Figuran en la Esquina Superior Derecha del Título)</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Dirección Oficial del Palacio Municipal
                  </label>
                  <input
                    type="text"
                    value={municipalConfig.municipalityAddress || ''}
                    placeholder="Palacio Municipal s/n, Zona Centro, C.P. 93990, Pánuco, Ver."
                    onChange={(e) => handleFieldChange('municipalityAddress', e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-stone-50/50"
                  />
                  <span className="text-[11px] text-stone-500 mt-0.5 block">
                    Ubicación impresa en el recuadro superior derecho del certificado.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Lema Institucional de la Administración
                  </label>
                  <input
                    type="text"
                    value={municipalConfig.municipalityMotto || ''}
                    placeholder="Transformando el Campo con Honestidad, Trabajo y Cercanía a la Gente"
                    onChange={(e) => handleFieldChange('municipalityMotto', e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-stone-50/50"
                  />
                  <span className="text-[11px] text-stone-500 mt-0.5 block">
                    Lema o consigna de la administración municipal en funciones.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Teléfono(s) de Atención Ciudadana
                  </label>
                  <input
                    type="text"
                    value={municipalConfig.municipalityPhone || ''}
                    placeholder="Tel. (846) 266-0011 / 266-0012"
                    onChange={(e) => handleFieldChange('municipalityPhone', e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-stone-50/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Correo Electrónico (Email) Institucional
                  </label>
                  <input
                    type="text"
                    value={municipalConfig.municipalityEmail || ''}
                    placeholder="contacto@panuco.gob.mx · fomentoagropecuario@panuco.gob.mx"
                    onChange={(e) => handleFieldChange('municipalityEmail', e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-stone-50/50"
                  />
                </div>
              </div>
            </div>

            {/* Logo Oficial del Municipio Selector & Preview */}
            <div className="sm:col-span-2 border-t border-stone-200 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 mb-2 flex items-center gap-1.5">
                <Image className="w-4 h-4" />
                <span>Logo Oficial del Municipio de Pánuco (Esquina Superior Derecha)</span>
              </h3>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-amber-50/40 p-3.5 rounded-lg border border-amber-200/70">
                <div className="flex flex-col items-center shrink-0">
                  <PanucoMunicipalLogo
                    customLogoUrl={municipalConfig.customLogoUrl || municipalConfig.coatOfArmsUrl}
                    size="lg"
                  />
                  <span className="text-[10px] text-stone-500 font-mono-data mt-1 text-center">
                    {municipalConfig.customLogoUrl ? 'Logo Personalizado' : 'Escudo Oficial Vector'}
                  </span>
                </div>

                <div className="flex-1 space-y-2 w-full">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                      URL de Imagen del Logo Municipal (Opcional)
                    </label>
                    <input
                      type="url"
                      value={municipalConfig.customLogoUrl || ''}
                      placeholder="https://ejemplo.gob.mx/logo-panuco.png o deje vacío para el escudo oficial"
                      onChange={(e) => handleFieldChange('customLogoUrl', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded focus:ring-2 focus:ring-amber-500 bg-white"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="px-3 py-1.5 text-xs font-medium bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 rounded cursor-pointer transition-colors flex items-center gap-1.5 shadow-2xs">
                      <Upload className="w-3.5 h-3.5 text-stone-600" />
                      <span>Subir Imagen desde Archivo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => {
                              if (typeof reader.result === 'string') {
                                handleFieldChange('customLogoUrl', reader.result);
                                setNotice('Logo municipal actualizado correctamente.');
                                setTimeout(() => setNotice(null), 3000);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    {municipalConfig.customLogoUrl && (
                      <button
                        type="button"
                        onClick={() => handleFieldChange('customLogoUrl', '')}
                        className="px-2.5 py-1.5 text-xs text-rose-700 hover:bg-rose-50 border border-rose-200 rounded transition-colors cursor-pointer"
                      >
                        Restablecer al Escudo Oficial
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Group 2: Firmantes y Funcionarios Autorizados */}
        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-stone-100 pb-3 mb-5">
            <div className="p-2 bg-emerald-100 text-emerald-900 rounded-lg">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-cinzel font-bold text-stone-900">
                2. Servidores Públicos Autorizados para Firmas
              </h2>
              <p className="text-xs text-stone-500">
                Nombres y cargos oficiales que suscribirán los certificados municipales
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                Tesorero Municipal (Nombre)
              </label>
              <input
                type="text"
                value={municipalConfig.treasurerName}
                onChange={(e) => handleFieldChange('treasurerName', e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-stone-50/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                Cargo del Tesorero
              </label>
              <input
                type="text"
                value={municipalConfig.treasurerTitle}
                onChange={(e) => handleFieldChange('treasurerTitle', e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-stone-50/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                Director de Fomento Agropecuario (Nombre)
              </label>
              <input
                type="text"
                value={municipalConfig.directorName}
                onChange={(e) => handleFieldChange('directorName', e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-stone-50/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                Cargo del Director de Fomento
              </label>
              <input
                type="text"
                value={municipalConfig.directorTitle}
                onChange={(e) => handleFieldChange('directorTitle', e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-stone-50/50"
              />
            </div>
          </div>
        </div>

        {/* Group 3: Fundamento Legal de la Ley Ganadera */}
        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-stone-100 pb-3 mb-5">
            <div className="p-2 bg-stone-800 text-amber-400 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-cinzel font-bold text-stone-900">
                3. Fundamento Jurídico de la Ley Ganadera del Estado de Veracruz
              </h2>
              <p className="text-xs text-stone-500">
                Texto normativo que otorga plena validez jurídica al registro de fierro
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
              Texto de Fundamentación Legal al Pie del Certificado
            </label>
            <textarea
              rows={4}
              value={municipalConfig.legalBasisText}
              onChange={(e) => handleFieldChange('legalBasisText', e.target.value)}
              className="w-full px-3.5 py-2 text-xs sm:text-sm border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-stone-50/50 leading-relaxed font-sans"
            />
          </div>
        </div>

        {/* Group 4: Catálogo de Municipios, Ejidos y Extensiones */}
        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-stone-100 pb-3 mb-5">
            <div className="p-2 bg-emerald-700 text-white rounded-lg">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-cinzel font-bold text-stone-900">
                4. Catálogo Territorial: Municipios, Ejidos, Congregaciones y Extensiones
              </h2>
              <p className="text-xs text-stone-500">
                Administre los municipios registrados y las localidades pecuarias disponibles en el formulario de registro y buscador
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Municipios */}
            <div className="p-4 bg-stone-50/80 rounded-xl border border-stone-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-800" />
                  <h3 className="font-semibold text-xs sm:text-sm text-stone-900">
                    Municipios y Demarcaciones Disponibles ({municipiosList.length})
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newMunInput}
                    onChange={(e) => setNewMunInput(e.target.value)}
                    placeholder="Nuevo municipio..."
                    className="px-2.5 py-1 text-xs border border-stone-300 rounded-md bg-white focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newMunInput.trim()) return;
                      const updated = addCustomMunicipio(newMunInput.trim());
                      setMunicipiosList(updated);
                      setNewMunInput('');
                      setNotice(`Municipio "${newMunInput.trim()}" agregado al catálogo.`);
                      setTimeout(() => setNotice(null), 3000);
                    }}
                    className="px-2.5 py-1 text-xs font-bold text-white bg-amber-700 hover:bg-amber-600 rounded-md flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Agregar (+)</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                {municipiosList.map((mun) => (
                  <span
                    key={mun}
                    className="px-2 py-0.5 rounded text-xs bg-white text-stone-800 border border-stone-300 shadow-2xs font-medium"
                  >
                    {mun}
                  </span>
                ))}
              </div>
            </div>

            {/* Ejidos, Congregaciones y Extensiones */}
            <div className="p-4 bg-stone-50/80 rounded-xl border border-stone-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-700" />
                  <h3 className="font-semibold text-xs sm:text-sm text-stone-900">
                    Ejidos, Congregaciones, Rancherías y Extensiones ({ejidosList.length})
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newEjidoInput}
                    onChange={(e) => setNewEjidoInput(e.target.value)}
                    placeholder="Nueva localidad..."
                    className="px-2.5 py-1 text-xs border border-stone-300 rounded-md bg-white focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newEjidoInput.trim()) return;
                      const updated = addCustomEjido(newEjidoInput.trim());
                      setEjidosList(updated);
                      setNewEjidoInput('');
                      setNotice(`Localidad "${newEjidoInput.trim()}" agregada al catálogo.`);
                      setTimeout(() => setNotice(null), 3000);
                    }}
                    className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-md flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Agregar (+)</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
                {ejidosList.map((ejido) => (
                  <span
                    key={ejido}
                    className="px-2 py-0.5 rounded text-xs bg-white text-stone-800 border border-stone-300 shadow-2xs font-medium"
                  >
                    {ejido}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Group 5: Control Oficial de Series: Formato y Dígitos de Inicio para Folio y Registro */}
        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500 text-stone-950 rounded-lg">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-cinzel font-bold text-stone-900">
                  5. Nomenclatura Oficial: Formato y Dígitos de Inicio de Folio y Registro
                </h2>
                <p className="text-xs text-stone-500">
                  Establezca el prefijo, nomenclatura y correlativo inicial para los nuevos expedientes y asientos notariales
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                saveStoredSeriesConfig(seriesConfig);
                setNotice('Configuración oficial de series, formatos y dígitos iniciales guardada.');
                setTimeout(() => setNotice(null), 3500);
              }}
              className="px-4 py-2 text-xs font-bold text-stone-900 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>Guardar Series Oficiales</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Folio Oficial Municipal */}
            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-950 font-mono-data flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-amber-700" /> Folio Oficial Municipal
                </h3>
                <span className="text-[11px] font-mono-data text-stone-500">Auto-incremental</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Formato / Prefijo:
                  </label>
                  <input
                    type="text"
                    value={seriesConfig.folioPrefix}
                    onChange={(e) => {
                      const updated = { ...seriesConfig, folioPrefix: e.target.value.toUpperCase() };
                      setSeriesConfig(updated);
                    }}
                    placeholder="PAN-2026-"
                    className="w-full px-3 py-1.5 text-xs font-mono-data font-bold border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 uppercase bg-white"
                  />
                  <span className="text-[10px] text-stone-500 block mt-0.5">Ej. PAN-2026-, PAN-, EXP-</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Dígitos de Inicio:
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={seriesConfig.folioStartNumber}
                    onChange={(e) => {
                      const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                      const updated = { ...seriesConfig, folioStartNumber: val };
                      setSeriesConfig(updated);
                    }}
                    placeholder="4290"
                    className="w-full px-3 py-1.5 text-xs font-mono-data font-bold border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-white"
                  />
                  <span className="text-[10px] text-stone-500 block mt-0.5">Número de inicio</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-amber-200/60 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-stone-600">Relleno de Ceros:</span>
                  <select
                    value={seriesConfig.folioPaddingLength}
                    onChange={(e) => {
                      const updated = { ...seriesConfig, folioPaddingLength: Number(e.target.value) };
                      setSeriesConfig(updated);
                    }}
                    className="text-xs px-2 py-1 border border-stone-300 rounded bg-white"
                  >
                    <option value={5}>5 dígitos (ej. 04290)</option>
                    <option value={4}>4 dígitos (ej. 4290)</option>
                    <option value={6}>6 dígitos (ej. 004290)</option>
                    <option value={0}>Sin ceros</option>
                  </select>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-stone-500 block">Ejemplo generado:</span>
                  <span className="font-mono-data font-bold text-amber-950 bg-amber-200/70 px-2 py-0.5 rounded text-xs">
                    {formatFolioString(seriesConfig.folioPrefix, seriesConfig.folioStartNumber, seriesConfig.folioPaddingLength)}
                  </span>
                </div>
              </div>
            </div>

            {/* Número de Registro Oficial */}
            <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-950 font-mono-data flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-700" /> Número de Registro Notarial
                </h3>
                <span className="text-[11px] font-mono-data text-stone-500">Asiento Oficial</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Formato / Prefijo:
                  </label>
                  <input
                    type="text"
                    value={seriesConfig.registrationPrefix}
                    onChange={(e) => {
                      const updated = { ...seriesConfig, registrationPrefix: e.target.value.toUpperCase() };
                      setSeriesConfig(updated);
                    }}
                    placeholder="REG-HAYTO-"
                    className="w-full px-3 py-1.5 text-xs font-mono-data font-bold border border-stone-300 rounded-md focus:ring-2 focus:ring-emerald-500 uppercase bg-white"
                  />
                  <span className="text-[10px] text-stone-500 block mt-0.5">Ej. REG-HAYTO-, REG-PAN-</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Dígitos de Inicio:
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={seriesConfig.registrationStartNumber}
                    onChange={(e) => {
                      const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                      const updated = { ...seriesConfig, registrationStartNumber: val };
                      setSeriesConfig(updated);
                    }}
                    placeholder="4290"
                    className="w-full px-3 py-1.5 text-xs font-mono-data font-bold border border-stone-300 rounded-md focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                  <span className="text-[10px] text-stone-500 block mt-0.5">Número de asiento</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-emerald-200/60 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-stone-600">Relleno de Ceros:</span>
                  <select
                    value={seriesConfig.registrationPaddingLength}
                    onChange={(e) => {
                      const updated = { ...seriesConfig, registrationPaddingLength: Number(e.target.value) };
                      setSeriesConfig(updated);
                    }}
                    className="text-xs px-2 py-1 border border-stone-300 rounded bg-white"
                  >
                    <option value={4}>4 dígitos (ej. 4290)</option>
                    <option value={5}>5 dígitos (ej. 04290)</option>
                    <option value={6}>6 dígitos (ej. 004290)</option>
                    <option value={0}>Sin ceros</option>
                  </select>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-stone-500 block">Ejemplo generado:</span>
                  <span className="font-mono-data font-bold text-emerald-950 bg-emerald-200/70 px-2 py-0.5 rounded text-xs">
                    {formatRegistrationString(seriesConfig.registrationPrefix, seriesConfig.registrationStartNumber, seriesConfig.registrationPaddingLength)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        </>
        )}

        {/* Group 5: Seguridad y Autenticación Biométrica (Huella Digital) */}
        {activeSection === 'biometria' && (
        <div className="bg-white border-2 border-stone-200 rounded-xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-amber-600 to-amber-800 text-white rounded-xl shadow-md">
                <Fingerprint className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-base font-cinzel font-bold text-stone-900">
                  5. Seguridad y Autenticación Biométrica (Huella Digital / WebAuthn)
                </h2>
                <p className="text-xs text-stone-500">
                  Enrolamiento y cotejo de huellas dactilares para firma de trámites y acceso de operadores
                </p>
              </div>
            </div>

            <span className="text-[10px] font-mono font-bold px-2.5 py-1 bg-stone-100 text-stone-700 rounded-lg border border-stone-200">
              FIPS / WebAuthn FIDO2
            </span>
          </div>

          {/* Status Bar */}
          <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-stone-900">Operador Activo:</span>
                <span className="text-stone-700">{currentUser.fullName} ({currentUser.badgeNumber})</span>
              </div>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Hardware: {biometricHardware?.reason || 'Sensor Biométrico Integrado / Lector USB Municipal'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsVerifyModalOpen(true)}
                disabled={userBiometrics.length === 0}
                className="px-3.5 py-2 text-xs font-semibold text-stone-800 bg-white hover:bg-stone-100 disabled:opacity-40 border border-stone-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                title="Probar cotejo biométrico en tiempo real"
              >
                <Fingerprint size={14} className="text-amber-600" />
                <span>Probar Cotejo de Huella</span>
              </button>

              <button
                type="button"
                onClick={() => setIsEnrollModalOpen(true)}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>Registrar Huella Digital</span>
              </button>
            </div>
          </div>

          {/* Registered Credentials List */}
          {userBiometrics.length > 0 ? (
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-600 block">
                Huellas Dactilares Vinculadas al Perfil ({userBiometrics.length}):
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {userBiometrics.map((cred) => (
                  <div
                    key={cred.id}
                    className="p-3 bg-amber-50/70 border border-amber-300 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-amber-200 text-amber-900 rounded-lg">
                        <Fingerprint size={18} />
                      </div>
                      <div>
                        <strong className="text-stone-900 block font-bold">
                          {cred.fingerIndex.replace(/_/g, ' ')}
                        </strong>
                        <span className="text-[10px] text-stone-600 font-mono block">
                          Folio: {cred.credentialId.slice(0, 20)}...
                        </span>
                        <span className="text-[10px] text-stone-500 block">
                          Registrado: {new Date(cred.registeredAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm('¿Desea revocar y eliminar este registro biométrico?')) {
                          await revokeBiometricCredential(currentUser.id, cred.credentialId);
                          setUserBiometrics(getStoredBiometricCredentials(currentUser.id));
                          setNotice('Credencial biométrica eliminada permanentemente.');
                          setTimeout(() => setNotice(null), 3000);
                        }
                      }}
                      className="p-2 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Revocar huella (LFPDPPP)"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-stone-50 border border-dashed border-stone-300 rounded-xl text-center text-xs text-stone-500">
              No cuenta con huellas registradas aún. Presione <strong>"Registrar Huella Digital"</strong> para enrolar su dedo en el sistema.
            </div>
          )}

          {/* Privacy and GDPR Legal Notice */}
          <div className="p-3 bg-stone-100 rounded-xl text-[11px] text-stone-600 leading-relaxed">
            <strong>Protección de Datos Personales (LGPDPPSO / GDPR):</strong> El sistema nunca almacena imágenes fotográficas de huellas. Los datos se convierten localmente en un template hash criptográfico unidireccional y las firmas se efectúan dentro del chip seguro del dispositivo (TPM / Secure Enclave).
          </div>
        </div>
        )}

        {/* Group 6: Respaldo y Migración de Base de Datos */}
        {activeSection === 'respaldo' && (
        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-stone-100 pb-3 mb-5">
            <div className="p-2 bg-amber-600 text-white rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-cinzel font-bold text-stone-900">
                6. Respaldo y Seguridad de los 4,250 Registros
              </h2>
              <p className="text-xs text-stone-500">
                Exportación e importación de la base de datos municipal completa para auditorías o servidores externos
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              type="button"
              onClick={handleExportDatabase}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg shadow transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Respaldo JSON Completo</span>
            </button>

            <label className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Importar Respaldo JSON</span>
              <input type="file" accept=".json" onChange={handleImportDatabase} className="hidden" />
            </label>
          </div>
        </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            SECCION: OPERACION
            Preferencias de operacion del sistema
           ═══════════════════════════════════════════════════════ */}
        {activeSection === 'operacion' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header de seccion */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs">
              <div className="flex items-center gap-3 pb-4 mb-5 border-b border-stone-100">
                <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 shrink-0">
                  <Sliders size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                    Preferencias de Operación
                  </span>
                  <h2 className="text-lg font-cinzel font-bold text-stone-900">
                    Configuración del Flujo de Trabajo
                  </h2>
                  <p className="text-xs text-stone-500">
                    Ajustes que afectan el comportamiento diario del sistema.
                  </p>
                </div>
              </div>

              {/* Toggle: Foto del recibo sellado */}
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">📸</span>
                      <strong className="text-sm font-bold text-stone-900">
                        Solicitar foto del recibo sellado al confirmar pago
                      </strong>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed pl-7">
                      Si está activado, al marcar una orden como PAGADA se ofrecerá al operador la opción de tomar una foto del recibo físico sellado por Tesorería. Esta foto se guarda en Cloudinary y aparece en el portafolio de evidencias del propietario.
                    </p>
                    <p className="text-[11px] text-stone-500 italic mt-2 pl-7">
                      💡 La captura de la foto es siempre OPCIONAL para el operador. El PDF del recibo se genera automáticamente sin importar este ajuste.
                    </p>
                  </div>
                  <div className="shrink-0 pt-1">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reciboFotoEnabled}
                        onChange={(e) => {
                          const nuevoValor = e.target.checked;
                          setReciboFotoEnabledState(nuevoValor);
                          setReciboFotoEnabled(nuevoValor);
                          setNotice(nuevoValor
                            ? '✅ Captura de foto del recibo sellado ACTIVADA.'
                            : '📷 Captura de foto del recibo sellado DESACTIVADA.');
                          setTimeout(() => setNotice(null), 3500);
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-12 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                    <div className="text-center mt-1">
                      <span className={reciboFotoEnabled ? 'text-[10px] font-bold text-emerald-700' : 'text-[10px] font-bold text-stone-500'}>
                        {reciboFotoEnabled ? 'ACTIVADO' : 'DESACTIVADO'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info adicional */}
              <div className="mt-5 p-3 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-900">
                <strong>💡 Nota:</strong> Los cambios se guardan automáticamente en este navegador. Cada operador puede tener su propia preferencia.
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Modal de Enrolamiento de Huella Digital */}
      <BiometricEnrollmentModal
        currentUser={currentUser}
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        onEnrollmentComplete={() => {
          setUserBiometrics(getStoredBiometricCredentials(currentUser.id));
          setNotice('Nueva huella digital enrolada y asociada exitosamente al operador.');
          setTimeout(() => setNotice(null), 4000);
        }}
      />

      {/* Modal de Prueba de Verificación de Huella */}
      <BiometricVerificationModal
        currentUser={currentUser}
        isOpen={isVerifyModalOpen}
        onClose={() => setIsVerifyModalOpen(false)}
        actionTitle="Prueba de Cotejo Biométrico"
        actionDescription="Coloque su dedo sobre el sensor para validar la coincidencia contra el template oficial almacenado."
        onSuccess={(res) => {
          setNotice(`¡Identidad biométrica confirmada con éxito! (${res.fingerIndex?.replace(/_/g, ' ') || 'Huella válida'}).`);
          setTimeout(() => setNotice(null), 4000);
        }}
      />
    </div>
  );
};
