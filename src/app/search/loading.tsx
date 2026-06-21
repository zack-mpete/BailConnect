import { Navbar } from "@/components/navbar";

export default function SearchLoading() {
  return (
    <main className="pb-24 md:pb-0">
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="h-8 w-56 rounded-xl bg-slate-100" />
        <div className="mt-3 h-5 w-96 max-w-full rounded-xl bg-slate-100" />
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <div className="h-80 rounded-2xl bg-white shadow-card" />
          <div className="h-80 rounded-2xl bg-white shadow-card" />
          <div className="h-80 rounded-2xl bg-white shadow-card" />
        </div>
      </section>
    </main>
  );
}
