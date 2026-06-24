# BailConnect - Plateforme Next.js de location immobilière

Application MVP prête à développer pour :

- ajouter une maison ;
- chercher une maison ;
- consulter un feed immobilier mobile-first ;
- préparer un contrat de bail numérique avec sceau visuel ;
- gérer des dashboards Admin, Bailleur, Agence et Locataire ;
- préparer l’intégration Supabase ;
- tester l’interface avec `public/api.json`.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Framer Motion
- Lucide React
- React Hot Toast
- Supabase JS préparé
- Web Push préparé via Service Worker

## Installation

```bash
npm install
npm run dev
```

Ouvrir ensuite :

```bash
http://localhost:3000
```

## Configuration Supabase

Copier `.env.example` vers `.env.local` :

```bash
cp .env.example .env.local
```

Remplir plus tard :

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

L'app utilise uniquement les clés publiques Supabase. Les actions protégées passent par Supabase Auth et les politiques RLS.

Le fichier `.env` / `.env.local` ne doit pas être commit. Il est couvert par `.gitignore`.

## Structure base de données

Le schéma Supabase canonique est dans :

```txt
supabase-schema.sql
```

Une vue lisible des tables, relations, policies et workflows est disponible ici :

```txt
docs/database-structure.md
```

## Pages incluses

| Page | Route | Statut |
|---|---|---|
| Accueil / feed | `/` | Branchée Supabase avec fallback mock |
| Recherche | `/search` | Branchée Supabase avec fallback mock |
| Détail maison | `/houses/[id]` | Branchée Supabase avec fallback mock |
| Ajouter maison | `/add-house` | Insert Supabase avec utilisateur connecté |
| Contrats | `/contrats` | Simulation visuelle |
| Dashboards | `/dashboard` | Branché Supabase avec fallback mock |
| Auth | `/auth` | Supabase Auth + synchronisation `users` |

## Web Push

Le service worker est dans :

```txt
public/sw.js
```

Les routes API préparées :

```txt
src/app/api/push/subscribe/route.ts
src/app/api/push/send/route.ts
```

À faire pour l’envoi réel :

1. Générer les clés VAPID :

```bash
npx web-push generate-vapid-keys
```

2. Remplir `.env.local` :

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
```

3. La table `push_subscriptions` est déjà dans `supabase-schema.sql`.

## Supabase Storage

Le bucket utilisé par les annonces est :

```txt
house-images
```

Pour l'activer :

1. Ouvrir Supabase SQL Editor.
2. Relancer `supabase-schema.sql`.
3. Vérifier dans Storage que le bucket `house-images` existe et qu'il est public.

Les images sont envoyées dans un dossier par utilisateur connecté :

```txt
house-images/{auth.uid()}/nom-du-fichier
```

Les policies Storage autorisent :

- lecture publique des images ;
- upload par utilisateur connecté ;
- modification/suppression seulement dans son propre dossier.

## Vision future : 3D

La visite 3D n’est pas intégrée dans le MVP. Elle est prévue comme évolution future avec :

- fichiers `.glb` ;
- Three.js ;
- React Three Fiber ;
- modèles créés avec Blender, photogrammétrie ou scan mobile.

## Prochaines tâches techniques

1. Finaliser les redirections selon rôle.
2. Générer les contrats en PDF.
3. Finaliser les Web Push avec une stratégie serveur pour les secrets VAPID.
4. Ajouter les règles de rôles dans les dashboards.
