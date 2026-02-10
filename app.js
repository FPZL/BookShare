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

// ================= MODAL DENÚNCIA =================
const modal = document.getElementById('report-modal');
let reportData = null;

document.getElementById('cancel-report').onclick = () => {
  modal.style.display = 'none';
  document.getElementById('report-text').value = '';
};

document.getElementById('send-report').onclick = () => {
  const motivo = document.getElementById('report-text').value.trim();
  if(!motivo) return alert('Descreva o motivo');

  const assunto = encodeURIComponent('Denúncia de livro no BookShare');
  const corpo = encodeURIComponent(
`Olá,

Foi realizada uma denúncia no sistema BookShare.

Título: ${reportData.title}
Autor do livro: ${reportData.author}
Publicado por: ${reportData.userName}
UID do usuário: ${reportData.uid}
ID do livro: ${reportData.id}

Motivo da denúncia:
${motivo}`
  );

  window.location.href =
    `mailto:felipe.lemos@unioeste.br?subject=${assunto}&body=${corpo}`;

  modal.style.display = 'none';
  document.getElementById('report-text').value = '';
};

// ================= ABAS =================
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');

    if(btn.dataset.tab === 'perfil'){
      perfilVisitadoUid = null;
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

  loginBtn.style.display = user ? 'none' : 'inline-block';
  logoutBtn.style.display = user ? 'inline-block' : 'none';
  bookForm.style.display = user ? 'block' : 'none';

  listarLivros();
});

// ================= ADICIONAR LIVRO =================
bookForm.addEventListener('submit', async e => {
  e.preventDefault();
  if(!currentUser) return alert('Faça login');

  await db.collection('books').add({
    title: document.getElementById('title').value.trim(),
    author: document.getElementById('author').value.trim(),
    category: document.getElementById('category').value.trim(),
    contact: document.getElementById('contact').value.trim(),
    description: document.getElementById('description').value.trim(),
    status:'available',
    uid: currentUser.uid,
    userName: currentUser.displayName,
    ratings:{},
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  bookForm.reset();
});

// ================= LISTAR LIVROS =================
function listarLivros(){
  db.collection('books').orderBy('createdAt','desc')
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
          <p>${escapeHtml(data.description||'')}</p>
          <p><strong>Categoria:</strong> ${escapeHtml(data.category||'')}</p>
          <p><strong>Contato:</strong> ${escapeHtml(data.contact||'')}</p>
          <p>Status: ${data.status}</p>

          <div class="stars">
            ${[1,2,3,4,5].map(n =>
              `<span class="star ${currentUser && data.ratings?.[currentUser.uid]>=n?'active':''}"
                data-value="${n}">★</span>`).join('')}
          </div>

          <div class="rating-info">
            ⭐ ${rating.media} (${rating.total})
          </div>

          <small>
            Adicionado por:
            <span class="user-link" data-uid="${data.uid}">
              ${escapeHtml(data.userName)}
            </span>
          </small>
        `;

        // Avaliar
        if(currentUser){
          div.querySelectorAll('.star').forEach(star=>{
            star.onclick = () =>
              db.collection('books').doc(id).set({
                ratings:{[currentUser.uid]:Number(star.dataset.value)}
              },{merge:true});
          });
        }

        // Perfil público (corrigido)
        const userLink = div.querySelector('.user-link');
        userLink.addEventListener('click', () => {
          perfilVisitadoUid = userLink.dataset.uid;
          document.querySelector('[data-tab="perfil"]').click();
        });

        // Botões de ação
        if(currentUser){
          // Devolver se emprestado por você
          if(data.status === 'borrowed' && data.borrowedBy === currentUser.uid){
            const returnBtn = document.createElement('button');
            returnBtn.textContent = 'Devolver 📖';
            returnBtn.style.marginRight = '6px';
            returnBtn.onclick = async () => {
              if(confirm(`Deseja marcar o livro "${data.title}" como disponível?`)){
                await db.collection('books').doc(id).update({
                  status:'available',
                  borrowedBy: firebase.firestore.FieldValue.delete(),
                  borrowedAt: firebase.firestore.FieldValue.delete()
                });
              }
            };
            div.appendChild(returnBtn);
          }

          // Emprestar para todos se disponível
          if(data.status === 'available'){
            const borrowBtn = document.createElement('button');
            borrowBtn.textContent = 'Emprestar 📚';
            borrowBtn.style.marginRight = '6px';
            borrowBtn.onclick = async () => {
              if(confirm(`Deseja pegar emprestado o livro "${data.title}"?`)){
                await db.collection('books').doc(id).update({
                  status:'borrowed',
                  borrowedBy: currentUser.uid,
                  borrowedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
              }
            };
            div.appendChild(borrowBtn);
          }

          // Remover livros disponíveis do dono
          if(data.uid === currentUser.uid && data.status === 'available'){
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'Remover ❌';
            removeBtn.style.marginRight = '6px';
            removeBtn.onclick = async () => {
              if(confirm('Deseja realmente remover este livro?')){
                await db.collection('books').doc(id).delete();
              }
            };
            div.appendChild(removeBtn);
          }
        }

        // Botão de denúncia
        const reportBtn = document.createElement('button');
        reportBtn.className = 'report-btn';
        reportBtn.textContent = 'Denunciar 🚩';
        reportBtn.onclick = () => {
          reportData = { ...data, id };
          document.getElementById('report-info').textContent =
            `Livro: ${data.title} — ${data.userName}`;
          modal.style.display = 'flex';
        };
        div.appendChild(reportBtn);

        booksDiv.appendChild(div);
      });
    });
}

// ================= PERFIL =================
function carregarPerfil(){
  const uid = perfilVisitadoUid || currentUser?.uid;
  if(!uid) return;

  const meu = currentUser && uid === currentUser.uid;
  perfilNome.textContent = meu ? currentUser.displayName : 'Perfil do usuário';
  perfilEmail.textContent = meu ? currentUser.email : 'Email privado';

  meusLivrosUl.innerHTML = '';
  historicoUl.innerHTML = '';

  db.collection('books').where('uid','==',uid).get()
    .then(snapshot=>{
      snapshot.forEach(doc=>{
        const d = doc.data();
        meusLivrosUl.innerHTML += `<li>${d.title} (${d.status})</li>`;
        if(meu && d.status==='borrowed')
          historicoUl.innerHTML += `<li>Emprestado: ${d.title}</li>`;
      });
      if(!meu) historicoUl.innerHTML = '<li>Histórico privado</li>';
    });
}

// ================= BUSCA =================
buscaInput.onkeyup = () => {
  const f = buscaInput.value.toLowerCase();
  document.querySelectorAll('.book-card').forEach(c=>{
    c.style.display = c.textContent.toLowerCase().includes(f)?'block':'none';
  });
};

// ================= AVALIAÇÃO =================
function calcularMedia(r){
  if(!r) return {media:0,total:0};
  const v = Object.values(r);
  if(!v.length) return {media:0,total:0};
  return {media:(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1),total:v.length};
}

// ================= ESCAPE =================
function escapeHtml(str){
  return str.replace(/[&<>"']/g,
    s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}
