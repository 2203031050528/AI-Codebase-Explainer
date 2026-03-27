import React, { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";

const NODE_W = 200;
const NODE_H = 44;
const FOLDER_W = 220;
const FOLDER_H = 56;

/* ── Dagre layout ──────────────────────────────────────────────────── */
function applyDagreLayout(nodes, edges) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", ranksep: 90, nodesep: 50 });

  nodes.forEach((n) => {
    const w = n.type === "folder" ? FOLDER_W : NODE_W;
    const h = n.type === "folder" ? FOLDER_H : NODE_H;
    g.setNode(n.id, { width: w, height: h });
  });
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map((n) => {
    const { x, y } = g.node(n.id);
    const w = n.type === "folder" ? FOLDER_W : NODE_W;
    const h = n.type === "folder" ? FOLDER_H : NODE_H;
    return { ...n, position: { x: x - w / 2, y: y - h / 2 } };
  });
}

/* ── Styles ────────────────────────────────────────────────────────── */
const fileStyle = {
  background: "#1a1e2a",
  color: "#abb2bf",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 11,
  fontFamily: "'JetBrains Mono', monospace",
  width: NODE_W,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const folderStyle = {
  background: "rgba(79,142,247,0.08)",
  color: "#4f8ef7",
  border: "1px solid rgba(79,142,247,0.3)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "'Inter', sans-serif",
  width: FOLDER_W,
};

/* ── Component ─────────────────────────────────────────────────────── */
function GraphView({ nodes: rawNodes, edges: rawEdges }) {
  const { initNodes, initEdges } = useMemo(() => {
    if (!rawNodes.length) return { initNodes: [], initEdges: [] };

    const validFileIds = new Set(rawNodes.map((n) => n.id));

    // Build folder nodes from file paths
    const folderSet = new Set();
    rawNodes.forEach((n) => {
      const parts = n.id.split("/");
      if (parts.length > 1) {
        // Add all ancestor folder paths
        for (let i = 1; i < parts.length; i++) {
          folderSet.add(parts.slice(0, i).join("/"));
        }
      }
    });

    // Folder nodes
    const folderNodes = [...folderSet].map((fPath) => ({
      id: `folder::${fPath}`,
      type: "folder",
      data: { label: `📁 ${fPath.split("/").pop() || fPath}` },
      style: folderStyle,
      position: { x: 0, y: 0 },
    }));

    // File nodes
    const fileNodes = rawNodes.map((n) => {
      const filename = n.id.split("/").pop();
      return {
        id: n.id,
        type: "file",
        data: { label: `📄 ${filename}` },
        style: fileStyle,
        position: { x: 0, y: 0 },
        title: n.id,
      };
    });

    // Folder → File edges (hierarchy)
    const hierarchyEdges = [];
    rawNodes.forEach((n, i) => {
      const parts = n.id.split("/");
      if (parts.length > 1) {
        const parentFolder = parts.slice(0, -1).join("/");
        hierarchyEdges.push({
          id: `h-${i}`,
          source: `folder::${parentFolder}`,
          target: n.id,
          style: { stroke: "rgba(79,142,247,0.25)", strokeWidth: 1 },
          type: "smoothstep",
        });
      }
    });

    // File → File import edges (from backend)
    const importEdges = rawEdges
      .filter((e) => validFileIds.has(e.source) && validFileIds.has(e.target))
      .map((e, i) => ({
        id: `imp-${i}`,
        source: e.source,
        target: e.target,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#3ecf8e" },
        style: { stroke: "#3ecf8e", strokeWidth: 1.5 },
        type: "smoothstep",
        label: "imports",
        labelStyle: { fill: "#3ecf8e", fontSize: 10 },
        labelBgStyle: { fill: "#13161e", fillOpacity: 0.8 },
      }));

    const allNodes = [...folderNodes, ...fileNodes];
    const allEdges = [...hierarchyEdges, ...importEdges];
    const layoutedNodes = applyDagreLayout(allNodes, allEdges);

    return { initNodes: layoutedNodes, initEdges: allEdges };
  }, [rawNodes, rawEdges]);

  const [nodes, , onNodesChange] = useNodesState(initNodes);
  const [edges, , onEdgesChange] = useEdgesState(initEdges);

  if (!rawNodes.length) {
    return (
      <div className="graph-empty">
        <span style={{ fontSize: 36 }}>🕸️</span>
        <span>Click <strong>🕸 Graph</strong> in the header to generate</span>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", minHeight: 300 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={3}
        attributionPosition="bottom-left"
      >
        <Background color="#2a2e3e" gap={20} size={1} />
        <Controls
          style={{
            background: "#1a1e2a",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        />
        <MiniMap
          style={{
            background: "#13161e",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
          nodeColor={(n) => (n.type === "folder" ? "#4f8ef7" : "#2a2e3e")}
          maskColor="rgba(13,15,20,0.75)"
        />
      </ReactFlow>

      {/* Legend */}
      <div style={{
        position: "absolute", bottom: 10, left: 10,
        background: "rgba(19,22,30,0.9)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 6, padding: "6px 10px",
        fontSize: 11, color: "#6b7394",
        display: "flex", gap: 14, pointerEvents: "none",
        zIndex: 10,
      }}>
        <span style={{ color: "#4f8ef7" }}>— Folder structure</span>
        <span style={{ color: "#3ecf8e" }}>→ Import dependency</span>
      </div>
    </div>
  );
}

export default GraphView;