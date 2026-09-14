"use client";

import { useEffect, useMemo } from "react";
import { cn } from "cn";
import { Graph, layout } from "@dagrejs/dagre";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Maximize2, Play } from "lucide-react";
import type { Request, User } from "@/lib/engine/types";
import { isLate, stageOf } from "@/lib/engine/rules";
import { useEngine } from "@/lib/engine/store";
import { useT, useFmt, useLocale, fill } from "@/lib/i18n";
import { PersonAvatar, StageDot } from "@/components/common";

/**
 * Lines view: every request is a bubble node. A solid line goes from a bubble to
 * each sub-request it spawned; a dashed line comes back once that sub-request is
 * closed. Selecting a start node or a bubble lights up only its own chain.
 */

type RequestNodeData = {
  r: Request;
  owner: User | undefined;
  now: number;
  dim: boolean;
  selected: boolean;
  /** the node the story player is currently on */
  active: boolean;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
};
type StartNodeData = {
  creator: User | undefined;
  rootId: string;
  dim: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
};

type RequestNode = Node<RequestNodeData, "request">;
type StartNode = Node<StartNodeData, "start">;
type FlowNode = RequestNode | StartNode;

const NODE_W = 236;
const NODE_H = 84;
const START_W = 64;
const START_H = 64;

const STAGE_BORDER: Record<ReturnType<typeof stageOf>, string> = {
  you: "border-s-stage-you",
  waiting: "border-s-stage-wait",
  done: "border-s-stage-done",
  stopped: "border-s-stage-stop",
};

function useSides() {
  const locale = useLocale();
  // the canvas is forced LTR; "start" is the side the flow enters from
  return locale === "ar"
    ? { start: Position.Right, end: Position.Left }
    : { start: Position.Left, end: Position.Right };
}

function RequestNodeView({ data }: NodeProps<RequestNode>) {
  const { t, tl, dir } = useT();
  const { fmtDue } = useFmt();
  const sides = useSides();
  const { r, owner, now, dim, selected, active } = data;
  const late = isLate(r, now);
  return (
    <div
      dir={dir}
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl border border-s-4 bg-card px-3 py-2 shadow-sm transition-all",
        STAGE_BORDER[stageOf(r.status)],
        selected ? "ring-2 ring-primary/40 border-primary" : "hover:border-primary/40",
        active && "ring-4 ring-primary/50 scale-[1.03]",
        late && "bg-late-soft/40",
        dim && "opacity-25",
      )}
      style={{ width: NODE_W, height: NODE_H }}
    >
      <Handle id="in" type="target" position={sides.start} style={{ top: "35%" }} />
      <Handle id="go" type="source" position={sides.end} style={{ top: "35%" }} />
      <Handle id="ret" type="target" position={sides.end} style={{ top: "72%" }} />
      <Handle id="back" type="source" position={sides.start} style={{ top: "72%" }} />

      <div className="flex items-center gap-1.5">
        <StageDot stage={stageOf(r.status)} />
        <span className="font-mono text-[10px] text-muted-foreground">{r.ref}</span>
        {r.priority === "urgent" && <span className="rounded-full bg-urgent-soft px-1.5 text-[9px] font-semibold text-urgent">{t.flag.urgent}</span>}
        {late && <span className="rounded-full bg-late-soft px-1.5 text-[9px] font-semibold text-late">{t.flag.late}</span>}
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onOpen(r.id);
          }}
          className="ms-auto inline-flex size-5 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
          aria-label={t.flow.open}
        >
          <Maximize2 className="size-3" />
        </button>
      </div>
      <p className="line-clamp-2 text-[12px] leading-snug">{tl(r.text)}</p>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        {owner && (
          <>
            <PersonAvatar user={owner} size={16} />
            <span className="truncate">{tl(owner.name)}</span>
          </>
        )}
        <span className={cn("ms-auto whitespace-nowrap", late && "font-semibold text-late")}>{fmtDue(r.deadline, now)}</span>
      </div>
    </div>
  );
}

function StartNodeView({ data }: NodeProps<StartNode>) {
  const { t, tl, dir } = useT();
  const sides = useSides();
  const { creator, dim, selected } = data;
  return (
    <div dir={dir} className={cn("flex flex-col items-center gap-1 transition-opacity", dim && "opacity-25")} style={{ width: START_W }}>
      <button
        className={cn(
          "relative flex size-12 items-center justify-center rounded-full border-2 bg-card shadow-sm transition-colors",
          selected ? "border-primary ring-4 ring-primary/20" : "border-border hover:border-primary/50",
        )}
        aria-label={t.flow.start}
      >
        <Handle id="go" type="source" position={sides.end} />
        <Handle id="ret" type="target" position={sides.end} style={{ top: "72%" }} />
        {creator ? <PersonAvatar user={creator} size={34} /> : <Play className="size-4" />}
        <span className="absolute -bottom-1 -end-1 inline-flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Play className="size-2.5 rtl:-scale-x-100" fill="currentColor" />
        </span>
      </button>
      <span className="max-w-[80px] truncate text-[10px] text-muted-foreground">{creator ? tl(creator.name) : t.flow.start}</span>
    </div>
  );
}

const nodeTypes = { request: RequestNodeView, start: StartNodeView };

/* ---------- chain math ---------- */

export function chainOf(requests: Request[], id: string): Set<string> {
  const byId = new Map(requests.map((r) => [r.id, r]));
  const out = new Set<string>();
  // up to the root
  let cur: Request | undefined = byId.get(id);
  while (cur) {
    out.add(cur.id);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  // and everything below the selected node
  const stack = [id];
  while (stack.length) {
    const x = stack.pop()!;
    for (const r of requests) if (r.parentId === x && !out.has(r.id)) { out.add(r.id); stack.push(r.id); }
  }
  return out;
}

export function rootOf(requests: Request[], id: string): string {
  const byId = new Map(requests.map((r) => [r.id, r]));
  let cur = byId.get(id);
  while (cur?.parentId) cur = byId.get(cur.parentId);
  return cur?.id ?? id;
}

function layoutFlow(requests: Request[], rtl: boolean): Map<string, { x: number; y: number }> {
  const g = new Graph();
  g.setGraph({ rankdir: "LR", nodesep: 22, ranksep: 70, marginx: 10, marginy: 10 });
  g.setDefaultEdgeLabel(() => ({}));
  const ids = new Set(requests.map((r) => r.id));
  // a child whose parent is filtered out behaves as a root of its own
  const isRoot = (r: Request) => !r.parentId || !ids.has(r.parentId);
  for (const r of requests) {
    g.setNode(r.id, { width: NODE_W, height: NODE_H });
    if (isRoot(r)) g.setNode(`start-${r.id}`, { width: START_W, height: START_H + 16 });
  }
  for (const r of requests) {
    if (isRoot(r)) g.setEdge(`start-${r.id}`, r.id);
    else g.setEdge(r.parentId as string, r.id);
  }
  layout(g);
  let maxX = 0;
  for (const id of g.nodes()) maxX = Math.max(maxX, g.node(id)?.x ?? 0);
  const pos = new Map<string, { x: number; y: number }>();
  for (const id of g.nodes()) {
    const n = g.node(id);
    if (!n) continue;
    const x = rtl ? maxX - n.x : n.x;
    pos.set(id, { x: x - n.width / 2, y: n.y - n.height / 2 });
  }
  return pos;
}

/* ---------- canvas ---------- */

function Canvas({
  requests,
  now,
  selectedId,
  activeId,
  onSelect,
  onOpen,
}: {
  requests: Request[];
  now: number;
  selectedId: string | null;
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onOpen: (id: string) => void;
}) {
  const users = useEngine((s) => s.db.users);
  const { t, tl } = useT();
  const locale = useLocale();
  const { fitView } = useReactFlow();
  const initialized = useNodesInitialized();
  const rtl = locale === "ar";

  const { nodes, edges } = useMemo(() => {
    const userOf = (id: string) => users.find((u) => u.id === id);
    const pos = layoutFlow(requests, rtl);
    const lit = selectedId ? chainOf(requests, selectedId) : null;
    const litRoot = selectedId ? rootOf(requests, selectedId) : null;
    const dimNode = (id: string) => !!lit && !lit.has(id);

    const ids = new Set(requests.map((r) => r.id));
    const isRoot = (r: Request) => !r.parentId || !ids.has(r.parentId);
    const nodes: FlowNode[] = [];
    for (const r of requests) {
      if (isRoot(r)) {
        nodes.push({
          id: `start-${r.id}`,
          type: "start",
          position: pos.get(`start-${r.id}`) ?? { x: 0, y: 0 },
          width: START_W,
          height: START_H + 16,
          draggable: false,
          data: {
            creator: userOf(r.creatorId),
            rootId: r.id,
            dim: !!lit && litRoot !== r.id,
            selected: selectedId === r.id,
            onSelect: (id) => onSelect(selectedId === id ? null : id),
          },
        });
      }
      nodes.push({
        id: r.id,
        type: "request",
        position: pos.get(r.id) ?? { x: 0, y: 0 },
        width: NODE_W,
        height: NODE_H,
        draggable: false,
        data: {
          r,
          owner: userOf(r.ownerId),
          now,
          dim: dimNode(r.id),
          selected: selectedId === r.id,
          active: activeId === r.id,
          onSelect: (id) => onSelect(selectedId === id ? null : id),
          onOpen,
        },
      });
    }

    const edges: Edge[] = [];
    const goStroke = "var(--primary)";
    const idleStroke = "color-mix(in oklch, var(--foreground) 30%, transparent)";
    const backStroke = "var(--stage-done)";
    const labelStyle = { fontSize: 10, fill: "var(--muted-foreground)", fontFamily: "inherit" } as const;
    const labelBg = { fill: "var(--card)", fillOpacity: 0.95 } as const;
    for (const r of requests) {
      const source = isRoot(r) ? `start-${r.id}` : (r.parentId as string);
      const inChain = lit ? lit.has(r.id) && (isRoot(r) ? litRoot === r.id || lit.has(r.id) : lit.has(r.parentId as string)) : false;
      const dim = !!lit && !inChain;
      const returned = r.status === "closed" || r.status === "complete";
      const stopped = r.status === "cancelled" || r.status === "rejected";
      const owner = userOf(r.ownerId);
      edges.push({
        id: `go-${r.id}`,
        source,
        sourceHandle: "go",
        target: r.id,
        targetHandle: "in",
        type: "smoothstep",
        label: inChain && owner ? fill(t.flow.goLabel, { name: tl(owner.name) }) : undefined,
        labelStyle,
        labelBgStyle: labelBg,
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 6,
        markerEnd: { type: MarkerType.ArrowClosed, color: inChain ? goStroke : idleStroke, width: 14, height: 14 },
        style: { stroke: inChain ? goStroke : idleStroke, strokeWidth: inChain ? 2.5 : 1.5, opacity: dim ? 0.15 : 1 },
      });
      if (!stopped) {
        edges.push({
          id: `back-${r.id}`,
          source: r.id,
          sourceHandle: "back",
          target: source,
          targetHandle: "ret",
          type: "smoothstep",
          animated: returned && !dim,
          label: inChain ? (returned ? t.flow.backLabel : t.flow.pendingLabel) : undefined,
          labelStyle: { ...labelStyle, fill: returned ? "var(--stage-done)" : "var(--muted-foreground)" },
          labelBgStyle: labelBg,
          labelBgPadding: [4, 2],
          labelBgBorderRadius: 6,
          markerEnd: { type: MarkerType.ArrowClosed, color: returned ? backStroke : idleStroke, width: 12, height: 12 },
          style: {
            stroke: returned ? backStroke : idleStroke,
            strokeWidth: returned && inChain ? 2.5 : 1.5,
            strokeDasharray: returned ? "7 5" : "2 5",
            opacity: dim ? 0.15 : returned ? 1 : 0.7,
          },
        });
      }
    }
    return { nodes, edges };
  }, [requests, users, rtl, selectedId, activeId, now, onSelect, onOpen, t, tl]);

  useEffect(() => {
    if (!initialized) return;
    const id = setTimeout(() => fitView({ padding: 0.1, duration: 250, maxZoom: 1 }), 50);
    return () => clearTimeout(id);
  }, [nodes.length, locale, fitView, initialized]);

  // selecting a chain zooms to it; clearing the selection shows everything again
  useEffect(() => {
    if (!initialized) return;
    if (!selectedId) {
      fitView({ padding: 0.1, duration: 300, maxZoom: 1 });
      return;
    }
    const known = new Set(requests.map((r) => r.id));
    const ids = [...chainOf(requests, selectedId)].filter((id) => known.has(id));
    if (!ids.length) return;
    const rootId = rootOf(requests, selectedId);
    if (known.has(rootId)) ids.push(`start-${rootId}`);
    fitView({ nodes: ids.map((id) => ({ id })), padding: 0.35, duration: 300, maxZoom: 1.1 });
  }, [selectedId, requests, fitView, initialized]);

  return (
    <div dir="ltr" className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.1, maxZoom: 1 }}
        onInit={(inst) => inst.fitView({ padding: 0.1, maxZoom: 1 })}
        onNodeClick={(_, node) => {
          const id = node.id.startsWith("start-") ? node.id.slice(6) : node.id;
          onSelect(selectedId === id ? null : id);
        }}
        onPaneClick={() => onSelect(null)}
        minZoom={0.25}
        maxZoom={1.6}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        className="h-full w-full"
      >
        <Background gap={24} size={1} />
        <Controls showInteractive={false} position={rtl ? "bottom-right" : "bottom-left"} />
      </ReactFlow>
    </div>
  );
}

export function FlowCanvas(props: {
  requests: Request[];
  now: number;
  selectedId: string | null;
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
