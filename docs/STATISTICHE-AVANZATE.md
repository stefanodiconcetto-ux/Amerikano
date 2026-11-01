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

Stato iniziale: **ramo di sviluppo, non pubblicato**. La PR di merge va revisionata prima di pubblicare su GitHub Pages: `main` è il ramo del gioco ufficiale condiviso. Personal Hub non contiene più una copia giocabile di Amerikano: PR #13 di `StefanoDiConcetto/personal-hub` pubblicata, collegamento nella stessa scheda al solo sito ufficiale. Non riprodurre il modulo in PH. I dati locali dei due domini rimangono separati: lo strumento di backup precedente in PH esporta lo schema v3 senza cancellare i dati, mentre il ripristino ufficiale può sostituire dati già presenti sul dominio di destinazione; salvare prima anche quelli. Rollback: annullare commit/UI e ripristinare gli asset della precedente release; `analytics.js` non richiede migrazioni o ripristini dati. Nessun costo o servizio aggiuntivo previsto.

## Esito integrazione — 1 novembre 2026

PR #3 integrata in `main` con commit `4d32407353e80d4f2a919bc46db3c07809feea7a`. `analytics.js`, `app.js`, `index.html` e `sw.js` riletti dopo il merge. Tutti i 16 test isolati V8 superati; sintassi valida, scheda «Analisi» e caricamento dell'asset verificati staticamente. La pubblicazione del codice su `main` è verificata; **la raggiungibilità del sito GitHub Pages e il collaudo nel browser reale non sono stati verificati** in questa sessione. Nessuna modifica a partite, Supabase o token.

Personal Hub PR #13 ha eliminato la copia giocabile e apre soltanto questo sito ufficiale. Il precedente paragrafo sullo stato del ramo descrive la fase precedente al merge, non la situazione attuale. Nessuna sincronizzazione di una seconda versione è necessaria.


## Semplificazione dell'interfaccia — 1 novembre 2026

**Feedback:** la pagina Analisi è difficile da capire. I 10 indicatori simultanei per ogni giocatore nascondevano i risultati utili dietro nomi tecnici e dati senza una chiara interpretazione.

**Nuova esperienza mobile, senza cambiare le formule:** ogni giocatore espande una sola sezione con quattro risposte iniziali: «Quando non chiudi», «Quante mani chiudi?», «Con quali contratti fai meno punti?», «Le tue rimonte». Ogni scheda mostra il numero, una spiegazione in italiano corrente e il campione osservato; i dati insufficienti sono indicati esplicitamente (mai inventati come zero). Il contratto con media più bassa viene evidenziato solo se ci sono **almeno due contratti confrontabili** e almeno tre risultati per ciascuno. Le altre sei analisi si trovano in «Altre curiosità» e i singoli contratti in «Guarda i contratti»: rimangono tutti cliccabili. Un solo giocatore aperto alla volta, con selezione preservata dopo il ritorno dal dettaglio.

Nel dettaglio sono mostrati prima il valore e la spiegazione; i dati grezzi restano accessibili su richiesta tramite «Mostra le mani e i calcoli». La nuova disposizione usa una sola colonna per gli indicatori sui telefoni e due colonne da 700 px, senza dipendere da scorrimenti orizzontali. Versioni degli asset rinnovate con cache offline v5.

**Controlli:** 22/22 test isolati sui sorgenti in V8, tra cui escaping HTML, tutti i 10 indicatori e contratti accessibili, valori sconosciuti non assimilati a zero, ranking affidabile solo con campioni confrontabili, selezione del giocatore, etichette singolare/plurale; sintassi di `app.js`, `analytics.js`, `sw.js` e riferimento ai nuovi asset verificati staticamente. Nessuna modifica a schema, partite, cloud, token o punteggi. Test Node da checkout pulito, screenshot 320/390px, navigazione reale su Android, controverifica indipendente **non effettuati**. Stato al momento della scrittura: candidato nel ramo `feat/clear-statistics-mobile-20261101`, non ancora pubblicato.

## Esito integrazione interfaccia semplificata — 1 novembre 2026

PR #4 integrata in `main`, commit `fac305458e66014bb67cf5735547da816c32ee64`. Sorgenti `analytics.js`, `app.js`, `styles.css`, `index.html` e `sw.js` riletti da GitHub: quattro indicatori immediati, sei approfondimenti a richiesta, contratti separati, giocatore preservato al ritorno, spiegazioni in testa al dettaglio e numeri di calcolo apribili. Cache offline aggiornata alla v5 e riferimenti asset versionati. **22/22 test isolati** superati; nessun cambiamento a partite, punteggi o dati cloud. **Pubblicazione del codice su main verificata.** La disponibilità effettiva del nuovo front-end su GitHub Pages, screenshot/mobile reale e suite completa da checkout pulito **non verificati** in questa sessione. La versione precedente resta ripristinabile tramite revert del commit, senza migrazione dati.
