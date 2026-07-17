import { Navbar } from "@/components/navbar";
import { Button, Card } from "@/components/ui";
import { routes } from "@/lib/routes";

export default function NotFoundPage() {
  return (
    <main className="pb-24 md:pb-0">
      <Navbar />
      <section className="mx-auto max-w-2xl px-4 py-16 md:px-6">
        <Card className="space-y-4 text-center">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-brand-600">Page introuvable</p>
          <h1 className="text-3xl font-black">Ce lien n’existe plus</h1>
          <p className="text-muted">Reviens au tableau de bord ou consulte les annonces disponibles.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button href={routes.dashboard} className="bg-ink text-white">Tableau de bord</Button>
            <Button href={routes.search} className="bg-brand-50 text-brand-700">Chercher un bien</Button>
          </div>
        </Card>
      </section>
    </main>
  );
}
