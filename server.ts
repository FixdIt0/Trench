import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import type { ClientMsg, ServerMsg, PlayerState } from "./src/engine/protocol.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3333");

// Serve static build
app.use(express.static(path.join(import.meta.dirname, "dist")));
app.get("/{*splat}", (_req, res) => res.sendFile(path.join(import.meta.dirname, "dist/index.html")));

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Player state
const players = new Map<string, { ws: WebSocket; state: PlayerState }>();

const SWORD_DAMAGE = [0, 1, 2, 3]; // tier 0/1/2/3

function broadcast(msg: ServerMsg) {
  const data = JSON.stringify(msg);
  for (const p of players.values()) {
    if (p.ws.readyState === WebSocket.OPEN) p.ws.send(data);
  }
}

function broadcastPlayers() {
  broadcast({ type: "players", players: [...players.values()].map(p => p.state) });
}

wss.on("connection", (ws) => {
  let playerId = "";

  ws.on("message", (raw) => {
    let msg: ClientMsg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === "join") {
      playerId = msg.wallet;
      players.set(playerId, {
        ws,
        state: { id: playerId, x: 100, y: -1, hp: 10, maxHp: 10, swordTier: 0, falling: false },
      });
      broadcastPlayers();
    }

    if (msg.type === "move" && playerId) {
      const p = players.get(playerId);
      if (p) {
        p.state.x = msg.x;
        p.state.y = msg.y;
        p.state.hp = msg.hp;
        p.state.falling = msg.falling;
        p.state.swordTier = msg.swordTier;
        broadcastPlayers();
      }
    }

    if (msg.type === "attack" && playerId) {
      const attacker = players.get(playerId);
      const target = players.get(msg.targetId);
      if (!attacker || !target) return;

      const dmg = SWORD_DAMAGE[attacker.state.swordTier] || 0;
      if (dmg === 0) return;

      // Must be adjacent (cardinal only)
      const dx = Math.abs(attacker.state.x - target.state.x);
      const dy = Math.abs(attacker.state.y - target.state.y);
      if (dx + dy !== 1) return;

      target.state.hp = Math.round((target.state.hp - dmg) * 100) / 100;
      broadcast({ type: "hit", attackerId: playerId, targetId: msg.targetId, damage: dmg, targetHp: target.state.hp });

      if (target.state.hp <= 0) {
        broadcast({ type: "kill", killerId: playerId, victimId: msg.targetId });
        // Respawn target
        target.state.hp = target.state.maxHp;
        target.state.x = 100;
        target.state.y = -1;
        target.state.falling = false;
      }
      broadcastPlayers();
    }
  });

  ws.on("close", () => {
    if (playerId) {
      players.delete(playerId);
      broadcastPlayers();
    }
  });
});

server.listen(PORT, () => console.log(`Trench server on :${PORT}`));
