import { SearchBar } from "@/components/search/search-bar";
import { Results } from "@/components/search/results";
import { Catalog } from "@/components/search/catalog";
import { CityShortcuts } from "@/components/search/city-shortcuts";
export default async function SearchPage({searchParams}:{searchParams:Promise<{q?:string}>}) {
 const {q=""}=await searchParams;
 return <div className="page-wrap fade-up"><div className="mb-7"><div className="eyebrow mb-2">Discover the overlooked</div><h1 className="page-title">Great businesses. Closer than you think.</h1><p className="page-subtitle">Find your next opportunity, from the corner store to the whole neighborhood.</p></div><div className="dashboard-panel mb-7 p-5 sm:p-6"><SearchBar key={q} initial={q}/><CityShortcuts/></div>{q?<Results key={q} q={q}/>:<Catalog/>}</div>;
}
