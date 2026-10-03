# Distributori Convenienti — V10

Correzione data MIMIT:
- `corrente` è la fonte autorevole per prezzo e `dtComu`;
- se `corrente` contiene carburante/modalità richiesti, lo storico NON può sostituirlo;
- fallback a `prezzi` soltanto se la combinazione non esiste in `corrente`;
- filtro: oggi + due giorni di calendario precedenti;
- cache-busting anche sui singoli `.json.gz`, per evitare gzip vecchi serviti dal browser/GitHub Pages;
- classifica finale per prezzo crescente, poi data più recente, poi distanza;
- massimo 5 risultati entro 5 km.
