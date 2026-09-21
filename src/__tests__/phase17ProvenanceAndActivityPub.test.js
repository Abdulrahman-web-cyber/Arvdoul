// src/__tests__/phase17ProvenanceAndActivityPub.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  ContentProvenanceService,
  MEDIA_GENESIS_TYPE,
} from '../services/contentProvenanceService.js';
import {
  ActivityPubMeshService,
  FEDERATION_DOMAIN_STATUS,
  ACTIVITY_TYPES,
} from '../services/activityPubMeshService.js';

describe('Phase 17: Content Provenance & Federated ActivityPub Mesh', () => {
  describe('1. Content Provenance & C2PA Tamper Detection (Feature 52)', () => {
    let provService;

    beforeEach(() => {
      provService = new ContentProvenanceService();
    });

    it('registers C2PA manifest with perceptual hash and cryptographic signature', () => {
      const mediaPayload = 'raw-raw-video-bytes-sample-12345';
      const manifest = provService.registerManifest({
        contentId: 'video_sunset_4k',
        creatorId: 'creator_eva',
        mediaData: mediaPayload,
        genesisType: MEDIA_GENESIS_TYPE.ORIGINAL_CAPTURE,
        toolMetadata: { software: 'CameraSensorPro', version: '1.4' },
      });

      expect(manifest.manifestId).toBeDefined();
      expect(manifest.contentHash).toMatch(/^FP_/);
      expect(manifest.signature).toMatch(/^SIG_PROVENANCE_/);
      expect(manifest.syntheticRisk.score).toBe(0.0);
      expect(manifest.syntheticRisk.classification).toBe('AUTHENTIC_CAPTURE');
    });

    it('detects tampering and rejects modified media data', () => {
      const originalMedia = 'authentic-interview-audio-segment';
      const manifest = provService.registerManifest({
        contentId: 'interview_audio_1',
        creatorId: 'journalist_bob',
        mediaData: originalMedia,
      });

      // Verification on pristine media succeeds
      const pristineCheck = provService.verifyProvenance(manifest.manifestId, originalMedia);
      expect(pristineCheck.isValid).toBe(true);
      expect(pristineCheck.creatorId).toBe('journalist_bob');

      // Tampered media data fails
      const tamperedMedia = 'tampered-interview-audio-segment-modified';
      const tamperedCheck = provService.verifyProvenance(manifest.manifestId, tamperedMedia);
      expect(tamperedCheck.isValid).toBe(false);
      expect(tamperedCheck.reason).toBe('CONTENT_TAMPERED_OR_MODIFIED');
    });

    it('evaluates synthetic media risk for AI-generated and undisclosed synthetic media', () => {
      // Properly disclosed AI content
      const disclosedAI = provService.registerManifest({
        contentId: 'synth_art_1',
        creatorId: 'ai_artist',
        mediaData: 'gemini-generated-pixels',
        genesisType: MEDIA_GENESIS_TYPE.AI_GENERATED,
        aiDisclosure: { model: 'Gemini-2.0-Flash', prompt: 'Neo Tokyo skyline' },
      });
      expect(disclosedAI.syntheticRisk.score).toBe(0.1);
      expect(disclosedAI.syntheticRisk.classification).toBe('DECLARED_SYNTHETIC');

      // Undisclosed/suspected synthetic media
      const undisclosedAI = provService.registerManifest({
        contentId: 'fake_news_clip',
        creatorId: 'anon_bad_actor',
        mediaData: 'cloned-voice-audio-bytes',
        genesisType: MEDIA_GENESIS_TYPE.SYNTHETIC_UNKNOWN,
      });
      expect(undisclosedAI.syntheticRisk.score).toBe(0.85);
      expect(undisclosedAI.syntheticRisk.isPermitted).toBe(false);
      expect(undisclosedAI.syntheticRisk.classification).toBe('SUSPECTED_UNDISCLOSED_SYNTHETIC');
    });

    it('tracks append-only chain of custody with edit actions', () => {
      const initialMedia = 'initial-photo-frame';
      const manifest = provService.registerManifest({
        contentId: 'photo_raw',
        creatorId: 'photographer_sam',
        mediaData: initialMedia,
      });

      const editedMedia = 'color-graded-photo-frame';
      const updated = provService.appendEditAction(manifest.manifestId, 'colorist_dan', {
        actionType: 'c2pa.color_graded',
        tool: 'LightroomClone',
        outputMediaData: editedMedia,
      });

      const editAssertion = updated.assertions.find(a => a.label === 'c2pa.actions');
      expect(editAssertion.data.actions.length).toBe(2);
      expect(editAssertion.data.actions[1].editorId).toBe('colorist_dan');

      // Verification on new edited media succeeds with updated chain
      const verifyEdited = provService.verifyProvenance(manifest.manifestId, editedMedia);
      expect(verifyEdited.isValid).toBe(true);
    });
  });

  describe('2. Federated ActivityPub Mesh Protocol (Feature 53)', () => {
    let pubService;

    beforeEach(() => {
      pubService = new ActivityPubMeshService('arvdoul.network');
    });

    it('resolves WebFinger queries for local and remote actors', () => {
      const local = pubService.resolveWebFinger('acct:alice@arvdoul.network');
      expect(local.subject).toBe('acct:alice@arvdoul.network');
      expect(local.links[0].href).toBe('https://arvdoul.network/users/alice');

      const remote = pubService.resolveWebFinger('acct:mastodon_user@mastodon.social');
      expect(remote.subject).toBe('acct:mastodon_user@mastodon.social');
      expect(remote.links[0].href).toBe('https://mastodon.social/users/mastodon_user');
    });

    it('generates standard ActivityStreams Person Actor object with public keys', () => {
      const actor = pubService.generateActor('elena', 'Elena Rostova', 'Digital Artist & Sound Explorer');
      expect(actor.type).toBe('Person');
      expect(actor.id).toBe('https://arvdoul.network/users/elena');
      expect(actor.inbox).toBe('https://arvdoul.network/users/elena/inbox');
      expect(actor.publicKey.publicKeyPem).toContain('BEGIN PUBLIC KEY');
    });

    it('publishes Notes and logs activities into outbox', () => {
      const noteActivity = pubService.publishNote({
        authorUsername: 'elena',
        content: '<p>Hello decentralized fediverse!</p>',
      });

      expect(noteActivity.type).toBe(ACTIVITY_TYPES.CREATE);
      expect(noteActivity.object.content).toBe('<p>Hello decentralized fediverse!</p>');

      const outbox = pubService.outboxRegistry.get('https://arvdoul.network/users/elena');
      expect(outbox.length).toBe(1);
    });

    it('enforces federation domain moderation policies and signature checks', () => {
      // 1. Allowed domain
      const activityFromMastodon = {
        type: ACTIVITY_TYPES.CREATE,
        id: 'https://mastodon.social/activities/101',
        actor: 'https://mastodon.social/users/charlie',
        object: { type: 'Note', content: 'Friendly federation post' },
      };

      const resultAllowed = pubService.receiveInboundActivity({
        activity: activityFromMastodon,
        signatureHeaders: { signature: 'keyId="main",signature="valid_base64_sig"' },
        senderDomain: 'mastodon.social',
      });
      expect(resultAllowed.accepted).toBe(true);

      // 2. Suspended domain
      pubService.setDomainPolicy('badactor.spam', FEDERATION_DOMAIN_STATUS.SUSPENDED);
      const activityFromSpam = {
        type: ACTIVITY_TYPES.CREATE,
        id: 'https://badactor.spam/activities/666',
        actor: 'https://badactor.spam/users/bot',
        object: { type: 'Note', content: 'Spam payload' },
      };

      const resultSuspended = pubService.receiveInboundActivity({
        activity: activityFromSpam,
        senderDomain: 'badactor.spam',
      });
      expect(resultSuspended.accepted).toBe(false);
      expect(resultSuspended.reason).toBe('DOMAIN_SUSPENDED');

      // 3. Invalid signature
      const resultBadSig = pubService.receiveInboundActivity({
        activity: activityFromMastodon,
        signatureHeaders: { signature: 'invalid_sig' },
        senderDomain: 'mastodon.social',
      });
      expect(resultBadSig.accepted).toBe(false);
      expect(resultBadSig.reason).toBe('INVALID_HTTP_SIGNATURE');
    });
  });
});
