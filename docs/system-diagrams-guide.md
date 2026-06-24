# Guide d'analyse pour créer des diagrammes

Ce document résume l'architecture de la plateforme **BailConnect** et fournit des modèles Mermaid prêts à transformer en diagrammes : architecture, parcours utilisateur, base de données, états métier et flux API.

## 1. Vue générale du système

BailConnect est une application de location immobilière construite avec **Next.js App Router**, **React**, **TypeScript**, **Tailwind CSS** et **Supabase**.

Le système permet de :

- publier des maisons par un administrateur, un bailleur ou une agence ;
- rechercher et consulter des annonces ;
- gérer des utilisateurs avec rôles ;
- demander, accepter et suivre des contrats de bail ;
- afficher des dashboards selon le rôle ;
- stocker les images des annonces dans Supabase Storage ;
- envoyer des notifications internes et, si configuré, des notifications Web Push.

## 2. Acteurs principaux

| Acteur | Rôle dans le système | Capacités principales |
|---|---|---|
| Visiteur | Utilisateur non connecté | Consulte l'accueil, la recherche et les détails publics des maisons |
| Locataire | Cherche un logement | Consulte les annonces, demande un contrat, accepte un contrat, reçoit des notifications |
| Bailleur | Propriétaire | Publie des maisons, gère ses annonces, accepte les demandes, suit les contrats |
| Agence | Intermédiaire immobilier | Publie et gère des annonces comme un bailleur professionnel |
| Admin | Gestionnaire global | Supervise utilisateurs, annonces, contrats et statistiques |

## 3. Architecture applicative

```mermaid
flowchart LR
  User[Utilisateur navigateur]
  UI[Pages Next.js + composants React]
  API[Routes API Next.js]
  SupabaseAuth[Supabase Auth]
  SupabaseDB[(PostgreSQL Supabase)]
  Storage[(Supabase Storage<br/>bucket house-images)]
  SW[Service Worker<br/>public/sw.js]
  Push[Web Push]
  Mock[Fallback mock<br/>src/lib/mock.ts]

  User --> UI
  UI --> API
  UI --> SupabaseAuth
  UI --> Storage
  API --> SupabaseAuth
  API --> SupabaseDB
  API --> Storage
  API --> Push
  SW --> Push
  Push --> User
  UI -. si Supabase absent/erreur .-> Mock
```

### Points importants pour un diagramme d'architecture

- Le frontend lit surtout via `src/lib/data.ts`.
- Les actions protégées passent par les routes `src/app/api/**/route.ts`.
- `src/lib/supabase.ts` crée le client Supabase public avec timeout.
- Les routes API utilisent le token Bearer via `src/app/api/_supabase.ts`.
- Certaines écritures sensibles utilisent `SUPABASE_SERVICE_ROLE_KEY` si disponible.
- Le stockage des images est séparé dans le bucket public `house-images`.
- Les notifications sont persistées en base, puis envoyées en Web Push si les clés VAPID existent.

## 4. Carte des pages

| Route | Fichier | Fonction |
|---|---|---|
| `/` | `src/app/page.tsx` | Accueil et feed immobilier |
| `/search` | `src/app/search/page.tsx` | Recherche d'annonces |
| `/houses/[id]` | `src/app/houses/[id]/page.tsx` | Détail d'une maison |
| `/add-house` | `src/app/add-house/page.tsx` | Ajout d'une annonce avec image |
| `/contrats` | `src/app/contrats/page.tsx` | Espace contrats |
| `/dashboard` | `src/app/dashboard/page.tsx` | Dashboard selon rôle |
| `/auth` | `src/app/auth/page.tsx` | Connexion / synchronisation utilisateur |

```mermaid
flowchart TD
  Home["/"]
  Search["/search"]
  Detail["/houses/[id]"]
  AddHouse["/add-house"]
  Contracts["/contrats"]
  Dashboard["/dashboard"]
  Auth["/auth"]

  Home --> Search
  Home --> Detail
  Search --> Detail
  Detail --> Contracts
  Auth --> Dashboard
  Dashboard --> AddHouse
  Dashboard --> Contracts
```

## 5. Routes API principales

| Route API | Méthodes | Responsabilité |
|---|---:|---|
| `/api/houses` | `GET`, `POST` | Liste et création d'annonces |
| `/api/houses/[id]` | `GET`, `PATCH`, `DELETE` | Lecture, modification et suppression d'une maison |
| `/api/contracts` | `GET`, `PATCH` | Liste des contrats d'un utilisateur, création implicite et accord contractuel |
| `/api/users/sync` | `POST` | Synchronise l'utilisateur Supabase Auth vers `public.users` |
| `/api/users/me` | `GET` | Retourne l'utilisateur connecté et ses rôles |
| `/api/roles` | `GET` | Liste les rôles applicatifs |
| `/api/dashboard` | `GET` | Données agrégées du dashboard standard |
| `/api/admin/dashboard` | `GET` | Vue admin complète |
| `/api/admin/users` | `PATCH` | Modification admin d'un utilisateur |
| `/api/notifications` | `GET`, `PATCH` | Liste et lecture des notifications |
| `/api/push/subscribe` | `POST` | Enregistre une souscription Web Push |
| `/api/push/send` | `POST` | Envoi de push côté serveur |

```mermaid
flowchart LR
  Browser[Navigateur]
  Auth[Supabase Auth]
  Api[Routes API Next.js]
  DB[(Supabase DB)]
  Storage[(Storage)]
  Push[Web Push]

  Browser -->|Bearer token| Api
  Browser --> Auth
  Browser --> Storage
  Api --> Auth
  Api --> DB
  Api --> Storage
  Api --> Push
```

## 6. Modèle de données

### Entités métier

- `role` : référentiel des rôles applicatifs.
- `users` : profil applicatif lié à `auth.users`.
- `houses` : annonces immobilières.
- `rental_requests` : demandes de location ou de contrat.
- `contracts` : contrats numériques avec état et sceau.
- `notifications` : notifications persistantes en base.
- `push_subscriptions` : abonnements navigateur pour Web Push.
- `storage.objects` : fichiers d'images dans le bucket `house-images`.

```mermaid
erDiagram
  ROLE ||--o{ USERS : attribue
  USERS ||--o{ HOUSES : publie
  USERS ||--o{ RENTAL_REQUESTS : demande
  HOUSES ||--o{ RENTAL_REQUESTS : concerne
  HOUSES ||--o{ CONTRACTS : formalise
  RENTAL_REQUESTS ||--o| CONTRACTS : genere
  USERS ||--o{ CONTRACTS : proprietaire
  USERS ||--o{ CONTRACTS : locataire
  USERS ||--o{ NOTIFICATIONS : recoit
  USERS ||--o{ NOTIFICATIONS : declenche
  USERS ||--o{ PUSH_SUBSCRIPTIONS : possede

  ROLE {
    smallint id PK
    app_role name
    text label
  }

  USERS {
    uuid id PK
    smallint role_id FK
    text full_name
    text email
    boolean verified
  }

  HOUSES {
    uuid id PK
    uuid owner_id FK
    text title
    text city
    text commune
    numeric price
    int rooms
    house_status status
    text image_url
  }

  RENTAL_REQUESTS {
    uuid id PK
    uuid house_id FK
    uuid tenant_id FK
    text status
  }

  CONTRACTS {
    uuid id PK
    uuid house_id FK
    uuid owner_id FK
    uuid tenant_id FK
    date start_date
    int duration_months
    numeric rent
    contract_status status
    text seal_code
  }

  NOTIFICATIONS {
    uuid id PK
    uuid user_id FK
    uuid actor_id FK
    text type
    text title
    timestamptz read_at
  }

  PUSH_SUBSCRIPTIONS {
    uuid id PK
    uuid user_id FK
    text endpoint
    jsonb subscription
  }
```

## 7. États métier

### Cycle de vie d'une maison

```mermaid
stateDiagram-v2
  [*] --> Disponible : publication
  Disponible --> Reserve : demande ou réservation
  Disponible --> Loue : contrat accepté par les deux parties
  Reserve --> Loue : finalisation du contrat
  Disponible --> Archive : retrait
  Reserve --> Archive : retrait
  Loue --> Archive : fin ou retrait
```

> Dans la base, les statuts exacts sont `Disponible`, `Réservé`, `Loué`, `Archivé`.

### Cycle de vie d'un contrat

```mermaid
stateDiagram-v2
  [*] --> Brouillon : création
  Brouillon --> PretASigner : accord propriétaire + locataire
  PretASigner --> Signe : signatures complètes
  Brouillon --> Annule : abandon
  PretASigner --> Annule : abandon
```

> Dans la base, les statuts exacts sont `brouillon`, `pret_a_signer`, `signe`, `annule`.

## 8. Flux : publication d'une maison

```mermaid
sequenceDiagram
  actor Owner as Admin/Bailleur/Agence
  participant UI as Page /add-house
  participant Storage as Supabase Storage
  participant API as POST /api/houses
  participant Auth as Supabase Auth
  participant DB as Table houses

  Owner->>UI: Remplit le formulaire
  UI->>Storage: Upload image dans house-images/{userId}/...
  Storage-->>UI: URL publique image_url
  UI->>API: Envoie les données + Bearer token
  API->>Auth: Vérifie l'utilisateur connecté
  API->>DB: Lit le rôle utilisateur
  API->>DB: Insère la maison
  DB-->>API: Maison créée
  API-->>UI: 201 + house
```

Règles importantes :

- seuls `admin`, `bailleur` et `agence` peuvent publier ;
- l'image est stockée dans `house-images` ;
- les coordonnées latitude/longitude sont validées côté API ;
- l'annonce est liée à `owner_id`.

## 9. Flux : demande et accord de contrat

Le code actuel centralise la logique active dans `/api/contracts` :

- `GET` liste les contrats où l'utilisateur connecté est propriétaire ou locataire ;
- `PATCH` crée ou récupère un contrat pour une maison, puis enregistre l'accord de la partie connectée ;
- quand les deux parties ont donné leur accord, le contrat passe à `pret_a_signer` et la maison peut passer à `Loué`.

```mermaid
sequenceDiagram
  actor Tenant as Locataire
  participant UI as Page détail / contrats
  participant API as PATCH /api/contracts
  participant Auth as Supabase Auth
  participant DB as Supabase DB
  participant Notify as notifyUsers()
  actor Owner as Bailleur/Agence

  Tenant->>UI: Demande ou accepte le contrat
  UI->>API: house_id ou contract_id + Bearer token
  API->>Auth: Vérifie le locataire
  API->>DB: Lit house ou contract
  API->>DB: Crée le contrat si nécessaire
  API->>DB: Renseigne agreed_by_tenant_at
  API->>Notify: Notifie le propriétaire
  Notify->>DB: Insère notification
  Notify-->>Owner: Web Push si configuré

  Owner->>UI: Accepte le contrat
  UI->>API: contract_id + Bearer token
  API->>DB: Renseigne agreed_by_owner_at
  API->>DB: Si les deux accords existent, status = pret_a_signer
  API->>DB: Met la maison à Loué si elle était Disponible
```

## 10. Flux : notifications

```mermaid
flowchart TD
  Event[Événement métier<br/>contrat, demande, accord]
  Notify[notifyUsers]
  Insert[(notifications)]
  Subs[(push_subscriptions)]
  Vapid{Clés VAPID configurées ?}
  WebPush[webpush.sendNotification]
  Browser[Navigateur utilisateur]

  Event --> Notify
  Notify --> Insert
  Notify --> Subs
  Subs --> Vapid
  Vapid -- Non --> Stop[Notification seulement en base]
  Vapid -- Oui --> WebPush
  WebPush --> Browser
```

## 11. Sécurité et règles RLS

Le schéma Supabase active Row Level Security sur les tables métier.

```mermaid
flowchart TD
  Public[Public]
  AuthUser[Utilisateur connecté]
  Owner[Propriétaire annonce]
  Tenant[Locataire]
  Admin[Admin]

  Public -->|lecture| Role[role]
  Public -->|lecture| Houses[houses]
  AuthUser -->|insert/update propre profil| Users[users]
  Owner -->|insert/update ses annonces| Houses
  Admin -->|update/delete annonces| Houses
  Tenant -->|crée demandes| Requests[rental_requests]
  Tenant -->|lit ses demandes| Requests
  Owner -->|lit/update demandes de ses maisons| Requests
  Owner -->|lit/update contrats| Contracts[contracts]
  Tenant -->|lit/update contrats| Contracts
  Admin -->|lit contrats| Contracts
  AuthUser -->|gère ses abonnements| PushSubs[push_subscriptions]
  AuthUser -->|lit/marque lues ses notifications| Notifications[notifications]
```

## 12. Modules à représenter dans un diagramme de composants

```mermaid
flowchart TB
  App[Next.js App Router]

  subgraph Pages
    Home[Accueil]
    Search[Recherche]
    Detail[Détail maison]
    Add[Ajout maison]
    Contracts[Contrats]
    Dashboard[Dashboard]
    AuthPage[Auth]
  end

  subgraph Components
    Navbar[navbar]
    SearchPanel[search-panel]
    HouseCard[house-card]
    Map[leaflet-maps/dashboard-map]
    RoleDashboard[role-dashboard]
    AdminDashboard[admin-dashboard]
    ContractWorkspace[contract-workspace]
    NotificationCenter[notification-center]
    WebPushButton[web-push-button]
  end

  subgraph Lib
    Data[data.ts]
    Supabase[supabase.ts]
    AuthClient[auth-client.ts]
    Mock[mock.ts]
  end

  App --> Pages
  Pages --> Components
  Pages --> Lib
  Components --> Lib
```

## 13. Glossaire technique

| Élément | Signification |
|---|---|
| `auth.users` | Table interne Supabase Auth, source de l'identité |
| `public.users` | Profil métier de l'utilisateur dans l'application |
| `role_id` | Lien vers le rôle applicatif |
| `owner_id` | Utilisateur qui possède ou publie une annonce |
| `tenant_id` | Locataire impliqué dans une demande ou un contrat |
| `seal_code` | Code de sceau visuel unique du contrat |
| `house-images` | Bucket Supabase public pour les images des annonces |
| `read_at` | Indique qu'une notification a été lue |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé serveur optionnelle pour contourner RLS dans certains traitements serveur |

## 14. Diagrammes recommandés pour documenter le projet

1. **Diagramme de contexte** : acteurs externes, navigateur, app Next.js, Supabase, Web Push.
2. **Diagramme de composants** : pages, composants React, routes API, librairies `src/lib`.
3. **Diagramme ERD** : tables Supabase et relations.
4. **Diagramme de séquence publication** : upload image puis création annonce.
5. **Diagramme de séquence contrat** : locataire, propriétaire, API, notifications.
6. **Diagramme d'états maison** : `Disponible`, `Réservé`, `Loué`, `Archivé`.
7. **Diagramme d'états contrat** : `brouillon`, `pret_a_signer`, `signe`, `annule`.
8. **Diagramme de sécurité RLS** : droits par rôle et par table.

## 15. Sources du code analysées

- `README.md`
- `supabase-schema.sql`
- `docs/database-structure.md`
- `src/types/index.ts`
- `src/lib/data.ts`
- `src/lib/supabase.ts`
- `src/app/api/_supabase.ts`
- `src/app/api/_notifications.ts`
- `src/app/api/houses/route.ts`
- `src/app/api/contracts/route.ts`
