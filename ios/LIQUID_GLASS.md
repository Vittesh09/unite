# iOS Liquid Glass path

The web UI uses CSS glass (`backdrop-filter`, translucent surfaces, large radii) so Android and the Capacitor WebView match today.

When building on a Mac against iOS versions that ship Liquid Glass:

1. Keep the same DOM structure (`#tab-bar`, `.sheet`, `.glass-strong`).
2. Prefer a native blur wrapper (SwiftUI/`UIVisualEffectView` or a Capacitor plugin) for the tab bar and modal sheets instead of CSS blur alone.
3. Mark wrapped nodes with the existing `.liquid-glass` class so CSS can back off opacity where the system material already provides depth.

Until that native step is wired, `.liquid-glass` is a no-op beyond a slightly brighter glass fill on iOS Safari/WebKit.
