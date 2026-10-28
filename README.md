# NetMesh Beta 0.3 — GitHub Pages + Supabase

Interface noire, vert néon et bleu électrique, adaptée au mobile. Le frontend utilise le projet Supabase Netanalyse et uniquement sa clé publishable.

## Fonctionnalités exécutées réellement par le serveur
- Authentification Supabase (inscription, connexion, déconnexion).
- Résolution DNS publique A et AAAA via DNS-over-HTTPS Cloudflare.
- Vérification HTTPS GET côté Edge Function, mesure de latence et code HTTP.
- Suivi limité à 3 redirections HTTPS; les redirections vers HTTP sont bloquées. Chaque nom d’hôte de la chaîne est validé et vérifié contre des plages IP privées/réservées avant la requête.
- Contrôle de présence de cinq en-têtes : HSTS, CSP, X-Content-Type-Options, X-Frame-Options et Referrer-Policy.
- Historique Supabase, recherche, filtres, copie du résultat et export CSV.

## Limites honnêtes
- Ce n’est pas un ping ICMP, un scan de ports, une mesure depuis le téléphone, un réseau mondial de sondes ni un audit complet.
- Une réponse HTTPS réussie confirme qu’une connexion TLS a pu aboutir, mais cette fonction ne lit pas l’émetteur ni la date d’expiration du certificat.
- La vérification DNS et la protection SSRF sont des protections en couches, pas une garantie absolue contre toutes les attaques DNS rebinding dans un environnement où le runtime ne permet pas d’épingler l’adresse IP de la connexion. N’expose pas le service à grande échelle sans revue de sécurité et quotas côté serveur.
- Les en-têtes absents ne prouvent pas à eux seuls qu’un site est vulnérable.

## Déploiement depuis Android

### 1. Appliquer la migration SQL
1. Ouvre https://supabase.com/dashboard/project/lisiwlfjxdglqisephfv/sql/new
2. Ouvre `supabase/migrations/202610280001_netmesh_beta03.sql` dans le ZIP et copie tout son contenu dans l’éditeur SQL.
3. Appuie sur **Run**. Cette migration ajoute les colonnes DNS, URL finale, état HTTPS, en-têtes et redirections. Elle ne supprime aucune ligne.

### 2. Mettre à jour la fonction Edge
1. Dans Supabase, ouvre **Edge Functions** puis la fonction `netmesh-check`.
2. Ouvre le fichier `supabase/functions/netmesh-check/index.ts` dans le ZIP.
3. Remplace le code de la fonction par le contenu de ce fichier et déploie.
4. Vérifie que **Verify JWT** reste activé. La fonction valide également l’utilisateur et ne doit pas être ouverte anonymement.
5. Ne copie jamais `SUPABASE_SERVICE_ROLE_KEY` dans les fichiers du site. Supabase fournit cette clé comme secret côté fonction; si l’éditeur demande des secrets, conserve les valeurs de projet déjà configurées.

### 3. Publier le frontend
1. Décompresse le ZIP.
2. Dans ton dépôt GitHub `Netmesh`, remplace `index.html`, `styles.css`, `app.js` et `README.md` par les nouveaux fichiers.
3. Fais **Commit changes** et attends le déploiement GitHub Pages.
4. Recharge https://hometvmeso-debug.github.io/Netmesh/

## Tests conseillés
1. Connecte-toi avec ton compte NetMesh.
2. Teste `example.com`, puis `cloudflare.com`.
3. Pour un domaine public normal, vérifie que DNS A/AAAA, code HTTP et latence apparaissent. Certains domaines peuvent n’avoir qu’un type d’enregistrement DNS.
4. Vérifie **Table Editor → diagnostic_runs** : les nouvelles colonnes doivent être remplies.
5. Teste l’export CSV et la recherche d’historique.
6. Les domaines locaux, IP privées, redirections HTTP et chaînes trop longues doivent être refusés.

## Sécurité Supabase
- RLS doit rester activé sur `public.diagnostic_runs`; chaque utilisateur ne doit lire que ses propres lignes.
- Le navigateur ne contient que la clé publishable `sb_publishable_…`.
- La fonction doit garder `verify_jwt` activé et utiliser la clé service role uniquement côté serveur pour enregistrer les résultats.
- Avant d’ouvrir l’usage à beaucoup de personnes, ajoute des quotas/rate limits et fais relire la fonction contre SSRF/DNS rebinding.
