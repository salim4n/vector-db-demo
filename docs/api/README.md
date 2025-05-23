# API REST

Cette section documente l'API REST du projet Vector-DB-Demo, qui expose les fonctionnalités de recherche et de gestion des documents.

## Introduction

L'API REST est construite avec Fastify, un framework web rapide et léger pour Node.js. Elle expose plusieurs endpoints pour interagir avec la base de données vectorielle et l'agent ReAct.

## Structure des routes

Les routes sont organisées de manière modulaire dans le dossier `src/routes/`. Chaque fichier définit un ensemble de routes liées à une fonctionnalité spécifique.

### Fichiers de routes

- `src/routes/health.ts` : Routes pour vérifier l'état de l'application
- `src/routes/documents.ts` : Routes pour la gestion des documents
- `src/routes/search.ts` : Routes pour la recherche de documents
- `src/routes/ingestion.ts` : Routes pour l'ingestion de données
- `src/routes/agent.ts` : Routes pour interagir avec l'agent ReAct

## Routes principales

### 1. Routes de santé (health.ts)

#### GET /health

Vérifie l'état de l'application.

**Réponse** :
```json
{
  "status": "ok",
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

### 2. Routes de documents (documents.ts)

#### GET /documents

Récupère la liste des documents.

**Paramètres de requête** :
- `category` (optionnel) : Filtre les documents par catégorie
- `limit` (optionnel, défaut: 10) : Nombre maximum de documents à retourner

**Réponse** :
```json
{
  "success": true,
  "count": 5,
  "documents": [
    {
      "content": "Contenu du document",
      "metadata": {
        "id": "doc_id",
        "category": "catégorie",
        "project_id": "projet_id",
        "asset_id": "asset_id",
        "content_type": "text",
        "created_at": "2023-01-01T00:00:00.000Z",
        "updated_at": "2023-01-01T00:00:00.000Z"
      }
    },
    // ...
  ]
}
```

#### GET /documents/:id

Récupère un document spécifique par son ID.

**Paramètres de chemin** :
- `id` : ID du document à récupérer

**Réponse** :
```json
{
  "success": true,
  "document": {
    "content": "Contenu du document",
    "metadata": {
      "id": "doc_id",
      "category": "catégorie",
      "project_id": "projet_id",
      "asset_id": "asset_id",
      "content_type": "text",
      "created_at": "2023-01-01T00:00:00.000Z",
      "updated_at": "2023-01-01T00:00:00.000Z"
    }
  }
}
```

### 3. Routes de recherche (search.ts)

#### GET /search

Effectue une recherche sémantique simple.

**Paramètres de requête** :
- `query` (requis) : Requête de recherche en langage naturel
- `limit` (optionnel, défaut: 5) : Nombre maximum de résultats à retourner
- `category` (optionnel) : Filtre les résultats par catégorie

**Réponse** :
```json
{
  "success": true,
  "count": 3,
  "query": "ma requête",
  "documents": [
    {
      "content": "Contenu du document",
      "metadata": {
        "id": "doc_id",
        "score": 0.92,
        "category": "catégorie",
        "project_id": "projet_id",
        "asset_id": "asset_id",
        "content_type": "text",
        "created_at": "2023-01-01T00:00:00.000Z",
        "updated_at": "2023-01-01T00:00:00.000Z"
      }
    },
    // ...
  ]
}
```

#### POST /search/advanced

Effectue une recherche sémantique avancée avec des critères de filtrage.

**Corps de la requête** :
```json
{
  "query": "ma requête",
  "limit": 5,
  "scoreThreshold": 0.7,
  "category": "catégorie principale",
  "categories": ["catégorie1", "catégorie2"],
  "minScore": 0.5,
  "reasoningKeywords": ["mot-clé1", "mot-clé2"]
}
```

**Réponse** :
```json
{
  "success": true,
  "count": 2,
  "query": "ma requête",
  "filters": {
    "category": "catégorie principale",
    "categories": ["catégorie1", "catégorie2"],
    "minScore": 0.5,
    "reasoningKeywords": ["mot-clé1", "mot-clé2"]
  },
  "documents": [
    {
      "content": "Contenu du document",
      "metadata": {
        "id": "doc_id",
        "score": 0.85,
        "category": "catégorie1",
        "category_analysis": {
          "categories": [
            { "name": "catégorie1", "score": 0.85 },
            { "name": "catégorie2", "score": 0.65 }
          ],
          "reasoning": "Raisonnement sur la catégorisation"
        },
        "project_id": "projet_id",
        "asset_id": "asset_id",
        "content_type": "text",
        "created_at": "2023-01-01T00:00:00.000Z",
        "updated_at": "2023-01-01T00:00:00.000Z"
      }
    },
    // ...
  ]
}
```

### 4. Routes d'ingestion (ingestion.ts)

#### POST /ingestion/csv

Ingère des données à partir d'un fichier CSV.

**Corps de la requête** :
```json
{
  "filePath": "/chemin/vers/fichier.csv"
}
```

**Réponse** :
```json
{
  "success": true,
  "message": "Ingestion terminée avec succès",
  "count": 100
}
```

### 5. Routes d'agent (agent.ts)

#### POST /agent/query

Envoie une requête à l'agent ReAct.

**Corps de la requête** :
```json
{
  "query": "Trouve-moi des documents sur la programmation",
  "config": {
    "model": "gpt-4",
    "temperature": 0,
    "tools": ["all"],
    "verbose": false
  }
}
```

**Réponse** :
```json
{
  "success": true,
  "response": "J'ai trouvé 3 documents sur la programmation...",
  "executionTime": 1.5
}
```

## Contrôleurs

Les contrôleurs sont définis dans le dossier `src/controllers/` et contiennent la logique métier pour chaque route. Ils sont importés et utilisés par les fichiers de routes.

### Fichiers de contrôleurs

- `src/controllers/healthController.ts` : Contrôleur pour les routes de santé
- `src/controllers/documentsController.ts` : Contrôleur pour les routes de documents
- `src/controllers/ingestionController.ts` : Contrôleur pour les routes d'ingestion

## Validation des données

La validation des données est effectuée à l'aide de Zod, une bibliothèque de validation de schémas pour TypeScript. Chaque route définit un schéma Zod pour valider les paramètres de requête, les paramètres de chemin et le corps de la requête.

## Gestion des erreurs

Les erreurs sont gérées de manière cohérente dans toute l'API. Chaque route capture les erreurs et renvoie une réponse d'erreur formatée avec un code d'état HTTP approprié.

Exemple de réponse d'erreur :
```json
{
  "success": false,
  "message": "Erreur lors de la recherche",
  "error": "Message d'erreur détaillé"
}
```

## Configuration de l'application Fastify

La configuration de l'application Fastify est définie dans le fichier `src/app.ts`. Ce fichier configure les plugins, les hooks et les routes de l'application.

## Point d'entrée de l'application

Le point d'entrée de l'application est défini dans le fichier `src/index.ts`. Ce fichier importe la configuration de l'application et démarre le serveur.
