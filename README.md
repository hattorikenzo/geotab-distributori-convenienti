# Distributori Convenienti — V5

La V5 legge prima `corrente` dai file MIMIT gzip:
- prezzo corrente;
- vera `dtComu` presente nel `prezzo_alle_8.csv` quotidiano;
- la comunicazione viene mantenuta anche se il prezzo non è cambiato.

Se `corrente` non è ancora presente, resta attivo il fallback allo storico precedente.
Include inoltre tutte le modifiche V4: 5 risultati, marker grandi, mappa mobile pulita e itinerario Google Maps.
