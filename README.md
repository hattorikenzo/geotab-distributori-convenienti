# Distributori Convenienti

Add-In MyGeotab per individuare i distributori con il prezzo MIMIT più conveniente entro 5 km dall'ultima posizione GPS del veicolo.

## V1
- elenco veicoli MyGeotab
- ultima posizione da `LogRecord`
- riconoscimento carburante con fallback
- raggio di ricerca 5 km
- prezzi Self / Servito
- dataset MIMIT centralizzato da `geotab-carburanti`
- mappa Leaflet / OpenStreetMap
- ordinamento per prezzo

Il dataset MIMIT viene letto da:
`https://hattorikenzo.github.io/geotab-carburanti/data`
