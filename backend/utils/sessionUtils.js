async function collectSessionIdsForUsername(sessionStore, username) {
  const store = sessionStore;
  if (!store || typeof store.all !== "function") return [];
  return new Promise((resolve) => {
    store.all((error, sessions) => {
      if (error) return resolve([]);
      const ids = [];
      if (Array.isArray(sessions)) {
        for (const item of sessions) {
          const sessionId = item.session_id || item.id || item.key;
          const session = item.session || item.data || item;
          if (sessionId && session?.user?.username === username)
            ids.push(sessionId);
        }
      } else if (sessions && typeof sessions === "object") {
        for (const sessionId of Object.keys(sessions)) {
          if (sessions[sessionId]?.user?.username === username)
            ids.push(sessionId);
        }
      }
      resolve(ids);
    });
  });
}

async function destroySessionIds(sessionStore, ids) {
  if (!ids.length) return;
  const store = sessionStore;
  if (!store || typeof store.destroy !== "function") return;
  await Promise.all(ids.map((id) => new Promise((resource) => store.destroy(id, () => resource()))));
}

export { collectSessionIdsForUsername, destroySessionIds };
