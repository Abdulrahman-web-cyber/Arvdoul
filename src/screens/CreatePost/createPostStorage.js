// src/screens/CreatePost/createPostStorage.js
import { openDB } from 'idb';
import { v4 as uuidv4 } from 'uuid';
import { purgeCreatePostStorageForOwner } from '../../utils/localContentCache.js';
import {
  DRAFT_DB_NAME,
  DRAFT_DB_VERSION,
  DRAFTS_STORE,
  OFFLINE_QUEUE_STORE,
  MEDIA_BLOB_STORE,
  BLOB_HASH_STORE,
  VERSIONS_STORE,
  TEMPLATES_STORE,
  MEDIA_UPLOAD_QUEUE_STORE,
  MAX_VERSIONS_PER_DRAFT,
} from './createPostConstants.js';

export { purgeCreatePostStorageForOwner };

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256PureJsHex(bytes) {
  const len = bytes.length;
  const bitLenHi = Math.floor((len * 8) / 0x100000000);
  const bitLenLo = (len * 8) >>> 0;
  const paddedLen = Math.ceil((len + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, bitLenHi, false);
  view.setUint32(paddedLen - 4, bitLenLo, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((val) => val.toString(16).padStart(8, '0'))
    .join('');
}

export async function sha256(blob) {
  const buffer = blob instanceof ArrayBuffer
    ? blob
    : blob instanceof Uint8Array
      ? blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength)
      : await blob.arrayBuffer();
  const subtle = typeof globalThis !== 'undefined' ? globalThis.crypto?.subtle : null;
  if (subtle && typeof subtle.digest === 'function') {
    const hashBuffer = await subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256PureJsHex(new Uint8Array(buffer));
}

export function stripEphemeralUrlsFromMediaItems(mediaItems = []) {
  return (Array.isArray(mediaItems) ? mediaItems : []).map((m) => {
    const cleanUrl =
      typeof m.url === 'string' && !m.url.startsWith('blob:') && !m.url.startsWith('data:')
        ? m.url
        : '';
    const cleanThumb =
      typeof m.thumbnail === 'string' &&
      !m.thumbnail.startsWith('blob:') &&
      !m.thumbnail.startsWith('data:')
        ? m.thumbnail
        : null;
    const cleanThumbUrl =
      typeof m.thumbnailUrl === 'string' &&
      !m.thumbnailUrl.startsWith('blob:') &&
      !m.thumbnailUrl.startsWith('data:')
        ? m.thumbnailUrl
        : null;
    return {
      ...m,
      file: null,
      preview: null,
      url: cleanUrl,
      thumbnail: cleanThumb,
      thumbnailUrl: cleanThumbUrl,
    };
  });
}

export function sanitizeStateForTemplate(state) {
  if (!state) return {};
  const audio = state.typeData?.audio || {};
  const cleanAudioUrl =
    typeof audio.url === 'string' && !audio.url.startsWith('blob:') && !audio.url.startsWith('data:')
      ? audio.url
      : '';
  const cleanCoverUrl =
    typeof audio.coverUrl === 'string' &&
    !audio.coverUrl.startsWith('blob:') &&
    !audio.coverUrl.startsWith('data:')
      ? audio.coverUrl
      : null;

  return {
    postType: state.postType || null,
    content: state.content || '',
    contentJSON: state.contentJSON || null,
    mediaItems: stripEphemeralUrlsFromMediaItems(state.mediaItems),
    visibility: state.visibility || 'public',
    location: state.location || null,
    hashtags: Array.isArray(state.hashtags) ? state.hashtags : [],
    scheduledTime: null,
    pollClosesAt: state.pollClosesAt || null,
    typeData: {
      poll: { ...(state.typeData?.poll || { options: [], allowMultiple: false }) },
      event: { ...(state.typeData?.event || {}) },
      link: { ...(state.typeData?.link || {}) },
      audio: {
        ...audio,
        file: null,
        coverFile: null,
        previewUrl: cleanAudioUrl || null,
        url: cleanAudioUrl,
        coverUrl: cleanCoverUrl,
      },
      video: {
        file: null,
        url:
          typeof state.typeData?.video?.url === 'string' &&
          !state.typeData.video.url.startsWith('blob:')
            ? state.typeData.video.url
            : '',
        duration: state.typeData?.video?.duration || 0,
      },
    },
  };
}

let cachedDb = null;
let cachedDbPromise = null;

export async function openCreatePostDB() {
  if (cachedDb) return cachedDb;
  if (typeof indexedDB === 'undefined') return null;
  if (cachedDbPromise) return cachedDbPromise;

  const openPromise = openDB(DRAFT_DB_NAME, DRAFT_DB_VERSION, {
    allowDowngrade: true,
    upgrade(db, _oldVersion, _newVersion, tx) {
      const ensureStore = (name, options, indexes = []) => {
        const store = db.objectStoreNames.contains(name)
          ? tx.objectStore(name)
          : db.createObjectStore(name, options);
        for (const [idxName, keyPath] of indexes) {
          if (!store.indexNames.contains(idxName)) {
            store.createIndex(idxName, keyPath);
          }
        }
        return store;
      };

      ensureStore(DRAFTS_STORE, { keyPath: 'id' }, [
        ['postType', 'postType'],
        ['updatedAt', 'updatedAt'],
        ['ownerUid', 'ownerUid'],
      ]);
      ensureStore(OFFLINE_QUEUE_STORE, { keyPath: 'id' }, [
        ['postType', 'postType'],
        ['createdAt', 'createdAt'],
        ['ownerUid', 'ownerUid'],
      ]);
      ensureStore(MEDIA_BLOB_STORE, { keyPath: 'id' }, [['ownerUid', 'ownerUid']]);
      ensureStore(BLOB_HASH_STORE, { keyPath: 'hash' }, [['ownerUid', 'ownerUid']]);
      ensureStore(VERSIONS_STORE, { keyPath: 'id' }, [
        ['draftId', 'draftId'],
        ['ownerUid', 'ownerUid'],
      ]);
      ensureStore(TEMPLATES_STORE, { keyPath: 'id' }, [
        ['name', 'name'],
        ['ownerUid', 'ownerUid'],
      ]);
      ensureStore(MEDIA_UPLOAD_QUEUE_STORE, { keyPath: 'id' }, [
        ['ownerUid', 'ownerUid'],
        ['createdAt', 'createdAt'],
      ]);
    },
    blocking() {
      if (cachedDb) {
        try {
          cachedDb.close();
        } catch (err) {
          console.warn('[createPostStorage] IDB close on versionchange note:', err?.message);
        }
        cachedDb = null;
        cachedDbPromise = null;
      }
    },
    terminated() {
      cachedDb = null;
      cachedDbPromise = null;
    },
  });

  let timeoutId;
  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn('[createPostStorage] openCreatePostDB timed out; continuing without local IDB');
      resolve(null);
    }, 2000);
    if (typeof timeoutId?.unref === 'function') timeoutId.unref();
  });

  cachedDbPromise = Promise.race([openPromise, timeoutPromise])
    .then((db) => {
      clearTimeout(timeoutId);
      if (db) {
        cachedDb = db;
        return db;
      }
      cachedDbPromise = null;
      return null;
    })
    .catch((err) => {
      clearTimeout(timeoutId);
      console.warn('[createPostStorage] openCreatePostDB unavailable:', err?.message);
      cachedDbPromise = null;
      return null;
    });

  return cachedDbPromise;
}

function assertUid(uid) {
  if (!uid || typeof uid !== 'string') {
    throw new Error('Authenticated user ID is required for composer storage');
  }
  return uid;
}

function ownedBy(record, uid) {
  return Boolean(record && record.ownerUid && record.ownerUid === uid);
}

export async function storeBlobWithDedup(db, file, type, ownerUid) {
  if (!db) return null;
  const uid = assertUid(ownerUid);
  const rawHash = await sha256(file);
  const scopedHash = `${uid}:${rawHash}`;
  const existing = await db.get(BLOB_HASH_STORE, scopedHash);
  if (existing && existing.blobId) {
    const existingBlob = await db.get(MEDIA_BLOB_STORE, existing.blobId);
    if (existingBlob && existingBlob.ownerUid === uid) {
      return existing.blobId;
    }
  }
  const blobId = uuidv4();
  await db.put(MEDIA_BLOB_STORE, {
    id: blobId,
    blob: file,
    type: type || file.type || 'application/octet-stream',
    name: file.name || 'media',
    ownerUid: uid,
    createdAt: Date.now(),
  });
  await db.put(BLOB_HASH_STORE, {
    hash: scopedHash,
    blobId,
    type: type || file.type || 'application/octet-stream',
    ownerUid: uid,
  });
  return blobId;
}

export async function getOwnedBlob(db, blobId, ownerUid) {
  if (!db || !blobId) return null;
  const uid = assertUid(ownerUid);
  const rec = await db.get(MEDIA_BLOB_STORE, blobId);
  return ownedBy(rec, uid) ? rec : null;
}

export async function gcOrphanBlobs(db, ownerUid) {
  if (!db) return;
  const referenced = new Set();

  const collectFromMedia = (items) => {
    for (const m of Array.isArray(items) ? items : []) {
      if (m?.blobId) referenced.add(m.blobId);
    }
  };

  const [drafts, queued, versions, mediaUploads] = await Promise.all([
    db.getAll(DRAFTS_STORE),
    db.getAll(OFFLINE_QUEUE_STORE),
    db.getAll(VERSIONS_STORE),
    db.getAll(MEDIA_UPLOAD_QUEUE_STORE),
  ]);

  for (const d of drafts) collectFromMedia(d?.data?.mediaItems);
  for (const q of queued) collectFromMedia(q?.data?.mediaItems);
  for (const v of versions) collectFromMedia(v?.data?.mediaItems);
  for (const u of mediaUploads) {
    if (u?.blobId) referenced.add(u.blobId);
  }

  const allBlobs = await db.getAll(MEDIA_BLOB_STORE);
  const deletedBlobIds = new Set();
  for (const b of allBlobs) {
    if (ownerUid && b.ownerUid && b.ownerUid !== ownerUid) continue;
    if (!referenced.has(b.id)) {
      await db.delete(MEDIA_BLOB_STORE, b.id);
      deletedBlobIds.add(b.id);
    }
  }

  if (deletedBlobIds.size > 0) {
    const allHashes = await db.getAll(BLOB_HASH_STORE);
    for (const h of allHashes) {
      if (deletedBlobIds.has(h.blobId)) {
        await db.delete(BLOB_HASH_STORE, h.hash);
      }
    }
  }
}

export async function listDraftsForOwner(db, ownerUid) {
  if (!db || !ownerUid) return [];
  const all = await db.getAll(DRAFTS_STORE);
  return all
    .filter((d) => ownedBy(d, ownerUid))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function getDraftForOwner(db, draftId, ownerUid) {
  if (!db || !draftId || !ownerUid) return null;
  const draft = await db.get(DRAFTS_STORE, draftId);
  return ownedBy(draft, ownerUid) ? draft : null;
}

export async function saveDraftRecord(db, draft, ownerUid) {
  const uid = assertUid(ownerUid);
  const scopedDraft = {
    ...draft,
    ownerUid: uid,
    updatedAt: draft.updatedAt || Date.now(),
  };
  await db.put(DRAFTS_STORE, scopedDraft);

  // Record a version snapshot and enforce bounded retention per draft
  await db.put(VERSIONS_STORE, {
    id: uuidv4(),
    draftId: scopedDraft.id,
    ownerUid: uid,
    data: scopedDraft.data,
    timestamp: Date.now(),
  });

  const existingVersions = (await db.getAllFromIndex(VERSIONS_STORE, 'draftId', scopedDraft.id))
    .filter((v) => ownedBy(v, uid))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  if (existingVersions.length > MAX_VERSIONS_PER_DRAFT) {
    const stale = existingVersions.slice(MAX_VERSIONS_PER_DRAFT);
    await Promise.all(stale.map((v) => db.delete(VERSIONS_STORE, v.id)));
  }

  return scopedDraft;
}

export async function deleteDraftRecord(db, draftId, ownerUid) {
  if (!db || !draftId) return false;
  const uid = assertUid(ownerUid);
  const existing = await db.get(DRAFTS_STORE, draftId);
  if (existing && !ownedBy(existing, uid)) return false;

  await db.delete(DRAFTS_STORE, draftId);
  const versions = await db.getAllFromIndex(VERSIONS_STORE, 'draftId', draftId);
  await Promise.all(
    versions.filter((v) => ownedBy(v, uid)).map((v) => db.delete(VERSIONS_STORE, v.id))
  );
  await gcOrphanBlobs(db, uid);
  return true;
}

export async function listDraftVersionsForOwner(db, draftId, ownerUid) {
  if (!db || !draftId || !ownerUid) return [];
  const all = await db.getAllFromIndex(VERSIONS_STORE, 'draftId', draftId);
  return all
    .filter((v) => ownedBy(v, ownerUid))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

export async function listTemplatesForOwner(db, ownerUid) {
  if (!db || !ownerUid) return [];
  const all = await db.getAll(TEMPLATES_STORE);
  return all
    .filter((t) => ownedBy(t, ownerUid))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function saveTemplateRecord(db, { name, postType, state, ownerUid }) {
  const uid = assertUid(ownerUid);
  const template = {
    id: uuidv4(),
    ownerUid: uid,
    name: name.trim(),
    postType,
    data: sanitizeStateForTemplate(state),
    createdAt: Date.now(),
  };
  await db.put(TEMPLATES_STORE, template);
  return template;
}

export async function getTemplateForOwner(db, templateId, ownerUid) {
  if (!db || !templateId || !ownerUid) return null;
  const tpl = await db.get(TEMPLATES_STORE, templateId);
  return ownedBy(tpl, ownerUid) ? tpl : null;
}

export async function listOfflineQueueForOwner(db, ownerUid) {
  if (!db || !ownerUid) return [];
  const all = await db.getAll(OFFLINE_QUEUE_STORE);
  return all
    .filter((item) => ownedBy(item, ownerUid))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

export async function getOfflineQueueItemForOwner(db, itemId, ownerUid) {
  if (!db || !itemId || !ownerUid) return null;
  const item = await db.get(OFFLINE_QUEUE_STORE, itemId);
  return ownedBy(item, ownerUid) ? item : null;
}

export async function putOfflineQueueItem(db, item, ownerUid) {
  const uid = assertUid(ownerUid);
  const record = { ...item, ownerUid: uid };
  await db.put(OFFLINE_QUEUE_STORE, record);
  return record;
}

export async function deleteOfflineQueueItem(db, itemId, ownerUid) {
  if (!db || !itemId) return false;
  const uid = assertUid(ownerUid);
  const existing = await db.get(OFFLINE_QUEUE_STORE, itemId);
  if (existing && !ownedBy(existing, uid)) return false;
  await db.delete(OFFLINE_QUEUE_STORE, itemId);
  await gcOrphanBlobs(db, uid);
  return true;
}

// Unified UID-scoped media upload retry queue (replaces unscoped arvdoul_upload_queue)
export async function enqueueMediaUpload(db, item, ownerUid) {
  const uid = assertUid(ownerUid);
  if (!item?.file) throw new Error('Cannot queue media upload without a file');
  const blobId = await storeBlobWithDedup(db, item.file, item.type || item.file.type, uid);
  const record = {
    id: item.id || uuidv4(),
    ownerUid: uid,
    blobId,
    name: item.name || item.file.name || 'media',
    type: item.type || (item.file.type?.startsWith('video/') ? 'video' : 'image'),
    mimeType: item.file.type || 'image/jpeg',
    alt: item.alt || '',
    retries: 0,
    createdAt: Date.now(),
  };
  await db.put(MEDIA_UPLOAD_QUEUE_STORE, record);
  return record;
}

export async function listMediaUploadsForOwner(db, ownerUid) {
  if (!db || !ownerUid) return [];
  const rows = await db.getAll(MEDIA_UPLOAD_QUEUE_STORE);
  const owned = rows.filter((r) => ownedBy(r, ownerUid));
  const hydrated = [];
  for (const row of owned) {
    const blobRec = row.blobId ? await getOwnedBlob(db, row.blobId, ownerUid) : null;
    if (blobRec?.blob) {
      const file = new File([blobRec.blob], row.name || 'media', {
        type: row.mimeType || blobRec.type || 'image/jpeg',
      });
      hydrated.push({ ...row, file });
    }
  }
  return hydrated;
}

export async function removeMediaUpload(db, id, ownerUid) {
  if (!db || !id || !ownerUid) return;
  const rec = await db.get(MEDIA_UPLOAD_QUEUE_STORE, id);
  if (rec && ownedBy(rec, ownerUid)) {
    await db.delete(MEDIA_UPLOAD_QUEUE_STORE, id);
    await gcOrphanBlobs(db, ownerUid);
  }
}
