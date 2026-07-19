# Bibliothèques et frameworks utilisés

Ce document inventorie les dépendances directes de **BailConnect**. Il est basé sur
`package.json`, les fichiers de configuration et les imports présents dans le code.
Les versions indiquées sont les versions déclarées dans `package.json` ; le fichier
`package-lock.json` fixe les versions exactes installées.

## Frameworks et socle applicatif

| Technologie | Version déclarée | Utilisation dans le projet |
|---|---:|---|
| [Next.js](https://nextjs.org/) (`next`) | `^15.0.0` | Framework principal. Le projet utilise l'App Router, les pages, les layouts, les routes API, `next/link`, `next/image`, la navigation et les imports dynamiques. |
| [React](https://react.dev/) (`react`) | `^19.0.0` | Construction des composants et utilisation des hooks (`useState`, `useEffect`, `useMemo`, etc.). |
| [React DOM](https://react.dev/reference/react-dom) (`react-dom`) | `^19.0.0` | Rendu de React dans le navigateur. Il est principalement utilisé par Next.js, sans import direct dans les fichiers applicatifs. |
| [TypeScript](https://www.typescriptlang.org/) (`typescript`) | `^5.5.4` | Typage statique des fichiers `.ts` et `.tsx`, vérifié avec `tsc --noEmit`. |
| [Tailwind CSS](https://tailwindcss.com/) (`tailwindcss`) | `^3.4.10` | Framework CSS utilitaire utilisé dans les composants et chargé depuis `src/app/globals.css`. |

## Bibliothèques utilisées par l'application

| Bibliothèque | Version déclarée | Utilisation dans le code |
|---|---:|---|
| [Supabase JS](https://supabase.com/docs/reference/javascript/introduction) (`@supabase/supabase-js`) | `^2.45.4` | Authentification, accès PostgreSQL via l'API Supabase, temps réel, stockage des images et clients utilisés par les routes API. |
| [Framer Motion](https://www.framer.com/motion/) (`framer-motion`) | `^11.3.30` | Animations, transitions et prise en charge de la préférence de réduction des animations. |
| [Leaflet](https://leafletjs.com/) (`leaflet`) | `^1.9.4` | Moteur de cartographie, marqueurs, coordonnées et gestion des icônes de carte. |
| [React Leaflet](https://react-leaflet.js.org/) (`react-leaflet`) | `^5.0.0` | Composants React pour les cartes Leaflet (`MapContainer`, `Marker`, `Popup`, `TileLayer`, etc.). |
| [Lucide React](https://lucide.dev/) (`lucide-react`) | `^0.468.0` | Icônes de l'interface utilisateur. |
| [React Hot Toast](https://react-hot-toast.com/) (`react-hot-toast`) | `^2.4.1` | Notifications visuelles de succès et d'erreur dans l'interface. |
| [Web Push](https://github.com/web-push-libs/web-push) (`web-push`) | `^3.6.7` | Envoi côté serveur des notifications Web Push avec des clés VAPID. |
| [clsx](https://github.com/lukeed/clsx) (`clsx`) | `^2.1.1` | Construction conditionnelle des listes de classes CSS dans la fonction utilitaire `cn`. |
| [tailwind-merge](https://github.com/dcastil/tailwind-merge) (`tailwind-merge`) | `^2.5.2` | Fusion des classes Tailwind en supprimant les classes contradictoires dans `cn`. |

## Outils de développement et de qualité

| Outil | Version déclarée | Rôle |
|---|---:|---|
| [Vitest](https://vitest.dev/) (`vitest`) | `^3.2.4` | Exécution des tests unitaires situés dans `tests/unit`. |
| [Playwright](https://playwright.dev/) (`@playwright/test`) | `^1.53.2` | Tests end-to-end dans `tests/e2e`, exécutés avec Chromium/Chrome. |
| [ESLint](https://eslint.org/) (`eslint`) | `^9.9.1` | Analyse statique et contrôle de la qualité du code. |
| `eslint-config-next` | `^15.0.0` | Règles ESLint recommandées par Next.js, notamment Core Web Vitals et TypeScript. |
| [PostCSS](https://postcss.org/) (`postcss`) | `^8.4.41` | Pipeline de transformation du CSS utilisé par Tailwind. |
| [Autoprefixer](https://github.com/postcss/autoprefixer) (`autoprefixer`) | `^10.4.20` | Ajout automatique des préfixes CSS nécessaires aux navigateurs. |

## Définitions de types

Ces paquets n'ajoutent pas de fonctionnalité à l'exécution. Ils fournissent des
types à TypeScript pour les bibliothèques ou les API concernées.

| Paquet | Version déclarée | Cible |
|---|---:|---|
| `@types/node` | `^22.5.4` | API Node.js et variables d'environnement. |
| `@types/react` | `^19.0.0` | React. |
| `@types/react-dom` | `^19.0.0` | React DOM. |
| `@types/leaflet` | `^1.9.21` | Leaflet. |

## Dépendances déclarées mais non utilisées directement

Les paquets suivants sont installés dans `package.json`, mais aucun import direct
n'a été trouvé dans le code ou les fichiers de configuration analysés :

| Paquet | Version déclarée | Usage prévu |
|---|---:|---|
| [React Hook Form](https://react-hook-form.com/) (`react-hook-form`) | `^7.52.2` | Gestion de formulaires React. Les formulaires actuels utilisent les hooks React et `FormEvent`. |
| `@hookform/resolvers` | `^3.9.0` | Connexion de React Hook Form à un validateur de schéma. |
| [Zod](https://zod.dev/) (`zod`) | `^3.23.8` | Validation et parsing de données par schémas. |

Ces dépendances peuvent être conservées si leur intégration est prévue. Dans le
cas contraire, elles peuvent être retirées afin d'alléger les installations et les
mises à jour.

## Dépendance de configuration à régulariser

Le fichier `eslint.config.mjs` importe `FlatCompat` depuis `@eslint/eslintrc`.
Ce paquet est actuellement disponible de manière transitive, mais il n'est pas
déclaré directement dans `package.json`. Comme il est importé par la configuration
du projet, il serait plus robuste de l'ajouter aux `devDependencies`.

## Services et API associés

Ces éléments ne sont pas des bibliothèques npm directes, mais ils font partie de
l'architecture utilisée par le code :

- **Supabase** : Auth, base PostgreSQL, Row Level Security, Realtime et Storage.
- **OpenStreetMap** : tuiles cartographiques affichées par Leaflet.
- **Web Push API** et **Service Worker API** : abonnement et réception des
  notifications dans le navigateur via `public/sw.js`.
- **Node.js** : environnement d'exécution des scripts, de Next.js et des routes
  serveur.

## Résumé

- 5 technologies composent le socle principal.
- 9 bibliothèques applicatives sont importées ou utilisées à l'exécution.
- 6 outils servent à construire, vérifier et tester le projet.
- 4 paquets fournissent des définitions TypeScript.
- 3 dépendances sont déclarées mais ne sont pas encore utilisées directement.

Les dépendances transitives présentes uniquement dans `package-lock.json` ne sont
pas listées individuellement : elles sont installées automatiquement par les
dépendances directes ci-dessus et ne sont pas appelées explicitement par
l'application.
