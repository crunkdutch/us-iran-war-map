import 'leaflet'

declare module 'leaflet' {
  interface MarkerClusterGroupOptions {
    chunkedLoading?: boolean
    chunkInterval?: number
    chunkDelay?: number
    maxClusterRadius?: number | ((zoom: number) => number)
    iconCreateFunction?: (cluster: any) => L.DivIcon
    spiderfyOnMaxZoom?: boolean
    showCoverageOnHover?: boolean
    zoomToBoundsOnClick?: boolean
    disableClusteringAtZoom?: number
    animate?: boolean
    animateAddingMarkers?: boolean
    singleMarkerMode?: boolean
    removeOutsideVisibleBounds?: boolean
    polygonOptions?: L.PolylineOptions
  }

  interface MarkerCluster {
    getChildCount(): number
    getAllChildMarkers(): L.Marker[]
  }

  class MarkerClusterGroup extends L.LayerGroup {
    constructor(options?: MarkerClusterGroupOptions)
    addLayer(layer: L.Layer): this
    removeLayer(layer: L.Layer): this
    clearLayers(): this
    getLayers(): L.Layer[]
    isSpiderfied(): any
    zoomToBounds(options?: { padding?: [number, number] }): void
  }

  function markerClusterGroup(options?: MarkerClusterGroupOptions): MarkerClusterGroup
}
