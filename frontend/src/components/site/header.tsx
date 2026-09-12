"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { ArrowUpRight, ChevronDown, Compass, LayoutGrid, MessageCircle, Search, ShieldCheck, Wallet, X } from "lucide-react";
import { demoUser, setDemoUser, IS_MOCK } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const subscribeIdentity = (listener: () => void) => { window.addEventListener("storage", listener); return () => window.removeEventListener("storage", listener); };

const nav = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/search", label: "Discover", icon: Compass },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
  { href: "/agent", label: "Bartr assistant", icon: MessageCircle },
];
export function Header() {
  const path = usePathname();
  const user = useSyncExternalStore(subscribeIdentity, demoUser, () => "");
  const [edit, setEdit] = useState(false);
  const [value, setValue] = useState("");
  const active = (href: string) => href === "/" ? path === "/" : path.startsWith(href);
  const title = path.startsWith("/company") ? "Market / Business profile" : path.startsWith("/surveillance") ? "Administration / Security" : nav.find(n => active(n.href))?.label ?? "Workspace";
  const account = <button type="button" aria-label="Change session identity" onClick={() => { setValue(user); setEdit(true); }} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-surface"><span className="flex size-8 items-center justify-center rounded-full bg-[#eae5f8] text-xs font-medium text-[#746295]">{(user || "B").slice(0,2).toUpperCase()}</span><span className="hidden sm:block max-w-32 truncate text-xs">{user || "Your account"}</span><ChevronDown size={13} className="text-muted-foreground" /></button>;
  return <>
    <aside className="app-sidebar">
      <Link href="/" className="mb-12 flex items-center gap-3 px-3 text-white"><BrandMark /><span className="text-[26px] tracking-[-.065em] font-medium">bartr<span className="text-[#a296ee]">.</span></span></Link>
      <p className="mb-3 px-3 font-mono text-[9px] uppercase tracking-[.16em] text-[#69728e]">Your workspace</p>
      <nav aria-label="Primary" className="space-y-1">{nav.map(n => <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined} className={`nav-item ${active(n.href) ? "active" : ""}`}><n.icon size={17} strokeWidth={1.7} />{n.label}</Link>)}</nav>
      <div className="mt-10 border-t border-[#2b3048] pt-6"><p className="mb-3 px-3 font-mono text-[9px] uppercase tracking-[.16em] text-[#69728e]">Exchange operations</p><Link href="/surveillance" aria-current={active("/surveillance") ? "page" : undefined} className={`nav-item ${active("/surveillance") ? "active" : ""}`}><ShieldCheck size={17} strokeWidth={1.7} />Security console</Link></div>
      <div className="mt-auto pt-12"><div className="rounded-xl border border-[#35384d] p-4"><span className="text-xl text-[#d6d0fc]">Small business.<br/>Big possibilities.</span><Link href="/search" className="mt-4 flex items-center justify-between text-[11px] text-[#aaa4cf]">Find your first stake <ArrowUpRight size={14} /></Link></div><div className="mt-5 flex items-center gap-2 px-3 text-[10px] text-[#828aa4]"><span className="size-1.5 rounded-full bg-[#65cba4]" />{IS_MOCK ? "Local exchange" : "Bartr exchange"}<span className="ml-auto text-[9px]">BTR / 01</span></div></div>
    </aside>
    <header className="app-content">
      <div className="app-topbar"><div className="flex items-center gap-3"><Link href="/" className="text-xl font-medium tracking-tight md:hidden">bartr.</Link><span className="hidden md:inline text-[12px] text-muted-foreground">Workspace <span className="mx-3 text-tint-300">/</span><span className="text-foreground">{title}</span></span></div><div className="flex items-center gap-5"><Link href="/search" className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground hover:text-accent"><Search size={15}/>Find a business</Link><span className="hidden sm:block h-5 w-px bg-line" />{account}</div></div>
      <nav aria-label="Mobile navigation" className="mobile-nav">{[...nav,{href:"/surveillance",label:"Security",icon:ShieldCheck}].map(n=><Link key={n.href} href={n.href} className={active(n.href)?"active":""}><n.icon size={14}/>{n.label}</Link>)}</nav>
    </header>
    {edit && <Dialog label="Session identity" onClose={() => setEdit(false)} className="!max-w-md"><div className="flex items-center justify-between"><h2 id="session-title" className="section-title">Session identity</h2><button aria-label="Close identity settings" onClick={()=>setEdit(false)}><X size={18}/></button></div><p className="my-4 text-sm secondary">Use the same phone number as iMessage to view that session’s orders and conversation. Accounts use the hackathon’s shared-identity mode.</p><form onSubmit={e=>{e.preventDefault(); if(value.trim()){setDemoUser(value.trim());window.location.reload();}}}><Input value={value} onChange={e=>setValue(e.target.value)} aria-label="Name, email, or phone number" maxLength={40} placeholder="Name, email, or +1 phone number"/><Button type="submit" variant="primary" className="mt-4 w-full" disabled={!value.trim()}>Open session</Button></form></Dialog>}
  </>;
}
export function BrandMark() { return <svg viewBox="0 0 32 32" width="29" height="29" fill="none" aria-hidden><path d="M5 6h14l8 10-8 10H5l8-10L5 6Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/><path d="M13 6 5 16l8 10M14 16h13" stroke="currentColor" strokeWidth="2.2"/></svg>; }
