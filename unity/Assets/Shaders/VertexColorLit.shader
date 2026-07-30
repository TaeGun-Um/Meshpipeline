// 정점 컬러(COLOR_0)를 알베도에 곱하는 Standard 라이팅 셰이더.
// glTFast의 glTF/PbrMetallicRoughness와 Unity의 Standard 둘 다 정점 컬러를
// 무시하기 때문에, 잡초 7,200포기의 마른/푸른 색 편차가 회백색으로 죽는다.
// 데이터는 메시에 이미 들어 있으므로 읽어주는 셰이더만 있으면 된다.
Shader "Custom/VertexColorLit"
{
    Properties
    {
        _Color ("Tint", Color) = (1,1,1,1)
        _Smoothness ("Smoothness", Range(0,1)) = 0.12
        _Metallic ("Metallic", Range(0,1)) = 0.0
    }

    SubShader
    {
        Tags { "RenderType" = "Opaque" }
        LOD 200
        Cull Off   // 잎은 한 겹 폴리곤이라 양면을 다 그려야 한다

        CGPROGRAM
        #pragma surface surf Standard fullforwardshadows
        #pragma target 3.0

        struct Input
        {
            float4 color : COLOR;
        };

        fixed4 _Color;
        half _Smoothness;
        half _Metallic;

        void surf (Input IN, inout SurfaceOutputStandard o)
        {
            o.Albedo = IN.color.rgb * _Color.rgb;
            o.Metallic = _Metallic;
            o.Smoothness = _Smoothness;
            o.Alpha = 1.0;
        }
        ENDCG
    }

    FallBack "Diffuse"
}
