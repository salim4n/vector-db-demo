import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createReactAgent } from 'langchain/agents';
import { pull } from 'langchain/hub';
import { DynamicTool } from '@langchain/core/tools';
import dotenv from 'dotenv';

// Import des fonctions originales pour les convertir en DynamicTools
import { semanticSearch } from './tools/retrieval';
import { filterPerCategory } from './tools/filter-per-category';

dotenv.config();

/**
 * Configuration de l'agent ReAct
 */
interface AgentConfig {
  /** Modèle de langage à utiliser */
  model?: string;
  /** Température pour la génération (0-1) */
  temperature?: number;
  /** Outils à mettre à disposition de l'agent */
  tools?: string[];
  /** Verbose mode pour le debugging */
  verbose?: boolean;
}

/**
 * Valeurs par défaut pour la configuration
 */
const DEFAULT_CONFIG: AgentConfig = {
  model: process.env.GPT_MODEL,
  temperature: 0,
  tools: ['all'],
  verbose: false
};

const semanticSearchTool = new DynamicTool({
  name: "semanticSearch",
  description: "Recherche des documents pertinents en fonction d'une requête en langage naturel. Utile pour trouver des informations spécifiques dans la base de documents.",
  func: async (input: string) => {
    try {
      let params: any;
      
      if (input.trim().startsWith('{')) {
        try {
          params = JSON.parse(input);
        } catch (e) {
          const fixedInput = input
            .replace(/(['\"'])?([a-zA-Z0-9_]+)(['\"'])?:/g, '"$2":') 
            .replace(/'/g, '"'); 
          
          try {
            params = JSON.parse(fixedInput);
          } catch (e2) {
            params = { query: input };
          }
        }
      } else {
        params = { query: input };
      }
      
      if (!params.query) {
        return JSON.stringify({
          success: false,
          error: "Le paramètre 'query' est requis pour la recherche sémantique"
        }, null, 2);
      }
      
      const documents = await semanticSearch(params);
      
      return JSON.stringify({
        success: true,
        count: documents.length,
        query: params.query,
        documents: documents.map(doc => ({
          content: doc.pageContent,
          metadata: {
            ...doc.metadata,
            score: doc.metadata.score ? Math.round(doc.metadata.score * 100) / 100 : undefined
          }
        }))
      }, null, 2);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }, null, 2);
    }
  }
});

const filterPerCategoryTool = new DynamicTool({
  name: "filterPerCategory",
  description: "Filtre les documents par catégorie. Utile quand l'utilisateur veut voir uniquement les documents d'une catégorie spécifique.",
  func: async (input: string) => {
    try {
      let category: string;
      
      if (input.trim().startsWith('{')) {
        try {
          const params = JSON.parse(input);
          category = params.category;
        } catch (e) {
          const fixedInput = input
            .replace(/(['\"'])?([a-zA-Z0-9_]+)(['\"'])?:/g, '"$2":') 
            .replace(/'/g, '"');
          
          try {
            const params = JSON.parse(fixedInput);
            category = params.category;
          } catch (e2) {
            category = input;
          }
        }
      } else {
        category = input;
      }
      
      if (!category) {
        return JSON.stringify({
          success: false,
          error: "Le paramètre 'category' est requis pour le filtrage par catégorie"
        }, null, 2);
      }
      
      const documents = await filterPerCategory(category);
      
      return JSON.stringify({
        success: true,
        count: documents.length,
        category,
        documents: documents.map(doc => ({
          content: doc.pageContent,
          metadata: doc.metadata
        }))
      }, null, 2);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }, null, 2);
    }
  }
});

//----------------------------BROKEN--------------------------------//
// const advancedFilteringTool = new DynamicTool({
//   name: "advancedFiltering",
//   description: "Filtre les documents avec des critères avancés comme les catégories, les scores et les mots-clés.",
//   func: async (input: string) => {
//     try {
//       let params: any;
      
//       if (input.trim().startsWith('{')) {
//         try {
//           params = JSON.parse(input);
//         } catch (e) {
//           const fixedInput = input
//             .replace(/(['\"'])?([a-zA-Z0-9_]+)(['\"'])?:/g, '"$2":') 
//             .replace(/'/g, '"');
          
//           try {
//             params = JSON.parse(fixedInput);
//           } catch (e2) {
//             return JSON.stringify({
//               success: false,
//               error: "Format d'entrée invalide pour le filtrage avancé"
//             }, null, 2);
//           }
//         }
//       } else {
//         return JSON.stringify({
//           success: false,
//           error: "Format d'entrée invalide pour le filtrage avancé. Attendu: objet JSON avec des paramètres de filtrage."
//         }, null, 2);
//       }
      
//       if (!params.mainCategory && !params.categories && !params.minScore && !params.reasoningKeywords) {
//         return JSON.stringify({
//           success: false,
//           error: "Au moins un paramètre de filtrage est requis (mainCategory, categories, minScore, reasoningKeywords)"
//         }, null, 2);
//       }
      
//       const documents = await advancedFiltering(params);
      
//       return JSON.stringify({
//         success: true,
//         count: documents.length,
//         filters: params,
//         documents: documents.map(doc => ({
//           content: doc.pageContent,
//           metadata: doc.metadata
//         }))
//       }, null, 2);
//     } catch (error) {
//       return JSON.stringify({
//         success: false,
//         error: error instanceof Error ? error.message : String(error)
//       }, null, 2);
//     }
//   }
// });
//------------------------------------------------------------------//

export async function createVectorDBAgent(config: AgentConfig = {}): Promise<AgentExecutor> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  const model = new ChatOpenAI({
    modelName: finalConfig.model,
    temperature: finalConfig.temperature,
  });
  
  const allTools = [semanticSearchTool, filterPerCategoryTool];
  
  let selectedTools = allTools;
  if (finalConfig.tools && !finalConfig.tools.includes('all')) {
    selectedTools = allTools.filter(tool => finalConfig.tools?.includes(tool.name));
  }
  
  // Utiliser le prompt standard sans personnalisation complexe
  const prompt = await pull<any>("hwchase17/react");
  
  const agent = await createReactAgent({
    llm: model,
    tools: selectedTools,
    prompt
  });
  
  const agentExecutor = AgentExecutor.fromAgentAndTools({
    agent,
    tools: selectedTools,
    verbose: finalConfig.verbose,
    maxIterations: 10
  });
  
  return agentExecutor;
}

/**
 * Fonction utilitaire pour exécuter une requête avec l'agent
 * 
 * @param query - La requête en langage naturel à traiter
 * @param config - Configuration optionnelle pour l'agent
 * @returns La réponse de l'agent
 */
export async function queryVectorDBAgent(query: string, config: AgentConfig = { model: process.env.GPT_MODEL, temperature: 0, tools: ['all'], verbose: false }): Promise<string> {
  try {
    // Créer l'agent
    const agent = await createVectorDBAgent(config);
    
    // Ajouter des instructions pour guider l'agent à utiliser les outils de filtrage
    const enhancedQuery = `
Recherche dans notre base de données de documents vectorielle.

INSTRUCTIONS IMPORTANTES:
- Tu es un agent ReAct qui doit suivre un format strict: Thought → Action → Action Input → Observation → Thought → ...
- Après chaque réflexion (Thought), tu DOIS choisir une action (Action) puis spécifier les paramètres (Action Input)
- Tu ne peux JAMAIS écrire deux "Thought:" consécutifs sans "Action:" entre eux
- Pour conclure, utilise "Final Answer:" suivi de ta réponse complète

STRATÉGIE DE RECHERCHE RECOMMANDÉE:
1. Commence par utiliser l'outil semanticSearch pour trouver des documents pertinents
2. Si les résultats ne sont pas assez précis, utilise filterPerCategory pour filtrer par catégorie

QUESTION: ${query}

N'hésite pas à combiner plusieurs outils pour obtenir les meilleurs résultats.`;
    
    // Exécuter la requête
    const result = await agent.invoke({
      input: enhancedQuery
    });
    
    // Retourner la réponse
    return result.output;
  } catch (error) {
    console.error('Erreur lors de l\'exécution de l\'agent:', error);
    
    // Essayer avec une stratégie de secours si l'erreur est liée aux outils
    if (error instanceof Error && 
        (error.message.includes('schema') || 
         error.message.includes('tool') || 
         error.message.includes('parsing'))) {
      try {
        console.log('Tentative avec une stratégie de secours...');
        
        // Créer un nouvel agent avec seulement l'outil de recherche sémantique
        const backupAgent = await createVectorDBAgent({
          ...config,
          tools: ['semanticSearch']
        });
        
        // Exécuter une recherche simple
        const backupResult = await backupAgent.invoke({
          input: `Recherche simple: ${query}`
        });
        
        return backupResult.output;
      } catch (backupError) {
        console.error('Erreur lors de la stratégie de secours:', backupError);
      }
    }
    
    return `Erreur: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// Si ce fichier est exécuté directement, démarrer une démo
if (require.main === module) {
  (async () => {
    try {
      const query = process.argv[2] || 'Quels sont les documents liés à Hugging Face avec un score élevé?';
      console.log(`\nRequête: ${query}\n`);
      
      const response = await queryVectorDBAgent(query, { verbose: true });
      console.log(`\nRéponse de l'agent:\n${response}`);
    } catch (error) {
      console.error('Erreur lors de l\'exécution de la démo:', error);
    }
  })();
}
