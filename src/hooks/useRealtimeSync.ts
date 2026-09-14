import { useEffect, useRef, useState, useCallback } from 'react';
import { TerminalDevice, UserRole } from '../types';

export interface RealtimeEvent {
  type: string;
  payload: any;
  timestamp: string;
  sourceTerminalId?: string;
}

export function useRealtimeSync(currentRole: UserRole, currentUserName: string) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [terminals, setTerminals] = useState<TerminalDevice[]>([]);
  const [terminalId, setTerminalId] = useState<string>('');
  const [eventLog, setEventLog] = useState<RealtimeEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const listenersRef = useRef<Map<string, Set<(payload: any) => void>>>(new Map());

  const addEventListener = useCallback((type: string, cb: (payload: any) => void) => {
    if (!listenersRef.current.has(type)) {
      listenersRef.current.set(type, new Set());
    }
    listenersRef.current.get(type)!.add(cb);
    return () => {
      listenersRef.current.get(type)?.delete(cb);
    };
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Identify terminal
        const userAgent = navigator.userAgent;
        const isMobile = /mobile|android|iphone|ipad/i.test(userAgent);
        const deviceType = (window as any).Telegram?.WebApp ? 'telegram' : isMobile ? 'mobile' : 'desktop';

        const tid = sessionStorage.getItem('solari_terminal_id') || `term_${Math.random().toString(36).substr(2, 6)}`;
        sessionStorage.setItem('solari_terminal_id', tid);
        setTerminalId(tid);

        ws.send(
          JSON.stringify({
            type: 'register_terminal',
            terminalId: tid,
            terminalName: `${currentUserName} (${currentRole})`,
            role: currentRole,
            deviceType,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'connected') {
            if (data.terminalId && !sessionStorage.getItem('solari_terminal_id')) {
              setTerminalId(data.terminalId);
            }
            if (data.activeTerminals) {
              setTerminals(data.activeTerminals);
            }
            return;
          }

          if (data.type === 'presence:update') {
            if (data.payload?.terminals) {
              setTerminals(data.payload.terminals);
            }
            return;
          }

          // Realtime event
          const newEvt: RealtimeEvent = {
            type: data.type,
            payload: data.payload,
            timestamp: data.timestamp || new Date().toISOString(),
            sourceTerminalId: data.sourceTerminalId,
          };

          setEventLog((prev) => [newEvt, ...prev.slice(0, 49)]);

          const callbacks = listenersRef.current.get(data.type);
          if (callbacks) {
            callbacks.forEach((cb) => cb(data.payload));
          }
        } catch (e) {
          // Parse error
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        setIsConnected(false);
      };
    } catch (err) {
      setIsConnected(false);
      reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
    }
  }, [currentRole, currentUserName]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  // Update terminal registration when role or username changes
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'register_terminal',
          terminalId,
          terminalName: `${currentUserName} (${currentRole})`,
          role: currentRole,
        })
      );
    }
  }, [currentRole, currentUserName, terminalId]);

  return {
    isConnected,
    terminals,
    terminalId,
    eventLog,
    addEventListener,
  };
}
