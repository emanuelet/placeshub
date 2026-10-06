# Import map collections

PlacesHub accepts KML, KMZ and GeoJSON files. Imports create an editable manual
collection; they do not stay in sync with the source map.

## Google My Maps export

1. In [Google My Maps](https://www.google.com/maps/d/), open your map, choose
   **Export to KML/KMZ** from the menu beside its title, and export the **entire map**.
2. In PlacesHub, open **Collections → Import map**, select the file, review the
   preview, then choose **Import collection**.

Point pins from all layers become one collection. Lines, polygons, icon images,
and duplicate or unsupported pins are skipped. Pin descriptions become
collection notes. KML content must be at most 5 MB.

## GeoJSON

Choose a `.geojson` file containing a `FeatureCollection`. Each point needs
`geometry.type: "Point"`, numeric `[longitude, latitude]` coordinates, and
`properties.name`. Optional `properties.description` becomes the collection
note. Altitude is ignored. Non-points, invalid coordinates and duplicate pins
are skipped. The collection uses the top-level `name`, or the filename when
no name is supplied.

All files must be at most 10 MB and contain at most 3,000 placemarks/features.
An import without any valid point pins is rejected.

## Move places

In manual collections, use **Move** for one place or **Move selected** for
several places to transfer them to another manual collection. Existing
destination notes take precedence over moved notes. Google-synced collections
cannot be changed this way.
