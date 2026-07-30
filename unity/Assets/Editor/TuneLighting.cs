// 광원 세기를 격자 탐색으로 맞춘다.
// Unity를 매번 띄워 밖에서 비교하면 1조합당 ~10초가 걸린다. 한 번 띄워서
// 여러 조합을 렌더하고 프레임버퍼를 C#에서 직접 샘플링해 오차를 계산한다.
//
// 기준값은 브라우저 렌더(web/shots/cmp_browser.png)의 동일 영역 평균 RGB.
// 실행: Unity.exe -batchmode -quit -projectPath <unity> -executeMethod TuneLighting.Run
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

public static class TuneLighting
{
    const string ScenePath = "Assets/Scenes/VacantLot.unity";
    const int W = 1280, H = 720;

    // 이름, 좌상단 x, y, 너비, 높이, 브라우저 목표 RGB
    struct Probe
    {
        public string name;
        public int x, y, w, h;
        public Vector3 target;
    }

    static readonly Probe[] Probes =
    {
        new Probe { name = "도로",       x = 300, y = 610, w = 140, h = 60, target = new Vector3( 67,  75,  91) },
        new Probe { name = "공터흙",     x = 770, y = 398, w =  60, h = 26, target = new Vector3(109,  99,  86) },
        new Probe { name = "담장밖흙",   x = 500, y = 300, w =  80, h = 14, target = new Vector3(104, 105, 108) },
        new Probe { name = "벽돌",       x = 380, y = 258, w =  44, h = 22, target = new Vector3(162, 145, 143) },
        new Probe { name = "담장",       x = 860, y = 470, w =  70, h = 20, target = new Vector3(139, 145, 145) },
        new Probe { name = "캐릭터셔츠", x = 548, y = 570, w =  16, h = 10, target = new Vector3( 75,  84, 101) },
    };

    // 1차 탐색에서 sun≈1.3, amb는 상한(0.34)에 걸렸으므로 앰비언트 범위를 넓혔다.
    static readonly float[] SunGrid = { 1.0f, 1.15f, 1.3f, 1.45f };
    static readonly float[] AmbGrid = { 0.34f, 0.55f, 0.8f, 1.1f, 1.5f };

    public static void Run()
    {
        EditorSceneManager.OpenScene(ScenePath);

        var cam = Camera.main;
        var lights = Object.FindObjectsByType<Light>(FindObjectsSortMode.None);
        var sun = lights.FirstOrDefault(l => l.gameObject.name == "Sun");
        var fill = lights.FirstOrDefault(l => l.gameObject.name == "Fill");
        if (cam == null || sun == null)
        {
            Debug.LogError("Main Camera 또는 Sun 을 찾을 수 없음");
            return;
        }

        var results = new List<(float sun, float amb, float err, Vector3[] means)>();

        foreach (var s in SunGrid)
        {
            foreach (var a in AmbGrid)
            {
                sun.intensity = s;
                if (fill != null) fill.intensity = s * 0.112f;   // three의 0.28/2.5 비율
                RenderSettings.ambientIntensity = a;
                DynamicGI.UpdateEnvironment();

                var tex = Render(cam);
                var means = Probes.Select(p => Mean(tex, p)).ToArray();
                float err = 0f;
                for (int i = 0; i < Probes.Length; i++)
                {
                    var d = means[i] - Probes[i].target;
                    err += (Mathf.Abs(d.x) + Mathf.Abs(d.y) + Mathf.Abs(d.z)) / 3f;
                }
                err /= Probes.Length;
                Object.DestroyImmediate(tex);

                results.Add((s, a, err, means));
                Debug.Log($"TUNE sun={s:0.00} amb={a:0.00} err={err:0.0}");
            }
        }

        var best = results.OrderBy(r => r.err).First();
        Debug.Log($"TUNE_BEST sun={best.sun:0.00} amb={best.amb:0.00} err={best.err:0.0}");
        for (int i = 0; i < Probes.Length; i++)
        {
            var m = best.means[i];
            var t = Probes[i].target;
            Debug.Log($"TUNE_PROBE {Probes[i].name,-10} unity {m.x:0},{m.y:0},{m.z:0}" +
                      $"  browser {t.x:0},{t.y:0},{t.z:0}" +
                      $"  diff {m.x - t.x:+0;-0},{m.y - t.y:+0;-0},{m.z - t.z:+0;-0}");
        }

        // 상위 5개도 같이 남긴다
        foreach (var r in results.OrderBy(x => x.err).Take(5))
            Debug.Log($"TUNE_TOP sun={r.sun:0.00} amb={r.amb:0.00} err={r.err:0.0}");
    }

    static Texture2D Render(Camera cam)
    {
        var rt = new RenderTexture(W, H, 24, RenderTextureFormat.ARGB32) { antiAliasing = 4 };
        cam.targetTexture = rt;
        cam.Render();

        var prev = RenderTexture.active;
        RenderTexture.active = rt;
        var tex = new Texture2D(W, H, TextureFormat.RGB24, false);
        tex.ReadPixels(new Rect(0, 0, W, H), 0, 0);
        tex.Apply();
        RenderTexture.active = prev;

        cam.targetTexture = null;
        rt.Release();
        Object.DestroyImmediate(rt);
        return tex;
    }

    // ReadPixels는 아래에서 위로 읽으므로 y를 뒤집어 준다
    static Vector3 Mean(Texture2D tex, Probe p)
    {
        int y0 = H - p.y - p.h;
        var px = tex.GetPixels(p.x, y0, p.w, p.h);
        float r = 0, g = 0, b = 0;
        foreach (var c in px) { r += c.r; g += c.g; b += c.b; }
        int n = px.Length;
        return new Vector3(r / n * 255f, g / n * 255f, b / n * 255f);
    }
}
