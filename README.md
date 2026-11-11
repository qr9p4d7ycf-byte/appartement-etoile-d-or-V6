# Chalet l’étoile d’or — site

1. **Publier** : déposez tout ce dossier dans votre dépôt GitHub, puis *Settings → Pages → Deploy from a branch → main / root*.
2. **Contenu** : tout (textes FR/EN/DE, ordre des sections, thèmes, WhatsApp, e-mail) est dans `content.json`.
   - Réordonner/retirer une section : modifiez la liste `"sections"`.
   - Changer de style : `"defaultTheme"` (`or`, `glace`, `ivoire`) ou ajoutez un thème dans `"themes"`.
   - Photos : ajoutez vos images dans `photos/` avec les noms indiqués dans `"photos"` (jpg).
   - Avis : ajoutez des entrées dans `"reviews"` ; la section se masque si la liste est vide.
3. **Calendrier Airbnb** : Airbnb → Calendrier → *Disponibilité → Synchroniser → Exporter le calendrier*, copiez le lien.
   Dans GitHub : *Settings → Secrets and variables → Actions → New secret* nommé `ICAL_URL`. Le lien reste privé ; seules les dates occupées sont publiées. Lancez l’action une fois à la main (onglet *Actions*).
4. **Formulaire** : créez un formulaire gratuit sur formspree.io et collez son adresse dans `"formEndpoint"`. Sans cela, le formulaire ouvre l’application mail.

5. **Administration** : ouvrez `https://VOTRE-SITE/admin.html`, saisissez le dépôt, une clé d’accès GitHub (Contents : Read and write, limitée à ce dépôt) et choisissez un code. Ensuite, seul le code est demandé sur cet appareil.

6. **Calendriers Airbnb / Booking** : depuis `admin.html` → onglet *Calendriers*. Collez le lien iCal de chaque plateforme : il est enregistré comme secret GitHub (jamais visible). La clé d’accès GitHub doit avoir les droits *Contents*, *Secrets* et *Actions* en *Read and write*.
7. **Tarifs** : onglet *Tarifs* (prix de base, périodes, séjour minimum, réductions). Le site affiche les tarifs et une estimation du total quand le visiteur choisit ses dates.

8. **Réservations** (demandes sans paiement, e-mail + page admin) :
   1. Créez une feuille Google Sheets vide, puis *Extensions → Apps Script*.
   2. Collez tout le contenu de `backend/booking-backend.gs`, puis modifiez `OWNER_EMAIL` et `ADMIN_KEY` (ne mettez JAMAIS votre vraie clé dans le dépôt GitHub : modifiez-la seulement dans Apps Script).
   3. *Déployer → Nouveau déploiement → Application Web*, exécuter en tant que **Moi**, accès : **Tout le monde**. Autorisez l'accès à Gmail et à la feuille, puis copiez l'adresse se terminant par `/exec`.
   4. Dans `admin.html` → onglet *Infos* : collez cette adresse dans « Adresse du service de réservation », Enregistrer. Puis onglet *Réservations* : saisissez votre `ADMIN_KEY`.
   5. Après toute modification du script, refaites *Déployer → Gérer les déploiements → Modifier → Nouvelle version*.

9. **Codes promo et e-mails automatiques** : après avoir collé le nouveau `booking-backend.gs` dans Apps Script, faites *Déployer → Gérer les déploiements → Modifier → Nouvelle version*, puis autorisez les nouvelles permissions (exécutez une fonction depuis l'éditeur si Google le demande). Dans l'admin : onglet *Codes promo* (création) et onglet *E-mails auto* (règles, puis bouton « Activer l'envoi automatique quotidien »).

10. **Statistiques** : redéployez le nouveau `booking-backend.gs`, puis lancez une synchronisation des calendriers (onglet *Calendriers*) pour enregistrer les séjours par plateforme. Onglet *Statistiques* : vues, parcours des visiteurs, occupation et chiffre d'affaires (estimé d'après vos tarifs, ou saisi à la main). Électricité : onglet *Tarifs*.
