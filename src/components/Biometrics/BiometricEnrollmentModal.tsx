import React, { useState, useEffect } from 'react';
import {
  Fingerprint,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
  Lock,
  Sparkles,
  Info,
  RefreshCw,
  Clock,
  User,
  HardDrive,
  Check,
} from 'lucide-react';
import {
  BiometricCredential,
  BiometricFingerIndex,
  MunicipalUser,
} from '../../types';
import {
  enrollBiometricFingerprint,
  getStoredBiometricCredentials,
  revokeBiometricCredential,
  isBiometricsSupported,
  triggerHaptic,
} from '../../services/biometricsService';

interface BiometricEnrollmentModalProps {
  currentUser: MunicipalUser;
  isOpen: boolean;
  onClose: () => void;
  onEnrollmentComplete?: (credential: BiometricCredential) => void;
}

const FINGER_OPTIONS: { id: BiometricFingerIndex; label: string; iconSide: string }[] = [
  { id: 'INDICE_DERECHO', label: 'Dedo Índice Derecho', iconSide: 'Mano Derecha' },
  { id: 'PULGAR_DERECHO', label: 'Dedo Pulgar Derecho', iconSide: 'Mano Derecha' },
  { id: 'INDICE_IZQUIERDO', label: 'Dedo Índice Izquierdo', iconSide: 'Mano Izquierda' },
  { id: 'PULGAR_IZQUIERDO', label: 'Dedo Pulgar Izquierdo', iconSide: 'Mano Izquierda' },
];

export const BiometricEnrollmentModal: React.FC<BiometricEnrollmentModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onEnrollmentComplete,
}) => {
  const [selectedFinger, setSelectedFinger] = useState<BiometricFingerIndex>('INDICE_DERECHO');
  const [consentGiven, setConsentGiven] = useState(true);
  const [deviceLabel, setDeviceLabel] = useState('Lector Integrado Touch ID / Windows Hello');

  // Estados de proceso
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successCredential, setSuccessCredential] = useState<BiometricCredential | null>(null);

  // Lista de credenciales actuales del usuario
  const [userCredentials, setUserCredentials] = useState<BiometricCredential[]>([]);
  const [hardwareStatus, setHardwareStatus] = useState<{
    supported: boolean;
    platformAuthenticator: boolean;
    reason?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUserCredentials(getStoredBiometricCredentials(currentUser.id));
      isBiometricsSupported().then((res) => {
        setHardwareStatus(res);
        if (res.platformAuthenticator) {
          setDeviceLabel('Sensor Biométrico Integrado (Touch ID / Windows Hello)');
        } else {
          setDeviceLabel('Lector USB Municipal DigitalPersona / SecuGen');
        }
      });
      setSuccessCredential(null);
      setErrorMessage(null);
      setIsScanning(false);
      setScanProgress(0);
    }
  }, [isOpen, currentUser.id]);

  if (!isOpen) return null;

  const handleStartEnrollment = async () => {
    if (!consentGiven) {
      setErrorMessage('Debe aceptar los términos de consentimiento de datos biométricos.');
      triggerHaptic('error');
      return;
    }

    setErrorMessage(null);
    setIsScanning(true);
    setScanProgress(15);

    // Animación de captura progresiva de minutiae biométricas
    const progressTimer = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 85) {
          clearInterval(progressTimer);
          return 85;
        }
        return prev + 18;
      });
    }, 250);

    try {
      const cred = await enrollBiometricFingerprint({
        user: currentUser,
        fingerIndex: selectedFinger,
        deviceLabel,
        consentGiven,
      });

      clearInterval(progressTimer);
      setScanProgress(100);
      setSuccessCredential(cred);
      setUserCredentials(getStoredBiometricCredentials(currentUser.id));

      if (onEnrollmentComplete) {
        onEnrollmentComplete(cred);
      }
    } catch (err: any) {
      clearInterval(progressTimer);
      setErrorMessage(err?.message || 'No se pudo completar la captura biométrica.');
      triggerHaptic('error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleRevoke = async (credentialId: string) => {
    if (confirm('¿Está seguro de que desea revocar y eliminar este registro de huella digital?')) {
      await revokeBiometricCredential(currentUser.id, credentialId);
      setUserCredentials(getStoredBiometricCredentials(currentUser.id));
      setSuccessCredential(null);
      triggerHaptic('click');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full border-2 border-stone-800 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-amber-500 to-amber-700 text-white rounded-2xl shadow-md">
              <Fingerprint className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-900 block">
                Seguridad Biométrica Municipal
              </span>
              <h2 className="text-xl font-black font-cinzel text-stone-900">
                Enrolamiento de Huella Digital
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Operador info */}
        <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-2xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <User className="w-4 h-4 text-amber-600" />
            <div>
              <p className="font-bold text-stone-900">{currentUser.fullName}</p>
              <p className="text-[10px] text-stone-500">{currentUser.role} · Gafete: {currentUser.badgeNumber}</p>
            </div>
          </div>
          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
            {userCredentials.length > 0 ? `${userCredentials.length} Huella(s) Activa(s)` : 'Sin Huella'}
          </span>
        </div>

        {/* Existing Credentials List if any */}
        {userCredentials.length > 0 && !successCredential && !isScanning && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center justify-between">
              <span>Huellas Digitales Registradas:</span>
              <span className="text-[10px] text-stone-400 font-normal">Cotejo biométrico FIPS/ISO</span>
            </h4>
            <div className="space-y-2">
              {userCredentials.map((cred) => (
                <div
                  key={cred.id}
                  className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center shrink-0">
                      <Fingerprint size={18} />
                    </div>
                    <div>
                      <strong className="text-stone-900 block font-bold">{cred.fingerIndex.replace(/_/g, ' ')}</strong>
                      <span className="text-[10px] text-stone-500 font-mono">
                        Folio: {cred.credentialId.slice(0, 24)}... · Alta: {new Date(cred.registeredAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevoke(cred.credentialId)}
                    title="Eliminar y revocar huella registrada"
                    className="p-2 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scanner Capture Area */}
        {!successCredential ? (
          <div className="space-y-5">
            {/* Finger Selection */}
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-2">
                1. Seleccione el dedo que colocará en el sensor biométrico:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {FINGER_OPTIONS.map((f) => {
                  const isSelected = selectedFinger === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      disabled={isScanning}
                      onClick={() => setSelectedFinger(f.id)}
                      className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-amber-100/70 border-amber-500 ring-2 ring-amber-500/30 font-bold text-amber-950'
                          : 'bg-white border-stone-200 hover:bg-stone-50 text-stone-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Fingerprint size={16} className={isSelected ? 'text-amber-800' : 'text-stone-400'} />
                        <span>{f.label}</span>
                      </div>
                      <span className="text-[10px] text-stone-400 font-normal">{f.iconSide}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sensor Graphic & Progress */}
            <div className="p-6 bg-stone-900 rounded-3xl border border-stone-800 text-center space-y-4 relative overflow-hidden shadow-inner">
              <div className="w-24 h-24 mx-auto rounded-3xl bg-stone-800/80 border-2 border-stone-700 flex items-center justify-center relative overflow-hidden">
                <Fingerprint
                  className={`w-14 h-14 transition-all duration-300 ${
                    isScanning
                      ? 'text-amber-400 scale-110 drop-shadow-[0_0_12px_rgba(251,191,36,0.8)]'
                      : 'text-stone-500'
                  }`}
                />

                {/* Laser scanline animation */}
                {isScanning && (
                  <div
                    className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_8px_#fbbf24] animate-bounce"
                    style={{ top: `${scanProgress}%` }}
                  />
                )}
              </div>

              <div>
                <p className="text-sm font-bold text-stone-100">
                  {isScanning
                    ? `Escaneando y extrayendo minucias... ${scanProgress}%`
                    : 'Coloque su dedo sobre el sensor o lector USB'}
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  {isScanning
                    ? 'Mantenga el dedo firme sobre la superficie del sensor...'
                    : `Dispositivo detectado: ${deviceLabel}`}
                </p>
              </div>

              {isScanning && (
                <div className="w-full bg-stone-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full transition-all duration-300"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              )}
            </div>

            {/* Consent Checkbox */}
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-start gap-2.5 text-xs text-stone-600">
              <input
                type="checkbox"
                id="consentCheck"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer shrink-0"
              />
              <label htmlFor="consentCheck" className="cursor-pointer leading-relaxed text-[11px]">
                <strong>Consentimiento Informado (LFPDPPP / GDPR):</strong> Autorizo el tratamiento de mis datos
                biométricos exclusivamente para el control de acceso y firma electrónica de trámites ganaderos. Entiendo
                que <u>no se almacena la imagen cruda de mi huella</u>, sino un template hash criptográfico seguro en el
                enclave del dispositivo, revocable en cualquier momento.
              </label>
            </div>

            {/* Error Message if any */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl flex items-center gap-2 text-xs text-rose-800 animate-fadeIn">
                <AlertCircle size={16} className="text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Action Button */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-stone-600 hover:text-stone-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleStartEnrollment}
                disabled={isScanning || !consentGiven}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Fingerprint size={16} />
                <span>{isScanning ? 'Procesando Huella...' : 'Iniciar Registro de Huella'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Enrollment Success Feedback */
          <div className="p-6 bg-emerald-50 border-2 border-emerald-400 rounded-3xl text-center space-y-4 animate-fadeIn">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg">
              <CheckCircle2 size={32} />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-800">
                Enrolamiento Biométrico Concluido
              </span>
              <h3 className="text-lg font-bold text-emerald-950 font-cinzel">
                ¡Huella Digital Registrada con Éxito!
              </h3>
              <p className="text-xs text-emerald-800 max-w-sm mx-auto leading-relaxed">
                El template criptográfico correspondiente a <strong>{successCredential.fingerIndex.replace(/_/g, ' ')}</strong> ha
                sido vinculado de forma segura a su perfil de operador.
              </p>
            </div>

            <div className="p-3 bg-white/80 border border-emerald-200 rounded-xl text-left text-xs font-mono space-y-1 text-emerald-900">
              <div><strong>Folio Biométrico:</strong> {successCredential.credentialId}</div>
              <div><strong>Algoritmo Criptográfico:</strong> {successCredential.algorithm} (P-256)</div>
              <div><strong>Dispositivo:</strong> {successCredential.deviceLabel}</div>
              <div><strong>Fecha de Enrolamiento:</strong> {new Date(successCredential.registeredAt).toLocaleString()}</div>
            </div>

            <div className="pt-2 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setSuccessCredential(null)}
                className="px-4 py-2 bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Registrar Otro Dedo
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
              >
                Entendido y Finalizar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
