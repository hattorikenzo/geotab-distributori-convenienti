# Distributori Convenienti — V7

Correzione filtro MIMIT:
- usa esclusivamente il blocco `corrente`;
- il limite di due giorni è calcolato per GIORNI DI CALENDARIO, non come 48 ore esatte;
- se oggi è 03/10/2026 sono ammessi 03/10, 02/10 e tutto il 01/10;
- 30/09/2026 e date precedenti vengono escluse;
- nessun fallback ai vecchi prezzi dello storico;
- il filtro viene applicato prima di scegliere i 5 distributori più convenienti.

Restano tutte le funzioni precedenti: raggio 5 km, massimo 5 risultati, marker veicolo/distributore e itinerario Google Maps.
