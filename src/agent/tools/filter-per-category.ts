
import { getDocumentsFromQdrant } from '@/ingestion/csvIngestion';
import { Document } from '@langchain/core/documents';
import { StructuredTool, DynamicTool } from '@langchain/core/tools';
import { z } from 'zod';

/** 
 * 
 * Les outils de l'agent peuvent être de deux types : des outils structurés (`StructuredTool`) et des outils dynamiques (`DynamicTool`).
 * Les outils structurés ont une validation intégrée avec un schéma pour les paramètres.
 * Les outils dynamiques sont plus simples mais peuvent tout de même utiliser Zod pour la validation manuellement.
 * 
 * Les deux approches sont valides et peuvent offrir une bonne sécurité de type avec TypeScript et Zod.
 * Le choix dépend principalement du style de code préféré et des besoins spécifiques.
 */

/**
 * Filtre les documents par catégorie.
 * @param category - La catégorie par laquelle filtrer les documents
 * @returns Une liste de documents correspondant à la catégorie spécifiée
 */
export async function filterPerCategory(category: string): Promise<Document[]> {
  // Passer directement la catégorie à getDocumentsFromQdrant pour filtrer au niveau de la base de données
  // plutôt que de filtrer en mémoire après avoir récupéré tous les documents
  return await getDocumentsFromQdrant(category);
}

/**
 * Schéma de validation pour les paramètres de l'outil de filtrage par catégorie
 */
const filterPerCategorySchema = z.object({
  category: z.string().min(1).describe('La catégorie par laquelle filtrer les documents')
});

/**
 * Type pour les paramètres de l'outil de filtrage par catégorie
 */
type FilterPerCategoryInput = z.infer<typeof filterPerCategorySchema>;

/**
 * Outil d'agent pour filtrer les documents par catégorie.
 */
export class FilterPerCategoryTool extends StructuredTool<typeof filterPerCategorySchema> {
  name = 'filterPerCategory';
  description = 'Filtre les documents par catégorie. Utile quand l\'utilisateur veut voir uniquement les documents d\'une catégorie spécifique.';
  schema = filterPerCategorySchema;

  async _call({ category }: FilterPerCategoryInput): Promise<string> {
    try {
      const documents = await filterPerCategory(category);
      return JSON.stringify({
        success: true,
        count: documents.length,
        category,
        documents: documents.map(doc => ({
          content: doc.pageContent,
          metadata: doc.metadata
        }))
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

/**
 * Instance de l'outil de filtrage par catégorie avec StructuredTool
 */
export const filterPerCategoryTool = new FilterPerCategoryTool();

/**
 * Version alternative utilisant DynamicTool avec validation Zod manuelle
 * Cette approche est également valide et montre comment utiliser Zod avec DynamicTool
 */
export const filterPerCategoryDynamicTool = new DynamicTool({
  name: 'filterPerCategoryDynamic',
  description: 'Filtre les documents par catégorie en utilisant une approche dynamique.',
  func: async (categoryRaw: string) => {
    try {
      // Validation manuelle avec Zod
      const result = filterPerCategorySchema.shape.category.safeParse(categoryRaw);
      
      if (!result.success) {
        return JSON.stringify({
          success: false,
          error: `Validation error: ${result.error.message}`
        });
      }
      
      const category = result.data;
      const documents = await filterPerCategory(category);
      
      return JSON.stringify({
        success: true,
        count: documents.length,
        category,
        documents: documents.map(doc => ({
          content: doc.pageContent,
          metadata: doc.metadata
        }))
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
});
