# Utilitaires

Cette section documente les utilitaires utilisés dans le projet Vector-DB-Demo.

## Introduction

Les utilitaires sont des fonctions et des classes qui fournissent des fonctionnalités communes utilisées dans différentes parties du projet. Ils sont définis dans le dossier `src/utils/`.

## Nettoyeur CSV (csvCleaner.ts)

Le fichier `src/utils/csvCleaner.ts` contient des fonctions pour nettoyer et catégoriser les données d'embeddings à partir de fichiers CSV.

### Fonctions principales

#### processEmbeddingsFile

```typescript
async function processEmbeddingsFile(
  inputFilePath: string,
  outputCleanedFilePath: string,
  outputCategorizedFilePath: string
): Promise<void>
```

Cette fonction traite un fichier d'embeddings en effectuant les étapes suivantes :

1. Nettoyage des données : suppression des lignes invalides, normalisation des formats, etc.
2. Catégorisation des documents : attribution d'une catégorie principale à chaque document
3. Analyse des catégories : génération d'une analyse détaillée des catégories pour chaque document
4. Écriture des données nettoyées et catégorisées dans des fichiers de sortie

#### cleanEmbeddingsFile

```typescript
async function cleanEmbeddingsFile(
  inputFilePath: string,
  outputFilePath: string
): Promise<void>
```

Cette fonction nettoie un fichier d'embeddings en effectuant les opérations suivantes :

1. Lecture du fichier CSV d'entrée
2. Suppression des lignes invalides ou incomplètes
3. Normalisation des formats de données
4. Écriture des données nettoyées dans un fichier de sortie

#### categorizeEmbeddingsFile

```typescript
async function categorizeEmbeddingsFile(
  inputFilePath: string,
  outputFilePath: string
): Promise<void>
```

Cette fonction catégorise un fichier d'embeddings nettoyé en effectuant les opérations suivantes :

1. Lecture du fichier CSV nettoyé
2. Analyse du contenu de chaque document pour déterminer sa catégorie principale
3. Génération d'une analyse détaillée des catégories pour chaque document
4. Écriture des données catégorisées dans un fichier de sortie

#### analyzeCategories

```typescript
async function analyzeCategories(text: string): Promise<CategoryAnalysis>
```

Cette fonction analyse le contenu d'un document pour déterminer ses catégories possibles. Elle utilise un modèle de langage pour générer une analyse des catégories, qui comprend :

1. Une liste de catégories possibles avec des scores de confiance
2. Un raisonnement expliquant pourquoi ces catégories ont été attribuées

L'analyse est retournée sous forme d'objet `CategoryAnalysis` contenant les catégories et le raisonnement.

## Autres utilitaires

### Validation de schémas

Le projet utilise Zod pour la validation des schémas. Les schémas sont définis dans les fichiers correspondants aux fonctionnalités qu'ils valident.

Exemple de schéma Zod :

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

### Gestion des erreurs

Le projet utilise un système de gestion des erreurs cohérent dans toutes les parties du code. Les erreurs sont capturées, journalisées et propagées de manière appropriée.

Exemple de gestion d'erreur :

```typescript
try {
  // Code qui peut générer une erreur
} catch (error) {
  console.error('Message d\'erreur descriptif:', error);
  throw error; // Ou renvoyer une erreur formatée
}
```

### Journalisation

Le projet utilise la journalisation pour suivre l'exécution du code et diagnostiquer les problèmes. Les messages de journalisation sont formatés de manière cohérente et incluent des informations contextuelles.

Exemple de journalisation :

```typescript
console.log('Nettoyage et catégorisation du fichier CSV...');
console.warn('QDRANT_API_KEY n\'est pas définie dans le fichier .env. La connexion à Qdrant Cloud pourrait échouer.');
console.error('Erreur lors de la génération de l\'embedding:', error);
```

## Configuration

La configuration des utilitaires est généralement effectuée à l'aide de variables d'environnement définies dans un fichier `.env` à la racine du projet. Le module `dotenv` est utilisé pour charger ces variables.

Exemple de configuration :

```typescript
import dotenv from 'dotenv';

dotenv.config();

const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
const qdrantApiKey = process.env.QDRANT_API_KEY;
const collectionName = process.env.QDRANT_COLLECTION || 'salim_embeddings';
```

## Bonnes pratiques

Les utilitaires du projet suivent plusieurs bonnes pratiques :

1. **Modularité** : Chaque utilitaire a une responsabilité unique et bien définie
2. **Réutilisabilité** : Les utilitaires sont conçus pour être réutilisés dans différentes parties du projet
3. **Validation** : Les entrées et les sorties sont validées à l'aide de schémas Zod
4. **Gestion des erreurs** : Les erreurs sont capturées et traitées de manière appropriée
5. **Journalisation** : Des messages de journalisation sont utilisés pour suivre l'exécution du code
6. **Configuration** : La configuration est effectuée à l'aide de variables d'environnement
7. **Documentation** : Les fonctions et les classes sont documentées à l'aide de commentaires JSDoc
