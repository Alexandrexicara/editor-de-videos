'use strict';

const preview = document.getElementById('avatarPreview');
const panel = document.createElement('div');
panel.className = 'field';
panel.innerHTML = '<label for="savedAvatarName">Minha biblioteca de avatares (salva neste navegador)</label><div class="row"><input id="savedAvatarName" type="text" maxlength="80" placeholder="Nome do avatar"><button class="btn secondary" id="saveAvatarLocal" type="button">Salvar avatar</button></div><div class="row" style="margin-top:10px"><select id="savedAvatarList" aria-label="Avatares salvos"><option value="">Carregando biblioteca...</option></select><button class="btn secondary" id="loadAvatarLocal" type="button">Carregar</button><button class="btn secondary" id="deleteAvatarLocal" type="button">Excluir</button></div><div class="hint">Os arquivos ficam guardados no armazenamento local deste navegador e não são enviados para a nuvem.</div>';
preview.parentElement.insertBefore(panel, preview);

const DB_NAME = 'avatar-studio-library';
const STORE = 'avatars';
let activeSavedImageUrl = null;
function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Não foi possível abrir a biblioteca local.'));
  });
}
async function withStore(mode, action) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let request;
    try { request = action(store); } catch (error) { db.close(); reject(error); return; }
    tx.oncomplete = () => { db.close(); resolve(request?.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || request?.error || new Error('Falha na biblioteca local.')); };
  });
}
async function allAvatars() { return (await withStore('readonly', store => store.getAll())) || []; }
async function refreshList() {
  const select = document.getElementById('savedAvatarList');
  const records = await allAvatars();
  select.replaceChildren();
  if (!records.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Nenhum avatar salvo';
    select.appendChild(option);
    return;
  }
  records.sort((a, b) => b.createdAt - a.createdAt).forEach(record => {
    const option = document.createElement('option');
    option.value = record.id;
    option.textContent = record.name + (record.kind === 'model' ? ' — 3D' : ' — imagem');
    select.appendChild(option);
  });
}
function status(message, type = '') {
  if (window.avatarStudioRender?.status) window.avatarStudioRender.status(message, type);
}
document.getElementById('saveAvatarLocal').addEventListener('click', async () => {
  const button = document.getElementById('saveAvatarLocal');
  button.disabled = true;
  try {
    const model = window.avatarStudioCurrentModel?.();
    const image = preview.querySelector('img');
    let blob, kind, defaultName;
    if (model) {
      blob = model.slice(0, model.size, 'model/gltf-binary');
      kind = 'model';
      defaultName = model.name.replace(/\.glb$/i, '');
    } else if (image) {
      const response = await fetch(image.src);
      if (!response.ok) throw new Error('Não foi possível ler a imagem do avatar.');
      blob = await response.blob();
      kind = 'image';
      defaultName = 'Meu avatar';
    } else {
      throw new Error('Crie ou carregue um avatar antes de salvar.');
    }
    const name = document.getElementById('savedAvatarName').value.trim() || defaultName;
    if (blob.size > 100 * 1024 * 1024) throw new Error('O avatar excede o limite local de 100 MB.');
    await withStore('readwrite', store => store.put({
      id: crypto.randomUUID(), name, kind, blob, createdAt: Date.now()
    }));
    await refreshList();
    status('Avatar salvo na biblioteca deste navegador.', 'ok');
  } catch (error) { status(error.message || 'Não foi possível salvar o avatar.', 'error'); }
  finally { button.disabled = false; }
});
document.getElementById('loadAvatarLocal').addEventListener('click', async () => {
  try {
    const id = document.getElementById('savedAvatarList').value;
    if (!id) throw new Error('Escolha um avatar salvo.');
    const record = (await allAvatars()).find(item => item.id === id);
    if (!record) throw new Error('Avatar não encontrado na biblioteca.');
    if (record.kind === 'model') {
      if (!window.avatarStudioLoadModel) throw new Error('O carregador 3D ainda não está disponível. Atualize a página.');
      await window.avatarStudioLoadModel(new File([record.blob], record.name + '.glb', { type: 'model/gltf-binary' }));
    } else {
      window.avatarStudioClearModel?.();
      if (activeSavedImageUrl) URL.revokeObjectURL(activeSavedImageUrl);
      const url = URL.createObjectURL(record.blob);
      activeSavedImageUrl = url;
      if (window.avatarStudioSetImage) window.avatarStudioSetImage(record.blob, url);
      else {
        const img = document.createElement('img');
        img.src = url;
        preview.replaceChildren(img);
      }
    }
    status('Avatar carregado da biblioteca local.', 'ok');
  } catch (error) { status(error.message || 'Não foi possível carregar o avatar.', 'error'); }
});
document.getElementById('deleteAvatarLocal').addEventListener('click', async () => {
  try {
    const id = document.getElementById('savedAvatarList').value;
    if (!id) throw new Error('Escolha um avatar salvo.');
    await withStore('readwrite', store => store.delete(id));
    await refreshList();
    status('Avatar excluído da biblioteca local.', 'ok');
  } catch (error) { status(error.message || 'Não foi possível excluir o avatar.', 'error'); }
});
refreshList().catch(error => status(error.message, 'error'));
