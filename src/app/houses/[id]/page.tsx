import { Navbar } from "@/components/navbar";
import { PublicHouseDetail } from "@/components/public-house-detail";
import { getHouse } from "@/lib/data";

export default async function HouseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const house = await getHouse(id);

  return (
    <main className="pb-24 md:pb-0"><Navbar />
      <section className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <PublicHouseDetail houseId={id} initialHouse={house} />
      </section>
    </main>
  );
}
