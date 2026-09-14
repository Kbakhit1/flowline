"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "cn";
import { Graph, layout } from "@dagrejs/dagre";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { User } from "@/lib/engine/types";
import { useEngine } from "@/lib/engine/store";
import { useT, useLocale } from "@/lib/i18n";
import { PersonAvatar } from "@/components/common";

export interface PersonStats {
  open: number;
  late: number;
}

type PersonNodeData = {
  user: User;
  stats: PersonStats;
  hasChildren: boolean;
  collapsed: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
};

type PersonNode = Node<PersonNodeData, "person">;

const NODE_W = 208;
const NODE_H = 66;

function PersonNodeView({ data }: NodeProps<PersonNode>) {
  const { tl, dir } = useT();
  const { user, stats, hasChildren, collapsed, selected } = data;
  return (
    <div
      dir={dir}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border bg-card px-2.5 py-2 shadow-sm transition-colors",
        selected ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/40",
      )}
      style={{ width: NODE_W, height: NODE_H }}
    >
      <Handle type="target" position={Position.Top} />
      <PersonAvatar user={user} size={34} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold leading-tight">{tl(user.name)}</div>
        <div className="truncate text-[10.5px] text-muted-foreground">{tl(user.title)}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] tabular">
          <span className={cn("rounded-full px-1.5", stats.open ? "bg-stage-you-soft text-stage-you" : "bg-muted text-muted-foreground")}>{stats.open}</span>
          {stats.late > 0 && <span className="rounded-full bg-late-soft px-1.5 font-semibold text-late">{stats.late}</span>}
        </div>
      </div>
      {hasChildren && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onToggle(user.id);
          }}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-foreground"
          aria-label={collapsed ? "expand" : "collapse"}
        >
          {collapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
        </button>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { person: PersonNodeView };

function layoutTree(users: User[], visible: Set<string>, rtl: boolean): Map<string, { x: number; y: number }> {
  const g = new Graph();
  g.setGraph({ rankdir: "TB", nodesep: 28, ranksep: 64 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const u of users) if (visible.has(u.id)) g.setNode(u.id, { width: NODE_W, height: NODE_H });
  for (const u of users) if (u.managerId && visible.has(u.id) && visible.has(u.managerId)) g.setEdge(u.managerId, u.id);
  layout(g);
  const pos = new Map<string, { x: number; y: number }>();
  let maxX = 0;
  for (const id of g.nodes()) {
    const n = g.node(id);
    if (!n) continue;
    maxX = Math.max(maxX, n.x);
  }
  for (const id of g.nodes()) {
    const n = g.node(id);
    if (!n) continue;
    const x = rtl ? maxX - n.x : n.x;
    pos.set(id, { x: x - NODE_W / 2, y: n.y - NODE_H / 2 });
  }
  return pos;
}

function TreeCanvas({ stats, selectedId, onSelect }: { stats: Map<string, PersonStats>; selectedId: string | null; onSelect: (id: string | null) => void }) {
  const allUsers = useEngine((s) => s.db.users);
  const users = useMemo(() => allUsers.filter((u) => u.active), [allUsers]);
  const locale = useLocale();
  const { fitView } = useReactFlow();
  const initialized = useNodesInitialized();
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const { nodes, edges } = useMemo(() => {
    const byId = new Map(users.map((u) => [u.id, u]));
    const hidden = (u: User): boolean => {
      let cur = u.managerId;
      while (cur) {
        if (collapsed.has(cur)) return true;
        cur = byId.get(cur)?.managerId ?? null;
      }
      return false;
    };
    const visible = new Set(users.filter((u) => !hidden(u)).map((u) => u.id));
    const pos = layoutTree(users, visible, locale === "ar");
    const nodes: PersonNode[] = users
      .filter((u) => visible.has(u.id))
      .map((u) => ({
        id: u.id,
        type: "person",
        position: pos.get(u.id) ?? { x: 0, y: 0 },
        width: NODE_W,
        height: NODE_H,
        draggable: false,
        data: {
          user: u,
          stats: stats.get(u.id) ?? { open: 0, late: 0 },
          hasChildren: users.some((x) => x.managerId === u.id),
          collapsed: collapsed.has(u.id),
          selected: selectedId === u.id,
          onToggle: toggle,
          onSelect: (id) => onSelect(selectedId === id ? null : id),
        },
      }));
    const edges: Edge[] = users
      .filter((u) => u.managerId && visible.has(u.id) && visible.has(u.managerId))
      .map((u) => ({ id: `${u.managerId}-${u.id}`, source: u.managerId!, target: u.id, type: "smoothstep" }));
    return { nodes, edges };
  }, [users, collapsed, locale, stats, selectedId, toggle, onSelect]);

  useEffect(() => {
    if (!initialized) return;
    // let React Flow measure the new nodes before fitting
    const id = setTimeout(() => fitView({ padding: 0.12, duration: 250, maxZoom: 1 }), 50);
    return () => clearTimeout(id);
  }, [nodes.length, locale, fitView, initialized]);

  // React Flow's pan/zoom math assumes LTR; the tree itself is mirrored in layoutTree
  return (
    <div dir="ltr" className="h-full w-full">
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
      onInit={(inst) => inst.fitView({ padding: 0.12, maxZoom: 1 })}
      onNodeClick={(_, node) => onSelect(selectedId === node.id ? null : node.id)}
      onPaneClick={() => onSelect(null)}
      minZoom={0.3}
      maxZoom={1.6}
      nodesConnectable={false}
      elementsSelectable={false}
      proOptions={{ hideAttribution: true }}
      className="h-full w-full"
    >
      <Background gap={24} size={1} />
      <Controls showInteractive={false} position={locale === "ar" ? "bottom-right" : "bottom-left"} />
    </ReactFlow>
    </div>
  );
}

export function OrgTree(props: { stats: Map<string, PersonStats>; selectedId: string | null; onSelect: (id: string | null) => void }) {
  return (
    <ReactFlowProvider>
      <TreeCanvas {...props} />
    </ReactFlowProvider>
  );
}
