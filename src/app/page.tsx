import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { HouseCard } from "@/components/house-card";
import { getAppData } from "@/lib/data";
import { WebPushButton } from "@/components/web-push-button";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getAppData();
  return (
    <main className="pb-24 md:pb-0">
      <Navbar />
      <Hero />
      <section className="mx-auto max-w-7xl px-3 py-6 min-[360px]:px-4 md:px-6 md:py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black md:text-3xl">Fil immobilier</h2>
            <p className="mt-2 text-sm text-muted">Nouvelles maisons publiées par les bailleurs et agences.</p>
          <div className="mt-3"><WebPushButton /></div>
          </div>
        </div>
        {data.houses.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {data.houses.map(house => <HouseCard key={house.id} house={house} />)}
          </div>
        ) : (
          <div className="surface-card text-center">
            <h3 className="text-lg font-black">Aucune maison disponible</h3>
            <p className="mt-2 text-sm text-muted">Les annonces validées et non archivées apparaîtront ici.</p>
          </div>
        )}
      </section>
    </main>
  );
}
