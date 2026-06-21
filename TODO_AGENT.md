# TODO Agent — Développement complet LeaseHub RDC

## Phase 1 — Base projet
- [x] Créer projet Next.js + TypeScript.
- [x] Ajouter Tailwind CSS.
- [x] Ajouter composants UI de base.
- [x] Ajouter données mock `public/api.json`.
- [x] Préparer `.env.example`.
- [x] Renseigner les vraies clés Supabase dans `.env.local`.

## Phase 2 — Interface publique
- [x] Accueil mobile-first type feed.
- [x] Cartes maisons interactives.
- [x] Page recherche avec filtres.
- [x] Page détail maison.
- [x] Mentionner la 3D comme vision future, pas MVP.

## Phase 3 — Formulaires
- [x] Page ajouter maison branchée sur Supabase.
- [ ] Brancher React Hook Form + Zod.
- [x] Brancher Supabase insert pour `houses`.
- [x] Brancher Supabase Storage pour images.

## Phase 4 — Authentification
- [x] Page auth connectée à Supabase.
- [x] Connecter Supabase Auth avec clé publique anon.
- [x] Séparer login et création de compte.
- [x] Ajouter composant `AuthStatus` pour se connecter/profil en haut de page.
- [x] Créer les tables `role` et `users`.
- [x] Conserver `profiles` pour les relations existantes des annonces, demandes et contrats.
- [x] Créer/synchroniser une ligne `users` après connexion/inscription Supabase Auth.
- [x] Ajouter endpoint `/api/users/me` pour récupérer l'utilisateur courant et son rôle.
- [ ] Définir la stratégie finale entre `users` et `profiles` avant les requêtes frontend.
- [x] Redirection selon le rôle via `users.role_id -> role.name`.
- [x] Filtrer navbar, dashboard, ajout annonce et contrats selon rôle.
- [x] Adapter la navigation en mobile-first avec raccourcis selon rôle.
- [ ] Middleware serveur/cookies pour protection SSR stricte des dashboards.

## Phase 5 — Dashboards
- [x] Dashboard global branché Supabase avec fallback mock.
- [ ] Dashboard Admin complet.
- [ ] Dashboard Bailleur complet.
- [ ] Dashboard Agence complet.
- [ ] Dashboard Locataire complet.

## Phase 6 — Contrats
- [x] Page contrat avec sceau visuel.
- [ ] Génération contrat depuis données Supabase.
- [ ] Signature numérique simulée côté UI.
- [ ] Export PDF.
- [ ] Historique des contrats.

## Phase 7 — Notifications Web Push
- [x] Service Worker de base.
- [x] Routes API `push/subscribe` et `push/send`.
- [ ] Générer clés VAPID.
- [x] Créer table `push_subscriptions`.
- [x] Relier `push_subscriptions.user_id` à l'utilisateur connecté.
- [ ] Envoyer notifications réelles avec `web-push`.

## Phase 8 — Supabase
- [x] Client Supabase préparé.
- [x] Variables d'environnement Supabase renseignées.
- [x] Schéma SQL initial fourni.
- [x] Ajouter `role` et `users` au schéma SQL.
- [x] Rendre `supabase-schema.sql` relançable (`if not exists`, policies recréables).
- [ ] Appliquer/valider `supabase-schema.sql` dans Supabase.
- [x] Compléter politiques RLS pour `users`, `role`, `profiles`, `houses`, `rental_requests`, `contracts` et `push_subscriptions`.
- [x] Ajouter bucket Storage `house-images` et policies `storage.objects`.
- [x] Ajouter les types TypeScript applicatifs pour `role`, `users`, `profiles`, `houses`, `rental_requests`, `contracts`.
- [x] Créer endpoints API: `houses`, `houses/[id]`, `roles`, `dashboard`, `users/sync`, `contracts`, `rental-requests`, `push`.
- [x] Créer endpoint API `users/me`.
- [x] Remplacer les lectures `api.json` par requêtes Supabase avec fallback mock.
- [x] Brancher les stats dashboard sur Supabase.
- [x] Brancher les rôles dashboard sur la table `role`.

## Phase 9 — Qualité
- [ ] Ajouter états loading/skeleton.
- [ ] Ajouter erreurs formulaires.
- [ ] Tester responsive mobile.
- [ ] Tester build production.
- [ ] Déployer sur Vercel.
