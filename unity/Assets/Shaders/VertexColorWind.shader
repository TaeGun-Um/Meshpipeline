// 정점 컬러 + 바람 흔들림. 잡초용.
//
// 브라우저(web/src/static/world.js createWeeds)는 MeshStandardMaterial의 정점
// 셰이더에 흔들림을 주입했다:
//   phase = instanceMatrix[3].x * 0.62 + instanceMatrix[3].z * 0.91
//   bend  = position.y * position.y
//   sway  = sin(uTime*1.55 + phase)*0.075 + sin(uTime*3.3 + phase*1.7)*0.028
//
// Unity 쪽은 인스턴스를 구워 단일 메시로 만들었으므로 instanceMatrix가 없다. 대신:
//   - 잎의 밑동~끝 비율은 uv.y 에 그대로 남아 있다 (blade geometry가 uv=(0|1, t))
//   - 포기별 위상은 정점의 월드 XZ 로 만든다 (한 포기 안에서는 5cm 이내라 사실상 동일)
//
// 시간은 _Time.y 가 아니라 전역 _WindTime 을 쓴다. 배치 렌더에서 시간을 고정해
// 프레임을 비교 검증할 수 있어야 하기 때문이다 (브라우저도 uTime 유니폼을 썼다).
Shader "Custom/VertexColorWind"
{
    Properties
    {
        _Color ("Tint", Color) = (1,1,1,1)
        _Smoothness ("Smoothness", Range(0,1)) = 0.12
        _WindAmp ("Wind Amp 1", Float) = 0.075
        _WindFreq ("Wind Freq 1", Float) = 1.55
        _WindAmp2 ("Wind Amp 2", Float) = 0.028
        _WindFreq2 ("Wind Freq 2", Float) = 3.3
        _WindZ ("Wind Z Factor", Float) = 0.45
    }

    SubShader
    {
        Tags { "RenderType" = "Opaque" }
        LOD 200
        Cull Off   // 잎은 한 겹 폴리곤

        CGPROGRAM
        #pragma surface surf Standard vertex:vert fullforwardshadows addshadow
        #pragma target 3.0

        struct Input
        {
            float4 color : COLOR;
        };

        fixed4 _Color;
        half _Smoothness;
        float _WindAmp, _WindFreq, _WindAmp2, _WindFreq2, _WindZ;
        float _WindTime;   // WindTime.cs 가 전역으로 설정

        void vert(inout appdata_full v)
        {
            float t = v.texcoord.y;          // 0 = 밑동, 1 = 잎끝
            float bend = t * t;              // 밑동은 고정, 끝이 크게 흔들린다

            float3 wpos = mul(unity_ObjectToWorld, v.vertex).xyz;
            float phase = wpos.x * 0.62 + wpos.z * 0.91;

            float sway = sin(_WindTime * _WindFreq + phase) * _WindAmp
                       + sin(_WindTime * _WindFreq2 + phase * 1.7) * _WindAmp2;

            v.vertex.x += sway * bend;
            v.vertex.z += sway * _WindZ * bend;
        }

        void surf(Input IN, inout SurfaceOutputStandard o)
        {
            o.Albedo = IN.color.rgb * _Color.rgb;
            o.Metallic = 0;
            o.Smoothness = _Smoothness;
            o.Alpha = 1;
        }
        ENDCG
    }

    FallBack "Diffuse"
}
