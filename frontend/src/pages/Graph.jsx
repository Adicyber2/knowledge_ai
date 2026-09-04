import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Sidebar from "../components/Sidebar";
import { getKnowledgeGraph, getKnowledge, rebuildKnowledgeGraph } from "../service/knowledgeService";
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


// ---- Domain → Color palette (used for node fill color only, no hub nodes) ----
const DOMAIN_COLORS = {
  "Frontend":   { fill: "#0f2a47", stroke: "#3b82f6", text: "#93c5fd", dot: "#3b82f6" },
  "Backend":    { fill: "#0f2f1f", stroke: "#22c55e", text: "#86efac", dot: "#22c55e" },
  "AI & ML":    { fill: "#1e1043", stroke: "#a855f7", text: "#d8b4fe", dot: "#a855f7" },
  "Database":   { fill: "#2a1d0a", stroke: "#f59e0b", text: "#fde68a", dot: "#f59e0b" },
  "DevOps":     { fill: "#0c2133", stroke: "#06b6d4", text: "#a5f3fc", dot: "#06b6d4" },
  "Security":   { fill: "#2a0a0a", stroke: "#ef4444", text: "#fca5a5", dot: "#ef4444" },
  "Mobile":     { fill: "#1a1a0f", stroke: "#eab308", text: "#fef08a", dot: "#eab308" },
  "General":    { fill: "#141a28", stroke: "#64748b", text: "#94a3b8", dot: "#64748b" },
};

const getDomainColors = (domain) =>
  DOMAIN_COLORS[domain] || DOMAIN_COLORS["General"];


// ---- Node Styling — color by domain ----
const getNodeStyle = (node, isSelected, isHovered) => {
  const colors = getDomainColors(node.domain);
  return {
    r: 24,
    fill: isSelected ? "#2d2060" : isHovered ? colors.fill.replace("0f", "1a") : colors.fill,
    stroke: isSelected ? "#f8fafc" : isHovered ? "#ffffff" : colors.stroke,
    strokeWidth: isSelected ? 3 : isHovered ? 2.5 : 1.8,
    textColor: colors.text,
    fontWeight: "500",
    fontSize: "9.5",
  };
};


// ---- Edge Styling ----
const getEdgeStyle = (relationship, isHovered) => {
  switch (relationship) {
    case "EXTENDS":
      return {
        stroke: isHovered ? "#f0abfc" : "#a855f7",
        strokeWidth: isHovered ? 2.8 : 2,
        strokeDasharray: "none",
        opacity: isHovered ? 1 : 0.8,
      };
    case "PREREQUISITE_OF":
    case "DEPENDS_ON":
      return {
        stroke: isHovered ? "#fca5a5" : "#ef4444",
        strokeWidth: isHovered ? 2.8 : 1.8,
        strokeDasharray: "7 3",
        opacity: isHovered ? 1 : 0.75,
      };
    case "PART_OF":
    case "EXPLAINS":
      return {
        stroke: isHovered ? "#86efac" : "#22c55e",
        strokeWidth: isHovered ? 2.8 : 1.8,
        strokeDasharray: "none",
        opacity: isHovered ? 1 : 0.75,
      };
    case "USES":
    case "ABOUT":
    case "BUILT_WITH":
    case "USED_FOR":
      return {
        stroke: isHovered ? "#7dd3fc" : "#38bdf8",
        strokeWidth: isHovered ? 2.8 : 1.8,
        strokeDasharray: "4 3",
        opacity: isHovered ? 1 : 0.7,
      };
    case "SIMILAR_TO":
    case "RELATED_TO":
      return {
        stroke: isHovered ? "#fde68a" : "#f59e0b",
        strokeWidth: isHovered ? 2.5 : 1.6,
        strokeDasharray: "5 4",
        opacity: isHovered ? 1 : 0.65,
      };
    case "SEMANTICALLY_RELATED":
      return {
        stroke: isHovered ? "#c4b5fd" : "#6d5db8",
        strokeWidth: isHovered ? 2.5 : 1.4,
        strokeDasharray: "3 4",
        opacity: isHovered ? 1 : 0.55,
      };
    default:
      return {
        stroke: isHovered ? "#94a3b8" : "#334155",
        strokeWidth: isHovered ? 2 : 1.2,
        strokeDasharray: "none",
        opacity: isHovered ? 0.9 : 0.5,
      };
  }
};


// ---- Short edge label for hover display ----
const getEdgeLabel = (relationship) => {
  switch (relationship) {
    case "EXTENDS": return "extends";
    case "PREREQUISITE_OF": return "prereq";
    case "DEPENDS_ON": return "depends on";
    case "PART_OF": return "part of";
    case "EXPLAINS": return "explains";
    case "USES": return "uses";
    case "ABOUT": return "about";
    case "BUILT_WITH": return "built with";
    case "USED_FOR": return "used for";
    case "SIMILAR_TO": return "similar to";
    case "RELATED_TO": return "related";
    case "SEMANTICALLY_RELATED": return "similar tags";
    default: return "";
  }
};


// ---- Cluster-aware Force Layout ----
// Nodes in the same domain are initially placed near each other.
// Force repulsion + spring attraction creates natural clusters.
const computeClusterLayout = (nodes, edges, width, height) => {
  const positions = {};

  if (nodes.length === 0) return positions;

  // Group nodes by domain
  const domainGroups = {};
  nodes.forEach((n) => {
    const d = n.domain || "General";
    if (!domainGroups[d]) domainGroups[d] = [];
    domainGroups[d].push(n);
  });

  const domains = Object.keys(domainGroups);
  const numDomains = domains.length;

  // Place domain clusters in a circle around the canvas center
  const cx = width / 2;
  const cy = height / 2;
  const clusterRadius = Math.min(width, height) * 0.3;

  domains.forEach((domain, di) => {
    const angle = (2 * Math.PI * di) / numDomains - Math.PI / 2;
    const clusterCx = cx + clusterRadius * Math.cos(angle);
    const clusterCy = cy + clusterRadius * Math.sin(angle);

    const group = domainGroups[domain];
    const groupRadius = 60 + group.length * 15;

    group.forEach((n, ni) => {
      const innerAngle = (2 * Math.PI * ni) / group.length;
      const r = group.length === 1 ? 0 : groupRadius * 0.5;
      positions[n.id] = {
        x: clusterCx + r * Math.cos(innerAngle) + (Math.random() - 0.5) * 30,
        y: clusterCy + r * Math.sin(innerAngle) + (Math.random() - 0.5) * 30,
        vx: 0,
        vy: 0,
      };
    });
  });

  // Force-directed simulation
  const k = Math.sqrt((width * height) / Math.max(nodes.length, 1)) * 0.65;
  const REPULSION = k * k;
  const MIN_DIST = 50;

  for (let iter = 0; iter < 150; iter++) {
    const damping = Math.max(0.1, 1 - iter / 150);

    // Repulsion between all node pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = positions[nodes[i].id];
        const b = positions[nodes[j].id];
        if (!a || !b) continue;

        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), MIN_DIST);
        const force = REPULSION / (dist * dist) * 40;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    // Spring attraction along edges
    edges.forEach((e) => {
      const a = positions[e.from];
      const b = positions[e.to];
      if (!a || !b) return;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const idealDist = 140;
      const force = (dist - idealDist) * 0.04;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    });

    // Gentle same-domain attraction (creates cluster cohesion)
    domains.forEach((domain) => {
      const group = domainGroups[domain];
      if (group.length < 2) return;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = positions[group[i].id];
          const b = positions[group[j].id];
          if (!a || !b) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          // Only attract if they're far apart — let edges handle close nodes
          if (dist > 200) {
            const force = (dist - 200) * 0.008;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            a.vx += fx;
            a.vy += fy;
            b.vx -= fx;
            b.vy -= fy;
          }
        }
      }
    });

    // Apply velocities
    nodes.forEach((n) => {
      const p = positions[n.id];
      if (!p) return;
      p.x += p.vx * 0.4 * damping;
      p.y += p.vy * 0.4 * damping;
      p.vx *= 0.72;
      p.vy *= 0.72;
      p.x = Math.max(60, Math.min(width - 60, p.x));
      p.y = Math.max(60, Math.min(height - 60, p.y));
    });
  }

  return positions;
};


// ---- Graph API call with rebuild trigger ----
const rebuildGraphAPI = async () => {
  const response = await fetch("/api/knowledge/graph/rebuild", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
    },
  });
  return response.json();
};


const Graph = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [graphData, setGraphData] = useState({ nodes: [], edges: [], stats: null });
  const [positions, setPositions] = useState({});
  const [allKnowledge, setAllKnowledge] = useState([]);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildMsg, setRebuildMsg] = useState("");

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

  const storageKey = user?.id ? `kv_graph_pos_v2_${user.id}` : "kv_graph_pos_v2";


  // Save node positions to LocalStorage
  const persistPositions = useCallback((newPositions) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(newPositions));
    } catch (e) {
      console.warn("Could not save node positions:", e);
    }
  }, [storageKey]);


  // Load graph data
  const loadGraph = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getKnowledgeGraph();
      const nodes = data.nodes || [];
      const edges = data.edges || [];
      const stats = data.stats || null;

      console.log("GRAPH DATA RECEIVED");
      console.log("NODES:", nodes.length);
      console.log("EDGES:", edges.length);

      setGraphData({ nodes, edges, stats });

      // Also fetch full knowledge for Related Knowledge in details modal
      try {
        const knowledgeItems = await getKnowledge();
        setAllKnowledge(knowledgeItems || []);
      } catch {
        // non-fatal
      }

      if (nodes.length > 0) {
        // Cluster-aware layout
        const calculatedPos = computeClusterLayout(nodes, edges, W, H);

        // Restore persisted positions (user may have manually arranged nodes)
        let savedPos = {};
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) savedPos = JSON.parse(raw);
        } catch {
          // ignore
        }

        // Merge: use saved positions for nodes we already have saved
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


  // Handle rebuild graph button with polling
  const handleRebuildGraph = async () => {
    console.log("\n========================================");
    console.log("GRAPH REBUILD START");
    try {
      setRebuilding(true);
      setRebuildMsg("");

      console.log("GRAPH REBUILD REQUEST SENT");
      const result = await rebuildKnowledgeGraph();
      console.log("GRAPH REBUILD RESPONSE:", result);

      setRebuildMsg(result.message || "Graph rebuild started in background.");

      // Poll until relationships are populated
      let pollCount = 0;
      const maxPolls = 10; // 10 x 2.5s = 25s

      const pollInterval = setInterval(async () => {
        pollCount++;
        console.log(`[GRAPH POLL] Fetching rebuilt graph data... (${pollCount}/${maxPolls})`);

        try {
          const freshData = await getKnowledgeGraph();
          const nodes = freshData?.nodes || [];
          const edges = freshData?.edges || [];

          console.log("GRAPH DATA RECEIVED");
          console.log("NODES:", nodes.length);
          console.log("EDGES:", edges.length);

          setGraphData({
            nodes,
            edges,
            stats: freshData?.stats || null,
          });

          if (nodes.length > 0) {
            const calculatedPos = computeClusterLayout(nodes, edges, W, H);
            setPositions(calculatedPos);
          }

          if (edges.length > 0 || pollCount >= maxPolls) {
            console.log("GRAPH REBUILD COMPLETE");
            console.log("========================================\n");
            clearInterval(pollInterval);
            setRebuilding(false);
          }
        } catch (pollErr) {
          console.warn("[GRAPH POLL] Poll error:", pollErr.message);
        }
      }, 2500);

    } catch (err) {
      console.error("GRAPH REBUILD FAILED:", err);
      setRebuildMsg("Rebuild failed. Please try again.");
      setRebuilding(false);
    }
  };


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
  const handleZoomOut = () => setZoom((z) => Math.max(0.4, z - 0.2));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    // Clear saved positions to recalculate layout
    try { localStorage.removeItem(storageKey); } catch {}
    loadGraph();
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.min(2.5, Math.max(0.4, z + delta)));
  };


  // Canvas Pan vs Node Drag
  const handleMouseDownCanvas = (e) => {
    if (e.target.tagName === "svg" || e.target.classList.contains("graph-bg")) {
      setIsCanvasDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseDownNode = (e, nodeId) => {
    e.stopPropagation();
    setDraggedNodeId(nodeId);
    const p = positions[nodeId] || { x: 0, y: 0 };
    setDragStart({
      x: (e.clientX - pan.x) / zoom - p.x,
      y: (e.clientY - pan.y) / zoom - p.y,
    });
  };

  const handleMouseMove = (e) => {
    if (draggedNodeId) {
      const newX = (e.clientX - pan.x) / zoom - dragStart.x;
      const newY = (e.clientY - pan.y) / zoom - dragStart.y;
      const clampedX = Math.max(30, Math.min(W - 30, newX));
      const clampedY = Math.max(30, Math.min(H - 30, newY));

      setPositions((prev) => {
        const next = {
          ...prev,
          [draggedNodeId]: { ...(prev[draggedNodeId] || {}), x: clampedX, y: clampedY },
        };
        persistPositions(next);
        return next;
      });
    } else if (isCanvasDragging) {
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


  // Compute stats for display
  const graphStats = useMemo(() => {
    const stats = graphData.stats;
    const knowledgeNodes = graphData.nodes.filter((n) => n.type === "knowledge");
    const aiEdges = graphData.edges.filter((e) => e.relationship !== "SEMANTICALLY_RELATED");
    const jaccardEdges = graphData.edges.filter((e) => e.relationship === "SEMANTICALLY_RELATED");
    const domains = stats?.domains || [...new Set(knowledgeNodes.map((n) => n.domain).filter(Boolean))];
    return {
      items: knowledgeNodes.length,
      aiEdges: aiEdges.length,
      jaccardEdges: jaccardEdges.length,
      totalEdges: graphData.edges.length,
      domains: domains.length,
      domainNames: Array.isArray(domains) ? domains : [],
    };
  }, [graphData]);


  return (
    <div className="vault-layout">
      <Sidebar />

      <main className="vault-main">

        {/* Header */}
        <header className="knowledge-header">
          <div>
            <span className="topbar-label">YOUR SECOND BRAIN</span>
            <h1>Knowledge Relationship Graph</h1>
            <p>
              Drag nodes to arrange clusters. Click any node for details.
              {graphStats.aiEdges > 0 && (
                <span style={{ color: "#a78bfa", marginLeft: "8px" }}>
                  ✦ {graphStats.aiEdges} AI-determined relationship{graphStats.aiEdges !== 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={handleRebuildGraph}
              disabled={rebuilding}
              style={{
                padding: "8px 14px",
                borderRadius: "10px",
                border: "1px solid rgba(139,92,246,0.4)",
                background: rebuilding
                  ? "rgba(139,92,246,0.2)"
                  : "rgba(139,92,246,0.08)",
                color: "#c4b5fd",
                fontSize: "12px",
                fontWeight: 600,
                cursor: rebuilding ? "not-allowed" : "pointer",
                transition: "0.15s",
              }}
              title="Clear existing relationships and rebuild semantic graph from scratch using AI"
            >
              {rebuilding ? "⟳ Rebuilding..." : "⟳ Rebuild Graph"}
            </button>
          </div>
        </header>


        {/* Rebuild status message */}
        {rebuildMsg && (
          <div style={{
            margin: "0 0 12px",
            padding: "10px 16px",
            border: "1px solid rgba(139,92,246,0.3)",
            borderRadius: "10px",
            background: "rgba(139,92,246,0.08)",
            color: "#c4b5fd",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <span>✦ {rebuildMsg}</span>
            <button
              onClick={() => setRebuildMsg("")}
              style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "16px" }}
            >
              ×
            </button>
          </div>
        )}


        {/* Domain Color Legend */}
        <div className="graph-legend" style={{ flexWrap: "wrap", gap: "8px" }}>
          {Object.entries(DOMAIN_COLORS)
            .filter(([d]) => d !== "General")
            .map(([domain, colors]) => (
              <span key={domain} className="graph-legend-item" style={{ color: colors.text, fontSize: "11px" }}>
                <span style={{
                  display: "inline-block",
                  width: "10px", height: "10px",
                  borderRadius: "50%",
                  background: colors.dot,
                  marginRight: "5px",
                  verticalAlign: "middle",
                }} />
                {domain}
              </span>
            ))
          }
          <span style={{ borderLeft: "1px solid #1f2330", margin: "0 4px" }} />
          <span className="graph-legend-item" style={{ color: "#a855f7", fontSize: "11px" }}>
            <span style={{ display: "inline-block", width: "18px", height: "2px", background: "#a855f7", marginRight: "5px", verticalAlign: "middle" }} />
            EXTENDS
          </span>
          <span className="graph-legend-item" style={{ color: "#22c55e", fontSize: "11px" }}>
            <span style={{ display: "inline-block", width: "18px", height: "2px", background: "#22c55e", marginRight: "5px", verticalAlign: "middle" }} />
            EXPLAINS
          </span>
          <span className="graph-legend-item" style={{ color: "#38bdf8", fontSize: "11px" }}>
            <span style={{ display: "inline-block", width: "18px", height: "2px", background: "#38bdf8", borderTop: "2px dashed #38bdf8", marginRight: "5px", verticalAlign: "middle" }} />
            USES
          </span>
          <span className="graph-legend-item" style={{ color: "#ef4444", fontSize: "11px" }}>
            <span style={{ display: "inline-block", width: "18px", height: "2px", borderTop: "2px dashed #ef4444", marginRight: "5px", verticalAlign: "middle" }} />
            PREREQ
          </span>
          <span className="graph-legend-item" style={{ color: "#6d5db8", fontSize: "11px" }}>
            <span style={{ display: "inline-block", width: "18px", height: "2px", borderTop: "2px dashed #6d5db8", marginRight: "5px", verticalAlign: "middle" }} />
            SIMILAR TAGS
          </span>
        </div>


        {/* Loading */}
        {loading && (
          <div className="graph-status">
            <div className="graph-spinner" />
            Generating semantic knowledge graph...
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
              <button onClick={handleResetZoom} title="Reset Layout">⊙</button>
            </div>


            {/* Edge Hover Relationship Tooltip */}
            {hoveredEdge && (
              <div className="edge-tooltip">
                <span className="edge-tooltip-type">{hoveredEdge.relationship?.replace(/_/g, " ")}</span>
                {hoveredEdge.confidence && (
                  <span style={{ color: "#94a3b8", fontSize: "10px" }}>
                    {Math.round(hoveredEdge.confidence * 100)}% confidence
                  </span>
                )}
                {hoveredEdge.reason && (
                  <span style={{ color: "#64748b", fontSize: "10px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {hoveredEdge.reason}
                  </span>
                )}
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
                {/* Arrow markers for each edge color */}
                {["#a855f7", "#22c55e", "#38bdf8", "#ef4444", "#f59e0b", "#6d5db8"].map((color, i) => (
                  <marker
                    key={i}
                    id={`arrow-${color.replace("#", "")}`}
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L0,6 L6,3 z" fill={color} opacity="0.7" />
                  </marker>
                ))}
              </defs>

              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>

                {/* Edges — rendered before nodes so nodes appear on top */}
                {graphData.edges.map((e, i) => {
                  const a = positions[e.from];
                  const b = positions[e.to];
                  if (!a || !b) return null;

                  const isEdgeHovered = hoveredEdge === e;
                  const isDimmed =
                    activeConnectedIds &&
                    (!activeConnectedIds.has(e.from) || !activeConnectedIds.has(e.to));

                  const style = getEdgeStyle(e.relationship, isEdgeHovered);
                  const edgeLabel = getEdgeLabel(e.relationship);

                  // Shorten line to not overlap with node circles (r=24)
                  const dx = b.x - a.x;
                  const dy = b.y - a.y;
                  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                  const nodeR = 24;
                  const x1 = a.x + (dx / dist) * nodeR;
                  const y1 = a.y + (dy / dist) * nodeR;
                  const x2 = b.x - (dx / dist) * nodeR;
                  const y2 = b.y - (dy / dist) * nodeR;

                  const mx = (a.x + b.x) / 2;
                  const my = (a.y + b.y) / 2;

                  return (
                    <g key={i}>
                      <line
                        x1={x1} y1={y1}
                        x2={x2} y2={y2}
                        stroke={style.stroke}
                        strokeWidth={style.strokeWidth}
                        strokeDasharray={style.strokeDasharray}
                        opacity={isDimmed ? 0.1 : style.opacity}
                      />
                      {/* Wider invisible line for hover target */}
                      <line
                        x1={x1} y1={y1}
                        x2={x2} y2={y2}
                        stroke="transparent"
                        strokeWidth="14"
                        style={{ cursor: "pointer" }}
                        onMouseEnter={() => setHoveredEdge(e)}
                        onMouseLeave={() => setHoveredEdge(null)}
                      />
                      {/* Hover label near midpoint */}
                      {isEdgeHovered && edgeLabel && (
                        <text
                          x={mx}
                          y={my - 8}
                          textAnchor="middle"
                          fontSize="8.5"
                          fill={style.stroke}
                          fontWeight="700"
                          style={{ pointerEvents: "none" }}
                          paintOrder="stroke"
                          stroke="#060810"
                          strokeWidth="3"
                        >
                          {edgeLabel}
                        </text>
                      )}
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

                  const style = getNodeStyle(node, isSelected, isHovered);
                  const colors = getDomainColors(node.domain);

                  // Truncate label: max 22 chars
                  const shortLabel = node.label?.length > 22
                    ? node.label.substring(0, 21) + "…"
                    : node.label;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${pos.x},${pos.y})`}
                      onMouseDown={(e) => handleMouseDownNode(e, node.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNode(node);
                      }}
                      onMouseEnter={() => setHoveredNode(node)}
                      onMouseLeave={() => setHoveredNode(null)}
                      className={`graph-node ${draggedNodeId === node.id ? "dragging" : ""}`}
                      opacity={isDimmed ? 0.18 : 1}
                    >
                      {/* Outer glow ring when selected or hovered */}
                      {(isSelected || isHovered) && (
                        <circle
                          r={style.r + 5}
                          fill="none"
                          stroke={colors.stroke}
                          strokeWidth="1.5"
                          opacity="0.25"
                        />
                      )}

                      {/* Node circle */}
                      <circle
                        r={style.r}
                        fill={style.fill}
                        stroke={style.stroke}
                        strokeWidth={style.strokeWidth}
                      />

                      {/* Source type icon inside node */}
                      <text
                        y="1"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="11"
                        fill={colors.text}
                        pointerEvents="none"
                      >
                        {getSourceIcon(node.sourceType)}
                      </text>

                      {/* AI processed dot indicator */}
                      {node.aiProcessed && (
                        <circle
                          cx={style.r - 4}
                          cy={-(style.r - 4)}
                          r="4"
                          fill="#a855f7"
                          stroke="#060810"
                          strokeWidth="1"
                        />
                      )}

                      {/* Node Label */}
                      <text
                        y={style.r + 13}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={style.fontSize}
                        fontWeight={style.fontWeight}
                        fill={style.textColor}
                        className="graph-label"
                        paintOrder="stroke"
                        stroke="#060810"
                        strokeWidth="2.5"
                      >
                        {shortLabel}
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
            <span>{graphStats.items} Knowledge Items</span>
            <span>·</span>
            <span>{graphStats.domains} Domain{graphStats.domains !== 1 ? "s" : ""}{graphStats.domainNames.length > 0 ? ` (${graphStats.domainNames.join(", ")})` : ""}</span>
            <span>·</span>
            <span style={{ color: "#a78bfa" }}>{graphStats.aiEdges} AI Relationships</span>
            {graphStats.jaccardEdges > 0 && (
              <>
                <span>·</span>
                <span style={{ color: "#6d5db8" }}>{graphStats.jaccardEdges} Tag Similarities</span>
              </>
            )}
            {graphStats.totalEdges === 0 && (
              <span style={{ color: "#64748b" }}>
                — No relationships yet. Save more content or click Rebuild Graph.
              </span>
            )}
          </div>
        )}


        {/* Knowledge Details Modal */}
        {selectedNode && (
          <KnowledgeDetailsModal
            item={{
              ...selectedNode,
              _id: selectedNode.knowledgeId || selectedNode.id?.replace(/^k-/, ""),
            }}
            onClose={() => setSelectedNode(null)}
            allKnowledge={allKnowledge}
            onOpenRelated={(relatedItem) => {
              const node = graphData.nodes.find(
                (n) =>
                  n.knowledgeId === relatedItem._id?.toString() ||
                  n.id === `k-${relatedItem._id}`
              );
              setSelectedNode(
                node || { ...relatedItem, _id: relatedItem._id, label: relatedItem.title, type: "knowledge" }
              );
            }}
          />
        )}

      </main>
    </div>
  );
};

export default Graph;
