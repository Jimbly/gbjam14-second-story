#pragma WebGL2

precision lowp float;

uniform sampler2D tex0; // source

varying lowp vec4 interp_color;
varying vec2 interp_texcoord;
uniform float param;

void main(void) {
  vec4 tex = texture2D(tex0, interp_texcoord);
  float v = min(3.0, floor((tex.r + tex.g + tex.b) * 1.5)); // 0...3
  v = min(param, v);
  v = v/4.0;
  gl_FragColor = vec4(v, v, v, 1.0);
}
