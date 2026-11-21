const express = require('express');

const app = express();

app.use(express.json());
app.disable('x-powered-by');

/**
 * Endpoint raíz: mensaje de bienvenida.
 */
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Bienvenido al laboratorio CI/CD con Node.js, Express y Docker',
  });
});

/**
 * Endpoint de salud usado por contenedores y balanceadores.
 */
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

/**
 * 404 en formato JSON para rutas desconocidas.
 */
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
});

module.exports = app;
