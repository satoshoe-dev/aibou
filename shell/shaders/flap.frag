#version 440
// The bottom of a window lifted like a cloth, without a copy of the window:
// the window itself stays where it is and keeps running. Drawn are only the
// opening under the lifted edge (the wallpaper, with the edge's shadow) and
// the edge itself, a band of fabric in the window colour. Everything else is
// left transparent, so the live window shows.
//
// lift: the bottom edge rises at cx and falls off as exp(-dx²/spread²).
// curtain (push != 0): the window's inner side slides aside at the bottom,
// most at the bottom edge, nothing 260 px up.
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    float w;        // px, item size
    float h;
    float lift;     // px the bottom edge rises at cx
    float cx;       // px
    float spread;   // px
    float edge;     // px, y of the bottom edge
    float push;     // px the inner side moves at the bottom (curtain), signed
    float side;     // px, x of the window's inner side (curtain)
    float fabricW;  // px, thickness of the lifted edge
    float hasWall;  // 1 when the wallpaper texture is ready
    vec4 fabric;    // window colour
    vec4 gapTop;    // without a wallpaper: dark at the edge ...
    vec4 gapBottom; // ... lighter towards the frame
};
layout(binding = 1) uniform sampler2D wall;

// colour of the opening at p; d = distance from the lifted edge into it
vec4 opening(vec2 p, float d, float depth) {
    vec4 c = hasWall > 0.5 ? texture(wall, qt_TexCoord0)
                           : mix(gapTop, gapBottom, clamp(d / max(depth, 1.0), 0.0, 1.0));
    // the edge casts a soft shadow into the opening
    float shade = 0.55 * (1.0 - smoothstep(0.0, 46.0, d));
    return vec4(c.rgb * (1.0 - shade), 1.0);
}

// the lifted edge; u = 0 where it meets the opening, 1 where it meets the window
vec4 band(float u) {
    // the underside in its own shadow, lighter towards the window, and a thin
    // light rim along the fold
    float light = 0.62 + 0.38 * u;
    vec3 c = fabric.rgb * light;
    c = mix(c, vec3(1.0), 0.10 * (1.0 - smoothstep(0.0, 0.18, u)));
    return vec4(c, 1.0);
}

void main() {
    vec2 p = qt_TexCoord0 * vec2(w, h);
    vec4 col = vec4(0.0);
    if (abs(push) < 0.01) {
        float dx = (p.x - cx) / spread;
        float rise = lift * exp(-dx * dx);
        float top = edge - rise;                    // the lifted edge
        float thick = min(fabricW, rise * 0.45);     // vanishes with the bulge
        if (p.y >= top && p.y <= edge && rise > 0.25) {
            col = opening(p, p.y - top, rise);
        } else if (p.y < top && p.y >= top - thick) {
            col = band((top - p.y) / max(thick, 0.001));
        }
        // soft rim on both sides, a pixel wide
        float aa = clamp(rise * 2.0, 0.0, 1.0);
        col *= aa;
    } else {
        float reach = 260.0;
        float ts = clamp((p.y - (edge - reach)) / reach, 0.0, 1.0);
        float dx = (side - cx) / spread;
        float shift = push * exp(-dx * dx) * ts * ts;    // signed, away from cx
        float b = side + shift;                          // where the window ends now
        float open = abs(shift);
        float thick = min(fabricW, open * 0.45);
        float into = sign(push) * (b - p.x);             // > 0: inside the opening
        if (p.y <= edge && open > 0.25) {
            if (into >= 0.0 && into <= open)
                col = opening(p, into, open);
            else if (into < 0.0 && into >= -thick)
                col = band(-into / max(thick, 0.001));
        }
    }
    fragColor = col * qt_Opacity;
}
