#pragma WebGL2

precision lowp float;

varying vec2 interp_texcoord;

uniform sampler2D inputTexture0;
uniform sampler2D inputTexture1;

void main()
{
  vec4 tex0 = texture2D(inputTexture0, interp_texcoord);;
  vec4 tex1 = texture2D(inputTexture1, interp_texcoord);;
  gl_FragColor = tex0 * tex1;
}
