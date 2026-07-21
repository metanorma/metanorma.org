(function (global) {
    'use strict';

    // Coordinate system: 147.4 × 147.4 — matches logo/metanorma-logo_icon-*.svg
    var VB_W = 147.4, VB_H = 147.4;
    var LANTERN_X = 73.7, LANTERN_Y = 40; // beam apex (inside the upper tower)

    // -- Theme palettes --------------------------------------------------
    var THEMES = {
        dark: {
            // evening: tower lit from the lantern above, shading into dusk at the base
            bodyStops: [
                { o: '0',   c: '#ece8ff' },
                { o: '.35', c: '#b9c2f2' },
                { o: '.7',  c: '#6b84d6' },
                { o: '1',   c: '#4560b0' }
            ],
            bodyGrad: { x1: 62, y1: 2, x2: 86, y2: 150 },
            beam: '#fff4d6',
            beamGlow: '#ffd966',
            beamTail: '#ffe9a8',
            halo: '#fff4d6',
            shock: '#c8b8ff',
            // evening sea — deep indigo water, crest catching the lamp light
            waveStops: [
                { o: '0',   c: '#cdd2ea' },
                { o: '.25', c: '#5e77bd' },
                { o: '1',   c: '#131b46' }
            ],
            rest: 1,                // night shift — the lamp is always on duty
            haloPeak: 1.0
        },
        light: {
            // morning: sun from the upper left — sunlit violet planes, base falling
            // into cool shadow (directional "isometric" shading)
            bodyStops: [
                { o: '0',   c: '#9a80f0' },
                { o: '.3',  c: '#6f61d4' },
                { o: '.6',  c: '#4b59a8' },
                { o: '1',   c: '#2e4a8c' }
            ],
            bodyGrad: { x1: 28, y1: 8, x2: 118, y2: 142 },
            // soft warm yellow (not orange) — gentler on the cream background
            beam: '#fde68a',
            beamGlow: '#f59e0b',
            // tails must stay lighter than the cream bg or the beam reads as a dark streak
            beamTail: '#fcd34d',
            halo: '#fef3c7',
            shock: '#f59e0b',
            // morning sea — sunlit teal, contrasting the violet tower
            waveStops: [
                { o: '0',   c: '#a9e4cf' },
                { o: '.35', c: '#3fb0a5' },
                { o: '1',   c: '#16697a' }
            ],
            rest: 0.05,             // day shift — the lamp dozes until woken (hover/click)
            haloPeak: 0.7
        }
    };

    // Lighthouse silhouette, split from metanorma-logo_icon-dark-waveless.svg clipPath into
    // the tower (body + window slats + interior cutouts) and the six shine strips (rays),
    // so the rays can glow independently, driven by the beam.
    var TOWER_PATH = 'M81.57,49.45h-15.62c-1.1,0-2,.9-2,2s.9,2,2,2h15.43c1.1.05,2.04-.8,2.1-1.9.05-1.1-.8-2.04-1.91-2.1ZM81.57,57.46h-15.62c-1.1,0-2,.9-2,2s.9,2,2,2h15.43c1.1.05,2.04-.8,2.1-1.9.05-1.11-.8-2.04-1.91-2.1ZM81.57,41.45h-15.62c-1.1-.05-2.04.81-2.09,1.92-.05,1.1.81,2.04,1.92,2.08h15.6c1.1.05,2.04-.8,2.1-1.9.05-1.1-.8-2.04-1.91-2.1ZM107.09,147.4h-4.06l-1.91-16.79h-9.55l-7.24,12.53,2.46,4.26h-46.33l8.8-76.64v-.09c0-.07,0-.14,0-.21.02-.05.04-.1.05-.16.03-.08.06-.15.1-.22l.07-.12c.05-.08.1-.15.16-.22l.06-.07c.07-.08.14-.15.22-.21h.05l.27-.17h.06l.27-.11h1.53V31.89c.04-.36.18-.71.4-1l19.59-25.39c.07-.08.15-.16.23-.23.87-.74,2.18-.64,2.92.23l19.61,25.43c.22.29.36.64.4,1,.01.06.01.13,0,.19v37.22h1.76l.25.1h.09l.24.16.07.06.21.2.07.09.15.21.12.11c.03.07.06.14.09.21.03.05.04.11.05.17,0,.07,0,.14,0,.21v.09l3.2,28.22c.09.82.18,1.6.26,2.33l1.09,9.46c.47,4.07.9,7.71,1.68,14.64l2.5,21.79ZM58.19,30.15h31l-15.5-20.16-15.5,20.16ZM56.1,69.21h35.16v-35.1h-35.16v35.1ZM60.9,73.3l5.79,10.01h14l5.79-10.01h-25.58ZM55.58,126.74l7.63-13.22-7-12.11h-6.46l-1.22,10.69-1.67,14.64h8.71ZM88.25,128.3l-7.24-12.53h-14.47l-7.23,12.52,7.23,12.55h14.47l7.24-12.53ZM97.31,97.41l-2.75-24.11h-3.44l-6.95,12,7,12.11h6.14Z';
    var RAYS_L_PATH = 'M38.28,56.59c.69.86.55,2.13-.31,2.82l-19.97,16.09c-.86.7-2.12.57-2.82-.28-.7-.86-.57-2.12.28-2.83l20-16.11c.86-.69,2.13-.55,2.82.31ZM15.49,25.62l20,16.1c.89.66,2.14.47,2.8-.42.62-.84.49-2.01-.29-2.69l-19.98-16.11c-.83-.73-2.09-.66-2.83.17-.74.83-.66,2.1.17,2.83l.13.12ZM34.37,49c0-1.1-.89-2-2-2H5.9c-1.1-.05-2.04.81-2.09,1.91-.05,1.1.81,2.04,1.92,2.09h26.64c1.11,0,2-.9,2-2Z';
    var RAYS_R_PATH = 'M111.9,56.34c-.89-.66-2.14-.47-2.8.42,0,0,0,0,0,0-.62.84-.49,2.01.29,2.69l20,16.09c.89.66,2.14.47,2.8-.42.62-.84.49-2.01-.29-2.69l-20-16.09ZM141.62,47h-26.66c-1.1,0-2,.9-2,2s.9,2,2,2h26.47c1.11.05,2.04-.8,2.1-1.91.05-1.1-.8-2.04-1.91-2.09ZM110.64,42.19v-.04c.45.02.9-.12,1.26-.39l20-16.09c.83-.73.91-1.99.18-2.82-.69-.78-1.86-.91-2.69-.29l-20,16.07c-.86.69-1,1.95-.31,2.81.38.47.95.75,1.56.75Z';

    // Wave curve (one period, from metanorma-logo_wave-*-solid.svg). Goes from (62.78, 26.83)
    // to (~0, 26.83) — trough-to-trough, so it tiles seamlessly. All commands are relative
    // (lowercase), so the same string can be repeated to trace multiple periods leftward.
    var WAVE_CURVE = 'c-2.95.06-7.44-.4-14.03-9.04l-.04.03s-.02-.02-.03-.03c-4-4.85-8.45-10.36-17.24-10.36s-13.35,5.65-17.31,10.51c-.65.79-1.29,1.58-2,2.35-.04.06-.07.13-.1.19-3.16,3.64-6.39,6.35-12.03,6.35';
    var WAVE_TILE_W = 62.78;
    // Render the wave as ONE continuous path covering several periods — no tile boundaries,
    // no overlap regions, no subpixel seams. The group is then translated to animate.
    var NUM_WAVE_PERIODS = 6;
    var WAVE_BASELINE_DY = 100; // wave peak lands at y ≈ 107.4, above the diamond bases

    function buildWavePath(numPeriods) {
        var totalWidth = numPeriods * WAVE_TILE_W;
        var d = 'M' + totalWidth.toFixed(2) + ',26.83';
        for (var i = 0; i < numPeriods; i++) d += WAVE_CURVE;
        // After the curves we're at (0, 26.83). Close down, right, up. The v100 extends the
        // water block well past the icon bottom (frame crop or mask handles the overflow).
        d += 'v100h' + totalWidth.toFixed(2) + 'v-100Z';
        return d;
    }

    // Canonical beam wedge: apex at (0,0), axis along +x, length 100. Drawn inside a group
    // that is rotated/scaled per frame — the fill gradients (userSpaceOnUse, also running
    // 0 → 100 along x) rotate and stretch with it, so the bright head stays pinned to the
    // lantern and the tail always fades at the tip.
    function beamWedgePath(hw0, hw1) {
        return 'M0,' + (-hw0).toFixed(2) +
            ' Q50,' + (-hw1 * 1.14).toFixed(2) + ' 100,' + (-hw1).toFixed(2) +
            ' Q' + (100 + hw1 * 0.9).toFixed(2) + ',0 100,' + hw1.toFixed(2) +
            ' Q50,' + (hw1 * 1.14).toFixed(2) + ' 0,' + hw0.toFixed(2) +
            ' Q' + (-hw0 * 1.5).toFixed(2) + ',0 0,' + (-hw0).toFixed(2) + 'Z';
    }

    // -- Easter eggs -------------------------------------------------------
    var KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown',
                  'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];

    // Morse pattern string ('.'/'-' separated by spaces between letters) → timed on/off
    // segments. unit = one Morse time unit in ms; symbol gap 1u, letter gap 3u.
    function buildMorseSegments(pattern, unit) {
        var segs = []; // [durationMs, on?1:0]
        var chars = pattern.split('');
        for (var i = 0; i < chars.length; i++) {
            if (chars[i] === ' ') continue;
            segs.push([chars[i] === '-' ? 3 * unit : unit, 1]);
            var next = chars[i + 1];
            if (next === ' ') { segs.push([3 * unit, 0]); i++; }
            else if (next != null) segs.push([unit, 0]);
        }
        return segs;
    }

    // Lamp state at ms into the signal: 1 on, 0 off, -1 = transmission finished.
    function morseGate(segs, ms) {
        var t = 0;
        for (var i = 0; i < segs.length; i++) {
            t += segs[i][0];
            if (ms < t) return segs[i][1];
        }
        return -1;
    }

    var _counter = 0;

    function assign(dst, src) { for (var k in src) { if (src.hasOwnProperty(k)) dst[k] = src[k]; } return dst; }

    // Default options — documented in the JSDoc above the constructor.
    var DEFAULTS = {
        theme: 'dark',
        mode: 'rotate',
        beamPeriod: 7.5,
        beamCount: 2,
        beamElev: 0.26,
        beamLen: 190,
        beamApexHw: 2.3,
        beamTipHw: 7.0,
        beamWidBoost: 1.2,
        beamMinBright: 0.3,
        beamMaxBright: 1.0,
        beamHazeScale: 2.2,
        beamHazeOpacity: 0.5,
        passSigma: 0.16,
        bloomRadius: 78,
        bloomPeak: 0.95,
        flareRx: 88,
        flareRy: 2.6,
        flarePeak: 0.85,
        washRadius: 180,
        washPeak: 0.2,
        coreRadius: 3.4,
        pilotRadius: 8,
        pilotOpacity: 0.6,
        haloRadius: 60,
        shockColor: null,
        shockMax: 130,
        flashDuration: 0.85,
        waveSpeed: 16,
        waveFeather: 0.12,
        rayGlow: 0.9,
        waveGlintPeak: 0.45,
        waveGlintTravel: 100,
        ambient: true,
        aimSensitivity: 55,
        aimElevSpan: 55,
        beamNodAmp: 0.07,
        beamNodPeriod: 5.3,
        clickBoost: 2.4,
        boostDecay: 1.9,
        holdDelay: 550,
        morsePattern: '... --- ...',
        morseUnit: 95,
        partyDuration: 8000,
        partySpin: 2.6,
        delay: 0
    };

    // Options baked into the SVG markup at build time — changing them via configure()
    // rebuilds the icon in place (animation state is preserved).
    var STRUCTURAL_OPTS = {};
    ['theme', 'beamCount', 'beamApexHw', 'beamTipHw', 'beamHazeScale', 'beamHazeOpacity',
     'bloomRadius', 'washRadius', 'haloRadius', 'pilotRadius', 'flareRy', 'waveSpeed',
     'waveFeather', 'ambient', 'shockColor'].forEach(function (k) { STRUCTURAL_OPTS[k] = 1; });

    /**
     * Lighthouse — animated Metanorma icon.
     *
     *     var lh = new Lighthouse('#icon', { theme: 'dark', beamPeriod: 6.5 });
     *
     * Interactions: move to aim (X sweeps, Y pitches) · quick click kicks the beacon ·
     * long-press signals Morse SOS · Konami code triggers party mode. In the light
     * ("morning") theme the lamp rests until an interaction wakes it.
     *
     * Options (defaults in brackets; units are the 147.4 × 147.4 icon space):
     *
     *   Scene
     *     theme 'dark'|'light'|object ['dark']   named scene, or a custom palette (below)
     *     mode 'rotate'|'static' ['rotate']  animated vs. frozen icon
     *     delay [0]                          ms before the animation starts
     *   Rotation
     *     beamPeriod [7.5]                   seconds per revolution (`period` is an alias)
     *     beamCount [2]                      lens panels, evenly spaced (2 = double flash)
     *     beamElev [0.26]                    beam tilt up into the sky (rise/run)
     *     beamNodAmp / beamNodPeriod [0.07 / 5.3]   gentle idle nod
     *   Beam shape
     *     beamLen [190]                      reach at sideways (foreshortened in 3D)
     *     beamApexHw / beamTipHw [2.3 / 7.0] wedge half-width at source / tip
     *     beamWidBoost [1.2]                 cone opens as it faces the viewer
     *     beamMinBright / beamMaxBright [0.3 / 1.0]   wedge opacity back / front
     *     beamHazeScale / beamHazeOpacity [2.2 / 0.5]   atmospheric skirt
     *   The pass — beam pointing at the viewer; flash factor G = exp(−(Δφ/passSigma)²)
     *     passSigma [0.16]                   flash width in radians
     *     bloomRadius / bloomPeak [78 / 0.95]       lantern bloom disc
     *     flareRx / flareRy / flarePeak [88 / 2.6 / 0.85]   anamorphic streak
     *     washRadius / washPeak [180 / 0.2]  scene-wide light wash
     *     coreRadius [3.4]                   hot lamp core
     *   Lamp
     *     pilotRadius / pilotOpacity [8 / 0.6]    always-on glow
     *     restLevel [theme: 1 dark, 0.05 light]   lamp level with no interaction
     *   Icon response
     *     rayGlow [0.9]                      shine-strip glint strength
     *     waveGlintPeak / waveGlintTravel [0.45 / 100]   water reflection
     *   Wave
     *     waveSpeed [16]                     units / second
     *     waveFeather [0.12]                 bottom fade height (fraction of icon height)
     *   Interaction
     *     aimSensitivity / aimElevSpan [55 / 55]  cursor → sweep / pitch range
     *     clickBoost / boostDecay [2.4 / 1.9]     spin kick on click
     *     holdDelay [550]                    ms until a press becomes a Morse signal
     *     morsePattern / morseUnit ['... --- ...' / 95]
     *   Click flash
     *     haloRadius / haloPeak [60 / theme: 1 dark, 0.7 light]
     *     shockColor / shockMax / flashDuration [theme.shock / 130 / 0.85 s]
     *   Fun
     *     ambient [true]                     shooting star (dark) / gulls (light)
     *     partyDuration / partySpin [8000 / 2.6]  Konami party mode
     *
     * Custom palettes — pass an object as `theme`; any key not given falls back to
     * `base` ('dark' unless specified):
     *
     *     theme: {
     *       base: 'dark'|'light',
     *       beam, beamGlow, beamTail, halo, shock,     // light colors
     *       body | bodyFrom+bodyTo | bodyStops+bodyGrad,  // tower: flat, 2-stop, or full
     *       wave | waveFrom+waveTo | waveStops,           // sea:   flat, 2-stop, or full
     *       day: bool,   // morning behaviors (gulls, sun glitter, resting lamp);
     *                  // defaults to base === 'light'
     *       rest, haloPeak   // behavior overrides (see Lamp / Click flash)
     *     }
     *     e.g. new Lighthouse('#el', { theme: { base: 'dark', beam: '#bfefff',
     *          waveFrom: '#3a7bd5', waveTo: '#0b2a5b' } })
     *
     * Derivation rules: `period` aliases `beamPeriod`; haloPeak and restLevel default
     * from the theme; bloomPeak/flarePeak/washPeak scale with haloPeak. An option set
     * explicitly (constructor or configure()) always wins over a derived value.
     *
     * Methods: configure(opts) · getOptions() · setMode(mode) · start() · destroy()
     */
    function Lighthouse(container, opts) {
        if (typeof container === 'string') container = document.querySelector(container);
        if (!container) throw new Error('Lighthouse: container not found');

        this._id = 'lh' + (++_counter);
        this._container = container;
        this._explicit = assign({}, opts); // user-set keys — always win in derivation
        this._opts = assign(assign({}, DEFAULTS), opts);
        this._resolveDerived();

        this._raf = null;
        this._start = 0;
        this._lastTick = 0;
        this._autoElapsed = 0;
        this._tracking = false;
        this._cursorDx = 0;
        this._cursorDy = 0;
        this._flashStart = -1;
        this._elev = this._opts.beamElev;                  // smoothed beam pitch
        this._phase = Math.PI / 2 - Math.PI * 2 * 0.12;    // first pass ~12% in
        this._spinBoost = 0;
        this._pressStart = -1;
        this._pressTO = null;
        this._morseStart = -1;
        this._morseSegs = null;
        this._partyUntil = -1;
        this._konamiIdx = 0;
        this._waveAnim = null;
        this._ambientAnims = [];

        this._build();
        this._start = performance.now() + this._opts.delay;
        this._lastTick = this._start;
        this._tick = this._tick.bind(this);
        this._onMove = this._onMove.bind(this);
        this._onLeave = this._onLeave.bind(this);
        this._onDown = this._onDown.bind(this);
        this._onUp = this._onUp.bind(this);
        this._onKey = this._onKey.bind(this);
        this._attach();
        this._raf = requestAnimationFrame(this._tick);
    }

    // Resolves the effective palette into this._theme (+ this._day for day/night
    // behavior), then the theme-dependent derived options. Explicit settings
    // (constructor or configure()) always win. Runs from the constructor and configure().
    Lighthouse.prototype._resolveDerived = function () {
        var o = this._opts, ex = this._explicit;
        var t = o.theme, th, day;
        if (typeof t === 'string') {
            th = THEMES[t];
            if (!th) throw new Error('Lighthouse: unknown theme "' + t + '" (expected "dark", "light", or a palette object)');
            day = t === 'light';
        } else if (t && typeof t === 'object') {
            var baseName = t.base || 'dark';
            var base = THEMES[baseName];
            if (!base) throw new Error('Lighthouse: unknown base theme "' + baseName + '" (expected "dark" or "light")');
            th = assign(assign({}, base), t);
            delete th.base;
            // flat shorthands expand into gradient stops (full stop arrays win)
            if (!t.bodyStops) {
                if (t.body) th.bodyStops = [{ o: '0', c: t.body }];
                if (t.bodyFrom || t.bodyTo) th.bodyStops = [{ o: '0', c: t.bodyFrom || t.bodyTo }, { o: '1', c: t.bodyTo || t.bodyFrom }];
            }
            if (!t.waveStops) {
                if (t.wave) th.waveStops = [{ o: '0', c: t.wave }];
                if (t.waveFrom || t.waveTo) th.waveStops = [{ o: '0', c: t.waveFrom || t.waveTo }, { o: '1', c: t.waveTo || t.waveFrom }];
            }
            day = t.day != null ? !!t.day : baseName === 'light';
        } else {
            throw new Error('Lighthouse: theme must be "dark", "light", or a palette object');
        }
        this._theme = th;
        this._day = day;
        if (ex.period != null && ex.beamPeriod == null) o.beamPeriod = ex.period;
        o.haloPeak = ex.haloPeak != null ? ex.haloPeak : th.haloPeak;
        if (ex.bloomPeak == null) o.bloomPeak = DEFAULTS.bloomPeak * o.haloPeak;
        if (ex.flarePeak == null) o.flarePeak = DEFAULTS.flarePeak * o.haloPeak;
        if (ex.washPeak  == null) o.washPeak  = DEFAULTS.washPeak  * o.haloPeak;
        o.restLevel = ex.restLevel != null ? ex.restLevel : th.rest;
        if (this._wake == null) this._wake = o.restLevel;
    };

    Lighthouse.prototype._build = function () {
        var id = this._id;
        var th = this._theme; // resolved palette (named theme or custom object)
        var o = this._opts;

        // ---- defs ----
        var defs = '<defs>';

        // Body gradient (directional "isometric" shading) + silhouette clip
        defs += '<linearGradient id="' + id + '-body" x1="' + th.bodyGrad.x1 + '" y1="' + th.bodyGrad.y1 +
                '" x2="' + th.bodyGrad.x2 + '" y2="' + th.bodyGrad.y2 + '" gradientUnits="userSpaceOnUse">';
        for (var i = 0; i < th.bodyStops.length; i++) {
            defs += '<stop offset="' + th.bodyStops[i].o + '" stop-color="' + th.bodyStops[i].c + '"/>';
        }
        defs += '</linearGradient>';
        defs += '<clipPath id="' + id + '-silh"><path d="' + TOWER_PATH + '"/></clipPath>';
        defs += '<clipPath id="' + id + '-rays-l"><path d="' + RAYS_L_PATH + '"/></clipPath>';
        defs += '<clipPath id="' + id + '-rays-r"><path d="' + RAYS_R_PATH + '"/></clipPath>';
        // No frame clipPath — let the halo overflow the top of the viewBox (set SVG overflow="visible").

        // Beam gradients run along the canonical wedge (0 → 100 on x) in userSpaceOnUse,
        // so the transformed group they sit in carries them around.
        defs += '<linearGradient id="' + id + '-core" x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">' +
                '<stop offset="0%"   stop-color="' + th.beam + '" stop-opacity="1"/>' +
                '<stop offset="30%"  stop-color="' + th.beam + '" stop-opacity="0.75"/>' +
                '<stop offset="65%"  stop-color="' + th.beamTail + '" stop-opacity="0.42"/>' +
                '<stop offset="100%" stop-color="' + th.beamTail + '" stop-opacity="0"/>' +
            '</linearGradient>';
        defs += '<linearGradient id="' + id + '-haze" x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">' +
                '<stop offset="0%"   stop-color="' + th.beamTail + '" stop-opacity="0.65"/>' +
                '<stop offset="45%"  stop-color="' + th.beamTail + '" stop-opacity="0.28"/>' +
                '<stop offset="100%" stop-color="' + th.beamTail + '" stop-opacity="0"/>' +
            '</linearGradient>';

        // Soft blur for whole beam groups (core + haze together)
        defs += '<filter id="' + id + '-beam-blur" x="-30%" y="-30%" width="160%" height="160%">' +
                    '<feGaussianBlur stdDeviation="2"/>' +
                '</filter>';

        // Bloom gradient — the "looking into the lamp" disc during the pass
        defs += '<radialGradient id="' + id + '-bloom" cx="' + LANTERN_X + '" cy="' + LANTERN_Y +
                '" r="' + o.bloomRadius + '" gradientUnits="userSpaceOnUse">' +
                '<stop offset="0%"   stop-color="' + th.halo + '" stop-opacity="1"/>' +
                '<stop offset="30%"  stop-color="' + th.halo + '" stop-opacity="0.5"/>' +
                '<stop offset="65%"  stop-color="' + th.beamTail + '" stop-opacity="0.14"/>' +
                '<stop offset="100%" stop-color="' + th.beamTail + '" stop-opacity="0"/>' +
            '</radialGradient>';

        // Ray glint gradient — warm light emanating outward from the lantern over the
        // shine strips; the beam direction drives how much each side lights up.
        defs += '<radialGradient id="' + id + '-rayglint" cx="' + LANTERN_X + '" cy="' + LANTERN_Y +
                '" r="82" gradientUnits="userSpaceOnUse">' +
                '<stop offset="0%"   stop-color="' + th.beam + '" stop-opacity="0.95"/>' +
                '<stop offset="45%"  stop-color="' + th.beam + '" stop-opacity="0.4"/>' +
                '<stop offset="100%" stop-color="' + th.beamTail + '" stop-opacity="0"/>' +
            '</radialGradient>';

        // Wash gradient — faint light in the air over the whole scene during the pass
        defs += '<radialGradient id="' + id + '-wash" cx="' + LANTERN_X + '" cy="' + LANTERN_Y +
                '" r="' + o.washRadius + '" gradientUnits="userSpaceOnUse">' +
                '<stop offset="0%"   stop-color="' + th.halo + '" stop-opacity="0.9"/>' +
                '<stop offset="40%"  stop-color="' + th.halo + '" stop-opacity="0.35"/>' +
                '<stop offset="100%" stop-color="' + th.beamTail + '" stop-opacity="0"/>' +
            '</radialGradient>';

        // Tight blur for the anamorphic flare and the lamp core
        defs += '<filter id="' + id + '-flare-blur" x="-60%" y="-60%" width="220%" height="220%">' +
                    '<feGaussianBlur stdDeviation="1.5"/>' +
                '</filter>';

        // Halo gradient (click flash)
        defs += '<radialGradient id="' + id + '-halo" cx="' + LANTERN_X + '" cy="' + LANTERN_Y +
                '" r="' + o.haloRadius + '" gradientUnits="userSpaceOnUse">' +
                '<stop offset="0%"   stop-color="' + th.halo + '" stop-opacity="1"/>' +
                '<stop offset="35%"  stop-color="' + th.halo + '" stop-opacity="0.55"/>' +
                '<stop offset="70%"  stop-color="' + th.beamGlow + '" stop-opacity="0.18"/>' +
                '<stop offset="100%" stop-color="' + th.beamGlow + '" stop-opacity="0"/>' +
            '</radialGradient>';

        // Pilot glow gradient (tight, just a soft dot)
        defs += '<radialGradient id="' + id + '-pilot" cx="' + LANTERN_X + '" cy="' + LANTERN_Y +
                '" r="' + o.pilotRadius + '" gradientUnits="userSpaceOnUse">' +
                '<stop offset="0%"   stop-color="' + th.halo + '" stop-opacity="1"/>' +
                '<stop offset="60%"  stop-color="' + th.halo + '" stop-opacity="0.55"/>' +
                '<stop offset="100%" stop-color="' + th.halo + '" stop-opacity="0"/>' +
            '</radialGradient>';

        // Wave mask: crisp clip at the icon's left/right/top, soft fade ONLY at the
        // bottom edge — a plain gradient, no blur filter (a gaussian blur over the
        // whole moving water block is a per-frame compute hog and fuzzes the crest).
        // Opaque all the way through the viewBox bottom so the lighthouse base
        // diamonds stay hidden, then dissolves over `waveFeather` below it.
        var fadeY0 = VB_H;
        var fadeY1 = VB_H + o.waveFeather * VB_H;
        defs += '<linearGradient id="' + id + '-wave-fade" x1="0" y1="' + fadeY0.toFixed(2) +
                '" x2="0" y2="' + fadeY1.toFixed(2) + '" gradientUnits="userSpaceOnUse">' +
                '<stop offset="0" stop-color="#fff"/>' +
                '<stop offset="1" stop-color="#fff" stop-opacity="0"/>' +
            '</linearGradient>';
        defs += '<mask id="' + id + '-wave-mask" maskUnits="userSpaceOnUse" ' +
                    'x="0" y="-200" width="' + VB_W + '" height="600">' +
                    '<rect x="0" y="-200" width="' + VB_W + '" height="600" ' +
                        'fill="url(#' + id + '-wave-fade)"/>' +
                '</mask>';

        // Wave gradient — vertical in the wave path's LOCAL frame (lit crest → deep
        // water). The range ends just past the viewBox bottom so the deep color is
        // actually visible inside the icon (and dissolves into the mask fade).
        defs += '<linearGradient id="' + id + '-wave-grad" x1="0" y1="16" x2="0" y2="60" gradientUnits="userSpaceOnUse">';
        for (var wv = 0; wv < th.waveStops.length; wv++) {
            defs += '<stop offset="' + th.waveStops[wv].o + '" stop-color="' + th.waveStops[wv].c + '"/>';
        }
        defs += '</linearGradient>';
        defs += '</defs>';

        // ---- beam groups ----
        // Each beam gets a BACK copy (under the tower) and a FRONT copy (over it); their
        // opacities are crossfaded by depth every frame, so the beam visibly passes behind
        // the lighthouse and sweeps in front of it. Each copy is a bright core wedge plus
        // a wider, dimmer haze skirt.
        var coreD = beamWedgePath(o.beamApexHw, o.beamTipHw);
        var hazeD = beamWedgePath(o.beamApexHw * 1.6, o.beamTipHw * o.beamHazeScale);
        var backBeams = '', frontBeams = '';
        for (var b = 0; b < o.beamCount; b++) {
            var pair =
                '<path d="' + hazeD + '" fill="url(#' + id + '-haze)" fill-opacity="' + o.beamHazeOpacity + '"/>' +
                '<path d="' + coreD + '" fill="url(#' + id + '-core)"/>';
            backBeams  += '<g class="lh-beam-back" opacity="0" filter="url(#' + id + '-beam-blur)">' + pair + '</g>';
            frontBeams += '<g class="lh-beam-front" opacity="0" filter="url(#' + id + '-beam-blur)">' + pair + '</g>';
        }

        // Tower body + the six shine strips, all filled with the same directional body
        // gradient so the icon looks exactly as before — the strips just get their own
        // geometry so a glint overlay can light them with the beam.
        var bodyHtml = '<rect x="0" y="0" width="' + VB_W + '" height="' + VB_H +
                       '" fill="url(#' + id + '-body)" clip-path="url(#' + id + '-silh)"/>' +
                       '<rect x="0" y="0" width="' + VB_W + '" height="' + VB_H +
                       '" fill="url(#' + id + '-body)" clip-path="url(#' + id + '-rays-l)"/>' +
                       '<rect x="0" y="0" width="' + VB_W + '" height="' + VB_H +
                       '" fill="url(#' + id + '-body)" clip-path="url(#' + id + '-rays-r)"/>';

        // The pass: bloom disc + anamorphic streak + hot lamp core (all driven by facing)
        var passHtml =
            // glint overlays on the shine strips — opacity follows the beam direction
            '<rect class="lh-rayglint-l" x="0" y="0" width="' + VB_W + '" height="' + VB_H +
                '" fill="url(#' + id + '-rayglint)" clip-path="url(#' + id + '-rays-l)" opacity="0"/>' +
            '<rect class="lh-rayglint-r" x="0" y="0" width="' + VB_W + '" height="' + VB_H +
                '" fill="url(#' + id + '-rayglint)" clip-path="url(#' + id + '-rays-r)" opacity="0"/>' +
            '<circle class="lh-bloom" cx="' + LANTERN_X + '" cy="' + LANTERN_Y +
                '" r="' + o.bloomRadius + '" fill="url(#' + id + '-bloom)" opacity="0"/>' +
            '<ellipse class="lh-flare" cx="' + LANTERN_X + '" cy="' + LANTERN_Y +
                '" rx="' + o.flareRx + '" ry="' + o.flareRy + '" fill="' + th.beam +
                '" filter="url(#' + id + '-flare-blur)" opacity="0"/>' +
            '<circle class="lh-core" cx="' + LANTERN_X + '" cy="' + LANTERN_Y +
                '" r="' + o.coreRadius + '" fill="' + th.beam +
                '" filter="url(#' + id + '-flare-blur)" opacity="0.45"/>';

        var haloHtml = '<circle class="lh-halo" cx="' + LANTERN_X + '" cy="' + LANTERN_Y +
                       '" r="' + o.haloRadius + '" fill="url(#' + id + '-halo)" opacity="0"/>' +
                       // pilot glow — always visible at low opacity, never lets the icon go fully dark
                       '<circle class="lh-pilot" cx="' + LANTERN_X + '" cy="' + LANTERN_Y +
                       '" r="' + o.pilotRadius + '" fill="url(#' + id + '-pilot)" opacity="' + o.pilotOpacity + '"/>' +
                       // shock ring — only visible during click flash
                       '<circle class="lh-shock" cx="' + LANTERN_X + '" cy="' + LANTERN_Y +
                       '" r="0" fill="none" stroke="' + (o.shockColor || th.shock) +
                       '" stroke-width="1.5" opacity="0"/>';

        // Wave: ONE continuous path covering several periods. No tile boundaries = no seams.
        // Crisp on every edge except the bottom (gradient mask); the shift group is
        // animated on the compositor via WAAPI — no per-frame JS, no blur re-rendering.
        var waveFullPath = buildWavePath(NUM_WAVE_PERIODS);
        var waveHtml = '<g class="lh-wave" mask="url(#' + id + '-wave-mask)">' +
            '<g class="lh-wave-shift" transform="translate(' + (-WAVE_TILE_W).toFixed(2) + ',' + WAVE_BASELINE_DY + ')">' +
                '<path d="' + waveFullPath + '" fill="url(#' + id + '-wave-grad)"/>' +
            '</g>' +
            // light glitter on the water — follows the beam by night, sits as sun
            // glitter by day; inside the wave mask so it fades with the bottom edge
            '<ellipse class="lh-waveglint" cx="' + LANTERN_X + '" cy="112" rx="24" ry="4.5" ' +
                'fill="' + th.beam + '" filter="url(#' + id + '-beam-blur)" opacity="0"/>' +
        '</g>';

        // Ambient surprises — shooting star by night, gulls by day (pure WAAPI loops)
        var ambientHtml = '';
        if (o.ambient) {
            if (!this._day) {
                ambientHtml = '<path class="lh-star" d="M0,0 l14,-5" stroke="' + th.beam +
                    '" stroke-width="1.1" stroke-linecap="round" fill="none" opacity="0"/>';
            } else {
                ambientHtml = '<path class="lh-gulls" d="M0,0 q3,-3.5 6,0 q3,-3.5 6,0 M17,4.5 q2.5,-3 5,0 q2.5,-3 5,0" ' +
                    'stroke="#9aa0c9" stroke-width="1.1" fill="none" stroke-linecap="round" opacity="0"/>';
            }
        }

        // Scene-wide atmospheric wash — last, so the light sits in front of everything
        // during the pass (like haze catching the beam as it sweeps past the camera).
        var washHtml = '<circle class="lh-wash" cx="' + LANTERN_X + '" cy="' + LANTERN_Y +
                       '" r="' + o.washRadius + '" fill="url(#' + id + '-wash)" opacity="0"/>';

        // ---- assemble ----
        // SVG overflow="visible" + no frame clipPath lets the halo (and shock ring on click)
        // extend above the viewBox top, and lets the wave's blurred edges spill softly.
        this._container.innerHTML =
            '<svg viewBox="0 0 ' + VB_W + ' ' + VB_H + '" xmlns="http://www.w3.org/2000/svg" ' +
                'preserveAspectRatio="xMidYMid meet" overflow="visible">' +
                defs +
                backBeams +
                ambientHtml +
                bodyHtml +
                frontBeams +
                passHtml +
                haloHtml +
                waveHtml +
                washHtml +
            '</svg>';

        var svg = this._container.querySelector('svg');
        this._svg = svg;
        var backs = svg.querySelectorAll('.lh-beam-back');
        var fronts = svg.querySelectorAll('.lh-beam-front');
        this._beams = [];
        for (var b2 = 0; b2 < backs.length; b2++) {
            this._beams.push({ back: backs[b2], front: fronts[b2] });
        }
        this._bloom = svg.querySelector('.lh-bloom');
        this._flare = svg.querySelector('.lh-flare');
        this._core = svg.querySelector('.lh-core');
        this._wash = svg.querySelector('.lh-wash');
        this._haloEl = svg.querySelector('.lh-halo');
        this._pilotEl = svg.querySelector('.lh-pilot');
        this._shockEl = svg.querySelector('.lh-shock');
        this._waveShift = svg.querySelector('.lh-wave-shift');
        this._rayGlintL = svg.querySelector('.lh-rayglint-l');
        this._rayGlintR = svg.querySelector('.lh-rayglint-r');
        this._waveGlint = svg.querySelector('.lh-waveglint');

        // The wave shift runs on the compositor via WAAPI — a pure transform loop that
        // needs no per-frame JS. One tile of travel per iteration; the path is periodic,
        // so the loop wraps seamlessly. (Engines without WAAPI fall back to the rAF
        // update in _tick.)
        if (this._waveShift.animate) {
            this._waveAnim = this._waveShift.animate(
                [{ transform: 'translate(0px,' + WAVE_BASELINE_DY + 'px)' },
                 { transform: 'translate(' + (-WAVE_TILE_W) + 'px,' + WAVE_BASELINE_DY + 'px)' }],
                { duration: WAVE_TILE_W / o.waveSpeed * 1000, iterations: Infinity, delay: o.delay });
            if (o.mode === 'static') this._waveAnim.pause();
        }

        // Ambient surprises — compositor-driven loops that are visible only in a small
        // slice of their timeline (a shooting star every ~24 s, gulls drifting past
        // every ~38 s), so they stay rare and delightful.
        var star = svg.querySelector('.lh-star');
        if (star && star.animate) {
            this._ambientAnims.push(star.animate([
                { transform: 'translate(168px,-8px)', opacity: 0 },
                { transform: 'translate(128px,10px)', opacity: 0.9, offset: 0.018 },
                { transform: 'translate(-24px,62px)', opacity: 0, offset: 0.05 },
                { transform: 'translate(-24px,62px)', opacity: 0, offset: 1 }
            ], { duration: 24000, iterations: Infinity, delay: 6000 }));
        }
        var gulls = svg.querySelector('.lh-gulls');
        if (gulls && gulls.animate) {
            this._ambientAnims.push(gulls.animate([
                { transform: 'translate(165px,20px)', opacity: 0 },
                { transform: 'translate(130px,24px)', opacity: 0.55, offset: 0.12 },
                { transform: 'translate(40px,30px)', opacity: 0.55, offset: 0.55 },
                { transform: 'translate(-35px,36px)', opacity: 0, offset: 0.75 },
                { transform: 'translate(-35px,36px)', opacity: 0, offset: 1 }
            ], { duration: 38000, iterations: Infinity, delay: 3000 }));
        }
        if (o.mode === 'static') {
            for (var a = 0; a < this._ambientAnims.length; a++) this._ambientAnims[a].pause();
        }
    };

    Lighthouse.prototype._attach = function () {
        this._container.addEventListener('pointermove', this._onMove);
        this._container.addEventListener('pointerleave', this._onLeave);
        this._container.addEventListener('pointerdown', this._onDown);
        this._container.addEventListener('pointerup', this._onUp);
        this._container.addEventListener('pointercancel', this._onUp);
        document.addEventListener('keydown', this._onKey);
    };

    Lighthouse.prototype._detach = function () {
        this._container.removeEventListener('pointermove', this._onMove);
        this._container.removeEventListener('pointerleave', this._onLeave);
        this._container.removeEventListener('pointerdown', this._onDown);
        this._container.removeEventListener('pointerup', this._onUp);
        this._container.removeEventListener('pointercancel', this._onUp);
        document.removeEventListener('keydown', this._onKey);
    };

    Lighthouse.prototype._onMove = function (e) {
        var rect = this._svg.getBoundingClientRect();
        if (rect.width <= 0) return;
        this._cursorDx = (e.clientX - rect.left) * (VB_W / rect.width) - LANTERN_X;
        this._cursorDy = (e.clientY - rect.top) * (VB_H / rect.height) - LANTERN_Y;
        this._tracking = true;
    };

    Lighthouse.prototype._onLeave = function () {
        this._tracking = false;
        this._cancelPress();
    };

    Lighthouse.prototype._cancelPress = function () {
        if (this._pressTO) { clearTimeout(this._pressTO); this._pressTO = null; }
        this._pressStart = -1;
    };

    Lighthouse.prototype._onDown = function (e) {
        this._pressStart = performance.now();
        // keep receiving events if a long-press drifts off the icon
        try { this._container.setPointerCapture(e.pointerId); } catch (err) {}
        var self = this;
        this._pressTO = setTimeout(function () {
            self._pressTO = null;
            self._morseStart = performance.now(); // long-press → start signaling
        }, this._opts.holdDelay);
    };

    Lighthouse.prototype._onUp = function () {
        if (this._pressTO) { clearTimeout(this._pressTO); this._pressTO = null; }
        if (this._pressStart < 0) return;
        var held = performance.now() - this._pressStart;
        this._pressStart = -1;
        if (held < this._opts.holdDelay) {
            // quick click — flash and kick the beacon
            this._flashStart = performance.now();
            this._spinBoost += this._opts.clickBoost;
        }
    };

    Lighthouse.prototype._onKey = function (e) {
        var k = (e.key || '').toLowerCase();
        if (k === KONAMI[this._konamiIdx]) this._konamiIdx++;
        else this._konamiIdx = k === KONAMI[0] ? 1 : 0;
        if (this._konamiIdx === KONAMI.length) {
            this._konamiIdx = 0;
            this._partyUntil = performance.now() + this._opts.partyDuration;
        }
    };

    // -- Animation loop --------------------------------------------------
    // Each beam is a 3D cone rotating about the vertical axis at constant speed:
    //
    //   direction d(φ) = (cos φ, elev, sin φ)   — viewer looks down −z, so sin φ > 0
    //   means the beam is in the front hemisphere, sin φ = 1 pointing at the viewer.
    //
    // Orthographic projection onto the screen supplies the cinematic motion for free:
    //   - Sideways (cos φ ≈ ±1): the beam lies flat, fully extended, and its tip stalls —
    //     it "rests" along the horizon.
    //   - Approaching the viewer: the beam foreshortens and REARS UP toward vertical
    //     (on-screen angle ≈ atan2(−elev, cos φ)), then whips through the overhead.
    //   - The pass (φ ≈ π/2): a gaussian flash factor G = exp(−(Δφ/σ)²) spikes around
    //     exact beam/viewer alignment — bloom (∝ G), anamorphic streak (∝ G³), atmospheric
    //     wash (∝ G²) — looking straight into the lamp for one beat before the beam
    //     swings away. (sin φ alone is too flat near its peak; the gaussian keeps the
    //     flash brief and the sky dark either side of it.)
    //
    // Depth layering: every beam has a copy under the tower and a copy over it, crossfaded
    // by sin φ, so beams pass behind the lighthouse and in front of it.
    Lighthouse.prototype._tick = function (now) {
        var dt = (now - this._lastTick) / 1000;
        this._lastTick = now;
        var el = (now - this._start) / 1000;
        if (el < 0) { this._raf = requestAnimationFrame(this._tick); return; }

        var o = this._opts;

        if (o.mode !== 'static') {
            if (!this._tracking) this._autoElapsed += dt;

            var TWO_PI = Math.PI * 2;

            // Party mode (Konami) — fast spin + hue rotation for a few seconds
            var party = now < this._partyUntil;
            if (party) {
                this._svg.style.filter = 'hue-rotate(' + ((now / 20) % 360).toFixed(1) + 'deg)';
            } else if (this._svg.style.filter) {
                this._svg.style.filter = '';
            }

            // Pitch: cursor Y aims the beam while tracking; otherwise the beacon nods gently
            var elevTarget;
            if (this._tracking) {
                elevTarget = o.beamElev - (this._cursorDy / o.aimElevSpan) * 0.35;
                elevTarget = Math.max(-0.2, Math.min(0.65, elevTarget));
            } else {
                elevTarget = o.beamElev + o.beamNodAmp * Math.sin(TWO_PI * this._autoElapsed / o.beamNodPeriod);
            }
            this._elev += (elevTarget - this._elev) * Math.min(1, dt * 7);
            var elev = this._elev;
            var invNorm = 1 / Math.sqrt(1 + elev * elev);
            var sxBase = o.beamLen / 100; // canonical wedge is 100 units long

            // Spin: the phase is integrated (not derived from absolute time) so click
            // kicks can inject decaying angular velocity
            this._spinBoost *= Math.exp(-dt * o.boostDecay);
            if (!this._tracking) {
                this._phase += dt * (TWO_PI / o.beamPeriod * (party ? o.partySpin : 1) + this._spinBoost);
            }

            var phi0;
            if (this._tracking) {
                // Cursor stays in the front hemisphere: p = -1 (LEFT) → φ = π,
                // p = +1 (RIGHT) → φ = 0, p = 0 (FORWARD) → φ = π/2.
                var p = Math.max(-1, Math.min(1, this._cursorDx / o.aimSensitivity));
                phi0 = (1 - p) * Math.PI / 2;
            } else {
                phi0 = this._phase;
            }

            // Morse signal gate (long-press): multiplies every light in the scene
            var gate = 1;
            if (this._morseStart >= 0) {
                if (!this._morseSegs) this._morseSegs = buildMorseSegments(o.morsePattern, o.morseUnit);
                var mg = morseGate(this._morseSegs, now - this._morseStart);
                if (mg < 0) { this._morseStart = -1; }
                else gate = mg ? 1 : 0.04;
            }

            // Lamp duty cycle — a real lighthouse is dark by day. In the morning theme
            // the lamp rests at `restLevel` (beams a ghost shimmer, no flash) until the
            // user wakes it (aim, click, signal, party); at night it is always on duty.
            var awake = this._tracking || this._morseStart >= 0 || party ||
                        this._spinBoost > 0.05 || this._flashStart >= 0;
            var wakeTarget = awake ? 1 : o.restLevel;
            var wakeRate = wakeTarget > this._wake ? 5 : 0.8; // wakes fast, dozes slowly
            this._wake += (wakeTarget - this._wake) * Math.min(1, dt * wakeRate);
            var wake = this._wake;

            var F = 0; // broad facing across beams — wedge brightness/width/layering
            var G = 0; // gaussian flash factor — drives the pass surge
            var glowL = 0, glowR = 0; // shine-strip glow per side, from beam direction
            var glowW = 0, bestC = 0; // water glint strength/position from dominant beam
            for (var b = 0; b < this._beams.length; b++) {
                var phi = phi0 + b * TWO_PI / this._beams.length;
                var s = Math.sin(phi), c = Math.cos(phi);
                var facing = s > 0 ? s : 0;
                if (facing > F) F = facing;
                var beamB = (s + 1) / 2;
                if (c < 0) { if (-c * beamB > glowL) glowL = -c * beamB; }
                else       { if ( c * beamB > glowR) glowR =  c * beamB; }
                if (Math.abs(c) * beamB > glowW) { glowW = Math.abs(c) * beamB; bestC = c; }
                // angular distance from pointing straight at the viewer (φ = π/2 mod 2π)
                var dp = phi % TWO_PI; if (dp < 0) dp += TWO_PI;
                dp = Math.abs(dp - Math.PI / 2);
                if (dp > Math.PI) dp = TWO_PI - dp;
                var g = Math.exp(-(dp * dp) / (o.passSigma * o.passSigma));
                if (g > G) G = g;

                // projection: foreshortened length, on-screen angle, cone opening
                var lenF = Math.sqrt(c * c + elev * elev) * invNorm;
                var deg = Math.atan2(-elev, c) * 180 / Math.PI;
                var widF = 1 + o.beamWidBoost * facing * facing;
                var t = 'translate(' + LANTERN_X + ',' + LANTERN_Y + ')' +
                        ' rotate(' + deg.toFixed(2) + ')' +
                        ' scale(' + (lenF * sxBase).toFixed(3) + ',' + widF.toFixed(3) + ')';

                var bright = (o.beamMinBright + (o.beamMaxBright - o.beamMinBright) * (s + 1) / 2) * gate * wake;
                // depth split: m → 1 front copy only, m → 0 back copy only (smoothstepped)
                var m = 0.5 + 2.6 * s;
                m = m < 0 ? 0 : m > 1 ? 1 : m;
                m = m * m * (3 - 2 * m);

                var beam = this._beams[b];
                beam.front.setAttribute('transform', t);
                beam.front.setAttribute('opacity', (bright * m).toFixed(3));
                beam.back.setAttribute('transform', t);
                beam.back.setAttribute('opacity', (bright * (1 - m)).toFixed(3));
            }

            // The pass — the flash surges with G so the light "finds" the viewer for one
            // beat, then releases. The lamp core blends broad facing with the flash.
            var f2 = F * F;
            var g2 = G * G;
            this._bloom.setAttribute('r', (o.bloomRadius * (0.6 + 0.4 * G)).toFixed(2));
            this._bloom.setAttribute('opacity', (o.bloomPeak * G * gate * wake).toFixed(3));
            this._flare.setAttribute('rx', (o.flareRx * (0.7 + 0.3 * G)).toFixed(2));
            this._flare.setAttribute('opacity', (o.flarePeak * g2 * G * gate * wake).toFixed(3));
            this._wash.setAttribute('opacity', (o.washPeak * g2 * gate * wake).toFixed(3));
            this._core.setAttribute('r', (o.coreRadius * (1 + 0.3 * F + 0.4 * G)).toFixed(2));
            this._core.setAttribute('opacity', (Math.min(1, 0.45 + 0.3 * f2 + 0.3 * G) * gate * wake).toFixed(3));
            // the pilot blinks along with the signal, dims when the lamp dozes, but
            // never fully dies
            this._pilotEl.setAttribute('opacity', (o.pilotOpacity * (0.4 + 0.6 * wake) * (0.15 + 0.85 * gate)).toFixed(3));

            // Shine strips — the glint follows the beam across the icon (left → center
            // → right): each side glows as the beam points at it, all pulse at the pass
            this._rayGlintL.setAttribute('opacity', (Math.min(1, o.rayGlow * Math.max(glowL, G)) * wake * gate).toFixed(3));
            this._rayGlintR.setAttribute('opacity', (Math.min(1, o.rayGlow * Math.max(glowR, G)) * wake * gate).toFixed(3));

            // Water glitter — the beam's reflection on the night sea; by day it sits
            // still as sun glitter (the sun needs no lamp)
            if (this._day) {
                this._waveGlint.setAttribute('cx', '56');
                this._waveGlint.setAttribute('opacity', (0.24 + 0.08 * Math.sin(el * 1.9)).toFixed(3));
            } else {
                // slide well past the icon edge, fading to zero before reaching it — the
                // glint drifts fully out of view instead of getting chopped by the wave
                // mask's crisp edge, and the dominant-beam handoff at the sideways
                // moment (bestC flips sign) happens while it is invisible
                var ac = Math.abs(bestC);
                var ef = (0.9 - ac) / 0.35; // 1 while ac ≤ 0.55, → 0 by ac = 0.9
                ef = ef < 0 ? 0 : ef > 1 ? 1 : ef;
                ef = ef * ef * (3 - 2 * ef);
                this._waveGlint.setAttribute('cx', (LANTERN_X + bestC * o.waveGlintTravel).toFixed(2));
                this._waveGlint.setAttribute('opacity', (glowW * o.waveGlintPeak * wake * gate * ef).toFixed(3));
            }

            // --- Halo: only active during click flash (no cycle-driven visibility) ---
            var flashElapsed = this._flashStart >= 0 ? (now - this._flashStart) / 1000 : -1;
            if (flashElapsed >= 0 && flashElapsed < o.flashDuration) {
                var fp = flashElapsed / o.flashDuration;
                var flashR  = o.haloRadius * (1 + fp * 1.6);
                var flashOp = fp < 0.15 ? 1 : Math.max(0, 1 - (fp - 0.15) / 0.85);
                this._haloEl.setAttribute('r', flashR.toFixed(2));
                this._haloEl.setAttribute('opacity', flashOp.toFixed(3));
                var shockR  = 6 + fp * o.shockMax;
                var shockOp = Math.max(0, 1 - fp) * 0.7;
                this._shockEl.setAttribute('r', shockR.toFixed(2));
                this._shockEl.setAttribute('opacity', shockOp.toFixed(3));
            } else {
                this._haloEl.setAttribute('opacity', '0');
                this._shockEl.setAttribute('opacity', '0');
                if (flashElapsed >= o.flashDuration) this._flashStart = -1;
            }

            // --- Wave: runs on the compositor via WAAPI (see _build); rAF fallback only ---
            if (!this._waveAnim) {
                var rawOffset = (el * o.waveSpeed) % WAVE_TILE_W;
                var tx = -WAVE_TILE_W + rawOffset;
                this._waveShift.setAttribute('transform',
                    'translate(' + tx.toFixed(2) + ',' + WAVE_BASELINE_DY + ')');
            }
        }

        this._raf = requestAnimationFrame(this._tick);
    };

    // -- Public API ------------------------------------------------------
    /**
     * Update options at runtime. Options consumed per frame (speeds, peaks,
     * sensitivities…) take effect immediately; structural ones (see STRUCTURAL_OPTS)
     * rebuild the icon in place, preserving animation state. Returns the instance.
     */
    Lighthouse.prototype.configure = function (opts) {
        if (!opts) return this;
        var prevMode = this._opts.mode;
        assign(this._explicit, opts);
        assign(this._opts, opts);
        this._resolveDerived();
        if (opts.mode != null && opts.mode !== prevMode) this.setMode(this._opts.mode);
        for (var k in opts) {
            if (opts.hasOwnProperty(k) && STRUCTURAL_OPTS[k]) { this._rebuild(); break; }
        }
        return this;
    };

    /** Returns a copy of the current, fully-resolved options. */
    Lighthouse.prototype.getOptions = function () {
        return assign({}, this._opts);
    };

    // Rebuilds the SVG in place (new defs/elements/animations) without touching the
    // animation clock or interaction state.
    Lighthouse.prototype._rebuild = function () {
        if (this._waveAnim) { this._waveAnim.cancel(); this._waveAnim = null; }
        for (var a = 0; a < this._ambientAnims.length; a++) this._ambientAnims[a].cancel();
        this._ambientAnims = [];
        this._build();
        if (this._opts.mode === 'static') this.setMode('static');
    };

    /** Switch between 'rotate' (animated) and 'static' (frozen) modes. */
    Lighthouse.prototype.setMode = function (mode) {
        if (this._raf) cancelAnimationFrame(this._raf);
        this._opts.mode = mode;
        if (mode === 'static') {
            this._svg.style.filter = '';
            if (this._waveAnim) this._waveAnim.pause();
            for (var b = 0; b < this._beams.length; b++) {
                this._beams[b].front.setAttribute('opacity', '0');
                this._beams[b].back.setAttribute('opacity', '0');
            }
            this._bloom.setAttribute('opacity', '0');
            this._flare.setAttribute('opacity', '0');
            this._core.setAttribute('opacity', '0');
            this._wash.setAttribute('opacity', '0');
            this._rayGlintL.setAttribute('opacity', '0');
            this._rayGlintR.setAttribute('opacity', '0');
            this._waveGlint.setAttribute('opacity', '0');
            this._haloEl.setAttribute('opacity', '0');
            this._shockEl.setAttribute('opacity', '0');
            for (var a = 0; a < this._ambientAnims.length; a++) this._ambientAnims[a].pause();
            return;
        }
        if (this._waveAnim) this._waveAnim.play();
        for (var a2 = 0; a2 < this._ambientAnims.length; a2++) this._ambientAnims[a2].play();
        this._start = performance.now();
        this._lastTick = this._start;
        this._tick = this._tick.bind(this);
        this._raf = requestAnimationFrame(this._tick);
    };
    /** Start (or restart) the animation loop. */
    Lighthouse.prototype.start = function () { this.setMode(this._opts.mode); };

    /** Stop the animation, remove listeners, and clear the icon from the DOM. */
    Lighthouse.prototype.destroy = function () {
        if (this._raf) cancelAnimationFrame(this._raf);
        if (this._waveAnim) this._waveAnim.cancel();
        for (var a = 0; a < this._ambientAnims.length; a++) this._ambientAnims[a].cancel();
        this._cancelPress();
        this._detach();
        this._container.innerHTML = '';
    };

    global.Lighthouse = Lighthouse;
})(window);
