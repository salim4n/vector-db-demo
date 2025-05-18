import fs from 'fs';
import { parse } from 'csv-parse/sync';
import path from 'path';
import { QdrantClient } from '@qdrant/js-client-rest';
import { Document } from '@langchain/core/documents';
import { z } from 'zod';
import dotenv from 'dotenv';
import { OpenAIEmbeddings } from '@langchain/openai';
import { processEmbeddingsFile } from '../utils/csvCleaner';

dotenv.config();

// Schéma pour une catégorie avec score
const CategorySchema = z.object({
  name: z.string(),
  score: z.number().min(0).max(1),
});

// Schéma pour l'analyse des catégories
const CategoryAnalysisSchema = z.object({
  categories: z.array(CategorySchema),
  reasoning: z.string(),
});

// Schéma pour valider les données d'embedding nettoyées et catégorisées
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

type CleanedEmbeddingRecord = z.infer<typeof CleanedEmbeddingSchema>;

// Configuration Qdrant Cloud
const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
const qdrantApiKey = process.env.QDRANT_API_KEY;
const qdrantClusterName = process.env.QDRANT_CLUSTER_NAME;
const collectionName = process.env.QDRANT_COLLECTION || 'salim_embeddings';

// Vérifier que les variables d'environnement pour Qdrant Cloud sont définies
if (!qdrantApiKey && qdrantUrl.includes('cloud.qdrant.io')) {
  console.warn('QDRANT_API_KEY n\'est pas définie dans le fichier .env. La connexion à Qdrant Cloud pourrait échouer.');
}

// Configuration OpenAI pour les embeddings
if (!process.env.OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY n\'est pas définie dans le fichier .env. Les embeddings ne fonctionneront pas correctement.');
}

// Initialiser le modèle d'embeddings
// Note: Pour les embeddings, nous continuons à utiliser text-embedding-3-small car GPT_MODEL est pour les modèles de génération
const embeddings = new OpenAIEmbeddings({
  modelName: 'text-embedding-3-small', // Les modèles GPT ne sont pas adaptés pour les embeddings
  dimensions: 1536, // Dimension par défaut pour text-embedding-3-small
});

// Fonction pour générer des embeddings à partir du texte
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const embeddingResult = await embeddings.embedQuery(text);
    return embeddingResult;
  } catch (error) {
    console.error('Erreur lors de la génération de l\'embedding:', error);
    throw error;
  }
}

// Fonction pour créer une collection si elle n'existe pas
async function ensureCollection(client: QdrantClient, dimension: number): Promise<void> {
  try {
    const collections = await client.getCollections();
    const collectionExists = collections.collections.some(c => c.name === collectionName);

    if (!collectionExists) {
      console.log(`Création de la collection ${collectionName}...`);
      await client.createCollection(collectionName, {
        vectors: {
          size: dimension,
          distance: 'Cosine',
        },
      });
      console.log(`Collection ${collectionName} créée avec succès.`);
    } else {
      console.log(`Collection ${collectionName} existe déjà.`);
    }
  } catch (error) {
    console.error('Erreur lors de la vérification/création de la collection:', error);
    throw error;
  }
}

// Fonction pour nettoyer, catégoriser et ingérer les embeddings depuis un CSV
export async function ingestEmbeddingsFromCsv(
  filePath: string = path.resolve(__dirname, '../../data/salim-embeddings.csv')
): Promise<void> {
  try {
    // Étape 1: Nettoyer et catégoriser le CSV
    console.log('Nettoyage et catégorisation du fichier CSV...');
    const cleanedFilePath = path.resolve(__dirname, '../../data/cleaned-embeddings.csv');
    const categorizedFilePath = path.resolve(__dirname, '../../data/categorized-embeddings.csv');
    
    await processEmbeddingsFile(filePath, cleanedFilePath, categorizedFilePath);
    
    // Étape 2: Lire le fichier catégorisé
    console.log(`Lecture du fichier catégorisé: ${categorizedFilePath}`);
    const fileContent = fs.readFileSync(categorizedFilePath, 'utf-8');
    
    // Analyser le CSV avec le séparateur point-virgule
    const records = parse(fileContent, {
      columns: true,
      delimiter: ';',
      skip_empty_lines: true,
    });

    // Valider et transformer les données
    const validRecords: CleanedEmbeddingRecord[] = [];
    for (const record of records) {
      try {
        const validRecord = CleanedEmbeddingSchema.parse(record);
        validRecords.push(validRecord);
      } catch (error) {
        console.warn('Enregistrement invalide ignoré:', error);
      }
    }

    if (validRecords.length === 0) {
      throw new Error('Aucun enregistrement valide trouvé dans le CSV catégorisé');
    }

    console.log(`${validRecords.length} enregistrements valides trouvés.`);

    // Initialiser le client Qdrant avec l'API key si disponible
    const qdrantConfig: any = { url: qdrantUrl };
    if (qdrantApiKey) {
      qdrantConfig.apiKey = qdrantApiKey;
    }
    const client = new QdrantClient(qdrantConfig);

    // Définir la dimension des embeddings pour OpenAI
    const dimension = 1536; // Dimension pour text-embedding-3-small
    console.log(`Dimension des embeddings: ${dimension}`);

    // Assurer que la collection existe
    await ensureCollection(client, dimension);

    // Préparer et insérer les points par lots
    const batchSize = 10; // Taille de lot réduite pour éviter de surcharger l'API OpenAI
    
    for (let i = 0; i < validRecords.length; i += batchSize) {
      const batch = validRecords.slice(i, i + batchSize);
      console.log(`Traitement du lot ${Math.floor(i / batchSize) + 1}/${Math.ceil(validRecords.length / batchSize)}...`);
      
      // Générer les embeddings pour chaque texte du lot
      const pointPromises = batch.map(async (record) => {
        try {
          const embedding = await generateEmbedding(record.text);
          
          // Parser l'analyse des catégories si disponible
          let categoryAnalysis = null;
          if (record.category_analysis_json) {
            try {
              categoryAnalysis = JSON.parse(record.category_analysis_json);
            } catch (error) {
              console.warn(`Erreur lors du parsing de l'analyse des catégories pour l'enregistrement ${record.id}:`, error);
            }
          }
          
          return {
            id: record.id,
            vector: embedding,
            payload: {
              project_id: record.project_id,
              asset_id: record.asset_id,
              content_type: record.content_type,
              text: record.text,
              category: record.category || 'Non catégorisé',
              category_analysis: categoryAnalysis,
              created_at: record.created_at,
              updated_at: record.updated_at,
            },
          };
        } catch (error) {
          console.error(`Erreur lors de la génération de l'embedding pour l'enregistrement ${record.id}:`, error);
          return null;
        }
      });
      
      const points = (await Promise.all(pointPromises)).filter(point => point !== null);
      
      if (points.length > 0) {
        console.log(`Insertion de ${points.length} points...`);
        await client.upsert(collectionName, {
          points: points,
        });
      }
    }

    console.log(`Ingestion terminée. Les embeddings ont été insérés dans Qdrant.`);
  } catch (error) {
    console.error('Erreur lors de l\'ingestion des embeddings:', error);
    throw error;
  }
}

// Fonction pour convertir les données Qdrant en documents LangChain
export async function getDocumentsFromQdrant(category?: string): Promise<Document[]> {
  try {
    // Initialiser le client Qdrant avec l'API key si disponible
    const qdrantConfig: any = { url: qdrantUrl };
    if (qdrantApiKey) {
      qdrantConfig.apiKey = qdrantApiKey;
    }
    const client = new QdrantClient(qdrantConfig);
    
    // Vérifier que la collection existe
    const collections = await client.getCollections();
    const collectionExists = collections.collections.some(c => c.name === collectionName);
    
    if (!collectionExists) {
      throw new Error(`La collection ${collectionName} n'existe pas.`);
    }
    
    // Préparer le filtre par catégorie si spécifié
    const filter = category ? {
      must: [{
        key: 'category',
        match: {
          value: category
        }
      }]
    } : undefined;
    
    // Récupérer tous les points (avec pagination si nécessaire)
    const limit = 1000;
    let offset = 0;
    const allPoints = [];
    
    while (true) {
      const response = await client.scroll(collectionName, {
        limit,
        offset,
        filter
      });
      
      if (response.points.length === 0) {
        break;
      }
      
      allPoints.push(...response.points);
      offset += response.points.length;
      
      if (response.points.length < limit) {
        break;
      }
    }
    
    // Convertir en documents LangChain
    const documents = allPoints.map(point => {
      const payload = point.payload ?? {};
      return new Document({
        pageContent: payload.text as string,
        metadata: {
          id: point.id,
          project_id: payload.project_id as string,
          asset_id: payload.asset_id as string,
          content_type: payload.content_type as string,
          category: payload.category as string,
          category_analysis: payload.category_analysis ? JSON.stringify(payload.category_analysis) : undefined,
          created_at: payload.created_at as string,
          updated_at: payload.updated_at as string,
        },
      });
    });
    
    return documents;
  } catch (error) {
    console.error('Erreur lors de la récupération des documents depuis Qdrant:', error);
    throw error;
  }
}

// Exécuter l'ingestion si ce fichier est appelé directement
if (require.main === module) {
  ingestEmbeddingsFromCsv()
    .then(() => console.log('Ingestion terminée avec succès.'))
    .catch(error => console.error('Erreur lors de l\'ingestion:', error));
}
