require('dotenv').config();
const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = 3000;

// Conectar ao banco de dados SQLite (semelhante ao H2)
const db = new sqlite3.Database('./feriados.db', (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite.');
  }
});

// Criar a tabela de feriados ao iniciar
db.run(
  `CREATE TABLE IF NOT EXISTS feriados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL
  )`,
  (err) => {
    if (err) {
      console.error('Erro ao criar tabela:', err.message);
    }
  }
);

// Função para buscar feriados da API Nager.Date e salvar no banco
async function buscarEFazerCache(year) {
  try {
    console.log(`🔄 Buscando feriados para o ano ${year}...`);
    const response = await axios.get(`https://date.nager.at/api/v3/PublicHolidays/${year}/BR`);
    const feriados = response.data;

    // Limpa a tabela antes de inserir novos dados
    db.run('DELETE FROM feriados', (err) => {
      if (err) console.error('Erro ao limpar tabela:', err.message);
    });

    // Inserir os feriados no banco
    const stmt = db.prepare('INSERT INTO feriados (data, nome, tipo) VALUES (?, ?, ?)');
    feriados.forEach((feriado) => {
      stmt.run(feriado.date, feriado.localName, feriado.global ? 'Nacional' : 'Regional');
    });
    stmt.finalize();

    console.log('✅ Feriados salvos no banco de dados!');
  } catch (error) {
    console.error('Erro ao buscar feriados:', error.message);
  }
}

// Rota para listar feriados do banco
app.get('/feriados/:year', async (req, res) => {
    const year = req.params.year;
  
    // Verifica se já temos os feriados no banco
    db.all('SELECT * FROM feriados WHERE data LIKE ?', [`${year}-%`], async (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
  
      if (rows.length > 0) {
        // Se já temos os feriados no banco, retorna os dados armazenados
        return res.json(rows);
      } else {
        // Se não temos os feriados, busca na API e armazena no banco
        try {
          console.log(`🔄 Buscando feriados do ano ${year} na API...`);
          const response = await axios.get(`https://date.nager.at/api/v3/PublicHolidays/${year}/BR`);
          const feriados = response.data;
  
          const stmt = db.prepare('INSERT INTO feriados (data, nome, tipo) VALUES (?, ?, ?)');
          feriados.forEach((feriado) => {
            stmt.run(feriado.date, feriado.localName, feriado.global ? 'Nacional' : 'Regional');
          });
          stmt.finalize();
  
          console.log(`✅ Feriados do ano ${year} salvos no banco!`);
          res.json(feriados);
        } catch (error) {
          res.status(500).json({ error: 'Erro ao buscar feriados' });
        }
      }
    });
  });
  

// Inicia o servidor e popula o banco com feriados do ano atual
app.listen(port, async () => {
  console.log(`🚀 Servidor rodando em http://localhost:${port}`);
  const anoAtual = new Date().getFullYear();
  await buscarEFazerCache(anoAtual);
});
