// 이 파일은 evals/make-demo-data.mjs 가 생성한다. 직접 고치지 말 것.
// 생성 시각: 2026-09-19T15:12:24.635Z
// 생성에 사용한 모델: ollama · qwen3:8b
//
// 실시간 호출이 실패했을 때(무료 할당량 소진, 키 없음 등) 화면이 비지 않도록
// 예시 입력에 한해 미리 계산해둔 결과다. 값은 실제 파이프라인의 출력이다.
import type { ClassifyResult } from "./classify";
import type { IssueGroup } from "./group";

export const DEMO_MODEL = "ollama:qwen3:8b";

const CLASSIFY: Record<string, ClassifyResult> = {
  "보스방 들어가자마자 가끔 캐릭터가 벽에 끼어서 못 움직여요. 재접속해야 풀림": {
    "category": "bug",
    "severity": "major",
    "summary": "보스방 진입 시 캐릭터가 벽에 끼어 움직일 수 없음",
    "reproSteps": [
      "보스방에 진입",
      "캐릭터가 벽에 끼는 현상 발생",
      "재접속 시 문제 해결"
    ]
  },
  "3챕터 중간보스가 너무 세요. 같은 레벨 다른 보스들보다 체력이 3배는 되는 느낌이라 진도가 안 나갑니다.": {
    "category": "balance",
    "severity": "major",
    "summary": "3챕터 중간보스의 체력이 다른 보스보다 3배로 너무 강해진다",
    "reproSteps": [
      "3챕터 중간보스를 공략하려고 한다",
      "같은 레벨의 다른 보스들과 비교해보면 체력이 3배로 느껴진다",
      "진도가 안 나가며 진행이 어려워진다"
    ]
  },
  "인벤토리 정렬 버튼이 어디 있는지 한참 찾았어요. 아이콘만 있고 설명이 없어서 뭔지 모르겠더라고요.": {
    "category": "ux",
    "severity": "minor",
    "summary": "인벤토리 정렬 버튼 위치가 어려워 찾기 어려웠음",
    "reproSteps": [
      "인벤토리 열기",
      "정렬 버튼 위치를 확인하려는 시도",
      "아이콘만 있고 설명이 없어 기능을 파악하지 못함"
    ]
  },
  "세이브하고 껐다 켜니까 캐릭터 진행도가 통째로 날아갔습니다. 3시간 플레이한 게 사라졌어요.": {
    "category": "bug",
    "severity": "critical",
    "summary": "세이브 후 재시작 시 캐릭터 진행도가 완전히 날라감",
    "reproSteps": [
      "게임을 플레이하다가 세이브를 진행합니다.",
      "게임을 껐다가 다시 켭니다.",
      "캐릭터의 진행도가 사라졌습니다."
    ]
  },
  "3챕터 보스방에서 벽 사이에 캐릭터가 박혀버렸어요. 나가지지도 않고 그냥 갇힘": {
    "category": "bug",
    "severity": "major",
    "summary": "3챕터 보스방에서 캐릭터가 벽 사이에 박혀 나가지 못해 갇힘",
    "reproSteps": [
      "3챕터 보스방에 진입",
      "벽 사이로 이동 시도",
      "캐릭터가 벽에 박혀 멈춤",
      "나가지 않고 갇힘 상태 유지"
    ]
  },
  "보스 방 입구 쪽 기둥에 끼면 이동이 안 됩니다. 로그아웃 말곤 방법이 없네요": {
    "category": "bug",
    "severity": "major",
    "summary": "보스 방 입구 기둥에 끼면 이동 불가",
    "reproSteps": [
      "보스 방 입구 쪽 기둥에 접근",
      "기둥에 끼면 이동이 중단됨",
      "로그아웃을 제외한 다른 방법으로 이동 불가"
    ]
  },
  "3챕터 중간보스가 너무 세요. 같은 레벨 다른 보스들보다 체력이 3배는 되는 느낌이라 진도가 안 나갑니다": {
    "category": "balance",
    "severity": "major",
    "summary": "3챕터 중간보스의 체력이 다른 보스보다 3배로 너무 강해진다",
    "reproSteps": [
      "3챕터 중간보스를 공략하려고 한다",
      "같은 레벨의 다른 보스들과 비교해보면 체력이 3배로 느껴진다",
      "진도가 안 나가며 진행이 어려워진다"
    ]
  },
  "3챕터 보스 난이도 조정 좀 해주세요. 여기서만 20번 죽었습니다": {
    "category": "balance",
    "severity": "major",
    "summary": "3챕터 보스 난이도가 너무 높아 죽음",
    "reproSteps": [
      "3챕터 보스와 전투 중",
      "반복적으로 죽음"
    ]
  },
  "세이브하고 껐다 켜니까 캐릭터 진행도가 통째로 날아갔습니다. 3시간 플레이한 게 사라졌어요": {
    "category": "bug",
    "severity": "critical",
    "summary": "세이브 후 재시작 시 캐릭터 진행도가 완전히 날라감",
    "reproSteps": [
      "게임을 플레이하다가 세이브를 진행합니다.",
      "게임을 껐다가 다시 켭니다.",
      "캐릭터의 진행도가 전부 사라졌습니다."
    ]
  },
  "게임 종료 후 재접속하니 세이브 파일이 없어졌어요. 처음부터 다시 해야 합니다": {
    "category": "bug",
    "severity": "critical",
    "summary": "게임 종료 후 재접속 시 세이브 파일이 삭제됨",
    "reproSteps": [
      "게임을 진행 중인 상태에서 종료합니다.",
      "다시 접속하여 게임을 시작합니다.",
      "세이브 파일이 없어졌음을 확인합니다."
    ]
  },
  "인벤토리 정렬 버튼이 어디 있는지 한참 찾았어요. 아이콘만 있고 설명이 없어서 뭔지 모르겠더라고요": {
    "category": "ux",
    "severity": "minor",
    "summary": "인벤토리 정렬 버튼 위치 불명확, 아이콘만 제공해 설명 없어",
    "reproSteps": [
      "인벤토리 열기",
      "정렬 버튼 위치를 찾으려 시도",
      "아이콘만 보이고 설명이 없어 기능을 모르게 되는 상황 발생"
    ]
  },
  "튜토리얼 스킵 버튼을 눌러도 다음 대사로 안 넘어가요": {
    "category": "bug",
    "severity": "major",
    "summary": "튜토리얼 스킵 버튼 클릭 시 다음 대사로 이동하지 않음",
    "reproSteps": [
      "튜토리얼 화면에서 스킵 버튼을 클릭합니다.",
      "다음 대사로 넘어가지 않고 동일한 화면이 유지됩니다."
    ]
  },
  "대화 중에 배경음악이 갑자기 끊깁니다": {
    "category": "bug",
    "severity": "minor",
    "summary": "대화 중 배경음악이 갑자기 끊김",
    "reproSteps": [
      "대화 중에 있던 상태",
      "배경음악이 갑자기 중단됨"
    ]
  },
  "설정 화면에 \"해상돗\" 이라고 오타가 있어요": {
    "category": "other",
    "severity": "minor",
    "summary": "설정 화면에 '해상 Desmond' 오타 있음",
    "reproSteps": [
      "설정 메뉴 진입",
      "화면에서 '해상 Desmond' 텍스트 확인"
    ]
  },
  "사람 많은 마을에서 프레임이 20까지 떨어집니다": {
    "category": "other",
    "severity": "minor",
    "summary": "사람 많은 마을에서 프레임이 20까지 떨어진다",
    "reproSteps": [
      "사람 많은 마을에 진입",
      "플레이 중인 동안 프레임이 20까지 떨어짐"
    ]
  }
};

const GROUP_KEY = "보스방 진입 시 캐릭터가 벽에 끼어 움직일 수 없음|3챕터 보스방에서 캐릭터가 벽 사이에 박혀 나가지 못해 갇힘|보스 방 입구 기둥에 끼면 이동 불가|3챕터 중간보스의 체력이 다른 보스보다 3배로 너무 강해진다|3챕터 보스 난이도가 너무 높아 죽음|세이브 후 재시작 시 캐릭터 진행도가 완전히 날라감|게임 종료 후 재접속 시 세이브 파일이 삭제됨|인벤토리 정렬 버튼 위치 불명확, 아이콘만 제공해 설명 없어|튜토리얼 스킵 버튼 클릭 시 다음 대사로 이동하지 않음|대화 중 배경음악이 갑자기 끊김|설정 화면에 '해상 Desmond' 오타 있음|사람 많은 마을에서 프레임이 20까지 떨어진다";

const GROUPS: IssueGroup[] = [
  {
    "title": "보스방에서 캐릭터가 벽/기둥에 끼어 움직일 수 없음",
    "category": "bug",
    "severity": "major",
    "count": 3,
    "memberIndexes": [
      0,
      1,
      2
    ]
  },
  {
    "title": "세이브 데이터가 날라감",
    "category": "bug",
    "severity": "critical",
    "count": 2,
    "memberIndexes": [
      5,
      6
    ]
  },
  {
    "title": "3챕터 보스 난이도 및 체력이 너무 높아 진도가 안 나감",
    "category": "balance",
    "severity": "major",
    "count": 2,
    "memberIndexes": [
      3,
      4
    ]
  },
  {
    "title": "튜토리얼 스킵 버튼 클릭 시 다음 대사로 이동하지 않음",
    "category": "bug",
    "severity": "major",
    "count": 1,
    "memberIndexes": [
      8
    ]
  },
  {
    "title": "대화 중 배경음악이 갑자기 끊김",
    "category": "bug",
    "severity": "minor",
    "count": 1,
    "memberIndexes": [
      9
    ]
  },
  {
    "title": "인벤토리 정렬 버튼 위치 불명확, 아이콘만 제공해 설명 없어",
    "category": "ux",
    "severity": "minor",
    "count": 1,
    "memberIndexes": [
      7
    ]
  },
  {
    "title": "설정 화면 '해상 Desmond' 오타",
    "category": "other",
    "severity": "minor",
    "count": 1,
    "memberIndexes": [
      10
    ]
  },
  {
    "title": "사람 많은 마을에서 프레임 20프레임 떨어짐",
    "category": "other",
    "severity": "minor",
    "count": 1,
    "memberIndexes": [
      11
    ]
  }
];

const norm = (s: string) => s.trim().replace(/\s+/g, " ");

/** 예시 피드백이면 미리 계산해둔 분류를 돌려준다. 아니면 null. */
export function demoClassify(feedback: string): ClassifyResult | null {
  return CLASSIFY[norm(feedback)] ?? null;
}

/** 예시 12건 그대로일 때만 미리 계산해둔 묶음을 돌려준다. 아니면 null. */
export function demoGroup(items: ClassifyResult[]): IssueGroup[] | null {
  const key = items.map((r) => norm(r.summary)).join("|");
  return key === GROUP_KEY ? GROUPS : null;
}
