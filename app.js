/* NetMesh Beta 0.3 — frontend statique. Ne jamais placer une clé service_role dans ce fichier. */
(() => {
  const SUPABASE_URL = "https://lisiwlfjxdglqisephfv.supabase.co";
  const SUPABASE_KEY = "sb_publishable_PPbnLZwRcNVxmh32odZPdg_qBVzkuIy";
  const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/netmesh-check`;
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const $ = (id) => document.getElementById(id);
  const authPanel = $("authPanel"), dashboard = $("dashboard"), logoutBtn = $("logoutBtn");
  const authMessage = $("authMessage"), historyMessage = $("historyMessage");
  let busy = false, cachedRows = [];
  function message(el, text, type = "") { el.textContent = text; el.className = `message ${type}`.trim(); }
  function setBusy(button, on, label) {
    button.disabled = on;
    if (on) { button.dataset.originalText = button.textContent; button.textContent = label; }
    else if (button.dataset.originalText) button.textContent = button.dataset.originalText;
  }
  function niceDate(value) { try { return new Date(value).toLocaleString("fr-FR", {dateStyle:"short",timeStyle:"short"}); } catch { return value || "—"; } }
  function outcomeLabel(outcome, status) {
    if (outcome === "success") return `RÉPONSE HTTP ${status ?? "OK"}`;
    if (outcome === "http_error") return `HTTP ${status || "ERREUR"}`;
    if (outcome === "timeout") return "DÉLAI DÉPASSÉ";
    if (outcome === "dns_error") return "ERREUR DNS";
    if (outcome === "tls_error") return "ERREUR HTTPS/TLS";
    return "ÉCHEC RÉSEAU";
  }
  function addDetail(parent, label, value) {
    const item = document.createElement("div"); item.className = "nm-detail";
    const l = document.createElement("span"); l.className = "nm-detail-label"; l.textContent = label;
    const v = document.createElement("strong"); v.textContent = value == null || value === "" ? "—" : String(value);
    item.append(l, v); parent.append(item);
  }
  function showResult(r) {
    const box = $("resultBox"); box.classList.remove("hidden"); box.replaceChildren();
    const heading = document.createElement("div"); heading.className = "result-heading";
    const host = document.createElement("span"); host.className = "result-host"; host.textContent = r.target_host || "Cible";
    const state = document.createElement("span"); state.className = `result-state ${r.outcome === "success" ? "" : "bad"}`; state.textContent = outcomeLabel(r.outcome, r.http_status);
    heading.append(host, state); box.append(heading);
    const details = document.createElement("div"); details.className = "result-details";
    addDetail(details, "LATENCE", r.duration_ms == null ? "—" : `${r.duration_ms} ms`);
    addDetail(details, "HTTP", r.http_status ?? "—");
    addDetail(details, "DNS A", (r.dns_a || []).join(", ") || "Aucun résultat");
    addDetail(details, "DNS AAAA", (r.dns_aaaa || []).join(", ") || "Aucun résultat");
    addDetail(details, "URL finale", r.final_url || "—");
    addDetail(details, "REDIRECTIONS", (r.redirect_chain || []).join(" | ") || "Aucune");
    addDetail(details, "HTTPS", r.https_ok ? "Connexion validée" : "Non confirmé");
    box.append(details);
    const security = document.createElement("div"); security.className = "nm-security";
    const securityTitle = document.createElement("strong"); securityTitle.textContent = "EN-TÊTES DE SÉCURITÉ"; security.append(securityTitle);
    const headers = r.security_headers || {};
    const headerNames = {"strict-transport-security":"HSTS", "content-security-policy":"CSP", "x-content-type-options":"X-Content-Type-Options", "x-frame-options":"X-Frame-Options", "referrer-policy":"Referrer-Policy"};
    Object.entries(headerNames).forEach(([key,label]) => {
      const line = document.createElement("div"); line.className = "nm-header-line";
      const name = document.createElement("span"); name.textContent = label;
      const value = document.createElement("b"); value.textContent = headers[key] ? "PRÉSENT" : "ABSENT"; value.className = headers[key] ? "nm-present" : "nm-missing";
      line.append(name, value); security.append(line);
    });
    const note = document.createElement("p"); note.className = "helper"; note.textContent = "Le contrôle des en-têtes est indicatif : un en-tête absent ne prouve pas à lui seul qu’un site est vulnérable. La date d’expiration du certificat n’est pas lue par ce test."; security.append(note); box.append(security);
    const actions = document.createElement("div"); actions.className = "result-actions";
    const copy = document.createElement("button"); copy.type = "button"; copy.className = "btn btn-outline btn-small"; copy.textContent = "Copier le résultat";
    copy.addEventListener("click", async () => {
      const summary = [`NetMesh — ${r.target_host}`, `HTTP: ${r.http_status ?? "—"}`, `Latence: ${r.duration_ms ?? "—"} ms`, `DNS A: ${(r.dns_a || []).join(", ") || "—"}`, `DNS AAAA: ${(r.dns_aaaa || []).join(", ") || "—"}`, `URL finale: ${r.final_url || "—"}`, `HTTPS: ${r.https_ok ? "validé" : "non confirmé"}`, `Date: ${niceDate(r.checked_at)}`].join("\n");
      try { await navigator.clipboard.writeText(summary); message(historyMessage, "Résultat copié.", "success"); }
      catch { message(historyMessage, summary, ""); }
    }); actions.append(copy); box.append(actions);
  }
  async function enterDashboard(user) {
    authPanel.classList.add("hidden"); dashboard.classList.remove("hidden"); logoutBtn.classList.remove("hidden");
    $("userLabel").textContent = (user.email || "OPERATOR").toUpperCase(); $("authStatus").textContent = "● ACTIVE"; await loadHistory();
  }
  function leaveDashboard() {
    dashboard.classList.add("hidden"); authPanel.classList.remove("hidden"); logoutBtn.classList.add("hidden");
    $("historyBody").innerHTML = '<tr><td colspan="4" class="empty">Connecte-toi pour afficher ton historique.</td></tr>';
    $("metricTotal").textContent = "—"; $("metricLatency").innerHTML = "—<small> ms</small>"; $("metricStatus").textContent = "—";
  }
  async function refreshSession() { const {data:{session}} = await client.auth.getSession(); if (session?.user) await enterDashboard(session.user); else leaveDashboard(); }
  $("authForm").addEventListener("submit", async (e) => {
    e.preventDefault(); if (busy) return; busy = true; const button = $("loginBtn"); setBusy(button,true,"Connexion…"); message(authMessage,"");
    try { const {data,error} = await client.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value}); if(error) message(authMessage,error.message,"error"); else {message(authMessage,"Connexion réussie.","success"); await enterDashboard(data.user);} }
    catch(err){message(authMessage,err.message || "Erreur de connexion.","error");} finally {setBusy(button,false);busy=false;}
  });
  $("signupBtn").addEventListener("click", async () => {
    if (busy) return; const email = $("email").value.trim(), password = $("password").value;
    if (!email || password.length < 8) { message(authMessage,"Entre un e-mail valide et un mot de passe d'au moins 8 caractères.","error"); return; }
    busy=true; setBusy($("signupBtn"),true,"Création…"); message(authMessage,"");
    try { const {data,error}=await client.auth.signUp({email,password}); if(error) message(authMessage,error.message,"error"); else if(data.session&&data.user){message(authMessage,"Compte créé. Tu es connecté.","success");await enterDashboard(data.user);} else message(authMessage,"Compte créé. Vérifie ta boîte e-mail si la confirmation est activée, puis connecte-toi.","success"); }
    catch(err){message(authMessage,err.message || "Erreur de création de compte.","error");} finally {setBusy($("signupBtn"),false);busy=false;}
  });
  logoutBtn.addEventListener("click", async()=>{await client.auth.signOut();leaveDashboard();message(authMessage,"Tu es déconnecté.","success");});
  $("exampleBtn").addEventListener("click",()=>{$("host").value="example.com";});
  document.querySelectorAll("[data-host]").forEach(b=>b.addEventListener("click",()=>{$("host").value=b.dataset.host;$("host").focus();}));
  $("checkForm").addEventListener("submit",async(e)=>{
    e.preventDefault(); if(busy)return; const host=$("host").value.trim(); if(!host)return; busy=true;setBusy($("checkBtn"),true,"Analyse DNS + HTTPS…");
    const {data:{session}}=await client.auth.getSession(); if(!session){message(historyMessage,"Session expirée. Reconnecte-toi.","error");setBusy($("checkBtn"),false);busy=false;leaveDashboard();return;}
    const box=$("resultBox");box.classList.remove("hidden");box.textContent="Vérification DNS et HTTPS depuis le serveur NetMesh…";
    try { const response=await fetch(FUNCTION_URL,{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY,"Authorization":`Bearer ${session.access_token}`},body:JSON.stringify({host})}); const payload=await response.json().catch(()=>({})); if(!response.ok)throw new Error(payload.error||`Erreur serveur (${response.status}).`); if(!payload.result)throw new Error("Réponse inattendue du serveur."); showResult(payload.result);message(historyMessage,"Diagnostic terminé. Historique actualisé.","success");await loadHistory(); }
    catch(err){box.classList.add("hidden");message(historyMessage,err.message||"Impossible de joindre le moteur NetMesh.","error");} finally {setBusy($("checkBtn"),false);busy=false;}
  });
  async function loadHistory(){
    message(historyMessage,"");const {data:{session}}=await client.auth.getSession();if(!session)return;
    const {data,error}=await client.from("diagnostic_runs").select("id,target_host,http_status,duration_ms,outcome,error_message,checked_at,dns_a,dns_aaaa,final_url,https_ok,security_headers").order("checked_at",{ascending:false}).limit(50);
    if(error){const fallback=await client.from("diagnostic_runs").select("id,target_host,http_status,duration_ms,outcome,error_message,checked_at").order("checked_at",{ascending:false}).limit(50);if(fallback.error){$("historyBody").innerHTML='<tr><td colspan="4" class="empty">Historique indisponible.</td></tr>';message(historyMessage,"Impossible de charger l'historique. Vérifie la migration SQL et les politiques RLS.","error");return;} cachedRows=fallback.data||[];}
    else cachedRows=data||[];
    $("metricTotal").textContent=cachedRows.length>=50?"50+":String(cachedRows.length);const last=cachedRows[0];$("metricLatency").innerHTML=last?.duration_ms==null?"—<small> ms</small>":`${last.duration_ms}<small> ms</small>`;$("metricStatus").textContent=last?(last.http_status||outcomeLabel(last.outcome)):"—";renderHistory();
  }
  function renderHistory(){const query=($("historySearch")?.value||"").trim().toLowerCase(),filter=$("historyFilter")?.value||"all";const rows=cachedRows.filter(r=>{const q=(r.target_host||"").toLowerCase().includes(query),c=Number(r.http_status||0);return q&&(filter==="all"||(filter==="success"&&c>=200&&c<300)||(filter==="redirect"&&c>=300&&c<400)||(filter==="error"&&c>=400));});if(!rows.length){$("historyBody").innerHTML='<tr><td colspan="4" class="empty">Aucun résultat pour ce filtre.</td></tr>';return;}$("historyBody").replaceChildren(...rows.map(r=>{const tr=document.createElement("tr");[r.target_host,outcomeLabel(r.outcome,r.http_status),r.duration_ms==null?"—":`${r.duration_ms} ms`,niceDate(r.checked_at)].forEach((value,i)=>{const td=document.createElement("td");if(i===1){const span=document.createElement("span");span.className=`state ${r.outcome==="success"?"":"bad"}`;span.textContent=value;td.append(span);}else td.textContent=value;tr.append(td);});return tr;}));}
  $("refreshBtn").addEventListener("click",loadHistory);$("historySearch").addEventListener("input",renderHistory);$("historyFilter").addEventListener("change",renderHistory);
  $("exportBtn").addEventListener("click",()=>{if(!cachedRows.length){message(historyMessage,"Aucun diagnostic à exporter.","error");return;}const headers=["domaine","résultat","code_http","latence_ms","dns_a","dns_aaaa","url_finale","https_ok","date_utc"],cell=v=>'"'+String(v??"").replace(/"/g,'""')+'"';const csv=[headers,...cachedRows.map(r=>[r.target_host,outcomeLabel(r.outcome,r.http_status),r.http_status,r.duration_ms,(r.dns_a||[]).join(" "),(r.dns_aaaa||[]).join(" "),r.final_url,r.https_ok,r.checked_at])].map(row=>row.map(cell).join(";")).join("\r\n");const blob=new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="netmesh-diagnostics.csv";a.click();URL.revokeObjectURL(url);message(historyMessage,"Export CSV préparé.","success");});
  client.auth.onAuthStateChange((_event,session)=>{if(session?.user)enterDashboard(session.user);else leaveDashboard();});refreshSession();
})();
