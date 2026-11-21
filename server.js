const app = require('./app');

const PORT = Number(process.env.PORT) || 3000;

const server = app.listen(PORT, () => {
  console.log(`[server] Escuchando en http://localhost:${PORT}`);
  console.log(`[server] Health check disponible en http://localhost:${PORT}/health`);
});

/**
 * Apagado ordenado para que Docker/Kubernetes no maten el proceso a la fuerza.
 */
function shutdown(signal) {
  console.log(`[server] Recibida señal ${signal}, cerrando servidor...`);
  server.close((error) => {
    if (error) {
      console.error('[server] Error al cerrar:', error);
      process.exit(1);
    }
    console.log('[server] Servidor cerrado correctamente.');
    process.exit(0);
  });
}

['SIGTERM', 'SIGINT'].forEach((signal) => {
  process.on(signal, () => shutdown(signal));
});

module.exports = server;
