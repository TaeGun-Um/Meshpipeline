// 카메라에 붙여 ACES 톤매핑을 적용하는 이미지 이펙트.
// Built-in RP에는 톤매핑이 없어서 브라우저(three.js)와 톤 커브가 어긋난다.
//
// 주의: OnRenderImage는 이 컴포넌트가 붙은 카메라의 렌더에만 개입한다.
// 에디터의 Scene 뷰는 자체 카메라를 쓰므로 적용되지 않는다 (Game 뷰와
// Camera.Render() 호출에는 적용됨). Scene 뷰까지 반영하려면 URP + Volume이 정공법.
using UnityEngine;

[ExecuteAlways]
[RequireComponent(typeof(Camera))]
[AddComponentMenu("Rendering/ACES Tonemapper")]
public class AcesTonemapper : MonoBehaviour
{
    [Tooltip("web/src/main.js 의 renderer.toneMappingExposure 와 같은 값")]
    public float exposure = 1.06f;

    Material _mat;

    void OnDisable()
    {
        if (_mat != null)
        {
            if (Application.isPlaying) Destroy(_mat);
            else DestroyImmediate(_mat);
            _mat = null;
        }
    }

    void OnRenderImage(RenderTexture src, RenderTexture dst)
    {
        if (_mat == null)
        {
            var shader = Shader.Find("Custom/AcesTonemap");
            if (shader == null || !shader.isSupported)
            {
                Graphics.Blit(src, dst);   // 셰이더가 없으면 원본 그대로 통과
                return;
            }
            _mat = new Material(shader) { hideFlags = HideFlags.HideAndDontSave };
        }

        _mat.SetFloat("_Exposure", exposure);
        Graphics.Blit(src, dst, _mat);
    }
}
