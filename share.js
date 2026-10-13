(function () {
  const SETTINGS_KEY = 'amerikano-supabase-v1';
  const params = new URLSearchParams(location.search);
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch {}
  const incoming = params.get('sb') && params.get('key') ? { url: params.get('sb'), anonKey: params.get('key') } : {};
  // Treat URL and key as one pair so incomplete old settings never mix projects.
  let config = { ...(window.SUPABASE_CONFIG || {}), ...(saved.url && saved.anonKey ? saved : {}), ...incoming };
  if (incoming.url) localStorage.setItem(SETTINGS_KEY, JSON.stringify(incoming));
  const headers = () => ({ 'Content-Type': 'application/json', apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` });
  // Prove in locale: il cloud vero resta spento, salvo consenso esplicito (localStorage 'amerikano-cloud-in-locale' = '1').
  const localBlocked = (() => { try { return /^(localhost|127(?:\.\d{1,3}){3}|\[::1\]|::1)$|\.localhost$/i.test(String(location.hostname || '')) && localStorage.getItem('amerikano-cloud-in-locale') !== '1'; } catch { return false; } })();
  const configured = () => !localBlocked && Boolean(config.url && config.anonKey);
  const getConfig = () => ({ url: config.url || '', anonKey: config.anonKey || '' });
  const saveConfig = (url, anonKey) => {
    const cleanUrl = String(url).trim().replace(/\/$/, '').replace(/\.supabase\.com$/i, '.supabase.co');
    const cleanKey = String(anonKey).trim();
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cleanUrl) || cleanKey.length < 40) throw new Error('INVALID_CONFIG');
    config = { ...config, url: cleanUrl, anonKey: cleanKey };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ url: cleanUrl, anonKey: cleanKey }));
  };
  const random = length => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return [...bytes].map(x => alphabet[x % alphabet.length]).join('');
  };
  async function rpc(name, body, { retryNetwork = false } = {}) {
    if (localBlocked) throw new Error('SUPABASE_LOCALE_BLOCCATO');
    if (!configured()) throw new Error('SUPABASE_NOT_CONFIGURED');
    const request = () => fetch(`${config.url.replace(/\/$/, '')}/rest/v1/rpc/${name}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    let response;
    try { response = await request(); }
    catch (firstError) {
      if (!retryNetwork) throw new Error('SUPABASE_NETWORK_UNAVAILABLE', { cause: firstError });
      await new Promise(resolve => setTimeout(resolve, 250));
      try { response = await request(); }
      catch { throw new Error('SUPABASE_NETWORK_UNAVAILABLE', { cause: firstError }); }
    }
    if (!response.ok) { const detail = await response.text(); throw new Error(`SUPABASE_${response.status}_${detail}`); }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
  const newAccess = () => ({ code: random(6), ownerToken: `${random(16)}${random(16)}` });
  async function create(state) {
    const {code,ownerToken}=newAccess();
    await rpc('create_amerikano_game', { p_code: code, p_owner_token: ownerToken, p_state: state });
    return { code, ownerToken };
  }
  const update = (access, state) => rpc('update_amerikano_game', { p_code: access.code, p_owner_token: access.ownerToken, p_state: state });
  let upsertV2Missing = false;
  const isMissingFunction = e => /SUPABASE_404_|PGRST202|Could not find the function/.test(String(e?.message || ''));
  async function upsert(access, state) {
    const body = { p_code: access.code, p_owner_token: access.ownerToken, p_state: state };
    if (!upsertV2Missing) {
      try { return await rpc('upsert_amerikano_game_v2', body); }
      catch (e) { if (!isMissingFunction(e)) throw e; upsertV2Missing = true; }
    }
    return rpc('upsert_amerikano_game', body);
  }
  const listCompleted = async () => { try { const rows = await rpc('list_amerikano_completed_games', {}, { retryNetwork: true }); return Array.isArray(rows) ? rows : null; } catch { return null; } };
  const ping = async () => { await rpc('get_active_amerikano_game', {}, { retryNetwork: true }); return true; };
  const deleteOwned = access => rpc('delete_amerikano_game_as_owner', { p_code: access.code, p_owner_token: access.ownerToken });
  const listOpen = async () => {
    try { const rows = await rpc('list_amerikano_open_games', {}, { retryNetwork: true }); return Array.isArray(rows) ? rows : []; }
    catch (e) { if (!/SUPABASE_404_|PGRST202|Could not find the function/.test(String(e?.message || ''))) return null; const one = await active(); return one ? [one] : []; }
  };
  const active = async () => { try { const rows = await rpc('get_active_amerikano_game', {}, { retryNetwork: true }); return Array.isArray(rows) ? rows[0] || null : null; } catch { return null; } };
  const listOwnerGames = ownerToken => rpc('list_amerikano_owner_games', { p_owner_token: ownerToken }, { retryNetwork: true });
  const deleteGame = access => rpc('delete_amerikano_game', { p_code: access.code, p_owner_token: access.ownerToken });
  async function read(code) { const result = await rpc('get_amerikano_game', { p_code: String(code).toUpperCase() }, { retryNetwork: true }); return Array.isArray(result) ? result[0] : result; }
  async function room(code) { const result = await rpc('get_amerikano_room', { p_code: String(code).toUpperCase() }, { retryNetwork: true }); return Array.isArray(result) ? result[0] : result; }
  async function claim(code, playerIndex) {
    const playerToken = `${random(16)}${random(16)}`;
    const ok = await rpc('claim_amerikano_player', { p_code: code, p_player_index: playerIndex, p_player_token: playerToken });
    if (!ok) throw new Error('PLAYER_ALREADY_CLAIMED');
    return { code, playerIndex, playerToken };
  }
  const chooseContract = (session, contract, double15=false) => rpc('choose_amerikano_contract', { p_code: session.code, p_player_token: session.playerToken, p_contract: contract, p_double15: double15 });
  const submitScore = (session, points, infractions, discardTakes, winner) => rpc('submit_amerikano_score', { p_code: session.code, p_player_token: session.playerToken, p_points: points, p_infractions: infractions, p_discard_takes: discardTakes, p_winner: winner });
  const approve = session => rpc('approve_amerikano_round', { p_code: session.code, p_player_token: session.playerToken });
  const setJokerClose = (access, jokerClose) => rpc('set_amerikano_round_joker_close', { p_code: access.code, p_owner_token: access.ownerToken, p_joker_close: Boolean(jokerClose) });
  const resetRound = access => rpc('reset_amerikano_round', { p_code: access.code, p_owner_token: access.ownerToken });
  const releasePlayer = (access, playerIndex) => rpc('release_amerikano_player', { p_code: access.code, p_owner_token: access.ownerToken, p_player_index: playerIndex });
  function gameUrl(code, spectator=false) {
    const base = config.siteUrl || `${location.origin}${location.pathname}`;
    const url = new URL(base);
    url.searchParams.set('game', code); url.searchParams.set(spectator ? 'view' : 'join', '1');
    url.searchParams.set('sb', config.url); url.searchParams.set('key', config.anonKey);
    return url.toString();
  }
  function shareText(text) {
    if (window.AndroidShare?.shareText) return window.AndroidShare.shareText('Partita Amerikano', text);
    if (navigator.share) return navigator.share({ title: 'Partita Amerikano', text }).catch(() => {});
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }
  const submitScoreAsOwner = (access, playerIndex, points, infractions, discardTakes, winner) => rpc('submit_amerikano_score_as_owner', { p_code: access.code, p_owner_token: access.ownerToken, p_player_index: playerIndex, p_points: points, p_infractions: infractions, p_discard_takes: discardTakes, p_winner: winner });
  const approveAsOwner = access => rpc('approve_amerikano_round_as_owner', { p_code: access.code, p_owner_token: access.ownerToken });
  window.ShareService = { listOpen, localBlocked: () => localBlocked, ping, deleteOwned, listCompleted, active, submitScoreAsOwner, approveAsOwner, configured, getConfig, saveConfig, newAccess, create, update, upsert, listOwnerGames, deleteGame, read, room, claim, chooseContract, submitScore, approve, setJokerClose, resetRound, releasePlayer, gameUrl, shareText };
})();

