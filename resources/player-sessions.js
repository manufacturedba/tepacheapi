import { Timestamp, WriteResult } from 'firebase-admin/firestore';
import { assert } from '../lib/assert.js';
import { Resource } from '../lib/resource.js';
import { createForNamespace } from '../lib/urn.js';
import { urn as validateUrn } from '../lib/validate.js';
import { Firestore } from '../services/firestore.js';
export class TepachePlayerSessions extends Resource {
  #firestore;

  namespace = 'tepache-player-session';

  collectionName = 'tepachePlayerSessions';

  constructor(firestore) {
    super();

    this.#firestore = firestore;
  }

  /**
   * Find matching player session for game session.
   *
   * @param {String} gameSessionUrn - The urn of the game session.
   * @param {Object} options
   * @param {String} uid - The uid of the player.
   *
   * @returns {Promise<DocumentReference>}
   */
  getByGameSessionUrnAndUser(gameSessionUrn, uid) {
    assert(
      validateUrn(gameSessionUrn),
      'gameSessionUrn is required to be a valid urn'
    );
    assert(uid, 'uid is required');

    return this.#firestore
      .findDocs(
        this.collectionName,
        {
          field: 'gameSessionUrn',
          operator: '==',
          value: gameSessionUrn,
        },
        {
          field: 'uid',
          operator: '==',
          value: uid,
        }
      )
      .orderBy('createdAt')
      .limitToLast(1);
  }

  /**
   *
   * @param {String} gameSessionUrn - The urn of the game session.
   * @param {String} uid - The uid of the player.
   * @param {String} name - The name of the player.
   * @returns {Promise<DocumentReference>}
   */
  async createForGameSessionAndUser(gameSessionUrn, uid, { name }) {
    assert(
      validateUrn(gameSessionUrn),
      'gameSessionUrn is required to be a valid urn'
    );
    assert(uid, 'uid is required');

    const urn = createForNamespace(this.namespace);
    const createdAt = Timestamp.now();

    const document = {
      urn,
      name,
      createdAt,
      lastActivityAt: createdAt,
      gameSessionUrn,
      uid,
    };

    return this.#firestore.addDoc(this.collectionName, document);
  }

  /**
   * Update the name for a player session.
   *
   * @param {String} playerSessionDocumentId - The id of the player session document.
   * @param {String} name - The updated name of the player.
   * @returns {Promise<WriteResult}
   */
  async updateName(playerSessionDocumentId, name = '') {
    assert(playerSessionDocumentId, 'playerSessionDocumentId is required');
    assert(name, 'name is required');

    const documentReference = await this.#firestore.getDocById(
      this.collectionName,
      playerSessionDocumentId
    );

    await Firestore.updateDocumentReference(documentReference, { name });

    return documentReference;
  }
}
