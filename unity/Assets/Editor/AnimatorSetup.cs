// Animator 컨트롤러를 코드로 만든다.
//
// 구성: Speed(float) 하나로 Idle-Walk-Run을 1D 블렌드 트리로 섞고,
//       Airborne(bool)로 Air 상태를 오간다.
// 임계값은 브라우저의 실제 이동 속도를 그대로 쓴다 (WALK 3.3, SPRINT 6.4 m/s).
// 그래야 컨트롤러 파라미터에 속도를 그대로 꽂으면 케이던스가 맞는다.
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Animations;
using UnityEngine;

public static class AnimatorSetup
{
    public const string CharacterFbx = "Assets/ProceduralImport/fbx_loose/character.fbx";
    public const string ControllerPath = "Assets/Animations/CharacterLocomotion.controller";

    const float WalkSpeed = 3.3f;   // controls.js WALK
    const float RunSpeed = 6.4f;    // controls.js SPRINT

    static AnimationClip FindClip(string needle)
    {
        return AssetDatabase.LoadAllAssetsAtPath(CharacterFbx)
            .OfType<AnimationClip>()
            .Where(c => !c.name.StartsWith("__preview"))
            .FirstOrDefault(c => c.name.ToLower().EndsWith(needle.ToLower()));
    }

    // 포스트프로세서 설정을 바꿔도 이미 임포트된 에셋은 다시 읽지 않는다.
    // .meta를 지워서 강제하면 전체 에셋 리프레시가 유발되므로, 해당 에셋만
    // 콕 집어 재임포트한다. 아바타가 휴머노이드가 아닐 때만 도므로 평소엔 공짜다.
    static void EnsureHumanoid()
    {
        var avatar = AssetDatabase.LoadAllAssetsAtPath(CharacterFbx)
            .OfType<Avatar>().FirstOrDefault();
        if (avatar != null && avatar.isHuman) return;

        Debug.Log($"REIMPORT {CharacterFbx} (avatar={(avatar == null ? "none" : "non-human")})");
        AssetDatabase.ImportAsset(
            CharacterFbx,
            ImportAssetOptions.ForceUpdate | ImportAssetOptions.ForceSynchronousImport);
    }

    public static AnimatorController Build()
    {
        Directory.CreateDirectory(Path.Combine(Application.dataPath, "Animations"));
        EnsureHumanoid();

        var idle = FindClip("Idle");
        var walk = FindClip("Walk");
        var run = FindClip("Run");
        var air = FindClip("Air");
        if (idle == null || walk == null || run == null || air == null)
        {
            Debug.LogError($"클립 누락 idle={idle} walk={walk} run={run} air={air}");
            return null;
        }
        Debug.Log($"ANIMATOR clips: {idle.name}({idle.length:0.###}s loop={idle.isLooping}) " +
                  $"{walk.name}({walk.length:0.###}s loop={walk.isLooping}) " +
                  $"{run.name}({run.length:0.###}s loop={run.isLooping}) " +
                  $"{air.name}({air.length:0.###}s loop={air.isLooping})");

        AssetDatabase.DeleteAsset(ControllerPath);
        var ctrl = AnimatorController.CreateAnimatorControllerAtPath(ControllerPath);
        ctrl.AddParameter("Speed", AnimatorControllerParameterType.Float);
        ctrl.AddParameter("Airborne", AnimatorControllerParameterType.Bool);

        var sm = ctrl.layers[0].stateMachine;

        // 1D 블렌드 트리: Speed로 Idle -> Walk -> Run
        var loco = ctrl.CreateBlendTreeInController("Locomotion", out BlendTree tree, 0);
        tree.blendType = BlendTreeType.Simple1D;
        tree.blendParameter = "Speed";
        tree.useAutomaticThresholds = false;
        tree.AddChild(idle, 0f);
        tree.AddChild(walk, WalkSpeed);
        tree.AddChild(run, RunSpeed);

        var airState = sm.AddState("Air");
        airState.motion = air;

        var toAir = loco.AddTransition(airState);
        toAir.hasExitTime = false;
        toAir.duration = 0.08f;
        toAir.AddCondition(AnimatorConditionMode.If, 0f, "Airborne");

        var toLoco = airState.AddTransition(loco);
        toLoco.hasExitTime = false;
        toLoco.duration = 0.14f;
        toLoco.AddCondition(AnimatorConditionMode.IfNot, 0f, "Airborne");

        sm.defaultState = loco;

        EditorUtility.SetDirty(ctrl);
        AssetDatabase.SaveAssets();

        Debug.Log($"ANIMATOR_BUILT {ControllerPath}  " +
                  $"states={sm.states.Length} params={ctrl.parameters.Length} " +
                  $"blendChildren={tree.children.Length}");
        return ctrl;
    }

    // 컨트롤러가 실제로 본을 움직이는지 확인한다.
    // 에디터 모드에서도 Animator.Update()로 평가가 되므로 Play 없이 검증 가능하다.
    // Speed를 0 -> 3.3 -> 6.4로 바꿔가며 본 각도가 변하는지, 그리고 워크 사이클을
    // 연속 렌더해서 눈으로도 볼 수 있게 남긴다.
    public static void Verify()
    {
        var scene = UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene();
        var chr = GameObject.Find("VacantLot/character");
        if (chr == null)
        {
            Debug.LogError("씬에서 character 를 찾을 수 없음");
            return;
        }
        var animator = chr.GetComponent<Animator>();
        if (animator == null || animator.runtimeAnimatorController == null)
        {
            Debug.LogError("Animator 또는 컨트롤러가 없음");
            return;
        }

        var arm = FindDeep(chr.transform, "LeftUpperArm");
        var leg = FindDeep(chr.transform, "LeftUpperLeg");
        if (arm == null || leg == null)
        {
            Debug.LogError("본을 찾을 수 없음 (휴머노이드 리타게팅으로 이름이 바뀌었을 수 있음)");
            return;
        }

        // 메시의 시각적 정면이 로컬 어느 쪽인지 정점으로 판정한다.
        // 발 박스는 z=+0.045에 놓여 있어 발끝이 한쪽으로 0.17, 뒤꿈치는 0.08만 나온다
        // (브라우저 기준 +Z가 발끝). 이 비대칭으로 왕복 중 180° 돌았는지 알 수 있다.
        var smr = chr.GetComponentInChildren<SkinnedMeshRenderer>();
        if (smr != null && smr.sharedMesh != null)
        {
            var verts = smr.sharedMesh.vertices;
            float fMinZ = 999f, fMaxZ = -999f;
            foreach (var v in verts)
            {
                if (v.y >= 0.15f) continue;      // 발 높이만
                fMinZ = Mathf.Min(fMinZ, v.z);
                fMaxZ = Mathf.Max(fMaxZ, v.z);
            }
            var toeSide = Mathf.Abs(fMaxZ) > Mathf.Abs(fMinZ) ? "+Z" : "-Z";
            Debug.Log($"FACING 발 높이 z범위 {fMinZ:0.###} ~ {fMaxZ:0.###}  ->  발끝은 로컬 {toeSide}" +
                      $"  (브라우저는 +Z, 다르면 왕복 중 180° 회전)");
        }

        float Norm(float d) => d > 180f ? d - 360f : d;

        foreach (var speed in new[] { 0f, WalkSpeed, RunSpeed })
        {
            animator.Rebind();
            animator.SetBool("Airborne", false);
            animator.SetFloat("Speed", speed);
            animator.Update(0f);

            float min = 999f, max = -999f;
            for (int i = 0; i < 60; i++)
            {
                animator.Update(1f / 60f);
                var x = Norm(arm.localEulerAngles.x);
                min = Mathf.Min(min, x);
                max = Mathf.Max(max, x);
            }
            Debug.Log($"ANIMATOR_RUN Speed={speed,4:0.0}  LeftUpperArm.x 범위 " +
                      $"{min,7:0.00}~{max,7:0.00}deg  진폭 {max - min,6:0.00}deg" +
                      $"  {(max - min > 1f ? "움직임" : "정지")}");
        }

        // Airborne 전환 확인
        animator.Rebind();
        animator.SetFloat("Speed", WalkSpeed);
        animator.SetBool("Airborne", true);
        for (int i = 0; i < 30; i++) animator.Update(1f / 60f);
        Debug.Log($"ANIMATOR_AIR state='{StateName(animator)}' " +
                  $"LeftUpperLeg.x={Norm(leg.localEulerAngles.x):0.00}deg (기대: 약 -31.5)");

        // 워크 사이클 연속 렌더
        animator.Rebind();
        animator.SetBool("Airborne", false);
        animator.SetFloat("Speed", WalkSpeed);
        animator.Update(0f);
        var walkClip = FindClip("Walk");
        var step = walkClip.length / 4f;
        for (int f = 0; f < 4; f++)
        {
            Shoot($"anim_walk_{f}");
            for (int i = 0; i < 8; i++) animator.Update(step / 8f);
        }
    }

    static string StateName(Animator a)
    {
        var info = a.GetCurrentAnimatorClipInfo(0);
        return info.Length > 0 ? info[0].clip.name : "(none)";
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

    static void Shoot(string name)
    {
        var cam = Camera.main;
        if (cam == null) return;

        const int W = 640, H = 720;
        var rt = new RenderTexture(W, H, 24, RenderTextureFormat.ARGB32) { antiAliasing = 4 };

        // 캐릭터를 크게 담기 위해 임시로 카메라를 옮긴다.
        // 오프셋을 눈대중으로 주면 프레이밍이 어긋나므로(실측: 다리만 잡혔다)
        // 렌더러 바운딩에서 중심과 반경을 구해 FOV로 거리를 계산한다.
        var chr = GameObject.Find("VacantLot/character");
        var keepPos = cam.transform.position;
        var keepRot = cam.transform.rotation;

        var rends = chr.GetComponentsInChildren<Renderer>(true);
        var b = rends[0].bounds;
        foreach (var r in rends) b.Encapsulate(r.bounds);

        var aspect = (float)W / H;
        var radius = Mathf.Max(Mathf.Max(b.size.x, b.size.z) / aspect, b.size.y, 0.5f) * 0.5f;
        var dist = radius / Mathf.Tan(cam.fieldOfView * 0.5f * Mathf.Deg2Rad) * 1.35f;

        var viewDir = new Vector3(0.55f, 0.12f, 0.83f).normalized;
        cam.transform.position = b.center + viewDir * dist;
        cam.transform.LookAt(b.center);

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
        File.WriteAllBytes(Path.Combine(dir, name + ".png"), tex.EncodeToPNG());

        cam.targetTexture = null;
        rt.Release();
        Object.DestroyImmediate(rt);
        Object.DestroyImmediate(tex);
        cam.transform.position = keepPos;
        cam.transform.rotation = keepRot;
        Debug.Log($"ANIM_SHOT {name}");
    }
}
