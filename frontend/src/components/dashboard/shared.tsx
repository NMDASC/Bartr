import { ArrowUpRight, CarFront, CircleDollarSign, Coffee, Factory, Shirt, Store, Wrench } from "lucide-react";
import Link from "next/link";
import type { CompanyCard, PersonalOrder } from "@contracts/types";
import { px, usd } from "@/lib/format";
export const categoryName = (s: string) => s === "hvac" ? "HVAC" : s.replaceAll("_", " ").replace(/\b\w/g, c=>c.toUpperCase());
export function BusinessAvatar({category,large=false}:{category:string;large?:boolean}) {
  const Icon = category.includes("laund") ? Shirt : category.includes("wash") || category.includes("auto") ? CarFront : category.includes("machine") ? Factory : category.includes("restaurant") || category.includes("cafe") ? Coffee : category.includes("hvac") ? Wrench : Store;
  const colors = category.includes("laund") ? ["#eeebff","#8670c7"] : category.includes("wash") ? ["#e4f3ef","#5c9d87"] : category.includes("machine") ? ["#f9ede4","#bc916b"] : ["#e9eef8","#7b91b8"];
  return <span className="business-icon" style={{background:colors[0],color:colors[1],...(large?{width:54,height:54,borderRadius:15}:{})}}><Icon size={large?26:20} strokeWidth={1.5}/></span>;
}
export function MarketCard({company}:{company:CompanyCard}) {
  return <Link href={`/company/${company._id}`} className="dashboard-panel group block p-5 transition-colors hover:border-accent/40"><div className="mb-5 flex items-center justify-between"><BusinessAvatar category={company.category}/><span className="soft-tag">{categoryName(company.category)}</span></div><h3 className="text-[15px] leading-5 tracking-[-.02em]">{company.name}</h3><p className="mt-1 text-xs secondary">{company.city}, {company.state}</p><div className="mt-6 flex items-end justify-between border-t border-hairline pt-4"><div><p className="eyebrow text-[9px]">Estimated value</p><p className="mt-1 text-[22px] tracking-[-.04em]">{company.v0_per_share!==null?usd(company.v0_per_share*10000,{compact:true}):"Pending"}</p></div><span className="flex size-7 items-center justify-center rounded-full border border-line text-muted-foreground group-hover:border-accent group-hover:text-accent"><ArrowUpRight size={14}/></span></div><div className="mt-3 flex gap-4 font-mono text-[10px]">{company.listed===false?<span className="text-accent">Make an offer · Not listed</span>:<><span className="text-up">Bid {px(company.bid)}</span><span className="text-down">Ask {px(company.ask)}</span></>}<span className="ml-auto text-muted-foreground" title="Valuation confidence">{company.confidence!==null?`${Math.round(company.confidence*100)}% conf.`:""}</span></div></Link>;
}
export function EmptyState({title,description,href,label}:{title:string;description:string;href?:string;label?:string}) {
  return <div className="flex flex-col items-center justify-center px-6 py-9 text-center"><span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-surface text-tint-400"><CircleDollarSign size={20} strokeWidth={1.5}/></span><h3 className="text-sm tracking-normal">{title}</h3><p className="mt-1 max-w-xs text-xs secondary">{description}</p>{href&&<Link href={href} className="mt-4 flex items-center gap-1.5 text-xs text-accent">{label??"Explore businesses"}<ArrowUpRight size={13}/></Link>}</div>;
}
const orderLabel = (order: PersonalOrder) => order.status === "open" ? "Pending" : order.status === "partial" ? "Partially filled" : categoryName(order.status);
const orderTone = (order: PersonalOrder) => order.status === "filled" ? "bg-up/10 text-up" : order.status === "cancelled" ? "bg-surface text-muted-foreground" : "bg-accent/10 text-accent";

export function OrdersTable({ orders, cancel, busy, compact = false }: {
  orders: PersonalOrder[];
  cancel: (id: string) => void;
  busy: string | null;
  compact?: boolean;
}) {
  const action = (order: PersonalOrder) => (order.status === "open" || order.status === "partial") &&
    <button aria-label={`Cancel ${order.side} order for ${order.company_name}`} onClick={() => cancel(order._id)} disabled={busy === order._id}
      className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-down/5 hover:text-down disabled:opacity-50">
      {busy === order._id ? "Cancelling…" : "Cancel"}
    </button>;
  return <>
    <div className="divide-y divide-hairline sm:hidden">{orders.map(order => <article key={order._id} className="p-4">
      <div className="flex items-center justify-between gap-3"><Link href={`/company/${order.market_id}`} className="flex items-center gap-3 text-xs"><BusinessAvatar category={order.category}/>{order.company_name}</Link><span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${orderTone(order)}`}>{orderLabel(order)}</span></div>
      <div className="my-4 flex items-center justify-between text-xs"><span><span className={order.side === "buy" ? "text-up" : "text-down"}>{categoryName(order.side)}</span> {order.qty} shares</span><span className="font-mono">${px(order.limit_price)} limit</span></div>
      <div className="flex items-center justify-between gap-2"><div><span className="text-[10px] secondary">{order.filled_qty} / {order.qty} filled</span><p className="mt-1 select-all font-mono text-[9px] secondary">{order._id}</p></div>{action(order)}</div>
    </article>)}</div>
    <div className="hidden overflow-x-auto sm:block"><table className="data-table"><thead><tr>{!compact && <th>Business</th>}<th>Order</th><th>Limit / share</th><th>Filled</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
      <tbody>{orders.map(order => <tr key={order._id}>
        {!compact && <td><Link className="flex items-center gap-3 hover:text-accent" href={`/company/${order.market_id}`}><BusinessAvatar category={order.category}/><span className="min-w-[125px] max-w-[190px] leading-5">{order.company_name}</span></Link></td>}
        <td title={order._id}><span className={order.side === "buy" ? "text-up" : "text-down"}>{categoryName(order.side)}</span><span className="ml-2 font-mono">{order.qty}</span></td>
        <td className="font-mono">${px(order.limit_price)}</td><td className="whitespace-nowrap font-mono">{order.filled_qty} / {order.qty}</td>
        <td><span className={`whitespace-nowrap rounded-md px-2 py-1 text-[10px] ${orderTone(order)}`}>{orderLabel(order)}</span></td><td>{action(order)}</td>
      </tr>)}</tbody></table></div>
  </>;
}
export function Neighborhood() {
 return <svg viewBox="0 0 420 255" fill="none" className="neighborhood" aria-hidden>
   <ellipse cx="252" cy="235" rx="165" ry="16" fill="#d7d0ee"/>
   <path d="M42 197 225 105l180 88-183 93L42 197Z" fill="#e0d9f3"/>
   <path d="m161 164 94-47 73 35-95 49-72-37Z" fill="#aea0ce"/>
   <path d="M161 89 233 124v77l-72-37V89Z" fill="#b6aad2"/><path d="m233 124 95-48v76l-95 49v-77Z" fill="#cdc3e5"/>
   <path d="m151 87 96-47 93 39-106 54-83-46Z" fill="#8e7cab"/><path d="m151 80 96-47 93 39-106 54-83-46Z" fill="#d6cbe8"/>
   <path d="M253 138v37l21-11v-37l-21 9Zm32-16v36l22-11v-36l-22 11Z" fill="#f4f0ff"/>
   <path d="m173 110 45 23v12l-45-23v-12Zm0 29 15 8v33l-15-8v-33Zm23 12 22 11v33l-22-11v-33Z" fill="#e6ddf4"/>
   <path d="m73 136 64-32 67 31-68 35-63-34Z" fill="#b8acda"/><path d="M73 136v63l64 33v-62l-64-34Z" fill="#ddd5eb"/><path d="m137 170 67-35v64l-67 33v-62Z" fill="#afa0cf"/>
   <path d="M75 148v18l62 32v-18l-62-32Z" fill="#8b79ad"/><path d="m137 180 65-33v18l-65 33v-18Z" fill="#7c699f"/>
   <path d="m85 174 13 7v26l-13-7v-26Zm26 13 14 7v26l-14-7v-26Z" fill="#f6f2fb"/><path d="m151 192 32-17v30l-32 16v-29Z" fill="#e9e0f5"/>
   <path d="m91 132 44-22 47 22-47 23-44-23Z" fill="#eae2f5"/>
   <path d="m266 159 64-33 57 29-66 33-55-29Z" fill="#bccabf"/><path d="M266 159v43l55 28v-42l-55-29Z" fill="#e0e8da"/><path d="m321 188 66-33v43l-66 32v-42Z" fill="#b5c5b3"/>
   <path d="m264 157 63-42 62 38-68 35-57-31Z" fill="#a3b89e"/><path d="m277 186 13 7v21l-13-7v-21Zm23 12 12 6v21l-12-6v-21Z" fill="#f4f7ed"/>
   <path d="M351 207v-34" stroke="#899d81" strokeWidth="4"/><ellipse cx="351" cy="162" rx="16" ry="25" fill="#a8c0a4"/>
   <path d="M52 210v-35" stroke="#9b8fb4" strokeWidth="4"/><ellipse cx="52" cy="162" rx="19" ry="28" fill="#c4b6dc"/>
   <path d="M224 245v-31" stroke="#8f9f83" strokeWidth="3"/><ellipse cx="224" cy="204" rx="12" ry="19" fill="#b3c5a5"/>
   <path d="m184 229 18-9m62 15 17-8M59 224l15-8" stroke="#f4f0fc" strokeWidth="3"/>
 </svg>;
}
