import { FastifyInstance } from 'fastify';
import { healthController } from '../controllers/healthController';

/**
 * Routes pour la vérification de la santé de l'application
 */
export default async function healthRoutes(fastify: FastifyInstance) {
  // Route pour la santé de l'application
  fastify.get('/health', {
    schema: {
      tags: ['santé'],
      summary: 'Vérifie la santé de l\'application',
      description: 'Retourne le statut de l\'application',
      response: {
        200: {
          description: 'Application en bon état',
          type: 'object',
          properties: {
            status: { type: 'string' }
          }
        }
      }
    },
    handler: healthController.checkHealth
  });
}
