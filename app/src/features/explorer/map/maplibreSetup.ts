import { setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

// The worker is resolved relative to the library file, which breaks once the bundler moves it.
setWorkerUrl(workerUrl)
