import { useRef, useEffect, useCallback, useState } from "react";
import type { CliId, Message, WsMessage } from "../types/message";

export function useWebSocket(onNewMessages: (msgs: Message[]) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>();
  const retryDelay = useRef(1000);
  const onNewMessagesRef = useRef(onNewMessages);
  const watchTargetRef = useRef<{
    cli: CliId;
    project: string;
    session: string;
  } | null>(null);
  onNewMessagesRef.current = onNewMessages;

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      setConnected(true);
      retryDelay.current = 1000;
      const target = watchTargetRef.current;
      if (target) {
        ws.send(JSON.stringify({ type: "watch", ...target }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data: WsMessage = JSON.parse(event.data);
        if (data.type === "new-messages" && data.messages) {
          onNewMessagesRef.current(data.messages);
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectTimeout.current = setTimeout(() => {
        retryDelay.current = Math.min(retryDelay.current * 2, 30000);
        connect();
      }, retryDelay.current);
    };

    ws.onerror = () => ws.close();

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const watch = useCallback((cli: CliId, project: string, session: string) => {
    watchTargetRef.current = { cli, project, session };
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "watch", cli, project, session }));
    }
  }, []);

  const unwatch = useCallback(() => {
    watchTargetRef.current = null;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "unwatch" }));
    }
  }, []);

  return { connected, watch, unwatch };
}
