# Distributori Convenienti — V9

Logica classifica:
- raggio massimo 5 km;
- Benzina/Gasolio ecc. e Self/Servito secondo selezione;
- accetta solo comunicazioni MIMIT del giorno corrente e dei due giorni di calendario precedenti;
- cerca sia `corrente` sia `prezzi`;
- per ogni impianto usa la comunicazione valida più recente;
- ordina i distributori per PREZZO crescente;
- a parità di prezzo preferisce la comunicazione MIMIT più recente;
- a ulteriore parità preferisce il distributore più vicino;
- mostra al massimo 5 risultati.

Esempio al 03/10/2026: sono ammessi 03/10, 02/10 e 01/10; 30/09 e precedenti sono esclusi.
