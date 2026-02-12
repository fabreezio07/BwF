# Battle With Friend - Specifiche MVP

**Data:** 2026-01-18 (Aggiornato)  
**Tipo:** Web App Gioco Competitivo Real-Time  
**Modalità:** Sfide a coppia (1v1)

---

## 🎯 Visione

Web app dove giocatori registrati si sfidano a coppia in un gioco di riflessi basato su rotazione arma e fisica real-time.

---

## 🛠️ Stack Tecnologico

### Backend
- **Runtime:** Node.js + Express
- **API:** HTTP REST per setup/matchmaking
- **Real-time:** WebSocket (connessione solo durante partita)
- **Database:** MariaDB (SQL)
- **Auth:** JWT (scadenza 24h)

### Frontend
- **Tecnologie:** Vanilla JavaScript (HTML, CSS, JS puro)
- **Approccio:** Nessun framework, state management semplice

---

## 🎮 Gameplay

### Meccanica di Controllo
- **Tasto ←** : Rotazione arma sinistra di 45°
- **Tasto →** : Rotazione arma destra di 45°
- Ogni giocatore controlla solo la propria arma

### Fisica
- Figura circolare (palla) con arma si muove con **movimento space-like (senza gravità)**
- **Velocità costante:** 2.0 pixels per frame (mantenuta anche dopo rimbalzi)
- **Velocità iniziale:** Direzione casuale con modulo costante (2.0 px/frame)
- **Velocità iniziali:** Garantite non parallele per entrambi i giocatori (per evitare traiettorie che non si incrociano)
- **Rimbalzo** su:
  - Bordi dell'area di gioco
  - Quando due figure si toccano
  - Quando arma colpisce arma avversaria (come bordo)
- **Rimbalzi elastici:** Velocità normalizzata dopo ogni rimbalzo per mantenere modulo costante (nessuna perdita di energia)
- **Rotazione figure:** Le figure ruotano automaticamente in base alla direzione del movimento (calcolata dal vettore velocità)

### Obiettivo
- **Vittoria:** Colpire la figura (palla) dell'avversario con la propria arma
- **NO Vittoria:** Colpire l'arma dell'avversario (solo rimbalzo)

### Implementazione Fisica
- Fisica **calcolata lato server** e inviata ai client
- **Hitbox:** Cerchi per figure, rettangoli per armi
- **Collisioni:** Rilevate e validate solo lato server

---

## 🖥️ Area di Gioco

- **Dimensioni:** 600x800 pixel (verticale/portrait)
- **Sfondo:** Nero
- **Figure:** Cerchi colorati (rosso vs blu)
- **Armi:** Bianco (entrambe)
- **Animazioni:** Nessuna

---

## 📋 Funzionalità MVP

### Core
1. ✅ Registrazione/Login (solo username, JWT)
2. ✅ Sistema inviti (timeout 3 minuti, entrambi online)
3. ✅ Partita real-time 1v1
4. ✅ Sistema punteggi (+10 vittoria, -5 sconfitta)
5. ✅ Classifica globale

### Gestione Partite
- Inviti attivi consultabili via API
- Accettazione sfida via API
- Possibilità di interrompere partita volontariamente (forfeit)
- **Disconnessione esplicita (forfeit)** → Vittoria avversario, punteggi salvati
- **Disconnessione tecnica** → Partita annullata, nessun punteggio salvato
- **Timeout match:** Match non giocati entro 3 minuti vengono cancellati (solo se nessun giocatore ha fatto mosse)

---

## 🗄️ Database Schema

### Tabella `users`
- `id` (PK)
- `username` (UNIQUE)
- `password_hash`
- `created_at`

### Tabella `matches`
- `id` (PK)
- `player1_id` (FK → users.id)
- `player2_id` (FK → users.id)
- `status` (pending, active, completed, cancelled)
  - `pending`: Match creato ma non ancora attivo
  - `active`: Match in corso (entrambi i giocatori connessi)
  - `completed`: Match completato con vincitore
  - `cancelled`: Match annullato (disconnessione tecnica o timeout)
- `winner_id` (FK → users.id, nullable)
- `activated_at` (TIMESTAMP, nullable) - Timestamp quando match diventa attivo
- `created_at`

### Tabella `scores`
- `id` (PK)
- `match_id` (FK → matches.id)
- `player_id` (FK → users.id)
- `score` (INT) - Punteggio totale corrente del giocatore dopo questo match
- `score_change` (INT) - Variazione punteggio per questo match (+10 per vittoria, -5 per sconfitta)
- `created_at`

---

## 🔌 API REST Endpoints

### Autenticazione
- `POST /api/auth/register` - Registrazione
- `POST /api/auth/login` - Login

### Matchmaking
- `POST /api/matches/invite` - Invita amico
- `GET /api/matches/invites/active` - Consulta inviti attivi
- `POST /api/matches/invites/:id/accept` - Accetta sfida
- `POST /api/matches/:id/forfeit` - Interrompi partita volontariamente
- `GET /api/matches/active` - Recupera match attivi per l'utente autenticato

### Storico e Classifica
- `GET /api/matches/history` - Storico partite
- `GET /api/leaderboard` - Classifica globale

---

## 🔄 WebSocket Events

### Eventi Client → Server
- `player.weapon.rotate` - Rotazione arma (direzione: "left" o "right", 45° per direzione)
- `match.join` - Giocatore si unisce al match (invia al connessione)
- `system.heartbeat.ack` - Acknowledgment heartbeat per mantenere connessione attiva

### Eventi Server → Client
- `connection.established` - Connessione WebSocket stabilita con successo
- `match.joined` - Conferma che il giocatore si è unito al match
- `game.start` - Partita inizia (include informazioni match e countdown)
- `game.update` - Aggiornamento stato gioco (ogni frame, ~60 FPS)
  - Include: posizioni figure, velocità, angoli armi, collisioni
- `game.end` - Partita finita (include vincitore, punteggi finali)
- `match.cancelled` - Match annullato (disconnessione tecnica o timeout)
- `system.heartbeat` - Heartbeat per monitoraggio connessione (ogni 30 secondi)

### Gestione Connessione
- WebSocket si connette **solo quando si entra in partita**
- Connessione su `/ws?token=<jwt_token>` (porta 3000)
- Autenticazione JWT richiesta per stabilire connessione
- Non connesso permanentemente dopo login
- Connessione chiusa al termine partita o in caso di errore
- Sistema heartbeat rileva disconnessioni tecniche (timeout dopo 60 secondi senza risposta)

---

## 🎨 UI/UX MVP

### Schermate

1. **Login/Registrazione**
   - Form semplice (solo username + password)
   - Nessuna email richiesta

2. **Dashboard**
   - Lista inviti attivi
   - Partite recenti
   - Link a classifica globale
   - Pulsante "Invita Amico"

3. **Schermata Gioco**
   - Countdown: 3, 2, 1 (senza "GO")
   - Area di gioco 600x800px
   - Due armi visibili simultaneamente
   - Figure rosso vs blu
   - Feedback visivo per collisioni armi
   - Feedback visivo vittoria/sconfitta

4. **Risultato Finale**
   - Vittoria/Sconfitta
   - Punteggi finali
   - Pulsante "Torna alla Dashboard"

---

## 🔒 Sicurezza MVP

- Validazione server-side di tutte le mosse
- Rate limiting naturale (max 1 evento ogni 20ms)
- JWT per autenticazione (24h)
- Errori "silenziati" per MVP (focus su funzionalità core)

---

## 💾 Persistenza

- Risultato finale salvato nella tabella `scores`:
  - Vincitore (user_id) → `score_change` = +10
  - Perdente (user_id) → `score_change` = -5
  - Punteggio totale aggiornato per entrambi i giocatori
  - Match cancellati non salvano punteggi
- Salvataggio atomico tramite transazioni database
- Nessun replay salvato
- Storico ultime partite disponibile (limitato a 50 partite per MVP)

---

## 📊 Sistema Punteggi

- **Vittoria:** +10 punti (`score_change`)
- **Sconfitta:** -5 punti (`score_change`)
- **Classifica:** Globale (non solo tra amici)
  - Include tutti i giocatori registrati (anche con punteggio 0)
  - Gestisce pareggi (stesso rank per stesso punteggio)
  - UI mostra top 5 giocatori
- Aggiornamento automatico dopo ogni partita completata
- Match cancellati non aggiornano punteggi

---

## 🚀 Prossimi Passi

1. Creare PRD dettagliato
2. Disegnare architettura tecnica completa
3. Definire schema database dettagliato
4. Creare wireframes UI/UX
5. Pianificare sviluppo in epiche e user stories
6. Setup ambiente sviluppo (Node.js, MariaDB, etc.)

---

**Documento generato da:** Sessione Brainstorming BMAD  
**Data Creazione:** 2026-01-12  
**Data Ultimo Aggiornamento:** 2026-01-18  
**Status:** ✅ MVP Implementato - Specifica Aggiornata

---

## 📝 Note di Aggiornamento

Questo documento è stato aggiornato il 2026-01-18 per riflettere l'implementazione reale del progetto. Le principali modifiche rispetto alla versione originale includono:

- **Fisica:** Cambiata da movimento con gravità a movimento space-like senza gravità
- **Velocità:** Implementata velocità costante (2.0 px/frame) mantenuta anche dopo rimbalzi
- **Rotazione:** Aggiunta rotazione automatica delle figure in base alla direzione del movimento
- **Database:** Aggiunto campo `score_change` alla tabella `scores` e `activated_at` alla tabella `matches`
- **Status Match:** Aggiornati da (waiting, active, finished) a (pending, active, completed, cancelled)
- **WebSocket Events:** Aggiornati nomi eventi per maggiore chiarezza e specificità
- **API:** Rimossa API `/api/user/profile` (non necessaria per MVP), aggiunta `/api/matches/active`

Per dettagli completi sulle discrepanze identificate e corrette, vedere `docs/MVP_SPEC_REVIEW.md`.
