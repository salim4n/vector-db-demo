import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { semanticSearch } from '../../agent/tools/retrieval';
import { advancedFiltering } from '../../agent/tools/advanced-filtering';

/**
 * Routes pour la recherche de documents
 */
export default async function searchRoutes(fastify: FastifyInstance) {
  // Schéma Zod pour la recherche simple
  const SimpleSearchSchema = z.object({
    query: z.string().min(1).describe('Requête de recherche en langage naturel'),
    limit: z.number().positive().default(5).describe('Nombre maximum de résultats'),
    category: z.string().optional().describe('Filtrer par catégorie (optionnel)')
  });

  type SimpleSearchParams = z.infer<typeof SimpleSearchSchema>;

  // Schéma Zod pour la recherche avancée
  const AdvancedSearchSchema = z.object({
    query: z.string().min(1).describe('Requête de recherche en langage naturel'),
    limit: z.number().positive().default(5).describe('Nombre maximum de résultats'),
    scoreThreshold: z.number().min(0).max(1).optional().describe('Score minimum de similarité'),
    category: z.string().optional().describe('Catégorie principale exacte'),
    categories: z.array(z.string()).optional().describe('Liste des catégories à rechercher'),
    minScore: z.number().min(0).max(1).optional().describe('Score minimum pour les catégories'),
    reasoningKeywords: z.array(z.string()).optional().describe('Mots-clés dans le raisonnement')
  });

  type AdvancedSearchParams = z.infer<typeof AdvancedSearchSchema>;

  // Route pour la recherche simple
  fastify.get<{
    Querystring: SimpleSearchParams
  }>('/search', {
    schema: {
      tags: ['recherche'],
      summary: 'Recherche sémantique simple',
      description: 'Recherche des documents pertinents en fonction d\'une requête en langage naturel',
      querystring: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Requête de recherche' },
          limit: { type: 'number', default: 5, description: 'Nombre maximum de résultats' },
          category: { type: 'string', description: 'Filtrer par catégorie (optionnel)' }
        },
        required: ['query']
      },
      response: {
        200: {
          description: 'Résultats de la recherche',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            count: { type: 'integer' },
            query: { type: 'string' },
            documents: { 
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  content: { type: 'string' },
                  metadata: { type: 'object' }
                }
              }
            }
          }
        },
        500: {
          description: 'Erreur lors de la recherche',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            error: { type: 'string' }
          }
        }
      }
    },
    handler: async (request, reply) => {
      try {
        const { query, limit, category } = request.query;
        
        const documents = await semanticSearch({
          query,
          limit,
          category,
          includeReasoning: true
        });
        
        return {
          success: true,
          count: documents.length,
          query,
          documents: documents.map(doc => ({
            content: doc.pageContent,
            metadata: {
              ...doc.metadata,
              score: doc.metadata.score ? Math.round(doc.metadata.score * 100) / 100 : undefined
            }
          }))
        };
      } catch (error) {
        reply.log.error(error);
        return reply.status(500).send({ 
          success: false, 
          message: 'Erreur lors de la recherche',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });

  // Route pour la recherche avancée
  fastify.post<{
    Body: AdvancedSearchParams
  }>('/search/advanced', {
    schema: {
      tags: ['recherche'],
      summary: 'Recherche sémantique avancée',
      description: 'Recherche avancée combinant recherche sémantique et filtrage par catégories',
      body: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Requête de recherche' },
          limit: { type: 'number', default: 5, description: 'Nombre maximum de résultats' },
          scoreThreshold: { type: 'number', description: 'Score minimum de similarité' },
          category: { type: 'string', description: 'Catégorie principale exacte' },
          categories: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'Liste des catégories à rechercher' 
          },
          minScore: { type: 'number', description: 'Score minimum pour les catégories' },
          reasoningKeywords: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'Mots-clés dans le raisonnement' 
          }
        },
        required: ['query']
      },
      response: {
        200: {
          description: 'Résultats de la recherche avancée',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            count: { type: 'integer' },
            query: { type: 'string' },
            filters: { type: 'object' },
            documents: { 
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  content: { type: 'string' },
                  metadata: { type: 'object' }
                }
              }
            }
          }
        },
        500: {
          description: 'Erreur lors de la recherche',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            error: { type: 'string' }
          }
        }
      }
    },
    handler: async (request, reply) => {
      try {
        const { 
          query, limit, scoreThreshold, 
          category, categories, minScore, reasoningKeywords 
        } = request.body;
        
        // Première étape : recherche sémantique
        const semanticResults = await semanticSearch({
          query,
          limit: limit * 2, // On récupère plus de résultats pour le filtrage
          scoreThreshold,
          category,
          includeReasoning: true
        });
        
        // Deuxième étape : filtrage avancé si des critères sont spécifiés
        let finalResults = semanticResults;
        
        if ((categories && categories.length > 0) || minScore !== undefined || (reasoningKeywords && reasoningKeywords.length > 0)) {
          finalResults = await advancedFiltering({
            mainCategory: category,
            categories,
            minScore,
            reasoningKeywords,
            limit
          });
        }
        
        // Limiter les résultats
        finalResults = finalResults.slice(0, limit);
        
        return {
          success: true,
          count: finalResults.length,
          query,
          filters: {
            category,
            categories,
            minScore,
            reasoningKeywords,
            scoreThreshold
          },
          documents: finalResults.map(doc => ({
            content: doc.pageContent,
            metadata: {
              ...doc.metadata,
              score: doc.metadata.score ? Math.round(doc.metadata.score * 100) / 100 : undefined
            }
          }))
        };
      } catch (error) {
        reply.log.error(error);
        return reply.status(500).send({ 
          success: false, 
          message: 'Erreur lors de la recherche avancée',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });
}
