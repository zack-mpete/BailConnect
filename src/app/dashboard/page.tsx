import { DashboardShell } from "@/components/dashboard-shell";
import { Navbar } from "@/components/navbar";
import { getAppData } from "@/lib/data";

export default async function DashboardPage() {
  const data = await getAppData();

  return (
    <main className="pb-24 md:pb-0">
      <Navbar />
      <section className="mx-auto max-w-7xl px-2 py-3 min-[360px]:px-3 md:px-6 md:py-4">
        <DashboardShell data={data} />
      </section>
    </main>
  );
}
