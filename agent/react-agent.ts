import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIFunctionsAgent, createReactAgent } from 'langchain/agents';
import { pull } from 'langchain/hub';
import dotenv from 'dotenv';

// Import des outils personnalisés
import { filterPerCategoryTool } from './tools/filter-per-category';
import { advancedFilteringTool } from './tools/advanced-filtering';
import { semanticSearchTool } from './tools/retrieval';

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

/**
 * Crée et configure un agent ReAct pour interagir avec la base de données vectorielle.
 * 
 * @param config - Configuration optionnelle pour personnaliser l'agent
 * @returns Un AgentExecutor prêt à être utilisé
 */
export async function createVectorDBAgent(config: AgentConfig = {}): Promise<AgentExecutor> {
  // Fusionner la configuration par défaut avec celle fournie
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Initialiser le modèle de langage
  const model = new ChatOpenAI({
    modelName: finalConfig.model,
    temperature: finalConfig.temperature,
  });
  
  // Sélectionner les outils à utiliser
  const allTools = [filterPerCategoryTool, advancedFilteringTool, semanticSearchTool];
  let selectedTools = allTools;
  
  if (finalConfig.tools && !finalConfig.tools.includes('all')) {
    selectedTools = allTools.filter(tool => finalConfig.tools?.includes(tool.name));
  }
  
  // Créer le prompt pour l'agent
  const prompt = await pull<any>("hwchase17/react");
  


  /**
   * Crée un agent OpenAI Functions configuré avec le modèle de langage spécifié,
   * les outils et le prompt. Cet agent est capable de traiter des requêtes en langage
   * naturel et d'utiliser les outils fournis pour effectuer des tâches ou récupérer
   * des informations.
   *
   * @param llm - Le modèle de langage à utiliser pour la génération de texte
   * @param tools - Les outils à mettre à disposition de l'agent
   * @param prompt - Le prompt pour l'agent qui définit les messages de système et d'utilisateur
   * @returns Un agent OpenAI Functions prêt à être utilisé
   */
  const agent = await createOpenAIFunctionsAgent({
    llm: model,
    tools: selectedTools,
    prompt
  });

  /**
   * Crée un agent ReAct qui peut interagir avec la base de données vectorielle
   * en utilisant les outils de recherche et de filtrage fournis.
   * 
   * @param llm - Le modèle de langage à utiliser pour la génération de texte
   * @param tools - Les outils à mettre à disposition de l'agent
   * @param prompt - Le prompt pour l'agent qui définit les messages de système et d'utilisateur
   * @returns Un agent ReAct prêt à être utilisé
   */
  const reactAgent = await createReactAgent({
    llm: model,
    tools: selectedTools,
    prompt
  }); 
  
  /**
   * Crée un exécuteur d'agent qui peut interagir avec la base de données vectorielle
   * en utilisant les outils de recherche et de filtrage fournis.
   * 
   * @param agent - L'agent à exécuter
   * @param tools - Les outils à mettre à disposition de l'agent
   * @param verbose - Mode verbose pour le debugging
   * @returns Un exécuteur d'agent prêt à être utilisé
   */
  const agentExecutor = new AgentExecutor({
    agent: reactAgent,
    tools: selectedTools,
    verbose: finalConfig.verbose
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
export async function queryVectorDBAgent(query: string, config: AgentConfig = { model: process.env.GPT_MODEL,temperature: 0,tools: ['all'],verbose: false }): Promise<string> {
  try {
    // Créer l'agent
    const agent = await createVectorDBAgent(config);
    
    // Exécuter la requête
    const result = await agent.invoke({
      input: query
    });
    
    // Retourner la réponse
    return result.output;
  } catch (error) {
    console.error('Erreur lors de l\'exécution de l\'agent:', error);
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
