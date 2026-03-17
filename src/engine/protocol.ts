// Multiplayer protocol types — shared between client and server

export interface PlayerState {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  swordTier: number;
  falling: boolean;
  kills: number;
  totalEarned: number;
  depth: number;
}

// Client → Server
export type ClientMsg =
  | { type: "join"; wallet: string }
  | { type: "move"; x: number; y: number; hp: number; falling: boolean; swordTier: number; totalEarned: number; depth: number }
  | { type: "attack"; targetId: string };

// Server → Client
export type ServerMsg =
  | { type: "players"; players: PlayerState[] }
  | { type: "hit"; attackerId: string; targetId: string; damage: number; targetHp: number }
  | { type: "kill"; killerId: string; victimId: string }
  | { type: "chat"; from: string; text: string };
