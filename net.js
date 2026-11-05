// Connects browsers directly with PeerJS. The host's tab runs the room, so there is no game server.
(function (root) {
  const PREFIX = 'projectx-beta-';
  const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const PING_MS = 4000;
  const LOST_MS = 13000;
  const CONNECT_MS = 12000;
  const GIVE_UP_MS = 180000;

  function newCode() {
    return Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
  }

  // handlers: open(code), error(message), join(token, name) -> rejection reason or null, leave(token), action(token, data)
  function startHost(handlers) {
    const conns = {};
    let peer = null;
    let code = null;

    function listen() {
      code = newCode();
      peer = new Peer(PREFIX + code);
      peer.on('open', () => handlers.open(code));
      peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
      peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
          peer.destroy();
          listen();
        } else if (err.type !== 'peer-unavailable' && !peer.open) {
          handlers.error('Could not create a room. Check your connection and try again.');
        }
      });
      peer.on('connection', (conn) => {
        let token = null;
        conn.on('data', (data) => {
          if (!data || typeof data !== 'object') return;
          if (data.type === 'join') {
            token = String(data.token).slice(0, 64);
            const previous = conns[token];
            conns[token] = conn;
            if (previous && previous !== conn) previous.close();
            const reason = handlers.join(token, data.name);
            if (reason) {
              delete conns[token];
              conn.send({ type: 'rejected', reason });
            }
          } else if (token && data.type !== 'pong') {
            handlers.action(token, data);
          }
        });
        conn.on('close', () => {
          if (token && conns[token] === conn) {
            delete conns[token];
            handlers.leave(token);
          }
        });
      });
    }

    listen();
    const pinger = setInterval(() => {
      Object.values(conns).forEach((conn) => { if (conn.open) conn.send({ type: 'ping' }); });
    }, PING_MS);

    return {
      send(token, message) {
        const conn = conns[token];
        if (conn && conn.open) conn.send(message);
      },
      close() {
        clearInterval(pinger);
        peer.destroy();
      },
    };
  }

  // handlers: state(data), error(message), status('connecting' | 'connected' | 'lost'), failed(reason)
  function joinRoom(code, { token, name, ...handlers }) {
    const target = PREFIX + code;
    let peer = new Peer();
    let conn = null;
    let joined = false;
    let finished = false;
    let lastSeen = Date.now();
    let attemptStarted = 0;
    let lostSince = null;

    function finish(reason) {
      finished = true;
      clearInterval(watchdog);
      handlers.failed(reason);
      peer.destroy();
    }

    function connect() {
      if (finished || !peer.open) return;
      if (conn) conn.close();
      attemptStarted = Date.now();
      const attempt = peer.connect(target, { reliable: true, serialization: 'json' });
      conn = attempt;
      attempt.on('open', () => {
        lastSeen = Date.now();
        attempt.send({ type: 'join', token, name });
      });
      attempt.on('data', (data) => {
        if (attempt !== conn || !data) return;
        lastSeen = Date.now();
        if (data.type === 'ping') {
          attempt.send({ type: 'pong' });
        } else if (data.type === 'rejected') {
          finish(data.reason);
        } else if (data.type === 'error') {
          handlers.error(data.message);
        } else {
          joined = true;
          lostSince = null;
          handlers.status('connected');
          handlers.state(data);
        }
      });
    }

    peer.on('open', connect);
    peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
    peer.on('error', (err) => {
      if (err.type === 'peer-unavailable' && !joined) finish(`No room found with the code ${code}. Check the code and try again.`);
      else if (!peer.open && !joined) finish('Could not connect. Check your connection and try again.');
    });

    const watchdog = setInterval(() => {
      if (finished) return;
      const quiet = Date.now() - lastSeen;
      const stuck = !conn || (!conn.open && Date.now() - attemptStarted > CONNECT_MS);
      if (!joined && stuck && attemptStarted) {
        finish('Could not reach that room. Some networks block direct connections, so try again or switch to mobile data.');
        return;
      }
      if (joined && (quiet > LOST_MS || stuck)) {
        if (lostSince === null) lostSince = Date.now();
        handlers.status('lost');
        if (Date.now() - lostSince > GIVE_UP_MS) finish('Lost the connection to the host. The room may have closed.');
        else if (Date.now() - attemptStarted > CONNECT_MS) connect();
      }
    }, 2000);

    handlers.status('connecting');
    return {
      send(message) {
        if (conn && conn.open) conn.send(message);
      },
    };
  }

  root.PXNet = { startHost, joinRoom };
})(typeof self !== 'undefined' ? self : this);
