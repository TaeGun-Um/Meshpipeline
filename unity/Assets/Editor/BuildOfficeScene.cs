// 오피스 섹터(4번 씬)를 유니티 씬으로 조립한다 — 파이프라인 이식의 첫 관문.
// 실행:
//   Unity.exe -batchmode -quit -projectPath <unity> -executeMethod BuildOfficeScene.Full -logFile -
//
// VacantLot(BuildScene.cs)과 다른 점 하나가 이 씬의 전부다:
// **조명이 정점 컬러에 구워져 있다** (web/src/scenes/office-sector/bake.js).
// 그래서 유니티 광원을 하나도 안 만들고, 불투명 메시 전부를
// Custom/BakedVertexColor(텍스처 x 정점색, 언릿)로 갈아 끼운다.
//
// 발광(형광등 패널·유도등·랙 표시등)과 유리는 브라우저 쪽 재질 이름이
// 결정론적이므로 (core/material.js — 파이프라인이 이름으로 검증한다)
// **이름으로 골라** glTFast 가 만든 재질을 그대로 둔다.
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

public static class BuildOfficeScene
{
    const string GlbDir = "Assets/ProceduralImport/office";
    const string ScenePath = "Assets/Scenes/OfficeSector.unity";
    const float ToneExposure = 1.05f;   // office-sector/index.js render.exposure

    // 갈아 끼우지 않는 재질 — 발광은 glTFast 의 emission 이 맡고, 유리는 투명이 맡는다.
    static readonly string[] KeepByName =
    {
        "Fluoro", "FluoroWarm", "FluoroCold", "ExitSign",
        "RackLed", "RackLedAmber", "Screen", "Glass",
    };

    static bool ShouldKeep(Material m)
    {
        if (m == null) return true;
        var n = m.name;
        return KeepByName.Any(k => n == k || n.StartsWith(k + " ") || n.StartsWith(k + "_"));
    }

    // 원본 재질의 베이스컬러 텍스처를 찾는다 (셰이더별 프로퍼티 이름을 가정하지 않는다
    // — BuildScene.HasAlbedoTexture 와 같은 접근).
    static Texture FindAlbedo(Material m)
    {
        if (m == null || m.shader == null) return null;
        int c = m.shader.GetPropertyCount();
        for (int i = 0; i < c; i++)
        {
            if (m.shader.GetPropertyType(i) !=
                UnityEngine.Rendering.ShaderPropertyType.Texture) continue;
            var name = m.shader.GetPropertyName(i);
            var lower = name.ToLower();
            if (!lower.Contains("basecolor") && !lower.Contains("maintex")) continue;
            var t = m.GetTexture(name);
            if (t != null) return t;
        }
        return null;
    }

    // 베이스컬러 **팩터** — 무텍스처 재질(벤치 라미네이트·트림)은 색이 여기 있다.
    // 텍스처만 옮기면 전부 흰색이 된다 (첫 판이 그랬다).
    static Color FindBaseColor(Material m)
    {
        if (m == null || m.shader == null) return Color.white;
        int c = m.shader.GetPropertyCount();
        for (int i = 0; i < c; i++)
        {
            if (m.shader.GetPropertyType(i) !=
                UnityEngine.Rendering.ShaderPropertyType.Color) continue;
            var name = m.shader.GetPropertyName(i);
            var lower = name.ToLower();
            if (!lower.Contains("basecolor") && lower != "_color") continue;
            return m.GetColor(name);
        }
        return m.HasProperty("_Color") ? m.color : Color.white;
    }

    public static void Run()
    {
        AssetDatabase.Refresh();
        Directory.CreateDirectory(Path.Combine(Application.dataPath, "Scenes"));

        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        var root = new GameObject("OfficeSector").transform;

        // interactables 는 소품 중 상호작용 대상 — 물건마다 독립 노드(rack_07 등,
        // 이름 결정론)라 개별 콜라이더·상태(크랙·약탈 포즈)를 달 수 있다.
        // interactables_open 은 약탈 뒤의 열림 포즈(rack_07_open) — 씬에 겹쳐
        // 들어오므로 루트를 꺼 둔다. 게임 로직이 약탈 시 닫힘/열림을 토글한다.
        foreach (var piece in new[]
        {
            "rock.glb", "floors.glb", "walls.glb",
            "ceilings.glb", "props.glb", "fixtures.glb",
            "interactables.glb", "interactables_open.glb",
        })
        {
            var asset = AssetDatabase.LoadAssetAtPath<GameObject>($"{GlbDir}/{piece}");
            if (asset == null) { Debug.LogWarning($"에셋 없음: {piece}"); continue; }
            var go = (GameObject)PrefabUtility.InstantiatePrefab(asset);
            go.name = Path.GetFileNameWithoutExtension(piece);
            go.transform.SetParent(root, false);
            if (go.name == "interactables_open") go.SetActive(false);
        }

        // ── 재질 교체 — 원본 재질 하나당 구운 재질 하나 (텍스처 공유 유지) ──
        var shader = Shader.Find("Custom/BakedVertexColor");
        if (shader == null) { Debug.LogError("셰이더 'Custom/BakedVertexColor' 없음"); return; }

        // **이름으로 캐시한다.** 여섯 GLB 각각이 같은 이름의 재질(Steel 등)을
        // 들고 오는데, Material 인스턴스로 캐시하면 GLB 마다 새 에셋을 같은
        // 경로에 CreateAsset 해서 앞서 만든 것이 파괴된다 — 첫 판의 마젠타가
        // 그것이었다. 이름은 core/material.js 가 결정론적으로 보장한다.
        var cache = new Dictionary<string, Material>();
        int swapped = 0, kept = 0;
        foreach (var r in root.GetComponentsInChildren<MeshRenderer>(true))
        {
            var mf = r.GetComponent<MeshFilter>();
            if (mf == null || mf.sharedMesh == null) continue;
            // COLOR_0 이 없는 메시는 구운 값이 없다 — 손대지 않는다
            if (!mf.sharedMesh.HasVertexAttribute(UnityEngine.Rendering.VertexAttribute.Color))
                continue;

            var mats = r.sharedMaterials;
            for (int i = 0; i < mats.Length; i++)
            {
                var src = mats[i];
                if (ShouldKeep(src)) { kept++; continue; }
                if (!cache.TryGetValue(src.name, out var baked))
                {
                    baked = new Material(shader) { name = src.name + "_baked" };
                    var tex = FindAlbedo(src);
                    if (tex != null) baked.SetTexture("_MainTex", tex);
                    baked.SetColor("_Color", FindBaseColor(src));
                    cache[src.name] = baked;
                    AssetDatabase.CreateAsset(baked,
                        $"Assets/Materials/Office_{Sanitize(src.name)}.mat");
                }
                mats[i] = baked;
                swapped++;
            }
            r.sharedMaterials = mats;
        }
        Debug.Log($"BAKED_MAT swapped={swapped} kept={kept} unique={cache.Count}");

        // ── 환경 — 광원 0개. 구운 빛이 전부다 ─────────────────────────────
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
        RenderSettings.ambientLight = Color.black;   // 남겨 둔 표준 재질(유리)만 영향받는다
        RenderSettings.skybox = null;

        // ── 카메라 — of_plaza 뷰. glTF→유니티 좌손 변환으로 X 가 뒤집힌다 ──
        var camGo = new GameObject("Main Camera") { tag = "MainCamera" };
        var cam = camGo.AddComponent<Camera>();
        cam.fieldOfView = 62f;                  // office-sector lens.fov
        cam.nearClipPlane = 0.05f;
        cam.farClipPlane = 400f;
        cam.clearFlags = CameraClearFlags.SolidColor;
        cam.backgroundColor = new Color(0.02f, 0.023f, 0.04f);
        cam.allowHDR = true;
        camGo.transform.position = new Vector3(-3.2f, 1.7f, 4.5f);
        camGo.transform.LookAt(new Vector3(14f, 1.6f, 1.0f));

        var tm = camGo.AddComponent<AcesTonemapper>();
        tm.exposure = ToneExposure;

        EditorSceneManager.SaveScene(scene, ScenePath);
        AssetDatabase.SaveAssets();
        Debug.Log($"OFFICE_SCENE_BUILT {ScenePath}");
    }

    static string Sanitize(string s)
    {
        foreach (var c in Path.GetInvalidFileNameChars()) s = s.Replace(c, '_');
        return s;
    }

    // 저장된 씬을 렌더해 Reports/office_scene.png 로 떨어뜨린다 (BuildScene.Shot 과 동일 수법).
    public static void Shot()
    {
        EditorSceneManager.OpenScene(ScenePath);
        var cam = Camera.main;
        if (cam == null) { Debug.LogError("Main Camera 없음"); return; }

        const int W = 1280, H = 720;
        var rt = new RenderTexture(W, H, 24, RenderTextureFormat.ARGB32) { antiAliasing = 4 };
        cam.targetTexture = rt;
        cam.Render();

        var prev = RenderTexture.active;
        RenderTexture.active = rt;
        var tex = new Texture2D(W, H, TextureFormat.RGB24, false);
        tex.ReadPixels(new Rect(0, 0, W, H), 0, 0);
        tex.Apply();
        RenderTexture.active = prev;

        var dir = Path.GetFullPath(Path.Combine(Application.dataPath, "..", "Reports"));
        Directory.CreateDirectory(dir);
        var png = Path.Combine(dir, "office_scene.png");
        File.WriteAllBytes(png, tex.EncodeToPNG());

        cam.targetTexture = null;
        rt.Release();
        Object.DestroyImmediate(rt);
        Object.DestroyImmediate(tex);
        Debug.Log($"OFFICE_SHOT {png}");
    }

    public static void Full()
    {
        Run();
        Shot();
    }
}
