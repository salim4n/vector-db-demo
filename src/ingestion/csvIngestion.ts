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
const embeddings = new OpenAIEmbeddings({
  modelName: 'text-embedding-3-small', 
  dimensions: 1536, // Dimension par défaut pour text-embedding-3-small
});

/**
 * Génère des embeddings à partir du texte.
 * 
 * @param text - Texte à vectoriser.
 * @returns Un tableau d'embeddings.
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const embeddingResult = await embeddings.embedQuery(text);
    return embeddingResult;
  } catch (error) {
    console.error('Erreur lors de la génération de l\'embedding:', error);
    throw error;
  }
}

/**
 * Assure que la collection existe dans Qdrant.
 * 
 * Si la collection n'existe pas, elle est créée avec la dimension spécifiée.
 * 
 * @param client - Client Qdrant.
 * @param dimension - Dimension des embeddings.
 * @returns Une promesse qui se résout lorsque la collection est assurée.
 */
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
      
      // Créer un index pour le champ category
      console.log(`Création d'un index pour le champ 'category'...`);
      try {
        await client.createPayloadIndex(collectionName, {
          field_name: 'category',
          field_schema: 'keyword',
        });
        console.log(`Index pour 'category' créé avec succès.`);
      } catch (indexError) {
        console.warn(`Erreur lors de la création de l'index pour 'category':`, indexError);
        // On continue même si l'index n'a pas pu être créé
      }
      
      console.log(`Collection ${collectionName} créée avec succès.`);
    } else {
      console.log(`Collection ${collectionName} existe déjà.`);
      
      // Vérifier si l'index pour category existe, sinon le créer
      try {
        console.log(`Vérification de l'index pour le champ 'category'...`);
        await client.createPayloadIndex(collectionName, {
          field_name: 'category',
          field_schema: 'keyword',
        });
        console.log(`Index pour 'category' créé avec succès.`);
      } catch (indexError: any) {
        // Si l'erreur indique que l'index existe déjà, c'est OK
        if (indexError.message && indexError.message.includes('already exists')) {
          console.log(`L'index pour 'category' existe déjà.`);
        } else {
          console.warn(`Erreur lors de la création de l'index pour 'category':`, indexError);
          // On continue même si l'index n'a pas pu être créé
        }
      }
    }
  } catch (error) {
    console.error('Erreur lors de la vérification/création de la collection:', error);
    throw error;
  }
}

  /**
   * Ingeste les données d'embeddings à partir d'un fichier CSV.
   * 
   * @param filePath - Chemin du fichier CSV contenant les données d'embeddings.
   * @returns Une promesse qui se résout lorsque l'ingestion est terminée.
   */
export async function ingestEmbeddingsFromCsv(
  filePath: string = path.resolve(__dirname, '../../data/salim-embeddings.csv')
): Promise<void> {
  try {
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

/**
 * Récupère les documents stockés dans Qdrant.
 * 
 * @param category - Optionnel, filtre les documents par catégorie.
 * @returns Une promesse qui se résout en un tableau de documents.
 */
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
      must: [
        {
          key: "category",
          match: {
            value: category
          }
        }
      ]
    } : undefined;
    
    console.log('Filtre appliqué:', JSON.stringify(filter, null, 2));
    
    // Récupérer tous les points (avec pagination si nécessaire)
    const limit = 1000;
    let offset = 0;
    const allPoints = [];
    
    try {
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
    } catch (scrollError: any) {
      // Si l'erreur est liée à l'index manquant et qu'une catégorie est spécifiée
      if (category && scrollError.data && scrollError.data.status && 
          scrollError.data.status.error && 
          scrollError.data.status.error.includes('Index required but not found')) {
        console.warn(`Index manquant pour la recherche par catégorie. Récupération de tous les documents et filtrage côté serveur.`);
        
        // Récupérer tous les documents sans filtre puis filtrer manuellement
        while (true) {
          const response = await client.scroll(collectionName, {
            limit,
            offset
          });
          
          if (response.points.length === 0) {
            break;
          }
          
          // Filtrer manuellement par catégorie
          const filteredPoints = response.points.filter(point => 
            point.payload && point.payload.category === category
          );
          
          allPoints.push(...filteredPoints);
          offset += response.points.length;
          
          if (response.points.length < limit) {
            break;
          }
        }
      } else {
        // Si c'est une autre erreur, la propager
        throw scrollError;
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



/**
 * Ajoute un index pour le champ category à la collection existante.
 * 
 * Si l'index existe déjà, l'opération est ignorée. L'index est utilisé pour améliorer
 * les performances de recherche par catégorie.
 * 
 * @returns Une promesse qui se résout lorsque l'index a été ajouté.
 */
export async function addCategoryIndex(): Promise<void> {
  try {
    console.log('Ajout d\'un index pour le champ category à la collection existante...');
    
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
    
    // Créer l'index pour le champ category
    try {
      await client.createPayloadIndex(collectionName, {
        field_name: 'category',
        field_schema: 'keyword',
      });
      console.log(`Index pour 'category' créé avec succès.`);
    } catch (indexError: any) {
      // Si l'erreur indique que l'index existe déjà, c'est OK
      if (indexError.message && indexError.message.includes('already exists')) {
        console.log(`L'index pour 'category' existe déjà.`);
      } else {
        console.error(`Erreur lors de la création de l'index pour 'category':`, indexError);
        throw indexError;
      }
    }
  } catch (error) {
    console.error('Erreur lors de l\'ajout de l\'index de catégorie:', error);
    throw error;
  }
}

if (require.main === module) {
  // Si le script est exécuté directement, vérifier les arguments
  const args = process.argv.slice(2);
  if (args.includes('--add-index')) {
    addCategoryIndex()
      .then(() => console.log('Ajout d\'index terminé avec succès.'))
      .catch(error => console.error('Erreur lors de l\'ajout d\'index:', error));
  } else {
    ingestEmbeddingsFromCsv()
      .then(() => console.log('Ingestion terminée avec succès.'))
      .catch(error => console.error('Erreur lors de l\'ingestion:', error));
  }
}
