import { start } from './app';

// Démarrer le serveur
start().catch(err => {
  console.error('Erreur lors du démarrage du serveur:', err);
  process.exit(1);
});
