import { FastifyRequest } from 'fastify';

/**
 * Contrôleur pour la vérification de la santé de l'application
 */
export const healthController = {
  /**
   * Vérifie la santé de l'application
   */
  async checkHealth(_request: FastifyRequest) {
    return { status: 'ok' };
  }
};
