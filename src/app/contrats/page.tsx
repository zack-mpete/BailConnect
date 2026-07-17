import { ContractWorkspace } from "@/components/contract-workspace";
import { Navbar } from "@/components/navbar";
import { RoleGate } from "@/components/role-gate";
import { getAppData } from "@/lib/data";

export default async function ContractsPage({ searchParams }: { searchParams: Promise<{ house?: string }> }) {
  const { house: houseId } = await searchParams;
  const data = await getAppData();
  const house = houseId
    ? data.houses.find(item => item.id === houseId) || null
    : data.houses[0] || null;
  const contract = house ? data.contracts.find(item => item.houseId === house.id) || null : null;

  return (
    <main className="pb-16">
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <RoleGate allow={["admin", "bailleur", "agence", "locataire"]} fallbackText="Connecte-toi pour preparer ou consulter un contrat.">
          <div className="mb-5">
            <h1 className="text-3xl font-black">Contrat de bail</h1>
            <p className="mt-2 text-sm text-muted">Verifie le bail, valide l'accord et garde la conversation au meme endroit.</p>
          </div>
          <ContractWorkspace requestedHouseId={houseId || null} house={house} contract={contract} />
        </RoleGate>
      </section>
    </main>
  );
}
