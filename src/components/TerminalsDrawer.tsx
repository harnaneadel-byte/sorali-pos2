import React from 'react';
import { TerminalDevice } from '../types';
import { RealtimeEvent } from '../hooks/useRealtimeSync';
import {
  Smartphone,
  Laptop,
  Radio,
  Send,
  X,
  Activity,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface TerminalsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  terminals: TerminalDevice[];
  currentTerminalId: string;
  eventLog: RealtimeEvent[];
}

export const TerminalsDrawer: React.FC<TerminalsDrawerProps> = ({
  isOpen,
  onClose,
  terminals,
  currentTerminalId,
  eventLog,
}) => {
  if (!isOpen) return null;

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
      case 'tablet':
        return <Smartphone className="w-4 h-4 text-amber-600" />;
      case 'telegram':
        return <Send className="w-4 h-4 text-blue-500" />;
      default:
        return <Laptop className="w-4 h-4 text-stone-700" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end animate-in fade-in">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between border-l border-stone-200">
        {/* Header */}
        <div className="p-4 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-600 animate-pulse" />
            <div>
              <h3 className="font-bold text-stone-900 font-cinzel text-sm">
                Terminaux Connectés en Direct
              </h3>
              <p className="text-[11px] text-stone-500">
                Synchronisation multi-appareils WebSockets active
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content: List of devices + Realtime Event Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar text-xs">
          {/* Active Devices List */}
          <div>
            <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
              Appareils Actifs ({terminals.length})
            </div>
            <div className="space-y-2">
              {terminals.map((t) => {
                const isCurrent = t.id === currentTerminalId;
                return (
                  <div
                    key={t.id}
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      isCurrent
                        ? 'bg-amber-50/70 border-amber-300'
                        : 'bg-stone-50 border-stone-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-white rounded-lg border border-stone-200 shadow-2xs">
                        {getDeviceIcon(t.deviceType)}
                      </div>
                      <div>
                        <div className="font-bold text-stone-900 flex items-center gap-1.5">
                          <span>{t.name}</span>
                          {isCurrent && (
                            <span className="text-[10px] bg-amber-600 text-white px-1.5 py-0.2 rounded font-mono">
                              Cet appareil
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-stone-500 font-mono">
                          ID: {t.id} • Rôle: {t.role}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                      <span>En ligne</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real-time Broadcast Event Stream */}
          <div>
            <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Flux d'Événements en Direct</span>
              <span className="font-mono text-[10px] text-stone-500">
                {eventLog.length} événements
              </span>
            </div>

            {eventLog.length === 0 ? (
              <div className="p-6 bg-stone-50 rounded-xl border border-stone-200 text-center text-stone-400 text-xs">
                En attente d'activités réseau... Effectuez une vente ou modifiez une tâche pour voir les événements temps réel.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
                {eventLog.map((evt, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-stone-50 rounded-lg border border-stone-200 flex items-start gap-2 text-[11px]"
                  >
                    <Activity className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-stone-900">
                          {evt.type}
                        </span>
                        <span className="text-[10px] text-stone-400 font-mono">
                          {new Date(evt.timestamp).toLocaleTimeString('fr-FR')}
                        </span>
                      </div>
                      <div className="text-stone-600 truncate mt-0.5">
                        {evt.payload?.title ||
                          evt.payload?.sale?.invoice_number ||
                          evt.payload?.customerName ||
                          JSON.stringify(evt.payload).slice(0, 50)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="p-3 bg-stone-50 border-t border-stone-200 text-[11px] text-stone-500 flex items-center justify-between">
          <span>Protocole: WebSocket RFC 6455</span>
          <span className="text-emerald-700 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Synchronisé
          </span>
        </div>
      </div>
    </div>
  );
};
