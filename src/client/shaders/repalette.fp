#pragma WebGL2

precision lowp float;

varying vec2 interp_texcoord;
uniform vec3 pal0;
uniform vec3 pal1;
uniform vec3 pal2;
uniform vec3 pal3;

uniform sampler2D inputTexture0;
void main()
{
  vec3 tex = texture2D(inputTexture0, interp_texcoord).rgb;
  float v = floor(tex.g * 3.1); // 0...3
  vec3 repal = mix(mix(mix(pal0,
    pal1, v),
    pal2, max(0.0, v-1.0)),
    pal3, max(0.0, v-2.0));

  gl_FragColor = vec4(repal, 1.0);
}
