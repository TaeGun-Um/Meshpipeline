// 오피스 섹터용 — 텍스처 x 정점 컬러, **언릿**.
//
// 이 씬의 정점 컬러(COLOR_0)는 알베도가 아니라 **구운 조명**이다
// (web/src/scenes/office-sector/bake.js). 브라우저의 최종 확산색은
//   알베도(텍스처) x 정점색 x 환경광 π x (램버트 1/π)  =  텍스처 x 정점색
// 이므로, 유니티에서 같은 화면을 얻는 정답은 라이팅을 얹는 것이 아니라
// **곱 두 개를 그대로 출력하는 언릿**이다. 표준 라이팅을 쓰면 빛이 두 번 든다.
//
// 톤매핑은 카메라의 AcesTonemapper 가 맡는다 (브라우저와 같은 커브).
Shader "Custom/BakedVertexColor"
{
    Properties
    {
        _MainTex ("Albedo", 2D) = "white" {}
        _Color ("Tint", Color) = (1,1,1,1)
    }

    SubShader
    {
        Tags { "RenderType" = "Opaque" }
        LOD 100

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            sampler2D _MainTex;
            float4 _MainTex_ST;
            fixed4 _Color;

            struct appdata
            {
                float4 vertex : POSITION;
                float2 uv : TEXCOORD0;
                float4 color : COLOR;
            };

            struct v2f
            {
                float4 pos : SV_POSITION;
                float2 uv : TEXCOORD0;
                float4 color : COLOR;
            };

            v2f vert (appdata v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = TRANSFORM_TEX(v.uv, _MainTex);
                o.color = v.color;
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                fixed4 tex = tex2D(_MainTex, i.uv);
                return fixed4(tex.rgb * i.color.rgb * _Color.rgb, 1.0);
            }
            ENDCG
        }
    }

    FallBack "Unlit/Texture"
}
