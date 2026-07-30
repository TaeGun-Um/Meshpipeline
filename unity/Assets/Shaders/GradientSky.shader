// 브라우저의 하늘 돔과 동일한 5스톱 수직 그라디언트를 스카이박스로 재현한다.
// 원본: web/src/textures.js skyTexture() 의 createLinearGradient 스톱 값.
// 스톱 위치는 천정(t=0) -> 천저(t=1) 기준이며, t는 극각(acos)으로 계산해서
// three.js SphereGeometry의 UV 분포와 맞춘다.
Shader "Custom/GradientSky"
{
    Properties
    {
        _C0 ("Zenith  (0.00)", Color) = (0.247, 0.463, 0.722, 1)
        _C1 ("Upper   (0.42)", Color) = (0.518, 0.663, 0.824, 1)
        _C2 ("Horizon (0.62)", Color) = (0.765, 0.812, 0.839, 1)
        _C3 ("Lower   (0.78)", Color) = (0.863, 0.824, 0.753, 1)
        _C4 ("Nadir   (1.00)", Color) = (0.788, 0.722, 0.635, 1)
        _Exposure ("Exposure", Range(0, 3)) = 1.0
    }

    SubShader
    {
        Tags { "Queue" = "Background" "RenderType" = "Background" "PreviewType" = "Skybox" }
        Cull Off
        ZWrite Off

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            fixed4 _C0, _C1, _C2, _C3, _C4;
            half _Exposure;

            struct v2f
            {
                float4 pos : SV_POSITION;
                float3 dir : TEXCOORD0;
            };

            v2f vert (appdata_base v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                // 오브젝트 공간 정점을 그대로 방향으로 쓰면 안 된다.
                // Unity 스카이박스 메시의 object->world 행렬에는 회전/스케일이 들어 있어서
                // 앙각이 엉뚱하게 읽힌다(실측: 8.9°를 72°로 읽음). w=0으로 방향만 변환한다.
                o.dir = mul(unity_ObjectToWorld, float4(v.vertex.xyz, 0.0)).xyz;
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float3 d = normalize(i.dir);
                // 천정 0 -> 천저 1
                float t = acos(clamp(d.y, -1.0, 1.0)) / 3.14159265;

                float3 c;
                if (t < 0.42)      c = lerp(_C0.rgb, _C1.rgb, t / 0.42);
                else if (t < 0.62) c = lerp(_C1.rgb, _C2.rgb, (t - 0.42) / 0.20);
                else if (t < 0.78) c = lerp(_C2.rgb, _C3.rgb, (t - 0.62) / 0.16);
                else               c = lerp(_C3.rgb, _C4.rgb, (t - 0.78) / 0.22);

                // 여기서 GammaToLinearSpace를 부르면 안 된다.
                // Linear 색공간에서는 Unity가 머티리얼 Color 프로퍼티를 셰이더로
                // 넘기기 전에 이미 선형으로 변환한다. 한 번 더 변환하면 이중 선형화가
                // 되어 하늘이 어둡고 과채도로 나온다(실측 -83,-62,-30).
                return fixed4(c * _Exposure, 1.0);
            }
            ENDCG
        }
    }

    FallBack Off
}
