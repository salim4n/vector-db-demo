import { FastifyReply, FastifyRequest } from 'fastify';
import { getDocumentsFromQdrant } from '../ingestion/csvIngestion';

/**
 * Interface pour les paramètres de requête de documents
 */
interface DocumentsQueryParams {
  category?: string;
}

/**
 * Contrôleur pour la gestion des documents et des catégories
 */
export const documentsController = {
  /**
   * Récupère les documents stockés dans Qdrant
   * Peut être filtré par catégorie
   */
  async getDocuments(request: FastifyRequest<{ Querystring: DocumentsQueryParams }>, reply: FastifyReply) {
    try {
      const { category } = request.query;
      
      // Récupérer les documents, filtrés par catégorie si spécifiée
      const documents = await getDocumentsFromQdrant(category);
      
      return { 
        success: true, 
        count: documents.length,
        category: category || 'all',
        documents: documents.map(doc => {
          // Convertir l'analyse des catégories en objet si présente
          let categoryAnalysis = undefined;
          if (doc.metadata.category_analysis) {
            try {
              categoryAnalysis = typeof doc.metadata.category_analysis === 'string' ?
                JSON.parse(doc.metadata.category_analysis) :
                doc.metadata.category_analysis;
            } catch (error) {
              reply.log.warn(`Erreur lors du parsing de l'analyse des catégories:`, error);
            }
          }
          
          return {
            content: doc.pageContent,
            metadata: {
              ...doc.metadata,
              category_analysis: categoryAnalysis
            }
          };
        })
      };
    } catch (error) {
      reply.log.error(error);
      return reply.status(500).send({ 
        success: false, 
        message: 'Erreur lors de la récupération des documents',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  },

  /**
   * Récupère les catégories disponibles avec leurs statistiques
   */
  async getCategories(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Récupérer tous les documents pour extraire les catégories
      const documents = await getDocumentsFromQdrant();
      
      // Extraire toutes les catégories avec leurs scores moyens
      const categoryScores = new Map<string, { count: number, totalScore: number }>();
      
      documents.forEach(doc => {
        // Ajouter la catégorie principale
        if (doc.metadata.category) {
          const category = doc.metadata.category;
          if (!categoryScores.has(category)) {
            categoryScores.set(category, { count: 0, totalScore: 0 });
          }
          const stats = categoryScores.get(category)!;
          stats.count += 1;
          stats.totalScore += 1; // Score maximum pour la catégorie principale
        }
        
        // Ajouter les catégories secondaires avec leurs scores
        let categoryAnalysis: any = undefined;
        if (doc.metadata.category_analysis) {
          try {
            categoryAnalysis = typeof doc.metadata.category_analysis === 'string' ?
              JSON.parse(doc.metadata.category_analysis) :
              doc.metadata.category_analysis;
              
            if (categoryAnalysis && categoryAnalysis.categories) {
              categoryAnalysis.categories.forEach((cat: any) => {
                if (!cat.name || typeof cat.score !== 'number') return;
                
                if (!categoryScores.has(cat.name)) {
                  categoryScores.set(cat.name, { count: 0, totalScore: 0 });
                }
                const stats = categoryScores.get(cat.name)!;
                stats.count += 1;
                stats.totalScore += cat.score;
              });
            }
          } catch (error) {
            reply.log.warn(`Erreur lors du parsing de l'analyse des catégories:`, error);
          }
        }
      });
      
      // Convertir en tableau avec scores moyens
      const categories = Array.from(categoryScores.entries()).map(([name, stats]) => ({
        name,
        count: stats.count,
        averageScore: stats.count > 0 ? stats.totalScore / stats.count : 0
      })).sort((a, b) => b.count - a.count || b.averageScore - a.averageScore);
      
      return {
        success: true,
        count: categories.length,
        categories,
        // Inclure également les catégories principales uniquement pour compatibilité
        mainCategories: [...new Set(documents.map(doc => doc.metadata.category))]
      };
    } catch (error) {
      reply.log.error(error);
      return reply.status(500).send({ 
        success: false, 
        message: 'Erreur lors de la récupération des catégories',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
};
