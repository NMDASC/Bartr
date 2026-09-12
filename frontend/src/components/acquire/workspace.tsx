"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Download, FilePenLine, Save, Sparkles } from "lucide-react";
import type { Acquisition } from "@contracts/types";
import { getAcquisitionDraft, saveAcquisitionDraft, startAcquisition } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loi } from "./loi";

export function AcquisitionWorkspace({ companyId }: { companyId: string }) {
  const [acq, setAcq] = useState<Acquisition | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [editing, setEditing] = useState(false), [saved, setSaved] = useState(false);
  const [research, setResearch] = useState<Acquisition | null>(null);
  const dirty = useRef(false);
  useEffect(() => {
    let active = true;
    getAcquisitionDraft(companyId).then(a => { if (active) setAcq(a); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [companyId]);
  useEffect(() => {
    if (acq?.checklist_status !== "researching") return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const latest = await getAcquisitionDraft(companyId);
        if (!active || !latest || latest.checklist_status === "researching") return;
        if (dirty.current && latest.checklist_source === "grok") {
          setResearch(latest);
          setAcq(a => a ? { ...a, checklist_status: "kept" } : a);
        } else {
          setAcq(a => a ? { ...a, checklist: dirty.current ? a.checklist : latest.checklist, checklist_source: latest.checklist_source, checklist_status: latest.checklist_status } : a);
        }
      } catch { /* Keep the saved draft usable while research reconnects. */ }
    }, 3000);
    return () => { active = false; clearInterval(timer); };
  }, [companyId, acq?.checklist_status]);
  const generate = async () => {
    setBusy(true); setError("");
    try { setAcq(await startAcquisition(companyId)); } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };
  const save = async () => {
    if (!acq) return;
    setBusy(true);
    try { setAcq(await saveAcquisitionDraft(companyId, acq)); dirty.current = false; setSaved(true); setError(""); } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };
  const changed = () => { dirty.current = true; setSaved(false); };
  const download = () => {
    if (!acq) return;
    const url = URL.createObjectURL(new Blob([acq.loi_md], { type: "text/markdown" }));
    const a = document.createElement("a"); a.href = url; a.download = `Bartr-LOI-${companyId}.md`; a.click(); URL.revokeObjectURL(url);
  };
  return <>
    {error && <p className="mb-4 text-sm text-down" role="alert">{error}</p>}
    {loading ? <div className="dashboard-panel h-60 animate-pulse !bg-surface" /> : !acq ?
      <section className="dashboard-panel flex flex-col items-center p-12 text-center">
        <FilePenLine size={38} strokeWidth={1.2} className="mb-5 text-accent" /><h2 className="text-2xl">Start the conversation.</h2>
        <p className="mt-3 max-w-md text-sm leading-6 secondary">Prepare a letter of intent and a diligence checklist for this business.</p>
        <Button variant="primary" className="mt-6" onClick={generate} disabled={busy}>{busy ? "Preparing your draft…" : "Prepare acquisition draft"}<ArrowRight size={15} /></Button>
      </section> : <>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><span className="soft-tag">Draft · {acq.acquisition_id}</span><div className="flex flex-wrap gap-2">
          <Button onClick={() => setEditing(!editing)}><FilePenLine size={14} />{editing ? "Preview draft" : "Edit draft"}</Button>
          <Button onClick={download}><Download size={14} />Download</Button>
          <Button variant="primary" onClick={save} disabled={busy || !acq.loi_md.trim()}><Save size={14} />{busy ? "Saving…" : saved ? "Saved" : "Save changes"}</Button>
        </div></div>
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="dashboard-panel">{editing ? <textarea disabled={busy} aria-label="Letter of intent draft" className="min-h-[650px] w-full resize-y p-6 font-mono text-xs leading-6" value={acq.loi_md} onChange={e => { setAcq({ ...acq, loi_md: e.target.value }); changed(); }} /> : <Loi md={acq.loi_md} />}</section>
          <aside className="dashboard-panel">
            <div className="flex items-center justify-between border-b border-line p-5"><h2 className="section-title">Diligence checklist</h2><span className="text-xs secondary">{acq.checklist.filter(i => i.done).length}/{acq.checklist.length}</span></div>
            <div className="border-b border-hairline bg-surface px-5 py-3 text-[11px] leading-5 secondary" role="status">
              <span className="flex items-center gap-1.5"><Sparkles size={12} />{acq.checklist_source === "grok" ? "Researched with Grok" : "Category & location checklist"}</span>
              {acq.checklist_status === "researching" && <p className="mt-1">Researching local requirements in the background…</p>}
              {acq.checklist_status === "unavailable" && <p className="mt-1">Live research is unavailable. Your template is ready to use.</p>}
              {research && <><p className="mt-2">Research is ready. Applying it replaces this checklist and preserves your letter.</p><Button disabled={busy} className="mt-2" onClick={() => { setAcq({ ...acq, checklist: research.checklist, checklist_source: "grok", checklist_status: "ready" }); setResearch(null); changed(); }}>Use researched checklist</Button></>}
            </div>
            <div className="h-1 bg-surface"><div className="h-1 bg-accent transition-all" style={{ width: `${acq.checklist.filter(i => i.done).length / Math.max(1, acq.checklist.length) * 100}%` }} /></div>
            <ol className="divide-y divide-hairline">{acq.checklist.map((it, i) => <li key={i} className="p-4"><label className="flex items-start gap-3"><input type="checkbox" disabled={busy} className="mt-1 size-4 accent-[#635bff]" checked={it.done} onChange={e => { setAcq({ ...acq, checklist: acq.checklist.map((x, j) => j === i ? { ...x, done: e.target.checked } : x) }); changed(); }} /><span className="text-xs leading-5"><span className={it.done ? "text-muted-foreground line-through" : ""}>{it.item}</span><span className="mt-1 block text-[10px] secondary">{it.why}</span></span></label>{it.citation && <a href={it.citation.url} target="_blank" rel="noreferrer" className="ml-7 mt-2 inline-block text-[10px] text-accent">{it.citation.title} ↗</a>}</li>)}</ol>
          </aside>
        </div>
        {saved && <p role="status" className="mt-3 flex items-center gap-1 text-xs text-up"><Check size={13} />Your draft and checklist are saved.</p>}
      </>}
  </>;
}
