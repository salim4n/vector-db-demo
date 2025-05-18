import Fastify, { FastifyInstance } from 'fastify';
import dotenv from 'dotenv';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

// Import des routes
import ingestionRoutes from './routes/ingestion';
import documentsRoutes from './routes/documents';
import healthRoutes from './routes/health';

dotenv.config();

const server: FastifyInstance = Fastify({
  logger: true
});

// Les routes sont maintenant définies dans la fonction registerRoutes()

// Configurer Swagger
async function setupSwagger() {
  await server.register(fastifySwagger, {
    swagger: {
      info: {
        title: 'API de Démonstration Vector DB',
        description: 'API pour l\'ingestion, le nettoyage, la catégorisation et la recherche de documents',
        version: '1.0.0'
      },
      consumes: ['application/json'],
      produces: ['application/json'],
      tags: [
        { name: 'ingestion', description: 'Endpoints d\'ingestion de données' },
        { name: 'documents', description: 'Endpoints de récupération de documents' },
        { name: 'catégories', description: 'Endpoints de gestion des catégories' },
        { name: 'santé', description: 'Endpoints de santé de l\'application' }
      ]
    }
  });

  await server.register(fastifySwaggerUi, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false
    }
  });
}

// Enregistrer les routes
async function registerRoutes() {
  // Enregistrer les routes d'ingestion
  await server.register(ingestionRoutes);
  
  // Enregistrer les routes de documents
  await server.register(documentsRoutes);
  
  // Enregistrer les routes de santé
  await server.register(healthRoutes);
}

// Démarrer le serveur
async function start() {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    const host = process.env.HOST || '0.0.0.0';
    
    await setupSwagger();
    await registerRoutes();
    
    await server.listen({ port, host });
    console.log(`Serveur démarré sur ${host}:${port}`);
    console.log(`Documentation Swagger disponible sur http://${host}:${port}/documentation`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Exécuter le serveur si ce fichier est appelé directement
if (require.main === module) {
  start();
}

export { server, start };