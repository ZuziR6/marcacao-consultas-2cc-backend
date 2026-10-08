// Aula 08/10/2026
// SQLite da clínica. Um arquivo, quatro tabelas, seed do catálogo da 01/10.

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import catalogo from "./dados/catalogo.json";

const pastaDados = path.join(__dirname, "dados");
fs.mkdirSync(pastaDados, { recursive: true });

export const caminhoDb = path.join(pastaDados, "clinica.db");
export const db = new DatabaseSync(caminhoDb);

const SQL_ESQUEMA = `
CREATE TABLE IF NOT EXISTS especialidades (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT
);

CREATE TABLE IF NOT EXISTS medicos (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  crm TEXT NOT NULL,
  email TEXT NOT NULL,
  especialidade_id INTEGER NOT NULL,
  ativo INTEGER NOT NULL,
  FOREIGN KEY (especialidade_id) REFERENCES especialidades(id)
);

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  login TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL,
  papel TEXT NOT NULL,
  medico_id INTEGER,
  cpf TEXT,
  telefone TEXT,
  FOREIGN KEY (medico_id) REFERENCES medicos(id)
);

CREATE TABLE IF NOT EXISTS consultas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medico_id INTEGER NOT NULL,
  paciente_id INTEGER NOT NULL,
  data TEXT NOT NULL,
  valor REAL NOT NULL,
  status TEXT NOT NULL,
  observacoes TEXT,
  FOREIGN KEY (medico_id) REFERENCES medicos(id),
  FOREIGN KEY (paciente_id) REFERENCES usuarios(id)
);
`;

function semear() {
    const jaTem = db
        .prepare("SELECT COUNT(*) AS total FROM especialidades")
        .get() as { total: number };

    if (jaTem.total > 0) {
        return;
    }

    const inserirEspecialidade = db.prepare(
        "INSERT INTO especialidades (id, nome, descricao) VALUES (?, ?, ?)"
    );
    const inserirMedico = db.prepare(
        "INSERT INTO medicos (id, nome, crm, email, especialidade_id, ativo) VALUES (?, ?, ?, ?, ?, ?)"
    );
    const inserirUsuario = db.prepare(
        `INSERT INTO usuarios
      (id, nome, login, email, senha, papel, medico_id, cpf, telefone)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    db.exec("BEGIN");
    try {
        for (const item of catalogo.especialidades) {
            inserirEspecialidade.run(item.id, item.nome, item.descricao ?? null);
        }
        for (const item of catalogo.medicos) {
            inserirMedico.run(
                item.id,
                item.nome,
                item.crm,
                item.email,
                item.especialidadeId,
                item.ativo ? 1 : 0
            );
        }
        for (const item of catalogo.usuarios) {
            inserirUsuario.run(
                item.id,
                item.nome,
                item.login,
                item.email,
                item.senha,
                item.papel,
                "medicoId" in item ? item.medicoId ?? null : null,
                "cpf" in item ? item.cpf ?? null : null,
                "telefone" in item ? item.telefone ?? null : null
            );
        }
        db.exec("COMMIT");
    } catch (erro) {
        db.exec("ROLLBACK");
        throw erro;
    }
}

export function garantirBanco() {
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec(SQL_ESQUEMA);
    semear();
}

export function listarEspecialidades() {
    return db
        .prepare("SELECT id, nome, descricao FROM especialidades ORDER BY id")
        .all();
}

export function listarMedicos() {
    const linhas = db
        .prepare(
            `SELECT m.id, m.nome, m.crm, m.email, m.ativo,
              e.id AS especialidade_id, e.nome AS especialidade_nome,
              e.descricao AS especialidade_descricao
       FROM medicos m
       JOIN especialidades e ON e.id = m.especialidade_id
       ORDER BY m.id`
        )
        .all() as Array<{
            id: number;
            nome: string;
            crm: string;
            email: string;
            ativo: number;
            especialidade_id: number;
            especialidade_nome: string;
            especialidade_descricao: string | null;
        }>;

    return linhas.map((linha) => ({
        id: linha.id,
        nome: linha.nome,
        crm: linha.crm,
        email: linha.email,
        ativo: linha.ativo === 1,
        especialidade: {
            id: linha.especialidade_id,
            nome: linha.especialidade_nome,
            descricao: linha.especialidade_descricao ?? undefined,
        },
    }));
}

export function listarUsuarios() {
    const linhas = db
        .prepare(
            `SELECT id, nome, login, email, papel, medico_id, cpf, telefone
       FROM usuarios ORDER BY id`
        )
        .all() as Array<{
            id: number;
            nome: string;
            login: string;
            email: string;
            papel: string;
            medico_id: number | null;
            cpf: string | null;
            telefone: string | null;
        }>;

    return linhas.map((linha) => ({
        id: linha.id,
        nome: linha.nome,
        login: linha.login,
        email: linha.email,
        papel: linha.papel,
        medicoId: linha.medico_id ?? undefined,
        cpf: linha.cpf ?? undefined,
        telefone: linha.telefone ?? undefined,
    }));
}

export function buscarMedico(id: number) {
    return listarMedicos().find((medico) => medico.id === id) ?? null;
}

export function buscarUsuario(id: number) {
    const linha = db
        .prepare(
            `SELECT id, nome, login, email, senha, papel, medico_id, cpf, telefone
       FROM usuarios WHERE id = ?`
        )
        .get(id) as
        | {
            id: number;
            nome: string;
            login: string;
            email: string;
            senha: string;
            papel: string;
            medico_id: number | null;
            cpf: string | null;
            telefone: string | null;
        }
        | undefined;

    if (!linha) {
        return null;
    }

    return {
        id: linha.id,
        nome: linha.nome,
        login: linha.login,
        email: linha.email,
        senha: linha.senha,
        papel: linha.papel,
        medicoId: linha.medico_id ?? undefined,
        cpf: linha.cpf ?? undefined,
        telefone: linha.telefone ?? undefined,
    };
}

function montarConsulta(linha: {
    id: number;
    medico_id: number;
    paciente_id: number;
    data: string;
    valor: number;
    status: string;
    observacoes: string | null;
}) {
    const medico = buscarMedico(linha.medico_id);
    const usuario = buscarUsuario(linha.paciente_id);
    if (!medico || !usuario) {
        return null;
    }

    return {
        id: linha.id,
        medico,
        paciente: {
            id: usuario.id,
            nome: usuario.nome,
            cpf: usuario.cpf ?? "não informado",
            email: usuario.email,
            telefone: usuario.telefone,
        },
        data: linha.data,
        valor: linha.valor,
        status: linha.status,
        observacoes: linha.observacoes ?? undefined,
    };
}

export function listarConsultas() {
    const linhas = db
        .prepare(
            `SELECT id, medico_id, paciente_id, data, valor, status, observacoes
       FROM consultas ORDER BY id`
        )
        .all() as Array<{
            id: number;
            medico_id: number;
            paciente_id: number;
            data: string;
            valor: number;
            status: string;
            observacoes: string | null;
        }>;

    return linhas
        .map(montarConsulta)
        .filter((consulta) => consulta !== null);
}

export function buscarConsulta(id: number) {
    const linha = db
        .prepare(
            `SELECT id, medico_id, paciente_id, data, valor, status, observacoes
       FROM consultas WHERE id = ?`
        )
        .get(id) as
        | {
            id: number;
            medico_id: number;
            paciente_id: number;
            data: string;
            valor: number;
            status: string;
            observacoes: string | null;
        }
        | undefined;

    return linha ? montarConsulta(linha) : null;
}

export function inserirConsulta(entrada: {
    medicoId: number;
    pacienteId: number;
    data: string;
    observacoes: string;
}) {
    const resultado = db
        .prepare(
            `INSERT INTO consultas (medico_id, paciente_id, data, valor, status, observacoes)
       VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
            entrada.medicoId,
            entrada.pacienteId,
            entrada.data,
            350,
            "agendada",
            entrada.observacoes
        );

    return buscarConsulta(Number(resultado.lastInsertRowid));
}