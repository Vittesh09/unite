# Unite Astronomy --- Cursor Implementation Roadmap

## Integrating an Open-Source Sky Viewer

**Document purpose:** This is the execution plan for Cursor. It defines
the order of work, decision gates, implementation boundaries, validation
requirements, and deliverables for the first Unite Astronomy sky viewer.

**Primary objective:** Deliver a working, touch-friendly,
offline-capable sky viewer by integrating a proven open-source engine.
Do not start by writing a planetarium engine from scratch.

------------------------------------------------------------------------

# 0. Rules for the coding agent

1.  Inspect the existing repository before changing files.
2.  Preserve the current framework, architecture, navigation, design
    system, and working features unless a specific incompatibility is
    demonstrated.
3.  Do not implement all milestones in one pass.
4.  Complete each phase's decision gate and report results before
    continuing.
5.  Do not fabricate star data, astronomical coordinates, APIs,
    benchmark results, or test results.
6.  Verify upstream source, API, licence and attribution requirements
    from the actual repository files before adopting a dependency.
7.  Keep the integration reversible and isolate third-party code behind
    an adapter.
8.  Do not load critical engine scripts or catalogue data from a remote
    CDN at runtime.
9.  Do not silently change licences, remove attribution, or assume a
    permissive licence applies to every bundled data file.
10. If a blocking issue appears, stop at the relevant gate, explain the
    evidence, and recommend the smallest safe next step.

# 1. Product goal and boundaries

The first milestone is a reliable sky-viewing foundation for Unite
Astronomy, not a complete planetarium or a finished astronomy ecosystem.

The first viewer should let a user: - View real catalogue-backed
stars. - Pan and zoom using touch. - See constellation lines and labels
where supported. - Search for supported objects and navigate to them. -
Select an object and inspect metadata actually available in the
catalogue. - Change observer location and date/time where supported by
the engine. - Use the installed viewer without an internet connection.

Later releases can build on this foundation with observing lists, object
visibility, observing logs, event reminders, equipment tools, and
community features.

## Explicitly out of scope for the first viewer

-   Telescope or mount control.
-   Astrophotography stacking or processing.
-   Full AR/camera overlay.
-   Social feed, accounts, payments, events, or marketplace.
-   A custom 3D renderer.
-   Claims of precision planetary ephemerides unless separately
    implemented and validated.
-   A promise that the device can point accurately at the real sky until
    physical-device sensor tests pass.

# 2. Open-source engine decision

## Candidate A --- SkyEngine (first proof-of-concept candidate)

Repository: https://github.com/drakkB/skyengine

The upstream project describes a small JavaScript Canvas 2D planetarium
engine, with star and constellation data, object selection, pan/zoom,
search and horizon mode. The repository states an MIT licence for the
engine and describes its bundled star data as derived from d3-celestial
under BSD terms.

Why evaluate it first: - Lightweight JavaScript implementation. - Canvas
2D is potentially practical inside a React Native WebView. - Smaller
integration surface for a first experiment. - Permissive stated engine
licence, subject to verifying all included assets/data.

Important limitation: - The upstream README describes its built-in
Sun/Moon/planet calculations as approximately 1° accurate. Treat those
positions as approximate until independently validated; do not use them
for precision predictions.

## Candidate B --- Stellarium Web Engine (comparison/fallback)

Repository: https://github.com/Stellarium/stellarium-web-engine

It is a more capable WebGL planetarium engine with a much larger star
database and richer rendering features. Its repository identifies an
AGPL-3.0 licence and a more involved build process.

Before choosing it, assess: - The legal obligations of AGPL-3.0 for the
planned distribution and network use. - WebAssembly/WebGL compatibility
inside the project's actual iOS and Android targets. - Bundle size,
offline catalogue assets, build reproducibility and performance. -
Whether the intended product needs legal review before adopting it.

Do not copy or distribute it before the licence implications are
documented.

## Candidate C --- astronomy calculation library

Astronomy Engine: https://github.com/cosinekitty/astronomy

This is a candidate for specific astronomical calculations supported by
its documented API. It is not a full sky renderer or a complete star
catalogue. Use it only where appropriate, behind a separate calculation
adapter.

## Required decision

At the end of Phase 1, recommend one of: - **GO: SkyEngine** - **NO-GO:
SkyEngine; evaluate Stellarium Web Engine** - **NO-GO: neither
candidate; explain the evidence and suggest the smallest alternative**

Do not make this decision based only on a README or a screenshot.

# 3. Phase 1 --- Repository, API, licence and platform audit

**Do not build the viewer in this phase.**

## Tasks

1.  Inspect the repository structure, package manifest, app entry point,
    navigation, design system, current dependencies and target
    platforms.
2.  Determine whether the project is Expo/React Native, another native
    stack, or a web app.
3.  Inspect SkyEngine's actual upstream README, licence files, package
    metadata, main source, data source and demo.
4.  Verify the actual public API and how it is initialised, resized,
    configured and destroyed.
5.  Confirm whether touch pan, pinch zoom, selection and search are
    supported by the source rather than merely implied by documentation.
6.  Inspect how date, observer location, coordinates and horizon mode
    are implemented.
7.  Check licences and attribution for the engine, star catalogue,
    constellation data, images, and any other bundled assets separately.
8.  Check maintenance status, dependency/security risks, platform
    compatibility and known limitations.
9.  Decide the least invasive integration path.
10. Provide a concise written recommendation and exact proposed file
    changes.

## Phase 1 deliverables

Cursor must report: - Current stack and target platforms. - Relevant
existing files and integration point. - Verified API surface. -
Licence/attribution findings. - Scientific accuracy limitations. -
Offline feasibility and expected asset-loading approach. - Main risks
and mitigations. - Go/no-go recommendation and fallback. - Proposed
files to create/change.

## Gate 1

Do not continue until the recommendation is supported by source
inspection. If licence or platform feasibility is unresolved, identify
what remains unknown instead of assuming it is safe.

# 4. Phase 2 --- Minimal runnable proof of concept

Implement only the smallest working integration that proves the chosen
engine can run in this app.

## Integration strategy

### If the project is Expo/React Native

-   Preserve the existing app and navigation.
-   First test whether a locally bundled HTML/JavaScript asset can host
    the engine inside the project's existing WebView setup.
-   Add `react-native-webview` only if it is missing and compatible with
    the current Expo SDK and build setup.
-   Bundle the engine and catalogue locally; do not rely on a CDN.
-   Avoid broad or unsafe file-access settings as a workaround for local
    asset issues.
-   Use a small, typed bridge between the native UI and viewer.
-   Validate every incoming message; never evaluate arbitrary incoming
    strings as code.

### If the project is web-based

-   Integrate the engine in a dedicated component.
-   Keep engine-specific code isolated from the rest of the UI.
-   Ensure local production builds include all required scripts and
    data.

### If the project uses another stack

-   Report the correct integration approach for that stack before making
    architectural changes.
-   Do not force React Native or WebView into the project without
    evidence.

## Minimal viewer functionality

-   Render actual stars from the selected engine's bundled catalogue.
-   Show constellation lines/labels and deep-sky objects where
    supported.
-   Support touch pan and pinch zoom.
-   Provide a reset/recenter action.
-   Select a supported object and expose real available metadata.
-   Search the real engine index and navigate to a result.
-   Show graceful loading, no-result, unsupported-feature and
    runtime-error states.
-   Work after installation with no network connection.
-   Include temporary development diagnostics to expose engine errors.

Do not build the full Unite Astronomy screen, saved-object persistence
or advanced features yet.

## Suggested boundaries (adapt to the repository)

-   `SkyViewerScreen`: screen shell and integration with navigation.
-   `SkyEngineHost`: WebView or canvas host.
-   `skyViewerBridge`: validated message protocol, if a bridge is
    required.
-   `skyViewerTypes`: shared typed object/observer/message contracts.
-   `skyEngineAdapter`: wrapper around the chosen upstream engine.
-   `SkySearch`: search controls.
-   `SkyObjectSheet`: object metadata UI.

These are proposed names, not a mandate. Use existing conventions if the
repository has an established structure.

## Bridge protocol if a WebView is used

Use explicit typed messages. For example:

**Viewer to app** - `ready` - `objectSelected` - `searchResults` -
`engineError`

**App to viewer** - `search` - `flyTo` - `setObserver` - `setDateTime` -
`setLayerVisibility` - `resetView`

Specify payload schemas, validate all messages, handle messages arriving
before readiness, and avoid arbitrary JavaScript execution.

## Gate 2

The proof is viable only if: - It runs in the actual project. - Real
catalogue stars are rendered. - Pan, zoom, selection and search work. -
Local assets load without a network connection. - The approach is
maintainable and licence requirements are understood.

If it fails, report the exact failure and evidence before choosing
another engine.

# 5. Phase 3 --- Reliability, offline support and scientific checks

## Functional tests

-   Engine initialises successfully.
-   Canvas/viewer resizes correctly with device orientation and layout
    changes.
-   Pan, pinch zoom and reset work on touch devices.
-   Search returns only supported real catalogue objects.
-   Selecting a search result navigates to the correct object.
-   Object metadata comes from the actual data source.
-   Layer toggles work or unsupported options are not shown.
-   Repeated mount/unmount does not leak event handlers or leave
    background work running.
-   Error states are recoverable and do not crash the containing app.

## Offline tests

-   Install or build the app.
-   Disable networking.
-   Launch the app and load the viewer.
-   Pan, zoom, search and select supported objects.
-   Record any features that legitimately require remote data and keep
    them out of the offline promise.

## Scientific validation

-   Document the coordinate frame/epoch, units, time convention,
    observer coordinate convention and azimuth convention.
-   Verify the engine's date/location transformation and horizon mode.
-   Compare selected objects against an independent trusted reference,
    such as Stellarium, for multiple dates, locations and sky
    directions.
-   Record input parameters, output values, differences and tolerance.
-   Test coordinate conversion functions independently if Unite adds any
    custom code.
-   Do not claim scientific accuracy because the view looks similar to a
    reference image.
-   The upstream SkyEngine's built-in planetary calculations are
    described as approximately 1° accurate. Do not use them for precise
    rise/set times, event predictions or high-precision pointing without
    replacing or validating the calculation.
-   If a separate library such as Astronomy Engine is introduced,
    confirm its documented scope and compare its results independently.

## Physical device and sensor rule

Do not advertise accurate live-sky alignment until tested on real
hardware. Sensor orientation requires permissions, heading calibration,
coordinate-frame conversions, sensor-noise handling and device-specific
testing. It is a later phase, not part of the initial proof.

## Gate 3

No further feature expansion until the functional/offline test results
and a short scientific limitations report are documented.

# 6. Phase 4 --- First Unite-specific experience

Only after Phases 1--3 pass, build the initial product layer around the
engine.

-   Apply the existing Unite Astronomy design system.
-   Keep the sky canvas legible and visually uncluttered.
-   Add a native/web search UI matching the current stack.
-   Add a detail sheet for supported objects using only real catalogue
    metadata.
-   Add a clear observer-location control and manual location selection.
-   Add date/time controls only if the engine reliably supports updating
    the view.
-   Add layer controls for features verified to work.
-   Add accessibility labels, keyboard navigation where relevant, and
    screen-reader support.
-   Add a saved observing list only if actual persistence is
    implemented; label local-only prototype storage honestly.
-   Include attribution/licence information in an appropriate About,
    Credits or Open Source Notices location.

Do not invent object facts or show blank/placeholder controls that
appear functional but do nothing.

# 7. Phase 5 --- Later astronomy features (not part of the initial build)

Prioritise these only after the core viewer is stable: 1. Object
visibility and rise/set with validated calculations. 2. Saved observing
lists. 3. Observation logs. 4. Event reminders. 5. Equipment profiles
and field-of-view calculations. 6. Better deep-sky catalogue coverage.
7. Sensor-assisted live sky orientation, validated on physical devices.
8. Community and astrophotography features.

Each feature should have its own scope, data source, acceptance criteria
and validation. Do not turn this first task into an unbounded rewrite.

# 8. Definition of done

The initial sky-viewer integration is complete only when:

-   [ ] The app builds and opens on each configured target platform.
-   [ ] The selected engine is bundled locally and can initialise
    offline.
-   [ ] Real catalogue data is used; no fabricated stars or coordinates
    are introduced.
-   [ ] Pan, pinch zoom, reset, search and selection work.
-   [ ] Object metadata is catalogue-backed and missing values are not
    invented.
-   [ ] Supported constellation/layer controls work.
-   [ ] Observer/date handling is documented and tested where supported.
-   [ ] Functional tests and offline tests are recorded.
-   [ ] Custom coordinate/calculation code has tests.
-   [ ] Independent reference comparisons and known limitations are
    documented.
-   [ ] Required licence notices and attribution are preserved.
-   [ ] No unrelated app features or architecture have been rewritten.
-   [ ] Run instructions and remaining limitations are documented.

# 9. Required final report from Cursor

After completing the approved phases, report:

1.  What was inspected and which engine was chosen, with evidence.
2.  Why the alternative was rejected or kept as a fallback.
3.  Files added/changed and why.
4.  Dependencies and licence/attribution changes.
5.  Commands used to run/build/test.
6.  Platforms actually tested and the results.
7.  Offline test results.
8.  Functional test results.
9.  Scientific comparisons, tolerances and known limitations.
10. Any unverified device-specific behaviour.
11. Remaining blockers and the next smallest useful step.

Never claim a build, test, offline run or physical-device behaviour
succeeded unless it was actually executed and observed.

# 10. Links

-   SkyEngine: https://github.com/drakkB/skyengine
-   Stellarium Web Engine:
    https://github.com/Stellarium/stellarium-web-engine
-   Astronomy Engine: https://github.com/cosinekitty/astronomy
-   Stellarium desktop: https://github.com/Stellarium/stellarium

------------------------------------------------------------------------

# Start instruction for Cursor

Read this document fully. Begin with **Phase 1 only**. Inspect the
current codebase and the actual upstream engine sources. Do not modify
application code until you return the Phase 1 report and identify a
viable path. After the report, wait for approval before proceeding to
Phase 2.
