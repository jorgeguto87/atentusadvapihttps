let usuarioLogado = false;
let sessionToken = null;

// Páginas que não requerem login
const paginasPublicas = ['login', 'cadastro', 'confirm', 'senha'];


// Função para verificar se o usuário está logado
function verificarAutenticacao() {
  // Verifica se existe um token de sessão válido
  const token = sessionStorage.getItem('sessionToken');
  const loginStatus = sessionStorage.getItem('usuarioLogado');
  
  if (token && loginStatus === 'true') {
    usuarioLogado = true;
    sessionToken = token;
    return true;
  }
  return false;
}

// Função para fazer login (agora usando API)
async function realizarLogin(username, password) {
  try {
    const response = await fetch('https://atentus.com.br:3040/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        login: username,
        senha: password
      })
    });
    
    const resultado = await response.json();
    
    if (resultado.sucesso) {
      usuarioLogado = true;
      sessionToken = resultado.token;
      
      // Salvar estado de login na sessão
      sessionStorage.setItem('usuarioLogado', 'true');
      sessionStorage.setItem('sessionToken', sessionToken);
      sessionStorage.setItem('loginUsuario', username);
      
      // Mostrar/esconder elementos baseado no login
      atualizarInterfaceLogin();
      
      return { sucesso: true, mensagem: resultado.mensagem };
      console.log('token:', sessionToken);
    } else {
      return { sucesso: false, mensagem: resultado.mensagem };
    }
    
  } catch (error) {
    console.error('Erro no login:', error);
    return { sucesso: false, mensagem: 'Erro de conexão com o servidor' };
  }
}



// Função para cadastrar usuário (agora usando API)
async function realizarCadastroUsuario(login, senha, email) {
  
  try {
    const response = await fetch('https://atentus.com.br:3040/cadastrar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        login: login,
        senha: senha,
        email: email
      })
    });
    
    const resultado = await response.json();
    
    alert('Resposta do servidor:', resultado);
    
    return {
      sucesso: resultado.sucesso,
      mensagem: resultado.mensagem
    };
    
  } catch (error) {
    console.error('Erro no cadastro:', error);
    return {
      sucesso: false,
      mensagem: 'Erro de conexão com o servidor'
    };
  }
}

// Função para fazer logout
function realizarLogout() {
  usuarioLogado = false;
  sessionToken = null;
  
  // Limpar dados da sessão
  sessionStorage.removeItem('usuarioLogado');
  sessionStorage.removeItem('sessionToken');
  sessionStorage.removeItem('loginUsuario');
  
  // Atualizar interface
  atualizarInterfaceLogin();
  
  // Redirecionar para login
  carregarPagina('login');
}

// Função para atualizar a interface baseada no status de login
function atualizarInterfaceLogin() {
  const navLinks = document.querySelectorAll('[data-page]');
  
  navLinks.forEach(link => {
    const pagina = link.getAttribute('data-page');
    
    if (!paginasPublicas.includes(pagina)) {
      if (usuarioLogado) {
        link.style.display = 'block';
        link.style.pointerEvents = 'auto';
        link.style.opacity = '1';
      } else {
        link.style.display = 'none';
      }
    }
  });
  
  // Mostrar nome do usuário logado se houver elemento para isso
  const userDisplay = document.getElementById('usuarioLogado');
  if (userDisplay) {
    const nomeUsuario = sessionStorage.getItem('loginUsuario');
    if (usuarioLogado && nomeUsuario) {
      userDisplay.textContent = `Bem-vindo, ${nomeUsuario}!`;
      userDisplay.style.display = 'block';
    } else {
      userDisplay.style.display = 'none';
    }
  }
}

function carregarPagina(pagina) {
  // Verificar se a página requer autenticação
  if (!paginasPublicas.includes(pagina) && !verificarAutenticacao()) {
    alert('Você precisa fazer login para acessar esta página!');
    carregarPagina('login');
    return;
  }
  

if (pagina !== 'sair') {
  // Debug: verificar se o arquivo existe
  console.log(`Tentando carregar: pages/${pagina}.html`);
  
  fetch(`https://atentus.com.br:3040/pages/${pagina}.html`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Arquivo não encontrado: pages/${pagina}.html (${response.status})`);
      }
      return response.text();
    })
    .then(html => {
      const main = document.querySelector('main') || document.getElementById('main');
      if (main) {
        main.innerHTML = html;
      }
      
      // Atualizar navegação ativa
      const activeLinks = document.querySelectorAll('.nav-link.active');
      activeLinks.forEach(link => link.classList.remove('active'));
      
      const currentLink = document.querySelector(`[data-page="${pagina}"]`);
      if (currentLink) {
        currentLink.classList.add('active');
      }else if (pagina === 'historico') {
  iniciarAtualizacaoAutomatica(); // Inicia o carregamento automático
}
      
      // Inicializar funcionalidades específicas da página
      if (pagina === 'login') {
  inicializarLogin();
} else if (pagina === 'cadastro') {
  botaoLogin();
  inicializarElementosPagina();
  inicializarCadastro();
} else {
  inicializarElementosPagina();

  if (pagina === 'confirm') {
    inicializarPaginaConfirm();
  } else if (pagina === 'senha') {
    inicializarPaginaSenha();
  }
}

      
      // Atualizar interface baseada no login
      atualizarInterfaceLogin();
      
      console.log(`Página ${pagina} carregada com sucesso`);
    })
    .catch((error) => {
      console.error('Erro detalhado:', error);
      const main = document.querySelector('main') || document.getElementById('main');
      if (main) {
        if (pagina === 'anuncios') {
          const nomeUsuario = sessionStorage.getItem('loginUsuario') || 'Usuário';
          main.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
              <h2>Bem-vindo, ${nomeUsuario}!</h2>
              <p>Login realizado com sucesso.</p>
              <p><small>Arquivo pages/anuncios.html não encontrado.</small></p>
              <button onclick="realizarLogout()" style="background: #dc3545; color: white; border: none; border-radius: 4px;">
                Fazer Logout
              </button>
            </div>
          `;
        } else {
          main.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
              <h2>Erro ao carregar página</h2>
              <p>Não foi possível carregar: <strong>${pagina}.html</strong></p>
              <p><small>${error.message}</small></p>
              <button onclick="carregarPagina('login')">
                Voltar ao Login
              </button>
            </div>
          `;
        }
      }
    });
}
}
// Função para inicializar o cadastro
function inicializarCadastro() {
  const btncadastrarUser = document.getElementById('btnCadastrar');
  const loginCadastro = document.getElementById('loginCadastro');
  const senhaCadastro = document.getElementById('senhaCadastro');
  const emailCadastro = document.getElementById('emailCadastro');
  const statusCadastro = document.getElementById('statusCadastro');

  if (btncadastrarUser) {
    btncadastrarUser.addEventListener('click', async (e) => {
      e.preventDefault();
      
      if (!loginCadastro || !senhaCadastro || !emailCadastro) {
        console.error('Elementos de cadastro não encontrados');
        return;
      }
      
      // Mostrar loading
      btncadastrarUser.disabled = true;
      btncadastrarUser.textContent = 'Cadastrando...';
      
      if (statusCadastro) {
        statusCadastro.textContent = 'Processando...';
        statusCadastro.style.color = 'blue';
      }
      
      const resultado = await realizarCadastroUsuario(
        loginCadastro.value.trim(),
        senhaCadastro.value.trim(),
        emailCadastro.value
      );
      console.log('Resultado do cadastro:', resultado);
      // Restaurar botão
      btncadastrarUser.disabled = false;
      btncadastrarUser.textContent = 'Cadastrar';
      
      if (statusCadastro) {
        statusCadastro.textContent = resultado.mensagem;
        statusCadastro.style.color = resultado.sucesso ? 'green' : 'red';
      }
      
      if (resultado.sucesso) {
        loginCadastro.value = '';
        senhaCadastro.value = '';
        emailCadastro.value = '';
        
        // Redirecionar para login após cadastro bem-sucedido
        setTimeout(() => {
          carregarPagina('login');
        }, 1500);
      }
    });
  } else {
    console.error('Botão de cadastro não encontrado');
  }
}

function botaoLogin(){
  const btnLogin = document.getElementById('linkLogin');
  if (btnLogin) {
    btnLogin.addEventListener('click', (e) => {
      e.preventDefault();
      carregarPagina('login');
    });
  }
}

function botaoCadastrar(){
  const btnCadastro = document.getElementById('linkCadastro');
  if (btnCadastro) {
    btnCadastro.addEventListener('click', (e) => {
      e.preventDefault();
      carregarPagina('cadastro');
    });
  }
}

function botaoEsqueciSenha(){
  const btnSenha = document.getElementById('linkSenha');
  if (btnSenha) {
    btnSenha.addEventListener('click', (e) => {
      e.preventDefault();
      carregarPagina('confirm');
    });
  }
}

function inicializarLogin() {
  const btnEntrar = document.getElementById('btnEntrar');
  
  if (btnEntrar) {
    btnEntrar.addEventListener('click', async (e) => {
      e.preventDefault();
      
      const login = document.getElementById('login');
      const senha = document.getElementById('senha');
      const statusLogin = document.getElementById('statusLogin');
      
      // Limpar status anterior
      if (statusLogin) {
        statusLogin.textContent = '';
        statusLogin.style.color = '';
      }
      
      if (login && senha) {
        // Mostrar loading
        btnEntrar.disabled = true;
        btnEntrar.textContent = 'Entrando...';
        
        if (statusLogin) {
          statusLogin.textContent = 'Verificando credenciais...';
          statusLogin.style.color = 'blue';
        }
        
        const resultado = await realizarLogin(login.value.trim(), senha.value);
        
        // Restaurar botão
        btnEntrar.disabled = false;
        btnEntrar.textContent = 'Entrar';
        
        if (resultado.sucesso) {
          // Login bem-sucedido
          if (statusLogin) {
            statusLogin.textContent = resultado.mensagem;
            statusLogin.style.color = 'green';
          }
          
          // Redirecionar para página principal após login
          setTimeout(() => {
            carregarPagina('anuncios');
          }, 500);
          
        } else {
          // Login falhou
          if (statusLogin) {
            statusLogin.textContent = resultado.mensagem;
            statusLogin.style.color = 'red';
          }
          login.value = '';
          senha.value = '';
        }
      }
    });
  }
  
  // Inicializar botão de cadastro se estiver na página de login
  botaoCadastrar();
}

// Alterar senha
// Array provisório para armazenar dados do usuário confirmado
let dadosUsuarioProvisorio = [];

// Função para confirmar email (confirm.html)
function configurarConfirmacaoEmail() {
  const btnEntrar = document.getElementById('btnConfirmar');
  const emailLogin = document.getElementById('emailLogin');
  const statusEmailConfrim = document.getElementById('statusEmailConfrim');
  
  if (btnEntrar && emailLogin && statusEmailConfrim) {
    btnEntrar.addEventListener('click', async () => {
      const email = emailLogin.value.trim();
      
      if (!email) {
        statusEmailConfrim.textContent = 'Por favor, digite um email válido';
        statusEmailConfrim.style.color = 'red';
        return;
      }
      
      // Desabilitar botão durante o processo
      btnEntrar.disabled = true;
      btnEntrar.textContent = 'Verificando...';
      statusEmailConfrim.textContent = 'Buscando usuários...';
      statusEmailConfrim.style.color = 'blue';
      
      try {
        // Buscar usuários via servidor
        const response = await fetch('https://atentus.com.br:3040/listar-usuarios', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Erro na requisição: ${response.status}`);
        }
        
        const dados = await response.json();
        console.log('Dados recebidos do servidor:', dados);
        
        // Procurar usuário pelo email
        const usuarioEncontrado = dados.usuarios.find(usuario => 
          usuario.email.toLowerCase() === email.toLowerCase()
        );
        
        if (usuarioEncontrado) {
          // Salvar dados no array provisório
          dadosUsuarioProvisorio = [{
            id: usuarioEncontrado.id,
            login: usuarioEncontrado.login,
            email: usuarioEncontrado.email,
            senha: usuarioEncontrado.senha,
            timestampConfirmacao: new Date().toISOString()
          }];
          
          statusEmailConfrim.textContent = 'Email confirmado com sucesso!';
          statusEmailConfrim.style.color = 'green';
          
          console.log('Dados salvos no array provisório:', dadosUsuarioProvisorio);
          
          // Redirecionar para página de alteração de senha após 1 segundo
          setTimeout(() => {
            carregarPagina('senha');
          }, 1000);
          
        } else {
          statusEmailConfrim.textContent = 'Email não encontrado no sistema';
          statusEmailConfrim.style.color = 'red';
          dadosUsuarioProvisorio = [];
        }
        
      } catch (error) {
        console.error('Erro ao confirmar email:', error);
        statusEmailConfrim.textContent = 'Erro ao conectar com o servidor';
        statusEmailConfrim.style.color = 'red';
        dadosUsuarioProvisorio = [];
      } finally {
        btnEntrar.disabled = false;
        btnEntrar.textContent = 'Confirmar';
      }
    });
    
    // Event listener para Enter no input
    emailLogin.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        btnEntrar.click();
      }
    });
  }
}

// Função para alterar senha (senha.html)
function configurarAlteracaoSenha() {
  const btnAlterar = document.getElementById('btnAlterar');
  const senhaOne = document.getElementById('senhaOne');
  const Newsenha = document.getElementById('Newsenha');
  const statusNewSenha = document.getElementById('statusNewSenha');
  
  if (btnAlterar && senhaOne && Newsenha && statusNewSenha) {
    btnAlterar.addEventListener('click', async () => {
      const novaSenha = senhaOne.value.trim();
      const confirmarSenha = Newsenha.value.trim();
      
      // Validações
      if (!novaSenha || !confirmarSenha) {
        statusNewSenha.textContent = 'Por favor, preencha todos os campos';
        statusNewSenha.style.color = 'red';
        return;
      }
      
      if (novaSenha !== confirmarSenha) {
        statusNewSenha.textContent = 'As senhas não coincidem';
        statusNewSenha.style.color = 'red';
        return;
      }
      
      if (novaSenha.length < 4) {
        statusNewSenha.textContent = 'A senha deve ter pelo menos 4 caracteres';
        statusNewSenha.style.color = 'red';
        return;
      }
      
      // Verificar se tem dados do usuário confirmado
      if (dadosUsuarioProvisorio.length === 0) {
        statusNewSenha.textContent = 'Erro: Confirme o email primeiro';
        statusNewSenha.style.color = 'red';
        setTimeout(() => {
          carregarPagina('confirm');
        }, 2000);
        return;
      }
      
      // Desabilitar botão durante o processo
      btnAlterar.disabled = true;
      btnAlterar.textContent = 'Alterando...';
      statusNewSenha.textContent = 'Alterando senha...';
      statusNewSenha.style.color = 'blue';
      
      const usuario = dadosUsuarioProvisorio[0];
      
      try {
        // Alterar senha via servidor
        const response = await fetch('https://atentus.com.br:3040/alterar-senha', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: usuario.id,
            login: usuario.login,
            senha: novaSenha,
            email: usuario.email
          })
        });
        
        if (!response.ok) {
          throw new Error(`Erro na requisição: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Resposta do servidor:', result);
        
        if (result.sucesso !== false) {
          statusNewSenha.textContent = 'Senha alterada com sucesso!';
          statusNewSenha.style.color = 'green';
          
          // Limpar dados provisórios
          dadosUsuarioProvisorio = [];
          
          // Redirecionar para login após 2 segundos
          setTimeout(() => {
            carregarPagina('login');
          }, 2000);
          
        } else {
          statusNewSenha.textContent = 'Erro ao alterar senha: ' + (result.mensagem || 'Erro desconhecido');
          statusNewSenha.style.color = 'red';
        }
        
      } catch (error) {
        console.error('Erro ao alterar senha:', error);
        statusNewSenha.textContent = 'Erro ao conectar com o servidor';
        statusNewSenha.style.color = 'red';
      } finally {
        btnAlterar.disabled = false;
        btnAlterar.textContent = 'Alterar';
      }
    });
    
    // Event listeners para Enter nos inputs
    senhaOne.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        Newsenha.focus();
      }
    });
    
    Newsenha.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        btnAlterar.click();
      }
    });
  }
}

// Função para limpar dados provisórios (utilitária)
function limparDadosProvisorio() {
  dadosUsuarioProvisorio = [];
  console.log('Dados provisórios limpos');
}

// Chamar as funções quando as páginas carregarem
// Adicione essas chamadas na sua função carregarPagina() ou onde for apropriado
function inicializarPaginaConfirm() {
  configurarConfirmacaoEmail();
}

function inicializarPaginaSenha() {
  configurarAlteracaoSenha();
}

//HISTORICO
let intervaloBusca = null;

const carregarHistorico = async () => {
  try {
    console.log('[Histórico] Buscando dados...');
    const response = await fetch('https://atentus.com.br:3040/historico-envios');
    
    if (!response.ok) {
      throw new Error(`Erro na requisição: ${response.status}`);
    }
    
    const historico = await response.json();
    console.log('[Histórico] Dados recebidos:', historico.length, 'registros');
    
    preencherFiltroData(historico);
    preencherTabela(historico);
    atualizarUltimaAtualizacao();
    
  } catch (erro) {
    console.error('[Histórico] Erro:', erro);
    mostrarMensagemErro('Erro ao carregar histórico. Tente recarregar a página.');
  }
};

const preencherFiltroData = (dados) => {
  const selectFiltro = document.getElementById('historico__filtro__data');
  if (!selectFiltro) return;

  // Limpa o select
  selectFiltro.innerHTML = '';

  // Adiciona opção padrão (ver tudo)
  const opcaoTodos = document.createElement('option');
  opcaoTodos.value = '';
  opcaoTodos.textContent = 'Todas as datas';
  selectFiltro.appendChild(opcaoTodos);

  // Extrai e ordena datas únicas (mais recentes primeiro)
  const datasUnicas = [...new Set(dados.map(item => item.data))].sort((a, b) => {
    const [diaA, mesA, anoA] = a.split('/').map(Number);
    const [diaB, mesB, anoB] = b.split('/').map(Number);
    return new Date(anoB, mesB - 1, diaB) - new Date(anoA, mesA - 1, diaA);
  });

  // Adiciona as opções ao select
  datasUnicas.forEach(data => {
    const opcao = document.createElement('option');
    opcao.value = data;
    opcao.textContent = data;
    selectFiltro.appendChild(opcao);
  });

  // Evento de mudança: filtrar a tabela quando mudar a data
  selectFiltro.addEventListener('change', () => {
    const dataSelecionada = selectFiltro.value;
    const dadosFiltrados = dataSelecionada
      ? dados.filter(item => item.data === dataSelecionada)
      : dados;

    preencherTabela(dadosFiltrados);
  });
};

const preencherTabela = (dados) => {
  const tbody = document.getElementById('tabela_historico_envios');
  
  if (!tbody) {
    console.error('[Histórico] Tabela não encontrada no DOM');
    return;
  }

  tbody.innerHTML = '';
  
  if (!dados || dados.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3">Nenhum envio registrado</td></tr>';
    return;
  }

  // Ordenar por data (mais recente primeiro)
  dados.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Preencher tabela
  dados.forEach(item => {
    const linha = document.createElement('tr');
    linha.innerHTML = `
      <td>${item.data || '--/--/----'}</td>
      <td>${item.hora || '--:--'}</td>
      <td>
        <span class="status">${item.status === 'sucesso' ? '✅' : '❌'}</span>
        ${item.posicao ? `<span class="posicao">(${item.posicao})</span>` : ''}
        <div class="mensagem">${item.mensagem || ''}</div>
      </td>
    `;
    tbody.appendChild(linha);
  });
};

const mostrarMensagemErro = (mensagem) => {
  const tbody = document.getElementById('tabela_historico_envios');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="3" class="erro">${mensagem}</td></tr>`;
  }
};

const iniciarAtualizacaoAutomatica = () => {
  pararAtualizacaoAutomatica();
  intervaloBusca = setInterval(carregarHistorico, 30000); // 30 segundos
  console.log('[Histórico] Atualização automática iniciada');
};

const pararAtualizacaoAutomatica = () => {
  if (intervaloBusca) {
    clearInterval(intervaloBusca);
    intervaloBusca = null;
  }
};

const atualizarUltimaAtualizacao = () => {
  const elemento = document.getElementById('ultima-atualizacao');
  if (elemento) {
    elemento.textContent = `Última atualização: ${new Date().toLocaleTimeString()}`;
  }
};


// Inicilizar Elementos da página
function inicializarElementosPagina() {
  if (!verificarAutenticacao() && !paginasPublicas.includes(getCurrentPage())) {
    carregarPagina('login');
    return;
  }

  const button = document.getElementById('emoji-button');
  const picker = document.getElementById('emoji-picker');
  const textarea = document.getElementById('input_text');

  const emojis = [
    '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇',
    '🙂','🙃','😉','😍','🥰','😘','😗','😙','😚','😎',
    '🤩','🥳','😏','😋','😜','🤪','😝','🤑','🤗','👍',
    '👎','👌','✌️','🤞','🤟','🤘','🤙','👋','👏','🙏','👇',
    '👆','👂','👃','👄','👶','👦','👧','👨','👩','👪',
    '👫','👬','👭','👮','👯','👰','👱','👲','👳','👴',
    '👵','👶','👷','👸','👹','👺','👻','👼','👽','👾',
    '👿','💀','💂','💃','💄','💅','💆','💇','💈','💉',
    '💊','💋','💌','💍','💎','💏','💐','💑','💒','💓',
    '💔','💕','💖','💗','💘','💙','💚','💛','💜','💝',
    '💞','💟','💠','💡','💢','💣','💤','💥','💦','💧',
    '💨','💩','💪','💫','💬','💭','💮','💯','💰','💱',
    '💲','💳','💴','💵','💶','💷','💸','💹','💺','💻',
    '💼','💽','💾','💿','📀','📁','📂','📃','📄','📅',
    '📆','📇','📈','📉','📊','📋','📌','📍','📎','📏',
    '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
    '🔥','✨','⚡','💥','⭐','🎉','🎊','🎈','🥳','🎂',
    '🍾','🥂','🍻','🍹','🍕','🍔','🍟','🌮','🍩','🍪',
    '💼','📈','📉','📊','💰','💵','💳','🧾','📜','📝',
    '📅','⏰','📢','📞','📱','✔️','❌','⚠️','🚫','✅',
    '❗','❓','💡','🔔','🎯','🚀'
  ];

  if (button && picker && textarea) {
    function criarPicker() {
      picker.innerHTML = '';
      emojis.forEach(emoji => {
        const span = document.createElement('span');
        span.textContent = emoji;
        span.addEventListener('click', () => {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const text = textarea.value;
          textarea.value = text.slice(0, start) + emoji + text.slice(end);
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
          picker.style.display = 'none';
        });
        picker.appendChild(span);
      });
    }

    button.addEventListener('click', () => {
      if (picker.style.display === 'none') {
        criarPicker();
        const rect = button.getBoundingClientRect();
        picker.style.position = 'absolute';
        picker.style.top = (rect.bottom + window.scrollY) + 'px';
        picker.style.left = (rect.left + window.scrollX) + 'px';
        picker.style.display = 'flex';
      } else {
        picker.style.display = 'none';
      }
    });

    document.addEventListener('click', (e) => {
      if (!picker.contains(e.target) && e.target !== button) {
        picker.style.display = 'none';
      }
    });
  }

  const uploadButton = document.getElementById('upload-button');
  if (uploadButton) {
    uploadButton.addEventListener('click', async () => {
      const fileInput = document.getElementById('file-input');
      const file = fileInput?.files[0];
      const diaSemana = document.getElementById('diaSemana')?.value;

      function exibirStatus(id, texto) {
        const campo = document.getElementById(id);
        if (campo) campo.innerHTML = texto;
      }

      if (!file) {
        exibirStatus('status_documents', 'Nenhum arquivo selecionado');
        return;
      }

      const formData = new FormData();
      formData.append('arquivo', file);
      formData.append('diaSemana', diaSemana);

      const response = await fetch('https://atentus.com.br:3040/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      exibirStatus('status_documents', data.message);
    });
  }

  const fileInput = document.getElementById('file-input');
  const imagem = document.getElementById('previewImagem');
  if (fileInput && imagem) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => imagem.src = reader.result;
        reader.readAsDataURL(file);
      }
    });
  }

  const campoMensagem = document.getElementById('input_text');
  const uploadText = document.getElementById('upload_text');
  const previewText = document.getElementById('previewText');

  if (campoMensagem && uploadText && previewText) {
    uploadText.addEventListener('click', () => {
      const semanaMensagem = document.getElementById('diaSemana');
      let mensagem;
      if (semanaMensagem) {
        const valor = semanaMensagem.value;
        mensagem = valor;
      }
      const dados = { mensagemSemana: mensagem, mensagem: campoMensagem.value };

      function exibirStatus(id, texto) {
        const campo = document.getElementById(id);
        if (campo) campo.textContent = texto;
      }

      fetch('https://atentus.com.br:3040/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      })
        .then(res => res.text())
        .then(() => exibirStatus('status_text', 'Dados salvos com sucesso'))
        .catch(err => console.error('Erro:', err));
    });

    campoMensagem.addEventListener('input', () => {
      const textoComQuebras = campoMensagem.value.replace(/\n/g, '<br>');
      previewText.innerHTML = textoComQuebras;
    });
    
  }

  const sair = document.getElementById('btnSair');
  if (sair) {
    sair.addEventListener('click', () => {
      usuarioLogado = false;
      sessionToken = null;
      sessionStorage.removeItem('usuarioLogado');
      sessionStorage.removeItem('sessionToken');
      sessionStorage.removeItem('loginUsuario');
      atualizarInterfaceLogin();
      carregarPagina('login');
    });
  }


  const diaSemanaSelect = document.getElementById('diaSemana');
  if (diaSemanaSelect) {
    diaSemanaSelect.addEventListener('change', () => {
      const statusDocs = document.getElementById('status_documents');
      const statusText = document.getElementById('status_text');
      const previewImagem = document.getElementById('previewImagem');
      const inputText = document.getElementById('input_text');
      const previewText = document.getElementById('previewText');

      if (statusDocs) statusDocs.innerHTML = '';
      if (statusText) statusText.innerHTML = '';
      if (fileInput) fileInput.value = '';
      if (previewImagem) previewImagem.src = 'default_preview.jpg';
      if (inputText) inputText.value = '';
      if (previewText) previewText.innerHTML = '';
    });
  }
  // Gerador de Links do WhatsApp
  const inputNumero = document.getElementById('input_gen_number');
  const inputTexto = document.getElementById('input_gen_text');
  const botaoGerar = document.getElementById('gerar_link');
  const statusLink = document.getElementById('status_link');

  if (inputNumero && inputTexto && botaoGerar && statusLink) {
    botaoGerar.addEventListener('click', () => {
      const numero = inputNumero.value.trim();
      const texto = inputTexto.value.trim();

      if (!numero || !/^55\d{11}$/.test(numero)) {
        statusLink.innerText = '❌ Número inválido. Use o formato 55DD9XXXXXXXX.';
        return;
      }

      const textoCodificado = encodeURIComponent(texto);
      const link = `https://wa.me/${numero}?text=${textoCodificado}`;
      statusLink.innerHTML = `<a href="${link}" target="_blank">${link}</a>`;
    });
  }

  // Scripts específicos de páginas futuras podem ir aqui:
    // Scripts específicos de páginas futuras podem ir aqui:
    let isRestarting = false;
let isLoggingOut = false;
let intervalId = null;

if (document.getElementById('qrcode')) {
  const qrcodeImg = document.getElementById('qrcode');
  const title = document.getElementById('title');
  const subtitle = document.getElementById('subtitle');
  const loading = document.getElementById('loading');
  const statusText = document.getElementById('status');

  async function checkStatus() {
    try {
      const res = await fetch('https://atentus.com.br:3040/status');
      const data = await res.json();

      if (data.connected) {
        qrcodeImg.style.display = 'none';
        loading.style.display = 'none';
        title.textContent = '✅ Conectado com Sucesso!';
        subtitle.textContent = 'Você já pode fechar esta página.';

        // Libera exibição normal novamente
        if (isRestarting || isLoggingOut) {
          statusText.textContent = '✅ Conectado com sucesso!';
        } else {
          statusText.textContent = '';
        }

        // Reset flags e reativa o checkStatus se estiver pausado
        isRestarting = false;
        isLoggingOut = false;
        restartCheckStatusInterval();

      } else {
        if (data.qr) {
          qrcodeImg.src = data.qr;
          qrcodeImg.style.display = 'block';
        }
        loading.style.display = 'block';

        if (!isRestarting && !isLoggingOut) {
          statusText.textContent = 'Aguardando conexão com o WhatsApp...';
        }
      }
    } catch (err) {
      console.error('Erro ao verificar status:', err);
    }
  }

  function startCheckStatusInterval() {
    if (!intervalId) {
      intervalId = setInterval(checkStatus, 3000);
    }
  }

  function stopCheckStatusInterval() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function restartCheckStatusInterval() {
    stopCheckStatusInterval();
    startCheckStatusInterval();
  }

  async function restartBot() {
    stopCheckStatusInterval();
    isRestarting = true;
    statusText.textContent = "♻️ Reiniciando, aguarde por favor...";
    loading.style.display = 'block';

    try {
      const res = await fetch('https://atentus.com.br:3040/restart', { method: 'POST' });
      const data = await res.json();

      if (data.message) {
        statusText.textContent = data.message;
        title.textContent = '✅ Reiniciado com sucesso!';
        
      } else {
        statusText.textContent = "Reiniciando, aguarde até a confirmação...";
      }

      // Reativa monitoramento após delay pequeno
      setTimeout(() => startCheckStatusInterval(), 3000);

    } catch (error) {
      statusText.textContent = "Erro ao reiniciar...";
      loading.style.display = 'none';
      console.error(error);
      isRestarting = false;
      startCheckStatusInterval();
    }
  }

  async function logoutBot() {
    stopCheckStatusInterval();
    isLoggingOut = true;
    statusText.textContent = "🚪 Desconectando, aguarde...";
    loading.style.display = 'block';

    try {
      const res = await fetch('https://atentus.com.br:3040/logout', { method: 'POST' });
      const data = await res.json();
      statusText.textContent = data.message;
      title.textContent = '❎ Desconectado!';

      // Reativa verificação depois de um tempo
      setTimeout(() => startCheckStatusInterval(), 3000);

    } catch (error) {
      statusText.textContent = "Erro ao desconectar...";
      loading.style.display = 'none';
      console.error(error);
      isLoggingOut = false;
      startCheckStatusInterval();
    }
  }

  // Botões
  const btnReconnect = document.getElementById('reconnect');
  const btnLogout = document.getElementById('logout');

  if (btnReconnect) btnReconnect.addEventListener('click', restartBot);
  if (btnLogout) btnLogout.addEventListener('click', logoutBot);

  // Inicialização
  checkStatus();
  startCheckStatusInterval();
}

// ⏰ Horários (incluir dentro da função inicializarElementosPagina)
const selects = [
  'chooseHours1', 'chooseHours2', 'chooseHours3',
  'chooseHours4', 'chooseHours5', 'chooseHours6'
];

const statusEl = document.getElementById('statushorarios');
const listaEl = document.getElementById('horarios_escolhidos');
const btnConfirmar = document.getElementById('confirmar_horas');

if (btnConfirmar && listaEl && statusEl) {
  const textoOriginalBotao = btnConfirmar.innerText;

  function carregarHorarios() {
    fetch('https://atentus.com.br:3040/horarios')
      .then(res => res.json())
      .then(data => {
        const lista = data.horarios || [];
        const horariosOriginais = lista.map(h => (h - 3 + 24) % 24);
        listaEl.innerText = horariosOriginais.map(h => `${h}:00`).join(' | ');
      })
      .catch(() => {
        listaEl.innerText = 'Erro ao carregar horários';
      });
  }

  btnConfirmar.addEventListener('click', () => {
    const valores = selects.map(id => {
      const el = document.getElementById(id);
      return el ? el.value : null;
    }).filter(v => v !== 'null' && v !== null);

    const unicos = [...new Set(valores.map(Number))].sort((a, b) => a - b);

    if (unicos.length === 0) {
      statusEl.innerText = '⚠️ Selecione pelo menos um horário';
      return;
    }

    btnConfirmar.disabled = true;
    btnConfirmar.innerText = 'Salvando...';

    fetch('https://atentus.com.br:3040/horarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ horarios: unicos })
    })
      .then(res => res.json())
      .then(data => {
        statusEl.innerText = '✅ Horários salvos com sucesso!';
        listaEl.innerText = data.horarios.map(h => `${h}:00`).join(' | ');
      })
      .catch(() => {
        statusEl.innerText = '❌ Erro ao salvar os horários';
      })
      .finally(() => {
        btnConfirmar.disabled = false;
        btnConfirmar.innerText = textoOriginalBotao;
      });
  });

  carregarHorarios();
}

if (document.getElementById('confirmar_grupos')) {
  const tabelaEsquerda = document.getElementById('tabela_grupos_esquerda');
  const tabelaDireita = document.getElementById('tabela_grupos_direita');
  const btnConfirmarGrupos = document.getElementById('confirmar_grupos');

  // Limpa quaisquer linhas existentes
  tabelaEsquerda.innerHTML = '';
  tabelaDireita.innerHTML = '';

  // Busca os grupos do backend
  fetch('https://atentus.com.br:3040/grupos')
    .then(res => res.json())
    .then(grupos => {
      grupos.forEach(grupo => {
        const tr = document.createElement('tr');

        let idParte = grupo.id;
        let nomeParte = '';

        if (grupo.id.includes(' - ')) {
        [idParte, nomeParte] = grupo.id.split(' - ');
        }

        const tdId = document.createElement('td');
        tdId.textContent = idParte;

        const tdNome = document.createElement('td');
        tdNome.textContent = nomeParte;

        const tdCheck = document.createElement('td');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.addEventListener('change', atualizarGruposSelecionados);

        tdCheck.appendChild(checkbox);

        tr.appendChild(tdId);
        tr.appendChild(tdNome);
        tr.appendChild(tdCheck);

        tabelaEsquerda.appendChild(tr);
        
        //setInterval(tr, 3000);
      });
    });

  function atualizarGruposSelecionados() {
    tabelaDireita.innerHTML = '';

    const linhas = tabelaEsquerda.querySelectorAll('tr');
    linhas.forEach(tr => {
      const checkbox = tr.querySelector('input[type="checkbox"]');
      if (checkbox && checkbox.checked) {
        const trNovo = document.createElement('tr');

        const tdId = document.createElement('td');
        tdId.textContent = tr.children[0].textContent;

        const tdNome = document.createElement('td');
        tdNome.textContent = tr.children[1].textContent;

        trNovo.appendChild(tdId);
        trNovo.appendChild(tdNome);

        tabelaDireita.appendChild(trNovo);
      }
    });
  }

  btnConfirmarGrupos.addEventListener('click', () => {
    const linhasSelecionadas = tabelaDireita.querySelectorAll('tr');
    const status = document.getElementById('status_grupos');
    const gruposSelecionados = Array.from(linhasSelecionadas).map(tr => ({
      id: tr.children[0].textContent,
      nome: tr.children[1].textContent
    }));

    fetch('https://atentus.com.br:3040/grupos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gruposSelecionados)
    })
      .then(res => res.json())
      .then(data => {
        //alert(data.message);
        status.textContent = data.message;
      })
      .catch(err => {
        //alert('Erro ao salvar os grupos');
        status.textContent = 'Erro ao salvar os grupos';
        console.error(err);
      });
  });
}

//meusanuncios
if (document.getElementById('tabela_grupos_check')) {
  fetch('https://atentus.com.br:3040/gruposcheck')
    .then(res => res.json())
    .then(grupos => {
      const tbody = document.getElementById('tabela_grupos_check');
      tbody.innerHTML = ''; // limpa antes de preencher (opcional)

      grupos.forEach(grupo => {
        const tr = document.createElement('tr');

        const tdId = document.createElement('td');
        tdId.textContent = grupo.id;

        const tdNome = document.createElement('td');
        tdNome.textContent = grupo.nome;

        tr.appendChild(tdId);
        tr.appendChild(tdNome);

        tbody.appendChild(tr);
      });
    })
    .catch(error => {
      console.error('Erro ao carregar os grupos:', error);
    });
}
if (document.getElementById('previewImagem_chk')) {
  const selectDia = document.getElementById('diaSemana_chk');
  const imagem = document.getElementById('previewImagem_chk');
  const texto = document.getElementById('previewText_chk');

  if (selectDia && imagem && texto) {
    // Função para carregar prévia
    const carregarPreview = (dia) => {
      fetch(`https://atentus.com.br:3040/anuncio/${dia}`)
        .then(res => res.json())
        .then(data => {
          
          // Se não há imagem ou está vazia, usa a default
          imagem.src = data.imagemBase64 || 'default_preview.jpg';
          texto.innerHTML = (data.texto || '').replace(/\n/g, '<br>');
        })
        .catch(err => {
          console.error('Erro ao carregar anúncio:', err);
          // Em caso de erro, também usa a imagem default
          imagem.src = 'default_preview.jpg';
          texto.textContent = '';
        });
    };

    // Carrega a primeira vez
    carregarPreview(selectDia.value);

    // Atualiza ao mudar
    selectDia.addEventListener('change', () => {
      carregarPreview(selectDia.value);
    });
  }
}

//duplicar anuncios meusanuncios

//document.addEventListener('DOMContentLoaded', () => {
  
  if (document.getElementById('confirmar_checkbox')) {
    const btnConfirmar = document.getElementById('confirmar_checkbox');
    btnConfirmar.addEventListener('click', () => {
      const selectDia = document.getElementById('diaSemana_chk');
      const diaOrigem = selectDia.value;
      const statuschk = document.getElementById('status_checkbox');

      // Pegar todos os checkboxes marcados
      const checkboxes = document.querySelectorAll('.main__checkbox');
      const diasDestino = [];

      checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
          // Extrair o dia do id, que está no formato checkbox_segunda, checkbox_terca, etc
          const dia = checkbox.id.replace('checkbox_', '');
          // Evita copiar para o mesmo dia origem
          if (dia !== diaOrigem) diasDestino.push(dia);
        }
      });

      if (diasDestino.length === 0) {
        //alert('Selecione pelo menos um dia diferente para copiar o anúncio.');
        statuschk.textContent = 'Selecione pelo menos um dia diferente para copiar o anúncio.';
        return;
      }

      fetch('https://atentus.com.br:3040/copiar-anuncio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ diaOrigem, diasDestino })
      })
      
      .then(res => {
        if (!res.ok) throw new Error('Erro ao copiar anúncio');
        return res.text();
      })
      .then(msg => {
        //alert(msg);
        statuschk.textContent = msg;
        // Opcional: desmarcar checkboxes após confirmação
        checkboxes.forEach(c => c.checked = false);
      })
      .catch(err => {
        console.error(err);
        //alert('Erro ao copiar anúncio. Veja o console.');
        statuschk.textContent = 'Erro ao copiar anúncio. Veja o console.';
      });
    });
  //}
};
//Apagar anuncio
if (document.getElementById('btn-apagar-anuncio')){
  const btnApagarAnuncio = document.getElementById('btn-apagar-anuncio');
  btnApagarAnuncio.addEventListener('click', async () => {
  const diaSelecionado = document.getElementById('diaSemana_chk').value;
  const statuschk = document.getElementById('status_checkbox');


  if (!diaSelecionado) {
    //alert('Por favor, selecione um dia.');
    statuschk.textContent = 'Por favor, selecione um dia.';
    return;
  }

  try {
    const resposta = await fetch('https://atentus.com.br:3040/apagar-anuncio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dia: diaSelecionado })
    });

    const textoResposta = await resposta.text();
    //alert(textoResposta);
    statuschk.textContent = textoResposta;
  } catch (error) {
    console.error('Erro ao apagar anúncio:', error);
    //alert('Erro ao tentar apagar o anúncio.');
    statuschk.textContent = 'Erro ao tentar apagar o anúncio.';
  }

});
};
//Apagar todos
if (document.getElementById('btn-apagar-todos')){
  const btnApagarTodos = document.getElementById('btn-apagar-todos');
  btnApagarTodos.addEventListener('click', async () => {
    const statuschk = document.getElementById('status_checkbox');
  if (!confirm('Tem certeza que deseja apagar todos os anúncios? Esta ação não pode ser desfeita!')) {
    return;
  }

  try {
    const resposta = await fetch('https://atentus.com.br:3040/apagar-todos-anuncios', {
      method: 'POST'
    });

    const textoResposta = await resposta.text();
    //alert(textoResposta);
    statuschk.textContent = textoResposta;
  } catch (error) {
    console.error('Erro ao apagar todos os anúncios:', error);
    //alert('Erro ao tentar apagar todos os anúncios.');
    statuschk.textContent = 'Erro ao tentar apagar todos os anúncios.';
  }
});
};

//Histórico

if (document.getElementById('tabela_historico_envios')) {
  console.log('[Histórico] Inicializando...');
  carregarHistorico();
  iniciarAtualizacaoAutomatica();
}
// Botão para apagar histórico
if (document.getElementById('btn-apagar-historico')) {
  document.getElementById('btn-apagar-historico').addEventListener('click', async () => {
    if (confirm('Tem certeza que deseja apagar todo o histórico de envios?')) {
      try {
        const response = await fetch('https://atentus.com.br:3040/delete-historico-envios', {
          method: 'DELETE'
        });

        if (!response.ok) throw new Error('Erro ao apagar histórico');

        const resultado = await response.json();

        if (resultado.sucesso) {
          alert('Histórico apagado com sucesso.');
          carregarHistorico(); // recarrega a tabela
        } else {
          alert('Falha ao apagar histórico.');
        }
      } catch (erro) {
        console.error('[Apagar Histórico] Erro:', erro);
        alert('Erro ao apagar histórico. Verifique o console.');
      }
    }
  });
}


  // if (main.innerHTML.includes("id_exclusivo_da_nova_pagina")) { ... }
}

// Configura os links do menu
function getCurrentPage() {
  const activeLink = document.querySelector('.nav-link.active');
  return activeLink ? activeLink.getAttribute('data-page') : 'login';
}

// Função para inicializar a aplicação
function inicializarApp() {
  // Verificar se já está logado
  if (verificarAutenticacao()) {
    carregarPagina('anuncios');
  } else {
    carregarPagina('login');
  }
  
  // Configurar event listeners para navegação
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-page]');
    if (link) {
      e.preventDefault();
      const pagina = link.getAttribute('data-page');
      carregarPagina(pagina);
    }
  });
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  inicializarApp();
});