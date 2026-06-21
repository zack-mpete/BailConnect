import { Navbar } from "@/components/navbar";

export default function ContractsLoading() {
  return (
    <main className="pb-24 md:pb-0">
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="h-8 w-72 rounded-xl bg-slate-100" />
        <div className="mt-3 h-5 w-96 max-w-full rounded-xl bg-slate-100" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="h-[620px] rounded-2xl bg-white shadow-card" />
          <div className="h-[520px] rounded-2xl bg-white shadow-card" />
        </div>
      </section>
    </main>
  );
}
