"use client";
import { useEffect, useState } from "react";
import type { Batch, Book } from "@contracts/types";
import { getBatches, getBook, subscribeMarket } from "@/lib/api";
export interface MarketView { book: Book | null; batches: Batch[]; last: number|null; prev: number|null; tick:number; ready:boolean; connected:boolean; error:string|null }
const merge = (a:Batch[],b:Batch[])=>Array.from(new Map([...a,...b].map(x=>[x._id,x])).values()).filter(x=>Number.isFinite(x.clearing_price)).sort((x,y)=>Date.parse(x.t)-Date.parse(y.t)).slice(-200);
export function useMarket(id:string,enabled=true):MarketView {
 const [book,setBook]=useState<Book|null>(null),[batches,setBatches]=useState<Batch[]>([]),[tick,setTick]=useState(0),[ready,setReady]=useState(false),[connected,setConnected]=useState(false),[error,setError]=useState<string|null>(null);
 useEffect(()=>{if(!enabled)return;let alive=true;
 const load=async()=>{try{const [b,h]=await Promise.all([getBook(id),getBatches(id,120)]);if(!alive)return;setBook(old=>old&&Date.parse(old.next_batch_at)>Date.parse(b.next_batch_at)?old:b);setBatches(old=>merge(h,old));setReady(true);setError(null);}catch{if(alive)setError("Market data is unavailable. Reconnecting…");}};
 void load();const timer=setInterval(load,15000);
 const off=subscribeMarket(id,f=>{if(!alive)return;if(f.type==="book"){setBook(f.book);setReady(true);setError(null);}if(f.type==="batch"){setBatches(xs=>merge(xs,[f.batch]));setTick(t=>t+1);}},c=>{if(alive)setConnected(c);});
 return()=>{alive=false;clearInterval(timer);off();};},[id,enabled]);
 return {book,batches,last:batches.at(-1)?.clearing_price??book?.last??null,prev:batches.at(-2)?.clearing_price??null,tick,ready,connected,error};
}
export function useCountdown(iso:string|null|undefined) {const [s,setS]=useState(0);useEffect(()=>{if(!iso)return;const update=()=>setS(Math.max(0,(Date.parse(iso)-Date.now())/1000));update();const t=window.setInterval(update,100);return()=>clearInterval(t);},[iso]);return s;}
