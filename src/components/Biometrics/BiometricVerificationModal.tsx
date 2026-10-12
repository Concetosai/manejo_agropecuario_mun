import React, { useState, useEffect } from 'react';
import {
  Fingerprint,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  KeyRound,
  Clock,
  ArrowRight,
  RefreshCw,
  User,
  ShieldAlert,
} from 'lucide-react';
import {
  MunicipalUser,
  BiometricVerificationResult,
} from '../../types';
import {
  verifyBiometricFingerprint,
  verifyPinFallback,
  getStoredBiometricCredentials,
  getLockoutState,
  triggerHaptic,
} from '../../services/biometricsService';

interface BiometricVerificationModalProps {
  currentUser: MunicipalUser;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: BiometricVerificationResult) => void;
  actionTitle?: string;
  actionDescription?: string;
}

export const BiometricVerificationModal: React.FC<BiometricVerificationModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onSuccess,
  actionTitle = 'Autenticación Biométrica de Operador',
  actionDescription = 'Coloque su dedo sobre el sensor para validar su identidad y autorizar la operación.',
}) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [verificationResult, setVerificationResult] = useState<BiometricVerificationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [simulateMismatch, setSimulateMismatch] = useState(false);

  // Fallback PIN state
  const [showPinFallback, setShowPinFallback] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Lockout countdown
  const [lockoutRemainingSec, setLockoutRemainingSec] = useState<number>(0);

  const registeredCredentials = getStoredBiometricCredentials(currentUser.id);
  const hasCredentials = registeredCredentials.length > 0;

  useEffect(() => {
    if (isOpen) {
      setVerificationResult(null);
      setErrorMessage(null);
      setPinError(null);
      setPinInput('');
      setIsVerifying(false);
      setScanProgress(0);

      const lockout = getLockoutState(currentUser.id);
      if (lockout.lockedUntil && Date.now() < lockout.lockedUntil) {
        setShowPinFallback(true);
        const rem = Math.ceil((lockout.lockedUntil - Date.now()) / 1000);
        setLockoutRemainingSec(rem);
      } else {
        setShowPinFallback(!hasCredentials);
        setLockoutRemainingSec(0);
      }
    }
  }, [isOpen, currentUser.id, hasCredentials]);

  // Lockout timer
  useEffect(() => {
    if (lockoutRemainingSec <= 0) return;
    const interval = setInterval(() => {
      setLockoutRemainingSec((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setShowPinFallback(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutRemainingSec]);

  if (!isOpen) return null;

  const handleScanFingerprint = async () => {
    if (lockoutRemainingSec > 0) return;

    setIsVerifying(true);
    setErrorMessage(null);
    setScanProgress(20);

    const progressTimer = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 80) {
          clearInterval(progressTimer);
          return 80;
        }
        return prev + 20;
      });
    }, 200);

    try {
      const res = await verifyBiometricFingerprint({
        user: currentUser,
        purpose: actionTitle,
        simulateMismatch,
      });

      clearInterval(progressTimer);
      setScanProgress(100);
      setVerificationResult(res);

      if (res.success) {
        triggerHaptic('success');
        setTimeout(() => {
          onSuccess(res);
          onClose();
        }, 900);
      } else {
        setErrorMessage(res.message);
        if (res.isLocked || res.requiresPinFallback) {
          setShowPinFallback(true);
          const lockout = getLockoutState(currentUser.id);
          if (lockout.lockedUntil) {
            setLockoutRemainingSec(Math.ceil((lockout.lockedUntil - Date.now()) / 1000));
          }
        }
      }
    } catch (err: any) {
      clearInterval(progressTimer);
      setErrorMessage(err?.message || 'Error al cotejar la huella digital.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      setPinError('Ingrese el PIN de seguridad municipal.');
      return;
    }

    const ok = verifyPinFallback(currentUser, pinInput.trim());
    if (ok) {
      triggerHaptic('success');
      const fallbackResult: BiometricVerificationResult = {
        success: true,
        message: 'Acceso autorizado mediante PIN municipal de respaldo.',
        userId: currentUser.id,
        userName: currentUser.fullName,
        sessionToken: `PIN-TOKEN-${currentUser.badgeNumber}-${Date.now()}`,
      };
      onSuccess(fallbackResult);
      onClose();
    } else {
      setPinError('PIN de seguridad municipal incorrecto.');
      triggerHaptic('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border-2 border-stone-800 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-amber-600 to-stone-900 text-amber-400 rounded-2xl shadow-md">
              <Fingerprint className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-900 block">
                Verificación de Identidad
              </span>
              <h2 className="text-lg font-black font-cinzel text-stone-900">
                {actionTitle}
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

        {/* User Card */}
        <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <User className="w-4 h-4 text-amber-700" />
            <div>
              <p className="font-bold text-stone-900">{currentUser.fullName}</p>
              <p className="text-[10px] text-stone-500">{currentUser.role} · {currentUser.badgeNumber}</p>
            </div>
          </div>
          <span className="text-[10px] bg-stone-200 text-stone-800 font-bold px-2 py-0.5 rounded-md">
            Operador Activo
          </span>
        </div>

        {/* Action description */}
        <p className="text-xs text-stone-600 text-center leading-relaxed">
          {actionDescription}
        </p>

        {/* Main Biometric / Lockout View */}
        {lockoutRemainingSec > 0 ? (
          /* Lockout Screen */
          <div className="p-5 bg-rose-50 border-2 border-rose-300 rounded-3xl text-center space-y-3 animate-fadeIn">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-600 text-white flex items-center justify-center shadow-md">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-950 font-cinzel">Sensor Bloqueado por Seguridad</h4>
              <p className="text-xs text-rose-800 mt-1">
                Se excedió el límite de 3 intentos fallidos consecutivos.
              </p>
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-rose-200 rounded-full font-mono text-xs font-bold text-rose-900">
                <Clock size={13} />
                <span>Desbloqueo en {Math.floor(lockoutRemainingSec / 60)}:{(lockoutRemainingSec % 60).toString().padStart(2, '0')} min</span>
              </div>
            </div>
            <p className="text-[11px] text-rose-700">
              Por favor utilice su <strong>PIN de Respaldo</strong> a continuación para autenticarse.
            </p>
          </div>
        ) : !showPinFallback && hasCredentials ? (
          /* Biometric Touch Scanner */
          <div className="space-y-5">
            <div
              onClick={!isVerifying ? handleScanFingerprint : undefined}
              className={`p-7 bg-stone-900 rounded-3xl border text-center space-y-4 relative overflow-hidden shadow-inner cursor-pointer transition-all hover:border-amber-500/50 ${
                isVerifying ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-stone-800'
              }`}
            >
              <div className="w-24 h-24 mx-auto rounded-3xl bg-stone-800/80 border-2 border-stone-700 flex items-center justify-center relative overflow-hidden group">
                <Fingerprint
                  className={`w-14 h-14 transition-all duration-300 ${
                    verificationResult?.success
                      ? 'text-emerald-400 scale-110 drop-shadow-[0_0_12px_#34d399]'
                      : isVerifying
                      ? 'text-amber-400 scale-105 drop-shadow-[0_0_10px_#fbbf24]'
                      : 'text-stone-400 group-hover:text-amber-400'
                  }`}
                />

                {/* Laser scan line */}
                {isVerifying && (
                  <div
                    className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_8px_#fbbf24] animate-bounce"
                    style={{ top: `${scanProgress}%` }}
                  />
                )}
              </div>

              <div>
                <p className="text-sm font-bold text-stone-100">
                  {verificationResult?.success
                    ? '¡Huella Verificada con Éxito!'
                    : isVerifying
                    ? 'Cotejando patrón de minutiae...'
                    : 'Toque para Escanear Huella'}
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  Sensor compatible: Touch ID, Windows Hello o Lector USB
                </p>
              </div>

              {isVerifying && (
                <div className="w-full bg-stone-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-amber-400 h-full transition-all duration-200"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              )}
            </div>

            {/* Error banner */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl flex items-center gap-2 text-xs text-rose-800 animate-fadeIn">
                <AlertCircle size={16} className="text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Test Mode Simulator Toggle */}
            <div className="flex items-center justify-between p-2.5 bg-stone-100 rounded-xl border border-stone-200 text-[11px] text-stone-600">
              <label htmlFor="simMismatch" className="cursor-pointer flex items-center gap-1.5 font-medium">
                <input
                  type="checkbox"
                  id="simMismatch"
                  checked={simulateMismatch}
                  onChange={(e) => setSimulateMismatch(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span>Simular huella no reconocida (prueba de 3 intentos / bloqueo)</span>
              </label>
              {simulateMismatch && (
                <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">
                  Modo Fallo Activo
                </span>
              )}
            </div>

            {/* Switch to PIN Fallback */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowPinFallback(true)}
                className="text-xs font-semibold text-amber-800 hover:text-amber-950 underline cursor-pointer inline-flex items-center gap-1"
              >
                <KeyRound size={13} />
                <span>¿Problemas con el sensor? Usar PIN de Respaldo</span>
              </button>
            </div>
          </div>
        ) : null}

        {/* PIN Fallback Form */}
        {(showPinFallback || !hasCredentials) && (
          <form onSubmit={handleVerifyPin} className="space-y-4 animate-fadeIn">
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-amber-900">
                <KeyRound size={16} className="text-amber-700" />
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Contingencia / PIN de Seguridad Municipal
                </h4>
              </div>
              <p className="text-[11px] text-stone-600">
                {!hasCredentials
                  ? 'No hay huellas registradas en su perfil. Ingrese su PIN de contingencia o contraseña institucional.'
                  : 'Ingrese su PIN institucional de 6 dígitos o contraseña del Ayuntamiento.'}
              </p>

              <div>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="PIN o contraseña..."
                  autoFocus
                  className="w-full text-center text-lg tracking-widest font-mono font-bold py-2.5 bg-white border border-stone-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {pinError && (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-1.5">
                  <AlertCircle size={14} className="text-rose-600 shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-amber-300 font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Validar PIN y Continuar</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {hasCredentials && lockoutRemainingSec === 0 && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowPinFallback(false)}
                  className="text-xs font-semibold text-stone-500 hover:text-stone-800 cursor-pointer inline-flex items-center gap-1"
                >
                  <Fingerprint size={13} />
                  <span>Volver a intentar con Huella Digital</span>
                </button>
              </div>
            )}
          </form>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
          <span className="flex items-center gap-1">
            <ShieldCheck size={13} className="text-emerald-600" />
            <span>FIDO2 / WebAuthn Seguro</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
