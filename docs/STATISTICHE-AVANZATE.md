# Amerikano — analisi statistiche avanzate

## Obiettivo e fonte

Requisiti confermati da Stefano nel documento canonico [Personal Hub / VISIONE-PRODOTTO.md](https://github.com/StefanoDiConcetto/personal-hub/blob/main/docs/VISIONE-PRODOTTO.md), sezione «Amerikano — statistiche accolte da Stefano». Questa realizzazione usa gli stessi dati delle statistiche di Amerikano, **solo partite concluse**, applica i filtri già esistenti per gruppo e durata ed esclude le partite di test. Un solo codice ufficiale per chi accede dal sito pubblico e da Personal Hub; non inserire la funzionalità in una variante solo personale.

## I 10 indicatori implementati

| Nome | Definizione e limiti |
|---|---|
| Costo mani perse | Media dei totali di mano quando un altro giocatore ha chiuso e il punteggio è registrato; niente inferenze da un totale pari a zero |
| Contratti sicuri/rischiosi | Media, deviazione standard e chiusure per giocatore/contratto; classificazione confrontabile solo con almeno 3 punti noti per contratto |
| Scelta efficace | Esclusivamente mani con `voluntaryChoice === true`, giocatore che sceglie, punteggio e vincitore registrati; confronto fra scelta e non scelta nella stessa tipologia di mani |
| Rimonta e tenuta | Rimonta da non-primo dopo la prima mano a primo finale; tenuta del primo posto dopo tutte le mani; pareggi condividono la posizione |
| Mano decisiva | Massima variazione assoluta del distacco, nella singola mano, tra vincitore finale univoco e secondo finale univoco. È un indicatore aritmetico, non una causa dimostrata |
| Dipendenza dalle chiusure | Confronto di vittorie finali con/senza almeno una mano chiusa, includendo solo partite con punteggi completi e tutti i vincitori di mano registrati |
| Impatto penalità | Scenario di ricalcolo `totale - 50 × infrazioni` per tutti i giocatori, solo quando i dati di tutti sono completi. Non rappresenta una partita realmente giocata |
| Avversari e contratti | Confronti soltanto fra partecipanti alle stesse partite e alle stesse mani, raggruppando anche i punteggi e le chiusure per contratto identico |
| Andamento nel tempo | Prima e seconda metà delle partite con timestamp valido, con copertura di aperture, chiusure e media punti per mano; confronti descrittivi, non causalità |
| Profilo di gioco | Sintesi descrittiva solo se almeno 3 partite e 12 punteggi di mano noti. Nessuna valutazione personale definitiva |

Ogni metrica è un pulsante e apre un pannello con spiegazione, formula e dettaglio del campione. Anche ogni contratto osservato è cliccabile e distingue **mano chiusa** da **contratto aperto**. I valori «—» indicano copertura insufficiente o risultato non calcolabile. I dati assenti, inclusi `didNotOpen` e `infractions`, non si trasformano in `false` o zero. I risultati non modificano dati, classifiche, proprietà o punteggi delle partite.

## Architettura

- `analytics.js`: analizzatore read-only puro, senza rete né storage, che riceve le partite concluse filtrate da `statisticsGames()`. Mantiene il calcolo distinto dall'interfaccia.
- `app.js`: quarta scheda **Analisi** della finestra Statistiche, pannelli dettaglio tutti cliccabili e ritorno alla scheda di partenza.
- `index.html`: carica `analytics.js` prima di `app.js` con `defer`.
- `styles.css`: quattro tab e tessere con layout adattivo per smartphone; stili della pagina gioco già esistente invariati.
- `sw.js`: aggiunge il nuovo modulo all'insieme offline e al controllo degli aggiornamenti.
- `tests/analytics.test.cjs`: casi sintetici senza accesso a partite reali.

## Prove

**16/16 test eseguiti sui sorgenti di `analytics.js` in V8 con API Node emulata**: pareggi, punteggi mancanti, chiusure sconosciute, scelta volontaria non registrata, penalità incomplete, campione minimo, confronto avversari per contratto e mani abbinate, HTML escaping e non-mutazione. Sintassi JavaScript di `analytics.js`, `app.js` e `sw.js` verificata; ordine di caricamento JS, scheda Analisi e cache offline controllati staticamente.

**NON VERIFICATI**: suite Node reale da checkout pulito, caricamento su browser reale nei tre formati, gestione sessioni condivise/SSO, apertura/ritorno dei dettagli sul Samsung, revisione indipendente, produzione o sincronizzazione della copia interna in Personal Hub. Nessun test ha letto o alterato punteggi personali.

## Rilascio e ripristino

Stato iniziale: **ramo di sviluppo, non pubblicato**. La PR di merge va revisionata prima di pubblicare su GitHub Pages: `main` è il ramo del gioco ufficiale condiviso. Dopo il rilascio ufficiale aggiornare il modulo versionato `web/production-v25/apps/amerikano/` di Personal Hub soltanto dalla stessa release, con test di compatibilità e integrità, preservando il confine dei dati tra origini. Non integrare direttamente nella PWA personale una versione diversa. Rollback: annullare commit/UI e ripristinare gli asset della precedente release; `analytics.js` non richiede migrazioni o ripristini dati. Nessun costo o servizio aggiuntivo previsto.
