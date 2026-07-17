import { Navbar } from "@/components/navbar";
import { OwnerHouseWorkspace } from "@/components/owner-house-workspace";
import { getAppData } from "@/lib/data";

export default async function DashboardHousePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getAppData();
  const house = data.houses.find(item => item.id === id) || null;

  const contracts = data.contracts.filter(contract => contract.houseId === id);
  const payments = data.payments.filter(payment => payment.houseId === id);

  return (
    <main className="pb-24 md:pb-0">
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <OwnerHouseWorkspace houseId={id} house={house} contracts={contracts} payments={payments} />
      </section>
    </main>
  );
}
