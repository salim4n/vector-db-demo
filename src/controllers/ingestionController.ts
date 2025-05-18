import { FastifyReply, FastifyRequest } from 'fastify';
import { ingestEmbeddingsFromCsv } from '../ingestion/csvIngestion';

/**
 * Contrôleur pour la gestion de l'ingestion des données
 */
export const ingestionController = {
  /**
   * Déclenche le processus d'ingestion des embeddings
   */
  async ingestData(_request: FastifyRequest, reply: FastifyReply) {
    try {
      await ingestEmbeddingsFromCsv();
      return { 
        success: true, 
        message: 'Ingestion des embeddings terminée avec succès' 
      };
    } catch (error) {
      reply.log.error(error);
      return reply.status(500).send({ 
        success: false, 
        message: 'Erreur lors de l\'ingestion des embeddings',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
};
