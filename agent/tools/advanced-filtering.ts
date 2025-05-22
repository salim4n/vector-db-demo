import { getDocumentsFromQdrant } from '../../src/ingestion/csvIngestion';
import { Document } from '@langchain/core/documents';
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Schéma Zod pour une catégorie avec score
 */
const categorySchema = z.object({
  name: z.string().describe('Nom de la catégorie'),
  score: z.number().min(0).max(1).describe('Score de confiance entre 0 et 1')
});

/**
 * Schéma Zod pour l'analyse des catégories
 */
const categoryAnalysisSchema = z.object({
  categories: z.array(categorySchema).describe('Liste des catégories avec leurs scores'),
  reasoning: z.string().optional().describe('Raisonnement expliquant les catégories attribuées')
});

/**
 * Schéma Zod pour les options de filtrage avancé
 */
const advancedFilterSchema = z.object({
  mainCategory: z.string().optional().describe('Catégorie principale exacte à filtrer'),
  categories: z.array(z.string()).optional().describe('Liste des catégories à rechercher (au moins une doit correspondre)'),
  minScore: z.number().min(0).max(1).optional().describe('Score minimum requis pour une catégorie (entre 0 et 1)'),
  reasoningKeywords: z.array(z.string()).optional().describe('Mots-clés à rechercher dans le raisonnement'),
  limit: z.number().positive().optional().describe('Limite le nombre de résultats')
});

/**
 * Types dérivés des schémas Zod
 */
type Category = z.infer<typeof categorySchema>;
type CategoryAnalysis = z.infer<typeof categoryAnalysisSchema>;
type AdvancedFilterOptions = z.infer<typeof advancedFilterSchema>;


/**
 * Filtre les documents selon des critères avancés.
 *
 * Cette fonction prend en entrée des options de filtrage avancées et retourne une liste
 * de documents qui satisfont ces critères. Les critères incluent:
 * - Filtrage par catégorie principale exacte.
 * - Filtrage par une liste de catégories où au moins une doit correspondre.
 * - Filtrage par score minimum requis pour une catégorie.
 * - Filtrage par présence de mots-clés dans le raisonnement associé aux catégories.
 * 
 * @param options - Les options de filtrage avancé qui déterminent quels documents
 * doivent être retournés. Les options incluent la catégorie principale, les catégories
 * à rechercher, le score minimum, les mots-clés à rechercher dans le raisonnement, et
 * une limite sur le nombre de résultats.
 * 
 * @returns Une promesse qui se résout en un tableau de documents filtrés selon les critères spécifiés.
 */
export async function advancedFiltering(options: AdvancedFilterOptions): Promise<Document[]> {
  const documents = await getDocumentsFromQdrant();
  
  return documents.filter(doc => {
    // Filtrage par catégorie principale
    if (options.mainCategory && doc.metadata.category !== options.mainCategory) {
      return false;
    }
    
    // Si pas d'autres filtres, on accepte le document
    if (!options.categories && !options.minScore && !options.reasoningKeywords) {
      return true;
    }
    
    // Récupération et parsing de l'analyse des catégories
    let categoryAnalysis: CategoryAnalysis | undefined;
    try {
      if (doc.metadata.category_analysis) {
        categoryAnalysis = typeof doc.metadata.category_analysis === 'string'
          ? JSON.parse(doc.metadata.category_analysis)
          : doc.metadata.category_analysis;
      }
    } catch (error) {
      console.warn('Erreur lors du parsing de l\'analyse des catégories:', error);
      return false; // Si on ne peut pas parser, on rejette le document
    }
    
    if (!categoryAnalysis) {
      return false;
    }
    
    // Filtrage par catégories
    if (options.categories && options.categories.length > 0) {
      const docCategories = categoryAnalysis.categories.map(cat => cat.name);
      const hasMatchingCategory = options.categories.some(cat => docCategories.includes(cat));
      if (!hasMatchingCategory) {
        return false;
      }
    }
    
    // Filtrage par score minimum
    if (options.minScore !== undefined) {
      const hasHighScore = categoryAnalysis.categories.some(cat => cat.score >= options.minScore!);
      if (!hasHighScore) {
        return false;
      }
    }
    
    // Filtrage par mots-clés dans le raisonnement
    if (options.reasoningKeywords && options.reasoningKeywords.length > 0 && categoryAnalysis.reasoning) {
      const reasoning = categoryAnalysis.reasoning.toLowerCase();
      const hasKeyword = options.reasoningKeywords.some(keyword => 
        reasoning.includes(keyword.toLowerCase())
      );
      if (!hasKeyword) {
        return false;
      }
    }
    
    return true;
  }).slice(0, options.limit || Infinity);
}

/**
 * Outil d'agent pour le filtrage avancé des documents.
 *
 * Filtre les documents selon des critères avancés comme les catégories, scores, et mots-clés dans le raisonnement.
 *
 * Les options de filtrage sont définies comme suit:
 * - `mainCategory`: catégorie principale exacte à filtrer
 * - `categories`: liste des catégories à rechercher (au moins une doit correspondre)
 * - `minScore`: score minimum requis pour une catégorie (entre 0 et 1)
 * - `reasoningKeywords`: mots-clés à rechercher dans le raisonnement
 * - `limit`: nombre maximum de résultats à renvoyer
 *
 * La méthode `_call` prend en argument les options de filtrage et renvoie un objet JSON contenant
 * les documents filtrés, ainsi que les filtres et le nombre de documents trouvés.
 */
export class AdvancedFilteringTool extends StructuredTool<typeof advancedFilterSchema> {
  name = 'advancedFiltering';
  description = 'Filtre les documents selon des critères avancés comme les catégories, scores, et mots-clés dans le raisonnement.';
  schema = advancedFilterSchema;

  async _call(options: AdvancedFilterOptions): Promise<string> {
    try {
      const documents = await advancedFiltering(options);
      return JSON.stringify({
        success: true,
        count: documents.length,
        filters: options,
        documents: documents.map(doc => ({
          content: doc.pageContent,
          metadata: {
            ...doc.metadata,
            // Assurons-nous que category_analysis est bien formaté pour JSON
            category_analysis: typeof doc.metadata.category_analysis === 'string'
              ? JSON.parse(doc.metadata.category_analysis)
              : doc.metadata.category_analysis
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
}

/**
 * Instance de l'outil de filtrage avancé prête à l'emploi
 */
export const advancedFilteringTool = new AdvancedFilteringTool();
