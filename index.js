/**
 * TODO: Delete this entrypoint following clean up of index.js
 */

import hapiBasic from '@hapi/basic';
import Hapi from '@hapi/hapi';
import Nes from '@hapi/nes';
import hapiPino from 'hapi-pino';
import hapiRateLimit from 'hapi-rate-limit';
import { tepacheGameSessionsPostHandler } from './handlers/tepache-game-sessions.js';
import {
  tepachePlayerSessionsGetHandler,
  tepachePlayerSessionsPatchHandler,
  tepachePlayerSessionsPostHandler,
} from './handlers/tepache-player-sessions.js';
import { heartbeatHandler } from './handlers/heartbeat.js';
import {
  tepacheSessionCapturesPostHandler,
  tepacheSessionCapturesTwilioSMSHandler,
} from './handlers/tepache-session-captures.js';
import { CORS } from './lib/config.js';
import { TepacheGameSessions } from './resources/game-sessions.js';
import { TepacheGames } from './resources/games.js';
import { TepacheHardwareInputs } from './resources/hardware-inputs.js';
import { TepachePlayerSessions } from './resources/player-sessions.js';
import { TepacheSessionCaptures } from './resources/session-captures.js';
import { TepacheLogs } from './resources/logs.js';
import { Authentication } from './services/authentication.js';
import { Firebase } from './services/firebase.js';
import { Firestore } from './services/firestore.js';
import { GameFacade } from './services/game-facade.js';
import { SESSION_MAX } from './constants/session-max.js';

const firebase = new Firebase();

await firebase.register();

const firestore = new Firestore(firebase);
const authentication = new Authentication(firebase);

const tepachePlayerSessions = new TepachePlayerSessions(firestore);
const tepacheGameSessions = new TepacheGameSessions(firestore);
const tepacheGames = new TepacheGames(firestore);
const tepacheHardwareInputs = new TepacheHardwareInputs(firestore);
const tepacheSessionCaptures = new TepacheSessionCaptures(firestore);
const tepacheLogs = new TepacheLogs(firestore);

const gameFacade = new GameFacade(
  tepacheGameSessions,
  tepacheHardwareInputs,
  tepacheLogs,
  tepachePlayerSessions
);

const PORT = process.env.PORT || 8484;

let sessionIncrement = 0;

/**
 * Generate incremented number
 * @returns
 */
function generateNumber() {
  if (sessionIncrement >= SESSION_MAX) {
    sessionIncrement = 0;
  }

  return ++sessionIncrement;
}

/**
 * Generates anonymous name
 *
 * @returns
 */
function generateAnonymous() {
  return `Anonymous${generateNumber()}`;
}

(async () => {
  const server = Hapi.server({
    // do not forget to read this from process
    debug: {
      log: ['*'],
      request: ['*'],
    },
    port: PORT,
    host: '0.0.0.0',
    routes: {
      cors: CORS,
    },
  });

  await server.register([
    {
      plugin: hapiRateLimit,
      options: {
        enabled: true,
        pathLimit: 1000,
        userLimit: 100,
        userPathLimit: 10,
        userCache: {
          expiresIn: 1000,
        },
        pathCache: {
          expiresIn: 1000,
        },
        userPathCache: {
          expiresIn: 1000,
        },
        headers: false,
      },
    },
    {
      plugin: hapiPino,
      options: {
        // Redact Authorization headers, see https://getpino.io/#/docs/redaction
        redact: ['req.headers.authorization'],
      },
    },
    {
      plugin: hapiBasic,
    },
  ]);

  // This works super poorly for JWT so hacks are warranted
  const validate = async (request) => {
    const [, token] = request.headers.authorization.split('Basic ');
    return {
      isValid: true,
      credentials: {
        authorization: token,
      },
    };
  };

  server.auth.strategy('socket', 'basic', { validate });

  await server.register([
    {
      plugin: Nes,
      options: {
        auth: {
          type: 'direct',
          route: 'socket',
        },
      },
    },
  ]);

  // https://jsonapi.org/format/

  server.route({
    method: 'POST',
    path: '/api/tepache-games', // create
    handler: async (request, h) => {
      return h.response('Not implemented').code(501);
    },
  });

  server.route({
    method: 'POST',
    path: '/api/tepache-game-sessions', // create
    ...tepacheGameSessionsPostHandler(
      authentication,
      tepacheGameSessions,
      tepacheGames
    ),
  });

  server.route({
    method: 'GET',
    path: '/api/tepache-player-sessions',
    ...tepachePlayerSessionsGetHandler(authentication, tepachePlayerSessions),
  });

  server.route({
    method: 'GET',
    path: '/api/tepache-player-sessions/{playerSessionUrn}',
    ...tepachePlayerSessionsGetHandler(authentication, tepachePlayerSessions),
  });

  server.route({
    method: 'POST',
    path: '/api/tepache-player-sessions',
    ...tepachePlayerSessionsPostHandler(
      authentication,
      tepachePlayerSessions,
      generateAnonymous,
      tepacheLogs
    ),
  });

  server.route({
    method: 'PATCH',
    path: '/api/tepache-player-sessions/{playerSessionDocumentId}',
    ...tepachePlayerSessionsPatchHandler(
      authentication,
      tepachePlayerSessions,
      generateAnonymous
    ),
  });

  server.route({
    method: 'POST',
    path: '/api/socket/heartbeat',
    ...heartbeatHandler(authentication, tepachePlayerSessions),
  });

  server.route({
    method: 'POST',
    path: '/api/tepache-session-captures', // create
    handler: async (request, h) => {
      return h.response('Not implemented').code(501);
    },
  });

  server.route({
    method: 'POST',
    path: '/api/tepache-hardware-inputs', // create
    handler: async (request, h) => {
      return h.response('Not implemented').code(501);
    },
  });

  server.route({
    method: 'POST',
    path: '/api/tepache-logs', // create
    handler: async (request, h) => {
      return h.response('Not implemented').code(501);
    },
  });

  server.route({
    method: 'POST',
    path: '/api/socket/tepache-session-captures', // create
    ...tepacheSessionCapturesPostHandler(
      tepacheSessionCaptures,
      tepacheGameSessions,
      tepachePlayerSessions,
      gameFacade,
      tepacheLogs
    ),
  });

  server.route({
    method: 'POST',
    path: '/api/sms/tepache-session-captures', // create
    ...tepacheSessionCapturesTwilioSMSHandler(
      tepacheSessionCaptures,
      tepacheGameSessions,
      tepachePlayerSessions,
      gameFacade
    ),
  });

  server.route({
    method: '*',
    path: '/{any*}',
    handler: function (request, h) {
      return h.response('Not Found\n').code(404);
    },
  });

  gameFacade.subscribe();

  await server.start();

  console.log('Tepache API running at', PORT);
})();

process.on('unhandledRejection', (err) => {
  console.log(err);
  try {
    gameFacade.unsubscribe();
  } catch (e) {
    console.log('Failed to unsubscribe', e);
  }
  process.exit(1);
});
