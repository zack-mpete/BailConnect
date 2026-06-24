import { ContractWorkspace } from "@/components/contract-workspace";
import { Navbar } from "@/components/navbar";
import { RoleGate } from "@/components/role-gate";
import { getAppData } from "@/lib/data";

export default async function ContractsPage({ searchParams }: { searchParams: Promise<{ house?: string }> }) {
  const { house: houseId } = await searchParams;
  const data = await getAppData();
  const house = data.houses.find(h => h.id === houseId) || data.houses[0] || null;
  const contract = house ? data.contracts.find(item => item.houseId === house.id) || null : null;

  return (
    <main className="pb-24 md:pb-0">
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <RoleGate allow={["admin", "bailleur", "agence", "locataire"]} fallbackText="Connecte-toi pour préparer ou consulter un contrat.">
          <div className="mb-6">
            <h1 className="text-3xl font-black">Contrat de bail</h1>
            <p className="mt-2 text-muted">Contrat généré depuis les informations enregistrées dans la plateforme.</p>
          </div>
          <ContractWorkspace house={house} contract={contract} />
        </RoleGate>
      </section>
    </main>
  );
}
