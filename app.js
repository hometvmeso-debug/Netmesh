/* NetMesh front-end. La clé publishable/anon est prévue pour le navigateur; ne jamais y mettre une clé service_role. */
(() => {
  const SUPABASE_URL = "https://lisiwlfjxdglqisephfv.supabase.co";
  const SUPABASE_KEY = "sb_publishable_PPbnLZwRcNVxmh32odZPdg_qBVzkuIy";
  const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/netmesh-check`;
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const $ = (id) => document.getElementById(id);
  const authPanel = $("authPanel"), dashboard = $("dashboard"), logoutBtn = $("logoutBtn");
  const authMessage = $("authMessage"), historyMessage = $("historyMessage");
  let busy = false;

  function message(el, text, type = "") {
    el.textContent = text;
    el.className = `message ${type}`.trim();
  }
  function setBusy(button, on, label) {
    button.disabled = on;
    if (on) { button.dataset.originalText = button.textContent; button.textContent = label; }
    else if (button.dataset.originalText) button.textContent = button.dataset.originalText;
  }
  function niceDate(value) {
    try { return new Date(value).toLocaleString("fr-FR", { dateStyle:"short", timeStyle:"short" }); }
    catch { return value || "—"; }
  }
  function outcomeLabel(outcome, status) {
    if (outcome === "success") return `OK${status ? ` · ${status}` : ""}`;
    if (outcome === "http_error") return `HTTP ${status || "ERREUR"}`;
    if (outcome === "timeout") return "TIMEOUT";
    if (outcome === "dns_error") return "ERREUR DNS";
    if (outcome === "tls_error") return "ERREUR TLS";
    return "ÉCHEC RÉSEAU";
  }
  function showResult(r) {
    const box = $("resultBox");
    box.classList.remove("hidden");
    const ok = r.outcome === "success";
    box.innerHTML = `
      <div class="result-heading"><span class="result-host"></span><span class="result-state ${ok ? "" : "bad"}">${outcomeLabel(r.outcome, r.http_status)}</span></div>
      <div class="result-details"><span>LATENCE&nbsp; <b>${r.duration_ms == null ? "—" : `${r.duration_ms} ms`}</b></span><span>HTTP&nbsp; <b>${r.http_status ?? "—"}</b></span><span>HEURE&nbsp; <b>${niceDate(r.checked_at)}</b></span></div>
      ${r.error_message ? `<p class="helper"></p>` : ""}`;
    box.querySelector(".result-host").textContent = r.target_host || "Cible";
    if (r.error_message) box.querySelector(".helper").textContent = r.error_message;
  }
  async function refreshSession() {
    const { data: { session } } = await client.auth.getSession();
    if (session?.user) await enterDashboard(session.user);
    else leaveDashboard();
  }
  async function enterDashboard(user) {
    authPanel.classList.add("hidden");
    dashboard.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
    $("userLabel").textContent = (user.email || "OPERATOR").toUpperCase();
    $("authStatus").textContent = "● ACTIVE";
    await loadHistory();
  }
  function leaveDashboard() {
    dashboard.classList.add("hidden");
    authPanel.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
    $("historyBody").innerHTML = '<tr><td colspan="4" class="empty">Connecte-toi pour afficher ton historique.</td></tr>';
    $("metricTotal").textContent = "—";
    $("metricLatency").innerHTML = "—<small> ms</small>";
    $("metricStatus").textContent = "—";
  }
  $("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    busy = true;
    const button = $("loginBtn"); setBusy(button, true, "Connexion…");
    message(authMessage, "");
    const email = $("email").value.trim(), password = $("password").value;
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) message(authMessage, error.message, "error");
    else { message(authMessage, "Connexion réussie.", "success"); await enterDashboard(data.user); }
    setBusy(button, false); busy = false;
  });
  $("signupBtn").addEventListener("click", async () => {
    if (busy) return;
    const email = $("email").value.trim(), password = $("password").value;
    if (!email || password.length < 6) {
      message(authMessage, "Entre un e-mail valide et un mot de passe d'au moins 6 caractères.", "error"); return;
    }
    busy = true; setBusy($("signupBtn"), true, "Création…"); message(authMessage, "");
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) message(authMessage, error.message, "error");
    else if (data.session && data.user) {
      message(authMessage, "Compte créé. Tu es connecté.", "success"); await enterDashboard(data.user);
    } else {
      message(authMessage, "Compte créé. Vérifie ta boîte e-mail si la confirmation est activée, puis connecte-toi.", "success");
    }
    setBusy($("signupBtn"), false); busy = false;
  });
  logoutBtn.addEventListener("click", async () => {
    await client.auth.signOut();
    leaveDashboard();
    message(authMessage, "Tu es déconnecté.", "success");
  });
  $("exampleBtn").addEventListener("click", () => { $("host").value = "example.com"; });
  $("checkForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    const host = $("host").value.trim();
    if (!host) return;
    busy = true; setBusy($("checkBtn"), true, "Analyse…");
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
      message(historyMessage, "Session expirée. Reconnecte-toi.", "error");
      setBusy($("checkBtn"), false); busy = false; leaveDashboard(); return;
    }
    const box = $("resultBox"); box.classList.remove("hidden");
    box.textContent = "Connexion au moteur NetMesh…";
    try {
      const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({ host })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Erreur serveur (${response.status}).`);
      if (!payload.result) throw new Error("Réponse inattendue du serveur.");
      showResult(payload.result);
      message(historyMessage, "Diagnostic terminé. Historique actualisé.", "success");
      await loadHistory();
    } catch (err) {
      box.classList.add("hidden");
      message(historyMessage, err.message || "Impossible de joindre le moteur NetMesh.", "error");
    } finally {
      setBusy($("checkBtn"), false); busy = false;
    }
  });
  async function loadHistory() {
    message(historyMessage, "");
    const { data: { session } } = await client.auth.getSession();
    if (!session) return;
    const { data, error } = await client.from("diagnostic_runs")
      .select("id,target_host,http_status,duration_ms,outcome,error_message,checked_at")
      .order("checked_at", { ascending: false }).limit(12);
    if (error) {
      $("historyBody").innerHTML = '<tr><td colspan="4" class="empty">Historique indisponible pour le moment.</td></tr>';
      message(historyMessage, "Impossible de charger l'historique. Vérifie les politiques RLS Supabase.", "error");
      return;
    }
    const rows = data || [];
    $("metricTotal").textContent = rows.length >= 12 ? "12+" : String(rows.length);
    const last = rows[0];
    $("metricLatency").innerHTML = last?.duration_ms == null ? "—<small> ms</small>" : `${last.duration_ms}<small> ms</small>`;
    $("metricStatus").textContent = last ? (last.http_status || outcomeLabel(last.outcome)) : "—";
    if (!rows.length) {
      $("historyBody").innerHTML = '<tr><td colspan="4" class="empty">Aucun diagnostic pour le moment. Lance ton premier test.</td></tr>'; return;
    }
    $("historyBody").replaceChildren(...rows.map((r) => {
      const tr = document.createElement("tr");
      const vals = [r.target_host, outcomeLabel(r.outcome, r.http_status), r.duration_ms == null ? "—" : `${r.duration_ms} ms`, niceDate(r.checked_at)];
      vals.forEach((value, i) => {
        const td = document.createElement("td");
        if (i === 1) { const span = document.createElement("span"); span.className = `state ${r.outcome === "success" ? "" : "bad"}`; span.textContent = value; td.append(span); }
        else td.textContent = value;
        tr.append(td);
      });
      return tr;
    }));
  }
  $("refreshBtn").addEventListener("click", loadHistory);
  client.auth.onAuthStateChange((_event, session) => {
    if (session?.user) enterDashboard(session.user);
    else leaveDashboard();
  });
  refreshSession();
})();
