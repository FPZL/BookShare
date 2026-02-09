// ================= FIREBASE =================
const firebaseConfig = {
  apiKey: "AIzaSyCRakMbIAtwkg7xlaxuyNfdVUADwx5S-0s",
  authDomain: "test-194d9.firebaseapp.com",
  projectId: "test-194d9",
  storageBucket: "test-194d9.firebasestorage.app",
  messagingSenderId: "709373549581",
  appId: "1:709373549581:web:069f53bd9d09a21fbc8944"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let perfilVisitadoUid = null;

// ================= ELEMENTOS =================
const bookForm = document.getElementById('book-form');
const booksDiv = document.getElementById('books');
const buscaInput = document.getElementById('buscaLivro');

// Perfil
const perfilNome = document.getElementById('perfil-nome');
const perfilEmail = document.getElementById('perfil-email');
const meusLivrosUl = document.getElementById('meus-livros');
const historicoUl = document.getElementById('historico-emprestimos');

// ================= ABAS =================
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');

    if(btn.dataset.tab === 'perfil'){
      perfilVisitadoUid = null; // volta para o próprio perfil
      carregarPerfil();
    }
  });
});

// ================= LOGIN / LOGOUT =================
const loginBtn = document.createElement('button');
loginBtn.textContent = 'Entrar com Google';

const logoutBtn = document.createElement('button');
logoutBtn.textContent = 'Sair';
logoutBtn.style.display = 'none';

bookForm.parentNode.insertBefore(loginBtn, bookForm);
bookForm.parentNode.insertBefore(logoutBtn, bookForm);

const provider = new firebase.auth.GoogleAuthProvider();

loginBtn.onclick = () => auth.signInWithPopup(provider);
logoutBtn.onclick = () => auth.signOut();

// ================= AUTH =================
auth.onAuthStateChanged(user => {
  currentUser = user;

  if(user){
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    bookForm.style.display = 'block';
  } else {
    loginBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
    bookForm.style.display = 'none';
  }

  listarLivros();
});

// ================= ADICIONAR LIVRO =================
bookForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if(!currentUser) return alert('Faça login');

  const title = document.getElementById('title').value.trim();
  const author = document.getElementById('author').value.trim();
  const category = document.getElementById('category').value.trim();
  const contact = document.getElementById('contact').value.trim();
  const description = document.getElementById('description').value.trim();

  await db.collection('books').add({
    title,
    author,
    category,
    contact,
    description,
    status: 'available',
    uid: currentUser.uid,
    userName: currentUser.displayName,
    ratings: {},
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  bookForm.reset();
});

// ================= LISTAR LIVROS =================
function listarLivros(){
  db.collection('books')
    .orderBy('createdAt','desc')
    .onSnapshot(snapshot => {
      booksDiv.innerHTML = '';

      snapshot.forEach(doc => {
        const data = doc.data();
        const id = doc.id;
        const rating = calcularMedia(data.ratings);

        const div = document.createElement('div');
        div.className = 'book-card';

        div.innerHTML = `
          <h3>${escapeHtml(data.title)}</h3>
          <strong>${escapeHtml(data.author)}</strong>
          <p>${escapeHtml(data.description || '')}</p>
          <p>Status: ${data.status}</p>

          <div class="stars">
            ${[1,2,3,4,5].map(n =>
              `<span class="star ${currentUser && data.ratings && data.ratings[currentUser.uid] >= n ? 'active' : ''}" data-value="${n}">★</span>`
            ).join('')}
          </div>

          <div class="rating-info">
            ⭐ ${rating.media} (${rating.total} avaliações)
          </div>

          <small>
            Adicionado por:
            <span class="user-link" data-uid="${data.uid}">
              ${escapeHtml(data.userName || 'Usuário')}
            </span>
          </small>
        `;

        // Avaliar livro
        if(currentUser){
          div.querySelectorAll('.star').forEach(star => {
            star.addEventListener('click', async () => {
              const value = Number(star.dataset.value);
              await db.collection('books').doc(id).set({
                ratings: { [currentUser.uid]: value }
              }, { merge:true });
            });
          });
        }

        // Clique no nome → perfil público
        const userLink = div.querySelector('.user-link');
        userLink.addEventListener('click', () => {
          perfilVisitadoUid = userLink.dataset.uid;

          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

          document.querySelector('[data-tab="perfil"]').classList.add('active');
          document.getElementById('perfil').classList.add('active');

          carregarPerfil();
        });

        // Botões do dono
        if(currentUser && data.uid === currentUser.uid){
          const actions = document.createElement('div');
          actions.className = 'book-actions';

          const toggleBtn = document.createElement('button');
          toggleBtn.textContent =
            data.status === 'available'
              ? 'Marcar como emprestado'
              : 'Marcar como devolvido';

          toggleBtn.onclick = async () => {
            await db.collection('books').doc(id).update({
              status: data.status === 'available' ? 'borrowed' : 'available'
            });
          };

          const delBtn = document.createElement('button');
          delBtn.textContent = 'Remover';
          delBtn.onclick = async () => {
            if(confirm('Remover este livro?')){
              await db.collection('books').doc(id).delete();
            }
          };

          actions.appendChild(toggleBtn);
          actions.appendChild(delBtn);
          div.appendChild(actions);
        }

        booksDiv.appendChild(div);
      });
    });
}

// ================= PERFIL =================
function carregarPerfil(){
  const uid = perfilVisitadoUid || (currentUser && currentUser.uid);
  if(!uid) return;

  const isMeuPerfil = currentUser && uid === currentUser.uid;

  perfilNome.textContent = isMeuPerfil
    ? currentUser.displayName
    : 'Perfil do usuário';

  perfilEmail.textContent = isMeuPerfil
    ? currentUser.email
    : 'Email privado';

  meusLivrosUl.innerHTML = '';
  historicoUl.innerHTML = '';

  db.collection('books')
    .where('uid','==',uid)
    .get()
    .then(snapshot => {
      if(snapshot.empty){
        meusLivrosUl.innerHTML = '<li>Nenhum livro publicado</li>';
      }

      snapshot.forEach(doc => {
        const data = doc.data();
        const li = document.createElement('li');
        li.textContent = `${data.title} (${data.status})`;
        meusLivrosUl.appendChild(li);

        if(isMeuPerfil && data.status === 'borrowed'){
          const h = document.createElement('li');
          h.textContent = `Emprestado: ${data.title}`;
          historicoUl.appendChild(h);
        }
      });

      if(!isMeuPerfil){
        historicoUl.innerHTML = '<li>Histórico privado</li>';
      }
    });
}

// ================= BUSCA =================
buscaInput.addEventListener('keyup', () => {
  const filtro = buscaInput.value.toLowerCase();
  document.querySelectorAll('.book-card').forEach(card => {
    card.style.display =
      card.textContent.toLowerCase().includes(filtro)
        ? 'block'
        : 'none';
  });
});

// ================= AVALIAÇÃO =================
function calcularMedia(ratings){
  if(!ratings) return { media: 0, total: 0 };

  const valores = Object.values(ratings);
  const total = valores.length;
  if(total === 0) return { media: 0, total: 0 };

  const soma = valores.reduce((a,b) => a + b, 0);
  return { media: (soma / total).toFixed(1), total };
}
// ===== DENÚNCIA =====
const reportBtn = document.createElement('button');
reportBtn.className = 'report-btn';
reportBtn.textContent = 'Denunciar 🚩';

reportBtn.onclick = () => {
  const assunto = encodeURIComponent('Denúncia de livro no BookShare');
  const corpo = encodeURIComponent(
    `Olá,

Gostaria de denunciar o seguinte livro:

Título: ${data.title}
Autor do livro: ${data.author}
Publicado por: ${data.userName}
UID do usuário: ${data.uid}
ID do livro: ${id}

Motivo da denúncia:
(descreva aqui)

Enviado automaticamente pelo sistema BookShare.`
  );

  window.location.href =
    `mailto:felipe.lemos@unioeste.br?subject=${assunto}&body=${corpo}`;
};

div.appendChild(reportBtn);


// ================= ESCAPE HTML =================
function escapeHtml(str){
  if(!str) return '';
  return str.replace(/[&<>"']/g, s =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])
  );
}
