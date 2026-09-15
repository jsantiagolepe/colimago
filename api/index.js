// Punto de entrada para Vercel. Todo el panel (login, /api/*, dashboard) es
// la misma app de Express de server.js; aquí solo se exporta para que Vercel
// la corra como función serverless. vercel.json manda todas las rutas aquí.
module.exports = require("../server");
