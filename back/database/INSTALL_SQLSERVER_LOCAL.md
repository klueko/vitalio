# Installer SQL Server en local (PC perso / travail, sans Docker)

Pour avoir une instance **locale** dédiée à Vitalio, indépendante des instances du travail.

---

## 1. Télécharger SQL Server

- **SQL Server Express** (gratuit, adapté au dev) :  
  https://www.microsoft.com/fr-fr/sql-server/sql-server-downloads  
  → Descendre jusqu’à **« Télécharger maintenant »** sous **Express**.
- Ou **Developer** (gratuit, toutes les fonctionnalités, usage non-production) : même page, section Developer.

Lancer l’installateur téléchargé (type **Basic** ou **Personnalisé** selon ce que vous voulez).

---

## 2. Installation (mode Basic)

1. Choisir **Installation de base** (Basic).
2. Accepter la licence et l’emplacement d’installation.
3. **À la fin de l’installation** : une fenêtre affiche des infos de connexion.
4. **Important** : noter ou définir le **mot de passe du compte `sa`** si l’installateur le demande (certains setups Basic le font à la fin). Sinon, activer le mode mixte après (étape 4).

L’instance s’appelle en général **SQLEXPRESS** (nom d’instance). Le serveur sera : **`localhost\SQLEXPRESS`** ou **`.\SQLEXPRESS`**.

---

## 3. Activer le mode mixte (authentification SQL + Windows)

Pour pouvoir vous connecter avec le compte **sa** (et que l’app Vitalio puisse s’y connecter) :

1. Ouvrir **SQL Server Management Studio** (SSMS).
2. Se connecter avec **Authentification Windows** au serveur **`localhost\SQLEXPRESS`** (ou **`.\SQLEXPRESS`**).
   - Si la connexion Windows échoue aussi : l’installateur a peut‑être ajouté uniquement votre compte ; réessayer après un redémarrage, ou utiliser **Configuration Manager** pour vérifier que l’instance est en cours d’exécution.
3. Clic droit sur le **nom du serveur** (en haut) → **Propriétés**.
4. Onglet **Sécurité** → **Mode d’authentification du serveur** : choisir **Mode d’authentification SQL Server et Windows**.
5. **OK**.
6. Redémarrer le service SQL Server :
   - `Win + R` → `services.msc` → Entrée.
   - Chercher **SQL Server (SQLEXPRESS)**.
   - Clic droit → **Redémarrer**.
7. Rouvrir SSMS, se connecter avec **Authentification SQL Server** :
   - Serveur : **`localhost\SQLEXPRESS`**
   - Connexion : **sa** + mot de passe défini à l’installation (ou réinitialisé par un admin).

---

## 4. Créer les bases Vitalio

1. Dans SSMS, connexion sur **`localhost\SQLEXPRESS`** (en **sa** ou en Windows).
2. Exécuter dans l’ordre les scripts du dossier `database/` :
   - **01_create_databases.sql**
   - **02_identity_schema.sql** (base Vitalio_Identity sélectionnée)
   - **03_medical_schema.sql** (base Vitalio_Medical sélectionnée)

---

## 5. Configurer Vitalio (.env)

Dans `vitalio/back/.env`, renseigner la chaîne de connexion pour l’instance **locale** :

```env
# SQL Server (instance locale)
MSSQL_HOST=localhost
MSSQL_PORT=1433
MSSQL_USER=sa
MSSQL_PASSWORD=votre_mot_de_passe_sa
# Instance nommée SQLEXPRESS : souvent le port est dynamique ou 1433 selon l’installation
MSSQL_DATABASE=Vitalio_Medical
```

Pour une **instance nommée** (ex. `SQLEXPRESS`), selon le driver utilisé on peut avoir besoin de :
- **Serveur** : `localhost\SQLEXPRESS` (sans port), ou
- **Serveur** : `localhost,1433` si le port est 1433.

Adapter selon la façon dont votre backend Python se connecte (pyodbc, pymssql, etc.) : soit `server=localhost\SQLEXPRESS`, soit `server=localhost;port=1433`.

---

## Résumé

| Étape | Action |
|-------|--------|
| 1 | Télécharger SQL Server Express (ou Developer) depuis le site Microsoft |
| 2 | Installer (Basic), noter le mot de passe **sa** si demandé |
| 3 | SSMS : connexion Windows sur **localhost\SQLEXPRESS** → Propriétés serveur → Mode mixte → Redémarrer le service |
| 4 | SSMS : connexion **sa** sur **localhost\SQLEXPRESS** → exécuter 01, 02, 03 |
| 5 | Renseigner **.env** (MSSQL_HOST, MSSQL_USER, MSSQL_PASSWORD, base) pour l’app Vitalio |

Votre instance locale est alors indépendante des serveurs du travail.
