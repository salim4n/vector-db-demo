import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { queryVectorDBAgent } from '../../agent/react-agent';
import { filterPerCategoryTool } from '../../agent/tools/filter-per-category';
import { advancedFilteringTool } from '../../agent/tools/advanced-filtering';
import { semanticSearchTool } from '../../agent/tools/retrieval';

// Liste des outils disponibles pour l'agent
const AVAILABLE_TOOLS = [
  filterPerCategoryTool.name,
  advancedFilteringTool.name,
  semanticSearchTool.name
];

/**
 * Routes pour l'agent ReAct
 */
export default async function agentRoutes(fastify: FastifyInstance) {
  // Schéma Zod pour les requêtes à l'agent
  const AgentQuerySchema = z.object({
    query: z.string().min(1).describe('Requête en langage naturel pour l\'agent'),
    verbose: z.boolean().default(false).describe('Mode verbeux pour voir le raisonnement de l\'agent'),
    tools: z.array(z.enum([...AVAILABLE_TOOLS, 'all'] as unknown as [string, ...string[]]))
      .default(['all'])
      .describe('Outils spécifiques à utiliser (optionnel)')
  });

  type AgentQueryParams = z.infer<typeof AgentQuerySchema>;

  // Route pour interagir avec l'agent
  fastify.post<{
    Body: AgentQueryParams
  }>('/agent/query', {
    schema: {
      tags: ['agent'],
      summary: 'Interroger l\'agent ReAct',
      description: 'Envoie une requête en langage naturel à l\'agent ReAct qui utilisera les outils disponibles pour rechercher et filtrer des documents dans la base de données vectorielle. Cet agent est spécialisé dans la recherche documentaire et non pour répondre à des questions générales.',
      body: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Requête en langage naturel concernant les documents dans la base de données' },
          verbose: { type: 'boolean', default: false, description: 'Mode verbeux' },
          tools: { 
            type: 'array', 
            items: { 
              type: 'string',
              enum: [...AVAILABLE_TOOLS, 'all']
            },
            default: ['all'],
            description: 'Outils spécifiques à utiliser. Valeurs possibles: ' + [...AVAILABLE_TOOLS, 'all'].join(', ')
          }
        },
        required: ['query']
      },
      response: {
        200: {
          description: 'Réponse de l\'agent',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            query: { type: 'string' },
            response: { type: 'string' },
            executionTime: { type: 'number' },
            toolsUsed: { 
              type: 'array',
              items: { type: 'string' }
            }
          }
        },
        400: {
          description: 'Requête invalide',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            error: { type: 'string' }
          }
        },
        500: {
          description: 'Erreur lors du traitement de la requête',
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
        const startTime = Date.now();
        const { query, verbose, tools } = request.body;
        
        // Validation des outils
        if (tools.length === 0) {
          return reply.status(400).send({
            success: false,
            message: 'Au moins un outil doit être spécifié',
            error: 'INVALID_TOOLS'
          });
        }
        
        // Si 'all' est présent, on utilise tous les outils
        const selectedTools = tools.includes('all') 
          ? ['all'] 
          : tools.filter(tool => AVAILABLE_TOOLS.includes(tool));
        
        // Configuration de l'agent
        const agentConfig = {
          verbose,
          tools: selectedTools
        };
        
        try {
          // Exécution de la requête
          const response = await queryVectorDBAgent(query, agentConfig);
          
          const executionTime = Date.now() - startTime;
          
          return {
            success: true,
            query,
            response,
            executionTime,
            toolsUsed: selectedTools
          };
        } catch (error) {
          // Vérifier si l'erreur est liée au schéma des outils
          if (error instanceof Error && 
              (error.message.includes('did not match expected schema') || 
               error.message.includes('validation') || 
               error.message.includes('schema'))) {
            
            return {
              success: false,
              query,
              response: `Désolé, je ne peux pas répondre à cette question car elle ne semble pas être liée aux documents dans notre base de données. Cet agent est spécialisé dans la recherche et le filtrage de documents spécifiques. Veuillez poser une question concernant les documents stockés dans la base de données vectorielle.`,
              executionTime: Date.now() - startTime,
              toolsUsed: selectedTools,
              error: 'QUERY_NOT_RELEVANT'
            };
          }
          
          // Autres erreurs
          throw error;
        }
      } catch (error) {
        reply.log.error(error);
        return reply.status(500).send({ 
          success: false, 
          message: 'Erreur lors du traitement de la requête par l\'agent',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });

  // Route pour obtenir des informations sur les outils disponibles
  fastify.get('/agent/tools', {
    schema: {
      tags: ['agent'],
      summary: 'Liste des outils disponibles',
      description: 'Récupère la liste des outils disponibles pour l\'agent ReAct',
      response: {
        200: {
          description: 'Liste des outils',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            tools: { 
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    handler: async (request, reply) => {
      return {
        success: true,
        tools: [
          {
            name: filterPerCategoryTool.name,
            description: 'Filtre les documents par catégorie'
          },
          {
            name: advancedFilteringTool.name,
            description: 'Filtre avancé avec scores et mots-clés'
          },
          {
            name: semanticSearchTool.name,
            description: 'Recherche sémantique vectorielle'
          }
        ]
      };
    }
  });
  
  // Route pour obtenir des exemples de requêtes valides
  fastify.get('/agent/examples', {
    schema: {
      tags: ['agent'],
      summary: 'Exemples de requêtes valides',
      description: 'Fournit des exemples de requêtes que l\'agent peut traiter',
      response: {
        200: {
          description: 'Liste d\'exemples',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            examples: { 
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      }
    },
    handler: async (request, reply) => {
      return {
        success: true,
        examples: [
          'Quels sont les documents liés à Hugging Face avec un score élevé?',
          'Trouve-moi des documents dans la catégorie "Machine Learning"',
          'Quels documents parlent de deep learning avec un score supérieur à 0.7?',
          'Montre-moi les documents qui contiennent des informations sur les transformers'
        ]
      };
    }
  });
}
