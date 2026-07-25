// Type declarations for leaflet.markercluster
// leaflet.markercluster augments L.MarkerClusterGroup onto the L namespace

import L from 'leaflet'

declare module 'leaflet' {
  export interface MarkerClusterGroupOptions extends L.LayerOptions {
    chunkedLoading?: boolean
    chunkInterval?: number
    chunkDelay?: number
    maxClusterRadius?: number | ((zoom: number) => number)
    iconCreateFunction?: (cluster: L.MarkerCluster) => L.DivIcon
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

  export interface MarkerCluster extends L.Layer {
    getChildCount(): number
    getAllChildMarkers(): L.Marker[]
  }

  class MarkerClusterGroup extends L.LayerGroup {
    constructor(options?: MarkerClusterGroupOptions)
    addLayer(layer: L.Layer): this
    removeLayer(layer: L.Layer): this
    clearLayers(): this
    getLayers(): L.Layer[]
    isSpiderfied(): boolean | null
    zoomToBounds(options?: { padding?: [number, number] }): void
    refreshClusters(
      clusters?: L.MarkerClusterGroup | L.Layer[] | { [key: string]: L.Layer } | L.Layer
    ): this
  }

  namespace MarkerClusterGroup {
    function markerClusterGroup(options?: MarkerClusterGroupOptions): MarkerClusterGroup
  }
}
