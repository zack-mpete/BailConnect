import { Navbar } from "@/components/navbar";
import { SearchPanel } from "@/components/search-panel";
import { getAppData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  const data = await getAppData();
  return <main className="pb-24 md:pb-0"><Navbar/><section className="mx-auto max-w-7xl px-3 py-6 min-[360px]:px-4 md:px-6 md:py-8"><h1 className="text-2xl font-black min-[390px]:text-3xl">Chercher une maison</h1><p className="mb-6 mt-2 text-muted">Filtre les biens par texte, type et budget.</p><SearchPanel houses={data.houses}/></section></main>;
}
