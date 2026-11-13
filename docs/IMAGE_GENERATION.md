# ImageGen 사용 방법 이미지 제작 기록

모드: 실제 내장 image_gen 도구. CLI/API 대체 생성은 사용하지 않았습니다.
참조 원본: 사용자가 제공한 zipone 제품 패키징 모의 이미지.png. 대표 파일은 public/assets/product-packaging-v2.png이며 수정 없이 복사했습니다.

## 최종 파일

- public/assets/how-height-v2.png: 측면 다이얼 조작과 상단 높이 관계
- public/assets/how-detect-v2.png: 전면 감지부 앞의 손, 직접 만지지 않고 열린 세로 집게
- public/assets/how-fabric-v2.png: 열린 세로 집게 사이에 지퍼 옆의 옷자락 삽입. 손가락은 밖에 위치
- public/assets/how-zip-v2.png: 닫힌 집게에 고정된 옷자락과 한 손의 지퍼 조작

## 공통 프롬프트 지침

Scientific-educational realistic product-use illustration, landscape 3:2. Match the exact reference: narrow curved ivory body, mint base rim, upward vertical ivory jaws with black inner pads, white upper platform, two round front sensing windows and one mint ribbed side height dial on the viewer's right. Keep the same front-right viewpoint, realistic anatomy, soft daylight, warm ivory background and white/mint palette. One step per separate scene. No long text, labels, step numbers, collage, horizontal desk clamp or extra product parts.

## 단계별 프롬프트

1. A single adult hand from the right gently rotates the mint RIGHT-SIDE HEIGHT DIAL. The front sensing windows remain visible and untouched. Show the raised upper platform and vertical jaws, with a small vertical double-headed arrow beside the height platform. No clothing or zipper.
2. One relaxed open hand approaches the TWO FRONT SENSING WINDOWS from the lower-left. The hand remains below and away from the TOP VERTICAL JAWS. Both upward jaws are visibly open with black pads facing inward. Do not show a hand manually opening the clamp. No clothing or arrows.
3. A close view of open upward jaws and the bottom hem of a mint zippered jacket. Place plain hem fabric adjacent to the zipper DOWN between the black pads. One hand holds cloth from above and outside the gap; all fingers remain outside. Keep the front windows and side dial recognizable. No zipper pulling yet.
4. A mint jacket on a cropped neutral torso. Closed upward jaws grip a narrow fold of its bottom hem immediately beside the zipper. Exactly one hand above pulls the ZIPPER PULL upward. The product anchors cloth only. No second hand supporting fabric or automatic zipper motion.

## 실제 보정 프롬프트

3. Keep product, hand anatomy, palette, angle and framing. Correct only garment placement: shift the zipper just LEFT of the left jaw, and lower a plain mint hem strip between the black pads. Make the fabric-to-pad contact visible. Keep fingers well above and outside the gap. No labels or additional hands.
4. Correct the physical fabric-to-clamp connection. Move ZipOne slightly RIGHT of the zipper and tuck a narrow fold of the jacket bottom hem down BETWEEN the closed upright jaws. Show a thin mint fabric strip sandwiched by the black pads and a taut fold continuing into the jacket. The zipper remains just LEFT of the jaw assembly, unobstructed. Exactly one hand pulls the slider upward. Preserve body proportions, two front windows, right dial, vertical jaws and the same realistic illustration style.

손과 집게 방향, 제품의 일관성, 옷자락 접촉 위치를 원본 크기와 홈페이지의 PC·모바일 표시에서 직접 확인했습니다. 제품 설명 이미지이며 실제 기기의 물리적 성능을 검증하는 자료는 아닙니다.
