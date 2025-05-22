import { QdrantClient } from '@qdrant/js-client-rest';
import { Document } from '@langchain/core/documents';
import { StructuredTool } from '@langchain/core/tools';
import { OpenAIEmbeddings } from '@langchain/openai';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Configuration de l'embedding model
const embeddings = new OpenAIEmbeddings({
  modelName: 'text-embedding-3-small',
  dimensions: 1536, // Dimension par défaut pour text-embedding-3-small
});

// Configuration du client Qdrant
const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
const qdrantApiKey = process.env.QDRANT_API_KEY;
const collectionName = process.env.QDRANT_COLLECTION || 'salim_embeddings';

/**
 * Schéma Zod pour les options de recherche sémantique
 */
const semanticSearchSchema = z.object({
  query: z.string().min(1).describe('Requête de recherche en langage naturel'),
  limit: z.number().positive().default(5).describe('Nombre maximum de résultats à retourner'),
  scoreThreshold: z.number().min(0).max(1).optional().describe('Score minimum de similarité (entre 0 et 1)'),
  category: z.string().optional().describe('Filtrer les résultats par catégorie spécifique'),
  includeReasoning: z.boolean().default(true).describe('Inclure le raisonnement dans les résultats')
});

/**
 * Type dérivé du schéma Zod pour les options de recherche
 */
type SemanticSearchOptions = z.infer<typeof semanticSearchSchema>;

/**
 * Effectue une recherche sémantique dans la base de données vectorielle.
 *
 * Cette fonction prend une requête en langage naturel, la convertit en vecteur d'embedding
 * et recherche les documents les plus similaires dans la base de données Qdrant.
 * 
 * @param options - Options de recherche incluant la requête, la limite de résultats,
 * le seuil de score, la catégorie pour filtrer et si on doit inclure le raisonnement
 * 
 * @returns Une promesse qui se résout en un tableau de documents correspondant à la requête
 */
export async function semanticSearch(options: SemanticSearchOptions): Promise<Document[]> {
  try {
    // Générer l'embedding pour la requête
    const queryEmbedding = await embeddings.embedQuery(options.query);
    
    // Initialiser le client Qdrant
    const client = new QdrantClient({
      url: qdrantUrl,
      ...(qdrantApiKey ? { apiKey: qdrantApiKey } : {})
    });
    
    // Préparer le filtre par catégorie si spécifié
    const filter = options.category ? {
      must: [{
        key: 'category',
        match: { value: options.category }
      }]
    } : undefined;
    
    // Effectuer la recherche par similarité
    const searchResults = await client.search(collectionName, {
      vector: queryEmbedding,
      limit: options.limit,
      filter,
      with_payload: true,
      score_threshold: options.scoreThreshold
    });
    
    // Convertir les résultats en documents LangChain
    return searchResults.map(result => {
      const payload = result.payload || {};
      
      // Traiter l'analyse des catégories
      let categoryAnalysis = undefined;
      if (payload.category_analysis && options.includeReasoning) {
        try {
          categoryAnalysis = typeof payload.category_analysis === 'string'
            ? JSON.parse(payload.category_analysis)
            : payload.category_analysis;
        } catch (error) {
          console.warn('Erreur lors du parsing de l\'analyse des catégories:', error);
        }
      }
      
      return new Document({
        pageContent: payload.text as string,
        metadata: {
          id: result.id,
          score: result.score,
          project_id: payload.project_id as string,
          asset_id: payload.asset_id as string,
          content_type: payload.content_type as string,
          category: payload.category as string,
          category_analysis: categoryAnalysis,
          created_at: payload.created_at as string,
          updated_at: payload.updated_at as string,
        },
      });
    });
  } catch (error) {
    console.error('Erreur lors de la recherche sémantique:', error);
    throw error;
  }
}

/**
 * Outil d'agent pour la recherche sémantique dans la base de documents.
 *
 * Cet outil permet à l'agent de rechercher des documents pertinents en fonction d'une requête
 * en langage naturel. Il utilise les embeddings pour trouver les documents sémantiquement
 * similaires à la requête.
 *
 * Les options de recherche incluent:
 * - `query`: la requête en langage naturel
 * - `limit`: nombre maximum de résultats (défaut: 5)
 * - `scoreThreshold`: score minimum de similarité (optionnel)
 * - `category`: filtrer par catégorie spécifique (optionnel)
 * - `includeReasoning`: inclure le raisonnement dans les résultats (défaut: true)
 */
export class SemanticSearchTool extends StructuredTool<typeof semanticSearchSchema> {
  name = 'semanticSearch';
  description = 'Recherche des documents pertinents en fonction d\'une requête en langage naturel. Utile pour trouver des informations spécifiques dans la base de documents.';
  schema = semanticSearchSchema;

  async _call(options: SemanticSearchOptions): Promise<string> {
    try {
      const documents = await semanticSearch(options);
      return JSON.stringify({
        success: true,
        count: documents.length,
        query: options.query,
        documents: documents.map(doc => ({
          content: doc.pageContent,
          metadata: {
            ...doc.metadata,
            // Formatage pour l'affichage
            score: doc.metadata.score ? Math.round(doc.metadata.score * 100) / 100 : undefined,
            // Assurons-nous que category_analysis est bien formaté pour JSON
            category_analysis: doc.metadata.category_analysis
          }
        }))
      }, null, 2);
    } catch (error) {
      return JSON.stringify({
        success: false,
        query: options.query,
        error: error instanceof Error ? error.message : String(error)
      }, null, 2);
    }
  }
}

/**
 * Instance de l'outil de recherche sémantique prête à l'emploi
 */
export const semanticSearchTool = new SemanticSearchTool();
