const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Safety: only touch our own dummy rows.
  await prisma.question.deleteMany({
    where: { category: { startsWith: 'Dummy/' } },
  });

  const categories = [
    'Dummy/CS',
    'Dummy/Frontend',
    'Dummy/Backend',
    'Dummy/DevOps',
    'Dummy/AI-Data',
  ];

  let created = 0;

  for (const category of categories) {
    // Parent passage used by linked questions (child can omit passage).
    const parent = await prisma.question.create({
      data: {
        category,
        type: 'MULTIPLE_CHOICE',
        content: {
          title: `${category} Passage`,
          passage:
            '(Dummy) Shared passage for linked questions. Used to test parent/child passage fallback.',
        },
        correctAnswer: null,
      },
    });
    created += 1;

    await prisma.question.create({
      data: {
        category,
        type: 'MULTIPLE_CHOICE',
        parentId: parent.id,
        content: {
          title: `${category} - Multiple Choice`,
          text: 'Which option is correct?',
          options: ['Option A (correct)', 'Option B', 'Option C', 'Option D'],
        },
        correctAnswer: { answer: [0] },
      },
    });
    created += 1;

    await prisma.question.create({
      data: {
        category,
        type: 'SHORT_ANSWER',
        content: {
          title: `${category} - Short Answer`,
          passage: 'Answer in one short phrase.',
          text: 'What is the keyword?',
          options: [],
        },
        correctAnswer: 'keyword',
      },
    });
    created += 1;

    await prisma.question.create({
      data: {
        category,
        type: 'FILL_IN_THE_BLANK',
        content: {
          title: `${category} - Fill In The Blank`,
          passage: 'Fill in the blank: ____ is used for container orchestration.',
          text: '(Blank)',
          options: [],
        },
        // Admin UI uses "options" as correct answers for this type; store an array of accepted values.
        correctAnswer: ['kubernetes', 'k8s'],
      },
    });
    created += 1;

    await prisma.question.create({
      data: {
        category,
        type: 'ESSAY',
        content: {
          title: `${category} - Essay`,
          passage: 'Write 3-5 sentences.',
          text: 'Explain the concept in your own words.',
          options: [],
        },
        correctAnswer: null,
      },
    });
    created += 1;
  }

  const byType = await prisma.question.groupBy({
    by: ['type'],
    where: { category: { startsWith: 'Dummy/' } },
    _count: { _all: true },
    orderBy: { type: 'asc' },
  });

  console.log(`Inserted dummy questions: ${created}`);
  for (const row of byType) {
    console.log(`${row.type}: ${row._count._all}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
