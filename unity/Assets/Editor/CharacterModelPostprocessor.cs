// 캐릭터 FBX를 휴머노이드로 임포트하게 강제한다.
//
// Unity FBX 임포터의 기본값은 Generic이고, 그 상태로는 Avatar가 만들어지지 않아
// Mecanim 리타게팅을 못 쓴다. 본 이름을 Unity 관례(Hips/Spine/LeftUpperArm ...)로
// 지어놨으므로 Human으로 지정하면 아바타 매퍼가 자동으로 잡는다.
//
// 임포트 설정을 코드로 못 박아두면 재임포트할 때마다 손으로 다시 만질 필요가 없다.
using System.Linq;
using UnityEditor;
using UnityEngine;

public class CharacterModelPostprocessor : AssetPostprocessor
{
    void OnPreprocessModel()
    {
        var importer = assetImporter as ModelImporter;
        if (importer == null) return;

        var path = importer.assetPath.Replace('\\', '/');
        if (!path.Contains("ProceduralImport")) return;
        if (!path.ToLower().Contains("character")) return;

        // 설정값은 pipeline/contract.json 이 단일 출처다 (PipelineContract.g.cs 로 생성).
        importer.importAnimation = true;
        importer.animationType = PipelineContract.CharacterAnimationType == "Human"
            ? ModelImporterAnimationType.Human
            : ModelImporterAnimationType.Generic;
        importer.avatarSetup = ModelImporterAvatarSetup.CreateFromThisModel;

        // 블렌더 FBX는 단위 스케일(0.01)을 파일 헤더에 적어두고, Unity는
        // useFileScale=true 일 때 그걸 읽어 정규화한다.
        // false로 끄면 센티미터 값이 그대로 들어와 100배가 된다
        // (실측: 캐릭터 높이 1.775 -> 177.48 유닛).
        importer.useFileScale = PipelineContract.UseFileScale;

        Debug.Log($"POSTPROCESS {path} -> {PipelineContract.CharacterAnimationType}, " +
                  $"useFileScale={PipelineContract.UseFileScale}");
    }

    // FBX에서 들어온 클립은 기본이 비루프다. Walk/Run/Idle은 루프여야
    // 블렌드 트리에서 끊기지 않고 이어진다. Air는 단발이라 그대로 둔다.
    void OnPreprocessAnimation()
    {
        var importer = assetImporter as ModelImporter;
        if (importer == null) return;

        var path = importer.assetPath.Replace('\\', '/');
        if (!path.Contains("ProceduralImport")) return;
        if (!path.ToLower().Contains("character")) return;

        var clips = importer.defaultClipAnimations;
        if (clips == null || clips.Length == 0) return;

        foreach (var c in clips)
        {
            var n = c.name.ToLower();
            c.loopTime = PipelineContract.LoopClips.Any(k => n.Contains(k.ToLower()));
        }
        importer.clipAnimations = clips;
        Debug.Log($"POSTPROCESS_ANIM {path} -> loop set on " +
                  string.Join(", ", clips.Where(c => c.loopTime).Select(c => c.name)));
    }
}
