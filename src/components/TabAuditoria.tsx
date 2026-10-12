import React, { useState, useMemo } from 'react';
import { AuditLogEntry, AuditActionType, MunicipalUser } from '../types';
import { getAuditLogs, recordAuditLog } from '../utils/auditAuth';
import {
  ShieldAlert,
  Search,
  Filter,
  Download,
  RotateCcw,
  CheckCircle2,
  Clock,
  User,
  FileText,
  Printer,
  FileCheck,
  AlertTriangle,
  History,
} from 'lucide-react';

interface TabAuditoriaProps {
  currentUser: MunicipalUser;
}

export const TabAuditoria: React.FC<TabAuditoriaProps> = ({ currentUser }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>(() => getAuditLogs());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [selectedUser, setSelectedUser] = useState<string>('ALL');
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Quick stats
  const stats = useMemo(() => {
    return {
      total: logs.length,
      certificados: logs.filter(
        (l) => l.actionType === 'IMPRESION_DOCUMENTO' || l.actionType === 'CARGA_CERTIFICADO'
      ).length,
      modificaciones: logs.filter(
        (l) => l.actionType === 'REGISTRO_CREADO' || l.actionType === 'REGISTRO_MODIFICADO'
      ).length,
      sesiones: logs.filter((l) => l.actionType === 'INICIO_SESION').length,
    };
  }, [logs]);

  // Unique users found in logs
  const uniqueUsers = useMemo(() => {
    return Array.from(new Set(logs.map((l) => l.userName))).filter(Boolean);
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedAction !== 'ALL' && log.actionType !== selectedAction) {
        return false;
      }
      if (selectedUser !== 'ALL' && log.userName !== selectedUser) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matches =
          log.details.toLowerCase().includes(q) ||
          log.userName.toLowerCase().includes(q) ||
          (log.folioAffected && log.folioAffected.toLowerCase().includes(q)) ||
          (log.producerAffected && log.producerAffected.toLowerCase().includes(q)) ||
          log.formattedTime.toLowerCase().includes(q) ||
          log.ipAddress.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [logs, selectedAction, selectedUser, searchTerm]);

  const handleExportCsv = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        'ID_Auditoria,Fecha_Hora,Servidor_Publico,Rol,Gafete,Tipo_Accion,Folio_Afectado,Titular_Afectado,Detalles,Terminal_IP',
        ...filteredLogs.map(
          (l) =>
            `"${l.id}","${l.formattedTime}","${l.userName}","${l.userRole}","${l.badgeNumber}","${l.actionType}","${l.folioAffected || 'N/A'}","${l.producerAffected || 'N/A'}","${l.details.replace(/"/g, '""')}","${l.ipAddress}"`
        ),
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Bitacora_Auditoria_Panuco_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportNotice('Bitácora de auditoría exportada exitosamente en formato CSV oficial.');
    setTimeout(() => setExportNotice(null), 3500);
  };

  const handleSimulateLog = () => {
    recordAuditLog({
      actionType: 'CONSULTA_PADRON',
      details: `Revisión de rutina de expedientes ganaderos por parte de ${currentUser.fullName}.`,
    });
    setLogs(getAuditLogs());
  };

  const getActionBadge = (action: AuditActionType) => {
    switch (action) {
      case 'REGISTRO_CREADO':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Alta de Registro</span>;
      case 'REGISTRO_MODIFICADO':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Modificación</span>;
      case 'REGISTRO_ELIMINADO':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">Baja / Cancelación</span>;
      case 'CARGA_CERTIFICADO':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">Carga Certificado</span>;
      case 'IMPRESION_DOCUMENTO':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">Impresión Oficial</span>;
      case 'INICIO_SESION':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-200 text-stone-800">Inicio Sesión</span>;
      case 'RECUPERACION_ACCESO':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800">Recuperación Clave</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-700">{action}</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8 w-full max-w-full overflow-x-hidden">
      {/* Title */}
      <div className="border-b border-stone-300 pb-4 sm:pb-6 mb-6 sm:mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
        <div>
          <span className="text-[10px] sm:text-xs uppercase tracking-widest font-semibold text-amber-800 block">
            Órgano de Control Interno y Contraloría · Pánuco, Ver.
          </span>
          <h1 className="text-xl sm:text-3xl font-cinzel font-bold text-stone-900 mt-1 break-words">
            Bitácora Oficial de Auditoría y Trazabilidad Municipal
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 mt-1">
            Registro cronológico inmutable de todas las altas, modificaciones, consultas e impresiones de fierros quemadores.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleExportCsv}
            className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-lg shadow transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Exportar Bitácora Oficial (CSV)</span>
          </button>
        </div>
      </div>

      {exportNotice && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg flex items-center justify-between text-sm shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{exportNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* 4 Diagnostic Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total de Eventos</span>
            <History className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold font-mono-data text-stone-900">{stats.total}</p>
          <span className="text-[11px] text-stone-400">Registros de actividad auditados</span>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Expedientes Gestionados</span>
            <FileText className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold font-mono-data text-emerald-800">{stats.modificaciones}</p>
          <span className="text-[11px] text-stone-400">Altas y modificaciones oficiales</span>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Títulos Emitidos</span>
            <Printer className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-bold font-mono-data text-purple-800">{stats.certificados}</p>
          <span className="text-[11px] text-stone-400">Certificados cargados/impresos</span>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Sesiones de Servidores</span>
            <User className="w-4 h-4 text-stone-600" />
          </div>
          <p className="text-2xl font-bold font-mono-data text-stone-800">{stats.sesiones}</p>
          <span className="text-[11px] text-stone-400">Accesos con gafete municipal</span>
        </div>
      </div>

      {/* Audit Search and Filter Bar */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
            placeholder="Buscar por detalle de acción, servidor público, folio (ej. PAN-2026), titular o IP..."
            className="w-full pl-9 pr-4 py-1.5 text-xs sm:text-sm border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-stone-50/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Action type filter */}
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="px-3 py-1.5 text-xs border border-stone-300 rounded-md bg-stone-50/50 text-stone-700"
          >
            <option value="ALL">Todas las Acciones</option>
            <option value="REGISTRO_CREADO">Altas de Registro</option>
            <option value="REGISTRO_MODIFICADO">Modificaciones</option>
            <option value="CARGA_CERTIFICADO">Cargas a Certificado</option>
            <option value="IMPRESION_DOCUMENTO">Impresiones Oficiales</option>
            <option value="INICIO_SESION">Inicios de Sesión</option>
            <option value="RECUPERACION_ACCESO">Recuperación Clave</option>
          </select>

          {/* User filter */}
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="px-3 py-1.5 text-xs border border-stone-300 rounded-md bg-stone-50/50 text-stone-700"
          >
            <option value="ALL">Todos los Servidores Públicos</option>
            {uniqueUsers.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-100 text-stone-700 font-semibold uppercase tracking-wider border-b border-stone-200">
              <tr>
                <th className="py-2.5 px-3">Fecha y Hora</th>
                <th className="py-2.5 px-3">Servidor Público</th>
                <th className="py-2.5 px-3">Tipo de Acción</th>
                <th className="py-2.5 px-3">Folio / Titular</th>
                <th className="py-2.5 px-3">Descripción Detallada del Evento</th>
                <th className="py-2.5 px-3">Terminal / IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-stone-500">
                    No se encontraron eventos de auditoría con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono-data text-stone-700">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-stone-400" />
                        <span>{log.formattedTime}</span>
                      </div>
                    </td>

                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-stone-900 block">{log.userName}</span>
                      <span className="text-[10px] text-stone-500">
                        {log.userRole} · <span className="font-mono-data">{log.badgeNumber}</span>
                      </span>
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {getActionBadge(log.actionType)}
                    </td>

                    <td className="py-2.5 px-3">
                      {log.folioAffected ? (
                        <>
                          <span className="font-mono-data font-semibold text-stone-900 block">
                            {log.folioAffected}
                          </span>
                          {log.producerAffected && (
                            <span className="text-[10px] text-stone-600 block">{log.producerAffected}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-stone-400 italic">No aplica</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-stone-800 leading-relaxed max-w-md">
                      {log.details}
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap text-stone-500 font-mono-data text-[11px]">
                      {log.ipAddress}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-stone-50 px-4 py-3 border-t border-stone-200 flex items-center justify-between text-xs text-stone-600">
          <span>Mostrando {filteredLogs.length} eventos auditados</span>
          <span className="font-mono-data text-[11px] text-stone-400">
            Cadena de custodia criptográfica activa · Pánuco, Ver.
          </span>
        </div>
      </div>
    </div>
  );
};
