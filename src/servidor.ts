// Aula 08/10/2026
// Primeiro processo. Ainda sem banco. Ainda sem catálogo.

import express from "express";

const app = express();
const PORTA = 3000;

app.get("/clinica", (_req, res) => {
    res.status(200).json({
        ok: true,
        servico: "clinica-api",
        agora: new Date().toISOString(),
    });
});

app.listen(PORTA, () => {
    console.log(`API da clínica em http://localhost:${PORTA}`);
});