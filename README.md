# Distributori Convenienti — V8

Correzione ricerca prezzi MIMIT:
- legge prima il blocco `corrente`;
- legge anche `prezzi`, la struttura utilizzata da CONSULTA PREZZI MIMIT;
- per ogni impianto/carburante/modalità determina il record con `dtComu` più recente;
- solo dopo applica il filtro temporale;
- se oggi è 03/10 sono validi 03/10, 02/10 e tutto il 01/10;
- dal 30/09 in giù l'impianto viene escluso;
- massimo 5 distributori convenienti entro 5 km.

Questo consente, per esempio, a un impianto come ID MIMIT 48907 con Benzina Self
e ultima comunicazione 02/10/2026 di essere considerato valido.
