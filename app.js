/********************
* LOAN SYSTEM *
********************/
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


await userRef.update({ pontos: firebase.firestore.FieldValue.increment(-5) });


alert('Empréstimo solicitado');
}


/********************
* RATING SYSTEM *
********************/
async function avaliar(userId, estrelas, comentario) {
await db.collection('avaliacoes').add({
avaliador: currentUser.uid,
avaliado: userId,
estrelas,
comentario,
createdAt: firebase.firestore.FieldValue.serverTimestamp()
});


await db.collection('usuarios').doc(currentUser.uid)
.update({ pontos: firebase.firestore.FieldValue.increment(2) });
}


/********************
* WISHLIST *
********************/
async function addWishlist(title) {
await db.collection('wishlists').doc(currentUser.uid)
.set({ livros: firebase.firestore.FieldValue.arrayUnion(title) }, { merge: true });
}


/********************
* REPORT SYSTEM *
********************/
async function denunciar(denunciado, motivo) {
await db.collection('denuncias').add({
denunciante: currentUser.uid,
denunciado,
motivo,
createdAt: firebase.firestore.FieldValue.serverTimestamp()
});
}


/********************
* SEARCH *
********************/
buscaLivro.onkeyup = () => {
const f = buscaLivro.value.toLowerCase();
document.querySelectorAll('.book-card').forEach(c => {
c.style.display = c.innerText.toLowerCase().includes(f) ? 'block' : 'none';
});
};


/********************
* RANKING *
********************/
db.collection('usuarios').orderBy('pontos','desc').limit(10)
.onSnapshot(snap => {
console.log('Ranking atualizado');
});


/********************
* CHAT STRUCTURE *
********************/
// chats/{chatId}/mensagens/{msgId}
// estrutura pronta para realtime

