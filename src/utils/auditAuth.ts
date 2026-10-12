import { MunicipalUser, AuditLogEntry, AuditActionType, MunicipalRole } from '../types';

const USERS_STORAGE_KEY = 'panuco_municipal_users_v1';
const CURRENT_USER_KEY = 'panuco_current_user_v1';
const AUDIT_LOG_STORAGE_KEY = 'panuco_audit_trail_v1';

const memoryStore = new Map<string, string>();
const safeStorage = {
  getItem: (key: string): string | null => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return memoryStore.get(key) || null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    } else {
      memoryStore.set(key, value);
    }
  },
  removeItem: (key: string): void => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    } else {
      memoryStore.delete(key);
    }
  },
};

// Default municipal government operators
const DEFAULT_USERS: MunicipalUser[] = [
  {
    id: 'user-001',
    username: 'faradillas',
    fullName: 'C.P. Fernando Aradillas Castillo',
    curp: 'ARCF780312HVRRLS01',
    email: 'f.aradillas@panuco.gob.mx',
    role: 'Oficial de Registro',
    department: 'Dirección de Fomento Agropecuario',
    badgeNumber: 'OPR-PAN-2025-01',
  },
  {
    id: 'user-002',
    username: 'oguzman',
    fullName: 'Mtro. Óscar Guzmán de Paz',
    curp: 'GUDO681024HVRRRN02',
    email: 'presidente@panuco.gob.mx',
    role: 'Administrador',
    department: 'Presidencia Municipal',
    badgeNumber: 'ADM-PAN-2025-00',
  },
  {
    id: 'user-003',
    username: 'contraloria',
    fullName: 'Lic. Beatriz Maya Zúñiga',
    curp: 'MAZB820719MVRLLS04',
    email: 'contraloria@panuco.gob.mx',
    role: 'Auditor',
    department: 'Órgano de Control Interno Municipal',
    badgeNumber: 'AUD-PAN-2025-03',
  },
  {
    id: 'user-004',
    username: 'inspector',
    fullName: 'Ing. Donato Pecero Saldaña',
    curp: 'PESD850510HVRRNN05',
    email: 'inspeccion.ganadera@panuco.gob.mx',
    role: 'Inspector',
    department: 'Casetas e Inspección de Hato Pánuco',
    badgeNumber: 'INS-PAN-2025-09',
  },
];

// Seed initial audit log entries
const DEFAULT_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'aud-001',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    formattedTime: formatTimestamp(new Date(Date.now() - 3600000 * 5)),
    userName: 'C.P. Fernando Aradillas Castillo',
    userRole: 'Oficial de Registro',
    badgeNumber: 'OPR-PAN-2025-01',
    actionType: 'INICIO_SESION',
    details: 'Autenticación exitosa en terminal de Fomento Agropecuario.',
    ipAddress: '192.168.10.14 (Palacio Municipal)',
  },
  {
    id: 'aud-002',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    formattedTime: formatTimestamp(new Date(Date.now() - 3600000 * 4)),
    userName: 'C.P. Fernando Aradillas Castillo',
    userRole: 'Oficial de Registro',
    badgeNumber: 'OPR-PAN-2025-01',
    actionType: 'CONSULTA_PADRON',
    details: 'Búsqueda multi-criterio en padrón histórico de fierros (Filtro: Reventadero).',
    ipAddress: '192.168.10.14 (Palacio Municipal)',
  },
  {
    id: 'aud-003',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    formattedTime: formatTimestamp(new Date(Date.now() - 3600000 * 2)),
    userName: 'C.P. Fernando Aradillas Castillo',
    userRole: 'Oficial de Registro',
    badgeNumber: 'OPR-PAN-2025-01',
    actionType: 'REGISTRO_MODIFICADO',
    folioAffected: 'PAN-2026-04289',
    producerAffected: 'Don Aurelio Guzmán Aradillas',
    details: 'Actualización de hato ganadero a 240 cabezas y refrendo de vigencia 2026-2029.',
    ipAddress: '192.168.10.14 (Palacio Municipal)',
  },
  {
    id: 'aud-004',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    formattedTime: formatTimestamp(new Date(Date.now() - 1800000)),
    userName: 'C.P. Fernando Aradillas Castillo',
    userRole: 'Oficial de Registro',
    badgeNumber: 'OPR-PAN-2025-01',
    actionType: 'IMPRESION_DOCUMENTO',
    folioAffected: 'PAN-2026-04289',
    producerAffected: 'Don Aurelio Guzmán Aradillas',
    details: 'Generación e impresión de Título Oficial y Credencial Ganadera de bolsillo.',
    ipAddress: '192.168.10.14 (Palacio Municipal)',
  },
];

export function getMunicipalUsers(): MunicipalUser[] {
  const stored = safeStorage.getItem(USERS_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // fallback
    }
  }
  safeStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
  return DEFAULT_USERS;
}

export function getCurrentUser(): MunicipalUser {
  const stored = safeStorage.getItem(CURRENT_USER_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // fallback
    }
  }
  const defaultUser = DEFAULT_USERS[0];
  safeStorage.setItem(CURRENT_USER_KEY, JSON.stringify(defaultUser));
  return defaultUser;
}

export function setCurrentUser(user: MunicipalUser): void {
  safeStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  recordAuditLog({
    actionType: 'INICIO_SESION',
    details: `Inicio de sesión oficial del servidor público ${user.fullName} (${user.role}).`,
    userName: user.fullName,
    userRole: user.role,
    badgeNumber: user.badgeNumber,
  });
}

export function registerMunicipalUser(newUser: Omit<MunicipalUser, 'id' | 'badgeNumber'>): MunicipalUser {
  const users = getMunicipalUsers();
  const id = `user-${String(users.length + 1).padStart(3, '0')}`;
  const badgeNumber = `OPR-PAN-2025-${String(users.length + 1).padStart(2, '0')}`;
  
  const created: MunicipalUser = {
    ...newUser,
    id,
    badgeNumber,
  };

  users.push(created);
  safeStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));

  recordAuditLog({
    actionType: 'REGISTRO_CREADO',
    details: `Alta de nuevo usuario del sistema municipal: ${created.fullName} (${created.role}).`,
    userName: created.fullName,
    userRole: created.role,
    badgeNumber: created.badgeNumber,
  });

  return created;
}

export function getAuditLogs(): AuditLogEntry[] {
  const stored = safeStorage.getItem(AUDIT_LOG_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // fallback
    }
  }
  safeStorage.setItem(AUDIT_LOG_STORAGE_KEY, JSON.stringify(DEFAULT_AUDIT_LOGS));
  return DEFAULT_AUDIT_LOGS;
}

export function recordAuditLog(entry: {
  actionType: AuditActionType;
  details: string;
  folioAffected?: string;
  producerAffected?: string;
  userName?: string;
  userRole?: string;
  badgeNumber?: string;
}): void {
  const currentUser = getCurrentUser();
  const logs = getAuditLogs();
  const now = new Date();

  const newEntry: AuditLogEntry = {
    id: `aud-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: now.toISOString(),
    formattedTime: formatTimestamp(now),
    userName: entry.userName || currentUser.fullName,
    userRole: entry.userRole || currentUser.role,
    badgeNumber: entry.badgeNumber || currentUser.badgeNumber,
    actionType: entry.actionType,
    folioAffected: entry.folioAffected,
    producerAffected: entry.producerAffected,
    details: entry.details,
    ipAddress: '192.168.10.14 (Red Interna Municipal)',
  };

  logs.unshift(newEntry);
  // Keep last 1,000 logs
  if (logs.length > 1000) logs.pop();

  try {
    safeStorage.setItem(AUDIT_LOG_STORAGE_KEY, JSON.stringify(logs));
  } catch {
    // quota safe
  }
}

function formatTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const min = pad(d.getMinutes());
  const sec = pad(d.getSeconds());
  return `${day}/${month}/${year} ${hours}:${min}:${sec}`;
}
