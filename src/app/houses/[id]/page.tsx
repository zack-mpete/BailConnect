import { Navbar } from "@/components/navbar";
import { Badge, Card } from "@/components/ui";
import { getHouse } from "@/lib/data";
import { money } from "@/lib/utils";
import { MapPin } from "lucide-react";
import { notFound } from "next/navigation";

export default async function HouseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const house = await getHouse(id);
  if (!house) return notFound();

  return (
    <main className="pb-24 md:pb-0"><Navbar />
      <section className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <img src={house.image} alt={house.title} className="h-[470px] w-full rounded-[2rem] object-cover shadow-soft" />
          <Card className="space-y-5">
            <Badge tone={house.status === "Disponible" ? "success" : "warn"}>{house.status}</Badge>
            <h1 className="text-3xl font-black">{house.title}</h1>
            <p className="flex items-center gap-2 text-muted"><MapPin size={18}/>{house.commune}, {house.city}</p>
            <p className="text-3xl font-black text-brand-700">{money(house.price)} <span className="text-sm text-muted">/ mois</span></p>
            <p className="leading-7 text-slate-600">{house.description}</p>
            <div className="flex flex-wrap gap-2">{house.features.map(f => <span key={f} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold">{f}</span>)}</div>
            <div className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-900"><b>Vision future :</b> une visite 3D sera ajoutée plus tard à partir de modèles .glb ou scans optimisés.</div>
          </Card>
        </div>
      </section>
    </main>
  );
}
