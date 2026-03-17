import { useEffect, useRef, useState, useCallback } from "react";
import type { ClientMsg, ServerMsg, PlayerState } from "../engine/protocol";

export function useMultiplayer(walletAddr: string | undefined) {
  const wsRef = useRef<WebSocket | null>(null);
  const [otherPlayers, setOtherPlayers] = useState<PlayerState[]>([]);
  const [allPlayers, setAllPlayers] = useState<PlayerState[]>([]);
  const [killFeed, setKillFeed] = useState<{ text: string; time: number }[]>([]);

  useEffect(() => {
    if (!walletAddr) return;
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}`);
    wsRef.current = ws;

    ws.onopen = () => {
      const msg: ClientMsg = { type: "join", wallet: walletAddr };
      ws.send(JSON.stringify(msg));
    };

    ws.onmessage = (e) => {
      const msg: ServerMsg = JSON.parse(e.data);
      if (msg.type === "players") {
        setAllPlayers(msg.players);
        setOtherPlayers(msg.players.filter(p => p.id !== walletAddr));
      }
      if (msg.type === "hit") {
        const atkr = msg.attackerId.slice(0, 4) + "..";
        const tgt = msg.targetId.slice(0, 4) + "..";
        setKillFeed(f => [{ text: `${atkr} hit ${tgt} for ${msg.damage} dmg`, time: Date.now() }, ...f].slice(0, 5));
      }
      if (msg.type === "kill") {
        const k = msg.killerId.slice(0, 4) + "..";
        const v = msg.victimId.slice(0, 4) + "..";
        setKillFeed(f => [{ text: `☠ ${k} killed ${v}`, time: Date.now() }, ...f].slice(0, 5));
      }
    };

    return () => { ws.close(); wsRef.current = null; };
  }, [walletAddr]);

  const sendMove = useCallback((x: number, y: number, hp: number, falling: boolean, swordTier: number, totalEarned: number, depth: number) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      const msg: ClientMsg = { type: "move", x, y, hp, falling, swordTier, totalEarned, depth };
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const sendAttack = useCallback((targetId: string) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      const msg: ClientMsg = { type: "attack", targetId };
      ws.send(JSON.stringify(msg));
    }
  }, []);

  // Clean old kill feed entries
  useEffect(() => {
    const t = setInterval(() => {
      setKillFeed(f => f.filter(e => Date.now() - e.time < 8000));
    }, 2000);
    return () => clearInterval(t);
  }, []);

  return { otherPlayers, allPlayers, killFeed, sendMove, sendAttack };
}
