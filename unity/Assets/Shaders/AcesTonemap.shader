// three.js의 ACESFilmicToneMapping을 그대로 포팅한 것.
// 상수와 행렬을 손대지 않고 옮겨야 톤 커브가 정확히 일치한다.
// 원본: three/src/renderers/shaders/ShaderChunk/tonemapping_pars_fragment.glsl.js
//
// three는 선형 색상에 톤매핑을 적용한 뒤 sRGB로 변환한다.
// Unity도 Linear 색공간에서는 이미지 이펙트가 선형 값을 보고, 최종 출력에서
// sRGB 변환이 일어나므로 여기서 별도 변환을 하지 않는다.
Shader "Custom/AcesTonemap"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _Exposure ("Exposure", Float) = 1.06
    }

    SubShader
    {
        Cull Off
        ZWrite Off
        ZTest Always

        Pass
        {
            CGPROGRAM
            #pragma vertex vert_img
            #pragma fragment frag
            #include "UnityCG.cginc"

            sampler2D _MainTex;
            float _Exposure;

            // three의 mat3(...)는 열 우선. HLSL float3x3(...)은 행 우선이므로
            // 전치해서 적어야 같은 행렬이 된다.
            static const float3x3 ACESInputMat = float3x3(
                0.59719, 0.35458, 0.04823,
                0.07600, 0.90834, 0.01566,
                0.02840, 0.13383, 0.83777);

            static const float3x3 ACESOutputMat = float3x3(
                 1.60475, -0.53108, -0.07367,
                -0.10208,  1.10813, -0.00605,
                -0.00327, -0.07276,  1.07602);

            float3 RRTAndODTFit(float3 v)
            {
                float3 a = v * (v + 0.0245786) - 0.000090537;
                float3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
                return a / b;
            }

            float4 frag (v2f_img i) : SV_Target
            {
                float4 src = tex2D(_MainTex, i.uv);
                float3 c = src.rgb;

                c *= _Exposure / 0.6;        // three와 동일한 스케일
                c = mul(ACESInputMat, c);
                c = RRTAndODTFit(c);
                c = mul(ACESOutputMat, c);

                return float4(saturate(c), src.a);
            }
            ENDCG
        }
    }

    Fallback Off
}
