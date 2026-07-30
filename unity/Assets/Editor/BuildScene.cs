// 임포트된 GLB 조각들을 하나의 씬으로 조립한다.
// 실행:
//   Unity.exe -batchmode -quit -projectPath <unity> -executeMethod BuildScene.Run -logFile -
//
// 조각들은 모두 같은 임포터를 거쳤으므로 추가 변환 없이 원점에 얹으면 서로 정확히 맞는다.
// (glTF 우손 -> Unity 좌손 변환에서 X가 반전되지만 모든 조각이 동일하게 반전되므로
//  상대 배치는 보존된다. 브라우저 화면과는 좌우가 바뀐 것처럼 보이는 게 정상이다.)
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

public static class BuildScene
{
    const string GlbDir = "Assets/ProceduralImport/glb";
    const string ScenePath = "Assets/Scenes/VacantLot.unity";

    // 브라우저는 sun 2.5 / fill 0.28을 쓰지만, 거기엔 ACES 톤매핑(노출 1.06)이 걸려 있다.
    // Unity Built-in RP는 톤매핑이 없어서 같은 수치를 넣으면 과노출된다.
    // 두 광원의 비율(0.28 / 2.5 = 0.112)만 유지하고 전체 스케일은 스크린샷 비교로 맞춘다.
    // ACES 톤매핑을 카메라에 붙였으므로 톤 커브가 브라우저와 같아졌다.
    // 따라서 광원 세기도 three.js 원본 값을 그대로 쓰는 것이 출발점이다.
    // (톤매핑 없이 맞추려던 이전 값 sun 1.32 / ambient 0.34는 커브 차이를
    //  스칼라로 억지로 상쇄한 것이라 위·수직면을 동시에 맞출 수 없었다)
    // three.js는 물리 기반 조명 모드에서 광원 기여를 π로 나눈다(1/PI 정규화).
    // Unity는 intensity를 디퓨즈 항에 그대로 곱하므로, 같은 밝기를 얻으려면
    // three의 값을 π로 나눠야 한다. 2.5를 그대로 넣으면 약 3배 과노출된다.
    // TuneLighting.Run 의 격자 탐색 결과 (sun 5단 × amb 4단, 20조합 8초).
    // three의 값(2.5)을 그대로 쓰면 과노출, π로 나누면(0.796) 과소노출이라
    // Unity의 광원 단위가 three와 1:1이 아님을 확인하고 실측으로 잡았다.
    const float SunIntensity = 1.00f;
    const float FillIntensity = SunIntensity * 0.112f;  // three의 0.28/2.5 비율 유지
    // 앰비언트가 1.1까지 올라간 건 Unity가 스카이박스를 SH 9계수로 투영해 쓰기 때문이다.
    // three의 HemisphereLight는 상/하 두 색을 직접 보간하므로 수직면에 훨씬 많이 들어온다.
    // 그 차이를 메우려면 Unity 쪽 배수가 커야 한다 (벽돌면 오차 -30 -> -7).
    const float AmbientIntensity = 1.10f;
    const float ToneExposure = 1.06f;    // main.js renderer.toneMappingExposure

    static GameObject Place(string file, Transform parent, Vector3 pos)
    {
        return PlacePath($"{GlbDir}/{file}", parent, pos);
    }

    static GameObject PlacePath(string path, Transform parent, Vector3 pos)
    {
        var asset = AssetDatabase.LoadAssetAtPath<GameObject>(path);
        if (asset == null)
        {
            Debug.LogWarning($"에셋을 찾을 수 없음: {path}");
            return null;
        }
        var go = (GameObject)PrefabUtility.InstantiatePrefab(asset);
        go.name = Path.GetFileNameWithoutExtension(path);
        go.transform.SetParent(parent, false);
        go.transform.localPosition = pos;
        return go;
    }

    // 앨비도 텍스처가 실제로 물려 있는지 (셰이더별 프로퍼티 이름을 가정하지 않는다)
    static bool HasAlbedoTexture(Material m)
    {
        if (m == null || m.shader == null) return false;
        int c = m.shader.GetPropertyCount();
        for (int i = 0; i < c; i++)
        {
            if (m.shader.GetPropertyType(i) !=
                UnityEngine.Rendering.ShaderPropertyType.Texture) continue;
            var name = m.shader.GetPropertyName(i);
            var lower = name.ToLower();
            if (!lower.Contains("basecolor") && !lower.Contains("maintex")) continue;
            if (m.GetTexture(name) != null) return true;
        }
        return false;
    }

    // COLOR_0을 가진 메시에 정점 컬러 머티리얼을 붙인다.
    // glTFast의 PbrMetallicRoughness도 Unity Standard도 정점 컬러를 무시하므로,
    // 읽어주는 셰이더로 바꿔줘야 색이 나온다 (잡초 + 잡석).
    // 텍스처가 있는 머티리얼(드럼통·벽돌·표지판)은 건드리지 않는다.
    static int ApplyVertexColorMaterials(Transform root, Material vcMat)
    {
        int applied = 0;
        foreach (var r in root.GetComponentsInChildren<MeshRenderer>(true))
        {
            var mf = r.GetComponent<MeshFilter>();
            if (mf == null || mf.sharedMesh == null) continue;
            var cols = mf.sharedMesh.colors32;
            if (cols == null || cols.Length == 0) continue;
            if (HasAlbedoTexture(r.sharedMaterial)) continue;

            r.sharedMaterial = vcMat;
            applied++;
            Debug.Log($"VCOLOR target: {r.gameObject.name} verts={mf.sharedMesh.vertexCount}");
        }
        return applied;
    }

    // 잡초용 — 정점 컬러 + 바람 흔들림
    static Material WindMaterial()
    {
        const string path = "Assets/Materials/VertexColorWind.mat";
        var existing = AssetDatabase.LoadAssetAtPath<Material>(path);
        if (existing != null) return existing;

        var shader = Shader.Find("Custom/VertexColorWind");
        if (shader == null)
        {
            Debug.LogError("셰이더 'Custom/VertexColorWind' 를 찾을 수 없음");
            return null;
        }
        Directory.CreateDirectory(Path.Combine(Application.dataPath, "Materials"));
        var m = new Material(shader) { name = "VertexColorWind" };
        m.SetFloat("_Smoothness", 0.12f);
        AssetDatabase.CreateAsset(m, path);
        AssetDatabase.SaveAssets();
        Debug.Log($"WIND_MAT created {path}");
        return m;
    }

    // 정점 컬러를 읽는 머티리얼. 없으면 만들어서 에셋으로 남긴다.
    static Material VertexColorMaterial()
    {
        const string dir = "Assets/Materials";
        const string path = dir + "/VertexColor.mat";

        // 잡초 전용이던 이전 이름은 정리한다
        const string legacy = dir + "/WeedVertexColor.mat";
        if (AssetDatabase.LoadAssetAtPath<Material>(legacy) != null)
            AssetDatabase.DeleteAsset(legacy);

        var existing = AssetDatabase.LoadAssetAtPath<Material>(path);
        if (existing != null) return existing;

        var shader = Shader.Find("Custom/VertexColorLit");
        if (shader == null)
        {
            Debug.LogError("셰이더 'Custom/VertexColorLit' 를 찾을 수 없음");
            return null;
        }

        Directory.CreateDirectory(Path.Combine(Application.dataPath, "Materials"));
        var mat = new Material(shader) { name = "VertexColor" };
        mat.SetFloat("_Smoothness", 0.12f);
        mat.SetFloat("_Metallic", 0f);
        AssetDatabase.CreateAsset(mat, path);
        AssetDatabase.SaveAssets();
        Debug.Log($"VCOLOR_MAT created {path}");
        return mat;
    }

    // ── 환경값 이식 ───────────────────────────────────────────────────────────
    // 전부 web/src/world.js createLights() / createSky() 의 값을 그대로 옮긴 것.
    // 중요: glTF -> Unity 임포트에서 축 하나가 반전되므로 광원 방향도 같이 뒤집어야
    // 그림자가 반대쪽으로 떨어지지 않는다. 지오메트리만 반전시키고 빛을 그대로 두면
    // 태양이 반대편에서 비추게 된다.
    // 어느 축을 뒤집는지는 규약(pipeline/contract.json)이 정한다 — 실측 결과 X다.
    static Vector3 FlipImportAxis(Vector3 v)
    {
        switch (PipelineContract.GltfToUnityAxisFlip)
        {
            case "X": return new Vector3(-v.x, v.y, v.z);
            case "Y": return new Vector3(v.x, -v.y, v.z);
            case "Z": return new Vector3(v.x, v.y, -v.z);
            default:
                Debug.LogError($"알 수 없는 axisFlip: {PipelineContract.GltfToUnityAxisFlip}");
                return v;
        }
    }

    // three.js는 라이트 color를 sRGB로 받아 내부에서 선형 변환한다.
    // Unity의 Light.color도 감마(sRGB) 기준이라 헥스 값을 그대로 넣으면 된다.
    // 메시의 시각적 정면이 dir 을 향하게 하는 회전.
    // PlayerController.FaceDir 과 같은 식이어야 한다 — 에디터 포즈와 런타임 포즈가
    // 갈라지면 Scene 뷰와 Play에서 캐릭터가 반대를 본다.
    static Quaternion FaceDir(Vector3 dir) =>
        Quaternion.LookRotation(dir) * Quaternion.Euler(0f, PipelineContract.ModelYawDegrees, 0f);

    static Color Srgb(int hex) => new Color(
        ((hex >> 16) & 0xFF) / 255f,
        ((hex >> 8) & 0xFF) / 255f,
        (hex & 0xFF) / 255f);

    static void SetupEnvironment()
    {
        // --- 태양: DirectionalLight(0xfff0d8, 2.5), position (26, 28, 20) ---
        // three는 position -> 원점 방향으로 비춘다. Unity는 transform.forward가 방향.
        var sunFrom = FlipImportAxis(new Vector3(26f, 28f, 20f));
        var sunGo = new GameObject("Sun");
        var sun = sunGo.AddComponent<Light>();
        sun.type = LightType.Directional;
        sun.color = Srgb(0xfff0d8);
        sun.intensity = SunIntensity;
        sun.shadows = LightShadows.Soft;
        sun.shadowStrength = 0.82f;
        sunGo.transform.rotation = Quaternion.LookRotation(-sunFrom.normalized);

        // --- 채움광: DirectionalLight(0xbcd2ee, 0.28), position (-18, 12, -14) ---
        var fillFrom = FlipImportAxis(new Vector3(-18f, 12f, -14f));
        var fillGo = new GameObject("Fill");
        var fill = fillGo.AddComponent<Light>();
        fill.type = LightType.Directional;
        fill.color = Srgb(0xbcd2ee);
        fill.intensity = FillIntensity;
        fill.shadows = LightShadows.None;   // 브라우저에서도 그림자 없음
        fillGo.transform.rotation = Quaternion.LookRotation(-fillFrom.normalized);

        // --- 앰비언트: HemisphereLight(sky 0x9dbbdd, ground 0x6b5b48, 0.42) ---
        // Unity의 Trilight가 반구광에 가장 가깝다. 세기는 색에 곱해 넣는다.
        // three는 색을 선형으로 변환한 뒤 intensity를 곱한다. Unity의 ambient* 는
        // 감마 기준으로 받으므로, 선형에서 세기를 곱하고 다시 감마로 되돌려야 한다.
        // (감마 값에 바로 0.42를 곱하면 Unity가 한 번 더 선형화해서 3배쯤 어두워진다)
        // Unity의 Trilight는 반구광 근사가 거칠어서 위를 향한 면이 과하게 어두워진다.
        // 실제 그라디언트 하늘을 컨볼브해서 쓰는 Skybox 모드가 three의 HemisphereLight에
        // 훨씬 가깝다. 세기는 스크린샷 비교로 맞춘 값.
        var skyC = Srgb(0x9dbbdd);
        var grdC = Srgb(0x6b5b48);
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Skybox;
        RenderSettings.ambientIntensity = AmbientIntensity;
        // Trilight로 되돌릴 때를 위해 색은 그대로 채워둔다
        RenderSettings.ambientSkyColor = skyC;
        RenderSettings.ambientEquatorColor = Color.Lerp(skyC, grdC, 0.5f);
        RenderSettings.ambientGroundColor = grdC;

        // --- 안개: THREE.Fog(0xd2cdc0, 62, 210) ---
        RenderSettings.fog = true;
        RenderSettings.fogMode = FogMode.Linear;
        RenderSettings.fogColor = Srgb(0xd2cdc0);
        RenderSettings.fogStartDistance = 62f;
        RenderSettings.fogEndDistance = 210f;

        // --- 하늘: 브라우저와 같은 5스톱 그라디언트 ---
        RenderSettings.skybox = SkyMaterial();
        RenderSettings.defaultReflectionMode =
            UnityEngine.Rendering.DefaultReflectionMode.Skybox;
        // 스카이박스 앰비언트/리플렉션 프로브를 지금 갱신한다 (배치모드에서는 자동 갱신 안 됨)
        DynamicGI.UpdateEnvironment();

        Debug.Log($"ENV sun={sunGo.transform.eulerAngles} fill={fillGo.transform.eulerAngles} " +
                  $"ambient={RenderSettings.ambientMode}@{RenderSettings.ambientIntensity}");
    }

    static Material SkyMaterial()
    {
        const string path = "Assets/Materials/GradientSky.mat";
        var existing = AssetDatabase.LoadAssetAtPath<Material>(path);
        if (existing != null) return existing;

        var shader = Shader.Find("Custom/GradientSky");
        if (shader == null)
        {
            Debug.LogError("셰이더 'Custom/GradientSky' 를 찾을 수 없음");
            return null;
        }
        Directory.CreateDirectory(Path.Combine(Application.dataPath, "Materials"));
        var m = new Material(shader) { name = "GradientSky" };
        AssetDatabase.CreateAsset(m, path);
        AssetDatabase.SaveAssets();
        Debug.Log($"SKY_MAT created {path}");
        return m;
    }

    public static void Run()
    {
        AssetDatabase.Refresh();
        Directory.CreateDirectory(Path.Combine(Application.dataPath, "Scenes"));

        var scene = EditorSceneManager.NewScene(
            NewSceneSetup.EmptyScene, NewSceneMode.Single);

        var root = new GameObject("VacantLot").transform;

        // 브라우저 씬의 모든 조각. 하나라도 빠지면 눈에 바로 띈다
        // (초기 버전에서 road/walls/poles를 빼먹어 도로도 담장도 전봇대도 없었다)
        foreach (var piece in new[]
        {
            "ground.glb",
            "road.glb",
            "walls.glb",
            "houses.glb",
            "poles.glb",
            "props.glb",
        })
        {
            Place(piece, root, Vector3.zero);
        }

        var weeds = Place("weeds_baked.glb", root, Vector3.zero);

        // 정점 컬러를 가진 메시(잡초, 잡석)에 전용 머티리얼을 일괄 적용
        var vcMat = VertexColorMaterial();
        if (vcMat != null)
        {
            int n = ApplyVertexColorMaterials(root, vcMat);
            Debug.Log($"VCOLOR_MAT applied to {n} renderer(s)");
        }

        // 잡초만 바람 머티리얼로 덮어쓴다.
        // 잡석도 같은 정점 컬러 메시지만 박스라서 흔들리면 안 된다
        // (바람 셰이더는 uv.y 를 잎 높이로 해석하는데 박스 UV에는 그 의미가 없다).
        var windMat = WindMaterial();
        if (weeds != null && windMat != null)
        {
            var rs = weeds.GetComponentsInChildren<MeshRenderer>(true);
            foreach (var r in rs) r.sharedMaterial = windMat;
            Debug.Log($"WIND_MAT applied to {rs.Length} renderer(s)");
        }

        // 바람 시간 공급자
        var windGo = new GameObject("WindTime");
        windGo.AddComponent<WindTime>();

        // 잡초만 그림자 캐스팅을 끈다. 브라우저도 받기만 하고 드리우지 않으며,
        // 켜두면 72,000 삼각형이 흙바닥을 새카맣게 덮는다. 잡석은 켜둔다.
        if (weeds != null)
        {
            foreach (var r in weeds.GetComponentsInChildren<MeshRenderer>(true))
                r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        }

        // 캐릭터는 GLB가 아니라 FBX를 쓴다 — 휴머노이드 아바타가 붙은 쪽이라
        // Animator/Mecanim을 그대로 쓸 수 있다 (glTFast 경로는 아바타를 안 만든다).
        var chr = PlacePath(AnimatorSetup.CharacterFbx, root, new Vector3(0f, 0.1f, 12.6f));
        if (chr != null)
        {
            chr.name = "character";

            // 에디터 포즈를 런타임과 같은 식으로 계산한다.
            // 전에는 여기서 Euler(0,180,0)을, PlayerController가 따로 modelYaw=180을
            // 적용해서 같은 문제에 대한 보정이 두 곳에 있었다. 런타임에 덮어써져
            // 겉으론 맞았지만 Scene 뷰와 Play의 캐릭터 방향이 반대였다.
            chr.transform.localRotation = FaceDir(Vector3.back);

            // UnityEngine.Object 에는 ?? / ?. 를 쓰면 안 된다.
            // GetComponent가 컴포넌트 없음을 "가짜 null"(C# 참조는 살아있음)로 돌려주기 때문에
            // ?? 는 통과해버리고, 이후 프로퍼티 접근에서 MissingComponentException이 난다.
            // Unity가 오버로드한 == 로 명시적으로 검사해야 한다.
            var animator = chr.GetComponent<Animator>();
            if (animator == null) animator = chr.AddComponent<Animator>();
            animator.runtimeAnimatorController =
                AssetDatabase.LoadAssetAtPath<RuntimeAnimatorController>(AnimatorSetup.ControllerPath);
            var avatar = AssetDatabase.LoadAllAssetsAtPath(AnimatorSetup.CharacterFbx)
                .OfType<Avatar>().FirstOrDefault();
            if (avatar != null) animator.avatar = avatar;
            animator.applyRootMotion = false;               // 이동은 컨트롤러가 아니라 코드가 한다
            animator.cullingMode = AnimatorCullingMode.AlwaysAnimate;

            // 물리·조작. 지형 높이 함수를 옮기는 대신 Unity 물리에 맡긴다.
            var cc = chr.GetComponent<CharacterController>();
            if (cc == null) cc = chr.AddComponent<CharacterController>();
            cc.radius = 0.32f;      // controls.js RADIUS
            cc.height = 1.72f;
            cc.center = new Vector3(0f, 0.86f, 0f);
            cc.stepOffset = 0.45f;  // controls.js STEP
            cc.slopeLimit = 50f;
            cc.skinWidth = 0.02f;

            var pc = chr.GetComponent<PlayerController>();
            if (pc == null) pc = chr.AddComponent<PlayerController>();
            pc.animator = animator;
            // 런타임 스크립트가 좌표계 규약을 직접 알지 않게, 씬 조립 시점에 주입한다
            pc.modelYaw = PipelineContract.ModelYawDegrees;

            Debug.Log($"ANIMATOR attached controller={(animator.runtimeAnimatorController != null)} " +
                      $"avatar={(animator.avatar != null ? animator.avatar.name : "none")} " +
                      $"isHuman={(animator.avatar != null && animator.avatar.isHuman)}");
        }

        // 캐릭터가 밟고 부딪힐 것들에 콜라이더를 붙인다.
        // 브라우저도 집·담장만 충돌체로 썼으므로 같은 범위로 맞춘다
        // (잡초 7,200 / 잡석 300에 콜라이더를 달면 의미 없이 무거워진다).
        int colliders = 0;
        foreach (var name in new[] { "ground", "road", "walls", "houses" })
        {
            var piece = root.Find(name);
            if (piece == null) continue;
            foreach (var mf in piece.GetComponentsInChildren<MeshFilter>(true))
            {
                if (mf.sharedMesh == null) continue;
                if (mf.GetComponent<MeshCollider>() != null) continue;
                mf.gameObject.AddComponent<MeshCollider>();
                colliders++;
            }
        }
        Debug.Log($"COLLIDERS {colliders} MeshCollider 추가 (ground/road/walls/houses)");

        SetupEnvironment();

        // 카메라 — 브라우저 기본 시점과 같은 자리 (X 반전 반영)
        var camGo = new GameObject("Main Camera");
        camGo.tag = "MainCamera";
        var cam = camGo.AddComponent<Camera>();
        cam.fieldOfView = 52f;                 // web/src/main.js PerspectiveCamera(52, ...)
        cam.nearClipPlane = 0.1f;
        cam.farClipPlane = 900f;
        cam.clearFlags = CameraClearFlags.Skybox;
        cam.allowHDR = true;   // 톤매핑 전에 1.0을 넘는 값을 보존해야 한다
        camGo.transform.position = new Vector3(-3f, 9.5f, 24.5f);
        camGo.transform.LookAt(new Vector3(0f, 1f, -3f));

        // ACES 톤매핑 (three.js와 같은 커브)
        var tm = camGo.AddComponent<AcesTonemapper>();
        tm.exposure = ToneExposure;
        Debug.Log($"TONEMAP ACES exposure={ToneExposure} hdr={cam.allowHDR}");

        // 스프링암 카메라를 플레이어에 연결 (Play 모드에서 3인칭 추적)
        if (chr != null)
        {
            var pc = chr.GetComponent<PlayerController>();
            if (pc != null) pc.cameraTarget = camGo.transform;
        }

        EditorSceneManager.SaveScene(scene, ScenePath);
        EditorBuildSettings.scenes = new[]
        {
            new EditorBuildSettingsScene(ScenePath, true)
        };
        AssetDatabase.SaveAssets();

        // 배치모드에서 이 씬을 열어두면 GUI가 다음에 이걸 복원한다
        EditorSceneManager.OpenScene(ScenePath);

        Debug.Log($"SCENE_BUILT {ScenePath}");
    }

    // 저장된 씬을 Main Camera 시점으로 렌더해 PNG로 떨어뜨린다.
    // 에디터를 열지 않고도 조립 결과를 확인하기 위한 것.
    public static void Shot()
    {
        EditorSceneManager.OpenScene(ScenePath);

        var cam = Camera.main;
        if (cam == null)
        {
            Debug.LogError("Main Camera 없음");
            return;
        }

        const int W = 1280, H = 720;
        var rt = new RenderTexture(W, H, 24, RenderTextureFormat.ARGB32);
        rt.antiAliasing = 4;
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
        var png = Path.Combine(dir, "scene.png");
        File.WriteAllBytes(png, tex.EncodeToPNG());

        cam.targetTexture = null;
        rt.Release();
        Object.DestroyImmediate(rt);
        Object.DestroyImmediate(tex);

        // 조립된 조각 목록도 같이 찍어둔다
        var root = GameObject.Find("VacantLot");
        var names = root == null
            ? "(VacantLot 없음)"
            : string.Join(", ", Enumerable.Range(0, root.transform.childCount)
                .Select(i => root.transform.GetChild(i).name));

        Debug.Log($"SCENE_SHOT {png}\nPIECES {names}");
    }

    // Unity 배치 1회당 고정 비용이 ~5.5초(라이선싱 1.6 + 도메인 리로드 2.4 +
    // 스크립트 컴파일 0.5 + 에셋 리프레시 2.7)다. 세 작업을 따로 띄우면
    // 시작 비용만 3배로 내는 셈이라 한 진입점으로 묶는다.
    public static void All()
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        long t0 = 0;
        void Mark(string label)
        {
            var now = sw.ElapsedMilliseconds;
            Debug.Log($"TIMING {label,-16} {now - t0,6}ms");
            t0 = now;
        }

        AnimatorSetup.Build();   // 씬이 컨트롤러를 참조하므로 먼저 만든다
        Mark("AnimatorSetup");
        Run();
        Mark("BuildScene");
        Shot();
        Mark("Shot");
        AnimatorSetup.Verify();
        Mark("AnimatorVerify");
        Debug.Log($"TIMING {"TOTAL",-16} {sw.ElapsedMilliseconds,6}ms");
    }

    // 에셋 23개를 전부 검사·렌더하는 ImportCheck는 1.4초가 든다.
    // 씬만 갱신할 때는 필요 없으므로 All()에서 떼어내고 별도 진입점으로 둔다.
    public static void Full()
    {
        All();
        ImportCheck.Run();
    }
}
