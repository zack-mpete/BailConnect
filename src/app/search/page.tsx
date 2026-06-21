import { Navbar } from "@/components/navbar";
import { SearchPanel } from "@/components/search-panel";
import { getAppData } from "@/lib/data";

export default async function SearchPage() {
  const data = await getAppData();
  return <main className="pb-24 md:pb-0"><Navbar/><section className="mx-auto max-w-7xl px-4 py-8 md:px-6"><h1 className="text-3xl font-black">Chercher une maison</h1><p className="mb-6 mt-2 text-muted">Filtre les biens par texte, type et budget.</p><SearchPanel houses={data.houses}/></section></main>;
}
