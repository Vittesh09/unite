# SkyEngine notices

These files are an unmodified copy of [drakkB/skyengine](https://github.com/drakkB/skyengine) commit `ba8254452a0b0601f9e037c5fec7e50c75565bc3` (version 1.3.2, 2026-06-14).

| File | SHA-256 |
| --- | --- |
| `sky-engine.js` | `fd852a2627361cf6a5e25e3f0ece265a50a3e885bdf7a1495dc0b74eecf07d97` |
| `sky-data.js` | `f92f7fabf4f405d16a809adfa2b087dadddfc876684768a5d6a1fad5329a8ce9` |
| `LICENSE` | `548269fcc3b72f8a44e98d8ccfccb78a986d553043ecc06a14623ae7844e631b` |

Do not install the unrelated npm package named `skyengine`. That package is a different project.

## Engine

`sky-engine.js` and this upstream `LICENSE` are under the MIT licence.

Copyright (c) 2026 drakkB

The MIT permission notice is the text in `LICENSE` above the catalogue paragraph. Keep that file with every copy of the engine.

## Catalogue data

`sky-data.js` is a derivative of [d3-celestial](https://github.com/ofrohn/d3-celestial). That project is BSD-3-Clause. The SkyEngine `LICENSE` summarizes this and does not reproduce the required notice, so the notice is included here.

Copyright (c) 2015, Olaf Frohn
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

### What the data file is

d3-celestial’s data readme attributes its magnitude-6 star file to XHIP, An Extended Hipparcos Compilation (Anderson & Francis 2012, VizieR V/137D), with names and designations from the cited cross-indexes. It states that the converted positions are J2000. It does not cite Gaia as that star-catalogue source. Yale Bright Star appears there only as part of a cross-index, not as the primary star list.

The SkyEngine `LICENSE` describes the same file as Yale Bright Star Catalogue and Hipparcos/Gaia data. That wording is preserved unchanged in `LICENSE`. The citation above is the one supported by the d3-celestial data readme. This copy was not byte-matched back to `stars.6.json`.

d3-celestial also credits Stellarium skycultures and Wikipedia for some names and translations. Those upstreams can have terms of their own. Keep this notice with the data file until that chain is resolved for a public release.

The bundled deep-sky list is 17 hand-entered objects. NGC 6121 (M4) is stored at right ascension 83.82°, the same right ascension as M42 in this file. Published M4 is near 245.9°. The proof shows the stored record.

## Local change

`sky-engine.js` is the upstream file plus these local changes. The SHA-256 above is the unmodified upstream file.

- `_computePlanets` uses `this.date` when that date is valid, so the Sun, Moon, and planets follow the observer time set by the app.
- Display names are English: Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, and Neptune.
- Uranus and Neptune use the orbital elements from Paul Schlyter’s “How to compute planetary positions” (https://stjarnhimlen.se/comp/ppcomp.html), the same source as the other planets. Schlyter notes that those two element sets are less accurate and are meant for a few centuries around the present.
- Planet names are drawn at every zoom level.
- Touch and mouse pan use grab-the-sky horizontally (drag moves the sky with the finger). Upstream applied the opposite horizontal camera delta.
- While phone pointing is active, single-finger pan is ignored so the compass is not fighting the touch; pinch zoom still works.

The calculation is still Schlyter’s low-precision method. This copy does not apply his Jupiter, Saturn, and Uranus perturbation terms. Treat positions as approximate, about 1°, not as a precise ephemeris.
