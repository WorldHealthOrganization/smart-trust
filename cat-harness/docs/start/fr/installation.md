---
layout: default
title: Installation
lang: fr
nav_exclude: true
translation_status: unverified
translation_source: start/installation.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# Installation
{: .no_toc }

1. TOC
{:toc}

---

> Ce qu'il faut exécuter **avant de pousser** (push), c'est
> [`platform-gates`]({{ '/reference/skill-instructions/platform-gates.html' | relative_url }}) ;
> la réussite de `bun test` ne garantit pas le passage des « gates », car leur liste est dérivée du
> workflow de CI. Si vous intégrez folio-assistant sur
> un dépôt déjà existant, lisez d'abord
> [`repo-conversion`]({{ '/reference/skill-instructions/repo-conversion.html' | relative_url }}).

## Prérequis

folio-assistant s'exécute sur [Bun](https://bun.sh) et se connecte à un agent LLM via
MCP. La plateforme elle-même n'a besoin que de Bun ; les types de contenu individuels font appel à des
chaînes d'outils plus lourdes (LaTeX, Lean, le FHIR IG Publisher) qui sont vérifiées au
moment de l'exécution et peuvent être installées à la demande.

| Prérequis | Nécessaire pour | Installation (Linux/macOS) | Installation (Windows) |
|-------------|-----------|---------|---------|
| **Bun ≥ 1.0** | le framework (toujours) | `curl -fsSL https://bun.sh/install \| bash` | `winget install Oven-sh.Bun` |
| Git + git-lfs | dépôts de contenu | `apt install git git-lfs` | `winget install Git.Git GitHub.GitLFS` |
| LaTeX (`latexmk`, `texlive`) | rendu des articles | `apt install texlive-full latexmk biber` | `winget install MiKTeX.MiKTeX` |
| Lean 4 (via `elan`) | formalisation des articles | `curl …/elan-init.sh \| sh -s -- -y` | voir les [versions d'elan](https://github.com/leanprover/elan/releases) |
| Java 21 + IG Publisher + SUSHI | IGs WHO SMART (L3) | voir le [guide WHO SMART IG](https://litlfred.github.io/folio-assistant/smart-base/guides/who-smart-ig.html) | `winget install EclipseAdoptium.Temurin.21.JDK`, puis le guide |
| `pandoc`, `ripgrep` | conversions, recherche | `apt install pandoc ripgrep` | `winget install JohnMacFarlane.Pandoc BurntSushi.ripgrep.MSVC` |

Seul Bun est requis. Chaque autre ligne est spécifique au type de contenu et fait l'objet d'une sonde au
moment de l'exécution ; n'installez donc rien d'autre tant que `check-deps` ne le demande pas.

## Cloner et installer

```sh
git clone https://github.com/litlfred/folio-assistant.git
cd folio-assistant
bun install
```

### Sur Windows, il existe un script

Sur une machine vierge disposant uniquement d'un client git, ceci installe Bun (via winget si
disponible), actualise la variable `PATH`, exécute `bun install`, puis passe le relais à la
sonde de capacités :

```powershell
git clone https://github.com/litlfred/folio-assistant.git
cd folio-assistant
.\cat-harness-tools\scripts\bootstrap.ps1 -CheckOnly   # rapport uniquement, n'installe rien
.\cat-harness-tools\scripts\bootstrap.ps1              # exécuter l'installation
```

Il installe Bun et rien d'autre — LaTeX, Lean, Java et l'IG Publisher restent
propres à chaque type de contenu, signalés par `check-deps` avec des indications d'installation.

Les scripts shell de la plateforme sont en bash. Sur Windows, ils s'exécutent sous **Git Bash**,
que [Git pour Windows](https://git-scm.com/download/win) installe, `git`
est donc le seul prérequis supplémentaire. Chaque script qu'un utilisateur exécute manuellement ou intègre dans
une configuration dispose d'un `.bat` à ses côtés — `cat-harness-tools\scripts\install-beans.bat`,
`cat-harness-tools\scripts\start-folio-assistant.bat`, `cat-harness-tools\scripts\git-hooks\install.bat`,
`cat-harness-tools\scripts\session-start-coord-sweep.bat`, etc. — qui localise Git Bash
(jamais le lanceur WSL dans `System32`) et exécute le script `.sh` jumeau avec les mêmes
arguments. Utilisez-les depuis `cmd.exe`, PowerShell, le Planificateur de tâches ou une entrée de
configuration MCP :

```bat
cat-harness-tools\scripts\install-beans.bat
cat-harness-tools\scripts\upload-to-uploads.bat https://example.org/guideline.pdf
```

Tout ce dont le script `.sh` a besoin — `bun`, `curl`, `gh`, `elan` — doit se trouver dans le
`PATH` de Windows, puisque Git Bash en hérite depuis l'appelant. Les scripts qui n'ont de sens
que sur un hôte Linux (`deploy/`, `install-tex.sh`, `setup-sage.sh`,
`setup-singular.sh`) n'ont délibérément aucun wrapper. La liste se trouve dans
`cat-harness-tools/scripts/gen-bat-wrappers.sh` ; `bun run cat bat:sync` régénère les wrappers
et `bun run cat bat:sync:check` fait échouer la CI si l'un d'eux est manquant ou obsolète.

### Sur Linux/macOS, il existe également un script

`cat-harness-tools/scripts/start-folio-assistant.sh` installe Bun s'il est manquant et
démarre ensuite le serveur, et
`cat-harness-tools/adapters/mcp-server/install.sh` est un installateur plus complet couvrant également TeX
Live.

## Vérifier votre environnement

La sonde `--check-deps` signale quelles capacités sont présentes et fournit une
indication d'installation pour tout élément manquant :

```sh
bun run cat-harness-tools/src/index.ts --check-deps
# ou via le script npm
bun run cat check-deps
```

## Lancer le serveur

folio-assistant est un serveur MCP. Il prend en charge deux modes de transport :

```sh
# transport stdio — ce que les harnais LLM (Claude Code, etc.) lancent
bun run cat-harness-tools/src/index.ts --stdio

# transport HTTP — pour une instance partagée de longue durée / l'interface web
bun run cat-harness-tools/src/index.ts --http

# pointez-le vers le dépôt de contenu que vous rédigez (valeur par défaut : ../.. )
bun run cat-harness-tools/src/index.ts --stdio --repo /path/to/your/content-repo
```

Des scripts pratiques sont disponibles dans `package.json` :

```sh
bun run cat start          # par défaut (stdio)
bun run cat start:http     # transport HTTP
bun run test           # tests unitaires (bun test)
bun run cat test:e2e       # tests de bout en bout Playwright
bun run cat lint           # eslint
```

## Configurer pour votre folio

Copiez l'exemple de configuration dans votre dépôt de **contenu** (pas dans
folio-assistant) et ajustez-le selon votre type de contenu :

```sh
# La DESTINATION est nommée d'après votre instance -- `mon-folio.config.json`, pas un
# mot fixe. Le fichier d'exemple conserve son propre nom : c'est ainsi qu'il s'appelle.
cp cat-harness/docs/reference/harness.config.example.json /path/to/your/content-repo/<votre-nom>.config.json
```

```json
{
  "contentType": "document",
  "adapter": "document",
  "adapterModule": "./folio-assistant/adapters/document/index.ts",
  "feedbackDir": ".folio-feedback",
  "skills": ".claude/skills/local"
}
```

`contentType` sélectionne à la fois l'adaptateur et le *profil* de types de blocs. Utilisez
`"paper"` (et `adapters/paper/index.ts`) pour un folio comportant des mathématiques
appuyées par Lean — l'adaptateur paper étend celui de document, il offre donc également chaque
outil de document. `folio_init` écrit ce fichier pour vous ; voir
[Démarrer un nouveau folio](https://github.com/litlfred/folio-assistant#start-a-new-folio).

---

## Connecter un harnais LLM

folio-assistant expose ses outils via MCP, de sorte que tout harnais d'agent compatible MCP
peut le piloter. Vous trouverez ci-dessous les configurations pour les plus courants. Dans tous les cas, l'agent
lance le serveur via **stdio**.

### Claude Code

Ajoutez folio-assistant en tant que serveur MCP. La configuration propre au projet réside dans `.mcp.json`
à la racine de votre dépôt de contenu :

```json
{
  "mcpServers": {
    "folio-assistant": {
      "command": "bun",
      "args": ["run", "/path/to/folio-assistant/cat-harness-tools/src/index.ts", "--stdio", "--repo", "."]
    }
  }
}
```

Ou enregistrez-le depuis la ligne de commande (CLI) :

```sh
claude mcp add folio-assistant -- bun run /path/to/folio-assistant/cat-harness-tools/src/index.ts --stdio --repo .
```

Claude Code lit également nativement `AGENTS.md` / `CLAUDE.md` et respecte le
hook `SessionStart` dans `.claude/settings.json` — ainsi, l'amorceur du plan de travail s'exécute
automatiquement au démarrage d'une session.

### Antigravity

Antigravity lit nativement `AGENTS.md` et prend en charge les serveurs MCP ainsi qu'un
hook de cycle de vie `SessionStart`. Ajoutez le serveur à sa configuration MCP (format JSON
partagé avec Gemini CLI) :

```json
{
  "mcpServers": {
    "folio-assistant": {
      "command": "bun",
      "args": ["run", "/path/to/folio-assistant/cat-harness-tools/src/index.ts", "--stdio", "--repo", "."]
    }
  }
}
```

Reliez l'amorceur de démarrage de session au hook `SessionStart` d'Antigravity afin que chaque
session soit initialisée avec le plan de travail — faites pointer la commande du hook vers le script
partagé `cat-harness-tools/scripts/session-start-coord-sweep.sh` (le même script utilisé par chaque harnais ;
seul le format de configuration du hook diffère selon l'outil).

### Gemini CLI

Gemini CLI lit nativement `AGENTS.md` / `GEMINI.md`. Enregistrez le serveur MCP dans
ses paramètres et réutilisez le même script `SessionStart` :

```json
{
  "mcpServers": {
    "folio-assistant": {
      "command": "bun",
      "args": ["run", "/path/to/folio-assistant/cat-harness-tools/src/index.ts", "--stdio", "--repo", "."]
    }
  }
}
```

### Tout autre client MCP

Pointez votre client vers la commande stdio ci-dessus, ou exécutez le transport HTTP
(`bun run cat start:http`) et connectez-vous via HTTP. Le serveur MCP expose un outil
`work_plan_prime` que tout agent connecté via MCP peut appeler pour obtenir une amorce
du plan de travail en direct identique, quel que soit le harnais.

> **Pourquoi cela fonctionne d'un harnais à l'autre.** La discipline réside dans `AGENTS.md` (un
> standard pour agents de la Linux Foundation lu nativement par Claude Code, Gemini CLI,
> Antigravity, Cursor, Copilot et d'autres) ; l'état en direct est exposé à la fois sous la forme d'un
> hook `SessionStart` propre à chaque harnais via un script partagé et sous la forme de l'outil MCP
> `work_plan_prime`. Consultez la page [architecture](../../concepts/fr/architecture.html).
