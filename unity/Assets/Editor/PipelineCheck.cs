// 파이프라인 적합성 검사 — 유니티 단계의 단일 진입점.
//
// 이전에는 질문 하나에 답하려고 즉석에서 만든 진단 스크립트가 9개 흩어져 있었다
// (DiagFeet / DiagGround / DiagWind / TuneLighting / VerifyAnimation / ...).
// 서로를 모르니 "지금 파이프라인이 건강한가?"에 한 번에 답할 수가 없었다.
//
// 여기서는 pipeline/contract.json 의 불변식을 항목별로 검사하고, 하나라도
// 깨지면 실패 코드로 종료한다. 통과/실패가 기계 판정이므로 회귀가 조용히
// 지나가지 않는다.
//
// 실행:
//   Unity.exe -batchmode -quit -projectPath <unity> -executeMethod PipelineCheck.Run -logFile -
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

public static class PipelineCheck
{
    const string CharacterFbx = "Assets/ProceduralImport/fbx_loose/character.fbx";
    const string GlbDir = "Assets/ProceduralImport/glb";
    const string ScenePath = "Assets/Scenes/VacantLot.unity";

    class Result
    {
        public string Stage;
        public string Name;
        public bool Pass;
        public string Detail;
        // 기계가 읽을 수 있는 실측값. --accept 가 규약의 내용 의존 값을 갱신할 때 쓴다.
        // 텍스트 detail 을 파싱하는 건 깨지기 쉬우므로 숫자를 따로 싣는다.
        public float? Measured;
    }

    static readonly List<Result> Results = new List<Result>();

    static void Check(string stage, string name, bool pass, string detail, float? measured = null)
    {
        Results.Add(new Result
        {
            Stage = stage, Name = name, Pass = pass, Detail = detail, Measured = measured,
        });
        Debug.Log($"CHECK [{(pass ? "PASS" : "FAIL")}] {stage}/{name}  {detail}");
    }

    static string F(float v) => v.ToString("0.###", CultureInfo.InvariantCulture);

    public static void Run()
    {
        Results.Clear();
        AssetDatabase.Refresh();

        Debug.Log($"PIPELINE_CHECK contract v{PipelineContract.Version} " +
                  $"axisFlip={PipelineContract.GltfToUnityAxisFlip} " +
                  $"modelYaw={PipelineContract.ModelYawDegrees}");

        StageStaticAssets();
        StageCharacterAsset();
        StageCharacterAnimation();
        StageScene();

        var failed = Results.Count(r => !r.Pass);
        var report = BuildReport(failed);
        var dir = Path.GetFullPath(Path.Combine(Application.dataPath, "..", "Reports"));
        Directory.CreateDirectory(dir);
        File.WriteAllText(Path.Combine(dir, "pipeline-check.json"), report);

        Debug.Log($"PIPELINE_RESULT {Results.Count - failed}/{Results.Count} 통과, {failed} 실패");
        Debug.Log("PIPELINE_JSON_BEGIN\n" + report + "\nPIPELINE_JSON_END");

        if (failed > 0)
        {
            // 배치모드에서 실패를 종료 코드로 전달해야 상위 오케스트레이터가 안다
            EditorApplication.Exit(1);
        }
    }

    // ── 1단계: 정적 에셋 ──────────────────────────────────────────────────

    static void StageStaticAssets()
    {
        const string S = "static";

        foreach (var kv in PipelineContract.StaticPieceTriangles)
        {
            var path = $"{GlbDir}/{kv.Key}.glb";
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
            if (prefab == null)
            {
                Check(S, $"{kv.Key}.exists", false, $"{path} 없음");
                continue;
            }

            var inst = (GameObject)UnityEngine.Object.Instantiate(prefab);
            int tris = CountTriangles(inst);
            // 인스턴스가 안 구워지면 값이 크게 줄어든다 (잡초 72000 -> 10)
            Check(S, $"{kv.Key}.triangles", tris == kv.Value,
                  $"{tris} (기대 {kv.Value})", tris);

            // 루트 트랜스폼이 원점인지 — 런타임 좌표가 박히면 공중에 뜬다
            var mag = inst.transform.localPosition.magnitude;
            Check(S, $"{kv.Key}.rootAtOrigin", PipelineContract.RootTranslation.Ok(mag),
                  $"|translation|={F(mag)} (기대 {PipelineContract.RootTranslation})");

            UnityEngine.Object.DestroyImmediate(inst);
        }

        foreach (var kv in PipelineContract.VertexColorMeshes)
        {
            var path = $"{GlbDir}/{kv.Key}.glb";
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
            if (prefab == null) { Check(S, $"{kv.Key}.vcolor", false, "에셋 없음"); continue; }

            var inst = (GameObject)UnityEngine.Object.Instantiate(prefab);
            int n = AllMeshes(inst).Count(m =>
                m.HasVertexAttribute(UnityEngine.Rendering.VertexAttribute.Color));
            Check(S, $"{kv.Key}.vertexColorMeshes", n >= kv.Value,
                  $"{n}개 (기대 {kv.Value}개 이상)", n);
            UnityEngine.Object.DestroyImmediate(inst);
        }
    }

    // ── 2단계: 캐릭터 에셋 ────────────────────────────────────────────────

    static void StageCharacterAsset()
    {
        const string S = "character";

        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(CharacterFbx);
        if (prefab == null) { Check(S, "exists", false, $"{CharacterFbx} 없음"); return; }
        Check(S, "exists", true, CharacterFbx);

        var inst = (GameObject)UnityEngine.Object.Instantiate(prefab);
        inst.transform.position = Vector3.zero;
        inst.transform.rotation = Quaternion.identity;

        var smr = inst.GetComponentInChildren<SkinnedMeshRenderer>();
        Check(S, "isSkinned", smr != null, smr != null ? "SkinnedMeshRenderer 있음" : "없음");

        if (smr != null)
        {
            Check(S, "boneCount", smr.bones.Length == PipelineContract.CharacterBoneCount,
                  $"{smr.bones.Length} (기대 {PipelineContract.CharacterBoneCount})");
            Check(S, "rootBone",
                  smr.rootBone != null && smr.rootBone.name == PipelineContract.CharacterRootBone,
                  smr.rootBone != null ? smr.rootBone.name : "(none)");

            var m = smr.sharedMesh;
            int tris = 0;
            for (int i = 0; i < m.subMeshCount; i++) tris += (int)(m.GetIndexCount(i) / 3);
            Check(S, "triangles", tris == PipelineContract.CharacterTriangles,
                  $"{tris} (기대 {PipelineContract.CharacterTriangles})", tris);
            Check(S, "submeshes", m.subMeshCount == PipelineContract.CharacterSubmeshes,
                  $"{m.subMeshCount} (기대 {PipelineContract.CharacterSubmeshes})", m.subMeshCount);

            // 키 — 스케일 규약(useFileScale)이 깨지면 100배로 튄다
            var h = smr.bounds.size.y;
            Check(S, "heightMeters", PipelineContract.CharacterHeight.Ok(h),
                  $"{F(h)}m (기대 {PipelineContract.CharacterHeight})");

            // 시각적 발바닥이 루트에 붙어 있는지 — 어긋나면 뜨거나 파묻힌다
            var foot = smr.bounds.min.y - inst.transform.position.y;
            Check(S, "footToRoot", PipelineContract.FootToRoot.Ok(foot),
                  $"{F(foot)}m (기대 {PipelineContract.FootToRoot})");
        }

        var avatar = AssetDatabase.LoadAllAssetsAtPath(CharacterFbx).OfType<Avatar>().FirstOrDefault();
        Check(S, "avatarIsHuman",
              avatar != null && avatar.isHuman == PipelineContract.CharacterAvatarIsHuman && avatar.isValid,
              avatar == null ? "Avatar 없음" : $"isHuman={avatar.isHuman} valid={avatar.isValid}");

        var importer = AssetImporter.GetAtPath(CharacterFbx) as ModelImporter;
        Check(S, "useFileScale",
              importer != null && importer.useFileScale == PipelineContract.UseFileScale,
              importer == null ? "importer 없음" : $"{importer.useFileScale}");

        UnityEngine.Object.DestroyImmediate(inst);
    }

    // ── 3단계: 캐릭터 애니메이션 ──────────────────────────────────────────

    static void StageCharacterAnimation()
    {
        const string S = "animation";

        var clips = AssetDatabase.LoadAllAssetsAtPath(CharacterFbx)
            .OfType<AnimationClip>()
            .Where(c => !c.name.StartsWith("__preview"))
            .ToList();

        foreach (var kv in PipelineContract.ClipSeconds)
        {
            var clip = clips.FirstOrDefault(c => c.name.EndsWith(kv.Key, StringComparison.OrdinalIgnoreCase));
            if (clip == null) { Check(S, $"{kv.Key}.exists", false, "클립 없음"); continue; }

            Check(S, $"{kv.Key}.seconds", kv.Value.Ok(clip.length),
                  $"{F(clip.length)}s (기대 {kv.Value})");

            bool shouldLoop = PipelineContract.LoopClips.Contains(kv.Key);
            Check(S, $"{kv.Key}.loop", clip.isLooping == shouldLoop,
                  $"isLooping={clip.isLooping} (기대 {shouldLoop})");
        }

        // 브라우저 수식으로 손계산한 포즈와 일치하는지.
        // 축·부호·보간이 파이프라인 어디서든 틀어지면 여기서 잡힌다.
        var walk = clips.FirstOrDefault(c => c.name.EndsWith("Walk", StringComparison.OrdinalIgnoreCase));
        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(CharacterFbx);
        if (walk != null && prefab != null)
        {
            var inst = (GameObject)UnityEngine.Object.Instantiate(prefab);
            walk.SampleAnimation(inst, 0.25f * walk.length);   // 위상 π/2

            foreach (var kv in PipelineContract.WalkPoseDegrees)
            {
                var bone = FindDeep(inst.transform, kv.Key);
                if (bone == null) { Check(S, $"pose.{kv.Key}", false, "본 없음"); continue; }
                float x = bone.localEulerAngles.x;
                if (x > 180f) x -= 360f;
                Check(S, $"pose.{kv.Key}", kv.Value.Ok(x), $"{F(x)}° (기대 {kv.Value})");
            }
            UnityEngine.Object.DestroyImmediate(inst);
        }
    }

    // ── 4단계: 조립된 씬 ──────────────────────────────────────────────────

    static void StageScene()
    {
        const string S = "scene";

        if (!File.Exists(ScenePath)) { Check(S, "exists", false, $"{ScenePath} 없음"); return; }
        EditorSceneManager.OpenScene(ScenePath);

        var root = GameObject.Find("VacantLot");
        Check(S, "root", root != null, root != null ? $"자식 {root.transform.childCount}개" : "없음");
        if (root == null) return;

        // 브라우저 씬의 모든 조각이 들어왔는지. 하나라도 빠지면 눈에 바로 띈다
        // (초기에 road/walls/poles 세 개가 누락돼 있었다).
        var expected = new[] { "ground", "road", "walls", "houses", "poles", "props", "weeds_baked", "character" };
        var present = Enumerable.Range(0, root.transform.childCount)
            .Select(i => root.transform.GetChild(i).name).ToHashSet();
        foreach (var name in expected)
            Check(S, $"piece.{name}", present.Contains(name), present.Contains(name) ? "있음" : "누락");

        var chr = root.transform.Find("character");
        if (chr != null)
        {
            var cc = chr.GetComponent<CharacterController>();
            var smr = chr.GetComponentInChildren<SkinnedMeshRenderer>();
            if (cc != null && smr != null)
            {
                var bottom = chr.position.y + cc.center.y - cc.height * 0.5f;
                var gap = smr.bounds.min.y - bottom;
                Check(S, "character.capsuleAlignment", PipelineContract.FootToRoot.Ok(gap),
                      $"발바닥-캡슐바닥 {F(gap)}m (기대 {PipelineContract.FootToRoot})");
            }

            var pc = chr.GetComponent<PlayerController>();
            Check(S, "character.modelYawInjected",
                  pc != null && Mathf.Approximately(pc.modelYaw, PipelineContract.ModelYawDegrees),
                  pc == null ? "PlayerController 없음" : $"modelYaw={F(pc.modelYaw)}");

            var animator = chr.GetComponent<Animator>();
            Check(S, "character.animator",
                  animator != null && animator.runtimeAnimatorController != null &&
                  animator.avatar != null && animator.avatar.isHuman,
                  animator == null ? "Animator 없음"
                      : $"controller={(animator.runtimeAnimatorController != null)} " +
                        $"avatarHuman={(animator.avatar != null && animator.avatar.isHuman)}");
        }
    }

    // ── 유틸 ──────────────────────────────────────────────────────────────

    static IEnumerable<Mesh> AllMeshes(GameObject go)
    {
        foreach (var f in go.GetComponentsInChildren<MeshFilter>(true))
            if (f.sharedMesh != null) yield return f.sharedMesh;
        foreach (var s in go.GetComponentsInChildren<SkinnedMeshRenderer>(true))
            if (s.sharedMesh != null) yield return s.sharedMesh;
    }

    // GetIndexCount 를 쓴다 — mesh.triangles 는 호출마다 대형 배열을 할당한다
    static int CountTriangles(GameObject go)
    {
        int tris = 0;
        foreach (var m in AllMeshes(go))
            for (int i = 0; i < m.subMeshCount; i++)
                tris += (int)(m.GetIndexCount(i) / 3);
        return tris;
    }

    static Transform FindDeep(Transform root, string name)
    {
        if (root.name == name) return root;
        for (int i = 0; i < root.childCount; i++)
        {
            var r = FindDeep(root.GetChild(i), name);
            if (r != null) return r;
        }
        return null;
    }

    static string Esc(string s) => s.Replace("\\", "\\\\").Replace("\"", "\\\"");

    static string BuildReport(int failed)
    {
        var sb = new System.Text.StringBuilder();
        sb.Append("{\n");
        sb.Append($"  \"contractVersion\": {PipelineContract.Version},\n");
        sb.Append($"  \"total\": {Results.Count},\n");
        sb.Append($"  \"failed\": {failed},\n");
        sb.Append("  \"checks\": [\n");
        for (int i = 0; i < Results.Count; i++)
        {
            var r = Results[i];
            var meas = r.Measured.HasValue
                ? r.Measured.Value.ToString("0.####", CultureInfo.InvariantCulture)
                : "null";
            sb.Append($"    {{ \"stage\": \"{Esc(r.Stage)}\", \"name\": \"{Esc(r.Name)}\", " +
                      $"\"pass\": {(r.Pass ? "true" : "false")}, \"measured\": {meas}, " +
                      $"\"detail\": \"{Esc(r.Detail)}\" }}" +
                      (i < Results.Count - 1 ? ",\n" : "\n"));
        }
        sb.Append("  ]\n}");
        return sb.ToString();
    }
}
