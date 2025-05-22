import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { documentsController } from '../controllers/documentsController';

/**
 * Routes pour la gestion des documents
 */
export default async function documentsRoutes(fastify: FastifyInstance) {
  // Schéma Zod pour les paramètres de requête
  const DocumentsQueryParamsSchema = z.object({
    category: z.string().optional(),
  });

  type DocumentsQueryParams = z.infer<typeof DocumentsQueryParamsSchema>;

  // Route pour récupérer tous les documents avec filtrage optionnel par catégorie
  fastify.get<{
    Querystring: DocumentsQueryParams
  }>('/documents', {
    schema: {
      tags: ['documents'],
      summary: 'Récupère les documents stockés dans Qdrant',
      description: 'Retourne tous les documents ou filtrés par catégorie',
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Catégorie pour filtrer les documents' }
        }
      },
      response: {
        200: {
          description: 'Liste des documents',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            count: { type: 'integer' },
            category: { type: 'string' },
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
          description: 'Erreur lors de la récupération',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            error: { type: 'string' }
          }
        }
      }
    },
    handler: documentsController.getDocuments
  });

  // Route pour récupérer les catégories disponibles
  // fastify.get('/categories', {
  //   schema: {
  //     tags: ['catégories'],
  //     summary: 'Récupère les catégories disponibles',
  //     description: 'Retourne toutes les catégories avec leurs statistiques',
  //     response: {
  //       200: {
  //         description: 'Liste des catégories',
  //         type: 'object',
  //         properties: {
  //           success: { type: 'boolean' },
  //           count: { type: 'integer' },
  //           categories: { 
  //             type: 'array',
  //             items: {
  //               type: 'object',
  //               properties: {
  //                 name: { type: 'string' },
  //                 count: { type: 'integer' },
  //                 averageScore: { type: 'number' }
  //               }
  //             }
  //           },
  //           mainCategories: {
  //             type: 'array',
  //             items: { type: 'string' }
  //           }
  //         }
  //       },
  //       500: {
  //         description: 'Erreur lors de la récupération',
  //         type: 'object',
  //         properties: {
  //           success: { type: 'boolean' },
  //           message: { type: 'string' },
  //           error: { type: 'string' }
  //         }
  //       }
  //     }
  //   },
  //   handler: documentsController.getCategories
  // });
}
