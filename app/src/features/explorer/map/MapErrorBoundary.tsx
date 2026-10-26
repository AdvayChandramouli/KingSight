import { Component, type ReactNode } from 'react'

type Props = { fallback: ReactNode; children: ReactNode }

/** Contains map engine crashes (including a failed code download) to the map area. */
export class MapErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
