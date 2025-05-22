import { FastifyReply, FastifyRequest } from 'fastify';
import { getDocumentsFromQdrant } from '../ingestion/csvIngestion';
// import { QdrantClient } from '@qdrant/js-client-rest';
// import { Document } from '@langchain/core/documents';

interface DocumentsQueryParams {
  category?: string;
}

export const documentsController = {
  async getDocuments(request: FastifyRequest<{ Querystring: DocumentsQueryParams }>, reply: FastifyReply) {
    try {
      const { category } = request.query;
      
      const documents = await getDocumentsFromQdrant(category);
      
      return { 
        success: true, 
        count: documents.length,
        category: category || 'all',
        documents: documents.map(doc => {
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

  // async getCategories(reply: FastifyReply) {
  //   try {
  //     let documents;
  //     try {
  //       documents = await getDocumentsFromQdrant();
  //     } catch (fetchError) {
  //       reply.log.warn(`Erreur lors de la récupération initiale des documents: ${fetchError}`);
  //       reply.log.warn('Tentative de récupération sans filtre...');
        
  //       const client = new QdrantClient({ 
  //         url: process.env.QDRANT_URL || 'http://localhost:6333',
  //         ...(process.env.QDRANT_API_KEY ? { apiKey: process.env.QDRANT_API_KEY } : {})
  //       });
        
  //       const collectionName = process.env.QDRANT_COLLECTION || 'salim_embeddings';
        
  //       const limit = 1000;
  //       let offset = 0;
  //       const allPoints = [];
        
  //       while (true) {
  //         const response = await client.scroll(collectionName, {
  //           limit,
  //           offset
  //         });
          
  //         if (response.points.length === 0) {
  //           break;
  //         }
          
  //         allPoints.push(...response.points);
  //         offset += response.points.length;
          
  //         if (response.points.length < limit) {
  //           break;
  //         }
  //       }
        
  //       documents = allPoints.map(point => {
  //         const payload = point.payload ?? {};
  //         let categoryAnalysis = undefined;
  //         if (payload.category_analysis) {
  //           try {
  //             categoryAnalysis = typeof payload.category_analysis === 'string' ?
  //               JSON.parse(payload.category_analysis) :
  //               payload.category_analysis;
  //           } catch (error) {
  //             reply.log.warn(`Erreur lors du parsing de l'analyse des catégories:`, error);
  //           }
  //         }
          
  //         return new Document({
  //           pageContent: payload.text as string,
  //           metadata: {
  //             id: point.id,
  //             project_id: payload.project_id as string,
  //             asset_id: payload.asset_id as string,
  //             content_type: payload.content_type as string,
  //             category: payload.category as string,
  //             category_analysis: categoryAnalysis,
  //             created_at: payload.created_at as string,
  //             updated_at: payload.updated_at as string,
  //           },
  //         });
  //       });
      
  //     }
      
  //     if (!documents || documents.length === 0) {
  //       return {
  //         success: true,
  //         count: 0,
  //         categories: [],
  //         mainCategories: []
  //       };
  //     }
      
  //     const categoryScores = new Map<string, { count: number, totalScore: number }>();
      
  //     documents.forEach(doc => {  
  //       if (doc.metadata.category) {
  //         const category = doc.metadata.category;
  //         if (!categoryScores.has(category)) {
  //           categoryScores.set(category, { count: 0, totalScore: 0 });
  //         }
  //         const stats = categoryScores.get(category)!;
  //         stats.count += 1;
  //         stats.totalScore += 1; // Score maximum pour la catégorie principale
  //       }
        
  //       let categoryAnalysis: any = undefined;
  //       if (doc.metadata.category_analysis) {
  //         try {
  //           categoryAnalysis = typeof doc.metadata.category_analysis === 'string' ?
  //             JSON.parse(doc.metadata.category_analysis) :
  //             doc.metadata.category_analysis;
              
  //           if (categoryAnalysis && categoryAnalysis.categories) {
  //             categoryAnalysis.categories.forEach((cat: any) => {
  //               if (!cat.name || typeof cat.score !== 'number') return;
                
  //               if (!categoryScores.has(cat.name)) {
  //                 categoryScores.set(cat.name, { count: 0, totalScore: 0 });
  //               }
  //               const stats = categoryScores.get(cat.name)!;
  //               stats.count += 1;
  //               stats.totalScore += cat.score;
                
  //             });
  //           }
  //         } catch (error) {
  //           reply.log.warn(`Erreur lors du parsing de l'analyse des catégories:`, error);
  //         }
  //       }
  //     });
      
  //     const categories = Array.from(categoryScores.entries()).map(([name, stats]) => ({
  //       name,
  //       count: stats.count,
  //       averageScore: stats.count > 0 ? stats.totalScore / stats.count : 0
  //     })).sort((a, b) => b.count - a.count || b.averageScore - a.averageScore);
      
  //     return {
  //       success: true,
  //       count: categories.length,
  //       categories,
  //       mainCategories: [...new Set(documents.map(doc => doc.metadata.category))]
  //     };
  //   } catch (error) {
  //     reply.log.error(error);
  //     return reply.status(500).send({ 
  //       success: false, 
  //       message: 'Erreur lors de la récupération des catégories',
  //       error: error instanceof Error ? error.message : String(error)
  //     });
  //   }
  // }
};
