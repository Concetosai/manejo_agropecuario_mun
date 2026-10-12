import React, { useState } from 'react';
import { MunicipalUser, MunicipalRole } from '../types';
import { getMunicipalUsers, setCurrentUser, registerMunicipalUser, recordAuditLog } from '../utils/auditAuth';
import {
  ShieldCheck,
  Lock,
  User,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Building,
  ArrowRight,
  RefreshCw,
  Fingerprint,
  Sparkles,
} from 'lucide-react';
import { BiometricVerificationModal } from './Biometrics/BiometricVerificationModal';
import { BiometricEnrollmentModal } from './Biometrics/BiometricEnrollmentModal';
import { getStoredBiometricCredentials } from '../services/biometricsService';

interface AuthModalProps {
  currentUser: MunicipalUser;
  isOpen: boolean;
  onClose: () => void;
  onUserChanged: (user: MunicipalUser) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onUserChanged,
}) => {
  const [tab, setTab] = useState<'login' | 'register' | 'recovery'>('login');
  const [availableUsers, setAvailableUsers] = useState<MunicipalUser[]>(getMunicipalUsers());

  // Login form state
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser.id);
  const [password, setPassword] = useState('Panuco2026!');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register form state
  const [regFullName, setRegFullName] = useState('');
  const [regCurp, setRegCurp] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<MunicipalRole>('Oficial de Registro');
  const [regDepartment, setRegDepartment] = useState('Dirección de Fomento Agropecuario');
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  // Recovery form state
  const [recoveryQuery, setRecoveryQuery] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);

  // Biometric state
  const [isBiometricVerifyOpen, setIsBiometricVerifyOpen] = useState(false);
  const [isBiometricEnrollOpen, setIsBiometricEnrollOpen] = useState(false);

  const selectedUser = availableUsers.find((u) => u.id === selectedUserId) || currentUser;
  const userHasBiometrics = getStoredBiometricCredentials(selectedUser.id).length > 0;

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = availableUsers.find((u) => u.id === selectedUserId);
    if (!user) {
      setLoginError('Seleccione un servidor público municipal.');
      return;
    }
    if (!password) {
      setLoginError('Ingrese la contraseña de seguridad municipal.');
      return;
    }

    setCurrentUser(user);
    onUserChanged(user);
    onClose();
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFullName.trim() || regCurp.trim().length !== 18) {
      alert('Por favor ingrese el nombre completo y una CURP válida de 18 caracteres.');
      return;
    }

    const created = registerMunicipalUser({
      username: regEmail.split('@')[0] || 'operador',
      fullName: regFullName.trim(),
      curp: regCurp.trim().toUpperCase(),
      email: regEmail.trim() || `${regEmail.split('@')[0]}@panuco.gob.mx`,
      role: regRole,
      department: regDepartment,
    });

    setAvailableUsers(getMunicipalUsers());
    setSelectedUserId(created.id);
    setRegSuccess(`Servidor público registrado con éxito (Gafete: ${created.badgeNumber}).`);
    setTimeout(() => {
      setRegSuccess(null);
      setTab('login');
    }, 2000);
  };

  const handleRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryQuery.trim()) {
      alert('Ingrese su CURP o correo electrónico institucional.');
      return;
    }

    const code = `PAN-TOKEN-${Math.floor(100000 + Math.random() * 900000)}`;
    recordAuditLog({
      actionType: 'RECUPERACION_ACCESO',
      details: `Solicitud de restablecimiento de contraseña para ${recoveryQuery.trim()}. Token generado: ${code}`,
      userName: recoveryQuery.trim(),
      userRole: 'Servidor Público',
      badgeNumber: 'SISTEMA',
    });

    setRecoveryMessage(
      `Se ha verificado la identidad en el Padrón Municipal de Servidores Públicos. Código de acceso temporal de Contraloría: ${code}. Su contraseña ha sido restablecida a "Panuco2026!".`
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-stone-300 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-stone-900 text-white p-3 sm:p-5 border-b border-amber-600/40 relative shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="p-1.5 sm:p-2 bg-amber-500/20 border border-amber-400/40 rounded-lg text-amber-400 shrink-0">
                <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <h3 className="font-cinzel font-bold text-sm sm:text-base text-amber-200 truncate">
                  Control de Acceso y Autenticación Oficial
                </h3>
                <p className="text-[10px] sm:text-xs text-stone-300 truncate">
                  H. Ayuntamiento Constitucional de Pánuco, Veracruz
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-stone-400 hover:text-white text-xl font-bold cursor-pointer p-1"
            >
              ×
            </button>
          </div>

          {/* Sub Navigation */}
          <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-stone-800 text-xs overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setTab('login')}
              className={`px-2.5 sm:px-3 py-1.5 rounded font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'login' ? 'bg-amber-500 text-stone-950 shadow-xs' : 'text-stone-300 hover:text-white'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => setTab('register')}
              className={`px-2.5 sm:px-3 py-1.5 rounded font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'register' ? 'bg-amber-500 text-stone-950 shadow-xs' : 'text-stone-300 hover:text-white'
              }`}
            >
              Registrar Operador
            </button>
            <button
              type="button"
              onClick={() => setTab('recovery')}
              className={`px-2.5 sm:px-3 py-1.5 rounded font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'recovery' ? 'bg-amber-500 text-stone-950 shadow-xs' : 'text-stone-300 hover:text-white'
              }`}
            >
              Recuperar Clave
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Seleccionar Servidor Público Autorizado
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-stone-50"
                >
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} — {u.role} ({u.badgeNumber})
                    </option>
                  ))}
                </select>
                <span className="text-xs text-stone-500 mt-1 block">
                  Operador actual: <strong className="text-stone-800">{currentUser.fullName}</strong> ({currentUser.role})
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Contraseña Institucional
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Contraseña de acceso"
                    className="w-full pl-9 pr-4 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-stone-50"
                  />
                </div>
                <span className="text-[11px] text-stone-500 mt-1 block">
                  Clave de demostración precargada: <code>Panuco2026!</code>
                </span>
              </div>

              {loginError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              {/* Biometric Quick Login Action */}
              <div className="pt-2 border-t border-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                    <Fingerprint className="w-4 h-4 text-amber-600" />
                    <span>Autenticación Biométrica Rápida</span>
                  </span>
                  {userHasBiometrics ? (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                      Huella Activa
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsBiometricEnrollOpen(true)}
                      className="text-[11px] font-semibold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                    >
                      + Registrar Huella
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (userHasBiometrics) {
                      setIsBiometricVerifyOpen(true);
                    } else {
                      setIsBiometricEnrollOpen(true);
                    }
                  }}
                  className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-amber-400 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer border border-amber-500/30 active:scale-95"
                >
                  <Fingerprint className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span>
                    {userHasBiometrics
                      ? `Ingresar con Huella Digital (${selectedUser.fullName.split(' ')[0]})`
                      : 'Enrolar y Registrar Huella Digital'}
                  </span>
                </button>
              </div>

              <div className="pt-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setTab('recovery')}
                  className="text-xs text-stone-500 hover:text-stone-800 underline cursor-pointer"
                >
                  ¿Olvidó su contraseña?
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-stone-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Validar con Contraseña</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              {regSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{regSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Nombre Completo del Servidor Público *
                </label>
                <input
                  type="text"
                  required
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder="Ej. Lic. Rodolfo Zúñiga Del Ángel"
                  className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-stone-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    CURP (18 car.) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={18}
                    value={regCurp}
                    onChange={(e) => setRegCurp(e.target.value.toUpperCase())}
                    placeholder="ZUAR800101HVR..."
                    className="w-full px-3.5 py-2 text-xs font-mono-data uppercase border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-stone-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                    Rol Municipal *
                  </label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as MunicipalRole)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-stone-50"
                  >
                    <option value="Oficial de Registro">Oficial de Registro</option>
                    <option value="Administrador">Administrador Municipal</option>
                    <option value="Auditor">Auditor de Contraloría</option>
                    <option value="Inspector">Inspector de Campo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Correo Electrónico Institucional *
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="r.zuniga@panuco.gob.mx"
                  className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-stone-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Dirección o Dependencia
                </label>
                <input
                  type="text"
                  value={regDepartment}
                  onChange={(e) => setRegDepartment(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-stone-50"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-lg shadow transition-colors cursor-pointer"
                >
                  Registrar en el Padrón Municipal
                </button>
              </div>
            </form>
          )}

          {tab === 'recovery' && (
            <form onSubmit={handleRecovery} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
                  Ingrese su CURP o Correo Institucional
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={recoveryQuery}
                    onChange={(e) => setRecoveryQuery(e.target.value)}
                    placeholder="Ej. f.aradillas@panuco.gob.mx o ARCF7803..."
                    className="w-full pl-9 pr-4 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-stone-50"
                  />
                </div>
                <span className="text-xs text-stone-500 mt-1 block">
                  El sistema cruzará la información con el Órgano de Control Interno de Pánuco.
                </span>
              </div>

              {recoveryMessage && (
                <div className="p-3 bg-amber-50 border border-amber-300 text-amber-950 text-xs rounded-lg leading-relaxed space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Recuperación Validada</span>
                  </div>
                  <p>{recoveryMessage}</p>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setTab('login')}
                  className="text-xs text-stone-600 hover:text-stone-900 cursor-pointer"
                >
                  Volver al inicio de sesión
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-stone-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow transition-colors cursor-pointer"
                >
                  Solicitar Código de Desbloqueo
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Modal de Verificación Biométrica para Login */}
      <BiometricVerificationModal
        currentUser={selectedUser}
        isOpen={isBiometricVerifyOpen}
        onClose={() => setIsBiometricVerifyOpen(false)}
        actionTitle="Autenticación Biométrica de Operador"
        actionDescription={`Coloque su dedo sobre el sensor para iniciar sesión como ${selectedUser.fullName}.`}
        onSuccess={() => {
          setCurrentUser(selectedUser);
          onUserChanged(selectedUser);
          setIsBiometricVerifyOpen(false);
          onClose();
        }}
      />

      {/* Modal de Enrolamiento de Huella */}
      <BiometricEnrollmentModal
        currentUser={selectedUser}
        isOpen={isBiometricEnrollOpen}
        onClose={() => setIsBiometricEnrollOpen(false)}
        onEnrollmentComplete={() => {
          setIsBiometricEnrollOpen(false);
        }}
      />
    </div>
  );
};
