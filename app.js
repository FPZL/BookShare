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

// Modal denúncia
const reportModal = document.getElementById('report-modal');
const reportInfo = document.getElementById('report-info');
const reportText = document.getElementById('report-text');
const cancelReport = document.getElementById('cancel-report');
const sendReport = document.getElementById('send-report');

let reportData = null;

// ================= ABAS =================
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');

    if (btn.dataset.tab === 'perfil') {
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

loginBtn.onclick = async () => {
  const result = await auth.signInWithPopup(provider);

  // 🔐 Restrição UNIOESTE (MINHA PARTE)
  if (!result.user.email.endsWith('@unioeste.br')) {
    alert('Use apenas email institucional da UNIOESTE');
    await auth.signOut();
  }
};

logoutBtn.onclick = () => auth.signOut();

// ================= AUTH =================
auth.onAuthStateChanged(async user => {
  currentUser = user;

  loginBtn.style.display = user ? 'none' : 'inline-block';
  logoutBtn.style.display = user ? 'inline-block' : 'none';
  bookForm.style.display = user ? 'block' : 'none';

  // Cria perfil base (MINHA PARTE – não interfere)
  if (user) {
    const ref = db.collection('users').doc(user.uid);
    if (!(await ref.get()).exists) {
      await ref.set({
        name: user.displayName,
        email: user.email,
        points: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  }

  listarLivros();
});

// ================= ADICIONAR LIVRO =================
bookForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (!currentUser) return alert('Faça login');

  await db.collection('books').add({
    title: title.value.trim(),
    author: author.value.trim(),
    category: category.value.trim(),
    contact: contact.value.trim(),
    description: description.value.trim(),
    status: 'available',
    uid: currentUser.uid,
    userName: currentUser.displayName,
    ratings: {},
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  bookForm.reset();
});

// ================= LISTAR LIVROS =================
function listarLivros() {
  db.collection('books')
    .orderBy('createdAt', 'desc')
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
              `<span class="star ${
                currentUser && data.ratings?.[currentUser.uid] >= n ? 'active' : ''
              }" data-value="${n}">★</span>`
            ).join('')}
          </div>

          <div class="rating-info">
            ⭐ ${rating.media} (${rating.total} avaliações)
          </div>

          <small>
            Adicionado por:
            <span class="user-link" data-uid="${data.uid}">
              ${escapeHtml(data.userName)}
            </span>
          </small>
        `;

        // Avaliação
        if (currentUser) {
          div.querySelectorAll('.star').forEach(star => {
            star.onclick = () => {
              db.collection('books').doc(id).set({
                ratings: { [currentUser.uid]: Number(star.dataset.value) }
              }, { merge: true });
            };
          });
        }

        // Perfil público
        div.querySelector('.user-link').onclick = () => {
          perfilVisitadoUid = data.uid;
          document.querySelector('[data-tab="perfil"]').click();
        };

        // Botões do dono
        if (currentUser && data.uid === currentUser.uid) {
          const actions = document.createElement('div');
          actions.className = 'book-actions';

          const toggleBtn = document.createElement('button');
          toggleBtn.textContent =
            data.status === 'available'
              ? 'Marcar como emprestado'
              : 'Marcar como devolvido';

          toggleBtn.onclick = async () => {
            const novo = data.status === 'available' ? 'borrowed' : 'available';
            await db.collection('books').doc(id).update({ status: novo });

            // Pontos (MINHA PARTE)
            if (novo === 'borrowed') {
              await db.collection('users').doc(currentUser.uid).update({
                points: firebase.firestore.FieldValue.increment(10)
              });
            }
          };

          const delBtn = document.createElement('button');
          delBtn.textContent = 'Remover';
          delBtn.onclick = async () => {
            if (confirm('Remover este livro?')) {
              await db.collection('books').doc(id).delete();
            }
          };

          actions.appendChild(toggleBtn);
          actions.appendChild(delBtn);
          div.appendChild(actions);
        }

        // Denúncia
        const reportBtn = document.createElement('button');
        reportBtn.className = 'report-btn';
        reportBtn.textContent = 'Denunciar 🚩';
        reportBtn.onclick = () => {
          reportData = { ...data, id };
          reportInfo.textContent =
            `Livro: ${data.title} — Publicado por: ${data.userName}`;
          reportText.value = '';
          reportModal.style.display = 'flex';
        };
        div.appendChild(reportBtn);

        booksDiv.appendChild(div);
      });
    });
}

// ================= PERFIL =================
function carregarPerfil() {
  const uid = perfilVisitadoUid || currentUser?.uid;
  if (!uid) return;

  const meu = currentUser && uid === currentUser.uid;

  perfilNome.textContent = meu ? currentUser.displayName : 'Perfil do usuário';
  perfilEmail.textContent = meu ? currentUser.email : 'Email privado';

  meusLivrosUl.innerHTML = '';
  historicoUl.innerHTML = '';

  db.collection('books')
    .where('uid', '==', uid)
    .get()
    .then(snapshot => {
      if (snapshot.empty) {
        meusLivrosUl.innerHTML = '<li>Nenhum livro publicado</li>';
      }

      snapshot.forEach(doc => {
        const d = doc.data();
        meusLivrosUl.innerHTML += `<li>${d.title} (${d.status})</li>`;

        if (meu && d.status === 'borrowed') {
          historicoUl.innerHTML += `<li>Emprestado: ${d.title}</li>`;
        }
      });

      if (!meu) {
        historicoUl.innerHTML = '<li>Histórico privado</li>';
      }
    });
}

// ================= BUSCA =================
buscaInput.onkeyup = () => {
  const f = buscaInput.value.toLowerCase();
  document.querySelectorAll('.book-card').forEach(c => {
    c.style.display = c.textContent.toLowerCase().includes(f) ? 'block' : 'none';
  });
};

// ================= MODAL DENÚNCIA =================
cancelReport.onclick = () => reportModal.style.display = 'none';

sendReport.onclick = () => {
  const motivo = reportText.value.trim();
  if (!motivo) return alert('Descreva o motivo');

  const assunto = encodeURIComponent('Denúncia de livro no BookShare');
  const corpo = encodeURIComponent(
`Livro: ${reportData.title}
Autor: ${reportData.author}
Publicado por: ${reportData.userName}
UID: ${reportData.uid}
ID do livro: ${reportData.id}

Motivo:
${motivo}`
  );

  window.location.href =
    `mailto:felipe.lemos@unioeste.br?subject=${assunto}&body=${corpo}`;

  reportModal.style.display = 'none';
};

// ================= AVALIAÇÃO =================
function calcularMedia(r) {
  if (!r) return { media: 0, total: 0 };
  const v = Object.values(r);
  if (!v.length) return { media: 0, total: 0 };
  return {
    media: (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1),
    total: v.length
  };
}

// ================= ESCAPE HTML =================
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g,
    s => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[s]));
}
