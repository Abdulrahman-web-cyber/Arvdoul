// functions/questions.js – ARVDOUL Q&A (server-authoritative)
//
// Post-embedded questions were a fully-built UI with no backend: the composer
// published `question` as a plain string while QuestionCard renders
// `question.text`/`question.bounty`/`question.closed`, answers lived in a
// client array nothing ever read, and nothing could post, vote on, accept,
// edit or delete an answer. Every Q&A control was therefore dead.
//
// Answers and their counters (upvotes / best answer) live on the post document
// under `question.answers`, and firestore.rules only let the post author update
// the post — an answerer is not the author, so a direct client write would be
// denied (and if it were allowed, the client could forge `isBest` or inflate
// `upvotes`). Every mutation therefore goes through a callable here:
//   - addAnswer        – append an answer (answerer)
//   - editAnswer       – edit your own answer
//   - deleteAnswer     – delete your own answer (or the question author / admin)
//   - castAnswerVote   – one vote per (answer, voter); toggles up/down
//   - acceptAnswer     – question author marks one answer best, closes the question
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { checkRateLimit } = require('./rateLimit');
const { getUserIdFromContext, isAdmin } = require('./auth');
const { awardXpSafe } = require('./xpAward');

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const MAX_ANSWER_LENGTH = 5000;

function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, '').trim();
}

/** Accepts either an array of answer objects or a legacy string array. */
function normaliseAnswers(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a) => (typeof a === 'string' ? { answer: a } : a))
    .filter((a) => a && typeof a === 'object');
}

/** Loads a post, asserts it is a question, and returns its answers. */
async function loadQuestionAnswers(postId) {
  const snap = await db.collection('posts').doc(postId).get();
  if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Post not found');
  const question = snap.data().question;
  if (!question || typeof question !== 'object') {
    throw new functions.https.HttpsError('failed-precondition', 'This post has no question');
  }
  return { question, answers: normaliseAnswers(question.answers) };
}

exports.addAnswer = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'addAnswer', 20, 60000);

  const { postId } = data || {};
  const text = stripHtml(data?.answer).slice(0, MAX_ANSWER_LENGTH);
  if (!postId) throw new functions.https.HttpsError('invalid-argument', 'postId required');
  if (!text) throw new functions.https.HttpsError('invalid-argument', 'Answer cannot be empty');

  const postRef = db.collection('posts').doc(postId);
  const answerId = `ans_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const profileSnap = await db.collection('users').doc(uid).get();
  const profile = profileSnap.exists ? profileSnap.data() : {};

  await db.runTransaction(async (t) => {
    const postSnap = await t.get(postRef);
    if (!postSnap.exists) throw new functions.https.HttpsError('not-found', 'Post not found');
    const question = postSnap.data().question;
    if (!question || typeof question !== 'object') {
      throw new functions.https.HttpsError('failed-precondition', 'This post has no question');
    }
    if (question.closed === true) {
      throw new functions.https.HttpsError('failed-precondition', 'This question is closed');
    }
    const answers = normaliseAnswers(question.answers);
    answers.push({
      id: answerId,
      userId: uid,
      userName: profile.displayName || profile.name || profile.username || 'Arvdoul user',
      userPhoto: profile.photoURL || '',
      userReputation: typeof profile.reputation === 'number' ? profile.reputation : null,
      answer: text,
      upvotes: 0,
      downvotes: 0,
      isBest: false,
      createdAt: new Date().toISOString(),
    });
    t.update(postRef, { 'question.answers': answers, updatedAt: FieldValue.serverTimestamp() });
  });

  await awardXpSafe(uid, 'answer_created', { source: answerId });

  return { success: true, answerId };
});

exports.editAnswer = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'editAnswer', 30, 60000);

  const { postId, answerId } = data || {};
  const text = stripHtml(data?.answer).slice(0, MAX_ANSWER_LENGTH);
  if (!postId || !answerId) throw new functions.https.HttpsError('invalid-argument', 'postId and answerId required');
  if (!text) throw new functions.https.HttpsError('invalid-argument', 'Answer cannot be empty');

  const postRef = db.collection('posts').doc(postId);
  await db.runTransaction(async (t) => {
    const { answers } = await loadQuestionAnswers(postId);
    const index = answers.findIndex((a) => a.id === answerId);
    if (index < 0) throw new functions.https.HttpsError('not-found', 'Answer not found');
    if (answers[index].userId !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'You can only edit your own answer');
    }
    answers[index] = { ...answers[index], answer: text, editedAt: new Date().toISOString() };
    t.update(postRef, { 'question.answers': answers, updatedAt: FieldValue.serverTimestamp() });
  });

  return { success: true };
});

exports.deleteAnswer = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'deleteAnswer', 30, 60000);

  const { postId, answerId } = data || {};
  if (!postId || !answerId) throw new functions.https.HttpsError('invalid-argument', 'postId and answerId required');

  const postRef = db.collection('posts').doc(postId);
  const postSnap = await postRef.get();
  const postAuthorId = postSnap.exists ? postSnap.data().authorId : null;
  const admin = await isAdmin(uid);

  await db.runTransaction(async (t) => {
    const { answers } = await loadQuestionAnswers(postId);
    const index = answers.findIndex((a) => a.id === answerId);
    if (index < 0) throw new functions.https.HttpsError('not-found', 'Answer not found');
    const owner = answers[index].userId;
    if (owner !== uid && postAuthorId !== uid && !admin) {
      throw new functions.https.HttpsError('permission-denied', 'You cannot delete this answer');
    }
    answers.splice(index, 1);
    t.update(postRef, { 'question.answers': answers, updatedAt: FieldValue.serverTimestamp() });
  });

  return { success: true };
});

exports.castAnswerVote = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'castAnswerVote', 60, 60000);

  const { postId, answerId, direction } = data || {};
  if (!postId || !answerId) {
    throw new functions.https.HttpsError('invalid-argument', 'postId and answerId required');
  }
  const newVote = direction === 'up' ? 'up' : direction === 'down' ? 'down' : null;

  const postRef = db.collection('posts').doc(postId);
  const voteRef = postRef.collection('answer_votes').doc(`${answerId}_${uid}`);

  const result = await db.runTransaction(async (t) => {
    const { answers } = await loadQuestionAnswers(postId);
    const index = answers.findIndex((a) => a.id === answerId);
    if (index < 0) throw new functions.https.HttpsError('not-found', 'Answer not found');

    const voteSnap = await t.get(voteRef);
    const previousVote = voteSnap.exists ? voteSnap.data().direction : null;

    const answer = { ...answers[index] };
    let upvotes = typeof answer.upvotes === 'number' ? answer.upvotes : 0;
    let downvotes = typeof answer.downvotes === 'number' ? answer.downvotes : 0;

    // Reverse the old vote, then apply the new one.
    if (previousVote === 'up') upvotes -= 1;
    if (previousVote === 'down') downvotes -= 1;
    if (newVote === 'up') upvotes += 1;
    if (newVote === 'down') downvotes += 1;

    answer.upvotes = Math.max(0, upvotes);
    answer.downvotes = Math.max(0, downvotes);
    answers[index] = answer;

    t.update(postRef, { 'question.answers': answers });
    if (newVote) {
      t.set(voteRef, { userId: uid, answerId, direction: newVote, updatedAt: FieldValue.serverTimestamp() });
    } else {
      t.delete(voteRef);
    }

    return { answer, vote: newVote };
  });

  return { success: true, answer: result.answer, vote: result.vote };
});

exports.acceptAnswer = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'acceptAnswer', 30, 60000);

  const { postId, answerId } = data || {};
  if (!postId || !answerId) {
    throw new functions.https.HttpsError('invalid-argument', 'postId and answerId required');
  }

  const postRef = db.collection('posts').doc(postId);
  let acceptedUserId = null;

  await db.runTransaction(async (t) => {
    const postSnap = await t.get(postRef);
    if (!postSnap.exists) throw new functions.https.HttpsError('not-found', 'Post not found');
    const post = postSnap.data();
    if (post.authorId !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'Only the question author can accept an answer');
    }
    const answers = normaliseAnswers(post.question && post.question.answers);
    const index = answers.findIndex((a) => a.id === answerId);
    if (index < 0) throw new functions.https.HttpsError('not-found', 'Answer not found');
    acceptedUserId = answers[index].userId || null;

    const updated = answers.map((a, i) => ({ ...a, isBest: i === index }));

    t.update(postRef, {
      'question.answers': updated,
      'question.acceptedAnswerId': answerId,
      'question.closed': true,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  if (acceptedUserId) {
    await awardXpSafe(acceptedUserId, 'answer_accepted', { source: `${postId}_${answerId}` });
  }

  return { success: true };
});
