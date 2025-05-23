# Ingestion de données

Cette section documente le processus d'ingestion de données dans la base de données vectorielle Qdrant.

## Introduction

L'ingestion de données est le processus par lequel les documents sont importés, nettoyés, catégorisés, transformés en embeddings et stockés dans la base de données vectorielle Qdrant. Ce processus est essentiel pour permettre la recherche sémantique et le filtrage des documents.

## Fichier principal

Le fichier principal pour l'ingestion de données est `src/ingestion/csvIngestion.ts`. Ce fichier contient les fonctions nécessaires pour ingérer des données à partir de fichiers CSV, générer des embeddings et stocker les données dans Qdrant.

## Schémas de données

### CleanedEmbeddingSchema

```typescript
const CleanedEmbeddingSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  asset_id: z.string(),
  content_type: z.string(),
  text: z.string(),
  category: z.string().optional(),
  category_analysis_json: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
```

Ce schéma définit la structure des données d'embedding nettoyées et catégorisées. Il est utilisé pour valider les données avant de les stocker dans Qdrant.

### CategorySchema et CategoryAnalysisSchema

```typescript
const CategorySchema = z.object({
  name: z.string(),
  score: z.number().min(0).max(1),
});

const CategoryAnalysisSchema = z.object({
  categories: z.array(CategorySchema),
  reasoning: z.string(),
});
```

Ces schémas définissent la structure des données d'analyse de catégorie. Ils sont utilisés pour valider les données d'analyse de catégorie avant de les stocker dans Qdrant.

## Fonctions principales

### ingestEmbeddingsFromCsv

```typescript
async function ingestEmbeddingsFromCsv(
  filePath: string = path.resolve(__dirname, '../../data/salim-embeddings.csv')
): Promise<void>
```

Cette fonction ingère des données d'embeddings à partir d'un fichier CSV. Elle effectue les étapes suivantes :

1. Nettoyage et catégorisation du fichier CSV
2. Lecture du fichier catégorisé
3. Validation des données
4. Initialisation du client Qdrant
5. Création de la collection si elle n'existe pas
6. Génération des embeddings pour chaque document
7. Insertion des points (embeddings + métadonnées) dans Qdrant par lots

### generateEmbedding

```typescript
async function generateEmbedding(text: string): Promise<number[]>
```

Cette fonction génère un embedding à partir d'un texte en utilisant le modèle OpenAI (text-embedding-3-small). Elle retourne un tableau de nombres représentant l'embedding.

### ensureCollection

```typescript
async function ensureCollection(client: QdrantClient, dimension: number): Promise<void>
```

Cette fonction assure que la collection existe dans Qdrant. Si la collection n'existe pas, elle est créée avec la dimension spécifiée. Elle crée également un index pour le champ `category` pour améliorer les performances de recherche par catégorie.

### getDocumentsFromQdrant

```typescript
async function getDocumentsFromQdrant(category?: string): Promise<Document[]>
```

Cette fonction récupère les documents stockés dans Qdrant. Elle prend en paramètre une catégorie optionnelle pour filtrer les documents. Elle retourne une promesse qui se résout en un tableau de documents.

### addCategoryIndex

```typescript
async function addCategoryIndex(): Promise<void>
```

Cette fonction ajoute un index pour le champ `category` à la collection existante. Si l'index existe déjà, l'opération est ignorée. L'index est utilisé pour améliorer les performances de recherche par catégorie.

## Processus d'ingestion

Le processus d'ingestion complet se déroule comme suit :

1. **Préparation des données** : Les données brutes sont nettoyées et catégorisées à l'aide de la fonction `processEmbeddingsFile` du module `src/utils/csvCleaner.ts`.

2. **Validation des données** : Les données nettoyées sont validées à l'aide du schéma `CleanedEmbeddingSchema` pour s'assurer qu'elles sont conformes à la structure attendue.

3. **Configuration de Qdrant** : Le client Qdrant est initialisé avec l'URL et la clé API spécifiées dans les variables d'environnement.

4. **Création de la collection** : Si la collection n'existe pas dans Qdrant, elle est créée avec la dimension spécifiée pour les embeddings.

5. **Génération des embeddings** : Pour chaque document, un embedding est généré à l'aide du modèle OpenAI.

6. **Insertion des données** : Les embeddings et les métadonnées sont insérés dans Qdrant par lots pour optimiser les performances.

## Utilisation

L'ingestion de données peut être déclenchée de plusieurs manières :

### Via la ligne de commande

```bash
# Ingestion à partir du fichier par défaut
node dist/src/ingestion/csvIngestion.js

# Ingestion à partir d'un fichier spécifique
node dist/src/ingestion/csvIngestion.js --file /chemin/vers/fichier.csv

# Ajout d'un index pour le champ category
node dist/src/ingestion/csvIngestion.js --add-index
```

### Via l'API REST

```http
POST /ingestion/csv
Content-Type: application/json

{
  "filePath": "/chemin/vers/fichier.csv"
}
```

### Via le code

```typescript
import { ingestEmbeddingsFromCsv } from './src/ingestion/csvIngestion';

// Ingestion à partir du fichier par défaut
await ingestEmbeddingsFromCsv();

// Ingestion à partir d'un fichier spécifique
await ingestEmbeddingsFromCsv('/chemin/vers/fichier.csv');
```

## Format du fichier CSV

Le fichier CSV d'entrée doit avoir les colonnes suivantes :

- `id` : Identifiant unique du document
- `project_id` : Identifiant du projet
- `asset_id` : Identifiant de l'asset
- `content_type` : Type de contenu (généralement "text")
- `text` : Contenu textuel du document
- `created_at` : Date de création
- `updated_at` : Date de mise à jour

Le fichier CSV nettoyé et catégorisé aura les colonnes supplémentaires suivantes :

- `category` : Catégorie principale du document
- `category_analysis_json` : Analyse des catégories au format JSON

## Dépendances

- `@qdrant/js-client-rest` : Client JavaScript pour Qdrant
- `@langchain/core/documents` : Types de documents pour LangChain
- `@langchain/openai` : Intégration OpenAI pour LangChain
- `zod` : Validation de schémas
- `csv-parse` : Analyse de fichiers CSV
- `dotenv` : Gestion des variables d'environnement
