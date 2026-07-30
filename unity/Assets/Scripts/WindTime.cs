// 바람 셰이더에 시간을 공급한다.
//
// _Time.y 를 직접 쓰지 않는 이유: 배치 렌더로 검증할 때 시간을 고정해 두 프레임을
// 비교해야 하는데 _Time 은 외부에서 통제할 수 없다. 전역 float 하나로 빼두면
// 에디터/플레이에서는 자동으로 흐르고, 검증할 때는 원하는 값을 꽂을 수 있다.
// 브라우저도 같은 구조였다 (renderer 루프가 uTime 유니폼을 갱신).
using UnityEngine;

[ExecuteAlways]
public class WindTime : MonoBehaviour
{
    static readonly int WindTimeId = Shader.PropertyToID("_WindTime");

    [Tooltip("바람 시간 배속")]
    public float timeScale = 1f;

    void Update()
    {
        // 에디터에서도 씬 뷰가 리페인트될 때마다 흐른다
        var t = Application.isPlaying ? Time.time : (float)UnityEditorTime();
        Shader.SetGlobalFloat(WindTimeId, t * timeScale);
    }

    static double UnityEditorTime()
    {
#if UNITY_EDITOR
        return UnityEditor.EditorApplication.timeSinceStartup;
#else
        return Time.realtimeSinceStartup;
#endif
    }
}
