const https = require('https');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const qrcode = require('qrcode');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const cron = require('node-cron');
const cors = require('cors');
const axios = require('axios');
const { exec } = require('child_process');
const bcrypt = require('bcryptjs');


const app = express();
const PORT = 3080;

app.use(cors({
  origin: 'https://atentus.com.br',
  methods: ['GET', 'POST', 'OPTIONS'],
  Authorization: "Bearer 123456abcdef",
  credentials: true
}));

//credenciais ssl
const credentials = {
    key: fs.readFileSync('/etc/letsencrypt/live/atentus.com.br/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/atentus.com.br/fullchain.pem')
};

const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let qrBase64 = '';
let isConnected = false;
let client;

const diaMap = {
  1: 'segunda',
  2: 'terca',
  3: 'quarta',
  4: 'quinta',
  5: 'sexta',
  6: 'sabado'
};

const imagemMap = {
  1: 'diaum',
  2: 'diadois',
  3: 'diatres',
  4: 'diaquatro',
  5: 'diacinco',
  6: 'diaseis'
};

//Função para criptografar senha
async function senhaHash(password, saltRounds = 10) {
  try {
    const hash = await bcrypt.hash(password, saltRounds);
    return hash;
  } catch (error) {
    console.error('Erro ao gerar hash:', error);
    throw error;
  }
}

function lerHorarios() {
  const filePath = path.join(__dirname, 'horarios.txt');
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf-8');
  const horariosOriginais = content.split(',').map(h => parseInt(h.trim())).filter(h => !isNaN(h));

  // Converte cada horário para +3 %24
  const horariosConvertidos = horariosOriginais.map(hora => (hora + 3) % 24);

  console.log('📋 Horários do arquivo:', horariosOriginais);
  console.log('🔄 Horários convertidos (+3):', horariosConvertidos);

  return horariosConvertidos;
}

function lerGruposDestinatarios() {
  const filePath = path.join(__dirname, 'grupos_check.txt');
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf-8')
    .split('\n')
    .map(l => l.split('|')[0]?.trim())
    .filter(id => id && id.endsWith('@g.us'));
}


function lerMensagensDataTxt() {
  const filePath = path.join(__dirname, 'data.txt');
  if (!fs.existsSync(filePath)) return {};
  const linhas = fs.readFileSync(filePath, 'utf-8').split('\n');
  const mapa = {};
  for (const linha of linhas) {
    const [dia, ...msg] = linha.split(':');
    if (dia && msg.length > 0) {
      mapa[dia.trim()] = msg.join(':').trim().replace(/\\n/g, '\n');
    }
  }
  return mapa;
}

async function startClient() {
  client = new Client({
    authStrategy: new LocalAuth({ clientId: 'atentusadv' }),
    puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--no-zygote',
      '--single-process',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-client-side-phishing-detection',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-first-run',
      '--safebrowsing-disable-auto-update'
    ]
  }
  });

  client.on('qr', async qr => {
    qrBase64 = await qrcode.toDataURL(qr);
    isConnected = false;
    console.log('📲 Novo QR Code gerado.');
  });

  client.on('ready', () => {
    isConnected = true;
    console.log('✅ Chatbot conectado com sucesso!');
    escutarGrupos();
    agendarEnvios();
  });

  client.on('disconnected', () => {
    isConnected = false;
    console.log('❌ Cliente desconectado.');
  });

  await client.initialize();
}

startClient();



async function restartClient() {
  if (client) await client.destroy();
  await startClient();
}

async function logoutClient() {
  if (client) {
    await client.logout();
    await client.destroy();
  }
  const sessionPath = path.join(__dirname, '.wwebjs_auth', 'atentusadv');
  if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });
  isConnected = false;
  await startClient();
}

function escutarGrupos() {
  // Função auxiliar para processar e salvar o grupo
  async function processarGrupo(msg) {
    try {
      // Verifica se a mensagem é de um grupo ou para um grupo
      const isFromGroup = msg.from.endsWith('@g.us');
      const isToGroup = msg.to && msg.to.endsWith('@g.us');
      
      if (isFromGroup || isToGroup) {
        const grupoId = isFromGroup ? msg.from : msg.to;
        const chat = await msg.getChat();
        const nomeGrupo = chat.name;
        const registro = `${grupoId} - ${nomeGrupo}`;
        const arquivo = path.join(__dirname, 'grupos_scan.txt');
        
        // Lê arquivo existente ou cria string vazia
        const existente = fs.existsSync(arquivo) ? fs.readFileSync(arquivo, 'utf-8') : '';
        
        // Verifica se o grupo já está registrado
        if (!existente.includes(grupoId)) {
          fs.appendFileSync(arquivo, registro + '\n', 'utf-8');
          console.log(`📁 Grupo salvo: ${registro}`);
        }
      }
    } catch (error) {
      console.error('Erro ao processar mensagem do grupo:', error);
    }
  }

  // Escuta mensagens RECEBIDAS nos grupos
  client.on('message', async msg => {
    await processarGrupo(msg);
  });

  // Escuta mensagens ENVIADAS POR VOCÊ nos grupos
  client.on('message_create', async msg => {
    await processarGrupo(msg);
  });
}

function agendarEnvios() {
  console.log('📅 Função de agendamento registrada');
  const enviosFilePath = path.join(__dirname, 'envios_registrados.txt');
  let enviadosHoje = new Set();

  // Carregar envios já realizados
  if (fs.existsSync(enviosFilePath)) {
    const content = fs.readFileSync(enviosFilePath, 'utf-8');
    content.split('\n').filter(Boolean).forEach(line => enviadosHoje.add(line));
    console.log('📌 Envios já registrados carregados:', Array.from(enviadosHoje));
  }

  // Agendamento para limpar registros à meia-noite
  cron.schedule('0 0 * * *', () => {
    enviadosHoje.clear();
    if (fs.existsSync(enviosFilePath)) {
      fs.unlinkSync(enviosFilePath);
    }
    console.log('🔄 Registros de envios do dia anterior limpos.');
  });

  // Agendamento principal
  cron.schedule('0 * * * *', async () => {
    console.log('\n🕒 Agendamento ativado! Verificando envios...');
    console.log('📌 Envios já realizados hoje:', Array.from(enviadosHoje));
    
    const agora = new Date();
    const hora = agora.getHours();
    
    function diaSemana() {
      let day = agora.getDay();
      if (hora >= 0 && hora <= 1) {
        day = day - 1;
        if (day < 0) day = 6;
      }
      return day;
    }
    
    const dia = diaSemana();
    console.log(`📆 Data/hora atual: ${agora.toLocaleString()}`);
    console.log(`📆 Dia da semana: ${dia} (0=Domingo) | Hora atual: ${hora}`);

    if (dia === 0) {
      console.log('⛔ Domingo. Nenhum envio será feito.');
      return;
    }

    const horarios = lerHorarios();
    console.log('📂 Horários cadastrados:', horarios);

    if (!horarios.includes(hora)) {
      console.log(`⏱️ Hora ${hora} não está nos horários programados.`);
      return;
    }

    const chaveEnvio = `${dia}-${hora}`;
    if (enviadosHoje.has(chaveEnvio)) {
      console.log('🔁 Já enviado neste horário. Ignorando...');
      return;
    }

    const nomeImagemBase = imagemMap[dia];
    const nomeMensagem = diaMap[dia];

    if (!nomeImagemBase || !nomeMensagem) {
      console.log('⚠️ Dia não mapeado corretamente:', dia);
      return;
    }

    const mensagemMap = lerMensagensDataTxt();
    console.log('📜 Mapa de mensagens:', Object.keys(mensagemMap));

    const texto = mensagemMap[nomeMensagem];
    console.log(`📄 Texto para ${nomeMensagem}:`, texto.substring(0, 50) + '...');

    const exts = ['.jpg', '.png'];
    let caminhoImagem = null;
    let imagemExt = '';

    for (const ext of exts) {
      const tentativa = path.join(assetsDir, `${nomeImagemBase}${ext}`);
      if (fs.existsSync(tentativa)) {
        caminhoImagem = tentativa;
        imagemExt = ext;
        break;
      }
    }

    if (!caminhoImagem) {
      console.log(`🖼️ Imagem não encontrada para ${nomeImagemBase}`);
    } else {
      console.log(`🖼️ Imagem encontrada: ${caminhoImagem}`);
    }

    if (!caminhoImagem || !texto) {
      console.log(`⚠️ Conteúdo incompleto para ${nomeMensagem.toUpperCase()}. Imagem ou texto ausente.`);
      return;
    }

    try {
      const media = MessageMedia.fromFilePath(caminhoImagem);
      const grupos = lerGruposDestinatarios();
      
      if (grupos.length === 0) {
        console.log('⚠️ Nenhum grupo destinatário configurado.');
        return;
      }
      
      console.log(`📣 Preparando envio para ${grupos.length} grupos com intervalo de 2 segundos...`);
      const now = new Date();
      now.setHours(now.getHours() - 3);
      const horaMsg = now.toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const dataMsg = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

      let historicoEnvios = [];

      // Função para salvar o histórico - CORRIGIDA
      const salvarHistorico = async (dados) => {
        try {
          const caminhoArquivo = path.join(__dirname, 'historico-envios.json');
      
          // Carregar histórico existente
          try {
            const arquivoExistente = await fsPromises.readFile(caminhoArquivo, 'utf8');
            historicoEnvios = JSON.parse(arquivoExistente);
          } catch {
            // Arquivo não existe ainda, começar com array vazio
            historicoEnvios = [];
          }
          
          // Adicionar novo registro
          historicoEnvios.push(dados);
          
          // Salvar de volta no arquivo
          await fsPromises.writeFile(caminhoArquivo, JSON.stringify(historicoEnvios, null, 2));
        } catch (erro) {
          console.error('Erro ao salvar histórico:', erro);
        }
      };

      // Função auxiliar para enviar com delay
      const enviarComDelay = async (grupoId, index) => {
        const inicioEnvio = new Date();
        inicioEnvio.setHours(inicioEnvio.getHours() - 3);
        const horaMsg = inicioEnvio.toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const dataMsg = inicioEnvio.toLocaleDateString('pt-BR');
        const chat = await client.getChatById(grupoId);
        const nomeGrupo = chat.name;
        try {
          console.log(`\n⏳ Enviando para grupo ${index + 1}/${grupos.length}: ${grupoId}`);
          await client.sendMessage(grupoId, media, { caption: texto });
          console.log(`✅ Mensagem enviada com sucesso para ${nomeGrupo} em ${horaMsg} (${dataMsg})`);
          
          // Registrar sucesso
          await salvarHistorico({
            id: Date.now() + Math.random(), // ID único
            grupoId,
            status: 'sucesso',
            hora: horaMsg,
            data: dataMsg,
            nome: nomeGrupo,
            timestamp: inicioEnvio.toISOString(),
            posicao: `${index + 1}/${grupos.length}`,
            mensagem: `Mensagem enviada com sucesso para<br>${nomeGrupo}`
          });

          // Aguardar 2 segundos, exceto após o último envio
          if (index < grupos.length - 1) {
            console.log('⏱️ Aguardando 2 segundos antes do próximo envio...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (erroEnvio) {
          console.error(`❌ Erro ao enviar para${grupoId}:`, erroEnvio.message);

          await salvarHistorico({
            id: Date.now() + Math.random(),
            grupoId,
            status: 'erro',
            hora: horaMsg,
            data: dataMsg,
            nome: nomeGrupo,
            timestamp: inicioEnvio.toISOString(),
            posicao: `${index + 1}/${grupos.length}`,
            mensagem: `Erro ao enviar para<br>${nomeGrupo}:<br>${erroEnvio.message}`,
            erro: erroEnvio.message
          });
        }
      };

      // Processar envios em série com delay
      for (let i = 0; i < grupos.length; i++) {
        await enviarComDelay(grupos[i], i);
      }

      // Registrar envio somente após todos os grupos serem processados
      enviadosHoje.add(chaveEnvio);
      fs.appendFileSync(enviosFilePath, chaveEnvio + '\n', 'utf-8');
      console.log(`\n📝 Todos os envios concluídos. Registrado: ${chaveEnvio}`);
    } catch (erroGeral) {
      console.error(`❌ Erro no processo de envio para ${nomeMensagem}:`, erroGeral.message);
    }
  });
}


// ROTAS ==================================================

app.get('/index', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/qrcode', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'conexao.html'));
});

app.get('/status', (req, res) => {
  res.json({
    connected: isConnected,
    qr: isConnected ? null : qrBase64
  });
});

app.post('/restart', async (req, res) => {
  await restartClient();
  res.json({ message: 'Reiniciado com sucesso.' });
});

app.post('/logout', async (req, res) => {
  await logoutClient();
  res.json({ message: 'Logout concluído. QR code aguardando...' });
});

//ROTA PARA SALVAR IMAGENS
const upload = multer({ storage: multer.memoryStorage() });

app.post('/upload', upload.single('arquivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo enviado' });

  const diaSemana = req.body.diaSemana?.toLowerCase();
  const nomeBase = {
    segunda: 'diaum',
    terca: 'diadois',
    quarta: 'diatres',
    quinta: 'diaquatro',
    sexta: 'diacinco',
    sabado: 'diaseis'
  }[diaSemana] || 'desconhecido';

  const ext = path.extname(req.file.originalname);
  const nomeFinal = `${nomeBase}${ext}`;
  const caminhoFinal = path.join(assetsDir, nomeFinal);

  fs.writeFile(caminhoFinal, req.file.buffer, err => {
    if (err) return res.status(500).json({ message: 'Erro ao salvar' });
    res.json({ message: 'Arquivo salvo com sucesso', filename: nomeFinal });
  });
});

//ROTA PARA SALVAR MENSAGENS
app.post('/salvar', (req, res) => {
  const { mensagemSemana, mensagem } = req.body;
  const textoFormatado = mensagem.replace(/\r?\n/g, '\\n');
  const novaLinha = `${mensagemSemana}: ${textoFormatado}`;
  const filePath = path.join(__dirname, 'data.txt');

  const ordemDias = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

  fs.readFile(filePath, 'utf8', (err, data) => {
    let linhas = data ? data.split('\n').filter(Boolean) : [];
    const mapa = {};
    for (const linha of linhas) {
      const [dia, ...resto] = linha.split(':');
      if (ordemDias.includes(dia.trim())) {
        mapa[dia.trim()] = resto.join(':').trim();
      }
    }

    mapa[mensagemSemana] = textoFormatado;
    const novoConteudo = ordemDias.filter(dia => mapa[dia]).map(d => `${d}: ${mapa[d]}`).join('\n');

    fs.writeFile(filePath, novoConteudo + '\n', err => {
      if (err) return res.status(500).send('Erro ao salvar dados');
      res.status(200).send('Dados salvos com sucesso');
    });
  });
});

app.post('/horarios', (req, res) => {
  const { horarios } = req.body;

  if (!Array.isArray(horarios) || horarios.length === 0) {
    return res.status(400).json({ message: 'Horários inválidos' });
  }

  const unicos = [...new Set(horarios.map(h => parseInt(h)).filter(h => !isNaN(h)))];
  const ordenados = unicos.sort((a, b) => a - b);

  fs.writeFileSync(path.join(__dirname, 'horarios.txt'), ordenados.join(','), 'utf-8');

  res.status(200).json({ message: 'Horários atualizados com sucesso', horarios: ordenados });
});

app.get('/horarios', (req, res) => {
  const horarios = lerHorarios();
  res.json({ horarios });
});

app.get('/grupos', (req, res) => {
  const caminho = './grupos_scan.txt';
  if (!fs.existsSync(caminho)) return res.json([]);

  const dados = fs.readFileSync(caminho, 'utf-8');
  const grupos = dados
    .split('\n')
    .filter(Boolean)
    .map(linha => {
      const [id, nome] = linha.split('|').map(x => x.trim());
      return { id, nome };
    });

  res.json(grupos);
});

// POST /grupos – salva no grupos_check.txt
app.post('/grupos', (req, res) => {
  const grupos = req.body;
  const texto = grupos.map(g => `${g.id} | ${g.nome}`).join('\n');
  fs.writeFileSync('./grupos_check.txt', texto, 'utf-8');
  res.json({ message: 'Grupos salvos com sucesso!' });
});

//meusanuncios

app.get('/gruposcheck', (req, res) => {
  const gruposPath = path.join(__dirname, 'grupos_check.txt');

  if (!fs.existsSync(gruposPath)) {
    return res.json([]); // Retorna array vazio se o arquivo não existir
  }

  const linhas = fs.readFileSync(gruposPath, 'utf-8').split('\n').filter(Boolean);
  const grupos = linhas.map(linha => {
    const [id, nome] = linha.split('|').map(p => p.trim());
    return { id, nome };
  });

  res.json(grupos);
});

//meusanuncios preview

app.get('/anuncio/:dia', (req, res) => {
  const nomesDias = {
    segunda: 'diaum',
    terca: 'diadois',
    quarta: 'diatres',
    quinta: 'diaquatro',
    sexta: 'diacinco',
    sabado: 'diaseis'
  };

  const dia = req.params.dia.toLowerCase();
  const nomeImagem = nomesDias[dia];
  if (!nomeImagem) return res.status(400).json({ error: 'Dia inválido' });

  const exts = ['jpg', 'png'];
  let imagemPath = null;
  for (const ext of exts) {
    const caminho = path.join(__dirname, 'assets', `${nomeImagem}.${ext}`);
    if (fs.existsSync(caminho)) {
      imagemPath = caminho;
      break;
    }
  }

  const imagemBase64 = imagemPath
    ? `data:image/${path.extname(imagemPath).substring(1)};base64,${fs.readFileSync(imagemPath, 'base64')}`
    : '';

  // função para ler mensagens do data.txt
  const lerMensagensDataTxt = () => {
    const dataPath = path.join(__dirname, 'data.txt');
    const mapa = {};
    if (fs.existsSync(dataPath)) {
      const conteudo = fs.readFileSync(dataPath, 'utf-8');
      const linhas = conteudo.split('\n').filter(Boolean);
      for (const linha of linhas) {
        const [diaTxt, ...resto] = linha.split(':');
        if (diaTxt && resto.length) {
          mapa[diaTxt.trim()] = resto.join(':').replace(/\\n/g, '\n').trim();
        }
      }
    }
    return mapa;
  };

  const mapaMensagens = lerMensagensDataTxt();
  const texto = mapaMensagens[dia] || '';

  res.json({ texto, imagemBase64 });
});

//meusanuncios duplicar
app.post('/copiar-anuncio', (req, res) => {
  try {
    const { diaOrigem, diasDestino } = req.body;

    if (!diaOrigem || !diasDestino || !Array.isArray(diasDestino)) {
      return res.status(400).send('Parâmetros inválidos');
    }

    const nomesDias = { segunda: 'diaum', terca: 'diadois', quarta: 'diatres', quinta: 'diaquatro', sexta: 'diacinco', sabado: 'diaseis' };

    const nomeOrigem = nomesDias[diaOrigem];
    if (!nomeOrigem) return res.status(400).send('Dia de origem inválido');

    const exts = ['.jpg', '.png'];
    let imagemOrigemPath = null;
    let extensao = '';

    for (const ext of exts) {
      const caminho = path.join(__dirname, 'assets', `${nomeOrigem}${ext}`);
      if (fs.existsSync(caminho)) {
        imagemOrigemPath = caminho;
        extensao = ext;
        break;
      }
    }
    if (!imagemOrigemPath) return res.status(404).send('Imagem de origem não encontrada');

    const mensagens = lerMensagensDataTxt();

    const textoOrigem = mensagens[diaOrigem];
    if (!textoOrigem) return res.status(404).send('Mensagem de origem não encontrada');

    diasDestino.forEach(dest => {
      const nomeDestino = nomesDias[dest];
      if (!nomeDestino) return;

      const destinoPath = path.join(__dirname, 'assets', `${nomeDestino}${extensao}`);
      fs.copyFileSync(imagemOrigemPath, destinoPath);

      mensagens[dest] = textoOrigem;
    });

    const ordemDias = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const novaData = ordemDias
      .map(dia => mensagens[dia] ? `${dia}: ${mensagens[dia].replace(/\n/g, '\\n')}` : null)
      .filter(Boolean)
      .join('\n');

    fs.writeFileSync(path.join(__dirname, 'data.txt'), novaData + '\n');

    res.send('Anúncio copiado com sucesso.');
  } catch (error) {
    console.error('Erro em /copiar-anuncio:', error);
    res.status(500).send('Erro interno no servidor');
  }
});

//apagar anuncio
app.post('/apagar-anuncio', (req, res) => {
  try {
    const { dia } = req.body;

    if (!dia) return res.status(400).send('Dia não informado.');

    const nomesDias = { segunda: 'diaum', terca: 'diadois', quarta: 'diatres', quinta: 'diaquatro', sexta: 'diacinco', sabado: 'diaseis' };
    const nomeArquivo = nomesDias[dia];

    if (!nomeArquivo) return res.status(400).send('Dia inválido.');

    // Apagar imagem do dia
    const exts = ['.jpg', '.png'];
    for (const ext of exts) {
      const caminho = path.join(__dirname, 'assets', `${nomeArquivo}${ext}`);
      if (fs.existsSync(caminho)) fs.unlinkSync(caminho);
    }

    // Apagar texto do dia
    const mensagens = lerMensagensDataTxt();
    delete mensagens[dia];

    const ordemDias = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const novaData = ordemDias
      .map(d => mensagens[d] ? `${d}: ${mensagens[d].replace(/\n/g, '\\n')}` : null)
      .filter(Boolean)
      .join('\n');

    fs.writeFileSync(path.join(__dirname, 'data.txt'), novaData + '\n');

    res.send(`Anúncio apagado com sucesso.`);
  } catch (error) {
    console.error('Erro em /apagar-anuncio:', error);
    res.status(500).send('Erro interno no servidor');
  }
});

//apagar todos
app.post('/apagar-todos-anuncios', (req, res) => {
  try {
    const nomesDias = { segunda: 'diaum', terca: 'diadois', quarta: 'diatres', quinta: 'diaquatro', sexta: 'diacinco', sabado: 'diaseis' };

    // Apagar todas as imagens
    Object.values(nomesDias).forEach(nomeArquivo => {
      ['.jpg', '.png'].forEach(ext => {
        const caminho = path.join(__dirname, 'assets', `${nomeArquivo}${ext}`);
        if (fs.existsSync(caminho)) fs.unlinkSync(caminho);
      });
    });

    // Limpar o data.txt
    fs.writeFileSync(path.join(__dirname, 'data.txt'), '');

    res.send('Todos os anúncios foram apagados com sucesso.');
  } catch (error) {
    console.error('Erro em /apagar-todos-anuncios:', error);
    res.status(500).send('Erro interno no servidor');
  }
});



//teste
/*app.get('/testar-envio-agora', async (req, res) => {
  const agora = new Date();
  const hora = agora.getHours();
  
  function diaSemana() {
    let day = agora.getDay();
    if (hora >= 0 && hora <= 1) {
      day = day - 1;
      if (day < 0) {
        day = 6;
      }
    }
    return day;
  }
  
  const dia = diaSemana();
  console.log(`📆 Teste - Dia: ${dia} | Hora: ${hora}`);

  if (dia === 0) {
    return res.send('⛔ Domingo. Nenhum envio será feito.');
  }

  const nomeImagemBase = imagemMap[dia];
  const nomeMensagem = diaMap[dia];

  if (!nomeImagemBase || !nomeMensagem) {
    return res.send(`⚠️ Dia não mapeado corretamente: ${dia}`);
  }

  const mensagemMap = lerMensagensDataTxt();
  console.log('📜 Mapa de mensagens:', mensagemMap);

  const texto = mensagemMap[nomeMensagem];
  console.log(`📄 Texto para ${nomeMensagem}:`, texto);

  const exts = ['.jpg', '.png'];
  let caminhoImagem = null;

  for (const ext of exts) {
    const tentativa = path.join(assetsDir, `${nomeImagemBase}${ext}`);
    if (fs.existsSync(tentativa)) {
      caminhoImagem = tentativa;
      break;
    }
  }

  if (!caminhoImagem) {
    console.log(`🖼️ Imagem não encontrada para ${nomeImagemBase}`);
  } else {
    console.log(`🖼️ Imagem encontrada: ${caminhoImagem}`);
  }

  if (!caminhoImagem || !texto) {
    return res.send(`⚠️ Conteúdo incompleto para ${nomeMensagem.toUpperCase()}. Imagem ou texto ausente.`);
  }

  try {
    const media = MessageMedia.fromFilePath(caminhoImagem);
    const grupos = lerGruposDestinatarios();
    console.log(`📣 Enviando para grupos:, \n${grupos}`);

    for (const grupoId of grupos) {
      try {
        await client.sendMessage(grupoId, media, { caption: texto });
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log(`✅ Mensagem de teste enviada para ${grupoId} (${nomeMensagem})`);
      } catch (erroEnvio) {
        console.error(`❌ Erro ao enviar para ${grupoId}:`, erroEnvio.message);
      }
    }

    res.send(`✅ Teste de envio manual concluído para ${nomeMensagem}.`);
  } catch (erroGeral) {
    console.error(`❌ Erro no processo de envio para ${nomeMensagem}:`, erroGeral.message);
    res.send('❌ Erro ao enviar mensagem de teste');
  }
});
*/

//cadastro
const LOGIN_FILE = 'login.txt';

// Inicializar o arquivo login.txt, se não existir
async function inicializarArquivoLogin() {
  try {
    await fsPromises.access(LOGIN_FILE);
    console.log('Arquivo login.txt encontrado');
  } catch (error) {
    await fsPromises.writeFile(LOGIN_FILE, '', 'utf8');
    console.log('Arquivo login.txt criado');
  }
}

// Função para ler usuários do arquivo
async function lerUsuarios() {
  try {
    const data = await fsPromises.readFile(LOGIN_FILE, 'utf8');
    if (!data.trim()) return [];

    return data.trim().split('\n').map(linha => {
      const [login, senha] = linha.split(':');
      return { login, senha };
    }).filter(user => user.login && user.senha);
  } catch (error) {
    console.error('Erro ao ler usuários:', error);
    return [];
  }
}

// Função para salvar um novo usuário
async function salvarUsuario(login, senha) {
  try {
    const novaLinha = `${login}:${senha}\n`;
    await fsPromises.appendFile(LOGIN_FILE, novaLinha, 'utf8');
    return true;
  } catch (error) {
    console.error('Erro ao salvar usuário:', error);
    return false;
  }
}

// Verifica se o login já existe
async function usuarioExiste(login) {
  const usuarios = await lerUsuarios();
  return usuarios.some(user => user.login === login);
}

// ROTAS DA API

// Rota para cadastrar usuário
app.post('/cadastrar', async (req, res) => {
  try {
    const { login, senha, email } = req.body;

    const response = await axios({
      'method': 'POST',
     url: 'https://atentus.cloud/api/create.php',
      headers: {
        'Authorization': 'Bearer 123456abcdef',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      data: {
        login: login,
        senha: senha,
        email: email
      }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Erro no proxy da API externa:', error.message);

    if (error.response) {
      return res.status(error.response.status).send(error.response.data);
    }

    res.status(500).json({ sucesso: false, mensagem: 'Erro ao conectar com a API externa' });
  }
});

// Rota para fazer login

app.post('/login', async (req, res) => {
  try {
  const { login, senha } = req.body;

   const response = await axios({
    'method': 'POST',
    url: 'https://atentus.cloud/api/read.php',
    headers: {
      'Authorization': 'Bearer 123456abcdef',
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    data: {
      login: login,
      senha: senha
    }
  });
  
  console.log(response.data);

  const token = response.data.token;
  if (token !== null) {
    res.status(200).json({ sucesso: true, mensagem: 'Sucesso' });
  } else {
    res.status(401).json({ sucesso: false, mensagem: 'Usuário o ou senha incorretos' });
  }

  }  catch (error) {
    if (error.response) {
      console.error('Erro da API externa:', error.response.status, error.response.data);
      return res.status(error.response.status).json(error.response.data);
    }

    console.error('Erro no proxy da API externa:', error.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao conectar com a API externa' });
  }
});
     
//rotas para alterar senha
// Rota para listar usuários (confirmação de email)
app.post('/listar-usuarios', async (req, res) => {
  try {
    const response = await axios({
      'method': 'GET',
      url: 'https://atentus.cloud/api/listarUsers.php',
      headers: {
        'Authorization': 'Bearer 123456abcdef',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log('Usuários listados:', response.data);
    
    // Retorna os dados diretamente
    res.status(200).json(response.data);

  } catch (error) {
    if (error.response) {
      console.error('Erro da API externa:', error.response.status, error.response.data);
      return res.status(error.response.status).json(error.response.data);
    }

    console.error('Erro no proxy da API externa:', error.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao conectar com a API externa' });
  }
});

// Rota para alterar senha
app.post('/alterar-senha', async (req, res) => {
  try {
    const { id, login, senha, email } = req.body;

    const senhaCriptografada = await senhaHash(senha, 10);

    // Validação básica
    if (!id || !login || !senha || !email) {
      return res.status(400).json({ 
        sucesso: false, 
        mensagem: 'Dados obrigatórios: id, login, senha, email' 
      });
    }

    const response = await axios({
      'method': 'POST',
      url: 'https://atentus.cloud/api/update.php',
      headers: {
        'Authorization': 'Bearer 123456abcdef',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      data: {
        id: id,
        login: login,
        senha: senhaCriptografada,
        email: email
      }
    });
    
    console.log('Senha alterada:', response.data);
    
    // Verifica se a alteração foi bem-sucedida
    if (response.data.sucesso !== false) {
      res.status(200).json({ 
        sucesso: true, 
        mensagem: 'Senha alterada com sucesso',
        dados: response.data 
      });
    } else {
      res.status(400).json({ 
        sucesso: false, 
        mensagem: response.data.mensagem || 'Erro ao alterar senha' 
      });
    }

  } catch (error) {
    if (error.response) {
      console.error('Erro da API externa:', error.response.status, error.response.data);
      return res.status(error.response.status).json(error.response.data);
    }

    console.error('Erro no proxy da API externa:', error.message);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao conectar com a API externa' });
  }
});

// Rota para listar usuários (apenas para debug)
app.get('/usuarios', async (req, res) => {
  try {
    const usuarios = await lerUsuarios();
    // Não retornar senhas por segurança
    const usuariosSemSenha = usuarios.map(user => ({ login: user.login }));
    res.json(usuariosSemSenha);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

//ROTAS DE HISTORICO

app.get('/historico-envios', async (req, res) => {
  console.log('📡 Requisição recebida para /historico-envios');
  try {
    const caminhoArquivo = path.join(__dirname, 'historico-envios.json');
    console.log('📁 Caminho do arquivo:', caminhoArquivo);
    
    // Verificar se arquivo existe usando fs.promises
    try {
      await fs.promises.access(caminhoArquivo);
      console.log('📄 Arquivo existe');
    } catch {
      console.log('📄 Arquivo não encontrado');
      return res.status(404).json({ erro: 'Arquivo de histórico não encontrado' });
    }
    
    // Ler arquivo
    const dados = await fs.promises.readFile(caminhoArquivo, 'utf8');
    console.log('📊 Dados lidos:', dados.length, 'caracteres');
    
    // Parsear JSON
    const historico = JSON.parse(dados);
    console.log('✅ JSON parseado com', historico.length, 'itens');
    
    // Enviar resposta
    res.json(historico);
  } catch (erro) {
    console.error('❌ Erro no servidor:', erro);
    res.status(500).json({ 
      erro: 'Erro ao carregar histórico',
      detalhes: erro.message 
    });
  }
});

// Limpar histórico antigo (opcional)
app.delete('/delete-historico-envios', async (req, res) => {
  try {
    const caminhoArquivo = path.join(__dirname, 'historico-envios.json');
    await fs.promises.writeFile(caminhoArquivo, JSON.stringify([]));
    res.json({ sucesso: true });
  } catch (erro) {
    console.error('❌ Erro ao apagar histórico:', erro);
    res.status(500).json({ erro: 'Erro ao limpar histórico' });
  }
});

const httpsServer = https.createServer(credentials, app);
httpsServer.listen(PORT, () => {
    console.log(`Servidor rodando em https://atentus.com.br:${PORT}`);
});