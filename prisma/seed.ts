import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const testOrder = await prisma.order.create({
    data: {
      recipientName: 'Bob',
      personality: 'A loving father and grandfather who loves fishing',
      genre: 'Country & Folk',
      status: 'completed',
      audioUrl: '/test-song.mp3',
      lyrics: '[Verse 1]\nSeventy candles glow\non a table set for you\nForty years in Houston heat\nyou wore that hardhat through\n\nYou built our home with tired hands\nand came back every night\nThree kids grew up on your good name\nand your steady light\n\n[Chorus]\nHappy birthday, Bob\nyou carried us home\nHappy birthday, Bob\nyou made our house a home\nWe love you so much\nfor every mile you gave\nHappy birthday, Bob\nour best part every day',
      title: 'Bob on Conroe',
      duration: '3:00',
    },
  });

  console.log(`Created test order with ID: ${testOrder.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });