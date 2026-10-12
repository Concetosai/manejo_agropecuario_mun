import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  X,
  Minimize2,
  Maximize2,
  Send,
  Sparkles,
  Bot,
  User,
  GripHorizontal,
  Database,
  ShieldCheck,
  Scale,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ChevronRight,
  ExternalLink,
  Layers,
  FileCheck2,
} from 'lucide-react';
import { ProducerData, BrandConfig } from '../types';
import { getMunicipalDatabase } from '../utils/database';

interface FloatingAIAssistantProps {
  currentProducer: ProducerData;
  currentBrand: BrandConfig;
  activeTab: string;
  onNavigateTab?: (tab: string) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  source?: string;
  isAnalysis?: boolean;
}

export const FloatingAIAssistant: React.FC<FloatingAIAssistantProps> = ({
  currentProducer,
  currentBrand,
  activeTab,
  onNavigateTab,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  // Position state (manual relocation / dragging)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    // Default position at bottom-right
    if (typeof window !== 'undefined') {
      return {
        x: Math.max(20, window.innerWidth - 100),
        y: Math.max(20, window.innerHeight - 100),
      };
    }
    return { x: 300, y: 500 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number }>({
    mouseX: 0,
    mouseY: 0,
    posX: 0,
    posY: 0,
  });
  const dragDistanceRef = useRef(0);

  // Messages state with helpful initial welcome
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'assistant',
      text: `### 🏛️ Secretaría de Desarrollo Agropecuario y Pesquero
**Dirección General de Ganadería · Municipio de Pánuco, Veracruz**

¡Bienvenido al Sistema Oficial Generador de Documentos Pecuarios de Pánuco!

**¿Qué formato de impresión deseas utilizar?**
1. **Formato Sencillo / Tradicional (Basado en Ficha Única):**
   Muestra únicamente los 15 datos esenciales limpios, texto legal Art. 30-33, firma oficial y sin QR ni folios excedentes.
2. **Formato Completo / Moderno (Acta Certificada):**
   Acta certificada con marco Guilloche, código QR de vinculación a la base de datos, folios específicos y credencial ganadera CR-80.

*Elija una opción para rellenar la plantilla correspondiente con sus datos pecuarios.*`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      source: 'Secretaría de Desarrollo Agropecuario',
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Adjust position if window is resized
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const maxX = window.innerWidth - (isOpen ? (isExpanded ? 550 : 380) : 70);
        const maxY = window.innerHeight - (isOpen ? (isExpanded ? 650 : 480) : 70);
        return {
          x: Math.min(Math.max(10, prev.x), Math.max(10, maxX)),
          y: Math.min(Math.max(10, prev.y), Math.max(10, maxY)),
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, isExpanded]);

  // Dragging event handlers (Mouse and Touch)
  const handleStartDrag = (clientX: number, clientY: number) => {
    setIsDragging(true);
    dragDistanceRef.current = 0;
    dragStartRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const deltaX = clientX - dragStartRef.current.mouseX;
      const deltaY = clientY - dragStartRef.current.mouseY;
      dragDistanceRef.current = Math.hypot(deltaX, deltaY);

      const targetWidth = isOpen ? (isExpanded ? 550 : 380) : 65;
      const targetHeight = isOpen ? (isExpanded ? 650 : 480) : 65;
      const maxX = Math.max(10, window.innerWidth - targetWidth - 10);
      const maxY = Math.max(10, window.innerHeight - targetHeight - 10);

      const newX = Math.min(Math.max(10, dragStartRef.current.posX + deltaX), maxX);
      const newY = Math.min(Math.max(10, dragStartRef.current.posY + deltaY), maxY);

      setPosition({ x: newX, y: newY });
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, isOpen, isExpanded]);

  // Compute database summary to inject into assistant context
  const getDatabaseContext = () => {
    try {
      const records = getMunicipalDatabase();
      const active = records.filter((r) => r.status === 'Vigente').length;
      const historical = records.filter((r) => r.status === 'Histórico').length;
      const disputed = records.filter((r) => r.status === 'En Litigio').length;

      // Group by ejido
      const ejidoCounts: Record<string, number> = {};
      records.forEach((r) => {
        ejidoCounts[r.ejido] = (ejidoCounts[r.ejido] || 0) + 1;
      });

      const topEjidos = Object.entries(ejidoCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, count]) => `${name} (${count})`);

      return {
        totalRecords: records.length,
        activeRecords: active,
        historicalRecords: historical,
        disputedRecords: disputed,
        topEjidos,
      };
    } catch {
      return {
        totalRecords: 4250,
        activeRecords: 3612,
        historicalRecords: 425,
        disputedRecords: 213,
        topEjidos: ['Reventadero', 'Villa Cacalilao', 'Tamos', 'Canoas', 'Moralillo'],
      };
    }
  };

  // Send message to server backend API
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isLoading) return;

    setInputMessage('');
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const dbContext = getDatabaseContext();

      const response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: query,
          activeTab,
          currentProducer,
          currentBrand,
          databaseSummary: dbContext,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error en servidor (${response.status})`);
      }

      const data = await response.json();
      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: data.reply || 'Sin respuesta del servidor.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: data.source === 'gemini-3.8-flash' ? 'Gemini 3.8 Flash · Pánuco' : 'Base de Conocimientos Local',
        isAnalysis: query.toLowerCase().includes('analizar') || query.toLowerCase().includes('duplicidad'),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.warn('Fallback to local assistant processing:', err);
      // Resilience fallback
      const fallbackMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: `### 🏛️ Respuesta del Sistema Municipal de Pánuco
Estimado usuario: Hemos procesado su consulta sobre **"${query}"**.
- **Registro Pecuario:** Conforme al Art. 45 de la Ley Ganadera de Veracruz, todo fierro debe registrarse ante el H. Ayuntamiento y la Asociación Ganadera Local.
- **Predio y UPP:** Su clave UPP (30-123-XXXX-XXX) y acreditación de pequeña propiedad o ejido son obligatorias antes de autorizar la forja del fierro.
- **Antiduplicidad:** No olvide verificar en la pestaña **Creador** que su monograma no tenga coincidencia superior al 65% con los registros vigentes.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: 'Asistente Local de Contingencia',
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleQuickAction = (actionText: string) => {
    handleSendMessage(actionText);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: 'Historial de conversación reiniciado. Estoy listo para asistirlo con la Ley Ganadera de Veracruz o el análisis de la base de datos municipal de Pánuco.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: 'Sistema Pánuco',
      },
    ]);
  };

  // Render text with basic markdown formatting
  const renderFormattedText = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-1.5 text-xs sm:text-sm leading-relaxed">
        {lines.map((line, idx) => {
          if (line.startsWith('### ')) {
            return (
              <h4 key={idx} className="font-bold text-amber-950 font-cinzel text-xs sm:text-sm mt-2 mb-1">
                {line.replace('### ', '')}
              </h4>
            );
          }
          if (line.startsWith('• ') || line.startsWith('- ')) {
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-2 text-stone-800">
                <span className="text-amber-700 font-bold shrink-0">•</span>
                <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line.slice(2)) }} />
              </div>
            );
          }
          if (line.match(/^\d+\.\s/)) {
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-2 text-stone-800">
                <span className="font-semibold text-amber-900 shrink-0">{line.match(/^\d+\./)?.[0]}</span>
                <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line.replace(/^\d+\.\s/, '')) }} />
              </div>
            );
          }
          if (!line.trim()) {
            return <div key={idx} className="h-1" />;
          }
          return (
            <p key={idx} className="text-stone-800" dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line) }} />
          );
        })}
      </div>
    );
  };

  function formatInlineMarkdown(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-stone-950">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic text-stone-700">$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-amber-100/70 text-amber-950 px-1 py-0.5 rounded font-mono text-[11px]">$1</code>');
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9999,
        touchAction: 'none',
      }}
      className="no-print select-none"
    >
      {/* ========================================================
          COLLAPSED STATE: FLOATING DRAGGABLE BUBBLE
         ======================================================== */}
      {!isOpen && (
        <div
          onMouseDown={(e) => handleStartDrag(e.clientX, e.clientY)}
          onTouchStart={(e) => handleStartDrag(e.touches[0].clientX, e.touches[0].clientY)}
          onClick={() => {
            // Only toggle open if it wasn't a significant drag
            if (dragDistanceRef.current < 6) {
              setIsOpen(true);
              setHasUnread(false);
            }
          }}
          className="relative group cursor-grab active:cursor-grabbing flex items-center gap-2"
          title="Asistente Ganadero Municipal AI - Pánuco (Arrastre para mover a cualquier parte)"
        >
          {/* Pulsing halo */}
          <div className="absolute -inset-1 bg-gradient-to-r from-amber-600 via-emerald-600 to-amber-700 rounded-full blur-xs opacity-75 group-hover:opacity-100 animate-pulse" />

          {/* Main Bubble */}
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-stone-900 via-amber-950 to-stone-900 border-2 border-amber-400/90 shadow-2xl flex flex-col items-center justify-center text-white transition-transform group-hover:scale-105">
            <div className="relative">
              <Bot className="w-6 h-6 sm:w-7 sm:h-7 text-amber-300 drop-shadow" />
              <Sparkles className="w-3 h-3 text-amber-200 absolute -top-1 -right-1 animate-spin" style={{ animationDuration: '6s' }} />
            </div>
            <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-amber-200 font-cinzel leading-none mt-0.5">
              AI Pánuco
            </span>

            {/* Drag handle dots indicator */}
            <div className="absolute top-1 text-amber-300/60 flex gap-0.5 pointer-events-none">
              <div className="w-1 h-1 rounded-full bg-amber-400" />
              <div className="w-1 h-1 rounded-full bg-amber-400" />
              <div className="w-1 h-1 rounded-full bg-amber-400" />
            </div>

            {/* Notification Badge */}
            {hasUnread && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-600 border-2 border-white rounded-full animate-bounce" />
            )}
          </div>

          {/* Quick tool-tip text label on hover */}
          <div className="hidden sm:group-hover:flex absolute left-full ml-3 px-3 py-1.5 bg-stone-900/95 text-white text-xs rounded-lg shadow-xl whitespace-nowrap items-center gap-2 border border-amber-500/50 backdrop-blur-sm pointer-events-none">
            <GripHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span>Asistente Pecuario AI · <strong>Arrastre para reubicar</strong></span>
          </div>
        </div>
      )}

      {/* ========================================================
          EXPANDED STATE: AI CHAT & KNOWLEDGE BASE WINDOW
         ======================================================== */}
      {isOpen && (
        <div
          className={`flex flex-col bg-white rounded-2xl shadow-2xl border-2 border-amber-800/80 overflow-hidden backdrop-blur-md transition-all duration-200 ${
            isExpanded
              ? 'w-[92vw] max-w-[560px] h-[82vh] max-h-[660px]'
              : 'w-[90vw] sm:w-[410px] h-[520px] max-h-[85vh]'
          }`}
          style={{ cursor: 'default' }}
        >
          {/* WINDOW HEADER (Acts as Drag Handle!) */}
          <div
            onMouseDown={(e) => handleStartDrag(e.clientX, e.clientY)}
            onTouchStart={(e) => handleStartDrag(e.touches[0].clientX, e.touches[0].clientY)}
            className="bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 text-white p-3 sm:p-3.5 flex items-center justify-between border-b border-amber-600/40 cursor-grab active:cursor-grabbing select-none shrink-0"
            title="Haga clic y arrastre aquí para mover esta ventana"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-400/80 flex items-center justify-center shrink-0 shadow-inner">
                <Bot className="w-4 h-4 text-amber-300" />
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-cinzel font-bold text-xs sm:text-sm text-amber-100 uppercase tracking-wide">
                    Asistente Ganadero Municipal
                  </h3>
                  <span className="text-[9px] bg-emerald-700/80 text-emerald-100 font-mono-data px-1.5 py-0.2 rounded border border-emerald-500/50">
                    En Línea
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-stone-300">
                  <GripHorizontal className="w-3 h-3 text-amber-400/80" />
                  <span>H. Ayuntamiento de Pánuco · 4,250 Registros</span>
                </div>
              </div>
            </div>

            {/* Window action buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleClearHistory}
                className="p-1.5 text-stone-300 hover:text-amber-300 hover:bg-white/10 rounded transition-colors cursor-pointer"
                title="Limpiar conversación"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 text-stone-300 hover:text-amber-300 hover:bg-white/10 rounded transition-colors cursor-pointer hidden sm:block"
                title={isExpanded ? 'Reducir tamaño' : 'Ampliar ventana'}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-stone-300 hover:text-rose-400 hover:bg-white/10 rounded transition-colors cursor-pointer"
                title="Minimizar a burbuja flotante"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* REAL-TIME APP STATUS BANNER */}
          <div className="bg-amber-50/90 border-b border-amber-200/80 px-3 py-1.5 flex items-center justify-between text-[11px] text-stone-700 shrink-0">
            <div className="flex items-center gap-1.5 truncate">
              <Database className="w-3.5 h-3.5 text-amber-800 shrink-0" />
              <span className="truncate">
                {currentProducer.fullName ? (
                  <>Expediente de: <strong className="text-amber-950">{currentProducer.fullName}</strong></>
                ) : (
                  <span className="text-stone-500 italic">Formulario en blanco (Listo para auditar)</span>
                )}
              </span>
            </div>
            {currentBrand.initials && (
              <span className="shrink-0 bg-stone-900 text-amber-300 text-[10px] font-mono-data px-1.5 py-0.5 rounded font-bold ml-1">
                Fierro: {currentBrand.initials}
              </span>
            )}
          </div>

          {/* CHAT MESSAGES CONTAINER */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-gradient-to-b from-stone-50/50 via-white to-stone-50/50 text-stone-800">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-amber-900 text-amber-200 flex items-center justify-center shrink-0 text-xs shadow-xs mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3 text-xs sm:text-sm shadow-xs ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-amber-700 to-amber-800 text-white rounded-tr-xs'
                      : 'bg-white border border-stone-200 text-stone-900 rounded-tl-xs shadow-sm'
                  }`}
                >
                  {msg.sender === 'assistant' ? (
                    renderFormattedText(msg.text)
                  ) : (
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  )}

                  <div
                    className={`flex items-center justify-between gap-2 mt-1.5 pt-1 border-t text-[10px] ${
                      msg.sender === 'user' ? 'border-amber-600/40 text-amber-200' : 'border-stone-100 text-stone-400'
                    }`}
                  >
                    <span>{msg.timestamp}</span>
                    {msg.source && <span className="font-mono-data text-[9px]">{msg.source}</span>}
                  </div>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-stone-800 text-white flex items-center justify-center shrink-0 text-xs shadow-xs mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200 w-fit animate-pulse">
                <Bot className="w-4 h-4 animate-spin text-amber-700" />
                <span>Analizando base de datos y normativa de Pánuco...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* QUICK SUGGESTION CHIPS (Knowledge Base & Database Analyzers) */}
          <div className="px-2.5 py-1.5 bg-stone-100 border-t border-stone-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-200 px-1.5 py-0.5 rounded shrink-0">
              Formato:
            </span>
            <button
              type="button"
              onClick={() => handleQuickAction('Deseo utilizar la Opción 1: Formato Sencillo / Tradicional (Ficha Única). ¿Qué datos exactos se requieren?')}
              className="px-2.5 py-1 text-[11px] bg-white hover:bg-amber-50 hover:text-amber-900 text-stone-800 border border-stone-300 rounded-full transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1 shadow-2xs shrink-0 font-medium"
            >
              <span>1. Formato Sencillo / Tradicional</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickAction('Deseo utilizar la Opción 2: Formato Completo / Moderno (Acta Certificada con QR). ¿Qué datos y folios incluye?')}
              className="px-2.5 py-1 text-[11px] bg-white hover:bg-amber-50 hover:text-amber-900 text-stone-800 border border-stone-300 rounded-full transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1 shadow-2xs shrink-0 font-medium"
            >
              <span>2. Formato Completo / Moderno</span>
            </button>
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 shrink-0 ml-1">
              Herramientas:
            </span>
            <button
              type="button"
              onClick={() => handleQuickAction('¿Mi fierro actual tiene conflicto o duplicidad contra los 4,250 registros de Pánuco?')}
              className="px-2.5 py-1 text-[11px] bg-white hover:bg-amber-50 hover:text-amber-900 text-stone-700 border border-stone-300 rounded-full transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1 shadow-2xs shrink-0"
            >
              <Search className="w-3 h-3 text-amber-700" />
              <span>Analizar Duplicidad Fierro</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickAction('Audita mi expediente actual y dime qué datos me faltan para certificar o descargar el PDF')}
              className="px-2.5 py-1 text-[11px] bg-white hover:bg-amber-50 hover:text-amber-900 text-stone-700 border border-stone-300 rounded-full transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1 shadow-2xs shrink-0"
            >
              <FileCheck2 className="w-3 h-3 text-emerald-700" />
              <span>Auditar Expediente Actual</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickAction('¿Qué dice la Ley Ganadera de Veracruz sobre dimensiones oficiales y vigencia de fierros?')}
              className="px-2.5 py-1 text-[11px] bg-white hover:bg-amber-50 hover:text-amber-900 text-stone-700 border border-stone-300 rounded-full transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1 shadow-2xs shrink-0"
            >
              <Scale className="w-3 h-3 text-amber-800" />
              <span>Ley Ganadera Veracruz</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickAction('Dame estadísticas generales de la base de datos pecuaria de Pánuco (ejidos y censo)')}
              className="px-2.5 py-1 text-[11px] bg-white hover:bg-amber-50 hover:text-amber-900 text-stone-700 border border-stone-300 rounded-full transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1 shadow-2xs shrink-0"
            >
              <Database className="w-3 h-3 text-stone-600" />
              <span>Estadísticas del Padrón</span>
            </button>
          </div>

          {/* CHAT INPUT AREA */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2 sm:p-3 bg-white border-t border-stone-200 flex items-center gap-2 shrink-0"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Pregunte sobre la ley, ejidos, duplicidad o su trámite..."
              disabled={isLoading}
              className="flex-1 px-3 py-2 text-xs sm:text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-600 focus:outline-none bg-stone-50/50"
            />
            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="p-2 sm:px-3.5 sm:py-2 text-white bg-amber-800 hover:bg-amber-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1 font-semibold text-xs"
              title="Enviar consulta"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Consultar</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
