"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "cn";
import { ArrowLeft, Hash, MessageSquare, SendHorizontal, Sparkles } from "lucide-react";
import { useEngine, selectMe } from "@/lib/engine/store";
import { useNow } from "@/lib/engine/hooks";
import { useT, useFmt, fill } from "@/lib/i18n";
import { PersonAvatar, StageDot } from "@/components/common";
import { stageOf } from "@/lib/engine/rules";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Sel = { kind: "channel" } | { kind: "thread"; requestId: string };

export default function ChatPage() {
  const { t, tl } = useT();
  const { fmtNum, fmtRelative } = useFmt();
  const now = useNow();
  const me = useEngine(selectMe);
  const users = useEngine((s) => s.db.users);
  const projectId = useEngine((s) => s.session.projectId);
  const project = useEngine((s) => s.db.projects.find((p) => p.id === projectId));
  const requests = useEngine((s) => s.db.requests);
  const messages = useEngine((s) => s.db.messages);
  const chatEnabled = useEngine((s) => s.db.company.settings.projectChatEnabled);
  const sendMessage = useEngine((s) => s.sendMessage);
  const setComposer = useEngine((s) => s.setComposer);
  const openRequest = useEngine((s) => s.openRequest);

  const [sel, setSel] = useState<Sel | null>(null);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const threads = useMemo(() => {
    const ids = new Set(messages.filter((m) => m.projectId === projectId && m.requestId).map((m) => m.requestId!));
    return requests
      .filter((r) => ids.has(r.id))
      .map((r) => ({ r, last: messages.filter((m) => m.requestId === r.id).sort((a, b) => b.at.localeCompare(a.at))[0] }))
      .sort((a, b) => b.last.at.localeCompare(a.last.at));
  }, [messages, requests, projectId]);

  const active: Sel | null = sel ?? (chatEnabled ? { kind: "channel" } : threads[0] ? { kind: "thread", requestId: threads[0].r.id } : null);
  const list = useMemo(() => {
    if (!active) return [];
    return messages
      .filter((m) => m.projectId === projectId && (active.kind === "channel" ? m.requestId === null : m.requestId === active.requestId))
      .sort((a, b) => a.at.localeCompare(b.at));
  }, [messages, projectId, active]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [list.length, active]);

  const send = () => {
    if (!text.trim() || !active) return;
    sendMessage(projectId, active.kind === "channel" ? null : active.requestId, text);
    setText("");
  };

  const convert = (mid: string, body: string) => {
    setComposer({
      projectId,
      text: body,
      recipientId: null,
      typeId: "t_task",
      priority: "normal",
      deadline: null,
      fields: {},
      parentId: null,
      lineId: null,
      returnToId: null,
      fromMessageId: mid,
    });
  };

  const showList = !sel; // mobile: list first, then the conversation
  const activeRequest = active?.kind === "thread" ? requests.find((r) => r.id === active.requestId) : null;

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem-4rem)] w-full max-w-4xl md:grid md:h-[calc(100dvh-3.5rem)] md:grid-cols-[260px_1fr]">
      {/* conversations */}
      <aside className={cn("min-h-0 flex-1 flex-col overflow-y-auto border-e thin-scroll md:flex md:flex-none", showList ? "flex" : "hidden")}>
        <div className="px-3 pt-3 pb-2">
          <h1 className="text-lg font-bold">{t.chat.title}</h1>
          <p className="text-[11px] text-muted-foreground">{project && tl(project.name)}</p>
        </div>
        <div className="flex flex-col gap-0.5 px-2">
          {chatEnabled && (
            <ConvRow active={active?.kind === "channel"} onClick={() => setSel({ kind: "channel" })} icon={<Hash className="size-4" />} title={t.chat.channel} sub={fill(t.chat.members, { n: fmtNum(project?.memberIds.length ?? 0) })} />
          )}
          {!chatEnabled && <p className="rounded-lg bg-muted/60 px-2.5 py-2 text-[11px] text-muted-foreground">{t.chat.disabled}</p>}
          <div className="px-2 pt-3 pb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{t.chat.threads}</div>
          {threads.map(({ r, last }) => (
            <ConvRow
              key={r.id}
              active={active?.kind === "thread" && active.requestId === r.id}
              onClick={() => setSel({ kind: "thread", requestId: r.id })}
              icon={<StageDot stage={stageOf(r.status)} />}
              title={tl(r.text)}
              sub={`${r.ref} · ${fmtRelative(last.at, now)}`}
            />
          ))}
        </div>
      </aside>

      {/* conversation */}
      <section className={cn("min-h-0 min-w-0 flex-1 flex-col md:flex", showList ? "hidden" : "flex")}>
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setSel(null)} aria-label={t.common.back}>
            <ArrowLeft className="size-4 rtl:-scale-x-100" />
          </Button>
          {active?.kind === "channel" ? (
            <>
              <Hash className="size-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{t.chat.channel}</span>
            </>
          ) : activeRequest ? (
            <button onClick={() => openRequest(activeRequest.id)} className="flex min-w-0 items-center gap-2 text-start">
              <StageDot stage={stageOf(activeRequest.status)} />
              <span className="truncate text-sm font-semibold">{tl(activeRequest.text)}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{activeRequest.ref}</span>
            </button>
          ) : (
            <span className="text-sm text-muted-foreground">{t.chat.empty}</span>
          )}
        </div>

        <div ref={listRef} data-tour="chat-list" className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 py-3 thin-scroll">
          {list.length === 0 && <p className="text-xs text-muted-foreground">{t.chat.empty}</p>}
          {list.map((m) => {
            const s = users.find((u) => u.id === m.senderId);
            const mine = m.senderId === me.id;
            const converted = m.convertedToRequestId ? requests.find((r) => r.id === m.convertedToRequestId) : null;
            return (
              <div key={m.id} className={cn("group flex max-w-[85%] gap-2", mine && "flex-row-reverse self-end")}>
                {s && <PersonAvatar user={s} size={26} className="mt-1" />}
                <div className="min-w-0">
                  <div className={cn("rounded-2xl px-3 py-2 text-sm", mine ? "bg-primary text-primary-foreground" : "bg-card ring-1 ring-foreground/10")}>
                    {!mine && s && <div className="mb-0.5 text-[10px] font-semibold text-muted-foreground">{tl(s.name)}</div>}
                    <div>{tl(m.text)}</div>
                    <div className={cn("mt-0.5 text-[10px]", mine ? "opacity-70" : "text-muted-foreground")}>{fmtRelative(m.at, now)}</div>
                  </div>
                  {active?.kind === "channel" && (
                    <div className={cn("mt-1 flex", mine && "justify-end")}>
                      {converted ? (
                        <button onClick={() => openRequest(converted.id)} className="inline-flex items-center gap-1 rounded-full bg-stage-you-soft px-2 py-0.5 text-[10px] font-semibold text-stage-you">
                          <MessageSquare className="size-3" /> {t.chat.converted} · {converted.ref}
                        </button>
                      ) : (
                        <button
                          onClick={() => convert(m.id, tl(m.text))}
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground opacity-70 transition-opacity hover:text-primary group-hover:opacity-100"
                        >
                          <Sparkles className="size-3" /> {t.chat.convert}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {active && (
          <form
            className="flex items-end gap-1.5 border-t px-3 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t.chat.placeholder}
              rows={1}
              className="min-h-9 resize-none py-1.5 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button size="icon" type="submit" disabled={!text.trim()} aria-label={t.inbox.send}>
              <SendHorizontal className="size-4 rtl:-scale-x-100" />
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}

function ConvRow({ active, onClick, icon, title, sub }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <button onClick={onClick} className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start transition-colors", active ? "bg-accent" : "hover:bg-muted/60")}>
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>
      </span>
    </button>
  );
}
