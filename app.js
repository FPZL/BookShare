/*********************************
 * FIREBASE CONFIG
 *********************************/
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
const db   = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

/*********************************
 * ELEMENTOS
 *********************************/
const bookForm   = document.getElementById('book-form');
const booksDiv   = document.getElementById('books');
const buscaInput = document.getElementById('buscaLivro');

/*********************************
 * LOGIN / LOGOUT (UNIOESTE)
 *********************************/
const loginBtn = document.createElement('button');
loginBtn.textContent = 'Entrar com Google';

const logoutBtn = document.createElement('button');
logoutBtn.textContent = 'Sair';
logoutBtn.style.display = 'none';

bookForm.parentNode.insertBefore(loginBtn, bookForm);
bookForm.parentNode.insertBefore(logoutBtn, bookForm);

let currentUser = null;

loginBtn.onclick  = () => auth.signInWithPopup(provider);
logoutBtn.onclick = () => auth.signOut();

auth.onAuthStateChanged(async user => {
  currentUser = user;

  if (user) {
    if (!user.email.endsWith('@unioeste.br')) {
      alert('Use email institucional da UNIOESTE');
      await auth.signOut();
      return;
    }

    loginBtn.style.display  = 'none';
    logoutBtn.style.display = 'inline-block';
    bookForm.style.display  = 'block';

    const userRef = db.collection('usuarios').doc(user.uid);
    const snap = await userRef.get();

    if (!snap.exists) {
      await userRef.set({
        nome: user.displayName,
        email: user.email,
        pontos: 20,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  } else {
    loginBtn.style.display  = 'inline-block';
    logoutBtn.style.display = 'none';
    bookForm.style.display  = 'none';
  }
});

/*********************************
 * ADICIONAR LIVRO (+ pontos)
 *********************************/
bookForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (!currentUser) return alert('Faça login');

  await db.collection('books').add({
    title: title.value.trim(),
    author: author.value.trim(),
    category: category.value.trim(),
    description: description.value.trim(),
    status: 'available',
    uid: currentUser.uid,
    userName: currentUser.displayName,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  await db.collection('usuarios')
    .doc(currentUser.uid)
    .update({ pontos: firebase.firestore.FieldValue.increment(5) });

  bookForm.reset();
});

/*********************************
 * LISTAR LIVROS + EMPRÉSTIMO
 *********************************/
db.collection('books')
  .orderBy('createdAt', 'desc')
  .onSnapshot(snapshot => {
    booksDiv.innerHTML = '';

    snapshot.forEach(doc => {
      const b = doc.data();
      const id = doc.id;

      const div = document.createElement('div');
      div.className = 'book-card';

      div.innerHTML = `
        <h3>${escapeHtml(b.title)}</h3>
        <strong>${escapeHtml(b.author)}</strong>
        <p>${escapeHtml(b.description || '')}</p>
        <p>Status: ${b.status}</p>
        <small>${escapeHtml(b.userName)}</small>
      `;

      // Solicitar empréstimo
      if (currentUser && currentUser.uid !== b.uid && b.status === 'available') {
        const btn = document.createElement('button');
        btn.textContent = 'Solicitar empréstimo';
        btn.onclick = () => solicitarEmprestimo(id, b.uid);
        div.appendChild(btn);
      }

      // Dono do livro
      if (currentUser && currentUser.uid === b.uid) {
        const btn = document.createElement('button');
        btn.textContent = 'Marcar devolvido';
        btn.onclick = () =>
          db.collection('books').doc(id).update({ status: 'available' });
        div.appendChild(btn);
      }

      booksDiv.appendChild(div);
    });
  });

/*********************************
 * EMPRÉSTIMO / HISTÓRICO
 *********************************/
async function solicitarEmprestimo(bookId, ownerId) {
  const userRef = db.collection('usuarios').doc(currentUser.uid);
  const snap = await userRef.get();

  if (snap.data().pontos < 5)
    return alert('Pontos insuficientes');

  await db.collection('emprestimos').add({
    bookId,
    ownerId,
    borrowerId: currentUser.uid,
    status: 'ativo',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  await userRef.update({
    pontos: firebase.firestore.FieldValue.increment(-5)
  });

  await db.collection('books')
    .doc(bookId)
    .update({ status: 'borrowed' });

  alert('Empréstimo realizado');
}

/*********************************
 * AVALIAÇÃO (estrelas + comentário)
 *********************************/
async function avaliar(avaliadoId, estrelas, comentario) {
  await db.collection('avaliacoes').add({
    avaliador: currentUser.uid,
    avaliado: avaliadoId,
    estrelas,
    comentario,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  await db.collection('usuarios')
    .doc(currentUser.uid)
    .update({ pontos: firebase.firestore.FieldValue.increment(2) });
}

/*********************************
 * WISHLIST
 *********************************/
async function addWishlist(titulo) {
  await db.collection('wishlists')
    .doc(currentUser.uid)
    .set({
      livros: firebase.firestore.FieldValue.arrayUnion(titulo)
    }, { merge: true });
}

/*********************************
 * DENÚNCIA
 *********************************/
async function denunciar(denunciadoId, motivo) {
  await db.collection('denuncias').add({
    denunciante: currentUser.uid,
    denunciado: denunciadoId,
    motivo,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

/*********************************
 * RANKING (top usuários)
 *********************************/
db.collection('usuarios')
  .orderBy('pontos', 'desc')
  .limit(10)
  .onSnapshot(() => {
    // ranking disponível no Firestore
  });

/*********************************
 * BUSCA
 *********************************/
buscaInput.addEventListener('keyup', () => {
  const f = buscaInput.value.toLowerCase();
  document.querySelectorAll('.book-card').forEach(card => {
    card.style.display =
      card.innerText.toLowerCase().includes(f) ? 'block' : 'none';
  });
});

/*********************************
 * CHAT (estrutura pronta)
 *********************************/
// chats/{chatId}/mensagens/{msgId}

/*********************************
 * ESCAPE HTML
 *********************************/
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, s =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[s]
  );
}
