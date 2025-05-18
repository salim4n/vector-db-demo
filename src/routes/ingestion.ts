import { FastifyInstance } from 'fastify';
import { ingestionController } from '../controllers/ingestionController';

/**
 * Routes pour l'ingestion des données
 */
export default async function ingestionRoutes(fastify: FastifyInstance) {
  // Route pour déclencher l'ingestion des embeddings
  fastify.post('/ingest', {
    schema: {
      tags: ['ingestion'],
      summary: 'Déclenche le processus d\'ingestion des embeddings',
      description: 'Nettoie, catégorise et ingère les données CSV dans Qdrant',
      response: {
        200: {
          description: 'Ingestion réussie',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        500: {
          description: 'Erreur lors de l\'ingestion',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            error: { type: 'string' }
          }
        }
      }
    },
    handler: ingestionController.ingestData
  });
}
