# NetMesh — GitHub Pages

Frontend statique NetMesh avec thème noir, vert néon et bleu électrique, connecté au projet Supabase **Netanalyse**.

## Ce que cette version fait
- Création de compte et connexion Supabase Auth.
- Diagnostic HTTPS d'un domaine public via l'Edge Function `netmesh-check`.
- Affichage du code HTTP, de la durée de réponse et du résultat.
- Historique privé des 12 derniers diagnostics de l'utilisateur connecté.

## Limites importantes
Cette version ne réalise pas un ping ICMP, un scan de ports, une cartographie réseau ni un audit de sécurité complet. La mesure correspond au temps de réponse HTTPS observé depuis l'Edge Function Supabase, pas depuis le téléphone.
Avant de rendre le service public à grande échelle, renforce la validation des cibles côté serveur contre les scénarios SSRF et vérifie les limites d'utilisation.

## Déployer gratuitement depuis Android avec GitHub Pages
1. Ouvre https://github.com et connecte-toi ou crée un compte.
2. Appuie sur **+** puis **New repository**.
3. Nomme le dépôt `netmesh`, choisis **Public**, puis crée-le.
4. Dans le dépôt, appuie sur **Add file → Upload files** et téléverse les fichiers `index.html`, `styles.css`, `app.js` et `README.md` (décompresse d'abord le ZIP si GitHub ne te laisse pas sélectionner les fichiers individuels).
5. Ouvre **Settings → Pages**.
6. Dans **Build and deployment**, choisis **Deploy from a branch**.
7. Branche : `main` ; dossier : `/(root)` ; puis **Save**.
8. Attends la publication. L'adresse sera de la forme `https://TON-PSEUDO.github.io/netmesh/`.

## Supabase Auth
Le frontend utilise uniquement la clé **publishable** du projet Netanalyse. Ne mets jamais la clé `service_role` ou une clé secrète dans les fichiers du site.
Si la création de compte exige une confirmation e-mail, confirme l'e-mail avant la première connexion. Dans Supabase, vérifie aussi **Authentication → URL Configuration** : ajoute l'URL GitHub Pages réelle à **Site URL / Redirect URLs** si ton paramétrage Auth l'exige.

## Sécurité des données
La table `public.diagnostic_runs` doit conserver RLS activé. La politique de lecture autorise chaque utilisateur authentifié à lire uniquement ses propres lignes. Les insertions passent par l'Edge Function côté serveur.
