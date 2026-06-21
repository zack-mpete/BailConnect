"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Navbar } from "@/components/navbar";
import { RoleGate } from "@/components/role-gate";
import { Button, Card } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { Home, ImagePlus, MapPin } from "lucide-react";
import toast from "react-hot-toast";

const LeafletLocationPicker = dynamic(() => import("@/components/leaflet-maps").then(mod => mod.LeafletLocationPicker), {
  ssr: false,
  loading: () => <div className="flex h-[360px] items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-muted">Chargement de la carte...</div>
});

type LatLng = {
  lat: number;
  lng: number;
};

const locationCatalog: Record<string, Record<string, Record<string, LatLng>>> = {
  Lubumbashi: {
    Lubumbashi: {
      "Centre-ville": { lat: -11.6616, lng: 27.4794 },
      Golf: { lat: -11.6845, lng: 27.4749 },
      Makutano: { lat: -11.6725, lng: 27.4824 }
    },
    Kampemba: {
      "Bel-Air": { lat: -11.6475, lng: 27.5067 },
      Bongonga: { lat: -11.6339, lng: 27.5226 },
      Industriel: { lat: -11.6427, lng: 27.4937 }
    },
    Katuba: {
      Katuba: { lat: -11.6906, lng: 27.4527 },
      Kisanga: { lat: -11.7072, lng: 27.4483 },
      Kenya: { lat: -11.6769, lng: 27.4561 }
    },
    Ruashi: {
      Ruashi: { lat: -11.6271, lng: 27.5457 },
      Kalukuluku: { lat: -11.6119, lng: 27.5622 }
    },
    Annexe: {
      Kasapa: { lat: -11.6066, lng: 27.4279 },
      Naviundu: { lat: -11.5969, lng: 27.4909 }
    }
  },
  Kinshasa: {
    Gombe: {
      Gombe: { lat: -4.3054, lng: 15.3126 },
      Socimat: { lat: -4.3105, lng: 15.2879 },
      Batetela: { lat: -4.3162, lng: 15.3005 }
    },
    Ngaliema: {
      "Ma Campagne": { lat: -4.3701, lng: 15.2557 },
      "Binza Pigeon": { lat: -4.3918, lng: 15.2432 },
      "Binza UPN": { lat: -4.4142, lng: 15.2643 }
    },
    Limete: {
      Residentiel: { lat: -4.3504, lng: 15.3379 },
      Industriel: { lat: -4.3303, lng: 15.3503 },
      Kingabwa: { lat: -4.3344, lng: 15.3838 }
    },
    Lemba: {
      Righini: { lat: -4.4021, lng: 15.3136 },
      Foire: { lat: -4.3838, lng: 15.3197 },
      "Super Lemba": { lat: -4.4178, lng: 15.3204 }
    },
    Kintambo: {
      Kintambo: { lat: -4.3357, lng: 15.2774 },
      Magasin: { lat: -4.3404, lng: 15.2871 }
    }
  },
  Kolwezi: {
    Dilala: {
      Dilala: { lat: -10.7203, lng: 25.4727 },
      Golf: { lat: -10.7077, lng: 25.4617 },
      "Joli Site": { lat: -10.7332, lng: 25.4558 }
    },
    Manika: {
      Manika: { lat: -10.7169, lng: 25.4891 },
      Mutoshi: { lat: -10.7446, lng: 25.5101 },
      Kasulo: { lat: -10.7091, lng: 25.5027 }
    }
  },
  Likasi: {
    Likasi: {
      "Centre-ville": { lat: -10.9817, lng: 26.7333 },
      Panda: { lat: -10.9932, lng: 26.7594 },
      Kikula: { lat: -10.9595, lng: 26.7585 }
    },
    Shituru: {
      Shituru: { lat: -10.9683, lng: 26.7198 },
      SNCC: { lat: -10.9769, lng: 26.7048 }
    }
  }
};

const cityOptions = Object.keys(locationCatalog);

function safeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AddHousePage() {
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [selectedCity, setSelectedCity] = useState(cityOptions[0]);
  const communeOptions = Object.keys(locationCatalog[selectedCity]);
  const [selectedCommune, setSelectedCommune] = useState(communeOptions[0]);
  const districtOptions = Object.keys(locationCatalog[selectedCity][selectedCommune]);
  const [selectedDistrict, setSelectedDistrict] = useState(districtOptions[0]);
  const suggestedCenter = locationCatalog[selectedCity][selectedCommune][selectedDistrict];

  function changeCity(city: string) {
    const nextCommunes = Object.keys(locationCatalog[city]);
    const nextCommune = nextCommunes[0];
    const nextDistrict = Object.keys(locationCatalog[city][nextCommune])[0];
    setSelectedCity(city);
    setSelectedCommune(nextCommune);
    setSelectedDistrict(nextDistrict);
    setLocation(null);
  }

  function changeCommune(commune: string) {
    const nextDistrict = Object.keys(locationCatalog[selectedCity][commune])[0];
    setSelectedCommune(commune);
    setSelectedDistrict(nextDistrict);
    setLocation(null);
  }

  function changeDistrict(district: string) {
    setSelectedDistrict(district);
    setLocation(null);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formElement = e.currentTarget;
    if (!supabase) {
      toast.error("Supabase n'est pas configuré.");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const userId = sessionData.session?.user.id;
    if (!token) {
      toast.error("Connecte-toi avant de publier une maison.");
      return;
    }

    const form = new FormData(formElement);
    const features = String(form.get("features") || "")
      .split(",")
      .map(feature => feature.trim())
      .filter(Boolean);

    setLoading(true);
    try {
      const image = form.get("image") as File | null;
      let imageUrl = "";

      if (image && image.size > 0) {
        if (!image.type.startsWith("image/")) {
          throw new Error("Le fichier choisi doit être une image.");
        }

        const path = `${userId}/${Date.now()}-${safeFileName(image.name)}`;
        const { error: uploadError } = await supabase.storage
          .from("house-images")
          .upload(path, image, {
            cacheControl: "3600",
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("house-images").getPublicUrl(path);
        imageUrl = data.publicUrl;
      }

      const res = await fetch("/api/houses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: form.get("title"),
          city: form.get("city"),
          commune: form.get("commune"),
          district: form.get("district"),
          address: form.get("address"),
          latitude: location?.lat ?? null,
          longitude: location?.lng ?? null,
          price: form.get("price"),
          rooms: form.get("rooms"),
          type: form.get("type"),
          description: form.get("description"),
          image_url: imageUrl,
          features
        })
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Publication impossible.");
      }

      formElement.reset();
      setLocation(null);
      toast.success("Maison publiée.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publication impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="pb-24 md:pb-0"><Navbar />
      <section className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <RoleGate allow={["admin", "bailleur", "agence"]} fallbackText="Seuls les bailleurs, agences et administrateurs peuvent publier une annonce.">
          <h1 className="text-3xl font-black">Ajouter une maison</h1>
          <p className="mt-2 text-muted">Publie une annonce visible dans le fil immobilier après connexion.</p>
          <form onSubmit={submit} className="mt-6 grid gap-5 lg:grid-cols-[1fr_.75fr]">
            <Card className="space-y-4">
              <label className="block text-sm font-bold">Titre<input name="title" required className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" placeholder="Maison moderne à Golf" /></label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-bold">Ville
                  <select name="city" required value={selectedCity} onChange={event => changeCity(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3">
                    {cityOptions.map(city => <option key={city} value={city}>{city}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-bold">Commune
                  <select name="commune" required value={selectedCommune} onChange={event => changeCommune(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3">
                    {communeOptions.map(commune => <option key={commune} value={commune}>{commune}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-bold">Quartier
                  <select name="district" required value={selectedDistrict} onChange={event => changeDistrict(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3">
                    {districtOptions.map(district => <option key={district} value={district}>{district}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-bold">Adresse indicative<input name="address" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Avenue, repere ou reference" /></label>
              </div>
              <div className="space-y-3">
                <div>
                  <h2 className="text-sm font-bold">Point exact sur la carte</h2>
                  <p className="mt-1 text-xs font-semibold text-muted">La carte se centre sur le quartier choisi. Clique ensuite sur le point exact ou deplace le marqueur.</p>
                </div>
                <LeafletLocationPicker value={location} suggestedCenter={suggestedCenter} onChange={setLocation} />
                <div className="grid gap-3 text-xs font-semibold text-muted md:grid-cols-2">
                  <p className="rounded-xl bg-slate-50 p-3">Latitude : {location ? location.lat.toFixed(6) : "non definie"}</p>
                  <p className="rounded-xl bg-slate-50 p-3">Longitude : {location ? location.lng.toFixed(6) : "non definie"}</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="block text-sm font-bold">Prix / mois<input name="price" required type="number" min="1" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="500" /></label>
                <label className="block text-sm font-bold">Pièces<input name="rooms" required type="number" min="1" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="4" /></label>
                <label className="block text-sm font-bold">Type<select name="type" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"><option>Maison</option><option>Appartement</option><option>Villa</option><option>Studio</option></select></label>
              </div>
              <label className="block text-sm font-bold">Image<input name="image" type="file" accept="image/*" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 file:mr-4 file:rounded-full file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-bold file:text-brand-700" /></label>
              <label className="block text-sm font-bold">Équipements<input name="features" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Parking, Jardin, Sécurité" /></label>
              <label className="block text-sm font-bold">Description<textarea name="description" required rows={5} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Décrire la maison, le quartier et les avantages..." /></label>
              <Button disabled={loading} className="w-full bg-ink text-white disabled:opacity-60">{loading ? "Publication..." : "Publier la maison"}</Button>
            </Card>
            <Card className="space-y-4 bg-ink text-white">
              <div className="rounded-xxl bg-white/10 p-5"><ImagePlus/><h2 className="mt-4 text-xl font-black">Médias</h2><p className="mt-2 text-sm text-white/70">Ajoute une image nette qui montre réellement le bien.</p></div>
              <div className="rounded-xxl bg-white/10 p-5"><MapPin/><h2 className="mt-4 text-xl font-black">Localisation</h2><p className="mt-2 text-sm text-white/70">Ville et commune alimentent les filtres publics.</p></div>
              <div className="rounded-xxl bg-white/10 p-5"><Home/><h2 className="mt-4 text-xl font-black">Statut</h2><p className="mt-2 text-sm text-white/70">Chaque nouvelle annonce démarre en Disponible.</p></div>
            </Card>
          </form>
        </RoleGate>
      </section>
    </main>
  );
}
