# Vue d'ensemble du projet Vector-DB-Demo

## Introduction

Vector-DB-Demo est une application de démonstration qui illustre l'utilisation d'une base de données vectorielle (Qdrant) pour stocker, catégoriser et rechercher des documents de manière sémantique. Le projet combine plusieurs technologies modernes pour créer un système de recherche intelligent capable de comprendre le contexte et la sémantique des requêtes.

## Architecture du projet

L'architecture du projet est organisée autour de plusieurs composants clés :

### 1. Base de données vectorielle (Qdrant)

Qdrant est utilisé comme base de données vectorielle pour stocker les embeddings des documents. Les embeddings sont des représentations vectorielles du contenu textuel, générées à l'aide du modèle OpenAI (text-embedding-3-small).

### 2. API REST (Fastify)

Une API REST construite avec Fastify expose les fonctionnalités de recherche et de gestion des documents. Les routes sont organisées de manière modulaire pour faciliter la maintenance et l'extension du projet.

### 3. Agent ReAct

Un agent ReAct (Reasoning and Acting) basé sur LangChain utilise des outils spécialisés pour interagir avec la base de données vectorielle et répondre aux requêtes des utilisateurs de manière intelligente.

### 4. Outils d'agent

Plusieurs outils sont mis à la disposition de l'agent pour effectuer différentes tâches :
- Recherche sémantique (retrieval.ts)
- Filtrage par catégorie (filter-per-category.ts)
- Filtrage avancé (advanced-filtering.ts)

### 5. Système d'ingestion

Un système d'ingestion permet d'importer des données depuis des fichiers CSV, de les nettoyer, de les catégoriser et de les stocker dans la base de données vectorielle.

## Flux de données

1. **Ingestion** : Les documents sont importés depuis des fichiers CSV, nettoyés et catégorisés.
2. **Vectorisation** : Le texte des documents est transformé en embeddings à l'aide du modèle OpenAI.
3. **Stockage** : Les embeddings et les métadonnées sont stockés dans Qdrant.
4. **Recherche** : Les requêtes des utilisateurs sont transformées en embeddings et comparées aux documents stockés.
5. **Filtrage** : Les résultats peuvent être filtrés par catégorie ou selon des critères avancés.
6. **Présentation** : Les résultats sont formatés et renvoyés à l'utilisateur.

## Structure des dossiers

```
vector-db-demo/
├── agent/                  # Agent ReAct et ses outils
│   ├── react-agent.ts      # Implémentation de l'agent ReAct
│   └── tools/              # Outils utilisés par l'agent
│       ├── advanced-filtering.ts
│       ├── filter-per-category.ts
│       ├── react-tool-wrappers.ts
│       └── retrieval.ts
├── data/                   # Données d'exemple et fichiers CSV
├── docs/                   # Documentation du projet
├── src/                    # Code source principal
│   ├── app.ts              # Configuration de l'application Fastify
│   ├── controllers/        # Contrôleurs pour les routes
│   ├── index.ts            # Point d'entrée de l'application
│   ├── ingestion/          # Logique d'ingestion des données
│   ├── routes/             # Définition des routes de l'API
│   └── utils/              # Utilitaires
└── test/                   # Tests
```

## Configuration

Le projet utilise des variables d'environnement pour la configuration, notamment pour les connexions à Qdrant et OpenAI. Ces variables peuvent être définies dans un fichier `.env` à la racine du projet.

Variables d'environnement importantes :
- `QDRANT_URL` : URL du serveur Qdrant (par défaut : http://localhost:6333)
- `QDRANT_API_KEY` : Clé API pour Qdrant Cloud (optionnel)
- `QDRANT_COLLECTION` : Nom de la collection Qdrant (par défaut : salim_embeddings)
- `OPENAI_API_KEY` : Clé API OpenAI pour les embeddings et le modèle de langage
- `GPT_MODEL` : Modèle GPT à utiliser pour l'agent ReAct
