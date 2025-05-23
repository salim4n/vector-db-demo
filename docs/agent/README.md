# Agent ReAct et ses outils

Cette section documente l'agent ReAct (Reasoning and Acting) et les outils qu'il utilise pour interagir avec la base de données vectorielle.

## Introduction à l'agent ReAct

L'agent ReAct est un agent basé sur LangChain qui utilise un modèle de langage (GPT) pour raisonner et agir en fonction des requêtes des utilisateurs. Il combine le raisonnement et l'action en utilisant des outils spécialisés pour interagir avec la base de données vectorielle.

Fichier principal : `agent/react-agent.ts`

## Configuration de l'agent

L'agent peut être configuré avec les paramètres suivants :

- `model` : Modèle de langage à utiliser (par défaut : défini dans la variable d'environnement GPT_MODEL)
- `temperature` : Température pour la génération (0-1) (par défaut : 0)
- `tools` : Outils à mettre à disposition de l'agent (par défaut : 'all')
- `verbose` : Mode verbose pour le debugging (par défaut : false)

## Fonctions principales

### createVectorDBAgent

```typescript
async function createVectorDBAgent(config: AgentConfig = {}): Promise<AgentExecutor>
```

Cette fonction crée un agent ReAct avec les outils spécifiés et le modèle de langage configuré. Elle retourne un exécuteur d'agent qui peut être utilisé pour traiter les requêtes.

### queryVectorDBAgent

```typescript
async function queryVectorDBAgent(query: string, config: AgentConfig = DEFAULT_CONFIG): Promise<string>
```

Cette fonction utilitaire permet d'exécuter une requête avec l'agent. Elle prend en paramètre une requête en langage naturel et une configuration optionnelle pour l'agent, et retourne la réponse de l'agent.

## Outils de l'agent

L'agent utilise plusieurs outils pour interagir avec la base de données vectorielle. Ces outils sont définis dans le dossier `agent/tools/`.

### 1. Recherche sémantique (retrieval.ts)

Fichier : `agent/tools/retrieval.ts`

Cet outil permet de rechercher des documents pertinents en fonction d'une requête en langage naturel. Il utilise les embeddings pour trouver les documents sémantiquement similaires à la requête.

#### Fonctions principales

##### semanticSearch

```typescript
async function semanticSearch(options: SemanticSearchOptions): Promise<Document[]>
```

Cette fonction effectue une recherche sémantique dans la base de données vectorielle. Elle prend en paramètre des options de recherche (requête, limite, seuil de score, catégorie, etc.) et retourne une promesse qui se résout en un tableau de documents correspondant à la requête.

Options de recherche :
- `query` : Requête de recherche en langage naturel
- `limit` : Nombre maximum de résultats à retourner (défaut : 5)
- `scoreThreshold` : Score minimum de similarité (entre 0 et 1)
- `category` : Filtrer les résultats par catégorie spécifique
- `includeReasoning` : Inclure le raisonnement dans les résultats (défaut : true)

##### SemanticSearchTool

Classe qui étend `StructuredTool` pour fournir un outil de recherche sémantique à l'agent. Elle utilise Zod pour la validation des paramètres.

### 2. Filtrage par catégorie (filter-per-category.ts)

Fichier : `agent/tools/filter-per-category.ts`

Cet outil permet de filtrer les documents par catégorie. Il est utile lorsque l'utilisateur souhaite voir uniquement les documents d'une catégorie spécifique.

#### Fonctions principales

##### filterPerCategory

```typescript
async function filterPerCategory(category: string): Promise<Document[]>
```

Cette fonction filtre les documents par catégorie. Elle prend en paramètre une catégorie et retourne une promesse qui se résout en un tableau de documents correspondant à la catégorie spécifiée.

##### FilterPerCategoryTool

Classe qui étend `StructuredTool` pour fournir un outil de filtrage par catégorie à l'agent. Elle utilise Zod pour la validation des paramètres.

##### filterPerCategoryDynamicTool

Version alternative utilisant `DynamicTool` avec validation Zod manuelle. Cette approche est également valide et montre comment utiliser Zod avec DynamicTool.

### 3. Filtrage avancé (advanced-filtering.ts)

Fichier : `agent/tools/advanced-filtering.ts`

Cet outil permet de filtrer les documents avec des critères avancés comme les catégories, les scores et les mots-clés. Il est utile pour des recherches plus complexes.

#### Fonctions principales

##### advancedFiltering

```typescript
async function advancedFiltering(options: AdvancedFilteringOptions): Promise<Document[]>
```

Cette fonction filtre les documents avec des critères avancés. Elle prend en paramètre des options de filtrage et retourne une promesse qui se résout en un tableau de documents correspondant aux critères spécifiés.

Options de filtrage :
- `mainCategory` : Catégorie principale exacte
- `categories` : Liste des catégories à rechercher
- `minScore` : Score minimum pour les catégories
- `reasoningKeywords` : Mots-clés dans le raisonnement
- `limit` : Nombre maximum de résultats à retourner

##### AdvancedFilteringTool

Classe qui étend `StructuredTool` pour fournir un outil de filtrage avancé à l'agent. Elle utilise Zod pour la validation des paramètres.

### 4. Wrappers d'outils ReAct (react-tool-wrappers.ts)

Fichier : `agent/tools/react-tool-wrappers.ts`

Ce fichier contient des wrappers pour les outils de l'agent, adaptés au format ReAct. Ces wrappers permettent d'utiliser les outils dans l'agent ReAct de manière plus flexible.

## Utilisation de l'agent

L'agent peut être utilisé de la manière suivante :

```typescript
import { queryVectorDBAgent } from './agent/react-agent';

// Exemple d'utilisation de l'agent
const query = "Trouve-moi des documents sur la programmation";
const response = await queryVectorDBAgent(query);
console.log(response);
```

L'agent analysera la requête, utilisera les outils appropriés pour rechercher des documents pertinents, et formulera une réponse en langage naturel.
