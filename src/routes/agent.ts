import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { queryVectorDBAgent } from '@/agent/react-agent';
import { filterPerCategoryTool } from '@/agent/tools/filter-per-category';
import { advancedFilteringTool } from '@/agent/tools/advanced-filtering';
import { semanticSearchTool } from '@/agent/tools/retrieval';

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
        
        // Vérification préliminaire pour détecter si la question est complètement hors sujet
        // Liste de mots-clés très spécifiques qui indiquent des questions clairement hors domaine
        const nonTechnicalKeywords = [
          'recette', 'cuisine', 'tarte', 'gâteau', 'cuisson', 'pâtisserie',
          'sport', 'football', 'tennis', 'basketball', 'match',
          'film', 'cinéma', 'acteur', 'actrice', 'regarder',
          'voyage', 'hôtel', 'réservation', 'billet', 'vol',
          'restaurant', 'manger', 'diner', 'déjeuner'
        ];
        
        // Liste de mots-clés techniques qui indiquent des questions potentiellement pertinentes
        const technicalKeywords = [
          // Termes généraux
          'document', 'documents', 'base de données', 'vectorielle', 'recherche',
          'catégorie', 'filtrer', 'filtrage', 'score', 'similarité', 'embedding',
          'information', 'informations', 'texte', 'contenu',
          
          // IA et ML
          'machine learning', 'ml', 'deep learning', 'apprentissage', 'modèle', 'modèles',
          'ia', 'intelligence artificielle', 'ai', 'artificial intelligence',
          'nlp', 'traitement du langage', 'natural language', 'language model',
          
          // Technologies spécifiques
          'transformer', 'transformers', 'hugging face', 'bert', 'gpt', 'llm',
          'tensorflow', 'tf', 'tfjs', 'pytorch', 'torch', 'keras',
          'vectorisé', 'vectorisation', 'semantic', 'sémantique', 'qdrant',
          'openai', 'embedding', 'embeddings', 'vector', 'vecteur',
          
          // Frameworks et librairies
          'react', 'angular', 'vue', 'svelte', 'node', 'javascript', 'typescript',
          'python', 'java', 'c++', 'rust', 'go', 'ruby', 'php'
        ];
        
        const queryLower = query.toLowerCase();
        
        // Vérifier si la question contient des mots-clés non techniques
        const containsNonTechnical = nonTechnicalKeywords.some(keyword => 
          queryLower.includes(keyword.toLowerCase())
        );
        
        // Vérifier si la question contient des mots-clés techniques
        const containsTechnical = technicalKeywords.some(keyword => 
          queryLower.includes(keyword.toLowerCase())
        );
        
        // Si la question contient des mots-clés non techniques ET ne contient pas de mots-clés techniques,
        // alors elle est probablement hors sujet
        if (containsNonTechnical && !containsTechnical) {
          return {
            success: false,
            query,
            response: `Désolé, je ne peux pas répondre à cette question car elle ne semble pas être liée aux documents dans notre base de données. Cet agent est spécialisé dans la recherche et le filtrage de documents techniques. Veuillez poser une question concernant les documents stockés dans la base de données vectorielle, comme par exemple: "Quels documents parlent de transformers?" ou "Trouve-moi des informations sur le machine learning".`,
            executionTime: Date.now() - startTime,
            toolsUsed: [],
            error: 'QUERY_NOT_RELEVANT'
          };
        }
        
        // Pour les questions très courtes (moins de 4 mots) qui ne contiennent aucun mot-clé technique,
        // demander plus de précisions
        const wordCount = query.split(/\s+/).length;
        if (wordCount < 4 && !containsTechnical) {
          return {
            success: false,
            query,
            response: `Votre question est trop courte ou manque de contexte technique. Pourriez-vous la reformuler en précisant ce que vous recherchez dans notre base de données de documents techniques? Par exemple: "Quels documents parlent de X?" ou "Trouve-moi des informations sur Y".`,
            executionTime: Date.now() - startTime,
            toolsUsed: [],
            error: 'QUERY_TOO_VAGUE'
          };
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
