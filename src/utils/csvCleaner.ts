import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Schéma pour une catégorie avec score
const CategorySchema = z.object({
  name: z.string(),     
  score: z.number().min(0).max(1),
});

// Schéma pour l'analyse des catégories
const CategoryAnalysisSchema = z.object({
  categories: z.array(CategorySchema),
  reasoning: z.string(),
});

type CategoryAnalysis = z.infer<typeof CategoryAnalysisSchema>;

// Schéma pour les données nettoyées
const CleanedRecordSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  asset_id: z.string(),
  content_type: z.string(),
  text: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  category_analysis: CategoryAnalysisSchema.optional(),
  category: z.string().optional(),
});

type CleanedRecord = z.infer<typeof CleanedRecordSchema>;

/**
 * Nettoie le CSV en supprimant les vecteurs d'embeddings et les informations du modèle
 * @param inputFilePath Chemin du fichier CSV d'entrée
 * @param outputFilePath Chemin du fichier CSV de sortie
 * @returns Un tableau d'objets CleanedRecord
 */
export async function cleanCsvFile(
  inputFilePath: string = path.resolve(__dirname, '../../data/salim-embeddings.csv'),
  outputFilePath: string = path.resolve(__dirname, '../../data/cleaned-embeddings.csv')
): Promise<CleanedRecord[]> {
  try {
    console.log(`Lecture du fichier CSV: ${inputFilePath}`);
    const fileContent = fs.readFileSync(inputFilePath, 'utf-8');
    
    const records = parse(fileContent, {
      columns: true,
      delimiter: ';',
      skip_empty_lines: true,
    });

    const cleanedRecords: CleanedRecord[] = records.map((record: any) => ({
      id: record.id,
      project_id: record.project_id,
      asset_id: record.asset_id,
      content_type: record.content_type,
      text: record.original_chunk,
      created_at: record.created_at,
      updated_at: record.updated_at,
    }));

    console.log(`${cleanedRecords.length} enregistrements nettoyés.`);

    const csvOutput = stringify(cleanedRecords, {
      header: true,
      delimiter: ';',
      columns: ['id', 'project_id', 'asset_id', 'content_type', 'text', 'created_at', 'updated_at'],
    });

    fs.writeFileSync(outputFilePath, csvOutput);
    console.log(`Fichier nettoyé enregistré: ${outputFilePath}`);

    return cleanedRecords;
  } catch (error) {
    console.error('Erreur lors du nettoyage du CSV:', error);
    throw error;
  }
}

/**
 * Ajoute des catégories aux enregistrements en utilisant un LLM
 * @param records Enregistrements nettoyés
 * @param outputFilePath Chemin du fichier CSV de sortie avec catégories
 * @returns Un tableau d'objets CleanedRecord avec catégories
 */
export async function categorizeRecords(
  records: CleanedRecord[],
  outputFilePath: string = path.resolve(__dirname, '../../data/categorized-embeddings.csv')
): Promise<CleanedRecord[]> {
  try {
    console.log('Initialisation du modèle LLM pour la catégorisation...');
    
    // Vérifier que la clé API est configurée
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('La clé API OpenAI n\'est pas configurée. Veuillez l\'ajouter dans le fichier .env');
    }
    
    const llm = new ChatOpenAI({
      modelName: process.env.GPT_MODEL || "gpt-4.1-mini",
      temperature: 0.1,
    });

    const categorizedRecords: CleanedRecord[] = [];
    
    // Traiter les enregistrements par lots pour éviter de surcharger l'API
    const batchSize = 10;
    for (let i = 0; i < records.length; i += batchSize) {
      console.log(`Traitement du lot ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}...`);
      
      const batch = records.slice(i, i + batchSize);
      const promises = batch.map(async (record) => {
        try {
          const prompt = `
          Voici un texte : "${record.text}"
          
          Catégorise ce texte en plusieurs catégories, tu es un expert en catégorisation de textes.
          Tu es totalement libre de choisir les catégories les plus pertinentes.

          Voici quelques exemples de catégories possibles (mais tu n'es pas limité à celles-ci):
          - Tensorflow
          - MLOps
          - Huggingface
          - Langchain
          - Python
          - Javascript
          - Machine Learning
          - Deep Learning
          - NLP
          - Computer Vision
          - Data Science
          
          Pour chaque catégorie, attribue un score de confiance entre 0 et 1.
          Fournis également un raisonnement bref expliquant ton choix de catégories.
          Maximum trois catégories.
          
          Ta réponse doit être au format JSON suivant:
          
          {
            "categories": [
              { "name": "Nom de catégorie 1", "score": 0.95 },
              { "name": "Nom de catégorie 2", "score": 0.8 },
              { "name": "Nom de catégorie 3", "score": 0.6 }
            ],
            "reasoning": "Explication concise de ton raisonnement pour ces catégories."
          }
          `;
          
          const response = await llm.invoke(prompt);
          const responseContent = response.content.toString().trim();
          
          try {
            // Extraire le JSON de la réponse (au cas où il y aurait du texte autour)
            const jsonMatch = responseContent.match(/\{[\s\S]*\}/); 
            const jsonStr = jsonMatch ? jsonMatch[0] : responseContent;
            
            // Parser la réponse JSON
            const analysisData = JSON.parse(jsonStr);
            
            // Valider avec Zod
            const categoryAnalysis = CategoryAnalysisSchema.parse(analysisData);
            
            // Extraire la catégorie principale (celle avec le score le plus élevé) pour compatibilité
            const mainCategory = categoryAnalysis.categories.length > 0 ? 
              categoryAnalysis.categories.sort((a, b) => b.score - a.score)[0].name : 
              'Non catégorisé';
            
            return {
              ...record,
              category_analysis: categoryAnalysis,
              category: mainCategory,
            };
          } catch (parseError) {
            console.error(`Erreur lors du parsing de la réponse pour l'enregistrement ${record.id}:`, parseError);
            console.log('Réponse brute:', responseContent);
            
            return {
              ...record,
              category: 'Non catégorisé',
            };
          }
        } catch (error) {
          console.error(`Erreur lors de la catégorisation de l'enregistrement ${record.id}:`, error);
          return {
            ...record,
            category: 'Non catégorisé',
          };
        }
      });
      
      const categorizedBatch = await Promise.all(promises);
      categorizedRecords.push(...categorizedBatch);
    }
    
    console.log(`${categorizedRecords.length} enregistrements catégorisés.`);
    
    // Préparer les données pour le CSV (aplatir les données complexes)
    const flatRecords = categorizedRecords.map(record => {
      const flatRecord: any = { ...record };
      
      // Si l'analyse des catégories existe, la convertir en chaîne JSON
      if (flatRecord.category_analysis) {
        flatRecord.category_analysis_json = JSON.stringify(flatRecord.category_analysis);
        delete flatRecord.category_analysis;
      }
      
      return flatRecord;
    });
    
    // Écrire les données catégorisées dans un nouveau fichier CSV
    const csvOutput = stringify(flatRecords, {
      header: true,
      delimiter: ';',
      columns: ['id', 'project_id', 'asset_id', 'content_type', 'text', 'category', 'category_analysis_json', 'created_at', 'updated_at'],
    });
    
    fs.writeFileSync(outputFilePath, csvOutput);
    console.log(`Fichier catégorisé enregistré: ${outputFilePath}`);
    
    return categorizedRecords;
  } catch (error) {
    console.error('Erreur lors de la catégorisation des enregistrements:', error);
    throw error;
  }
}

/**
 * Processus le fichier d'embeddings en nettoyant les données et en ajoutant des catégories.
 * 
 * @param inputFilePath - Chemin du fichier CSV d'entrée contenant les embeddings.
 * @param cleanedFilePath - Chemin où le fichier CSV nettoyé sera enregistré.
 * @param categorizedFilePath - Chemin où le fichier CSV catégorisé sera enregistré.
 * @returns Une promesse qui se résout lorsque le traitement est terminé.
 */
export async function processEmbeddingsFile(
  inputFilePath: string = path.resolve(__dirname, '../../data/salim-embeddings.csv'),
  cleanedFilePath: string = path.resolve(__dirname, '../../data/cleaned-embeddings.csv'),
  categorizedFilePath: string = path.resolve(__dirname, '../../data/categorized-embeddings.csv')
): Promise<void> {
  try {
    // Étape 1: Nettoyer le CSV
    const cleanedRecords = await cleanCsvFile(inputFilePath, cleanedFilePath);
    
    // Étape 2: Ajouter des catégories
    await categorizeRecords(cleanedRecords, categorizedFilePath);
    
    console.log('Traitement du fichier d\'embeddings terminé avec succès.');
  } catch (error) {
    console.error('Erreur lors du traitement du fichier d\'embeddings:', error);
    throw error;
  }
}

if (require.main === module) {
  processEmbeddingsFile()
    .then(() => console.log('Traitement terminé avec succès.'))
    .catch(error => console.error('Erreur lors du traitement:', error));
}
