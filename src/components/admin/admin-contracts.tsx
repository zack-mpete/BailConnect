"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  FileSignature,
  Search,
  UsersRound
} from "lucide-react";
import { Badge } from "@/components/ui";
import { houseContractsHref } from "@/lib/house-links";
import { money } from "@/lib/utils";
import type { Contract } from "@/types";
import { CONTRACT_STATUS_LABELS } from "@/lib/statuses";

type ContractFilter = "all" | "signed" | "pending" | "termination" | "closed";

const filters: Array<{ id: ContractFilter; label: string }> = [
  { id: "all", label: "Tous" },
  { id: "signed", label: "Signés" },
  { id: "pending", label: "À valider" },
  { id: "termination", label: "Résiliations" },
  { id: "closed", label: "Terminés" }
];

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" as const } }
};

function matchesFilter(contract: Contract, filter: ContractFilter) {
  if (filter === "signed") return contract.status === "signe";
  if (filter === "pending") return ["brouillon", "pret_a_signer"].includes(contract.status);
  if (filter === "termination") return contract.status === "resiliation_programmee";
  if (filter === "closed") return ["resilie", "annule"].includes(contract.status);
  return true;
}

function agreementProgress(contract: Contract) {
  return Number(Boolean(contract.agreedByOwnerAt)) + Number(Boolean(contract.agreedByTenantAt));
}

function AgreementState({ contract }: { contract: Contract }) {
  const progress = agreementProgress(contract);

  return (
    <div className="min-w-[150px]">
      <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
        <span className={contract.agreedByOwnerAt ? "text-emerald-700" : "text-slate-400"}>
          Bailleur
        </span>
        <span className={contract.agreedByTenantAt ? "text-emerald-700" : "text-slate-400"}>
          Locataire
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1">
        <span className={`h-1.5 rounded-full ${progress >= 1 ? "bg-emerald-500" : "bg-slate-200"}`} />
        <span className={`h-1.5 rounded-full ${progress === 2 ? "bg-emerald-500" : "bg-slate-200"}`} />
      </div>
      <p className="mt-1.5 text-[10px] font-semibold text-muted">{progress}/2 accord(s)</p>
    </div>
  );
}

function StatusPill({ contract }: { contract: Contract }) {
  const styles = {
    brouillon: "bg-slate-100 text-slate-700",
    pret_a_signer: "bg-cyan-100 text-cyan-800",
    signe: "bg-emerald-100 text-emerald-800",
    annule: "bg-rose-100 text-rose-700",
    resiliation_programmee: "bg-amber-100 text-amber-800",
    resilie: "bg-violet-100 text-violet-700"
  };

  return (
    <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black ${styles[contract.status]}`}>
      {CONTRACT_STATUS_LABELS[contract.status]}
    </span>
  );
}

export function AdminContracts({
  contracts,
  onFinalize
}: {
  contracts: Contract[];
  onFinalize: (contract: Contract) => void;
}) {
  const [filter, setFilter] = useState<ContractFilter>("all");
  const [query, setQuery] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  const visibleContracts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr");
    return contracts.filter(contract => {
      const searchable = `${contract.seal} ${contract.owner} ${contract.tenant}`.toLocaleLowerCase("fr");
      return matchesFilter(contract, filter) && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [contracts, filter, query]);

  const signedCount = contracts.filter(contract => contract.status === "signe").length;
  const pendingCount = contracts.filter(contract => ["brouillon", "pret_a_signer"].includes(contract.status)).length;
  const terminationCount = contracts.filter(contract => contract.status === "resiliation_programmee").length;

  function contractStatus(contract: Contract) {
    const canFinalize = contract.status === "resiliation_programmee"
      && contract.terminationEffectiveDate
      && contract.terminationEffectiveDate <= today;

    return (
      <div className="space-y-2">
        <StatusPill contract={contract} />
        {contract.status === "resiliation_programmee" && contract.terminationEffectiveDate && (
          <p className="text-[11px] font-bold text-amber-800">Effet le {contract.terminationEffectiveDate}</p>
        )}
        {canFinalize && (
          <button
            type="button"
            onClick={() => onFinalize(contract)}
            className="rounded-full bg-rose-600 px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-rose-700"
          >
            Finaliser
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-violet-100/70 bg-white shadow-card">
      <div className="bg-gradient-to-r from-slate-950 via-violet-950 to-cyan-950 p-5 text-white">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-violet-200">
              <FileSignature size={19} />
              <p className="text-xs font-black uppercase tracking-[0.16em]">Registre contractuel</p>
            </div>
            <h2 className="mt-2 text-2xl font-black">Historique des contrats</h2>
            <p className="mt-1 text-sm text-white/60">Accords, loyers et résiliations dans une vue unifiée.</p>
          </div>
          <Badge>{contracts.length} contrats</Badge>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            { label: "Signés", value: signedCount, Icon: CheckCircle2, style: "text-emerald-200" },
            { label: "À valider", value: pendingCount, Icon: UsersRound, style: "text-cyan-200" },
            { label: "Résiliations", value: terminationCount, Icon: CalendarDays, style: "text-amber-200" }
          ].map(({ label, value, Icon, style }) => (
            <div key={label} className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
              <div className={`flex items-center gap-2 text-xs font-bold ${style}`}><Icon size={15} /> {label}</div>
              <p className="mt-2 text-2xl font-black">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-b border-slate-100 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <label className="relative block w-full xl:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              className="form-control py-2.5 pl-10 text-sm"
              placeholder="Rechercher un sceau ou une partie..."
              aria-label="Rechercher dans les contrats"
            />
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-soft">
            {filters.map(item => (
              <button
                key={item.id}
                type="button"
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
                className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-black transition ${
                  filter === item.id
                    ? "bg-violet-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-violet-50 hover:text-violet-700"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs font-semibold text-muted">{visibleContracts.length} résultat(s)</p>
      </div>

      <motion.div
        key={`mobile-${filter}-${query}`}
        variants={listVariants}
        initial="hidden"
        animate="visible"
        className="grid max-h-[calc(100vh-320px)] gap-3 overflow-y-auto p-4 scrollbar-soft md:hidden"
      >
        {visibleContracts.map(contract => (
          <motion.article
            variants={itemVariants}
            key={contract.id}
            className="min-w-0 rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-black">{contract.seal}</p>
                <p className="mt-1 text-xs text-muted">{contract.startDate} · {contract.duration}</p>
              </div>
              {contractStatus(contract)}
            </div>
            <div className="mt-4 rounded-xl bg-white p-3">
              <p className="truncate text-sm font-bold">{contract.owner}</p>
              <p className="mt-1 truncate text-sm text-muted">{contract.tenant}</p>
            </div>
            <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-3">
              <AgreementState contract={contract} />
              <p className="text-right text-lg font-black text-slate-950">{money(contract.rent)}</p>
            </div>
            <Link
              href={houseContractsHref(contract.houseId)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-violet-100 px-4 py-3 text-xs font-black text-violet-700"
            >
              Ouvrir le contrat <ArrowUpRight size={15} />
            </Link>
          </motion.article>
        ))}
      </motion.div>

      <div className="hidden max-h-[calc(100vh-320px)] overflow-auto scrollbar-soft md:block">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50/95 text-[11px] uppercase tracking-wider text-muted backdrop-blur">
            <tr>
              <th className="px-5 py-3">Contrat</th>
              <th className="px-4 py-3">Parties</th>
              <th className="px-4 py-3">Période</th>
              <th className="px-4 py-3">Loyer</th>
              <th className="px-4 py-3">Accords</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <motion.tbody
            key={`desktop-${filter}-${query}`}
            variants={listVariants}
            initial="hidden"
            animate="visible"
          >
            {visibleContracts.map(contract => (
              <motion.tr
                variants={itemVariants}
                key={contract.id}
                className="group border-t border-slate-100 align-middle transition-colors hover:bg-violet-50/40"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                      <FileSignature size={17} />
                    </span>
                    <div className="min-w-0">
                      <p className="max-w-[180px] truncate font-black">{contract.seal}</p>
                      <p className="mt-0.5 text-[11px] text-muted">ID {contract.id.slice(0, 8)}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <p className="max-w-[180px] truncate font-bold">{contract.owner}</p>
                  <p className="mt-1 max-w-[180px] truncate text-xs text-muted">{contract.tenant}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="font-bold">{contract.startDate}</p>
                  <p className="mt-1 text-xs text-muted">{contract.duration}</p>
                </td>
                <td className="px-4 py-4">
                  <div className="inline-flex items-center gap-2 font-black">
                    <CircleDollarSign className="text-emerald-600" size={17} />
                    {money(contract.rent)}
                  </div>
                </td>
                <td className="px-4 py-4"><AgreementState contract={contract} /></td>
                <td className="px-4 py-4">{contractStatus(contract)}</td>
                <td className="px-5 py-4 text-right">
                  <Link
                    href={houseContractsHref(contract.houseId)}
                    aria-label={`Ouvrir le contrat ${contract.seal}`}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition group-hover:bg-violet-600 group-hover:text-white"
                  >
                    <ArrowUpRight size={17} />
                  </Link>
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </div>

      {!visibleContracts.length && (
        <div className="p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <FileSignature size={20} />
          </div>
          <p className="mt-3 font-black">Aucun contrat trouvé</p>
          <p className="mt-1 text-sm text-muted">Modifie la recherche ou le filtre sélectionné.</p>
        </div>
      )}
    </div>
  );
}
