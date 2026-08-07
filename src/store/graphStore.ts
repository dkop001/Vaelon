// ── Workspace Graph Store (Phase 2) ────────────────────────────────────────
// Holds the persisted dependency graph for the active workspace.
// `scan()` triggers a backend re-index; `load()` fetches the saved snapshot.

import { create } from 'zustand';
import { api, GraphNode, GraphEdge } from '../ipc/client';

interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  scannedFiles: number;
  scannedAt: string | null;
  loading: boolean;
  scanning: boolean;
  error: string | null;

  load: (workspaceId: string) => Promise<void>;
  scan: (workspaceId: string, workspacePath: string) => Promise<void>;
  clear: () => void;
}

export const useGraphStore = create<GraphState>((set) => ({
  nodes: [],
  edges: [],
  scannedFiles: 0,
  scannedAt: null,
  loading: false,
  scanning: false,
  error: null,

  load: async (workspaceId: string) => {
    set({ loading: true, error: null });
    try {
      const snap = await api.graphQuery(workspaceId);
      set({
        nodes: snap.nodes,
        edges: snap.edges,
        scannedFiles: snap.scanned_files,
        scannedAt: snap.scanned_at,
        loading: false,
      });
    } catch (err: any) {
      set({ error: err?.toString?.() ?? String(err), loading: false });
    }
  },

  scan: async (workspaceId: string, workspacePath: string) => {
    set({ scanning: true, error: null });
    try {
      const snap = await api.graphScan(workspaceId, workspacePath);
      set({
        nodes: snap.nodes,
        edges: snap.edges,
        scannedFiles: snap.scanned_files,
        scannedAt: snap.scanned_at,
        scanning: false,
      });
    } catch (err: any) {
      set({ error: err?.toString?.() ?? String(err), scanning: false });
    }
  },

  clear: () => {
    set({ nodes: [], edges: [], scannedFiles: 0, scannedAt: null, error: null });
  },
}));
