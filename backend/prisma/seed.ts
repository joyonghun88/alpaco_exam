import { PrismaClient } from '@prisma/client';
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  const exam = await prisma.exam.create({
    data: {
      title: '2026 상반기 디지털 혁신(DX) 아키텍처 평가',
      description: '클라우드 인프라 설계 및 데이터 파이프라인 구성 이해도 검증',
    }
  });

  const room = await prisma.examRoom.create({
    data: {
      examId: exam.id,
      roomName: 'A그룹 실무자 DX 평가장',
      startAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 시작: 1일전
      endAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 종료: 7일후
      durationMinutes: 60,
      status: 'IN_PROGRESS',
    }
  });

  await prisma.participant.create({
    data: {
      roomId: room.id,
      invitationCode: 'ALPACO-2026-DX01',
      name: '홍길동',
      email: 'hong@alpaco.io',
      status: 'READY'
    }
  });

  console.log('초기 더미 데이터 세팅 완료 (초대코드: ALPACO-2026-DX01)');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
