import { DynamicTool } from '@langchain/core/tools';
import { semanticSearchTool } from './retrieval';
import { filterPerCategoryTool } from './filter-per-category';
import { advancedFilteringTool } from './advanced-filtering';

/**
 * Fonction utilitaire pour parser une entrée potentiellement mal formatée
 * et la convertir en objet JSON valide
 */
function parseToolInput(input: string): any {
  // Si l'entrée est déjà un objet, la retourner telle quelle
  if (typeof input === 'object') {
    return input;
  }

  try {
    // Essayer de parser l'entrée comme JSON valide
    return JSON.parse(input);
  } catch (e) {
    // Si ce n'est pas un JSON valide, essayer de le convertir
    try {
      // Remplacer les clés non quotées par des clés quotées
      // Par exemple: {query: "transformers"} -> {"query": "transformers"}
      const fixedInput = input
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":')
        .replace(/'/g, '"'); // Remplacer les apostrophes par des guillemets
      
      return JSON.parse(fixedInput);
    } catch (e2) {
      // Si l'entrée est une simple chaîne, supposer qu'il s'agit d'une requête
      if (typeof input === 'string' && !input.includes(':')) {
        return { query: input };
      }
      
      // Si tout échoue, lever une erreur
      throw new Error(`Impossible de parser l'entrée: ${input}`);
    }
  }
}

/**
 * Wrapper pour l'outil de recherche sémantique qui accepte des entrées mal formatées
 */
export const semanticSearchReactTool = new DynamicTool({
  name: 'semanticSearch',
  description: semanticSearchTool.description,
  func: async (input: string) => {
    try {
      // Parser l'entrée
      const parsedInput = parseToolInput(input);
      
      // Vérifier que la requête est présente
      if (!parsedInput.query) {
        return JSON.stringify({
          success: false,
          error: 'Le paramètre "query" est requis pour la recherche sémantique'
        }, null, 2);
      }
      
      // Appeler l'outil original avec l'entrée parsée
      return await semanticSearchTool.call(parsedInput);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }, null, 2);
    }
  }
});

/**
 * Wrapper pour l'outil de filtrage par catégorie qui accepte des entrées mal formatées
 */
export const filterPerCategoryReactTool = new DynamicTool({
  name: 'filterPerCategory',
  description: filterPerCategoryTool.description,
  func: async (input: string) => {
    try {
      // Parser l'entrée
      const parsedInput = parseToolInput(input);
      
      // Vérifier que la catégorie est présente
      if (!parsedInput.category) {
        return JSON.stringify({
          success: false,
          error: 'Le paramètre "category" est requis pour le filtrage par catégorie'
        }, null, 2);
      }
      
      // Appeler l'outil original avec l'entrée parsée
      return await filterPerCategoryTool.call(parsedInput);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }, null, 2);
    }
  }
});

/**
 * Wrapper pour l'outil de filtrage avancé qui accepte des entrées mal formatées
 */
export const advancedFilteringReactTool = new DynamicTool({
  name: 'advancedFiltering',
  description: advancedFilteringTool.description,
  func: async (input: string) => {
    try {
      // Parser l'entrée
      const parsedInput = parseToolInput(input);
      
      // Vérifier qu'au moins un paramètre de filtrage est présent
      if (!parsedInput.mainCategory && 
          !parsedInput.categories && 
          !parsedInput.minScore && 
          !parsedInput.reasoningKeywords) {
        return JSON.stringify({
          success: false,
          error: 'Au moins un paramètre de filtrage est requis pour le filtrage avancé'
        }, null, 2);
      }
      
      // Appeler l'outil original avec l'entrée parsée
      return await advancedFilteringTool.call(parsedInput);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }, null, 2);
    }
  }
});

/**
 * Liste des outils adaptés pour l'agent ReAct
 */
export const reactTools = [
  semanticSearchReactTool,
  filterPerCategoryReactTool,
  advancedFilteringReactTool
];
