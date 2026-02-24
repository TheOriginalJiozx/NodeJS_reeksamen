export async function collectSessionIdsForUsername(username) {
  const store = global.sessionStore;
  if (!store || typeof store.all !== "function") return [];
  // spørgsmål: hvorfor bruger vi en Promise her?
  // Vi bruger en Promise her for at gøre den callback-baserede sessionStore.all-metode kompatibel med async/await-syntaksen.
  // sessionStore.all forventer en callback-funktion, der kaldes med resultatet,
  // men ved at indpakke det i en Promise kan vi bruge await for at vente på resultatet,
  // hvilket gør koden mere læsbar og lettere at håndtere i tilfælde af fejl.
  return new Promise((resolve) => {
    store.all((error, sessions) => {
      if (error) return resolve([]);
      const ids = [];
      if (Array.isArray(sessions)) {
        for (const item of sessions) {
          const sessionId = item.session_id || item.id || item.key;
          const session = item.session || item.data || item;
          if (sessionId && session?.user?.username === username) ids.push(sessionId);
        }
      } else if (sessions && typeof sessions === "object") {
        for (const sessionId of Object.keys(sessions)) {
          if (sessions[sessionId]?.user?.username === username) ids.push(sessionId);
        }
      }
      resolve(ids);
    });
  });
}

export async function destroySessionIds(ids) {
  if (!ids.length) return;
  const store = global.sessionStore;
  if (!store || typeof store.destroy !== "function") return;
  // spørgsmål: hvorfor bruger vi Promise.all her?
  // Vi bruger Promise.all her for at køre flere asynkrone operationer parallelt og vente på, at de alle er færdige.
  // I dette tilfælde vil vi gerne ødelægge alle sessioner for en bruger samtidig, og ved at bruge Promise.all kan vi starte alle destroy-operationerne på samme tid,
  // hvilket kan være hurtigere end at vente på den første, før vi starter den anden.
  await Promise.all(ids.map((id) => new Promise((resource) => store.destroy(id, () => resource()))));
}
