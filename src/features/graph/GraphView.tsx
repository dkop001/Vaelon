// ── Workspace Graph View (Phase 2) ─────────────────────────────────────────
// Force-directed visualization of the persisted workspace dependency graph.
// Nodes = directories / files / symbols. Edges = contains / defines / imports.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useAppStore } from '../../store/appStore';
import { GraphNode, GraphEdge } from '../../ipc/client';
import './GraphView.css';

type SimNode = GraphNode & { x: number; y: number; vx: number; vy: number; };
type SimEdge = GraphEdge;

const NODE_RADIUS: Record<string, number> = {
  directory: 26,
  file: 14,
  symbol: 6,
};

const COLORS: Record<string, string> = {
  directory: '#8b5cf6',
  file: '#6366f1',
  symbol: '#fbbf24',
};

const EDGE_OPACITY: Record<string, number> = {
  contains: 0.08,
  defines: 0.25,
  imports: 0.55,
};

const EDGE_COLOR: Record<string, string> = {
  contains: '#475569',
  defines: '#f59e0b',
  imports: '#818cf8',
};

function buildSim(nodes: GraphNode[], edges: GraphEdge[]): { nodes: SimNode[]; edges: SimEdge[] } {
  const sim = nodes.map((n, i) => {
    // Seed positions in a circle so the layout converges faster.
    const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2;
    const radius = 120 + Math.random() * 60;
    return {
      ...n,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
    };
  });
  return { nodes: sim, edges };
}

function stepSim(nodes: SimNode[], edges: SimEdge[], iterations: number) {
  const k = 200;         // spring constant
  const rest = 90;       // ideal edge length
  const repulsion = 2200; // node-node repulsion
  const damping = 0.85;

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion (O(n²) — fine for a few hundred nodes)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 5) dist = 5;
        const force = repulsion / (dist * dist);
        dx /= dist;
        dy /= dist;
        a.vx -= dx * force;
        a.vy -= dy * force;
        b.vx += dx * force;
        b.vy += dy * force;
      }
    }
    // Springs along edges
    for (const e of edges) {
      const a = nodes.find((n) => n.id === e.source_id);
      const b = nodes.find((n) => n.id === e.target_id);
      if (!a || !b) continue;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - rest) * k;
      dx /= dist;
      dy /= dist;
      a.vx += dx * force;
      a.vy += dy * force;
      b.vx -= dx * force;
      b.vy -= dy * force;
    }
    // Apply velocity + damping
    for (const n of nodes) {
      n.x += n.vx * damping;
      n.y += n.vy * damping;
      n.vx *= damping;
      n.vy *= damping;
    }
  }
}

// ── Graph View ─────────────────────────────────────────────────────────────

export default function GraphView() {
  const { nodes, edges, scannedFiles, scannedAt, loading, scanning, error, load, scan } = useGraphStore();
  const { workspaces, activeWorkspaceId } = useWorkspaceStore();
  const { setBackgroundService } = useAppStore();

  const [sim, setSim] = useState<{ nodes: SimNode[]; edges: SimEdge[] } | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [filter, setFilter] = useState('');
  const [view, setView] = useState<{ zoom: number; panX: number; panY: number }>({ zoom: 1, panX: 0, panY: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ id: string | null; dx: number; dy: number }>({ id: null, dx: 0, dy: 0 });

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);

  // Load persisted graph when the workspace changes.
  useEffect(() => {
    if (activeWorkspaceId) {
      load(activeWorkspaceId).catch(() => {});
    } else {
      useGraphStore.getState().clear();
    }
  }, [activeWorkspaceId, load]);

  // Reset the simulation when nodes/edges change.
  useEffect(() => {
    if (nodes.length === 0) {
      setSim(null);
      return;
    }
    const { nodes: sn, edges: se } = buildSim(nodes, edges);
    stepSim(sn, se, 90);
    setSim({ nodes: sn, edges: se });
  }, [nodes, edges]);

  // Mark indexer background service while scanning.
  useEffect(() => {
    setBackgroundService('indexer', scanning ? 'active' : 'inactive');
  }, [scanning, setBackgroundService]);

  const handleScan = useCallback(async () => {
    if (!activeWs) return;
    await scan(activeWs.id, activeWs.path);
  }, [activeWs, scan]);

  const filteredNodes = useMemo(() => {
    if (!sim) return [];
    if (!filter.trim()) return sim.nodes;
    const q = filter.trim().toLowerCase();
    return sim.nodes.filter(
      (n) => n.name.toLowerCase().includes(q) || n.path.toLowerCase().includes(q)
    );
  }, [sim, filter]);

  const connectedIds = useMemo(() => {
    const set = new Set<string>();
    for (const n of filteredNodes) set.add(n.id);
    const out = new Set<string>(set);
    for (const e of sim?.edges ?? []) {
      if (set.has(e.source_id)) out.add(e.target_id);
      if (set.has(e.target_id)) out.add(e.source_id);
    }
    return out;
  }, [filteredNodes, sim]);

  // ── Interaction handlers ─────────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const target = (e.target as Element).closest?.('g[data-node-id]');
    if (target) {
      const id = target.getAttribute('data-node-id')!;
      const node = sim?.nodes.find((n) => n.id === id);
      if (node) {
        dragRef.current = { id, dx: e.clientX - node.x, dy: e.clientY - node.y };
        setSelected(node);
        (e.target as Element).setPointerCapture?.(e.pointerId);
        return;
      }
    }
    // Pan the canvas
    dragRef.current = { id: '__pan__', dx: e.clientX - view.panX, dy: e.clientY - view.panY };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.id === '__pan__') {
      setView((v) => ({ ...v, panX: e.clientX - d.dx, panY: e.clientY - d.dy }));
      return;
    }
    setSim((s) => {
      if (!s) return s;
      const node = s.nodes.find((n) => n.id === d.id);
      if (!node) return s;
      node.x = e.clientX - d.dx;
      node.y = e.clientY - d.dy;
      return { ...s };
    });
  };

  const handlePointerUp = () => {
    dragRef.current = { id: null, dx: 0, dy: 0 };
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setView((v) => ({ ...v, zoom: Math.min(3, Math.max(0.25, v.zoom * factor)) }));
  };

  // ── Render ───────────────────────────────────────────────────────────

  const svgW = 1200;
  const svgH = 800;

  if (loading) {
    return (
      <div className="graph-view">
        <div className="graph-empty">Loading graph…</div>
      </div>
    );
  }

  if (sim === null) {
    return (
      <div className="graph-view">
        <div className="graph-empty">
          <div className="graph-empty-icon">⌬</div>
          <h2>Workspace Graph</h2>
          <p>
            Scan this project to build a live dependency graph of its directories, files, and symbols.
          </p>
          <button className="btn btn-primary" onClick={handleScan} disabled={scanning || !activeWs}>
            {scanning ? 'Scanning…' : 'Scan Workspace'}
          </button>
          {error && <p className="graph-error">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="graph-view">
      <div className="graph-toolbar">
        <input
          className="graph-search"
          placeholder="Filter nodes…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="graph-stats">
          <span>{scannedFiles} files</span>
          <span>·</span>
          <span>{nodes.filter((n) => n.node_type === 'symbol').length} symbols</span>
          {scannedAt && <span>· scanned {scannedAt.slice(0, 16).replace('T', ' ')}</span>}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleScan} disabled={scanning || !activeWs}>
          {scanning ? 'Scanning…' : 'Re-scan'}
        </button>
        {error && <span className="graph-error-inline">{error}</span>}
      </div>

      <div className="graph-canvas">
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`${-svgW / 2} ${-svgH / 2} ${svgW} ${svgH}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          style={{ cursor: dragRef.current.id ? 'grabbing' : 'grab' }}
        >
          <g transform={`translate(${view.panX} ${view.panY}) scale(${view.zoom})`}>
            {/* Edges */}
            {sim.edges.map((e) => {
              const a = sim.nodes.find((n) => n.id === e.source_id);
              const b = sim.nodes.find((n) => n.id === e.target_id);
              if (!a || !b) return null;
              const visible =
                filteredNodes.length === sim.nodes.length ||
                (connectedIds.has(a.id) && connectedIds.has(b.id));
              return (
                <line
                  key={e.id}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className="graph-edge"
                  style={{
                    stroke: EDGE_COLOR[e.edge_type] ?? '#94a3b8',
                    opacity: visible ? EDGE_OPACITY[e.edge_type] ?? 0.2 : 0.02,
                  }}
                />
              );
            })}

            {/* Nodes */}
            {filteredNodes.map((n) => {
              const isSelected = selected?.id === n.id;
              const dimmed = filter.trim() !== '' && !connectedIds.has(n.id);
              return (
                <g
                  key={n.id}
                  data-node-id={n.id}
                  className={`graph-node graph-node-${n.node_type} ${isSelected ? 'selected' : ''} ${dimmed ? 'dimmed' : ''}`}
                  opacity={dimmed ? 0.18 : 1}
                >
                  <circle
                    r={NODE_RADIUS[n.node_type] ?? 10}
                    fill={COLORS[n.node_type] ?? '#94a3b8'}
                    fillOpacity={0.16}
                    stroke={COLORS[n.node_type] ?? '#94a3b8'}
                    strokeWidth={isSelected ? 2 : 1}
                  />
                  <text
                    className="graph-node-label"
                    textAnchor="middle"
                    dy={n.node_type === 'symbol' ? 3 : 30}
                    fontSize={n.node_type === 'directory' ? 11 : n.node_type === 'symbol' ? 8 : 9}
                    fontWeight={n.node_type === 'directory' ? 700 : 500}
                  >
                    {n.node_type === 'symbol' ? n.symbol_kind : n.name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Legend */}
        <div className="graph-legend">
          {(['directory', 'file', 'symbol'] as const).map((t) => (
            <div key={t} className="graph-legend-item">
              <span className="graph-legend-dot" style={{ background: COLORS[t] }} />
              {t}
            </div>
          ))}
        </div>
      </div>

      {/* Inspector */}
      {selected && (
        <div className="graph-inspector">
          <div className="graph-inspector-head">
            <span style={{ color: COLORS[selected.node_type] }}>{selected.node_type}</span>
            <button className="graph-inspector-close" onClick={() => setSelected(null)}>×</button>
          </div>
          <div className="graph-inspector-name">{selected.name}</div>
          <div className="graph-inspector-path">{selected.path}</div>
          {selected.node_type === 'file' && (
            <div className="graph-inspector-meta">
              {selected.language} · {selected.size} bytes
            </div>
          )}
          {selected.node_type === 'symbol' && (
            <div className="graph-inspector-meta">kind: {selected.symbol_kind}</div>
          )}
        </div>
      )}
    </div>
  );
}
