# 🔍 Vector DB Demo avec Nettoyage et Catégorisation

## Description
Cette application démontre l'utilisation d'une base de données vectorielle (Qdrant) avec des fonctionnalités avancées de nettoyage de données et de catégorisation automatique par IA. Elle permet d'ingérer des données CSV, de les nettoyer, de les catégoriser et de les stocker dans Qdrant pour une recherche efficace.

## Fonctionnalités

### Pipeline d'ingestion
1. **Nettoyage des données CSV** - Suppression des embeddings et des informations de modèle inutiles
2. **Catégorisation automatique** - Utilisation d'un LLM pour classer chaque entrée dans une catégorie
3. **Génération d'embeddings** - Création de nouveaux embeddings avec OpenAI
4. **Stockage dans Qdrant** - Indexation des données avec leurs métadonnées enrichies

### API de consommation
1. **Récupération de documents** - Endpoint pour obtenir tous les documents ou filtrés par catégorie
2. **Liste des catégories** - Endpoint pour obtenir toutes les catégories disponibles
3. **Filtrage par métadonnées** - Possibilité de filtrer les résultats par catégorie

## Structure du projet
```
/
├── src/
│   ├── ingestion/
│   │   └── csvIngestion.ts       // Ingestion et traitement des CSV
│   ├── utils/
│   │   └── csvCleaner.ts         // Nettoyage et catégorisation des données
│   └── app.ts                    // Serveur Fastify et routes API
├── data/
│   ├── salim-embeddings.csv      // Données d'entrée
│   ├── cleaned-embeddings.csv    // Données nettoyées
│   └── categorized-embeddings.csv // Données catégorisées
├── .env                          // Variables d'environnement
├── tsconfig.json
├── package.json
└── README.md
```

## Endpoints API

### POST `/ingest`
Déclenche le processus d'ingestion des données CSV.

### GET `/documents`
Récupère tous les documents stockés dans Qdrant.

Paramètres de requête optionnels:
- `category` - Filtre les documents par catégorie (ex: `/documents?category=Documentation`)

### GET `/categories`
Récupère la liste de toutes les catégories disponibles.

### GET `/health`
Vérifie l'état de santé de l'application.

## Stack technique
- **Qdrant** - Base de données vectorielle
- **Fastify** - Framework API
- **OpenAI** - Génération d'embeddings et catégorisation
- **TypeScript** - Langage de programmation
- **LangChain** - Outils pour la manipulation de documents

## Configuration

Créez un fichier `.env` à la racine du projet avec les variables suivantes:

```
OPENAI_API_KEY=votre_clé_api_openai
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=salim_embeddings
PORT=3000
HOST=0.0.0.0
```

## Installation

```bash
pnpm install
```

## Démarrage

```bash
pnpm start
```

## Utilisation

1. Assurez-vous que Qdrant est en cours d'exécution
2. Démarrez l'application
3. Envoyez une requête POST à `/ingest` pour traiter les données
4. Interrogez les données via `/documents` ou `/documents?category=VotreCategorie`
