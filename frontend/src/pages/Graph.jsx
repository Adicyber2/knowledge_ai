import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Sidebar from "../components/Sidebar";
import { getKnowledgeGraph } from "../service/knowledgeService";
import { useAuth } from "../context/AuthContext";
import KnowledgeDetailsModal from "../components/KnowledgeDetailsModal";
import "./Graph.css";


// ---- Source type icon ----
const getSourceIcon = (type) => {
  switch ((type || "").toLowerCase()) {
    case "youtube": return "▶";
    case "pdf": return "📄";
    case "article": return "🌐";
    case "note": return "📝";
    default: return "✦";
  }
};


// ---- Node Styling ----
const getNodeStyle = (type, isSelected, isHovered) => {
  switch (type) {
    case "domain":
      return {
        r: 28,
        fill: "url(#domainGradient)",
        stroke: isSelected ? "#f8fafc" : isHovered ? "#c4b5fd" : "#8b5cf6",
        strokeWidth: isSelected ? 3 : 2,
        textColor: "#f8fafc",
        fontWeight: "700",
        fontSize: "11",
      };
    case "tag":
      return {
        r: 18,
        fill: "#0c1a2e",
        stroke: isSelected ? "#f8fafc" : isHovered ? "#a5f3fc" : "#06b6d4",
        strokeWidth: isSelected ? 3 : 1.5,
        textColor: "#67e8f9",
        fontWeight: "600",
        fontSize: "10",
      };
    case "knowledge":
      return {
        r: 22,
        fill: "#1e1b4b",
        stroke: isSelected ? "#f8fafc" : isHovered ? "#ddd6fe" : "#7c3aed",
        strokeWidth: isSelected ? 3 : 1.5,
        textColor: "#c4b5fd",
        fontWeight: "500",
        fontSize: "9.5",
      };
    default:
      return {
        r: 16,
        fill: "#1e293b",
        stroke: "#64748b",
        strokeWidth: 1.5,
        textColor: "#94a3b8",
        fontWeight: "400",
        fontSize: "9",
      };
  }
};


// ---- Edge Styling ----
const getEdgeStyle = (relationship, isHovered) => {
  switch (relationship) {
    case "SEMANTICALLY_RELATED":
      return {
        stroke: isHovered ? "#c4b5fd" : "#8b5cf6",
        strokeWidth: isHovered ? 2.5 : 1.5,
        strokeDasharray: "4 3",
        opacity: isHovered ? 1 : 0.6,
      };
    case "SOURCE_OF_TOPIC":
      return {
        stroke: isHovered ? "#38bdf8" : "#0284c7",
        strokeWidth: isHovered ? 2.5 : 1.5,
        strokeDasharray: "none",
        opacity: isHovered ? 1 : 0.7,
      };
    case "SAME_TOPIC":
    case "SAME_TAG":
    default:
      return {
        stroke: isHovered ? "#94a3b8" : "#334155",
        strokeWidth: isHovered ? 2 : 1.2,
        strokeDasharray: "none",
        opacity: isHovered ? 0.9 : 0.5,
      };
  }
};


// ---- Hierarchical Force Layout Initial Computation ----
const computeHierarchicalLayout = (nodes, edges, width, height) => {
  const positions = {};

  const domainNodes = nodes.filter((n) => n.type === "domain");
  const tagNodes = nodes.filter((n) => n.type === "tag");
  const knowledgeNodes = nodes.filter((n) => n.type === "knowledge");

  domainNodes.forEach((n, idx) => {
    const total = domainNodes.length;
    const step = width / (total + 1);
    positions[n.id] = {
      x: step * (idx + 1),
      y: 110,
      vx: 0,
      vy: 0,
    };
  });

  tagNodes.forEach((n, idx) => {
    const parentDomain = domainNodes.find((d) => d.id === `domain-${n.domain}`);
    const baseX = parentDomain ? positions[parentDomain.id]?.x : width / 2;
    const offset = (idx % 2 === 0 ? 1 : -1) * Math.floor((idx + 1) / 2) * 80;

    positions[n.id] = {
      x: Math.max(90, Math.min(width - 90, (baseX || width / 2) + offset)),
      y: 270 + (idx % 3) * 40,
      vx: 0,
      vy: 0,
    };
  });

  knowledgeNodes.forEach((n, idx) => {
    positions[n.id] = {
      x: Math.random() * (width - 240) + 120,
      y: 440 + (idx % 3) * 45,
      vx: 0,
      vy: 0,
    };
  });

  const k = Math.sqrt((width * height) / Math.max(nodes.length, 1)) * 0.75;

  for (let iter = 0; iter < 120; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = positions[nodes[i].id];
        const b = positions[nodes[j].id];
        if (!a || !b) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = (k * k) / dist;
        const fx = (dx / dist) * force * 0.35;
        const fy = (dy / dist) * force * 0.35;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    edges.forEach((e) => {
      const a = positions[e.from];
      const b = positions[e.to];
      if (!a || !b) return;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = (dist * dist) / k;
      const factor = e.relationship === "SEMANTICALLY_RELATED" ? 0.02 : 0.05;
      const fx = (dx / dist) * force * factor;
      const fy = (dy / dist) * force * factor;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    });

    nodes.forEach((n) => {
      const p = positions[n.id];
      if (!p) return;
      p.x += p.vx * 0.35;
      p.y += p.vy * 0.35;
      p.vx *= 0.7;
      p.vy *= 0.7;
      p.x = Math.max(60, Math.min(width - 60, p.x));
      p.y = Math.max(60, Math.min(height - 60, p.y));
    });
  }

  return positions;
};


const Graph = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [positions, setPositions] = useState({});

  // Details Modal
  const [selectedNode, setSelectedNode] = useState(null);

  // Hover states
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredEdge, setHoveredEdge] = useState(null);

  // Zoom & Pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Dragging states
  const [isCanvasDragging, setIsCanvasDragging] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const svgRef = useRef(null);
  const W = 1000;
  const H = 650;

  const storageKey = user?.id ? `kv_graph_pos_${user.id}` : "kv_graph_pos";


  // Save node positions to LocalStorage
  const persistPositions = useCallback((newPositions) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(newPositions));
    } catch (e) {
      console.warn("Could not save node positions:", e);
    }
  }, [storageKey]);


  // Load graph data & restore persisted node positions
  const loadGraph = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getKnowledgeGraph();
      const nodes = data.nodes || [];
      const edges = data.edges || [];
      setGraphData({ nodes, edges });

      if (nodes.length > 0) {
        // Initial hierarchical positions
        const calculatedPos = computeHierarchicalLayout(nodes, edges, W, H);

        // Restore persisted positions if saved
        let savedPos = {};
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) savedPos = JSON.parse(raw);
        } catch {
          // ignore
        }

        // Merge saved positions over calculated
        const finalPos = { ...calculatedPos };
        Object.keys(savedPos).forEach((nid) => {
          if (finalPos[nid] && savedPos[nid]) {
            finalPos[nid] = {
              ...finalPos[nid],
              x: savedPos[nid].x,
              y: savedPos[nid].y,
            };
          }
        });

        setPositions(finalPos);
      }
    } catch (err) {
      console.error("Failed to load graph:", err);
      setError("Failed to load knowledge graph.");
    } finally {
      setLoading(false);
    }
  }, [storageKey]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);


  // Connected node IDs for active hover
  const activeConnectedIds = useMemo(() => {
    if (!hoveredNode) return null;
    const connected = new Set([hoveredNode.id]);
    graphData.edges.forEach((e) => {
      if (e.from === hoveredNode.id) connected.add(e.to);
      if (e.to === hoveredNode.id) connected.add(e.from);
    });
    return connected;
  }, [hoveredNode, graphData.edges]);


  // Zoom handlers
  const handleZoomIn = () => setZoom((z) => Math.min(2.5, z + 0.2));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, z - 0.2));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.min(2.5, Math.max(0.5, z + delta)));
  };


  // Canvas Pan vs Node Drag handlers
  const handleMouseDownCanvas = (e) => {
    if (e.target.tagName === "svg" || e.target.classList.contains("graph-bg")) {
      setIsCanvasDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseDownNode = (e, nodeId) => {
    e.stopPropagation();
    setDraggedNodeId(nodeId);
    // Track pointer offset in SVG coordinates
    const p = positions[nodeId] || { x: 0, y: 0 };
    setDragStart({
      x: (e.clientX - pan.x) / zoom - p.x,
      y: (e.clientY - pan.y) / zoom - p.y,
    });
  };

  const handleMouseMove = (e) => {
    if (draggedNodeId) {
      // Move ONLY the dragged node
      const newX = (e.clientX - pan.x) / zoom - dragStart.x;
      const newY = (e.clientY - pan.y) / zoom - dragStart.y;

      const clampedX = Math.max(30, Math.min(W - 30, newX));
      const clampedY = Math.max(30, Math.min(H - 30, newY));

      setPositions((prev) => {
        const next = {
          ...prev,
          [draggedNodeId]: {
            ...(prev[draggedNodeId] || {}),
            x: clampedX,
            y: clampedY,
          },
        };
        persistPositions(next);
        return next;
      });
    } else if (isCanvasDragging) {
      // Pan canvas
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsCanvasDragging(false);
    setDraggedNodeId(null);
  };


  return (
    <div className="vault-layout">
      <Sidebar />

      <main className="vault-main">

        {/* Header */}
        <header className="knowledge-header">
          <div>
            <span className="topbar-label">YOUR SECOND BRAIN</span>
            <h1>Knowledge Relationship Graph</h1>
            <p>Drag individual nodes to arrange. Click any node or card for details.</p>
          </div>
        </header>


        {/* Legend */}
        <div className="graph-legend">
          <span className="graph-legend-item graph-legend-domain">
            <span className="legend-dot domain-dot" /> DOMAIN
          </span>
          <span className="graph-legend-item graph-legend-tag">
            <span className="legend-dot tag-dot" /> TAG / SUBTOPIC
          </span>
          <span className="graph-legend-item graph-legend-knowledge">
            <span className="legend-dot knowledge-dot" /> KNOWLEDGE ITEM
          </span>
          <span className="graph-legend-item graph-legend-semantic">
            <span className="legend-line semantic-line" /> SEMANTIC RELATION
          </span>
        </div>


        {/* Loading */}
        {loading && (
          <div className="graph-status">
            <div className="graph-spinner" />
            Generating knowledge relationship graph...
          </div>
        )}


        {/* Error */}
        {error && (
          <div className="auth-error">{error}</div>
        )}


        {/* Empty State */}
        {!loading && !error && graphData.nodes.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">◈</div>
            <h2>Your Knowledge Graph is empty</h2>
            <p>Add notes, articles, PDFs or videos to start building your Knowledge Graph.</p>
          </div>
        )}


        {/* Graph Container */}
        {!loading && !error && graphData.nodes.length > 0 && (
          <div className="graph-container">

            {/* Zoom / Pan Controls Toolbar */}
            <div className="graph-controls">
              <button onClick={handleZoomIn} title="Zoom In">+</button>
              <button onClick={handleZoomOut} title="Zoom Out">−</button>
              <button onClick={handleResetZoom} title="Reset View">⊙</button>
            </div>


            {/* Edge Hover Relationship Tooltip */}
            {hoveredEdge && (
              <div className="edge-tooltip">
                <span className="edge-tooltip-type">{hoveredEdge.relationship}</span>
                <span>{hoveredEdge.label || "Connected"}</span>
              </div>
            )}


            {/* SVG Canvas */}
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="graph-svg graph-bg"
              onWheel={handleWheel}
              onMouseDown={handleMouseDownCanvas}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <defs>
                <linearGradient id="domainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#4c1d95" />
                </linearGradient>
              </defs>

              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>

                {/* Edges */}
                {graphData.edges.map((e, i) => {
                  const a = positions[e.from];
                  const b = positions[e.to];
                  if (!a || !b) return null;

                  const isEdgeHovered = hoveredEdge === e;
                  const isDimmed =
                    activeConnectedIds &&
                    (!activeConnectedIds.has(e.from) || !activeConnectedIds.has(e.to));

                  const style = getEdgeStyle(e.relationship, isEdgeHovered);

                  return (
                    <g key={i}>
                      <line
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke={style.stroke}
                        strokeWidth={style.strokeWidth}
                        strokeDasharray={style.strokeDasharray}
                        opacity={isDimmed ? 0.15 : style.opacity}
                      />
                      {/* Invisible wider line for easier hover detection */}
                      <line
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke="transparent"
                        strokeWidth="12"
                        style={{ cursor: "pointer" }}
                        onMouseEnter={() => setHoveredEdge(e)}
                        onMouseLeave={() => setHoveredEdge(null)}
                      />
                    </g>
                  );
                })}


                {/* Nodes */}
                {graphData.nodes.map((node) => {
                  const pos = positions[node.id];
                  if (!pos) return null;

                  const isSelected = selectedNode?.id === node.id;
                  const isHovered = hoveredNode?.id === node.id;
                  const isDimmed = activeConnectedIds && !activeConnectedIds.has(node.id);

                  const style = getNodeStyle(node.type, isSelected, isHovered);

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${pos.x},${pos.y})`}
                      onMouseDown={(e) => handleMouseDownNode(e, node.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Open KnowledgeDetailsModal on node click
                        setSelectedNode(node);
                      }}
                      onMouseEnter={() => setHoveredNode(node)}
                      onMouseLeave={() => setHoveredNode(null)}
                      className={`graph-node ${draggedNodeId === node.id ? "dragging" : ""}`}
                      opacity={isDimmed ? 0.2 : 1}
                    >
                      {/* Node circle */}
                      <circle
                        r={style.r}
                        fill={style.fill}
                        stroke={style.stroke}
                        strokeWidth={style.strokeWidth}
                        className={isSelected ? "graph-node-selected" : ""}
                      />

                      {/* Icon inside Knowledge nodes */}
                      {node.type === "knowledge" && (
                        <text
                          y="1"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize="11"
                          fill={style.textColor}
                          pointerEvents="none"
                        >
                          {getSourceIcon(node.sourceType)}
                        </text>
                      )}

                      {/* Domain icon */}
                      {node.type === "domain" && (
                        <text
                          y="-2"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize="12"
                          fill="#ffffff"
                          pointerEvents="none"
                        >
                          📁
                        </text>
                      )}

                      {/* Node Label */}
                      <text
                        y={style.r + 14}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={style.fontSize}
                        fontWeight={style.fontWeight}
                        fill={style.textColor}
                        className="graph-label"
                      >
                        {node.label.length > 20
                          ? node.label.substring(0, 20) + "…"
                          : node.label}
                      </text>
                    </g>
                  );
                })}

              </g>
            </svg>

          </div>
        )}


        {/* Stats Footer */}
        {!loading && graphData.nodes.length > 0 && (
          <div className="graph-stats">
            <span>{graphData.nodes.filter((n) => n.type === "domain").length} Domains</span>
            <span>·</span>
            <span>{graphData.nodes.filter((n) => n.type === "tag").length} Subtopics & Tags</span>
            <span>·</span>
            <span>{graphData.nodes.filter((n) => n.type === "knowledge").length} Knowledge Items</span>
            <span>·</span>
            <span>{graphData.edges.length} Relationships</span>
          </div>
        )}


        {/* Shared Reusable Knowledge Details Modal */}
        {selectedNode && (
          <KnowledgeDetailsModal
            item={selectedNode}
            onClose={() => setSelectedNode(null)}
          />
        )}

      </main>
    </div>
  );
};

export default Graph;
