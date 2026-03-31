import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const WORDS_LIST = [
  // Easy
  { word: 'cat', difficulty: 'easy' },
  { word: 'dog', difficulty: 'easy' },
  { word: 'sun', difficulty: 'easy' },
  { word: 'car', difficulty: 'easy' },
  { word: 'tree', difficulty: 'easy' },
  { word: 'fish', difficulty: 'easy' },
  { word: 'ball', difficulty: 'easy' },
  { word: 'star', difficulty: 'easy' },
  { word: 'moon', difficulty: 'easy' },
  { word: 'house', difficulty: 'easy' },
  { word: 'apple', difficulty: 'easy' },
  { word: 'boat', difficulty: 'easy' },
  { word: 'bird', difficulty: 'easy' },
  { word: 'cake', difficulty: 'easy' },
  { word: 'rain', difficulty: 'easy' },
  { word: 'hat', difficulty: 'easy' },
  { word: 'cup', difficulty: 'easy' },

  // Medium
  { word: 'guitar', difficulty: 'medium' },
  { word: 'dragon', difficulty: 'medium' },
  { word: 'rocket', difficulty: 'medium' },
  { word: 'castle', difficulty: 'medium' },
  { word: 'pirate', difficulty: 'medium' },
  { word: 'wizard', difficulty: 'medium' },
  { word: 'jungle', difficulty: 'medium' },
  { word: 'planet', difficulty: 'medium' },
  { word: 'anchor', difficulty: 'medium' },
  { word: 'balloon', difficulty: 'medium' },
  { word: 'camera', difficulty: 'medium' },
  { word: 'diamond', difficulty: 'medium' },
  { word: 'garden', difficulty: 'medium' },
  { word: 'helmet', difficulty: 'medium' },
  { word: 'island', difficulty: 'medium' },
  { word: 'knight', difficulty: 'medium' },
  { word: 'laptop', difficulty: 'medium' },
  { word: 'museum', difficulty: 'medium' },
  { word: 'ocean', difficulty: 'medium' },
  { word: 'penguin', difficulty: 'medium' },
  { word: 'rainbow', difficulty: 'medium' },

  // Hard
  { word: 'philosophy', difficulty: 'hard' },
  { word: 'democracy', difficulty: 'hard' },
  { word: 'evolution', difficulty: 'hard' },
  { word: 'nostalgia', difficulty: 'hard' },
  { word: 'sarcasm', difficulty: 'hard' },
  { word: 'labyrinth', difficulty: 'hard' },
  { word: 'astronaut', difficulty: 'hard' },
  { word: 'saxophone', difficulty: 'hard' },
  { word: 'telescope', difficulty: 'hard' },
  { word: 'alchemist', difficulty: 'hard' },
  { word: 'blueprint', difficulty: 'hard' },
  { word: 'conductor', difficulty: 'hard' },
  { word: 'espionage', difficulty: 'hard' },
  { word: 'hurricane', difficulty: 'hard' },
  { word: 'mythology', difficulty: 'hard' },
  { word: 'paradox', difficulty: 'hard' },
];

async function main() {
  console.log('🌱 Seeding SketchBattle database...\n');

  // Create test users
  const password1 = await bcrypt.hash('testpass123', 12);
  const password2 = await bcrypt.hash('testpass456', 12);

  const user1 = await prisma.user.upsert({
    where: { email: 'testuser1@sketchbattle.dev' },
    update: {},
    create: {
      username: 'TestUser1',
      email: 'testuser1@sketchbattle.dev',
      passwordHash: password1,
      isGuest: false,
    },
  });
  console.log(`✅ Created user: ${user1.username} (${user1.id})`);

  const user2 = await prisma.user.upsert({
    where: { email: 'testuser2@sketchbattle.dev' },
    update: {},
    create: {
      username: 'TestUser2',
      email: 'testuser2@sketchbattle.dev',
      passwordHash: password2,
      isGuest: false,
    },
  });
  console.log(`✅ Created user: ${user2.username} (${user2.id})`);

  // Create default word pack
  const wordPack = await prisma.wordPack.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Default Pack',
      ownerUserId: null,
      isPublic: true,
    },
  });
  console.log(`✅ Created word pack: ${wordPack.name}`);

  // Insert words
  for (const w of WORDS_LIST) {
    await prisma.word.create({
      data: {
        packId: wordPack.id,
        word: w.word,
        difficulty: w.difficulty,
      },
    });
  }
  console.log(`✅ Inserted ${WORDS_LIST.length} words\n`);

  console.log('🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
