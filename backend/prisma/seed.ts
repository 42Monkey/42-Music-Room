import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();
const SEED_PASSWORD = 'password123';

async function main() {
  console.log('🌱 Starting database seeding...');
  const passwordHash = await argon2.hash(SEED_PASSWORD);

  const users = [];
  for (let i = 0; i < 50; i++) {
    const email = `user${i + 1}@test.com`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash,
        displayName: `Test User ${i + 1}`,
        emailVerified: true,
        bio: `Seed bio for user ${i + 1}`,
        musicPreference: { genres: [['techno', 'jazz', 'rock'][i % 3]] },
      },
    });
    users.push(user);
  }
  console.log(`Created/Updated ${users.length} users.`);

  // Pre-accepted friendships using senderId and receiverId
  for (let i = 0; i < 10; i++) {
    await prisma.friendship.upsert({
      where: {
        senderId_receiverId: {
          senderId: users[i].id,
          receiverId: users[i + 1].id,
        },
      },
      update: { status: 'ACCEPTED' },
      create: {
        senderId: users[i].id,
        receiverId: users[i + 1].id,
        status: 'ACCEPTED',
      },
    });
  }

  console.log(`✅ Seeded 10 friendships successfully!`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
