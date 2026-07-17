import { DashboardShell } from "@/components/dashboard-shell";
import { Navbar } from "@/components/navbar";
import { getAppData } from "@/lib/data";

export default async function DashboardPage() {
  const data = await getAppData();

  return (
    <main className="pb-24 md:pb-0">
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 py-4 md:px-6">
        <DashboardShell data={data} />
      </section>
    </main>
  );
}
