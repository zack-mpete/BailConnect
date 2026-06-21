import { Navbar } from "@/components/navbar";

export default function DashboardLoading() {
  return (
    <main className="pb-24 md:pb-0">
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="h-8 w-48 rounded-xl bg-slate-100" />
        <div className="mt-3 h-5 w-80 max-w-full rounded-xl bg-slate-100" />
        <div className="mt-6 rounded-2xl bg-ink p-5">
          <div className="h-5 w-40 rounded-xl bg-white/10" />
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="h-20 rounded-2xl bg-white/10" />
            <div className="h-20 rounded-2xl bg-white/10" />
            <div className="h-20 rounded-2xl bg-white/10" />
          </div>
        </div>
      </section>
    </main>
  );
}
