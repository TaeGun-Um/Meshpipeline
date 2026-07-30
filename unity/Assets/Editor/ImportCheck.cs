// 절차적으로 생성된 모델이 Unity에서 무엇을 유지하고 무엇을 잃는지 검사한다.
// 실행:
//   Unity.exe -batchmode -quit -projectPath <unity> -executeMethod ImportCheck.Run -logFile -
// 결과: unity/Reports/import-report.json + 모델별 PNG 렌더
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using UnityEditor;
using UnityEngine;

public static class ImportCheck
{
    const string Root = "Assets/ProceduralImport";

    static string OutDir =>
        Path.GetFullPath(Path.Combine(Application.dataPath, "..", "Reports"));

    static string Esc(string s) =>
        s.Replace("\\", "\\\\").Replace("\"", "\\\"");

    static string F(float v) => v.ToString("0.###", CultureInfo.InvariantCulture);

    public static void Run()
    {
        AssetDatabase.Refresh();
        Directory.CreateDirectory(OutDir);

        var paths = Directory
            .GetFiles(Root, "*.*", SearchOption.AllDirectories)
            .Select(p => p.Replace('\\', '/'))
            .Where(p => p.EndsWith(".glb") || p.EndsWith(".fbx") || p.EndsWith(".gltf"))
            .OrderBy(p => p)
            .ToList();

        var records = new List<string>();
        foreach (var p in paths)
            records.Add(Inspect(p));

        var json = "[\n" + string.Join(",\n", records) + "\n]";
        File.WriteAllText(Path.Combine(OutDir, "import-report.json"), json);
        Debug.Log("UNITY_JSON_BEGIN\n" + json + "\nUNITY_JSON_END");
    }

    static string Inspect(string assetPath)
    {
        var sb = new StringBuilder();
        // 같은 파일명이 폴더별로 여러 벌 있으므로 Root 기준 상대경로로 구분한다
        var rel = assetPath.Substring(Root.Length).TrimStart('/');
        sb.Append(" {\n");
        sb.Append($"  \"asset\": \"{Esc(rel)}\",\n");
        sb.Append($"  \"format\": \"{Path.GetExtension(assetPath).TrimStart('.')}\",\n");

        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(assetPath);
        if (prefab == null)
        {
            sb.Append("  \"import\": \"FAILED (에셋으로 인식되지 않음 — 임포터 없음?)\"\n }");
            return sb.ToString();
        }
        sb.Append("  \"import\": \"ok\",\n");

        var inst = (GameObject)Object.Instantiate(prefab);
        inst.transform.position = Vector3.zero;

        var transforms = inst.GetComponentsInChildren<Transform>(true);
        var renderers = inst.GetComponentsInChildren<MeshRenderer>(true);
        var filters = inst.GetComponentsInChildren<MeshFilter>(true);

        int verts = 0, tris = 0, submeshes = 0, meshesWithColor = 0;
        var bounds = new Bounds();
        bool boundsInit = false;

        // SkinnedMeshRenderer는 MeshFilter가 없다. 둘 다 훑어야 스켈레탈 메시가
        // 집계에서 빠지지 않는다 (안 그러면 캐릭터 삼각형이 0으로 나온다).
        var allMeshes = filters
            .Select(f => f.sharedMesh)
            .Concat(inst.GetComponentsInChildren<SkinnedMeshRenderer>(true)
                        .Select(s => s.sharedMesh))
            .Where(m => m != null);

        // mesh.triangles / mesh.colors32 는 매번 배열을 새로 할당한다.
        // ground 96,800 · weeds 72,000 삼각형을 glb/fbx/fbx_loose 3벌씩 훑으면
        // 수십만 개 int 배열을 계속 만들고 버리는 셈이다. 개수만 필요하므로
        // GetIndexCount / HasVertexAttribute 로 바꿔 할당을 0으로 만든다.
        foreach (var m in allMeshes)
        {
            verts += m.vertexCount;
            for (int s = 0; s < m.subMeshCount; s++)
                tris += (int)(m.GetIndexCount(s) / 3);
            submeshes += m.subMeshCount;
            if (m.HasVertexAttribute(UnityEngine.Rendering.VertexAttribute.Color))
                meshesWithColor++;
        }

        // SkinnedMeshRenderer는 MeshRenderer가 아니라 Renderer를 상속한다.
        // MeshRenderer만 보면 스켈레탈 메시의 머티리얼과 바운딩이 0으로 나온다.
        var allRenderers = inst.GetComponentsInChildren<Renderer>(true);
        foreach (var r in allRenderers)
        {
            if (!boundsInit) { bounds = r.bounds; boundsInit = true; }
            else bounds.Encapsulate(r.bounds);
        }

        var mats = allRenderers.SelectMany(r => r.sharedMaterials)
                               .Where(m => m != null).Distinct().ToList();

        // 셰이더마다 텍스처 프로퍼티 이름이 달라서, 이름을 가정하지 않고 전부 훑는다
        var shaderNames = mats.Select(m => m.shader != null ? m.shader.name : "(null)")
                              .Distinct().OrderBy(s => s).ToList();
        var boundTexProps = new SortedDictionary<string, int>();
        var texAssets = new HashSet<Texture>();

        foreach (var m in mats)
        {
            if (m.shader == null) continue;
            int n = m.shader.GetPropertyCount();
            for (int i = 0; i < n; i++)
            {
                if (m.shader.GetPropertyType(i) != UnityEngine.Rendering.ShaderPropertyType.Texture)
                    continue;
                var name = m.shader.GetPropertyName(i);
                var tex = m.GetTexture(name);
                if (tex == null) continue;
                boundTexProps.TryGetValue(name, out int c);
                boundTexProps[name] = c + 1;
                texAssets.Add(tex);
            }
        }

        sb.Append($"  \"gameObjects\": {transforms.Length},\n");
        sb.Append($"  \"meshRenderers\": {renderers.Length},\n");
        sb.Append($"  \"verts\": {verts},\n");
        sb.Append($"  \"tris\": {tris},\n");
        sb.Append($"  \"submeshes\": {submeshes},\n");
        sb.Append($"  \"meshesWithVertexColor\": {meshesWithColor},\n");
        sb.Append($"  \"materials\": {mats.Count},\n");
        sb.Append($"  \"textures\": {texAssets.Count},\n");
        sb.Append("  \"shaders\": [" +
                  string.Join(", ", shaderNames.Select(s => $"\"{Esc(s)}\"")) + "],\n");
        sb.Append("  \"boundTextureSlots\": {" +
                  string.Join(", ", boundTexProps.Select(kv => $"\"{Esc(kv.Key)}\": {kv.Value}")) +
                  "},\n");
        sb.Append($"  \"sizeUnits\": [{F(bounds.size.x)}, {F(bounds.size.y)}, {F(bounds.size.z)}],\n");

        // 스켈레탈: SkinnedMeshRenderer / Avatar / AnimationClip
        var smrs = inst.GetComponentsInChildren<SkinnedMeshRenderer>(true);
        sb.Append($"  \"skinnedMeshRenderers\": {smrs.Length},\n");
        if (smrs.Length > 0)
        {
            sb.Append($"  \"bones\": {smrs[0].bones.Length},\n");
            sb.Append($"  \"rootBone\": \"{Esc(smrs[0].rootBone ? smrs[0].rootBone.name : "(none)")}\",\n");
        }

        var subs = AssetDatabase.LoadAllAssetsAtPath(assetPath);
        var avatar = subs.OfType<Avatar>().FirstOrDefault();
        sb.Append($"  \"avatar\": \"{(avatar == null ? "none" : (avatar.isHuman ? "Humanoid" : "Generic"))}\",\n");
        sb.Append($"  \"avatarValid\": {(avatar != null && avatar.isValid ? "true" : "false")},\n");

        var clips = subs.OfType<AnimationClip>()
            .Where(c => !c.name.StartsWith("__preview"))
            .OrderBy(c => c.name)
            .ToList();
        sb.Append("  \"clips\": [" +
                  string.Join(", ", clips.Select(c => $"\"{Esc(c.name)} {c.length.ToString("0.###", CultureInfo.InvariantCulture)}s\"")) +
                  "],\n");

        var importer = AssetImporter.GetAtPath(assetPath) as ModelImporter;
        sb.Append($"  \"animationType\": \"{(importer == null ? "n/a" : importer.animationType.ToString())}\",\n");

        // 좌표계 변환 검증용.
        // 실측 결과: glTF(우손) -> Unity(좌손) 변환에서 뒤집히는 축은 X이고 Z는 보존된다.
        //   브라우저 집 x=-14.5, z=-17.5  ->  Unity x=+14.5, z=-17.5
        // 한 축만 반전 + 좌표계 손 변경이 상쇄되므로 형상이 거울로 뒤집히는 게 아니다.
        // 씬 전체가 Y축 180° 돌아 보이는 건 정상이며 고칠 대상이 아니다.
        // (규약: pipeline/contract.json conversions.gltfToUnity.axisFlip)
        var kids = new List<string>();
        var rootT = inst.transform.childCount == 1 ? inst.transform.GetChild(0) : inst.transform;
        for (int i = 0; i < Mathf.Min(rootT.childCount, 10); i++)
        {
            var c = rootT.GetChild(i);
            kids.Add($"[{F(c.localPosition.x)}, {F(c.localPosition.y)}, {F(c.localPosition.z)}]");
        }
        sb.Append("  \"childLocalPos\": [" + string.Join(", ", kids) + "],\n");
        sb.Append($"  \"rootScale\": [{F(inst.transform.localScale.x)}, {F(inst.transform.localScale.y)}, {F(inst.transform.localScale.z)}],\n");

        var png = Render(inst, bounds, rel.Replace('/', '_').Replace('.', '_'));
        sb.Append($"  \"render\": \"{Esc(png ?? "(실패)")}\"\n");
        sb.Append(" }");

        Object.DestroyImmediate(inst);
        return sb.ToString();
    }

    static string Render(GameObject target, Bounds b, string name)
    {
        const int W = 900, H = 560;

        var camGo = new GameObject("chk_cam");
        var cam = camGo.AddComponent<Camera>();
        cam.clearFlags = CameraClearFlags.SolidColor;
        cam.backgroundColor = new Color(0.93f, 0.93f, 0.93f, 1f);
        cam.fieldOfView = 40f;
        cam.nearClipPlane = 0.01f;
        cam.farClipPlane = 5000f;

        var lightGo = new GameObject("chk_light");
        var light = lightGo.AddComponent<Light>();
        light.type = LightType.Directional;
        light.intensity = 1.15f;
        light.transform.rotation = Quaternion.Euler(48f, -35f, 0f);

        // 세로로 긴 대상이 잘리지 않게 화면비를 반영해 반경을 잡는다
        float aspect = (float)W / H;
        float radius = Mathf.Max(Mathf.Max(b.size.x, b.size.z), b.size.y * aspect, 0.5f) * 0.5f;
        float dist = radius / Mathf.Tan(cam.fieldOfView * 0.5f * Mathf.Deg2Rad) * 1.45f;

        var dir = new Vector3(0.85f, 0.5f, -1f).normalized;
        camGo.transform.position = b.center + dir * dist;
        camGo.transform.LookAt(b.center);

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

        var bytes = tex.EncodeToPNG();
        var path = Path.Combine(OutDir, name + ".png");
        File.WriteAllBytes(path, bytes);

        cam.targetTexture = null;
        Object.DestroyImmediate(tex);
        rt.Release();
        Object.DestroyImmediate(rt);
        Object.DestroyImmediate(camGo);
        Object.DestroyImmediate(lightGo);

        return path;
    }
}
