// --- Firebase ---
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

// --- Elementos ---
const bookForm = document.getElementById('book-form');
const booksDiv = document.getElementById('books');
const buscaInput = document.getElementById('buscaLivro');

// Perfil
const perfilNome = document.getElementById('perfil-nome');
const perfilEmail = document.getElementById('perfil-email');
const meusLivrosUl = document.getElementById('meus-livros');
const historicoUl = document.getElementById('historico-emprestimos');

// --- Abas ---
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab, .tab-content')
      .forEach(el => el.classList.remove('active'));

    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// --- Login/Logout ---
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

let currentUser = null;

auth.onAuthStateChanged(user => {
  currentUser = user;

  if(user){
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    bookForm.style.display = 'block';

    carregarPerfil();
  } else {
    loginBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
    bookForm.style.display = 'none';
  }
});

// --- Perfil ---
function carregarPerfil(){
  perfilNome.textContent = currentUser.displayName;
  perfilEmail.textContent = currentUser.email;

  meusLivrosUl.innerHTML = '';
  historicoUl.innerHTML = '';

  db.collection('books')
    .where('uid','==',currentUser.uid)
    .onSnapshot(snapshot => {
      meusLivrosUl.innerHTML = '';
      historicoUl.innerHTML = '';

      snapshot.forEach(doc => {
        const data = doc.data();

        const li = document.createElement('li');
        li.textContent = `${data.title} (${data.status})`;
        meusLivrosUl.appendChild(li);

        if(data.status === 'borrowed'){
          const h = document.createElement('li');
          h.textContent = `Emprestado: ${data.title}`;
          historicoUl.appendChild(h);
        }
      });
    });
}

// --- Adicionar livro ---
bookForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if(!currentUser) return alert('Faça login para adicionar livros');

  const title = titleInput.value.trim();
  const author = authorInput.value.trim();
  const category = categoryInput.value.trim();
  const contact = contactInput.value.trim();
  const description = descriptionInput.value.trim();

  await db.collection('books').add({
    title,
    author,
    category,
    contact,
    description,
    status: 'available',
    uid: currentUser.uid,
    userName: currentUser.displayName,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  bookForm.reset();
});

// --- Listar livros ---
db.collection('books')
  .orderBy('createdAt','desc')
  .onSnapshot(snapshot => {
    booksDiv.innerHTML = '';

    snapshot.forEach(doc => {
      const data = doc.data();
      const id = doc.id;

      const div = document.createElement('div');
      div.className = 'book-card';

      div.innerHTML = `
        <h3>${escapeHtml(data.title)}</h3>
        <strong>${escapeHtml(data.author)}</strong>
        <p>${escapeHtml(data.description || '')}</p>
        <p>Status: ${data.status}</p>
        <small>Adicionado por: ${escapeHtml(data.userName || '')}</small>
      `;

      if(currentUser && currentUser.uid === data.uid){
        const actions = document.createElement('div');
        actions.className = 'book-actions';

        const toggleBtn = document.createElement('button');
        toggleBtn.textContent =
          data.status === 'available'
            ? 'Marcar como emprestado'
            : 'Marcar como devolvido';

        toggleBtn.onclick = () =>
          db.collection('books').doc(id)
            .update({ status: data.status === 'available' ? 'borrowed' : 'available' });

        actions.appendChild(toggleBtn);
        div.appendChild(actions);
      }

      booksDiv.appendChild(div);
    });
  });

// --- Busca ---
buscaInput.addEventListener('keyup', () => {
  const filtro = buscaInput.value.toLowerCase();
  document.querySelectorAll('.book-card').forEach(card => {
    card.style.display =
      card.textContent.toLowerCase().includes(filtro)
        ? 'block'
        : 'none';
  });
});

// --- Escape HTML ---
function escapeHtml(str){
  return str.replace(/[&<>"']/g, s =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])
  );
}
