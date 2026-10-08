// Aula 08/10/2026
// Processo no terminal. Express recebe HTTP. SQLite grava clinica.db.
// O app Expo continua parado. JWT fica para a próxima aula.

import express from "express";
import cors from "cors";
import {
    buscarConsulta,
    buscarMedico,
    buscarUsuario,
    garantirBanco,
    inserirConsulta,
    listarConsultas,
    listarEspecialidades,
    listarMedicos,
    listarUsuarios,
} from "./banco";

const app = express();
const PORTA = Number(process.env.PORTA) || 3000;

app.use(cors());
app.use(express.json());

function dataCivil(data: Date): Date {
    return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

function validarDataAgenda(data: Date): string | null {
    const hoje = dataCivil(new Date());
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 2, hoje.getDate());
    const escolhida = dataCivil(data);

    if (escolhida.getTime() < inicio.getTime()) {
        return "Não é possível agendar para hoje nem para uma data passada.";
    }
    if (escolhida.getTime() > fim.getTime()) {
        return "A agenda abre no máximo 2 meses à frente.";
    }
    return null;
}

function parsearDataCivil(texto: string): Date | null {
    const soDia = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto.trim());
    if (!soDia) {
        return null;
    }
    const ano = Number(soDia[1]);
    const mes = Number(soDia[2]);
    const dia = Number(soDia[3]);
    const data = new Date(ano, mes - 1, dia);
    if (
        data.getFullYear() !== ano ||
        data.getMonth() !== mes - 1 ||
        data.getDate() !== dia
    ) {
        return null;
    }
    return data;
}

app.get("/clinica", (_req, res) => {
    res.status(200).json({
        ok: true,
        servico: "clinica-api",
        agora: new Date().toISOString(),
    });
});

app.get("/especialidades", (_req, res) => {
    res.status(200).json(listarEspecialidades());
});

app.get("/medicos", (_req, res) => {
    res.status(200).json(listarMedicos());
});

app.get("/usuarios", (_req, res) => {
    res.status(200).json(listarUsuarios());
});

app.get("/consultas", (_req, res) => {
    res.status(200).json(listarConsultas());
});

app.get("/consultas/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ erro: "Id inválido." });
        return;
    }

    const consulta = buscarConsulta(id);
    if (!consulta) {
        res.status(404).json({ erro: "Consulta não encontrada." });
        return;
    }

    res.status(200).json(consulta);
});

app.post("/consultas", (req, res) => {
    const medicoId = Number(req.body.medicoId);
    const pacienteId = Number(req.body.pacienteId);
    const dataTexto = String(req.body.data ?? "");

    if (!medicoId || !pacienteId || !dataTexto) {
        res.status(400).json({
            erro: "medicoId, pacienteId e data são obrigatórios.",
        });
        return;
    }

    const data = parsearDataCivil(dataTexto);
    if (!data) {
        res.status(400).json({
            erro: "data inválida. Use o formato 2026-10-20.",
        });
        return;
    }

    const erroData = validarDataAgenda(data);
    if (erroData) {
        res.status(400).json({ erro: erroData });
        return;
    }

    const medico = buscarMedico(medicoId);
    if (!medico) {
        res.status(404).json({ erro: "Médico não encontrado." });
        return;
    }
    if (!medico.ativo) {
        res.status(400).json({ erro: "Este médico não está ativo na agenda." });
        return;
    }

    const paciente = buscarUsuario(pacienteId);
    if (!paciente || paciente.papel !== "paciente") {
        res.status(404).json({ erro: "Paciente não encontrado." });
        return;
    }

    const observacoes =
        typeof req.body.observacoes === "string" && req.body.observacoes.trim()
            ? req.body.observacoes.trim()
            : `Agendada pela API (${medico.especialidade.nome})`;

    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");

    const criada = inserirConsulta({
        medicoId,
        pacienteId,
        data: `${ano}-${mes}-${dia}`,
        observacoes,
    });

    res.status(201).json(criada);
});

app.use((_req, res) => {
    res.status(404).json({ erro: "Rota não encontrada." });
});

garantirBanco();

app.listen(PORTA, () => {
    console.log(`API da clínica em http://localhost:${PORTA}`);
});