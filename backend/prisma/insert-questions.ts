import { PrismaClient, QuestionType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const exam = await prisma.exam.findFirst();
  if (!exam) {
    console.log("No exam found. Run seed.ts first.");
    return;
  }

  await prisma.question.deleteMany({}); 

  // 1. 문제 은행에 문제 생성
  const q1 = await prisma.question.create({
    data: {
      category: 'Cloud', type: 'MULTIPLE_CHOICE',
      content: { text: "[사례 연구] A기업은 기존 온프레미스 인프라를 클라우드로 이전하면서 데이터 파이프라인 아키텍처를 재설계하려 합니다. 실시간 로그 수집을 충족하기 위해 도입해야 하는 가장 적절한 AWS 컴포넌트를 모두 고르시오.", options: ["AWS Kinesis (실시간 스트리밍)", "AWS S3 (데이터 레이크저장소)", "AWS IAM (계정 제어)", "Amazon CloudFront"] },
      correctAnswer: { answer: [0] }
    }
  });

  const q2 = await prisma.question.create({
    data: {
      category: 'Infra', type: 'MULTIPLE_CHOICE',
      content: { text: "다음 중 Docker 컨테이너의 장점으로 가장 거리가 먼 것은 무엇인가요?", options: ["OS 레벨 격리를 통한 경량화된 실행 환경 보장", "개발-운영 환경 일치로 인한 코드 베이스 이식성의 증가", "호스트 머신의 하드웨어 리소스를 100% 에뮬레이팅하여 가상화", "수 초 내의 매우 빠른 컨테이너 시작/종료 시간 및 스케일링"] },
      correctAnswer: { answer: [2] }
    }
  });

  const q3 = await prisma.question.create({
    data: {
      category: 'Architecture', type: 'MULTIPLE_CHOICE',
      content: { text: "Microservices Architecture (MSA) 패턴에서 여러 독립적인 서비스 간의 분산 트랜잭션과 데이터 정합성을 비동기적으로 보장하기 위해 롤백(보상 트랜잭션)을 함께 묶어 설계하는 이 패턴의 이름은 무엇입니까?", options: ["Saga Pattern (사가 패턴)", "Singleton Pattern (싱글톤 패턴)", "Circut Breaker (서킷 브레이커 패턴)", "API Gateway Pattern"] },
      correctAnswer: { answer: [0] }
    }
  });

  // 2. 시험지에 문제 매핑 (ExamQuestion)
  await prisma.examQuestion.createMany({
    data: [
      { examId: exam.id, questionId: q1.id, orderNum: 1, point: 30 },
      { examId: exam.id, questionId: q2.id, orderNum: 2, point: 30 },
      { examId: exam.id, questionId: q3.id, orderNum: 3, point: 40 },
    ]
  });

  console.log("Question Pool & Exam Mapping set up perfectly!");
}

main().finally(async () => {
  await prisma.$disconnect();
});
